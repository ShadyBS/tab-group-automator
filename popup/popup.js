/**
 * @file popup.js
 * @description Lógica para o popup da barra de ferramentas da extensão.
 */

// Importar utilitários DOM seguros
import { createElement, replaceContent, createLoadingElement } from '../src/dom-utils.js';

// Aplica o tema com base nas configurações guardadas
function applyTheme(theme) {
  if (
    theme === 'dark' ||
    (theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('autoGroupingToggle');
  const optionsButton = document.getElementById('optionsButton');
  const groupAllButton = document.getElementById('groupAllButton');
  const statusDiv = document.getElementById('popup-status');

  // NOVO: Elementos da UI de Sugestão
  const suggestionBox = document.getElementById('suggestion-box');
  const suggestionName = document.getElementById('suggestion-name');
  const acceptSuggestionBtn = document.getElementById('accept-suggestion');
  const rejectSuggestionBtn = document.getElementById('reject-suggestion');

  let currentSuggestion = null; // Armazena a sugestão atual

  /**
   * Define o estado da UI do popup com base nas configurações.
   * @param {object} settings - O objeto de configurações.
   */
  function setPopupState(settings) {
    applyTheme(settings.theme || 'auto');
    toggle.checked = settings.autoGroupingEnabled;
    toggle.disabled = false;
    groupAllButton.disabled = false;
  }

  /**
   * Mostra uma mensagem de erro no popup.
   * @param {string} message - A mensagem a ser exibida.
   */
  function showError(message) {
    statusDiv.textContent = message;
    statusDiv.className = 'text-xs text-center mt-2 h-4 text-red-500 font-bold';
    toggle.disabled = true;
    groupAllButton.disabled = true;
  }

  // --- NOVO: Funções de Sugestão ---
  async function updateSuggestionUI() {
    try {
      currentSuggestion = await browser.runtime.sendMessage({
        action: 'getSuggestion',
      });
      if (currentSuggestion) {
        suggestionName.textContent = currentSuggestion.suggestedName;
        suggestionBox.classList.remove('hidden');
      } else {
        suggestionBox.classList.add('hidden');
      }
    } catch (e) {
      console.error('Erro ao obter sugestão:', e);
      suggestionBox.classList.add('hidden');
    }
  }

  /**
   * Inicializa o popup, carregando as configurações e definindo o estado da UI.
   */
  async function initializePopup(retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 500; // 500ms

    statusDiv.textContent =
      retryCount > 0
        ? `A tentar reconectar... (${retryCount}/${maxRetries})`
        : 'A carregar...';
    statusDiv.className = 'text-xs text-center mt-2 h-4'; // Reset class

    try {
      const settings = await browser.runtime.sendMessage({
        action: 'getSettings',
      });
      if (settings) {
        setPopupState(settings);
        statusDiv.textContent = ''; // Limpa a mensagem de carregamento
      } else {
        showError('Erro: Resposta inválida do script.');
      }
    } catch (error) {
      console.error('Erro ao inicializar o popup:', error);

      // Tenta reconectar se ainda há tentativas disponíveis
      if (retryCount < maxRetries) {
        setTimeout(() => {
          initializePopup(retryCount + 1);
        }, retryDelay * (retryCount + 1)); // Delay progressivo
      } else {
        showError('Erro de comunicação. Recarregue a extensão.');
      }
    }
  }

  initializePopup();
  updateSuggestionUI(); // NOVO: Verifica por sugestões ao abrir

  // Listener para o botão de ativar/desativar
  toggle.addEventListener('change', async () => {
    const originalState = !toggle.checked; // O estado antes da mudança
    const newState = toggle.checked;

    try {
      await browser.runtime.sendMessage({
        action: 'updateSettings',
        settings: { autoGroupingEnabled: newState },
      });
      browser.runtime
        .sendMessage({
          action: 'log',
          level: 'info',
          context: 'Popup',
          message: `Agrupamento automático ${
            newState ? 'ativado' : 'desativado'
          } pelo utilizador.`,
        })
        .catch(() => {});
    } catch (error) {
      // CORREÇÃO: Se a gravação falhar, reverte a UI para o estado original e notifica o utilizador.
      console.error('Falha ao atualizar a configuração:', error);
      statusDiv.textContent = 'Erro ao guardar.';
      statusDiv.className = 'text-xs text-center mt-2 h-4 text-red-500';
      toggle.checked = originalState; // Reverte a alteração visual
    }
  });

  // Listener para o botão de agrupar tudo
  groupAllButton.addEventListener('click', async () => {
    groupAllButton.disabled = true;
    
    // Criar elemento de loading de forma segura
    const loadingContent = createLoadingElement('Agrupando...');
    replaceContent(groupAllButton, loadingContent);

    // Mostrar progresso no status
    statusDiv.textContent = 'Iniciando agrupamento...';
    statusDiv.className = 'text-xs text-center mt-2 h-4 text-blue-600 dark:text-blue-400';

    browser.runtime
      .sendMessage({
        action: 'log',
        level: 'info',
        context: 'Popup',
        message: 'Botão "Agrupar Abas Abertas" clicado.',
      })
      .catch(() => {});

    try {
      // Obter contagem de abas primeiro para mostrar progresso
      const tabs = await browser.tabs.query({ currentWindow: true, pinned: false });
      const tabCount = tabs.length;
      
      if (tabCount === 0) {
        statusDiv.textContent = 'Nenhuma aba para agrupar';
        statusDiv.className = 'text-xs text-center mt-2 h-4 text-yellow-600 dark:text-yellow-400';
        setTimeout(() => {
          groupAllButton.disabled = false;
          replaceContent(groupAllButton, [
            createElement('svg', {
              xmlns: 'http://www.w3.org/2000/svg',
              className: 'h-5 w-5',
              viewBox: '0 0 20 20',
              fill: 'currentColor'
            }),
            createElement('span', {}, 'Agrupar Abas Abertas')
          ]);
          statusDiv.textContent = '';
        }, 2000);
        return;
      }

      statusDiv.textContent = `Processando ${tabCount} abas...`;
      
      const startTime = performance.now();
      await browser.runtime.sendMessage({ action: 'groupAllTabs' });
      const duration = performance.now() - startTime;
      
      // Mostrar resultado com métricas de performance
      if (duration < 50) {
        statusDiv.textContent = `✅ ${tabCount} abas agrupadas em ${Math.round(duration)}ms`;
        statusDiv.className = 'text-xs text-center mt-2 h-4 text-green-600 dark:text-green-400';
      } else if (duration < 200) {
        statusDiv.textContent = `✅ ${tabCount} abas agrupadas em ${Math.round(duration)}ms`;
        statusDiv.className = 'text-xs text-center mt-2 h-4 text-blue-600 dark:text-blue-400';
      } else {
        statusDiv.textContent = `⚠️ ${tabCount} abas agrupadas em ${Math.round(duration)}ms (lento)`;
        statusDiv.className = 'text-xs text-center mt-2 h-4 text-yellow-600 dark:text-yellow-400';
      }
      
      setTimeout(() => window.close(), 1500);
      
    } catch (error) {
      console.error('Erro ao agrupar todas as abas:', error);
      statusDiv.textContent = '❌ Falha ao agrupar abas';
      statusDiv.className = 'text-xs text-center mt-2 h-4 text-red-500';
      
      // Restaurar botão após erro
      setTimeout(() => {
        groupAllButton.disabled = false;
        replaceContent(groupAllButton, [
          createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            className: 'h-5 w-5',
            viewBox: '0 0 20 20',
            fill: 'currentColor'
          }),
          createElement('span', {}, 'Agrupar Abas Abertas')
        ]);
        statusDiv.textContent = '';
      }, 3000);
    }
  });

  // Listener para o botão de opções
  optionsButton.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });

  // --- NOVO: Listeners para botões de sugestão ---
  acceptSuggestionBtn.addEventListener('click', async () => {
    if (!currentSuggestion) return;

    try {
      // Uma nova ação 'acceptSuggestion' será necessária no background script
      await browser.runtime.sendMessage({
        action: 'acceptSuggestion',
        suggestion: currentSuggestion,
      });
      window.close();
    } catch (e) {
      console.error('Erro ao aceitar sugestão:', e);
      showError('Falha ao criar grupo.');
    }
  });

  rejectSuggestionBtn.addEventListener('click', async () => {
    try {
      await browser.runtime.sendMessage({ action: 'clearSuggestion' });
      suggestionBox.classList.add('hidden');
      currentSuggestion = null;
    } catch (e) {
      console.error('Erro ao rejeitar sugestão:', e);
    }
  });

  // CORREÇÃO: Ouve por atualizações de configurações feitas em outros locais (ex: página de opções)
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'settingsUpdated') {
      console.log('Popup a receber atualização de configurações.');
      initializePopup(); // Re-inicializa o popup para refletir as novas configurações
    }
    // NOVO: Ouve por novas sugestões enquanto o popup está aberto
    if (message.action === 'suggestionUpdated') {
      console.log('Popup a receber notificação de nova sugestão.');
      updateSuggestionUI();
    }
  });
});
