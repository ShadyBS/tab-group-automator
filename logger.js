/**
 * @file logger.js
 * @description Módulo de logging centralizado para a extensão.
 */

// Define os níveis de log por ordem de severidade.
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// O nível de log padrão. Será atualizado pelas configurações do utilizador.
let currentLogLevel = LOG_LEVELS.INFO;

// Mapeia cada nível para um método e estilo do console para uma saída colorida.
const levelDetails = {
  [LOG_LEVELS.DEBUG]: { method: 'log', style: 'color: #6e6e6e;' },
  [LOG_LEVELS.INFO]: { method: 'info', style: 'color: #007bff;' },
  [LOG_LEVELS.WARN]: { method: 'warn', style: 'color: #ffc107; font-weight: bold;' },
  [LOG_LEVELS.ERROR]: { method: 'error', style: 'color: #dc3545; font-weight: bold;' },
};

/**
 * Função principal que regista a mensagem se o nível for apropriado.
 * @param {number} level - O nível da mensagem de log.
 * @param {string} context - O contexto (módulo/função) de onde o log se origina.
 * @param {string} message - A mensagem de log principal.
 * @param  {...any} details - Objetos ou valores adicionais a serem registados.
 */
function log(level, context, message, ...details) {
  // Ignora a mensagem se o nível de log atual for mais restritivo.
  if (level < currentLogLevel) return;

  const { method, style } = levelDetails[level];
  const timestamp = new Date().toISOString().slice(11, 23);

  // Garante que objetos sejam passados diretamente para o console para inspeção interativa.
  const processedDetails = details.map(d => (typeof d === 'object' ? d : String(d)));

  console[method](
    `%c[ATG] ${timestamp} [${context}] - ${message}`,
    style,
    ...processedDetails
  );
}

export default {
  /**
   * Define o nível de log a ser exibido.
   * @param {string} levelName - 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'.
   */
  setLevel: (levelName) => {
    const newLevel = LOG_LEVELS[(levelName || 'INFO').toUpperCase()];
    if (newLevel !== undefined) {
      currentLogLevel = newLevel;
    }
  },

  // Métodos de atalho para cada nível de log.
  debug: (context, message, ...details) => log(LOG_LEVELS.DEBUG, context, message, ...details),
  info: (context, message, ...details) => log(LOG_LEVELS.INFO, context, message, ...details),
  warn: (context, message, ...details) => log(LOG_LEVELS.WARN, context, message, ...details),
  error: (context, message, ...details) => log(LOG_LEVELS.ERROR, context, message, ...details),
};
