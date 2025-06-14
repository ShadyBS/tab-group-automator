/**
 * @file grouping-logic.js
 * @description Core logic for grouping tabs.
 */

import { settings, smartNameCache, saveSmartNameCache } from './settings-manager.js';

const colors = ["blue", "red", "green", "yellow", "purple", "pink", "cyan", "orange"];
let colorIndex = 0;

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
    const { url, title, id: tabId } = tab;
    if (!url || !url.startsWith('http')) return null;

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
        try {
            const injectionResults = await browser.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content-script.js'],
            });

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
                    saveSmartNameCache(); // Salva o cache
                    return smartName;
                }

                if (details.pageTitle) {
                    const titleParts = details.pageTitle.split(/\||–|-/);
                    if (titleParts.length > 1) {
                        const firstPart = titleParts[0].trim();
                        const lastPart = titleParts[titleParts.length - 1].trim();
                        const domainCore = getBaseDomainName(url).split('.')[0].toLowerCase();
                        let brandName = null;
                        if (firstPart.toLowerCase().replace(/\s/g, '').includes(domainCore)) brandName = firstPart;
                        else if (lastPart.toLowerCase().replace(/\s/g, '').includes(domainCore)) brandName = lastPart;
                        if (brandName && brandName.length < 40) {
                            smartNameCache.set(hostname, brandName);
                            saveSmartNameCache(); // Salva o cache
                            return brandName;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`Não foi possível injetar o script na aba ${tabId}: ${e.message}`);
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

export async function processTabQueue(tabIds) {
    if (!settings.autoGroupingEnabled || tabIds.length === 0) return;

    try {
        const tabsToProcess = (await Promise.all(tabIds.map(id => browser.tabs.get(id).catch(() => null)))).filter(Boolean);
        
        for (const tab of tabsToProcess) {
            if (tab.groupId !== browser.tabs.TAB_ID_NONE && settings.manualGroupIds.includes(tab.groupId)) {
                continue;
            }

            if (!isTabGroupable(tab)) {
                if (tab.groupId !== browser.tabs.TAB_ID_NONE) {
                    await browser.tabs.ungroup([tab.id]);
                }
                continue;
            }

            const finalGroupName = await getFinalGroupName(tab);
            const wasAlreadyGrouped = tab.groupId !== browser.tabs.TAB_ID_NONE;
            let currentGroup = null;

            if (wasAlreadyGrouped) {
                try {
                   currentGroup = await browser.tabGroups.get(tab.groupId);
                } catch(e) {
                    // CORREÇÃO: Se o grupo antigo não for encontrado (porque foi removido pelo navegador),
                    // defina currentGroup como nulo e continue a execução. Isso evita
                    // que um erro aqui interrompa a nomeação do novo grupo.
                    currentGroup = null;
                }
            }

            if (!finalGroupName) {
                if (wasAlreadyGrouped) await browser.tabs.ungroup([tab.id]);
                continue;
            }
            
            if (wasAlreadyGrouped && currentGroup && currentGroup.title.replace(/\s\(\d+\)$/, '') === finalGroupName) {
                continue;
            }

            const existingGroups = await browser.tabGroups.query({ windowId: tab.windowId });
            const targetGroup = existingGroups.find(g => g.title.replace(/\s\(\d+\)$/, '') === finalGroupName && !settings.manualGroupIds.includes(g.id));

            if (targetGroup) {
                await browser.tabs.group({ groupId: targetGroup.id, tabIds: [tab.id] });
            } else {
                const allTabsInWindow = await browser.tabs.query({ windowId: tab.windowId });
                const potentialTabs = [];
                for(const t of allTabsInWindow) {
                    if (isTabGroupable(t) && await getFinalGroupName(t) === finalGroupName) {
                        potentialTabs.push(t);
                    }
                }

                const matchedRule = settings.customRules.find(r => r.name === finalGroupName);
                const minTabsRequired = matchedRule ? (matchedRule.minTabs || 1) : (settings.suppressSingleTabGroups ? 2 : 1);

                if (potentialTabs.length < minTabsRequired) {
                    if (wasAlreadyGrouped) await browser.tabs.ungroup([tab.id]);
                    continue;
                }
                
                if (potentialTabs.length > 0) {
                    const newGroupId = await browser.tabs.group({ createProperties: { windowId: tab.windowId }, tabIds: potentialTabs.map(t => t.id) });
                    await browser.tabGroups.update(newGroupId, { title: finalGroupName, color: getNextColor() });
                }
            }
        }
    } catch(e) {
        console.error("[Queue] Erro ao processar a fila de abas:", e);
    }
}
