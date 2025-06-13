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
  manualGroupIds: [], // NOVO: Guarda os IDs dos grupos manuais
};

// In-memory settings object
export let settings = { ...DEFAULT_SETTINGS };
export let smartNameCache = new Map();

function getStorageArea() {
    // A sincronização será reativada quando o erro do manifesto for corrigido
    // return settings.syncEnabled ? browser.storage.sync : browser.storage.local;
    return browser.storage.local;
}

/**
 * Loads settings from storage into the in-memory object.
 */
export async function loadSettings() {
  const storageArea = getStorageArea();
  const data = await storageArea.get('settings');

  settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  console.log("Settings loaded. Manual Groups:", settings.manualGroupIds);
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
 * Clears the smart name cache.
 */
export function clearSmartNameCache() {
    smartNameCache.clear();
    console.log("Smart name cache cleared.");
}
