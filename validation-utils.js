/**
 * @file validation-utils.js
 * @description Utilitários para validação de tipos e inputs, focado em type safety e robustez.
 */

// Mensagem de depuração para confirmar o carregamento do módulo
console.log("validation-utils.js loaded");

// Importa o objeto Logger explicitamente
import Logger from "./logger.js";

/**
 * Tipos válidos de propriedades de aba para condições
 */
export const VALID_TAB_PROPERTIES = new Set([
  "url",
  "title",
  "hostname",
  "url_path",
]);

/**
 * Operadores válidos para condições
 */
export const VALID_OPERATORS = new Set([
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "equals",
  "regex",
  "wildcard",
]);

/**
 * Operadores lógicos válidos para grupos de condições
 */
export const VALID_LOGICAL_OPERATORS = new Set(["AND", "OR"]);

/**
 * Cores válidas para grupos de abas
 */
export const VALID_GROUP_COLORS = new Set([
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "pink",
  "cyan",
  "orange",
  "grey",
]);

/**
 * Valida se um valor é uma string não vazia
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isNonEmptyString(value, fieldName = "value") {
  const isValid = typeof value === "string" && value.trim().length > 0;
  if (!isValid) {
    // Risco: Logger pode não estar totalmente inicializado ou ter um problema próprio.
    // Mitigação: Adicionar um try-catch ao redor da chamada do Logger para evitar que o erro se propague.
    try {
      Logger.warn(
        "Validation",
        `Campo '${fieldName}' deve ser uma string não vazia. Recebido: ${typeof value}`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação para '${fieldName}': ${logError.message}`
      );
    }
  }
  return isValid;
}

/**
 * Valida se um valor é um número positivo
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isPositiveNumber(value, fieldName = "value") {
  const isValid =
    typeof value === "number" && Number.isFinite(value) && value > 0;
  if (!isValid) {
    try {
      Logger.warn(
        "Validation",
        `Campo '${fieldName}' deve ser um número positivo. Recebido: ${value} (${typeof value})`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação para '${fieldName}': ${logError.message}`
      );
    }
  }
  return isValid;
}

/**
 * Valida se um valor é um número inteiro não negativo
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isNonNegativeInteger(value, fieldName = "value") {
  const isValid =
    typeof value === "number" && Number.isInteger(value) && value >= 0;
  if (!isValid) {
    try {
      Logger.warn(
        "Validation",
        `Campo '${fieldName}' deve ser um número inteiro não negativo. Recebido: ${value} (${typeof value})`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação para '${fieldName}': ${logError.message}`
      );
    }
  }
  return isValid;
}

/**
 * Valida se um valor é um booleano
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isBoolean(value, fieldName = "value") {
  const isValid = typeof value === "boolean";
  if (!isValid) {
    try {
      Logger.warn(
        "Validation",
        `Campo '${fieldName}' deve ser booleano. Recebido: ${value} (${typeof value})`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação para '${fieldName}': ${logError.message}`
      );
    }
  }
  return isValid;
}

/**
 * Valida se um valor é um array não vazio
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isNonEmptyArray(value, fieldName = "value") {
  const isValid = Array.isArray(value) && value.length > 0;
  if (!isValid) {
    try {
      Logger.warn(
        "Validation",
        `Campo '${fieldName}' deve ser um array não vazio. Recebido: ${
          Array.isArray(value) ? "array vazio" : typeof value
        }`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação para '${fieldName}': ${logError.message}`
      );
    }
  }
  return isValid;
}

/**
 * Valida uma regex de forma segura
 * @param {string} pattern - Padrão regex
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se a regex é válida
 */
