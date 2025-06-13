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
  exceptions: []
};

// In-memory settings object
export let settings = { ...DEFAULT_SETTINGS };
export let smartNameCache = new Map();

/**
 * Loads settings from storage into the in-memory object.
 */
export async function loadSettings() {
  const data = await browser.storage.local.get('settings');
  settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  console.log("Settings loaded. Grouping mode:", settings.groupingMode);
}

/**
 * Updates a specific part of the settings and saves to storage.
 * @param {object} newSettings - The new settings to apply.
 */
export async function updateSettings(newSettings) {
    const oldSettings = { ...settings };
    settings = { ...settings, ...newSettings };
    await browser.storage.local.set({ settings });

    // Return a summary of what changed
    return { oldSettings, newSettings: settings };
}

/**
 * Clears the smart name cache.
 */
export function clearSmartNameCache() {
    smartNameCache.clear();
    console.log("Smart name cache cleared.");
}
