/**
 * @file grouping-logic.js
 * @description Lógica principal para agrupar abas.
 */

import Logger from "./logger.js";
import {
  settings,
  smartNameCache,
  saveSmartNameCache,
} from "./settings-manager.js";
import { pendingAutomaticGroups, injectionFailureMap } from "./app-state.js";
import {
  handleTabOperation,
  handleGroupOperation,
  withErrorHandling
} from "./error-handler.js";

const colors = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "pink",
  "cyan",
  "orange",
];
let colorIndex = 0;
const MAX_INJECTION_RETRIES = 3;

function sanitizeDomainName(domain) {
  if (!domain) return "";
  const tldsToRemove = (settings.domainSanitizationTlds || []).sort(
    (a, b) => b.length - a.length
  );
  let name = domain.toLowerCase().replace(/^www\./, "");
  const tld = tldsToRemove.find((t) => name.endsWith(t));
  if (tld) name = name.slice(0, -tld.length);
  return name
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// --- AVALIADOR DE REGRAS COMPLEXAS ---

/**
 * Avalia uma única condição contra uma aba.
 * @param {browser.tabs.Tab} tab - O objeto da aba.
 * @param {object} condition - A condição a ser avaliada.
 * @returns {boolean} - Verdadeiro se a condição for satisfeita.
 */
function evaluateCondition(tab, condition) {
  const tabProperties = {
    url: tab.url || "",
    title: tab.title || "",
    hostname: getHostname(tab.url) || "",
    url_path: (tab.url ? new URL(tab.url).pathname : "") || "",
  };

  const propValue = String(tabProperties[condition.property] || "");
  const condValue = String(condition.value || "");

  if (condValue === "") return false; // Condições com valor vazio são sempre falsas.

  try {
    switch (condition.operator) {
      case "contains":
        return propValue.toLowerCase().includes(condValue.toLowerCase());
      case "not_contains":
        return !propValue.toLowerCase().includes(condValue.toLowerCase());
      case "starts_with":
        return propValue.toLowerCase().startsWith(condValue.toLowerCase());
      case "ends_with":
        return propValue.toLowerCase().endsWith(condValue.toLowerCase());
      case "equals":
        return propValue.toLowerCase() === condValue.toLowerCase();
      case "regex":
        return new RegExp(condValue, "i").test(propValue);
      case "wildcard": // Mantido para retrocompatibilidade na migração
        return new RegExp(
          "^" +
            condValue
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .replace(/\\\*/g, ".*") +
            "$",
          "i"
        ).test(propValue);
      default:
        return false;
    }
  } catch (e) {
    Logger.error(
      "evaluateCondition",
      `Erro ao avaliar regex para o valor "${condValue}"`,
      e
    );
    return false;
  }
}

/**
 * Avalia um grupo de condições de uma regra.
 * @param {browser.tabs.Tab} tab - O objeto da aba.
 * @param {object} rule - A regra personalizada completa.
 * @returns {boolean} - Verdadeiro se a regra corresponder à aba.
 */
function evaluateRule(tab, rule) {
  if (
    !rule.conditionGroup ||
    !rule.conditionGroup.conditions ||
    rule.conditionGroup.conditions.length === 0
  ) {
    return false;
  }

  const { operator, conditions } = rule.conditionGroup;

  if (operator === "AND") {
    // Avaliação "preguiçosa": para na primeira condição falsa.
    return conditions.every((condition) => evaluateCondition(tab, condition));
  }

  if (operator === "OR") {
    // Avaliação "preguiçosa": para na primeira condição verdadeira.
    return conditions.some((condition) => evaluateCondition(tab, condition));
  }

  return false;
}

// --- LÓGICA DE NOMENCLATURA ---

export function isTabGroupable(tab) {
  if (!tab || !tab.id || !tab.url || !tab.url.startsWith("http") || tab.pinned)
    return false;
  return !settings.exceptions.some(
    (exception) => exception && tab.url.includes(exception)
  );
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

async function fetchSmartName(tab) {
  const tabId = tab.id;
  const failureCount = injectionFailureMap.get(tabId) || 0;
  if (failureCount >= MAX_INJECTION_RETRIES) {
    Logger.warn(
      "fetchSmartName",
      `Máximo de falhas de injeção para a aba ${tabId}.`
    );
    return null;
  }
  
  const result = await withErrorHandling(async () => {
    const injectionResults = await browser.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
    
    if (injectionResults && injectionResults[0] && injectionResults[0].result) {
      const details = injectionResults[0].result;

      // 1. Tenta usar os nomes de alta prioridade primeiro.
      const priorityName =
        details.manifestName ||
        details.appleWebAppTitle ||
        details.ogSiteName ||
        details.applicationName ||
        details.schemaName ||
        details.ogTitle;
      if (priorityName) {
        return priorityName;
      }

      // 2. Valida o h1Content para garantir que ele é relevante para o domínio.
      if (details.h1Content) {
        const hostname = getHostname(tab.url);
        if (hostname) {
          // Extrai a parte principal do domínio (ex: 'google' de 'www.google.com')
          const domainCore = hostname.split(".")[0].toLowerCase();
          if (details.h1Content.toLowerCase().includes(domainCore)) {
            return details.h1Content;
          }
        }
      }
    }
    return null;
  }, {
    context: `fetchSmartName-${tabId}`,
    maxRetries: 1,
    criticalOperation: false,
    fallback: () => {
      // Fallback: incrementa contador de falhas e retorna null
      injectionFailureMap.set(tabId, (injectionFailureMap.get(tabId) || 0) + 1);
      return null;
    }
  });
  
  if (result !== null) {
    // Sucesso - limpa contador de falhas
    injectionFailureMap.delete(tabId);
  }
  
  return result;
}

export async function getFinalGroupName(tab) {
  if (!isTabGroupable(tab)) return null;

  // 1. Regras personalizadas complexas
  for (const rule of settings.customRules || []) {
    if (evaluateRule(tab, rule)) {
      return rule.name;
    }
  }

  const hostname = getHostname(tab.url);
  if (!hostname) return null;

  // 2. Cache
  if (smartNameCache.has(hostname)) {
    return smartNameCache.get(hostname);
  }

  // 3. Nomenclatura Inteligente
  let groupName = null;
  if (settings.groupingMode === "smart") {
    groupName = await fetchSmartName(tab);
  }

  // 4. Fallback para nome de domínio
  if (!groupName) {
    groupName = sanitizeDomainName(hostname);
  }

  smartNameCache.set(hostname, groupName);
  saveSmartNameCache();
  return groupName;
}

export function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length;
  return color;
}

// --- PROCESSAMENTO DA FILA ---

export async function processTabQueue(tabIds) {
  if (!settings.autoGroupingEnabled || tabIds.length === 0) return;

  Logger.debug(
    "processTabQueue",
    `Iniciando processamento para: ${tabIds.join(", ")}.`
  );

  const tabsByWindow = {};
  const tabsToProcess = (
    await Promise.all(
      tabIds.map((id) => browser.tabs.get(id).catch(() => null))
    )
  ).filter(Boolean);
  if (tabsToProcess.length === 0) return;

  for (const tab of tabsToProcess) {
    (tabsByWindow[tab.windowId] = tabsByWindow[tab.windowId] || []).push(tab);
  }

  for (const windowIdStr in tabsByWindow) {
    const windowId = parseInt(windowIdStr, 10);
    const allTabsInWindow = await browser.tabs.query({ windowId });
    const allGroupsInWindow = await browser.tabGroups.query({ windowId });
    const groupTitleToIdMap = new Map(
      allGroupsInWindow.map((g) => [
        (g.title || "").replace(/\s\(\d+\)$/, "").replace(/📌\s*/g, ""),
        g.id,
      ])
    );

    const groupNamePromises = allTabsInWindow.map(async (tab) => ({
      tabId: tab.id,
      groupName: await getFinalGroupName(tab),
    }));
    const tabIdToGroupName = new Map(
      (await Promise.all(groupNamePromises)).map((item) => [
        item.tabId,
        item.groupName,
      ])
    );

    const groupNameCounts = new Map();
    for (const name of tabIdToGroupName.values()) {
      if (name) groupNameCounts.set(name, (groupNameCounts.get(name) || 0) + 1);
    }

    const tabsToGroup = new Map();
    for (const tab of allTabsInWindow) {
      if (settings.manualGroupIds.includes(tab.groupId)) continue;

      const finalGroupName = tabIdToGroupName.get(tab.id);
      if (!finalGroupName) {
        if (tab.groupId) await browser.tabs.ungroup([tab.id]).catch(() => {});
        continue;
      }

      const currentGroup = tab.groupId
        ? allGroupsInWindow.find((g) => g.id === tab.groupId)
        : null;
      const currentCleanTitle = currentGroup
        ? (currentGroup.title || "")
            .replace(/\s\(\d+\)$/, "")
            .replace(/📌\s*/g, "")
        : null;
      if (finalGroupName === currentCleanTitle) continue;

      const matchedRule = settings.customRules.find(
        (r) => r.name === finalGroupName
      );
      const minTabsRequired = matchedRule
        ? matchedRule.minTabs || 1
        : settings.minTabsForAutoGroup || 2;
      const totalMatchingTabs = groupNameCounts.get(finalGroupName) || 0;

      if (totalMatchingTabs < minTabsRequired) {
        if (tab.groupId) await browser.tabs.ungroup([tab.id]).catch(() => {});
        continue;
      }

      if (!tabsToGroup.has(finalGroupName)) {
        tabsToGroup.set(finalGroupName, []);
      }
      tabsToGroup.get(finalGroupName).push(tab.id);
    }

    for (const [groupName, tabIdsForGroup] of tabsToGroup.entries()) {
      await withErrorHandling(async () => {
        const existingGroupId = groupTitleToIdMap.get(groupName);
        if (
          existingGroupId &&
          !settings.manualGroupIds.includes(existingGroupId)
        ) {
          await browser.tabs.group({
            groupId: existingGroupId,
            tabIds: tabIdsForGroup,
          });
          return { success: true, action: 'added_to_existing', groupId: existingGroupId };
        } else if (!existingGroupId) {
          // 1. Registar a intenção de criar um grupo automático.
          pendingAutomaticGroups.set(tabIdsForGroup[0], {
            tabIds: tabIdsForGroup,
          });
          const newGroupId = await browser.tabs.group({
            createProperties: { windowId },
            tabIds: tabIdsForGroup,
          });
          // A classificação como automático será agora feita em handleTabGroupCreated.
          const matchedRule = settings.customRules.find(
            (r) => r.name === groupName
          );
          const color =
            matchedRule && matchedRule.color
              ? matchedRule.color
              : getNextColor();
          await browser.tabGroups.update(newGroupId, {
            title: groupName,
            color,
          });
          groupTitleToIdMap.set(groupName, newGroupId);
          return { success: true, action: 'created_new', groupId: newGroupId };
        }
        return { success: false, reason: 'no_action_needed' };
      }, {
        context: `processTabQueue-group-${groupName}`,
        maxRetries: 2,
        retryDelay: 500,
        criticalOperation: false,
        fallback: async () => {
          // Fallback: remove abas problemáticas da fila pendente
          Logger.warn(
            "processTabQueue",
            `Removendo abas problemáticas do grupo "${groupName}" da fila pendente.`
          );
          pendingAutomaticGroups.delete(tabIdsForGroup[0]);
          return { success: false, fallback: true };
        }
      });
    }
  }
}
