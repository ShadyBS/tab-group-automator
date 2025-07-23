/**
 * @file browser-api-wrapper.js
 * @description Wrapper para APIs do navegador com rate limiting automático e fallback para APIs nativas.
 */

import Logger from "./logger.js";
import { getConfig } from "./performance-config.js";
import { RateLimitedAPI, globalAPIRateLimiter } from "./api-rate-limiter.js";

/**
 * Fornece um wrapper transparente sobre as APIs `browser.*` para aplicar
 * rate limiting de forma automática, com um fallback opcional para a API nativa.
 */
class BrowserAPIWrapper {
  constructor() {
    this.rateLimitingEnabled = getConfig("API_RATE_LIMIT_ENABLED");
    this.fallbackToNative = true;

    // Cria proxy para interceptar chamadas
    this.api = this.createAPIProxy();

    Logger.debug(
      "BrowserAPIWrapper",
      `Rate limiting ${
        this.rateLimitingEnabled ? "habilitado" : "desabilitado"
      }`
    );
  }

  /**
   * Cria o proxy principal que intercepta o acesso às APIs do navegador (ex: `browser.tabs`).
   * @returns {Proxy} Um proxy para o objeto `browser`.
   */
  createAPIProxy() {
    const self = this;

    return new Proxy(browser, {
      get(target, prop) {
        // Intercepta APIs específicas
        switch (prop) {
          case "tabs":
            return self.createTabsProxy();
          case "tabGroups":
            return self.createTabGroupsProxy();
          case "windows":
            return self.createWindowsProxy();
          case "storage":
            return self.createStorageProxy();
          default:
            // Retorna API nativa para outras propriedades
            return target[prop];
        }
      },
    });
  }

  /**
   * Cria um proxy específico para a API `browser.tabs`.
   * @returns {Proxy} Um proxy para `browser.tabs`.
   */
  createTabsProxy() {
    const self = this;

    return new Proxy(browser.tabs, {
      get(target, prop) {
        switch (prop) {
          case "get":
            return (tabId, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.tabs.get(tabId, context),
                () => target.get(tabId),
                "tabs.get"
              );

          case "query":
            return (queryInfo, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.tabs.query(queryInfo, context),
                () => target.query(queryInfo),
                "tabs.query"
              );

          case "group":
            return (options, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.tabs.group(options, context),
                () => target.group(options),
                "tabs.group"
              );

          case "ungroup":
            return (tabIds, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.tabs.ungroup(tabIds, context),
                () => target.ungroup(tabIds),
                "tabs.ungroup"
              );

          default:
            // Retorna método nativo para outras operações
            return target[prop];
        }
      },
    });
  }

  /**
   * Cria um proxy específico para a API `browser.tabGroups`.
   * @returns {Proxy} Um proxy para `browser.tabGroups`.
   */
  createTabGroupsProxy() {
    const self = this;

    return new Proxy(browser.tabGroups, {
      get(target, prop) {
        switch (prop) {
          case "get":
            return (groupId, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.tabGroups.get(groupId, context),
                () => target.get(groupId),
                "tabGroups.get"
              );

          case "query":
            return (queryInfo, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.tabGroups.query(queryInfo, context),
                () => target.query(queryInfo),
                "tabGroups.query"
              );

          case "update":
            return (groupId, updateProperties, context = {}) =>
              self.executeWithRateLimit(
                () =>
                  RateLimitedAPI.tabGroups.update(
                    groupId,
                    updateProperties,
                    context
                  ),
                () => target.update(groupId, updateProperties),
                "tabGroups.update"
              );

          default:
            // Retorna método nativo para outras operações
            return target[prop];
        }
      },
    });
  }

  /**
   * Cria um proxy específico para a API `browser.windows`.
   * @returns {Proxy} Um proxy para `browser.windows`.
   */
  createWindowsProxy() {
    const self = this;

    return new Proxy(browser.windows, {
      get(target, prop) {
        switch (prop) {
          case "getAll":
            return (getInfo, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.windows.getAll(getInfo, context),
                () => target.getAll(getInfo),
                "windows.getAll"
              );

          default:
            // Retorna método nativo para outras operações
            return target[prop];
        }
      },
    });
  }

  /**
   * Cria um proxy específico para a API `browser.storage`.
   * @returns {Proxy} Um proxy para `browser.storage`.
   */
  createStorageProxy() {
    const self = this;

    return new Proxy(browser.storage, {
      get(target, prop) {
        switch (prop) {
          case "local":
            return self.createStorageAreaProxy(target.local, "local");
          case "sync":
            return self.createStorageAreaProxy(target.sync, "sync");
          default:
            return target[prop];
        }
      },
    });
  }

  /**
   * Cria um proxy para uma área de armazenamento específica (`local` ou `sync`).
   * @param {browser.storage.StorageArea} storageArea - O objeto da área de armazenamento.
   * @param {string} areaName - O nome da área (`local` ou `sync`).
   * @returns {Proxy} Um proxy para a área de armazenamento.
   */
  createStorageAreaProxy(storageArea, areaName) {
    const self = this;

    return new Proxy(storageArea, {
      get(target, prop) {
        switch (prop) {
          case "get":
            return (keys, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.storage[areaName].get(keys, context),
                () => target.get(keys),
                `storage.${areaName}.get`
              );

          case "set":
            return (items, context = {}) =>
              self.executeWithRateLimit(
                () => RateLimitedAPI.storage[areaName].set(items, context),
                () => target.set(items),
                `storage.${areaName}.set`
              );

          default:
            // Retorna método nativo para outras operações
            return target[prop];
        }
      },
    });
  }

