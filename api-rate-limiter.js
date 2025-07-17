/**
 * @file api-rate-limiter.js
 * @description Sistema centralizado de rate limiting e throttling para APIs do navegador com filas e priorização.
 */

import Logger from "./logger.js";
import { withErrorHandling } from "./adaptive-error-handler.js";
import { getConfig } from "./performance-config.js";

/**
 * Tipos de operação com diferentes prioridades e limites
 */
export const API_OPERATION_TYPES = {
  // Operações críticas - alta prioridade
  CRITICAL_TAB_GET: { priority: 1, category: 'tabs', operation: 'get', critical: true },
  CRITICAL_GROUP_GET: { priority: 1, category: 'tabGroups', operation: 'get', critical: true },
  
  // Operações de usuário - prioridade média-alta
  USER_TAB_GROUP: { priority: 2, category: 'tabs', operation: 'group', userInitiated: true },
  USER_TAB_UNGROUP: { priority: 2, category: 'tabs', operation: 'ungroup', userInitiated: true },
  USER_GROUP_UPDATE: { priority: 2, category: 'tabGroups', operation: 'update', userInitiated: true },
  
  // Operações de query - prioridade média
  TAB_QUERY: { priority: 3, category: 'tabs', operation: 'query' },
  GROUP_QUERY: { priority: 3, category: 'tabGroups', operation: 'query' },
  WINDOW_QUERY: { priority: 3, category: 'windows', operation: 'getAll' },
  
  // Operações automáticas - prioridade baixa
  AUTO_TAB_GROUP: { priority: 4, category: 'tabs', operation: 'group', automated: true },
  AUTO_TAB_UNGROUP: { priority: 4, category: 'tabs', operation: 'ungroup', automated: true },
  AUTO_GROUP_UPDATE: { priority: 4, category: 'tabGroups', operation: 'update', automated: true },
  
  // Operações de storage - prioridade baixa
  STORAGE_GET: { priority: 5, category: 'storage', operation: 'get' },
  STORAGE_SET: { priority: 5, category: 'storage', operation: 'set' },
  
  // Operações de background - prioridade muito baixa
  BACKGROUND_CLEANUP: { priority: 6, category: 'background', operation: 'cleanup' },
  BACKGROUND_SYNC: { priority: 6, category: 'background', operation: 'sync' }
};

/**
 * Configurações de rate limiting por categoria de API
 */
const API_RATE_LIMITS = {
  tabs: {
    maxConcurrent: 8,           // Máximo de operações simultâneas
    maxPerSecond: 20,           // Máximo por segundo
    maxPerMinute: 300,          // Máximo por minuto
    burstLimit: 10,             // Limite de burst
    cooldownMs: 100             // Cooldown entre operações
  },
  tabGroups: {
    maxConcurrent: 6,
    maxPerSecond: 15,
    maxPerMinute: 200,
    burstLimit: 8,
    cooldownMs: 150
  },
  windows: {
    maxConcurrent: 4,
    maxPerSecond: 10,
    maxPerMinute: 100,
    burstLimit: 5,
    cooldownMs: 200
  },
  storage: {
    maxConcurrent: 3,
    maxPerSecond: 8,
    maxPerMinute: 80,
    burstLimit: 4,
    cooldownMs: 250
  },
  background: {
    maxConcurrent: 2,
    maxPerSecond: 5,
    maxPerMinute: 50,
    burstLimit: 3,
    cooldownMs: 500
  }
};

/**
 * Classe para uma operação na fila
 */
class QueuedOperation {
  constructor(operationType, apiCall, resolve, reject, context = {}) {
    this.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.operationType = operationType;
    this.apiCall = apiCall;
    this.resolve = resolve;
    this.reject = reject;
    this.context = context;
    this.timestamp = Date.now();
    this.retryCount = 0;
    this.maxRetries = context.maxRetries || 3;
  }
  
  get priority() {
    return this.operationType.priority;
  }
  
  get category() {
    return this.operationType.category;
  }
  
  get age() {
    return Date.now() - this.timestamp;
  }
  
  get isExpired() {
    const maxAge = this.context.maxAge || 30000; // 30 segundos padrão
    return this.age > maxAge;
  }
}

/**
 * Classe principal do rate limiter
 */
export class APIRateLimiter {
  constructor() {
    this.queues = new Map(); // Filas por categoria
    this.activeOperations = new Map(); // Operações ativas por categoria
    this.rateLimiters = new Map(); // Rate limiters por categoria
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      queuedRequests: 0,
      throttledRequests: 0,
      averageWaitTime: 0,
      peakQueueSize: 0,
      categoryStats: new Map()
    };
    
