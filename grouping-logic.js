/**
 * @file grouping-logic.js
 * @description Lógica principal para agrupar abas.
 */

import Logger from "./logger.js";
import {
  settings,
  smartNameCache,
  saveSmartNameCache,
  getSmartNameFromLegacyCache,
  setSmartNameInLegacyCache,
  invalidateCacheByDomainChange,
} from "./settings-manager.js";
import { pendingAutomaticGroups, injectionFailureMap } from "./app-state.js";
import {
  handleTabOperation,
  handleGroupOperation,
  withErrorHandling,
} from "./adaptive-error-handler.js";
import { getConfig } from "./performance-config.js";
import {
  globalTabParallelProcessor,
  globalWindowDataProcessor,
} from "./parallel-batch-processor.js";
import {
  validateCondition,
  validateTabObject,
  sanitizeString,
  sanitizeUrl,
  VALID_TAB_PROPERTIES,
  VALID_OPERATORS,
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

/**
 * Limpa e formata um nome de domínio para ser usado como título de grupo.
 * Remove "www.", TLDs comuns e capitaliza cada parte.
 * @param {string} domain - O domínio a ser sanitizado.
 * @returns {string} O nome de domínio formatado.
 */
function sanitizeDomainName(domain) {
  if (!domain || typeof domain !== "string") {
    Logger.warn(
      "sanitizeDomainName",
      `Domínio inválido recebido: ${typeof domain}`
    );
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
    Logger.error(
      "evaluateCondition",
      `Tab inválida: ${tabValidation.errors.join("; ")}`
    );
    return false;
  }

  // Validação de entrada para condition
  const conditionValidation = validateCondition(condition);
  if (!conditionValidation.isValid) {
    Logger.error(
      "evaluateCondition",
      `Condição inválida: ${conditionValidation.errors.join("; ")}`
    );
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
      Logger.warn(
        "evaluateCondition",
        `Erro ao extrair pathname da URL: ${sanitizedUrl}`
      );
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
    Logger.error(
      "evaluateCondition",
      `Propriedade '${condition.property}' não suportada`
    );
    return false;
  }

  const propValue = String(tabProperties[condition.property] || "");
  const condValue = sanitizeString(String(condition.value || ""), 200);

  if (condValue === "") {
    Logger.debug(
      "evaluateCondition",
      "Condição com valor vazio sempre retorna falso"
    );
    return false; // Condições com valor vazio são sempre falsas.
  }

  // Validação adicional: verifica se o operador é suportado
  if (!VALID_OPERATORS.has(condition.operator)) {
    Logger.error(
      "evaluateCondition",
      `Operador '${condition.operator}' não suportado`
    );
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
          Logger.error(
            "evaluateCondition",
            `Regex inválida: "${condValue}". Erro: ${regexError.message}`
          );
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
          Logger.error(
            "evaluateCondition",
            `Wildcard inválido: "${condValue}". Erro: ${wildcardError.message}`
          );
          return false;
        }
      default:
        Logger.error(
          "evaluateCondition",
          `Operador desconhecido: ${condition.operator}`
        );
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
    Logger.error(
      "evaluateRule",
      `Tab inválida: ${tabValidation.errors.join("; ")}`
    );
    return false;
  }

  // Validação da regra
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    Logger.error("evaluateRule", "Regra deve ser um objeto válido");
    return false;
  }

  if (
    !rule.conditionGroup ||
    typeof rule.conditionGroup !== "object" ||
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
    Logger.error(
      "evaluateRule",
      "conditionGroup deve ter um array não vazio de conditions"
    );
    return false;
  }

  const { operator, conditions } = rule.conditionGroup;

  // Validação do operador
  if (!["AND", "OR"].includes(operator)) {
    Logger.error(
      "evaluateRule",
      `Operador lógico inválido: ${operator}. Deve ser 'AND' ou 'OR'`
    );
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
    Logger.error(
      "evaluateRule",
      `Erro inesperado ao avaliar regra: ${error.message}`,
      error
    );
    return false;
  }
}

// --- LÓGICA DE NOMENCLATURA ---

/**
 * Verifica se uma aba pode ser agrupada com base nas configurações.
 * @param {browser.tabs.Tab} tab - O objeto da aba.
 * @returns {boolean} Verdadeiro se a aba for agrupável.
 */
export function isTabGroupable(tab) {
  // Validação robusta da aba
  const tabValidation = validateTabObject(tab);
  if (!tabValidation.isValid) {
    Logger.debug(
      "isTabGroupable",
      `Tab inválida: ${tabValidation.errors.join("; ")}`
    );
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
    if (typeof exception !== "string" || !exception) {
      Logger.warn(
        "isTabGroupable",
        `Exceção inválida encontrada: ${typeof exception}`
      );
      return false;
    }
    return sanitizedUrl.includes(exception);
  });
}

