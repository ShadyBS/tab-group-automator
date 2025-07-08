/**
 * @file context-menu-manager.js
 * @description Gere toda a lógica de criação, atualização e eventos para o menu de contexto do browser.
 */

import Logger from "./logger.js";
import { settings, updateSettings } from "./settings-manager.js";
import {
  processTabQueue,
  getFinalGroupName,
  isTabGroupable,
  getNextColor,
} from "./grouping-logic.js";
import { pendingAutomaticGroups } from "./app-state.js";

export async function updateContextMenus() {
  // Adiciona uma verificação para garantir que a API de menus está disponível.
  // Isto evita erros se a permissão "menus" estiver em falta no manifest.
  if (!browser.contextMenus) {
    return; // Sai silenciosamente, o erro será registado na inicialização.
  }

  await browser.contextMenus.removeAll();
  // O contexto 'tab' é específico do Firefox e causa erros em navegadores baseados em Chromium.
  // 'page' é um contexto seguro e compatível que cobre a funcionalidade principal
  // de clicar com o botão direito no conteúdo de uma página.
  const validContexts = ["page"];

  const mainParentId = "main-parent";
  browser.contextMenus.create({
    id: mainParentId,
    title: "Auto Tab Grouper",
    contexts: validContexts,
  });

  browser.contextMenus.create({
    id: "create-new-rule",
    parentId: mainParentId,
    title: "➕ Criar regra para este site...",
    contexts: validContexts,
  });

  if (settings.customRules && settings.customRules.length > 0) {
    const addToRuleParentId = "add-to-existing-rule-parent";
    browser.contextMenus.create({
      id: addToRuleParentId,
      parentId: mainParentId,
      title: "➕ Adicionar a regra existente ►",
      contexts: validContexts,
    });
    for (const [index, rule] of settings.customRules.entries()) {
      browser.contextMenus.create({
        id: `add-to-rule-${index}`,
        parentId: addToRuleParentId,
        title: rule.name,
        contexts: validContexts,
      });
    }
  }

  browser.contextMenus.create({
    id: "never-group-domain",
    parentId: mainParentId,
    title: "🚫 Nunca agrupar o domínio...",
    contexts: validContexts,
  });
  browser.contextMenus.create({
    id: "group-similar-now",
    parentId: mainParentId,
    title: "✨ Agrupar abas semelhantes agora",
    contexts: validContexts,
  });

  browser.contextMenus.create({
    id: "convert-to-auto",
    parentId: mainParentId,
    title: "🔓 Converter em grupo automático",
    contexts: validContexts,
    visible: false,
  });
  browser.contextMenus.create({
    id: "group-actions-separator",
    parentId: mainParentId,
    type: "separator",
    contexts: validContexts,
    visible: false,
  });
  browser.contextMenus.create({
    id: "copy-group-urls",
    parentId: mainParentId,
    title: "📋 Copiar todos os URLs do grupo",
    contexts: validContexts,
    visible: false,
  });
  browser.contextMenus.create({
    id: "rule-from-group",
    parentId: mainParentId,
    title: "➕ Criar regra a partir deste grupo...",
    contexts: validContexts,
    visible: false,
  });

  browser.contextMenus.create({
    id: "separator-1",
    type: "separator",
    parentId: mainParentId,
    contexts: validContexts,
  });
  browser.contextMenus.create({
    id: "open-options",
    parentId: mainParentId,
    title: "⚙️ Opções da Extensão",
    contexts: validContexts,
  });
}

