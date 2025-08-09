/**
 * @file cache-warmer.js
 * @description Sistema de pre-loading inteligente para otimizar performance
 * Implementa cache warming baseado em padrões de uso e prioridades
 */

import Logger from "./logger.js";
import moduleLoader from "./module-loader.js";

/**
 * Sistema de cache warming inteligente
 * Analisa padrões de uso e pré-carrega módulos com base em prioridades
 */
class CacheWarmer {
  constructor() {
    this.warmingInProgress = false;
    this.warmingQueue = new Set();
    this.usagePatternsKey = "usage_patterns";
    this.warmingMetricsKey = "warming_metrics";
    this.lastWarmingTime = 0;
    this.warmingCooldown = 5 * 60 * 1000; // 5 minutos entre warmings
  }

  /**
   * Inicia o processo de cache warming
   * @param {boolean} force - Força warming mesmo se em cooldown
   * @returns {Promise<object>} - Resultado do warming
   */
  async warmCache(force = false) {
    // Verifica cooldown
    if (!force && this.isInCooldown()) {
      Logger.debug("CacheWarmer", "Cache warming em cooldown, pulando...");
      return { skipped: true, reason: "cooldown" };
    }

    if (this.warmingInProgress) {
      Logger.debug("CacheWarmer", "Cache warming já em progresso");
      return { skipped: true, reason: "in_progress" };
    }

    this.warmingInProgress = true;
    const startTime = performance.now();

    try {
      Logger.info("CacheWarmer", "Iniciando cache warming inteligente...");

      // Obtém padrões de uso
      const usagePatterns = await this.getUsagePatterns();

      // Calcula módulos prioritários
      const priorityModules = this.calculatePriorityModules(usagePatterns);

      // Pré-carrega módulos em background
      const warmingResult = await this.preloadModules(priorityModules);

      // Atualiza métricas
      const totalTime = performance.now() - startTime;
      await this.recordWarmingMetrics(warmingResult, totalTime);

      this.lastWarmingTime = Date.now();

      Logger.info(
        "CacheWarmer",
        `Cache warming concluído em ${totalTime.toFixed(2)}ms`,
        warmingResult
      );

      return {
        success: true,
        totalTime,
        modulesWarmed: warmingResult.successful,
        modulesFailed: warmingResult.failed,
        ...warmingResult,
      };
    } catch (error) {
      Logger.error("CacheWarmer", "Erro durante cache warming:", error);
      return { success: false, error: error.message };
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * Verifica se está em período de cooldown
   * @returns {boolean} - True se em cooldown
   */
  isInCooldown() {
    return Date.now() - this.lastWarmingTime < this.warmingCooldown;
  }

  /**
   * Obtém padrões de uso dos módulos
   * @returns {Promise<object>} - Padrões de uso
   */
  async getUsagePatterns() {
    try {
      const stored = await browser.storage.local.get([this.usagePatternsKey]);
      const patterns = stored[this.usagePatternsKey] || {};

      Logger.debug(
        "CacheWarmer",
        `Padrões de uso carregados: ${Object.keys(patterns).length} módulos`
      );
      return patterns;
    } catch (error) {
      Logger.error("CacheWarmer", "Erro ao obter padrões de uso:", error);
      return {};
    }
  }

  /**
   * Registra uso de um módulo para análise de padrões
   * @param {string} moduleName - Nome do módulo usado
   * @returns {Promise<void>}
   */
  async recordModuleUsage(moduleName) {
    try {
      const patterns = await this.getUsagePatterns();
      const now = Date.now();

      if (!patterns[moduleName]) {
        patterns[moduleName] = {
          frequency: 0,
          lastUsed: 0,
          firstUsed: now,
          totalUses: 0,
          averageInterval: 0,
        };
      }

      const modulePattern = patterns[moduleName];
      const timeSinceLastUse = now - modulePattern.lastUsed;

      // Atualiza estatísticas
      modulePattern.frequency++;
      modulePattern.totalUses++;
      modulePattern.lastUsed = now;

      // Calcula intervalo médio de uso
      if (modulePattern.totalUses > 1) {
        const totalTime = now - modulePattern.firstUsed;
        modulePattern.averageInterval = totalTime / modulePattern.totalUses;
      }

      // Salva padrões atualizados
      await browser.storage.local.set({
        [this.usagePatternsKey]: patterns,
      });

      Logger.debug(
        "CacheWarmer",
        `Uso registrado para ${moduleName}: ${modulePattern.totalUses} usos`
      );
    } catch (error) {
      Logger.error("CacheWarmer", "Erro ao registrar uso do módulo:", error);
    }
  }

  /**
   * Calcula módulos prioritários baseado em padrões de uso
   * @param {object} patterns - Padrões de uso
   * @returns {string[]} - Lista de módulos prioritários
   */
  calculatePriorityModules(patterns) {
    const now = Date.now();
    const scores = new Map();

    // Define módulos disponíveis para warming
    const availableModules = [
      "tab-renaming-engine.js",
      "learning-engine.js",
      "intelligent-cache-manager.js",
      "adaptive-error-handler.js",
      "adaptive-memory-manager.js",
      "parallel-batch-processor.js",
      "performance-optimizations.js",
    ];

    for (const module of availableModules) {
      const pattern = patterns[module];
      let score = 0;

      if (pattern) {
        // Fator de frequência (0-40 pontos)
        const frequencyScore = Math.min(pattern.frequency * 2, 40);

        // Fator de recência (0-30 pontos)
        const daysSinceLastUse =
          (now - pattern.lastUsed) / (24 * 60 * 60 * 1000);
        const recencyScore = Math.max(30 - daysSinceLastUse * 5, 0);

        // Fator de consistência (0-20 pontos)
        const consistencyScore =
          pattern.averageInterval > 0
            ? Math.min(20 / (daysSinceLastUse + 1), 20)
            : 0;

        // Fator de uso total (0-10 pontos)
        const totalUsesScore = Math.min(pattern.totalUses, 10);

        score =
          frequencyScore + recencyScore + consistencyScore + totalUsesScore;
      } else {
        // Módulos nunca usados recebem score baixo mas não zero
        // para permitir descoberta de novos padrões
        score = 5;
      }

      scores.set(module, score);
    }

    // Ordena por score e retorna top 5
    const sortedModules = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([module, score]) => {
        Logger.debug(
          "CacheWarmer",
          `Módulo ${module} score: ${score.toFixed(1)}`
        );
        return module;
      });

    Logger.info(
      "CacheWarmer",
      `Módulos prioritários calculados: ${sortedModules.join(", ")}`
    );
    return sortedModules;
  }

  /**
   * Pré-carrega módulos prioritários
   * @param {string[]} modules - Lista de módulos para pré-carregar
   * @returns {Promise<object>} - Resultado do pré-carregamento
   */
  async preloadModules(modules) {
    const startTime = performance.now();
    const results = {
      total: modules.length,
      successful: 0,
      failed: 0,
      details: [],
      loadTimes: [],
    };

    Logger.info(
      "CacheWarmer",
      `Pré-carregando ${modules.length} módulos prioritários...`
    );

    // Pré-carrega módulos em paralelo com limite de concorrência
    const concurrencyLimit = 3;
    const batches = [];

    for (let i = 0; i < modules.length; i += concurrencyLimit) {
      batches.push(modules.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (module) => {
        const moduleStartTime = performance.now();

        try {
          // Verifica se já está carregado
          if (moduleLoader.isModuleLoaded(module)) {
            Logger.debug(
              "CacheWarmer",
              `Módulo ${module} já carregado, pulando...`
            );
            return {
              module,
              success: true,
              cached: true,
              loadTime: 0,
            };
          }

          // Carrega módulo
          await moduleLoader.loadModule(module);
          const loadTime = performance.now() - moduleStartTime;

          // Registra uso para padrões futuros
          await this.recordModuleUsage(module);

          Logger.debug(
            "CacheWarmer",
            `Módulo ${module} pré-carregado em ${loadTime.toFixed(2)}ms`
          );

          return {
            module,
            success: true,
            cached: false,
            loadTime,
          };
        } catch (error) {
          const loadTime = performance.now() - moduleStartTime;
          Logger.warn(
            "CacheWarmer",
            `Falha no pré-carregamento de ${module}:`,
            error
          );

          return {
            module,
            success: false,
            cached: false,
            loadTime,
            error: error.message,
          };
        }
      });

      // Aguarda batch atual antes de processar próximo
      const batchResults = await Promise.allSettled(batchPromises);

      // Processa resultados do batch
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          const moduleResult = result.value;
          results.details.push(moduleResult);
          results.loadTimes.push(moduleResult.loadTime);

          if (moduleResult.success) {
            results.successful++;
          } else {
            results.failed++;
          }
        } else {
          results.failed++;
          results.details.push({
            success: false,
            error: result.reason?.message || "Unknown error",
          });
        }
      });

