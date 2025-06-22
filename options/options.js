/**
 * @file options.js
 * @description Lógica para a página de opções da extensão, com suporte para regras complexas.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Mapeamento de Elementos da UI ---
    const ui = {
        theme: document.getElementById('theme'),
        groupingMode: document.getElementById('groupingMode'),
        minTabsForAutoGroup: document.getElementById('minTabsForAutoGroup'),
        uncollapseOnActivate: document.getElementById('uncollapseOnActivate'),
        autoCollapseTimeout: document.getElementById('autoCollapseTimeout'),
        ungroupSingleTabs: document.getElementById('ungroupSingleTabs'),
        ungroupSingleTabsTimeout: document.getElementById('ungroupSingleTabsTimeout'),
        exceptionsList: document.getElementById('exceptionsList'),
        showTabCount: document.getElementById('showTabCount'),
        syncEnabled: document.getElementById('syncEnabled'),
        logLevel: document.getElementById('logLevel'),
        domainSanitizationTlds: document.getElementById('domainSanitizationTlds'),
        titleSanitizationNoise: document.getElementById('titleSanitizationNoise'),
        titleDelimiters: document.getElementById('titleDelimiters'),
        rulesList: document.getElementById('rulesList'),
        importBtn: document.getElementById('importBtn'),
        exportBtn: document.getElementById('exportBtn'),
        importFile: document.getElementById('importFile'),
        ruleModal: document.getElementById('ruleModal'),
        modalTitle: document.getElementById('modalTitle'),
        ruleForm: document.getElementById('ruleForm'),
        addRuleBtn: document.getElementById('addRuleBtn'),
        cancelRuleBtn: document.getElementById('cancelRuleBtn'),
        saveRuleBtn: document.getElementById('saveRuleBtn'),
        ruleIndex: document.getElementById('ruleIndex'),
        ruleName: document.getElementById('ruleName'),
        ruleColor: document.getElementById('ruleColor'),
        ruleMinTabs: document.getElementById('ruleMinTabs'),
        ruleOperator: document.getElementById('ruleOperator'),
        conditionsContainer: document.getElementById('conditionsContainer'),
        addConditionBtn: document.getElementById('addConditionBtn'),
        confirmModal: document.getElementById('confirmModal'),
        confirmModalText: document.getElementById('confirmModalText'),
        confirmOkBtn: document.getElementById('confirmOkBtn'),
        confirmCancelBtn: document.getElementById('confirmCancelBtn'),
        notificationContainer: document.getElementById('notification-container'),
        saveStatus: document.getElementById('saveStatus'),
        ruleTesterUrl: document.getElementById('ruleTesterUrl'),
        ruleTesterTitle: document.getElementById('ruleTesterTitle'),
        ruleTesterResult: document.getElementById('ruleTesterResult'),
    };

    let currentSettings = {};
    let sortableInstance = null;
    let confirmCallback = null;
    let saveTimeout = null;

    // --- LÓGICA DO CONSTRUTOR DE REGRAS ---

    const propertyOptions = `
        <option value="url">URL Completa</option>
        <option value="hostname">Domínio (ex: google.com)</option>
        <option value="url_path">Caminho da URL (ex: /noticias)</option>
        <option value="title">Título da Aba</option>
    `;

    const operatorOptions = {
        string: `
            <option value="contains">contém</option>
            <option value="not_contains">não contém</option>
            <option value="starts_with">começa com</option>
            <option value="ends_with">termina com</option>
            <option value="equals">é igual a</option>
            <option value="regex">corresponde à Regex</option>
        `,
    };

    function createConditionElement(condition = {}) {
    const conditionDiv = document.createElement('div');
    conditionDiv.className = 'condition-item bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-600';
    
    // Layout em grid responsivo para melhor distribuição do espaço
    conditionDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div class="md:col-span-3">
                <select class="condition-property w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600">
                    ${propertyOptions}
                </select>
            </div>
            <div class="md:col-span-3">
                <select class="condition-operator w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600">
                    ${operatorOptions.string}
                </select>
            </div>
            <div class="md:col-span-5">
                <input type="text" class="condition-value w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Digite o valor aqui...">
            </div>
            <div class="md:col-span-1 flex justify-center">
                <button type="button" class="remove-condition-btn text-red-500 hover:text-red-700 font-bold p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Preencher valores se fornecidos
    if (condition.property) conditionDiv.querySelector('.condition-property').value = condition.property;
    if (condition.operator) conditionDiv.querySelector('.condition-operator').value = condition.operator;
    if (condition.value) conditionDiv.querySelector('.condition-value').value = condition.value;

    // Event listener para remover condição
    conditionDiv.querySelector('.remove-condition-btn').addEventListener('click', () => {
        conditionDiv.remove();
    });

    return conditionDiv;
    }

    ui.addConditionBtn.addEventListener('click', () => {
        ui.conditionsContainer.appendChild(createConditionElement());
    });

    // --- FUNÇÕES DE GESTÃO DE DADOS ---

    async function loadSettings() {
        try {
            const settingsFromBg = await browser.runtime.sendMessage({ action: 'getSettings' });
            currentSettings = settingsFromBg || {};
            populateForm(currentSettings);
            updateDynamicUI();
            await testCurrentRule();
        } catch (e) {
            console.error("Erro ao carregar as configurações:", e);
            showNotification('Não foi possível carregar as configurações.', 'error');
        }
    }

    function populateForm(settings) {
        applyTheme(settings.theme || 'auto');
        ui.theme.value = settings.theme || 'auto';
        ui.groupingMode.value = settings.groupingMode;
        ui.minTabsForAutoGroup.value = settings.minTabsForAutoGroup || 2;
        ui.uncollapseOnActivate.checked = settings.uncollapseOnActivate;
        ui.autoCollapseTimeout.value = settings.autoCollapseTimeout;
        ui.ungroupSingleTabs.checked = settings.ungroupSingleTabs;
        ui.ungroupSingleTabsTimeout.value = settings.ungroupSingleTabsTimeout;
        ui.exceptionsList.value = (settings.exceptions || []).join('\n');
        ui.showTabCount.checked = settings.showTabCount;
        ui.syncEnabled.checked = settings.syncEnabled;
        ui.logLevel.value = settings.logLevel || 'INFO';
        ui.domainSanitizationTlds.value = (settings.domainSanitizationTlds || []).join('\n');
        ui.titleSanitizationNoise.value = (settings.titleSanitizationNoise || []).join('\n');
        ui.titleDelimiters.value = settings.titleDelimiters || '|–—:·»«-';
        renderRulesList();
    }

    function collectSettingsFromForm() {
        return {
            ...currentSettings,
            theme: ui.theme.value,
            groupingMode: ui.groupingMode.value,
            minTabsForAutoGroup: parseInt(ui.minTabsForAutoGroup.value, 10) || 2,
            uncollapseOnActivate: ui.uncollapseOnActivate.checked,
            autoCollapseTimeout: parseInt(ui.autoCollapseTimeout.value, 10) || 0,
            ungroupSingleTabs: ui.ungroupSingleTabs.checked,
            ungroupSingleTabsTimeout: parseInt(ui.ungroupSingleTabsTimeout.value, 10) || 10,
            exceptions: ui.exceptionsList.value.split('\n').map(e => e.trim()).filter(Boolean),
            showTabCount: ui.showTabCount.checked,
            syncEnabled: ui.syncEnabled.checked,
            logLevel: ui.logLevel.value,
            domainSanitizationTlds: ui.domainSanitizationTlds.value.split('\n').map(e => e.trim()).filter(Boolean),
            titleSanitizationNoise: ui.titleSanitizationNoise.value.split('\n').map(e => e.trim()).filter(Boolean),
            titleDelimiters: ui.titleDelimiters.value,
            customRules: currentSettings.customRules || [] 
        };
    }
    
    function scheduleSave() {
        clearTimeout(saveTimeout);
        updateSaveStatus('saving');
        
        saveTimeout = setTimeout(async () => {
            const newSettings = collectSettingsFromForm();
            try {
                await browser.runtime.sendMessage({ action: 'updateSettings', settings: newSettings });
                currentSettings = newSettings;
                updateSaveStatus('saved');
                await testCurrentRule();
            } catch (e) {
                updateSaveStatus('error');
                showNotification('Erro ao guardar as configurações.', 'error');
            }
        }, 750);
    }
    
    function updateSaveStatus(status) {
        const statusMap = { saving: ['A guardar...', 'text-yellow-500'], saved: ['Alterações guardadas.', 'text-green-500'], error: ['Erro ao guardar.', 'text-red-500'] };
        const [text, color] = statusMap[status] || ['', ''];
        ui.saveStatus.textContent = text;
        ui.saveStatus.className = `h-6 text-center font-semibold transition-colors ${color}`;
    }

    // --- FUNÇÕES DE UI E RENDERIZAÇÃO ---
    
    // CORRIGIDO: Tornar a função mais robusta para evitar erros com regras malformadas.
    function renderRulesList() {
        ui.rulesList.innerHTML = '';
        const rules = currentSettings.customRules || [];
        if (rules.length === 0) {
            ui.rulesList.innerHTML = '<p class="text-slate-500 italic text-center p-4 dark:text-slate-400">Nenhuma regra personalizada ainda.</p>';
            return;
        }

        rules.forEach((rule, index) => {
            // Verificação de segurança para a estrutura da regra
            const hasConditionGroup = rule.conditionGroup && Array.isArray(rule.conditionGroup.conditions);
            const conditions = hasConditionGroup ? rule.conditionGroup.conditions : [];
            const operator = hasConditionGroup ? rule.conditionGroup.operator : 'E';
            
            let summary = 'Regra vazia ou inválida';
            if(conditions.length > 0) {
                const firstCond = conditions[0];
                summary = `${firstCond.property} ${firstCond.operator} "${firstCond.value}"`;
                if(conditions.length > 1) {
                    summary += ` ${operator.toLowerCase()} mais ${conditions.length - 1}...`;
                }
            }
            
            const ruleElement = document.createElement('div');
            const colorMap = { grey: '#5A5A5A', blue: '#3498db', red: '#e74c3c', yellow: '#f1c40f', green: '#2ecc71', pink: '#e91e63', purple: '#9b59b6', cyan: '#1abc9c', orange: '#e67e22' };
            ruleElement.className = 'rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm dark:bg-slate-700/50';
            ruleElement.dataset.index = index;
            const tooltipTitle = hasConditionGroup 
                ? conditions.map(c => `${c.property} ${c.operator} ${c.value}`).join(` ${operator} `)
                : 'Regra em formato antigo. Edite para corrigir.';

            ruleElement.innerHTML = `<div class="flex items-center space-x-4 flex-grow min-w-0"><span class="drag-handle cursor-move p-2 text-slate-400 dark:text-slate-500">☰</span><span class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${colorMap[rule.color] || '#ccc'}"></span><div class="flex-grow min-w-0"><strong class="text-indigo-700 dark:text-indigo-400">${rule.name}</strong><p class="text-sm text-slate-600 dark:text-slate-300 truncate" title="${tooltipTitle}">${summary}</p></div></div><div class="flex space-x-1 flex-shrink-0"><button data-action="duplicate" class="text-slate-500 hover:text-blue-600 p-2 rounded-md" title="Duplicar Regra">❐</button><button data-action="edit" class="text-slate-500 hover:text-indigo-600 p-2 rounded-md" title="Editar Regra">✏️</button><button data-action="delete" class="text-slate-500 hover:text-red-600 p-2 rounded-md" title="Excluir Regra">🗑️</button></div>`;
            ui.rulesList.appendChild(ruleElement);
        });
        
        initSortable();
    }
    
    function initSortable() {
        if (sortableInstance) sortableInstance.destroy();
        if (ui.rulesList && currentSettings.customRules && currentSettings.customRules.length > 0) {
            sortableInstance = new Sortable(ui.rulesList, {
                group: 'rules-list', handle: '.drag-handle', animation: 150,
                onEnd: (evt) => {
                    const movedItem = currentSettings.customRules.splice(evt.oldIndex, 1)[0];
                    currentSettings.customRules.splice(evt.newIndex, 0, movedItem);
                    renderRulesList();
                    scheduleSave();
                }
            });
        }
    }
    
    // --- TESTADOR DE REGRAS ---

    async function testCurrentRule() {
        const url = ui.ruleTesterUrl.value.trim();
        const title = ui.ruleTesterTitle.value.trim();
        if (!url && !title) {
            ui.ruleTesterResult.innerHTML = 'Aguardando entrada...';
            return;
        }
        
        const mockTab = { url, title, id: -1, hostname: '', pathname: '' };
        try {
            const parsedUrl = new URL(url);
            mockTab.hostname = parsedUrl.hostname;
            mockTab.pathname = parsedUrl.pathname;
        } catch (e) {
            // URL inválida, mas podemos continuar testando o título
        }
        
        try {
            // Simula a lógica de evaluateRule
            const evaluateCondition = (cond) => {
                const tabProperties = { url: mockTab.url, title: mockTab.title, hostname: mockTab.hostname, url_path: mockTab.pathname };
                const propValue = String(tabProperties[cond.property] || '');
                const condValue = String(cond.value || '');
                if (condValue === '') return false;
                switch (cond.operator) {
                    case 'contains': return propValue.toLowerCase().includes(condValue.toLowerCase());
                    case 'not_contains': return !propValue.toLowerCase().includes(condValue.toLowerCase());
                    case 'starts_with': return propValue.toLowerCase().startsWith(condValue.toLowerCase());
                    case 'ends_with': return propValue.toLowerCase().endsWith(condValue.toLowerCase());
                    case 'equals': return propValue.toLowerCase() === condValue.toLowerCase();
                    case 'regex': return new RegExp(condValue, 'i').test(propValue);
                    default: return false;
                }
            };
            
            const matchingRule = (currentSettings.customRules || []).find(rule => {
                if(!rule.conditionGroup) return false;
                const {operator, conditions} = rule.conditionGroup;
                if (!conditions || conditions.length === 0) return false;
                
                if(operator === 'AND') return conditions.every(evaluateCondition);
                if(operator === 'OR') return conditions.some(evaluateCondition);
                return false;
            });

            if (matchingRule) {
                ui.ruleTesterResult.innerHTML = `Correspondeu: <strong class="text-indigo-600 dark:text-indigo-400">${matchingRule.name}</strong>`;
            } else {
                ui.ruleTesterResult.innerHTML = 'Nenhuma regra personalizada correspondeu. Usará a nomenclatura inteligente/domínio.';
            }
        } catch(e) {
            ui.ruleTesterResult.innerHTML = `<span class="text-red-500">Erro na avaliação da regra: ${e.message}</span>`;
        }
    }

    // --- MODAIS E AÇÕES ---
    
    function openModalForEdit(index) {
        const rule = currentSettings.customRules[index];
        ui.modalTitle.textContent = 'Editar Regra';
        ui.ruleIndex.value = index;
        ui.ruleName.value = rule.name;
        ui.ruleColor.value = rule.color || 'grey';
        ui.ruleMinTabs.value = rule.minTabs || 1;
        
        // Assegura que a regra a ser editada tem o formato correto
        const conditionGroup = rule.conditionGroup || { operator: 'AND', conditions: [] };
        ui.ruleOperator.value = conditionGroup.operator;

        ui.conditionsContainer.innerHTML = '';
        if (conditionGroup.conditions.length === 0) {
            ui.conditionsContainer.appendChild(createConditionElement());
        } else {
            conditionGroup.conditions.forEach(c => ui.conditionsContainer.appendChild(createConditionElement(c)));
        }
        
        ui.ruleModal.classList.remove('hidden');
    }

    function openModalForAdd() {
        ui.modalTitle.textContent = 'Adicionar Nova Regra';
        ui.ruleForm.reset();
        ui.ruleIndex.value = '';
        ui.ruleColor.value = 'grey';
        ui.ruleMinTabs.value = 1;
        ui.ruleOperator.value = 'AND';
        ui.conditionsContainer.innerHTML = '';
        ui.conditionsContainer.appendChild(createConditionElement());
        ui.ruleModal.classList.remove('hidden');
    }

    function handleRuleFormSubmit(e) {
        e.preventDefault();
        const index = ui.ruleIndex.value;
        const conditions = Array.from(ui.conditionsContainer.children).map(div => ({
            property: div.querySelector('.condition-property').value,
            operator: div.querySelector('.condition-operator').value,
            value: div.querySelector('.condition-value').value.trim()
        })).filter(c => c.value); // Filtra condições sem valor

        if (conditions.length === 0) {
            showNotification("Uma regra deve ter pelo menos uma condição válida.", 'error');
            return;
        }

        const newRule = {
            name: ui.ruleName.value.trim(),
            color: ui.ruleColor.value,
            minTabs: parseInt(ui.ruleMinTabs.value, 10) || 1,
            conditionGroup: {
                operator: ui.ruleOperator.value,
                conditions
            }
        };

        if (index !== '') {
            currentSettings.customRules[parseInt(index, 10)] = newRule;
        } else {
            currentSettings.customRules.push(newRule);
        }

        renderRulesList();
        scheduleSave();
        ui.ruleModal.classList.add('hidden');
    }
    
    function deleteRule(index) {
        const ruleName = currentSettings.customRules[index].name;
        showConfirmModal(`Tem a certeza que deseja excluir a regra "${ruleName}"?`, () => {
            currentSettings.customRules.splice(index, 1);
            renderRulesList();
            scheduleSave();
            showNotification(`Regra "${ruleName}" excluída.`, 'info');
        });
    }

    function duplicateRule(index) {
        const originalRule = currentSettings.customRules[index];
        const newRule = JSON.parse(JSON.stringify(originalRule));
        newRule.name += " (cópia)";
        currentSettings.customRules.splice(index + 1, 0, newRule);
        renderRulesList();
        scheduleSave();
        showNotification(`Regra "${originalRule.name}" duplicada.`, 'info');
    }
    
    function showConfirmModal(text, callback) {
        ui.confirmModalText.textContent = text;
        confirmCallback = callback;
        ui.confirmModal.classList.remove('hidden');
    }
    
    function showNotification(message, type = 'info') { const n = document.createElement('div'); const c = { success: 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/50 dark:border-green-600 dark:text-green-200', error: 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/50 dark:border-red-600 dark:text-red-200', info: 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/50 dark:border-blue-600 dark:text-blue-200' }; n.className = `p-4 border-l-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out opacity-0 translate-y-2 ${c[type]}`; n.textContent = message; ui.notificationContainer.appendChild(n); setTimeout(() => n.classList.remove('opacity-0', 'translate-y-2'), 10); setTimeout(() => { n.classList.add('opacity-0'); n.addEventListener('transitionend', () => n.remove()); }, 4000); }
    function applyTheme(theme) { if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); } }
    function updateDynamicUI() { ui.ungroupSingleTabsTimeout.disabled = !ui.ungroupSingleTabs.checked; ui.ungroupSingleTabsTimeout.parentElement.style.opacity = ui.ungroupSingleTabs.checked ? 1 : 0.6; }
    
    // --- INICIALIZAÇÃO E EVENT LISTENERS ---

    async function initialize() {
        await loadSettings();
        
        const autoSaveFields = ['theme', 'groupingMode', 'minTabsForAutoGroup', 'uncollapseOnActivate', 'autoCollapseTimeout', 'ungroupSingleTabs', 'ungroupSingleTabsTimeout', 'exceptionsList', 'showTabCount', 'syncEnabled', 'logLevel', 'titleDelimiters', 'domainSanitizationTlds', 'titleSanitizationNoise'];
        autoSaveFields.forEach(id => {
            const el = ui[id];
            if (!el) return;
            const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(ev, scheduleSave);
        });

        ui.theme.addEventListener('change', () => applyTheme(ui.theme.value));
        ui.ungroupSingleTabs.addEventListener('change', updateDynamicUI);
        ui.ruleTesterUrl.addEventListener('input', testCurrentRule);
        ui.ruleTesterTitle.addEventListener('input', testCurrentRule);
        
        ui.addRuleBtn.addEventListener('click', openModalForAdd);
        ui.cancelRuleBtn.addEventListener('click', () => ui.ruleModal.classList.add('hidden'));
        ui.ruleForm.addEventListener('submit', handleRuleFormSubmit);
        
        ui.rulesList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const action = button.dataset.action;
            const index = parseInt(button.closest('.rule-item').dataset.index, 10);
            if (action === 'edit') openModalForEdit(index);
            else if (action === 'delete') deleteRule(index);
            else if (action === 'duplicate') duplicateRule(index);
        });
        
        ui.importBtn.addEventListener('click', () => ui.importFile.click());
        ui.exportBtn.addEventListener('click', async () => {
            const settingsToExport = await browser.runtime.sendMessage({ action: 'getSettings' });
            const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], { type: 'application/json' });
            browser.downloads.download({ url: URL.createObjectURL(blob), filename: `auto-tab-grouper-settings-${new Date().toISOString().slice(0,10)}.json`, saveAs: true });
        });
        ui.importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const importedSettings = JSON.parse(ev.target.result);
                    if (importedSettings && typeof importedSettings === 'object') {
                        await browser.runtime.sendMessage({ action: 'updateSettings', settings: importedSettings });
                        await loadSettings();
                        showNotification('Configurações importadas com sucesso!', 'success');
                    } else {
                        showNotification('Erro: Ficheiro de configuração inválido.', 'error');
                    }
                } catch (err) {
                    showNotification('Erro ao ler o ficheiro de importação.', 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
        ui.confirmCancelBtn.addEventListener('click', () => ui.confirmModal.classList.add('hidden'));
        ui.confirmOkBtn.addEventListener('click', () => { if (typeof confirmCallback === 'function') confirmCallback(); ui.confirmModal.classList.add('hidden'); });

        // NOVO: Processa os parâmetros da URL para abrir o modal
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'new_rule') {
            openModalForAdd(); // Abre o modal
            
            // Preenche os campos a partir dos parâmetros
            if (params.has('name')) {
                ui.ruleName.value = params.get('name');
            }
            
            if (params.has('patterns')) {
                const patterns = params.get('patterns').split('\n');
                ui.conditionsContainer.innerHTML = ''; // Limpa a condição padrão
                patterns.forEach(pattern => {
                    const value = pattern.replace(/\*/g, ''); // Remove wildcards
                    ui.conditionsContainer.appendChild(createConditionElement({
                        property: 'hostname',
                        operator: 'contains',
                        value: value
                    }));
                });
                ui.ruleOperator.value = 'OR';
            }
            
            if (params.has('url')) {
                try {
                    const url = new URL(params.get('url'));
                    if (!ui.ruleName.value) {
                         ui.ruleName.value = url.hostname.replace(/^www\./, '');
                    }
                    ui.conditionsContainer.innerHTML = ''; // Limpa a condição padrão
                    ui.conditionsContainer.appendChild(createConditionElement({
                        property: 'hostname',
                        operator: 'equals',
                        value: url.hostname
                    }));
                } catch(e) { /* Ignora URLs inválidas */ }
            }
        }
    }
    
    initialize();
});