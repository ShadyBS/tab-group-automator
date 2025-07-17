/**
 * @file adaptive-memory-manager.js
 * @description Sistema avançado de gerenciamento de memória com intervalos adaptativos e detecção de pressão de memória.
 */

import Logger from "./logger.js";
import { getConfig } from "./performance-config.js";
import { withErrorHandling } from "./adaptive-error-handler.js";

// Limites de tamanho para estruturas de dados (configuráveis)
const MEMORY_LIMITS = {
  TAB_GROUP_MAP: 5000,           // Máximo de entradas no mapa aba-grupo
  TITLE_UPDATERS: 100,           // Máximo de updaters pendentes
  GROUP_ACTIVITY: 1000,          // Máximo de atividades de grupo rastreadas
  SMART_NAME_CACHE: 2000,        // Máximo de nomes em cache
  INJECTION_FAILURES: 500,       // Máximo de falhas de injeção rastreadas
  PENDING_GROUPS: 50,            // Máximo de grupos pendentes
  SINGLE_TAB_TIMESTAMPS: 200     // Máximo de timestamps de abas únicas
};

// Configurações adaptativas de limpeza
const ADAPTIVE_CONFIG = {
  // Intervalos adaptativos (em ms)
  MIN_INTERVAL: 30 * 1000,       // 30 segundos (alta pressão)
  MAX_INTERVAL: 15 * 60 * 1000,  // 15 minutos (baixa pressão)
  DEFAULT_INTERVAL: 5 * 60 * 1000, // 5 minutos (pressão normal)
  
  // Thresholds de pressão de memória
  HIGH_PRESSURE_THRESHOLD: 0.8,  // 80% dos limites
  MEDIUM_PRESSURE_THRESHOLD: 0.6, // 60% dos limites
  LOW_PRESSURE_THRESHOLD: 0.3,   // 30% dos limites
  
  // Configurações de adaptação
  PRESSURE_HISTORY_SIZE: 10,      // Histórico de pressão para suavização
  ADAPTATION_FACTOR: 0.2,         // Fator de adaptação do intervalo
  EMERGENCY_THRESHOLD: 0.95,      // 95% para limpeza de emergência
  
  // Configurações de limpeza
  STALE_THRESHOLD: 30 * 60 * 1000, // 30 minutos para dados obsoletos
  BATCH_SIZE: 100,                // Processar em lotes
  MAX_AGE_CACHE: 24 * 60 * 60 * 1000, // 24 horas para cache
  MAX_AGE_FAILURES: 60 * 60 * 1000     // 1 hora para falhas de injeção
};

/**
 * Classe para gerenciamento adaptativo de memória
 */
export class AdaptiveMemoryManager {
  constructor() {
    this.cleanupInterval = null;
    this.currentInterval = ADAPTIVE_CONFIG.DEFAULT_INTERVAL;
    this.pressureHistory = [];
    this.lastCleanupStats = null;
    
    // Estatísticas de memória
    this.stats = {
      lastCleanup: Date.now(),
      totalCleaned: 0,
      cleanupCycles: 0,
      adaptations: 0,
      emergencyCleanups: 0,
      averagePressure: 0,
      peakPressure: 0
    };
    
    // Configurações de limpeza por tipo
    this.cleanupStrategies = {
      low: { aggressiveness: 0.3, batchSize: 50 },
      medium: { aggressiveness: 0.6, batchSize: 75 },
      high: { aggressiveness: 0.9, batchSize: 100 },
      emergency: { aggressiveness: 1.0, batchSize: 150 }
    };
  }
  
  /**
   * Calcula a pressão atual de memória
   * @param {object} maps - Mapas de memória
   * @returns {number} Pressão de memória (0-1)
   */
  calculateMemoryPressure(maps) {
    const pressures = [
      maps.tabGroupMap.size / MEMORY_LIMITS.TAB_GROUP_MAP,
      maps.debouncedTitleUpdaters.size / MEMORY_LIMITS.TITLE_UPDATERS,
      maps.groupActivity.size / MEMORY_LIMITS.GROUP_ACTIVITY,
      maps.singleTabGroupTimestamps.size / MEMORY_LIMITS.SINGLE_TAB_TIMESTAMPS,
      maps.smartNameCache.size / MEMORY_LIMITS.SMART_NAME_CACHE,
      maps.injectionFailureMap.size / MEMORY_LIMITS.INJECTION_FAILURES,
      maps.pendingAutomaticGroups.size / MEMORY_LIMITS.PENDING_GROUPS
    ];
    
    // Calcula pressão média ponderada (dá mais peso aos mapas maiores)
    const weights = [0.3, 0.1, 0.2, 0.1, 0.2, 0.05, 0.05];
    const weightedPressure = pressures.reduce((sum, pressure, index) => 
      sum + (pressure * weights[index]), 0
    );
    
    return Math.min(weightedPressure, 1.0);
  }
  
