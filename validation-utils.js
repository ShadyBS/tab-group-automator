/**
 * @file validation-utils.js
 * @description Utilitários para validação de tipos e inputs, focado em type safety e robustez.
 */

import Logger from "./logger.js";

/**
 * Tipos válidos de propriedades de aba para condições
 */
export const VALID_TAB_PROPERTIES = new Set([
  'url', 'title', 'hostname', 'url_path'
]);

/**
 * Operadores válidos para condições
 */
export const VALID_OPERATORS = new Set([
  'contains', 'not_contains', 'starts_with', 'ends_with', 
  'equals', 'regex', 'wildcard'
]);

/**
 * Operadores lógicos válidos para grupos de condições
 */
export const VALID_LOGICAL_OPERATORS = new Set(['AND', 'OR']);

/**
 * Cores válidas para grupos de abas
 */
export const VALID_GROUP_COLORS = new Set([
  'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'cyan', 'orange', 'grey'
]);

/**
 * Valida se um valor é uma string não vazia
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isNonEmptyString(value, fieldName = 'value') {
  const isValid = typeof value === 'string' && value.trim().length > 0;
  if (!isValid) {
    Logger.warn('Validation', `Campo '${fieldName}' deve ser uma string não vazia. Recebido: ${typeof value}`);
  }
  return isValid;
}

/**
 * Valida se um valor é um número positivo
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isPositiveNumber(value, fieldName = 'value') {
  const isValid = typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (!isValid) {
    Logger.warn('Validation', `Campo '${fieldName}' deve ser um número positivo. Recebido: ${value} (${typeof value})`);
  }
  return isValid;
}

/**
 * Valida se um valor é um número inteiro não negativo
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isNonNegativeInteger(value, fieldName = 'value') {
  const isValid = typeof value === 'number' && Number.isInteger(value) && value >= 0;
  if (!isValid) {
    Logger.warn('Validation', `Campo '${fieldName}' deve ser um número inteiro não negativo. Recebido: ${value} (${typeof value})`);
  }
  return isValid;
}

/**
 * Valida se um valor é um booleano
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isBoolean(value, fieldName = 'value') {
  const isValid = typeof value === 'boolean';
  if (!isValid) {
    Logger.warn('Validation', `Campo '${fieldName}' deve ser booleano. Recebido: ${value} (${typeof value})`);
  }
  return isValid;
}

/**
 * Valida se um valor é um array não vazio
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se válido
 */
export function isNonEmptyArray(value, fieldName = 'value') {
  const isValid = Array.isArray(value) && value.length > 0;
  if (!isValid) {
    Logger.warn('Validation', `Campo '${fieldName}' deve ser um array não vazio. Recebido: ${Array.isArray(value) ? 'array vazio' : typeof value}`);
  }
  return isValid;
}

/**
 * Valida uma regex de forma segura
 * @param {string} pattern - Padrão regex
 * @param {string} fieldName - Nome do campo para logging
 * @returns {boolean} - True se a regex é válida
 */