      // Pequeno delay entre batches para não sobrecarregar
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Calcula estatísticas finais
    results.totalTime = performance.now() - startTime;
    results.averageLoadTime =
      results.loadTimes.length > 0
        ? results.loadTimes.reduce((a, b) => a + b, 0) /
          results.loadTimes.length
        : 0;
    results.maxLoadTime =
      results.loadTimes.length > 0 ? Math.max(...results.loadTimes) : 0;

    return results;
  }

  /**
   * Registra métricas do cache warming
   * @param {object} result - Resultado do warming
   * @param {number} totalTime - Tempo total gasto
   * @returns {Promise<void>}
   */
  async recordWarmingMetrics(result, totalTime) {
    try {
      const stored = await browser.storage.local.get([this.warmingMetricsKey]);
      const metrics = stored[this.warmingMetricsKey] || {
        totalWarmings: 0,
        totalModulesWarmed: 0,
        totalTime: 0,
        averageTime: 0,
        successRate: 0,
        lastWarming: 0,
      };

      // Atualiza métricas
      metrics.totalWarmings++;
      metrics.totalModulesWarmed += result.successful;
      metrics.totalTime += totalTime;
      metrics.averageTime = metrics.totalTime / metrics.totalWarmings;
      metrics.successRate =
        metrics.totalModulesWarmed / (metrics.totalWarmings * 5); // Assumindo 5 módulos por warming
      metrics.lastWarming = Date.now();

      await browser.storage.local.set({
        [this.warmingMetricsKey]: metrics,
      });
    } catch (error) {
      Logger.error("CacheWarmer", "Erro ao registrar métricas:", error);
    }
  }

  /**
   * Obtém métricas do cache warming
   * @returns {Promise<object>} - Métricas do warming
   */
  async getWarmingMetrics() {
    try {
      const stored = await browser.storage.local.get([this.warmingMetricsKey]);
      return (
        stored[this.warmingMetricsKey] || {
          totalWarmings: 0,
          totalModulesWarmed: 0,
          totalTime: 0,
          averageTime: 0,
          successRate: 0,
          lastWarming: 0,
        }
      );
    } catch (error) {
      Logger.error("CacheWarmer", "Erro ao obter métricas:", error);
      return {
        totalWarmings: 0,
        totalModulesWarmed: 0,
        totalTime: 0,
        averageTime: 0,
        successRate: 0,
        lastWarming: 0,
      };
    }
  }

  /**
   * Limpa padrões de uso antigos
   * @param {number} maxAge - Idade máxima em ms (padrão: 30 dias)
   * @returns {Promise<number>} - Número de padrões removidos
   */
  async cleanupOldPatterns(maxAge = 30 * 24 * 60 * 60 * 1000) {
    try {
      const patterns = await this.getUsagePatterns();
      const now = Date.now();
      let removedCount = 0;

      for (const [module, pattern] of Object.entries(patterns)) {
        if (now - pattern.lastUsed > maxAge) {
          delete patterns[module];
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await browser.storage.local.set({
          [this.usagePatternsKey]: patterns,
        });

        Logger.info(
          "CacheWarmer",
          `Removidos ${removedCount} padrões de uso antigos`
        );
      }

      return removedCount;
    } catch (error) {
      Logger.error("CacheWarmer", "Erro ao limpar padrões antigos:", error);
      return 0;
    }
  }

  /**
   * Reseta todos os padrões de uso
   * @returns {Promise<void>}
   */
  async resetUsagePatterns() {
    try {
      await browser.storage.local.remove([this.usagePatternsKey]);
      Logger.info("CacheWarmer", "Padrões de uso resetados");
    } catch (error) {
      Logger.error("CacheWarmer", "Erro ao resetar padrões:", error);
    }
  }

  /**
   * Obtém status atual do cache warmer
   * @returns {Promise<object>} - Status do warmer
   */
  async getStatus() {
    const patterns = await this.getUsagePatterns();
    const metrics = await this.getWarmingMetrics();

    return {
      warmingInProgress: this.warmingInProgress,
      inCooldown: this.isInCooldown(),
      cooldownRemaining: Math.max(
        0,
        this.warmingCooldown - (Date.now() - this.lastWarmingTime)
      ),
      trackedModules: Object.keys(patterns).length,
      lastWarming: metrics.lastWarming,
      totalWarmings: metrics.totalWarmings,
      successRate: metrics.successRate,
    };
  }
}

// Instância global do cache warmer
const cacheWarmer = new CacheWarmer();

export default cacheWarmer;
export { CacheWarmer };
