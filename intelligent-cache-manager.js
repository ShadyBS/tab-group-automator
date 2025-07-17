/**
 * @file intelligent-cache-manager.js
 * @description Sistema avançado de cache com invalidação, versionamento e TTL para nomes inteligentes.
 */

import Logger from "./logger.js";
import { withErrorHandling } from "./adaptive-error-handler.js";
import { getConfig } from "./performance-config.js";

/**
 * Estrutura de entrada do cache inteligente
 * @typedef {Object} CacheEntry
 * @property {string} value - Valor armazenado
 * @property {number} timestamp - Timestamp de criação
 * @property {number} lastAccessed - Timestamp do último acesso
 * @property {number} accessCount - Número de acessos
 * @property {number} ttl - Time-to-live em ms
 * @property {string} version - Versão da entrada
 * @property {string} domainHash - Hash do domínio para invalidação
 * @property {Object} metadata - Metadados adicionais
 */

/**
 * Classe para gerenciamento inteligente de cache com TTL e invalidação
 */
export class IntelligentCacheManager {
  constructor(options = {}) {
    this.cacheName = options.cacheName || 'smartNameCache';
    this.maxSize = options.maxSize || getConfig('MAX_CACHE_SIZE') || 2000;
    this.defaultTTL = options.defaultTTL || getConfig('CACHE_DEFAULT_TTL') || 24 * 60 * 60 * 1000; // 24h
    this.cleanupInterval = options.cleanupInterval || getConfig('CACHE_CLEANUP_INTERVAL') || 5 * 60 * 1000; // 5min
    this.version = options.version || '1.0.0';
    
    // Cache em memória
    this.cache = new Map();
    
    // Configurações de invalidação
    this.invalidationTriggers = new Set();
    this.domainChangeTracking = new Map();
    
    // Estatísticas
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
      cleanups: 0,
      totalAccesses: 0,
      lastCleanup: Date.now()
    };
    
    // Timer de limpeza automática
    this.cleanupTimer = null;
    this.saveTimer = null;
    
    // Configurações de persistência
    this.persistenceEnabled = options.persistenceEnabled !== false;
    this.saveDelay = options.saveDelay || getConfig('CACHE_SAVE_DELAY') || 2000;
    
