/**
 * @file tab-renaming-engine.js
 * @description Motor principal para renomeação automática de abas baseada em regras configuráveis.
 */

import Logger from "./logger.js";
import { withErrorHandling } from "./adaptive-error-handler.js";
import { getConfig } from "./performance-config.js";
import { validateTabRenamingRule } from "./validation-utils.js";

/**
 * Estados de processamento de renomeação
 */
export const RenamingState = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CACHED: 'CACHED'
};

/**
 * Tipos de estratégias de renomeação
 */
export const StrategyType = {
  CSS_EXTRACT: 'css_extract',
  TITLE_MANIPULATION: 'title_manipulation',
  DOMAIN_BASED: 'domain_based',
  ORIGINAL_TITLE: 'original_title'
};

/**
 * Ações de manipulação de texto
 */
export const TextAction = {
  REPLACE: 'replace',
  PREPEND: 'prepend',
  APPEND: 'append',
  REMOVE: 'remove',
  TRUNCATE: 'truncate',
  EXTRACT: 'extract'
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
      ruleUsageStats: new Map(),
      lastCleanup: Date.now()
    };
    
    // Inicia limpeza periódica do cache
    this.startCacheCleanup();
    
    Logger.info("TabRenamingEngine", "Motor de renomeação de abas inicializado");
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
      const validation = validateTabRenamingRule(rule);
      if (validation.isValid) {
        this.rules.set(rule.id, rule);
        validRules++;
      } else {
        Logger.warn("TabRenamingEngine", `Regra inválida "${rule.name}": ${validation.errors.join(', ')}`);
      }
    }
    
    Logger.info("TabRenamingEngine", `${validRules} regras carregadas de ${rules.length} fornecidas`);
  }
  
  /**
   * Processa uma aba para renomeação
   * @param {number} tabId - ID da aba
   * @param {object} tab - Objeto da aba
   * @returns {Promise<boolean>} True se a aba foi renomeada
   */
  async processTab(tabId, tab) {
    if (this.processing.has(tabId)) {
      Logger.debug("TabRenamingEngine", `Aba ${tabId} já está sendo processada`);
      return false;
    }
    
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      Logger.debug("TabRenamingEngine", `Aba ${tabId} não é elegível para renomeação`);
      return false;
    }
    
    const startTime = Date.now();
    this.processing.add(tabId);
    
    try {
      this.metrics.totalProcessed++;
      
      // Verifica cache primeiro
      const cacheKey = this.generateCacheKey(tab);
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        Logger.debug("TabRenamingEngine", `Cache hit para aba ${tabId}: ${cachedResult}`);
        
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
        Logger.debug("TabRenamingEngine", `Nenhuma regra aplicável para aba ${tabId}`);
        return false;
      }
      
      // Executa renomeação
      const newTitle = await this.executeRenamingRules(tab, applicableRules);
      
      if (newTitle && newTitle !== tab.title) {
        // Atualiza título da aba
        const success = await this.updateTabTitle(tabId, newTitle);
        
        if (success) {
          // Armazena no cache
          this.setCachedResult(cacheKey, newTitle);
          this.metrics.successfulRenames++;
          
          Logger.info("TabRenamingEngine", `Aba ${tabId} renomeada: "${tab.title}" → "${newTitle}"`);
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      this.metrics.failedExtractions++;
      Logger.error("TabRenamingEngine", `Erro ao processar aba ${tabId}:`, error);
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
      if (!rule.enabled) continue;
      
      if (this.matchesConditions(tab, rule.conditions)) {
        applicableRules.push(rule);
        
        // Atualiza estatísticas de uso da regra
        const currentCount = this.metrics.ruleUsageStats.get(rule.id) || 0;
        this.metrics.ruleUsageStats.set(rule.id, currentCount + 1);
      }
    }
    
    // Ordena por prioridade (menor número = maior prioridade)
    return applicableRules.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }
  
  /**
   * Verifica se uma aba atende às condições de uma regra
   * @param {object} tab - Objeto da aba
   * @param {object} conditions - Condições da regra
   * @returns {boolean} True se atende às condições
   */
  matchesConditions(tab, conditions) {
    if (!conditions) return false;
    
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      const pathname = url.pathname;
      const title = tab.title || '';
      
      // Verifica padrões de host
      if (conditions.hostPatterns && conditions.hostPatterns.length > 0) {
        const hostMatches = conditions.hostPatterns.some(pattern => {
          const regex = this.convertWildcardToRegex(pattern);
          return regex.test(hostname);
        });
        if (!hostMatches) return false;
      }
      
      // Verifica regex de host
      if (conditions.hostRegex) {
        const hostRegex = new RegExp(conditions.hostRegex);
        if (!hostRegex.test(tab.url)) return false;
      }
      
      // Verifica padrões de URL
      if (conditions.urlPatterns && conditions.urlPatterns.length > 0) {
        const urlMatches = conditions.urlPatterns.some(pattern => {
          const regex = this.convertWildcardToRegex(pattern);
          return regex.test(pathname);
        });
        if (!urlMatches) return false;
      }
      
      // Verifica padrões de título
      if (conditions.titlePatterns && conditions.titlePatterns.length > 0) {
        const titleMatches = conditions.titlePatterns.some(pattern => {
          const regex = this.convertWildcardToRegex(pattern);
          return regex.test(title);
        });
        if (!titleMatches) return false;
      }
      
      return true;
      
    } catch (error) {
      Logger.debug("TabRenamingEngine", `Erro ao verificar condições: ${error.message}`);
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
        const result = await this.executeRule(tab, rule);
        if (result && result.trim()) {
          Logger.debug("TabRenamingEngine", `Regra "${rule.name}" produziu resultado: "${result}"`);
          return result.trim();
        }
      } catch (error) {
        Logger.debug("TabRenamingEngine", `Erro ao executar regra "${rule.name}": ${error.message}`);
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
      try {
        const result = await this.executeStrategy(tab, strategy, rule.options);
        if (result && result.trim()) {
          return result.trim();
        }
      } catch (error) {
        Logger.debug("TabRenamingEngine", `Estratégia ${strategy.type} falhou: ${error.message}`);
        
        // Tenta fallback se especificado
        if (strategy.fallback) {
          const fallbackStrategy = rule.renamingStrategies.find(s => s.type === strategy.fallback);
          if (fallbackStrategy) {
            try {
              const fallbackResult = await this.executeStrategy(tab, fallbackStrategy, rule.options);
              if (fallbackResult && fallbackResult.trim()) {
                return fallbackResult.trim();
              }
            } catch (fallbackError) {
              Logger.debug("TabRenamingEngine", `Fallback ${strategy.fallback} também falhou: ${fallbackError.message}`);
            }
          }
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
        return this.executeTitleManipulation(tab.title, strategy.operations || []);
        
      case StrategyType.DOMAIN_BASED:
        return this.executeDomainBasedNaming(tab);
        
      case StrategyType.ORIGINAL_TITLE:
        return tab.title;
        
      default:
        Logger.warn("TabRenamingEngine", `Tipo de estratégia desconhecido: ${strategy.type}`);
        return null;
    }
  }
  
  /**
   * Executa extração via CSS (placeholder para Fase 2)
   * @param {object} tab - Objeto da aba
   * @param {object} strategy - Estratégia CSS
   * @param {object} options - Opções
   * @returns {Promise<string|null>} Texto extraído
   */
  async executeCSSExtraction(tab, strategy, options) {
    // Placeholder para implementação na Fase 2
    Logger.debug("TabRenamingEngine", "Extração CSS será implementada na Fase 2");
    return null;
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
              const regex = new RegExp(operation.pattern, operation.flags || '');
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
              const regex = new RegExp(operation.pattern, operation.flags || '');
              result = result.replace(regex, '');
            }
            break;
            
          case TextAction.TRUNCATE:
            if (operation.maxLength && result.length > operation.maxLength) {
              const ellipsis = operation.ellipsis || '...';
              result = result.substring(0, operation.maxLength - ellipsis.length) + ellipsis;
            }
            break;
            
          case TextAction.EXTRACT:
            if (operation.pattern) {
              const regex = new RegExp(operation.pattern, operation.flags || '');
              const match = result.match(regex);
              if (match) {
                result = operation.group ? match[operation.group] || match[0] : match[0];
              }
            }
            break;
        }
      } catch (error) {
        Logger.debug("TabRenamingEngine", `Erro na operação ${operation.action}: ${error.message}`);
      }
    }
    
    return result.trim();
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
      const cleanHostname = hostname.replace(/^www\./, '');
      
      // Capitaliza primeira letra de cada parte do domínio
      const parts = cleanHostname.split('.');
      const formattedDomain = parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join('.');
      
      return `[${formattedDomain}] ${tab.title}`;
      
    } catch (error) {
      Logger.debug("TabRenamingEngine", `Erro na nomeação baseada em domínio: ${error.message}`);
      return tab.title;
    }
  }
  
  /**
   * Atualiza o título de uma aba
   * @param {number} tabId - ID da aba
   * @param {string} newTitle - Novo título
   * @returns {Promise<boolean>} True se bem-sucedido
   */
  async updateTabTitle(tabId, newTitle) {
    return await withErrorHandling(async () => {
      // Valida o novo título
      if (!newTitle || typeof newTitle !== 'string') {
        throw new Error('Título inválido');
      }
      
      // Limita o comprimento do título
      const maxLength = getConfig('TAB_RENAMING_MAX_TITLE_LENGTH');
      const finalTitle = newTitle.length > maxLength ? 
        newTitle.substring(0, maxLength - 3) + '...' : newTitle;
      
      // Atualiza a aba (placeholder - será implementado quando integrado)
      Logger.debug("TabRenamingEngine", `Atualizando título da aba ${tabId} para: "${finalTitle}"`);
      
      // TODO: Implementar atualização real do título quando integrado ao background.js
      // await browser.tabs.update(tabId, { title: finalTitle });
      
      return true;
      
    }, {
      context: `updateTabTitle-${tabId}`,
      maxRetries: 2,
      criticalOperation: false,
      fallback: () => {
        Logger.warn("TabRenamingEngine", `Falha ao atualizar título da aba ${tabId}`);
        return false;
      }
    });
  }
  
  /**
   * Converte padrão wildcard para regex
   * @param {string} pattern - Padrão com wildcards
   * @returns {RegExp} Expressão regular
   */
  convertWildcardToRegex(pattern) {
    // Escapa caracteres especiais exceto * e ?
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Converte wildcards para regex
    const regexPattern = escaped
      .replace(/\\\*/g, '.*')  // * vira .*
      .replace(/\\\?/g, '.');  // ? vira .
    
    return new RegExp(`^${regexPattern}$`, 'i');
  }
  
  /**
   * Gera chave de cache para uma aba
   * @param {object} tab - Objeto da aba
   * @returns {string} Chave de cache
   */
  generateCacheKey(tab) {
    try {
      const url = new URL(tab.url);
      return `${url.hostname}:${url.pathname}:${tab.title}`;
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
      created: Date.now()
    });
  }
  
  /**
   * Atualiza tempo médio de processamento
   * @param {number} processingTime - Tempo de processamento em ms
   */
  updateAverageProcessingTime(processingTime) {
    const currentAvg = this.metrics.averageProcessingTime;
    const totalProcessed = this.metrics.totalProcessed;
    
    this.metrics.averageProcessingTime = 
      ((currentAvg * (totalProcessed - 1)) + processingTime) / totalProcessed;
  }
  
  /**
   * Inicia limpeza periódica do cache
   */
  startCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, getConfig('TAB_RENAMING_CACHE_CLEANUP_INTERVAL'));
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
      Logger.debug("TabRenamingEngine", `Cache limpo: ${removedCount} entradas expiradas removidas`);
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
      cacheHitRate: this.metrics.totalProcessed > 0 ? 
        (this.metrics.cacheHits / this.metrics.totalProcessed * 100).toFixed(2) + '%' : '0%',
      successRate: this.metrics.totalProcessed > 0 ? 
        (this.metrics.successfulRenames / this.metrics.totalProcessed * 100).toFixed(2) + '%' : '0%'
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
      ruleUsageStats: new Map(),
      lastCleanup: Date.now()
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
}

// Instância global do motor de renomeação
export const globalTabRenamingEngine = new TabRenamingEngine();

Logger.debug("TabRenamingEngine", "Motor de renomeação de abas inicializado e pronto para uso");