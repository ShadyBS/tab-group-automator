/**
 * @file settings-manager.js
 * @description Manages extension settings and storage.
 */

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
  // NOVO: Configuração do tema da interface
  theme: 'auto', // 'auto', 'light', 'dark'
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
};

// In-memory objects
export let settings = { ...DEFAULT_SETTINGS };
export let smartNameCache = new Map();

// Variável para controlar o timeout do debounce ao salvar o cache.
let saveCacheTimeout = null;

function getStorageArea() {
    return browser.storage.local;
}

/**
 * Loads settings from storage into the in-memory object.
 */
export async function loadSettings() {
    const storageArea = getStorageArea();
    try {
        const data = await storageArea.get(['settings', 'smartNameCache']);
        settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        
        if (data.smartNameCache) {
            smartNameCache = new Map(Object.entries(data.smartNameCache));
        }
    } catch(e) {
        console.error("Fatal error loading settings:", e);
        settings = { ...DEFAULT_SETTINGS };
        smartNameCache = new Map();
        throw e;
    }
}

/**
 * Updates a specific part of the settings and saves to storage.
 * @param {object} newSettings - The new settings to apply.
 */
export async function updateSettings(newSettings) {
    const oldSettings = { ...settings };
    settings = { ...settings, ...newSettings };
    
    const storageArea = getStorageArea();
    await storageArea.set({ settings });

    return { oldSettings, newSettings: settings };
}

/**
 * Saves the smart name cache to persistent storage using a debounce mechanism
 * to prevent excessive writes.
 */
export function saveSmartNameCache() {
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
    }

    saveCacheTimeout = setTimeout(async () => {
        const storageArea = getStorageArea();
        try {
            await storageArea.set({ smartNameCache: Object.fromEntries(smartNameCache) });
        } catch (e) {
            console.error("Erro ao salvar o smart name cache:", e);
        }
        saveCacheTimeout = null;
    }, 2000);
}

/**
 * Clears the smart name cache from memory and storage.
 */
export function clearSmartNameCache() {
    smartNameCache.clear();
    
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
        saveCacheTimeout = null;
    }

    const storageArea = getStorageArea();
    storageArea.remove('smartNameCache');
}
