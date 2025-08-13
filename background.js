/**
 * @file background.js
 * @description Ponto de entrada principal da extensão, gere eventos e a fila de processamento.
 */

// Importa o polyfill para garantir que o namespace `browser` esteja disponível em todos os navegadores.
import "./vendor/browser-polyfill.js";

import Logger from "./logger.js";
import {
  settings,
  loadSettings,
  updateSettings,
  DEFAULT_SETTINGS,
  smartNameCache,
} from "./settings-manager.js";
import { processTabQueue } from "./grouping-logic.js";
import {
  initializeContextMenus,
  updateContextMenus,
} from "./context-menu-manager.js";
import { pendingAutomaticGroups, injectionFailureMap } from "./app-state.js";
import {
  handleTabOperation,
  handleGroupOperation,
  handleCriticalOperation,
  withErrorHandling,
  globalAdaptiveErrorHandler,
} from "./adaptive-error-handler.js";
import {
  startMemoryCleanup,
  stopMemoryCleanup,
  performMemoryCleanup,
  isMemoryLimitExceeded,
  emergencyCleanup,
  getMemoryStats,
  globalAdaptiveMemoryManager,
} from "./adaptive-memory-manager.js";
import {
  getConfig,
  loadConfigFromSettings,
  getConfigForSettings,
  createConfigurableDelay,
  getAllConfig,
  updateConfig,
} from "./performance-config.js";
import {
  globalTabParallelProcessor,
  globalWindowDataProcessor,
} from "./parallel-batch-processor.js";
import {
  getAPIWrapperStats,
  clearAPIQueues,
  pauseAPICategory,
  resumeAPICategory,
} from "./browser-api-wrapper.js";
import { globalAPIRateLimiter } from "./api-rate-limiter.js";
import { globalTabRenamingEngine } from "./tab-renaming-engine.js"; // Importa o motor de renomeação de abas

// --- Constantes e Variáveis de Estado ---
// (Agora obtidas dinamicamente via getConfig)

let tabProcessingQueue = new Set();
let queueTimeout = null;
let tabGroupMap = new Map();
let debouncedTitleUpdaters = new Map(); // Usado para debounce de títulos de grupo E invalidação de cache
let groupActivity = new Map();
let collapseInterval = null;
let ungroupInterval = null;
let singleTabGroupTimestamps = new Map();

// Objeto para facilitar passagem de mapas para gerenciador de memória
const memoryMaps = {
  get tabGroupMap() {
    return tabGroupMap;
  },
  get debouncedTitleUpdaters() {
    return debouncedTitleUpdaters;
  },
  get groupActivity() {
    return groupActivity;
  },
  get singleTabGroupTimestamps() {
    return singleTabGroupTimestamps;
  },
  get smartNameCache() {
    return smartNameCache;
  },
  get injectionFailureMap() {
    return injectionFailureMap;
  },
  get pendingAutomaticGroups() {
    return pendingAutomaticGroups;
  },
};

// --- Lógica de Onboarding ---
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    Logger.info(
      "onInstalled",
      "Extensão instalada pela primeira vez. A abrir página de boas-vindas."
    );
    const welcomeUrl = browser.runtime.getURL("help/help.html");
    browser.tabs.create({ url: welcomeUrl });
  } else if (details.reason === "update") {
    // Recarrega as configurações após uma atualização para garantir que
    // configurações do sync sejam preservadas
    Logger.info(
      "onInstalled",
      "Extensão atualizada. A recarregar configurações..."
    );
    try {
      await loadSettings();
      Logger.info(
        "onInstalled",
        "Configurações recarregadas após atualização."
      );
    } catch (e) {
      Logger.error(
        "onInstalled",
        "Erro ao recarregar configurações após atualização:",
        e
      );
    }
  }
});

// --- Funções Auxiliares ---

/**
 * Extrai hostname de uma URL
 * @param {string} url - URL para extrair hostname
 * @returns {string|null} Hostname ou null se inválido
 */
