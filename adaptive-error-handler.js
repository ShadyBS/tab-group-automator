/**
 * @file adaptive-error-handler.js
 * @description Sistema avançado de tratamento de erros com estratégias contextuais e algoritmos de backoff adaptativos.
 */

import Logger from './logger.js';
import { getConfig } from './performance-config.js';

// Tipos de erro expandidos e categorizados
export const ErrorType = {
  // Erros de entidade não encontrada
  TAB_NOT_FOUND: 'TAB_NOT_FOUND',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  WINDOW_NOT_FOUND: 'WINDOW_NOT_FOUND',

  // Erros de permissão e acesso
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Erros de API e rede
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Erros de armazenamento
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',

  // Erros de script e injeção
  SCRIPT_INJECTION_FAILED: 'SCRIPT_INJECTION_FAILED',
  CONTENT_SCRIPT_ERROR: 'CONTENT_SCRIPT_ERROR',

  // Erros transitórios
  TRANSIENT_ERROR: 'TRANSIENT_ERROR',
  TEMPORARY_UNAVAILABLE: 'TEMPORARY_UNAVAILABLE',

  // Erros de validação
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',

  // Erros desconhecidos
  UNKNOWN: 'UNKNOWN',
};

// Estratégias de recuperação expandidas
export const RecoveryStrategy = {
  IMMEDIATE_RETRY: 'IMMEDIATE_RETRY', // Retry imediato para erros transitórios
  LINEAR_BACKOFF: 'LINEAR_BACKOFF', // Backoff linear para erros de rede
  EXPONENTIAL_BACKOFF: 'EXPONENTIAL_BACKOFF', // Backoff exponencial para erros persistentes
  FIBONACCI_BACKOFF: 'FIBONACCI_BACKOFF', // Backoff fibonacci para casos especiais
  JITTERED_BACKOFF: 'JITTERED_BACKOFF', // Backoff com jitter para evitar thundering herd
  SKIP: 'SKIP', // Pular operação
  FALLBACK: 'FALLBACK', // Usar fallback
  ABORT: 'ABORT', // Abortar operação
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER', // Circuit breaker para falhas repetidas
};

// Algoritmos de backoff
export const BackoffAlgorithm = {
  IMMEDIATE: () => 0,
  LINEAR: (attempt, baseDelay = 1000) => baseDelay * attempt,
  EXPONENTIAL: (attempt, baseDelay = 1000) => baseDelay * Math.pow(2, attempt),
  FIBONACCI: (attempt, baseDelay = 1000) => {
    const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
    return baseDelay * fib(attempt + 1);
  },
  JITTERED: (attempt, baseDelay = 1000) => {
    const exponential = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponential; // 10% jitter
    return exponential + jitter;
  },
};

/**
 * Classe para gerenciamento avançado de erros com estratégias contextuais.
 * Esta classe implementa um sistema robusto de tratamento de erros que classifica
 * diferentes tipos de erro, aplica estratégias de recuperação (como retentativas
 * com backoff), e usa um circuit breaker para prevenir falhas em cascata.
 */
