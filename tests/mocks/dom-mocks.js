// Simula a API DOM para testes
class MockStorage {
  constructor() {
    this.store = {};
  }
  
  getItem(key) {
    return this.store[key] || null;
  }
  
  setItem(key, value) {
    this.store[key] = String(value);
  }
  
  removeItem(key) {
    delete this.store[key];
  }
  
  clear() {
    this.store = {};
  }
}

global.localStorage = new MockStorage();
global.sessionStorage = new MockStorage();

// Mock para URLSearchParams
global.URLSearchParams = class {
  constructor(query) {
    this.params = new Map();
    if (query) {
      query.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        this.params.set(key, decodeURIComponent(value));
      });
    }
  }
  
  get(name) {
    return this.params.get(name);
  }
};

// Mock para fetch API
global.fetch = jest.fn();