function getHostnameFromUrl(url) {
  if (typeof url !== "string" || !url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch (e) {
    Logger.debug(
      "getHostnameFromUrl",
      `Erro ao extrair hostname da URL: ${url}`
    );
    return null;
  }
}

/**
 * Invalida cache para mudanças de domínio
 * @param {string} hostname - Hostname que mudou
 * @param {string} changeType - Tipo de mudança
 */
async function invalidateCacheForDomainChange(hostname, changeType) {
  try {
    const { invalidateCacheByDomainChange } = await import(
      "./settings-manager.js"
    );
    invalidateCacheByDomainChange(hostname, changeType);
  } catch (e) {
    Logger.debug(
      "invalidateCacheForDomainChange",
      `Erro ao invalidar cache: ${e.message}`
    );
  }
}

// --- Lógica de Processamento e Gestão de Eventos ---

/**
 * Agenda o processamento da fila de abas.
 * Usa um timeout para agrupar múltiplas adições de abas em um único processamento.
 * Realiza uma verificação de memória de emergência antes de processar.
 */
function scheduleQueueProcessing() {
  Logger.debug(
    "scheduleQueueProcessing",
    "Agendamento de processamento da fila."
  );

  // Verifica se precisa de limpeza de emergência antes de processar
  if (isMemoryLimitExceeded(memoryMaps)) {
    Logger.warn(
      "scheduleQueueProcessing",
      "Limite de memória excedido - executando limpeza de emergência."
    );
    emergencyCleanup(memoryMaps).then(() => {
      Logger.info(
        "scheduleQueueProcessing",
        "Limpeza de emergência concluída."
      );
    });
  }

  if (queueTimeout) clearTimeout(queueTimeout);
  queueTimeout = setTimeout(async () => {
    const tabsToProcess = Array.from(tabProcessingQueue);
    tabProcessingQueue.clear();
    Logger.info(
      "Queue",
      `A processar ${tabsToProcess.length} abas.`,
      tabsToProcess
    );
    await processTabQueue(tabsToProcess);
  }, getConfig("QUEUE_DELAY"));
}

/**
 * Lida com o evento de atualização de uma aba (onUpdated).
 * Responsável por acionar o agrupamento, a renomeação de abas e a invalidação de cache
 * com base em mudanças de status, título ou URL.
 * @param {number} tabId - ID da aba que foi atualizada.
 * @param {object} changeInfo - Objeto que descreve as mudanças na aba.
 * @param {browser.tabs.Tab} tab - O estado atual da aba.
 */
// CORRIGIDO: A função agora reage a mudanças de título em abas já carregadas.
function handleTabUpdated(tabId, changeInfo, tab) {
  Logger.debug("handleTabUpdated", `Aba ${tabId} atualizada.`, {
    changeInfo,
    tab,
  });

  // Lógica para atualizar o contador de abas quando uma aba muda de grupo.
  if (changeInfo.groupId !== undefined) {
    const oldGroupId = tabGroupMap.get(tabId);
    if (oldGroupId) {
      scheduleTitleUpdate(oldGroupId);
    }
    scheduleTitleUpdate(changeInfo.groupId);
    tabGroupMap.set(tabId, changeInfo.groupId);
  }

  // Invalidação de cache baseada em mudanças significativas (otimizada)
  if (tab.url && tab.url.startsWith("http")) {
    const hostname = getHostnameFromUrl(tab.url);
    if (hostname) {
      // Invalida cache apenas para mudanças de título significativas
      if (changeInfo.title && tab.status === "complete") {
        // Só invalida se o título mudou substancialmente (não apenas contadores)
        const titleChange = changeInfo.title;
        const isSignificantChange =
          titleChange &&
          titleChange.length > 5 &&
          !titleChange.match(/^\(\d+\)/) && // Não é apenas um contador
          !titleChange.match(/\d+\s*(new|unread|messages?|notifications?)$/i); // Não é apenas notificação

        if (isSignificantChange) {
          // Debounce cache invalidation to avoid excessive calls
          const cacheKey = `cache-invalidate-${hostname}`;
          if (!debouncedTitleUpdaters.has(cacheKey)) {
            const timeoutId = setTimeout(() => {
              invalidateCacheForDomainChange(hostname, "title_change");
              debouncedTitleUpdaters.delete(cacheKey);
            }, 2000); // 2 second debounce
            debouncedTitleUpdaters.set(cacheKey, timeoutId);
          }
        }
      }

      // Invalida cache se houve mudança de URL (navegação)
      if (changeInfo.url) {
        invalidateCacheForDomainChange(hostname, "url_change");
      }
    }
  }

  // Determina se a aba precisa ser processada para AGRUPAMENTO.
  // Isto acontece se o status mudou para 'complete' OU se o título mudou enquanto a aba já estava 'complete'.
  const needsGroupingProcessing =
    settings.autoGroupingEnabled &&
    tab.url &&
    tab.url.startsWith("http") &&
    (changeInfo.status === "complete" ||
      (changeInfo.title && tab.status === "complete"));

  if (needsGroupingProcessing) {
    Logger.debug(
      "handleTabUpdated",
      `Aba ${tabId} marcada para processamento de agrupamento devido a mudança de status ou título.`
    );
    injectionFailureMap.delete(tabId);

    // Debounce agrupamento por aba
    const groupingDebounceKey = `grouping-${tabId}`;
    if (debouncedTitleUpdaters.has(groupingDebounceKey)) {
      clearTimeout(debouncedTitleUpdaters.get(groupingDebounceKey));
    }
    const timeoutId = setTimeout(() => {
      tabProcessingQueue.add(tabId);
      scheduleQueueProcessing();
      debouncedTitleUpdaters.delete(groupingDebounceKey);
    }, 300); // 300ms debounce para agrupamento
    debouncedTitleUpdaters.set(groupingDebounceKey, timeoutId);
  }

  // --- NOVO: Acionamento da Renomeação de Abas ---
  // A renomeação deve ocorrer após o agrupamento, mas pode ser acionada por mudanças de título ou URL.
  // Usamos um debounce específico para renomeação para evitar sobrecarga.
  const renamingDebounceKey = `renaming-${tabId}`;
  if (debouncedTitleUpdaters.has(renamingDebounceKey)) {
    clearTimeout(debouncedTitleUpdaters.get(renamingDebounceKey));
  }

  if (
    settings.tabRenamingEnabled &&
    tab.url &&
    tab.url.startsWith("http") &&
    (changeInfo.status === "complete" || changeInfo.title || changeInfo.url)
  ) {
    const timeoutId = setTimeout(async () => {
      Logger.debug(
        "handleTabUpdated",
        `Acionando motor de renomeação para aba ${tabId}.`
      );
      await globalTabRenamingEngine.processTab(tabId, tab);
      debouncedTitleUpdaters.delete(renamingDebounceKey);
    }, getConfig("TAB_RENAMING_DELAY")); // Usa um delay configurável para renomeação
    debouncedTitleUpdaters.set(renamingDebounceKey, timeoutId);
  }
  // --- FIM NOVO ---
}

/**
 * Lida com o evento de remoção de uma aba (onRemoved).
 * Limpa os recursos associados à aba removida e agenda a atualização
 * do título do grupo ao qual pertencia.
 * @param {number} tabId - ID da aba que foi removida.
 * @param {object} removeInfo - Informações sobre a remoção (ex: isWindowClosing).
 */
function handleTabRemoved(tabId, removeInfo) {
  Logger.debug("handleTabRemoved", `Aba ${tabId} removida.`, { removeInfo });
  const oldGroupId = tabGroupMap.get(tabId);
  if (oldGroupId) {
    scheduleTitleUpdate(oldGroupId);
  }

  // Limpeza proativa de recursos relacionados à aba removida
  tabGroupMap.delete(tabId);
  injectionFailureMap.delete(tabId);

  // Remove entrada de grupos pendentes se a aba era a chave
  if (pendingAutomaticGroups.has(tabId)) {
    pendingAutomaticGroups.delete(tabId);
  }

  // Limpa qualquer debounce de renomeação pendente para esta aba
  const renamingDebounceKey = `renaming-${tabId}`;
  if (debouncedTitleUpdaters.has(renamingDebounceKey)) {
    clearTimeout(debouncedTitleUpdaters.get(renamingDebounceKey));
    debouncedTitleUpdaters.delete(renamingDebounceKey);
  }
}

/**
 * Ativa ou desativa os listeners de eventos de abas (onUpdated, onRemoved).
 * Inclui otimizações e fallbacks para garantir a compatibilidade entre navegadores.
 * @param {boolean} enable - `true` para ativar os listeners, `false` para desativar.
 */
// CORRIGIDO: Adiciona "title" às propriedades que o listener de onUpdated observa.
function toggleListeners(enable) {
  // Adiciona verificações de segurança para garantir que as APIs existem antes de usá-las.
  // Isto previne falhas se as permissões estiverem em falta ou se o browser não suportar a API.
  if (!browser.tabs || !browser.tabs.onUpdated || !browser.tabs.onRemoved) {
    Logger.warn(
      "toggleListeners",
      "A API browser.tabs.onUpdated ou onRemoved não está disponível. Listeners não serão alterados."
    );
    return;
  }

  const hasUpdatedListener =
    browser.tabs.onUpdated.hasListener(handleTabUpdated);
  const hasRemovedListener =
    browser.tabs.onRemoved.hasListener(handleTabRemoved);

  if (enable) {
    if (!hasUpdatedListener) {
      try {
        // Tenta registar o listener com um filtro otimizado.
        // Isto é mais eficiente, pois a extensão só é notificada sobre as alterações que lhe interessam.
        browser.tabs.onUpdated.addListener(handleTabUpdated, {
          properties: ["status", "groupId", "title", "url"], // Adicionado 'url' para renomeação
        });
      } catch (e) {
        // Fallback para navegadores (como algumas versões do Edge) que podem não suportar
        // o filtro de propriedade 'title'. Neste caso, registamos o listener sem filtros.
        // A extensão continuará a funcionar, embora receba mais eventos do que o necessário.
        Logger.warn(
          "toggleListeners",
          "Otimização do listener 'onUpdated' não suportada pelo navegador. A usar fallback compatível."
        );
        // O erro 'e' só é relevante para depuração, por isso não o mostramos nos níveis de log normais.
        Logger.debug("toggleListeners", "Detalhes do erro de filtro:", e);
        browser.tabs.onUpdated.addListener(handleTabUpdated);
      }
    }
    if (!hasRemovedListener) {
      browser.tabs.onRemoved.addListener(handleTabRemoved);
    }
  } else {
    if (hasUpdatedListener) {
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
    }
    if (hasRemovedListener) {
      browser.tabs.onRemoved.removeListener(handleTabRemoved);
    }
  }
}

/**
 * Lida com o evento de criação de uma nova aba.
 * Atualiza o contador do grupo se a aba já pertencer a um grupo.
 * @param {browser.tabs.Tab} tab - A aba criada.
 */
function handleTabCreated(tab) {
  if (tab && tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
    scheduleTitleUpdate(tab.groupId);
    tabGroupMap.set(tab.id, tab.groupId);
  }
}

/**
 * Lida com o evento de anexação de uma aba a um grupo.
 * Atualiza o contador do grupo de destino.
 * @param {object} attachInfo - Informações sobre a anexação.
 * @param {number} attachInfo.tabId - ID da aba anexada.
 * @param {number} attachInfo.newWindowId - ID da nova janela.
 * @param {number} attachInfo.newPosition - Nova posição da aba.
 */
async function handleTabAttached(attachInfo) {
  try {
    const tab = await browser.tabs.get(attachInfo.tabId);
    if (tab && tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
      scheduleTitleUpdate(tab.groupId);
      tabGroupMap.set(tab.id, tab.groupId);
    }
  } catch (e) {
    Logger.warn("handleTabAttached", "Erro ao obter aba anexada:", e);
  }
}

// --- Lógica de Comportamento dos Grupos (Timers) ---

/**
 * Centraliza o gerenciamento dos timers de automação para evitar concorrência.
 * Garante que apenas uma instância de cada timer esteja ativa.
 */
function updateAutomationTimers() {
  updateAutoCollapseTimer();
  updateUngroupTimer();
}

/**
 * Inicia ou para o temporizador que verifica e recolhe grupos de abas inativos.
 * A configuração é baseada em `settings.autoCollapseTimeout`.
 */
function updateAutoCollapseTimer() {
  Logger.debug(
    "Timers",
    `Timer de auto-collapse ${
      settings.autoCollapseTimeout > 0
        ? `ativado (${settings.autoCollapseTimeout}s)`
        : "desativado"
    }.`
  );
  if (collapseInterval) clearInterval(collapseInterval);
  collapseInterval = null;
  if (settings.autoCollapseTimeout > 0) {
    collapseInterval = setInterval(async () => {
      const timeoutMs = settings.autoCollapseTimeout * 1000;
      if (timeoutMs <= 0) return;
      try {
        const windows = await browser.windows.getAll({
          windowTypes: ["normal"],
        });
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
              groupActivity.set(group.id, Date.now());
              continue;
            }
            const lastActivityTime = groupActivity.get(group.id) || Date.now();
            if (Date.now() - lastActivityTime > timeoutMs) {
              Logger.debug(
                "checkAutoCollapse",
                `Grupo inativo ${group.id} a ser recolhido.`
              );
              await browser.tabGroups.update(group.id, { collapsed: true });
              groupActivity.delete(group.id);
            }
          }
        }
      } catch (e) {
        Logger.error(
          "checkAutoCollapse",
          "Erro ao verificar grupos inativos:",
          e
        );
      }
    }, getConfig("AUTO_COLLAPSE_CHECK_INTERVAL"));
  }
}

