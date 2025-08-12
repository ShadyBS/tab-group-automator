/**
 * @file learning-engine.js
 * @description Módulo de aprendizado para sugerir grupos de abas com base no comportamento do usuário.
 */

import { settings, updateSettings } from './settings-manager.js';
import Logger from './logger.js';

// Utilitário para hash SHA-256 de strings (hostname)
async function hashHostname(hostname) {
  const encoder = new TextEncoder();
  const data = encoder.encode(hostname);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
const LOG_PREFIX = '[LearningEngine]';

class LearningEngine {
  constructor() {
    this.patterns = null;
    // Cache de sugestões em memória: { cacheKey: {suggestion, expiresAt} }
    // Modelo ML offline simples: pesos para combinação de hashes (regressão logística simplificada)
    this.mlWeights = {}; // { hash: weight }
    this.mlBias = 0;
    this.suggestionCache = {};
  }

  async initialize() {
    await this.loadPatterns();
    await this.cleanupExpiredPatterns(); // Limpeza na inicialização
    Logger.info(`${LOG_PREFIX} Módulo de aprendizado inicializado.`);
  }

  async loadPatterns() {
    // Acessa diretamente a propriedade do objeto de configurações importado
    this.patterns = settings.userPatterns || [];
    Logger.debug(`${LOG_PREFIX} Padrões de usuário carregados:`, this.patterns);
  }

  async savePatterns() {
    // Usa a função updateSettings para salvar a propriedade específica
    await updateSettings({ userPatterns: this.patterns });
    Logger.debug(`${LOG_PREFIX} Padrões de usuário salvos.`);
  }

  /**
   * Aprende com um grupo de abas criado ou modificado pelo usuário.
   * @param {string} groupName - O nome dado ao grupo.
   * @param {Array<Object>} tabs - As abas no grupo.
   */
  async learnFromGroup(groupName, tabs) {
    Logger.info(
      `${LOG_PREFIX} Aprendendo com o grupo '${groupName}' com ${tabs.length} abas.`
    );

    if (!groupName || tabs.length < 2) {
      Logger.debug(
        `${LOG_PREFIX} Grupo ignorado por ter nome vazio ou menos de 2 abas.`
      );
      return;
    }

    // Extrai hostnames e gera hashes SHA-256
    const hostnames = tabs
      .map((tab) => {
        try {
          return new URL(tab.url).hostname;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    if (hostnames.length < 2) {
      Logger.debug(
        `${LOG_PREFIX} Padrão não aprendido, domínios insuficientes.`
      );
      return;
    }

    // Gera hashes dos hostnames
    const domainHashes = await Promise.all(
      hostnames.map((hostname) => hashHostname(hostname))
    );

    // Usamos um conjunto de hashes únicos e ordenados como chave do padrão
    const uniqueHashes = [...new Set(domainHashes)].sort();
    const patternKey = JSON.stringify(uniqueHashes);

    let existingPattern = this.patterns.find((p) => p.key === patternKey);

    if (existingPattern) {
      // Atualiza padrão existente
      existingPattern.confidence = Math.min(
        1,
        existingPattern.confidence + 0.1
      );
      existingPattern.timesSeen = (existingPattern.timesSeen || 1) + 1;
      existingPattern.suggestedName = groupName;
      Logger.debug(
        `${LOG_PREFIX} Padrão existente atualizado:`,
        existingPattern
      );
    } else {
      // Cria novo padrão com TTL e metadata de privacidade
      const newPattern = {
        key: patternKey,
        domains: uniqueHashes,
        suggestedName: groupName,
        confidence: 0.5,
        timesSeen: 1,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 dias
        lastAccessedAt: Date.now(),
        source: 'user_grouping',
        privacyLevel: 'hashed_hostname',
      };
      this.patterns.push(newPattern);
      Logger.debug(`${LOG_PREFIX} Novo padrão criado:`, newPattern);
    }

    // Mantém a lista de padrões gerenciável, removendo os mais antigos e menos confiáveis
    if (this.patterns.length > 50) {
      this.patterns.sort(
        (a, b) =>
          a.confidence * a.timesSeen - b.confidence * b.timesSeen ||
          a.createdAt - b.createdAt
      );
      this.patterns.shift(); // Remove o menos relevante
    }

    await this.savePatterns();
  }

  /**
   * Remove padrões expirados baseado no TTL
   * @returns {number} Número de padrões removidos
   */
  async cleanupExpiredPatterns() {
    const now = Date.now();
    const initialCount = this.patterns.length;

    this.patterns = this.patterns.filter((pattern) => {
      // Remove se expirado
      if (pattern.expiresAt && pattern.expiresAt < now) {
        Logger.debug(`${LOG_PREFIX} Padrão expirado removido: ${pattern.key}`);
        return false;
      }
      return true;
    });

    const removedCount = initialCount - this.patterns.length;

    if (removedCount > 0) {
      await this.savePatterns();
      Logger.info(
        `${LOG_PREFIX} Limpeza automática: ${removedCount} padrões expirados removidos`
      );
    }

    return removedCount;
  }

  /**
   * Analisa as abas não agrupadas e retorna uma sugestão se um padrão for encontrado.
   * @param {Array<Object>} ungroupedTabs - As abas que não estão em nenhum grupo.
   * @returns {Object|null} Uma sugestão de grupo ou null.
   */
  async getSuggestion(ungroupedTabs) {
    Logger.info(
      `${LOG_PREFIX} Verificando sugestões para ${ungroupedTabs.length} abas não agrupadas.`
    );

    // Limpeza periódica durante uso
    if (Math.random() < 0.1) {
      // 10% de chance
      this.cleanupExpiredPatterns();
    }

    if (ungroupedTabs.length < 3) {
      return null; // Não sugere para menos de 3 abas
    }

    // Extrai hostnames e gera hashes SHA-256
    const hostnames = ungroupedTabs
      .map((tab) => {
        try {
          return new URL(tab.url).hostname;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    const tabHashes = await Promise.all(
      hostnames.map((hostname) => hashHostname(hostname))
    );
    const tabHashesSet = new Set(tabHashes);

    // Gera chave única para o cache (hash dos hashes ordenados)
    const cacheKey = JSON.stringify([...tabHashes].sort());
    const now = Date.now();

    // Limpa entradas expiradas do cache
    for (const key in this.suggestionCache) {
      if (this.suggestionCache[key].expiresAt < now) {
        delete this.suggestionCache[key];
      }
    }

    // Consulta cache
    if (
      this.suggestionCache[cacheKey] &&
      this.suggestionCache[cacheKey].expiresAt > now
    ) {
      Logger.debug(`${LOG_PREFIX} Sugestão retornada do cache.`);
      return this.suggestionCache[cacheKey].suggestion;
    }

    let bestMatch = null;
    let maxScore = 0;

    for (const pattern of this.patterns) {
      if (pattern.confidence < 0.6) continue; // Ignora padrões com baixa confiança

      const patternDomains = new Set(pattern.domains);
      const intersection = new Set(
        [...tabHashesSet].filter((hash) => patternDomains.has(hash))
      );

      // O score pode ser uma combinação da sobreposição e da confiança do padrão
      const score = intersection.size * pattern.confidence;

      if (score > maxScore && intersection.size >= 2) {
        maxScore = score;
        bestMatch = {
          pattern,
          matchedHashes: [...intersection],
        };
      }
    }

    if (bestMatch) {
      // Agrupa abas cujos hashes estão no padrão encontrado
      const tabsToGroup = [];
      for (let i = 0; i < ungroupedTabs.length; i++) {
        if (bestMatch.matchedHashes.includes(tabHashes[i])) {
          tabsToGroup.push(ungroupedTabs[i]);
        }
      }

      if (tabsToGroup.length >= 2) {
        // Score ML para o conjunto de hashes agrupados
        const mlScore = this.mlScore(bestMatch.matchedHashes);
        if (mlScore < 0.7) {
          Logger.debug(
            `${LOG_PREFIX} Score ML insuficiente (${mlScore.toFixed(
              2
            )}), sugestão não exibida.`
          );
          // Cacheia ausência de sugestão para este conjunto
          this.suggestionCache[cacheKey] = {
            suggestion: null,
            expiresAt: now + 2 * 60 * 1000,
          };
          return null;
        }
        const suggestion = {
          suggestedName: bestMatch.pattern.suggestedName,
          tabIds: tabsToGroup.map((t) => t.id),
          patternKey: bestMatch.pattern.key,
          confidence: bestMatch.pattern.confidence,
          mlScore: mlScore,
        };
        // Salva sugestão no cache com TTL de 5 minutos
        this.suggestionCache[cacheKey] = {
          suggestion,
          expiresAt: now + 5 * 60 * 1000,
        };
        Logger.info(
          `${LOG_PREFIX} Sugestão encontrada (ML score ${mlScore.toFixed(2)}):`,
          suggestion
        );
        return suggestion;
      }
    }

    Logger.debug(`${LOG_PREFIX} Nenhuma sugestão encontrada.`);
    // Salva ausência de sugestão no cache para evitar recomputação
    this.suggestionCache[cacheKey] = {
      suggestion: null,
      expiresAt: now + 2 * 60 * 1000,
    };
    return null;
  }

  /**
   * Gera relatório de privacidade dos dados armazenados
   * @returns {Object} Relatório detalhado para o usuário
   */
  getPrivacyReport() {
    const now = Date.now();
    const report = {
      totalPatterns: this.patterns.length,
      oldestPattern: null,
      newestPattern: null,
      domainsCount: new Set(),
      expiringIn7Days: 0,
      expiredPatterns: 0,
      patterns: [],
      // Atenção: domínios são exibidos apenas como hashes para máxima privacidade
      domainsAreHashed: true,
    };

    this.patterns.forEach((pattern) => {
      // Coleta hashes únicos
      pattern.domains.forEach((hash) => report.domainsCount.add(hash));

      // Encontra mais antigo e mais novo
      if (
        !report.oldestPattern ||
        pattern.createdAt < report.oldestPattern.createdAt
      ) {
        report.oldestPattern = pattern;
      }
      if (
        !report.newestPattern ||
        pattern.createdAt > report.newestPattern.createdAt
      ) {
        report.newestPattern = pattern;
      }

      // Conta expirações
      if (pattern.expiresAt) {
        if (pattern.expiresAt < now) {
          report.expiredPatterns++;
        } else if (pattern.expiresAt < now + 7 * 24 * 60 * 60 * 1000) {
          report.expiringIn7Days++;
        }
      }

      // Adiciona padrão sanitizado para exibição
      report.patterns.push({
        domains: pattern.domains, // hashes
        suggestedName: pattern.suggestedName,
        confidence: Math.round(pattern.confidence * 100),
        timesSeen: pattern.timesSeen,
        createdAt: new Date(pattern.createdAt).toLocaleDateString('pt-BR'),
        expiresAt: pattern.expiresAt
          ? new Date(pattern.expiresAt).toLocaleDateString('pt-BR')
          : 'Nunca',
        daysUntilExpiry: pattern.expiresAt
          ? Math.ceil((pattern.expiresAt - now) / (24 * 60 * 60 * 1000))
          : null,
      });
    });

    report.domainsCount = report.domainsCount.size;

    return report;
  }

  /**
   * Calcula o score ML para um conjunto de hashes usando regressão logística simples.
   * @param {Array<string>} hashes
   * @returns {number} score entre 0 e 1
   */
  mlScore(hashes) {
    let sum = this.mlBias;
    for (const h of hashes) {
      sum += this.mlWeights[h] || 0;
    }
    // Sigmoid
    return 1 / (1 + Math.exp(-sum));
  }

  /**
   * Recebe feedback do usuário sobre uma sugestão e treina o modelo ML.
   * @param {Array<string>} tabUrls - URLs das abas agrupadas
   * @param {boolean} accepted - true se o usuário aceitou a sugestão
   */
  async feedbackOnSuggestion(tabUrls, accepted) {
    // Extrai hostnames e gera hashes
    const hostnames = tabUrls
      .map((url) => {
        try {
          return new URL(url).hostname;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    const hashes = await Promise.all(hostnames.map((h) => hashHostname(h)));
    this.mlTrain(hashes, accepted);
    Logger.info(
      `${LOG_PREFIX} Feedback recebido para ML: ${
        accepted ? 'aceito' : 'rejeitado'
      }.`
    );
  }

  /**
   * Atualiza pesos do modelo ML com feedback supervisionado (aceito/rejeitado).
   * @param {Array<string>} hashes
   * @param {boolean} accepted
   */
  mlTrain(hashes, accepted) {
    // Taxa de aprendizado simples
    const lr = 0.1;
    const target = accepted ? 1 : 0;
    const pred = this.mlScore(hashes);
    const error = target - pred;
    for (const h of hashes) {
      this.mlWeights[h] = (this.mlWeights[h] || 0) + lr * error;
    }
    this.mlBias += lr * error;
  }
}
export const learningEngine = new LearningEngine();
