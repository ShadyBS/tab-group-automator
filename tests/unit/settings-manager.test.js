import { 
  DEFAULT_SETTINGS, 
  loadSettings, 
  updateSettings, 
  saveSmartNameCache, 
  clearSmartNameCache 
} from '../../settings-manager.js';
import { settings, smartNameCache } from '../../settings-manager.js';

beforeEach(() => {
  // Reset mocks
  browser.storage.local.get.mockReset();
  browser.storage.local.set.mockReset();
  browser.storage.local.remove.mockReset();
  
  // Reset state
  Object.assign(settings, DEFAULT_SETTINGS);
  smartNameCache.clear();
});

describe('settings-manager', () => {
  test('DEFAULT_SETTINGS should have correct values', () => {
    expect(DEFAULT_SETTINGS).toEqual({
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
      manualGroupIds: []
    });
  });

  test('loadSettings should initialize with defaults when storage is empty', async () => {
    browser.storage.local.get.mockResolvedValue({});
    
    await loadSettings();
    
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(smartNameCache.size).toBe(0);
  });

  test('loadSettings should merge stored settings with defaults', async () => {
    const storedSettings = {
      autoGroupingEnabled: false,
      customRules: [{ name: 'Test Rule', patterns: ['*example.com*'] }]
    };
    
    browser.storage.local.get.mockResolvedValue({
      settings: storedSettings,
      smartNameCache: { 'example.com': 'Example' }
    });
    
    await loadSettings();
    
    expect(settings.autoGroupingEnabled).toBe(false);
    expect(settings.customRules).toEqual(storedSettings.customRules);
    expect(smartNameCache.get('example.com')).toBe('Example');
  });

  test('updateSettings should update settings and save to storage', async () => {
    const newSettings = {
      autoGroupingEnabled: false,
      groupingMode: 'domain'
    };
    
    await updateSettings(newSettings);
    
    expect(settings.autoGroupingEnabled).toBe(false);
    expect(settings.groupingMode).toBe('domain');
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      settings: expect.objectContaining(newSettings)
    });
  });

  test('saveSmartNameCache should debounce saves', async () => {
    jest.useFakeTimers();
    
    smartNameCache.set('example.com', 'Example');
    saveSmartNameCache();
    
    // Should not save immediately
    expect(browser.storage.local.set).not.toHaveBeenCalled();
    
    // Advance time by 2 seconds
    jest.advanceTimersByTime(2000);
    
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      smartNameCache: { 'example.com': 'Example' }
    });
    
    jest.useRealTimers();
  });

  test('clearSmartNameCache should clear cache and storage', async () => {
    smartNameCache.set('example.com', 'Example');
    
    await clearSmartNameCache();
    
    expect(smartNameCache.size).toBe(0);
    expect(browser.storage.local.remove).toHaveBeenCalledWith('smartNameCache');
  });
});