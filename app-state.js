/**
 * @file app-state.js
 * @description Mantém o estado partilhado para a extensão, como conjuntos de rastreamento.
 * Isto evita dependências circulares e permite que diferentes módulos partilhem estado.
 */

/**
 * Um Set para rastrear os IDs dos grupos que foram criados automaticamente.
 * @type {Set<number>}
 */
export let recentlyCreatedAutomaticGroups = new Set();

/**
 * NOVO: Um Set para armazenar temporariamente IDs de grupos que acabaram de ser criados
 * e que aguardam para serem classificados como automáticos ou manuais.
 * @type {Set<number>}
 */
export let pendingClassificationGroups = new Set();

/**
 * NOVO: Um Map para rastrear falhas na injeção de scripts.
 * A chave é o tabId, o valor é o número de tentativas falhadas.
 * Usado para evitar tentativas repetidas em páginas protegidas ou com erros persistentes.
 * @type {Map<number, number>}
 */
export let injectionFailureMap = new Map();