/**
 * Verifica e desagrupa grupos que contêm apenas uma aba por um período de tempo configurado.
 * Ignora grupos marcados como manuais.
 */
async function checkSingleTabGroups() {
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

    for (const [groupId, info] of groupInfo.entries()) {
      if (info.count === 1) {
        if (settings.manualGroupIds.includes(groupId)) continue;

        if (!singleTabGroupTimestamps.has(groupId)) {
          singleTabGroupTimestamps.set(groupId, now);
        } else {
          if (now - singleTabGroupTimestamps.get(groupId) > timeoutMs) {
            Logger.debug(
              "checkSingleTabGroups",
              `Grupo ${groupId} solitário. A desagrupar a aba ${info.tabIds[0]}.`
            );
            await browser.tabs.ungroup(info.tabIds); // desagrupa todas as abas (deve ser só uma)
            singleTabGroupTimestamps.delete(groupId);
          }
        }
      } else {
        singleTabGroupTimestamps.delete(groupId);
      }
    }

    for (const groupId of singleTabGroupTimestamps.keys()) {
      if (!groupInfo.has(groupId)) {
        singleTabGroupTimestamps.delete(groupId);
      }
    }
  } catch (e) {
    Logger.error(
      "checkSingleTabGroups",
      "Erro ao verificar grupos com abas únicas:",
      e
    );
    // Limpa timestamps órfãos para evitar acumulação de memória
    singleTabGroupTimestamps.clear();
  }
}

