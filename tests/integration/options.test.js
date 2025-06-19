/**
 * @file options.test.js
 * @description Testes de integração para a página de opções.
 */
import fs from 'fs';
import path from 'path';

// Importar o módulo a ser testado
// O script adiciona os seus próprios listeners ao 'document'
import '../../options/options.js';

// Módulos que precisam de ser mockados
import * as settingsManager from '../../settings-manager.js';
jest.mock('../../settings-manager.js');

describe('options.js', () => {
  beforeEach(() => {
    // Carregar o HTML da página de opções no JSDOM
    const html = fs.readFileSync(path.resolve(__dirname, '../../options/options.html'), 'utf8');
    document.body.innerHTML = html;
    
    // Mock da resposta do background script para carregar as configurações
    browser.runtime.sendMessage.mockResolvedValue({
        autoGroupingEnabled: true,
        groupingMode: 'smart',
        customRules: [],
        exceptions: [],
    });
  });

  test('deve carregar as configurações e preencher o formulário ao iniciar', async () => {
    // Disparar o evento que o script espera
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    
    // Aguardar a resolução das Promises (ex: sendMessage)
    await new Promise(process.nextTick);

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getSettings' });
    const groupingModeSelect = document.getElementById('groupingMode');
    expect(groupingModeSelect.value).toBe('smart');
  });

  test('deve salvar as configurações ao clicar no botão "Salvar"', async () => {
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await new Promise(process.nextTick);
    
    // Simular interação do utilizador
    const exceptionsTextarea = document.getElementById('exceptionsList');
    exceptionsTextarea.value = 'google.com';
    
    const saveButton = document.getElementById('saveButton');
    saveButton.click();
    
    // Verificar se a mensagem de atualização foi enviada com os dados corretos
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        action: 'updateSettings',
        settings: expect.objectContaining({
            exceptions: ['google.com']
        }),
    }));
  });
});
