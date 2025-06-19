/**
 * @file test-utils.js
 * @description Ficheiro de setup global para o Jest.
 * Configura um ambiente JSDOM e mocks globais para a API 'browser'.
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');
const mockBrowser = require('../mocks/browser-mocks');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Event = dom.window.Event; // Corrige o erro "Event is not defined"
// Adicione outras APIs do DOM aqui se necessário, ex:
global.URL = dom.window.URL;

// Tornar o mock do 'browser' disponível globalmente para todos os testes
global.browser = mockBrowser;

// Hooks do Jest para limpar o ambiente entre os testes
beforeEach(() => {
  // Limpa todos os mocks antes de cada teste para evitar contaminação
  jest.clearAllMocks();
});
