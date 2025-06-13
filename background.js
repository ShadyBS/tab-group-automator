/**
 * @file background.js
 * @description Ponto de entrada principal da extensão, gere eventos e a fila de processamento.
 */

import { settings, loadSettings, updateSettings, clearSmartNameCache } from './settings-manager.js';
import { processTabQueue, getFinalGroupName, isTabGroupable, getNextColor } from './grouping-logic.js';

// --- Funções principais e listeners de eventos do browser ---

let tabProcessingQueue = new Set();
let queueTimeout = null;
const QUEUE_DELAY = 500;

function scheduleQueueProcessing() {
    if (queueTimeout) clearTimeout(queueTimeout);
    queueTimeout = setTimeout(async () => {
        const tabsToProcess = Array.from(tabProcessingQueue);
        tabProcessingQueue.clear();
        await processTabQueue(tabsToProcess);
    }, QUEUE_DELAY);
}

function handleTabUpdated(tabId, changeInfo, tab) {
  if (settings.autoGroupingEnabled && changeInfo.status === 'complete' && tab.url) {
    tabProcessingQueue.add(tabId);
    scheduleQueueProcessing();
  }
}

function toggleListeners(enable) {
  const hasListener = browser.tabs.onUpdated.hasListener(handleTabUpdated);
  if (enable && !hasListener) {
    browser.tabs.onUpdated.addListener(handleTabUpdated, { properties: ["status"] });
  } else if (!enable && hasListener) {
    browser.tabs.onUpdated.removeListener(handleTabUpdated);
  }
}

let groupActivity = new Map();
let collapseInterval = null;
let ungroupInterval = null;
let singleTabGroupTimestamps = new Map();

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
            // **MODIFICAÇÃO**: Ignora grupos manuais
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

async function updateGroupTitleWithCount(groupId) {
    if (!settings.showTabCount || groupId === browser.tabs.TAB_ID_NONE) return;
    try {
        const group = await browser.tabGroups.get(groupId);
        const tabsInGroup = await browser.tabs.query({ groupId: groupId });
        const count = tabsInGroup.length;
        
        let cleanTitle = group.title.replace(/\s\(\d+\)$/, '');
        if (settings.manualGroupIds.includes(groupId)) {
            cleanTitle = cleanTitle.replace('📌 ', '');
        }

        let newTitle = count > 0 ? `${cleanTitle} (${count})` : cleanTitle;

        if (settings.manualGroupIds.includes(groupId)) {
            newTitle = `📌 ${newTitle}`;
        }

        if (group.title !== newTitle) {
            await browser.tabGroups.update(groupId, { title: newTitle });
        }
    } catch (e) {}
}

function handleTabAttached(tabId, attachInfo) {
    updateGroupTitleWithCount(attachInfo.newGroupId);
    updateGroupTitleWithCount(detachInfo.oldGroupId);
}

function handleTabDetached(tabId, detachInfo) {
    updateGroupTitleWithCount(attachInfo.newGroupId);
    updateGroupTitleWithCount(detachInfo.oldGroupId);
}

function toggleTitleCounterListeners(enable) {
    const hasAttachedListener = browser.tabs.onAttached.hasListener(handleTabAttached);
    if (enable && !hasAttachedListener) {
        browser.tabs.onAttached.addListener(handleTabAttached);
        browser.tabs.onDetached.addListener(handleTabDetached);
    } else if (!enable && hasAttachedListener) {
        browser.tabs.onAttached.removeListener(handleTabAttached);
        browser.tabs.onDetached.removeListener(handleTabDetached);
    }
}


// --- LÓGICA DE GRUPOS MANUAIS ---

async function handleTabGroupCreated(group) {
    // **CORREÇÃO**: Lógica robusta para detetar grupos manuais vs. automáticos.
    // Aguarda um instante para permitir que a criação automática nomeie o grupo.
    await new Promise(resolve => setTimeout(resolve, 100));

    let updatedGroup;
    try {
        updatedGroup = await browser.tabGroups.get(group.id);
    } catch (e) {
        return; // O grupo foi removido nesse meio tempo, não faz nada.
    }

    // Se o grupo já tem um nome (e não é um nome genérico), é um grupo automático.
    if (updatedGroup.title && !updatedGroup.title.startsWith("Grupo ")) {
        return; // Não faz nada, deixa a lógica normal seguir.
    }

    // Se, após a espera, o grupo continua sem nome ou com nome genérico, é manual.
    if (!settings.manualGroupIds.includes(group.id)) {
        const newManualIds = [...settings.manualGroupIds, group.id];
        await updateSettings({ manualGroupIds: newManualIds });
        await browser.tabGroups.update(group.id, { title: `📌 ${updatedGroup.title || 'Grupo'}` });
    }
}

