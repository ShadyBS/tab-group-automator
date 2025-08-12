/**
 * @file background.js
 * @description Event-driven Service Worker compatible with Manifest V3
 * Implements proper event-driven architecture with chrome.storage for state persistence
 */

// Import the polyfill to ensure the `browser` namespace is available across all browsers.
import './vendor/browser-polyfill.js';

// Critical imports (immediate loading)
import Logger from './logger.js';
import { loadSettings, updateSettings } from './settings-manager.js';
import {
  getConfig,
  loadConfigFromSettings,
  isFeatureEnabled,
} from './performance-config.js';
import {
  validateRuntimeMessage,
  sanitizeMessageData,
  messageRateLimiter,
  validateSender,
} from './validation-utils.js';

// --- STATE MANAGEMENT ---
// All state is now stored in chrome.storage.local and loaded on-demand

/**
 * Storage keys for persistent state
 */
const STORAGE_KEYS = {
  TAB_PROCESSING_QUEUE: 'tabProcessingQueue',
  TAB_GROUP_MAP: 'tabGroupMap',
  GROUP_ACTIVITY: 'groupActivity',
  SINGLE_TAB_GROUP_TIMESTAMPS: 'singleTabGroupTimestamps',
  PENDING_SUGGESTION: 'pendingSuggestion',
  INITIALIZATION_STATE: 'initializationState',
};

/**
 * In-memory cache for frequently accessed data (cleared on service worker restart)
 */
let memoryCache = {
  settings: null,
  debouncedTimers: new Map(), // These cannot be persisted, created fresh each time
  moduleCache: new Map(),
};

/**
 * In-memory state object to accumulate changes before batch writing to storage
 */
let pendingStorageUpdates = {
  [STORAGE_KEYS.TAB_GROUP_MAP]: null,
  [STORAGE_KEYS.GROUP_ACTIVITY]: null,
  [STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS]: null,
  [STORAGE_KEYS.TAB_PROCESSING_QUEUE]: null,
  [STORAGE_KEYS.PENDING_SUGGESTION]: null,
  [STORAGE_KEYS.INITIALIZATION_STATE]: null,
};

/**
 * Debounced function to commit accumulated state changes to storage
 * This reduces storage I/O by batching multiple updates into a single write operation
 */
function commitStateToStorage() {
  // FEATURE FLAG: Batched Storage - only use batching if feature is enabled
  if (!isFeatureEnabled('batchedStorage')) {
    // Immediate storage writes when feature flag is disabled
    const updates = {};
    let hasUpdates = false;

    // Collect all pending updates
    for (const [key, value] of Object.entries(pendingStorageUpdates)) {
      if (value !== null) {
        updates[key] = value;
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      // Write immediately without debouncing
      browser.storage.local
        .set(updates)
        .then(() => {
          Logger.debug(
            'commitStateToStorage',
            `Immediate commit: ${
              Object.keys(updates).length
            } storage updates (batched storage disabled)`,
            Object.keys(updates)
          );

          // Clear pending updates after successful commit
          for (const key of Object.keys(updates)) {
            pendingStorageUpdates[key] = null;
          }
        })
        .catch((error) => {
          Logger.warn(
            'commitStateToStorage',
            'Failed to commit immediate storage updates:',
            error
          );
        });
    }
    return;
  }

  // Batched storage with debouncing (original behavior when feature flag is enabled)
  debounce(
    'storage-commit',
    async () => {
      const updates = {};
      let hasUpdates = false;

      // Collect all pending updates
      for (const [key, value] of Object.entries(pendingStorageUpdates)) {
        if (value !== null) {
          updates[key] = value;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        try {
          await browser.storage.local.set(updates);
          Logger.debug(
            'commitStateToStorage',
            `Batched commit: ${Object.keys(updates).length} storage updates`,
            Object.keys(updates)
          );

          // Clear pending updates after successful commit
          for (const key of Object.keys(updates)) {
            pendingStorageUpdates[key] = null;
          }
        } catch (error) {
          Logger.warn(
            'commitStateToStorage',
            'Failed to commit batched storage updates:',
            error
          );
        }
      }
    },
    500 // 500ms debounce delay as specified in the requirements
  );
}

/**
 * Load state from chrome.storage.local
 * @param {string} key - Storage key
 * @returns {Promise<any>} - Stored value or null
 */
async function loadState(key) {
  try {
    const result = await browser.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    Logger.warn('loadState', `Failed to load state for key ${key}:`, error);
    return null;
  }
}

/**
 * Save state to chrome.storage.local
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
async function saveState(key, value) {
  try {
    await browser.storage.local.set({ [key]: value });
  } catch (error) {
    Logger.warn('saveState', `Failed to save state for key ${key}:`, error);
  }
}

/**
 * Initialize state with default values if not present
 */
async function initializeState() {
  const defaults = {
    [STORAGE_KEYS.TAB_PROCESSING_QUEUE]: [],
    [STORAGE_KEYS.TAB_GROUP_MAP]: {},
    [STORAGE_KEYS.GROUP_ACTIVITY]: {},
    [STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS]: {},
    [STORAGE_KEYS.PENDING_SUGGESTION]: null,
    [STORAGE_KEYS.INITIALIZATION_STATE]: {
      initialized: false,
      timestamp: Date.now(),
    },
  };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const existing = await loadState(key);
    if (existing === null) {
      await saveState(key, defaultValue);
    }
  }
}

/**
 * Get tab processing queue from storage
 * @returns {Promise<number[]>} - Array of tab IDs
 */
async function getTabProcessingQueue() {
  const queue = await loadState(STORAGE_KEYS.TAB_PROCESSING_QUEUE);
  return Array.isArray(queue) ? queue : [];
}

/**
 * Add tab to processing queue using batched storage
 * @param {number} tabId - Tab ID to add
 */
async function addToTabProcessingQueue(tabId) {
  // Get current state from pending updates or load from storage
  let queue = pendingStorageUpdates[STORAGE_KEYS.TAB_PROCESSING_QUEUE];
  if (queue === null) {
    queue = await getTabProcessingQueue();
    pendingStorageUpdates[STORAGE_KEYS.TAB_PROCESSING_QUEUE] = queue;
  }

  if (!queue.includes(tabId)) {
    queue.push(tabId);
    commitStateToStorage();
  }
}

/**
 * Clear tab processing queue using batched storage
 */
async function clearTabProcessingQueue() {
  pendingStorageUpdates[STORAGE_KEYS.TAB_PROCESSING_QUEUE] = [];
  commitStateToStorage();
}

/**
 * Get tab group map from storage
 * @returns {Promise<Map<number, number>>} - Map of tab ID to group ID
 */
async function getTabGroupMap() {
  const mapData = await loadState(STORAGE_KEYS.TAB_GROUP_MAP);
  return new Map(
    Object.entries(mapData || {}).map(([k, v]) => [parseInt(k), v])
  );
}

/**
 * Update tab group map using batched storage
 * @param {number} tabId - Tab ID
 * @param {number} groupId - Group ID
 */
async function updateTabGroupMap(tabId, groupId) {
  // Get current state from pending updates or load from storage
  let mapData = pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP];
  if (mapData === null) {
    mapData = (await loadState(STORAGE_KEYS.TAB_GROUP_MAP)) || {};
    pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP] = mapData;
  }

  mapData[tabId] = groupId;
  commitStateToStorage();
}

