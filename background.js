/**
 * @file background.js
 * @description Ponto de entrada principal da extensão, gere eventos e a fila de processamento.
 */

import { settings, loadSettings, updateSettings } from './settings-manager.js';
import { processTabQueue } from './grouping-logic.js';
import { initializeContextMenus, updateContextMenus } from './context-menu-manager.js';
import { recentlyCreatedAutomaticGroups, pendingClassificationGroups } from './app-state.js';

// --- Constantes e Variáveis de Estado ---

const QUEUE_DELAY = 500;
const TITLE_UPDATE_DEBOUNCE = 250; // ms
const CLASSIFICATION_TIMEOUT = 500; // ms

let tabProcessingQueue = new Set();
let queueTimeout = null;
let tabGroupMap = new Map();
let debouncedTitleUpdaters = new Map();
let groupActivity = new Map();
let collapseInterval = null;
let ungroupInterval = null;
let singleTabGroupTimestamps = new Map();

// --- Lógica de Processamento e Gestão de Eventos (CORRIGIDA) ---

function scheduleQueueProcessing() {
    if (queueTimeout) clearTimeout(queueTimeout);
    queueTimeout = setTimeout(async () => {
        const tabsToProcess = Array.from(tabProcessingQueue);
        tabProcessingQueue.clear();
        await processTabQueue(tabsToProcess);
    }, QUEUE_DELAY);
}

/**
 * Lida com todas as atualizações de abas, incluindo carregamento de página e mudanças de grupo.
 */
function handleTabUpdated(tabId, changeInfo, tab) {
    // 1. Lógica para o contador de abas
    // Se o groupId da aba mudou, atualiza os contadores do grupo antigo e do novo.
    if (changeInfo.groupId !== undefined) {
        const oldGroupId = tabGroupMap.get(tabId);
        if (oldGroupId) {
            scheduleTitleUpdate(oldGroupId); // Agenda atualização para o grupo de onde a aba saiu.
        }
        scheduleTitleUpdate(changeInfo.groupId); // Agenda atualização para o grupo onde a aba entrou.
        tabGroupMap.set(tabId, changeInfo.groupId); // Atualiza o nosso mapa de estado.
    }

    // 2. Lógica para agrupamento automático
    // Se a página terminou de carregar, agenda a aba para possível agrupamento.
    if (settings.autoGroupingEnabled && changeInfo.status === 'complete' && tab.url) {
        tabProcessingQueue.add(tabId);
        scheduleQueueProcessing();
    }
}

// Lida com a remoção (fecho) de uma aba
function handleTabRemoved(tabId, removeInfo) {
    const oldGroupId = tabGroupMap.get(tabId);
    if (oldGroupId) {
        scheduleTitleUpdate(oldGroupId);
    }
    tabGroupMap.delete(tabId);
}


/**
 * Ativa ou desativa os listeners de eventos principais com base nas configurações.
 */
function toggleListeners(enable) {
    const hasUpdatedListener = browser.tabs.onUpdated.hasListener(handleTabUpdated);
    const hasRemovedListener = browser.tabs.onRemoved.hasListener(handleTabRemoved);

    if (enable) {
        if (!hasUpdatedListener) {
            // Escuta por mudanças de status (página carregada) e de grupo.
            browser.tabs.onUpdated.addListener(handleTabUpdated, { properties: ["status", "groupId"] });
        }
        if (!hasRemovedListener) {
            browser.tabs.onRemoved.addListener(handleTabRemoved);
        }
    } else {
        if (hasUpdatedListener) {
            browser.tabs.onUpdated.removeListener(handleTabUpdated);
        }
        if (hasRemovedListener) {
            browser.tabs.onRemoved.removeListener(handleTabRemoved);
        }
    }
}

// --- Lógica de Comportamento dos Grupos (Timers) ---

function updateAutoCollapseTimer() {
    if (collapseInterval) clearInterval(collapseInterval);
    collapseInterval = null;
    if (settings.autoCollapseTimeout > 0) {
        collapseInterval = setInterval(async () => {
            const timeoutMs = settings.autoCollapseTimeout * 1000;
            if (timeoutMs <= 0) return;
            try {
                const windows = await browser.windows.getAll({ windowTypes: ['normal'] });
                const now = Date.now();
                for (const window of windows) {
                    const activeTabs = await browser.tabs.query({ active: true, windowId: window.id });
                    const activeTabInWindow = activeTabs.length > 0 ? activeTabs[0] : null;
                    const groups = await browser.tabGroups.query({ windowId: window.id, collapsed: false });
                    for (const group of groups) {
                        if (activeTabInWindow && activeTabInWindow.groupId === group.id) {
                             groupActivity.set(group.id, now);
                             continue;
                        }
                        const lastActivityTime = groupActivity.get(group.id) || Date.now();
                        if (now - lastActivityTime > timeoutMs) {
                            await browser.tabGroups.update(group.id, { collapsed: true });
                            groupActivity.delete(group.id);
                        }
                    }
                }
            } catch (e) { console.error("Erro ao verificar grupos inativos:", e); }
        }, 5000);
    }
}