async function handleTabGroupUpdated(group) {
    const isManual = settings.manualGroupIds.includes(group.id);
    const hasPin = group.title.startsWith('📌 ');

    // Garante a consistência do pino
    if (isManual && !hasPin) {
        await browser.tabGroups.update(group.id, { title: `📌 ${group.title}` });
    } else if (!isManual && hasPin) {
        await browser.tabGroups.update(group.id, { title: group.title.replace('📌 ', '') });
    }
}

async function handleTabGroupRemoved(group) {
    if (settings.manualGroupIds.includes(group.id)) {
        const newManualIds = settings.manualGroupIds.filter(id => id !== group.id);
        await updateSettings({ manualGroupIds: newManualIds });
    }
}


// --- LÓGICA DO MENU DE CONTEXTO ---
async function updateContextMenus() {
    await browser.menus.removeAll();
    const validContexts = ["page", "tab"];
    
    const mainParentId = "main-parent";
    browser.menus.create({ id: mainParentId, title: "Auto Tab Grouper", contexts: validContexts });
    
    browser.menus.create({ id: "create-new-rule", parentId: mainParentId, title: "➕ Criar regra para este site...", contexts: validContexts });

    if (settings.customRules && settings.customRules.length > 0) {
        const addToRuleParentId = "add-to-existing-rule-parent";
        browser.menus.create({id: addToRuleParentId, parentId: mainParentId, title: "➕ Adicionar a regra existente ►", contexts: validContexts});
        for (const [index, rule] of settings.customRules.entries()) {
            browser.menus.create({ id: `add-to-rule-${index}`, parentId: addToRuleParentId, title: rule.name, contexts: validContexts });
        }
    }

    browser.menus.create({ id: "never-group-domain", parentId: mainParentId, title: '🚫 Nunca agrupar o domínio...', contexts: validContexts });
    browser.menus.create({ id: "group-similar-now", parentId: mainParentId, title: "✨ Agrupar abas semelhantes agora", contexts: validContexts });
    
    browser.menus.create({ id: "convert-to-auto", parentId: mainParentId, title: "🔓 Converter em grupo automático", contexts: validContexts, visible: false });
    browser.menus.create({ id: "group-actions-separator", parentId: mainParentId, type: "separator", contexts: validContexts, visible: false });
    browser.menus.create({ id: "copy-group-urls", parentId: mainParentId, title: "📋 Copiar todos os URLs do grupo", contexts: validContexts, visible: false });
    browser.menus.create({ id: "rule-from-group", parentId: mainParentId, title: "➕ Criar regra a partir deste grupo...", contexts: validContexts, visible: false });

    browser.menus.create({ id: "separator-1", type: "separator", parentId: mainParentId, contexts: validContexts });
    browser.menus.create({ id: "open-options", parentId: mainParentId, title: "⚙️ Opções da Extensão", contexts: validContexts });
}

browser.menus.onShown.addListener(async (info, tab) => {
    if (tab && tab.url) {
        try {
            const domain = new URL(tab.url).hostname;
            browser.menus.update("never-group-domain", { title: `🚫 Nunca agrupar o domínio "${domain}"` });
        } catch(e) {}
    }

    const isGrouped = tab && tab.groupId !== browser.tabs.TAB_ID_NONE;
    const isManual = isGrouped && settings.manualGroupIds.includes(tab.groupId);

    browser.menus.update("group-actions-separator", { visible: isGrouped });
    browser.menus.update("copy-group-urls", { visible: isGrouped });
    browser.menus.update("rule-from-group", { visible: isGrouped });
    browser.menus.update("convert-to-auto", { visible: isManual });
    
    browser.menus.refresh();
});

