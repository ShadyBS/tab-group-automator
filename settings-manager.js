/**
 * @file settings-manager.js
 * @description Gere as configurações da extensão e o armazenamento, com suporte para sincronização.
 */
import Logger from "./logger.js";
import { withErrorHandling, handleCriticalOperation } from "./error-handler.js";
import { getConfig } from "./performance-config.js";
import { 
  validateSettings, 
  validateCustomRule,
  sanitizeString 
} from "./validation-utils.js";

export const DEFAULT_SETTINGS = {
  autoGroupingEnabled: true,
  groupingMode: "smart",
  minTabsForAutoGroup: 2, // Substituído suppressSingleTabGroups
  autoCollapseTimeout: 0,
  uncollapseOnActivate: true,
  customRules: [], // A estrutura das regras será alterada
  ungroupSingleTabs: false,
  ungroupSingleTabsTimeout: 10,
  exceptions: [],
  showTabCount: true,
  syncEnabled: false,
  manualGroupIds: [],
  logLevel: "INFO",
  theme: "auto",
  domainSanitizationTlds: [
    ".rs.gov.br",
    ".sp.gov.br",
    ".rj.gov.br",
    ".com.br",
    ".net.br",
    ".org.br",
    ".gov.br",
    ".edu.br",
    ".gov.uk",
    ".ac.uk",
    ".co.uk",
    ".gov.au",
    ".com.au",
    ".com",
    ".org",
    ".net",
    ".dev",
    ".io",
    ".gov",
    ".edu",
    ".co",
    ".app",
    ".xyz",
    ".info",
    ".biz",
    ".br",
    ".rs",
    ".uk",
    ".de",
    ".jp",
    ".fr",
    ".au",
    ".us",
  ],
  titleSanitizationNoise: [
    "login",
    "sign in",
    "dashboard",
    "homepage",
    "painel",
  ],
  titleDelimiters: "|–—:·»«-",
};

// Objetos em memória
export let settings = { ...DEFAULT_SETTINGS };
export let smartNameCache = new Map();

let saveCacheTimeout = null;

function getStorage(useSync) {
  return useSync ? browser.storage.sync : browser.storage.local;
}

/**
 * Converte uma regra do formato antigo para o novo formato com conditionGroup.
 * @param {object} oldRule - A regra no formato antigo.
 * @returns {object} A regra no novo formato.
 */
function migrateRuleToNewFormat(oldRule) {
  // Validação básica da regra antiga
  if (!oldRule || typeof oldRule !== 'object' || Array.isArray(oldRule)) {
    Logger.error("MigrateRule", "Regra inválida para migração: deve ser um objeto");
    return null;
  }

  // Se a regra já tem conditionGroup, ela já está no novo formato.
  if (oldRule.conditionGroup) {
    // Valida se o formato novo está correto
    const validation = validateCustomRule(oldRule);
    if (validation.isValid) {
      return oldRule;
    } else {
      Logger.warn("MigrateRule", `Regra existente com formato inválido: ${validation.errors.join('; ')}`);
      // Continua com a migração para tentar corrigir
    }
  }

  const ruleName = sanitizeString(oldRule.name || 'Regra sem nome', 50);
  Logger.info("MigrateRule", `Migrando regra antiga: "${ruleName}"`);

  const newRule = {
    name: ruleName,
    color: oldRule.color || "grey",
    minTabs: (typeof oldRule.minTabs === 'number' && oldRule.minTabs > 0) ? oldRule.minTabs : 1,
    conditionGroup: {
      operator: "OR", // Múltiplos padrões no formato antigo funcionam como 'OU'
      conditions: [],
    },
  };

  if (oldRule.patterns && Array.isArray(oldRule.patterns) && oldRule.patterns.length > 0) {
    const propertyMap = {
      "url-wildcard": { property: "url", operator: "wildcard" },
      "url-regex": { property: "url", operator: "regex" },
      "title-match": { property: "title", operator: "contains" },
    };

    const mapping = propertyMap[oldRule.type] || {
      property: "url",
      operator: "contains",
    };

    newRule.conditionGroup.conditions = oldRule.patterns
      .filter(pattern => typeof pattern === 'string' && pattern.trim().length > 0)
      .map((pattern) => ({
        property: mapping.property,
        operator: mapping.operator,
        value: sanitizeString(pattern, 200),
      }));
  }

  // Valida a regra migrada
  const validation = validateCustomRule(newRule);
  if (!validation.isValid) {
    Logger.error("MigrateRule", `Falha na migração da regra "${ruleName}": ${validation.errors.join('; ')}`);
    return null;
  }

  Logger.info("MigrateRule", `Regra "${ruleName}" migrada com sucesso`);
  return newRule;
}

