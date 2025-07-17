/**
 * @file performance-config.js
 * @description Configurações de performance centralizadas e tunáveis para otimizar operações.
 */

import Logger from "./logger.js";

// Configurações padrão de performance
const DEFAULT_PERFORMANCE_CONFIG = {
  // --- Configurações de Queue e Processamento ---
  QUEUE_DELAY: 500,                      // ms - Delay para processar fila de abas
  TITLE_UPDATE_DEBOUNCE: 250,            // ms - Debounce para atualizações de título
  INITIAL_CLEANUP_DELAY: 10000,          // ms - Delay para limpeza inicial após inicialização
  
  // --- Configurações de Injection e Retry ---
  MAX_INJECTION_RETRIES: 3,              // Máximo de tentativas de injeção de script
  INJECTION_RETRY_DELAY: 1000,           // ms - Delay entre tentativas de injeção
  
  // --- Configurações de Timers e Intervalos ---
  AUTO_COLLAPSE_CHECK_INTERVAL: 5000,    // ms - Intervalo para verificar grupos inativos
  SINGLE_TAB_CHECK_INTERVAL: 1500,       // ms - Intervalo para verificar grupos com aba única
  
  // --- Configurações de Storage ---
  STORAGE_RETRY_DELAY: 1000,             // ms - Delay para retry de operações de storage
  CACHE_SAVE_DELAY: 2000,                // ms - Delay para salvar cache
  CACHE_CLEANUP_RETRY_DELAY: 500,        // ms - Delay para retry de limpeza de cache
  
  // --- Configurações de Cache ---
  MAX_CACHE_SIZE: 1000,                  // Tamanho máximo do cache de nomes
  CACHE_MAX_AGE: 24 * 60 * 60 * 1000,    // ms - Idade máxima do cache (24h)
  
  // --- Configurações de Cache Inteligente ---
  CACHE_DEFAULT_TTL: 24 * 60 * 60 * 1000, // ms - TTL padrão para entradas (24h)
  CACHE_CLEANUP_INTERVAL: 5 * 60 * 1000,  // ms - Intervalo de limpeza automática (5min)
  CACHE_OPTIMIZATION_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // ms - Threshold para otimização (7 dias)
  CACHE_DOMAIN_CHANGE_THRESHOLD: 3,       // Número de mudanças para invalidar domínio
  CACHE_VERSION_CHECK_ENABLED: true,      // Habilita verificação de versão do cache
  
  // --- Configurações de Gerenciamento Adaptativo de Memória ---
  ADAPTIVE_MEMORY_ENABLED: true,         // Habilita gerenciamento adaptativo
  MEMORY_PRESSURE_CHECK_INTERVAL: 30000, // ms - Intervalo para verificar pressão
  MEMORY_ADAPTATION_SENSITIVITY: 0.2,    // Sensibilidade da adaptação (0-1)
  EMERGENCY_CLEANUP_THRESHOLD: 0.95,     // Threshold para limpeza de emergência
  MEMORY_HISTORY_SIZE: 10,               // Tamanho do histórico de pressão
  
  // --- Configurações de Tratamento Adaptativo de Erros ---
  ADAPTIVE_ERROR_HANDLING_ENABLED: true, // Habilita tratamento adaptativo de erros
  ERROR_RETRY_BASE_DELAY: 1000,          // ms - Delay base para retry de erros
  ERROR_RETRY_MAX_DELAY: 30000,          // ms - Delay máximo para retry de erros
  CIRCUIT_BREAKER_THRESHOLD: 5,          // Número de falhas para ativar circuit breaker
  CIRCUIT_BREAKER_RESET_TIME: 60000,     // ms - Tempo para reset do circuit breaker
  ERROR_STATS_RETENTION_TIME: 300000,    // ms - Tempo de retenção das estatísticas de erro
  
  // --- Configurações de Batching ---
  BATCH_SIZE: 50,                        // Tamanho padrão do batch para operações
  BATCH_DELAY: 10,                       // ms - Delay entre processamento de batches
  MAX_CONCURRENT_OPERATIONS: 5,          // Máximo de operações concorrentes
  
  // --- Configurações de Processamento Paralelo ---
  MAX_TAB_CONCURRENCY: 4,                // Máximo de operações de aba concorrentes
  TAB_BATCH_SIZE: 10,                    // Tamanho do batch para operações de aba
  WINDOW_CONCURRENCY: 2,                 // Máximo de janelas processadas concorrentemente
  GROUP_OPERATION_DELAY: 150,            // ms - Delay entre operações de grupo
  ITEM_CONCURRENCY: 3,                   // Itens processados concorrentemente por batch
  SUB_BATCH_DELAY: 50,                   // ms - Delay entre sub-batches
  
  // --- Configurações de API Calls ---
  API_TIMEOUT: 5000,                     // ms - Timeout para chamadas de API
  API_RETRY_COUNT: 3,                    // Número de tentativas para APIs
  API_BATCH_SIZE: 20,                    // Tamanho do batch para operações de API
  
  // --- Configurações de Performance Monitoring ---
  PERFORMANCE_LOG_THRESHOLD: 1000,       // ms - Log operações que demoram mais que isso
  BATCH_PERFORMANCE_LOG: true,           // Log performance de operações em batch
  
  // --- Configurações de Throttling ---
  THROTTLE_DELAY: 100,                   // ms - Delay para throttling
  MAX_OPERATIONS_PER_SECOND: 50,         // Máximo de operações por segundo
};

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
    Logger.warn("PerformanceConfig", `Configuração desconhecida: ${key}. Usando valor padrão.`);
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
    Logger.warn("PerformanceConfig", `Tentativa de definir configuração desconhecida: ${key}`);
    return false;
  }
  
  const oldValue = currentConfig[key];
  currentConfig[key] = value;
  
  Logger.debug("PerformanceConfig", `Configuração ${key} alterada: ${oldValue} → ${value}`);
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
    Logger.warn("PerformanceConfig", `Chaves de configuração inválidas ignoradas: ${invalidKeys.join(', ')}`);
  }
  
  Object.assign(currentConfig, validUpdates);
  Logger.info("PerformanceConfig", `${Object.keys(validUpdates).length} configurações atualizadas.`, validUpdates);
}

