/**
 * @file options.js
 * @description Lógica para a página de opções da extensão.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Declaração de Constantes de UI ---
    const groupingModeSelect = document.getElementById('groupingMode');
    const suppressSingleTabGroupsCheckbox = document.getElementById('suppressSingleTabGroups');
    const uncollapseOnActivateCheckbox = document.getElementById('uncollapseOnActivate');
    const autoCollapseTimeoutInput = document.getElementById('autoCollapseTimeout');
    const ungroupSingleTabsCheckbox = document.getElementById('ungroupSingleTabs');
    const ungroupSingleTabsTimeoutInput = document.getElementById('ungroupSingleTabsTimeout');
    const exceptionsListTextarea = document.getElementById('exceptionsList');
    const showTabCountCheckbox = document.getElementById('showTabCount');
    const syncEnabledCheckbox = document.getElementById('syncEnabled');
    
    const rulesList = document.getElementById('rulesList');
    const saveButton = document.getElementById('saveButton');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');

    const ruleModal = document.getElementById('ruleModal');
    const modalTitle = document.getElementById('modalTitle');
    const ruleForm = document.getElementById('ruleForm');
    const addRuleBtn = document.getElementById('addRuleBtn');
    const cancelRuleBtn = document.getElementById('cancelRuleBtn');
    const ruleIndexInput = document.getElementById('ruleIndex');
    const ruleNameInput = document.getElementById('ruleName');
    const ruleTypeSelect = document.getElementById('ruleType');
    const rulePatternsTextarea = document.getElementById('rulePatterns');
    const ruleMinTabsInput = document.getElementById('ruleMinTabs');
    const ruleColorSelect = document.getElementById('ruleColor'); // Referência ao novo select

    const confirmModal = document.getElementById('confirmModal');
    const confirmModalText = document.getElementById('confirmModalText');
    const confirmOkBtn = document.getElementById('confirmOkBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const notificationContainer = document.getElementById('notification-container');

    let currentSettings = {};
    let sortableInstance = null;
    let confirmCallback = null;

    checkForUrlAction();
    loadSettings();
    
    // --- Funções de Notificação e Modal ---

    function showNotification(message, type = 'info') {
        const a_notification = document.createElement('div');
        const colors = {
            success: 'bg-green-100 border-green-500 text-green-800',
            error: 'bg-red-100 border-red-500 text-red-800',
            info: 'bg-blue-100 border-blue-500 text-blue-800',
        };
        a_notification.className = `p-4 border-l-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out opacity-0 translate-y-2 ${colors[type]}`;
        a_notification.textContent = message;
        
        notificationContainer.appendChild(a_notification);
        
        setTimeout(() => {
            a_notification.classList.remove('opacity-0', 'translate-y-2');
        }, 10);

        setTimeout(() => {
            a_notification.classList.add('opacity-0');
            a_notification.addEventListener('transitionend', () => a_notification.remove());
        }, 4000);
    }

    function showConfirmModal(text, onConfirm) {
        confirmModalText.textContent = text;
        confirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
    }

    function hideConfirmModal() {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    }


    // --- Funções Principais ---

    async function loadSettings() {
        try {
            const settingsFromBg = await browser.runtime.sendMessage({ action: 'getSettings' });
            currentSettings = settingsFromBg || {};
            
            groupingModeSelect.value = currentSettings.groupingMode;
            suppressSingleTabGroupsCheckbox.checked = currentSettings.suppressSingleTabGroups;
            uncollapseOnActivateCheckbox.checked = currentSettings.uncollapseOnActivate;
            autoCollapseTimeoutInput.value = currentSettings.autoCollapseTimeout;
            ungroupSingleTabsCheckbox.checked = currentSettings.ungroupSingleTabs;
            ungroupSingleTabsTimeoutInput.value = currentSettings.ungroupSingleTabsTimeout;
            exceptionsListTextarea.value = (currentSettings.exceptions || []).join('\n');
            showTabCountCheckbox.checked = currentSettings.showTabCount;
            syncEnabledCheckbox.checked = currentSettings.syncEnabled;
            
            renderRules();
        } catch (e) {
            console.error("Erro ao carregar as configurações:", e);
            showNotification('Não foi possível carregar as configurações.', 'error');
        }
    }

    function saveAllSettings() {
        const exceptions = exceptionsListTextarea.value.split('\n').map(e => e.trim()).filter(Boolean);
        
        const newSettings = {
            ...currentSettings, 
            groupingMode: groupingModeSelect.value,
            suppressSingleTabGroups: suppressSingleTabGroupsCheckbox.checked,
            uncollapseOnActivate: uncollapseOnActivateCheckbox.checked,
            autoCollapseTimeout: parseInt(autoCollapseTimeoutInput.value, 10) || 0,
            ungroupSingleTabs: ungroupSingleTabsCheckbox.checked,
            ungroupSingleTabsTimeout: parseInt(ungroupSingleTabsTimeoutInput.value, 10) || 10,
            exceptions: exceptions,
            showTabCount: showTabCountCheckbox.checked,
            syncEnabled: syncEnabledCheckbox.checked,
        };
        
        browser.runtime.sendMessage({ action: 'updateSettings', settings: newSettings }).then(() => {
            currentSettings = newSettings;
            showNotification('Configurações salvas com sucesso!', 'success');
        }).catch(e => {
            console.error("Falha ao enviar mensagem de atualização:", e);
            showNotification('Erro ao salvar as configurações.', 'error');
        });
    }
    
    function renderRules() {
        rulesList.innerHTML = '';
        if (!currentSettings.customRules || currentSettings.customRules.length === 0) {
            rulesList.innerHTML = '<p class="text-slate-500 italic text-center p-4">Nenhuma regra personalizada ainda.</p>';
        } else {
            currentSettings.customRules.forEach((rule, index) => {
                const patterns = rule.patterns || [];
                const displayPattern = patterns.length > 1 ? `${patterns[0]} (e mais ${patterns.length - 1})` : patterns[0] || 'Nenhum padrão';
                const ruleElement = document.createElement('div');
                // Pequena correção para usar a cor do nome no span de visualização
                const colorMap = { grey: '#5A5A5A', blue: '#3498db', red: '#e74c3c', yellow: '#f1c40f', green: '#2ecc71', pink: '#e91e63', purple: '#9b59b6', cyan: '#1abc9c', orange: '#e67e22' };
                const displayColor = colorMap[rule.color] || '#ccc';

                ruleElement.className = 'rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm';
                ruleElement.innerHTML = `
                    <div class="flex items-center space-x-4 flex-grow min-w-0">
                        <span class="drag-handle cursor-move p-2 text-slate-400">&#x2630;</span>
                        <span class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${displayColor}"></span>
                        <div class="flex-grow min-w-0">
                            <strong class="text-indigo-700">${rule.name}</strong>
                            <p class="text-sm text-slate-600 truncate" title="${patterns.join('\n')}">${displayPattern} <span class="text-xs bg-slate-200 text-slate-500 p-1 rounded">${rule.type}</span></p>
                        </div>
                    </div>
                    <div class="flex space-x-1 flex-shrink-0">
                        <button data-index="${index}" class="duplicate-rule-btn text-slate-500 hover:text-blue-600 p-2 rounded-md" title="Duplicar Regra">❐</button>
                        <button data-index="${index}" class="edit-rule-btn text-slate-500 hover:text-indigo-600 p-2 rounded-md" title="Editar Regra">✏️</button>
                        <button data-index="${index}" class="delete-rule-btn text-slate-500 hover:text-red-600 p-2 rounded-md" title="Excluir Regra">🗑️</button>
                    </div>
                `;
                rulesList.appendChild(ruleElement);
            });
        }
        
        initSortable();
    }
    
    function initSortable() {
        if (sortableInstance) sortableInstance.destroy();
        const rulesListEl = document.getElementById('rulesList');
        if (rulesListEl && currentSettings.customRules && currentSettings.customRules.length > 0) {
            try {
                sortableInstance = new Sortable(rulesListEl, {
                    group: 'rules-list', 
                    handle: '.drag-handle',
                    animation: 150,
                    onEnd: (evt) => {
                        const movedItem = currentSettings.customRules.splice(evt.oldIndex, 1)[0];
                        currentSettings.customRules.splice(evt.newIndex, 0, movedItem);
                        saveAllSettings();
                        renderRules();
                    }
                });
            } catch (e) {
                console.error("Falha ao inicializar o Sortable.js:", e);
            }
        }
    }

    function checkForUrlAction() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'new_rule') {
            openModalForAdd();
            
            ruleNameInput.value = decodeURIComponent(params.get('name') || '');
            rulePatternsTextarea.value = decodeURIComponent(params.get('patterns') || '');

            const url = decodeURIComponent(params.get('url') || '');
            const title = decodeURIComponent(params.get('title') || '');
            if (url && title) {
                const titleParts = title.split(/\||–|-/);
                const cleanTitle = titleParts[0].trim();
                ruleNameInput.value = cleanTitle.length > 0 ? cleanTitle : 'Novo Grupo';
                try {
                    const hostname = new URL(url).hostname;
                    rulePatternsTextarea.value = `*${hostname}*`;
                    ruleTypeSelect.value = 'url-wildcard';
                } catch(e) {}
            }
        }
    }
    
    function openModalForEdit(e) {
        const index = e.currentTarget.dataset.index;
        modalTitle.textContent = 'Editar Regra';
        const rule = currentSettings.customRules[index];
        ruleIndexInput.value = index;
        ruleNameInput.value = rule.name;
        ruleTypeSelect.value = rule.type;
        rulePatternsTextarea.value = (rule.patterns || []).join('\n');
        ruleMinTabsInput.value = rule.minTabs || 1;
        ruleColorSelect.value = rule.color || 'grey';
        ruleModal.classList.remove('hidden');
    }

    function openModalForAdd() {
        modalTitle.textContent = 'Adicionar Nova Regra';
        ruleForm.reset();
        ruleIndexInput.value = '';
        ruleMinTabsInput.value = 1;
        ruleColorSelect.value = 'grey'; // CORRIGIDO: O valor padrão agora é um nome de cor válido.
        ruleModal.classList.remove('hidden');
    }
    
    function closeModal() {
        ruleModal.classList.add('hidden');
        if (window.history.replaceState) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: cleanUrl}, '', cleanUrl);
        }
    }

    function handleRuleFormSubmit(e) {
        e.preventDefault();
        const rule = {
            name: ruleNameInput.value.trim(),
            type: ruleTypeSelect.value,
            patterns: rulePatternsTextarea.value.split('\n').map(p => p.trim()).filter(Boolean),
            color: ruleColorSelect.value, // CORRIGIDO: Pega o valor do <select>
            minTabs: parseInt(ruleMinTabsInput.value, 10) || 1,
        };
        const index = ruleIndexInput.value;

        if (index !== '') {
            currentSettings.customRules[index] = rule;
        } else {
            if (!currentSettings.customRules) currentSettings.customRules = [];
            currentSettings.customRules.push(rule);
        }
        
        closeModal();
        saveAllSettings();
        renderRules();
    }
    
    function deleteRule(e) {
        const index = e.currentTarget.dataset.index;
        const ruleName = currentSettings.customRules[index].name;
        
        showConfirmModal(`Tem a certeza que deseja excluir a regra "${ruleName}"?`, () => {
            currentSettings.customRules.splice(index, 1);
            saveAllSettings();
            renderRules();
            showNotification(`Regra "${ruleName}" excluída.`, 'info');
        });
    }
    
    // --- Event Listeners ---
    rulesList.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('edit-rule-btn')) {
            openModalForEdit({ currentTarget: target });
        } else if (target.classList.contains('delete-rule-btn')) {
            deleteRule({ currentTarget: target });
        } else if (target.classList.contains('duplicate-rule-btn')) {
            const index = parseInt(target.dataset.index, 10);
            const originalRule = currentSettings.customRules[index];
            const newRule = JSON.parse(JSON.stringify(originalRule));
            newRule.name += " (cópia)";
            currentSettings.customRules.splice(index + 1, 0, newRule);
            saveAllSettings();
            renderRules();
        }
    });

    saveButton.addEventListener('click', saveAllSettings);
    addRuleBtn.addEventListener('click', openModalForAdd);
    cancelRuleBtn.addEventListener('click', closeModal);
    ruleForm.addEventListener('submit', handleRuleFormSubmit);
    
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedSettings = JSON.parse(e.target.result);
                if (importedSettings && typeof importedSettings === 'object' && 'customRules' in importedSettings) {
                    await browser.runtime.sendMessage({ action: 'updateSettings', settings: importedSettings });
                    showNotification('Configurações importadas com sucesso!', 'success');
                    loadSettings();
                } else {
                    showNotification('Erro: Ficheiro de configuração inválido.', 'error');
                }
            } catch (err) { 
                showNotification('Erro ao ler o ficheiro de importação.', 'error');
            }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    exportBtn.addEventListener('click', async () => {
        const settingsToExport = await browser.runtime.sendMessage({ action: 'getSettings' });
        const jsonString = JSON.stringify(settingsToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        browser.downloads.download({
            url: URL.createObjectURL(blob),
            filename: `auto-tab-grouper-settings-${new Date().toISOString().slice(0,10)}.json`,
            saveAs: true
        });
    });

    ruleModal.addEventListener('click', (e) => {
        if (e.target === ruleModal) closeModal();
    });

    confirmCancelBtn.addEventListener('click', hideConfirmModal);
    confirmOkBtn.addEventListener('click', () => {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
        }
        hideConfirmModal();
    });

    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsUpdated") {
            loadSettings();
        }
    });
});