export function isValidRegex(pattern, fieldName = 'regex') {
  if (!isNonEmptyString(pattern, fieldName)) {
    return false;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    Logger.warn('Validation', `Regex inválida no campo '${fieldName}': ${pattern}. Erro: ${error.message}`);
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
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    errors.push('Condição deve ser um objeto válido');
    return { isValid: false, errors };
  }

  // Valida propriedade
  if (!VALID_TAB_PROPERTIES.has(condition.property)) {
    errors.push(`Propriedade '${condition.property}' inválida. Valores válidos: ${Array.from(VALID_TAB_PROPERTIES).join(', ')}`);
  }

  // Valida operador
  if (!VALID_OPERATORS.has(condition.operator)) {
    errors.push(`Operador '${condition.operator}' inválido. Valores válidos: ${Array.from(VALID_OPERATORS).join(', ')}`);
  }

  // Valida valor
  if (!isNonEmptyString(condition.value, 'condition.value')) {
    errors.push('Valor da condição deve ser uma string não vazia');
  }

  // Validação específica para regex
  if (condition.operator === 'regex' && condition.value) {
    if (!isValidRegex(condition.value, 'condition.value')) {
      errors.push('Valor da condição com operador regex deve ser uma expressão regular válida');
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    Logger.warn('Validation', `Condição inválida: ${errors.join('; ')}`);
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
  if (!conditionGroup || typeof conditionGroup !== 'object' || Array.isArray(conditionGroup)) {
    errors.push('Grupo de condições deve ser um objeto válido');
    return { isValid: false, errors };
  }

  // Valida operador lógico
  if (!VALID_LOGICAL_OPERATORS.has(conditionGroup.operator)) {
    errors.push(`Operador lógico '${conditionGroup.operator}' inválido. Valores válidos: ${Array.from(VALID_LOGICAL_OPERATORS).join(', ')}`);
  }

  // Valida conditions array
  if (!Array.isArray(conditionGroup.conditions)) {
    errors.push('Campo conditions deve ser um array');
  } else if (conditionGroup.conditions.length === 0) {
    errors.push('Grupo de condições deve ter pelo menos uma condição');
  } else {
    // Valida cada condição individualmente
    conditionGroup.conditions.forEach((condition, index) => {
      const conditionResult = validateCondition(condition);
      if (!conditionResult.isValid) {
        errors.push(`Condição ${index + 1}: ${conditionResult.errors.join('; ')}`);
      }
    });
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    Logger.warn('Validation', `Grupo de condições inválido: ${errors.join('; ')}`);
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
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    errors.push('Regra deve ser um objeto válido');
    return { isValid: false, errors };
  }

  // Valida nome da regra
  if (!isNonEmptyString(rule.name, 'rule.name')) {
    errors.push('Nome da regra deve ser uma string não vazia');
  }

  // Valida cor (opcional)
  if (rule.color && !VALID_GROUP_COLORS.has(rule.color)) {
    errors.push(`Cor '${rule.color}' inválida. Valores válidos: ${Array.from(VALID_GROUP_COLORS).join(', ')}`);
  }

  // Valida minTabs (opcional)
  if (rule.minTabs !== undefined && !isPositiveNumber(rule.minTabs, 'rule.minTabs')) {
    errors.push('minTabs deve ser um número positivo');
  }

  // Valida conditionGroup
  if (!rule.conditionGroup) {
    errors.push('Regra deve ter um conditionGroup');
  } else {
    const groupResult = validateConditionGroup(rule.conditionGroup);
    if (!groupResult.isValid) {
      errors.push(`conditionGroup inválido: ${groupResult.errors.join('; ')}`);
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    Logger.warn('Validation', `Regra personalizada inválida: ${errors.join('; ')}`);
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
  if (!tab || typeof tab !== 'object' || Array.isArray(tab)) {
    errors.push('Tab deve ser um objeto válido');
    return { isValid: false, errors };
  }

  // Valida propriedades essenciais
  if (tab.id !== undefined && !isNonNegativeInteger(tab.id, 'tab.id')) {
    errors.push('tab.id deve ser um número inteiro não negativo');
  }

  if (tab.url !== undefined && typeof tab.url !== 'string') {
    errors.push('tab.url deve ser uma string');
  }

  if (tab.title !== undefined && typeof tab.title !== 'string') {
    errors.push('tab.title deve ser uma string');
  }

  if (tab.windowId !== undefined && !isNonNegativeInteger(tab.windowId, 'tab.windowId')) {
    errors.push('tab.windowId deve ser um número inteiro não negativo');
  }

  if (tab.groupId !== undefined && tab.groupId !== -1 && !isNonNegativeInteger(tab.groupId, 'tab.groupId')) {
    errors.push('tab.groupId deve ser um número inteiro não negativo ou -1');
  }

  if (tab.pinned !== undefined && !isBoolean(tab.pinned, 'tab.pinned')) {
    errors.push('tab.pinned deve ser booleano');
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    Logger.warn('Validation', `Objeto tab inválido: ${errors.join('; ')}`);
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
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    errors.push('Settings deve ser um objeto válido');
    return { isValid: false, errors };
  }

  // Valida booleanos
  const booleanFields = ['autoGroupingEnabled', 'ungroupSingleTabs', 'uncollapseOnActivate', 'showTabCount', 'syncEnabled'];
  booleanFields.forEach(field => {
    if (settings[field] !== undefined && !isBoolean(settings[field], `settings.${field}`)) {
      errors.push(`${field} deve ser booleano`);
    }
  });

  // Valida números
  if (settings.minTabsForAutoGroup !== undefined && !isPositiveNumber(settings.minTabsForAutoGroup, 'settings.minTabsForAutoGroup')) {
    errors.push('minTabsForAutoGroup deve ser um número positivo');
  }

  if (settings.autoCollapseTimeout !== undefined && !isNonNegativeInteger(settings.autoCollapseTimeout, 'settings.autoCollapseTimeout')) {
    errors.push('autoCollapseTimeout deve ser um número inteiro não negativo');
  }

  if (settings.ungroupSingleTabsTimeout !== undefined && !isNonNegativeInteger(settings.ungroupSingleTabsTimeout, 'settings.ungroupSingleTabsTimeout')) {
    errors.push('ungroupSingleTabsTimeout deve ser um número inteiro não negativo');
  }

  // Valida strings
  if (settings.groupingMode !== undefined && !['smart', 'domain'].includes(settings.groupingMode)) {
    errors.push('groupingMode deve ser "smart" ou "domain"');
  }

  if (settings.logLevel !== undefined && !['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(settings.logLevel)) {
    errors.push('logLevel deve ser DEBUG, INFO, WARN ou ERROR');
  }

  if (settings.theme !== undefined && !['auto', 'light', 'dark'].includes(settings.theme)) {
    errors.push('theme deve ser auto, light ou dark');
  }

  // Valida arrays
  if (settings.customRules !== undefined) {
    if (!Array.isArray(settings.customRules)) {
      errors.push('customRules deve ser um array');
    } else {
      settings.customRules.forEach((rule, index) => {
        const ruleResult = validateCustomRule(rule);
        if (!ruleResult.isValid) {
          errors.push(`Regra ${index + 1}: ${ruleResult.errors.join('; ')}`);
        }
      });
    }
  }

  if (settings.exceptions !== undefined) {
    if (!Array.isArray(settings.exceptions)) {
      errors.push('exceptions deve ser um array');
    } else {
      settings.exceptions.forEach((exception, index) => {
        if (typeof exception !== 'string') {
          errors.push(`Exception ${index + 1} deve ser uma string`);
        }
      });
    }
  }

  if (settings.manualGroupIds !== undefined) {
    if (!Array.isArray(settings.manualGroupIds)) {
      errors.push('manualGroupIds deve ser um array');
    } else {
      settings.manualGroupIds.forEach((id, index) => {
        if (!isNonNegativeInteger(id, `manualGroupIds[${index}]`)) {
          errors.push(`manualGroupIds[${index}] deve ser um número inteiro não negativo`);
        }
      });
    }
  }

  const isValid = errors.length === 0;
  if (!isValid) {
    Logger.warn('Validation', `Settings inválidas: ${errors.join('; ')}`);
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
  if (typeof input !== 'string') {
    Logger.warn('Validation', `sanitizeString recebeu tipo inválido: ${typeof input}`);
    return '';
  }

  // Remove caracteres de controle e limita o comprimento
  const sanitized = input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove caracteres de controle
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
  if (typeof input !== 'string') {
    Logger.warn('Validation', `sanitizeUrl recebeu tipo inválido: ${typeof input}`);
    return null;
  }

  try {
    const url = new URL(input);
    // Apenas permite protocolos HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      Logger.warn('Validation', `Protocolo de URL não permitido: ${url.protocol}`);
      return null;
    }
    return url.href;
  } catch (error) {
    Logger.warn('Validation', `URL inválida: ${input}. Erro: ${error.message}`);
    return null;
  }
}

/**
 * Resultado de validação
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Se a validação passou
 * @property {string[]} errors - Lista de erros encontrados
 */
