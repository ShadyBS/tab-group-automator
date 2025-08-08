/**
 * @file performance-monitor.js
 * @description Sistema de monitoramento de performance em tempo real
 * Implementa tracking de métricas, alertas e relatórios de performance
 */

import Logger from "./logger.js";

/**
 * Monitor de performance em tempo real
 * Rastreia métricas, detecta problemas e gera alertas
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.thresholds = {
      startupTime: 500,           // ms
      moduleLoadTime: 200,        // ms
      memoryUsage: 50 * 1024 * 1024, // 50MB
      cacheHitRate: 0.9,          // 90%
      errorRate: 0.05,            // 5%
      responseTime: 1000,         // ms
      cpuUsage: 0.8,              // 80%
      operationTime: 2000         // ms
    };
    this.alertHandlers = new Set();
    this.reportingInterval = null;
    this.metricsHistory = [];
    this.maxHistorySize = 100;
    this.startTime = performance.now();
  }

  /**
   * Registra uma métrica de performance
   * @param {string} name - Nome da métrica
   * @param {number} value - Valor da métrica
   * @param {string} unit - Unidade da métrica
   * @param {object} metadata - Metadados adicionais
   */
  recordMetric(name, value, unit = 'ms', metadata = {}) {
    const timestamp = Date.now();
    const metric = {
      name,
      value,
      unit,
      timestamp,
      metadata,
      threshold: this.thresholds[name]
    };
    
    // Armazena métrica atual
    this.metrics.set(name, metric);
    
    // Adiciona ao histórico
    this.addToHistory(metric);
    
    // Verifica thresholds
    if (metric.threshold && value > metric.threshold) {
      this.triggerAlert(name, value, metric.threshold, metadata);
    }
    
    // Log para analytics
    this.logMetric(name, metric);
    
    Logger.debug("PerformanceMonitor", `Métrica registrada: ${name} = ${value}${unit}`);
  }

  /**
   * Adiciona métrica ao histórico
   * @param {object} metric - Métrica para adicionar
   */
  addToHistory(metric) {
    this.metricsHistory.push({
      ...metric,
      id: `${metric.name}_${metric.timestamp}`
    });
    
    // Mantém tamanho do histórico
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Dispara alerta de threshold excedido
   * @param {string} name - Nome da métrica
   * @param {number} value - Valor atual
   * @param {number} threshold - Threshold excedido
   * @param {object} metadata - Metadados do contexto
   */
  triggerAlert(name, value, threshold, metadata = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'performance_threshold_exceeded',
      metric: name,
      value,
      threshold,
      severity: this.calculateSeverity(name, value, threshold),
      timestamp: Date.now(),
      metadata,
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Mantém apenas os últimos 50 alertas
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    Logger.warn("PerformanceMonitor", `⚠️ Alerta de Performance: ${name} = ${value} excede threshold ${threshold}`, alert);
    
    // Notifica handlers registrados
    this.notifyAlertHandlers(alert);
    
    // Ações automáticas baseadas na severidade
    this.handleAlertActions(alert);
  }

  /**
   * Calcula severidade do alerta
   * @param {string} name - Nome da métrica
   * @param {number} value - Valor atual
   * @param {number} threshold - Threshold
   * @returns {string} - Severidade (low, medium, high, critical)
   */
  calculateSeverity(name, value, threshold) {
    const ratio = value / threshold;
    
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Notifica handlers de alerta
   * @param {object} alert - Alerta para notificar
   */
  notifyAlertHandlers(alert) {
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        Logger.error("PerformanceMonitor", "Erro em handler de alerta:", error);
      }
    }
  }

  /**
   * Executa ações automáticas baseadas no alerta
   * @param {object} alert - Alerta para processar
   */
  handleAlertActions(alert) {
    switch (alert.severity) {
      case 'critical':
        this.handleCriticalAlert(alert);
        break;
      case 'high':
        this.handleHighAlert(alert);
        break;
      case 'medium':
        this.handleMediumAlert(alert);
        break;
      default:
        // Alertas low são apenas logados
        break;
    }
  }

  /**
   * Trata alertas críticos
   * @param {object} alert - Alerta crítico
   */
  handleCriticalAlert(alert) {
    Logger.error("PerformanceMonitor", `🚨 ALERTA CRÍTICO: ${alert.metric}`, alert);
    
    switch (alert.metric) {
      case 'memoryUsage':
        this.triggerEmergencyMemoryCleanup();
        break;
      case 'startupTime':
        this.triggerStartupOptimization();
        break;
      case 'errorRate':
        this.triggerErrorRateInvestigation();
        break;
    }
  }

  /**
   * Trata alertas de alta severidade
   * @param {object} alert - Alerta de alta severidade
   */
  handleHighAlert(alert) {
    Logger.warn("PerformanceMonitor", `🔥 ALERTA ALTO: ${alert.metric}`, alert);
    
    // Ações menos drásticas que crítico
    switch (alert.metric) {
      case 'moduleLoadTime':
        this.suggestModuleOptimization(alert.metadata);
        break;
      case 'cacheHitRate':
        this.suggestCacheOptimization();
        break;
    }
  }

  /**
   * Trata alertas de média severidade
   * @param {object} alert - Alerta de média severidade
   */
  handleMediumAlert(alert) {
    Logger.info("PerformanceMonitor", `⚠️ ALERTA MÉDIO: ${alert.metric}`, alert);
    
    // Registra para análise posterior
    this.schedulePerformanceAnalysis(alert);
  }

  /**
   * Registra handler de alerta
   * @param {Function} handler - Função para tratar alertas
   */
  addAlertHandler(handler) {
    if (typeof handler === 'function') {
      this.alertHandlers.add(handler);
      Logger.debug("PerformanceMonitor", "Handler de alerta registrado");
    }
  }

  /**
   * Remove handler de alerta
   * @param {Function} handler - Handler para remover
   */
  removeAlertHandler(handler) {
    this.alertHandlers.delete(handler);
    Logger.debug("PerformanceMonitor", "Handler de alerta removido");
  }

  /**
   * Obtém métricas atuais
   * @returns {object} - Métricas atuais
   */
  getCurrentMetrics() {
    const current = {};
    for (const [name, metric] of this.metrics.entries()) {
      current[name] = {
        value: metric.value,
        unit: metric.unit,
        timestamp: metric.timestamp,
        threshold: metric.threshold,
        withinThreshold: !metric.threshold || metric.value <= metric.threshold
      };
    }
    return current;
  }

  /**
   * Gera relatório de performance
   * @param {number} timeRange - Período em ms para análise
   * @returns {object} - Relatório detalhado
   */
  generatePerformanceReport(timeRange = 60 * 60 * 1000) { // 1 hora padrão
    const now = Date.now();
    const cutoff = now - timeRange;
    
    // Filtra métricas do período
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoff);
    const recentAlerts = this.alerts.filter(a => a.timestamp >= cutoff);
    
    // Agrupa métricas por nome
    const metricGroups = {};
    recentMetrics.forEach(metric => {
      if (!metricGroups[metric.name]) {
        metricGroups[metric.name] = [];
      }
      metricGroups[metric.name].push(metric);
    });
    
    // Calcula estatísticas por métrica
    const metricStats = {};
    for (const [name, metrics] of Object.entries(metricGroups)) {
      const values = metrics.map(m => m.value);
      metricStats[name] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        latest: values[values.length - 1],
        trend: this.calculateTrend(values),
        thresholdViolations: metrics.filter(m => m.threshold && m.value > m.threshold).length
      };
    }
    
    // Análise de alertas
    const alertStats = {
      total: recentAlerts.length,
      bySeverity: {
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        high: recentAlerts.filter(a => a.severity === 'high').length,
        medium: recentAlerts.filter(a => a.severity === 'medium').length,
        low: recentAlerts.filter(a => a.severity === 'low').length
      },
      byMetric: {}
    };
    
    recentAlerts.forEach(alert => {
      alertStats.byMetric[alert.metric] = (alertStats.byMetric[alert.metric] || 0) + 1;
    });
    
    const report = {
      timeRange: {
        start: cutoff,
        end: now,
        duration: timeRange
      },
      summary: {
        totalMetrics: recentMetrics.length,
        uniqueMetrics: Object.keys(metricGroups).length,
        totalAlerts: recentAlerts.length,
        uptime: now - this.startTime
      },
      metrics: metricStats,
      alerts: alertStats,
      recommendations: this.generateRecommendations(metricStats, alertStats),
      generatedAt: now
    };
    
    Logger.info("PerformanceMonitor", "Relatório de performance gerado", {
      timeRange: timeRange / 1000 / 60,
      metrics: Object.keys(metricStats).length,
      alerts: recentAlerts.length
    });
    
    return report;
  }

  /**
   * Calcula tendência dos valores
   * @param {number[]} values - Valores para análise
   * @returns {string} - Tendência (increasing, decreasing, stable)
   */
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Gera recomendações baseadas nas métricas
   * @param {object} metricStats - Estatísticas das métricas
   * @param {object} alertStats - Estatísticas dos alertas
   * @returns {string[]} - Lista de recomendações
   */
  generateRecommendations(metricStats, alertStats) {
    const recommendations = [];
    
    // Recomendações baseadas em métricas
    for (const [metric, stats] of Object.entries(metricStats)) {
      if (stats.thresholdViolations > 0) {
        recommendations.push(`Otimizar ${metric}: ${stats.thresholdViolations} violações de threshold`);
      }
      
      if (stats.trend === 'increasing' && this.thresholds[metric]) {
        recommendations.push(`Monitorar ${metric}: tendência crescente detectada`);
      }
    }
    
    // Recomendações baseadas em alertas
    if (alertStats.bySeverity.critical > 0) {
      recommendations.push(`Investigar ${alertStats.bySeverity.critical} alertas críticos imediatamente`);
    }
    
    if (alertStats.total > 10) {
      recommendations.push("Alto número de alertas - considerar ajustar thresholds ou otimizar performance");
    }
    
    // Recomendações específicas
    if (metricStats.startupTime && metricStats.startupTime.avg > 1000) {
      recommendations.push("Implementar lazy loading para reduzir tempo de startup");
    }
    
    if (metricStats.memoryUsage && metricStats.memoryUsage.trend === 'increasing') {
      recommendations.push("Investigar possível memory leak");
    }
    
    return recommendations;
  }

  /**
   * Inicia monitoramento automático
   * @param {number} interval - Intervalo em ms
   */
  startAutoReporting(interval = 5 * 60 * 1000) { // 5 minutos padrão
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    this.reportingInterval = setInterval(() => {
      const report = this.generatePerformanceReport(interval);
      this.logPerformanceReport(report);
    }, interval);
    
    Logger.info("PerformanceMonitor", `Auto-reporting iniciado com intervalo de ${interval / 1000}s`);
  }

  /**
   * Para monitoramento automático
   */
  stopAutoReporting() {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
      Logger.info("PerformanceMonitor", "Auto-reporting parado");
    }
  }

  /**
   * Log do relatório de performance
   * @param {object} report - Relatório para log
   */
  logPerformanceReport(report) {
    Logger.info("PerformanceMonitor", "📊 Relatório de Performance", {
      uptime: `${(report.summary.uptime / 1000 / 60).toFixed(1)}min`,
      metrics: report.summary.uniqueMetrics,
      alerts: report.summary.totalAlerts,
      recommendations: report.recommendations.length
    });
    
    if (report.recommendations.length > 0) {
      Logger.warn("PerformanceMonitor", "💡 Recomendações:", report.recommendations);
    }
  }

  /**
   * Log de métrica para analytics
   * @param {string} name - Nome da métrica
   * @param {object} metric - Dados da métrica
   */
  logMetric(name, metric) {
    // Implementar integração com sistema de analytics se necessário
    // Por enquanto apenas debug log
    if (metric.threshold && metric.value > metric.threshold) {
      Logger.debug("PerformanceMonitor", `📈 Métrica ${name}: ${metric.value}${metric.unit} (threshold: ${metric.threshold})`);
    }
  }

  /**
   * Ações específicas para diferentes tipos de alerta
   */
  triggerEmergencyMemoryCleanup() {
    Logger.error("PerformanceMonitor", "🆘 Acionando limpeza de emergência de memória");
    // Integrar com sistema de limpeza de memória
  }

  triggerStartupOptimization() {
    Logger.error("PerformanceMonitor", "🚀 Acionando otimização de startup");
    // Implementar otimizações de startup
  }

  triggerErrorRateInvestigation() {
    Logger.error("PerformanceMonitor", "🔍 Acionando investigação de taxa de erro");
    // Implementar análise de erros
  }

  suggestModuleOptimization(metadata) {
    Logger.warn("PerformanceMonitor", "📦 Sugerindo otimização de módulo", metadata);
  }

  suggestCacheOptimization() {
    Logger.warn("PerformanceMonitor", "💾 Sugerindo otimização de cache");
  }

  schedulePerformanceAnalysis(alert) {
    Logger.info("PerformanceMonitor", "📋 Agendando análise de performance", alert);
  }

  /**
   * Obtém status atual do monitor
   * @returns {object} - Status do monitor
   */
  getStatus() {
    return {
      isMonitoring: !!this.reportingInterval,
      totalMetrics: this.metrics.size,
      totalAlerts: this.alerts.length,
      unacknowledgedAlerts: this.alerts.filter(a => !a.acknowledged).length,
      uptime: Date.now() - this.startTime,
      thresholds: this.thresholds,
      alertHandlers: this.alertHandlers.size
    };
  }

  /**
   * Reseta todas as métricas e alertas
   */
  reset() {
    this.metrics.clear();
    this.alerts.length = 0;
    this.metricsHistory.length = 0;
    this.startTime = performance.now();
    
    Logger.info("PerformanceMonitor", "Monitor de performance resetado");
  }
}

// Instância global do monitor de performance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export { PerformanceMonitor };