/**
 * Extrai o hostname de uma URL de forma segura.
 * @param {string} url - A URL.
 * @returns {string|null} O hostname ou nulo se a URL for inválida.
 */
function getHostname(url) {
  if (typeof url !== "string" || !url) {
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
    Logger.debug(
      "getHostname",
      `Erro ao extrair hostname da URL: ${sanitizedUrl}. Erro: ${e.message}`
    );
    return null;
  }
}

/**
 * Tenta extrair um nome "inteligente" para o grupo a partir do conteúdo da página.
 * Injeta um content script para obter metadados como `og:site_name` ou `<h1>`.
 * @param {browser.tabs.Tab} tab - O objeto da aba.
 * @returns {Promise<string|null>} O nome inteligente extraído ou nulo.
 */
async function fetchSmartName(tab) {
  const tabId = tab.id;
  const failureCount = injectionFailureMap.get(tabId) || 0;
  const maxRetries = getConfig("MAX_INJECTION_RETRIES");

  if (failureCount >= maxRetries) {
    Logger.warn(
      "fetchSmartName",
      `Máximo de falhas de injeção para a aba ${tabId} (${maxRetries} tentativas).`
    );
    return null;
  }

  // Enhanced URL validation to prevent injection on protected pages
  if (!tab.url || !isValidUrlForInjection(tab.url)) {
    Logger.debug(
      "fetchSmartName",
      `URL não suportada para injeção: ${tab.url}`
    );
    return null;
  }

  const result = await withErrorHandling(
    async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Script injection timeout")), 5000);
      });

      const injectionPromise = browser.scripting.executeScript({
        target: { tabId },
        files: ["content-script.js"],
      });

      const injectionResults = await Promise.race([
        injectionPromise,
        timeoutPromise,
      ]);

      if (
        injectionResults &&
        injectionResults[0] &&
        injectionResults[0].result
      ) {
        const details = injectionResults[0].result;

        // 1. Tenta usar os nomes de alta prioridade primeiro.
        const priorityName =
          details.manifestName ||
          details.appleWebAppTitle ||
          details.ogSiteName ||
          details.applicationName ||
          details.schemaName ||
          details.ogTitle;
        if (priorityName && priorityName.trim()) {
          return sanitizeString(priorityName.trim(), 50);
        }

        // 2. Valida o h1Content para garantir que ele é relevante para o domínio.
        if (details.h1Content && details.h1Content.trim()) {
          const hostname = getHostname(tab.url);
          if (hostname) {
            // Extrai a parte principal do domínio (ex: 'google' de 'www.google.com')
            const domainCore = hostname.split(".")[0].toLowerCase();
            const h1Lower = details.h1Content.toLowerCase();
            if (h1Lower.includes(domainCore) || h1Lower.length <= 30) {
              return sanitizeString(details.h1Content.trim(), 50);
            }
          }
        }
      }
      return null;
    },
    {
      context: `fetchSmartName-${tabId}`,
      maxRetries: 1,
      criticalOperation: false,
      fallback: () => {
        // Fallback: incrementa contador de falhas e retorna null
        injectionFailureMap.set(
          tabId,
          (injectionFailureMap.get(tabId) || 0) + 1
        );
        return null;
      },
    }
  );

  if (result !== null) {
    // Sucesso - limpa contador de falhas
    injectionFailureMap.delete(tabId);
  }

  return result;
}

/**
 * Validates if a URL is safe for content script injection
 * @param {string} url - URL to validate
 * @returns {boolean} - True if safe for injection
 */
function isValidUrlForInjection(url) {
  if (!url || typeof url !== "string") return false;

  // Protected schemes that don't allow content script injection
  const protectedSchemes = [
    "chrome://",
    "chrome-extension://",
    "moz-extension://",
    "about:",
    "data:",
    "file:",
    "ftp:",
    "javascript:",
    "blob:",
    "chrome-search://",
    "chrome-devtools://",
    "view-source:",
  ];

  const lowerUrl = url.toLowerCase();
  if (protectedSchemes.some((scheme) => lowerUrl.startsWith(scheme))) {
    return false;
  }

  // Only allow http and https
  return lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://");
}

