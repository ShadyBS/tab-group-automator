/**
 * @file adaptive-memory-manager.js
 * @description Sistema avançado de gerenciamento de memória com intervalos adaptativos e detecção de pressão de memória.
 */

import Logger from "./logger.js";
import { getConfig } from "./performance-config.js";
import { withErrorHandling } from "./adaptive-error-handler.js";

// Limites de tamanho para estruturas de dados (configuráveis)
import { settings } from "./settings-manager.js";

// Limites de tamanho para estruturas de dados (agora dinâmicos)
function getMemoryLimits() {
  return (
    settings.memoryLimits || {
      TAB_GROUP_MAP: 5000,
      TITLE_UPDATERS: 100,
      GROUP_ACTIVITY: 1000,
      SMART_NAME_CACHE: 2000,
      INJECTION_FAILURES: 500,
      PENDING_GROUPS: 50,
      SINGLE_TAB_TIMESTAMPS: 200,
    }
  );
}

// Configurações adaptativas de limpeza
const ADAPTIVE_CONFIG = {
  // Intervalos adaptativos (em ms)
  MIN_INTERVAL: 30 * 1000, // 30 segundos (alta pressão)
  MAX_INTERVAL: 15 * 60 * 1000, // 15 minutos (baixa pressão)
  DEFAULT_INTERVAL: 5 * 60 * 1000, // 5 minutos (pressão normal)

  // Thresholds de pressão de memória
  HIGH_PRESSURE_THRESHOLD: 0.8, // 80% dos limites
  MEDIUM_PRESSURE_THRESHOLD: 0.6, // 60% dos limites
  LOW_PRESSURE_THRESHOLD: 0.3, // 30% dos limites

  // Configurações de adaptação
  PRESSURE_HISTORY_SIZE: 10, // Histórico de pressão para suavização
  ADAPTATION_FACTOR: 0.2, // Fator de adaptação do intervalo
  EMERGENCY_THRESHOLD: 0.95, // 95% para limpeza de emergência

  // Configurações de limpeza
  STALE_THRESHOLD: 30 * 60 * 1000, // 30 minutos para dados obsoletos
  BATCH_SIZE: 100, // Processar em lotes
  MAX_AGE_CACHE: 24 * 60 * 60 * 1000, // 24 horas para cache
  MAX_AGE_FAILURES: 60 * 60 * 1000, // 1 hora para falhas de injeção
};

