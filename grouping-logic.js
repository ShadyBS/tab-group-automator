/**
 * @file grouping-logic.js
 * @description Core logic for grouping tabs.
 */

import { settings, smartNameCache, saveSmartNameCache } from './settings-manager.js';
import { recentlyCreatedAutomaticGroups, injectionFailureMap } from './app-state.js';

// --- Constantes ---
const colors = ["blue", "red", "green", "yellow", "purple", "pink", "cyan", "orange"];
let colorIndex = 0;
const MAX_INJECTION_RETRIES = 3;


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

function getBaseDomainName(url) {
    const hostname = getHostname(url);
    if (!hostname) return null;
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length > 2) {
        const tldIndex = parts.length - 2;
        if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(parts[tldIndex]) && parts.length > 2) {
             return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    }
    return parts.join('.');
}

export async function getFinalGroupName(tab) {
    if (!isTabGroupable(tab)) {
        return null;
    }

    const { url, title, id: tabId } = tab;
    const hostname = getHostname(url);
    if (!hostname) return null;

    if (smartNameCache.has(hostname)) {
        return smartNameCache.get(hostname);
    }

    const rules = settings.customRules || [];
    for (const rule of rules) {
        for (const pattern of rule.patterns || []) {
            try {
                const trimmedPattern = pattern.trim();
                if(!trimmedPattern) continue;
                if (rule.type === 'url-wildcard' && new RegExp(trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(url)) return rule.name;
                if (rule.type === 'url-regex' && new RegExp(trimmedPattern).test(url)) return rule.name;
                if (rule.type === 'title-match' && title && title.toLowerCase().includes(trimmedPattern.toLowerCase())) return rule.name;
            } catch(e) { console.warn(`Regex inválida: ${pattern}`); }
        }
    }

    if (settings.groupingMode === 'smart') {
        const failureCount = injectionFailureMap.get(tabId) || 0;
        if (failureCount >= MAX_INJECTION_RETRIES) {
            return getBaseDomainName(url);
        }

        try {
            const injectionResults = await browser.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content-script.js'],
            });
            
            injectionFailureMap.delete(tabId);

            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                const details = injectionResults[0].result;
                const smartName = 
                    details.ogSiteName ||
                    details.applicationName ||
                    details.schemaName ||
                    details.twitterAppName ||
                    details.dcPublisher ||
                    (details.twitterSite ? details.twitterSite.replace('@', '') : null) ||
                    details.logoAltText;
                
                if (smartName) {
                    smartNameCache.set(hostname, smartName);
                    saveSmartNameCache();
                    return smartName;
                }

                if (details.pageTitle) {
                    const pageTitle = details.pageTitle;
                    const domainCore = getBaseDomainName(url).split('.')[0].toLowerCase();
                    let brandName = null;

                    if (pageTitle.length < 30 && pageTitle.toLowerCase().replace(/\s/g, '').includes(domainCore)) {
                        brandName = pageTitle;
                    }

                    if (!brandName) {
                        const titleParts = pageTitle.split(/\||–|-/);
                        if (titleParts.length > 1) {
                            const firstPart = titleParts[0].trim();
                            const lastPart = titleParts[titleParts.length - 1].trim();
                            
                            if (firstPart.toLowerCase().replace(/\s/g, '').includes(domainCore)) {
                                brandName = firstPart;
                            } else if (lastPart.toLowerCase().replace(/\s/g, '').includes(domainCore)) {
                                brandName = lastPart;
                            }
                        }
                    }
                    
                    if (brandName && brandName.length < 40) {
                        smartNameCache.set(hostname, brandName);
                        saveSmartNameCache();
                        return brandName;
                    }
                }
            }
        } catch (e) {
            const newFailureCount = (injectionFailureMap.get(tabId) || 0) + 1;
            injectionFailureMap.set(tabId, newFailureCount);
            console.warn(`Falha ao injetar script na aba ${tabId} (tentativa ${newFailureCount}): ${e.message}`);
        }
    }
    
    if (settings.groupingMode === 'smart' || settings.groupingMode === 'subdomain') return hostname;
    return getBaseDomainName(url);
}

