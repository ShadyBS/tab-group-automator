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
  CRITICAL_TAB_GET: {
    priority: 1,
    category: "tabs",
    operation: "get",
    critical: true,
  },
  CRITICAL_GROUP_GET: {
    priority: 1,
    category: "tabGroups",
    operation: "get",
    critical: true,
  },

  // Operações de usuário - prioridade média-alta
  USER_TAB_GROUP: {
    priority: 2,
    category: "tabs",
    operation: "group",
    userInitiated: true,
  },
  USER_TAB_UNGROUP: {
    priority: 2,
    category: "tabs",
    operation: "ungroup",
    userInitiated: true,
  },
  USER_GROUP_UPDATE: {
    priority: 2,
    category: "tabGroups",
    operation: "update",
    userInitiated: true,
  },

  // Operações de query - prioridade média
  TAB_QUERY: { priority: 3, category: "tabs", operation: "query" },
  GROUP_QUERY: { priority: 3, category: "tabGroups", operation: "query" },
  WINDOW_QUERY: { priority: 3, category: "windows", operation: "getAll" },

  // Operações automáticas - prioridade baixa
  AUTO_TAB_GROUP: {
    priority: 4,
    category: "tabs",
    operation: "group",
    automated: true,
  },
  AUTO_TAB_UNGROUP: {
    priority: 4,
    category: "tabs",
    operation: "ungroup",
    automated: true,
  },
  AUTO_GROUP_UPDATE: {
    priority: 4,
    category: "tabGroups",
    operation: "update",
    automated: true,
  },

  // Operações de storage - prioridade baixa
  STORAGE_GET: { priority: 5, category: "storage", operation: "get" },
  STORAGE_SET: { priority: 5, category: "storage", operation: "set" },

  // Operações de background - prioridade muito baixa
  BACKGROUND_CLEANUP: {
    priority: 6,
    category: "background",
    operation: "cleanup",
  },
  BACKGROUND_SYNC: { priority: 6, category: "background", operation: "sync" },
};

/**
 * Configurações de rate limiting por categoria de API
 */
const API_RATE_LIMITS = {
  tabs: {
    maxConcurrent: 8, // Máximo de operações simultâneas
    maxPerSecond: 20, // Máximo por segundo
    maxPerMinute: 300, // Máximo por minuto
    burstLimit: 10, // Limite de burst
    cooldownMs: 100, // Cooldown entre operações
  },
  tabGroups: {
    maxConcurrent: 6,
    maxPerSecond: 15,
    maxPerMinute: 200,
    burstLimit: 8,
    cooldownMs: 150,
  },
  windows: {
    maxConcurrent: 4,
    maxPerSecond: 10,
    maxPerMinute: 100,
    burstLimit: 5,
    cooldownMs: 200,
  },
  storage: {
    maxConcurrent: 3,
    maxPerSecond: 8,
    maxPerMinute: 80,
    burstLimit: 4,
    cooldownMs: 250,
  },
  background: {
    maxConcurrent: 2,
    maxPerSecond: 5,
    maxPerMinute: 50,
    burstLimit: 3,
    cooldownMs: 500,
  },
};