/**
 * Reseta todas as configurações para os valores padrão
 */
export function resetConfig() {
  currentConfig = { ...DEFAULT_PERFORMANCE_CONFIG };
  Logger.info("PerformanceConfig", "Configurações resetadas para valores padrão.");
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
    Logger.debug("PerformanceConfig", "Nenhuma configuração de performance encontrada nas settings.");
    return;
  }
  
  const configToLoad = settings.performanceConfig;
  const validConfig = {};
  
  for (const [key, value] of Object.entries(configToLoad)) {
    if (validateConfigValue(key, value)) {
      validConfig[key] = value;
    } else {
      Logger.warn("PerformanceConfig", `Valor inválido para ${key}: ${value}. Usando padrão.`);
    }
  }
  
  if (Object.keys(validConfig).length > 0) {
    updateConfig(validConfig);
    Logger.info("PerformanceConfig", `Configurações carregadas das settings: ${Object.keys(validConfig).join(', ')}`);
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
  return new Promise(resolve => setTimeout(resolve, delay));
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
      await new Promise(resolve => 
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
    this.operations = this.operations.filter(time => now - time < 1000);
    
    if (this.operations.length >= maxOpsPerSecond) {
      const oldestOp = Math.min(...this.operations);
      const waitTime = 1000 - (now - oldestOp);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.operations.push(now);
  }
}

// Instâncias globais reutilizáveis
export const globalThrottler = new ConfigurableThrottler();
export const globalRateLimiter = new ConfigurableRateLimiter();

// Exporta constantes para compatibilidade
export { DEFAULT_PERFORMANCE_CONFIG };

Logger.debug("PerformanceConfig", "Módulo de configuração de performance inicializado.");
