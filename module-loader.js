/**
 * @file module-loader.js
 * @description Sistema de carregamento dinâmico de módulos para otimização de performance
 * Implementa lazy loading com cache e prevenção de carregamentos duplicados
 */

import Logger from './logger.js';

/**
 * Sistema de carregamento dinâmico de módulos
 * Gerencia cache, evita carregamentos duplicados e fornece métricas de performance
 */
class ModuleLoader {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
    this.loadMetrics = new Map();
    this.startTime = performance.now();
  }

  /**
   * Carrega um módulo dinamicamente com cache e prevenção de duplicação
   * @param {string} moduleName - Nome do módulo a ser carregado
   * @returns {Promise<object>} - Módulo carregado
   */
  async loadModule(moduleName) {
    const startTime = performance.now();
    
    // Evitar carregamento duplicado
    if (this.loadedModules.has(moduleName)) {
      const cachedModule = this.loadedModules.get(moduleName);
      Logger.debug('ModuleLoader', `Módulo ${moduleName} retornado do cache`);
      return cachedModule;
    }

    // Evitar múltiplas requisições simultâneas
    if (this.loadingPromises.has(moduleName)) {
      Logger.debug('ModuleLoader', `Aguardando carregamento em progresso: ${moduleName}`);
      return this.loadingPromises.get(moduleName);
    }

    // Carregar módulo dinamicamente
    const loadPromise = this.dynamicImport(moduleName);
    this.loadingPromises.set(moduleName, loadPromise);

    try {
      const module = await loadPromise;
      this.loadedModules.set(moduleName, module);
      this.loadingPromises.delete(moduleName);
      
      // Registrar métricas
      const loadTime = performance.now() - startTime;
      this.recordLoadMetric(moduleName, loadTime, true);
      
      return module;
    } catch (error) {
      this.loadingPromises.delete(moduleName);
      this.recordLoadMetric(moduleName, performance.now() - startTime, false, error);
      throw error;
    }
  }

  /**
   * Importa módulo dinamicamente com tratamento de erro
   * @param {string} moduleName - Nome do módulo
   * @returns {Promise<object>} - Módulo importado
   */
  async dynamicImport(moduleName) {
    const startTime = performance.now();
    
    try {
      const module = await import(`./${moduleName}`);
      const loadTime = performance.now() - startTime;
      
      Logger.info('ModuleLoader', `${moduleName} carregado em ${loadTime.toFixed(2)}ms`);
      return module;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      Logger.error('ModuleLoader', `Falha ao carregar ${moduleName} após ${loadTime.toFixed(2)}ms:`, error);
      throw new Error(`Falha ao carregar módulo ${moduleName}: ${error.message}`);
    }
  }

  /**
   * Pré-carrega múltiplos módulos em paralelo
   * @param {string[]} moduleNames - Lista de módulos para pré-carregar
   * @returns {Promise<object>} - Resultado do pré-carregamento
   */
  async preloadModules(moduleNames) {
    const startTime = performance.now();
    Logger.info('ModuleLoader', `Pré-carregando ${moduleNames.length} módulos:`, moduleNames);
    
    const preloadPromises = moduleNames.map(async (moduleName) => {
      try {
        await this.loadModule(moduleName);
        return { module: moduleName, success: true };
      } catch (error) {
        Logger.warn('ModuleLoader', `Falha no pré-carregamento de ${moduleName}:`, error);
        return { module: moduleName, success: false, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(preloadPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    const totalTime = performance.now() - startTime;
    Logger.info('ModuleLoader', `Pré-carregamento concluído em ${totalTime.toFixed(2)}ms: ${successful} sucessos, ${failed} falhas`);
    
    return {
      total: moduleNames.length,
      successful,
      failed,
      loadTime: totalTime,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };
  }

  /**
   * Registra métricas de carregamento de módulo
   * @param {string} moduleName - Nome do módulo
   * @param {number} loadTime - Tempo de carregamento em ms
   * @param {boolean} success - Se o carregamento foi bem-sucedido
   * @param {Error} [error] - Erro se houve falha
   */
  recordLoadMetric(moduleName, loadTime, success, error = null) {
    const metric = {
      moduleName,
      loadTime,
      success,
      timestamp: Date.now(),
      error: error ? error.message : null
    };
    
    this.loadMetrics.set(moduleName, metric);
    
    // Log de performance se exceder threshold
    if (loadTime > 200) { // 200ms threshold
      Logger.warn('ModuleLoader', `Carregamento lento detectado: ${moduleName} levou ${loadTime.toFixed(2)}ms`);
    }
  }

  /**
   * Obtém estatísticas de performance do carregador
   * @returns {object} - Estatísticas detalhadas
   */
  getPerformanceStats() {
    const stats = {
      totalModulesLoaded: this.loadedModules.size,
      totalLoadAttempts: this.loadMetrics.size,
      currentlyLoading: this.loadingPromises.size,
      cacheHitRate: 0,
      averageLoadTime: 0,
      slowestModule: null,
      fastestModule: null,
      failedLoads: [],
      uptime: performance.now() - this.startTime
    };
    
    if (this.loadMetrics.size > 0) {
      const metrics = Array.from(this.loadMetrics.values());
      const successfulLoads = metrics.filter(m => m.success);
      const failedLoads = metrics.filter(m => !m.success);
      
      // Taxa de acerto do cache (aproximada baseada em sucessos vs tentativas)
      stats.cacheHitRate = successfulLoads.length / metrics.length;
      
      // Tempo médio de carregamento
      if (successfulLoads.length > 0) {
        stats.averageLoadTime = successfulLoads.reduce((sum, m) => sum + m.loadTime, 0) / successfulLoads.length;
        
        // Módulo mais lento e mais rápido
        const sortedByTime = successfulLoads.sort((a, b) => a.loadTime - b.loadTime);
        stats.fastestModule = { name: sortedByTime[0].moduleName, time: sortedByTime[0].loadTime };
        stats.slowestModule = { name: sortedByTime[sortedByTime.length - 1].moduleName, time: sortedByTime[sortedByTime.length - 1].loadTime };
      }
      
      // Carregamentos falhados
      stats.failedLoads = failedLoads.map(m => ({ name: m.moduleName, error: m.error }));
    }
    
    return stats;
  }

  /**
   * Limpa cache de módulos (para testes ou recuperação de erro)
   * @param {string[]} [moduleNames] - Módulos específicos para limpar, ou todos se não especificado
   */
  clearCache(moduleNames = null) {
    if (moduleNames) {
      moduleNames.forEach(name => {
        this.loadedModules.delete(name);
        this.loadMetrics.delete(name);
      });
      Logger.info('ModuleLoader', `Cache limpo para módulos: ${moduleNames.join(', ')}`);
    } else {
      const clearedCount = this.loadedModules.size;
      this.loadedModules.clear();
      this.loadMetrics.clear();
      Logger.info('ModuleLoader', `Cache completo limpo: ${clearedCount} módulos removidos`);
    }
  }

  /**
   * Verifica se um módulo está carregado
   * @param {string} moduleName - Nome do módulo
   * @returns {boolean} - True se o módulo está carregado
   */
  isModuleLoaded(moduleName) {
    return this.loadedModules.has(moduleName);
  }

  /**
   * Verifica se um módulo está sendo carregado
   * @param {string} moduleName - Nome do módulo
   * @returns {boolean} - True se o módulo está sendo carregado
   */
  isModuleLoading(moduleName) {
    return this.loadingPromises.has(moduleName);
  }

  /**
   * Lista todos os módulos carregados
   * @returns {string[]} - Array com nomes dos módulos carregados
   */
  getLoadedModules() {
    return Array.from(this.loadedModules.keys());
  }
}

// Instância global do carregador de módulos
const moduleLoader = new ModuleLoader();

export default moduleLoader;
export { ModuleLoader };