/**
 * Remove tab from group map using batched storage
 * @param {number} tabId - Tab ID to remove
 */
async function removeFromTabGroupMap(tabId) {
  // Get current state from pending updates or load from storage
  let mapData = pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP];
  if (mapData === null) {
    mapData = (await loadState(STORAGE_KEYS.TAB_GROUP_MAP)) || {};
    pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP] = mapData;
  }

  delete mapData[tabId];
  commitStateToStorage();
}

/**
 * Get group activity from storage
 * @returns {Promise<Map<number, number>>} - Map of group ID to timestamp
 */
async function getGroupActivity() {
  const activityData = await loadState(STORAGE_KEYS.GROUP_ACTIVITY);
  return new Map(
    Object.entries(activityData || {}).map(([k, v]) => [parseInt(k), v])
  );
}

/**
 * Update group activity using batched storage
 * @param {number} groupId - Group ID
 * @param {number} timestamp - Activity timestamp
 */
async function updateGroupActivity(groupId, timestamp) {
  // Get current state from pending updates or load from storage
  let activityData = pendingStorageUpdates[STORAGE_KEYS.GROUP_ACTIVITY];
  if (activityData === null) {
    activityData = (await loadState(STORAGE_KEYS.GROUP_ACTIVITY)) || {};
    pendingStorageUpdates[STORAGE_KEYS.GROUP_ACTIVITY] = activityData;
  }

  activityData[groupId] = timestamp;
  commitStateToStorage();
}

/**
 * Load module on demand with caching
 * @param {string} moduleName - Module name to load
 * @returns {Promise<any>} - Loaded module
 */
async function loadModule(moduleName) {
  if (memoryCache.moduleCache.has(moduleName)) {
    return memoryCache.moduleCache.get(moduleName);
  }

  try {
    const module = await import(`./${moduleName}`);
    memoryCache.moduleCache.set(moduleName, module);
    return module;
  } catch (error) {
    Logger.error('loadModule', `Failed to load module ${moduleName}:`, error);
    throw error;
  }
}

/**
 * Get current settings (cached or load from storage)
 * @returns {Promise<object>} - Settings object
 */
async function getSettings() {
  if (!memoryCache.settings) {
    await loadSettings();
    // Get settings from the settings manager after loading
    const { settings } = await import('./settings-manager.js');
    memoryCache.settings = settings;
  }
  return memoryCache.settings;
}

/**
 * Clear memory cache (called on critical errors)
 */
function clearMemoryCache() {
  memoryCache.settings = null;
  memoryCache.moduleCache.clear();
  // Clear all timers
  for (const timerId of memoryCache.debouncedTimers.values()) {
    clearTimeout(timerId);
  }
  memoryCache.debouncedTimers.clear();
}

// --- LAZY LOADING HELPERS ---

/**
 * Load grouping logic module on demand
 */
async function ensureGroupingLogicLoaded() {
  return await loadModule('grouping-logic.js');
}

/**
 * Load context menu module on demand
 */
async function ensureContextMenuLoaded() {
  return await loadModule('context-menu-manager.js');
}

/**
 * Load error handling module on demand
 */
async function ensureErrorHandlingLoaded() {
  return await loadModule('adaptive-error-handler.js');
}

/**
 * Load tab renaming engine on demand
 */
async function ensureTabRenamingLoaded() {
  return await loadModule('tab-renaming-engine.js');
}

/**
 * Load learning engine on demand
 */
async function ensureLearningEngineLoaded() {
  return await loadModule('learning-engine.js');
}

