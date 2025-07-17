/**
 * @file popup.js
 * @description Lógica para o popup da barra de ferramentas da extensão.
 */

// Aplica o tema com base nas configurações guardadas
function applyTheme(theme) {
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('autoGroupingToggle');
    const optionsButton = document.getElementById('optionsButton');
    const groupAllButton = document.getElementById('groupAllButton');
    const statusDiv = document.getElementById('popup-status'); // Agora obtido do HTML

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

    /**
     * Inicializa o popup, carregando as configurações e definindo o estado da UI.
     */
    async function initializePopup(retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 500; // 500ms
        
        statusDiv.textContent = retryCount > 0 ? `A tentar reconectar... (${retryCount}/${maxRetries})` : 'A carregar...';
        statusDiv.className = 'text-xs text-center mt-2 h-4'; // Reset class
        
        try {
            const settings = await browser.runtime.sendMessage({ action: 'getSettings' });
            if (settings) {
                setPopupState(settings);
                statusDiv.textContent = ''; // Limpa a mensagem de carregamento
            } else {
                showError('Erro: Resposta inválida do script.');
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

    // Listener para o botão de ativar/desativar
    toggle.addEventListener('change', async () => {
        const originalState = !toggle.checked; // O estado antes da mudança
        const newState = toggle.checked;

        try {
            await browser.runtime.sendMessage({
                action: 'updateSettings',
                settings: { autoGroupingEnabled: newState }
            });
            browser.runtime.sendMessage({
                action: 'log',
                level: 'info',
                context: 'Popup',
                message: `Agrupamento automático ${newState ? 'ativado' : 'desativado'} pelo utilizador.`
            }).catch(() => {});
        } catch (error) {
            // CORREÇÃO: Se a gravação falhar, reverte a UI para o estado original e notifica o utilizador.
            console.error("Falha ao atualizar a configuração:", error);
            statusDiv.textContent = "Erro ao guardar.";
            statusDiv.className = 'text-xs text-center mt-2 h-4 text-red-500';
            toggle.checked = originalState; // Reverte a alteração visual
        }
    });

    // Listener para o botão de agrupar tudo
    groupAllButton.addEventListener('click', () => {
        groupAllButton.disabled = true;
        groupAllButton.innerHTML = `<div class="flex items-center justify-center space-x-2"><svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Agrupando...</span></div>`;
        
        browser.runtime.sendMessage({ action: 'log', level: 'info', context: 'Popup', message: 'Botão "Agrupar Abas Abertas" clicado.' }).catch(() => {});
        
        browser.runtime.sendMessage({ action: 'groupAllTabs' }).then(() => {
            setTimeout(() => window.close(), 500);
        }).catch(error => {
            console.error("Erro ao agrupar todas as abas:", error);
            showError("Falha ao agrupar abas.");
        });
    });

    // Listener para o botão de opções
    optionsButton.addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });

    // CORREÇÃO: Ouve por atualizações de configurações feitas em outros locais (ex: página de opções)
    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsUpdated") {
            console.log("Popup a receber atualização de configurações.");
            initializePopup(); // Re-inicializa o popup para refletir as novas configurações
        }
    });
});
