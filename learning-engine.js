/**
 * @file learning-engine.js
 * @description Módulo de aprendizado para sugerir grupos de abas com base no comportamento do usuário.
 */

import { settings, updateSettings } from "./settings-manager.js";
import Logger from "./logger.js";

const LOG_PREFIX = "[LearningEngine]";

class LearningEngine {
  constructor() {
    this.patterns = null;
  }

  async initialize() {
    await this.loadPatterns();
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

    const domains = tabs
      .map((tab) => {
        try {
          return new URL(tab.url).hostname;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    if (domains.length < 2) {
      Logger.debug(
        `${LOG_PREFIX} Padrão não aprendido, domínios insuficientes.`
      );
      return;
    }

    // Usamos um conjunto de domínios únicos e ordenados como chave do padrão
    const patternKey = JSON.stringify([...new Set(domains)].sort());

    let existingPattern = this.patterns.find((p) => p.key === patternKey);

    if (existingPattern) {
      // Atualiza padrão existente
      existingPattern.confidence = Math.min(
        1,
        existingPattern.confidence + 0.1
      );
      existingPattern.timesSeen = (existingPattern.timesSeen || 1) + 1;
      // Poderíamos adicionar uma lógica mais inteligente para atualizar o nome,
      // por exemplo, se o usuário o renomeia consistentemente.
      existingPattern.suggestedName = groupName;
      Logger.debug(
        `${LOG_PREFIX} Padrão existente atualizado:`,
        existingPattern
      );
    } else {
      // Cria novo padrão
      const newPattern = {
        key: patternKey,
        domains: [...new Set(domains)].sort(),
        suggestedName: groupName,
        confidence: 0.5,
        timesSeen: 1,
        createdAt: Date.now(),
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
   * Analisa as abas não agrupadas e retorna uma sugestão se um padrão for encontrado.
   * @param {Array<Object>} ungroupedTabs - As abas que não estão em nenhum grupo.
   * @returns {Object|null} Uma sugestão de grupo ou null.
   */
  getSuggestion(ungroupedTabs) {
    Logger.info(
      `${LOG_PREFIX} Verificando sugestões para ${ungroupedTabs.length} abas não agrupadas.`
    );

    if (ungroupedTabs.length < 3) {
      return null; // Não sugere para menos de 3 abas
    }

    const tabDomains = new Set(
      ungroupedTabs
        .map((tab) => {
          try {
            return new URL(tab.url).hostname;
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean)
    );

    let bestMatch = null;
    let maxScore = 0;

    for (const pattern of this.patterns) {
      if (pattern.confidence < 0.6) continue; // Ignora padrões com baixa confiança

      const patternDomains = new Set(pattern.domains);
      const intersection = new Set(
        [...tabDomains].filter((domain) => patternDomains.has(domain))
      );

      // O score pode ser uma combinação da sobreposição e da confiança do padrão
      const score = intersection.size * pattern.confidence;

      if (score > maxScore && intersection.size >= 2) {
        maxScore = score;
        bestMatch = {
          pattern,
          matchedDomains: [...intersection],
        };
      }
    }

    if (bestMatch) {
      const tabsToGroup = ungroupedTabs.filter((tab) => {
        try {
          const hostname = new URL(tab.url).hostname;
          return bestMatch.matchedDomains.includes(hostname);
        } catch (e) {
          return false;
        }
      });

      if (tabsToGroup.length >= 2) {
        const suggestion = {
          suggestedName: bestMatch.pattern.suggestedName,
          tabIds: tabsToGroup.map((t) => t.id),
          patternKey: bestMatch.pattern.key,
          confidence: bestMatch.pattern.confidence,
        };
        Logger.info(`${LOG_PREFIX} Sugestão encontrada:`, suggestion);
        return suggestion;
      }
    }

    Logger.debug(`${LOG_PREFIX} Nenhuma sugestão encontrada.`);
    return null;
  }

  /**
   * Limpa todos os padrões aprendidos.
   */
  async clearHistory() {
    this.patterns = [];
    await this.savePatterns();
    Logger.info(`${LOG_PREFIX} Histórico de aprendizado foi limpo.`);
  }
}

export const learningEngine = new LearningEngine();
