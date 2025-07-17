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
import { getConfig } from "./performance-config.js";
import { batchProcessTabs, batchProcessGroups } from "./async-batch-processor.js";
import { 
  globalTabParallelProcessor, 
  globalWindowDataProcessor 
} from "./parallel-batch-processor.js";
import {
  validateCondition,
  validateTabObject,
  sanitizeString,
  sanitizeUrl,
  VALID_TAB_PROPERTIES,
  VALID_OPERATORS
} from "./validation-utils.js";

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

function sanitizeDomainName(domain) {
  if (!domain || typeof domain !== 'string') {
    Logger.warn('sanitizeDomainName', `Domínio inválido recebido: ${typeof domain}`);
    return "";
  }
  
  const sanitizedDomain = sanitizeString(domain, 100);
  if (!sanitizedDomain) return "";
  
  const tldsToRemove = (settings.domainSanitizationTlds || []).sort(
    (a, b) => b.length - a.length
  );
  let name = sanitizedDomain.toLowerCase().replace(/^www\./, "");
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
  // Validação de entrada para tab
  const tabValidation = validateTabObject(tab);
  if (!tabValidation.isValid) {
    Logger.error("evaluateCondition", `Tab inválida: ${tabValidation.errors.join('; ')}`);
    return false;
  }

  // Validação de entrada para condition
  const conditionValidation = validateCondition(condition);
  if (!conditionValidation.isValid) {
    Logger.error("evaluateCondition", `Condição inválida: ${conditionValidation.errors.join('; ')}`);
    return false;
  }

  // Sanitização segura das propriedades da aba
  const sanitizedUrl = sanitizeUrl(tab.url) || "";
  const sanitizedTitle = sanitizeString(tab.title || "", 200);
  const hostname = getHostname(sanitizedUrl) || "";
  
  let urlPath = "";
  if (sanitizedUrl) {
    try {
      urlPath = new URL(sanitizedUrl).pathname || "";
    } catch (e) {
      Logger.warn("evaluateCondition", `Erro ao extrair pathname da URL: ${sanitizedUrl}`);
      urlPath = "";
    }
  }

  const tabProperties = {
    url: sanitizedUrl,
    title: sanitizedTitle,
    hostname: sanitizeString(hostname, 100),
    url_path: sanitizeString(urlPath, 100),
  };

  // Validação adicional: verifica se a propriedade existe
  if (!VALID_TAB_PROPERTIES.has(condition.property)) {
    Logger.error("evaluateCondition", `Propriedade '${condition.property}' não suportada`);
    return false;
  }

  const propValue = String(tabProperties[condition.property] || "");
  const condValue = sanitizeString(String(condition.value || ""), 200);

  if (condValue === "") {
    Logger.debug("evaluateCondition", "Condição com valor vazio sempre retorna falso");
    return false; // Condições com valor vazio são sempre falsas.
  }

  // Validação adicional: verifica se o operador é suportado
  if (!VALID_OPERATORS.has(condition.operator)) {
    Logger.error("evaluateCondition", `Operador '${condition.operator}' não suportado`);
    return false;
  }

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
        try {
          const regex = new RegExp(condValue, "i");
          return regex.test(propValue);
        } catch (regexError) {
          Logger.error("evaluateCondition", `Regex inválida: "${condValue}". Erro: ${regexError.message}`);
          return false;
        }
      case "wildcard": // Mantido para retrocompatibilidade na migração
        try {
          const wildcardRegex = new RegExp(
            "^" +
              condValue
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                .replace(/\\\*/g, ".*") +
              "$",
            "i"
          );
          return wildcardRegex.test(propValue);
        } catch (wildcardError) {
          Logger.error("evaluateCondition", `Wildcard inválido: "${condValue}". Erro: ${wildcardError.message}`);
          return false;
        }
      default:
        Logger.error("evaluateCondition", `Operador desconhecido: ${condition.operator}`);
        return false;
    }
  } catch (e) {
    Logger.error(
      "evaluateCondition",
      `Erro inesperado ao avaliar condição: propriedade="${condition.property}", operador="${condition.operator}", valor="${condValue}"`,
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
  // Validação da aba
  const tabValidation = validateTabObject(tab);
  if (!tabValidation.isValid) {
    Logger.error("evaluateRule", `Tab inválida: ${tabValidation.errors.join('; ')}`);
    return false;
  }

  // Validação da regra
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    Logger.error("evaluateRule", "Regra deve ser um objeto válido");
    return false;
  }

  if (
    !rule.conditionGroup ||
    typeof rule.conditionGroup !== 'object' ||
    Array.isArray(rule.conditionGroup)
  ) {
    Logger.error("evaluateRule", "Regra deve ter um conditionGroup válido");
    return false;
  }

  if (
    !rule.conditionGroup.conditions ||
    !Array.isArray(rule.conditionGroup.conditions) ||
    rule.conditionGroup.conditions.length === 0
  ) {
    Logger.error("evaluateRule", "conditionGroup deve ter um array não vazio de conditions");
    return false;
  }

  const { operator, conditions } = rule.conditionGroup;

  // Validação do operador
  if (!['AND', 'OR'].includes(operator)) {
    Logger.error("evaluateRule", `Operador lógico inválido: ${operator}. Deve ser 'AND' ou 'OR'`);
    return false;
  }

  try {
    if (operator === "AND") {
      // Avaliação "preguiçosa": para na primeira condição falsa.
      return conditions.every((condition) => evaluateCondition(tab, condition));
    }

    if (operator === "OR") {
      // Avaliação "preguiçosa": para na primeira condição verdadeira.
      return conditions.some((condition) => evaluateCondition(tab, condition));
    }

    return false;
  } catch (error) {
    Logger.error("evaluateRule", `Erro inesperado ao avaliar regra: ${error.message}`, error);
    return false;
  }
}

