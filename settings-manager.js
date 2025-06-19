/**
 * @file settings-manager.js
 * @description Gere as configurações da extensão e o armazenamento, com suporte para sincronização.
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
  syncEnabled: false, // A sincronização é opcional
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
};

// Objetos em memória
export let settings = { ...DEFAULT_SETTINGS };
export let smartNameCache = new Map();

// Timeout para o debounce da gravação do cache.
let saveCacheTimeout = null;

/**
 * Determina qual área de armazenamento usar (sync ou local).
 * @param {boolean} useSync - Se deve usar o armazenamento sync.
 * @returns {browser.storage.StorageArea} A área de armazenamento apropriada.
 */
function getStorage(useSync) {
    return useSync ? browser.storage.sync : browser.storage.local;
}

/**
 * Carrega as configurações do armazenamento. O armazenamento sync é prioritário.
 */
export async function loadSettings() {
    try {
        // Prioriza o armazenamento sync.
        const syncData = await browser.storage.sync.get('settings');
        let loadedSettings = null;

        if (syncData && syncData.settings) {
            console.log("A carregar configurações do sync.");
            loadedSettings = syncData.settings;
        } else {
            // Recorre ao armazenamento local se não estiver no sync.
            console.log("Sem configurações no sync, a tentar local.");
            const localData = await browser.storage.local.get('settings');
            if (localData && localData.settings) {
                loadedSettings = localData.settings;
            }
        }
        
        settings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

        // O cache de nomes inteligentes é sempre local, pois pode ser grande e específico da máquina.
        const cacheData = await browser.storage.local.get('smartNameCache');
        if (cacheData && cacheData.smartNameCache) {
            smartNameCache = new Map(Object.entries(cacheData.smartNameCache));
        }

    } catch(e) {
        console.error("Erro fatal ao carregar configurações:", e);
        // Em caso de erro fatal, reverte para os padrões.
        settings = { ...DEFAULT_SETTINGS };
        smartNameCache = new Map();
        throw e;
    }
}

/**
 * Atualiza uma parte das configurações, guarda na área de armazenamento correta
 * e lida com a movimentação das configurações entre o armazenamento local e sync.
 * @param {object} newSettings - As novas configurações a aplicar.
 */
export async function updateSettings(newSettings) {
    const oldSettings = { ...settings };
    const oldSyncStatus = oldSettings.syncEnabled;

    // Aplica as novas configurações ao nosso objeto em memória
    settings = { ...settings, ...newSettings };
    const newSyncStatus = settings.syncEnabled;

    const targetStorage = getStorage(newSyncStatus);

    try {
        await targetStorage.set({ settings });
        console.log(`Configurações guardadas no armazenamento ${newSyncStatus ? 'sync' : 'local'}.`);

        // Se o estado de sincronização mudou, remove as configurações da localização antiga.
        if (oldSyncStatus !== newSyncStatus) {
            const sourceStorage = getStorage(oldSyncStatus);
            await sourceStorage.remove('settings');
            console.log(`Configurações removidas do armazenamento ${oldSyncStatus ? 'sync' : 'local'}.`);
        }

    } catch (e) {
        console.error(`Erro ao guardar configurações no armazenamento ${newSyncStatus ? 'sync' : 'local'}:`, e);
        // Opcionalmente, reverte as configurações em caso de falha
        settings = oldSettings;
        throw e;
    }

    return { oldSettings, newSettings: settings };
}

/**
 * Guarda o cache de nomes inteligentes no armazenamento local com debounce.
 * Este cache NÃO deve ser sincronizado.
 */
export function saveSmartNameCache() {
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
    }

    saveCacheTimeout = setTimeout(async () => {
        try {
            // Usa explicitamente o armazenamento local para o cache.
            await browser.storage.local.set({ smartNameCache: Object.fromEntries(smartNameCache) });
        } catch (e) {
            console.error("Erro ao guardar o cache de nomes inteligentes:", e);
        }
        saveCacheTimeout = null;
    }, 2000);
}

/**
 * Limpa o cache de nomes inteligentes da memória и do armazenamento local.
 */
export function clearSmartNameCache() {
    smartNameCache.clear();
    
    if (saveCacheTimeout) {
        clearTimeout(saveCacheTimeout);
        saveCacheTimeout = null;
    }
    
    // Usa explicitamente o armazenamento local para o cache.
    browser.storage.local.remove('smartNameCache');
}
