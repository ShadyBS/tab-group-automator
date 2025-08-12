/**
 * @file performance-config.js
 * @description Configurações de performance centralizadas e tunáveis para otimizar operações.
 */

import Logger from './logger.js';

// Configurações padrão de performance otimizadas para TASK-A-001
const DEFAULT_PERFORMANCE_CONFIG = {
  // --- TASK-A-001: Configurações Otimizadas de Queue e Processamento ---
  QUEUE_DELAY: 150, // ms - Reduzido de 500ms para resposta mais rápida
  TITLE_UPDATE_DEBOUNCE: 150, // ms - Reduzido de 250ms para atualizações mais responsivas
  INITIAL_CLEANUP_DELAY: 5000, // ms - Reduzido de 10s para inicialização mais rápida

  // --- TASK-A-001: Configurações Otimizadas de Injection e Retry ---
  MAX_INJECTION_RETRIES: 5, // Aumentado para evitar bloqueios prematuros
  INJECTION_RETRY_DELAY: 500, // ms - Reduzido de 1000ms para retry mais rápido
  SCRIPT_INJECTION_TIMEOUT: 1500, // ms - Timeout para injeção de script (TASK-C-007)

  // --- Configurações de Timers e Intervalos ---
  AUTO_COLLAPSE_CHECK_INTERVAL: 5000, // ms - Mantido
  SINGLE_TAB_CHECK_INTERVAL: 1500, // ms - Mantido

  // --- Configurações de Storage ---
  STORAGE_RETRY_DELAY: 500, // ms - Reduzido de 1000ms
  CACHE_SAVE_DELAY: 1000, // ms - Reduzido de 2000ms para salvamento mais rápido
  CACHE_CLEANUP_RETRY_DELAY: 250, // ms - Reduzido de 500ms

  // --- TASK-A-001: Configurações Otimizadas de Cache ---
  MAX_CACHE_SIZE: 2000, // Aumentado de 1000 para melhor hit rate
  CACHE_MAX_AGE: 24 * 60 * 60 * 1000, // ms - Mantido (24h)

  // --- TASK-A-001: Configurações Otimizadas de Cache Inteligente ---
  CACHE_DEFAULT_TTL: 24 * 60 * 60 * 1000, // ms - Mantido (24h)
  CACHE_CLEANUP_INTERVAL: 3 * 60 * 1000, // ms - Reduzido de 5min para 3min
  CACHE_OPTIMIZATION_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // ms - Mantido (7 dias)
  CACHE_DOMAIN_CHANGE_THRESHOLD: 3, // Mantido
  CACHE_VERSION_CHECK_ENABLED: true, // Mantido

  // --- OTIMIZAÇÃO: Configurações específicas para cache de nomes inteligentes ---
  SMART_NAME_CACHE_TTL: 24 * 60 * 60 * 1000, // ms - TTL para nomes extraídos com sucesso (24h)
  SMART_NAME_FALLBACK_TTL: 2 * 60 * 60 * 1000, // ms - TTL para fallbacks de domínio (2h)
  SMART_NAME_CACHE_ENABLED: true, // Ativa/desativa cache de nomes inteligentes

  // --- Configurações de Gerenciamento Adaptativo de Memória ---
  ADAPTIVE_MEMORY_ENABLED: true, // Mantido
  MEMORY_PRESSURE_CHECK_INTERVAL: 20000, // ms - Reduzido de 30s para 20s
  MEMORY_ADAPTATION_SENSITIVITY: 0.3, // Aumentado de 0.2 para resposta mais rápida
  EMERGENCY_CLEANUP_THRESHOLD: 0.9, // Reduzido de 0.95 para cleanup mais agressivo
  MEMORY_HISTORY_SIZE: 15, // Aumentado de 10 para melhor análise

  // --- Configurações de Tratamento Adaptativo de Erros ---
  ADAPTIVE_ERROR_HANDLING_ENABLED: true, // Mantido
  ERROR_RETRY_BASE_DELAY: 500, // ms - Reduzido de 1000ms
  ERROR_RETRY_MAX_DELAY: 15000, // ms - Reduzido de 30s para 15s
  CIRCUIT_BREAKER_THRESHOLD: 7, // Aumentado para evitar circuit breaker prematuro
  CIRCUIT_BREAKER_RESET_TIME: 30000, // ms - Reduzido de 60s para 30s
  ERROR_STATS_RETENTION_TIME: 180000, // ms - Reduzido de 5min para 3min

  // --- TASK-A-001: Configurações Otimizadas de Batching ---
  BATCH_SIZE: 15, // Reduzido de 50 para processamento mais rápido
  BATCH_DELAY: 5, // ms - Reduzido de 10ms para menor latência
  MAX_CONCURRENT_OPERATIONS: 8, // Aumentado de 5 para maior paralelismo

  // --- TASK-A-001: Configurações Otimizadas de Processamento Paralelo ---
  MAX_TAB_CONCURRENCY: 6, // Aumentado de 4 para maior paralelismo
  TAB_BATCH_SIZE: 12, // Aumentado de 10 para melhor throughput
  WINDOW_CONCURRENCY: 3, // Aumentado de 2 para processar mais janelas
  GROUP_OPERATION_DELAY: 100, // ms - Reduzido de 150ms para operações mais rápidas
  ITEM_CONCURRENCY: 5, // Aumentado de 3 para maior paralelismo
  SUB_BATCH_DELAY: 25, // ms - Reduzido de 50ms para menor latência

  // --- TASK-A-001: Configurações Otimizadas de API Calls ---
  API_TIMEOUT: 3000, // ms - Reduzido de 5000ms para timeout mais agressivo
  API_RETRY_COUNT: 2, // Reduzido de 3 para evitar delays
  API_BATCH_SIZE: 25, // Aumentado de 20 para melhor throughput

  // --- TASK-A-001: Configurações de Performance Monitoring ---
  PERFORMANCE_LOG_THRESHOLD: 50, // ms - Reduzido de 1000ms para detectar operações lentas
  BATCH_PERFORMANCE_LOG: true, // Mantido para monitoramento
  PERFORMANCE_TARGET_100_TABS: 50, // ms - Meta para 100 abas (TASK-A-001)
  PERFORMANCE_TARGET_200_TABS: 100, // ms - Meta para 200 abas (TASK-A-001)
  MEMORY_TARGET_200_TABS: 50, // MB - Meta de memória para 200+ abas (TASK-A-001)

  // --- TASK-A-001: Configurações Otimizadas de Throttling ---
  THROTTLE_DELAY: 50, // ms - Reduzido de 100ms para menor latência
  MAX_OPERATIONS_PER_SECOND: 100, // Aumentado de 50 para maior throughput

  // --- Configurações de Rate Limiting de APIs ---
  API_QUEUE_PROCESS_INTERVAL: 25, // ms - Reduzido de 50ms para processamento mais rápido
  API_CLEANUP_INTERVAL: 30000, // ms - Reduzido de 60s para 30s
  API_MAX_QUEUE_SIZE: 1500, // Aumentado de 1000 para maior capacidade
  API_OPERATION_MAX_AGE: 15000, // ms - Reduzido de 30s para 15s
  API_BURST_RECOVERY_TIME: 2500, // ms - Reduzido de 5s para 2.5s
  API_RATE_LIMIT_ENABLED: true, // Mantido

  // Configurações de Renomeação de Abas
  TAB_RENAMING_DELAY: 1000, // ms - Reduzido de 2000ms
  TAB_RENAMING_TIMEOUT: 5000, // ms - Reduzido de 10000ms
  TAB_RENAMING_CACHE_TTL: 300000, // ms - Mantido (5 min)
  TAB_RENAMING_CACHE_CLEANUP_INTERVAL: 300000, // ms - Reduzido de 10min para 5min
  TAB_RENAMING_MAX_CONCURRENT: 5, // Aumentado de 3 para maior paralelismo
  TAB_RENAMING_RETRY_DELAY: 500, // ms - Reduzido de 1000ms
  TAB_RENAMING_MAX_TITLE_LENGTH: 100, // Mantido
  TAB_RENAMING_MAX_RULES: 50, // Mantido
  TAB_RENAMING_ENABLED: false, // Mantido (padrão: desabilitado)

  // --- TASK-A-001: Configurações de Debouncing Inteligente ---
  SMART_DEBOUNCE_BASE_DELAY: 150, // ms - Delay base para debouncing inteligente
  SMART_DEBOUNCE_MAX_DELAY: 500, // ms - Delay máximo para debouncing inteligente
  SMART_DEBOUNCE_EVENT_THRESHOLD: 10, // Número de eventos para aumentar delay
  SMART_DEBOUNCE_TIME_WINDOW: 1000, // ms - Janela de tempo para contar eventos

  // --- TASK-A-001: Configurações de Sugestões ---
  SUGGESTION_CHECK_DEBOUNCE: 2000, // ms - Delay para verificação de sugestões
  SUGGESTION_MIN_TABS: 3, // Mínimo de abas para sugerir agrupamento
  SUGGESTION_CONFIDENCE_THRESHOLD: 0.7, // Threshold de confiança para sugestões
};