    // Inicializa estruturas para cada categoria
    for (const category of Object.keys(API_RATE_LIMITS)) {
      this.queues.set(category, []);
      this.activeOperations.set(category, new Set());
      this.rateLimiters.set(category, new CategoryRateLimiter(category, API_RATE_LIMITS[category]));
      this.stats.categoryStats.set(category, {
        requests: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        avgWaitTime: 0
      });
    }
    
    // Inicia processamento das filas
    this.startQueueProcessing();
    
    // Inicia limpeza periódica
    this.startPeriodicCleanup();
    
    Logger.info("APIRateLimiter", "Sistema de rate limiting inicializado");
  }
  
  /**
   * Executa uma operação de API com rate limiting
   * @param {string} operationTypeKey - Chave do tipo de operação
   * @param {Function} apiCall - Função que executa a chamada da API
   * @param {Object} context - Contexto adicional
   * @returns {Promise} Resultado da operação
   */
  async executeOperation(operationTypeKey, apiCall, context = {}) {
    const operationType = API_OPERATION_TYPES[operationTypeKey];
    if (!operationType) {
      throw new Error(`Tipo de operação desconhecido: ${operationTypeKey}`);
    }
    
    this.stats.totalRequests++;
    const categoryStats = this.stats.categoryStats.get(operationType.category);
    categoryStats.requests++;
    
    return new Promise((resolve, reject) => {
      const operation = new QueuedOperation(operationType, apiCall, resolve, reject, context);
      this.enqueueOperation(operation);
    });
  }
  
  /**
   * Adiciona operação à fila apropriada
   * @param {QueuedOperation} operation - Operação a ser enfileirada
   */
  enqueueOperation(operation) {
    const queue = this.queues.get(operation.category);
    
    // Verifica se pode executar imediatamente
    if (this.canExecuteImmediately(operation)) {
      this.executeImmediately(operation);
      return;
    }
    
    // Adiciona à fila com ordenação por prioridade
    queue.push(operation);
    queue.sort((a, b) => {
      // Prioridade primeiro (menor número = maior prioridade)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Depois por idade (mais antigo primeiro)
      return a.timestamp - b.timestamp;
    });
    
    this.stats.queuedRequests++;
    const categoryStats = this.stats.categoryStats.get(operation.category);
    categoryStats.queued++;
    
    // Atualiza estatísticas de pico
    const totalQueueSize = Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0);
    this.stats.peakQueueSize = Math.max(this.stats.peakQueueSize, totalQueueSize);
    
    Logger.debug("APIRateLimiter", `Operação enfileirada: ${operation.category} (fila: ${queue.length})`);
  }
  
  /**
   * Verifica se operação pode ser executada imediatamente
   * @param {QueuedOperation} operation - Operação a verificar
   * @returns {boolean} True se pode executar imediatamente
   */
  canExecuteImmediately(operation) {
    const rateLimiter = this.rateLimiters.get(operation.category);
    const activeOps = this.activeOperations.get(operation.category);
    
    return rateLimiter.canExecute() && activeOps.size < rateLimiter.config.maxConcurrent;
  }
  
  /**
   * Executa operação imediatamente
   * @param {QueuedOperation} operation - Operação a executar
   */
  async executeImmediately(operation) {
    const rateLimiter = this.rateLimiters.get(operation.category);
    const activeOps = this.activeOperations.get(operation.category);
    
    // Registra operação ativa
    activeOps.add(operation.id);
    rateLimiter.recordExecution();
    
    try {
      const startTime = Date.now();
      const result = await this.executeWithTimeout(operation);
      const duration = Date.now() - startTime;
      
      this.recordSuccess(operation, duration);
      operation.resolve(result);
      
    } catch (error) {
      this.recordFailure(operation, error);
      
      // Tenta retry se configurado
      if (operation.retryCount < operation.maxRetries && this.shouldRetry(error)) {
        operation.retryCount++;
        Logger.debug("APIRateLimiter", `Retry ${operation.retryCount}/${operation.maxRetries} para operação ${operation.id}`);
        
        // Re-enfileira com delay
        setTimeout(() => {
          this.enqueueOperation(operation);
        }, this.calculateRetryDelay(operation.retryCount));
      } else {
        operation.reject(error);
      }
    } finally {
      // Remove da lista de operações ativas
      activeOps.delete(operation.id);
    }
  }
  
  /**
   * Executa operação com timeout
   * @param {QueuedOperation} operation - Operação a executar
   * @returns {Promise} Resultado da operação
   */
  async executeWithTimeout(operation) {
    const timeout = operation.context.timeout || getConfig('API_TIMEOUT') || 10000;
    
    return Promise.race([
      operation.apiCall(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API_TIMEOUT')), timeout);
      })
    ]);
  }
  
  /**
   * Inicia processamento contínuo das filas
   */
  startQueueProcessing() {
    const processInterval = getConfig('API_QUEUE_PROCESS_INTERVAL') || 50;
    
    setInterval(() => {
      this.processQueues();
    }, processInterval);
  }
  
  /**
   * Processa todas as filas
   */
  processQueues() {
    for (const [category, queue] of this.queues.entries()) {
      if (queue.length === 0) continue;
      
      const rateLimiter = this.rateLimiters.get(category);
      const activeOps = this.activeOperations.get(category);
      
      // Remove operações expiradas
      this.removeExpiredOperations(queue);
      
      // Processa operações que podem ser executadas
      while (queue.length > 0 && 
             rateLimiter.canExecute() && 
             activeOps.size < rateLimiter.config.maxConcurrent) {
        
        const operation = queue.shift();
        this.stats.queuedRequests--;
        
        // Executa operação
        this.executeImmediately(operation);
      }
    }
  }
  
  /**
   * Remove opera��ões expiradas das filas
   * @param {Array} queue - Fila a limpar
   */
  removeExpiredOperations(queue) {
    const expiredCount = queue.length;
    
    for (let i = queue.length - 1; i >= 0; i--) {
      const operation = queue[i];
      if (operation.isExpired) {
        queue.splice(i, 1);
        this.stats.queuedRequests--;
        operation.reject(new Error('OPERATION_EXPIRED'));
        Logger.debug("APIRateLimiter", `Operação expirada removida: ${operation.id}`);
      }
    }
    
    const removedCount = expiredCount - queue.length;
    if (removedCount > 0) {
      Logger.debug("APIRateLimiter", `${removedCount} operações expiradas removidas`);
    }
  }
  
  /**
   * Inicia limpeza periódica
   */
  startPeriodicCleanup() {
    const cleanupInterval = getConfig('API_CLEANUP_INTERVAL') || 60000; // 1 minuto
    
    setInterval(() => {
      this.performCleanup();
    }, cleanupInterval);
  }
  
  /**
   * Executa limpeza periódica
   */
  performCleanup() {
    let totalCleaned = 0;
    
    // Limpa filas
    for (const [category, queue] of this.queues.entries()) {
      const beforeSize = queue.length;
      this.removeExpiredOperations(queue);
      totalCleaned += beforeSize - queue.length;
    }
    
    // Reset de rate limiters
    for (const rateLimiter of this.rateLimiters.values()) {
      rateLimiter.cleanup();
    }
    
    if (totalCleaned > 0) {
      Logger.debug("APIRateLimiter", `Limpeza periódica: ${totalCleaned} operações removidas`);
    }
  }
  
  /**
   * Registra sucesso de operação
   * @param {QueuedOperation} operation - Operação bem-sucedida
   * @param {number} duration - Duração da operação
   */
  recordSuccess(operation, duration) {
    this.stats.completedRequests++;
    const categoryStats = this.stats.categoryStats.get(operation.category);
    categoryStats.completed++;
    
    // Atualiza tempo médio de espera
    const waitTime = Date.now() - operation.timestamp;
    this.updateAverageWaitTime(waitTime);
    categoryStats.avgWaitTime = (categoryStats.avgWaitTime + waitTime) / 2;
    
    Logger.debug("APIRateLimiter", `Operação concluída: ${operation.id} (${duration}ms)`);
  }
  
  /**
   * Registra falha de operação
   * @param {QueuedOperation} operation - Operação que falhou
   * @param {Error} error - Erro ocorrido
   */
  recordFailure(operation, error) {
    this.stats.failedRequests++;
    const categoryStats = this.stats.categoryStats.get(operation.category);
    categoryStats.failed++;
    
    Logger.debug("APIRateLimiter", `Operação falhou: ${operation.id} - ${error.message}`);
  }
  
  /**
   * Atualiza tempo médio de espera
   * @param {number} waitTime - Tempo de espera da operação
   */
  updateAverageWaitTime(waitTime) {
    if (this.stats.completedRequests === 1) {
      this.stats.averageWaitTime = waitTime;
    } else {
      this.stats.averageWaitTime = (this.stats.averageWaitTime + waitTime) / 2;
    }
  }
  
  /**
   * Verifica se deve fazer retry
   * @param {Error} error - Erro ocorrido
   * @returns {boolean} True se deve fazer retry
   */
  shouldRetry(error) {
    const retryableErrors = [
      'API_TIMEOUT',
      'NETWORK_ERROR',
      'RATE_LIMITED',
      'TEMPORARY_UNAVAILABLE'
    ];
    
    return retryableErrors.some(errorType => 
      error.message.includes(errorType) || error.name === errorType
    );
  }
  
  /**
   * Calcula delay para retry
   * @param {number} retryCount - Número da tentativa
   * @returns {number} Delay em ms
   */
  calculateRetryDelay(retryCount) {
    const baseDelay = getConfig('ERROR_RETRY_BASE_DELAY') || 1000;
    return Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000);
  }
  
  /**
   * Obtém estatísticas detalhadas
   * @returns {Object} Estatísticas do rate limiter
   */
  getDetailedStats() {
    const queueSizes = {};
    const activeOperationCounts = {};
    
    for (const [category, queue] of this.queues.entries()) {
      queueSizes[category] = queue.length;
      activeOperationCounts[category] = this.activeOperations.get(category).size;
    }
    
    return {
      ...this.stats,
      queueSizes,
      activeOperationCounts,
      rateLimiterStats: Object.fromEntries(
        Array.from(this.rateLimiters.entries()).map(([category, limiter]) => [
          category,
          limiter.getStats()
        ])
      ),
      timestamp: Date.now()
    };
  }
  
  /**
   * Força limpeza de todas as filas
   */
  clearAllQueues() {
    let totalCleared = 0;
    
    for (const [category, queue] of this.queues.entries()) {
      const queueSize = queue.length;
      
      // Rejeita todas as operações pendentes
      queue.forEach(operation => {
        operation.reject(new Error('QUEUE_CLEARED'));
      });
      
      queue.length = 0;
      totalCleared += queueSize;
      this.stats.queuedRequests -= queueSize;
    }
    
    Logger.info("APIRateLimiter", `Todas as filas foram limpas: ${totalCleared} operações canceladas`);
    return totalCleared;
  }
  
  /**
   * Pausa processamento de uma categoria
   * @param {string} category - Categoria a pausar
   */
  pauseCategory(category) {
    const rateLimiter = this.rateLimiters.get(category);
    if (rateLimiter) {
      rateLimiter.pause();
      Logger.info("APIRateLimiter", `Categoria ${category} pausada`);
    }
  }
  
  /**
   * Resume processamento de uma categoria
   * @param {string} category - Categoria a resumir
   */
  resumeCategory(category) {
    const rateLimiter = this.rateLimiters.get(category);
    if (rateLimiter) {
      rateLimiter.resume();
      Logger.info("APIRateLimiter", `Categoria ${category} resumida`);
    }
  }
}

