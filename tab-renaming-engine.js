/**
 * @file tab-renaming-engine.js
 * @description Motor principal para renomeação automática de abas baseada em regras configuráveis.
 */

import Logger from "./logger.js";
import { withErrorHandling } from "./adaptive-error-handler.js";
import { getConfig } from "./performance-config.js";
import { validateTabRenamingRule, sanitizeString } from "./validation-utils.js";
import { WrappedBrowserAPI } from "./browser-api-wrapper.js"; // Importa o wrapper da API do navegador

/**
 * Estados de processamento de renomeação
 */
export const RenamingState = {
  IDLE: "IDLE",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CACHED: "CACHED",
};

/**
 * Tipos de estratégias de renomeação
 */
export const StrategyType = {
  CSS_EXTRACT: "css_extract",
  TITLE_MANIPULATION: "title_manipulation",
  DOMAIN_BASED: "domain_based",
  ORIGINAL_TITLE: "original_title",
};

/**
 * Ações de manipulação de texto
 */
export const TextAction = {
  REPLACE: "replace",
  PREPEND: "prepend",
  APPEND: "append",
  REMOVE: "remove",
  TRUNCATE: "truncate",
  EXTRACT: "extract",
};

/**
 * Motor principal de renomeação de abas
 */
export class TabRenamingEngine {
  constructor() {
    this.rules = new Map();
    this.processing = new Set();
    this.cache = new Map();
    this.metrics = {
      totalProcessed: 0,
      successfulRenames: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      ruleUsageStats: new Map(),
      lastCleanup: Date.now(),
    };

    // O timer de limpeza do cache será iniciado no background.js para garantir que as configurações sejam carregadas.
    this.cleanupIntervalId = null;

    Logger.info(
      "TabRenamingEngine",
      "Motor de renomeação de abas inicializado"
    );
  }