  /**
   * Atualiza o histórico de pressão e calcula médias
   * @param {number} currentPressure - Pressão atual
   */
  updatePressureHistory(currentPressure) {
    this.pressureHistory.push(currentPressure);
    
    // Mantém apenas o histórico recente
    if (this.pressureHistory.length > ADAPTIVE_CONFIG.PRESSURE_HISTORY_SIZE) {
      this.pressureHistory.shift();
    }
    
    // Atualiza estatísticas
    this.stats.averagePressure = this.pressureHistory.reduce((a, b) => a + b, 0) / this.pressureHistory.length;
    this.stats.peakPressure = Math.max(this.stats.peakPressure, currentPressure);
  }
  
  /**
   * Adapta o intervalo de limpeza baseado na pressão de memória
   * @param {number} currentPressure - Pressão atual de memória
   * @returns {number} Novo intervalo em ms
   */
  adaptCleanupInterval(currentPressure) {
    let targetInterval;
    
    if (currentPressure >= ADAPTIVE_CONFIG.HIGH_PRESSURE_THRESHOLD) {
      // Alta pressão: intervalo mínimo
      targetInterval = ADAPTIVE_CONFIG.MIN_INTERVAL;
    } else if (currentPressure >= ADAPTIVE_CONFIG.MEDIUM_PRESSURE_THRESHOLD) {
      // Pressão média: interpola entre mínimo e padrão
      const factor = (currentPressure - ADAPTIVE_CONFIG.MEDIUM_PRESSURE_THRESHOLD) / 
                    (ADAPTIVE_CONFIG.HIGH_PRESSURE_THRESHOLD - ADAPTIVE_CONFIG.MEDIUM_PRESSURE_THRESHOLD);
      targetInterval = ADAPTIVE_CONFIG.DEFAULT_INTERVAL - 
                      (factor * (ADAPTIVE_CONFIG.DEFAULT_INTERVAL - ADAPTIVE_CONFIG.MIN_INTERVAL));
    } else if (currentPressure >= ADAPTIVE_CONFIG.LOW_PRESSURE_THRESHOLD) {
      // Pressão baixa: intervalo padrão
      targetInterval = ADAPTIVE_CONFIG.DEFAULT_INTERVAL;
    } else {
      // Pressão muito baixa: intervalo máximo
      targetInterval = ADAPTIVE_CONFIG.MAX_INTERVAL;
    }
    
    // Suaviza a adaptação para evitar oscilações
    const adaptationFactor = ADAPTIVE_CONFIG.ADAPTATION_FACTOR;
    const newInterval = this.currentInterval * (1 - adaptationFactor) + 
                       targetInterval * adaptationFactor;
    
    // Verifica se houve mudança significativa
    if (Math.abs(newInterval - this.currentInterval) > 1000) {
      Logger.debug(
        "AdaptiveMemoryManager",
        `Adaptando intervalo: ${Math.round(this.currentInterval / 1000)}s → ${Math.round(newInterval / 1000)}s (pressão: ${(currentPressure * 100).toFixed(1)}%)`
      );
      this.stats.adaptations++;
    }
    
    this.currentInterval = Math.max(ADAPTIVE_CONFIG.MIN_INTERVAL, 
                                   Math.min(ADAPTIVE_CONFIG.MAX_INTERVAL, newInterval));
    
    return this.currentInterval;
  }
  