// --- UTILITY FUNCTIONS ---

/**
 * Debounced function execution
 * @param {string} key - Unique key for the debounce
 * @param {Function} fn - Function to execute
 * @param {number} delay - Delay in milliseconds
 */
function debounce(key, fn, delay) {
  // Clear existing timer
  if (memoryCache.debouncedTimers.has(key)) {
    clearTimeout(memoryCache.debouncedTimers.get(key));
  }

  // Set new timer
  const timerId = setTimeout(() => {
    fn();
    memoryCache.debouncedTimers.delete(key);
  }, delay);

  memoryCache.debouncedTimers.set(key, timerId);
}

// --- CORE EVENT HANDLERS ---

/**
 * Handle tab created event
 * @param {browser.tabs.Tab} tab - Created tab
 */
async function handleTabCreated(tab) {
  Logger.debug('handleTabCreated', `Tab ${tab.id} created.`, { tab });

  if (tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
    Logger.info(
      'handleTabCreated',
      `New tab ${tab.id} created in group ${tab.groupId}. Scheduling title update.`
    );
    debounce(
      `group-title-${tab.groupId}`,
      async () => {
        await updateGroupTitleWithCount(tab.groupId);
      },
      getConfig('TITLE_UPDATE_DEBOUNCE') || 1000
    );
  }

  // Schedule suggestion check
  debounce(
    'suggestion-check',
    async () => {
      await scheduleSuggestionCheck();
    },
    getConfig('SUGGESTION_CHECK_DEBOUNCE') || 3000
  );
}

/**
 * Handle tab updated event
 * @param {number} tabId - Updated tab ID
 * @param {object} changeInfo - Change information
 * @param {browser.tabs.Tab} tab - Updated tab
 */
async function handleTabUpdated(tabId, changeInfo, tab) {
  Logger.debug('handleTabUpdated', `Tab ${tabId} updated.`, {
    changeInfo,
    tab,
  });

  // Handle group changes
  if (changeInfo.groupId !== undefined) {
    const tabGroupMap = await getTabGroupMap();
    const oldGroupId = tabGroupMap.get(tabId);

    if (oldGroupId) {
      debounce(
        `group-title-${oldGroupId}`,
        async () => {
          await updateGroupTitleWithCount(oldGroupId);
        },
        getConfig('TITLE_UPDATE_DEBOUNCE') || 1000
      );
    }

    if (changeInfo.groupId) {
      debounce(
        `group-title-${changeInfo.groupId}`,
        async () => {
          await updateGroupTitleWithCount(changeInfo.groupId);
        },
        getConfig('TITLE_UPDATE_DEBOUNCE') || 1000
      );
    }

    await updateTabGroupMap(tabId, changeInfo.groupId);
  }

  // Handle grouping processing
  const settings = await getSettings();
  const needsGroupingProcessing =
    settings.autoGroupingEnabled &&
    tab.url &&
    tab.url.startsWith('http') &&
    (changeInfo.status === 'complete' ||
      (changeInfo.title && tab.status === 'complete'));

  if (needsGroupingProcessing) {
    Logger.debug(
      'handleTabUpdated',
      `Tab ${tabId} marked for grouping processing due to status or title change.`
    );
    await addToTabProcessingQueue(tabId);
    debounce(
      'queue-processing',
      async () => {
        await processTabQueue();
      },
      getConfig('QUEUE_DELAY') || 2000
    );
  }

  // Handle tab renaming
  if (
    settings.tabRenamingEnabled &&
    tab.url &&
    tab.url.startsWith('http') &&
    (changeInfo.status === 'complete' || changeInfo.title || changeInfo.url)
  ) {
    debounce(
      `renaming-${tabId}`,
      async () => {
        Logger.debug(
          'handleTabUpdated',
          `Triggering tab renaming for tab ${tabId}.`
        );
        const renamingModule = await ensureTabRenamingLoaded();
        await renamingModule.globalTabRenamingEngine.processTab(tabId, tab);
      },
      getConfig('TAB_RENAMING_DELAY') || 1000
    );
  }
}

/**
 * Handle tab removed event
 * @param {number} tabId - Removed tab ID
 * @param {object} removeInfo - Remove information
 */
async function handleTabRemoved(tabId, removeInfo) {
  Logger.debug('handleTabRemoved', `Tab ${tabId} removed.`, { removeInfo });

  const tabGroupMap = await getTabGroupMap();
  const oldGroupId = tabGroupMap.get(tabId);

  if (oldGroupId) {
    debounce(
      `group-title-${oldGroupId}`,
      async () => {
        // First update the group title with the correct count
        await updateGroupTitleWithCount(oldGroupId);
        // Then remove the tab from the group map
        await removeFromTabGroupMap(tabId);
      },
      getConfig('TITLE_UPDATE_DEBOUNCE') || 1000
    );
  } else {
    // If no group, clean up immediately
    await removeFromTabGroupMap(tabId);
  }

  // Clear any pending timers for this tab
  const timersToRemove = [];
  for (const [key, timerId] of memoryCache.debouncedTimers.entries()) {
    if (key.includes(`-${tabId}`)) {
      clearTimeout(timerId);
      timersToRemove.push(key);
    }
  }
  timersToRemove.forEach((key) => memoryCache.debouncedTimers.delete(key));

  // Schedule suggestion check
  debounce(
    'suggestion-check',
    async () => {
      await scheduleSuggestionCheck();
    },
    getConfig('SUGGESTION_CHECK_DEBOUNCE') || 3000
  );
}

