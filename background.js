/**
 * @file background.js
 * @description Ponto de entrada principal da extensão, gere eventos e a fila de processamento.
 */

import { settings, loadSettings, updateSettings, clearSmartNameCache } from './settings-manager.js';
import { processTabQueue, getFinalGroupName, isTabGroupable, getNextColor } from './grouping-logic.js';

let tabProcessingQueue = new Set();
let queueTimeout = null;

const QUEUE_DELAY = 500; // Processa a fila 500ms após a última aba ser adicionada

function scheduleQueueProcessing() {
    if (queueTimeout) {
        clearTimeout(queueTimeout);
    }
    queueTimeout = setTimeout(async () => {
        const tabsToProcess = Array.from(tabProcessingQueue);
        tabProcessingQueue.clear();
        await processTabQueue(tabsToProcess);
    }, QUEUE_DELAY);
}

function handleTabUpdated(tabId, changeInfo, tab) {
  if (settings.autoGroupingEnabled && changeInfo.status === 'complete') {
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

// --- Funções de comportamento (mantidas aqui para simplicidade) ---

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
      groupActivity.set(groupId, Date.now());
      const group = await browser.tabGroups.get(groupId);
      if (group && group.collapsed) await browser.tabGroups.update(groupId, { collapsed: false });
    }
  } catch (error) {}
}

async function checkIdleGroups() {
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
                if (activeTabInWindow && activeTabInWindow.groupId === group.id) continue; 
                const lastActivityTime = groupActivity.get(group.id) || 0;
                if (lastActivityTime > 0 && (now - lastActivityTime > timeoutMs)) {
                    await browser.tabGroups.update(group.id, { collapsed: true });
                    groupActivity.delete(group.id);
                }
            }
        }
    } catch (e) { console.error("Erro ao verificar grupos inativos:", e); }
}

function updateAutoCollapseTimer() {
  if (collapseInterval) clearInterval(collapseInterval);
  collapseInterval = null;
  if (settings.autoCollapseTimeout > 0) collapseInterval = setInterval(checkIdleGroups, 1000);
}

