/**
 * @file options.js
 * @description Lógica para a página de opções da extensão, com gravação automática e UI dinâmica.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Mapeamento de Elementos da UI ---
    const ui = {
        theme: document.getElementById('theme'),
        groupingMode: document.getElementById('groupingMode'),
        suppressSingleTabGroups: document.getElementById('suppressSingleTabGroups'),
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
        rulesList: document.getElementById('rulesList'),
        importBtn: document.getElementById('importBtn'),
        exportBtn: document.getElementById('exportBtn'),
        importFile: document.getElementById('importFile'),
        ruleModal: document.getElementById('ruleModal'),
        modalTitle: document.getElementById('modalTitle'),
        ruleForm: document.getElementById('ruleForm'),
        addRuleBtn: document.getElementById('addRuleBtn'),
        cancelRuleBtn: document.getElementById('cancelRuleBtn'),
        ruleIndex: document.getElementById('ruleIndex'),
        ruleName: document.getElementById('ruleName'),
        ruleType: document.getElementById('ruleType'),
        rulePatterns: document.getElementById('rulePatterns'),
        ruleMinTabs: document.getElementById('ruleMinTabs'),
        ruleColor: document.getElementById('ruleColor'),
        confirmModal: document.getElementById('confirmModal'),
        confirmModalText: document.getElementById('confirmModalText'),
        confirmOkBtn: document.getElementById('confirmOkBtn'),
        confirmCancelBtn: document.getElementById('confirmCancelBtn'),
        notificationContainer: document.getElementById('notification-container'),
        saveStatus: document.getElementById('saveStatus'),
        ruleTesterInput: document.getElementById('ruleTesterInput'),
        ruleTesterResult: document.getElementById('ruleTesterResult'),
    };

    // --- Variáveis de Estado ---
    let currentSettings = {};
    let sortableInstance = null;
    let confirmCallback = null;
    let saveTimeout = null;

    // --- GESTÃO DE DADOS E CONFIGURAÇÕES ---

    async function loadSettings() {
        try {
            const settingsFromBg = await browser.runtime.sendMessage({ action: 'getSettings' });
            currentSettings = settingsFromBg || {};
            populateForm(currentSettings);
            applyTheme(currentSettings.theme);
            updateDynamicUI();
            testCurrentRule();
        } catch (e) {
            console.error("Erro ao carregar as configurações:", e);
            showNotification('Não foi possível carregar as configurações.', 'error');
        }
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
            } catch (e) {
                console.error("Falha ao enviar mensagem de atualização:", e);
                updateSaveStatus('error');
                showNotification('Erro ao guardar as configurações.', 'error');
            }
        }, 750);
    }
    
    function collectSettingsFromForm() {
        return {
            ...currentSettings,
            theme: ui.theme.value,
            groupingMode: ui.groupingMode.value,
            suppressSingleTabGroups: ui.suppressSingleTabGroups.checked,
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
            customRules: currentSettings.customRules || [] // Preserva as regras
        };
    }

    // --- RENDERIZAÇÃO E ATUALIZAÇÃO DA UI ---

    function populateForm(settings) {
        ui.theme.value = settings.theme || 'auto';
        ui.groupingMode.value = settings.groupingMode;
        ui.suppressSingleTabGroups.checked = settings.suppressSingleTabGroups;
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
        renderRules();
    }

    function applyTheme(theme) {
        if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    function updateDynamicUI() {
        ui.ungroupSingleTabsTimeout.disabled = !ui.ungroupSingleTabs.checked;
        ui.ungroupSingleTabsTimeout.parentElement.style.opacity = ui.ungroupSingleTabs.checked ? 1 : 0.6;
    }

    function renderRules() {
        ui.rulesList.innerHTML = '';
        const rules = currentSettings.customRules || [];
        if (rules.length === 0) {
            ui.rulesList.innerHTML = '<p class="text-slate-500 italic text-center p-4 dark:text-slate-400">Nenhuma regra personalizada ainda.</p>';
        } else {
            rules.forEach((rule, index) => {
                const patterns = rule.patterns || [];
                const displayPattern = patterns.length > 1 ? `${patterns[0]} (e mais ${patterns.length - 1})` : patterns[0] || 'Nenhum padrão';
                const ruleElement = document.createElement('div');
                const colorMap = { grey: '#5A5A5A', blue: '#3498db', red: '#e74c3c', yellow: '#f1c40f', green: '#2ecc71', pink: '#e91e63', purple: '#9b59b6', cyan: '#1abc9c', orange: '#e67e22' };
                ruleElement.className = 'rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm dark:bg-slate-700/50';
                ruleElement.innerHTML = `
                    <div class="flex items-center space-x-4 flex-grow min-w-0">
                        <span class="drag-handle cursor-move p-2 text-slate-400 dark:text-slate-500">&#x2630;</span>
                        <span class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${colorMap[rule.color] || '#ccc'}"></span>
                        <div class="flex-grow min-w-0">
                            <strong class="text-indigo-700 dark:text-indigo-400">${rule.name}</strong>
                            <p class="text-sm text-slate-600 dark:text-slate-300 truncate" title="${patterns.join('\n')}">${displayPattern} <span class="text-xs bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-400 p-1 rounded">${rule.type}</span></p>
                        </div>
                    </div>
                    <div class="flex space-x-1 flex-shrink-0">
                        <button data-index="${index}" class="duplicate-rule-btn text-slate-500 hover:text-blue-600 p-2 rounded-md dark:text-slate-400 dark:hover:text-blue-400" title="Duplicar Regra">❐</button>
                        <button data-index="${index}" class="edit-rule-btn text-slate-500 hover:text-indigo-600 p-2 rounded-md dark:text-slate-400 dark:hover:text-indigo-400" title="Editar Regra">✏️</button>
                        <button data-index="${index}" class="delete-rule-btn text-slate-500 hover:text-red-600 p-2 rounded-md dark:text-slate-400 dark:hover:text-red-400" title="Excluir Regra">🗑️</button>
                    </div>
                `;
                ui.rulesList.appendChild(ruleElement);
            });
        }
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
                    scheduleSave();
                    renderRules();
                }
            });
        }
    }

    function testCurrentRule() {
        const url = ui.ruleTesterInput.value.trim();
        if (!url) {
            ui.ruleTesterResult.innerHTML = 'Aguardando URL...';
            return;
        }
        const rules = currentSettings.customRules || [];
        for (const rule of rules) {
            for (const pattern of rule.patterns || []) {
                try {
                    if (!pattern.trim()) continue;
                    let isMatch = false;
                    if (rule.type === 'url-wildcard') {
                        isMatch = new RegExp(pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(url);
                    } else if (rule.type === 'url-regex') {
                        isMatch = new RegExp(pattern.trim()).test(url);
                    }
                    if (isMatch) {
                        ui.ruleTesterResult.innerHTML = `Correspondeu: <strong class="text-indigo-600 dark:text-indigo-400">${rule.name}</strong>`;
                        return;
                    }
                } catch (e) { /* Ignora regex inválida durante o teste */ }
            }
        }
        ui.ruleTesterResult.innerHTML = 'Nenhuma regra personalizada correspondeu. Usará a estratégia de nomenclatura padrão.';
    }

    // --- GESTÃO DE MODAIS E NOTIFICAÇÕES ---

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = { success: 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/50 dark:border-green-600 dark:text-green-200', error: 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/50 dark:border-red-600 dark:text-red-200', info: 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/50 dark:border-blue-600 dark:text-blue-200' };
        notification.className = `p-4 border-l-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out opacity-0 translate-y-2 ${colors[type]}`;
        notification.textContent = message;
        ui.notificationContainer.appendChild(notification);
        setTimeout(() => notification.classList.remove('opacity-0', 'translate-y-2'), 10);
        setTimeout(() => {
            notification.classList.add('opacity-0');
            notification.addEventListener('transitionend', () => notification.remove());
        }, 4000);
    }
    
    function showConfirmModal(text, onConfirm) { ui.confirmModalText.textContent = text; confirmCallback = onConfirm; ui.confirmModal.classList.remove('hidden'); }
    function hideConfirmModal() { ui.confirmModal.classList.add('hidden'); confirmCallback = null; }
    function openModalForEdit(index) {
        ui.modalTitle.textContent = 'Editar Regra';
        const rule = currentSettings.customRules[index];
        ui.ruleIndex.value = index;
        ui.ruleName.value = rule.name;
        ui.ruleType.value = rule.type;
        ui.rulePatterns.value = (rule.patterns || []).join('\n');
        ui.ruleMinTabs.value = rule.minTabs || 1;
        ui.ruleColor.value = rule.color || 'grey';
        ui.ruleModal.classList.remove('hidden');
    }
    function openModalForAdd() { ui.modalTitle.textContent = 'Adicionar Nova Regra'; ui.ruleForm.reset(); ui.ruleIndex.value = ''; ui.ruleMinTabs.value = 1; ui.ruleColor.value = 'grey'; ui.ruleModal.classList.remove('hidden'); }
    function closeModal() {
        ui.ruleModal.classList.add('hidden');
        if (window.history.replaceState) {
            const cleanUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
    }

    function handleRuleFormSubmit(e) {
        e.preventDefault();
        const rule = { name: ui.ruleName.value.trim(), type: ui.ruleType.value, patterns: ui.rulePatterns.value.split('\n').map(p => p.trim()).filter(Boolean), color: ui.ruleColor.value, minTabs: parseInt(ui.ruleMinTabs.value, 10) || 1 };
        const index = ui.ruleIndex.value;
        if (index !== '') currentSettings.customRules[index] = rule;
        else currentSettings.customRules.push(rule);
        closeModal();
        renderRules();
        scheduleSave();
    }

    function deleteRule(index) {
        const ruleName = currentSettings.customRules[index].name;
        showConfirmModal(`Tem a certeza que deseja excluir a regra "${ruleName}"?`, () => {
            currentSettings.customRules.splice(index, 1);
            renderRules();
            scheduleSave();
            showNotification(`Regra "${ruleName}" excluída.`, 'info');
        });
    }

    function duplicateRule(index) {
        const newRule = JSON.parse(JSON.stringify(currentSettings.customRules[index]));
        newRule.name += " (cópia)";
        currentSettings.customRules.splice(index + 1, 0, newRule);
        renderRules();
        scheduleSave();
        showNotification(`Regra "${newRule.name.replace(' (cópia)', '')}" duplicada.`, 'info');
    }
    
    function updateSaveStatus(status) {
        const statusMap = { saving: ['A guardar...', 'text-yellow-500'], saved: ['Alterações guardadas.', 'text-green-500'], error: ['Erro ao guardar.', 'text-red-500'] };
        const [text, color] = statusMap[status] || ['', ''];
        ui.saveStatus.textContent = text;
        ui.saveStatus.className = `h-6 text-center font-semibold transition-colors ${color}`;
    }

    function handleUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') !== 'new_rule') return;
        
        openModalForAdd();
        ui.ruleName.value = decodeURIComponent(params.get('name') || '');
        const url = decodeURIComponent(params.get('url') || '');
        const patterns = decodeURIComponent(params.get('patterns') || '');
        
        if (patterns) {
             ui.rulePatterns.value = patterns;
        } else if (url) {
            try { ui.rulePatterns.value = `*${new URL(url).hostname}*`; } catch(e) {}
        }
    }

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---

    loadSettings();
    handleUrlParameters();

    // Listeners para os campos que guardam automaticamente
    Object.keys(ui).forEach(key => {
        const element = ui[key];
        if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            const eventType = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
            element.addEventListener(eventType, scheduleSave);
        }
    });

    // Listeners para UI dinâmica e Testador de Regras
    ui.theme.addEventListener('change', () => applyTheme(ui.theme.value));
    ui.ungroupSingleTabs.addEventListener('change', updateDynamicUI);
    ui.ruleTesterInput.addEventListener('input', testCurrentRule);

    // Listeners para botões e modais
    ui.addRuleBtn.addEventListener('click', openModalForAdd);
    ui.cancelRuleBtn.addEventListener('click', closeModal);
    ui.ruleForm.addEventListener('submit', handleRuleFormSubmit);
    ui.ruleModal.addEventListener('click', (e) => { if (e.target === ui.ruleModal) closeModal(); });
    ui.confirmCancelBtn.addEventListener('click', hideConfirmModal);
    ui.confirmOkBtn.addEventListener('click', () => { if (typeof confirmCallback === 'function') confirmCallback(); hideConfirmModal(); });

    ui.rulesList.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const index = parseInt(button.dataset.index, 10);
        if (button.classList.contains('edit-rule-btn')) openModalForEdit(index);
        else if (button.classList.contains('delete-rule-btn')) deleteRule(index);
        else if (button.classList.contains('duplicate-rule-btn')) duplicateRule(index);
    });

    // Listeners para Importar/Exportar
    ui.importBtn.addEventListener('click', () => ui.importFile.click());
    ui.exportBtn.addEventListener('click', async () => {
        const settingsToExport = await browser.runtime.sendMessage({ action: 'getSettings' });
        const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], { type: 'application/json' });
        browser.downloads.download({ url: URL.createObjectURL(blob), filename: `auto-tab-grouper-settings-${new Date().toISOString().slice(0,10)}.json`, saveAs: true });
    });
    ui.importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedSettings = JSON.parse(e.target.result);
                if (importedSettings && typeof importedSettings === 'object') {
                    await browser.runtime.sendMessage({ action: 'updateSettings', settings: importedSettings });
                    await loadSettings();
                    showNotification('Configurações importadas com sucesso!', 'success');
                } else {
                    showNotification('Erro: Ficheiro de configuração inválido.', 'error');
                }
            } catch (err) { showNotification('Erro ao ler o ficheiro de importação.', 'error'); }
        };
        reader.readAsText(file);
        event.target.value = ''; // Limpa o input para permitir re-importar o mesmo ficheiro
    });
});