/**
 * Handle tab activated event
 * @param {object} activeInfo - Active tab information
 */
async function handleTabActivated({ tabId }) {
  const settings = await getSettings();
  if (!settings.uncollapseOnActivate) return;

  try {
    const errorHandling = await ensureErrorHandlingLoaded();

    const result = await errorHandling.handleTabOperation(async () => {
      const tab = await browser.tabs.get(tabId);
      if (tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
        const group = await browser.tabGroups.get(tab.groupId);
        await updateGroupActivity(group.id, Date.now());

        if (group.collapsed) {
          Logger.debug(
            'handleTabActivated',
            `Expanding group ${group.id} due to tab ${tabId} activation.`
          );
          await browser.tabGroups.update(group.id, { collapsed: false });
        }
        return { success: true, groupId: group.id };
      }
      return { success: false, reason: 'no_group' };
    }, `handleTabActivated-${tabId}`);

    if (result === null) {
      Logger.debug(
        'handleTabActivated',
        `Tab ${tabId} or group not found - operation ignored.`
      );
    }
  } catch (error) {
    Logger.warn(
      'handleTabActivated',
      `Error handling tab activation for tab ${tabId}:`,
      error
    );
  }
}

/**
 * Handle tab group created event
 * @param {browser.tabGroups.TabGroup} group - Created group
 */
async function handleTabGroupCreated(group) {
  Logger.debug('handleTabGroupCreated', `Group ${group.id} created.`, group);

  try {
    const tabsInNewGroup = await browser.tabs.query({ groupId: group.id });
    const newGroupTabIds = tabsInNewGroup.map((t) => t.id).sort();

    // Check if this matches any pending automatic groups
    // This would require loading the app state module
    const appStateModule = await loadModule('app-state.js');
    const pendingAutomaticGroups = appStateModule.pendingAutomaticGroups;

    let isManualGroup = true;
    for (const [key, pendingGroup] of pendingAutomaticGroups.entries()) {
      const pendingTabIds = [...pendingGroup.tabIds].sort();
      if (JSON.stringify(newGroupTabIds) === JSON.stringify(pendingTabIds)) {
        Logger.debug(
          'handleTabGroupCreated',
          `Group ${group.id} matched pending intention. Classified as automatic.`
        );
        pendingAutomaticGroups.delete(key);
        isManualGroup = false;
        break;
      }
    }

    if (isManualGroup) {
      Logger.info(
        'handleTabGroupCreated',
        `Group ${group.id} classified as manual.`
      );
      const settings = await getSettings();

      if (!settings.manualGroupIds.includes(group.id)) {
        const newManualIds = [...settings.manualGroupIds, group.id];
        await updateSettings({ manualGroupIds: newManualIds });

        // Add pin to title for visual identification
        const errorHandling = await ensureErrorHandlingLoaded();
        await errorHandling.handleGroupOperation(async () => {
          const currentGroup = await browser.tabGroups.get(group.id);
          const cleanTitle = (currentGroup.title || 'Group').replace(
            /📌\s*/,
            ''
          );
          if (!currentGroup.title.startsWith('📌')) {
            await browser.tabGroups.update(group.id, {
              title: `📌 ${cleanTitle}`,
            });
            return { success: true, title: `📌 ${cleanTitle}` };
          }
          return { success: false, reason: 'already_pinned' };
        }, `handleTabGroupCreated-pin-${group.id}`);

        // Learn from manual group if it has a title
        const cleanTitle = (group.title || '').replace(/📌\s*/, '').trim();
        if (cleanTitle) {
          const learningEngine = await ensureLearningEngineLoaded();
          await learningEngine.learningEngine.learnFromGroup(
            cleanTitle,
            tabsInNewGroup
          );
        }
      }
    }
  } catch (error) {
    Logger.error(
      'handleTabGroupCreated',
      `Error handling group creation for group ${group.id}:`,
      error
    );
  }
}

/**
 * Handle tab group updated event
 * @param {browser.tabGroups.TabGroup} group - Updated group
 */
async function handleTabGroupUpdated(group) {
  Logger.debug('handleTabGroupUpdated', `Group ${group.id} updated.`, group);

  try {
    const settings = await getSettings();
    const isManual = settings.manualGroupIds.includes(group.id);
    const title = group.title || '';
    const hasPin = title.startsWith('📌');

    // Learn from manual group title changes
    if (isManual) {
      debounce(
        `learning-update-${group.id}`,
        async () => {
          try {
            const currentGroup = await browser.tabGroups.get(group.id);
            const cleanTitle = (currentGroup.title || '')
              .replace(/📌\s*/, '')
              .trim();

            if (cleanTitle) {
              const tabsInGroup = await browser.tabs.query({
                groupId: group.id,
              });
              if (tabsInGroup.length > 0) {
                const learningEngine = await ensureLearningEngineLoaded();
                await learningEngine.learningEngine.learnFromGroup(
                  cleanTitle,
                  tabsInGroup
                );
              }
            }
          } catch (e) {
            Logger.warn(
              'handleTabGroupUpdated',
              `Could not learn from group ${group.id}, may have been removed.`,
              e
            );
          }
        },
        2000
      );
    }

    // Update pin status
    if (isManual && !hasPin) {
      await browser.tabGroups.update(group.id, { title: `📌 ${title}` });
    } else if (!isManual && hasPin) {
      await browser.tabGroups.update(group.id, {
        title: title.replace(/📌\s*/, ''),
      });
    }
  } catch (error) {
    Logger.error(
      'handleTabGroupUpdated',
      `Error handling group update for group ${group.id}:`,
      error
    );
  }
}

