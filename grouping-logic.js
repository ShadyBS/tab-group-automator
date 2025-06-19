/**
 * @file grouping-logic.js
 * @description Core logic for grouping tabs.
 */

import Logger from './logger.js';
import { settings, smartNameCache, saveSmartNameCache } from './settings-manager.js';
import { recentlyCreatedAutomaticGroups, injectionFailureMap } from './app-state.js';

// --- Constantes ---
const colors = ["blue", "red", "green", "yellow", "purple", "pink", "cyan", "orange"];
let colorIndex = 0;
const MAX_INJECTION_RETRIES = 3;

// --- NOVAS FUNÇÕES DE HIGIENIZAÇÃO ---

/**
 * Limpa e formata um nome de domínio para ser mais legível.
 * @param {string} domain - O nome do domínio a ser limpo.
 * @returns {string} O nome do domínio higienizado.
 */
function sanitizeDomainName(domain) {
    if (!domain) return '';
    
    // Usa a lista de TLDs das configurações do utilizador, com um fallback para a lista padrão.
    const tldsToRemove = (settings.domainSanitizationTlds || []).sort((a, b) => b.length - a.length);
    let name = domain.toLowerCase().replace(/^www\./, ''); // Remove www.

    const tld = tldsToRemove.find(t => name.endsWith(t));
    if (tld) {
        name = name.slice(0, -tld.length);
    }
    
    const parts = name.split('.');
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}


/**
 * Limpa um título de página para remover texto genérico e desnecessário.
 * @param {string} title - O título da página.
 * @returns {string} O título higienizado.
 */
function sanitizeTitle(title) {
    if (!title) return '';

    // Remove texto genérico de SEO e separadores comuns no final
    let cleanTitle = title.replace(/\s*([|–—-])\s*.*$/, '').trim();

    // Usa a lista de palavras-ruído das configurações do utilizador para criar as regex.
    const noiseWords = settings.titleSanitizationNoise || [];
    const noiseRegex = noiseWords.map(word => new RegExp(word, 'i'));

    if (noiseRegex.some(regex => regex.test(cleanTitle))) {
        return title.split(/\||–|—/)[0].trim();
    }
    
    return cleanTitle.length > 2 ? cleanTitle : title;
}


export function isTabGroupable(tab) {
  if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http') || tab.pinned) {
    return false;
  }
  for (const exception of settings.exceptions) {
    if (exception && tab.url.includes(exception)) {
      return false;
    }
  }
  return true;
}

function getHostname(url) {
    if (!url || !url.startsWith('http')) return null;
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

// MODIFICADO: Esta função agora usa o higienizador
function getBaseDomainName(url) {
    const hostname = getHostname(url);
    if (!hostname) return null;
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length > 2) {
        const tldIndex = parts.length - 2;
        if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(parts[tldIndex]) && parts.length > 2) {
             return sanitizeDomainName(parts.slice(-3).join('.'));
        }
        return sanitizeDomainName(parts.slice(-2).join('.'));
    }
    return sanitizeDomainName(parts.join('.'));
}

