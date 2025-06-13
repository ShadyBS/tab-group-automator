/**
 * @file options.js
 * @description Lógica para a página de opções da extensão.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Declaração de Constantes ---
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
    const saveNotification = document.getElementById('saveNotification');

    const ruleModal = document.getElementById('ruleModal');
    const modalTitle = document.getElementById('modalTitle');
    const ruleForm = document.getElementById('ruleForm');
    const addRuleBtn = document.getElementById('addRuleBtn');
    const cancelRuleBtn = document.getElementById('cancelRuleBtn');
    const ruleIndexInput = document.getElementById('ruleIndex');
    const ruleNameInput = document.getElementById('ruleName');
    const ruleTypeSelect = document.getElementById('ruleType');
    const rulePatternsTextarea = document.getElementById('rulePatterns');
    const saveRuleBtn = document.getElementById('saveRuleBtn');

    const ruleTesterInput = document.getElementById('ruleTesterInput');
    const ruleTesterResult = document.getElementById('ruleTesterResult');

    let currentSettings = {};
    let sortableInstance = null;

    // **CORREÇÃO ESTRUTURAL**: Executa a ação da URL imediatamente ao carregar.
    // Isto garante que o modal abre mesmo que a inicialização do Sortable falhe.
    checkForUrlAction();
    
    // Carrega o resto das configurações e da interface.
    loadSettings();
    
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
            document.body.innerHTML = '<p class="text-red-500 p-8 text-center">Ocorreu um erro crítico ao carregar as configurações. Por favor, recarregue a extensão e tente novamente.</p>';
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
            saveNotification.classList.remove('opacity-0');
            setTimeout(() => { saveNotification.classList.add('opacity-0'); }, 2500);
        }).catch(e => console.error("Falha ao enviar mensagem de atualização:", e));
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
                ruleElement.className = 'rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm';
                ruleElement.innerHTML = `
                    <div class="flex items-center space-x-4 flex-grow min-w-0">
                        <span class="drag-handle cursor-move p-2 text-slate-400">&#x2630;</span>
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
        }
        
        document.querySelectorAll('.edit-rule-btn').forEach(btn => btn.addEventListener('click', openModalForEdit));
        document.querySelectorAll('.delete-rule-btn').forEach(btn => btn.addEventListener('click', deleteRule));
        
        initSortable();
    }
    
    function initSortable() {
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }

        const rulesListEl = document.getElementById('rulesList');
        if (rulesListEl && currentSettings.customRules && currentSettings.customRules.length > 0) {
            try {
                // **CORREÇÃO**: A opção `group` deve ser um objeto com uma propriedade `name`.
                sortableInstance = new Sortable(rulesListEl, {
                    group: { name: 'rules-list' }, 
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
                console.error("Falha ao inicializar o Sortable.js. A funcionalidade de reordenar estará desativada.", e);
            }
        }
    }

    function checkForUrlAction() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'new_rule') {
            openModalForAdd();
            
            ruleNameInput.value = params.get('name') || '';
            rulePatternsTextarea.value = params.get('patterns') || '';

            const url = params.get('url');
            const title = params.get('title');
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
    
    async function testRule() {
        const urlToTest = ruleTesterInput.value.trim();
        if (!urlToTest) {
            ruleTesterResult.textContent = 'Aguardando URL...';
            return;
        }

        try {
            const { getFinalGroupName } = await import('../grouping-logic.js');
            new URL(urlToTest);
            const mockTab = { url: urlToTest, title: 'Aba de Teste', id: -1 };
            const groupName = await getFinalGroupName(mockTab);
            
            if (groupName) {
                ruleTesterResult.innerHTML = `Corresponderia ao grupo: <strong class="text-indigo-700">${groupName}</strong>`;
            } else {
                ruleTesterResult.textContent = 'Este URL não seria agrupado.';
            }

        } catch (e) {
            console.error("Erro no testador de regras:", e);
            ruleTesterResult.textContent = 'URL inválido ou erro ao testar.';
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
            color: document.getElementById('ruleColor').value,
        };
        const index = ruleIndexInput.value;

        if (index !== '') {
            currentSettings.customRules[index] = rule;
        } else {
            if (!currentSettings.customRules) currentSettings.customRules = [];
            currentSettings.customRules.push(rule);
        }
        
        closeModal();
        renderRules();
        saveAllSettings();
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
    
    // --- Event Listeners ---
    saveButton.addEventListener('click', saveAllSettings);
    addRuleBtn.addEventListener('click', openModalForAdd);
    cancelRuleBtn.addEventListener('click', closeModal);
    ruleForm.addEventListener('submit', handleRuleFormSubmit);
    ruleTesterInput.addEventListener('input', testRule);
    
    ruleModal.addEventListener('click', (e) => {
        if (e.target === ruleModal) closeModal();
    });

    browser.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsUpdated") {
            loadSettings();
        }
    });
});