export async function loadSettings() {
  return await handleCriticalOperation(async () => {
    // Primeiro verifica se há configurações no sync
    const syncData = await withErrorHandling(async () => {
      return await browser.storage.sync.get("settings");
    }, {
      context: 'load-sync-settings',
      maxRetries: 2,
      criticalOperation: false,
      fallback: () => ({ settings: null })
    });
    
    let loadedSettings = null;
    let settingsSource = "default";

    if (syncData && syncData.settings) {
      Logger.info(
        "SettingsManager",
        "A carregar configurações do armazenamento sync."
      );
      loadedSettings = syncData.settings;
      settingsSource = "sync";
    } else {
      Logger.info(
        "SettingsManager",
        "Sem configurações no sync, a tentar armazenamento local."
      );
      const localData = await withErrorHandling(async () => {
        return await browser.storage.local.get("settings");
      }, {
        context: 'load-local-settings',
        maxRetries: 3,
        criticalOperation: false,
        fallback: () => ({ settings: null })
      });
      
      if (localData && localData.settings) {
        loadedSettings = localData.settings;
        settingsSource = "local";
      }
    }

    // Aplica as configurações carregadas sobre as padrão
    settings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

    let settingsWereMigrated = false;

    // **SCRIPT DE MIGRAÇÃO DE suppressSingleTabGroups**
    if (settings.hasOwnProperty("suppressSingleTabGroups")) {
      Logger.warn(
        "SettingsManager",
        "Detectado formato de 'suppressSingleTabGroups' antigo. Migrando..."
      );
      settings.minTabsForAutoGroup = settings.suppressSingleTabGroups ? 2 : 1;
      delete settings.suppressSingleTabGroups;
      settingsWereMigrated = true;
    }

    // **SCRIPT DE MIGRAÇÃO DE REGRAS**
    if (
      settings.customRules &&
      Array.isArray(settings.customRules) &&
      settings.customRules.length > 0 &&
      !settings.customRules[0].conditionGroup
    ) {
      Logger.warn(
        "SettingsManager",
        "Detectado formato de regras antigo. Iniciando migração..."
      );
      
      const migratedRules = settings.customRules
        .map(migrateRuleToNewFormat)
        .filter(rule => rule !== null); // Remove regras que falharam na migração
      
      if (migratedRules.length !== settings.customRules.length) {
        Logger.warn(
          "SettingsManager",
          `${settings.customRules.length - migratedRules.length} regras foram removidas durante a migração devido a erros`
        );
      }
      
      settings.customRules = migratedRules;
      settingsWereMigrated = true;
      Logger.info("SettingsManager", `Migração de regras concluída. ${migratedRules.length} regras migradas com sucesso.`);
    }

    // Se qualquer migração ocorreu, salva as configurações imediatamente.
    if (settingsWereMigrated) {
      await updateSettings(settings);
      Logger.info("SettingsManager", "Configurações migradas foram guardadas.");
    }

    // Carrega cache de nomes inteligentes
    const cacheData = await withErrorHandling(async () => {
      return await browser.storage.local.get("smartNameCache");
    }, {
      context: 'load-smart-cache',
      maxRetries: 2,
      criticalOperation: false,
      fallback: () => ({ smartNameCache: null })
    });
    
    if (cacheData && cacheData.smartNameCache) {
      smartNameCache = new Map(Object.entries(cacheData.smartNameCache));
    }
    
    Logger.info("SettingsManager", `Configurações carregadas de ${settingsSource}.`);
    return { success: true, source: settingsSource };
    
  }, "loadSettings", async () => {
    // Fallback crítico: usar configurações padrão
    Logger.error("SettingsManager", "Usando configurações padrão devido a falhas críticas.");
    settings = { ...DEFAULT_SETTINGS };
    smartNameCache = new Map();
    return { success: false, fallback: true };
  });
}