    this.startAutomaticCleanup();
  }
  
  /**
   * Obtém uma entrada do cache
   * @param {string} key - Chave da entrada
   * @returns {string|null} - Valor ou null se não encontrado/expirado
   */
  get(key) {
    this.stats.totalAccesses++;
    
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Verifica TTL
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      Logger.debug('IntelligentCache', `Entrada expirada removida: ${key}`);
      return null;
    }
    
    // Atualiza estatísticas de acesso
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.stats.hits++;
    
    Logger.debug('IntelligentCache', `Cache hit para: ${key}`);
    return entry.value;
  }
  
  /**
   * Define uma entrada no cache
   * @param {string} key - Chave da entrada
   * @param {string} value - Valor a armazenar
   * @param {Object} options - Opções adicionais
   */
  set(key, value, options = {}) {
    const now = Date.now();
    const ttl = options.ttl || this.defaultTTL;
    const metadata = options.metadata || {};
    
    // Cria hash do domínio para invalidação
    const domainHash = this.createDomainHash(key);
    
    const entry = {
      value,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      ttl,
      version: this.version,
      domainHash,
      metadata: {
        ...metadata,
        source: options.source || 'unknown',
        confidence: options.confidence || 1.0
      }
    };
    
    // Verifica se precisa fazer limpeza por tamanho
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }
    
    this.cache.set(key, entry);
    
    // Agenda salvamento
    this.scheduleSave();
    
    Logger.debug('IntelligentCache', `Entrada adicionada: ${key} (TTL: ${ttl}ms)`);
  }
  
  /**
   * Remove uma entrada do cache
   * @param {string} key - Chave a remover
   * @returns {boolean} - True se removido
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.scheduleSave();
      Logger.debug('IntelligentCache', `Entrada removida: ${key}`);
    }
    return deleted;
  }
  
  /**
   * Verifica se uma entrada está expirada
   * @param {CacheEntry} entry - Entrada a verificar
   * @returns {boolean} - True se expirada
   */
  isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl;
  }
  
  /**
   * Cria hash do domínio para invalidação
   * @param {string} key - Chave (hostname)
   * @returns {string} - Hash do domínio
   */
  createDomainHash(key) {
    // Extrai domínio principal para agrupamento
    const parts = key.split('.');
    const domain = parts.length > 2 ? parts.slice(-2).join('.') : key;
    return domain.toLowerCase();
  }
  
  /**
   * Remove entradas menos recentemente usadas
   */
  evictLeastRecentlyUsed() {
    if (this.cache.size === 0) return;
    
    // Encontra entrada com menor lastAccessed
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      Logger.debug('IntelligentCache', `LRU eviction: ${oldestKey}`);
    }
  }
  
  /**
   * Limpa entradas expiradas
   * @returns {number} - Número de entradas removidas
   */
  cleanupExpired() {
    let removedCount = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.stats.evictions += removedCount;
      this.stats.cleanups++;
      this.stats.lastCleanup = now;
      Logger.debug('IntelligentCache', `Limpeza: ${removedCount} entradas expiradas removidas`);
    }
    
    return removedCount;
  }
  
  /**
   * Invalida entradas baseado em critérios
   * @param {Object} criteria - Critérios de invalidação
   * @returns {number} - Número de entradas invalidadas
   */
  invalidate(criteria = {}) {
    let invalidatedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      let shouldInvalidate = false;
      
      // Invalidação por domínio
      if (criteria.domain && entry.domainHash === criteria.domain.toLowerCase()) {
        shouldInvalidate = true;
      }
      
      // Invalidação por versão
      if (criteria.version && entry.version !== criteria.version) {
        shouldInvalidate = true;
      }
      
      // Invalidação por idade
      if (criteria.maxAge && (Date.now() - entry.timestamp) > criteria.maxAge) {
        shouldInvalidate = true;
      }
      
      // Invalidação por padrão de chave
      if (criteria.keyPattern && new RegExp(criteria.keyPattern).test(key)) {
        shouldInvalidate = true;
      }
      
      // Invalidação por metadados
      if (criteria.metadata) {
        for (const [metaKey, metaValue] of Object.entries(criteria.metadata)) {
          if (entry.metadata[metaKey] === metaValue) {
            shouldInvalidate = true;
            break;
          }
        }
      }
      
      if (shouldInvalidate) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
      this.stats.invalidations += invalidatedCount;
      this.scheduleSave();
      Logger.info('IntelligentCache', `Invalidação: ${invalidatedCount} entradas removidas`, criteria);
    }
    
    return invalidatedCount;
  }
  
  /**
   * Invalida entradas relacionadas a mudanças de domínio
   * @param {string} hostname - Hostname que mudou
   * @param {string} changeType - Tipo de mudança
   */
  invalidateByDomainChange(hostname, changeType = 'content') {
    const domainHash = this.createDomainHash(hostname);
    
    // Registra mudança para análise de padrões
    if (!this.domainChangeTracking.has(domainHash)) {
      this.domainChangeTracking.set(domainHash, []);
    }
    
    this.domainChangeTracking.get(domainHash).push({
      timestamp: Date.now(),
      changeType,
      hostname
    });
    
    // Mantém apenas mudanças recentes
    const recentChanges = this.domainChangeTracking.get(domainHash)
      .filter(change => Date.now() - change.timestamp < 60 * 60 * 1000); // 1 hora
    
    this.domainChangeTracking.set(domainHash, recentChanges);
    
    // Invalida se há muitas mudanças recentes
    if (recentChanges.length >= 3) {
      const invalidated = this.invalidate({ domain: domainHash });
      Logger.info('IntelligentCache', `Invalidação por mudanças frequentes em ${domainHash}: ${invalidated} entradas`);
    }
  }
  
  /**
   * Atualiza versão do cache (invalida entradas antigas)
   * @param {string} newVersion - Nova versão
   */
  updateVersion(newVersion) {
    const oldVersion = this.version;
    this.version = newVersion;
    
    const invalidated = this.invalidate({ version: oldVersion });
    Logger.info('IntelligentCache', `Versão atualizada de ${oldVersion} para ${newVersion}. ${invalidated} entradas invalidadas`);
  }
  
  /**
   * Inicia limpeza automática
   */
  startAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
      this.optimizeCache();
    }, this.cleanupInterval);
    
    Logger.debug('IntelligentCache', `Limpeza automática iniciada (intervalo: ${this.cleanupInterval}ms)`);
  }
  
  /**
   * Para limpeza automática
   */
  stopAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      Logger.debug('IntelligentCache', 'Limpeza automática parada');
    }
  }
  
  /**
   * Otimiza o cache baseado em padrões de uso
   */
  optimizeCache() {
    const now = Date.now();
    const optimizationThreshold = 7 * 24 * 60 * 60 * 1000; // 7 dias
    
    // Remove entradas não acessadas há muito tempo
    let optimizedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > optimizationThreshold && entry.accessCount < 2) {
        this.cache.delete(key);
        optimizedCount++;
      }
    }
    
    if (optimizedCount > 0) {
      this.stats.evictions += optimizedCount;
      Logger.debug('IntelligentCache', `Otimização: ${optimizedCount} entradas pouco usadas removidas`);
    }
  }
  
  /**
   * Agenda salvamento do cache
   */
  scheduleSave() {
    if (!this.persistenceEnabled) return;
    
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(async () => {
      await this.save();
      this.saveTimer = null;
    }, this.saveDelay);
  }
  
  /**
   * Salva cache no armazenamento
   */
  async save() {
    if (!this.persistenceEnabled) return;
    
    return await withErrorHandling(async () => {
      const cacheData = {
        version: this.version,
        timestamp: Date.now(),
        entries: Object.fromEntries(this.cache),
        stats: this.stats
      };
      
      await browser.storage.local.set({
        [this.cacheName]: cacheData
      });
      
      Logger.debug('IntelligentCache', `Cache salvo: ${this.cache.size} entradas`);
      return { success: true, size: this.cache.size };
      
    }, {
      context: 'intelligent-cache-save',
      maxRetries: 3,
      criticalOperation: false,
      fallback: () => {
        Logger.warn('IntelligentCache', 'Falha ao salvar cache - continuando em memória');
        return { success: false, fallback: true };
      }
    });
  }
  
  /**
   * Carrega cache do armazenamento
   */
  async load() {
    if (!this.persistenceEnabled) return;
    
    return await withErrorHandling(async () => {
      const data = await browser.storage.local.get(this.cacheName);
      const cacheData = data[this.cacheName];
      
      if (!cacheData) {
        Logger.debug('IntelligentCache', 'Nenhum cache encontrado no armazenamento');
        return { success: true, loaded: 0 };
      }
      
      // Verifica compatibilidade de versão
      if (cacheData.version !== this.version) {
        Logger.info('IntelligentCache', `Versão do cache incompatível (${cacheData.version} vs ${this.version}). Iniciando com cache vazio.`);
        return { success: true, loaded: 0, versionMismatch: true };
      }
      
      // Carrega entradas válidas
      let loadedCount = 0;
      const now = Date.now();
      
      for (const [key, entry] of Object.entries(cacheData.entries || {})) {
        // Verifica se entrada não está expirada
        if (!this.isExpired(entry)) {
          this.cache.set(key, entry);
          loadedCount++;
        }
      }
      
      // Carrega estatísticas
      if (cacheData.stats) {
        this.stats = { ...this.stats, ...cacheData.stats };
      }
      
      Logger.info('IntelligentCache', `Cache carregado: ${loadedCount} entradas válidas de ${Object.keys(cacheData.entries || {}).length} totais`);
      return { success: true, loaded: loadedCount };
      
    }, {
      context: 'intelligent-cache-load',
      maxRetries: 2,
      criticalOperation: false,
      fallback: () => {
        Logger.warn('IntelligentCache', 'Falha ao carregar cache - iniciando com cache vazio');
        return { success: false, fallback: true, loaded: 0 };
      }
    });
  }
  
  /**
   * Limpa todo o cache
   */
  clear() {
    this.cache.clear();
    this.domainChangeTracking.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
      cleanups: 0,
      totalAccesses: 0,
      lastCleanup: Date.now()
    };
    
    if (this.persistenceEnabled) {
      browser.storage.local.remove(this.cacheName);
    }
    
    Logger.info('IntelligentCache', 'Cache completamente limpo');
  }
  
  /**
   * Obtém estatísticas detalhadas do cache
   * @returns {Object} - Estatísticas completas
   */
  getDetailedStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    const hitRate = this.stats.totalAccesses > 0 ? 
      (this.stats.hits / this.stats.totalAccesses) * 100 : 0;
    
    const avgAge = entries.length > 0 ? 
      entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length : 0;
    
    const avgAccessCount = entries.length > 0 ? 
      entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: JSON.stringify(Object.fromEntries(this.cache)).length,
      avgAge: Math.round(avgAge),
      avgAccessCount: Math.round(avgAccessCount * 100) / 100,
      version: this.version,
      domainChanges: this.domainChangeTracking.size,
      timestamp: now
    };
  }
  
  /**
   * Obtém informações sobre uma entrada específica
   * @param {string} key - Chave da entrada
   * @returns {Object|null} - Informações da entrada
   */
  getEntryInfo(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    return {
      key,
      value: entry.value,
      age: now - entry.timestamp,
      lastAccessed: now - entry.lastAccessed,
      accessCount: entry.accessCount,
      ttl: entry.ttl,
      timeToExpiry: entry.ttl - (now - entry.timestamp),
      version: entry.version,
      domainHash: entry.domainHash,
      metadata: entry.metadata,
      isExpired: this.isExpired(entry)
    };
  }
  
  /**
   * Exporta cache para análise
   * @returns {Object} - Dados do cache para exportação
   */
  export() {
    return {
      version: this.version,
      timestamp: Date.now(),
      config: {
        maxSize: this.maxSize,
        defaultTTL: this.defaultTTL,
        cleanupInterval: this.cleanupInterval
      },
      stats: this.getDetailedStats(),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...this.getEntryInfo(key)
      })),
      domainChanges: Object.fromEntries(this.domainChangeTracking)
    };
  }
  
  /**
   * Destrói o cache e limpa recursos
   */
  destroy() {
    this.stopAutomaticCleanup();
    
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    
    this.clear();
    Logger.debug('IntelligentCache', 'Cache destruído');
  }
}

// Instância global do cache inteligente
export const globalIntelligentCache = new IntelligentCacheManager({
  cacheName: 'intelligentSmartNameCache',
  version: '1.0.0'
});

// Funções de compatibilidade com o sistema anterior
export function getSmartNameFromCache(hostname) {
  return globalIntelligentCache.get(hostname);
}

export function setSmartNameInCache(hostname, name, options = {}) {
  globalIntelligentCache.set(hostname, name, options);
}

export function invalidateSmartNameCache(criteria) {
  return globalIntelligentCache.invalidate(criteria);
}

export function clearSmartNameCache() {
  globalIntelligentCache.clear();
}

export function getSmartNameCacheStats() {
  return globalIntelligentCache.getDetailedStats();
}

// Inicialização automática
globalIntelligentCache.load().then(() => {
  Logger.info('IntelligentCache', 'Sistema de cache inteligente inicializado');
});

Logger.debug("IntelligentCacheManager", "Sistema de cache inteligente com TTL e invalidação inicializado.");