async function checkSingleTabGroups() {
    if (!settings.ungroupSingleTabs || settings.ungroupSingleTabsTimeout <= 0) return;
    const timeoutMs = settings.ungroupSingleTabsTimeout * 1000;
    const now = Date.now();
    try {
        const allGroups = await browser.tabGroups.query({});
        for (const group of allGroups) {
            if (settings.manualGroupIds.includes(group.id)) continue;

            const tabsInGroup = await browser.tabs.query({ groupId: group.id });
            if (tabsInGroup.length === 1) {
                const tabId = tabsInGroup[0].id;
                if (!singleTabGroupTimestamps.has(group.id)) {
                    singleTabGroupTimestamps.set(group.id, now);
                } else {
                    const timeEnteredState = singleTabGroupTimestamps.get(group.id);
                    if (now - timeEnteredState > timeoutMs) {
                        await browser.tabs.ungroup([tabId]);
                        singleTabGroupTimestamps.delete(group.id);
                    }
                }
            } else {
                 if (singleTabGroupTimestamps.has(group.id)) {
                    singleTabGroupTimestamps.delete(group.id);
                }
            }
        }
    } catch (e) { console.error("Erro ao verificar grupos com abas únicas:", e); }
}

function updateUngroupTimer() {
    if (ungroupInterval) clearInterval(ungroupInterval);
    ungroupInterval = null;
    if (settings.ungroupSingleTabs && settings.ungroupSingleTabsTimeout > 0) {
        ungroupInterval = setInterval(checkSingleTabGroups, 1500);
    }
}

async function handleTabActivated({ tabId }) {
  if (!settings.uncollapseOnActivate) return;
  try {
    const tab = await browser.tabs.get(tabId);
    if (tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
      const groupId = tab.groupId;
      const now = Date.now();
      groupActivity.set(groupId, now);
      const group = await browser.tabGroups.get(groupId);
      if (group && group.collapsed) await browser.tabGroups.update(groupId, { collapsed: false });
    }
  } catch (error) {}
}


// --- Lógica de Contagem e Títulos dos Grupos ---

async function updateGroupTitleWithCount(groupId) {
    if (!settings.showTabCount || !groupId || groupId === browser.tabs.TAB_ID_NONE) return;
    try {
        const group = await browser.tabGroups.get(groupId);
        const tabsInGroup = await browser.tabs.query({ groupId: groupId });
        const count = tabsInGroup.length;
        
        let cleanTitle = (group.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, '');

        let newTitle = count > 0 ? `${cleanTitle} (${count})` : cleanTitle;

        if (settings.manualGroupIds.includes(groupId)) {
            newTitle = `📌 ${newTitle}`;
        }

        if (group.title !== newTitle) {
            await browser.tabGroups.update(groupId, { title: newTitle });
        }
    } catch (e) {
        if (e.message.includes("No group with id")) {
            console.log(`Não foi possível atualizar o título: o grupo ${groupId} já não existe.`);
        } else {
            console.error(`Falha ao atualizar o título para o grupo ${groupId}:`, e);
        }
    }
}

function scheduleTitleUpdate(groupId) {
    if (!groupId || groupId === browser.tabs.TAB_ID_NONE) return;
    if (debouncedTitleUpdaters.has(groupId)) {
        clearTimeout(debouncedTitleUpdaters.get(groupId));
    }
    const timeoutId = setTimeout(() => {
        updateGroupTitleWithCount(groupId);
        debouncedTitleUpdaters.delete(groupId);
    }, TITLE_UPDATE_DEBOUNCE);
    debouncedTitleUpdaters.set(groupId, timeoutId);
}

// --- Lógica de Grupos Manuais e Edição de Regras ---

async function handleTabGroupCreated(group) {
    pendingClassificationGroups.add(group.id);
    
    setTimeout(async () => {
        if (recentlyCreatedAutomaticGroups.has(group.id)) {
            recentlyCreatedAutomaticGroups.delete(group.id);
            pendingClassificationGroups.delete(group.id);
            return;
        }
        
        if (pendingClassificationGroups.has(group.id)) {
            pendingClassificationGroups.delete(group.id);
            
            if (!settings.manualGroupIds.includes(group.id)) {
                const newManualIds = [...settings.manualGroupIds, group.id];
                await updateSettings({ manualGroupIds: newManualIds });
                
                try {
                    const currentGroup = await browser.tabGroups.get(group.id);
                    const cleanTitle = (currentGroup.title || 'Grupo').replace(/📌\s*/g, '');
                    await browser.tabGroups.update(group.id, { title: `📌 ${cleanTitle}` });
                } catch (e) { /* O grupo pode já não existir */ }
            }
        }
    }, CLASSIFICATION_TIMEOUT);
}

async function handleTabGroupUpdated(group) {
    const isManual = settings.manualGroupIds.includes(group.id);
    const title = group.title || '';
    const hasPin = title.startsWith('📌 ');

    if (isManual && !hasPin) {
        await browser.tabGroups.update(group.id, { title: `📌 ${title}` });
    } else if (!isManual && hasPin) {
        await browser.tabGroups.update(group.id, { title: title.replace(/📌\s*/g, '') });
    }
}

