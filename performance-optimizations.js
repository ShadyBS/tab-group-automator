/**
 * @file performance-optimizations.js
 * @description Otimizações de performance para resolver problemas identificados nos logs
 */

import { updateConfig } from './performance-config.js';
import Logger from './logger.js';

/**
 * Aplica otimizações de performance baseadas na análise dos logs de erro
 */
export function applyPerformanceOptimizations() {
  const optimizations = {
    // Reduz concorrência para evitar sobrecarga
    MAX_CONCURRENT_OPERATIONS: 3,        // Reduzido de 5 para 3
    MAX_TAB_CONCURRENCY: 2,             // Reduzido de 4 para 2
    TAB_BATCH_SIZE: 8,                  // Reduzido de 10 para 8
    BATCH_SIZE: 8,                      // Reduzido de 50 para 8
    
    // Aumenta delays para reduzir pressão no sistema
    QUEUE_DELAY: 750,                   // Aumentado de 500 para 750ms
    TITLE_UPDATE_DEBOUNCE: 500,         // Aumentado de 250 para 500ms
    INJECTION_RETRY_DELAY: 1500,        // Aumentado de 1000 para 1500ms
    
    // Reduz tentativas para falhar mais rápido
    MAX_INJECTION_RETRIES: 2,           // Reduzido de 3 para 2
    API_RETRY_COUNT: 2,                 // Reduzido de 3 para 2
    
    // Aumenta intervalos de verificação
    AUTO_COLLAPSE_CHECK_INTERVAL: 45000, // Aumentado de 5000 para 45000ms
    SINGLE_TAB_CHECK_INTERVAL: 20000,    // Aumentado de 1500 para 20000ms
    MEMORY_PRESSURE_CHECK_INTERVAL: 60000, // Aumentado de 30000 para 60000ms
    
    // Reduz threshold de performance para detectar problemas mais cedo
    PERFORMANCE_LOG_THRESHOLD: 800,     // Reduzido de 1000 para 800ms
    
    // Otimiza cache
    MAX_CACHE_SIZE: 500,                // Reduzido de 1000 para 500
    CACHE_CLEANUP_INTERVAL: 600000,     // Aumentado de 300000 para 600000ms (10min)
    
    // Otimiza circuit breaker para ser mais sensível
    CIRCUIT_BREAKER_THRESHOLD: 3,       // Reduzido de 5 para 3
    CIRCUIT_BREAKER_RESET_TIME: 90000,  // Aumentado de 60000 para 90000ms
    
    // Aumenta delays de erro
    ERROR_RETRY_BASE_DELAY: 1500,       // Aumentado de 1000 para 1500ms
    ERROR_RETRY_MAX_DELAY: 45000,       // Aumentado de 30000 para 45000ms
    
    // Reduz rate limiting
    MAX_OPERATIONS_PER_SECOND: 30,      // Reduzido de 50 para 30
    
    // Aumenta delays de processamento paralelo
    GROUP_OPERATION_DELAY: 200,         // Aumentado de 150 para 200ms
    SUB_BATCH_DELAY: 100,               // Aumentado de 50 para 100ms
    
    // Aumenta timeouts
    API_TIMEOUT: 8000,                  // Aumentado de 5000 para 8000ms
    TAB_RENAMING_TIMEOUT: 8000,         // Reduzido de 10000 para 8000ms
    
    // Otimiza limpeza inicial
    INITIAL_CLEANUP_DELAY: 15000        // Aumentado de 10000 para 15000ms
  };
  
  updateConfig(optimizations);
  
  Logger.info('PerformanceOptimizations', 'Otimizações de performance aplicadas:', {
    optimizationsCount: Object.keys(optimizations).length,
    keyChanges: [
      'Reduzida concorrência máxima',
      'Aumentados delays de processamento', 
      'Reduzidas tentativas de retry',
      'Otimizados intervalos de verificação',
      'Melhorado circuit breaker',
      'Reduzido tamanho do cache'
    ]
  });
  
  return optimizations;
}

/**
 * Aplica otimizações específicas para resolver erros de fetchSmartName
 */
export function applyContentScriptOptimizations() {
  const contentScriptOptimizations = {
    // Reduz tentativas de injeção para falhar mais rápido
    MAX_INJECTION_RETRIES: 1,           // Reduzido para 1 tentativa apenas
    INJECTION_RETRY_DELAY: 2000,        // Aumentado para 2 segundos
    
    // Reduz timeout para content scripts
    TAB_RENAMING_TIMEOUT: 5000,         // Reduzido para 5 segundos
    API_TIMEOUT: 6000,                  // Reduzido para 6 segundos
    
    // Reduz concorrência de processamento de nomes
    TAB_RENAMING_MAX_CONCURRENT: 1,     // Apenas 1 por vez
    ITEM_CONCURRENCY: 2,               // Reduzido de 3 para 2
    
    // Aumenta delays entre operações
    TAB_RENAMING_DELAY: 3000,           // Aumentado para 3 segundos
    THROTTLE_DELAY: 200                 // Aumentado de 100 para 200ms
  };
  
  updateConfig(contentScriptOptimizations);
  
  Logger.info('PerformanceOptimizations', 'Otimizações de content script aplicadas:', contentScriptOptimizations);
  
  return contentScriptOptimizations;
}

/**
 * Aplica otimizações para reduzir invalidação de cache
 */
export function applyCacheOptimizations() {
  const cacheOptimizations = {
    // Aumenta TTL do cache para reduzir invalidações
    CACHE_DEFAULT_TTL: 48 * 60 * 60 * 1000,  // Aumentado para 48 horas
    TAB_RENAMING_CACHE_TTL: 600000,          // Aumentado para 10 minutos
    
    // Reduz frequência de limpeza
    CACHE_CLEANUP_INTERVAL: 900000,          // Aumentado para 15 minutos
    TAB_RENAMING_CACHE_CLEANUP_INTERVAL: 1200000, // Aumentado para 20 minutos
    
    // Aumenta threshold para invalidação
    CACHE_DOMAIN_CHANGE_THRESHOLD: 5,        // Aumentado de 3 para 5
    
    // Reduz tamanho máximo para forçar limpeza mais eficiente
    MAX_CACHE_SIZE: 300,                     // Reduzido para 300
    
    // Aumenta delay para salvar cache
    CACHE_SAVE_DELAY: 5000                   // Aumentado para 5 segundos
  };
  
  updateConfig(cacheOptimizations);
  
  Logger.info('PerformanceOptimizations', 'Otimizações de cache aplicadas:', cacheOptimizations);
  
  return cacheOptimizations;
}

/**
 * Aplica todas as otimizações de performance
 */
export function applyAllOptimizations() {
  const generalOpts = applyPerformanceOptimizations();
  const contentOpts = applyContentScriptOptimizations();
  const cacheOpts = applyCacheOptimizations();
  
  Logger.info('PerformanceOptimizations', 'Todas as otimizações aplicadas com sucesso', {
    general: Object.keys(generalOpts).length,
    contentScript: Object.keys(contentOpts).length,
    cache: Object.keys(cacheOpts).length,
    total: Object.keys(generalOpts).length + Object.keys(contentOpts).length + Object.keys(cacheOpts).length
  });
  
  return {
    general: generalOpts,
    contentScript: contentOpts,
    cache: cacheOpts
  };
}

Logger.debug('PerformanceOptimizations', 'Módulo de otimizações de performance carregado.');