async function handleContextMenuClick(info, tab) {
    if (!tab) return; 
    
    const tabGroupId = tab.groupId;

    if (info.menuItemId.startsWith("add-to-rule-")) {
        try {
            const ruleIndex = parseInt(info.menuItemId.replace("add-to-rule-", ""), 10);
            const rule = settings.customRules[ruleIndex];
            if (rule && tab.url) {
                const newPattern = `*${new URL(tab.url).hostname}*`;
                if (!rule.patterns.includes(newPattern)) {
                    rule.patterns.push(newPattern);
                    await updateSettings({ customRules: settings.customRules });
                }
            }
        } catch (e) { console.error("Erro ao adicionar padrão:", e); }
        return;
    }

    switch (info.menuItemId) {
        case "create-new-rule":
            const path = `options/options.html?action=new_rule&url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title)}`;
            browser.tabs.create({ url: browser.runtime.getURL(path) });
            break;
        case "never-group-domain":
             if (tab.url) {
                try {
                    const domain = new URL(tab.url).hostname;
                    if (domain && !settings.exceptions.includes(domain)) {
                        await updateSettings({ exceptions: [...settings.exceptions, domain] });
                    }
                } catch (e) { console.error("Erro ao adicionar exceção:", e); }
            }
            break;
        case "group-similar-now":
            try {
                const finalGroupName = await getFinalGroupName(tab);
                if (!finalGroupName) return;
                
                const allTabsInWindow = await browser.tabs.query({ windowId: tab.windowId, pinned: false });
                const matchingTabs = [];

                for (const t of allTabsInWindow) {
                    if (isTabGroupable(t)) {
                        const groupNameForOtherTab = await getFinalGroupName(t);
                        if (groupNameForOtherTab === finalGroupName) {
                            matchingTabs.push(t.id);
                        }
                    }
                }
                
                if (matchingTabs.length > 0) {
                     const existingGroups = await browser.tabGroups.query({ windowId: tab.windowId, title: finalGroupName });
                     if (existingGroups.length > 0) {
                         await browser.tabs.group({ groupId: existingGroups[0].id, tabIds: matchingTabs });
                     } else {
                         const newGroupId = await browser.tabs.group({ tabIds: matchingTabs, createProperties: { windowId: tab.windowId } });
                         await browser.tabGroups.update(newGroupId, { title: finalGroupName, color: getNextColor() });
                     }
                }
            } catch (e) { console.error("Erro ao agrupar abas:", e); }
            break;
        case "open-options":
            browser.runtime.openOptionsPage();
            break;
        case "copy-group-urls":
            if (tabGroupId) {
                const tabs = await browser.tabs.query({ groupId: tabGroupId });
                const urls = tabs.map(t => t.url).join('\n');
                await browser.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (text) => {
                        navigator.clipboard.writeText(text);
                    },
                    args: [urls]
                });
            }
            break;
        case "rule-from-group":
            if (tabGroupId) {
                const tabs = await browser.tabs.query({ groupId: tabGroupId });
                const group = await browser.tabGroups.get(tabGroupId);
                const hostnames = new Set(tabs.map(t => { try { return `*${new URL(t.url).hostname}*`; } catch { return null; }}).filter(Boolean));
                const patterns = Array.from(hostnames).join('\n');
                const cleanTitle = group.title.replace(/\s\(\d+\)$/, '').replace('📌 ', '');
                const rulePath = `options/options.html?action=new_rule&name=${encodeURIComponent(cleanTitle)}&patterns=${encodeURIComponent(patterns)}`;
                browser.tabs.create({ url: browser.runtime.getURL(rulePath) });
            }
            break;
        case "convert-to-auto":
            if (tabGroupId && settings.manualGroupIds.includes(tabGroupId)) {
                const newManualIds = settings.manualGroupIds.filter(id => id !== tabGroupId);
                await updateSettings({ manualGroupIds: newManualIds });

                const group = await browser.tabGroups.get(tabGroupId);
                if (group.title.startsWith('📌 ')) {
                    await browser.tabGroups.update(tabGroupId, { title: group.title.replace('📌 ', '') });
                }

                const tabsInGroup = await browser.tabs.query({ groupId: tabGroupId });
                await processTabQueue(tabsInGroup.map(t => t.id));
            }
            break;
    }
}

// --- GESTOR DE MENSAGENS E INICIALIZAÇÃO ---

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.action) {
                case 'getSettings':
                    sendResponse(settings);
                    break;
                case 'updateSettings':
                    const { oldSettings, newSettings } = await updateSettings(message.settings);
                    if (newSettings.autoGroupingEnabled !== oldSettings.autoGroupingEnabled) toggleListeners(newSettings.autoGroupingEnabled);
                    if (newSettings.showTabCount !== oldSettings.showTabCount) toggleTitleCounterListeners(newSettings.showTabCount);
                    if (newSettings.autoCollapseTimeout !== oldSettings.autoCollapseTimeout) updateAutoCollapseTimer();
                    if (newSettings.ungroupSingleTabs !== oldSettings.ungroupSingleTabs || newSettings.ungroupSingleTabsTimeout !== oldSettings.ungroupSingleTabsTimeout) {
                        updateUngroupTimer();
                    }
                    await updateContextMenus();
                    sendResponse(newSettings);
                    break;
                case 'groupAllTabs':
                    const allTabs = await browser.tabs.query({ currentWindow: true, pinned: false });
                    await processTabQueue(allTabs.map(t => t.id));
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

async function main() {
    try {
        await loadSettings();
        
        browser.tabs.onActivated.addListener(handleTabActivated);
        browser.menus.onClicked.addListener(handleContextMenuClick);
        
        browser.tabGroups.onCreated.addListener(handleTabGroupCreated);
        browser.tabGroups.onUpdated.addListener(handleTabGroupUpdated);
        browser.tabGroups.onRemoved.addListener(handleTabGroupRemoved);
        
        await updateContextMenus();
        toggleListeners(settings.autoGroupingEnabled);
        toggleTitleCounterListeners(settings.showTabCount);
        updateAutoCollapseTimer();
        updateUngroupTimer();
        
        console.log("Auto Tab Grouper inicializado com sucesso.");
    } catch (e) {
        console.error("Falha crítica durante a inicialização da extensão:", e);
    }
}

main();
