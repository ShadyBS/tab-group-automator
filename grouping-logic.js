/**
 * @file grouping-logic.js
 * @description Lógica principal para agrupar abas.
 */

import Logger from './logger.js';
import { settings, smartNameCache, saveSmartNameCache } from './settings-manager.js';
import { recentlyCreatedAutomaticGroups, injectionFailureMap } from './app-state.js';

// --- Constantes ---
const colors = ["blue", "red", "green", "yellow", "purple", "pink", "cyan", "orange"];
let colorIndex = 0;
const MAX_INJECTION_RETRIES = 3;

// --- FUNÇÕES DE HIGIENIZAÇÃO DE DOMÍNIO ---
function sanitizeDomainName(domain) {
    if (!domain) return '';
    const tldsToRemove = (settings.domainSanitizationTlds || []).sort((a, b) => b.length - a.length);
    let name = domain.toLowerCase().replace(/^www\./, '');
    const tld = tldsToRemove.find(t => name.endsWith(t));
    if (tld) name = name.slice(0, -tld.length);
    return name.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

// --- FUNÇÕES DE EXTRAÇÃO DE NOME DE MARCA DO TÍTULO ---
function chooseBestBrandSegment(segments, hostname, noiseWords = []) {
    if (segments.length === 1) return segments[0];
    
    const simplifiedHostname = hostname.toLowerCase().replace(/\.(com|org|net|br|io|dev)/g, '').replace(/[^a-z0-9]/g, '');

    const scoredSegments = segments.map(segment => {
        const simplifiedSegment = segment.toLowerCase().replace(/[^a-z0-9]/g, '');
        let score = segment.length;
        if (simplifiedHostname.includes(simplifiedSegment) || simplifiedSegment.includes(simplifiedHostname)) score -= 50;
        if (segment.charAt(0) === segment.charAt(0).toUpperCase() && segment.charAt(0) !== segment.charAt(0).toLowerCase()) score -= 5;
        for (const noise of noiseWords) {
            if (new RegExp(`\\b${noise}\\b`, 'i').test(segment)) score += 20;
        }
        return { text: segment, score };
    });

    scoredSegments.sort((a, b) => a.score - b.score);
    return scoredSegments[0].text;
}

function extractBrandNameFromTitle(title, hostname, separators = '', noiseWords = []) {
    if (!title || !hostname) return null;
    const cleanHostname = hostname.replace(/^www\./, '');
    if (!separators || separators.length === 0) return null;
    
    const escapedDelimiters = String(separators).split('').map(sep => sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    const regex = new RegExp(`[${escapedDelimiters}]`);
    
    const segments = title.split(regex).map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;

    const bestSegment = chooseBestBrandSegment(segments, cleanHostname, noiseWords);
    if (!bestSegment || bestSegment.length < 2 || bestSegment.length > 50) return null;
    return bestSegment;
}

// --- LÓGICA PRINCIPAL DE NOMENCLATURA DE GRUPOS ---

export function isTabGroupable(tab) {
    if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http') || tab.pinned) return false;
    return !settings.exceptions.some(exception => exception && tab.url.includes(exception));
}

function getHostname(url) {
    try { return new URL(url).hostname; } catch (e) { return null; }
}

function findMatchingRule(tab) {
    const { url, title } = tab;
    for (const rule of (settings.customRules || [])) {
        for (const pattern of (rule.patterns || [])) {
            try {
                const trimmedPattern = pattern.trim();
                if (!trimmedPattern) continue;
                if ((rule.type === 'url-wildcard' && new RegExp(trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(url)) ||
                    (rule.type === 'url-regex' && new RegExp(trimmedPattern).test(url)) ||
                    (rule.type === 'title-match' && title && title.toLowerCase().includes(trimmedPattern.toLowerCase()))) {
                    return rule.name;
                }
            } catch (e) {
                Logger.warn('findMatchingRule', `Regex inválida na regra '${rule.name}': ${pattern}`, e);
            }
        }
    }
    return null;
}

async function fetchSmartName(tab) {
    const tabId = tab.id;
    const failureCount = injectionFailureMap.get(tabId) || 0;
    if (failureCount >= MAX_INJECTION_RETRIES) {
        Logger.warn('fetchSmartName', `Máximo de falhas de injeção para a aba ${tabId}.`);
        return null;
    }
    try {
        const injectionResults = await browser.scripting.executeScript({
            target: { tabId },
            files: ['content-script.js'],
        });
        injectionFailureMap.delete(tabId);
        if (injectionResults && injectionResults[0] && injectionResults[0].result) {
            const details = injectionResults[0].result;
            return details.ogSiteName || details.applicationName || details.schemaName || details.ogTitle || details.h1Content || details.twitterAppName || details.dcPublisher || details.logoAltText;
        }
    } catch (e) {
        const newFailureCount = (injectionFailureMap.get(tabId) || 0) + 1;
        injectionFailureMap.set(tabId, newFailureCount);
        Logger.warn('fetchSmartName', `Falha ao injetar script na aba ${tabId} (tentativa ${newFailureCount}): ${e.message}`);
    }
    return null;
}

export async function getFinalGroupName(tab) {
    if (!isTabGroupable(tab)) return null;

    const ruleName = findMatchingRule(tab);
    if (ruleName) return ruleName;

    const hostname = getHostname(tab.url);
    if (!hostname) return null;

    if (smartNameCache.has(hostname)) {
        return smartNameCache.get(hostname);
    }
    
    let groupName = null;
    if (settings.groupingMode === 'smart') {
        groupName = await fetchSmartName(tab);
        if (!groupName) {
            groupName = extractBrandNameFromTitle(tab.title, hostname, settings.titleDelimiters, settings.titleSanitizationNoise);
        }
    }

    if (groupName) {
        smartNameCache.set(hostname, groupName);
        saveSmartNameCache();
        return groupName;
    }
    
    const fallbackName = sanitizeDomainName(hostname);
    smartNameCache.set(hostname, fallbackName);
    saveSmartNameCache();
    return fallbackName;
}

export function getNextColor() {
    const color = colors[colorIndex];
    colorIndex = (colorIndex + 1) % colors.length;
    return color;
}

export async function processTabQueue(tabIds) {
    if (!settings.autoGroupingEnabled || tabIds.length === 0) return;

    // MELHORIA DE LOG: Log inicial mais informativo.
    Logger.debug('processTabQueue', `Iniciando processamento. Abas na fila: ${tabIds.join(', ')}`);

    const tabsByWindow = {};
    const tabsToProcess = (await Promise.all(tabIds.map(id => browser.tabs.get(id).catch(() => null)))).filter(Boolean);
    if (tabsToProcess.length === 0) return;
    
    for (const tab of tabsToProcess) {
        (tabsByWindow[tab.windowId] = tabsByWindow[tab.windowId] || []).push(tab);
    }

    for (const windowIdStr in tabsByWindow) {
        const windowId = parseInt(windowIdStr, 10);
        const allTabsInWindow = await browser.tabs.query({ windowId });
        const allGroupsInWindow = await browser.tabGroups.query({ windowId });
        const groupTitleToIdMap = new Map(allGroupsInWindow.map(g => [(g.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, ''), g.id]));

        const groupNamePromises = allTabsInWindow.map(async tab => ({ tabId: tab.id, groupName: await getFinalGroupName(tab) }));
        const tabIdToGroupName = new Map((await Promise.all(groupNamePromises)).map(item => [item.tabId, item.groupName]));
        
        const groupNameCounts = new Map();
        for (const name of tabIdToGroupName.values()) {
            if (name) groupNameCounts.set(name, (groupNameCounts.get(name) || 0) + 1);
        }

        const tabsToGroup = new Map();
        for (const tab of allTabsInWindow) {
            if (settings.manualGroupIds.includes(tab.groupId)) continue;
            
            const finalGroupName = tabIdToGroupName.get(tab.id);
            if (!finalGroupName) {
                if(tab.groupId) await browser.tabs.ungroup([tab.id]).catch(()=>{});
                continue;
            }

            const currentGroup = tab.groupId ? allGroupsInWindow.find(g => g.id === tab.groupId) : null;
            const currentCleanTitle = currentGroup ? (currentGroup.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, '') : null;
            if (finalGroupName === currentCleanTitle) continue;

            if (!tabsToGroup.has(finalGroupName)) {
                tabsToGroup.set(finalGroupName, []);
            }
            tabsToGroup.get(finalGroupName).push(tab.id);
        }
        
        for(const [groupName, tabIdsForGroup] of tabsToGroup.entries()){
            const matchedRule = settings.customRules.find(r => r.name === groupName);
            const minTabsRequired = matchedRule ? (matchedRule.minTabs || 1) : (settings.suppressSingleTabGroups ? 2 : 1);
            
            // CORREÇÃO: Usa a contagem total de abas para este nome de grupo, não apenas as que estão sendo movidas.
            const totalMatchingTabs = groupNameCounts.get(groupName) || 0;
            
            // MELHORIA DE LOG: Mostra a decisão sobre o mínimo de abas.
            Logger.debug('processTabQueue', `Avaliando grupo '${groupName}'. Mínimo: ${minTabsRequired}, Encontradas: ${totalMatchingTabs}, Para mover: ${tabIdsForGroup.length}`);

            if (totalMatchingTabs < minTabsRequired) {
                Logger.debug('processTabQueue', `Grupo '${groupName}' não atingiu o mínimo de abas. Desagrupando ${tabIdsForGroup.join(', ')}.`);
                await browser.tabs.ungroup(tabIdsForGroup).catch(()=>{});
                continue;
            }

            try {
                const existingGroupId = groupTitleToIdMap.get(groupName);
                if (existingGroupId && !settings.manualGroupIds.includes(existingGroupId)) {
                    Logger.debug('processTabQueue', `Adicionando abas ${tabIdsForGroup.join(', ')} ao grupo existente '${groupName}' (${existingGroupId})`);
                    await browser.tabs.group({ groupId: existingGroupId, tabIds: tabIdsForGroup });
                } else if (!existingGroupId) {
                    Logger.debug('processTabQueue', `Criando novo grupo '${groupName}' com as abas ${tabIdsForGroup.join(', ')}`);
                    const newGroupId = await browser.tabs.group({ createProperties: { windowId }, tabIds: tabIdsForGroup });
                    recentlyCreatedAutomaticGroups.add(newGroupId);
                    const color = (matchedRule && matchedRule.color) ? matchedRule.color : getNextColor();
                    await browser.tabGroups.update(newGroupId, { title: groupName, color });
                    groupTitleToIdMap.set(groupName, newGroupId);
                }
            } catch (e) {
                Logger.error(`processTabQueue`, `Erro ao processar o grupo "${groupName}":`, e);
            }
        }
    }
}
