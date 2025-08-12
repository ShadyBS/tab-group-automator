/**
 * @file initialization-cache.js
 * @description Sistema de cache de inicialização para otimizar startup time
 * Implementa cache inteligente com TTL, versionamento e validação
 */

import Logger from './logger.js';

/**
 * Sistema de cache de inicialização para otimizar performance de startup
 * Gerencia cache com TTL, versionamento e validação de integridade
 */
class InitializationCache {
  constructor() {
    this.CACHE_VERSION = '1.0.0';
    this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
    this.cacheKey = 'sw_init_cache';
    this.metricsKey = 'sw_init_metrics';
  }

  /**
   * Obtém dados de inicialização do cache
   * @returns {Promise<object|null>} - Dados cached ou null se inválido/expirado
   */
  async getCachedInitialization() {
    try {
      const cached = await browser.storage.local.get([this.cacheKey]);
      const cacheData = cached[this.cacheKey];
      
      if (!cacheData) {
        Logger.debug('InitializationCache', 'Nenhum cache de inicialização encontrado');
        return null;
      }
      
      // Verifica se o cache expirou
      if (this.isCacheExpired(cacheData)) {
        Logger.info('InitializationCache', 'Cache de inicialização expirado, limpando...');
        await this.clearCache();
        return null;
      }
      
      // Verifica versão do cache
      if (cacheData.version !== this.CACHE_VERSION) {
        Logger.info('InitializationCache', `Versão do cache incompatível (${cacheData.version} vs ${this.CACHE_VERSION}), limpando...`);
        await this.clearCache();
        return null;
      }
      
      // Valida integridade dos dados
      if (!this.validateCacheData(cacheData.data)) {
        Logger.warn('InitializationCache', 'Dados do cache corrompidos, limpando...');
        await this.clearCache();
        return null;
      }
      
      Logger.info('InitializationCache', 'Cache de inicialização válido encontrado');
      this.recordCacheHit();
      return cacheData.data;
    } catch (error) {
      Logger.error('InitializationCache', 'Erro ao obter cache de inicialização:', error);
      return null;
    }
  }