/**
 * Handle tab group removed event
 * @param {browser.tabGroups.TabGroup} group - Removed group
 */
async function handleTabGroupRemoved(group) {
  Logger.info('handleTabGroupRemoved', `Group ${group.id} removed.`, group);

  try {
    // Update settings if it was a manual group
    const settings = await getSettings();
    if (settings.manualGroupIds.includes(group.id)) {
      const newManualIds = settings.manualGroupIds.filter(
        (id) => id !== group.id
      );
      await updateSettings({ manualGroupIds: newManualIds });
    }

    // Clean up activity data using batched storage
    let activityData = pendingStorageUpdates[STORAGE_KEYS.GROUP_ACTIVITY];
    if (activityData === null) {
      activityData = (await loadState(STORAGE_KEYS.GROUP_ACTIVITY)) || {};
      pendingStorageUpdates[STORAGE_KEYS.GROUP_ACTIVITY] = activityData;
    }
    delete activityData[group.id];

    // Clean up single tab timestamps using batched storage
    let timestampData =
      pendingStorageUpdates[STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS];
    if (timestampData === null) {
      timestampData =
        (await loadState(STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS)) || {};
      pendingStorageUpdates[STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS] =
        timestampData;
    }
    delete timestampData[group.id];

    // Remove orphaned tabs from group map using batched storage
    let tabGroupMapData = pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP];
    if (tabGroupMapData === null) {
      tabGroupMapData = (await loadState(STORAGE_KEYS.TAB_GROUP_MAP)) || {};
      pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP] = tabGroupMapData;
    }
    const updatedMapData = {};
    for (const [tabId, groupId] of Object.entries(tabGroupMapData)) {
      if (groupId !== group.id) {
        updatedMapData[tabId] = groupId;
      }
    }
    pendingStorageUpdates[STORAGE_KEYS.TAB_GROUP_MAP] = updatedMapData;

    commitStateToStorage();

    // Clear any pending timers for this group
    const timersToRemove = [];
    for (const [key, timerId] of memoryCache.debouncedTimers.entries()) {
      if (key.includes(`-${group.id}`)) {
        clearTimeout(timerId);
        timersToRemove.push(key);
      }
    }
    timersToRemove.forEach((key) => memoryCache.debouncedTimers.delete(key));

    // Schedule suggestion check
    debounce(
      'suggestion-check',
      async () => {
        await scheduleSuggestionCheck();
      },
      getConfig('SUGGESTION_CHECK_DEBOUNCE') || 3000
    );
  } catch (error) {
    Logger.error(
      'handleTabGroupRemoved',
      `Error handling group removal for group ${group.id}:`,
      error
    );
  }
}

// --- CORE BUSINESS LOGIC ---

/**
 * Process the tab queue
 */
async function processTabQueue() {
  try {
    const queue = await getTabProcessingQueue();
    if (queue.length === 0) return;

    Logger.info('processTabQueue', `Processing ${queue.length} tabs.`, queue);

    const groupingModule = await ensureGroupingLogicLoaded();
    await groupingModule.processTabQueue(queue);

    await clearTabProcessingQueue();
  } catch (error) {
    Logger.error('processTabQueue', 'Error processing tab queue:', error);
  }
}

/**
 * Update group title with count
 * @param {number} groupId - Group ID
 */
async function updateGroupTitleWithCount(groupId) {
  if (!groupId || groupId === browser.tabs.TAB_ID_NONE) return;

  const settings = await getSettings();
  if (!settings.showTabCount) return;

  try {
    const errorHandling = await ensureErrorHandlingLoaded();

    const result = await errorHandling.handleGroupOperation(async () => {
      const group = await browser.tabGroups.get(groupId);
      const tabsInGroup = await browser.tabs.query({ groupId });
      const count = tabsInGroup.length;

      let cleanTitle = (group.title || '')
        .replace(/\s\(\d+\)$/, '')
        .replace(/📌\s*/, '');
      let newTitle = count > 0 ? `${cleanTitle} (${count})` : cleanTitle;

      if (settings.manualGroupIds.includes(groupId)) {
        newTitle = `📌 ${newTitle}`;
      }

      if (group.title !== newTitle) {
        Logger.debug(
          'updateGroupTitleWithCount',
          `Updating group ${groupId} title to '${newTitle}'.`
        );
        await browser.tabGroups.update(groupId, { title: newTitle });
        return { success: true, newTitle };
      }
      return { success: false, reason: 'no_change_needed' };
    }, `updateGroupTitle-${groupId}`);

    if (result === null) {
      Logger.debug(
        'updateGroupTitleWithCount',
        `Group ${groupId} not found - operation ignored.`
      );
    }
  } catch (error) {
    Logger.error(
      'updateGroupTitleWithCount',
      `Error updating title for group ${groupId}:`,
      error
    );
  }
}

/**
 * Schedule suggestion check
 */