/**
 * Determina o nome final do grupo para uma aba, seguindo uma hierarquia de lógicas:
 * 1. Regras personalizadas.
 * 2. Cache inteligente.
 * 3. Extração de nome inteligente (se ativado).
 * 4. Fallback para o nome de domínio.
 * @param {browser.tabs.Tab} tab - O objeto da aba.
 * @returns {Promise<string|null>} O nome final do grupo ou nulo se não for agrupável.
 */
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

  // 2. Cache inteligente (com fallback para cache legado)
  const cachedName = getSmartNameFromLegacyCache(hostname);
  if (cachedName) {
    Logger.debug(
      "getFinalGroupName",
      `Cache hit para ${hostname}: ${cachedName}`
    );
    return cachedName;
  }

  // 3. Nomenclatura Inteligente
  let groupName = null;
  let confidence = 1.0;
  let source = "domain_fallback";

  if (settings.groupingMode === "smart") {
    groupName = await fetchSmartName(tab);
    if (groupName) {
      confidence = 0.9; // Alta confiança para nomes obtidos via script
      source = "smart_extraction";
      Logger.debug(
        "getFinalGroupName",
        `Nome inteligente obtido para ${hostname}: ${groupName}`
      );
    }
  }

  // 4. Fallback para nome de domínio
  if (!groupName) {
    groupName = sanitizeDomainName(hostname);
    confidence = 0.7; // Confiança média para nomes de domínio
    source = "domain_sanitization";
    Logger.debug(
      "getFinalGroupName",
      `Nome de domínio usado para ${hostname}: ${groupName}`
    );
  }

  // 5. Armazena no cache inteligente com metadados
  if (groupName) {
    setSmartNameInLegacyCache(hostname, groupName, {
      source,
      confidence,
      metadata: {
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        extractedAt: Date.now(),
        groupingMode: settings.groupingMode,
      },
    });

    // Mantém compatibilidade com sistema legado
    saveSmartNameCache();
  }

  return groupName;
}

/**
 * Obtém a próxima cor disponível da paleta de cores para novos grupos.
 * @returns {string} Uma string de cor (ex: "blue").
 */
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
  Logger.debug(
    "batchGetTabsParallel",
    `Obtendo ${tabIds.length} abas em paralelo`
  );

  // Usa o processador paralelo para obter abas
  const validTabs = await globalTabParallelProcessor.getTabsParallel(tabIds);

  Logger.debug(
    "batchGetTabsParallel",
    `${validTabs.length}/${tabIds.length} abas obtidas com sucesso`
  );
  return validTabs;
}

/**
 * Obtém os dados de múltiplas abas de forma otimizada, usando processamento paralelo.
 * @param {number[]} tabIds - Um array de IDs de abas a serem obtidas.
 * @returns {Promise<browser.tabs.Tab[]>} Uma promessa que resolve para um array de objetos de abas válidas.
 */
async function batchGetTabs(tabIds) {
  return batchGetTabsParallel(tabIds);
}

/**
 * Agrupa uma lista de abas pelo seu `windowId`.
 * @param {browser.tabs.Tab[]} tabs - O array de abas a ser agrupado.
 * @returns {Object.<number, browser.tabs.Tab[]>} Um objeto onde as chaves são IDs de janela e os valores são arrays de abas.
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
 * Obtém todos os dados de abas e grupos para uma janela específica de forma otimizada.
 * @param {number} windowId - O ID da janela a ser consultada.
 * @returns {Promise<{allTabsInWindow: browser.tabs.Tab[], allGroupsInWindow: browser.tabGroups.TabGroup[]}>} Uma promessa que resolve para um objeto contendo as abas e os grupos da janela.
 */
async function batchGetWindowData(windowId) {
  // Executa queries em paralelo para otimizar
  const [allTabsInWindow, allGroupsInWindow] = await Promise.all([
    browser.tabs.query({ windowId }),
    browser.tabGroups.query({ windowId }),
  ]);

  return { allTabsInWindow, allGroupsInWindow };
}

/**
 * Processa nomes de grupos em paralelo
 * @param {browser.tabs.Tab[]} tabs - Abas
 * @returns {Promise<Map>} Mapa de tabId para groupName
 */
async function batchProcessGroupNamesParallel(tabs) {
  Logger.debug(
    "batchProcessGroupNamesParallel",
    `Processando nomes para ${tabs.length} abas em paralelo`
  );

  // Usa o processador paralelo para obter nomes de grupos
  const tabIdToGroupName =
    await globalTabParallelProcessor.processGroupNamesParallel(
      tabs,
      getFinalGroupName
    );

  Logger.debug(
    "batchProcessGroupNamesParallel",
    `${tabIdToGroupName.size} nomes de grupos processados`
  );
  return tabIdToGroupName;
}