  /**
   * Determina a estratégia de limpeza baseada na pressão
   * @param {number} pressure - Pressão de memória
   * @returns {string} Estratégia de limpeza
   */
  getCleanupStrategy(pressure) {
    if (pressure >= ADAPTIVE_CONFIG.EMERGENCY_THRESHOLD) {
      return 'emergency';
    } else if (pressure >= ADAPTIVE_CONFIG.HIGH_PRESSURE_THRESHOLD) {
      return 'high';
    } else if (pressure >= ADAPTIVE_CONFIG.MEDIUM_PRESSURE_THRESHOLD) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Executa limpeza adaptativa baseada na pressão de memória
   * @param {object} maps - Mapas de memória
   * @param {string} strategy - Estratégia de limpeza
   * @returns {Promise<object>} Estatísticas da limpeza
   */
  async performAdaptiveCleanup(maps, strategy = null) {
    const startTime = Date.now();
    const currentPressure = this.calculateMemoryPressure(maps);
    
    // Determina estratégia se não fornecida
    if (!strategy) {
      strategy = this.getCleanupStrategy(currentPressure);
    }
    
    const config = this.cleanupStrategies[strategy];
    let totalCleaned = 0;
    
    Logger.info(
      "AdaptiveMemoryManager",
      `Iniciando limpeza ${strategy} (pressão: ${(currentPressure * 100).toFixed(1)}%, agressividade: ${(config.aggressiveness * 100).toFixed(0)}%)`
    );
    
    try {
      // Executa limpezas em paralelo com configuração adaptativa
      const cleanupPromises = [
        this.cleanupTabGroupMapAdaptive(maps.tabGroupMap, config),
        this.cleanupTitleUpdatersAdaptive(maps.debouncedTitleUpdaters, config),
        this.cleanupGroupActivityAdaptive(maps.groupActivity, config),
        this.cleanupSingleTabTimestampsAdaptive(maps.singleTabGroupTimestamps, config),
        this.cleanupInjectionFailuresAdaptive(maps.injectionFailureMap, config),
        this.cleanupPendingGroupsAdaptive(maps.pendingAutomaticGroups, config)
      ];
      
      const results = await Promise.allSettled(cleanupPromises);
      
      // Soma resultados bem-sucedidos
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && typeof result.value === 'number') {
          totalCleaned += result.value;
        } else if (result.status === 'rejected') {
          Logger.warn("AdaptiveMemoryManager", `Falha na limpeza ${index}:`, result.reason);
        }
      });
      
      // Cache de nomes com limpeza adaptativa
      totalCleaned += this.cleanupSmartNameCacheAdaptive(maps.smartNameCache, config);
      
      // Atualiza estatísticas
      const duration = Date.now() - startTime;
      this.stats.lastCleanup = Date.now();
      this.stats.totalCleaned += totalCleaned;
      this.stats.cleanupCycles++;
      
      if (strategy === 'emergency') {
        this.stats.emergencyCleanups++;
      }
      
      // Atualiza histórico de pressão
      this.updatePressureHistory(currentPressure);
      
      const finalPressure = this.calculateMemoryPressure(maps);
      const pressureReduction = currentPressure - finalPressure;
      
      const cleanupStats = {
        strategy,
        cleaned: totalCleaned,
        duration,
        pressureBefore: currentPressure,
        pressureAfter: finalPressure,
        pressureReduction,
        sizes: {
          tabGroupMap: maps.tabGroupMap.size,
          debouncedTitleUpdaters: maps.debouncedTitleUpdaters.size,
          groupActivity: maps.groupActivity.size,
          singleTabGroupTimestamps: maps.singleTabGroupTimestamps.size,
          smartNameCache: maps.smartNameCache.size,
          injectionFailureMap: maps.injectionFailureMap.size,
          pendingAutomaticGroups: maps.pendingAutomaticGroups.size
        }
      };
      
      this.lastCleanupStats = cleanupStats;
      
      Logger.info(
        "AdaptiveMemoryManager",
        `Limpeza ${strategy} concluída: ${totalCleaned} entradas removidas em ${duration}ms, pressão reduzida em ${(pressureReduction * 100).toFixed(1)}%`,
        cleanupStats
      );
      