export class AdaptiveErrorHandler {
  constructor() {
    // Configurações de estratégias por tipo de erro
    this.errorStrategies = new Map([
      // Erros de entidade não encontrada - skip imediato
      [
        ErrorType.TAB_NOT_FOUND,
        { strategy: RecoveryStrategy.SKIP, maxRetries: 0 },
      ],
      [
        ErrorType.GROUP_NOT_FOUND,
        { strategy: RecoveryStrategy.SKIP, maxRetries: 0 },
      ],
      [
        ErrorType.WINDOW_NOT_FOUND,
        { strategy: RecoveryStrategy.SKIP, maxRetries: 0 },
      ],

      // Erros de permissão - abort ou fallback
      [
        ErrorType.PERMISSION_DENIED,
        { strategy: RecoveryStrategy.ABORT, maxRetries: 0 },
      ],
      [
        ErrorType.ACCESS_DENIED,
        { strategy: RecoveryStrategy.FALLBACK, maxRetries: 1 },
      ],
      [
        ErrorType.INSUFFICIENT_PERMISSIONS,
        { strategy: RecoveryStrategy.ABORT, maxRetries: 0 },
      ],

      // Erros de API e rede - backoff adaptativo
      [
        ErrorType.API_UNAVAILABLE,
        { strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF, maxRetries: 3 },
      ],
      [
        ErrorType.NETWORK_ERROR,
        { strategy: RecoveryStrategy.JITTERED_BACKOFF, maxRetries: 4 },
      ],
      [
        ErrorType.TIMEOUT_ERROR,
        { strategy: RecoveryStrategy.LINEAR_BACKOFF, maxRetries: 2 },
      ],
      [
        ErrorType.RATE_LIMITED,
        { strategy: RecoveryStrategy.FIBONACCI_BACKOFF, maxRetries: 5 },
      ],

      // Erros de armazenamento - backoff exponencial
      [
        ErrorType.STORAGE_ERROR,
        { strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF, maxRetries: 3 },
      ],
      [
        ErrorType.QUOTA_EXCEEDED,
        { strategy: RecoveryStrategy.FALLBACK, maxRetries: 1 },
      ],
      [
        ErrorType.STORAGE_UNAVAILABLE,
        { strategy: RecoveryStrategy.LINEAR_BACKOFF, maxRetries: 2 },
      ],

      // Erros de script - fallback com retry limitado
      [
        ErrorType.SCRIPT_INJECTION_FAILED,
        { strategy: RecoveryStrategy.FALLBACK, maxRetries: 2 },
      ],
      [
        ErrorType.CONTENT_SCRIPT_ERROR,
        { strategy: RecoveryStrategy.FALLBACK, maxRetries: 1 },
      ],

      // Erros transitórios - retry imediato
      [
        ErrorType.TRANSIENT_ERROR,
        { strategy: RecoveryStrategy.IMMEDIATE_RETRY, maxRetries: 3 },
      ],
      [
        ErrorType.TEMPORARY_UNAVAILABLE,
        { strategy: RecoveryStrategy.LINEAR_BACKOFF, maxRetries: 2 },
      ],

      // Erros de validação - abort
      [
        ErrorType.VALIDATION_ERROR,
        { strategy: RecoveryStrategy.ABORT, maxRetries: 0 },
      ],
      [
        ErrorType.INVALID_ARGUMENT,
        { strategy: RecoveryStrategy.ABORT, maxRetries: 0 },
      ],

      // Erro desconhecido - backoff conservador
      [
        ErrorType.UNKNOWN,
        { strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF, maxRetries: 2 },
      ],
    ]);

    // Configurações contextuais
    this.contextualConfigs = new Map([
      ['critical', { multiplier: 1.5, maxRetries: 5 }],
      ['background', { multiplier: 1.0, maxRetries: 3 }],
      ['user-initiated', { multiplier: 0.8, maxRetries: 4 }],
      ['batch-operation', { multiplier: 1.2, maxRetries: 2 }],
      ['memory-cleanup', { multiplier: 0.5, maxRetries: 1 }],
    ]);

    // Circuit breaker para falhas repetidas
    this.circuitBreakers = new Map();

    // Estatísticas de erros
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByContext: new Map(),
      recoverySuccesses: 0,
      circuitBreakerTrips: 0,
    };
  }

  /**
   * Classifica um erro com base na sua mensagem e stack trace para determinar o tipo de erro.
   * @param {Error} error - O objeto de erro a ser classificado.
   * @returns {ErrorType} O tipo de erro classificado.
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const stack = error.stack?.toLowerCase() || '';

    // Erros de entidade não encontrada
    if (
      message.includes('no tab with id') ||
      message.includes('tab not found')
    ) {
      return ErrorType.TAB_NOT_FOUND;
    }
    if (
      message.includes('no group with id') ||
      message.includes('invalid tab group id')
    ) {
      return ErrorType.GROUP_NOT_FOUND;
    }
    if (
      message.includes('no window with id') ||
      message.includes('window not found')
    ) {
      return ErrorType.WINDOW_NOT_FOUND;
    }

    // Erros de permissão
    if (
      message.includes('permission denied') ||
      message.includes('access denied')
    ) {
      return ErrorType.PERMISSION_DENIED;
    }
    if (message.includes('insufficient permissions')) {
      return ErrorType.INSUFFICIENT_PERMISSIONS;
    }
    if (message.includes('cannot access')) {
      return ErrorType.ACCESS_DENIED;
    }

    // Erros de API e rede
    if (
      message.includes('network error') ||
      message.includes('connection failed')
    ) {
      return ErrorType.NETWORK_ERROR;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    if (
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return ErrorType.RATE_LIMITED;
    }
    if (
      message.includes('api unavailable') ||
      message.includes('service unavailable')
    ) {
      return ErrorType.API_UNAVAILABLE;
    }

    // Erros de armazenamento
    if (
      message.includes('quota exceeded') ||
      message.includes('storage quota')
    ) {
      return ErrorType.QUOTA_EXCEEDED;
    }
    if (
      message.includes('storage error') ||
      message.includes('storage unavailable')
    ) {
      return ErrorType.STORAGE_ERROR;
    }

    // Erros de script
    if (
      message.includes('script injection') ||
      message.includes('injection failed')
    ) {
      return ErrorType.SCRIPT_INJECTION_FAILED;
    }
    if (
      message.includes('content script') ||
      stack.includes('content-script')
    ) {
      return ErrorType.CONTENT_SCRIPT_ERROR;
    }

    // Erros transitórios
    if (message.includes('temporary') || message.includes('transient')) {
      return ErrorType.TRANSIENT_ERROR;
    }
    if (message.includes('temporarily unavailable')) {
      return ErrorType.TEMPORARY_UNAVAILABLE;
    }

    // Erros de validação
    if (
      message.includes('validation') ||
      message.includes('invalid argument')
    ) {
      return ErrorType.VALIDATION_ERROR;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Obtém a configuração de recuperação apropriada com base no tipo de erro e no contexto da operação.
   * @param {ErrorType} errorType - O tipo de erro classificado.
   * @param {string} context - O contexto da operação (ex: 'critical', 'background').
   * @returns {{strategy: RecoveryStrategy, maxRetries: number, baseDelay: number, maxDelay: number}} A configuração da estratégia.
   */
  getStrategyConfig(errorType, context) {
    const baseConfig =
      this.errorStrategies.get(errorType) ||
      this.errorStrategies.get(ErrorType.UNKNOWN);

    const contextConfig =
      this.contextualConfigs.get(context) ||
      this.contextualConfigs.get('background');

    return {
      strategy: baseConfig.strategy,
      maxRetries: Math.min(
        baseConfig.maxRetries * contextConfig.multiplier,
        10
      ),
      baseDelay: getConfig('ERROR_RETRY_BASE_DELAY') || 1000,
      maxDelay: getConfig('ERROR_RETRY_MAX_DELAY') || 30000,
    };
  }

  /**
   * Calcula o tempo de espera (delay) para a próxima tentativa com base na estratégia de backoff.
   * @param {RecoveryStrategy} strategy - A estratégia de recuperação a ser usada.
   * @param {number} attempt - O número da tentativa atual.
   * @param {number} baseDelay - O tempo de espera base em milissegundos.
   * @param {number} maxDelay - O tempo de espera máximo em milissegundos.
   * @returns {number} O tempo de espera calculado em milissegundos.
   */
  calculateBackoffDelay(strategy, attempt, baseDelay, maxDelay) {
    let delay;

    switch (strategy) {
      case RecoveryStrategy.IMMEDIATE_RETRY:
        delay = BackoffAlgorithm.IMMEDIATE(attempt);
        break;
      case RecoveryStrategy.LINEAR_BACKOFF:
        delay = BackoffAlgorithm.LINEAR(attempt, baseDelay);
        break;
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        delay = BackoffAlgorithm.EXPONENTIAL(attempt, baseDelay);
        break;
      case RecoveryStrategy.FIBONACCI_BACKOFF:
        delay = BackoffAlgorithm.FIBONACCI(attempt, baseDelay);
        break;
      case RecoveryStrategy.JITTERED_BACKOFF:
        delay = BackoffAlgorithm.JITTERED(attempt, baseDelay);
        break;
      default:
        delay = BackoffAlgorithm.EXPONENTIAL(attempt, baseDelay);
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * Verifica se o circuit breaker deve ser ativado para um determinado contexto e tipo de erro.
   * @param {string} context - O contexto da operação.
   * @param {ErrorType} errorType - O tipo de erro.
   * @returns {boolean} `true` se o circuit breaker for ativado, `false` caso contrário.
   */
  shouldTripCircuitBreaker(context, errorType) {
    const key = `${context}-${errorType}`;
    const breaker = this.circuitBreakers.get(key) || {
      failures: 0,
      lastFailure: 0,
    };

    const now = Date.now();
    const threshold = getConfig('CIRCUIT_BREAKER_THRESHOLD') || 5;
    const resetTime = getConfig('CIRCUIT_BREAKER_RESET_TIME') || 60000; // 1 minuto

    // Reset circuit breaker se passou tempo suficiente
    if (now - breaker.lastFailure > resetTime) {
      breaker.failures = 0;
    }

    breaker.failures++;
    breaker.lastFailure = now;
    this.circuitBreakers.set(key, breaker);

    if (breaker.failures >= threshold) {
      this.errorStats.circuitBreakerTrips++;
      Logger.warn(
        'AdaptiveErrorHandler',
        `Circuit breaker ativado para ${key} após ${breaker.failures} falhas`
      );
      return true;
    }

    return false;
  }

  /**
   * Executa uma operação com tratamento de erro adaptativo, aplicando retentativas e estratégias de recuperação.
   * @param {Function} operation - A função (potencialmente assíncrona) a ser executada.
   * @param {object} [options={}] - Opções para personalizar o tratamento de erro.
   * @param {string} [options.context='background'] - O contexto da operação.
   * @param {Function|null} [options.fallback=null] - Uma função de fallback a ser executada se as retentativas falharem.
   * @param {boolean} [options.criticalOperation=false] - Se a operação é crítica.
   * @param {number|null} [options.customRetries=null] - Número personalizado de retentativas.
   * @param {Function|null} [options.onRetry=null] - Callback a ser executado em cada retentativa.
   * @param {Function|null} [options.onError=null] - Callback a ser executado em cada erro.
   * @returns {Promise<any>} O resultado da operação ou do fallback.
   * @throws {Error} Se todas as tentativas e o fallback falharem.
   */
  async executeWithAdaptiveHandling(operation, options = {}) {
    const {
      context = 'background',
      fallback = null,
      criticalOperation = false,
      customRetries = null,
      onRetry = null,
      onError = null,
    } = options;

    let lastError = null;
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition -- intentional infinite retry loop, exited by break/throw
    while (true) {
      try {
        const result = await operation();

        // Sucesso - atualiza estatísticas
        if (attempt > 0) {
          this.errorStats.recoverySuccesses++;
          Logger.debug(
            'AdaptiveErrorHandler',
            `Recuperação bem-sucedida após ${attempt} tentativas em ${context}`
          );
        }

        return result;
      } catch (error) {
        lastError = error;
        this.errorStats.totalErrors++;

        const errorType = this.classifyError(error);

        // Atualiza estatísticas
        this.errorStats.errorsByType.set(
          errorType,
          (this.errorStats.errorsByType.get(errorType) || 0) + 1
        );
        this.errorStats.errorsByContext.set(
          context,
          (this.errorStats.errorsByContext.get(context) || 0) + 1
        );

        // Callback de erro personalizado
        if (onError) {
          await onError(error, errorType, attempt);
        }

        // Verifica circuit breaker
        if (this.shouldTripCircuitBreaker(context, errorType)) {
          Logger.error(
            'AdaptiveErrorHandler',
            `Circuit breaker ativo - abortando operação em ${context}`
          );
          throw new Error(`Circuit breaker ativo para ${context}-${errorType}`);
        }

        const strategyConfig = this.getStrategyConfig(
          errorType,
          criticalOperation ? 'critical' : context
        );
        const maxRetries =
          customRetries !== null ? customRetries : strategyConfig.maxRetries;

        Logger.debug(
          'AdaptiveErrorHandler',
          `Tentativa ${
            attempt + 1
          } falhou em ${context}. Tipo: ${errorType}, Estratégia: ${
            strategyConfig.strategy
          }`,
          { error: error.message }
        );

        // Verifica se deve continuar tentando
        if (attempt >= maxRetries) {
          Logger.error(
            'AdaptiveErrorHandler',
            `Todas as ${maxRetries + 1} tentativas falharam em ${context}`,
            lastError
          );
          break;
        }

        // Aplica estratégia de recuperação
        switch (strategyConfig.strategy) {
          case RecoveryStrategy.SKIP:
            Logger.info(
              'AdaptiveErrorHandler',
              `Pulando operação em ${context} - ${errorType}`
            );
            return null;

          case RecoveryStrategy.ABORT:
            Logger.error(
              'AdaptiveErrorHandler',
              `Abortando operação em ${context} - ${errorType}`,
              error
            );
            throw error;

          case RecoveryStrategy.FALLBACK:
            if (fallback) {
              Logger.warn(
                'AdaptiveErrorHandler',
                `Usando fallback em ${context} - ${errorType}`
              );
              try {
                return await fallback();
              } catch (fallbackError) {
                Logger.error(
                  'AdaptiveErrorHandler',
                  `Fallback também falhou em ${context}`,
                  fallbackError
                );
                throw fallbackError;
              }
            }
            // Se não há fallback, continua com retry
            break;

          case RecoveryStrategy.CIRCUIT_BREAKER:
            Logger.warn(
              'AdaptiveErrorHandler',
              `Circuit breaker ativado para ${context}`
            );
            throw new Error(`Circuit breaker ativo para ${context}`);
        }

        // Calcula delay para próxima tentativa
        const delay = this.calculateBackoffDelay(
          strategyConfig.strategy,
          attempt,
          strategyConfig.baseDelay,
          strategyConfig.maxDelay
        );

        if (delay > 0) {
          Logger.debug(
            'AdaptiveErrorHandler',
            `Aguardando ${delay}ms antes da próxima tentativa...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Callback de retry personalizado
        if (onRetry) {
          await onRetry(attempt, delay, errorType);
        }

        attempt++;
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError;
  }

  /**
   * Obtém as estatísticas de erros acumuladas.
   * @returns {object} Um objeto com estatísticas detalhadas sobre os erros.
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType),
      errorsByContext: Object.fromEntries(this.errorStats.errorsByContext),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      timestamp: Date.now(),
    };
  }

  /**
   * Reseta todas as estatísticas de erros e o estado dos circuit breakers.
   */
  resetStats() {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByContext: new Map(),
      recoverySuccesses: 0,
      circuitBreakerTrips: 0,
    };
    this.circuitBreakers.clear();
  }

  /**
   * Define uma estratégia de recuperação personalizada para um tipo de erro específico.
   * @param {ErrorType} errorType - O tipo de erro a ser configurado.
   * @param {object} config - A nova configuração da estratégia (ex: `{ strategy: RecoveryStrategy.SKIP, maxRetries: 0 }`).
   */
  setCustomStrategy(errorType, config) {
    this.errorStrategies.set(errorType, config);
  }

  /**
   * Define uma configuração personalizada para um contexto de operação específico.
   * @param {string} context - O contexto a ser configurado.
   * @param {object} config - A nova configuração contextual (ex: `{ multiplier: 2.0, maxRetries: 5 }`).
   */
  setContextualConfig(context, config) {
    this.contextualConfigs.set(context, config);
  }
}

// Instância global do handler adaptativo
export const globalAdaptiveErrorHandler = new AdaptiveErrorHandler();

// Funções de compatibilidade com o sistema anterior

/**
 * Classifica um erro usando a instância global do `AdaptiveErrorHandler`.
 * @param {Error} error - O erro a ser classificado.
 * @returns {ErrorType} O tipo de erro classificado.
 */
export function classifyError(error) {
  return globalAdaptiveErrorHandler.classifyError(error);
}

/**
 * Obtém a estratégia de recuperação para um tipo de erro e contexto usando a instância global.
 * @param {ErrorType} errorType - O tipo de erro.
 * @param {string} context - O contexto da operação.
 * @returns {RecoveryStrategy} A estratégia de recuperação recomendada.
 */
export function getRecoveryStrategy(errorType, context) {
  const config = globalAdaptiveErrorHandler.getStrategyConfig(
    errorType,
    context
  );
  return config.strategy;
}

/**
 * Wrapper para `executeWithAdaptiveHandling` da instância global.
 * @param {Function} operation - A operação a ser executada.
 * @param {object} [options={}] - Opções de tratamento de erro.
 * @returns {Promise<any>} O resultado da operação.
 */
export async function withErrorHandling(operation, options = {}) {
  return globalAdaptiveErrorHandler.executeWithAdaptiveHandling(
    operation,
    options
  );
}

/**
 * Wrapper de tratamento de erro pré-configurado para operações comuns relacionadas a abas.
 * @param {Function} tabOperation - A operação de aba a ser executada.
 * @param {string} context - Um identificador de contexto para a operação.
 * @returns {Promise<any>} O resultado da operação.
 */
export async function handleTabOperation(tabOperation, context) {
  return globalAdaptiveErrorHandler.executeWithAdaptiveHandling(tabOperation, {
    context: `tab-${context}`,
    customRetries: 1,
    criticalOperation: false,
  });
}

/**
 * Wrapper de tratamento de erro pré-configurado para operações comuns relacionadas a grupos.
 * @param {Function} groupOperation - A operação de grupo a ser executada.
 * @param {string} context - Um identificador de contexto para a operação.
 * @returns {Promise<any>} O resultado da operação.
 */
export async function handleGroupOperation(groupOperation, context) {
  return globalAdaptiveErrorHandler.executeWithAdaptiveHandling(
    groupOperation,
    {
      context: `group-${context}`,
      customRetries: 1,
      criticalOperation: false,
    }
  );
}

/**
 * Wrapper de tratamento de erro pré-configurado para operações críticas.
 * Usa mais retentativas e uma configuração mais agressiva.
 * @param {Function} operation - A operação crítica a ser executada.
 * @param {string} context - Um identificador de contexto para a operação.
 * @param {Function|null} [fallback=null] - Uma função de fallback a ser executada em caso de falha total.
 * @returns {Promise<any>} O resultado da operação.
 */
export async function handleCriticalOperation(
  operation,
  context,
  fallback = null
) {
  return globalAdaptiveErrorHandler.executeWithAdaptiveHandling(operation, {
    context: `critical-${context}`,
    fallback,
    criticalOperation: true,
    customRetries: 5,
  });
}

Logger.debug(
  'AdaptiveErrorHandler',
  'Sistema de tratamento adaptativo de erros inicializado.'
);