export function isValidRegex(pattern, fieldName = "regex") {
  if (!isNonEmptyString(pattern, fieldName)) {
    return false;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    try {
      Logger.warn(
        "Validation",
        `Regex inválida no campo '${fieldName}': ${pattern}. Erro: ${error.message}`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação para '${fieldName}': ${logError.message}`
      );
    }
    return false;
  }
}

/**
 * Valida uma condição individual
 * @param {any} condition - Condição a validar
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateCondition(condition) {
  const errors = [];

  // Verifica se condition é um objeto
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    errors.push("Condição deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Valida propriedade
  if (!VALID_TAB_PROPERTIES.has(condition.property)) {
    errors.push(
      `Propriedade '${
        condition.property
      }' inválida. Valores válidos: ${Array.from(VALID_TAB_PROPERTIES).join(
        ", "
      )}`
    );
  }

  // Valida operador
  if (!VALID_OPERATORS.has(condition.operator)) {
    errors.push(
      `Operador '${condition.operator}' inválido. Valores válidos: ${Array.from(
        VALID_OPERATORS
      ).join(", ")}`
    );
  }

  // Valida valor
  if (!isNonEmptyString(condition.value, "condition.value")) {
    errors.push("Valor da condição deve ser uma string não vazia");
  }

  // Validação específica para regex
  if (condition.operator === "regex" && condition.value) {
    if (!isValidRegex(condition.value, "condition.value")) {
      errors.push(
        "Valor da condição com operador regex deve ser uma expressão regular válida"
      );
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn("Validation", `Condição inválida: ${errors.join("; ")}`);
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de condição: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Valida um grupo de condições
 * @param {any} conditionGroup - Grupo de condições a validar
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateConditionGroup(conditionGroup) {
  const errors = [];

  // Verifica se conditionGroup é um objeto
  if (
    !conditionGroup ||
    typeof conditionGroup !== "object" ||
    Array.isArray(conditionGroup)
  ) {
    errors.push("Grupo de condições deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Valida operador lógico
  if (!VALID_LOGICAL_OPERATORS.has(conditionGroup.operator)) {
    errors.push(
      `Operador lógico '${
        conditionGroup.operator
      }' inválido. Valores válidos: ${Array.from(VALID_LOGICAL_OPERATORS).join(
        ", "
      )}`
    );
  }

  // Valida conditions array
  if (!Array.isArray(conditionGroup.conditions)) {
    errors.push("Campo conditions deve ser um array");
  } else if (conditionGroup.conditions.length === 0) {
    errors.push("Grupo de condições deve ter pelo menos uma condição");
  } else {
    // Valida cada condição individualmente
    conditionGroup.conditions.forEach((condition, index) => {
      const conditionResult = validateCondition(condition);
      if (!conditionResult.isValid) {
        errors.push(
          `Condição ${index + 1}: ${conditionResult.errors.join("; ")}`
        );
      }
    });
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn(
        "Validation",
        `Grupo de condições inválido: ${errors.join("; ")}`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de grupo de condições: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Valida uma regra personalizada completa
 * @param {any} rule - Regra a validar
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateCustomRule(rule) {
  const errors = [];

  // Verifica se rule é um objeto
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    errors.push("Regra deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Valida nome da regra
  if (!isNonEmptyString(rule.name, "rule.name")) {
    errors.push("Nome da regra deve ser uma string não vazia");
  }

  // Valida cor (opcional)
  if (rule.color && !VALID_GROUP_COLORS.has(rule.color)) {
    errors.push(
      `Cor '${rule.color}' inválida. Valores válidos: ${Array.from(
        VALID_GROUP_COLORS
      ).join(", ")}`
    );
  }

  // Valida minTabs (opcional)
  if (
    rule.minTabs !== undefined &&
    !isPositiveNumber(rule.minTabs, "rule.minTabs")
  ) {
    errors.push("minTabs deve ser um número positivo");
  }

  // Valida conditionGroup
  if (!rule.conditionGroup) {
    errors.push("Regra deve ter um conditionGroup");
  } else {
    const groupResult = validateConditionGroup(rule.conditionGroup);
    if (!groupResult.isValid) {
      errors.push(`conditionGroup inválido: ${groupResult.errors.join("; ")}`);
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn(
        "Validation",
        `Regra personalizada inválida: ${errors.join("; ")}`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de regra personalizada: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Valida um objeto de aba do browser
 * @param {any} tab - Objeto da aba a validar
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateTabObject(tab) {
  const errors = [];

  // Verifica se tab é um objeto
  if (!tab || typeof tab !== "object" || Array.isArray(tab)) {
    errors.push("Tab deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Valida propriedades essenciais
  if (tab.id !== undefined && !isNonNegativeInteger(tab.id, "tab.id")) {
    errors.push("tab.id deve ser um número inteiro não negativo");
  }

  if (tab.url !== undefined && typeof tab.url !== "string") {
    errors.push("tab.url deve ser uma string");
  }

  if (tab.title !== undefined && typeof tab.title !== "string") {
    errors.push("tab.title deve ser uma string");
  }

  if (
    tab.windowId !== undefined &&
    !isNonNegativeInteger(tab.windowId, "tab.windowId")
  ) {
    errors.push("tab.windowId deve ser um número inteiro não negativo");
  }

  if (
    tab.groupId !== undefined &&
    tab.groupId !== -1 &&
    !isNonNegativeInteger(tab.groupId, "tab.groupId")
  ) {
    errors.push("tab.groupId deve ser um número inteiro não negativo ou -1");
  }

  if (tab.pinned !== undefined && !isBoolean(tab.pinned, "tab.pinned")) {
    errors.push("tab.pinned deve ser booleano");
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn("Validation", `Objeto tab inválido: ${errors.join("; ")}`);
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de objeto tab: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Valida configurações do usuário
 * @param {any} settings - Configurações a validar
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateSettings(settings) {
  const errors = [];

  // Verifica se settings é um objeto
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    errors.push("Settings deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Valida booleanos
  const booleanFields = [
    "autoGroupingEnabled",
    "ungroupSingleTabs",
    "uncollapseOnActivate",
    "showTabCount",
    "syncEnabled",
    "tabRenamingEnabled",
  ]; // NOVO: tabRenamingEnabled
  booleanFields.forEach((field) => {
    if (
      settings[field] !== undefined &&
      !isBoolean(settings[field], `settings.${field}`)
    ) {
      errors.push(`${field} deve ser booleano`);
    }
  });

  // Valida números
  if (
    settings.minTabsForAutoGroup !== undefined &&
    !isPositiveNumber(
      settings.minTabsForAutoGroup,
      "settings.minTabsForAutoGroup"
    )
  ) {
    errors.push("minTabsForAutoGroup deve ser um número positivo");
  }

  if (
    settings.autoCollapseTimeout !== undefined &&
    !isNonNegativeInteger(
      settings.autoCollapseTimeout,
      "settings.autoCollapseTimeout"
    )
  ) {
    errors.push("autoCollapseTimeout deve ser um número inteiro não negativo");
  }

  if (
    settings.ungroupSingleTabsTimeout !== undefined &&
    !isNonNegativeInteger(
      settings.ungroupSingleTabsTimeout,
      "settings.ungroupSingleTabsTimeout"
    )
  ) {
    errors.push(
      "ungroupSingleTabsTimeout deve ser um número inteiro não negativo"
    );
  }

  // Valida strings
  if (
    settings.groupingMode !== undefined &&
    !["smart", "domain"].includes(settings.groupingMode)
  ) {
    errors.push("groupingMode deve ser 'smart' ou 'domain'");
  }

  if (
    settings.logLevel !== undefined &&
    !["DEBUG", "INFO", "WARN", "ERROR", "NONE"].includes(settings.logLevel)
  ) {
    // Adicionado 'NONE'
    errors.push("logLevel deve ser DEBUG, INFO, WARN, ERROR ou NONE");
  }

  if (
    settings.theme !== undefined &&
    !["auto", "light", "dark"].includes(settings.theme)
  ) {
    errors.push("theme deve ser auto, light ou dark");
  }

  // Valida arrays
  if (settings.customRules !== undefined) {
    if (!Array.isArray(settings.customRules)) {
      errors.push("customRules deve ser um array");
    } else {
      settings.customRules.forEach((rule, index) => {
        const ruleResult = validateCustomRule(rule);
        if (!ruleResult.isValid) {
          errors.push(`Regra ${index + 1}: ${ruleResult.errors.join("; ")}`);
        }
      });
    }
  }

  if (settings.exceptions !== undefined) {
    if (!Array.isArray(settings.exceptions)) {
      errors.push("exceptions deve ser um array");
    } else {
      settings.exceptions.forEach((exception, index) => {
        if (typeof exception !== "string") {
          errors.push(`Exception ${index + 1} deve ser uma string`);
        }
      });
    }
  }

  if (settings.manualGroupIds !== undefined) {
    if (!Array.isArray(settings.manualGroupIds)) {
      errors.push("manualGroupIds deve ser um array");
    } else {
      settings.manualGroupIds.forEach((id, index) => {
        if (!isNonNegativeInteger(id, `manualGroupIds[${index}]`)) {
          errors.push(
            `manualGroupIds[${index}] deve ser um número inteiro não negativo`
          );
        }
      });
    }
  }

  // NOVO: Valida tabRenamingRules
  if (settings.tabRenamingRules !== undefined) {
    if (!Array.isArray(settings.tabRenamingRules)) {
      errors.push("tabRenamingRules deve ser um array");
    } else {
      settings.tabRenamingRules.forEach((rule, index) => {
        const ruleResult = validateTabRenamingRule(rule);
        if (!ruleResult.isValid) {
          errors.push(
            `Regra de Renomeação ${index + 1}: ${ruleResult.errors.join("; ")}`
          );
        }
      });
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn("Validation", `Settings inválidas: ${errors.join("; ")}`);
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de settings: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Sanitiza uma string removendo caracteres perigosos
 * @param {any} input - Input a sanitizar
 * @param {number} maxLength - Comprimento máximo (padrão: 500)
 * @returns {string} - String sanitizada
 */
export function sanitizeString(input, maxLength = 500) {
  if (typeof input !== "string") {
    try {
      Logger.warn(
        "Validation",
        `sanitizeString recebeu tipo inválido: ${typeof input}`
      );
    } catch (logError) {
      console.warn(
        `Erro ao registrar sanitização de string: ${logError.message}`
      );
    }
    return "";
  }

  // Remove caracteres de controle e limita o comprimento
  const sanitized = input
    // eslint-disable-next-line no-control-regex -- Required for sanitizing control characters from user input
    // eslint-disable-next-line no-control-regex -- Required for sanitizing control characters from user input
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove caracteres de controle
    .slice(0, maxLength)
    .trim();

  return sanitized;
}

/**
 * Sanitiza uma URL de forma segura
 * @param {any} input - URL a sanitizar
 * @returns {string|null} - URL sanitizada ou null se inválida
 */
export function sanitizeUrl(input) {
  if (typeof input !== "string") {
    try {
      Logger.warn(
        "Validation",
        `sanitizeUrl recebeu tipo inválido: ${typeof input}`
      );
    } catch (logError) {
      console.warn(`Erro ao registrar sanitização de URL: ${logError.message}`);
    }
    return null;
  }

  try {
    const url = new URL(input);
    // Apenas permite protocolos HTTP/HTTPS
    if (!["http:", "https:"].includes(url.protocol)) {
      try {
        Logger.warn(
          "Validation",
          `Protocolo de URL não permitido: ${url.protocol}`
        );
      } catch (logError) {
        console.warn(`Erro ao registrar protocolo de URL: ${logError.message}`);
      }
      return null;
    }
    return url.href;
  } catch (error) {
    try {
      Logger.warn(
        "Validation",
        `URL inválida: ${input}. Erro: ${error.message}`
      );
    } catch (logError) {
      console.warn(`Erro ao registrar URL inválida: ${logError.message}`);
    }
    return null;
  }
}

/**
 * Valida as opções de uma regra de renomeação
 * @param {object} options - Opções a validar
 * @returns {Array} Array de erros
 */
function validateRenamingOptions(options) {
  const errors = [];

  if (
    options.waitForLoad !== undefined &&
    !isBoolean(options.waitForLoad, "options.waitForLoad")
  ) {
    errors.push("Opção 'waitForLoad' deve ser booleana");
  }

  if (
    options.cacheResult !== undefined &&
    !isBoolean(options.cacheResult, "options.cacheResult")
  ) {
    errors.push("Opção 'cacheResult' deve ser booleana");
  }

  if (
    options.respectManualChanges !== undefined &&
    !isBoolean(options.respectManualChanges, "options.respectManualChanges")
  ) {
    errors.push("Opção 'respectManualChanges' deve ser booleana");
  }

  if (
    options.retryAttempts !== undefined &&
    (!isNonNegativeInteger(options.retryAttempts, "options.retryAttempts") ||
      options.retryAttempts < 0 ||
      options.retryAttempts > 5)
  ) {
    errors.push("Opção 'retryAttempts' deve ser um número inteiro entre 0 e 5");
  }
  return errors;
}

/**
 * Valida uma regra de renomeação de abas
 * @param {object} rule - Regra de renomeação a validar
 * @returns {ValidationResult} Resultado da validação
 */
export function validateTabRenamingRule(rule) {
  const errors = [];

  // Validação básica da estrutura
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    errors.push("Regra deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Validação do ID (opcional, mas bom para garantir consistência)
  if (rule.id !== undefined && typeof rule.id !== "string") {
    errors.push("ID da regra deve ser uma string");
  }

  // Validação do nome
  if (
    !rule.name ||
    typeof rule.name !== "string" ||
    rule.name.trim().length === 0
  ) {
    errors.push("Nome da regra é obrigatório");
  } else if (rule.name.length > 100) {
    errors.push("Nome da regra deve ter no máximo 100 caracteres");
  }

  // Validação da prioridade
  if (rule.priority !== undefined) {
    if (
      typeof rule.priority !== "number" ||
      rule.priority < 1 ||
      rule.priority > 999
    ) {
      errors.push("Prioridade deve ser um número entre 1 e 999");
    }
  }

  // Validação do status 'enabled'
  if (rule.enabled !== undefined && typeof rule.enabled !== "boolean") {
    errors.push("O status de ativação (enabled) deve ser booleano");
  }

  // Validação das condições
  if (
    !rule.conditions ||
    !Array.isArray(rule.conditions) ||
    rule.conditions.length === 0
  ) {
    errors.push("A regra deve ter pelo menos uma condição válida.");
  } else {
    rule.conditions.forEach((condition, i) => {
      const result = validateCondition(condition);
      if (!result.isValid) {
        errors.push(`Condição #${i + 1}: ${result.errors.join("; ")}`);
      }
    });
  }

  // Validação das estratégias de renomeação
  if (
    !rule.renamingStrategies ||
    !Array.isArray(rule.renamingStrategies) ||
    rule.renamingStrategies.length === 0
  ) {
    errors.push("Pelo menos uma estratégia de renomeação é obrigatória");
  } else {
    for (let i = 0; i < rule.renamingStrategies.length; i++) {
      const strategyErrors = validateRenamingStrategy(
        rule.renamingStrategies[i],
        i
      );
      errors.push(...strategyErrors);
    }
  }

  // Validação das opções
  if (rule.options && typeof rule.options !== "object") {
    errors.push("Opções devem ser um objeto");
  } else if (rule.options) {
    const optionErrors = validateRenamingOptions(rule.options);
    errors.push(...optionErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida uma estratégia de renomeação
 * @param {object} strategy - Estratégia a validar
 * @param {number} index - Índice da estratégia
 * @returns {Array} Array de erros
 */
function validateRenamingStrategy(strategy, index) {
  const errors = [];
  const prefix = `Estratégia ${index + 1}`;

  if (!strategy || typeof strategy !== "object") {
    errors.push(`${prefix}: deve ser um objeto`);
    return errors;
  }

  const validTypes = [
    "css_extract",
    "title_manipulation",
    "domain_based",
    "original_title",
  ];
  if (!strategy.type || !validTypes.includes(strategy.type)) {
    errors.push(`${prefix}: tipo deve ser um de: ${validTypes.join(", ")}`);
  }

  // Validação específica por tipo
  switch (strategy.type) {
    case "css_extract":
      if (!strategy.selector || typeof strategy.selector !== "string") {
        errors.push(`${prefix}: seletor CSS é obrigatório para extração CSS`);
      } else {
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        const cssSelectorRegex = /^[a-zA-Z0-9\s.#\[\]:\-()*+~>,=''\|]+$/;
        if (!cssSelectorRegex.test(strategy.selector)) {
          errors.push(`${prefix}: seletor CSS contém caracteres inválidos`);
        }
      }

      if (strategy.attribute && typeof strategy.attribute !== "string") {
        errors.push(`${prefix}: atributo deve ser uma string`);
      }
      break;

    case "title_manipulation":
      if (
        !strategy.operations ||
        !Array.isArray(strategy.operations) ||
        strategy.operations.length === 0
      ) {
        errors.push(
          `${prefix}: operações são obrigatórias para manipulação de título`
        );
      } else {
        for (let i = 0; i < strategy.operations.length; i++) {
          const opErrors = validateTextOperation(
            strategy.operations[i],
            i,
            prefix
          );
          errors.push(...opErrors);
        }
      }
      break;
  }

  if (strategy.fallback && !validTypes.includes(strategy.fallback)) {
    errors.push(`${prefix}: fallback deve ser um tipo válido`);
  }

  return errors;
}

/**
 * Valida uma operação de texto
 * @param {object} operation - Operação a validar
 * @param {number} index - Índice da operação
 * @param {string} strategyPrefix - Prefixo da estratégia
 * @returns {Array} Array de erros
 */
function validateTextOperation(operation, index, strategyPrefix) {
  const errors = [];
  const prefix = `${strategyPrefix}, Operação ${index + 1}`;

  if (!operation || typeof operation !== "object") {
    errors.push(`${prefix}: deve ser um objeto`);
    return errors;
  }

  const validActions = [
    "replace",
    "prepend",
    "append",
    "remove",
    "truncate",
    "extract",
  ];
  if (!operation.action || !validActions.includes(operation.action)) {
    errors.push(`${prefix}: ação deve ser uma de: ${validActions.join(", ")}`);
    return errors;
  }

  switch (operation.action) {
    case "replace":
    case "remove":
    case "extract":
      if (!operation.pattern || typeof operation.pattern !== "string") {
        errors.push(
          `${prefix}: padrão é obrigatório para ação ${operation.action}`
        );
      } else {
        try {
          new RegExp(operation.pattern, operation.flags || "");
        } catch (e) {
          errors.push(`${prefix}: padrão contém regex inválida`);
        }
      }

      if (
        operation.action === "replace" &&
        operation.replacement === undefined
      ) {
        errors.push(`${prefix}: substituição é obrigatória para ação replace`);
      }

      if (operation.action === "extract" && operation.group !== undefined) {
        if (typeof operation.group !== "number" || operation.group < 0) {
          errors.push(`${prefix}: grupo deve ser um número não negativo`);
        }
      }
      break;

    case "prepend":
    case "append":
      if (!operation.text || typeof operation.text !== "string") {
        errors.push(
          `${prefix}: texto é obrigatório para ação ${operation.action}`
        );
      }
      break;

    case "truncate":
      if (
        !operation.maxLength ||
        typeof operation.maxLength !== "number" ||
        operation.maxLength <= 0
      ) {
        errors.push(`${prefix}: maxLength deve ser um número positivo`);
      }

      if (operation.ellipsis && typeof operation.ellipsis !== "string") {
        errors.push(`${prefix}: ellipsis deve ser uma string`);
      }
      break;
  }

  if (operation.flags && typeof operation.flags !== "string") {
    errors.push(`${prefix}: flags devem ser uma string`);
  }

  return errors;
}

/**
 * Ações válidas para mensagens do runtime
 */
export const VALID_MESSAGE_ACTIONS = new Set([
  "getSettings",
  "getSuggestion",
  "clearSuggestion",
  "clearLearningHistory",
  "acceptSuggestion",
  "updateSettings",
  "groupAllTabs",
  "getMemoryStats",
  "cleanupMemory",
  "getAdaptiveMemoryStats",
  "forceAdaptiveCleanup",
  "emergencyAdaptiveCleanup",
  "getErrorStats",
  "resetErrorStats",
  "setCustomErrorStrategy",
  "setContextualErrorConfig",
  "getCacheStats",
  "getDetailedCacheStats",
  "invalidateCacheByDomain",
  "invalidateCacheByCriteria",
  "clearAllCaches",
  "migrateLegacyCache",
  "getPerformanceConfig",
  "updatePerformanceConfig",
  "getAPIRateLimiterStats",
  "clearAPIQueues",
  "pauseAPICategory",
  "resumeAPICategory",
  "getRateLimiterDetailedStats",
  "log",
  "extractContent",
]);

/**
 * Valida uma mensagem do runtime
 * @param {any} message - Mensagem a validar
 * @param {object} sender - Informações do remetente
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateRuntimeMessage(message, sender) {
  const errors = [];

  // Verifica se message é um objeto
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    errors.push("Mensagem deve ser um objeto válido");
    return { isValid: false, errors };
  }

  // Valida ação
  if (!message.action || typeof message.action !== "string") {
    errors.push("Ação da mensagem é obrigatória e deve ser uma string");
  } else if (!VALID_MESSAGE_ACTIONS.has(message.action)) {
    errors.push(`Ação '${message.action}' não é permitida`);
  }

  // Validações específicas por ação
  switch (message.action) {
    case "updateSettings":
      if (!message.settings || typeof message.settings !== "object") {
        errors.push("updateSettings requer um objeto settings válido");
      }
      break;

    case "acceptSuggestion":
      if (!message.suggestion || typeof message.suggestion !== "object") {
        errors.push("acceptSuggestion requer um objeto suggestion válido");
      } else {
        if (!Array.isArray(message.suggestion.tabIds)) {
          errors.push("suggestion.tabIds deve ser um array");
        }
        if (
          !message.suggestion.suggestedName ||
          typeof message.suggestion.suggestedName !== "string"
        ) {
          errors.push("suggestion.suggestedName deve ser uma string não vazia");
        }
      }
      break;

    case "extractContent":
      if (!message.selector || typeof message.selector !== "string") {
        errors.push("extractContent requer um seletor CSS válido");
      } else {
        // Validação básica de seletor CSS para prevenir injeção
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
        const cssSelectorRegex = /^[a-zA-Z0-9\s.#\[\]:\-()*+~>,=''\|]+$/;
        if (!cssSelectorRegex.test(message.selector)) {
          errors.push("Seletor CSS contém caracteres não permitidos");
        }
      }
      if (message.attribute && typeof message.attribute !== "string") {
        errors.push("Atributo deve ser uma string");
      }
      break;

    case "invalidateCacheByDomain":
      if (!message.hostname || typeof message.hostname !== "string") {
        errors.push("invalidateCacheByDomain requer hostname válido");
      }
      break;

    case "log":
      if (
        !message.level ||
        !["debug", "info", "warn", "error"].includes(message.level)
      ) {
        errors.push("log requer level válido (debug, info, warn, error)");
      }
      if (!message.context || typeof message.context !== "string") {
        errors.push("log requer context válido");
      }
      if (!message.message || typeof message.message !== "string") {
        errors.push("log requer message válido");
      }
      break;
  }

  // Validação do sender para ações sensíveis
  if (sender && message.action === "extractContent") {
    if (!sender.tab || typeof sender.tab.id !== "number") {
      errors.push("extractContent deve vir de uma aba válida");
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn("Validation", `Mensagem inválida: ${errors.join("; ")}`);
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de mensagem: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Sanitiza dados de mensagem removendo propriedades perigosas
 * @param {object} data - Dados a sanitizar
 * @returns {object} - Dados sanitizados
 */
export function sanitizeMessageData(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const sanitized = {};

  // Lista de propriedades permitidas
  const allowedProps = [
    "action",
    "settings",
    "suggestion",
    "selector",
    "attribute",
    "hostname",
    "changeType",
    "criteria",
    "config",
    "category",
    "level",
    "context",
    "message",
    "details",
    "strategy",
    "errorType",
  ];

  for (const prop of allowedProps) {
    if (Object.prototype.hasOwnProperty.call(data, prop)) {
      if (typeof data[prop] === "string") {
        sanitized[prop] = sanitizeString(data[prop], 1000);
      } else if (typeof data[prop] === "object" && data[prop] !== null) {
        // Para objetos, fazemos uma sanitização recursiva limitada
        sanitized[prop] = sanitizeObjectShallow(data[prop]);
      } else {
        sanitized[prop] = data[prop];
      }
    }
  }

  return sanitized;
}

/**
 * Sanitiza um objeto de forma superficial
 * @param {object} obj - Objeto a sanitizar
 * @returns {object} - Objeto sanitizado
 */
function sanitizeObjectShallow(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }

  const sanitized = {};
  const maxProps = 20; // Limite de propriedades para prevenir DoS
  let propCount = 0;

  for (const [key, value] of Object.entries(obj)) {
    if (propCount >= maxProps) break;

    if (typeof key === "string" && key.length <= 50) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeString(value, 500);
      } else if (typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      }
    }
    propCount++;
  }

  return sanitized;
}