      return cleanupStats;
      
    } catch (error) {
      Logger.error("AdaptiveMemoryManager", "Erro durante limpeza adaptativa:", error);
      return { strategy, cleaned: totalCleaned, error: error.message };
    }
  }
  
  /**
   * Limpeza adaptativa do mapa tab-grupo
   * @param {Map} tabGroupMap - Mapa a ser limpo
   * @param {object} config - Configuração de limpeza
   * @returns {Promise<number>} Número de entradas removidas
   */
  async cleanupTabGroupMapAdaptive(tabGroupMap, config) {
    return await withErrorHandling(async () => {
      let removedCount = 0;
      const entries = Array.from(tabGroupMap.entries());
      const batchSize = config.batchSize;
      
      // Processa em lotes adaptativos
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        for (const [tabId, groupId] of batch) {
          const tabStillExists = await this.tabExists(tabId);
          const groupStillExists = await this.groupExists(groupId);
          
          if (!tabStillExists || !groupStillExists) {
            tabGroupMap.delete(tabId);
            removedCount++;
          }
        }
        
        // Pausa adaptativa entre lotes
        if (i + batchSize < entries.length) {
          const pauseTime = config.aggressiveness > 0.8 ? 5 : 10;
          await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
      }
      
      // Aplica limite adaptativo
      const adaptiveLimit = Math.floor(MEMORY_LIMITS.TAB_GROUP_MAP * (1 - config.aggressiveness * 0.2));
      if (tabGroupMap.size > adaptiveLimit) {
        const excess = tabGroupMap.size - adaptiveLimit;
        const oldEntries = Array.from(tabGroupMap.entries()).slice(0, excess);
        oldEntries.forEach(([tabId]) => tabGroupMap.delete(tabId));
        removedCount += excess;
        Logger.debug("AdaptiveMemoryManager", `Limite adaptativo do tabGroupMap aplicado. Removidas ${excess} entradas antigas.`);
      }
      
      return removedCount;
    }, {
      context: 'cleanupTabGroupMapAdaptive',
      maxRetries: 2,
      criticalOperation: false
    }) || 0;
  }
  
  /**
   * Limpeza adaptativa de atualizadores de título
   * @param {Map} debouncedTitleUpdaters - Mapa de updaters
   * @param {object} config - Configuração de limpeza
   * @returns {Promise<number>} Número de entradas removidas
   */
  async cleanupTitleUpdatersAdaptive(debouncedTitleUpdaters, config) {
    return await withErrorHandling(async () => {
      let removedCount = 0;
      
      for (const [groupId, timeoutId] of debouncedTitleUpdaters.entries()) {
        const groupStillExists = await this.groupExists(groupId);
        
        if (!groupStillExists) {
          clearTimeout(timeoutId);
          debouncedTitleUpdaters.delete(groupId);
          removedCount++;
        }
      }
      
      // Limite adaptativo
      const adaptiveLimit = Math.floor(MEMORY_LIMITS.TITLE_UPDATERS * (1 - config.aggressiveness * 0.3));
      if (debouncedTitleUpdaters.size > adaptiveLimit) {
        const excess = debouncedTitleUpdaters.size - adaptiveLimit;
        const oldEntries = Array.from(debouncedTitleUpdaters.entries()).slice(0, excess);
        oldEntries.forEach(([groupId, timeoutId]) => {
          clearTimeout(timeoutId);
          debouncedTitleUpdaters.delete(groupId);
        });
        removedCount += excess;
      }
      
      return removedCount;
    }, {
      context: 'cleanupTitleUpdatersAdaptive',
      maxRetries: 1,
      criticalOperation: false
    }) || 0;
  }
  
  /**
   * Limpeza adaptativa de atividades de grupo
   * @param {Map} groupActivity - Mapa de atividades
   * @param {object} config - Configuração de limpeza
   * @returns {Promise<number>} Número de entradas removidas
   */
  async cleanupGroupActivityAdaptive(groupActivity, config) {
    return await withErrorHandling(async () => {
      let removedCount = 0;
      const now = Date.now();
      
      // Threshold adaptativo baseado na agressividade
      const adaptiveThreshold = ADAPTIVE_CONFIG.STALE_THRESHOLD * (1 - config.aggressiveness * 0.5);
      const staleThreshold = now - adaptiveThreshold;
      
      for (const [groupId, lastActivity] of groupActivity.entries()) {
        const groupStillExists = await this.groupExists(groupId);
        const isStale = lastActivity < staleThreshold;
        
        if (!groupStillExists || isStale) {
          groupActivity.delete(groupId);
          removedCount++;
        }
      }
      
      // Limite adaptativo
      const adaptiveLimit = Math.floor(MEMORY_LIMITS.GROUP_ACTIVITY * (1 - config.aggressiveness * 0.2));
      if (groupActivity.size > adaptiveLimit) {
        const excess = groupActivity.size - adaptiveLimit;
        const sortedEntries = Array.from(groupActivity.entries())
          .sort(([,a], [,b]) => a - b)
          .slice(0, excess);
        
        sortedEntries.forEach(([groupId]) => groupActivity.delete(groupId));
        removedCount += excess;
      }
      
      return removedCount;
    }, {
      context: 'cleanupGroupActivityAdaptive',
      maxRetries: 1,
      criticalOperation: false
    }) || 0;
  }
  
  /**
   * Limpeza adaptativa de timestamps de abas únicas
   * @param {Map} singleTabGroupTimestamps - Mapa de timestamps
   * @param {object} config - Configuração de limpeza
   * @returns {Promise<number>} Número de entradas removidas
   */
  async cleanupSingleTabTimestampsAdaptive(singleTabGroupTimestamps, config) {
    return await withErrorHandling(async () => {
      let removedCount = 0;
      const now = Date.now();
      const adaptiveThreshold = ADAPTIVE_CONFIG.STALE_THRESHOLD * (1 - config.aggressiveness * 0.5);
      const staleThreshold = now - adaptiveThreshold;
      
      for (const [groupId, timestamp] of singleTabGroupTimestamps.entries()) {
        const groupStillExists = await this.groupExists(groupId);
        const isStale = timestamp < staleThreshold;
        
        if (!groupStillExists || isStale) {
          singleTabGroupTimestamps.delete(groupId);
          removedCount++;
        }
      }
      
      // Limite adaptativo
      const adaptiveLimit = Math.floor(MEMORY_LIMITS.SINGLE_TAB_TIMESTAMPS * (1 - config.aggressiveness * 0.3));
      if (singleTabGroupTimestamps.size > adaptiveLimit) {
        const excess = singleTabGroupTimestamps.size - adaptiveLimit;
        const sortedEntries = Array.from(singleTabGroupTimestamps.entries())
          .sort(([,a], [,b]) => a - b)
          .slice(0, excess);
        
        sortedEntries.forEach(([groupId]) => singleTabGroupTimestamps.delete(groupId));
        removedCount += excess;
      }
      
      return removedCount;
    }, {
      context: 'cleanupSingleTabTimestampsAdaptive',
      maxRetries: 1,
      criticalOperation: false
    }) || 0;
  }
  
  /**
   * Limpeza adaptativa do cache de nomes inteligentes
   * @param {Map} smartNameCache - Cache de nomes
   * @param {object} config - Configuração de limpeza
   * @returns {number} Número de entradas removidas
   */
  cleanupSmartNameCacheAdaptive(smartNameCache, config) {
    let removedCount = 0;
    
    // Limite adaptativo baseado na agressividade
    const adaptiveLimit = Math.floor(MEMORY_LIMITS.SMART_NAME_CACHE * (1 - config.aggressiveness * 0.4));
    
    if (smartNameCache.size > adaptiveLimit) {
      const excess = smartNameCache.size - adaptiveLimit;
      const entries = Array.from(smartNameCache.keys()).slice(0, excess);
      entries.forEach(hostname => smartNameCache.delete(hostname));
      removedCount = excess;
    }
    
    return removedCount;
  }
  
  /**
   * Limpeza adaptativa de falhas de injeção
   * @param {Map} injectionFailureMap - Mapa de falhas
   * @param {object} config - Configuração de limpeza
   * @returns {Promise<number>} Número de entradas removidas
   */
  async cleanupInjectionFailuresAdaptive(injectionFailureMap, config) {
    return await withErrorHandling(async () => {
      let removedCount = 0;
      
      const entries = Array.from(injectionFailureMap.keys());
      for (const tabId of entries) {
        const tabStillExists = await this.tabExists(tabId);
        if (!tabStillExists) {
          injectionFailureMap.delete(tabId);
          removedCount++;
        }
      }
      
      // Limite adaptativo
      const adaptiveLimit = Math.floor(MEMORY_LIMITS.INJECTION_FAILURES * (1 - config.aggressiveness * 0.3));
      if (injectionFailureMap.size > adaptiveLimit) {
        const excess = injectionFailureMap.size - adaptiveLimit;
        const oldEntries = Array.from(injectionFailureMap.keys()).slice(0, excess);
        oldEntries.forEach(tabId => injectionFailureMap.delete(tabId));
        removedCount += excess;
      }
      
      return removedCount;
    }, {
      context: 'cleanupInjectionFailuresAdaptive',
      maxRetries: 1,
      criticalOperation: false
    }) || 0;
  }
  
  /**
   * Limpeza adaptativa de grupos pendentes
   * @param {Map} pendingAutomaticGroups - Mapa de grupos pendentes
   * @param {object} config - Configuração de limpeza
   * @returns {Promise<number>} Número de entradas removidas
   */
  async cleanupPendingGroupsAdaptive(pendingAutomaticGroups, config) {
    return await withErrorHandling(async () => {
      let removedCount = 0;
      
      for (const [key, pendingGroup] of pendingAutomaticGroups.entries()) {
        let hasValidTabs = false;
        
        for (const tabId of pendingGroup.tabIds) {
          if (await this.tabExists(tabId)) {
            hasValidTabs = true;
            break;
          }
        }
        
        if (!hasValidTabs) {
          pendingAutomaticGroups.delete(key);
          removedCount++;
        }
      }
      
      // Limite adaptativo
      const adaptiveLimit = Math.floor(MEMORY_LIMITS.PENDING_GROUPS * (1 - config.aggressiveness * 0.4));
      if (pendingAutomaticGroups.size > adaptiveLimit) {
        const excess = pendingAutomaticGroups.size - adaptiveLimit;
        const oldEntries = Array.from(pendingAutomaticGroups.keys()).slice(0, excess);
        oldEntries.forEach(key => pendingAutomaticGroups.delete(key));
        removedCount += excess;
      }
      
      return removedCount;
    }, {
      context: 'cleanupPendingGroupsAdaptive',
      maxRetries: 1,
      criticalOperation: false
    }) || 0;
  }
  
  /**
   * Verifica se uma aba ainda existe
   * @param {number} tabId - ID da aba
   * @returns {Promise<boolean>} True se a aba existe
   */
  async tabExists(tabId) {
    try {
      await browser.tabs.get(tabId);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Verifica se um grupo ainda existe
   * @param {number} groupId - ID do grupo
   * @returns {Promise<boolean>} True se o grupo existe
   */
  async groupExists(groupId) {
    if (!groupId || groupId === browser.tabs.TAB_ID_NONE) return false;
    try {
      await browser.tabGroups.get(groupId);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Inicia o gerenciamento adaptativo de memória
   * @param {object} maps - Mapas de memória
   */
  startAdaptiveCleanup(maps) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    const scheduleNextCleanup = () => {
      this.cleanupInterval = setTimeout(async () => {
        try {
          // Calcula pressão atual e adapta intervalo
          const currentPressure = this.calculateMemoryPressure(maps);
          const newInterval = this.adaptCleanupInterval(currentPressure);
          
          // Executa limpeza adaptativa
          await this.performAdaptiveCleanup(maps);
          
          // Agenda próxima limpeza com intervalo adaptado
          scheduleNextCleanup();
          
        } catch (error) {
          Logger.error("AdaptiveMemoryManager", "Erro no ciclo de limpeza adaptativa:", error);
          // Reagenda com intervalo padrão em caso de erro
          this.currentInterval = ADAPTIVE_CONFIG.DEFAULT_INTERVAL;
          scheduleNextCleanup();
        }
      }, this.currentInterval);
    };
    
    scheduleNextCleanup();
    
    Logger.info(
      "AdaptiveMemoryManager",
      `Gerenciamento adaptativo de memória iniciado (intervalo inicial: ${Math.round(this.currentInterval / 1000)}s)`
    );
  }
  
  /**
   * Para o gerenciamento adaptativo de memória
   */
  stopAdaptiveCleanup() {
    if (this.cleanupInterval) {
      clearTimeout(this.cleanupInterval);
      this.cleanupInterval = null;
      Logger.info("AdaptiveMemoryManager", "Gerenciamento adaptativo de memória parado.");
    }
  }
  
  /**
   * Força uma limpeza de emergência
   * @param {object} maps - Mapas de memória
   * @returns {Promise<object>} Estatísticas da limpeza
   */
  async emergencyCleanup(maps) {
    Logger.warn("AdaptiveMemoryManager", "Executando limpeza de emergência adaptativa...");
    return await this.performAdaptiveCleanup(maps, 'emergency');
  }
  
  /**
   * Verifica se há pressão de memória crítica
   * @param {object} maps - Mapas de memória
   * @returns {boolean} True se há pressão crítica
   */
  isMemoryPressureCritical(maps) {
    const pressure = this.calculateMemoryPressure(maps);
    return pressure >= ADAPTIVE_CONFIG.EMERGENCY_THRESHOLD;
  }
  
  /**
   * Obtém estatísticas detalhadas do gerenciador
   * @param {object} maps - Mapas de memória
   * @returns {object} Estatísticas completas
   */
  getDetailedStats(maps) {
    const currentPressure = this.calculateMemoryPressure(maps);
    
    return {
      ...this.stats,
      currentPressure,
      currentInterval: this.currentInterval,
      pressureHistory: [...this.pressureHistory],
      lastCleanupStats: this.lastCleanupStats,
      memoryLimits: MEMORY_LIMITS,
      adaptiveConfig: ADAPTIVE_CONFIG,
      sizes: {
        tabGroupMap: maps.tabGroupMap?.size || 0,
        debouncedTitleUpdaters: maps.debouncedTitleUpdaters?.size || 0,
        groupActivity: maps.groupActivity?.size || 0,
        singleTabGroupTimestamps: maps.singleTabGroupTimestamps?.size || 0,
        smartNameCache: maps.smartNameCache?.size || 0,
        injectionFailureMap: maps.injectionFailureMap?.size || 0,
        pendingAutomaticGroups: maps.pendingAutomaticGroups?.size || 0
      },
      pressureBreakdown: {
        tabGroupMap: (maps.tabGroupMap?.size || 0) / MEMORY_LIMITS.TAB_GROUP_MAP,
        debouncedTitleUpdaters: (maps.debouncedTitleUpdaters?.size || 0) / MEMORY_LIMITS.TITLE_UPDATERS,
        groupActivity: (maps.groupActivity?.size || 0) / MEMORY_LIMITS.GROUP_ACTIVITY,
        singleTabGroupTimestamps: (maps.singleTabGroupTimestamps?.size || 0) / MEMORY_LIMITS.SINGLE_TAB_TIMESTAMPS,
        smartNameCache: (maps.smartNameCache?.size || 0) / MEMORY_LIMITS.SMART_NAME_CACHE,
        injectionFailureMap: (maps.injectionFailureMap?.size || 0) / MEMORY_LIMITS.INJECTION_FAILURES,
        pendingAutomaticGroups: (maps.pendingAutomaticGroups?.size || 0) / MEMORY_LIMITS.PENDING_GROUPS
      }
    };
  }
}

// Instância global do gerenciador adaptativo
export const globalAdaptiveMemoryManager = new AdaptiveMemoryManager();

// Exporta funções de compatibilidade com o sistema antigo
export function getMemoryStats(maps = null) {
  return globalAdaptiveMemoryManager.getDetailedStats(maps);
}

export async function performMemoryCleanup(maps) {
  return await globalAdaptiveMemoryManager.performAdaptiveCleanup(maps);
}

export function startMemoryCleanup(maps) {
  globalAdaptiveMemoryManager.startAdaptiveCleanup(maps);
}

export function stopMemoryCleanup() {
  globalAdaptiveMemoryManager.stopAdaptiveCleanup();
}

export async function emergencyCleanup(maps) {
  return await globalAdaptiveMemoryManager.emergencyCleanup(maps);
}

export function isMemoryLimitExceeded(maps) {
  return globalAdaptiveMemoryManager.isMemoryPressureCritical(maps);
}

// Exporta constantes para compatibilidade
export { MEMORY_LIMITS, ADAPTIVE_CONFIG as CLEANUP_CONFIG };

Logger.debug("AdaptiveMemoryManager", "Sistema de gerenciamento adaptativo de memória inicializado.");