/**
 * Classe para rate limiting por categoria
 */
class CategoryRateLimiter {
  constructor(category, config) {
    this.category = category;
    this.config = config;
    this.executionTimes = [];
    this.lastExecution = 0;
    this.burstCount = 0;
    this.burstStartTime = 0;
    this.paused = false;
  }
  
  /**
   * Verifica se pode executar operação
   * @returns {boolean} True se pode executar
   */
  canExecute() {
    if (this.paused) return false;
    
    const now = Date.now();
    
    // Verifica cooldown
    if (now - this.lastExecution < this.config.cooldownMs) {
      return false;
    }
    
    // Limpa execuções antigas
    this.cleanupOldExecutions(now);
    
    // Verifica limite por segundo
    const recentExecutions = this.executionTimes.filter(time => now - time < 1000);
    if (recentExecutions.length >= this.config.maxPerSecond) {
      return false;
    }
    
    // Verifica limite por minuto
    const minuteExecutions = this.executionTimes.filter(time => now - time < 60000);
    if (minuteExecutions.length >= this.config.maxPerMinute) {
      return false;
    }
    
    // Verifica burst limit
    if (this.burstCount >= this.config.burstLimit) {
      if (now - this.burstStartTime < 1000) {
        return false;
      } else {
        // Reset burst counter
        this.burstCount = 0;
        this.burstStartTime = now;
      }
    }
    
    return true;
  }
  