export async function getFinalGroupName(tab) {
    if (!isTabGroupable(tab)) {
        return null;
    }

    const { url, title, id: tabId } = tab;
    Logger.debug('getFinalGroupName', `A determinar nome para a aba ${tabId}`, { url: tab.url, title });
    const hostname = getHostname(url);
    if (!hostname) return null;

    // 1. Verificação de Regras Personalizadas (MAIOR PRIORIDADE)
    const rules = settings.customRules || [];
    for (const rule of rules) {
        for (const pattern of rule.patterns || []) {
            try {
                const trimmedPattern = pattern.trim();
                if(!trimmedPattern) continue;
                if (rule.type === 'url-wildcard' && new RegExp(trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(url)) {
                    Logger.debug('getFinalGroupName', `Regra personalizada '${rule.name}' correspondeu.`, { rule, tab });
                    return rule.name;
                }
                if (rule.type === 'url-regex' && new RegExp(trimmedPattern).test(url)) {
                    Logger.debug('getFinalGroupName', `Regra personalizada '${rule.name}' correspondeu.`, { rule, tab });
                    return rule.name;
                }
                if (rule.type === 'title-match' && title && title.toLowerCase().includes(trimmedPattern.toLowerCase())) {
                    Logger.debug('getFinalGroupName', `Regra personalizada '${rule.name}' correspondeu.`, { rule, tab });
                    return rule.name;
                }
            } catch(e) { Logger.warn('getFinalGroupName', `Regex inválida na regra '${rule.name}': ${pattern}`); }
        }
    }

    // 2. Verificação de Cache (se nenhuma regra personalizada corresponder)
    if (smartNameCache.has(hostname)) {
        const cachedName = smartNameCache.get(hostname);
        Logger.debug('getFinalGroupName', `Cache hit para o anfitrião '${hostname}'. Nome: '${cachedName}'`);
        return cachedName;
    }

    // 3. Nomenclatura Inteligente (se ativada e nada encontrado acima)
    if (settings.groupingMode === 'smart') {
        const failureCount = injectionFailureMap.get(tabId) || 0;
        if (failureCount >= MAX_INJECTION_RETRIES) {
            Logger.warn('getFinalGroupName', `Máximo de falhas de injeção atingido para a aba ${tabId}. A usar nome de domínio base.`);
            return getBaseDomainName(url);
        }

        try {
            Logger.debug('getFinalGroupName', `A tentar injeção de script na aba ${tabId} para nome inteligente...`);
            const injectionResults = await browser.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content-script.js'],
            });
            
            injectionFailureMap.delete(tabId);

            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                const details = injectionResults[0].result;

                const potentialNames = [
                    { source: 'og:site_name', value: details.ogSiteName },
                    { source: 'application-name', value: details.applicationName },
                    { source: 'schema.org', value: details.schemaName },
                    { source: 'twitter:app:name', value: details.twitterAppName },
                    { source: 'DC.publisher', value: details.dcPublisher },
                    { source: 'twitter:site', value: details.twitterSite ? details.twitterSite.replace('@', '') : null },
                    { source: 'logo alt text', value: details.logoAltText }
                ];

                Logger.debug('getFinalGroupName', `Fontes de nomes inteligentes candidatas para '${hostname}':`, potentialNames.filter(p => p.value));

                const foundName = potentialNames.find(p => p.value);
                let smartName = foundName ? foundName.value : null;

                if (smartName) {
                    smartName = sanitizeTitle(smartName); // Higieniza mesmo os nomes inteligentes
                    Logger.info('getFinalGroupName', `Nome inteligente escolhido: '${smartName}' (Fonte: ${foundName.source}). A guardar no cache.`, { allDetails: details });
                    smartNameCache.set(hostname, smartName);
                    saveSmartNameCache();
                    return smartName;
                }

                if (details.pageTitle) {
                    const domainCore = getBaseDomainName(url).split('.')[0].toLowerCase();
                    let brandName = null;
                    if (details.pageTitle.length < 30 && details.pageTitle.toLowerCase().replace(/\s/g, '').includes(domainCore)) brandName = details.pageTitle;
                    if (!brandName) {
                        const titleParts = details.pageTitle.split(/\||–|-/);
                        if (titleParts.length > 1) {
                            const firstPart = titleParts[0].trim();
                            const lastPart = titleParts[titleParts.length - 1].trim();
                            if (firstPart.toLowerCase().replace(/\s/g, '').includes(domainCore)) brandName = firstPart;
                            else if (lastPart.toLowerCase().replace(/\s/g, '').includes(domainCore)) brandName = lastPart;
                        }
                    }
                    if (brandName && brandName.length < 40) {
                        const cleanBrandName = sanitizeTitle(brandName); // Higieniza o nome encontrado
                        Logger.info('getFinalGroupName', `Nome inteligente encontrado a partir do título: '${cleanBrandName}'. A guardar no cache.`);
                        smartNameCache.set(hostname, cleanBrandName);
                        saveSmartNameCache();
                        return cleanBrandName;
                    }
                }
            }
        } catch (e) {
            const newFailureCount = (injectionFailureMap.get(tabId) || 0) + 1;
            injectionFailureMap.set(tabId, newFailureCount);
            Logger.warn('getFinalGroupName', `Falha ao injetar script na aba ${tabId} (tentativa ${newFailureCount}): ${e.message}`);
        }
    }
    
    // 4. Fallback para modos de agrupamento (MODIFICADO para usar higienizadores)
    const fallbackName = (settings.groupingMode === 'smart' || settings.groupingMode === 'subdomain') 
        ? sanitizeDomainName(hostname) 
        : getBaseDomainName(url); // getBaseDomainName já higieniza
        
    Logger.debug('getFinalGroupName', `Nome final retornado (fallback): '${fallbackName}'`);
    return fallbackName;
}

export function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length;
  return color;
}

