/**
 * @file intelligent-cache-manager.js
 * @description Sistema avançado de cache com invalidação, versionamento e TTL para nomes inteligentes.
 */

import Logger from './logger.js';
import { withErrorHandling } from './adaptive-error-handler.js';
import { getConfig } from './performance-config.js';

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
 * Classe para gerenciamento inteligente de cache com TTL, versionamento,
 * invalidação automática e estratégias de otimização.
 */
export class IntelligentCacheManager {
  constructor(options = {}) {
    this.cacheName = options.cacheName || 'smartNameCache';
    this.maxSize = options.maxSize || getConfig('MAX_CACHE_SIZE') || 2000;
    this.defaultTTL =
      options.defaultTTL ||
      getConfig('CACHE_DEFAULT_TTL') ||
      24 * 60 * 60 * 1000; // 24h
    this.cleanupInterval =
      options.cleanupInterval ||
      getConfig('CACHE_CLEANUP_INTERVAL') ||
      5 * 60 * 1000; // 5min
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
      lastCleanup: Date.now(),
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
   * Obtém um valor do cache. Retorna `null` se a chave não existir ou se a entrada estiver expirada.
   * @param {string} key - A chave da entrada a ser recuperada.
   * @returns {string|null} O valor armazenado ou `null`.
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
   * Adiciona ou atualiza uma entrada no cache.
   * @param {string} key - A chave da entrada.
   * @param {string} value - O valor a ser armazenado.
   * @param {object} [options={}] - Opções para a entrada de cache (ex: `ttl`, `metadata`).
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
        confidence: options.confidence || 1.0,
      },
    };

    // Verifica se precisa fazer limpeza por tamanho
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);

    // Agenda salvamento
    this.scheduleSave();

    Logger.debug(
      'IntelligentCache',
      `Entrada adicionada: ${key} (TTL: ${ttl}ms)`
    );
  }

  /**
   * Remove uma entrada do cache.
   * @param {string} key - A chave da entrada a ser removida.
   * @returns {boolean} `true` se a entrada foi removida com sucesso, `false` caso contrário.
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
   * Verifica se uma entrada de cache expirou com base no seu TTL.
   * @param {CacheEntry} entry - A entrada de cache a ser verificada.
   * @returns {boolean} `true` se a entrada estiver expirada, `false` caso contrário.
   */
  isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Cria um "hash" simplificado do domínio principal a partir de um hostname para agrupar chaves relacionadas.
   * @param {string} key - A chave (hostname) a ser processada.
   * @returns {string} O domínio principal em minúsculas.
   */
  createDomainHash(key) {
    // Extrai domínio principal para agrupamento
    const parts = key.split('.');
    const domain = parts.length > 2 ? parts.slice(-2).join('.') : key;
    return domain.toLowerCase();
  }

  /**
   * Remove a entrada menos recentemente usada (LRU) para liberar espaço quando o cache está cheio.
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
   * Executa uma varredura no cache e remove todas as entradas que expiraram.
   * @returns {number} O número de entradas que foram removidas.
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
      Logger.debug(
        'IntelligentCache',
        `Limpeza: ${removedCount} entradas expiradas removidas`
      );
    }

    return removedCount;
  }

  /**
   * Invalida (remove) entradas do cache que correspondem a um conjunto de critérios.
   * @param {object} [criteria={}] - Os critérios para invalidação (ex: `domain`, `version`, `maxAge`).
   * @returns {number} O número de entradas que foram invalidadas.
   */
  invalidate(criteria = {}) {
    let invalidatedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      let shouldInvalidate = false;

      // Invalidação por domínio
      if (
        criteria.domain &&
        entry.domainHash === criteria.domain.toLowerCase()
      ) {
        shouldInvalidate = true;
      }

      // Invalidação por versão
      if (criteria.version && entry.version !== criteria.version) {
        shouldInvalidate = true;
      }

      // Invalidação por idade
      if (criteria.maxAge && Date.now() - entry.timestamp > criteria.maxAge) {
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
      Logger.info(
        'IntelligentCache',
        `Invalidação: ${invalidatedCount} entradas removidas`,
        criteria
      );
    }

    return invalidatedCount;
  }

  /**
   * Rastreia mudanças em um domínio e invalida o cache se ocorrerem mudanças frequentes.
   * @param {string} hostname - O hostname que sofreu uma mudança.
   * @param {string} [changeType='content'] - O tipo de mudança (ex: 'content', 'url').
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
      hostname,
    });

    // Mantém apenas mudanças recentes
    const recentChanges = this.domainChangeTracking
      .get(domainHash)
      .filter((change) => Date.now() - change.timestamp < 60 * 60 * 1000); // 1 hora

    this.domainChangeTracking.set(domainHash, recentChanges);

    // Invalida se há muitas mudanças recentes
    if (recentChanges.length >= 3) {
      const invalidated = this.invalidate({ domain: domainHash });
      Logger.info(
        'IntelligentCache',
        `Invalidação por mudanças frequentes em ${domainHash}: ${invalidated} entradas`
      );
    }
  }

  /**
   * Atualiza a versão do cache, invalidando todas as entradas da versão antiga.
   * @param {string} newVersion - A nova string de versão.
   */
  updateVersion(newVersion) {
    const oldVersion = this.version;
    this.version = newVersion;

    const invalidated = this.invalidate({ version: oldVersion });
    Logger.info(
      'IntelligentCache',
      `Versão atualizada de ${oldVersion} para ${newVersion}. ${invalidated} entradas invalidadas`
    );
  }

  /**
   * Inicia um temporizador para executar a limpeza automática de entradas expiradas e otimizações periodicamente.
   */
  startAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
      this.optimizeCache();
    }, this.cleanupInterval);

    Logger.debug(
      'IntelligentCache',
      `Limpeza automática iniciada (intervalo: ${this.cleanupInterval}ms)`
    );
  }

  /**
   * Para o temporizador de limpeza automática.
   */
  stopAutomaticCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      Logger.debug('IntelligentCache', 'Limpeza automática parada');
    }
  }

  /**
   * Otimiza o cache removendo entradas que são raramente acessadas.
   */
  optimizeCache() {
    const now = Date.now();
    const optimizationThreshold = 7 * 24 * 60 * 60 * 1000; // 7 dias

    // Remove entradas não acessadas há muito tempo
    let optimizedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (
        now - entry.lastAccessed > optimizationThreshold &&
        entry.accessCount < 2
      ) {
        this.cache.delete(key);
        optimizedCount++;
      }
    }

    if (optimizedCount > 0) {
      this.stats.evictions += optimizedCount;
      Logger.debug(
        'IntelligentCache',
        `Otimização: ${optimizedCount} entradas pouco usadas removidas`
      );
    }
  }

  /**
   * Agenda o salvamento do estado do cache no armazenamento local, usando um debounce para evitar escritas excessivas.
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
   * Salva o estado atual do cache no armazenamento local.
   * @returns {Promise<{success: boolean, size?: number, fallback?: boolean}>} O resultado da operação de salvamento.
   */
  async save() {
    if (!this.persistenceEnabled) return;

    return await withErrorHandling(
      async () => {
        const cacheData = {
          version: this.version,
          timestamp: Date.now(),
          entries: Object.fromEntries(this.cache),
          stats: this.stats,
        };

        await browser.storage.local.set({
          [this.cacheName]: cacheData,
        });

        Logger.debug(
          'IntelligentCache',
          `Cache salvo: ${this.cache.size} entradas`
        );
        return { success: true, size: this.cache.size };
      },
      {
        context: 'intelligent-cache-save',
        maxRetries: 3,
        criticalOperation: false,
        fallback: () => {
          Logger.warn(
            'IntelligentCache',
            'Falha ao salvar cache - continuando em memória'
          );
          return { success: false, fallback: true };
        },
      }
    );
  }

  /**
   * Carrega o estado do cache a partir do armazenamento local.
   * @returns {Promise<{success: boolean, loaded: number, versionMismatch?: boolean, fallback?: boolean}>} O resultado da operação de carregamento.
   */
  async load() {
    if (!this.persistenceEnabled) return;

    return await withErrorHandling(
      async () => {
        const data = await browser.storage.local.get(this.cacheName);
        const cacheData = data[this.cacheName];

        if (!cacheData) {
          Logger.debug(
            'IntelligentCache',
            'Nenhum cache encontrado no armazenamento'
          );
          return { success: true, loaded: 0 };
        }

        // Verifica compatibilidade de versão
        if (cacheData.version !== this.version) {
          Logger.info(
            'IntelligentCache',
            `Versão do cache incompatível (${cacheData.version} vs ${this.version}). Iniciando com cache vazio.`
          );
          return { success: true, loaded: 0, versionMismatch: true };
        }

        // Carrega entradas válidas
        let loadedCount = 0;

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

        Logger.info(
          'IntelligentCache',
          `Cache carregado: ${loadedCount} entradas válidas de ${
            Object.keys(cacheData.entries || {}).length
          } totais`
        );
        return { success: true, loaded: loadedCount };
      },
      {
        context: 'intelligent-cache-load',
        maxRetries: 2,
        criticalOperation: false,
        fallback: () => {
          Logger.warn(
            'IntelligentCache',
            'Falha ao carregar cache - iniciando com cache vazio'
          );
          return { success: false, fallback: true, loaded: 0 };
        },
      }
    );
  }

  /**
   * Limpa completamente o cache da memória e do armazenamento local.
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
      lastCleanup: Date.now(),
    };

    if (this.persistenceEnabled) {
      browser.storage.local.remove(this.cacheName);
    }

    Logger.info('IntelligentCache', 'Cache completamente limpo');
  }

  /**
   * Obtém um objeto com estatísticas detalhadas sobre o desempenho e o estado do cache.
   * @returns {object} As estatísticas detalhadas do cache.
   */
  getDetailedStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());

    const hitRate =
      this.stats.totalAccesses > 0
        ? (this.stats.hits / this.stats.totalAccesses) * 100
        : 0;

    const avgAge =
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) /
          entries.length
        : 0;

    const avgAccessCount =
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + entry.accessCount, 0) /
          entries.length
        : 0;

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
      timestamp: now,
    };
  }

  /**
   * Obtém informações detalhadas sobre uma entrada de cache específica.
   * @param {string} key - A chave da entrada a ser inspecionada.
   * @returns {object|null} Um objeto com informações detalhadas da entrada ou `null` se não for encontrada.
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
      isExpired: this.isExpired(entry),
    };
  }

  /**
   * Exporta o estado completo do cache (configuração, estatísticas, entradas) para fins de depuração ou análise.
   * @returns {object} Um objeto contendo o estado completo do cache.
   */
  export() {
    return {
      version: this.version,
      timestamp: Date.now(),
      config: {
        maxSize: this.maxSize,
        defaultTTL: this.defaultTTL,
        cleanupInterval: this.cleanupInterval,
      },
      stats: this.getDetailedStats(),
      entries: Array.from(this.cache.entries()).map(([key]) => ({
        key,
        ...this.getEntryInfo(key),
      })),
      domainChanges: Object.fromEntries(this.domainChangeTracking),
    };
  }

  /**
   * Para todos os temporizadores e limpa o cache, preparando a instância para ser descartada.
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
  version: '1.0.0',
});

// Funções de compatibilidade com o sistema anterior
/** @deprecated Usar `globalIntelligentCache.get` */
export function getSmartNameFromCache(hostname) {
  return globalIntelligentCache.get(hostname);
}

/** @deprecated Usar `globalIntelligentCache.set` */
export function setSmartNameInCache(hostname, name, options = {}) {
  globalIntelligentCache.set(hostname, name, options);
}

/** @deprecated Usar `globalIntelligentCache.invalidate` */
export function invalidateSmartNameCache(criteria) {
  return globalIntelligentCache.invalidate(criteria);
}

/** @deprecated Usar `globalIntelligentCache.clear` */
export function clearSmartNameCache() {
  globalIntelligentCache.clear();
}

/** @deprecated Usar `globalIntelligentCache.getDetailedStats` */
export function getSmartNameCacheStats() {
  return globalIntelligentCache.getDetailedStats();
}

// Inicialização automática
globalIntelligentCache.load().then(() => {
  Logger.info('IntelligentCache', 'Sistema de cache inteligente inicializado');
});

Logger.debug(
  'IntelligentCacheManager',
  'Sistema de cache inteligente com TTL e invalidação inicializado.'
);