  /**
   * Registra execução
   */
  recordExecution() {
    const now = Date.now();
    this.executionTimes.push(now);
    this.lastExecution = now;
    
    // Gerencia burst counter
    if (now - this.burstStartTime > 1000) {
      this.burstCount = 1;
      this.burstStartTime = now;
    } else {
      this.burstCount++;
    }
  }
  
  /**
   * Remove execuções antigas
   * @param {number} now - Timestamp atual
   */
  cleanupOldExecutions(now) {
    // Mantém apenas execuções dos últimos 5 minutos
    this.executionTimes = this.executionTimes.filter(time => now - time < 300000);
  }
  
  /**
   * Pausa rate limiter
   */
  pause() {
    this.paused = true;
  }
  
  /**
   * Resume rate limiter
   */
  resume() {
    this.paused = false;
  }
  
  /**
   * Limpeza periódica
   */
  cleanup() {
    const now = Date.now();
    this.cleanupOldExecutions(now);
    
    // Reset burst se necessário
    if (now - this.burstStartTime > 5000) {
      this.burstCount = 0;
    }
  }
  
  /**
   * Obtém estatísticas
   * @returns {Object} Estatísticas do rate limiter
   */
  getStats() {
    const now = Date.now();
    const recentExecutions = this.executionTimes.filter(time => now - time < 60000);
    
    return {
      category: this.category,
      paused: this.paused,
      totalExecutions: this.executionTimes.length,
      recentExecutions: recentExecutions.length,
      burstCount: this.burstCount,
      lastExecution: this.lastExecution,
      timeSinceLastExecution: now - this.lastExecution,
      config: this.config
    };
  }
}

