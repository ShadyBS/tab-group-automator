/**
 * @file options.js
 * @description Lógica para a página de opções da extensão.
 */

document.addEventListener('DOMContentLoaded', () => {
    const groupingModeSelect = document.getElementById('groupingMode');
    const suppressSingleTabGroupsCheckbox = document.getElementById('suppressSingleTabGroups');
    const uncollapseOnActivateCheckbox = document.getElementById('uncollapseOnActivate');
    const autoCollapseTimeoutInput = document.getElementById('autoCollapseTimeout');
    const ungroupSingleTabsCheckbox = document.getElementById('ungroupSingleTabs');
    const ungroupSingleTabsTimeoutInput = document.getElementById('ungroupSingleTabsTimeout');
    const exceptionsListTextarea = document.getElementById('exceptionsList');
    
    const rulesList = document.getElementById('rulesList');
    const saveButton = document.getElementById('saveButton');
    const saveNotification = document.getElementById('saveNotification');

    const ruleModal = document.getElementById('ruleModal');
    const modalTitle = document.getElementById('modalTitle');
    const ruleForm = document.getElementById('ruleForm');
    const addRuleBtn = document.getElementById('addRuleBtn');
    const cancelRuleBtn = document.getElementById('cancelRuleBtn');
    const ruleIndexInput = document.getElementById('ruleIndex');
    const rulePatternsTextarea = document.getElementById('rulePatterns');
    const saveRuleBtn = document.getElementById('saveRuleBtn');
    const ruleNameInput = document.getElementById('ruleName');
    const ruleTypeSelect = document.getElementById('ruleType');

    let currentSettings = {};

    async function loadSettings() {
        try {
            const data = await browser.storage.local.get('settings');
            const defaults = {
                groupingMode: 'smart',
                suppressSingleTabGroups: true,
                uncollapseOnActivate: true,
                autoCollapseTimeout: 0,
                ungroupSingleTabs: false,
                ungroupSingleTabsTimeout: 10,
                customRules: [],
                exceptions: [],
                autoGroupingEnabled: true
            };
            currentSettings = { ...defaults, ...(data.settings || {}) };
            
            groupingModeSelect.value = currentSettings.groupingMode;
            suppressSingleTabGroupsCheckbox.checked = currentSettings.suppressSingleTabGroups;
            uncollapseOnActivateCheckbox.checked = currentSettings.uncollapseOnActivate;
            autoCollapseTimeoutInput.value = currentSettings.autoCollapseTimeout;
            ungroupSingleTabsCheckbox.checked = currentSettings.ungroupSingleTabs;
            ungroupSingleTabsTimeoutInput.value = currentSettings.ungroupSingleTabsTimeout;
            exceptionsListTextarea.value = (currentSettings.exceptions || []).join('\n');
            
            renderRules();
            
            // **NOVA LÓGICA**: Verifica se a página foi aberta com uma ação do menu de contexto
            checkForUrlAction();

        } catch (e) { console.error("Erro ao carregar configurações:", e); }
    }
    
    function checkForUrlAction() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');

        if (action === 'new_rule') {
            const url = params.get('url');
            const title = params.get('title');
            
            openModalForAdd(); // Abre o modal para adicionar uma nova regra
            
            // Preenche o formulário com as informações da aba
            if (title) {
                // Tenta extrair um nome mais limpo do título
                 const titleParts = title.split(/\||–|-/);
                 const cleanTitle = titleParts[0].trim();
                 ruleNameInput.value = cleanTitle.length > 0 ? cleanTitle : 'Novo Grupo';
            }
            if (url) {
                try {
                    const hostname = new URL(url).hostname;
                    rulePatternsTextarea.value = `*${hostname}*`;
                    ruleTypeSelect.value = 'url-wildcard';
                } catch(e) {
                    rulePatternsTextarea.value = url;
                    ruleTypeSelect.value = 'url-wildcard';
                }
            }
        }
    }


    function saveAllSettings() {
        const exceptions = exceptionsListTextarea.value.split('\n').map(e => e.trim()).filter(e => e);
        
        const newSettings = {
            ...currentSettings, 
            groupingMode: groupingModeSelect.value,
            suppressSingleTabGroups: suppressSingleTabGroupsCheckbox.checked,
            uncollapseOnActivate: uncollapseOnActivateCheckbox.checked,
            autoCollapseTimeout: parseInt(autoCollapseTimeoutInput.value, 10) || 0,
            ungroupSingleTabs: ungroupSingleTabsCheckbox.checked,
            ungroupSingleTabsTimeout: parseInt(ungroupSingleTabsTimeoutInput.value, 10) || 10,
            exceptions: exceptions
            // customRules é salvo através do modal
        };
        
        browser.runtime.sendMessage({ action: 'updateSettings', settings: newSettings }).then(() => {
            currentSettings = newSettings;
            saveNotification.classList.remove('opacity-0');
            setTimeout(() => { saveNotification.classList.add('opacity-0'); }, 2500);
        }).catch(e => console.error("Falha ao enviar mensagem de atualização:", e));
    }
    
    function renderRules() {
        rulesList.innerHTML = '';
        if (!currentSettings.customRules || currentSettings.customRules.length === 0) {
            rulesList.innerHTML = '<p class="text-slate-500 italic text-center p-4">Nenhuma regra personalizada ainda.</p>';
            return;
        }

        currentSettings.customRules.forEach((rule, index) => {
            const patterns = rule.patterns || [];
            const displayPattern = patterns.length > 1 ? `${patterns[0]} (e mais ${patterns.length - 1})` : patterns[0] || 'Nenhum padrão';
            const ruleElement = document.createElement('div');
            ruleElement.className = 'rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm';
            ruleElement.innerHTML = `
                <div class="flex items-center space-x-4 flex-grow min-w-0">
                    <span class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${rule.color || '#ccc'}"></span>
                    <div class="flex-grow min-w-0">
                        <strong class="text-indigo-700">${rule.name}</strong>
                        <p class="text-sm text-slate-600 truncate" title="${patterns.join('\n')}">${displayPattern} <span class="text-xs bg-slate-200 text-slate-500 p-1 rounded">${rule.type}</span></p>
                    </div>
                </div>
                <div class="flex space-x-2 flex-shrink-0">
                    <button data-index="${index}" class="edit-rule-btn text-slate-500 hover:text-indigo-600 font-bold p-2 rounded-md">Editar</button>
                    <button data-index="${index}" class="delete-rule-btn text-slate-500 hover:text-red-600 font-bold p-2 rounded-md">Excluir</button>
                </div>
            `;
            rulesList.appendChild(ruleElement);
        });

        document.querySelectorAll('.edit-rule-btn').forEach(btn => btn.addEventListener('click', openModalForEdit));
        document.querySelectorAll('.delete-rule-btn').forEach(btn => btn.addEventListener('click', deleteRule));
    }

    function openModalForEdit(e) {
        const index = e.currentTarget.dataset.index;
        modalTitle.textContent = 'Editar Regra';
        const rule = currentSettings.customRules[index];
        ruleIndexInput.value = index;
        ruleNameInput.value = rule.name;
        ruleTypeSelect.value = rule.type;
        rulePatternsTextarea.value = (rule.patterns || []).join('\n');
        document.getElementById('ruleColor').value = rule.color || '#cccccc';
        ruleModal.classList.remove('hidden');
    }

    function openModalForAdd() {
        modalTitle.textContent = 'Adicionar Nova Regra';
        ruleForm.reset();
        ruleIndexInput.value = '';
        rulePatternsTextarea.value = '';
        document.getElementById('ruleColor').value = '#cccccc';
        ruleModal.classList.remove('hidden');
    }
    
    function closeModal() {
        ruleModal.classList.add('hidden');
        // Limpa os parâmetros da URL para evitar que o modal reabra ao recarregar a página
        if (window.history.replaceState) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: cleanUrl}, '', cleanUrl);
        }
    }

    function handleRuleFormSubmit(e) {
        e.preventDefault();
        saveRuleBtn.disabled = true;
        saveRuleBtn.textContent = 'A guardar...';
        const rule = {
            name: ruleNameInput.value.trim(),
            type: ruleTypeSelect.value,
            patterns: rulePatternsTextarea.value.split('\n').map(p => p.trim()).filter(p => p),
            color: document.getElementById('ruleColor').value,
        };
        const index = ruleIndexInput.value;

        if (index !== '') {
            currentSettings.customRules[index] = rule;
        } else {
            if (!currentSettings.customRules) currentSettings.customRules = [];
            currentSettings.customRules.push(rule);
        }
        
        // Salva as regras e o resto das configurações
        saveAllSettings();

        setTimeout(() => {
            closeModal();
            renderRules();
            saveRuleBtn.disabled = false;
            saveRuleBtn.textContent = 'Guardar Regra';
        }, 200);
    }
    
    function deleteRule(e) {
        const index = e.currentTarget.dataset.index;
        const ruleName = currentSettings.customRules[index].name;
        if (confirm(`Tem a certeza que deseja excluir a regra "${ruleName}"?`)) {
            currentSettings.customRules.splice(index, 1);
            renderRules();
            saveAllSettings();
        }
    }

    saveButton.addEventListener('click', saveAllSettings);
    addRuleBtn.addEventListener('click', openModalForAdd);
    cancelRuleBtn.addEventListener('click', closeModal);
    ruleForm.addEventListener('submit', handleRuleFormSubmit);
    
    ruleModal.addEventListener('click', (e) => {
        if (e.target === ruleModal) closeModal();
    });

    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsUpdated") {
            loadSettings();
        }
    });

    loadSettings();
});
