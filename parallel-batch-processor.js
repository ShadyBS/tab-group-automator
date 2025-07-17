/**
 * @file parallel-batch-processor.js
 * @description Sistema avançado de processamento paralelo em lote com controle de concorrência.
 */

import Logger from "./logger.js";
import { getConfig } from "./performance-config.js";
import { withErrorHandling } from "./error-handler.js";

/**
 * Processador paralelo avançado com controle de concorrência
 */
export class ParallelBatchProcessor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || getConfig('MAX_CONCURRENT_OPERATIONS');
    this.batchSize = options.batchSize || getConfig('BATCH_SIZE');
    this.context = options.context || 'ParallelProcessor';
    this.enableMetrics = options.enableMetrics !== false;
    
    // Controle de concorrência
    this.activeTasks = 0;
    this.taskQueue = [];
    this.semaphore = new Semaphore(this.maxConcurrency);
    
    // Métricas de performance
    this.metrics = {
      totalProcessed: 0,
      totalTime: 0,
      averageTime: 0,
      peakConcurrency: 0,
      errors: 0
    };
  }
  
  /**
   * Processa uma lista de itens em paralelo com controle de concorrência
   * @param {Array} items - Itens a processar
   * @param {Function} processor - Função de processamento
   * @param {object} options - Opções específicas
   * @returns {Promise<Array>} Resultados do processamento
   */
  async processParallel(items, processor, options = {}) {
    if (!items || items.length === 0) return [];
    
    const startTime = Date.now();
    const batchSize = options.batchSize || this.batchSize;
    const maxConcurrency = options.maxConcurrency || this.maxConcurrency;
    
    Logger.debug(
      this.context,
      `Iniciando processamento paralelo de ${items.length} itens (concorrência: ${maxConcurrency}, lote: ${batchSize})`
    );
    
    try {
      // Divide em lotes para processamento
      const batches = this.createBatches(items, batchSize);
      const results = [];
      
      // Processa lotes com controle de concorrência
      const batchPromises = batches.map((batch, index) => 
        this.processBatchWithSemaphore(batch, processor, index, options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Consolida resultados
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          Logger.warn(this.context, 'Falha no processamento de lote:', result.reason);
          this.metrics.errors++;
        }
      }
      
      // Atualiza métricas
      const duration = Date.now() - startTime;
      this.updateMetrics(items.length, duration);
      
      Logger.debug(
        this.context,
        `Processamento paralelo concluído: ${results.length}/${items.length} itens em ${duration}ms`
      );
      
      return results;
      
    } catch (error) {
      Logger.error(this.context, 'Erro no processamento paralelo:', error);
      throw error;
    }
  }
  
  /**
   * Processa um lote com controle de semáforo
   * @param {Array} batch - Lote a processar
   * @param {Function} processor - Função de processamento
   * @param {number} batchIndex - Índice do lote
   * @param {object} options - Opções
   * @returns {Promise<Array>} Resultados do lote
   */
  async processBatchWithSemaphore(batch, processor, batchIndex, options) {
    await this.semaphore.acquire();
    
    try {
      this.activeTasks++;
      this.metrics.peakConcurrency = Math.max(this.metrics.peakConcurrency, this.activeTasks);
      
      const batchStartTime = Date.now();
      const results = await this.processBatchInternal(batch, processor, batchIndex, options);
      
      const batchDuration = Date.now() - batchStartTime;
      Logger.debug(
        this.context,
        `Lote ${batchIndex} processado: ${batch.length} itens em ${batchDuration}ms`
      );
      
      return results;
      
    } finally {
      this.activeTasks--;
      this.semaphore.release();
    }
  }
  
  /**
   * Processamento interno do lote
   * @param {Array} batch - Lote a processar
   * @param {Function} processor - Função de processamento
   * @param {number} batchIndex - Índice do lote
   * @param {object} options - Opções
   * @returns {Promise<Array>} Resultados
   */
  async processBatchInternal(batch, processor, batchIndex, options) {
    const concurrentTasks = options.itemConcurrency || Math.min(batch.length, 3);
    const results = [];
    
    // Processa itens do lote em sub-grupos concorrentes
    for (let i = 0; i < batch.length; i += concurrentTasks) {
      const subBatch = batch.slice(i, i + concurrentTasks);
      
      const subBatchPromises = subBatch.map(async (item, subIndex) => {
        const itemIndex = i + subIndex;
        return await withErrorHandling(
          () => processor(item, itemIndex, batchIndex),
          {
            context: `${this.context}-item-${batchIndex}-${itemIndex}`,
            maxRetries: options.retries || 1,
            criticalOperation: false
          }
        );
      });
      
      const subBatchResults = await Promise.allSettled(subBatchPromises);
      
      // Coleta resultados bem-sucedidos
      for (const result of subBatchResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
          results.push(result.value);
        }
      }
      
      // Pausa entre sub-lotes se necessário
      if (i + concurrentTasks < batch.length && options.subBatchDelay) {
        await new Promise(resolve => setTimeout(resolve, options.subBatchDelay));
      }
    }
    
    return results;
  }
  
  /**
   * Cria lotes de itens
   * @param {Array} items - Itens a dividir
   * @param {number} batchSize - Tamanho do lote
   * @returns {Array<Array>} Lotes
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  /**
   * Atualiza métricas de performance
   * @param {number} itemCount - Número de itens processados
   * @param {number} duration - Duração em ms
   */
  updateMetrics(itemCount, duration) {
    if (!this.enableMetrics) return;
    
    this.metrics.totalProcessed += itemCount;
    this.metrics.totalTime += duration;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalProcessed;
  }
  
  /**
   * Obtém métricas de performance
   * @returns {object} Métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTasks: this.activeTasks,
      queueSize: this.taskQueue.length
    };
  }
  
  /**
   * Reseta métricas
   */
  resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      totalTime: 0,
      averageTime: 0,
      peakConcurrency: 0,
      errors: 0
    };
  }
}