// --- FEATURE FLAGS para Otimizações de Performance ---
export const FEATURE_FLAGS = {
  smartNameCaching: {
    key: 'smartNameCaching',
    name: 'Cache de Nomes Inteligentes',
    description:
      'Ativa o cache da função fetchSmartName para melhorar performance',
    defaultValue: true,
    category: 'performance',
  },
  selectiveProcessing: {
    key: 'selectiveProcessing',
    name: 'Processamento Seletivo',
    description:
      'Refatoração da processTabQueue para processar apenas abas necessárias',
    defaultValue: true,
    category: 'performance',
  },
  batchedStorage: {
    key: 'batchedStorage',
    name: 'Armazenamento em Lote',
    description: 'Otimização do chrome.storage.local com operações em lote',
    defaultValue: true,
    category: 'performance',
  },
};

// Estado atual das feature flags
let currentFeatureFlags = {};

// Inicializa feature flags com valores padrão
function initializeFeatureFlags() {
  currentFeatureFlags = {};
  for (const [flagKey, flagConfig] of Object.entries(FEATURE_FLAGS)) {
    currentFeatureFlags[flagKey] = flagConfig.defaultValue;
  }
}

/**
 * Verifica se uma feature flag está habilitada
 * @param {string} flagKey - Chave da feature flag
 * @returns {boolean} True se a flag estiver habilitada
 */