  /**
   * Salva dados de inicialização no cache
   * @param {object} data - Dados para cachear
   * @returns {Promise<boolean>} - True se salvou com sucesso
   */
  async setCachedInitialization(data) {
    try {
      // Valida dados antes de cachear
      if (!this.validateCacheData(data)) {
        Logger.error('InitializationCache', 'Dados inválidos para cache, não salvando');
        return false;
      }
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: data,
        checksum: this.calculateChecksum(data)
      };
      
      await browser.storage.local.set({
        [this.cacheKey]: cacheData
      });
      
      Logger.info('InitializationCache', 'Dados de inicialização salvos no cache');
      this.recordCacheSave();
      return true;
    } catch (error) {
      Logger.error('InitializationCache', 'Erro ao salvar cache de inicialização:', error);
      return false;
    }
  }

  /**
   * Verifica se o cache expirou
   * @param {object} cacheData - Dados do cache
   * @returns {boolean} - True se expirado
   */
  isCacheExpired(cacheData) {
    if (!cacheData.timestamp) return true;
    return (Date.now() - cacheData.timestamp) > this.CACHE_TTL;
  }

  /**
   * Valida integridade dos dados do cache
   * @param {object} data - Dados para validar
   * @returns {boolean} - True se válidos
   */
  validateCacheData(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Verifica estrutura básica esperada
    const requiredFields = ['settings', 'modules', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        Logger.debug('InitializationCache', `Campo obrigatório ausente: ${field}`);
        return false;
      }
    }
    
    // Valida settings
    if (!data.settings || typeof data.settings !== 'object') {
      Logger.debug('InitializationCache', 'Settings inválidas no cache');
      return false;
    }
    
    // Valida módulos
    if (!data.modules || typeof data.modules !== 'object') {
      Logger.debug('InitializationCache', 'Módulos inválidos no cache');
      return false;
    }
    
    return true;
  }

  /**
   * Calcula checksum simples dos dados
   * @param {object} data - Dados para calcular checksum
   * @returns {string} - Checksum
   */
  calculateChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Limpa o cache de inicialização
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      await browser.storage.local.remove([this.cacheKey]);
      Logger.info('InitializationCache', 'Cache de inicialização limpo');
    } catch (error) {
      Logger.error('InitializationCache', 'Erro ao limpar cache:', error);
    }
  }

  /**
   * Registra hit do cache para métricas
   */
  recordCacheHit() {
    this.updateMetrics('hits', 1);
  }

  /**
   * Registra save do cache para métricas
   */
  recordCacheSave() {
    this.updateMetrics('saves', 1);
  }

  /**
   * Atualiza métricas do cache
   * @param {string} metric - Nome da métrica
   * @param {number} increment - Valor para incrementar
   */
  async updateMetrics(metric, increment = 1) {
    try {
      const stored = await browser.storage.local.get([this.metricsKey]);
      const metrics = stored[this.metricsKey] || {
        hits: 0,
        saves: 0,
        misses: 0,
        errors: 0,
        lastReset: Date.now()
      };
      
      metrics[metric] = (metrics[metric] || 0) + increment;
      
      await browser.storage.local.set({
        [this.metricsKey]: metrics
      });
    } catch (error) {
      Logger.debug('InitializationCache', 'Erro ao atualizar métricas:', error);
    }
  }

  /**
   * Obtém métricas do cache
   * @returns {Promise<object>} - Métricas do cache
   */
  async getMetrics() {
    try {
      const stored = await browser.storage.local.get([this.metricsKey]);
      const metrics = stored[this.metricsKey] || {
        hits: 0,
        saves: 0,
        misses: 0,
        errors: 0,
        lastReset: Date.now()
      };
      
      // Calcula taxa de acerto
      const total = metrics.hits + metrics.misses;
      metrics.hitRate = total > 0 ? (metrics.hits / total) : 0;
      
      return metrics;
    } catch (error) {
      Logger.error('InitializationCache', 'Erro ao obter métricas:', error);
      return { hits: 0, saves: 0, misses: 0, errors: 0, hitRate: 0 };
    }
  }

  /**
   * Reseta métricas do cache
   * @returns {Promise<void>}
   */
  async resetMetrics() {
    try {
      const resetMetrics = {
        hits: 0,
        saves: 0,
        misses: 0,
        errors: 0,
        lastReset: Date.now()
      };
      
      await browser.storage.local.set({
        [this.metricsKey]: resetMetrics
      });
      
      Logger.info('InitializationCache', 'Métricas do cache resetadas');
    } catch (error) {
      Logger.error('InitializationCache', 'Erro ao resetar métricas:', error);
    }
  }

  /**
   * Força invalidação do cache (para testes ou atualizações)
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    await this.clearCache();
    await this.updateMetrics('misses', 1);
    Logger.info('InitializationCache', 'Cache invalidado manualmente');
  }

  /**
   * Obtém informações de status do cache
   * @returns {Promise<object>} - Status do cache
   */
  async getStatus() {
    try {
      const cached = await browser.storage.local.get([this.cacheKey]);
      const cacheData = cached[this.cacheKey];
      const metrics = await this.getMetrics();
      
      return {
        hasCache: !!cacheData,
        isValid: cacheData ? !this.isCacheExpired(cacheData) && cacheData.version === this.CACHE_VERSION : false,
        version: cacheData?.version || null,
        age: cacheData ? Date.now() - cacheData.timestamp : null,
        ttl: this.CACHE_TTL,
        metrics
      };
    } catch (error) {
      Logger.error('InitializationCache', 'Erro ao obter status:', error);
      return {
        hasCache: false,
        isValid: false,
        version: null,
        age: null,
        ttl: this.CACHE_TTL,
        metrics: { hits: 0, saves: 0, misses: 0, errors: 0, hitRate: 0 }
      };
    }
  }
}

// Instância global do cache de inicialização
const initializationCache = new InitializationCache();

export default initializationCache;
export { InitializationCache };