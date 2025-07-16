/**
 * @file memory-manager.js
 * @description Gerenciador de memória para limpar recursos orfãos e prevenir vazamentos de memória.
 */

import Logger from "./logger.js";
import { withErrorHandling } from "./error-handler.js";

// Limites de tamanho para estruturas de dados
const MEMORY_LIMITS = {
  TAB_GROUP_MAP: 5000,           // Máximo de entradas no mapa aba-grupo
  TITLE_UPDATERS: 100,           // Máximo de updaters pendentes
  GROUP_ACTIVITY: 1000,          // Máximo de atividades de grupo rastreadas
  SMART_NAME_CACHE: 2000,        // Máximo de nomes em cache
  INJECTION_FAILURES: 500,       // Máximo de falhas de injeção rastreadas
  PENDING_GROUPS: 50,            // Máximo de grupos pendentes
  SINGLE_TAB_TIMESTAMPS: 200     // Máximo de timestamps de abas únicas
};

// Configurações de limpeza
const CLEANUP_CONFIG = {
  INTERVAL: 5 * 60 * 1000,       // 5 minutos
  STALE_THRESHOLD: 30 * 60 * 1000, // 30 minutos para dados obsoletos
  BATCH_SIZE: 100,               // Processar em lotes para evitar bloqueio
  MAX_AGE_CACHE: 24 * 60 * 60 * 1000, // 24 horas para cache
  MAX_AGE_FAILURES: 60 * 60 * 1000     // 1 hora para falhas de injeção
};

let cleanupInterval = null;
let memoryStats = {
  lastCleanup: Date.now(),
  totalCleaned: 0,
  cleanupCycles: 0
};

/**
 * Obtém estatísticas atuais de uso de memória
 * @returns {object} Estatísticas de memória
 */
export function getMemoryStats() {
  return {
    ...memoryStats,
    timestamp: Date.now()
  };
}

/**
 * Verifica se uma aba ainda existe
 * @param {number} tabId - ID da aba
 * @returns {Promise<boolean>} True se a aba existe
 */