export function isFeatureEnabled(flagKey) {
  if (!(flagKey in FEATURE_FLAGS)) {
    Logger.warn(
      'PerformanceConfig',
      `Feature flag desconhecida: ${flagKey}. Retornando false.`
    );
    return false;
  }

  return currentFeatureFlags[flagKey] !== undefined
    ? currentFeatureFlags[flagKey]
    : FEATURE_FLAGS[flagKey].defaultValue;
}

/**
 * Define o estado de uma feature flag
 * @param {string} flagKey - Chave da feature flag
 * @param {boolean} enabled - Novo estado da flag
 */
export function setFeatureFlag(flagKey, enabled) {
  if (!(flagKey in FEATURE_FLAGS)) {
    Logger.warn(
      'PerformanceConfig',
      `Tentativa de definir feature flag desconhecida: ${flagKey}`
    );
    return false;
  }

  const oldValue = currentFeatureFlags[flagKey];
  currentFeatureFlags[flagKey] = Boolean(enabled);

  Logger.debug(
    'PerformanceConfig',
    `Feature flag ${flagKey} alterada: ${oldValue} → ${enabled}`
  );
  return true;
}

/**
 * Obtém todas as feature flags e seus estados
 * @returns {object} Objeto com estado de todas as flags
 */
export function getAllFeatureFlags() {
  const result = {};
  for (const flagKey of Object.keys(FEATURE_FLAGS)) {
    result[flagKey] = isFeatureEnabled(flagKey);
  }
  return result;
}

/**
 * Atualiza múltiplas feature flags de uma vez
 * @param {object} flagUpdates - Objeto com as atualizações das flags
 */
export function updateFeatureFlags(flagUpdates) {
  const validUpdates = {};
  const invalidKeys = [];

  for (const [flagKey, enabled] of Object.entries(flagUpdates)) {
    if (flagKey in FEATURE_FLAGS) {
      validUpdates[flagKey] = enabled;
    } else {
      invalidKeys.push(flagKey);
    }
  }

  if (invalidKeys.length > 0) {
    Logger.warn(
      'PerformanceConfig',
      `Feature flags inválidas ignoradas: ${invalidKeys.join(', ')}`
    );
  }

  Object.assign(currentFeatureFlags, validUpdates);
  Logger.info(
    'PerformanceConfig',
    `${Object.keys(validUpdates).length} feature flags atualizadas.`,
    validUpdates
  );
}

/**
 * Reseta todas as feature flags para valores padrão
 */
export function resetFeatureFlags() {
  initializeFeatureFlags();
  Logger.info(
    'PerformanceConfig',
    'Feature flags resetadas para valores padrão.'
  );
}

/**
 * Carrega feature flags das configurações da extensão
 * @param {object} settings - Settings da extensão
 */