async function checkSingleTabGroups() {
    if (!settings.ungroupSingleTabs || settings.ungroupSingleTabsTimeout <= 0) return;
    const timeoutMs = settings.ungroupSingleTabsTimeout * 1000;
    const now = Date.now();
    try {
        const allGroups = await browser.tabGroups.query({});
        for (const group of allGroups) {
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
    if (settings.ungroupSingleTabs && settings.ungroupSingleTabsTimeout > 0) ungroupInterval = setInterval(checkSingleTabGroups, 1500);
}


// --- LÓGICA DO MENU DE CONTEXTO ---

async function updateContextMenus() {
    await browser.menus.removeAll();
    if (browser.runtime.lastError) {}

    await loadSettings();

    const mainParentId = "main-parent";
    browser.menus.create({
        id: mainParentId,
        title: "Auto Tab Grouper",
        contexts: ["page", "tab"],
    }, () => { if (browser.runtime.lastError) {} });

    browser.menus.create({
        id: "create-new-rule",
        parentId: mainParentId,
        title: "➕ Criar nova regra para este site...",
        contexts: ["page", "tab"],
    }, () => { if (browser.runtime.lastError) {} });

    if (settings.customRules && settings.customRules.length > 0) {
        const addToRuleParentId = "add-to-existing-rule-parent";
        browser.menus.create({
            id: addToRuleParentId,
            parentId: mainParentId,
            title: "➕ Adicionar a uma regra existente ►",
            contexts: ["page", "tab"],
        }, () => { if (browser.runtime.lastError) {} });

        for (const [index, rule] of settings.customRules.entries()) {
            browser.menus.create({
                id: `add-to-rule-${index}`,
                parentId: addToRuleParentId,
                title: rule.name,
                contexts: ["page", "tab"],
            }, () => { if (browser.runtime.lastError) {} });
        }
    }

    const exceptionsParentId = "never-group-parent";
    browser.menus.create({
        id: exceptionsParentId,
        parentId: mainParentId,
        title: "🚫 Nunca agrupar ►",
        contexts: ["page", "tab"],
    }, () => { if (browser.runtime.lastError) {} });

    browser.menus.create({
        id: "never-group-domain",
        parentId: exceptionsParentId,
        title: "Nunca agrupar este domínio",
        contexts: ["page", "tab"],
    }, () => { if (browser.runtime.lastError) {} });

     browser.menus.create({
        id: "never-group-url",
        parentId: exceptionsParentId,
        title: "Nunca agrupar este URL específico",
        contexts: ["page", "tab"],
    }, () => { if (browser.runtime.lastError) {} });


    browser.menus.create({
        id: "group-similar-now",
        parentId: mainParentId,
        title: "✨ Agrupar abas semelhantes agora",
        contexts: ["page", "tab"],
    }, () => { if (browser.runtime.lastError) {} });

    browser.menus.create({ id: "separator-1", type: "separator", parentId: mainParentId, contexts: ["page", "tab"] }, () => { if (browser.runtime.lastError) {} });
    browser.menus.create({ id: "open-options", parentId: mainParentId, title: "⚙️ Opções da Extensão", contexts: ["page", "tab"] }, () => { if (browser.runtime.lastError) {} });
}


async function handleContextMenuClick(info, tab) {
    if (!tab) { 
        return;
    }
    
    if (info.menuItemId.startsWith("add-to-rule-")) {
        try {
            const ruleIndex = parseInt(info.menuItemId.replace("add-to-rule-", ""), 10);
            const rule = settings.customRules[ruleIndex];
            if (rule) {
                const newPattern = `*${new URL(tab.url).hostname}*`;
                if (!rule.patterns.includes(newPattern)) {
                    rule.patterns.push(newPattern);
                    await updateSettings({ customRules: settings.customRules });
                }
            }
        } catch (e) {
            console.error("Erro ao adicionar padrão à regra existente:", e);
        }
        return;
    }

    switch (info.menuItemId) {
        case "create-new-rule":
            try {
                // CORREÇÃO: O caminho para options.html precisa incluir a pasta "options".
                const path = `options/options.html?action=new_rule&url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title)}`;
                browser.tabs.create({ url: browser.runtime.getURL(path) });
            } catch (e) {
                 console.error("Erro ao abrir página de opções para nova regra:", e);
            }
            break;

        case "never-group-domain":
            try {
                const domain = new URL(tab.url).hostname;
                if (domain && !settings.exceptions.includes(domain)) {
                    const newExceptions = [...settings.exceptions, domain];
                    await updateSettings({ exceptions: newExceptions });
                    browser.runtime.sendMessage({ action: "settingsUpdated" });
                }
            } catch (e) {
                 console.error("Não foi possível adicionar o domínio à exceção:", e);
            }
            break;
            
        case "never-group-url":
            try {
                const url = tab.url;
                if (url && !settings.exceptions.includes(url)) {
                     const newExceptions = [...settings.exceptions, url];
                    await updateSettings({ exceptions: newExceptions });
                    browser.runtime.sendMessage({ action: "settingsUpdated" });
                }
            } catch(e) {
                 console.error("Não foi possível adicionar a URL à exceção:", e);
            }
            break;

        case "group-similar-now":
            try {
                const finalGroupName = await getFinalGroupName(tab);
                if (!finalGroupName) return;

                const allTabsInWindow = await browser.tabs.query({ windowId: tab.windowId, pinned: false });
                const tabsToGroupIds = [];

                for (const t of allTabsInWindow) {
                    if (isTabGroupable(t) && await getFinalGroupName(t) === finalGroupName) {
                        tabsToGroupIds.push(t.id);
                    }
                }
                
                if (tabsToGroupIds.length > 0) {
                     const existingGroups = await browser.tabGroups.query({ windowId: tab.windowId, title: finalGroupName });
                     if (existingGroups.length > 0) {
                         await browser.tabs.group({ groupId: existingGroups[0].id, tabIds: tabsToGroupIds });
                     } else {
                         const newGroupId = await browser.tabs.group({ tabIds: tabsToGroupIds, createProperties: { windowId: tab.windowId } });
                         await browser.tabGroups.update(newGroupId, { title: finalGroupName, color: getNextColor() });
                     }
                }
            } catch (e) {
                console.error("Erro ao agrupar abas semelhantes:", e);
            }
            break;

        case "open-options":
            browser.runtime.openOptionsPage();
            break;
    }
}

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'updateSettings':
      const { oldSettings, newSettings } = await updateSettings(message.settings);
      
      if (newSettings.autoGroupingEnabled !== oldSettings.autoGroupingEnabled) {
          toggleListeners(newSettings.autoGroupingEnabled);
      }
      if (newSettings.autoCollapseTimeout !== oldSettings.autoCollapseTimeout) {
          updateAutoCollapseTimer();
      }
      if (newSettings.ungroupSingleTabs !== oldSettings.ungroupSingleTabs || newSettings.ungroupSingleTabsTimeout !== oldSettings.ungroupSingleTabsTimeout) {
          updateUngroupTimer();
      }
      if (newSettings.groupingMode !== oldSettings.groupingMode) {
          clearSmartNameCache();
      }
      
      await updateContextMenus();

      return newSettings;

    case 'getSettings':
      return settings;

    case 'groupAllTabs':
      const allTabs = await browser.tabs.query({currentWindow: true});
      await processTabQueue(allTabs.map(t => t.id));
      return { status: "ok" };
      
    default:
      throw new Error(`Ação desconhecida: ${message.action}`);
  }
}

// --- Inicialização ---
async function main() {
    try {
        await loadSettings();
        
        browser.runtime.onMessage.addListener(handleMessage);
        browser.tabs.onActivated.addListener(handleTabActivated);
        browser.menus.onClicked.addListener(handleContextMenuClick);
        
        await updateContextMenus();
        toggleListeners(settings.autoGroupingEnabled);
        updateAutoCollapseTimer();
        updateUngroupTimer();

    } catch (e) {
        console.error("Falha crítica durante a inicialização da extensão:", e);
    }
}

main();
