/**
 * @file grouping-logic.js
 * @description Lógica principal para agrupar separadores.
 */

import Logger from './logger.js';
import { settings, smartNameCache, saveSmartNameCache } from './settings-manager.js';
import { recentlyCreatedAutomaticGroups, injectionFailureMap } from './app-state.js';

// --- Constantes ---
const colors = ["blue", "red", "green", "yellow", "purple", "pink", "cyan", "orange"];
let colorIndex = 0;
const MAX_INJECTION_RETRIES = 3;

// --- Funções de Higienização ---

function sanitizeDomainName(domain) {
    if (!domain) return '';
    const tldsToRemove = (settings.domainSanitizationTlds || []).sort((a, b) => b.length - a.length);
    let name = domain.toLowerCase().replace(/^www\./, '');
    const tld = tldsToRemove.find(t => name.endsWith(t));
    if (tld) name = name.slice(0, -tld.length);
    return name.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function sanitizeTitle(title) {
    if (!title) return '';
    let cleanTitle = title.replace(/\s*([|–—-])\s*.*$/, '').trim();
    const noiseWords = settings.titleSanitizationNoise || [];
    const noiseRegex = noiseWords.map(word => new RegExp(`\\b${word}\\b`, 'i'));
    if (noiseRegex.some(regex => regex.test(cleanTitle))) {
        return title.split(/\||–|—/)[0].trim();
    }
    return cleanTitle.length > 2 ? cleanTitle : title;
}

// --- Funções de Verificação e Utilitários ---

export function isTabGroupable(tab) {
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http') || tab.pinned) {
        return false;
    }
    return !settings.exceptions.some(exception => exception && tab.url.includes(exception));
}

function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

function getBaseDomainName(url) {
    const hostname = getHostname(url);
    if (!hostname) return null;
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length > 2) {
        const tldIndex = parts.length - 2;
        if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(parts[tldIndex])) {
            return sanitizeDomainName(parts.slice(-3).join('.'));
        }
        return sanitizeDomainName(parts.slice(-2).join('.'));
    }
    return sanitizeDomainName(parts.join('.'));
}

export function getNextColor() {
    const color = colors[colorIndex];
    colorIndex = (colorIndex + 1) % colors.length;
    return color;
}

// --- Lógica Principal de Nomenclatura de Grupos (Refatorado) ---

/**
 * Tenta encontrar uma correspondência para o separador nas regras personalizadas do utilizador.
 * @param {browser.tabs.Tab} tab - O objeto do separador.
 * @returns {string|null} O nome do grupo da regra correspondente ou nulo.
 */
function findMatchingRule(tab) {
    const { url, title } = tab;
    const rules = settings.customRules || [];
    for (const rule of rules) {
        for (const pattern of rule.patterns || []) {
            try {
                const trimmedPattern = pattern.trim();
                if (!trimmedPattern) continue;

                const wildcardToRegex = p => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);

                if ((rule.type === 'url-wildcard' && wildcardToRegex(trimmedPattern).test(url)) ||
                    (rule.type === 'url-regex' && new RegExp(trimmedPattern).test(url)) ||
                    (rule.type === 'title-match' && title && title.toLowerCase().includes(trimmedPattern.toLowerCase()))) {
                    Logger.debug('findMatchingRule', `Regra personalizada '${rule.name}' correspondeu.`, { rule, tab });
                    return rule.name;
                }
            } catch (e) {
                Logger.warn('findMatchingRule', `Regex inválida na regra '${rule.name}': ${pattern}`, e);
            }
        }
    }
    return null;
}

/**
 * Tenta extrair um "nome inteligente" da página web injetando um script de conteúdo.
 * @param {browser.tabs.Tab} tab - O objeto do separador.
 * @returns {Promise<string|null>} O nome inteligente encontrado ou nulo.
 */
async function fetchSmartName(tab) {
    const tabId = tab.id;
    const hostname = getHostname(tab.url);
    
    const failureCount = injectionFailureMap.get(tabId) || 0;
    if (failureCount >= MAX_INJECTION_RETRIES) {
        Logger.warn('fetchSmartName', `Máximo de falhas de injeção atingido para a aba ${tabId}.`);
        return null;
    }

    try {
        Logger.debug('fetchSmartName', `A tentar injeção de script na aba ${tabId}...`);
        const injectionResults = await browser.scripting.executeScript({
            target: { tabId },
            files: ['content-script.js'],
        });
        
        injectionFailureMap.delete(tabId); // Limpa falhas em caso de sucesso

        if (injectionResults && injectionResults[0] && injectionResults[0].result) {
            const details = injectionResults[0].result;
            const nameSources = [
                details.ogSiteName, details.applicationName, details.schemaName,
                details.twitterAppName, details.dcPublisher,
                details.twitterSite ? details.twitterSite.replace('@', '') : null,
                details.logoAltText
            ];

            const smartName = nameSources.find(name => name);
            if (smartName) {
                const cleanName = sanitizeTitle(smartName);
                Logger.info('fetchSmartName', `Nome inteligente encontrado: '${cleanName}' para o anfitrião '${hostname}'.`);
                smartNameCache.set(hostname, cleanName);
                saveSmartNameCache();
                return cleanName;
            }
        }
    } catch (e) {
        const newFailureCount = (injectionFailureMap.get(tabId) || 0) + 1;
        injectionFailureMap.set(tabId, newFailureCount);
        Logger.warn('fetchSmartName', `Falha ao injetar script na aba ${tabId} (tentativa ${newFailureCount}): ${e.message}`);
    }
    
    return null;
}