/**
 * Inicia ou para o temporizador que verifica e desagrupa grupos com uma única aba.
 * A configuração é baseada em `settings.ungroupSingleTabs`.
 */
function updateUngroupTimer() {
  Logger.debug(
    "Timers",
    `Timer de desagrupar abas únicas ${
      settings.ungroupSingleTabs
        ? `ativado (${settings.ungroupSingleTabsTimeout}s)`
        : "desativado"
    }.`
  );
  if (ungroupInterval) clearInterval(ungroupInterval);
  ungroupInterval = null;
  if (settings.ungroupSingleTabs && settings.ungroupSingleTabsTimeout > 0) {
    ungroupInterval = setInterval(
      checkSingleTabGroups,
      getConfig("SINGLE_TAB_CHECK_INTERVAL")
    );
  }
}

/**
 * Lida com a ativação de uma aba.
 * Se a configuração `uncollapseOnActivate` estiver ativa, expande o grupo
 * da aba ativada e atualiza o seu tempo de atividade.
 * @param {object} activeInfo - Informações sobre a aba ativada.
 * @param {number} activeInfo.tabId - O ID da aba que foi ativada.
 */
async function handleTabActivated({ tabId }) {
  if (!settings.uncollapseOnActivate) return;

  const result = await handleTabOperation(async () => {
    const tab = await browser.tabs.get(tabId);
    if (tab.groupId && tab.groupId !== browser.tabs.TAB_ID_NONE) {
      const group = await browser.tabGroups.get(tab.groupId);
      groupActivity.set(group.id, Date.now());
      if (group.collapsed) {
        Logger.debug(
          "handleTabActivated",
          `A expandir o grupo ${group.id} devido à ativação da aba ${tabId}.`
        );
        await browser.tabGroups.update(group.id, { collapsed: false });
      }
      return { success: true, groupId: group.id };
    }
    return { success: false, reason: "no_group" };
  }, `handleTabActivated-${tabId}`);

  if (result === null) {
    Logger.debug(
      "handleTabActivated",
      `Aba ${tabId} ou grupo não encontrado - operação ignorada.`
    );
  }
}