async function handleContextMenuClick(info, tab) {
  if (!tab) return;
  Logger.info(
    "handleContextMenuClick",
    `Item de menu '${info.menuItemId}' clicado.`,
    { info, tab }
  );

  const tabGroupId = tab.groupId;

  // CORRIGIDO: Lógica para adicionar uma nova condição à regra existente, usando o formato correto.
  if (info.menuItemId.startsWith("add-to-rule-")) {
    try {
      const ruleIndex = parseInt(
        info.menuItemId.replace("add-to-rule-", ""),
        10
      );
      const rule = settings.customRules[ruleIndex];

      // Assegura que a regra está no formato correto antes de a modificar
      if (
        rule &&
        tab.url &&
        rule.conditionGroup &&
        Array.isArray(rule.conditionGroup.conditions)
      ) {
        const hostname = new URL(tab.url).hostname;
        const newCondition = {
          property: "hostname",
          operator: "contains",
          value: hostname,
        };

        // Verifica se uma condição semelhante já existe para evitar duplicados
        const conditionExists = rule.conditionGroup.conditions.some(
          (c) =>
            c.property === newCondition.property &&
            c.value === newCondition.value
        );

        if (!conditionExists) {
          rule.conditionGroup.conditions.push(newCondition);
          // Define o operador para 'OR' se houver múltiplas condições, o que é mais intuitivo para esta ação
          if (rule.conditionGroup.conditions.length > 1) {
            rule.conditionGroup.operator = "OR";
          }
          await updateSettings({ customRules: settings.customRules });
          Logger.info(
            "handleContextMenuClick",
            `Condição para "${hostname}" adicionada à regra "${rule.name}".`
          );
        } else {
          Logger.info(
            "handleContextMenuClick",
            `Condição para "${hostname}" já existe na regra "${rule.name}".`
          );
        }
      } else {
        Logger.warn(
          "handleContextMenuClick",
          `A regra "${rule.name}" está num formato inválido. Não foi possível adicionar a condição.`
        );
      }
    } catch (e) {
      Logger.error(
        "handleContextMenuClick",
        "Erro ao adicionar condição à regra:",
        e
      );
    }
    return;
  }

  switch (info.menuItemId) {
    case "create-new-rule":
      const path = `options/options.html?action=new_rule&url=${encodeURIComponent(
        tab.url
      )}&title=${encodeURIComponent(tab.title)}`;
      browser.tabs.create({ url: browser.runtime.getURL(path) });
      break;
    case "never-group-domain":
      if (tab.url) {
        try {
          const domain = new URL(tab.url).hostname;
          if (domain && !settings.exceptions.includes(domain)) {
            await updateSettings({
              exceptions: [...settings.exceptions, domain],
            });
            Logger.info(
              "handleContextMenuClick",
              `Adicionada exceção para o domínio: ${domain}`
            );
          }
        } catch (e) {
          Logger.error(
            "handleContextMenuClick",
            "Erro ao adicionar exceção:",
            e
          );
        }
      }
      break;
    case "group-similar-now":
      try {
        const targetGroupName = await getFinalGroupName(tab);
        if (!targetGroupName) return;

        const allTabsInWindow = await browser.tabs.query({
          windowId: tab.windowId,
          pinned: false,
        });

        // OTIMIZAÇÃO: Executa a obtenção de nomes de grupo em paralelo para um desempenho muito mais rápido.
        const groupNamePromises = allTabsInWindow
          .filter(isTabGroupable)
          .map(async (t) => ({
            id: t.id,
            groupName: await getFinalGroupName(t),
          }));

        const tabGroupNames = await Promise.all(groupNamePromises);

        const matchingTabIds = tabGroupNames
          .filter((item) => item.groupName === targetGroupName)
          .map((item) => item.id);

        if (matchingTabIds.length > 0) {
          const existingGroups = await browser.tabGroups.query({
            windowId: tab.windowId,
            title: targetGroupName,
          });
          if (existingGroups.length > 0) {
            await browser.tabs.group({
              groupId: existingGroups[0].id,
              tabIds: matchingTabIds,
            });
          } else {
            const newGroupId = await browser.tabs.group({
              tabIds: matchingTabIds,
              createProperties: { windowId: tab.windowId },
            });
            pendingAutomaticGroups.set(matchingTabIds[0], {
              tabIds: matchingTabIds,
            });
            await browser.tabGroups.update(newGroupId, {
              title: targetGroupName,
              color: getNextColor(),
            });
          }
        }
      } catch (e) {
        Logger.error(
          "handleContextMenuClick",
          "Erro ao agrupar abas semelhantes:",
          e
        );
      }
      break;
    case "open-options":
      browser.runtime.openOptionsPage();
      break;
    case "copy-group-urls":
      if (tabGroupId) {
        const tabs = await browser.tabs.query({ groupId: tabGroupId });
        const urls = tabs.map((t) => t.url).join("\n");
        // Usa scripting.executeScript para aceder à área de transferência de uma forma mais segura no MV3
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (textToCopy) => {
            navigator.clipboard.writeText(textToCopy);
          },
          args: [urls],
        });
      }
      break;
    case "rule-from-group":
      if (tabGroupId) {
        const tabs = await browser.tabs.query({ groupId: tabGroupId });
        const group = await browser.tabGroups.get(tabGroupId);
        const hostnames = new Set(
          tabs
            .map((t) => {
              try {
                return `*${new URL(t.url).hostname}*`;
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        );
        const patterns = Array.from(hostnames).join("\n");
        const cleanTitle = (group.title || "")
          .replace(/\s\(\d+\)$/, "")
          .replace("📌 ", "");
        const rulePath = `options/options.html?action=new_rule&name=${encodeURIComponent(
          cleanTitle
        )}&patterns=${encodeURIComponent(patterns)}`;
        browser.tabs.create({ url: browser.runtime.getURL(rulePath) });
      }
      break;
    case "convert-to-auto":
      if (tabGroupId && settings.manualGroupIds.includes(tabGroupId)) {
        const newManualIds = settings.manualGroupIds.filter(
          (id) => id !== tabGroupId
        );
        await updateSettings({ manualGroupIds: newManualIds });
        const group = await browser.tabGroups.get(tabGroupId);
        if ((group.title || "").startsWith("📌 ")) {
          await browser.tabGroups.update(tabGroupId, {
            title: group.title.replace("📌 ", ""),
          });
        }
        const tabsInGroup = await browser.tabs.query({ groupId: tabGroupId });
        processTabQueue(tabsInGroup.map((t) => t.id));
      }
      break;
  }
}

async function handleMenuShown(info, tab) {
  if (tab && tab.url) {
    try {
      const domain = new URL(tab.url).hostname;
      browser.contextMenus.update("never-group-domain", {
        title: `🚫 Nunca agrupar o domínio "${domain}"`,
      });
    } catch (e) {
      // Ignora erros de URL inválida (ex: about:blank)
    }
  }

  const isGrouped = tab && tab.groupId !== browser.tabs.TAB_ID_NONE;
  const isManual = isGrouped && settings.manualGroupIds.includes(tab.groupId);

  browser.contextMenus.update("group-actions-separator", {
    visible: isGrouped,
  });
  browser.contextMenus.update("copy-group-urls", { visible: isGrouped });
  browser.contextMenus.update("rule-from-group", { visible: isGrouped });
  browser.contextMenus.update("convert-to-auto", { visible: isManual });

  browser.contextMenus.refresh();
}

export function initializeContextMenus() {
  // Adiciona uma verificação para garantir que a API de menus está disponível.
  // Isto evita que a extensão falhe ao iniciar se a permissão "menus" estiver em falta.
  if (!browser.contextMenus) {
    // 1. Verifica se a API principal existe.
    Logger.error(
      "ContextMenus",
      "A API 'contextMenus' não está disponível. Verifique se a permissão 'contextMenus' (ou 'menus' no Firefox) está no manifest.json."
    );
    return;
  }

  // 2. Verifica o evento 'onClicked' antes de adicionar o listener.
  if (browser.contextMenus.onClicked) {
    browser.contextMenus.onClicked.addListener(handleContextMenuClick);
  } else {
    Logger.warn("ContextMenus", "API 'contextMenus.onClicked' não disponível.");
  }

  // 3. Verifica o evento 'onShown' antes de adicionar o listener.
  if (browser.contextMenus.onShown) {
    browser.contextMenus.onShown.addListener(handleMenuShown);
  } else {
    Logger.warn("ContextMenus", "API 'contextMenus.onShown' não disponível.");
  }
}
