/**
 * @file browser-mocks.js
 * @description Mock robusto para a API 'browser' das WebExtensions.
 * As funções assíncronas retornam Promises para simular o comportamento real.
 */

// jest.fn() cria uma função "espiã" que podemos usar para verificar se foi chamada.
const mockBrowser = {
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({})),
    getURL: jest.fn(path => `chrome-extension://mock-id/${path}`),
    openOptionsPage: jest.fn(() => Promise.resolve()),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => true),
    },
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    group: jest.fn(options => Promise.resolve(options.groupId || Math.floor(Math.random() * 1000))),
    ungroup: jest.fn(() => Promise.resolve()),
    get: jest.fn(id => Promise.resolve({ id, url: `https://example.com/tab/${id}` })),
    create: jest.fn(options => Promise.resolve({ id: 999, url: options.url })),
    onUpdated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onActivated: { addListener: jest.fn() },
  },
  tabGroups: {
    query: jest.fn(() => Promise.resolve([])),
    update: jest.fn(() => Promise.resolve({})),
    get: jest.fn(id => Promise.resolve({ id, title: `Group ${id}` })),
    onCreated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
  },
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
    },
  },
  menus: {
    create: jest.fn(),
    update: jest.fn(),
    removeAll: jest.fn(() => Promise.resolve()),
    refresh: jest.fn(() => Promise.resolve()),
    onClicked: { addListener: jest.fn() },
    onShown: { addListener: jest.fn() },
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{}])),
  },
  downloads: {
    download: jest.fn(() => Promise.resolve(1)),
  },
  windows: {
    getAll: jest.fn(() => Promise.resolve([])),
  },
};

module.exports = mockBrowser;
