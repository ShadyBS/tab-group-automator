/**
 * @file popup.js
 * @description Lógica para o popup da barra de ferramentas da extensão.
 */

// --- LÓGICA DE TEMA ---
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

    const statusDiv = document.createElement('div');
    statusDiv.id = 'popup-status';
    statusDiv.className = 'text-xs text-center mt-2';
    document.body.appendChild(statusDiv);

    async function initializePopup() {
        statusDiv.textContent = 'Carregando...';
        try {
            const settings = await browser.runtime.sendMessage({ action: 'getSettings' });
            if (settings) {
                // Aplica o tema assim que as configurações são carregadas
                applyTheme(settings.theme || 'auto');
                
                toggle.checked = settings.autoGroupingEnabled;
                toggle.disabled = false;
                groupAllButton.disabled = false;
                statusDiv.textContent = '';
            } else {
                statusDiv.textContent = 'Erro: Resposta inválida.';
                toggle.disabled = true;
                groupAllButton.disabled = true;
            }
        } catch (error) {
            toggle.disabled = true;
            groupAllButton.disabled = true;
            statusDiv.textContent = "Erro de comunicação. Recarregue a extensão.";
            statusDiv.className += ' text-red-500 font-bold';
        }
    }

    initializePopup();

    toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        browser.runtime.sendMessage({
            action: 'updateSettings',
            settings: { autoGroupingEnabled: enabled }
        });
        browser.runtime.sendMessage({
            action: 'log',
            level: 'info',
            context: 'Popup',
            message: `Agrupamento automático ${enabled ? 'ativado' : 'desativado'} pelo utilizador.`
        }).catch(() => {});
    });

    groupAllButton.addEventListener('click', () => {
        groupAllButton.disabled = true;
        groupAllButton.innerHTML = `<div class="flex items-center justify-center space-x-2"><svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Agrupando...</span></div>`;
        
        browser.runtime.sendMessage({ action: 'log', level: 'info', context: 'Popup', message: 'Botão "Agrupar Abas Abertas" clicado.' }).catch(() => {});
        
        browser.runtime.sendMessage({ action: 'groupAllTabs' }).then(() => {
            setTimeout(() => window.close(), 500);
        });
    });

    optionsButton.addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });
});
