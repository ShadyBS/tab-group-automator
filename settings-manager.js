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
        console.log("Settings and cache loaded. Manual Groups:", settings.manualGroupIds.length);
    } catch(e) {
        console.error("Fatal error loading settings:", e);
        settings = { ...DEFAULT_SETTINGS };
        smartNameCache = new Map();
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
    // Limpa qualquer operação de salvamento pendente para reiniciar o contador.
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
    }

    // Agenda uma nova operação de salvamento para daqui a 2 segundos.
    saveCacheTimeout = setTimeout(async () => {
        const storageArea = getStorageArea();
        try {
            await storageArea.set({ smartNameCache: Object.fromEntries(smartNameCache) });
            console.log("[ATG] Smart name cache salvo no armazenamento após debounce.");
        } catch (e) {
            console.error("Erro ao salvar o smart name cache:", e);
        }
        saveCacheTimeout = null; // Limpa o ID do timeout após a execução.
    }, 2000); // Atraso de 2000ms (2 segundos)
}

/**
 * Clears the smart name cache from memory and storage.
 */
export function clearSmartNameCache() {
    smartNameCache.clear();
    
    // Cancela qualquer salvamento pendente, pois estamos a limpar o cache.
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
        saveCacheTimeout = null;
    }

    const storageArea = getStorageArea();
    storageArea.remove('smartNameCache');
    console.log("Smart name cache cleared.");
}