/**
 * Processa e obtém os nomes de grupo finais para uma lista de abas em paralelo.
 * @param {browser.tabs.Tab[]} tabs - O array de abas para processar.
 * @returns {Promise<Map<number, string>>} Uma promessa que resolve para um mapa de ID da aba para o nome do grupo.
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
async function batchGroupOperationsParallel(
  tabsToGroup,
  windowId,
  groupTitleToIdMap
) {
  const operations = [];

  Logger.debug(
    "batchGroupOperationsParallel",
    `Preparando ${tabsToGroup.size} operações de agrupamento`
  );

  // Prepara operações em lote
  for (const [groupName, tabIdsForGroup] of tabsToGroup.entries()) {
    const existingGroupId = groupTitleToIdMap.get(groupName);

    if (existingGroupId && !settings.manualGroupIds.includes(existingGroupId)) {
      // Operação de adicionar a grupo existente
      operations.push({
        type: "addToExisting",
        groupId: existingGroupId,
        tabIds: tabIdsForGroup,
        groupName,
      });
    } else if (!existingGroupId) {
      // Operação de criar novo grupo
      const matchedRule = settings.customRules.find(
        (r) => r.name === groupName
      );
      const color = matchedRule?.color || getNextColor();

      operations.push({
        type: "createNew",
        windowId,
        tabIds: tabIdsForGroup,
        groupName,
        color,
      });
    }
  }

  if (operations.length === 0) return;

  // Usa o processador paralelo para executar operações
  const results =
    await globalTabParallelProcessor.executeGroupOperationsParallel(operations);

  Logger.debug(
    "batchGroupOperationsParallel",
    `${results.length} operações de agrupamento concluídas`
  );
  return results;
}

/**
 * Executa operações de agrupamento (criar novo grupo ou adicionar a um existente) em lote e em paralelo.
 * @param {Map<string, number[]>} tabsToGroup - Um mapa do nome do grupo para um array de IDs de abas.
 * @param {number} windowId - O ID da janela onde as operações ocorrerão.
 * @param {Map<string, number>} groupTitleToIdMap - Um mapa de títulos de grupo para IDs de grupo existentes.
 * @returns {Promise<any[]>} Uma promessa que resolve para um array com os resultados das operações.
 */
async function batchGroupOperations(tabsToGroup, windowId, groupTitleToIdMap) {
  return batchGroupOperationsParallel(tabsToGroup, windowId, groupTitleToIdMap);
}

/**
 * Executa uma única operação de agrupamento, como criar um grupo ou adicionar abas a um grupo existente.
 * Envolve tratamento de erros e lógica de fallback.
 * @param {object} operation - O objeto da operação a ser executada.
 * @returns {Promise<object>} Uma promessa que resolve para o resultado da operação.
 */
async function executeGroupOperation(operation) {
  return await withErrorHandling(
    async () => {
      switch (operation.type) {
        case "addToExisting":
          await browser.tabs.group({
            groupId: operation.groupId,
            tabIds: operation.tabIds,
          });
          return {
            success: true,
            action: "added_to_existing",
            groupId: operation.groupId,
          };

        case "createNew":
          // Registra intenção de grupo automático
          pendingAutomaticGroups.set(operation.tabIds[0], {
            tabIds: operation.tabIds,
          });

          const newGroupId = await browser.tabs.group({
            createProperties: { windowId: operation.windowId },
            tabIds: operation.tabIds,
          });

          // Configura o grupo
          const matchedRule = settings.customRules.find(
            (r) => r.name === operation.groupName
          );
          const color = matchedRule?.color || getNextColor();

          await browser.tabGroups.update(newGroupId, {
            title: operation.groupName,
            color,
          });

          return { success: true, action: "created_new", groupId: newGroupId };

        default:
          throw new Error(`Tipo de operação desconhecido: ${operation.type}`);
      }
    },
    {
      context: `groupOperation-${operation.type}-${operation.groupName}`,
      maxRetries: 2,
      retryDelay: 500,
      criticalOperation: false,
      fallback: async () => {
        Logger.warn(
          "groupOperation",
          `Fallback para operação ${operation.type} do grupo "${operation.groupName}"`
        );
        if (operation.type === "createNew") {
          pendingAutomaticGroups.delete(operation.tabIds[0]);
        }
        return { success: false, fallback: true };
      },
    }
  );
}

// --- PROCESSAMENTO DA FILA ---

/**
 * Processa a fila de abas para agrupamento.
 * Esta é a função central que orquestra todo o processo de agrupamento automático.
 * @param {number[]} tabIds - Um array de IDs de abas a serem processadas.
 */
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
    const { allTabsInWindow, allGroupsInWindow } = await batchGetWindowData(
      windowId
    );

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
  const logThreshold = getConfig("PERFORMANCE_LOG_THRESHOLD");

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