/**
 * Semáforo para controle de concorrência
 */
class Semaphore {
  constructor(maxCount) {
    this.maxCount = maxCount;
    this.currentCount = 0;
    this.waitQueue = [];
  }
  
  async acquire() {
    if (this.currentCount < this.maxCount) {
      this.currentCount++;
      return;
    }
    
    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }
  
  release() {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      resolve();
    } else {
      this.currentCount--;
    }
  }
  
  getStats() {
    return {
      currentCount: this.currentCount,
      maxCount: this.maxCount,
      waitingCount: this.waitQueue.length
    };
  }
}

/**
 * Processador especializado para operações de abas
 */
export class TabParallelProcessor extends ParallelBatchProcessor {
  constructor(options = {}) {
    super({
      ...options,
      context: 'TabParallelProcessor',
      maxConcurrency: options.maxConcurrency || getConfig('MAX_TAB_CONCURRENCY') || 2, // Reduced from 4
      batchSize: options.batchSize || getConfig('TAB_BATCH_SIZE') || 8 // Reduced from 10
    });
  }
  
  /**
   * Obtém múltiplas abas em paralelo
   * @param {Array<number>} tabIds - IDs das abas
   * @returns {Promise<Array>} Abas válidas
   */
  async getTabsParallel(tabIds) {
    return this.processParallel(
      tabIds,
      async (tabId) => {
        try {
          return await browser.tabs.get(tabId);
        } catch (error) {
          // Aba não existe mais, retorna null
          return null;
        }
      },
      {
        itemConcurrency: 5,
        retries: 0 // Não retry para tabs que não existem
      }
    );
  }
  
  /**
   * Processa nomes de grupos em paralelo
   * @param {Array} tabs - Abas
   * @param {Function} nameProcessor - Função para obter nome do grupo
   * @returns {Promise<Map>} Mapa de tabId para groupName
   */
  async processGroupNamesParallel(tabs, nameProcessor) {
    const results = await this.processParallel(
      tabs,
      async (tab) => {
        const groupName = await nameProcessor(tab);
        return { tabId: tab.id, groupName };
      },
      {
        itemConcurrency: 3,
        subBatchDelay: 50,
        retries: 1
      }
    );
    
    const tabIdToGroupName = new Map();
    for (const result of results) {
      if (result && result.tabId && result.groupName) {
        tabIdToGroupName.set(result.tabId, result.groupName);
      }
    }
    
    return tabIdToGroupName;
  }
  
