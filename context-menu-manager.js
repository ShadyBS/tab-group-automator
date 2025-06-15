/**
 * @file context-menu-manager.js
 * @description Gere toda a lógica de criação, atualização e eventos para o menu de contexto do browser.
 */

import { settings, updateSettings } from './settings-manager.js';
import { processTabQueue, getFinalGroupName, isTabGroupable, getNextColor } from './grouping-logic.js';
import { recentlyCreatedAutomaticGroups } from './app-state.js';

/**
 * Cria ou atualiza todos os itens do menu de contexto.
 */
export async function updateContextMenus() {
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

/**
 * Lida com cliques nos itens do menu de contexto.
 * @param {browser.menus.OnClickData} info Informação sobre o item clicado.
 * @param {browser.tabs.Tab} tab A aba onde o clique ocorreu.
 */
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
                         recentlyCreatedAutomaticGroups.add(newGroupId);
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
                const newIds = await processTabQueue(tabsInGroup.map(t => t.id));
                for (const id of newIds) {
                    recentlyCreatedAutomaticGroups.add(id);
                }
            }
            break;
    }
}

/**
 * Lida com a visibilidade dos itens do menu de contexto.
 * @param {browser.menus.OnShowData} info 
 * @param {browser.tabs.Tab} tab 
 */
async function handleMenuShown(info, tab) {
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
}

/**
 * Adiciona os listeners de eventos para o menu de contexto.
 */
export function initializeContextMenus() {
    browser.menus.onClicked.addListener(handleContextMenuClick);
    browser.menus.onShown.addListener(handleMenuShown);
}
