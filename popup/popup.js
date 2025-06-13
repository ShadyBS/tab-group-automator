/**
 * @file popup.js
 * @description Lógica para o popup da barra de ferramentas da extensão.
 */

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('autoGroupingToggle');
    const optionsButton = document.getElementById('optionsButton');
    const groupAllButton = document.getElementById('groupAllButton');

    // Cria um elemento de status para feedback claro na UI
    const statusDiv = document.createElement('div');
    statusDiv.id = 'popup-status';
    statusDiv.className = 'text-xs text-center mt-2';
    document.body.appendChild(statusDiv);

    // Função principal para inicializar o estado do popup.
    async function initializePopup() {
        console.log("Popup: Tentando inicializar...");
        statusDiv.textContent = 'Carregando...';
        
        try {
            // 1. Pede ao script de fundo a configuração atual.
            const settings = await browser.runtime.sendMessage({ action: 'getSettings' });

            // 2. Se as configurações forem recebidas e válidas, atualiza a interface.
            if (settings && typeof settings.autoGroupingEnabled !== 'undefined') {
                console.log("Popup: Configurações recebidas com sucesso:", settings);
                toggle.checked = settings.autoGroupingEnabled;
                toggle.disabled = false;
                groupAllButton.disabled = false;
                statusDiv.textContent = ''; // Limpa o status em caso de sucesso
            } else {
                console.warn("Popup: Resposta do script de fundo vazia ou malformada.", settings);
                statusDiv.textContent = 'Erro: Resposta inválida.';
                toggle.disabled = true;
                groupAllButton.disabled = true;
            }
        } catch (error) {
            console.error("Popup: ERRO CRÍTICO ao enviar mensagem para o script de fundo. A extensão pode precisar ser recarregada.", error);
            // Desabilita a interface para indicar um problema de comunicação.
            toggle.disabled = true;
            groupAllButton.disabled = true;
            statusDiv.textContent = "Erro de comunicação. Recarregue a extensão.";
            statusDiv.className += ' text-red-500 font-bold';
        }
    }

    // Chama a função de inicialização.
    initializePopup();

    // Listener para quando o usuário clica no toggle.
    toggle.addEventListener('change', () => {
        // Envia a mudança para o script de fundo salvar.
        browser.runtime.sendMessage({
            action: 'updateSettings',
            settings: { autoGroupingEnabled: toggle.checked }
        });
    });

    // Listeners para os outros botões.
    groupAllButton.addEventListener('click', () => {
        groupAllButton.disabled = true;
        groupAllButton.innerHTML = `<div class="flex items-center justify-center space-x-2"><svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Agrupando...</span></div>`;
        browser.runtime.sendMessage({ action: 'groupAllTabs' }).then(() => {
            setTimeout(() => window.close(), 500);
        });
    });

    optionsButton.addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });
});