async function tabExists(tabId) {
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
async function groupExists(groupId) {
  if (!groupId || groupId === browser.tabs.TAB_ID_NONE) return false;
  try {
    await browser.tabGroups.get(groupId);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Limpa entradas órfãs do mapa tab-grupo
 * @param {Map} tabGroupMap - Mapa a ser limpo
 * @returns {Promise<number>} Número de entradas removidas
 */
export async function cleanupTabGroupMap(tabGroupMap) {
  return await withErrorHandling(async () => {
    let removedCount = 0;
    const entries = Array.from(tabGroupMap.entries());
    
    // Processa em lotes para evitar sobrecarga
    for (let i = 0; i < entries.length; i += CLEANUP_CONFIG.BATCH_SIZE) {
      const batch = entries.slice(i, i + CLEANUP_CONFIG.BATCH_SIZE);
      
      for (const [tabId, groupId] of batch) {
        const tabStillExists = await tabExists(tabId);
        const groupStillExists = await groupExists(groupId);
        
        if (!tabStillExists || !groupStillExists) {
          tabGroupMap.delete(tabId);
          removedCount++;
        }
      }
      
      // Pequena pausa entre lotes
      if (i + CLEANUP_CONFIG.BATCH_SIZE < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Aplica limite de tamanho se necessário
    if (tabGroupMap.size > MEMORY_LIMITS.TAB_GROUP_MAP) {
      const excess = tabGroupMap.size - MEMORY_LIMITS.TAB_GROUP_MAP;
      const oldEntries = Array.from(tabGroupMap.entries()).slice(0, excess);
      oldEntries.forEach(([tabId]) => tabGroupMap.delete(tabId));
      removedCount += excess;
      Logger.warn("MemoryManager", `Limite do tabGroupMap excedido. Removidas ${excess} entradas antigas.`);
    }
    
    Logger.debug("MemoryManager", `TabGroupMap: ${removedCount} entradas órfãs removidas. Tamanho atual: ${tabGroupMap.size}`);
    return removedCount;
  }, {
    context: 'cleanupTabGroupMap',
    maxRetries: 2,
    criticalOperation: false
  }) || 0;
}

/**
 * Limpa timeouts expirados de atualizadores de título
 * @param {Map} debouncedTitleUpdaters - Mapa de updaters
 * @returns {Promise<number>} Número de entradas removidas
 */
export async function cleanupTitleUpdaters(debouncedTitleUpdaters) {
  return await withErrorHandling(async () => {
    let removedCount = 0;
    
    for (const [groupId, timeoutId] of debouncedTitleUpdaters.entries()) {
      const groupStillExists = await groupExists(groupId);
      
      if (!groupStillExists) {
        clearTimeout(timeoutId);
        debouncedTitleUpdaters.delete(groupId);
        removedCount++;
      }
    }
    
    // Aplica limite de tamanho
    if (debouncedTitleUpdaters.size > MEMORY_LIMITS.TITLE_UPDATERS) {
      const excess = debouncedTitleUpdaters.size - MEMORY_LIMITS.TITLE_UPDATERS;
      const oldEntries = Array.from(debouncedTitleUpdaters.entries()).slice(0, excess);
      oldEntries.forEach(([groupId, timeoutId]) => {
        clearTimeout(timeoutId);
        debouncedTitleUpdaters.delete(groupId);
      });
      removedCount += excess;
      Logger.warn("MemoryManager", `Limite do debouncedTitleUpdaters excedido. Removidas ${excess} entradas.`);
    }
    
    Logger.debug("MemoryManager", `TitleUpdaters: ${removedCount} entradas órfãs removidas. Tamanho atual: ${debouncedTitleUpdaters.size}`);
    return removedCount;
  }, {
    context: 'cleanupTitleUpdaters',
    maxRetries: 1,
    criticalOperation: false
  }) || 0;
}

/**
 * Limpa atividades de grupos obsoletas
 * @param {Map} groupActivity - Mapa de atividades
 * @returns {Promise<number>} Número de entradas removidas
 */
export async function cleanupGroupActivity(groupActivity) {
  return await withErrorHandling(async () => {
    let removedCount = 0;
    const now = Date.now();
    const staleThreshold = now - CLEANUP_CONFIG.STALE_THRESHOLD;
    
    for (const [groupId, lastActivity] of groupActivity.entries()) {
      const groupStillExists = await groupExists(groupId);
      const isStale = lastActivity < staleThreshold;
      
      if (!groupStillExists || isStale) {
        groupActivity.delete(groupId);
        removedCount++;
      }
    }
    
    // Aplica limite de tamanho
    if (groupActivity.size > MEMORY_LIMITS.GROUP_ACTIVITY) {
      const excess = groupActivity.size - MEMORY_LIMITS.GROUP_ACTIVITY;
      const sortedEntries = Array.from(groupActivity.entries())
        .sort(([,a], [,b]) => a - b) // Ordena por atividade mais antiga
        .slice(0, excess);
      
      sortedEntries.forEach(([groupId]) => groupActivity.delete(groupId));
      removedCount += excess;
      Logger.warn("MemoryManager", `Limite do groupActivity excedido. Removidas ${excess} entradas antigas.`);
    }
    
    Logger.debug("MemoryManager", `GroupActivity: ${removedCount} entradas obsoletas removidas. Tamanho atual: ${groupActivity.size}`);
    return removedCount;
  }, {
    context: 'cleanupGroupActivity',
    maxRetries: 1,
    criticalOperation: false
  }) || 0;
}

/**
 * Limpa timestamps de grupos com aba única obsoletos
 * @param {Map} singleTabGroupTimestamps - Mapa de timestamps
 * @returns {Promise<number>} Número de entradas removidas
 */
export async function cleanupSingleTabTimestamps(singleTabGroupTimestamps) {
  return await withErrorHandling(async () => {
    let removedCount = 0;
    const now = Date.now();
    const staleThreshold = now - CLEANUP_CONFIG.STALE_THRESHOLD;
    
    for (const [groupId, timestamp] of singleTabGroupTimestamps.entries()) {
      const groupStillExists = await groupExists(groupId);
      const isStale = timestamp < staleThreshold;
      
      if (!groupStillExists || isStale) {
        singleTabGroupTimestamps.delete(groupId);
        removedCount++;
      }
    }
    
    // Aplica limite de tamanho
    if (singleTabGroupTimestamps.size > MEMORY_LIMITS.SINGLE_TAB_TIMESTAMPS) {
      const excess = singleTabGroupTimestamps.size - MEMORY_LIMITS.SINGLE_TAB_TIMESTAMPS;
      const sortedEntries = Array.from(singleTabGroupTimestamps.entries())
        .sort(([,a], [,b]) => a - b)
        .slice(0, excess);
      
      sortedEntries.forEach(([groupId]) => singleTabGroupTimestamps.delete(groupId));
      removedCount += excess;
      Logger.warn("MemoryManager", `Limite do singleTabGroupTimestamps excedido. Removidas ${excess} entradas antigas.`);
    }
    
    Logger.debug("MemoryManager", `SingleTabTimestamps: ${removedCount} entradas obsoletas removidas. Tamanho atual: ${singleTabGroupTimestamps.size}`);
    return removedCount;
  }, {
    context: 'cleanupSingleTabTimestamps',
    maxRetries: 1,
    criticalOperation: false
  }) || 0;
}

/**
 * Limpa cache de nomes inteligentes obsoletos
 * @param {Map} smartNameCache - Cache de nomes
 * @returns {number} Número de entradas removidas
 */
export function cleanupSmartNameCache(smartNameCache) {
  let removedCount = 0;
  
  // Aplica apenas limite de tamanho para o cache (não há como verificar se hostname ainda é válido)
  if (smartNameCache.size > MEMORY_LIMITS.SMART_NAME_CACHE) {
    const excess = smartNameCache.size - MEMORY_LIMITS.SMART_NAME_CACHE;
    const entries = Array.from(smartNameCache.keys()).slice(0, excess);
    entries.forEach(hostname => smartNameCache.delete(hostname));
    removedCount = excess;
    Logger.warn("MemoryManager", `Limite do smartNameCache excedido. Removidas ${excess} entradas antigas.`);
  }
  
  Logger.debug("MemoryManager", `SmartNameCache: ${removedCount} entradas antigas removidas. Tamanho atual: ${smartNameCache.size}`);
  return removedCount;
}

/**
 * Limpa falhas de injeção obsoletas
 * @param {Map} injectionFailureMap - Mapa de falhas
 * @returns {Promise<number>} Número de entradas removidas
 */
export async function cleanupInjectionFailures(injectionFailureMap) {
  return await withErrorHandling(async () => {
    let removedCount = 0;
    
    const entries = Array.from(injectionFailureMap.keys());
    for (const tabId of entries) {
      const tabStillExists = await tabExists(tabId);
      if (!tabStillExists) {
        injectionFailureMap.delete(tabId);
        removedCount++;
      }
    }
    
    // Aplica limite de tamanho
    if (injectionFailureMap.size > MEMORY_LIMITS.INJECTION_FAILURES) {
      const excess = injectionFailureMap.size - MEMORY_LIMITS.INJECTION_FAILURES;
      const oldEntries = Array.from(injectionFailureMap.keys()).slice(0, excess);
      oldEntries.forEach(tabId => injectionFailureMap.delete(tabId));
      removedCount += excess;
      Logger.warn("MemoryManager", `Limite do injectionFailureMap excedido. Removidas ${excess} entradas antigas.`);
    }
    
    Logger.debug("MemoryManager", `InjectionFailures: ${removedCount} entradas órfãs removidas. Tamanho atual: ${injectionFailureMap.size}`);
    return removedCount;
  }, {
    context: 'cleanupInjectionFailures',
    maxRetries: 1,
    criticalOperation: false
  }) || 0;
}

/**
 * Limpa grupos pendentes obsoletos
 * @param {Map} pendingAutomaticGroups - Mapa de grupos pendentes
 * @returns {Promise<number>} Número de entradas removidas
 */
export async function cleanupPendingGroups(pendingAutomaticGroups) {
  return await withErrorHandling(async () => {
    let removedCount = 0;
    
    for (const [key, pendingGroup] of pendingAutomaticGroups.entries()) {
      let hasValidTabs = false;
      
      for (const tabId of pendingGroup.tabIds) {
        if (await tabExists(tabId)) {
          hasValidTabs = true;
          break;
        }
      }
      
      if (!hasValidTabs) {
        pendingAutomaticGroups.delete(key);
        removedCount++;
      }
    }
    
    // Aplica limite de tamanho
    if (pendingAutomaticGroups.size > MEMORY_LIMITS.PENDING_GROUPS) {
      const excess = pendingAutomaticGroups.size - MEMORY_LIMITS.PENDING_GROUPS;
      const oldEntries = Array.from(pendingAutomaticGroups.keys()).slice(0, excess);
      oldEntries.forEach(key => pendingAutomaticGroups.delete(key));
      removedCount += excess;
      Logger.warn("MemoryManager", `Limite do pendingAutomaticGroups excedido. Removidas ${excess} entradas antigas.`);
    }
    
    Logger.debug("MemoryManager", `PendingGroups: ${removedCount} entradas órfãs removidas. Tamanho atual: ${pendingAutomaticGroups.size}`);
    return removedCount;
  }, {
    context: 'cleanupPendingGroups',
    maxRetries: 1,
    criticalOperation: false
  }) || 0;
}

/**
 * Executa limpeza completa de memória
 * @param {object} maps - Objeto contendo todos os mapas a serem limpos
 * @returns {Promise<object>} Estatísticas da limpeza
 */
export async function performMemoryCleanup(maps) {
  const startTime = Date.now();
  let totalCleaned = 0;
  
  Logger.info("MemoryManager", "Iniciando limpeza de memória...");
  
  try {
    const results = await Promise.allSettled([
      cleanupTabGroupMap(maps.tabGroupMap),
      cleanupTitleUpdaters(maps.debouncedTitleUpdaters),
      cleanupGroupActivity(maps.groupActivity),
      cleanupSingleTabTimestamps(maps.singleTabGroupTimestamps),
      cleanupInjectionFailures(maps.injectionFailureMap),
      cleanupPendingGroups(maps.pendingAutomaticGroups)
    ]);
    
    // Soma resultados bem-sucedidos
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && typeof result.value === 'number') {
        totalCleaned += result.value;
      } else if (result.status === 'rejected') {
        Logger.warn("MemoryManager", `Falha na limpeza ${index}:`, result.reason);
      }
    });
    
    // Cache de nomes é síncrono
    totalCleaned += cleanupSmartNameCache(maps.smartNameCache);
    
    const duration = Date.now() - startTime;
    memoryStats.lastCleanup = Date.now();
    memoryStats.totalCleaned += totalCleaned;
    memoryStats.cleanupCycles++;
    
    const stats = {
      cleaned: totalCleaned,
      duration,
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
    
    Logger.info("MemoryManager", `Limpeza concluída: ${totalCleaned} entradas removidas em ${duration}ms`, stats);
    return stats;
    
  } catch (error) {
    Logger.error("MemoryManager", "Erro durante limpeza de memória:", error);
    return { cleaned: totalCleaned, error: error.message };
  }
}

/**
 * Inicia o agendamento automático de limpeza
 * @param {object} maps - Mapas a serem limpos periodicamente
 */
export function startMemoryCleanup(maps) {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  cleanupInterval = setInterval(async () => {
    await performMemoryCleanup(maps);
  }, CLEANUP_CONFIG.INTERVAL);
  
  Logger.info("MemoryManager", `Limpeza automática iniciada (intervalo: ${CLEANUP_CONFIG.INTERVAL / 1000}s)`);
}

/**
 * Para o agendamento automático de limpeza
 */
export function stopMemoryCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    Logger.info("MemoryManager", "Limpeza automática parada.");
  }
}

/**
 * Força uma limpeza de emergência quando limites são excedidos
 * @param {object} maps - Mapas a serem limpos
 */
export async function emergencyCleanup(maps) {
  Logger.warn("MemoryManager", "Executando limpeza de emergência...");
  return await performMemoryCleanup(maps);
}

/**
 * Verifica se algum limite de memória foi excedido
 * @param {object} maps - Mapas a verificar
 * @returns {boolean} True se algum limite foi excedido
 */
export function isMemoryLimitExceeded(maps) {
  return maps.tabGroupMap.size > MEMORY_LIMITS.TAB_GROUP_MAP ||
         maps.debouncedTitleUpdaters.size > MEMORY_LIMITS.TITLE_UPDATERS ||
         maps.groupActivity.size > MEMORY_LIMITS.GROUP_ACTIVITY ||
         maps.singleTabGroupTimestamps.size > MEMORY_LIMITS.SINGLE_TAB_TIMESTAMPS ||
         maps.smartNameCache.size > MEMORY_LIMITS.SMART_NAME_CACHE ||
         maps.injectionFailureMap.size > MEMORY_LIMITS.INJECTION_FAILURES ||
         maps.pendingAutomaticGroups.size > MEMORY_LIMITS.PENDING_GROUPS;
}

export { MEMORY_LIMITS, CLEANUP_CONFIG };