/**
 * Classe para gerenciamento adaptativo de memória.
 * Monitora o uso de memória de várias estruturas de dados, calcula uma "pressão"
 * de memória e ajusta dinamicamente a frequência e a agressividade da limpeza
 * para manter o desempenho e evitar o uso excessivo de recursos.
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
      peakPressure: 0,
    };

    // Configurações de limpeza por tipo
    this.cleanupStrategies = {
      low: { aggressiveness: 0.3, batchSize: 50 },
      medium: { aggressiveness: 0.6, batchSize: 75 },
      high: { aggressiveness: 0.9, batchSize: 100 },
      emergency: { aggressiveness: 1.0, batchSize: 150 },
    };
  }

  /**
   * Calcula a pressão de memória atual com base no tamanho dos mapas em relação aos seus limites.
   * @param {object} maps - Um objeto contendo os mapas de estado da aplicação.
   * @returns {number} Um valor de pressão normalizado entre 0 (sem pressão) e 1 (pressão máxima).
   */
  calculateMemoryPressure(maps) {
    const pressures = [
      maps.tabGroupMap.size / getMemoryLimits().TAB_GROUP_MAP,
      maps.debouncedTitleUpdaters.size / getMemoryLimits().TITLE_UPDATERS,
      maps.groupActivity.size / getMemoryLimits().GROUP_ACTIVITY,
      maps.singleTabGroupTimestamps.size /
        getMemoryLimits().SINGLE_TAB_TIMESTAMPS,
      maps.smartNameCache.size / getMemoryLimits().SMART_NAME_CACHE,
      maps.injectionFailureMap.size / getMemoryLimits().INJECTION_FAILURES,
      maps.pendingAutomaticGroups.size / getMemoryLimits().PENDING_GROUPS,
    ];

    // Calcula pressão média ponderada (dá mais peso aos mapas maiores)
    const weights = [0.3, 0.1, 0.2, 0.1, 0.2, 0.05, 0.05];
    const weightedPressure = pressures.reduce(
      (sum, pressure, index) => sum + pressure * weights[index],
      0
    );

    return Math.min(weightedPressure, 1.0);
  }

  /**
   * Atualiza o histórico de medições de pressão de memória para suavizar as adaptações.
   * @param {number} currentPressure - A pressão de memória calculada atualmente.
   */
  updatePressureHistory(currentPressure) {
    this.pressureHistory.push(currentPressure);

    // Mantém apenas o histórico recente
    if (this.pressureHistory.length > ADAPTIVE_CONFIG.PRESSURE_HISTORY_SIZE) {
      this.pressureHistory.shift();
    }

    // Atualiza estatísticas
    this.stats.averagePressure =
      this.pressureHistory.reduce((a, b) => a + b, 0) /
      this.pressureHistory.length;
    this.stats.peakPressure = Math.max(
      this.stats.peakPressure,
      currentPressure
    );
  }

  /**
   * Ajusta dinamicamente o intervalo do temporizador de limpeza com base na pressão de memória.
   * @param {number} currentPressure - A pressão de memória atual.
   * @returns {number} O novo intervalo de limpeza em milissegundos.
   */
  adaptCleanupInterval(currentPressure) {
    let targetInterval;

    const config = ADAPTIVE_CONFIG;
    if (currentPressure >= config.HIGH_PRESSURE_THRESHOLD) {
      // Alta pressão: intervalo mínimo
      targetInterval = config.MIN_INTERVAL;
    } else if (currentPressure >= config.MEDIUM_PRESSURE_THRESHOLD) {
      // Pressão média: interpola entre mínimo e padrão
      const factor =
        (currentPressure - config.MEDIUM_PRESSURE_THRESHOLD) /
        (config.HIGH_PRESSURE_THRESHOLD - config.MEDIUM_PRESSURE_THRESHOLD);
      targetInterval =
        config.DEFAULT_INTERVAL -
        factor * (config.DEFAULT_INTERVAL - config.MIN_INTERVAL);
    } else if (currentPressure >= config.LOW_PRESSURE_THRESHOLD) {
      // Pressão baixa: intervalo padrão
      targetInterval = config.DEFAULT_INTERVAL;
    } else {
      // Pressão muito baixa: intervalo máximo
      targetInterval = config.MAX_INTERVAL;
    }

    // Suaviza a adaptação para evitar oscilações
    const adaptationFactor = config.ADAPTATION_FACTOR;
    const newInterval =
      this.currentInterval * (1 - adaptationFactor) +
      targetInterval * adaptationFactor;

    // Verifica se houve mudança significativa
    if (Math.abs(newInterval - this.currentInterval) > 1000) {
      Logger.debug(
        "AdaptiveMemoryManager",
        `Adaptando intervalo: ${Math.round(
          this.currentInterval / 1000
        )}s → ${Math.round(newInterval / 1000)}s (pressão: ${(
          currentPressure * 100
        ).toFixed(1)}%)`
      );
      this.stats.adaptations++;
    }

    this.currentInterval = Math.max(
      config.MIN_INTERVAL,
      Math.min(config.MAX_INTERVAL, newInterval)
    );

    return this.currentInterval;
  }

  /**
   * Determina a estratégia de limpeza apropriada (low, medium, high, emergency) com base na pressão de memória.
   * @param {number} pressure - A pressão de memória atual.
   * @returns {string} O nome da estratégia de limpeza.
   */
  getCleanupStrategy(pressure) {
    const config = ADAPTIVE_CONFIG;
    if (pressure >= config.EMERGENCY_THRESHOLD) {
      return "emergency";
    } else if (pressure >= config.HIGH_PRESSURE_THRESHOLD) {
      return "high";
    } else if (pressure >= config.MEDIUM_PRESSURE_THRESHOLD) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Executa um ciclo de limpeza de memória com uma estratégia e agressividade baseadas na pressão atual.
   * @param {object} maps - Os mapas de estado da aplicação a serem limpos.
   * @param {string|null} [strategy=null] - Força uma estratégia de limpeza específica; se nulo, é determinada automaticamente.
   * @returns {Promise<object>} Um objeto com as estatísticas do ciclo de limpeza.
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
      `Iniciando limpeza ${strategy} (pressão: ${(
        currentPressure * 100
      ).toFixed(1)}%, agressividade: ${(config.aggressiveness * 100).toFixed(
        0
      )}%)`
    );

    try {
      // Executa limpezas em paralelo com configuração adaptativa
      const cleanupPromises = [
        this.cleanupTabGroupMapAdaptive(maps.tabGroupMap, config),
        this.cleanupTitleUpdatersAdaptive(maps.debouncedTitleUpdaters, config),
        this.cleanupGroupActivityAdaptive(maps.groupActivity, config),
        this.cleanupSingleTabTimestampsAdaptive(
          maps.singleTabGroupTimestamps,
          config
        ),
        this.cleanupInjectionFailuresAdaptive(maps.injectionFailureMap, config),
        this.cleanupPendingGroupsAdaptive(maps.pendingAutomaticGroups, config),
      ];

      const results = await Promise.allSettled(cleanupPromises);

      // Soma resultados bem-sucedidos
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && typeof result.value === "number") {
          totalCleaned += result.value;
        } else if (result.status === "rejected") {
          Logger.warn(
            "AdaptiveMemoryManager",
            `Falha na limpeza ${index}:`,
            result.reason
          );
        }
      });

      // Cache de nomes com limpeza adaptativa
      totalCleaned += this.cleanupSmartNameCacheAdaptive(
        maps.smartNameCache,
        config
      );

      // Atualiza estatísticas
      const duration = Date.now() - startTime;
      this.stats.lastCleanup = Date.now();
      this.stats.totalCleaned += totalCleaned;
      this.stats.cleanupCycles++;

      if (strategy === "emergency") {
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
          pendingAutomaticGroups: maps.pendingAutomaticGroups.size,
        },
      };

      this.lastCleanupStats = cleanupStats;

      Logger.info(
        "AdaptiveMemoryManager",
        `Limpeza ${strategy} concluída: ${totalCleaned} entradas removidas em ${duration}ms, pressão reduzida em ${(
          pressureReduction * 100
        ).toFixed(1)}%`,
        cleanupStats
      );

      return cleanupStats;
    } catch (error) {
      Logger.error(
        "AdaptiveMemoryManager",
        "Erro durante limpeza adaptativa:",
        error
      );
      return { strategy, cleaned: totalCleaned, error: error.message };
    }
  }

  /**
   * Limpa o mapa `tabGroupMap` de entradas órfãs (abas ou grupos que não existem mais).
   * @param {Map<number, number>} tabGroupMap - O mapa de IDs de abas para IDs de grupos.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {Promise<number>} O número de entradas removidas.
   */
  async cleanupTabGroupMapAdaptive(tabGroupMap, config) {
    return (
      (await withErrorHandling(
        async () => {
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
              await new Promise((resolve) => setTimeout(resolve, pauseTime));
            }
          }

          // Aplica limite adaptativo
          const adaptiveLimit = Math.floor(
            getMemoryLimits().TAB_GROUP_MAP * (1 - config.aggressiveness * 0.2)
          );
          if (tabGroupMap.size > adaptiveLimit) {
            const excess = tabGroupMap.size - adaptiveLimit;
            const oldEntries = Array.from(tabGroupMap.entries()).slice(
              0,
              excess
            );
            oldEntries.forEach(([tabId]) => tabGroupMap.delete(tabId));
            removedCount += excess;
            Logger.debug(
              "AdaptiveMemoryManager",
              `Limite adaptativo do tabGroupMap aplicado. Removidas ${excess} entradas antigas.`
            );
          }

          return removedCount;
        },
        {
          context: "cleanupTabGroupMapAdaptive",
          maxRetries: 2,
          criticalOperation: false,
        }
      )) || 0
    );
  }

  /**
   * Limpa `debouncedTitleUpdaters` de timers associados a grupos que não existem mais.
   * @param {Map<number, number>} debouncedTitleUpdaters - O mapa de updaters de título.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {Promise<number>} O número de entradas removidas.
   */
  async cleanupTitleUpdatersAdaptive(debouncedTitleUpdaters, config) {
    return (
      (await withErrorHandling(
        async () => {
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
          const adaptiveLimit = Math.floor(
            getMemoryLimits().TITLE_UPDATERS * (1 - config.aggressiveness * 0.3)
          );
          if (debouncedTitleUpdaters.size > adaptiveLimit) {
            const excess = debouncedTitleUpdaters.size - adaptiveLimit;
            const oldEntries = Array.from(
              debouncedTitleUpdaters.entries()
            ).slice(0, excess);
            oldEntries.forEach(([groupId, timeoutId]) => {
              clearTimeout(timeoutId);
              debouncedTitleUpdaters.delete(groupId);
            });
            removedCount += excess;
          }

          return removedCount;
        },
        {
          context: "cleanupTitleUpdatersAdaptive",
          maxRetries: 1,
          criticalOperation: false,
        }
      )) || 0
    );
  }

  /**
   * Limpa o mapa `groupActivity` de entradas obsoletas ou de grupos que não existem mais.
   * @param {Map<number, number>} groupActivity - O mapa de atividade de grupos.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {Promise<number>} O número de entradas removidas.
   */
  async cleanupGroupActivityAdaptive(groupActivity, config) {
    return (
      (await withErrorHandling(
        async () => {
          let removedCount = 0;
          const now = Date.now();

          // Threshold adaptativo baseado na agressividade
          const adaptiveThreshold =
            ADAPTIVE_CONFIG.STALE_THRESHOLD * (1 - config.aggressiveness * 0.5);
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
          const adaptiveLimit = Math.floor(
            getMemoryLimits().GROUP_ACTIVITY * (1 - config.aggressiveness * 0.2)
          );
          if (groupActivity.size > adaptiveLimit) {
            const excess = groupActivity.size - adaptiveLimit;
            const sortedEntries = Array.from(groupActivity.entries())
              .sort(([, a], [, b]) => a - b)
              .slice(0, excess);

            sortedEntries.forEach(([groupId]) => groupActivity.delete(groupId));
            removedCount += excess;
          }

          return removedCount;
        },
        {
          context: "cleanupGroupActivityAdaptive",
          maxRetries: 1,
          criticalOperation: false,
        }
      )) || 0
    );
  }

  /**
   * Limpa `singleTabGroupTimestamps` de entradas de grupos que não existem mais ou que já não são de aba única.
   * @param {Map<number, number>} singleTabGroupTimestamps - O mapa de timestamps de grupos de aba única.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {Promise<number>} O número de entradas removidas.
   */
  async cleanupSingleTabTimestampsAdaptive(singleTabGroupTimestamps, config) {
    return (
      (await withErrorHandling(
        async () => {
          let removedCount = 0;
          const now = Date.now();
          const adaptiveThreshold =
            ADAPTIVE_CONFIG.STALE_THRESHOLD * (1 - config.aggressiveness * 0.5);
          const staleThreshold = now - adaptiveThreshold;

          for (const [
            groupId,
            timestamp,
          ] of singleTabGroupTimestamps.entries()) {
            const groupStillExists = await this.groupExists(groupId);
            const isStale = timestamp < staleThreshold;

            if (!groupStillExists || isStale) {
              singleTabGroupTimestamps.delete(groupId);
              removedCount++;
            }
          }

          // Limite adaptativo
          const adaptiveLimit = Math.floor(
            getMemoryLimits().SINGLE_TAB_TIMESTAMPS *
              (1 - config.aggressiveness * 0.3)
          );
          if (singleTabGroupTimestamps.size > adaptiveLimit) {
            const excess = singleTabGroupTimestamps.size - adaptiveLimit;
            const sortedEntries = Array.from(singleTabGroupTimestamps.entries())
              .sort(([, a], [, b]) => a - b)
              .slice(0, excess);

            sortedEntries.forEach(([groupId]) =>
              singleTabGroupTimestamps.delete(groupId)
            );
            removedCount += excess;
          }

          return removedCount;
        },
        {
          context: "cleanupSingleTabTimestampsAdaptive",
          maxRetries: 1,
          criticalOperation: false,
        }
      )) || 0
    );
  }

  /**
   * Limpa o `smartNameCache` se exceder o limite adaptativo, removendo as entradas mais antigas.
   * @param {Map<string, any>} smartNameCache - O mapa do cache de nomes inteligentes.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {number} O número de entradas removidas.
   */
  cleanupSmartNameCacheAdaptive(smartNameCache, config) {
    let removedCount = 0;

    // Limite adaptativo baseado na agressividade
    const adaptiveLimit = Math.floor(
      getMemoryLimits().SMART_NAME_CACHE * (1 - config.aggressiveness * 0.4)
    );

    if (smartNameCache.size > adaptiveLimit) {
      const excess = smartNameCache.size - adaptiveLimit;
      const entries = Array.from(smartNameCache.keys()).slice(0, excess);
      entries.forEach((hostname) => smartNameCache.delete(hostname));
      removedCount = excess;
    }

    return removedCount;
  }

  /**
   * Limpa o `injectionFailureMap` de entradas para abas que não existem mais.
   * @param {Map<number, number>} injectionFailureMap - O mapa de falhas de injeção.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {Promise<number>} O número de entradas removidas.
   */
  async cleanupInjectionFailuresAdaptive(injectionFailureMap, config) {
    return (
      (await withErrorHandling(
        async () => {
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
          const adaptiveLimit = Math.floor(
            getMemoryLimits().INJECTION_FAILURES *
              (1 - config.aggressiveness * 0.3)
          );
          if (injectionFailureMap.size > adaptiveLimit) {
            const excess = injectionFailureMap.size - adaptiveLimit;
            const oldEntries = Array.from(injectionFailureMap.keys()).slice(
              0,
              excess
            );
            oldEntries.forEach((tabId) => injectionFailureMap.delete(tabId));
            removedCount += excess;
          }

          return removedCount;
        },
        {
          context: "cleanupInjectionFailuresAdaptive",
          maxRetries: 1,
          criticalOperation: false,
        }
      )) || 0
    );
  }

  /**
   * Limpa `pendingAutomaticGroups` de entradas cujas abas associadas já não existem.
   * @param {Map<number, object>} pendingAutomaticGroups - O mapa de grupos automáticos pendentes.
   * @param {object} config - A configuração de limpeza atual.
   * @returns {Promise<number>} O número de entradas removidas.
   */
  async cleanupPendingGroupsAdaptive(pendingAutomaticGroups, config) {
    return (
      (await withErrorHandling(
        async () => {
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
          const adaptiveLimit = Math.floor(
            getMemoryLimits().PENDING_GROUPS * (1 - config.aggressiveness * 0.4)
          );
          if (pendingAutomaticGroups.size > adaptiveLimit) {
            const excess = pendingAutomaticGroups.size - adaptiveLimit;
            const oldEntries = Array.from(pendingAutomaticGroups.keys()).slice(
              0,
              excess
            );
            oldEntries.forEach((key) => pendingAutomaticGroups.delete(key));
            removedCount += excess;
          }

          return removedCount;
        },
        {
          context: "cleanupPendingGroupsAdaptive",
          maxRetries: 1,
          criticalOperation: false,
        }
      )) || 0
    );
  }

  /**
   * Verifica de forma segura se uma aba com um determinado ID ainda existe.
   * @param {number} tabId - O ID da aba a ser verificado.
   * @returns {Promise<boolean>} `true` se a aba existir, `false` caso contrário.
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
   * Verifica de forma segura se um grupo de abas com um determinado ID ainda existe.
   * @param {number} groupId - O ID do grupo a ser verificado.
   * @returns {Promise<boolean>} `true` se o grupo existir, `false` caso contrário.
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
   * Inicia o ciclo de limpeza adaptativa de memória.
   * @param {object} maps - Os mapas de estado da aplicação a serem monitorizados.
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
          Logger.error(
            "AdaptiveMemoryManager",
            "Erro no ciclo de limpeza adaptativa:",
            error
          );
          // Reagenda com intervalo padrão em caso de erro
          this.currentInterval = ADAPTIVE_CONFIG.DEFAULT_INTERVAL;
          scheduleNextCleanup();
        }
      }, this.currentInterval);
    };

    scheduleNextCleanup();

    Logger.info(
      "AdaptiveMemoryManager",
      `Gerenciamento adaptativo de memória iniciado (intervalo inicial: ${Math.round(
        this.currentInterval / 1000
      )}s)`
    );
  }

  /**
   * Para o ciclo de limpeza adaptativa de memória.
   */
  stopAdaptiveCleanup() {
    if (this.cleanupInterval) {
      clearTimeout(this.cleanupInterval);
      this.cleanupInterval = null;
      Logger.info(
        "AdaptiveMemoryManager",
        "Gerenciamento adaptativo de memória parado."
      );
    }
  }

  /**
   * Força a execução de um ciclo de limpeza de emergência com a máxima agressividade.
   * @param {object} maps - Os mapas de estado da aplicação a serem limpos.
   * @returns {Promise<object>} Um objeto com as estatísticas do ciclo de limpeza.
   */
  async emergencyCleanup(maps) {
    Logger.warn(
      "AdaptiveMemoryManager",
      "Executando limpeza de emergência adaptativa..."
    );
    return await this.performAdaptiveCleanup(maps, "emergency");
  }

  /**
   * Verifica se a pressão de memória atual excede o limiar de emergência.
   * @param {object} maps - Os mapas de estado da aplicação.
   * @returns {boolean} `true` se a pressão de memória for crítica, `false` caso contrário.
   */
  isMemoryPressureCritical(maps) {
    const pressure = this.calculateMemoryPressure(maps);
    return pressure >= ADAPTIVE_CONFIG.EMERGENCY_THRESHOLD;
  }

  /**
   * Obtém um relatório detalhado do estado atual do gerenciador de memória.
   * @param {object} maps - Os mapas de estado da aplicação.
   * @returns {object} Um objeto com estatísticas detalhadas.
   */
  getDetailedStats(maps) {
    const currentPressure = this.calculateMemoryPressure(maps);

    return {
      ...this.stats,
      currentPressure,
      currentInterval: this.currentInterval,
      pressureHistory: [...this.pressureHistory],
      lastCleanupStats: this.lastCleanupStats,
      memoryLimits: getMemoryLimits(),
      adaptiveConfig: ADAPTIVE_CONFIG,
      sizes: {
        tabGroupMap: maps.tabGroupMap?.size || 0,
        debouncedTitleUpdaters: maps.debouncedTitleUpdaters?.size || 0,
        groupActivity: maps.groupActivity?.size || 0,
        singleTabGroupTimestamps: maps.singleTabGroupTimestamps?.size || 0,
        smartNameCache: maps.smartNameCache?.size || 0,
        injectionFailureMap: maps.injectionFailureMap?.size || 0,
        pendingAutomaticGroups: maps.pendingAutomaticGroups?.size || 0,
      },
      pressureBreakdown: {
        tabGroupMap:
          (maps.tabGroupMap?.size || 0) / getMemoryLimits().TAB_GROUP_MAP,
        debouncedTitleUpdaters:
          (maps.debouncedTitleUpdaters?.size || 0) /
          getMemoryLimits().TITLE_UPDATERS,
        groupActivity:
          (maps.groupActivity?.size || 0) / getMemoryLimits().GROUP_ACTIVITY,
        singleTabGroupTimestamps:
          (maps.singleTabGroupTimestamps?.size || 0) /
          getMemoryLimits().SINGLE_TAB_TIMESTAMPS,
        smartNameCache:
          (maps.smartNameCache?.size || 0) / getMemoryLimits().SMART_NAME_CACHE,
        injectionFailureMap:
          (maps.injectionFailureMap?.size || 0) /
          getMemoryLimits().INJECTION_FAILURES,
        pendingAutomaticGroups:
          (maps.pendingAutomaticGroups?.size || 0) /
          getMemoryLimits().PENDING_GROUPS,
      },
    };
  }
}