async function scheduleSuggestionCheck() {
  try {
    const settings = await getSettings();
    if (!settings.suggestionsEnabled) {
      pendingStorageUpdates[STORAGE_KEYS.PENDING_SUGGESTION] = null;
      commitStateToStorage();
      return;
    }

    const allTabs = await browser.tabs.query({
      currentWindow: true,
      pinned: false,
    });
    const ungroupedTabs = allTabs.filter(
      (tab) => !tab.groupId || tab.groupId === browser.tabs.TAB_ID_NONE
    );

    const learningEngine = await ensureLearningEngineLoaded();
    const suggestion =
      learningEngine.learningEngine.getSuggestion(ungroupedTabs);

    if (suggestion) {
      Logger.info(
        'scheduleSuggestionCheck',
        'New suggestion available.',
        suggestion
      );
      pendingStorageUpdates[STORAGE_KEYS.PENDING_SUGGESTION] = suggestion;
      commitStateToStorage();

      // Notify popup that new suggestion is ready
      browser.runtime
        .sendMessage({ action: 'suggestionUpdated' })
        .catch(() => {});
    } else {
      pendingStorageUpdates[STORAGE_KEYS.PENDING_SUGGESTION] = null;
      commitStateToStorage();
    }
  } catch (error) {
    Logger.error(
      'scheduleSuggestionCheck',
      'Error checking suggestions:',
      error
    );
    pendingStorageUpdates[STORAGE_KEYS.PENDING_SUGGESTION] = null;
    commitStateToStorage();
  }
}

/**
 * Populate tab group map with current state
 */
async function populateTabGroupMap() {
  try {
    const errorHandling = await ensureErrorHandlingLoaded();

    await errorHandling.handleCriticalOperation(
      async () => {
        const allTabs = await browser.tabs.query({});
        const mapData = {};

        for (const tab of allTabs) {
          if (tab.groupId) {
            mapData[tab.id] = tab.groupId;
          }
        }

        await saveState(STORAGE_KEYS.TAB_GROUP_MAP, mapData);
        Logger.debug(
          'populateTabGroupMap',
          `Map populated with ${Object.keys(mapData).length} entries.`
        );
        return { success: true, count: Object.keys(mapData).length };
      },
      'populateTabGroupMap',
      async () => {
        Logger.warn('populateTabGroupMap', 'Using fallback - empty tab map.');
        await saveState(STORAGE_KEYS.TAB_GROUP_MAP, {});
        return { success: false, fallback: true };
      }
    );
  } catch (error) {
    Logger.error(
      'populateTabGroupMap',
      'Error populating tab group map:',
      error
    );
  }
}

// --- MESSAGE HANDLING ---

/**
 * Process message action
 * @param {object} message - Sanitized message
 * @param {object} sender - Validated sender
 * @returns {Promise<object>} - Operation result
 */
async function processMessageAction(message, sender) {
  Logger.info('processMessageAction', `Processing action '${message.action}'`, {
    action: message.action,
  });

  switch (message.action) {
    case 'getSettings':
      return await getSettings();

    case 'getPerformanceConfig': // Return all current performance config values
    {
      const { getAllConfig } = await import('./performance-config.js');
      return getAllConfig();
    }

    case 'updatePerformanceConfig': // Update performance config with provided values
    {
      const { updateConfig, getAllConfig } = await import(
        './performance-config.js'
      );
      if (!message.config || typeof message.config !== 'object') {
        return { success: false, error: 'No config object provided.' };
      }
      updateConfig(message.config);
      return { success: true, config: getAllConfig() };
    }

    case 'getSuggestion':
      return await loadState(STORAGE_KEYS.PENDING_SUGGESTION);

    case 'clearSuggestion':
      pendingStorageUpdates[STORAGE_KEYS.PENDING_SUGGESTION] = null;
      commitStateToStorage();
      return { success: true };

    case 'clearLearningHistory': {
      const learningEngine = await ensureLearningEngineLoaded();
      await learningEngine.learningEngine.clearHistory();
      return { success: true };
    }

    case 'getLearningReport': {
      const learningEngineForReport = await ensureLearningEngineLoaded();
      const report =
        await learningEngineForReport.learningEngine.getPrivacyReport();
      return report;
    }

    case 'setLearningEnabled': {
      await updateSettings({ learningEnabled: message.enabled });
      return { success: true };
    }

    case 'acceptSuggestion':
      if (message.suggestion && message.suggestion.tabIds) {
        try {
          const { tabIds, suggestedName } = message.suggestion;
          const newGroupId = await browser.tabs.group({ tabIds });
          await browser.tabGroups.update(newGroupId, { title: suggestedName });

          // Reinforce pattern after success
          const tabsInGroup = await browser.tabs.query({ groupId: newGroupId });
          const learningEngineForSuggestion =
            await ensureLearningEngineLoaded();
          learningEngineForSuggestion.learningEngine.learnFromGroup(
            suggestedName,
            tabsInGroup
          );

          pendingStorageUpdates[STORAGE_KEYS.PENDING_SUGGESTION] = null;
          commitStateToStorage();
          return { success: true, groupId: newGroupId };
        } catch (e) {
          Logger.error(
            'acceptSuggestion',
            'Error creating group from suggestion:',
            e
          );
          return { success: false, error: e.message };
        }
      } else {
        return { success: false, error: 'Invalid suggestion.' };
      }

    case 'updateSettings': {
      const { newSettings } = await updateSettings(message.settings);

      // Update cache
      memoryCache.settings = newSettings;
      Logger.setLevel(newSettings.logLevel);

      // Update context menus
      const contextMenuModule = await ensureContextMenuLoaded();
      await contextMenuModule.updateContextMenus();

      // Reload tab renaming rules if enabled
      if (newSettings.tabRenamingEnabled) {
        const renamingModule = await ensureTabRenamingLoaded();
        renamingModule.globalTabRenamingEngine.loadRules(
          newSettings.tabRenamingRules || []
        );
      }

      // Notify other parts of extension
      browser.runtime
        .sendMessage({ action: 'settingsUpdated' })
        .catch(() => {});
      return newSettings;
    }

    case 'groupAllTabs': {
      const allTabs = await browser.tabs.query({
        currentWindow: true,
        pinned: false,
      });
      await processTabQueue(allTabs.map((t) => t.id));
      return { status: 'ok' };
    }

    case 'getMemoryStats': {
      const memoryModule = await loadModule('adaptive-memory-manager.js');
      // Create memory maps object for compatibility
      const memoryMaps = {
        get tabGroupMap() {
          return getTabGroupMap();
        },
        get debouncedTitleUpdaters() {
          return memoryCache.debouncedTimers;
        },
        get groupActivity() {
          return getGroupActivity();
        },
        get singleTabGroupTimestamps() {
          return (async () => {
            const data = await loadState(
              STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS
            );
            // Convert object to Map<number, number>
            return new Map(
              Object.entries(data || {}).map(([k, v]) => [parseInt(k), v])
            );
          })();
        },
        // Optionally, add other required maps here as needed
      };
      return memoryModule.getMemoryStats(memoryMaps);
    }

    case 'log': {
      const effectiveTabId =
        sender.tab && typeof sender.tab.id === 'number'
          ? sender.tab.id
          : typeof message.tabId === 'number'
          ? message.tabId
          : null;

      if (
        (effectiveTabId !== null || sender.tab) &&
        message.level &&
        message.context &&
        message.message
      ) {
        Logger[message.level](
          `ContentScript: ${message.context}`,
          message.message,
          ...(message.details || []),
          { tabId: effectiveTabId }
        );
      }
      return { success: true };
    }

    default:
      Logger.warn('processMessageAction', `Unknown action: ${message.action}`);
      throw new Error(`Unknown action: ${message.action}`);
  }
}

