/**
 * @file error-handler.js
 * @description Módulo centralizado para tratamento consistente de erros e recuperação.
 */

import Logger from "./logger.js";

// Tipos de erro categorizados para tratamento específico
export const ErrorType = {
  TAB_NOT_FOUND: 'TAB_NOT_FOUND',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  SCRIPT_INJECTION_FAILED: 'SCRIPT_INJECTION_FAILED',
  UNKNOWN: 'UNKNOWN'
};

// Estratégias de recuperação
export const RecoveryStrategy = {
  RETRY: 'RETRY',
  SKIP: 'SKIP',
  FALLBACK: 'FALLBACK',
  ABORT: 'ABORT'
};

/**
 * Classifica um erro baseado na mensagem de erro
 * @param {Error} error - O erro a ser classificado
 * @returns {string} - Tipo do erro
 */
export function classifyError(error) {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('no tab with id') || message.includes('tab not found')) {
    return ErrorType.TAB_NOT_FOUND;
  }
  if (message.includes('no group with id') || message.includes('invalid tab group id')) {
    return ErrorType.GROUP_NOT_FOUND;
  }
  if (message.includes('permission') || message.includes('access denied')) {
    return ErrorType.PERMISSION_DENIED;
  }
  if (message.includes('cannot access') || message.includes('undefined')) {
    return ErrorType.API_UNAVAILABLE;
  }
  if (message.includes('storage') || message.includes('quota')) {
    return ErrorType.STORAGE_ERROR;
  }
  if (message.includes('script') || message.includes('injection')) {
    return ErrorType.SCRIPT_INJECTION_FAILED;
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * Determina a estratégia de recuperação baseada no tipo de erro e contexto
 * @param {string} errorType - Tipo do erro
 * @param {string} context - Contexto onde o erro ocorreu
 * @returns {string} - Estratégia de recuperação
 */
export function getRecoveryStrategy(errorType, context) {
  switch (errorType) {
    case ErrorType.TAB_NOT_FOUND:
    case ErrorType.GROUP_NOT_FOUND:
      return RecoveryStrategy.SKIP; // Entidades já removidas, pular operação
    
    case ErrorType.PERMISSION_DENIED:
      return RecoveryStrategy.ABORT; // Não pode continuar sem permissões
    
    case ErrorType.API_UNAVAILABLE:
      return context.includes('critical') ? RecoveryStrategy.ABORT : RecoveryStrategy.FALLBACK;
    
    case ErrorType.STORAGE_ERROR:
      return RecoveryStrategy.RETRY; // Tentativas com backoff
    
    case ErrorType.SCRIPT_INJECTION_FAILED:
      return RecoveryStrategy.FALLBACK; // Usar nomenclatura padrão
    
    default:
      return RecoveryStrategy.RETRY;
  }
}

/**
 * Wrapper para operações assíncronas com tratamento de erro robusto
 * @param {Function} operation - Função async a ser executada
 * @param {object} options - Opções de configuração
 * @returns {Promise} - Resultado da operação ou erro tratado
 */
export async function withErrorHandling(operation, options = {}) {
  const {
    context = 'unknown',
    maxRetries = 2,
    retryDelay = 1000,
    fallback = null,
    criticalOperation = false
  } = options;

  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);
      const strategy = getRecoveryStrategy(errorType, criticalOperation ? 'critical' : context);
      
      Logger.debug(
        'ErrorHandler',
        `Tentativa ${attempt + 1}/${maxRetries + 1} falhou em ${context}. Tipo: ${errorType}, Estratégia: ${strategy}`,
        { error: error.message }
      );
      
      switch (strategy) {
        case RecoveryStrategy.SKIP:
          Logger.info('ErrorHandler', `Pulando operação em ${context} - entidade não encontrada.`);
          return null;
        
        case RecoveryStrategy.ABORT:
          Logger.error('ErrorHandler', `Abortando operação em ${context} - erro crítico.`, error);
          throw error;
        
        case RecoveryStrategy.FALLBACK:
          if (fallback) {
            Logger.warn('ErrorHandler', `Usando fallback em ${context}.`);
            return await fallback();
          }
          break;
        
        case RecoveryStrategy.RETRY:
          if (attempt < maxRetries) {
            const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
            Logger.warn('ErrorHandler', `Tentando novamente em ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          break;
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  Logger.error('ErrorHandler', `Todas as tentativas falharam em ${context}.`, lastError);
  throw lastError;
}

/**
 * Handler específico para operações de abas que podem falhar silenciosamente
 * @param {Function} tabOperation - Operação relacionada a abas
 * @param {string} context - Contexto da operação
 * @returns {Promise} - Resultado ou null se a aba não existir mais
 */
export async function handleTabOperation(tabOperation, context) {
  return withErrorHandling(tabOperation, {
    context,
    maxRetries: 1,
    criticalOperation: false
  });
}

/**
 * Handler específico para operações de grupos que podem falhar silenciosamente
 * @param {Function} groupOperation - Operação relacionada a grupos
 * @param {string} context - Contexto da operação
 * @returns {Promise} - Resultado ou null se o grupo não existir mais
 */
export async function handleGroupOperation(groupOperation, context) {
  return withErrorHandling(groupOperation, {
    context,
    maxRetries: 1,
    criticalOperation: false
  });
}

/**
 * Handler para operações críticas que devem ser relatadas mesmo se falharem
 * @param {Function} operation - Operação crítica
 * @param {string} context - Contexto da operação
 * @param {Function} fallback - Função de fallback opcional
 * @returns {Promise} - Resultado da operação
 */
export async function handleCriticalOperation(operation, context, fallback = null) {
  return withErrorHandling(operation, {
    context,
    maxRetries: 3,
    retryDelay: 500,
    fallback,
    criticalOperation: true
  });
}