// --- LÓGICA DE NOMENCLATURA ---

export function isTabGroupable(tab) {
  // Validação robusta da aba
  const tabValidation = validateTabObject(tab);
  if (!tabValidation.isValid) {
    Logger.debug("isTabGroupable", `Tab inválida: ${tabValidation.errors.join('; ')}`);
    return false;
  }

  // Verificações básicas
  if (!tab || !tab.id || !tab.url || tab.pinned) {
    return false;
  }

  // Sanitização e validação da URL
  const sanitizedUrl = sanitizeUrl(tab.url);
  if (!sanitizedUrl || !sanitizedUrl.startsWith("http")) {
    return false;
  }

  // Verificação de exceções com validação
  if (!Array.isArray(settings.exceptions)) {
    Logger.warn("isTabGroupable", "settings.exceptions não é um array válido");
    return true; // Se exceptions não for válido, considera que a aba é agrupável
  }

  return !settings.exceptions.some((exception) => {
    if (typeof exception !== 'string' || !exception) {
      Logger.warn("isTabGroupable", `Exceção inválida encontrada: ${typeof exception}`);
      return false;
    }
    return sanitizedUrl.includes(exception);
  });
}

function getHostname(url) {
  if (typeof url !== 'string' || !url) {
    Logger.debug("getHostname", `URL inválida recebida: ${typeof url}`);
    return null;
  }

  const sanitizedUrl = sanitizeUrl(url);
  if (!sanitizedUrl) {
    return null;
  }

  try {
    return new URL(sanitizedUrl).hostname;
  } catch (e) {
    Logger.debug("getHostname", `Erro ao extrair hostname da URL: ${sanitizedUrl}. Erro: ${e.message}`);
    return null;
  }
}