export async function updateSettings(newSettings) {
  // Validação das novas configurações
  if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
    Logger.error("updateSettings", "newSettings deve ser um objeto válido");
    throw new Error("Configurações inválidas fornecidas");
  }

  const oldSettings = { ...settings };
  const oldSyncStatus = oldSettings.syncEnabled;

  // Mescla com validação
  const mergedSettings = { ...settings, ...newSettings };
  
  // Validação completa das configurações mescladas
  const validation = validateSettings(mergedSettings);
  if (!validation.isValid) {
    Logger.error("updateSettings", `Configurações inválidas: ${validation.errors.join('; ')}`);
    throw new Error(`Configurações inválidas: ${validation.errors.join('; ')}`);
  }

  settings = mergedSettings;
  const newSyncStatus = settings.syncEnabled;

  const targetStorage = getStorage(newSyncStatus);

  return await withErrorHandling(async () => {
    await targetStorage.set({ settings });
    Logger.info(
      "SettingsManager",
      `Configurações guardadas no armazenamento ${
        newSyncStatus ? "sync" : "local"
      }.`
    );

    // Remove configurações do armazenamento anterior se mudou o tipo
    if (oldSyncStatus !== newSyncStatus) {
      await withErrorHandling(async () => {
        const sourceStorage = getStorage(oldSyncStatus);
        await sourceStorage.remove("settings");
        Logger.info(
          "SettingsManager",
          `Configurações removidas do armazenamento ${
            oldSyncStatus ? "sync" : "local"
          }.`
        );
      }, {
        context: 'remove-old-settings',
        maxRetries: 2,
        criticalOperation: false
      });
    }
    
    return { oldSettings, newSettings: settings };
    
  }, {
    context: `updateSettings-${newSyncStatus ? 'sync' : 'local'}`,
    maxRetries: 3,
    retryDelay: getConfig('STORAGE_RETRY_DELAY'),
    criticalOperation: true,
    fallback: async () => {
      // Rollback: restaura configurações antigas
      Logger.warn("SettingsManager", "Revertendo para configurações anteriores devido a falhas.");
      settings = oldSettings;
      return { oldSettings, newSettings: oldSettings, rollback: true };
    }
  });
}

export function saveSmartNameCache() {
  if (saveCacheTimeout) {
    clearTimeout(saveCacheTimeout);
  }
  saveCacheTimeout = setTimeout(async () => {
    await withErrorHandling(async () => {
      await browser.storage.local.set({
        smartNameCache: Object.fromEntries(smartNameCache),
      });
      Logger.debug("SettingsManager", `Cache de nomes inteligentes salvo com ${smartNameCache.size} entradas.`);
      return { success: true, cacheSize: smartNameCache.size };
    }, {
      context: 'save-smart-cache',
      maxRetries: 3,
      retryDelay: getConfig('CACHE_CLEANUP_RETRY_DELAY'),
      criticalOperation: false,
      fallback: () => {
        Logger.warn("SettingsManager", "Falha ao salvar cache de nomes inteligentes - continuando sem salvar.");
        return { success: false, fallback: true };
      }
    });
    saveCacheTimeout = null;
  }, getConfig('CACHE_SAVE_DELAY'));
}

export function clearSmartNameCache() {
  smartNameCache.clear();
  if (saveCacheTimeout) {
    clearTimeout(saveCacheTimeout);
    saveCacheTimeout = null;
  }
  browser.storage.local.remove("smartNameCache");
}

/**
 * Remove entradas antigas do cache baseado em tempo de acesso
 * @param {number} maxAge - Idade máxima em milissegundos (padrão: 24 horas)
 * @returns {number} Número de entradas removidas
 */
export function cleanupOldCacheEntries(maxAge = 24 * 60 * 60 * 1000) {
  if (!smartNameCache || smartNameCache.size === 0) return 0;
  
  let removedCount = 0;
  const now = Date.now();
  
  // Como o Map não armazena timestamps, usamos uma estratégia de LRU aproximada
  // removendo entradas antigas quando o cache excede um tamanho razoável
  const maxCacheSize = getConfig('MAX_CACHE_SIZE');
  
  if (smartNameCache.size > maxCacheSize) {
    const excess = smartNameCache.size - maxCacheSize;
    const entries = Array.from(smartNameCache.keys());
    
    // Remove as primeiras entradas (assumindo que são as mais antigas)
    for (let i = 0; i < excess; i++) {
      smartNameCache.delete(entries[i]);
      removedCount++;
    }
    
    Logger.debug("SettingsManager", `Cache limpo: ${removedCount} entradas antigas removidas. Tamanho atual: ${smartNameCache.size}`);
  }
  
  return removedCount;
}

/**
 * Obtém estatísticas do cache de nomes inteligentes
 * @returns {object} Estatísticas do cache
 */
export function getCacheStats() {
  return {
    size: smartNameCache.size,
    memoryUsage: JSON.stringify(Object.fromEntries(smartNameCache)).length,
    timestamp: Date.now()
  };
}