export function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length;
  return color;
}

/**
 * [OTIMIZADO] Processa a fila de abas para agrupar.
 * Segue o padrão "Read-Process-Write" para máxima performance e robustez.
 * 1. Read: Lê o estado do navegador (abas, grupos) uma única vez por janela.
 * 2. Process: Decide todas as ações em memória, sem chamadas de API.
 * 3. Write: Executa todas as ações de agrupamento em lote.
 * @param {number[]} tabIds - IDs das abas a serem processadas.
 */
export async function processTabQueue(tabIds) {
    if (!settings.autoGroupingEnabled || tabIds.length === 0) return;

    try {
        // Obter os objetos completos das abas
        const tabsToProcess = (await Promise.all(tabIds.map(id => browser.tabs.get(id).catch(() => null)))).filter(Boolean);
        if (tabsToProcess.length === 0) return;

        // Agrupar abas por janela, pois as operações são por janela
        const tabsByWindow = tabsToProcess.reduce((acc, tab) => {
            if (!acc[tab.windowId]) {
                acc[tab.windowId] = [];
            }
            acc[tab.windowId].push(tab);
            return acc;
        }, {});

        // Processar cada janela independentemente
        for (const windowIdStr in tabsByWindow) {
            const windowId = parseInt(windowIdStr, 10);
            const queuedTabsInWindow = tabsByWindow[windowId];
            
            // --- 1. READ PHASE ---
            const allTabsInWindow = await browser.tabs.query({ windowId });
            const allGroupsInWindow = await browser.tabGroups.query({ windowId });
            const groupTitleToIdMap = new Map(allGroupsInWindow.map(g => [(g.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, ''), g.id]));

            // --- 2. PROCESS PHASE ---
            const groupActions = new Map(); // { groupName: { tabsToGroup: [], color: '...' } }
            const tabsToUngroup = new Set();
            
            // Mapear os nomes de grupo para todas as abas na janela para a lógica de minTabs
            const groupNamePromises = allTabsInWindow.map(async tab => ({ tabId: tab.id, groupName: await getFinalGroupName(tab) }));
            const tabIdToGroupName = new Map((await Promise.all(groupNamePromises)).map(item => [item.tabId, item.groupName]));
            
            // Contar o número total de abas candidatas para cada nome de grupo
            const groupNameCounts = new Map();
            for (const name of tabIdToGroupName.values()) {
                if (name) {
                    groupNameCounts.set(name, (groupNameCounts.get(name) || 0) + 1);
                }
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
                
                if (finalGroupName === currentCleanTitle) continue; // Já está no grupo certo

                // Verificar a regra minTabs para novos grupos
                const isNewGroup = !groupTitleToIdMap.has(finalGroupName);
                if (isNewGroup) {
                    const matchedRule = settings.customRules.find(r => r.name === finalGroupName);
                    const minTabsRequired = matchedRule ? (matchedRule.minTabs || 1) : (settings.suppressSingleTabGroups ? 2 : 1);
                    const candidateCount = groupNameCounts.get(finalGroupName) || 0;
                    if (candidateCount < minTabsRequired) {
                        if (tab.groupId) tabsToUngroup.add(tab.id);
                        continue;
                    }
                }
                
                // Adicionar ação de agrupamento
                if (!groupActions.has(finalGroupName)) {
                    const matchedRule = settings.customRules.find(r => r.name === finalGroupName);
                    groupActions.set(finalGroupName, {
                        tabsToGroup: [],
                        color: matchedRule && matchedRule.color ? matchedRule.color : getNextColor()
                    });
                }
                groupActions.get(finalGroupName).tabsToGroup.push(tab.id);
            }

            // --- 3. WRITE PHASE ---
            if (tabsToUngroup.size > 0) {
                try {
                    await browser.tabs.ungroup(Array.from(tabsToUngroup));
                } catch(e) { console.error("Erro ao desagrupar abas:", e); }
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
                } catch(e) { console.error(`Erro ao processar o grupo "${groupName}":`, e); }
            }
        }
    } catch(e) {
        console.error("[Queue] Erro grave ao processar a fila de abas:", e);
    }
}
