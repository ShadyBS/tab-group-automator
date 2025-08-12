/**
 * @file tab-renaming-engine.js
 * Motor principal para renomeação automática de abas baseada em regras configuráveis.
 */

import Logger from './logger.js';
import { withErrorHandling } from './adaptive-error-handler.js';
import { getConfig } from './performance-config.js';
import { validateTabRenamingRule, sanitizeString } from './validation-utils.js';
import { WrappedBrowserAPI } from './browser-api-wrapper.js'; // Importa o wrapper da API do navegador

function debouncePerKey(fn, delay) {
  const timers = new Map();
  return function (key, ...args) {
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
    }
    return new Promise((resolve) => {
      timers.set(
        key,
        setTimeout(async () => {
          timers.delete(key);
          resolve(await fn.apply(this, [key, ...args]));
        }, delay)
      );
    });
  };
}

export const RenamingState = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CACHED: 'CACHED',
};

export const StrategyType = {
  CSS_EXTRACT: 'css_extract',
  TITLE_MANIPULATION: 'title_manipulation',
  DOMAIN_BASED: 'domain_based',
  ORIGINAL_TITLE: 'original_title',
};

export const TextAction = {
  REPLACE: 'replace',
  PREPEND: 'prepend',
  APPEND: 'append',
  REMOVE: 'remove',
  TRUNCATE: 'truncate',
  EXTRACT: 'extract',
};

export class TabRenamingEngine {
  constructor() {
    this.rules = new Map();
    this.processing = new Set();
    this.cache = new Map();

    this.tabIdTitleCache = new Map();

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

    this.cleanupIntervalId = null;

    Logger.info(
      'TabRenamingEngine',
      'Motor de renomeação de abas inicializado'
    );
  }

