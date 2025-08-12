/**
 * @file worker-manager.js
 * @description Gerenciador de Web Workers para operações pesadas
 * Implementa pool de workers, timeout, retry e métricas de performance
 */

import Logger from './logger.js';

/**
 * Gerenciador de Web Workers para operações pesadas
 * Fornece interface assíncrona com timeout, retry e pool de workers
 */
class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.taskIdCounter = 0;
    this.maxWorkers = 2; // Limite de workers simultâneos
    this.defaultTimeout = 10000; // 10 segundos
    this.retryAttempts = 2;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      timeoutTasks: 0,
      averageTime: 0,
      totalTime: 0,
    };
  }

  /**
   * Executa uma tarefa pesada no worker
   * @param {string} type - Tipo da tarefa
   * @param {object} data - Dados para processar
   * @param {object} options - Opções da tarefa
   * @returns {Promise<object>} - Resultado da tarefa
   */
  async executeHeavyTask(type, data, options = {}) {
    const taskId = ++this.taskIdCounter;
    const timeout = options.timeout || this.defaultTimeout;
    const retries =
      options.retries !== undefined ? options.retries : this.retryAttempts;

    Logger.debug('WorkerManager', `Executando tarefa ${taskId} tipo ${type}`);

    this.metrics.totalTasks++;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.executeTaskWithTimeout(
          taskId,
          type,
          data,
          timeout
        );

        this.metrics.completedTasks++;
        this.updateAverageTime(result.processingTime);

        Logger.debug(
          'WorkerManager',
          `Tarefa ${taskId} concluída em ${result.processingTime.toFixed(2)}ms`
        );
        return result.result;
      } catch (error) {
        Logger.warn(
          'WorkerManager',
          `Tentativa ${attempt + 1} da tarefa ${taskId} falhou:`,
          error
        );

        if (attempt === retries) {
          this.metrics.failedTasks++;
          if (error.message.includes('timeout')) {
            this.metrics.timeoutTasks++;
          }
          throw error;
        }

        // Delay antes da próxima tentativa
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1))
        );
      }
    }
  }

  /**
   * Executa tarefa com timeout
   * @param {number} taskId - ID da tarefa
   * @param {string} type - Tipo da tarefa
   * @param {object} data - Dados para processar
   * @param {number} timeout - Timeout em ms
   * @returns {Promise<object>} - Resultado da tarefa
   */
  async executeTaskWithTimeout(taskId, type, data, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.cleanupTask(taskId);
        reject(new Error(`Timeout da tarefa ${taskId} após ${timeout}ms`));
      }, timeout);

      this.executeTaskInternal(taskId, type, data)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execução interna da tarefa
   * @param {number} taskId - ID da tarefa
   * @param {string} type - Tipo da tarefa
   * @param {object} data - Dados para processar
   * @returns {Promise<object>} - Resultado da tarefa
   */
  async executeTaskInternal(taskId, type, data) {
    const worker = await this.getAvailableWorker();
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      // Registra tarefa ativa
      this.activeTasks.set(taskId, {
        worker,
        startTime,
        type,
        resolve,
        reject,
      });

      // Configura listener para esta tarefa
      const messageHandler = (event) => {
        const {
          taskId: responseTaskId,
          success,
          result,
          error,
          processingTime,
        } = event.data;

        if (responseTaskId === taskId) {
          worker.removeEventListener('message', messageHandler);
          this.activeTasks.delete(taskId);
          this.releaseWorker(worker);

          if (success) {
            resolve({ result, processingTime });
          } else {
            reject(new Error(error));
          }
        }
      };

      worker.addEventListener('message', messageHandler);

      // Envia tarefa para o worker
      worker.postMessage({ taskId, type, data });
    });
  }

  /**
   * Obtém worker disponível ou cria novo se necessário
   * @returns {Promise<Worker>} - Worker disponível
   */
  async getAvailableWorker() {
    // Procura worker livre
    for (const [, workerInfo] of this.workers.entries()) {
      if (!workerInfo.busy) {
        workerInfo.busy = true;
        workerInfo.lastUsed = Date.now();
        return workerInfo.worker;
      }
    }

    // Cria novo worker se não atingiu o limite
    if (this.workers.size < this.maxWorkers) {
      return this.createNewWorker();
    }

    // Aguarda worker ficar disponível
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const [, workerInfo] of this.workers.entries()) {
          if (!workerInfo.busy) {
            clearInterval(checkInterval);
            workerInfo.busy = true;
            workerInfo.lastUsed = Date.now();
            resolve(workerInfo.worker);
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Cria novo worker
   * @returns {Worker} - Novo worker
   */
  createNewWorker() {
    try {
      const worker = new Worker('./performance-worker.js');
      const workerId = `worker_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Configura handlers de erro
      worker.addEventListener('error', (error) => {
        Logger.error('WorkerManager', `Erro no worker ${workerId}:`, error);
        this.handleWorkerError(workerId, error);
      });

      worker.addEventListener('messageerror', (error) => {
        Logger.error(
          'WorkerManager',
          `Erro de mensagem no worker ${workerId}:`,
          error
        );
        this.handleWorkerError(workerId, error);
      });

      // Registra worker
      this.workers.set(workerId, {
        worker,
        busy: true,
        created: Date.now(),
        lastUsed: Date.now(),
        tasksCompleted: 0,
        errors: 0,
      });

      Logger.info(
        'WorkerManager',
        `Worker ${workerId} criado. Total: ${this.workers.size}`
      );
      return worker;
    } catch (error) {
      Logger.error('WorkerManager', 'Erro ao criar worker:', error);
      throw new Error('Falha ao criar worker para processamento pesado');
    }
  }

  /**
   * Libera worker para reuso
   * @param {Worker} worker - Worker para liberar
   */
  releaseWorker(worker) {
    for (const [workerId, workerInfo] of this.workers.entries()) {
      if (workerInfo.worker === worker) {
        workerInfo.busy = false;
        workerInfo.tasksCompleted++;
        Logger.debug('WorkerManager', `Worker ${workerId} liberado`);
        break;
      }
    }
  }

  /**
   * Trata erros do worker
   * @param {string} workerId - ID do worker
   * @param {Error} error - Erro ocorrido
   */
  // eslint-disable-next-line no-unused-vars -- error is required by event signature for future-proofing
  handleWorkerError(workerId, error) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.errors++;

      // Remove worker se muitos erros
      if (workerInfo.errors > 3) {
        Logger.warn(
          'WorkerManager',
          `Removendo worker ${workerId} devido a muitos erros`
        );
        this.removeWorker(workerId);
      }
    }
  }

  /**
   * Remove worker
   * @param {string} workerId - ID do worker
   */
  removeWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      try {
        workerInfo.worker.terminate();
      } catch (error) {
        Logger.debug(
          'WorkerManager',
          `Erro ao terminar worker ${workerId}:`,
          error
        );
      }

      this.workers.delete(workerId);
      Logger.info(
        'WorkerManager',
        `Worker ${workerId} removido. Total: ${this.workers.size}`
      );
    }
  }

  /**
   * Limpa tarefa ativa
   * @param {number} taskId - ID da tarefa
   */
  cleanupTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      this.releaseWorker(task.worker);
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Atualiza tempo médio de processamento
   * @param {number} processingTime - Tempo de processamento
   */
  updateAverageTime(processingTime) {
    this.metrics.totalTime += processingTime;
    this.metrics.averageTime =
      this.metrics.totalTime / this.metrics.completedTasks;
  }

  /**
   * Obtém métricas de performance
   * @returns {object} - Métricas detalhadas
   */
  getPerformanceMetrics() {
    const workerStats = Array.from(this.workers.entries()).map(
      ([id, info]) => ({
        id,
        busy: info.busy,
        tasksCompleted: info.tasksCompleted,
        errors: info.errors,
        uptime: Date.now() - info.created,
        lastUsed: Date.now() - info.lastUsed,
      })
    );

    return {
      ...this.metrics,
      successRate:
        this.metrics.totalTasks > 0
          ? this.metrics.completedTasks / this.metrics.totalTasks
          : 0,
      timeoutRate:
        this.metrics.totalTasks > 0
          ? this.metrics.timeoutTasks / this.metrics.totalTasks
          : 0,
      activeWorkers: this.workers.size,
      activeTasks: this.activeTasks.size,
      workerStats,
    };
  }

  /**
   * Limpa workers inativos
   * @param {number} maxIdleTime - Tempo máximo inativo em ms
   */
  cleanupIdleWorkers(maxIdleTime = 5 * 60 * 1000) {
    // 5 minutos
    const now = Date.now();
    const workersToRemove = [];

    for (const [workerId, workerInfo] of this.workers.entries()) {
      if (!workerInfo.busy && now - workerInfo.lastUsed > maxIdleTime) {
        workersToRemove.push(workerId);
      }
    }

    workersToRemove.forEach((workerId) => {
      Logger.debug('WorkerManager', `Removendo worker inativo: ${workerId}`);
      this.removeWorker(workerId);
    });

    return workersToRemove.length;
  }

  /**
   * Termina todos os workers
   */
  terminateAllWorkers() {
    Logger.info('WorkerManager', `Terminando ${this.workers.size} workers...`);

    for (const [workerId, workerInfo] of this.workers.entries()) {
      try {
        workerInfo.worker.terminate();
      } catch (error) {
        Logger.debug(
          'WorkerManager',
          `Erro ao terminar worker ${workerId}:`,
          error
        );
      }
    }

    this.workers.clear();
    this.activeTasks.clear();

    Logger.info('WorkerManager', 'Todos os workers terminados');
  }

  /**
   * Obtém status atual do gerenciador
   * @returns {object} - Status detalhado
   */
  getStatus() {
    return {
      totalWorkers: this.workers.size,
      busyWorkers: Array.from(this.workers.values()).filter((w) => w.busy)
        .length,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      metrics: this.getPerformanceMetrics(),
    };
  }

  /**
   * Reseta métricas
   */
  resetMetrics() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      timeoutTasks: 0,
      averageTime: 0,
      totalTime: 0,
    };

    Logger.info('WorkerManager', 'Métricas resetadas');
  }
}

// Instância global do gerenciador de workers
const workerManager = new WorkerManager();

// Cleanup automático de workers inativos a cada 10 minutos
setInterval(() => {
  const cleaned = workerManager.cleanupIdleWorkers();
  if (cleaned > 0) {
    Logger.info('WorkerManager', `${cleaned} workers inativos removidos`);
  }
}, 10 * 60 * 1000);

// Cleanup na saída
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    workerManager.terminateAllWorkers();
  });
}

export default workerManager;
export { WorkerManager };