// --- Lógica de Contagem e Títulos dos Grupos ---

/**
 * Atualiza o título de um grupo para incluir a contagem de abas.
 * Ex: "Meu Grupo" -> "Meu Grupo (3)".
 * Adiciona um pino (📌) para grupos manuais.
 * @param {number} groupId - O ID do grupo a ser atualizado.
 */
async function updateGroupTitleWithCount(groupId) {
  if (
    !settings.showTabCount ||
    !groupId ||
    groupId === browser.tabs.TAB_ID_NONE
  )
    return;

  const result = await handleGroupOperation(async () => {
    const group = await browser.tabGroups.get(groupId);
    const tabsInGroup = await browser.tabs.query({ groupId });
    const count = tabsInGroup.length;

    let cleanTitle = (group.title || "")
      .replace(/\s\(\d+\)$/, "")
      .replace(/📌\s*/, "");
    let newTitle = count > 0 ? `${cleanTitle} (${count})` : cleanTitle;

    if (settings.manualGroupIds.includes(groupId)) {
      newTitle = `📌 ${newTitle}`;
    }

    if (group.title !== newTitle) {
      Logger.debug(
        "updateGroupTitle",
        `A atualizar o título do grupo ${groupId} para '${newTitle}'.`
      );
      await browser.tabGroups.update(groupId, { title: newTitle });
      return { success: true, newTitle };
    }
    return { success: false, reason: "no_change_needed" };
  }, `updateGroupTitle-${groupId}`);

  if (result === null) {
    Logger.debug(
      "updateGroupTitle",
      `Grupo ${groupId} não encontrado - operação ignorada.`
    );
  }
}

/**
 * Agenda uma atualização do título do grupo usando um debounce.
 * Evita atualizações excessivas quando várias abas são movidas rapidamente.
 * @param {number} groupId - O ID do grupo a ter o título atualizado.
 */
function scheduleTitleUpdate(groupId) {
  if (!groupId || groupId === browser.tabs.TAB_ID_NONE) return;
  // Usamos debouncedTitleUpdaters para debounce de títulos de grupo E invalidação de cache
  // Para evitar conflitos, usamos um prefixo diferente para títulos de grupo
  const groupTitleDebounceKey = `group-title-${groupId}`;
  if (debouncedTitleUpdaters.has(groupTitleDebounceKey)) {
    clearTimeout(debouncedTitleUpdaters.get(groupTitleDebounceKey));
  }
  const timeoutId = setTimeout(() => {
    updateGroupTitleWithCount(groupId);
    debouncedTitleUpdaters.delete(groupTitleDebounceKey);
  }, getConfig("TITLE_UPDATE_DEBOUNCE"));
  debouncedTitleUpdaters.set(groupTitleDebounceKey, timeoutId);
}

// --- Lógica de Grupos Manuais e Edição de Regras ---

/**
 * Lida com a criação de um novo grupo de abas (onCreated).
 * Determina se o grupo foi criado manualmente pelo utilizador ou automaticamente pela extensão.
 * Grupos manuais são rastreados para evitar que sejam processados automaticamente.
 * @param {browser.tabGroups.TabGroup} group - O objeto do grupo que foi criado.
 */
async function handleTabGroupCreated(group) {
  const tabsInNewGroup = await browser.tabs.query({ groupId: group.id });
  const newGroupTabIds = tabsInNewGroup.map((t) => t.id).sort();

  // Itera sobre as intenções de agrupamento pendentes
  for (const [key, pendingGroup] of pendingAutomaticGroups.entries()) {
    const pendingTabIds = [...pendingGroup.tabIds].sort();

    // Compara os IDs dos separadores (convertidos para string para uma comparação fiável de arrays)
    if (JSON.stringify(newGroupTabIds) === JSON.stringify(pendingTabIds)) {
      Logger.debug(
        "handleTabGroupCreated",
        `Grupo ${group.id} correspondeu a uma intenção pendente. Classificado como automático.`
      );
      // A intenção foi cumprida, remove-a do mapa.
      pendingAutomaticGroups.delete(key);
      return; // É um grupo automático, não faz mais nada.
    }
  }

  // Se o loop terminar e não houver correspondência, o grupo foi criado manualmente.
  Logger.info(
    "handleTabGroupCreated",
    `Grupo ${group.id} classificado como manual.`
  );
  if (!settings.manualGroupIds.includes(group.id)) {
    const newManualIds = [...settings.manualGroupIds, group.id];
    await updateSettings({ manualGroupIds: newManualIds });

    // Adiciona o pino ao título para identificação visual.
    const pinResult = await handleGroupOperation(async () => {
      const currentGroup = await browser.tabGroups.get(group.id);
      const cleanTitle = (currentGroup.title || "Grupo").replace(/📌\s*/, "");
      if (!currentGroup.title.startsWith("📌")) {
        await browser.tabGroups.update(group.id, {
          title: `📌 ${cleanTitle}`,
        });
        return { success: true, title: `📌 ${cleanTitle}` };
      }
      return { success: false, reason: "already_pinned" };
    }, `handleTabGroupCreated-pin-${group.id}`);

    if (pinResult === null) {
      Logger.warn(
        "handleTabGroupCreated",
        `Grupo manual ${group.id} removido antes de adicionar pino.`
      );
    }
  }
}