/**
 * Representa uma operação de API enfileirada, contendo a chamada a ser executada,
 * sua prioridade, e informações de contexto.
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
 * Gerencia o rate limiting e o throttling de chamadas de API do navegador.
 * Utiliza filas priorizadas por categoria de operação para garantir que
 * operações críticas sejam executadas antes das de baixa prioridade.
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
      categoryStats: new Map(),
    };

    // Inicializa estruturas para cada categoria
    for (const category of Object.keys(API_RATE_LIMITS)) {
      this.queues.set(category, []);
      this.activeOperations.set(category, new Set());
      this.rateLimiters.set(
        category,
        new CategoryRateLimiter(category, API_RATE_LIMITS[category])
      );
      this.stats.categoryStats.set(category, {
        requests: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        avgWaitTime: 0,
      });
    }

    // Inicia processamento das filas
    this.startQueueProcessing();

    // Inicia limpeza periódica
    this.startPeriodicCleanup();

    Logger.info("APIRateLimiter", "Sistema de rate limiting inicializado");
  }

  /**
   * Enfileira uma operação de API para ser executada de acordo com as regras de rate limiting.
   * @param {string} operationTypeKey - A chave do tipo de operação (de `API_OPERATION_TYPES`).
   * @param {Function} apiCall - A função que realiza a chamada à API do navegador.
   * @param {object} [context={}] - Contexto adicional para a operação (ex: `timeout`, `maxRetries`).
   * @returns {Promise<any>} Uma promessa que resolve com o resultado da chamada da API.
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
      const operation = new QueuedOperation(
        operationType,
        apiCall,
        resolve,
        reject,
        context
      );
      this.enqueueOperation(operation);
    });
  }

  /**
   * Adiciona uma operação à fila de sua categoria, mantendo a ordem de prioridade.
   * @param {QueuedOperation} operation - O objeto da operação a ser enfileirado.
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
    const totalQueueSize = Array.from(this.queues.values()).reduce(
      (sum, q) => sum + q.length,
      0
    );
    this.stats.peakQueueSize = Math.max(
      this.stats.peakQueueSize,
      totalQueueSize
    );

    Logger.debug(
      "APIRateLimiter",
      `Operação enfileirada: ${operation.category} (fila: ${queue.length})`
    );
  }

  /**
   * Verifica se uma operação pode ser executada imediatamente, sem entrar na fila.
   * @param {QueuedOperation} operation - A operação a ser verificada.
   * @returns {boolean} `true` se a operação puder ser executada imediatamente.
   */
  canExecuteImmediately(operation) {
    const rateLimiter = this.rateLimiters.get(operation.category);
    const activeOps = this.activeOperations.get(operation.category);

    return (
      rateLimiter.canExecute() &&
      activeOps.size < rateLimiter.config.maxConcurrent
    );
  }

  /**
   * Executa uma operação de API imediatamente, tratando o sucesso, a falha e as retentativas.
   * @param {QueuedOperation} operation - A operação a ser executada.
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
      if (
        operation.retryCount < operation.maxRetries &&
        this.shouldRetry(error)
      ) {
        operation.retryCount++;
        Logger.debug(
          "APIRateLimiter",
          `Retry ${operation.retryCount}/${operation.maxRetries} para operação ${operation.id}`
        );

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
   * Executa a chamada da API de uma operação com um timeout configurável.
   * @param {QueuedOperation} operation - A operação a ser executada.
   * @returns {Promise<any>} O resultado da chamada da API.
   */
  async executeWithTimeout(operation) {
    const timeout =
      operation.context.timeout || getConfig("API_TIMEOUT") || 10000;

    return Promise.race([
      operation.apiCall(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("API_TIMEOUT")), timeout);
      }),
    ]);
  }

  /**
   * Inicia o processamento periódico das filas de operações.
   */
  startQueueProcessing() {
    const processInterval = getConfig("API_QUEUE_PROCESS_INTERVAL") || 50;

    setInterval(() => {
      this.processQueues();
    }, processInterval);
  }

  /**
   * Processa todas as filas, executando operações se os limites de rate limiting permitirem.
   */
  processQueues() {
    for (const [category, queue] of this.queues.entries()) {
      if (queue.length === 0) continue;

      const rateLimiter = this.rateLimiters.get(category);
      const activeOps = this.activeOperations.get(category);

      // Remove operações expiradas
      this.removeExpiredOperations(queue);

      // Processa operações que podem ser executadas
      while (
        queue.length > 0 &&
        rateLimiter.canExecute() &&
        activeOps.size < rateLimiter.config.maxConcurrent
      ) {
        const operation = queue.shift();
        this.stats.queuedRequests--;

        // Executa operação
        this.executeImmediately(operation);
      }
    }
  }

  /**
   * Remove operações expiradas de uma fila.
   * @param {QueuedOperation[]} queue - A fila a ser limpa.
   */
  removeExpiredOperations(queue) {
    const expiredCount = queue.length;

    for (let i = queue.length - 1; i >= 0; i--) {
      const operation = queue[i];
      if (operation.isExpired) {
        queue.splice(i, 1);
        this.stats.queuedRequests--;
        operation.reject(new Error("OPERATION_EXPIRED"));
        Logger.debug(
          "APIRateLimiter",
          `Operação expirada removida: ${operation.id}`
        );
      }
    }

    const removedCount = expiredCount - queue.length;
    if (removedCount > 0) {
      Logger.debug(
        "APIRateLimiter",
        `${removedCount} operações expiradas removidas`
      );
    }
  }

  /**
   * Inicia um temporizador para limpeza periódica de recursos internos.
   */
  startPeriodicCleanup() {
    const cleanupInterval = getConfig("API_CLEANUP_INTERVAL") || 60000; // 1 minuto

    setInterval(() => {
      this.performCleanup();
    }, cleanupInterval);
  }

  /**
   * Executa tarefas de limpeza, como remover operações expiradas e resetar contadores.
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
      Logger.debug(
        "APIRateLimiter",
        `Limpeza periódica: ${totalCleaned} operações removidas`
      );
    }
  }

  /**
   * Regista o sucesso de uma operação e atualiza as estatísticas.
   * @param {QueuedOperation} operation - A operação que foi concluída com sucesso.
   * @param {number} duration - A duração da operação em milissegundos.
   */
  recordSuccess(operation, duration) {
    this.stats.completedRequests++;
    const categoryStats = this.stats.categoryStats.get(operation.category);
    categoryStats.completed++;

    // Atualiza tempo médio de espera
    const waitTime = Date.now() - operation.timestamp;
    this.updateAverageWaitTime(waitTime);
    categoryStats.avgWaitTime = (categoryStats.avgWaitTime + waitTime) / 2;

    Logger.debug(
      "APIRateLimiter",
      `Operação concluída: ${operation.id} (${duration}ms)`
    );
  }

  /**
   * Regista a falha de uma operação e atualiza as estatísticas.
   * @param {QueuedOperation} operation - A operação que falhou.
   * @param {Error} error - O erro que ocorreu.
   */
  recordFailure(operation, error) {
    this.stats.failedRequests++;
    const categoryStats = this.stats.categoryStats.get(operation.category);
    categoryStats.failed++;

    Logger.debug(
      "APIRateLimiter",
      `Operação falhou: ${operation.id} - ${error.message}`
    );
  }

  /**
   * Atualiza o tempo médio de espera das operações.
   * @param {number} waitTime - O tempo de espera da operação recém-concluída.
   */
  updateAverageWaitTime(waitTime) {
    if (this.stats.completedRequests === 1) {
      this.stats.averageWaitTime = waitTime;
    } else {
      this.stats.averageWaitTime = (this.stats.averageWaitTime + waitTime) / 2;
    }
  }

  /**
   * Determina se uma operação que falhou deve ser tentada novamente com base no tipo de erro.
   * @param {Error} error - O erro que ocorreu.
   * @returns {boolean} `true` se a operação deve ser tentada novamente.
   */
  shouldRetry(error) {
    const retryableErrors = [
      "API_TIMEOUT",
      "NETWORK_ERROR",
      "RATE_LIMITED",
      "TEMPORARY_UNAVAILABLE",
    ];

    return retryableErrors.some(
      (errorType) =>
        error.message.includes(errorType) || error.name === errorType
    );
  }

  /**
   * Calcula o tempo de espera para uma retentativa usando backoff exponencial.
   * @param {number} retryCount - O número da tentativa atual.
   * @returns {number} O tempo de espera em milissegundos.
   */
  calculateRetryDelay(retryCount) {
    const baseDelay = getConfig("ERROR_RETRY_BASE_DELAY") || 1000;
    return Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000);
  }

  /**
   * Obtém um objeto com estatísticas detalhadas sobre o estado do rate limiter.
   * @returns {object} As estatísticas detalhadas.
   */
  getDetailedStats() {
    const queueSizes = {};
    const activeOperationCounts = {};

    for (const [category, queue] of this.queues.entries()) {
      queueSizes[category] = queue.length;
      activeOperationCounts[category] =
        this.activeOperations.get(category).size;
    }

    return {
      ...this.stats,
      queueSizes,
      activeOperationCounts,
      rateLimiterStats: Object.fromEntries(
        Array.from(this.rateLimiters.entries()).map(([category, limiter]) => [
          category,
          limiter.getStats(),
        ])
      ),
      timestamp: Date.now(),
    };
  }

  /**
   * Limpa todas as filas, rejeitando todas as operações pendentes.
   * @returns {number} O número de operações canceladas.
   */
  clearAllQueues() {
    let totalCleared = 0;

    for (const [category, queue] of this.queues.entries()) {
      const queueSize = queue.length;

      // Rejeita todas as operações pendentes
      queue.forEach((operation) => {
        operation.reject(new Error("QUEUE_CLEARED"));
      });

      queue.length = 0;
      totalCleared += queueSize;
      this.stats.queuedRequests -= queueSize;
    }

    Logger.info(
      "APIRateLimiter",
      `Todas as filas foram limpas: ${totalCleared} operações canceladas`
    );
    return totalCleared;
  }

  /**
   * Pausa o processamento de novas operações para uma categoria específica.
   * @param {string} category - A categoria a ser pausada.
   */
  pauseCategory(category) {
    const rateLimiter = this.rateLimiters.get(category);
    if (rateLimiter) {
      rateLimiter.pause();
      Logger.info("APIRateLimiter", `Categoria ${category} pausada`);
    }
  }

  /**
   * Retoma o processamento de operações para uma categoria específica.
   * @param {string} category - A categoria a ser retomada.
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
 * Gerencia os limites de taxa (por segundo, por minuto, concorrência) para uma única categoria de API.
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
   * Verifica se uma operação pode ser executada com base nos limites de taxa atuais.
   * @returns {boolean} `true` se a execução for permitida.
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
    const recentExecutions = this.executionTimes.filter(
      (time) => now - time < 1000
    );
    if (recentExecutions.length >= this.config.maxPerSecond) {
      return false;
    }

    // Verifica limite por minuto
    const minuteExecutions = this.executionTimes.filter(
      (time) => now - time < 60000
    );
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
   * Regista que uma operação foi executada, atualizando os contadores de rate limiting.
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
   * Remove registos de execução antigos para manter o array de `executionTimes` pequeno.
   * @param {number} now - O timestamp atual.
   */
  cleanupOldExecutions(now) {
    // Mantém apenas execuções dos últimos 5 minutos
    this.executionTimes = this.executionTimes.filter(
      (time) => now - time < 300000
    );
  }

  /**
   * Pausa o rate limiter, impedindo a execução de novas operações.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Retoma o rate limiter, permitindo a execução de novas operações.
   */
  resume() {
    this.paused = false;
  }

  /**
   * Executa a limpeza periódica dos registos de execução.
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
   * Obtém estatísticas sobre o estado atual do rate limiter da categoria.
   * @returns {object} As estatísticas do rate limiter.
   */
  getStats() {
    const now = Date.now();
    const recentExecutions = this.executionTimes.filter(
      (time) => now - time < 60000
    );

    return {
      category: this.category,
      paused: this.paused,
      totalExecutions: this.executionTimes.length,
      recentExecutions: recentExecutions.length,
      burstCount: this.burstCount,
      lastExecution: this.lastExecution,
      timeSinceLastExecution: now - this.lastExecution,
      config: this.config,
    };
  }
}