/**
 * Implementa rate limiting simples para mensagens
 */
class MessageRateLimiter {
  constructor() {
    this.requests = new Map(); // tabId -> array de timestamps
    this.maxRequests = 10; // máximo de requests por janela
    this.windowMs = 1000; // janela de 1 segundo
  }

  /**
   * Verifica se uma requisição deve ser permitida
   * @param {number} tabId - ID da aba
   * @returns {boolean} - Se a requisição é permitida
   */
  isAllowed(tabId) {
    const now = Date.now();
    const tabRequests = this.requests.get(tabId) || [];

    // Remove requests antigas
    const validRequests = tabRequests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(tabId, validRequests);

    // Limpeza periódica
    if (this.requests.size > 100) {
      this.cleanup();
    }

    return true;
  }

  /**
   * Limpa entradas antigas
   */
  cleanup() {
    const now = Date.now();
    for (const [tabId, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        (timestamp) => now - timestamp < this.windowMs
      );

      if (validRequests.length === 0) {
        this.requests.delete(tabId);
      } else {
        this.requests.set(tabId, validRequests);
      }
    }
  }
}

export const messageRateLimiter = new MessageRateLimiter();

/**
 * Valida o sender de uma mensagem
 * @param {object} sender - Objeto sender
 * @param {string} action - Ação sendo executada
 * @returns {boolean} - Se o sender é válido
 */