/**
 * Lida com a atualização de um grupo de abas (onUpdated).
 * Garante que o pino (📌) seja adicionado ou removido do título
 * para refletir o estado manual do grupo.
 * @param {browser.tabGroups.TabGroup} group - O objeto do grupo que foi atualizado.
 */
async function handleTabGroupUpdated(group) {
  Logger.debug("handleTabGroupUpdated", `Grupo ${group.id} atualizado.`, group);
  const isManual = settings.manualGroupIds.includes(group.id);
  const title = group.title || "";
  const hasPin = title.startsWith("📌");

  if (isManual && !hasPin) {
    await browser.tabGroups.update(group.id, { title: `📌 ${title}` });
  } else if (!isManual && hasPin) {
    await browser.tabGroups.update(group.id, {
      title: title.replace(/📌\s*/, ""),
    });
  }
}

/**
 * Lida com a remoção de um grupo de abas (onRemoved).
 * Limpa o estado associado, como o ID do grupo manual,
 * timers e entradas de mapa.
 * @param {browser.tabGroups.TabGroup} group - O objeto do grupo que foi removido.
 */
async function handleTabGroupRemoved(group) {
  Logger.info("handleTabGroupRemoved", `Grupo ${group.id} removido.`, group);

  // Atualiza configurações se era um grupo manual
  if (settings.manualGroupIds.includes(group.id)) {
    const newManualIds = settings.manualGroupIds.filter(
      (id) => id !== group.id
    );
    await updateSettings({ manualGroupIds: newManualIds });
  }

  // Limpeza proativa de recursos relacionados ao grupo removido
  groupActivity.delete(group.id);
  singleTabGroupTimestamps.delete(group.id);

  // Cancela qualquer updater de título pendente para este grupo
  const groupTitleDebounceKey = `group-title-${group.id}`;
  if (debouncedTitleUpdaters.has(groupTitleDebounceKey)) {
    clearTimeout(debouncedTitleUpdaters.get(groupTitleDebounceKey));
    debouncedTitleUpdaters.delete(groupTitleDebounceKey);
  }

  // Remove abas órfãs do mapa tab-grupo
  for (const [tabId, groupId] of tabGroupMap.entries()) {
    if (groupId === group.id) {
      tabGroupMap.delete(tabId);
    }
  }
}

/**
 * Compara as regras antigas e novas para detetar edições (nome ou cor).
 * Se uma regra foi alterada, atualiza os grupos de abas existentes
 * que correspondem ao nome antigo da regra.
 * @param {object} oldSettings - As configurações antigas.
 * @param {object} newSettings - As novas configurações.
 */
async function checkForRenamedOrEditedRules(oldSettings, newSettings) {
  const oldRules = oldSettings.customRules || [];
  const newRules = newSettings.customRules || [];

  if (oldRules.length === 0 || newRules.length === 0) return;

  const changedRules = [];
  for (const oldRule of oldRules) {
    const newRule = newRules.find(
      (r) => JSON.stringify(r.patterns) === JSON.stringify(oldRule.patterns)
    );
    if (
      newRule &&
      (oldRule.name !== newRule.name || oldRule.color !== newRule.color)
    ) {
      changedRules.push({
        oldName: oldRule.name,
        newName: newRule.name,
        newColor: newRule.color,
      });
    }
  }

  if (changedRules.length === 0) return;
  Logger.info(
    "checkForRenamedRules",
    "Regras renomeadas ou editadas detetadas, a atualizar grupos existentes...",
    changedRules
  );

  const allGroups = await browser.tabGroups.query({});
  for (const change of changedRules) {
    const cleanOldName = change.oldName.replace(/📌\s*/, "");
    const targetGroup = allGroups.find(
      (g) =>
        (g.title || "").replace(/\s\(\d+\)$/, "").replace(/📌\s*/g, "") ===
        cleanOldName
    );

    if (targetGroup) {
      try {
        const updatePayload = {};
        if (change.oldName !== change.newName) {
          updatePayload.title = (targetGroup.title || "").replace(
            cleanOldName,
            change.newName
          );
        }
        if (change.newColor && targetGroup.color !== change.newColor) {
          updatePayload.color = change.newColor;
        }
        if (Object.keys(updatePayload).length > 0) {
          await browser.tabGroups.update(targetGroup.id, updatePayload);
        }
      } catch (e) {
        Logger.error(
          "checkForRenamedRules",
          `Erro ao atualizar o grupo para a regra renomeada de "${change.oldName}":`,
          e
        );
      }
    }
  }
}