// Instância global do rate limiter
export const globalAPIRateLimiter = new APIRateLimiter();

// Funções de conveniência para uso direto
export async function executeTabsOperation(operationType, apiCall, context = {}) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

export async function executeTabGroupsOperation(operationType, apiCall, context = {}) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

export async function executeStorageOperation(operationType, apiCall, context = {}) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

export async function executeWindowsOperation(operationType, apiCall, context = {}) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

// Wrapper functions para APIs específicas
export const RateLimitedAPI = {
  // Tabs API
  tabs: {
    get: (tabId, context = {}) => executeTabsOperation('CRITICAL_TAB_GET', () => browser.tabs.get(tabId), context),
    query: (queryInfo, context = {}) => executeTabsOperation('TAB_QUERY', () => browser.tabs.query(queryInfo), context),
    group: (options, context = {}) => {
      const operationType = context.userInitiated ? 'USER_TAB_GROUP' : 'AUTO_TAB_GROUP';
      return executeTabsOperation(operationType, () => browser.tabs.group(options), context);
    },
    ungroup: (tabIds, context = {}) => {
      const operationType = context.userInitiated ? 'USER_TAB_UNGROUP' : 'AUTO_TAB_UNGROUP';
      return executeTabsOperation(operationType, () => browser.tabs.ungroup(tabIds), context);
    }
  },
  
  // TabGroups API
  tabGroups: {
    get: (groupId, context = {}) => executeTabGroupsOperation('CRITICAL_GROUP_GET', () => browser.tabGroups.get(groupId), context),
    query: (queryInfo, context = {}) => executeTabGroupsOperation('GROUP_QUERY', () => browser.tabGroups.query(queryInfo), context),
    update: (groupId, updateProperties, context = {}) => {
      const operationType = context.userInitiated ? 'USER_GROUP_UPDATE' : 'AUTO_GROUP_UPDATE';
      return executeTabGroupsOperation(operationType, () => browser.tabGroups.update(groupId, updateProperties), context);
    }
  },
  
  // Windows API
  windows: {
    getAll: (getInfo, context = {}) => executeWindowsOperation('WINDOW_QUERY', () => browser.windows.getAll(getInfo), context)
  },
  
  // Storage API
  storage: {
    local: {
      get: (keys, context = {}) => executeStorageOperation('STORAGE_GET', () => browser.storage.local.get(keys), context),
      set: (items, context = {}) => executeStorageOperation('STORAGE_SET', () => browser.storage.local.set(items), context)
    },
    sync: {
      get: (keys, context = {}) => executeStorageOperation('STORAGE_GET', () => browser.storage.sync.get(keys), context),
      set: (items, context = {}) => executeStorageOperation('STORAGE_SET', () => browser.storage.sync.set(items), context)
    }
  }
};

Logger.debug("APIRateLimiter", "Sistema de rate limiting de APIs inicializado.");