async function handleTabGroupRemoved(group) {
    pendingClassificationGroups.delete(group.id);
    recentlyCreatedAutomaticGroups.delete(group.id);
    if (settings.manualGroupIds.includes(group.id)) {
        const newManualIds = settings.manualGroupIds.filter(id => id !== group.id);
        await updateSettings({ manualGroupIds: newManualIds });
    }
}

async function checkForRenamedOrEditedRules(oldSettings, newSettings) {
    const oldRules = oldSettings.customRules || [];
    const newRules = newSettings.customRules || [];
    const changedRules = [];

    for (let i = 0; i < oldRules.length; i++) {
        if (newRules[i] && (oldRules[i].name !== newRules[i].name || oldRules[i].color !== newRules[i].color)) {
            changedRules.push({
                oldName: oldRules[i].name,
                newName: newRules[i].name,
                newColor: newRules[i].color
            });
        }
    }
    
    if (changedRules.length === 0) return;

    const allGroups = await browser.tabGroups.query({});
    for (const change of changedRules) {
        const targetGroup = allGroups.find(g => {
            const cleanTitle = (g.title || '').replace(/\s\(\d+\)$/, '').replace(/📌\s*/g, '');
            return cleanTitle === change.oldName;
        });

        if (targetGroup) {
            try {
                const updatePayload = {};
                const currentTitle = targetGroup.title || '';
                if (change.oldName !== change.newName) {
                    updatePayload.title = currentTitle.replace(change.oldName, change.newName);
                }
                if (change.newColor && targetGroup.color !== change.newColor) {
                    updatePayload.color = change.newColor;
                }
                if (Object.keys(updatePayload).length > 0) {
                     await browser.tabGroups.update(targetGroup.id, updatePayload);
                }
            } catch (e) {
                console.error(`Erro ao atualizar o grupo para a regra renomeada de "${change.oldName}":`, e);
            }
        }
    }
}

// --- Gestor de Mensagens e Inicialização ---

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case 'getSettings':
                    sendResponse(settings);
                    break;
                case 'updateSettings':
                    const { oldSettings, newSettings } = await updateSettings(message.settings);
                    
                    await checkForRenamedOrEditedRules(oldSettings, newSettings);
                    
                    if (newSettings.autoGroupingEnabled !== oldSettings.autoGroupingEnabled) toggleListeners(newSettings.autoGroupingEnabled);
                    if (newSettings.showTabCount !== oldSettings.showTabCount) toggleListeners(newSettings.showTabCount); // Simplificado
                    if (newSettings.autoCollapseTimeout !== oldSettings.autoCollapseTimeout) updateAutoCollapseTimer();
                    if (newSettings.ungroupSingleTabs !== oldSettings.ungroupSingleTabs || newSettings.ungroupSingleTabsTimeout !== oldSettings.ungroupSingleTabsTimeout) {
                        updateUngroupTimer();
                    }
                    await updateContextMenus();
                    sendResponse(newSettings);
                    break;
                case 'groupAllTabs':
                    await processTabQueue((await browser.tabs.query({ currentWindow: true, pinned: false })).map(t => t.id));
                    sendResponse({ status: "ok" });
                    break;
                default:
                    sendResponse({ error: `Ação desconhecida: ${message.action}` });
                    break;
            }
        } catch (error) {
            console.error(`Erro ao processar a ação "${message.action}":`, error);
            sendResponse({ error: error.message });
        }
    })();
    return true;
});

async function populateTabGroupMap() {
    tabGroupMap.clear();
    try {
        const allTabs = await browser.tabs.query({});
        for (const tab of allTabs) {
            tabGroupMap.set(tab.id, tab.groupId);
        }
        console.log(`[ATG] Mapa de Aba-Grupo populado com ${tabGroupMap.size} entradas.`);
    } catch (e) {
        console.error("[ATG] Erro ao popular o mapa de Aba-Grupo:", e);
    }
}

async function main() {
    try {
        await loadSettings();
        
        await populateTabGroupMap();
        if (settings.showTabCount) {
             const allGroups = await browser.tabGroups.query({});
             for (const group of allGroups) {
                 updateGroupTitleWithCount(group.id);
             }
        }

        browser.tabs.onActivated.addListener(handleTabActivated);
        
        browser.tabGroups.onCreated.addListener(handleTabGroupCreated);
        browser.tabGroups.onUpdated.addListener(handleTabGroupUpdated);
        browser.tabGroups.onRemoved.addListener(handleTabGroupRemoved);
        
        // Inicializa os módulos
        initializeContextMenus();
        await updateContextMenus();

        // Inicializa os listeners e timers com base nas configurações
        toggleListeners(settings.autoGroupingEnabled || settings.showTabCount);
        updateAutoCollapseTimer();
        updateUngroupTimer();
        
        console.log("Auto Tab Grouper inicializado com sucesso e refatorado.");
    } catch (e) {
        console.error("Falha crítica durante a inicialização da extensão:", e);
    }
}

main();
