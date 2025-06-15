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