// --- EVENT LISTENERS (GLOBAL SCOPE) ---

// Install and startup events
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    Logger.info(
      'onInstalled',
      'Extension installed for the first time. Opening welcome page.'
    );
    const welcomeUrl = browser.runtime.getURL('help/help.html');
    browser.tabs.create({ url: welcomeUrl });
  } else if (details.reason === 'update') {
    Logger.info('onInstalled', 'Extension updated. Reloading settings...');
    try {
      await loadSettings();
      Logger.info('onInstalled', 'Settings reloaded after update.');
    } catch (e) {
      Logger.error('onInstalled', 'Error reloading settings after update:', e);
    }
  }
});

// Tab event listeners
browser.tabs.onCreated.addListener(handleTabCreated);
browser.tabs.onUpdated.addListener(handleTabUpdated, {
  properties: ['status', 'groupId', 'title', 'url'],
});
browser.tabs.onRemoved.addListener(handleTabRemoved);
browser.tabs.onActivated.addListener(handleTabActivated);

// Tab group event listeners
if (browser.tabGroups) {
  browser.tabGroups.onCreated.addListener(handleTabGroupCreated);
  browser.tabGroups.onUpdated.addListener(handleTabGroupUpdated);
  browser.tabGroups.onRemoved.addListener(handleTabGroupRemoved);
}

// Message listener
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      // Validate sender
      const effectiveTabId =
        sender.tab && typeof sender.tab.id === 'number'
          ? sender.tab.id
          : typeof message.tabId === 'number'
          ? message.tabId
          : 0;

      if (!validateSender(sender, message?.action, effectiveTabId)) {
        Logger.warn(
          'onMessage',
          `Invalid sender for action ${message?.action}`,
          {
            sender,
            tabId: effectiveTabId,
          }
        );
        sendResponse({ error: 'Invalid sender' });
        return;
      }

      // Rate limiting
      if (!messageRateLimiter.isAllowed(effectiveTabId)) {
        Logger.warn(
          'onMessage',
          `Rate limit exceeded for tab ${effectiveTabId}`
        );
        sendResponse({ error: 'Rate limit exceeded' });
        return;
      }

      // Message validation
      const validation = validateRuntimeMessage(message, sender);
      if (!validation.isValid) {
        Logger.warn(
          'onMessage',
          `Invalid message: ${validation.errors.join('; ')}`,
          { message, sender }
        );
        sendResponse({
          error: `Invalid message: ${validation.errors.join('; ')}`,
        });
        return;
      }

      // Sanitize message
      const sanitizedMessage = sanitizeMessageData(message);

      // Timeout for long operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 5000);
      });

      Logger.info(
        'onMessage',
        `Action '${sanitizedMessage.action}' received.`,
        {
          action: sanitizedMessage.action,
          tabId: effectiveTabId,
        }
      );

      // Process message
      const fakeSender =
        sender.tab || effectiveTabId
          ? { ...sender, tab: sender.tab || { id: effectiveTabId } }
          : sender;

      const operationPromise = processMessageAction(
        sanitizedMessage,
        fakeSender
      );
      const result = await Promise.race([operationPromise, timeoutPromise]);
      sendResponse(result);
    } catch (error) {
      Logger.error(
        'onMessage',
        `Error processing action '${message?.action}':`,
        error
      );
      sendResponse({ error: error.message });
    }
  })();
  return true; // Indicates async response
});

// --- INITIALIZATION ---

/**
 * Initialize the extension
 */
