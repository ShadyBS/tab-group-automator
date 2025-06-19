/**
 * @file context-menu-manager.test.js
 * @description Testes para o gestor do menu de contexto.
 */

// Importar o módulo que queremos testar
import * as contextMenuManager from '../../context-menu-manager.js';

// Importar os módulos que precisamos de mockar
import * as settingsManager from '../../settings-manager.js';
import * as groupingLogic from '../../grouping-logic.js';
import * as appState from '../../app-state.js';

// Criar mocks para as dependências para isolar o nosso módulo
jest.mock('../../settings-manager.js');
jest.mock('../../grouping-logic.js');
jest.mock('../../app-state.js');

describe('context-menu-manager', () => {
  let clickHandler;

  beforeEach(async () => {
    // Restaurar o estado dos mocks antes de cada teste
    settingsManager.settings = {
      customRules: [],
      exceptions: [],
      manualGroupIds: [],
    };
    appState.recentlyCreatedAutomaticGroups = new Set();
    
    // Inicializar os menus para obter os handlers
    await contextMenuManager.initializeContextMenus();
    // Captura o handler de clique registado no nosso mock
    if (browser.menus.onClicked.addListener.mock.calls.length > 0) {
        clickHandler = browser.menus.onClicked.addListener.mock.calls[0][0];
    }
  });

  test('deve criar os menus básicos na atualização', async () => {
    await contextMenuManager.updateContextMenus();
    expect(browser.menus.removeAll).toHaveBeenCalled();
    expect(browser.menus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'main-parent' }));
  });

  test('deve adicionar uma exceção corretamente', async () => {
    const tab = { url: 'https://mail.google.com' };
    await clickHandler({ menuItemId: 'never-group-domain' }, tab);

    // Verifica se a função de atualização de configurações foi chamada
    expect(settingsManager.updateSettings).toHaveBeenCalledWith({
      exceptions: ['mail.google.com'],
    });
  });

  test('deve agrupar abas semelhantes ao clicar', async () => {
    const tab = { id: 1, url: "https://example.com", windowId: 100 };
    const allTabs = [
      tab,
      { id: 2, url: "https://example.com/page", windowId: 100 },
      { id: 3, url: "https://other.com", windowId: 100 },
    ];

    // Configuração dos mocks para este cenário
    groupingLogic.getFinalGroupName.mockResolvedValue('Example');
    groupingLogic.isTabGroupable.mockReturnValue(true);
    browser.tabs.query.mockResolvedValue(allTabs);
    browser.tabGroups.query.mockResolvedValue([]); // Simula que não há grupos existentes

    await clickHandler({ menuItemId: "group-similar-now" }, tab);

    // A lógica deve encontrar todas as abas correspondentes (1 e 2) e agrupá-las.
    expect(browser.tabs.group).toHaveBeenCalledWith(expect.objectContaining({
      tabIds: [1, 2],
    }));
  });

  test('deve converter grupo manual em automático', async () => {
    const tab = { id: 1, groupId: 100 };
    settingsManager.settings.manualGroupIds = [100];
    
    browser.tabGroups.get.mockResolvedValue({ id: 100, title: '📌 Manual Group' });
    browser.tabs.query.mockResolvedValue([{ id: 1, groupId: 100 }]);
    groupingLogic.processTabQueue.mockResolvedValue([101]); // Mock para retornar um iterável

    await clickHandler({ menuItemId: "convert-to-auto" }, tab);
    
    expect(settingsManager.updateSettings).toHaveBeenCalledWith({ manualGroupIds: [] });
    expect(browser.tabGroups.update).toHaveBeenCalledWith(100, { title: 'Manual Group' });
    expect(groupingLogic.processTabQueue).toHaveBeenCalledWith([1]);
  });
});
