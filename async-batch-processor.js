/**
 * @file async-batch-processor.js
 * @description Sistema de processamento em lote para operações assíncronas, otimizando performance de APIs.
 */

import Logger from "./logger.js";
import { getConfig, globalRateLimiter } from "./performance-config.js";
import { withErrorHandling } from "./error-handler.js";

/**
 * Processador de lotes para operações assíncronas
 */
export class AsyncBatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || getConfig('BATCH_SIZE');
    this.delay = options.delay || getConfig('BATCH_DELAY');
    this.maxConcurrent = options.maxConcurrent || getConfig('MAX_CONCURRENT_OPERATIONS');
    this.context = options.context || 'BatchProcessor';
    this.enableLogging = options.enableLogging !== false;
    
    this.activeOperations = 0;
    this.queue = [];
    this.processing = false;
  }
  
  /**
   * Adiciona operação à fila de processamento
   * @param {Function} operation - Função assíncrona a ser executada
   * @param {*} data - Dados para a operação
   * @returns {Promise} Promise que resolve com o resultado
   */
  async add(operation, data) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        operation,
        data,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      if (!this.processing) {
        this.startProcessing();
      }
    });
  }
  
  /**
   * Inicia o processamento da fila
   */
  async startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    const startTime = Date.now();
    
    try {
      while (this.queue.length > 0) {
        await this.processBatch();
        
        if (this.queue.length > 0 && this.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      }
    } finally {
      this.processing = false;
      
      if (this.enableLogging) {
        const duration = Date.now() - startTime;
        Logger.debug(this.context, `Processamento de lote concluído em ${duration}ms`);
      }
    }
  }
  
  /**
   * Processa um lote de operações
   */
  async processBatch() {
    const batch = this.queue.splice(0, this.batchSize);
    if (batch.length === 0) return;
    
    const batchStartTime = Date.now();
    
    // Agrupa operações por tipo se possível
    const groupedOps = this.groupOperations(batch);
    
    // Processa grupos concorrentemente
    const promises = groupedOps.map(group => this.processGroup(group));
    
    await Promise.allSettled(promises);
    
    if (this.enableLogging) {
      const duration = Date.now() - batchStartTime;
      const logThreshold = getConfig('PERFORMANCE_LOG_THRESHOLD');
      
      if (duration > logThreshold || getConfig('BATCH_PERFORMANCE_LOG')) {
        Logger.debug(this.context, `Lote de ${batch.length} operações processado em ${duration}ms`);
      }
    }
  }
  
  /**
   * Agrupa operações similares para otimização
   * @param {Array} batch - Lote de operações
   * @returns {Array} Grupos de operações
   */
  groupOperations(batch) {
    const groups = new Map();
    
    for (const item of batch) {
      const key = this.getOperationKey(item.operation);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }
    
    return Array.from(groups.values());
  }
  
  /**
   * Obtém chave para agrupar operações similares
   * @param {Function} operation - Função de operação
   * @returns {string} Chave do grupo
   */
  getOperationKey(operation) {
    // Tenta identificar o tipo de operação pelo nome da função
    const opName = operation.name || operation.toString().match(/function\s+([^(]+)/)?.[1] || 'anonymous';
    return opName;
  }
  
  /**
   * Processa um grupo de operações
   * @param {Array} group - Grupo de operações
   */
  async processGroup(group) {
    // Controla concorrência
    while (this.activeOperations >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.activeOperations++;
    
    try {
      // Processa itens do grupo concorrentemente mas respeitando rate limiting
      const concurrentBatch = Math.min(group.length, this.maxConcurrent - this.activeOperations + 1);
      
      for (let i = 0; i < group.length; i += concurrentBatch) {
        const subBatch = group.slice(i, i + concurrentBatch);
        const promises = subBatch.map(item => this.executeOperation(item));
        await Promise.allSettled(promises);
        
        // Rate limiting entre sub-batches
        if (i + concurrentBatch < group.length) {
          await globalRateLimiter.checkRate();
        }
      }
    } finally {
      this.activeOperations--;
    }
  }
  
  /**
   * Executa uma operação individual
   * @param {object} item - Item da fila
   */
  async executeOperation(item) {
    try {
      const result = await withErrorHandling(
        () => item.operation(item.data),
        {
          context: `${this.context}-operation`,
          maxRetries: 2,
          criticalOperation: false
        }
      );
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
  }
  
  /**
   * Obtém estatísticas do processador
   * @returns {object} Estatísticas
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      activeOperations: this.activeOperations,
      processing: this.processing,
      batchSize: this.batchSize,
      maxConcurrent: this.maxConcurrent
    };
  }
  
  /**
   * Limpa a fila (rejeita todas as operações pendentes)
   */
  clear() {
    const error = new Error('Batch processor cleared');
    for (const item of this.queue) {
      item.reject(error);
    }
    this.queue = [];
  }
}

/**
 * Processador especializado para operações de abas
 */
export class TabBatchProcessor extends AsyncBatchProcessor {
  constructor(options = {}) {
    super({
      ...options,
      context: 'TabBatchProcessor',
      batchSize: options.batchSize || getConfig('API_BATCH_SIZE')
    });
  }
  
  /**
   * Agrupa operações de abas de forma mais inteligente
   * @param {Array} batch - Lote de operações
   * @returns {Array} Grupos otimizados
   */
  groupOperations(batch) {
    const groups = {
      query: [],
      get: [],
      update: [],
      group: [],
      ungroup: [],
      other: []
    };
    
    for (const item of batch) {
      const opType = this.identifyTabOperation(item.operation, item.data);
      if (groups[opType]) {
        groups[opType].push(item);
      } else {
        groups.other.push(item);
      }
    }
    
    // Filtra grupos vazios e retorna
    return Object.values(groups).filter(group => group.length > 0);
  }
  
  /**
   * Identifica o tipo de operação de aba
   * @param {Function} operation - Operação
   * @param {*} data - Dados da operação
   * @returns {string} Tipo da operação
   */
  identifyTabOperation(operation, data) {
    const opString = operation.toString();
    
    if (opString.includes('browser.tabs.query')) return 'query';
    if (opString.includes('browser.tabs.get')) return 'get';
    if (opString.includes('browser.tabs.update')) return 'update';
    if (opString.includes('browser.tabs.group')) return 'group';
    if (opString.includes('browser.tabs.ungroup')) return 'ungroup';
    
    return 'other';
  }
  
  /**
   * Processa grupos de tabs de forma otimizada
   * @param {Array} group - Grupo de operações
   */
  async processGroup(group) {
    if (group.length === 0) return;
    
    const opType = this.identifyTabOperation(group[0].operation, group[0].data);
    
    // Otimizações específicas por tipo de operação
    switch (opType) {
      case 'query':
        await this.processQueryGroup(group);
        break;
      case 'get':
        await this.processGetGroup(group);
        break;
      case 'group':
        await this.processGroupOperations(group);
        break;
      default:
        await super.processGroup(group);
    }
  }
  
  /**
   * Processa queries de abas em lote
   * @param {Array} group - Grupo de queries
   */
  async processQueryGroup(group) {
    // Para queries, podemos tentar combinar critérios similares
    const combinableQueries = this.combineQueries(group);
    
    for (const combinedQuery of combinableQueries) {
      await this.executeOperation(combinedQuery);
    }
  }
  
  /**
   * Processa operações de get em lote
   * @param {Array} group - Grupo de gets
   */
  async processGetGroup(group) {
    // Para gets individuais, processa em pequenos lotes para não sobrecarregar
    const subBatchSize = Math.min(5, group.length);
    
    for (let i = 0; i < group.length; i += subBatchSize) {
      const subBatch = group.slice(i, i + subBatchSize);
      const promises = subBatch.map(item => this.executeOperation(item));
      await Promise.allSettled(promises);
      
      if (i + subBatchSize < group.length) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequena pausa
      }
    }
  }
  
  /**
   * Processa operações de agrupamento
   * @param {Array} group - Grupo de operações de agrupamento
   */
  async processGroupOperations(group) {
    // Agrupa operações por janela para otimizar
    const byWindow = new Map();
    
    for (const item of group) {
      const windowId = this.extractWindowId(item.data);
      if (!byWindow.has(windowId)) {
        byWindow.set(windowId, []);
      }
      byWindow.get(windowId).push(item);
    }
    
    // Processa cada janela separadamente
    for (const windowOps of byWindow.values()) {
      for (const item of windowOps) {
        await this.executeOperation(item);
        // Pequena pausa entre operações de agrupamento
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  /**
   * Combina queries similares quando possível
   * @param {Array} group - Grupo de queries
   * @returns {Array} Queries combinadas
   */
  combineQueries(group) {
    // Por simplicidade, retorna o grupo original
    // Implementação futura poderia combinar queries com critérios similares
    return group;
  }
  
  /**
   * Extrai windowId dos dados da operação
   * @param {*} data - Dados da operação
   * @returns {number} Window ID
   */
  extractWindowId(data) {
    if (data && typeof data === 'object') {
      return data.windowId || data.createProperties?.windowId || 'unknown';
    }
    return 'unknown';
  }
}

/**
 * Processador especializado para operações de grupos
 */
export class GroupBatchProcessor extends AsyncBatchProcessor {
  constructor(options = {}) {
    super({
      ...options,
      context: 'GroupBatchProcessor',
      batchSize: options.batchSize || getConfig('API_BATCH_SIZE')
    });
  }
  
  /**
   * Processa operações de grupos com otimizações específicas
   */
  async processGroup(group) {
    // Operações de grupos são mais sensíveis, processamos uma por vez
    for (const item of group) {
      await this.executeOperation(item);
      // Pausa entre operações de grupo para evitar conflitos
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

// Instâncias globais reutilizáveis
export const globalTabBatchProcessor = new TabBatchProcessor();
export const globalGroupBatchProcessor = new GroupBatchProcessor();

/**
 * Helper para criar operações em lote facilmente
 * @param {Array} items - Itens a processar
 * @param {Function} operation - Operação a executar para cada item
 * @param {object} options - Opções do processador
 * @returns {Promise<Array>} Resultados das operações
 */
export async function batchProcess(items, operation, options = {}) {
  const processor = new AsyncBatchProcessor(options);
  
  const promises = items.map(item => processor.add(operation, item));
  return Promise.allSettled(promises);
}

/**
 * Helper específico para operações de abas
 * @param {Array} items - Itens a processar
 * @param {Function} operation - Operação de aba
 * @param {object} options - Opções
 * @returns {Promise<Array>} Resultados
 */
export async function batchProcessTabs(items, operation, options = {}) {
  const promises = items.map(item => globalTabBatchProcessor.add(operation, item));
  return Promise.allSettled(promises);
}

/**
 * Helper específico para operações de grupos
 * @param {Array} items - Itens a processar
 * @param {Function} operation - Operação de grupo
 * @param {object} options - Opções
 * @returns {Promise<Array>} Resultados
 */
export async function batchProcessGroups(items, operation, options = {}) {
  const promises = items.map(item => globalGroupBatchProcessor.add(operation, item));
  return Promise.allSettled(promises);
}

Logger.debug("AsyncBatchProcessor", "Sistema de processamento em lote inicializado.");
