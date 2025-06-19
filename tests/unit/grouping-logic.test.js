/**
 * @file grouping-logic.test.js
 * @description Testes para a lógica principal de agrupamento.
 */

import { isTabGroupable, getFinalGroupName, processTabQueue } from '../../grouping-logic.js';
import * as settingsManager from '../../settings-manager.js';
import * as appState from '../../app-state.js';

// Mock das dependências para isolar a lógica de agrupamento
jest.mock('../../settings-manager.js');
jest.mock('../../app-state.js');

describe('grouping-logic', () => {
  beforeEach(() => {
    // Restaurar o estado dos mocks antes de cada teste
    settingsManager.settings = {
      exceptions: [],
      customRules: [],
      groupingMode: 'smart',
      manualGroupIds: [],
    };
    settingsManager.smartNameCache = new Map();
    appState.injectionFailureMap = new Map();
  });

  test('isTabGroupable deve identificar corretamente abas agrupáveis', () => {
    // Corrigido: Adicionado 'id' aos objetos de aba, como esperado pela função
    const groupableTab = { id: 1, url: 'https://example.com', pinned: false };
    const pinnedTab = { id: 2, url: 'https://example.com', pinned: true };
    const nonHttpTab = { id: 3, url: 'about:blank', pinned: false };
    const exceptionTab = { id: 4, url: 'https://mail.google.com', pinned: false };
    
    settingsManager.settings.exceptions = ['mail.google.com'];
    
    expect(isTabGroupable(groupableTab)).toBe(true);
    expect(isTabGroupable(pinnedTab)).toBe(false);
    expect(isTabGroupable(nonHttpTab)).toBe(false);
    expect(isTabGroupable(exceptionTab)).toBe(false);
  });

  test('getFinalGroupName deve usar o cache quando disponível', async () => {
    const tab = { id: 1, url: 'https://example.com' };
    settingsManager.smartNameCache.set('example.com', 'Cached Name');
    
    const name = await getFinalGroupName(tab);

    expect(name).toBe('Cached Name');
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  test('processTabQueue deve obter abas e processá-las', async () => {
    const tabsToProcessIds = [1, 2];
    const tab1 = { id: 1, url: 'https://site.com/a', windowId: 10 };
    const tab2 = { id: 2, url: 'https://site.com/b', windowId: 10 };
    
    // Configuração dos mocks
    browser.tabs.get.mockImplementation(id => {
        if (id === 1) return Promise.resolve(tab1);
        if (id === 2) return Promise.resolve(tab2);
        return Promise.resolve(null);
    });
    browser.tabs.query.mockResolvedValue([tab1, tab2]);
    browser.tabGroups.query.mockResolvedValue([]);
    
    // Mock do getFinalGroupName para retornar um nome consistente
    const getFinalGroupNameMock = jest.spyOn(groupingLogic, 'getFinalGroupName').mockResolvedValue('Site');

    await processTabQueue(tabsToProcessIds);

    // Deve tentar agrupar as duas abas juntas
    expect(browser.tabs.group).toHaveBeenCalledWith(expect.objectContaining({
        tabIds: [1, 2]
    }));

    getFinalGroupNameMock.mockRestore(); // Limpar o spy
  });
});
