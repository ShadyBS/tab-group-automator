/**
 * @file settings-manager.js
 * @description Gere as configurações da extensão e o armazenamento, com suporte para sincronização.
 */
import Logger from './logger.js';

export const DEFAULT_SETTINGS = {
  autoGroupingEnabled: true,
  groupingMode: 'smart',
  autoCollapseTimeout: 0,
  suppressSingleTabGroups: true,
  uncollapseOnActivate: true,
  customRules: [],
  ungroupSingleTabs: false,
  ungroupSingleTabsTimeout: 10,
  exceptions: [],
  showTabCount: true,
  syncEnabled: false,
  manualGroupIds: [],
  logLevel: 'INFO',
  theme: 'auto',
  domainSanitizationTlds: [
    '.rs.gov.br', '.sp.gov.br', '.rj.gov.br',
    '.com.br', '.net.br', '.org.br', '.gov.br', '.edu.br',
    '.gov.uk', '.ac.uk', '.co.uk',
    '.gov.au', '.com.au',
    '.com', '.org', '.net', '.dev', '.io', '.gov', '.edu', 
    '.co', '.app', '.xyz', '.info', '.biz',
    '.br', '.rs', '.uk', '.de', '.jp', '.fr', '.au', '.us'
  ],
  titleSanitizationNoise: [
    'login', 'sign in', 'dashboard', 'homepage', 'painel'
  ],
  // NOVO: Adiciona a configuração para os delimitadores de título.
  titleDelimiters: '|–—:·»«-',
};

// Objetos em memória
export let settings = { ...DEFAULT_SETTINGS };
export let smartNameCache = new Map();

// Timeout para o debounce da gravação do cache.
let saveCacheTimeout = null;

function getStorage(useSync) {
    return useSync ? browser.storage.sync : browser.storage.local;
}

export async function loadSettings() {
    try {
        const syncData = await browser.storage.sync.get('settings');
        let loadedSettings = null;

        if (syncData && syncData.settings) {
            Logger.info("SettingsManager", "A carregar configurações do armazenamento sync.");
            loadedSettings = syncData.settings;
        } else {
            Logger.info("SettingsManager", "Sem configurações no sync, a tentar armazenamento local.");
            const localData = await browser.storage.local.get('settings');
            if (localData && localData.settings) {
                loadedSettings = localData.settings;
            }
        }
        
        settings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

        const cacheData = await browser.storage.local.get('smartNameCache');
        if (cacheData && cacheData.smartNameCache) {
            smartNameCache = new Map(Object.entries(cacheData.smartNameCache));
        }

    } catch(e) {
        Logger.error("SettingsManager", "Erro fatal ao carregar configurações:", e);
        settings = { ...DEFAULT_SETTINGS };
        smartNameCache = new Map();
        throw e;
    }
}

export async function updateSettings(newSettings) {
    const oldSettings = { ...settings };
    const oldSyncStatus = oldSettings.syncEnabled;

    settings = { ...settings, ...newSettings };
    const newSyncStatus = settings.syncEnabled;

    const targetStorage = getStorage(newSyncStatus);

    try {
        await targetStorage.set({ settings });
        Logger.info("SettingsManager", `Configurações guardadas no armazenamento ${newSyncStatus ? 'sync' : 'local'}.`);

        if (oldSyncStatus !== newSyncStatus) {
            const sourceStorage = getStorage(oldSyncStatus);
            await sourceStorage.remove('settings');
            Logger.info("SettingsManager", `Configurações removidas do armazenamento ${oldSyncStatus ? 'sync' : 'local'}.`);
        }

    } catch (e) {
        Logger.error("SettingsManager", `Erro ao guardar configurações no armazenamento ${newSyncStatus ? 'sync' : 'local'}:`, e);
        settings = oldSettings;
        throw e;
    }

    return { oldSettings, newSettings: settings };
}

export function saveSmartNameCache() {
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
    }

    saveCacheTimeout = setTimeout(async () => {
        try {
            await browser.storage.local.set({ smartNameCache: Object.fromEntries(smartNameCache) });
        } catch (e) {
            Logger.error("SettingsManager", "Erro ao guardar o cache de nomes inteligentes:", e);
        }
        saveCacheTimeout = null;
    }, 2000);
}

export function clearSmartNameCache() {
    smartNameCache.clear();
    
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
        saveCacheTimeout = null;
    }
    
    browser.storage.local.remove('smartNameCache');
}