// --- Gestor de Mensagens e Inicialização ---

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    Logger.info("onMessage", `Ação '${message.action}' recebida.`, message);
    try {
      switch (message.action) {
        case "getSettings":
          sendResponse(settings);
          break;
        case "updateSettings":
          const { oldSettings, newSettings } = await updateSettings(
            message.settings
          );
          Logger.setLevel(newSettings.logLevel);

          await checkForRenamedOrEditedRules(oldSettings, newSettings);
          // NOVO: Recarrega as regras de renomeação no motor
          globalTabRenamingEngine.loadRules(newSettings.tabRenamingRules || []);

          toggleListeners(
            newSettings.autoGroupingEnabled ||
              newSettings.showTabCount ||
              newSettings.tabRenamingEnabled
          ); // Adiciona tabRenamingEnabled para ativar/desativar listeners
          updateAutomationTimers();

          // Atualiza menu de contexto dinamicamente ao alterar configurações
          await updateContextMenus();

          // Notifica outras partes da extensão (como o popup) que as configurações mudaram.
          browser.runtime
            .sendMessage({ action: "settingsUpdated" })
            .catch(() => {});
          sendResponse(newSettings);
          break;
        case "groupAllTabs":
          const allTabs = await browser.tabs.query({
            currentWindow: true,
            pinned: false,
          });
          await processTabQueue(allTabs.map((t) => t.id));
          sendResponse({ status: "ok" });
          break;
        case "getMemoryStats":
          sendResponse(getMemoryStats(memoryMaps));
          break;
        case "cleanupMemory":
          const cleanupStats = await performMemoryCleanup(memoryMaps);
          sendResponse(cleanupStats);
          break;
        case "getAdaptiveMemoryStats":
          sendResponse(
            globalAdaptiveMemoryManager.getDetailedStats(memoryMaps)
          );
          break;
        case "forceAdaptiveCleanup":
          const adaptiveCleanupStats =
            await globalAdaptiveMemoryManager.performAdaptiveCleanup(
              memoryMaps,
              message.strategy
            );
          sendResponse(adaptiveCleanupStats);
          break;
        case "emergencyAdaptiveCleanup":
          const emergencyStats =
            await globalAdaptiveMemoryManager.emergencyCleanup(memoryMaps);
          sendResponse(emergencyStats);
          break;
        case "getErrorStats":
          sendResponse(globalAdaptiveErrorHandler.getErrorStats());
          break;
        case "resetErrorStats":
          globalAdaptiveErrorHandler.resetStats();
          sendResponse({ success: true });
          break;
        case "setCustomErrorStrategy":
          globalAdaptiveErrorHandler.setCustomStrategy(
            message.errorType,
            message.config
          );
          sendResponse({ success: true });
          break;
        case "setContextualErrorConfig":
          globalAdaptiveErrorHandler.setContextualConfig(
            message.context,
            message.config
          );
          sendResponse({ success: true });
          break;
        case "getCacheStats":
          const { getCacheStats } = await import("./settings-manager.js");
          sendResponse(getCacheStats());
          break;
        case "getDetailedCacheStats":
          const { getDetailedCacheStats } = await import(
            "./settings-manager.js"
          );
          sendResponse(getDetailedCacheStats());
          break;
        case "invalidateCacheByDomain":
          const { invalidateCacheByDomainChange } = await import(
            "./settings-manager.js"
          );
          invalidateCacheByDomainChange(message.hostname, message.changeType);
          sendResponse({ success: true });
          break;
        case "invalidateCacheByCriteria":
          const { invalidateCacheByCriteria } = await import(
            "./settings-manager.js"
          );
          const invalidatedCount = invalidateCacheByCriteria(message.criteria);
          sendResponse({ success: true, invalidated: invalidatedCount });
          break;
        case "clearAllCaches":
          const { clearAllCaches } = await import("./settings-manager.js");
          clearAllCaches();
          sendResponse({ success: true });
          break;
        case "migrateLegacyCache":
          const { migrateLegacyCacheToIntelligent } = await import(
            "./settings-manager.js"
          );
          const migrationResult = await migrateLegacyCacheToIntelligent();
          sendResponse(migrationResult);
          break;
        case "getPerformanceConfig":
          sendResponse(getAllConfig());
          break;
        case "updatePerformanceConfig":
          updateConfig(message.config);
          sendResponse({ success: true });
          break;
        case "getAPIRateLimiterStats":
          sendResponse(getAPIWrapperStats());
          break;
        case "clearAPIQueues":
          const clearedCount = clearAPIQueues();
          sendResponse({ success: true, cleared: clearedCount });
          break;
        case "pauseAPICategory":
          pauseAPICategory(message.category);
          sendResponse({ success: true });
          break;
        case "resumeAPICategory":
          resumeAPICategory(message.category);
          sendResponse({ success: true });
          break;
        case "getRateLimiterDetailedStats":
          sendResponse(globalAPIRateLimiter.getDetailedStats());
          break;
        case "log":
          if (
            sender.tab &&
            message.level &&
            message.context &&
            message.message
          ) {
            Logger[message.level](
              `ContentScript: ${message.context}`,
              message.message,
              ...(message.details || [])
            );
          }
          break;
        default:
          Logger.warn(
            "onMessage",
            `Ação desconhecida recebida: ${message.action}`
          );
          sendResponse({ error: `Ação desconhecida: ${message.action}` });
          break;
      }
    } catch (error) {
      Logger.error(
        "onMessage",
        `Erro ao processar a ação "${message.action}":`,
        error
      );
      sendResponse({ error: error.message });
    }
  })();
  return true; // Indica que a resposta será assíncrona.
});