  /**
   * Executa operações de agrupamento em paralelo controlado
   * @param {Array} operations - Operações de agrupamento
   * @returns {Promise<Array>} Resultados das operações
   */
  async executeGroupOperationsParallel(operations) {
    // Separa operações por tipo para otimizar ordem de execução
    const addOperations = operations.filter(op => op.type === 'addToExisting');
    const createOperations = operations.filter(op => op.type === 'createNew');
    
    const results = [];
    
    // Processa adições em paralelo (mais seguras)
    if (addOperations.length > 0) {
      const addResults = await this.processParallel(
        addOperations,
        async (operation) => await this.executeGroupOperation(operation),
        {
          itemConcurrency: 2,
          subBatchDelay: 100
        }
      );
      results.push(...addResults);
    }
    
    // Processa criações sequencialmente para evitar conflitos
    for (const operation of createOperations) {
      try {
        const result = await this.executeGroupOperation(operation);
        if (result) results.push(result);
        
        // Pausa entre criações para evitar conflitos de API
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        Logger.warn(this.context, `Falha na criação de grupo: ${operation.groupName}`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Executa uma operação de agrupamento individual
   * @param {object} operation - Operação a executar
   * @returns {Promise<object>} Resultado da operação
   */
  async executeGroupOperation(operation) {
    return await withErrorHandling(async () => {
      switch (operation.type) {
        case 'addToExisting':
          await browser.tabs.group({
            groupId: operation.groupId,
            tabIds: operation.tabIds,
          });
          return { 
            success: true, 
            action: 'added_to_existing', 
            groupId: operation.groupId,
            tabCount: operation.tabIds.length
          };
          
        case 'createNew':
          // Registra intenção de grupo automático
          const { pendingAutomaticGroups } = await import("./app-state.js");
          pendingAutomaticGroups.set(operation.tabIds[0], {
            tabIds: operation.tabIds,
          });
          
          const newGroupId = await browser.tabs.group({
            createProperties: { windowId: operation.windowId },
            tabIds: operation.tabIds,
          });
          
          // Configura o grupo
          await browser.tabGroups.update(newGroupId, {
            title: operation.groupName,
            color: operation.color,
          });
          
          return { 
            success: true, 
            action: 'created_new', 
            groupId: newGroupId,
            groupName: operation.groupName,
            tabCount: operation.tabIds.length
          };
          
        default:
          throw new Error(`Tipo de operação desconhecido: ${operation.type}`);
      }
    }, {
      context: `${this.context}-groupOp-${operation.type}`,
      maxRetries: 2,
      retryDelay: 300,
      criticalOperation: false
    });
  }
}

/**
 * Processador especializado para dados de janelas
 */
export class WindowDataProcessor extends ParallelBatchProcessor {
  constructor(options = {}) {
    super({
      ...options,
      context: 'WindowDataProcessor',
      maxConcurrency: options.maxConcurrency || 2 // Menos concorrência para operações de janela
    });
  }
  
  /**
   * Obtém dados de múltiplas janelas em paralelo
   * @param {Array<number>} windowIds - IDs das janelas
   * @returns {Promise<Map>} Mapa de windowId para dados da janela
   */
  async getWindowDataParallel(windowIds) {
    const results = await this.processParallel(
      windowIds,
      async (windowId) => {
        const [allTabsInWindow, allGroupsInWindow] = await Promise.all([
          browser.tabs.query({ windowId }),
          browser.tabGroups.query({ windowId })
        ]);
        
        return {
          windowId,
          tabs: allTabsInWindow,
          groups: allGroupsInWindow
        };
      },
      {
        itemConcurrency: 1, // Uma janela por vez para evitar sobrecarga
        retries: 2
      }
    );
    
    const windowDataMap = new Map();
    for (const result of results) {
      if (result && result.windowId) {
        windowDataMap.set(result.windowId, result);
      }
    }
    
    return windowDataMap;
  }
}

// Instâncias globais otimizadas
export const globalTabParallelProcessor = new TabParallelProcessor();
export const globalWindowDataProcessor = new WindowDataProcessor();

Logger.debug("ParallelBatchProcessor", "Sistema de processamento paralelo avançado inicializado.");