  /**
   * Carrega regras de renomeação.
   * @param {Array} rules - Array de regras de renomeação.
   */
  loadRules(rules) {
    this.rules.clear();

    if (!Array.isArray(rules)) {
      Logger.warn('TabRenamingEngine', 'Regras devem ser um array');
      return;
    }

    let validRules = 0;
    for (const rule of rules) {
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
          'TabRenamingEngine',
          `Regra inválida '${
            rule.name || 'Sem Nome'
          }': ${validation.errors.join(', ')}`
        );
      }
    }

    Logger.info(
      'TabRenamingEngine',
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
    const TIMEOUT_MS = 3000;
    return await Promise.race([
      (async () => {
        if (this.processing.has(tabId)) {
          Logger.debug(
            'TabRenamingEngine',
            `Aba ${tabId} já está sendo processada`
          );
          return false;
        }

        if (this.tabIdTitleCache.has(tabId)) {
          const cachedTitle = this.tabIdTitleCache.get(tabId);
          if (cachedTitle === tab.title) {
            Logger.debug(
              'TabRenamingEngine',
              `TabId cache hit: aba ${tabId} já renomeada para '${cachedTitle}'`
            );
            return false;
          }
        }

        if (!tab || !tab.url || !tab.url.startsWith('http')) {
          Logger.debug(
            'TabRenamingEngine',
            `Aba ${tabId} não é elegível para renomeação (URL inválida/protegida)`
          );
          return false;
        }

        // TODO: Melhorar lógica de detecção de alterações manuais em fases futuras.

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
              'TabRenamingEngine',
              `Cache hit para aba ${tabId}: ${cachedResult}`
            );

            if (cachedResult !== tab.title) {
              await this.updateTabTitle(tabId, cachedResult);
              this.metrics.successfulRenames++;
              // Atualiza cache simples também
              this.tabIdTitleCache.set(tabId, cachedResult);
              return true;
            }
            // Atualiza cache simples também
            this.tabIdTitleCache.set(tabId, cachedResult);
            return false;
          }

          // Encontra regras aplicáveis
          const applicableRules = this.findApplicableRules(tab);
          if (applicableRules.length === 0) {
            Logger.debug(
              'TabRenamingEngine',
              `Nenhuma regra aplicável para aba ${tabId}`
            );
            return false;
          }

          const newTitle = await this.executeRenamingRules(
            tab,
            applicableRules
          );

          if (newTitle && newTitle.trim() && newTitle.trim() !== tab.title) {
            // Atualiza título da aba
            const success = await this.updateTabTitle(tabId, newTitle.trim());

            if (success) {
              // Armazena no cache
              this.setCachedResult(cacheKey, newTitle.trim());
              // Atualiza cache simples por tabId
              this.tabIdTitleCache.set(tabId, newTitle.trim());
              this.metrics.successfulRenames++;

              Logger.info(
                'TabRenamingEngine',
                `Aba ${tabId} renomeada: '${tab.title}' → '${newTitle.trim()}'`
              );
              return true;
            }
          }

          return false;
        } catch (error) {
          this.metrics.failedExtractions++;
          Logger.error(
            'TabRenamingEngine',
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
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Tab renaming timed out after 3s')),
          TIMEOUT_MS
        )
      ),
    ]).catch((err) => {
      Logger.error(
        'TabRenamingEngine',
        `Timeout ou erro crítico ao renomear aba ${tabId}:`,
        err
      );
      this.processing.delete(tabId);
      return false;
    });
  }

  /**
   * Encontra regras aplicáveis para uma aba
   * @param {object} tab - Objeto da aba
   * @returns {Array} Array de regras aplicáveis ordenadas por prioridade
   */
  findApplicableRules(tab) {
    const applicableRules = [];
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (this.matchesConditions(tab, rule)) {
        applicableRules.push(rule);
        const currentCount = this.metrics.ruleUsageStats.get(rule.id) || 0;
        this.metrics.ruleUsageStats.set(rule.id, currentCount + 1);
      }
    }
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
    const { conditions, conditionOperator = 'AND' } = rule;
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return false;
    }
    try {
      const check = (condition) => this.evaluateCondition(tab, condition);
      if (conditionOperator === 'OR') {
        return conditions.some(check);
      }
      return conditions.every(check);
    } catch (error) {
      Logger.error(
        'TabRenamingEngine',
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
    if (
      !condition ||
      !condition.property ||
      !condition.operator ||
      condition.value === undefined
    ) {
      Logger.warn(
        'TabRenamingEngine',
        'Ignorando condição incompleta:',
        condition
      );
      return false;
    }
    const tabProperties = {
      url: tab.url || '',
      title: tab.title || '',
      hostname: '',
      url_path: '',
    };
    try {
      const url = new URL(tab.url);
      tabProperties.hostname = url.hostname;
      tabProperties.url_path = url.pathname;
    } catch (e) {
      // no-op: ignore URL parsing errors
    }
    if (
      !Object.prototype.hasOwnProperty.call(tabProperties, condition.property)
    ) {
      Logger.warn(
        'TabRenamingEngine',
        `Propriedade inválida na condição: ${condition.property}`
      );
      return false;
    }
    const propValue = String(tabProperties[condition.property] || '');
    const condValue = String(condition.value || '').trim();
    if (condValue === '') {
      return false;
    }
    try {
      switch (condition.operator) {
        case 'contains':
          return propValue.toLowerCase().includes(condValue.toLowerCase());
        case 'not_contains':
          return !propValue.toLowerCase().includes(condValue.toLowerCase());
        case 'starts_with':
          return propValue.toLowerCase().startsWith(condValue.toLowerCase());
        case 'ends_with':
          return propValue.toLowerCase().endsWith(condValue.toLowerCase());
        case 'equals':
          return propValue.toLowerCase() === condValue.toLowerCase();
        case 'regex':
          try {
            return new RegExp(condition.value, 'i').test(propValue);
          } catch (regexError) {
            Logger.warn(
              'TabRenamingEngine',
              `Regex inválida na condição: '${condition.value}'`,
              regexError
            );
            return false;
          }
        case 'wildcard':
          try {
            const wildcardRegex = new RegExp(
              '^' +
                condValue
                  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  .replace(/\\\*/g, '.*')
                  .replace(/\\\?/g, '.') +
                '$',
              'i'
            );
            return wildcardRegex.test(propValue);
          } catch (wildcardError) {
            Logger.warn(
              'TabRenamingEngine',
              `Padrão wildcard inválido: '${condValue}'`,
              wildcardError
            );
            return false;
          }
        default:
          Logger.warn(
            'TabRenamingEngine',
            `Operador desconhecido na condição: ${condition.operator}`
          );
          return false;
      }
    } catch (error) {
      Logger.error(
        'TabRenamingEngine',
        'Erro ao avaliar condição:',
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
        if (
          rule.options?.respectManualChanges &&
          tab.title !== this.getCachedResult(this.generateCacheKey(tab))
        ) {
          continue;
        }
        const result = await this.executeRule(tab, rule);
        if (result && result.trim()) {
          return result.trim();
        }
      } catch (error) {
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
        // no-op: ignore strategy execution errors
      }
      if (result && result.trim()) {
        return result.trim();
      }
      if (strategy.fallback && typeof strategy.fallback === 'object') {
        try {
          const fallbackResult = await this.executeStrategy(
            tab,
            strategy.fallback,
            rule.options
          );
          if (fallbackResult && fallbackResult.trim()) {
            return fallbackResult.trim();
          }
        } catch (fallbackError) {
          // no-op: ignore fallback strategy errors
        }
      }
    }
    return null;
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
          'TabRenamingEngine',
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
            setTimeout(resolve, getConfig('TAB_RENAMING_DELAY'))
          );
        }

        const timeoutMs =
          options.retryDelay || getConfig('TAB_RENAMING_TIMEOUT');

        // Envia mensagem para o content-script para extrair o conteúdo
        const extractedContentPromise = WrappedBrowserAPI.tabs.sendMessage(
          tab.id,
          {
            action: 'extractContent',
            selector: strategy.selector,
            attribute: strategy.attribute,
          }
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Content script extraction timed out')),
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
        maxRetries: options.retryAttempts || getConfig('API_RETRY_COUNT'),
        retryDelay: getConfig('INJECTION_RETRY_DELAY'),
        criticalOperation: false,
        fallback: () => {
          Logger.warn(
            'TabRenamingEngine',
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
                operation.flags || ''
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
                operation.flags || ''
              );
              result = result.replace(regex, '');
            }
            break;
          case TextAction.TRUNCATE:
            if (operation.maxLength && result.length > operation.maxLength) {
              const ellipsis = operation.ellipsis || '...';
              result =
                result.substring(0, operation.maxLength - ellipsis.length) +
                ellipsis;
            }
            break;
          case TextAction.EXTRACT:
            if (operation.pattern) {
              const regex = new RegExp(
                operation.pattern,
                operation.flags || ''
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
        Logger.warn(
          'TabRenamingEngine',
          `Erro na operação ${operation.action}: ${error.message}. Operação ignorada.`
        );
      }
    }
    return sanitizeString(result, getConfig('TAB_RENAMING_MAX_TITLE_LENGTH'));
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
      const cleanHostname = hostname.replace(/^www\./, '');
      const parts = cleanHostname.split('.');
      const formattedDomain = parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('.');
      return sanitizeString(
        `[${formattedDomain}] ${tab.title}`,
        getConfig('TAB_RENAMING_MAX_TITLE_LENGTH')
      );
    } catch (error) {
      Logger.warn(
        'TabRenamingEngine',
        `Erro na nomeação baseada em domínio: ${error.message}. Usando título original.`
      );
      return sanitizeString(
        tab.title,
        getConfig('TAB_RENAMING_MAX_TITLE_LENGTH')
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
          typeof newTitle !== 'string' ||
          newTitle.trim().length === 0
        ) {
          throw new Error('Título inválido ou vazio após processamento.');
        }

        // Limita o comprimento do título
        const maxLength = getConfig('TAB_RENAMING_MAX_TITLE_LENGTH');
        const finalTitle =
          newTitle.length > maxLength
            ? newTitle.substring(0, maxLength - 3) + '...'
            : newTitle;

        Logger.debug(
          'TabRenamingEngine',
          `Atualizando título da aba ${tabId} para: '${finalTitle}' via injeção de script`
        );

        // Otimização: só injeta content-script se necessário
        let contentScriptInjected = false;
        try {
          await WrappedBrowserAPI.tabs.sendMessage(tabId, { action: 'ping' });
          contentScriptInjected = true;
        } catch (e) {
          contentScriptInjected = false;
        }

        if (!contentScriptInjected) {
          try {
            await browser.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content-script.js'],
            });
            Logger.debug(
              'TabRenamingEngine',
              `content-script.js injetado em tabId ${tabId} (injeção programática)`
            );
          } catch (injectErr) {
            Logger.warn(
              'TabRenamingEngine',
              `Falha ao injetar content-script.js em tabId ${tabId}: ${injectErr.message}`
            );
            // Não retorna erro aqui, pois pode ser página protegida
          }
        }

        // Agora executa o script para alterar o título
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
        maxRetries: getConfig('API_RETRY_COUNT'), // Reutiliza a configuração de retry da API
        criticalOperation: false,
        fallback: () => {
          Logger.warn(
            'TabRenamingEngine',
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
    try {
      const url = new URL(tab.url);
      return `${url.hostname}${url.pathname}${url.search}:${tab.title}`;
    } catch (error) {
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
        'TabRenamingEngine',
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
  setCachedResult(key, value, ttl = null) {
    const cacheTTL = ttl || getConfig('TAB_RENAMING_CACHE_TTL');
    this.cache.set(key, {
      value,
      expires: Date.now() + cacheTTL,
      created: Date.now(),
    });
  }

  /**
   * Inicia limpeza periódica do cache
   */
  startCacheCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupCache();
    }, getConfig('TAB_RENAMING_CACHE_CLEANUP_INTERVAL'));
    Logger.info(
      'TabRenamingEngine',
      `Limpeza automática do cache iniciada (intervalo: ${getConfig(
        'TAB_RENAMING_CACHE_CLEANUP_INTERVAL'
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
      Logger.info('TabRenamingEngine', 'Limpeza automática do cache parada.');
    }
  }

  /**
   * Limpa entradas expiradas do cache
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expires) {
        this.cache.delete(key);
      }
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
            ).toFixed(2) + '%'
          : '0%',
      successRate:
        this.metrics.totalProcessed > 0
          ? (
              (this.metrics.successfulRenames / this.metrics.totalProcessed) *
              100
            ).toFixed(2) + '%'
          : '0%',
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
    Logger.info('TabRenamingEngine', 'Estatísticas limpas');
  }

  /**
   * Limpa cache manualmente
   */
  clearCache() {
    this.cache.clear();
    this.tabIdTitleCache.clear();
    Logger.info('TabRenamingEngine', 'Cache limpo manualmente');
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

export const globalTabRenamingEngine = new TabRenamingEngine();

globalTabRenamingEngine.processTabDebounced = debouncePerKey(
  async (tabId, tab) => globalTabRenamingEngine.processTab(tabId, tab),
  300
);

Logger.debug(
  'TabRenamingEngine',
  'Motor de renomeação de abas inicializado e pronto para uso'
);