// Instância global do rate limiter
export const globalAPIRateLimiter = new APIRateLimiter();

// Funções de conveniência para uso direto
/** @deprecated Usar `RateLimitedAPI.tabs` */
export async function executeTabsOperation(
  operationType,
  apiCall,
  context = {}
) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

/** @deprecated Usar `RateLimitedAPI.tabGroups` */
export async function executeTabGroupsOperation(
  operationType,
  apiCall,
  context = {}
) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

/** @deprecated Usar `RateLimitedAPI.storage` */
export async function executeStorageOperation(
  operationType,
  apiCall,
  context = {}
) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

/** @deprecated Usar `RateLimitedAPI.windows` */
export async function executeWindowsOperation(
  operationType,
  apiCall,
  context = {}
) {
  return globalAPIRateLimiter.executeOperation(operationType, apiCall, context);
}

// Wrapper functions para APIs específicas
export const RateLimitedAPI = {
  // Tabs API
  tabs: {
    get: (tabId, context = {}) =>
      executeTabsOperation(
        "CRITICAL_TAB_GET",
        () => browser.tabs.get(tabId),
        context
      ),
    query: (queryInfo, context = {}) =>
      executeTabsOperation(
        "TAB_QUERY",
        () => browser.tabs.query(queryInfo),
        context
      ),
    group: (options, context = {}) => {
      const operationType = context.userInitiated
        ? "USER_TAB_GROUP"
        : "AUTO_TAB_GROUP";
      return executeTabsOperation(
        operationType,
        () => browser.tabs.group(options),
        context
      );
    },
    ungroup: (tabIds, context = {}) => {
      const operationType = context.userInitiated
        ? "USER_TAB_UNGROUP"
        : "AUTO_TAB_UNGROUP";
      return executeTabsOperation(
        operationType,
        () => browser.tabs.ungroup(tabIds),
        context
      );
    },
  },

  // TabGroups API
  tabGroups: {
    get: (groupId, context = {}) =>
      executeTabGroupsOperation(
        "CRITICAL_GROUP_GET",
        () => browser.tabGroups.get(groupId),
        context
      ),
    query: (queryInfo, context = {}) =>
      executeTabGroupsOperation(
        "GROUP_QUERY",
        () => browser.tabGroups.query(queryInfo),
        context
      ),
    update: (groupId, updateProperties, context = {}) => {
      const operationType = context.userInitiated
        ? "USER_GROUP_UPDATE"
        : "AUTO_GROUP_UPDATE";
      return executeTabGroupsOperation(
        operationType,
        () => browser.tabGroups.update(groupId, updateProperties),
        context
      );
    },
  },

  // Windows API
  windows: {
    getAll: (getInfo, context = {}) =>
      executeWindowsOperation(
        "WINDOW_QUERY",
        () => browser.windows.getAll(getInfo),
        context
      ),
  },

  // Storage API
  storage: {
    local: {
      get: (keys, context = {}) =>
        executeStorageOperation(
          "STORAGE_GET",
          () => browser.storage.local.get(keys),
          context
        ),
      set: (items, context = {}) =>
        executeStorageOperation(
          "STORAGE_SET",
          () => browser.storage.local.set(items),
          context
        ),
    },
    sync: {
      get: (keys, context = {}) =>
        executeStorageOperation(
          "STORAGE_GET",
          () => browser.storage.sync.get(keys),
          context
        ),
      set: (items, context = {}) =>
        executeStorageOperation(
          "STORAGE_SET",
          () => browser.storage.sync.set(items),
          context
        ),
    },
  },
};

Logger.debug(
  "APIRateLimiter",
  "Sistema de rate limiting de APIs inicializado."
);
