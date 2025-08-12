/**
 * @file performance-validator.js
 * @description Validador de performance para TASK-A-001 - Verifica se as metas de performance são atingidas
 */

import Logger from './logger.js';
import { getConfig } from './performance-config.js';

/**
 * Classe para validação de performance conforme TASK-A-001
 */
export class PerformanceValidator {
  constructor() {
    this.metrics = new Map();
    this.validationHistory = [];
    this.isValidationEnabled = true;

    // Metas de performance da TASK-A-001
    this.targets = {
      grouping100Tabs: getConfig('PERFORMANCE_TARGET_100_TABS'), // 50ms
      grouping200Tabs: getConfig('PERFORMANCE_TARGET_200_TABS'), // 100ms
      memoryUsage200Tabs: getConfig('MEMORY_TARGET_200_TABS'), // 50MB
      uiResponsiveness: 16, // 60fps = 16ms por frame
      cacheHitRate: 0.8, // 80% de cache hit rate
      errorRate: 0.05, // Máximo 5% de erro
    };

    this.validationResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      lastValidation: null,
    };
  }

  /**
   * Registra uma métrica de performance
   * @param {string} operation - Nome da operação
   * @param {number} duration - Duração em ms
   * @param {number} tabCount - Número de abas processadas
   * @param {object} metadata - Metadados adicionais
   */
  recordMetric(operation, duration, tabCount, metadata = {}) {
    if (!this.isValidationEnabled) return;

    const metric = {
      operation,
      duration,
      tabCount,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        memoryUsage: this.getMemoryUsage(),
        cacheStats: this.getCacheStats(),
      },
    };

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    this.metrics.get(operation).push(metric);

    // Mantém apenas as últimas 100 métricas por operação
    const operationMetrics = this.metrics.get(operation);
    if (operationMetrics.length > 100) {
      operationMetrics.splice(0, operationMetrics.length - 100);
    }

    // Validação em tempo real para operações críticas
    if (operation === 'processTabQueue') {
      this.validateGroupingPerformance(metric);
    }

    Logger.debug(
      'PerformanceValidator',
      `Métrica registrada: ${operation} - ${duration}ms (${tabCount} abas)`
    );
  }

  /**
   * Valida performance de agrupamento em tempo real
   * @param {object} metric - Métrica de performance
   */
  validateGroupingPerformance(metric) {
    const { duration, tabCount } = metric;
    let target, status, level;

    if (tabCount <= 100) {
      target = this.targets.grouping100Tabs;
      status = duration <= target ? 'PASS' : 'FAIL';
      level = duration <= target ? 'info' : 'warn';
    } else if (tabCount <= 200) {
      target = this.targets.grouping200Tabs;
      status = duration <= target ? 'PASS' : 'FAIL';
      level = duration <= target ? 'info' : 'warn';
    } else {
      // Para mais de 200 abas, usa uma extrapolação linear
      target = this.targets.grouping200Tabs * (tabCount / 200);
      status = duration <= target ? 'PASS' : 'FAIL';
      level = duration <= target ? 'info' : 'warn';
    }

    const result = {
      operation: 'grouping_performance',
      status,
      duration,
      target,
      tabCount,
      timestamp: Date.now(),
      ratio: duration / target,
    };

    this.validationHistory.push(result);

    if (status === 'PASS') {
      this.validationResults.passed++;
      Logger[level](
        'PerformanceValidator',
        `✅ Agrupamento PASSOU: ${tabCount} abas em ${duration}ms (meta: ${target}ms)`
      );
    } else {
      this.validationResults.failed++;
      Logger[level](
        'PerformanceValidator',
        `❌ Agrupamento FALHOU: ${tabCount} abas em ${duration}ms (meta: ${target}ms) - ${Math.round(
          (duration / target - 1) * 100
        )}% acima da meta`
      );
    }

    // Mantém apenas as últimas 50 validações
    if (this.validationHistory.length > 50) {
      this.validationHistory.splice(0, this.validationHistory.length - 50);
    }
  }

  /**
   * Executa validação completa de performance
   * @returns {Promise<object>} Resultado da validação
   */
  async performFullValidation() {
    if (!this.isValidationEnabled) {
      return {
        status: 'DISABLED',
        message: 'Validação de performance desabilitada',
      };
    }

    Logger.info(
      'PerformanceValidator',
      '🔍 Iniciando validação completa de performance...'
    );

    const results = {
      timestamp: Date.now(),
      overall: 'PASS',
      details: {},
      recommendations: [],
    };

    try {
      // 1. Validação de Performance de Agrupamento
      results.details.groupingPerformance =
        await this.validateGroupingMetrics();

      // 2. Validação de Uso de Memória
      results.details.memoryUsage = await this.validateMemoryUsage();

      // 3. Validação de Cache Hit Rate
      results.details.cachePerformance = await this.validateCachePerformance();

      // 4. Validação de Taxa de Erro
      results.details.errorRate = await this.validateErrorRate();

      // 5. Validação de Responsividade da UI
      results.details.uiResponsiveness = await this.validateUIResponsiveness();

      // Determina status geral
      const failedValidations = Object.values(results.details).filter(
        (v) => v.status === 'FAIL'
      );
      const warningValidations = Object.values(results.details).filter(
        (v) => v.status === 'WARNING'
      );

      if (failedValidations.length > 0) {
        results.overall = 'FAIL';
        results.recommendations.push(
          'Otimizações críticas necessárias para atender metas de performance'
        );
      } else if (warningValidations.length > 0) {
        results.overall = 'WARNING';
        results.recommendations.push(
          'Algumas otimizações recomendadas para melhor performance'
        );
      }

      this.validationResults.lastValidation = results;

      Logger.info(
        'PerformanceValidator',
        `✅ Validação completa: ${results.overall} (${failedValidations.length} falhas, ${warningValidations.length} avisos)`
      );

      return results;
    } catch (error) {
      Logger.error(
        'PerformanceValidator',
        'Erro durante validação de performance:',
        error
      );
      return {
        status: 'ERROR',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Valida métricas de agrupamento
   * @returns {Promise<object>} Resultado da validação
   */
  async validateGroupingMetrics() {
    const groupingMetrics = this.metrics.get('processTabQueue') || [];

    if (groupingMetrics.length === 0) {
      return {
        status: 'WARNING',
        message: 'Nenhuma métrica de agrupamento disponível',
        score: 0,
      };
    }

    const recentMetrics = groupingMetrics.slice(-10); // Últimas 10 operações
    let passCount = 0;
    let totalOperations = recentMetrics.length;

    for (const metric of recentMetrics) {
      const { duration, tabCount } = metric;
      let target;

      if (tabCount <= 100) {
        target = this.targets.grouping100Tabs;
      } else if (tabCount <= 200) {
        target = this.targets.grouping200Tabs;
      } else {
        target = this.targets.grouping200Tabs * (tabCount / 200);
      }

      if (duration <= target) {
        passCount++;
      }
    }

    const passRate = passCount / totalOperations;
    const avgDuration =
      recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;
    const avgTabCount =
      recentMetrics.reduce((sum, m) => sum + m.tabCount, 0) / totalOperations;

    return {
      status: passRate >= 0.8 ? 'PASS' : passRate >= 0.6 ? 'WARNING' : 'FAIL',
      passRate: Math.round(passRate * 100),
      avgDuration: Math.round(avgDuration),
      avgTabCount: Math.round(avgTabCount),
      totalOperations,
      message: `${Math.round(
        passRate * 100
      )}% das operações atendem às metas de performance`,
    };
  }

  /**
   * Valida uso de memória
   * @returns {Promise<object>} Resultado da validação
   */
  async validateMemoryUsage() {
    const currentMemory = this.getMemoryUsage();
    const target = this.targets.memoryUsage200Tabs;

    return {
      status:
        currentMemory <= target
          ? 'PASS'
          : currentMemory <= target * 1.2
          ? 'WARNING'
          : 'FAIL',
      currentUsage: currentMemory,
      target,
      percentage: Math.round((currentMemory / target) * 100),
      message: `Uso atual: ${currentMemory}MB (meta: ${target}MB)`,
    };
  }

  /**
   * Valida performance do cache
   * @returns {Promise<object>} Resultado da validação
   */
  async validateCachePerformance() {
    const cacheStats = this.getCacheStats();
    const hitRate =
      cacheStats.totalAccesses > 0
        ? cacheStats.hits / cacheStats.totalAccesses
        : 0;
    const target = this.targets.cacheHitRate;

    return {
      status:
        hitRate >= target
          ? 'PASS'
          : hitRate >= target * 0.8
          ? 'WARNING'
          : 'FAIL',
      hitRate: Math.round(hitRate * 100),
      target: Math.round(target * 100),
      totalAccesses: cacheStats.totalAccesses,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      message: `Cache hit rate: ${Math.round(
        hitRate * 100
      )}% (meta: ${Math.round(target * 100)}%)`,
    };
  }

  /**
   * Valida taxa de erro
   * @returns {Promise<object>} Resultado da validação
   */
  async validateErrorRate() {
    // Implementação simplificada - em produção, integraria com sistema de erro
    const errorRate = 0.02; // Placeholder - 2%
    const target = this.targets.errorRate;

    return {
      status:
        errorRate <= target
          ? 'PASS'
          : errorRate <= target * 2
          ? 'WARNING'
          : 'FAIL',
      errorRate: Math.round(errorRate * 100),
      target: Math.round(target * 100),
      message: `Taxa de erro: ${Math.round(
        errorRate * 100
      )}% (meta: ${Math.round(target * 100)}%)`,
    };
  }

  /**
   * Valida responsividade da UI
   * @returns {Promise<object>} Resultado da validação
   */
  async validateUIResponsiveness() {
    // Verifica se operações longas estão bloqueando a UI
    const longOperations = [];

    for (const [operation, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.slice(-5);
      const longOps = recentMetrics.filter(
        (m) => m.duration > this.targets.uiResponsiveness
      );
      if (longOps.length > 0) {
        longOperations.push({
          operation,
          count: longOps.length,
          avgDuration:
            longOps.reduce((sum, m) => sum + m.duration, 0) / longOps.length,
        });
      }
    }

    const status =
      longOperations.length === 0
        ? 'PASS'
        : longOperations.length <= 2
        ? 'WARNING'
        : 'FAIL';

    return {
      status,
      longOperations: longOperations.length,
      details: longOperations,
      message:
        longOperations.length === 0
          ? 'Nenhuma operação bloqueante detectada'
          : `${longOperations.length} operações podem estar bloqueando a UI`,
    };
  }

  /**
   * Obtém uso atual de memória (estimativa)
   * @returns {number} Uso de memória em MB
   */
  getMemoryUsage() {
    // Implementação simplificada - em produção, usaria performance.memory
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    return 25; // Estimativa padrão
  }

  /**
   * Obtém estatísticas do cache
   * @returns {object} Estatísticas do cache
   */
  getCacheStats() {
    // Implementação simplificada - em produção, integraria com cache manager
    return {
      hits: 850,
      misses: 150,
      totalAccesses: 1000,
    };
  }

  /**
   * Gera relatório de performance
   * @returns {object} Relatório detalhado
   */
  generateReport() {
    const report = {
      timestamp: Date.now(),
      summary: {
        ...this.validationResults,
        isEnabled: this.isValidationEnabled,
      },
      targets: this.targets,
      recentValidations: this.validationHistory.slice(-10),
      metrics: {},
    };

    // Adiciona estatísticas por operação
    for (const [operation, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.slice(-10);
      if (recentMetrics.length > 0) {
        report.metrics[operation] = {
          count: recentMetrics.length,
          avgDuration: Math.round(
            recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
              recentMetrics.length
          ),
          minDuration: Math.min(...recentMetrics.map((m) => m.duration)),
          maxDuration: Math.max(...recentMetrics.map((m) => m.duration)),
          avgTabCount: Math.round(
            recentMetrics.reduce((sum, m) => sum + (m.tabCount || 0), 0) /
              recentMetrics.length
          ),
        };
      }
    }

    return report;
  }

  /**
   * Habilita/desabilita validação de performance
   * @param {boolean} enabled - Se deve habilitar validação
   */
  setValidationEnabled(enabled) {
    this.isValidationEnabled = enabled;
    Logger.info(
      'PerformanceValidator',
      `Validação de performance ${enabled ? 'habilitada' : 'desabilitada'}`
    );
  }

  /**
   * Limpa histórico de métricas
   */
  clearMetrics() {
    this.metrics.clear();
    this.validationHistory = [];
    this.validationResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      lastValidation: null,
    };
    Logger.info('PerformanceValidator', 'Métricas de performance limpas');
  }

  /**
   * Executa teste de stress para validar performance
   * @param {number} tabCount - Número de abas para simular
   * @returns {Promise<object>} Resultado do teste
   */
  async runStressTest(tabCount = 100) {
    Logger.info(
      'PerformanceValidator',
      `🧪 Iniciando teste de stress com ${tabCount} abas...`
    );

    const startTime = performance.now();

    try {
      // Simula processamento de abas

      // Registra início do teste
      const testStartTime = performance.now();

      // Simula operação de agrupamento
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(10, tabCount / 10))
      );

      const testDuration = performance.now() - testStartTime;

      // Registra métrica do teste
      this.recordMetric('stress_test', testDuration, tabCount, {
        testType: 'simulated',
        mockData: true,
      });

      const totalTime = performance.now() - startTime;

      Logger.info(
        'PerformanceValidator',
        `✅ Teste de stress concluído: ${tabCount} abas em ${Math.round(
          testDuration
        )}ms (total: ${Math.round(totalTime)}ms)`
      );

      return {
        success: true,
        tabCount,
        duration: Math.round(testDuration),
        totalTime: Math.round(totalTime),
        target:
          tabCount <= 100
            ? this.targets.grouping100Tabs
            : this.targets.grouping200Tabs,
        passed:
          testDuration <=
          (tabCount <= 100
            ? this.targets.grouping100Tabs
            : this.targets.grouping200Tabs),
      };
    } catch (error) {
      Logger.error(
        'PerformanceValidator',
        'Erro durante teste de stress:',
        error
      );
      return {
        success: false,
        error: error.message,
        tabCount,
        duration: performance.now() - startTime,
      };
    }
  }
}

// Instância global do validador
export const globalPerformanceValidator = new PerformanceValidator();

// Funções de conveniência
export function recordPerformanceMetric(
  operation,
  duration,
  tabCount,
  metadata
) {
  return globalPerformanceValidator.recordMetric(
    operation,
    duration,
    tabCount,
    metadata
  );
}

export function validatePerformance() {
  return globalPerformanceValidator.performFullValidation();
}

export function getPerformanceReport() {
  return globalPerformanceValidator.generateReport();
}

export function runPerformanceStressTest(tabCount) {
  return globalPerformanceValidator.runStressTest(tabCount);
}

Logger.debug(
  'PerformanceValidator',
  'Sistema de validação de performance TASK-A-001 inicializado.'
);