  /**
   * Carrega regras de renomeação
   * @param {Array} rules - Array de regras de renomeação
   */
  loadRules(rules) {
    this.rules.clear();

    if (!Array.isArray(rules)) {
      Logger.warn("TabRenamingEngine", "Regras devem ser um array");
      return;
    }

    let validRules = 0;
    for (const rule of rules) {
      // Adiciona um ID único para cada regra se ainda não tiver
      if (!rule.id) {
        rule.id = `rule-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }
      const validation = validateTabRenamingRule(rule);
      if (validation.isValid) {
        this.rules.set(rule.id, rule);
        validRules++;
      } else {
        Logger.warn(
          "TabRenamingEngine",
          `Regra inválida "${
            rule.name || "Sem Nome"
          }": ${validation.errors.join(", ")}`
        );
      }
    }

    Logger.info(
      "TabRenamingEngine",
      `${validRules} regras carregadas de ${rules.length} fornecidas`
    );
  }

  /**
   * Processa uma aba para renomeação
   * @param {number} tabId - ID da aba
   * @param {object} tab - Objeto da aba
   * @returns {Promise<boolean>} True se a aba foi renomeada
   */
  async processTab(tabId, tab) {
    // Risco: Chamadas excessivas podem sobrecarregar o motor.
    // Mitigação: O debounce no background.js já ajuda. Aqui, verificamos se a aba já está em processamento.
    if (this.processing.has(tabId)) {
      Logger.debug(
        "TabRenamingEngine",
        `Aba ${tabId} já está sendo processada`
      );
      return false;
    }

    // Risco: Abas com URLs inválidas ou protegidas.
    // Mitigação: Verifica se a URL é válida para processamento.
    if (!tab || !tab.url || !tab.url.startsWith("http")) {
      Logger.debug(
        "TabRenamingEngine",
        `Aba ${tabId} não é elegível para renomeação (URL inválida/protegida)`
      );
      return false;
    }

    // Se a regra 'respectManualChanges' estiver ativa e o título da aba for diferente do que está no cache,
    // assumimos que o usuário fez uma alteração manual e não renomeamos.
    // No entanto, para a Fase 1, não temos como saber se o título atual foi definido por uma regra ou manualmente.
    // Esta lógica será mais robusta na Fase 2 com um mecanismo de "dirty state" ou metadados de título.
    // Por enquanto, vamos renomear se uma regra se aplicar.

    const startTime = Date.now();
    this.processing.add(tabId);

    try {
      this.metrics.totalProcessed++;

      // Verifica cache primeiro
      const cacheKey = this.generateCacheKey(tab);
      const cachedResult = this.getCachedResult(cacheKey);

      if (cachedResult) {
        this.metrics.cacheHits++;
        Logger.debug(
          "TabRenamingEngine",
          `Cache hit para aba ${tabId}: ${cachedResult}`
        );

        if (cachedResult !== tab.title) {
          await this.updateTabTitle(tabId, cachedResult);
          this.metrics.successfulRenames++;
          return true;
        }
        return false;
      }

      // Encontra regras aplicáveis
      const applicableRules = this.findApplicableRules(tab);
      if (applicableRules.length === 0) {
        Logger.debug(
          "TabRenamingEngine",
          `Nenhuma regra aplicável para aba ${tabId}`
        );
        return false;
      }

      // Executa renomeação
      const newTitle = await this.executeRenamingRules(tab, applicableRules);

      if (newTitle && newTitle.trim() && newTitle.trim() !== tab.title) {
        // Atualiza título da aba
        const success = await this.updateTabTitle(tabId, newTitle.trim());

        if (success) {
          // Armazena no cache
          this.setCachedResult(cacheKey, newTitle.trim());
          this.metrics.successfulRenames++;

          Logger.info(
            "TabRenamingEngine",
            `Aba ${tabId} renomeada: "${tab.title}" → "${newTitle.trim()}"`
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      this.metrics.failedExtractions++; // Conta como falha de extração/processamento geral
      Logger.error(
        "TabRenamingEngine",
        `Erro ao processar aba ${tabId}:`,
        error
      );
      return false;
    } finally {
      this.processing.delete(tabId);

      // Atualiza métricas de tempo
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);
    }
  }

  /**
   * Encontra regras aplicáveis para uma aba
   * @param {object} tab - Objeto da aba
   * @returns {Array} Array de regras aplicáveis ordenadas por prioridade
   */
  findApplicableRules(tab) {
    const applicableRules = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue; // Risco: Regras desabilitadas ainda podem ser processadas. Mitigação: Verifica `rule.enabled`.

      if (this.matchesConditions(tab, rule)) {
        applicableRules.push(rule);

        // Atualiza estatísticas de uso da regra
        const currentCount = this.metrics.ruleUsageStats.get(rule.id) || 0;
        this.metrics.ruleUsageStats.set(rule.id, currentCount + 1);
      }
    }

    // Ordena por prioridade (menor número = maior prioridade)
    return applicableRules.sort(
      (a, b) => (a.priority || 999) - (b.priority || 999)
    );
  }

  /**
   * Verifica se uma aba atende às condições de uma regra.
   * Suporta o novo formato de array de condições.
   * @param {object} tab - Objeto da aba
   * @param {object} rule - O objeto da regra contendo as condições e o operador.
   * @returns {boolean} True se as condições da regra forem atendidas
   */
  matchesConditions(tab, rule) {
    const { conditions, conditionOperator = "AND" } = rule;

    // Valida o novo formato de condições. O formato antigo é considerado inválido aqui.
    if (!Array.isArray(conditions) || conditions.length === 0) {
      // Não loga como erro, pois pode ser uma regra antiga ou malformada que será ignorada.
      return false;
    }

    try {
      const check = (condition) => this.evaluateCondition(tab, condition);

      if (conditionOperator === "OR") {
        // Lógica "OU": pelo menos uma condição deve ser verdadeira.
        return conditions.some(check);
      }
      // Lógica "E" (padrão): todas as condições devem ser verdadeiras.
      return conditions.every(check);
    } catch (error) {
      Logger.error(
        "TabRenamingEngine",
        `Erro inesperado ao avaliar condições para a aba ${tab.id}:`,
        error
      );
      return false;
    }
  }

  /**
   * Avalia uma única condição contra as propriedades da aba.
   * @param {object} tab - Objeto da aba
   * @param {object} condition - A condição a ser avaliada
   * @returns {boolean} - True se a condição for satisfeita
   */
  evaluateCondition(tab, condition) {
    // Validação básica da condição
    if (
      !condition ||
      !condition.property ||
      !condition.operator ||
      condition.value === undefined
    ) {
      Logger.warn(
        "TabRenamingEngine",
        "Ignorando condição incompleta:",
        condition
      );
      return false;
    }

    // Prepara as propriedades da aba para avaliação
    const tabProperties = {
      url: tab.url || "",
      title: tab.title || "",
      hostname: "",
      url_path: "",
    };

    try {
      const url = new URL(tab.url);
      tabProperties.hostname = url.hostname;
      tabProperties.url_path = url.pathname;
    } catch (e) {
      // URL inválida, as propriedades de URL permanecerão vazias. A avaliação pode continuar.
    }

    // Valida se a propriedade existe no nosso mapa
    if (
      !Object.prototype.hasOwnProperty.call(tabProperties, condition.property)
    ) {
      Logger.warn(
        "TabRenamingEngine",
        `Propriedade inválida na condição: ${condition.property}`
      );
      return false;
    }

    const propValue = String(tabProperties[condition.property] || "");
    const condValue = String(condition.value || "").trim();

    // Condições com valor vazio são ignoradas
    if (condValue === "") {
      return false;
    }

    try {
      switch (condition.operator) {
        case "contains":
          return propValue.toLowerCase().includes(condValue.toLowerCase());
        case "not_contains":
          return !propValue.toLowerCase().includes(condValue.toLowerCase());
        case "starts_with":
          return propValue.toLowerCase().startsWith(condValue.toLowerCase());
        case "ends_with":
          return propValue.toLowerCase().endsWith(condValue.toLowerCase());
        case "equals":
          return propValue.toLowerCase() === condValue.toLowerCase();
        case "regex":
          try {
            // Usa o valor original para a regex para preservar maiúsculas/minúsculas se necessário (controlado por flags)
            return new RegExp(condition.value, "i").test(propValue);
          } catch (regexError) {
            Logger.warn(
              "TabRenamingEngine",
              `Regex inválida na condição: "${condition.value}"`,
              regexError
            );
            return false;
          }
        case "wildcard":
          try {
            const wildcardRegex = new RegExp(
              "^" +
                condValue
                  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                  .replace(/\\\*/g, ".*")
                  .replace(/\\\?/g, ".") +
                "$",
              "i"
            );
            return wildcardRegex.test(propValue);
          } catch (wildcardError) {
            Logger.warn(
              "TabRenamingEngine",
              `Padrão wildcard inválido: "${condValue}"`,
              wildcardError
            );
            return false;
          }
        default:
          Logger.warn(
            "TabRenamingEngine",
            `Operador desconhecido na condição: ${condition.operator}`
          );
          return false;
      }
    } catch (error) {
      Logger.error(
        "TabRenamingEngine",
        "Erro ao avaliar condição:",
        error,
        condition
      );
      return false;
    }
  }

  /**
   * Executa estratégias de renomeação para uma aba
   * @param {object} tab - Objeto da aba
   * @param {Array} rules - Regras aplicáveis
   * @returns {Promise<string|null>} Novo título ou null
   */
  async executeRenamingRules(tab, rules) {
    for (const rule of rules) {
      try {
        // Risco: Regras com opções 'respectManualChanges' podem sobrescrever títulos manuais.
        // Mitigação: Verifica a opção 'respectManualChanges'.
        if (
          rule.options?.respectManualChanges &&
          tab.title !== this.getCachedResult(this.generateCacheKey(tab))
        ) {
          Logger.debug(
            "TabRenamingEngine",
            `Regra "${rule.name}" ignorada para aba ${tab.id} devido a 'respectManualChanges'.`
          );
          continue;
        }

        const result = await this.executeRule(tab, rule);
        if (result && result.trim()) {
          Logger.debug(
            "TabRenamingEngine",
            `Regra "${rule.name}" produziu resultado: "${result}"`
          );
          return result.trim();
        }
      } catch (error) {
        Logger.debug(
          "TabRenamingEngine",
          `Erro ao executar regra "${rule.name}": ${error.message}`
        );
        continue;
      }
    }

    return null;
  }

  /**
   * Executa uma regra específica
   * @param {object} tab - Objeto da aba
   * @param {object} rule - Regra a executar
   * @returns {Promise<string|null>} Resultado da execução
   */
  async executeRule(tab, rule) {
    if (!rule.renamingStrategies || rule.renamingStrategies.length === 0) {
      return null;
    }

    for (const strategy of rule.renamingStrategies) {
      let result = null;
      try {
        result = await this.executeStrategy(tab, strategy, rule.options);
      } catch (error) {
        Logger.debug(
          "TabRenamingEngine",
          `Estratégia ${strategy.type} falhou com erro: ${error.message}`
        );
        // O resultado permanece nulo, o que acionará o fallback.
      }

      // Se a estratégia principal foi bem-sucedida, retorna o resultado.
      if (result && result.trim()) {
        return result.trim();
      }

      // Se a estratégia falhou (lançou erro ou retornou vazio), tenta o fallback.
      if (strategy.fallback && typeof strategy.fallback === "object") {
        Logger.debug(
          "TabRenamingEngine",
          `Estratégia ${strategy.type} falhou. Tentando fallback: ${strategy.fallback.type}`
        );
        try {
          // O fallback agora é um objeto de estratégia completo.
          const fallbackResult = await this.executeStrategy(
            tab,
            strategy.fallback,
            rule.options
          );

          if (fallbackResult && fallbackResult.trim()) {
            Logger.debug(
              "TabRenamingEngine",
              `Fallback ${strategy.fallback.type} bem-sucedido.`
            );
            return fallbackResult.trim();
          }
        } catch (fallbackError) {
          Logger.debug(
            "TabRenamingEngine",
            `Fallback ${strategy.fallback.type} também falhou: ${fallbackError.message}`
          );
        }
      }
    }

    return null; // Retorna nulo se nenhuma estratégia (ou fallback) funcionar.
  }

  /**
   * Executa uma estratégia específica
   * @param {object} tab - Objeto da aba
   * @param {object} strategy - Estratégia a executar
   * @param {object} options - Opções da regra
   * @returns {Promise<string|null>} Resultado da estratégia
   */
  async executeStrategy(tab, strategy, options = {}) {
    switch (strategy.type) {
      case StrategyType.CSS_EXTRACT:
        return await this.executeCSSExtraction(tab, strategy, options);

      case StrategyType.TITLE_MANIPULATION:
        return this.executeTitleManipulation(
          tab.title,
          strategy.operations || []
        );

      case StrategyType.DOMAIN_BASED:
        return this.executeDomainBasedNaming(tab);

      case StrategyType.ORIGINAL_TITLE:
        return tab.title;

      default:
        Logger.warn(
          "TabRenamingEngine",
          `Tipo de estratégia desconhecido: ${strategy.type}`
        );
        return null;
    }
  }

  /**
   * Executa extração via CSS
   * @param {object} tab - Objeto da aba
   * @param {object} strategy - Estratégia CSS
   * @param {object} options - Opções
   * @returns {Promise<string|null>} Texto extraído
   */
  async executeCSSExtraction(tab, strategy, options) {
    // Risco: Injeção de script pode falhar ou demorar muito.
    // Mitigação: Usa withErrorHandling e timeout.
    return await withErrorHandling(
      async () => {
        // Adiciona um atraso para garantir que a página esteja renderizada
        if (options.waitForLoad) {
          await new Promise((resolve) =>
            setTimeout(resolve, getConfig("TAB_RENAMING_DELAY"))
          );
        }

        const timeoutMs =
          options.retryDelay || getConfig("TAB_RENAMING_TIMEOUT");

        // Envia mensagem para o content-script para extrair o conteúdo
        const extractedContentPromise = WrappedBrowserAPI.tabs.sendMessage(
          tab.id,
          {
            action: "extractContent",
            selector: strategy.selector,
            attribute: strategy.attribute,
          }
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Content script extraction timed out")),
            timeoutMs
          )
        );

        const result = await Promise.race([
          extractedContentPromise,
          timeoutPromise,
        ]);

        return result;
      },
      {
        context: `css-extraction-${tab.id}`,
        maxRetries: options.retryAttempts || getConfig("API_RETRY_COUNT"),
        retryDelay: getConfig("INJECTION_RETRY_DELAY"),
        criticalOperation: false,
        fallback: () => {
          Logger.warn(
            "TabRenamingEngine",
            `Falha na extração CSS para aba ${tab.id}.`
          );
          return null;
        },
      }
    );
  }

  /**
   * Executa manipulação de título
   * @param {string} originalTitle - Título original
   * @param {Array} operations - Operações a executar
   * @returns {string} Título manipulado
   */
  executeTitleManipulation(originalTitle, operations) {
    if (!originalTitle || !Array.isArray(operations)) {
      return originalTitle;
    }

    let result = originalTitle;

    for (const operation of operations) {
      try {
        switch (operation.action) {
          case TextAction.REPLACE:
            if (operation.pattern && operation.replacement !== undefined) {
              const regex = new RegExp(
                operation.pattern,
                operation.flags || ""
              );
              result = result.replace(regex, operation.replacement);
            }
            break;

          case TextAction.PREPEND:
            if (operation.text) {
              result = operation.text + result;
            }
            break;

          case TextAction.APPEND:
            if (operation.text) {
              result = result + operation.text;
            }
            break;

          case TextAction.REMOVE:
            if (operation.pattern) {
              const regex = new RegExp(
                operation.pattern,
                operation.flags || ""
              );
              result = result.replace(regex, "");
            }
            break;

          case TextAction.TRUNCATE:
            if (operation.maxLength && result.length > operation.maxLength) {
              const ellipsis = operation.ellipsis || "...";
              result =
                result.substring(0, operation.maxLength - ellipsis.length) +
                ellipsis;
            }
            break;

          case TextAction.EXTRACT:
            if (operation.pattern) {
              const regex = new RegExp(
                operation.pattern,
                operation.flags || ""
              );
              const match = result.match(regex);
              if (match) {
                result = operation.group
                  ? match[operation.group] || match[0]
                  : match[0];
              }
            }
            break;
        }
      } catch (error) {
        // Risco: Regex inválida ou erro na operação de texto.
        // Mitigação: Captura o erro e loga, permitindo que as próximas operações ou estratégias continuem.
        Logger.warn(
          "TabRenamingEngine",
          `Erro na operação ${operation.action}: ${error.message}. Operação ignorada.`
        );
      }
    }

    return sanitizeString(result, getConfig("TAB_RENAMING_MAX_TITLE_LENGTH")); // Garante que o título final seja sanitizado e limitado
  }

  /**
   * Executa nomeação baseada no domínio
   * @param {object} tab - Objeto da aba
   * @returns {string} Nome baseado no domínio
   */
  executeDomainBasedNaming(tab) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;

      // Remove www. se presente
      const cleanHostname = hostname.replace(/^www\./, "");

      // Capitaliza primeira letra de cada parte do domínio
      const parts = cleanHostname.split(".");
      const formattedDomain = parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(".");

      // Combina com o título original para um nome mais descritivo
      return sanitizeString(
        `[${formattedDomain}] ${tab.title}`,
        getConfig("TAB_RENAMING_MAX_TITLE_LENGTH")
      );
    } catch (error) {
      Logger.warn(
        "TabRenamingEngine",
        `Erro na nomeação baseada em domínio: ${error.message}. Usando título original.`
      );
      return sanitizeString(
        tab.title,
        getConfig("TAB_RENAMING_MAX_TITLE_LENGTH")
      );
    }
  }

  /**
   * Atualiza o título de uma aba
   * @param {number} tabId - ID da aba
   * @param {string} newTitle - Novo título
   * @returns {Promise<boolean>} True se bem-sucedido
   */
  async updateTabTitle(tabId, newTitle) {
    // Risco: Título inválido (vazio, muito longo) ou falha na API.
    // Mitigação: Validação e sanitização do título, uso de withErrorHandling.
    return await withErrorHandling(
      async () => {
        // Valida o novo título
        if (
          !newTitle ||
          typeof newTitle !== "string" ||
          newTitle.trim().length === 0
        ) {
          throw new Error("Título inválido ou vazio após processamento.");
        }

        // Limita o comprimento do título
        const maxLength = getConfig("TAB_RENAMING_MAX_TITLE_LENGTH");
        const finalTitle =
          newTitle.length > maxLength
            ? newTitle.substring(0, maxLength - 3) + "..."
            : newTitle;

        Logger.debug(
          "TabRenamingEngine",
          `Atualizando título da aba ${tabId} para: "${finalTitle}" via injeção de script`
        );

        // Manifest V3 não permite alterar o título diretamente via tabs.update.
        // A abordagem correta é injetar um script que altere document.title.
        await browser.scripting.executeScript({
          target: { tabId: tabId },
          func: (title) => {
            document.title = title;
          },
          args: [finalTitle],
        });

        return true;
      },
      {
        context: `updateTabTitle-${tabId}`,
        maxRetries: getConfig("API_RETRY_COUNT"), // Reutiliza a configuração de retry da API
        criticalOperation: false,
        fallback: () => {
          Logger.warn(
            "TabRenamingEngine",
            `Falha ao atualizar título da aba ${tabId} via injeção de script.`
          );
          return false;
        },
      }
    );
  }

  /**
   * Gera chave de cache para uma aba
   * @param {object} tab - Objeto da aba
   * @returns {string} Chave de cache
   */
  generateCacheKey(tab) {
    // Risco: Chaves de cache não únicas podem levar a resultados incorretos.
    // Mitigação: Combina URL e título para maior unicidade.
    try {
      const url = new URL(tab.url);
      // Inclui hostname, pathname e query params (se relevantes) para maior granularidade
      // Mas evita fragmentos (#) que não afetam o conteúdo da página
      return `${url.hostname}${url.pathname}${url.search}:${tab.title}`;
    } catch (error) {
      // Fallback para URLs inválidas
      return `${tab.url}:${tab.title}`;
    }
  }

  /**
   * Obtém resultado do cache
   * @param {string} key - Chave do cache
   * @returns {string|null} Resultado em cache ou null
   */
  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.expires) {
      this.cache.delete(key);
      Logger.debug(
        "TabRenamingEngine",
        `Entrada de cache expirada removida para chave: ${key}`
      );
      return null;
    }

    return cached.value;
  }

  /**
   * Armazena resultado no cache
   * @param {string} key - Chave do cache
   * @param {string} value - Valor a armazenar
   * @param {number} ttl - Time to live em ms
   */
  /**
   * Armazena resultado no cache com limite de tamanho e política LRU.
   * Ao atingir o limite, remove a entrada menos recentemente usada.
   * Racional: evita crescimento indefinido do cache e uso excessivo de memória.
   */
  setCachedResult(key, value, ttl = null) {
    const cacheTTL = ttl || getConfig("TAB_RENAMING_CACHE_TTL");
    // Se a chave já existe, remove para atualizar a ordem (LRU)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, {
      value,
      expires: Date.now() + cacheTTL,
      created: Date.now(),
    });

    // Limite de tamanho do cache (configurável, padrão 300)
    const maxCacheSize = getConfig("MAX_CACHE_SIZE") || 300;
    while (this.cache.size > maxCacheSize) {
      // Remove a entrada menos recentemente usada (primeira do Map)
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
      // Comentário: LRU simples, pois Map mantém ordem de inserção/acesso.
    }
  }

  /**
   * Inicia limpeza periódica do cache
   */
  /**
   * Inicia limpeza periódica do cache.
   * Garante que só será chamado uma vez por ciclo de vida da extensão.
   * Racional: evita múltiplos timers concorrentes e vazamentos de recursos.
   */
  startCacheCleanup() {
    if (this._cleanupStarted) {
      // Já iniciado, ignora chamadas subsequentes.
      Logger.debug(
        "TabRenamingEngine",
        "startCacheCleanup() já foi chamado; ignorando chamada duplicada."
      );
      return;
    }
    this._cleanupStarted = true;

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupCache();
    }, getConfig("TAB_RENAMING_CACHE_CLEANUP_INTERVAL"));
    Logger.info(
      "TabRenamingEngine",
      `Limpeza automática do cache iniciada (intervalo: ${getConfig(
        "TAB_RENAMING_CACHE_CLEANUP_INTERVAL"
      )}ms)`
    );
  }

  /**
   * Para a limpeza automática do cache.
   */
  stopCacheCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      Logger.info("TabRenamingEngine", "Limpeza automática do cache parada.");
    }
  }

  /**
   * Limpa entradas expiradas do cache
   */
  cleanupCache() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expires) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      Logger.debug(
        "TabRenamingEngine",
        `Cache limpo: ${removedCount} entradas expiradas removidas`
      );
    }

    this.metrics.lastCleanup = now;
  }

  /**
   * Obtém estatísticas do motor
   * @returns {object} Estatísticas detalhadas
   */
  getStats() {
    return {
      ...this.metrics,
      rulesLoaded: this.rules.size,
      cacheSize: this.cache.size,
      currentlyProcessing: this.processing.size,
      cacheHitRate:
        this.metrics.totalProcessed > 0
          ? (
              (this.metrics.cacheHits / this.metrics.totalProcessed) *
              100
            ).toFixed(2) + "%"
          : "0%",
      successRate:
        this.metrics.totalProcessed > 0
          ? (
              (this.metrics.successfulRenames / this.metrics.totalProcessed) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * Limpa todas as estatísticas
   */
  clearStats() {
    this.metrics = {
      totalProcessed: 0,
      successfulRenames: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      ruleUsageStats: new Map(),
      lastCleanup: Date.now(),
    };

    Logger.info("TabRenamingEngine", "Estatísticas limpas");
  }

  /**
   * Limpa cache manualmente
   */
  clearCache() {
    this.cache.clear();
    Logger.info("TabRenamingEngine", "Cache limpo manualmente");
  }

  /**
   * Atualiza o tempo médio de processamento.
   * @param {number} processingTime - O tempo de processamento da última operação.
   */
  updateAverageProcessingTime(processingTime) {
    this.metrics.totalProcessingTime += processingTime;
    if (this.metrics.totalProcessed > 0) {
      this.metrics.averageProcessingTime =
        this.metrics.totalProcessingTime / this.metrics.totalProcessed;
    }
  }
}

// Instância global do motor de renomeação
export const globalTabRenamingEngine = new TabRenamingEngine();

Logger.debug(
  "TabRenamingEngine",
  "Motor de renomeação de abas inicializado e pronto para uso"
);
