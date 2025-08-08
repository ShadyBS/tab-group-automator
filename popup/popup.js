/**
 * @file popup.js
 * @description Lógica para o popup da barra de ferramentas da extensão.
 */

// Importar utilitários DOM seguros
import { createElement, replaceContent, createLoadingElement } from '../src/dom-utils.js';

// Aplica o tema com base nas configurações guardadas
function applyTheme(theme) {
  if (
    theme === "dark" ||
    (theme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("autoGroupingToggle");
  const optionsButton = document.getElementById("optionsButton");
  const groupAllButton = document.getElementById("groupAllButton");
  const statusDiv = document.getElementById("popup-status");

  // NOVO: Elementos da UI de Sugestão
  const suggestionBox = document.getElementById("suggestion-box");
  const suggestionName = document.getElementById("suggestion-name");
  const acceptSuggestionBtn = document.getElementById("accept-suggestion");
  const rejectSuggestionBtn = document.getElementById("reject-suggestion");

  let currentSuggestion = null; // Armazena a sugestão atual

  /**
   * Define o estado da UI do popup com base nas configurações.
   * @param {object} settings - O objeto de configurações.
   */
  function setPopupState(settings) {
    applyTheme(settings.theme || "auto");
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
    statusDiv.className = "text-xs text-center mt-2 h-4 text-red-500 font-bold";
    toggle.disabled = true;
    groupAllButton.disabled = true;
  }

  // --- NOVO: Funções de Sugestão ---
  async function updateSuggestionUI() {
    try {
      currentSuggestion = await browser.runtime.sendMessage({
        action: "getSuggestion",
      });
      if (currentSuggestion) {
        suggestionName.textContent = currentSuggestion.suggestedName;
        suggestionBox.classList.remove("hidden");
      } else {
        suggestionBox.classList.add("hidden");
      }
    } catch (e) {
      console.error("Erro ao obter sugestão:", e);
      suggestionBox.classList.add("hidden");
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
        : "A carregar...";
    statusDiv.className = "text-xs text-center mt-2 h-4"; // Reset class

    try {
      const settings = await browser.runtime.sendMessage({
        action: "getSettings",
      });
      if (settings) {
        setPopupState(settings);
        statusDiv.textContent = ""; // Limpa a mensagem de carregamento
      } else {
        showError("Erro: Resposta inválida do script.");
      }
    } catch (error) {
      console.error("Erro ao inicializar o popup:", error);

      // Tenta reconectar se ainda há tentativas disponíveis
      if (retryCount < maxRetries) {
        setTimeout(() => {
          initializePopup(retryCount + 1);
        }, retryDelay * (retryCount + 1)); // Delay progressivo
      } else {
        showError("Erro de comunicação. Recarregue a extensão.");
      }
    }
  }

  initializePopup();
  updateSuggestionUI(); // NOVO: Verifica por sugestões ao abrir

  // Listener para o botão de ativar/desativar
  toggle.addEventListener("change", async () => {
    const originalState = !toggle.checked; // O estado antes da mudança
    const newState = toggle.checked;

    try {
      await browser.runtime.sendMessage({
        action: "updateSettings",
        settings: { autoGroupingEnabled: newState },
      });
      browser.runtime
        .sendMessage({
          action: "log",
          level: "info",
          context: "Popup",
          message: `Agrupamento automático ${
            newState ? "ativado" : "desativado"
          } pelo utilizador.`,
        })
        .catch(() => {});
    } catch (error) {
      // CORREÇÃO: Se a gravação falhar, reverte a UI para o estado original e notifica o utilizador.
      console.error("Falha ao atualizar a configuração:", error);
      statusDiv.textContent = "Erro ao guardar.";
      statusDiv.className = "text-xs text-center mt-2 h-4 text-red-500";
      toggle.checked = originalState; // Reverte a alteração visual
    }
  });

  // Listener para o botão de agrupar tudo
  groupAllButton.addEventListener("click", () => {
    groupAllButton.disabled = true;
    
    // Criar elemento de loading de forma segura
    const loadingContent = createLoadingElement('Agrupando...');
    replaceContent(groupAllButton, loadingContent);

    browser.runtime
      .sendMessage({
        action: "log",
        level: "info",
        context: "Popup",
        message: 'Botão "Agrupar Abas Abertas" clicado.',
      })
      .catch(() => {});

    browser.runtime
      .sendMessage({ action: "groupAllTabs" })
      .then(() => {
        setTimeout(() => window.close(), 500);
      })
      .catch((error) => {
        console.error("Erro ao agrupar todas as abas:", error);
        showError("Falha ao agrupar abas.");
      });
  });

  // Listener para o botão de opções
  optionsButton.addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  // --- NOVO: Listeners para botões de sugestão ---
  acceptSuggestionBtn.addEventListener("click", async () => {
    if (!currentSuggestion) return;

    try {
      // Uma nova ação 'acceptSuggestion' será necessária no background script
      await browser.runtime.sendMessage({
        action: "acceptSuggestion",
        suggestion: currentSuggestion,
      });
      window.close();
    } catch (e) {
      console.error("Erro ao aceitar sugestão:", e);
      showError("Falha ao criar grupo.");
    }
  });

  rejectSuggestionBtn.addEventListener("click", async () => {
    try {
      await browser.runtime.sendMessage({ action: "clearSuggestion" });
      suggestionBox.classList.add("hidden");
      currentSuggestion = null;
    } catch (e) {
      console.error("Erro ao rejeitar sugestão:", e);
    }
  });

  // CORREÇÃO: Ouve por atualizações de configurações feitas em outros locais (ex: página de opções)
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "settingsUpdated") {
      console.log("Popup a receber atualização de configurações.");
      initializePopup(); // Re-inicializa o popup para refletir as novas configurações
    }
    // NOVO: Ouve por novas sugestões enquanto o popup está aberto
    if (message.action === "suggestionUpdated") {
      console.log("Popup a receber notificação de nova sugestão.");
      updateSuggestionUI();
    }
  });
});