async function initializeExtension() {
  try {
    Logger.info(
      'initializeExtension',
      '🚀 Starting event-driven initialization...'
    );

    // Initialize state storage
    await initializeState();

    // Load settings
    await loadSettings();
    const settings = await getSettings();
    Logger.setLevel(settings.logLevel);

    // Load performance config
    loadConfigFromSettings(settings);

    // Populate tab group map
    await populateTabGroupMap();

    // Setup timers based on settings
    if (settings.autoCollapseTimeout > 0) {
      setInterval(async () => {
        await checkAutoCollapse();
      }, getConfig('AUTO_COLLAPSE_CHECK_INTERVAL') || 30000);
    }

    if (settings.ungroupSingleTabs && settings.ungroupSingleTabsTimeout > 0) {
      setInterval(async () => {
        await checkSingleTabGroups();
      }, getConfig('SINGLE_TAB_CHECK_INTERVAL') || 10000);
    }

    // Setup periodic cleanup
    if (browser.alarms) {
      browser.alarms.create('memoryLeakCleanup', { periodInMinutes: 3 });
      browser.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'memoryLeakCleanup') {
          // Perform cleanup
          Logger.info('onAlarm', 'Performing periodic cleanup');
          clearMemoryCache(); // Clear memory cache but preserve storage
        }
      });
    }

    Logger.info(
      'initializeExtension',
      '✅ Event-driven initialization completed successfully!'
    );

    return { success: true };
  } catch (error) {
    Logger.error(
      'initializeExtension',
      '❌ Critical initialization error:',
      error
    );
    return { success: false, error: error.message };
  }
}

/**
 * Check for auto-collapse of inactive groups
 */
async function checkAutoCollapse() {
  const settings = await getSettings();
  if (settings.autoCollapseTimeout <= 0) return;

  const timeoutMs = settings.autoCollapseTimeout * 1000;

  try {
    const windows = await browser.windows.getAll({ windowTypes: ['normal'] });
    const groupActivity = await getGroupActivity();

    for (const window of windows) {
      const activeTabs = await browser.tabs.query({
        active: true,
        windowId: window.id,
      });
      const activeTabInWindow = activeTabs[0] || null;
      const groups = await browser.tabGroups.query({
        windowId: window.id,
        collapsed: false,
      });

      for (const group of groups) {
        if (activeTabInWindow && activeTabInWindow.groupId === group.id) {
          await updateGroupActivity(group.id, Date.now());
          continue;
        }

        const lastActivityTime = groupActivity.get(group.id) || Date.now();
        if (Date.now() - lastActivityTime > timeoutMs) {
          Logger.debug(
            'checkAutoCollapse',
            `Collapsing inactive group ${group.id}.`
          );
          await browser.tabGroups.update(group.id, { collapsed: true });
          // Remove from activity tracking after collapse using batched storage
          let activityData = pendingStorageUpdates[STORAGE_KEYS.GROUP_ACTIVITY];
          if (activityData === null) {
            activityData = (await loadState(STORAGE_KEYS.GROUP_ACTIVITY)) || {};
            pendingStorageUpdates[STORAGE_KEYS.GROUP_ACTIVITY] = activityData;
          }
          delete activityData[group.id];
          commitStateToStorage();
        }
      }
    }
  } catch (e) {
    Logger.error('checkAutoCollapse', 'Error checking inactive groups:', e);
  }
}

/**
 * Check for single tab groups to ungroup
 */
async function checkSingleTabGroups() {
  const settings = await getSettings();
  if (!settings.ungroupSingleTabs || settings.ungroupSingleTabsTimeout <= 0)
    return;

  const timeoutMs = settings.ungroupSingleTabsTimeout * 1000;
  const now = Date.now();

  try {
    const allTabs = await browser.tabs.query({});
    const groupInfo = new Map();

    for (const tab of allTabs) {
      if (tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
        if (!groupInfo.has(tab.groupId)) {
          groupInfo.set(tab.groupId, { count: 0, tabIds: [] });
        }
        const info = groupInfo.get(tab.groupId);
        info.count++;
        info.tabIds.push(tab.id);
      }
    }

    const timestampData =
      (await loadState(STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS)) || {};

    for (const [groupId, info] of groupInfo.entries()) {
      if (info.count === 1) {
        if (settings.manualGroupIds.includes(groupId)) continue;

        if (!timestampData[groupId]) {
          timestampData[groupId] = now;
        } else {
          if (now - timestampData[groupId] > timeoutMs) {
            Logger.debug(
              'checkSingleTabGroups',
              `Ungrouping single tab group ${groupId}.`
            );
            await browser.tabs.ungroup(info.tabIds);
            delete timestampData[groupId];
          }
        }
      } else {
        delete timestampData[groupId];
      }
    }

    // Clean up orphaned timestamps
    for (const groupId of Object.keys(timestampData)) {
      if (!groupInfo.has(parseInt(groupId))) {
        delete timestampData[groupId];
      }
    }

    pendingStorageUpdates[STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS] =
      timestampData;
    commitStateToStorage();
  } catch (e) {
    Logger.error(
      'checkSingleTabGroups',
      'Error checking single tab groups:',
      e
    );
    // Clear timestamps on error to prevent accumulation
    pendingStorageUpdates[STORAGE_KEYS.SINGLE_TAB_GROUP_TIMESTAMPS] = {};
    commitStateToStorage();
  }
}

// Initialize immediately when service worker starts
initializeExtension().catch((error) => {
  Logger.error('Main', '💥 Unhandled initialization error:', error);
});