async function fetchSmartName(tab) {
  const tabId = tab.id;
  const failureCount = injectionFailureMap.get(tabId) || 0;
  const maxRetries = getConfig('MAX_INJECTION_RETRIES');
  
  if (failureCount >= maxRetries) {
    Logger.warn(
      "fetchSmartName",
      `Máximo de falhas de injeção para a aba ${tabId} (${maxRetries} tentativas).`
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

// --- FUNÇÕES DE OTIMIZAÇÃO E BATCHING ---

/**
 * Obtém múltiplas abas em lote de forma otimizada
 * @param {number[]} tabIds - IDs das abas
 * @returns {Promise<browser.tabs.Tab[]>} Abas válidas
 */
/**
 * Obtém múltiplas abas em paralelo de forma otimizada
 * @param {number[]} tabIds - IDs das abas
 * @returns {Promise<browser.tabs.Tab[]>} Abas válidas
 */
async function batchGetTabsParallel(tabIds) {
  Logger.debug("batchGetTabsParallel", `Obtendo ${tabIds.length} abas em paralelo`);
  
  // Usa o processador paralelo para obter abas
  const validTabs = await globalTabParallelProcessor.getTabsParallel(tabIds);
  
  Logger.debug("batchGetTabsParallel", `${validTabs.length}/${tabIds.length} abas obtidas com sucesso`);
  return validTabs;
}

/**
 * Função otimizada que substitui a implementação sequencial anterior
 * @param {number[]} tabIds - IDs das abas
 * @returns {Promise<browser.tabs.Tab[]>} Abas válidas
 */
async function batchGetTabs(tabIds) {
  return batchGetTabsParallel(tabIds);
}

/**
 * Agrupa abas por janela
 * @param {browser.tabs.Tab[]} tabs - Abas
 * @returns {object} Abas agrupadas por windowId
 */
function groupTabsByWindow(tabs) {
  const tabsByWindow = {};
  for (const tab of tabs) {
    if (!tabsByWindow[tab.windowId]) {
      tabsByWindow[tab.windowId] = [];
    }
    tabsByWindow[tab.windowId].push(tab);
  }
  return tabsByWindow;
}

/**
 * Obtém dados de grupos e abas para uma janela em lote
 * @param {number} windowId - ID da janela
 * @returns {Promise<object>} Dados da janela
 */
async function batchGetWindowData(windowId) {
  // Executa queries em paralelo para otimizar
  const [allTabsInWindow, allGroupsInWindow] = await Promise.all([
    browser.tabs.query({ windowId }),
    browser.tabGroups.query({ windowId })
  ]);
  
  return { allTabsInWindow, allGroupsInWindow };
}

/**
 * Processa nomes de grupos em paralelo
 * @param {browser.tabs.Tab[]} tabs - Abas
 * @returns {Promise<Map>} Mapa de tabId para groupName
 */
async function batchProcessGroupNamesParallel(tabs) {
  Logger.debug("batchProcessGroupNamesParallel", `Processando nomes para ${tabs.length} abas em paralelo`);
  
  // Usa o processador paralelo para obter nomes de grupos
  const tabIdToGroupName = await globalTabParallelProcessor.processGroupNamesParallel(tabs, getFinalGroupName);
  
  Logger.debug("batchProcessGroupNamesParallel", `${tabIdToGroupName.size} nomes de grupos processados`);
  return tabIdToGroupName;
}

/**
 * Função otimizada que substitui a implementação sequencial anterior
 * @param {browser.tabs.Tab[]} tabs - Abas
 * @returns {Promise<Map>} Mapa de tabId para groupName
 */
async function batchProcessGroupNames(tabs) {
  return batchProcessGroupNamesParallel(tabs);
}

/**
 * Executa operações de agrupamento em paralelo otimizado
 * @param {Map} tabsToGroup - Mapa de groupName para tabIds
 * @param {number} windowId - ID da janela
 * @param {Map} groupTitleToIdMap - Mapa de títulos para IDs de grupo
 */
async function batchGroupOperationsParallel(tabsToGroup, windowId, groupTitleToIdMap) {
  const operations = [];
  
  Logger.debug("batchGroupOperationsParallel", `Preparando ${tabsToGroup.size} operações de agrupamento`);
  
  // Prepara operações em lote
  for (const [groupName, tabIdsForGroup] of tabsToGroup.entries()) {
    const existingGroupId = groupTitleToIdMap.get(groupName);
    
    if (existingGroupId && !settings.manualGroupIds.includes(existingGroupId)) {
      // Operação de adicionar a grupo existente
      operations.push({
        type: 'addToExisting',
        groupId: existingGroupId,
        tabIds: tabIdsForGroup,
        groupName
      });
    } else if (!existingGroupId) {
      // Operação de criar novo grupo
      const matchedRule = settings.customRules.find(r => r.name === groupName);
      const color = matchedRule?.color || getNextColor();
      
      operations.push({
        type: 'createNew',
        windowId,
        tabIds: tabIdsForGroup,
        groupName,
        color
      });
    }
  }
  
  if (operations.length === 0) return;
  
  // Usa o processador paralelo para executar operações
  const results = await globalTabParallelProcessor.executeGroupOperationsParallel(operations);
  
  Logger.debug("batchGroupOperationsParallel", `${results.length} operações de agrupamento concluídas`);
  return results;
}

/**
 * Função otimizada que substitui a implementação sequencial anterior
 * @param {Map} tabsToGroup - Mapa de groupName para tabIds
 * @param {number} windowId - ID da janela
 * @param {Map} groupTitleToIdMap - Mapa de títulos para IDs de grupo
 */
async function batchGroupOperations(tabsToGroup, windowId, groupTitleToIdMap) {
  return batchGroupOperationsParallel(tabsToGroup, windowId, groupTitleToIdMap);
}

/**
 * Executa uma operação de agrupamento individual
 * @param {object} operation - Operação a executar
 */
async function executeGroupOperation(operation) {
  return await withErrorHandling(async () => {
    switch (operation.type) {
      case 'addToExisting':
        await browser.tabs.group({
          groupId: operation.groupId,
          tabIds: operation.tabIds,
        });
        return { success: true, action: 'added_to_existing', groupId: operation.groupId };
        
      case 'createNew':
        // Registra intenção de grupo automático
        pendingAutomaticGroups.set(operation.tabIds[0], {
          tabIds: operation.tabIds,
        });
        
        const newGroupId = await browser.tabs.group({
          createProperties: { windowId: operation.windowId },
          tabIds: operation.tabIds,
        });
        
        // Configura o grupo
        const matchedRule = settings.customRules.find(r => r.name === operation.groupName);
        const color = matchedRule?.color || getNextColor();
        
        await browser.tabGroups.update(newGroupId, {
          title: operation.groupName,
          color,
        });
        
        return { success: true, action: 'created_new', groupId: newGroupId };
        
      default:
        throw new Error(`Tipo de operação desconhecido: ${operation.type}`);
    }
  }, {
    context: `groupOperation-${operation.type}-${operation.groupName}`,
    maxRetries: 2,
    retryDelay: 500,
    criticalOperation: false,
    fallback: async () => {
      Logger.warn("groupOperation", `Fallback para operação ${operation.type} do grupo "${operation.groupName}"`);
      if (operation.type === 'createNew') {
        pendingAutomaticGroups.delete(operation.tabIds[0]);
      }
      return { success: false, fallback: true };
    }
  });
}

// --- PROCESSAMENTO DA FILA ---

export async function processTabQueue(tabIds) {
  if (!settings.autoGroupingEnabled || tabIds.length === 0) return;

  const startTime = Date.now();
  Logger.debug(
    "processTabQueue",
    `Iniciando processamento para ${tabIds.length} abas.`
  );

  // Otimização: Processar tabs em lotes para reduzir chamadas de API
  const tabsToProcess = await batchGetTabs(tabIds);
  if (tabsToProcess.length === 0) return;

  const tabsByWindow = groupTabsByWindow(tabsToProcess);

  // Processa cada janela com otimizações de batching
  for (const windowIdStr in tabsByWindow) {
    const windowId = parseInt(windowIdStr, 10);
    
    // Obtém dados da janela em paralelo
    const { allTabsInWindow, allGroupsInWindow } = await batchGetWindowData(windowId);
    
    const groupTitleToIdMap = new Map(
      allGroupsInWindow.map((g) => [
        (g.title || "").replace(/\s\(\d+\)$/, "").replace(/📌\s*/g, ""),
        g.id,
      ])
    );

    // Processa nomes de grupos em lote
    const tabIdToGroupName = await batchProcessGroupNames(allTabsInWindow);

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

    // Executa operações de agrupamento em lote otimizado
    await batchGroupOperations(tabsToGroup, windowId, groupTitleToIdMap);
  }
  
  // Log de performance se habilitado
  const duration = Date.now() - startTime;
  const logThreshold = getConfig('PERFORMANCE_LOG_THRESHOLD');
  
  if (duration > logThreshold) {
    Logger.info(
      "processTabQueue",
      `Processamento de ${tabIds.length} abas concluído em ${duration}ms (acima do threshold de ${logThreshold}ms)`
    );
  } else {
    Logger.debug(
      "processTabQueue",
      `Processamento de ${tabIds.length} abas concluído em ${duration}ms`
    );
  }
}