export function loadFeatureFlagsFromSettings(settings) {
  if (!settings || !settings.featureFlags) {
    Logger.debug(
      'PerformanceConfig',
      'Nenhuma feature flag encontrada nas settings.'
    );
    return;
  }

  const flagsToLoad = settings.featureFlags;
  const validFlags = {};

  for (const [flagKey, enabled] of Object.entries(flagsToLoad)) {
    if (flagKey in FEATURE_FLAGS && typeof enabled === 'boolean') {
      validFlags[flagKey] = enabled;
    } else {
      Logger.warn(
        'PerformanceConfig',
        `Feature flag inválida nas settings: ${flagKey}. Usando padrão.`
      );
    }
  }

  if (Object.keys(validFlags).length > 0) {
    updateFeatureFlags(validFlags);
    Logger.info(
      'PerformanceConfig',
      `Feature flags carregadas das settings: ${Object.keys(validFlags).join(
        ', '
      )}`
    );
  }
}

/**
 * Obtém feature flags para salvar nas settings
 * @returns {object} Feature flags para salvar
 */
export function getFeatureFlagsForSettings() {
  const flags = getAllFeatureFlags();
  const defaultFlags = {};

  // Só salva flags que foram alteradas do padrão
  for (const [flagKey, enabled] of Object.entries(flags)) {
    if (enabled !== FEATURE_FLAGS[flagKey].defaultValue) {
      defaultFlags[flagKey] = enabled;
    }
  }

  return Object.keys(defaultFlags).length > 0 ? defaultFlags : undefined;
}

// Inicializa feature flags
initializeFeatureFlags();

// Configurações atuais (podem ser modificadas)
let currentConfig = { ...DEFAULT_PERFORMANCE_CONFIG };

/**
 * Obtém o valor de uma configuração
 * @param {string} key - Chave da configuração
 * @returns {*} Valor da configuração
 */
export function getConfig(key) {
  const value = currentConfig[key];
  if (value === undefined) {
    Logger.warn(
      'PerformanceConfig',
      `Configuração desconhecida: ${key}. Usando valor padrão.`
    );
    return DEFAULT_PERFORMANCE_CONFIG[key];
  }
  return value;
}

/**
 * Define o valor de uma configuração
 * @param {string} key - Chave da configuração
 * @param {*} value - Novo valor
 */
export function setConfig(key, value) {
  if (!(key in DEFAULT_PERFORMANCE_CONFIG)) {
    Logger.warn(
      'PerformanceConfig',
      `Tentativa de definir configuração desconhecida: ${key}`
    );
    return false;
  }

  const oldValue = currentConfig[key];
  currentConfig[key] = value;

  Logger.debug(
    'PerformanceConfig',
    `Configuração ${key} alterada: ${oldValue} → ${value}`
  );
  return true;
}

/**
 * Atualiza múltiplas configurações de uma vez
 * @param {object} configUpdates - Objeto com as atualizações
 */
export function updateConfig(configUpdates) {
  const validUpdates = {};
  const invalidKeys = [];

  for (const [key, value] of Object.entries(configUpdates)) {
    if (key in DEFAULT_PERFORMANCE_CONFIG) {
      validUpdates[key] = value;
    } else {
      invalidKeys.push(key);
    }
  }

  if (invalidKeys.length > 0) {
    Logger.warn(
      'PerformanceConfig',
      `Chaves de configuração inválidas ignoradas: ${invalidKeys.join(', ')}`
    );
  }

  Object.assign(currentConfig, validUpdates);
  Logger.info(
    'PerformanceConfig',
    `${Object.keys(validUpdates).length} configurações atualizadas.`,
    validUpdates
  );
}

/**
 * Reseta todas as configurações para os valores padrão
 */
export function resetConfig() {
  currentConfig = { ...DEFAULT_PERFORMANCE_CONFIG };
  Logger.info(
    'PerformanceConfig',
    'Configurações resetadas para valores padrão.'
  );
}

/**
 * Obtém todas as configurações atuais
 * @returns {object} Objeto com todas as configurações
 */
export function getAllConfig() {
  return { ...currentConfig };
}

/**
 * Obtém apenas as configurações que foram modificadas dos padrões
 * @returns {object} Configurações modificadas
 */
export function getModifiedConfig() {
  const modified = {};
  for (const [key, value] of Object.entries(currentConfig)) {
    if (value !== DEFAULT_PERFORMANCE_CONFIG[key]) {
      modified[key] = value;
    }
  }
  return modified;
}

