/**
 * @file app-state.js
 * @description Mantém o estado partilhado para a extensão, como conjuntos de rastreamento.
 * Isto evita dependências circulares e permite que diferentes módulos partilhem estado.
 */

/**
 * Um Map para rastrear a intenção de criar grupos automáticos.
 * A chave é um identificador temporário (ex: o ID do primeiro separador) e o valor
 * é um objeto com os IDs dos separadores que serão agrupados.
 * @type {Map<number, {tabIds: number[]}>}
 */
export let pendingAutomaticGroups = new Map();

/**
 * Um Map para rastrear falhas na injeção de scripts de conteúdo.
 * A chave é o tabId, o valor é o número de tentativas falhadas.
 * Usado para evitar tentativas repetidas em páginas protegidas ou com erros persistentes.
 * @type {Map<number, number>}
 */
export let injectionFailureMap = new Map();