/**
 * Valida o sender de uma mensagem, aceitando sender.tab OU tabId explícito (MV3 robusto)
 * @param {object} sender - Objeto sender
 * @param {string} action - Ação sendo executada
 * @param {number} [tabId] - tabId explícito da mensagem (opcional)
 * @returns {boolean} - Se o sender é válido
 */
export function validateSender(sender, action, tabId) {
  // Ações que requerem contexto de aba
  const tabRequiredActions = new Set(["extractContent", "log"]);

  if (tabRequiredActions.has(action)) {
    const hasSenderTab =
      sender && sender.tab && typeof sender.tab.id === "number";
    const hasExplicitTabId = typeof tabId === "number" && tabId > 0;
    if (!hasSenderTab && !hasExplicitTabId) {
      try {
        Logger.warn(
          "validateSender",
          `Ação '${action}' requer sender.tab ou tabId explícito (MV3 robusto)`,
          { sender, tabId }
        );
      } catch (logError) {
        console.warn(
          `Erro ao registrar validação de sender: ${logError.message}`
        );
      }
      return false;
    }
  }

  return true;
}

/**
 * Valida um seletor CSS para uso seguro
 * @param {string} selector - Seletor CSS a validar
 * @returns {ValidationResult} - Resultado da validação
 */
export function validateCSSSelector(selector) {
  const errors = [];

  if (!isNonEmptyString(selector, "selector")) {
    errors.push("Seletor deve ser uma string não vazia");
    return { isValid: false, errors };
  }

  // Limite de tamanho
  if (selector.length > 200) {
    errors.push("Seletor muito longo (máximo 200 caracteres)");
  }

  // Padrões perigosos
  const dangerousPatterns = [
    /javascript:/i,
    /expression\(/i,
    /url\(/i,
    /@import/i,
    /behavior:/i,
    /binding:/i,
    /vbscript:/i,
    /data:/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(selector)) {
      errors.push("Seletor contém padrão potencialmente perigoso");
      break;
    }
  }

  // Regex básica de segurança
  // eslint-disable-next-line no-useless-escape -- Escapes required for matching special CSS selector chars
  const safeRegex = /^[a-zA-Z0-9\s\.\#\[\]\:\-\(\)\*\+\~\>\,\=\'\'\|_]+$/;
  if (!safeRegex.test(selector)) {
    errors.push("Seletor contém caracteres não permitidos");
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn("Validation", `Seletor CSS inválido: ${errors.join("; ")}`);
    } catch (logError) {
      console.warn(
        `Erro ao registrar validação de seletor: ${logError.message}`
      );
    }
  }

  return { isValid, errors };
}

/**
 * Lista de seletores CSS permitidos para extração de conteúdo
 */
export const ALLOWED_CSS_SELECTORS = new Set([
  "meta[name='application-name']",
  "meta[property='og:site_name']",
  "meta[property='og:title']",
  "meta[name='apple-mobile-web-app-title']",
  "meta[name='twitter:site']",
  "meta[name='twitter:app:name:iphone']",
  "meta[name='twitter:app:name:googleplay']",
  "meta[name='DC.publisher']",
  "title",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "body",
  "main",
  "article",
  "section",
  "header",
  "footer",
  "nav",
  "link[rel='manifest']",
  "script[type='application/ld+json']",
  "header img[alt]",
  "a[href='/'] img[alt]",
  "[class*='logo'] img[alt]",
  "img[alt*='logo']",
]);

/**
 * Lista de atributos HTML permitidos para extração
 */
export const ALLOWED_HTML_ATTRIBUTES = new Set([
  "content",
  "alt",
  "title",
  "href",
  "src",
  "name",
  "property",
  "rel",
  "type",
]);

/**
 * Resultado de validação
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Se a validação passou
 * @property {string[]} errors - Lista de erros encontrados
 */