/**
 * Popula o mapa `tabGroupMap` com o estado atual de todas as abas e seus grupos.
 * Essencial para ter uma visão correta do estado dos grupos no arranque da extensão.
 */
async function populateTabGroupMap() {
  tabGroupMap.clear();
  await handleCriticalOperation(
    async () => {
      const allTabs = await browser.tabs.query({});
      for (const tab of allTabs) {
        if (tab.groupId) {
          tabGroupMap.set(tab.id, tab.groupId);
        }
      }
      Logger.debug(
        "populateTabGroupMap",
        `Mapa populado com ${tabGroupMap.size} entradas.`
      );
      return { success: true, count: tabGroupMap.size };
    },
    "populateTabGroupMap",
    async () => {
      // Fallback: inicia com mapa vazio, funcionalidades ainda funcionarão
      Logger.warn(
        "populateTabGroupMap",
        "Usando fallback - mapa de abas vazio."
      );
      return { success: false, fallback: true };
    }
  );
}

/**
 * Função principal de inicialização da extensão.
 * Carrega configurações, inicializa listeners, temporizadores e todos os
 * subsistemas necessários para o funcionamento da extensão.
 * Inclui tratamento de erros críticos para garantir um arranque robusto.
 */
async function main() {
  await handleCriticalOperation(
    async () => {
      Logger.info("Main", "Extensão a inicializar...");

      // Carregamento de configurações é crítico
      await loadSettings();
      Logger.setLevel(settings.logLevel);

      // Carrega configurações de performance
      loadConfigFromSettings(settings);

      Logger.info("Main", "Configurações iniciais carregadas:", settings);

      // --- ADIÇÃO DE LISTENERS COM VERIFICAÇÃO DE SEGURANÇA ---
      // Cada 'addListener' é agora verificado para garantir que a API existe antes de ser usada.
      // Isto previne a falha crítica 'Cannot read properties of undefined (reading 'addListener')'.

      if (browser.tabs) {
        if (browser.tabs.onActivated) {
          browser.tabs.onActivated.addListener(handleTabActivated);
        } else {
          Logger.warn("Main", "API 'tabs.onActivated' não disponível.");
        }

        // Adiciona listeners para criação e anexação de abas
        if (browser.tabs.onCreated) {
          browser.tabs.onCreated.addListener(handleTabCreated);
        }
        if (browser.tabs.onAttached) {
          browser.tabs.onAttached.addListener(handleTabAttached);
        }
      }

      if (browser.tabGroups) {
        await populateTabGroupMap();

        if (settings.showTabCount && browser.tabGroups.query) {
          await withErrorHandling(
            async () => {
              const allGroups = await browser.tabGroups.query({});
              const titleUpdatePromises = allGroups.map((group) =>
                updateGroupTitleWithCount(group.id)
              );
              await Promise.allSettled(titleUpdatePromises);
              return { success: true, groupCount: allGroups.length };
            },
            {
              context: "initial-title-updates",
              maxRetries: 2,
              criticalOperation: false,
            }
          );
        }

        // Verifica cada evento individualmente antes de adicionar o listener.
        if (browser.tabGroups.onCreated)
          browser.tabGroups.onCreated.addListener(handleTabGroupCreated);
        if (browser.tabGroups.onUpdated)
          browser.tabGroups.onUpdated.addListener(handleTabGroupUpdated);
        if (browser.tabGroups.onRemoved)
          browser.tabGroups.onRemoved.addListener(handleTabGroupRemoved);
      } else {
        Logger.warn(
          "Main",
          "A API 'tabGroups' não é suportada ou está indisponível. Funcionalidades de grupo desativadas."
        );
      }

      // Inicialização de componentes opcionais com tratamento de erro individual
      await withErrorHandling(
        async () => {
          initializeContextMenus();
          await updateContextMenus();
        },
        {
          context: "context-menus-init",
          maxRetries: 1,
          criticalOperation: false,
        }
      );

      // NOVO: Carrega as regras de renomeação no motor
      globalTabRenamingEngine.loadRules(settings.tabRenamingRules || []);
      // NOVO: Inicia a limpeza do cache de renomeação
      globalTabRenamingEngine.startCacheCleanup();

      toggleListeners(
        settings.autoGroupingEnabled ||
          settings.showTabCount ||
          settings.tabRenamingEnabled
      );
      updateAutomationTimers();

      // Inicia o gerenciamento automático de memória
      startMemoryCleanup(memoryMaps);

      // Executa uma limpeza inicial após inicialização
      setTimeout(async () => {
        const initialCleanup = await performMemoryCleanup(memoryMaps);
        Logger.info(
          "Main",
          "Limpeza inicial de memória concluída:",
          initialCleanup
        );
      }, getConfig("INITIAL_CLEANUP_DELAY"));

      Logger.info("Main", "Auto Tab Grouper inicializado com sucesso.", {
        settings,
      });
      return { success: true };
    },
    "main-initialization",
    async () => {
      // Fallback para inicialização mínima
      Logger.error(
        "Main",
        "Iniciando em modo de recuperação com configurações mínimas."
      );
      settings = { ...DEFAULT_SETTINGS };
      Logger.setLevel("ERROR");
      return { success: false, fallback: true };
    }
  );
}

main();
