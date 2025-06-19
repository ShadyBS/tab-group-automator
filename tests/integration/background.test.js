/**
 * @file background.test.js
 * @description Testes de integração para o background script.
 */

// Importar explicitamente as funções que queremos testar ou espiar
import * as background from '../../background.js';
import * as settingsManager from '../../settings-manager.js';
import * as groupingLogic from '../../grouping-logic.js';

// Mockar as dependências
jest.mock('../../settings-manager.js');
jest.mock('../../grouping-logic.js');
jest.mock('../../context-menu-manager.js');
jest.mock('../../app-state.js', () => ({
  recentlyCreatedAutomaticGroups: new Set(),
  pendingClassificationGroups: new Set(),
  injectionFailureMap: new Map(),
}));


describe('background.js', () => {
  
  beforeEach(() => {
    // Configurar um estado limpo para os mocks antes de cada teste
    settingsManager.settings = {
        autoGroupingEnabled: true,
        showTabCount: true,
        manualGroupIds: [],
        customRules: [],
    };
    // Simular que o carregamento das configurações foi bem-sucedido
    settingsManager.loadSettings.mockResolvedValue(); 
  });

  test('deve inicializar os listeners e módulos corretamente', async () => {
    await background.main(); // Chamar a função de inicialização exportada
    
    expect(settingsManager.loadSettings).toHaveBeenCalled();
    expect(browser.tabs.onUpdated.addListener).toHaveBeenCalled();
    expect(browser.tabs.onRemoved.addListener).toHaveBeenCalled();
    expect(browser.tabGroups.onCreated.addListener).toHaveBeenCalled();
  });

  test('deve processar uma mensagem de "updateSettings"', async () => {
    await background.main();

    // Capturar o listener de mensagens
    const messageHandler = browser.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Simular o recebimento de uma mensagem para atualizar as configurações
    const newSettingsPayload = { autoGroupingEnabled: false };
    settingsManager.updateSettings.mockResolvedValue({
        oldSettings: { autoGroupingEnabled: true },
        newSettings: { autoGroupingEnabled: false },
    });

    const response = await messageHandler(
      { action: 'updateSettings', settings: newSettingsPayload },
      {}, // sender
      () => {} // sendResponse
    );

    expect(settingsManager.updateSettings).toHaveBeenCalledWith(newSettingsPayload);
  });
});