/**
 * Valida se um valor é apropriado para uma configuração
 * @param {string} key - Chave da configuração
 * @param {*} value - Valor a validar
 * @returns {boolean} True se válido
 */
export function validateConfigValue(key, value) {
  if (!(key in DEFAULT_PERFORMANCE_CONFIG)) {
    return false;
  }

  const defaultValue = DEFAULT_PERFORMANCE_CONFIG[key];
  const defaultType = typeof defaultValue;

  if (typeof value !== defaultType) {
    return false;
  }

  // Validações específicas para configurações numéricas
  if (defaultType === 'number') {
    if (value < 0) return false;

    // Limites específicos para alguns valores
    switch (key) {
      case 'BATCH_SIZE':
      case 'API_BATCH_SIZE':
        return value >= 1 && value <= 1000;
      case 'MAX_INJECTION_RETRIES':
      case 'API_RETRY_COUNT':
        return value >= 0 && value <= 10;
      case 'MAX_CONCURRENT_OPERATIONS':
        return value >= 1 && value <= 50;
      case 'MAX_OPERATIONS_PER_SECOND':
        return value >= 1 && value <= 1000;
      default:
        return value <= 60000; // Máximo 60 segundos para delays
    }
  }

  return true;
}

/**
 * Carrega configurações de performance das settings da extensão
 * @param {object} settings - Settings da extensão
 */
export function loadConfigFromSettings(settings) {
  if (!settings || !settings.performanceConfig) {
    Logger.debug(
      'PerformanceConfig',
      'Nenhuma configuração de performance encontrada nas settings.'
    );
    return;
  }

  const configToLoad = settings.performanceConfig;
  const validConfig = {};

  for (const [key, value] of Object.entries(configToLoad)) {
    if (validateConfigValue(key, value)) {
      validConfig[key] = value;
    } else {
      Logger.warn(
        'PerformanceConfig',
        `Valor inválido para ${key}: ${value}. Usando padrão.`
      );
    }
  }

  if (Object.keys(validConfig).length > 0) {
    updateConfig(validConfig);
    Logger.info(
      'PerformanceConfig',
      `Configurações carregadas das settings: ${Object.keys(validConfig).join(
        ', '
      )}`
    );
  }
}

/**
 * Obtém configurações de performance para salvar nas settings
 * @returns {object} Configurações modificadas para salvar
 */
export function getConfigForSettings() {
  const modified = getModifiedConfig();
  return Object.keys(modified).length > 0 ? modified : undefined;
}

/**
 * Cria um helper para obter múltiplas configurações de uma vez
 * @param {string[]} keys - Array de chaves
 * @returns {object} Objeto com as configurações solicitadas
 */
export function getConfigs(keys) {
  const configs = {};
  for (const key of keys) {
    configs[key] = getConfig(key);
  }
  return configs;
}

/**
 * Cria delays configuráveis
 * @param {string} configKey - Chave da configuração para o delay
 * @returns {Promise} Promise que resolve após o delay
 */
export function createConfigurableDelay(configKey) {
  const delay = getConfig(configKey);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Throttler configurável baseado em configurações
 */
export class ConfigurableThrottler {
  constructor() {
    this.lastExecution = 0;
  }

  async throttle() {
    const now = Date.now();
    const delay = getConfig('THROTTLE_DELAY');
    const timeSinceLastExecution = now - this.lastExecution;

    if (timeSinceLastExecution < delay) {
      await new Promise((resolve) =>
        setTimeout(resolve, delay - timeSinceLastExecution)
      );
    }

    this.lastExecution = Date.now();
  }
}

/**
 * Rate limiter configurável
 */
export class ConfigurableRateLimiter {
  constructor() {
    this.operations = [];
  }

  async checkRate() {
    const now = Date.now();
    const maxOpsPerSecond = getConfig('MAX_OPERATIONS_PER_SECOND');

    // Remove operações antigas (mais de 1 segundo)
    this.operations = this.operations.filter((time) => now - time < 1000);

    if (this.operations.length >= maxOpsPerSecond) {
      const oldestOp = Math.min(...this.operations);
      const waitTime = 1000 - (now - oldestOp);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.operations.push(now);
  }
}

// Instâncias globais reutilizáveis
export const globalThrottler = new ConfigurableThrottler();
export const globalRateLimiter = new ConfigurableRateLimiter();

// Exporta constantes para compatibilidade
export { DEFAULT_PERFORMANCE_CONFIG };

Logger.debug(
  'PerformanceConfig',
  'Módulo de configuração de performance inicializado.'
);