/**
 * Determina o nome final do grupo para um determinado separador.
 * @param {browser.tabs.Tab} tab - O objeto do separador.
 * @returns {Promise<string|null>} O nome final do grupo.
 */
export async function getFinalGroupName(tab) {
    if (!isTabGroupable(tab)) return null;

    // 1. Prioridade máxima: Regras personalizadas
    const ruleName = findMatchingRule(tab);
    if (ruleName) return ruleName;

    const hostname = getHostname(tab.url);
    if (!hostname) return null;

    // 2. Verificar cache de nomes inteligentes
    if (smartNameCache.has(hostname)) {
        return smartNameCache.get(hostname);
    }

    // 3. Tentar obter nome inteligente se o modo estiver ativo
    if (settings.groupingMode === 'smart') {
        const smartName = await fetchSmartName(tab);
        if (smartName) return smartName;
    }

    // 4. Fallback para modos de agrupamento por domínio
    const fallbackName = (settings.groupingMode === 'smart' || settings.groupingMode === 'subdomain')
        ? sanitizeDomainName(hostname)
        : getBaseDomainName(tab.url);

    Logger.debug('getFinalGroupName', `Nome final (fallback): '${fallbackName}' para o url ${tab.url}`);
    return fallbackName;
}

/**
 * Processa uma fila de separadores para os agrupar.
 * @param {number[]} tabIds - Uma lista de IDs de separadores a processar.
 */
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
            
            const groupNamePromises = allTabsInWindow.map(async tab => ({ tabId: tab.id, groupName: await getFinalGroupName(tab) }));
            const tabIdToGroupName = new Map((await Promise.all(groupNamePromises)).map(item => [item.tabId, item.groupName]));
            
            const groupNameCounts = new Map();
            for (const name of tabIdToGroupName.values()) {
                if (name) groupNameCounts.set(name, (groupNameCounts.get(name) || 0) + 1);
            }
            
            for (const tab of queuedTabsInWindow) {
                if (settings.manualGroupIds.includes(tab.groupId)) continue;

                const finalGroupName = tabIdToGroupName.get(tab.id);
                const currentGroup = tab.groupId ? allGroupsInWindow.find(g => g.id === tab.groupId) : null;
                const currentCleanTitle = currentGroup ? (currentGroup.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, '') : null;

                if (!finalGroupName) {
                    if (tab.groupId) tabsToUngroup.add(tab.id);
                    continue;
                }
                
                if (finalGroupName === currentCleanTitle) continue;

                const matchedRule = settings.customRules.find(r => r.name === finalGroupName);
                const minTabsRequired = matchedRule ? (matchedRule.minTabs || 1) : (settings.suppressSingleTabGroups ? 2 : 1);
                
                if ((groupNameCounts.get(finalGroupName) || 0) < minTabsRequired) {
                    if (tab.groupId) tabsToUngroup.add(tab.id);
                    continue;
                }

                if (!groupActions.has(finalGroupName)) {
                     groupActions.set(finalGroupName, {
                        tabsToGroup: [],
                        color: (matchedRule && matchedRule.color) ? matchedRule.color : getNextColor(),
                        isNew: !groupTitleToIdMap.has(finalGroupName)
                    });
                }
                groupActions.get(finalGroupName).tabsToGroup.push(tab.id);
            }

            if (tabsToUngroup.size > 0) {
                await browser.tabs.ungroup(Array.from(tabsToUngroup)).catch(e => Logger.error("processTabQueue", "Erro ao desagrupar abas:", e));
            }

            for (const [groupName, action] of groupActions.entries()) {
                const tabsForAction = [...new Set(action.tabsToGroup)]; // Evitar duplicados
                if (tabsForAction.length === 0) continue;
                
                try {
                    const existingGroupId = groupTitleToIdMap.get(groupName);
                    if (existingGroupId && !settings.manualGroupIds.includes(existingGroupId)) {
                        await browser.tabs.group({ groupId: existingGroupId, tabIds: tabsForAction });
                    } else {
                        const allMatchingTabs = allTabsInWindow
                            .filter(t => tabIdToGroupName.get(t.id) === groupName && !settings.manualGroupIds.includes(t.groupId))
                            .map(t => t.id);

                        if(allMatchingTabs.length > 0) {
                            const newGroupId = await browser.tabs.group({ createProperties: { windowId }, tabIds: allMatchingTabs });
                            recentlyCreatedAutomaticGroups.add(newGroupId);
                            await browser.tabGroups.update(newGroupId, { title: groupName, color: action.color });
                            groupTitleToIdMap.set(groupName, newGroupId); // Atualiza o mapa para os próximos da fila
                        }
                    }
                } catch (e) {
                    Logger.error(`processTabQueue`, `Erro ao processar o grupo "${groupName}":`, e);
                }
            }
        }
        Logger.info('processTabQueue', 'Processamento em lote concluído.');
    } catch(e) {
        Logger.error("processTabQueue", "Erro grave ao processar a fila de abas:", e);
    }
}