  /**
   * Executa uma chamada de API, aplicando rate limiting se estiver ativado.
   * Se a chamada com rate limiting falhar, pode recorrer à chamada nativa como fallback.
   * @param {Function} rateLimitedCall - A função que executa a chamada através do `RateLimitedAPI`.
   * @param {Function} nativeCall - A função que executa a chamada nativa da API do navegador.
   * @param {string} operationName - O nome da operação para fins de logging.
   * @returns {Promise<any>} O resultado da chamada da API.
   */
  async executeWithRateLimit(rateLimitedCall, nativeCall, operationName) {
    if (!this.rateLimitingEnabled) {
      Logger.debug(
        "BrowserAPIWrapper",
        `Rate limiting desabilitado, usando API nativa: ${operationName}`
      );
      return nativeCall();
    }

    try {
      const result = await rateLimitedCall();
      Logger.debug(
        "BrowserAPIWrapper",
        `Rate limited call bem-sucedida: ${operationName}`
      );
      return result;
    } catch (error) {
      Logger.warn(
        "BrowserAPIWrapper",
        `Rate limited call falhou para ${operationName}: ${error.message}`
      );

      if (this.fallbackToNative) {
        Logger.debug(
          "BrowserAPIWrapper",
          `Usando fallback para API nativa: ${operationName}`
        );
        return nativeCall();
      } else {
        throw error;
      }
    }
  }

  /**
   * Habilita rate limiting
   */
  enableRateLimiting() {
    this.rateLimitingEnabled = true;
    Logger.info("BrowserAPIWrapper", "Rate limiting habilitado");
  }

  /**
   * Desabilita rate limiting
   */
  disableRateLimiting() {
    this.rateLimitingEnabled = false;
    Logger.info("BrowserAPIWrapper", "Rate limiting desabilitado");
  }

  /**
   * Habilita fallback para API nativa
   */
  enableFallback() {
    this.fallbackToNative = true;
    Logger.info("BrowserAPIWrapper", "Fallback para API nativa habilitado");
  }

  /**
   * Desabilita fallback para API nativa
   */
  disableFallback() {
    this.fallbackToNative = false;
    Logger.info("BrowserAPIWrapper", "Fallback para API nativa desabilitado");
  }

  /**
   * Obtém estatísticas do rate limiter
   * @returns {Object} Estatísticas detalhadas
   */
  getStats() {
    return {
      rateLimitingEnabled: this.rateLimitingEnabled,
      fallbackEnabled: this.fallbackToNative,
      rateLimiterStats: globalAPIRateLimiter.getDetailedStats(),
    };
  }

  /**
   * Limpa todas as filas do rate limiter
   * @returns {number} Número de operações canceladas
   */
  clearQueues() {
    return globalAPIRateLimiter.clearAllQueues();
  }

  /**
   * Pausa rate limiting para uma categoria
   * @param {string} category - Categoria a pausar
   */
  pauseCategory(category) {
    globalAPIRateLimiter.pauseCategory(category);
  }

  /**
   * Resume rate limiting para uma categoria
   * @param {string} category - Categoria a resumir
   */
  resumeCategory(category) {
    globalAPIRateLimiter.resumeCategory(category);
  }
}

// Instância global do wrapper
export const globalBrowserAPIWrapper = new BrowserAPIWrapper();

// Exporta API wrapeada para uso global
export const WrappedBrowserAPI = globalBrowserAPIWrapper.api;

// Funções de conveniência para controle do wrapper
export function enableAPIRateLimiting() {
  globalBrowserAPIWrapper.enableRateLimiting();
}

export function disableAPIRateLimiting() {
  globalBrowserAPIWrapper.disableRateLimiting();
}

export function getAPIWrapperStats() {
  return globalBrowserAPIWrapper.getStats();
}

export function clearAPIQueues() {
  return globalBrowserAPIWrapper.clearQueues();
}

export function pauseAPICategory(category) {
  globalBrowserAPIWrapper.pauseCategory(category);
}

export function resumeAPICategory(category) {
  globalBrowserAPIWrapper.resumeCategory(category);
}

// Funções para migração gradual
export function createRateLimitedTabsAPI() {
  return {
    get: (tabId, context = {}) => RateLimitedAPI.tabs.get(tabId, context),
    query: (queryInfo, context = {}) =>
      RateLimitedAPI.tabs.query(queryInfo, context),
    group: (options, context = {}) =>
      RateLimitedAPI.tabs.group(options, context),
    ungroup: (tabIds, context = {}) =>
      RateLimitedAPI.tabs.ungroup(tabIds, context),
  };
}

export function createRateLimitedTabGroupsAPI() {
  return {
    get: (groupId, context = {}) =>
      RateLimitedAPI.tabGroups.get(groupId, context),
    query: (queryInfo, context = {}) =>
      RateLimitedAPI.tabGroups.query(queryInfo, context),
    update: (groupId, updateProperties, context = {}) =>
      RateLimitedAPI.tabGroups.update(groupId, updateProperties, context),
  };
}

export function createRateLimitedStorageAPI() {
  return {
    local: {
      get: (keys, context = {}) =>
        RateLimitedAPI.storage.local.get(keys, context),
      set: (items, context = {}) =>
        RateLimitedAPI.storage.local.set(items, context),
    },
    sync: {
      get: (keys, context = {}) =>
        RateLimitedAPI.storage.sync.get(keys, context),
      set: (items, context = {}) =>
        RateLimitedAPI.storage.sync.set(items, context),
    },
  };
}

Logger.debug(
  "BrowserAPIWrapper",
  "Wrapper de APIs do navegador com rate limiting inicializado."
);