export async function processTabQueue(tabIds) {
    if (!settings.autoGroupingEnabled || tabIds.length === 0) return;
    Logger.info('processTabQueue', `Início do processamento em lote para ${tabIds.length} abas.`);

    try {
        const tabsToProcess = (await Promise.all(tabIds.map(id => browser.tabs.get(id).catch(() => null)))).filter(Boolean);
        if (tabsToProcess.length === 0) return;

        const tabsByWindow = tabsToProcess.reduce((acc, tab) => {
            if (!acc[tab.windowId]) acc[tab.windowId] = [];
            acc[tab.windowId].push(tab);
            return acc;
        }, {});

        for (const windowIdStr in tabsByWindow) {
            const windowId = parseInt(windowIdStr, 10);
            const queuedTabsInWindow = tabsByWindow[windowId];
            
            const allTabsInWindow = await browser.tabs.query({ windowId });
            const allGroupsInWindow = await browser.tabGroups.query({ windowId });
            const groupTitleToIdMap = new Map(allGroupsInWindow.map(g => [(g.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, ''), g.id]));

            const groupActions = new Map();
            const tabsToUngroup = new Set();
            const processedGroupNames = new Set();
            
            const groupNamePromises = allTabsInWindow.map(async tab => ({ tabId: tab.id, groupName: await getFinalGroupName(tab) }));
            const tabIdToGroupName = new Map((await Promise.all(groupNamePromises)).map(item => [item.tabId, item.groupName]));
            
            const groupNameCounts = new Map();
            for (const name of tabIdToGroupName.values()) {
                if (name) groupNameCounts.set(name, (groupNameCounts.get(name) || 0) + 1);
            }
            
            for (const tab of queuedTabsInWindow) {
                if (settings.manualGroupIds.includes(tab.groupId)) continue;
                const finalGroupName = tabIdToGroupName.get(tab.id);
                Logger.debug('processTabQueue', `A avaliar a aba ${tab.id}. Nome de grupo alvo: '${finalGroupName}'. Grupo atual: ${tab.groupId}`);
                if (processedGroupNames.has(finalGroupName)) continue;
                
                const currentGroup = tab.groupId ? allGroupsInWindow.find(g => g.id === tab.groupId) : null;
                const currentCleanTitle = currentGroup ? (currentGroup.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, '') : null;

                if (!finalGroupName) {
                    if (tab.groupId) {
                        Logger.debug('processTabQueue', `Aba ${tab.id} será desagrupada.`);
                        tabsToUngroup.add(tab.id);
                    }
                    continue;
                }
                
                if (finalGroupName === currentCleanTitle) continue;

                const isNewGroup = !groupTitleToIdMap.has(finalGroupName);
                if (isNewGroup) {
                    const matchedRule = settings.customRules.find(r => r.name === finalGroupName);
                    const minTabsRequired = matchedRule ? (matchedRule.minTabs || 1) : (settings.suppressSingleTabGroups ? 2 : 1);
                    const candidateCount = groupNameCounts.get(finalGroupName) || 0;
                    
                    if (candidateCount < minTabsRequired) {
                        if (tab.groupId) tabsToUngroup.add(tab.id);
                        continue;
                    }
                    
                    const allMatchingTabsInWindow = allTabsInWindow.filter(t => tabIdToGroupName.get(t.id) === finalGroupName);
                    const tabsForNewGroup = allMatchingTabsInWindow.filter(t => !settings.manualGroupIds.includes(t.groupId)).map(t => t.id);

                    if (tabsForNewGroup.length > 0) {
                        Logger.debug('processTabQueue', `Ação para criar novo grupo '${finalGroupName}' com ${tabsForNewGroup.length} abas.`);
                         groupActions.set(finalGroupName, {
                            tabsToGroup: tabsForNewGroup,
                            color: matchedRule && matchedRule.color ? matchedRule.color : getNextColor()
                        });
                        processedGroupNames.add(finalGroupName);
                    }
                } else {
                    Logger.debug('processTabQueue', `Aba ${tab.id} será adicionada ao grupo '${finalGroupName}'.`);
                    if (!groupActions.has(finalGroupName)) {
                        const matchedRule = settings.customRules.find(r => r.name === finalGroupName);
                        groupActions.set(finalGroupName, {
                            tabsToGroup: [],
                            color: matchedRule && matchedRule.color ? matchedRule.color : getNextColor()
                        });
                    }
                    groupActions.get(finalGroupName).tabsToGroup.push(tab.id);
                }
            }

            if (tabsToUngroup.size > 0) {
                try {
                    await browser.tabs.ungroup(Array.from(tabsToUngroup));
                } catch(e) { Logger.error("processTabQueue", "Erro ao desagrupar abas:", e); }
            }

            for (const [groupName, action] of groupActions.entries()) {
                if (action.tabsToGroup.length === 0) continue;
                try {
                    const existingGroupId = groupTitleToIdMap.get(groupName);
                    if (existingGroupId && !settings.manualGroupIds.includes(existingGroupId)) {
                        await browser.tabs.group({ groupId: existingGroupId, tabIds: action.tabsToGroup });
                    } else {
                        const newGroupId = await browser.tabs.group({ createProperties: { windowId }, tabIds: action.tabsToGroup });
                        recentlyCreatedAutomaticGroups.add(newGroupId);
                        await browser.tabGroups.update(newGroupId, { title: groupName, color: action.color });
                    }
                } catch(e) { Logger.error(`processTabQueue`, `Erro ao processar o grupo "${groupName}":`, e); }
            }
        }
        Logger.info('processTabQueue', 'Processamento em lote concluído.');
    } catch(e) {
        Logger.error("processTabQueue", "Erro grave ao processar a fila de abas:", e);
    }
}