// Instância global do gerenciador adaptativo
export const globalAdaptiveMemoryManager = new AdaptiveMemoryManager();

// Exporta funções de compatibilidade com o sistema antigo
/** @deprecated Usar `globalAdaptiveMemoryManager.getDetailedStats` */
export function getMemoryStats(maps = null) {
  return globalAdaptiveMemoryManager.getDetailedStats(maps);
}

/** @deprecated Usar `globalAdaptiveMemoryManager.performAdaptiveCleanup` */
export async function performMemoryCleanup(maps) {
  return await globalAdaptiveMemoryManager.performAdaptiveCleanup(maps);
}

/** @deprecated Usar `globalAdaptiveMemoryManager.startAdaptiveCleanup` */
export function startMemoryCleanup(maps) {
  globalAdaptiveMemoryManager.startAdaptiveCleanup(maps);
}

/** @deprecated Usar `globalAdaptiveMemoryManager.stopAdaptiveCleanup` */
export function stopMemoryCleanup() {
  globalAdaptiveMemoryManager.stopAdaptiveCleanup();
}

/** @deprecated Usar `globalAdaptiveMemoryManager.emergencyCleanup` */
export async function emergencyCleanup(maps) {
  return await globalAdaptiveMemoryManager.emergencyCleanup(maps);
}

/** @deprecated Usar `globalAdaptiveMemoryManager.isMemoryPressureCritical` */
export function isMemoryLimitExceeded(maps) {
  return globalAdaptiveMemoryManager.isMemoryPressureCritical(maps);
}

// Exporta constantes para compatibilidade
export { ADAPTIVE_CONFIG as CLEANUP_CONFIG };

Logger.debug(
  "AdaptiveMemoryManager",
  "Sistema de gerenciamento adaptativo de memória inicializado."
);
