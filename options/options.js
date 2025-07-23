/**
 * @file options.js
 * @description Lógica para a página de opções da extensão, com suporte para regras complexas.
 */

// Importação estática do módulo de validação.
// Isso resolve problemas de carregamento dinâmico que podem ocorrer em alguns ambientes de extensão.
import { validateTabRenamingRule } from "../validation-utils.js";
import { clearSmartNameCache } from "../intelligent-cache-manager.js";

// Conteúdo para os tooltips de ajuda contextual.
const helpTexts = {
  groupingMode:
    "Define como os grupos são nomeados. <ul><li><strong>Nomenclatura Inteligente:</strong> Tenta descobrir o nome principal do site (ex: 'Google Docs').</li><li><strong>Agrupar por Domínio:</strong> Usa o nome do site (ex: 'google.com').</li><li><strong>Agrupar por Subdomínio:</strong> É mais específico (ex: 'docs.google.com').</li></ul>",
  minTabsForAutoGroup:
    "Define o número mínimo de abas semelhantes que precisam estar abertas antes que um novo grupo seja criado automaticamente. Use '1' para agrupar imediatamente, ou '2' (padrão) para evitar grupos com uma única aba.",
  showTabCount:
    "Se ativado, o título de cada grupo mostrará o número de abas que ele contém. Ex: 'Notícias (5)'. Desative para um visual mais limpo.",
  uncollapseOnActivate:
    "Se ativado, um grupo recolhido será automaticamente expandido quando você clicar em uma das suas abas na barra de abas do Firefox.",
  autoCollapseTimeout:
    "Recolhe automaticamente um grupo que não foi usado por um certo tempo. Isto ajuda a manter sua barra de abas organizada. Deixe '0' para desativar esta funcionalidade.",
  ungroupSingleTabs:
    "Se ativado, quando um grupo fica com apenas uma aba, essa aba será automaticamente removida do grupo após um tempo. Isto evita ter grupos com uma única aba.",
  ungroupSingleTabsTimeout:
    "Define o tempo de espera antes de desagrupar uma aba solitária, se a opção acima estiver ativa.",
  theme:
    "Escolha a aparência da extensão. 'Automático' seguirá o tema claro/escuro do seu sistema operacional.",
  domainSanitizationTlds:
    "TLDs são as terminações de um site (ex: '.com', '.gov.br'). Listá-los aqui ajuda a criar nomes de grupo melhores (ex: `google.com.br` vira `Google`). Importante: Os mais longos (`.com.br`) devem vir antes dos mais curtos (`.br`).",
  titleSanitizationNoise:
    "Palavras 'ruidosas' como 'Login' ou 'Painel' podem atrapalhar a Nomenclatura Inteligente. Liste aqui palavras que, se encontradas, devem ser ignoradas para ajudar a encontrar o nome verdadeiro do site.",
  titleDelimiters:
    "Caracteres como `|`, `-` ou `—` são frequentemente usados para separar o nome da marca do resto do título (ex: 'Seu Painel | NomeDaEmpresa'). Informar estes caracteres aqui ajuda a Nomenclatura Inteligente a isolar e extrair o nome da marca com mais precisão.",
  exceptionsList:
    "Liste aqui os sites que você NUNCA quer que sejam agrupados. Insira o domínio (ex: `mail.google.com`), um por linha. Qualquer URL que contenha o texto inserido será ignorada.",
  customRules:
    "Crie regras poderosas para cenários complexos. As regras são verificadas de cima para baixo; a primeira que corresponder será usada. Arraste-as para reordenar a prioridade. <br><a href='../help/help.html' target='_blank' class='text-indigo-400 hover:underline'>Aprenda a dominar as regras.</a>",
  ruleTester:
    "Use este campo para testar como uma URL e um título seriam agrupados com base nas suas regras e configurações atuais. O resultado mostrará qual regra personalizada correspondeu, ou se será usado o agrupamento padrão.",
  syncEnabled:
    "Se ativado, suas configurações e regras serão salvas na sua Conta Firefox e sincronizadas entre seus dispositivos. Se desativado, as configurações ficam salvas apenas neste computador.",
  tabRenaming:
    "Ative a renomeação automática de abas para personalizar os títulos. Crie regras com condições e estratégias para extrair ou manipular o texto do título da aba. As regras são aplicadas em ordem de prioridade.",
  renamingStrategy:
    "Define como o novo título será gerado. <ul><li><strong>Extração CSS:</strong> Tenta pegar texto de um elemento específico na página.</li><li><strong>Manipulação de Título:</strong> Modifica o título atual da aba.</li><li><strong>Baseado em Domínio:</strong> Usa o nome do domínio da aba.</li><li><strong>Título Original:</strong> Mantém o título original da aba (útil como fallback).</li></ul>",
  textOperations:
    "Sequência de operações para manipular o título. As operações são aplicadas uma após a outra. Por exemplo, você pode remover um padrão e depois adicionar um prefixo.",
  renamingRuleName:
    "Dê um nome descritivo para a sua regra, para que você possa identificá-la facilmente na lista. Ex: 'Títulos de Artigos de Notícias'.",
  renamingPriority:
    "Define a ordem em que as regras são testadas. Um número menor significa uma prioridade maior. Se uma aba corresponder a várias regras, a que tiver o menor número de prioridade será aplicada.",
  renamingConditions:
    "Defina as condições que uma aba deve atender para que esta regra seja aplicada. Você pode combinar múltiplas condições usando 'TODAS' (AND) ou 'QUALQUER UMA' (OR).",
  renamingStrategies:
    "Define como o novo título será gerado. As estratégias são tentadas em ordem, de cima para baixo. A primeira que retornar um texto válido será usada.",
  cssSelector:
    "Um seletor CSS aponta para um elemento específico na página web. Use-o para extrair texto de cabeçalhos, títulos ou outros elementos. <br><strong>Exemplos:</strong><ul><li><code>h1</code> (para o cabeçalho principal)</li><li><code>.article-title</code> (para um elemento com a classe 'article-title')</li><li><code>#main-header</code> (para um elemento com o ID 'main-header')</li></ul>",
  cssAttribute:
    "Opcional. Se você precisa extrair o valor de um atributo de um elemento em vez do seu texto, especifique o nome do atributo aqui. Comum para imagens (use <code>alt</code>) ou links (use <code>title</code>).",
  regexPattern:
    "Expressões Regulares (Regex) são um padrão de busca poderoso para encontrar e manipular texto. <br><strong>Dica:</strong> Use parênteses <code>()</code> para criar um 'grupo de captura'. Você pode então usar <code>$1</code>, <code>$2</code>, etc., no campo 'Substituir por' para se referir ao texto capturado. <br><a href='https://regex101.com/' target='_blank' class='text-indigo-400 hover:underline'>Aprenda e teste suas Regex aqui.</a>",
  advancedRenamingOptions:
    "Ajustes finos para o comportamento da regra:<ul><li><strong>Aguardar carregamento:</strong> Útil para sites que carregam o título dinamicamente após a página inicial carregar.</li><li><strong>Armazenar em cache:</strong> Melhora a performance ao salvar o resultado da renomeação, evitando reprocessamento.</li><li><strong>Respeitar alterações manuais:</strong> Se você renomear manualmente uma aba, a extensão não tentará renomeá-la novamente.</li><li><strong>Tentativas de Reaplicação:</strong> Quantas vezes a regra deve tentar ser aplicada se a primeira tentativa falhar (ex: o elemento ainda não apareceu na página).</li></ul>",
};

document.addEventListener("DOMContentLoaded", () => {
  // --- Mapeamento de Elementos da UI ---
  const ui = {
    theme: document.getElementById("theme"),
    groupingMode: document.getElementById("groupingMode"),
    minTabsForAutoGroup: document.getElementById("minTabsForAutoGroup"),
    uncollapseOnActivate: document.getElementById("uncollapseOnActivate"),
    autoCollapseTimeout: document.getElementById("autoCollapseTimeout"),
    ungroupSingleTabs: document.getElementById("ungroupSingleTabs"),
    ungroupSingleTabsTimeout: document.getElementById(
      "ungroupSingleTabsTimeout"
    ),
    exceptionsList: document.getElementById("exceptionsList"),
    showTabCount: document.getElementById("showTabCount"),
    syncEnabled: document.getElementById("syncEnabled"),
    logLevel: document.getElementById("logLevel"),
    domainSanitizationTlds: document.getElementById("domainSanitizationTlds"),
    titleSanitizationNoise: document.getElementById("titleSanitizationNoise"),
    titleDelimiters: document.getElementById("titleDelimiters"),
    rulesList: document.getElementById("rulesList"), // Agrupamento
    importBtn: document.getElementById("importBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
    ruleModal: document.getElementById("ruleModal"), // Modal de Agrupamento
    modalTitle: document.getElementById("modalTitle"),
    ruleForm: document.getElementById("ruleForm"),
    addRuleBtn: document.getElementById("addRuleBtn"), // Agrupamento
    cancelRuleBtn: document.getElementById("cancelRuleBtn"),
    saveRuleBtn: document.getElementById("saveRuleBtn"),
    ruleIndex: document.getElementById("ruleIndex"),
    ruleName: document.getElementById("ruleName"),
    ruleColor: document.getElementById("ruleColor"),
    ruleMinTabs: document.getElementById("ruleMinTabs"),
    ruleOperator: document.getElementById("ruleOperator"),
    conditionsContainer: document.getElementById("conditionsContainer"), // Agrupamento
    addConditionBtn: document.getElementById("addConditionBtn"), // Agrupamento
    confirmModal: document.getElementById("confirmModal"),
    confirmModalText: document.getElementById("confirmModalText"),
    confirmOkBtn: document.getElementById("confirmOkBtn"),
    confirmCancelBtn: document.getElementById("confirmCancelBtn"),
    notificationContainer: document.getElementById("notification-container"),
    saveStatus: document.getElementById("saveStatus"),
    ruleTesterUrl: document.getElementById("ruleTesterUrl"),
    ruleTesterTitle: document.getElementById("ruleTesterTitle"),
    ruleTesterResult: document.getElementById("ruleTesterResult"),
    // Elementos de diagnóstico de memória
    refreshMemoryStats: document.getElementById("refreshMemoryStats"),
    cleanupMemory: document.getElementById("cleanupMemory"),
    clearCacheBtn: document.getElementById("clearCacheBtn"),
    memoryTabGroupMap: document.getElementById("memoryTabGroupMap"),
    memoryTitleUpdaters: document.getElementById("memoryTitleUpdaters"),
    memoryGroupActivity: document.getElementById("memoryGroupActivity"),
    memorySmartCache: document.getElementById("memorySmartCache"),
    memoryInjectionFailures: document.getElementById("memoryInjectionFailures"),
    memoryPendingGroups: document.getElementById("memoryPendingGroups"),
    lastCleanupTime: document.getElementById("lastCleanupTime"),
    totalCleaned: document.getElementById("totalCleaned"),
    cleanupCycles: document.getElementById("cleanupCycles"),
    // Elementos de configuração de performance
    queueDelay: document.getElementById("queueDelay"),
    batchSize: document.getElementById("batchSize"),
    maxInjectionRetries: document.getElementById("maxInjectionRetries"),
    performanceLogging: document.getElementById("performanceLogging"),
    resetPerformanceConfig: document.getElementById("resetPerformanceConfig"),
    savePerformanceConfig: document.getElementById("savePerformanceConfig"),
    // NOVO: Elementos de Renomeação Automática de Abas
    tabRenamingEnabled: document.getElementById("tabRenamingEnabled"),
    addRenamingRuleBtn: document.getElementById("addRenamingRuleBtn"),
    renamingRulesList: document.getElementById("renamingRulesList"),
    renamingRuleModal: document.getElementById("renamingRuleModal"),
    renamingModalTitle: document.getElementById("renamingModalTitle"),
    renamingRuleForm: document.getElementById("renamingRuleForm"),
    renamingRuleId: document.getElementById("renamingRuleId"),
    renamingRuleName: document.getElementById("renamingRuleName"),
    renamingRulePriority: document.getElementById("renamingRulePriority"),
    renamingRuleEnabled: document.getElementById("renamingRuleEnabled"),
    renamingRuleConditionOperator: document.getElementById(
      "renamingRuleConditionOperator"
    ),
    renamingConditionsContainer: document.getElementById(
      "renamingConditionsContainer"
    ),
    addRenamingConditionBtn: document.getElementById("addRenamingConditionBtn"),
    renamingStrategiesContainer: document.getElementById(
      "renamingStrategiesContainer"
    ),
    addRenamingStrategyBtn: document.getElementById("addRenamingStrategyBtn"),
    renamingOptionWaitForLoad: document.getElementById(
      "renamingOptionWaitForLoad"
    ),
    renamingOptionCacheResult: document.getElementById(
      "renamingOptionCacheResult"
    ),
    renamingOptionRespectManualChanges: document.getElementById(
      "renamingOptionRespectManualChanges"
    ),
    renamingOptionRetryAttempts: document.getElementById(
      "renamingOptionRetryAttempts"
    ),
    cancelRenamingRuleBtn: document.getElementById("cancelRenamingRuleBtn"),
    saveRenamingRuleBtn: document.getElementById("saveRenamingRuleBtn"),
  };

  let currentSettings = {};
  let sortableInstance = null; // Para regras de agrupamento
  let renamingSortableInstance = null; // Para regras de renomeação
  let confirmCallback = null;
  let saveTimeout = null;

  // --- LÓGICA DE AJUDA CONTEXTUAL (TOOLTIPS) ---
  function initializeHelpTooltips() {
    document.querySelectorAll(".help-tooltip").forEach((button) => {
      const helpKey = button.dataset.helpKey;
      const text = helpTexts[helpKey];

      if (text) {
        const tooltipContent = document.createElement("div");
        tooltipContent.className = "tooltip-content";
        tooltipContent.innerHTML = text; // Usamos innerHTML para permitir formatação com <ul>, <a> etc.
        button.appendChild(tooltipContent);
      }
    });
  }

  // --- LÓGICA DO CONSTRUTOR DE REGRAS DE AGRUPAMENTO ---

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
    const conditionDiv = document.createElement("div");
    conditionDiv.className =
      "condition-item bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-600";

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
    if (condition.property)
      conditionDiv.querySelector(".condition-property").value =
        condition.property;
    if (condition.operator)
      conditionDiv.querySelector(".condition-operator").value =
        condition.operator;
    if (condition.value)
      conditionDiv.querySelector(".condition-value").value = condition.value;

    // Event listener para remover condição
    conditionDiv
      .querySelector(".remove-condition-btn")
      .addEventListener("click", () => {
        conditionDiv.remove();
      });

    return conditionDiv;
  }

  ui.addConditionBtn.addEventListener("click", () => {
    ui.conditionsContainer.appendChild(createConditionElement());
  });

  // --- NOVO: LÓGICA DO CONSTRUTOR DE REGRAS DE RENOMEAÇÃO ---

  const renamingStrategyOptions = `
    <option value="css_extract">Extração CSS</option>
    <option value="title_manipulation">Manipulação de Título</option>
    <option value="domain_based">Baseado em Domínio</option>
    <option value="original_title">Título Original (Fallback)</option>
  `;

  const textActionOptions = `
    <option value="replace">Substituir</option>
    <option value="prepend">Adicionar no Início</option>
    <option value="append">Adicionar no Fim</option>
    <option value="remove">Remover</option>
    <option value="truncate">Truncar</option>
    <option value="extract">Extrair (Regex)</option>
  `;

  function createRenamingConditionElement(condition = {}) {
    const conditionDiv = document.createElement("div");
    conditionDiv.className =
      "condition-item bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-600";
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
    if (condition.property)
      conditionDiv.querySelector(".condition-property").value =
        condition.property;
    if (condition.operator)
      conditionDiv.querySelector(".condition-operator").value =
        condition.operator;
    if (condition.value)
      conditionDiv.querySelector(".condition-value").value = condition.value;

    conditionDiv
      .querySelector(".remove-condition-btn")
      .addEventListener("click", () => {
        conditionDiv.remove();
      });
    return conditionDiv;
  }

  function createTextOperationElement(operation = {}) {
    const opDiv = document.createElement("div");
    opDiv.className =
      "text-operation-item bg-slate-100 dark:bg-slate-700/70 p-3 rounded-lg border border-slate-200 dark:border-slate-600";
    opDiv.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <label class="font-semibold text-sm">Ação:</label>
            <select class="operation-action p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600">
                ${textActionOptions}
            </select>
            <button type="button" class="remove-operation-btn text-red-500 hover:text-red-700 font-bold p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                </svg>
            </button>
        </div>
        <div class="operation-fields space-y-2">
            <!-- Campos dinâmicos aqui -->
        </div>
    `;
    const actionSelect = opDiv.querySelector(".operation-action");
    const fieldsContainer = opDiv.querySelector(".operation-fields");

    actionSelect.value = operation.action || "replace";

    const updateFields = () => {
      fieldsContainer.innerHTML = "";
      const action = actionSelect.value;

      let fieldsHtml = "";
      switch (action) {
        case "replace":
        case "remove":
        case "extract":
          fieldsHtml += `
            <div>
                <label class="block text-xs font-medium mb-1">Padrão (Regex):</label>
                <input type="text" class="operation-pattern w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: (.*) - YouTube">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Flags (opcional):</label>
                <input type="text" class="operation-flags w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: gi (global, case-insensitive)">
            </div>
          `;
          if (action === "replace") {
            fieldsHtml += `
              <div>
                  <label class="block text-xs font-medium mb-1">Substituir por:</label>
                  <input type="text" class="operation-replacement w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: $1">
              </div>
            `;
          }
          if (action === "extract") {
            fieldsHtml += `
              <div>
                  <label class="block text-xs font-medium mb-1">Grupo de Captura (opcional):</label>
                  <input type="number" min="0" class="operation-group w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: 1">
              </div>
            `;
          }
          break;
        case "prepend":
        case "append":
          fieldsHtml += `
            <div>
                <label class="block text-xs font-medium mb-1">Texto:</label>
                <input type="text" class="operation-text w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: [Lido] ">
            </div>
          `;
          break;
        case "truncate":
          fieldsHtml += `
            <div>
                <label class="block text-xs font-medium mb-1">Comprimento Máximo:</label>
                <input type="number" min="1" class="operation-max-length w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600">
            </div>
            <div>
                <label class="block text-xs font-medium mb-1">Elipse (opcional):</label>
                <input type="text" class="operation-ellipsis w-full p-1 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: ...">
            </div>
          `;
          break;
      }
      fieldsContainer.innerHTML = fieldsHtml;

      // Preencher valores dinâmicos
      if (operation.pattern)
        fieldsContainer.querySelector(".operation-pattern").value =
          operation.pattern;
      if (operation.replacement)
        fieldsContainer.querySelector(".operation-replacement").value =
          operation.replacement;
      if (operation.flags)
        fieldsContainer.querySelector(".operation-flags").value =
          operation.flags;
      if (operation.group)
        fieldsContainer.querySelector(".operation-group").value =
          operation.group;
      if (operation.text)
        fieldsContainer.querySelector(".operation-text").value = operation.text;
      if (operation.maxLength)
        fieldsContainer.querySelector(".operation-max-length").value =
          operation.maxLength;
      if (operation.ellipsis)
        fieldsContainer.querySelector(".operation-ellipsis").value =
          operation.ellipsis;
    };

    actionSelect.addEventListener("change", updateFields);
    opDiv
      .querySelector(".remove-operation-btn")
      .addEventListener("click", () => opDiv.remove());

    updateFields(); // Chama na criação para renderizar os campos iniciais
    return opDiv;
  }

  function createRenamingStrategyElement(strategy = {}) {
    const strategyDiv = document.createElement("div");
    strategyDiv.className =
      "renaming-strategy-item bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-600";
    strategyDiv.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <label class="font-semibold">Estratégia:</label>
            <select class="strategy-type p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600">
                ${renamingStrategyOptions}
            </select>
            <button type="button" class="remove-strategy-btn text-red-500 hover:text-red-700 font-bold p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                </svg>
            </button>
        </div>
        <div class="strategy-fields space-y-3">
            <!-- Campos específicos da estratégia -->
        </div>
        <div class="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
            <label class="block text-sm font-medium mb-1">Fallback (se a estratégia acima falhar):</label>
            <select class="strategy-fallback w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600">
                <option value="">Nenhum</option>
                ${renamingStrategyOptions}
            </select>
            <div class="fallback-config-container mt-2 pl-4 border-l-2 border-slate-200 dark:border-slate-600">
                <!-- Campos de configuração do Fallback serão renderizados aqui -->
            </div>
        </div>
    `;

    const typeSelect = strategyDiv.querySelector(".strategy-type");
    const fieldsContainer = strategyDiv.querySelector(".strategy-fields");
    const fallbackSelect = strategyDiv.querySelector(".strategy-fallback");
    const fallbackContainer = strategyDiv.querySelector(
      ".fallback-config-container"
    );

    // Função reutilizável para renderizar os campos de uma estratégia
    const renderStrategyFields = (container, strategyData) => {
      container.innerHTML = "";
      const type = strategyData.type;
      let fieldsHtml = "";

      switch (type) {
        case "css_extract":
          fieldsHtml = `
            <div>
                <label class="block text-sm font-medium mb-1">Seletor CSS:</label>
                <input type="text" class="strategy-selector w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: h1.title" value="${
                  strategyData.selector || ""
                }">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Atributo (opcional):</label>
                <input type="text" class="strategy-attribute w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600" placeholder="Ex: alt" value="${
                  strategyData.attribute || ""
                }">
            </div>`;
          break;
        case "title_manipulation":
          fieldsHtml = `
            <div class="text-operations-container space-y-2"></div>
            <button type="button" class="add-operation-btn mt-2 bg-blue-400 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded-lg text-xs">
                + Adicionar Operação de Texto
            </button>`;
          break;
      }
      container.innerHTML = fieldsHtml;

      if (type === "title_manipulation") {
        const opsContainer = container.querySelector(
          ".text-operations-container"
        );
        container
          .querySelector(".add-operation-btn")
          .addEventListener("click", () =>
            opsContainer.appendChild(createTextOperationElement())
          );

        const operations = strategyData.operations || [{}]; // Adiciona uma operação padrão se não houver nenhuma
        operations.forEach((op) =>
          opsContainer.appendChild(createTextOperationElement(op))
        );
      }
    };

    // Event listeners
    typeSelect.addEventListener("change", () => {
      renderStrategyFields(fieldsContainer, { type: typeSelect.value });
    });

    fallbackSelect.addEventListener("change", () => {
      const fallbackType = fallbackSelect.value;
      if (fallbackType) {
        renderStrategyFields(fallbackContainer, { type: fallbackType });
      } else {
        fallbackContainer.innerHTML = "";
      }
    });

    strategyDiv
      .querySelector(".remove-strategy-btn")
      .addEventListener("click", () => strategyDiv.remove());

    // Preenchimento inicial
    typeSelect.value = strategy.type || "original_title";
    renderStrategyFields(fieldsContainer, strategy);

    if (strategy.fallback && typeof strategy.fallback === "object") {
      fallbackSelect.value = strategy.fallback.type;
      renderStrategyFields(fallbackContainer, strategy.fallback);
    } else {
      fallbackSelect.value = "";
    }

    return strategyDiv;
  }

  ui.addRenamingConditionBtn.addEventListener("click", () => {
    ui.renamingConditionsContainer.appendChild(
      createRenamingConditionElement()
    );
  });

  ui.addRenamingStrategyBtn.addEventListener("click", () => {
    ui.renamingStrategiesContainer.appendChild(createRenamingStrategyElement());
  });

  // --- FUNÇÕES DE GESTÃO DE DADOS ---

  async function loadSettings() {
    try {
      const settingsFromBg = await browser.runtime.sendMessage({
        action: "getSettings",
      });
      currentSettings = settingsFromBg || {};

      // --- Bloco de Migração de Regras de Renomeação ---
      // Converte regras do formato antigo (objeto) para o novo (array de condições)
      let settingsChanged = false;
      if (
        currentSettings.tabRenamingRules &&
        Array.isArray(currentSettings.tabRenamingRules)
      ) {
        currentSettings.tabRenamingRules.forEach((rule) => {
          // A verificação chave: se `conditions` é um objeto mas não um array, é o formato antigo.
          if (
            rule.conditions &&
            typeof rule.conditions === "object" &&
            !Array.isArray(rule.conditions)
          ) {
            console.warn(
              `Migrando regra de renomeação do formato antigo: ${rule.name}`
            );
            const newConditions = [];
            const oldConditions = rule.conditions;

            if (oldConditions.hostPatterns) {
              newConditions.push(
                ...oldConditions.hostPatterns.map((p) => ({
                  property: "hostname",
                  operator: "contains",
                  value: p,
                }))
              );
            }
            if (oldConditions.hostRegex) {
              newConditions.push({
                property: "hostname",
                operator: "regex",
                value: oldConditions.hostRegex,
              });
            }
            if (oldConditions.urlPatterns) {
              newConditions.push(
                ...oldConditions.urlPatterns.map((p) => ({
                  property: "url",
                  operator: "contains",
                  value: p,
                }))
              );
            }
            if (oldConditions.titlePatterns) {
              newConditions.push(
                ...oldConditions.titlePatterns.map((p) => ({
                  property: "title",
                  operator: "contains",
                  value: p,
                }))
              );
            }
            rule.conditions = newConditions;
            settingsChanged = true;
          }
        });
      }

      // Se alguma regra foi migrada, salva as configurações atualizadas
      if (settingsChanged) {
        console.log(
          "Regras de renomeação migradas. Salvando novas configurações."
        );
        // Atualiza as configurações no background sem esperar, para não atrasar a UI
        browser.runtime.sendMessage({
          action: "updateSettings",
          settings: currentSettings,
        });
      }
      // --- Fim do Bloco de Migração ---

      populateForm(currentSettings);
      updateDynamicUI();
      await testCurrentRule();
    } catch (e) {
      console.error("Erro ao carregar as configurações:", e);
      showNotification("Não foi possível carregar as configurações.", "error");
    }
  }

  function populateForm(settings) {
    applyTheme(settings.theme || "auto");
    ui.theme.value = settings.theme || "auto";
    ui.groupingMode.value = settings.groupingMode;
    ui.minTabsForAutoGroup.value = settings.minTabsForAutoGroup || 2;
    ui.uncollapseOnActivate.checked = settings.uncollapseOnActivate;
    ui.autoCollapseTimeout.value = settings.autoCollapseTimeout;
    ui.ungroupSingleTabs.checked = settings.ungroupSingleTabs;
    ui.ungroupSingleTabsTimeout.value = settings.ungroupSingleTabsTimeout;
    ui.exceptionsList.value = (settings.exceptions || []).join("\n");
    ui.showTabCount.checked = settings.showTabCount;
    ui.syncEnabled.checked = settings.syncEnabled;
    ui.logLevel.value = settings.logLevel || "INFO";
    ui.domainSanitizationTlds.value = (
      settings.domainSanitizationTlds || []
    ).join("\n");
    ui.titleSanitizationNoise.value = (
      settings.titleSanitizationNoise || []
    ).join("\n");
    ui.titleDelimiters.value = settings.titleDelimiters || "|–—:·»«-";
    renderRulesList(); // Agrupamento
    // NOVO: Renomeação de Abas
    ui.tabRenamingEnabled.checked = settings.tabRenamingEnabled || false;
    renderRenamingRulesList();
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
      ungroupSingleTabsTimeout:
        parseInt(ui.ungroupSingleTabsTimeout.value, 10) || 10,
      exceptions: ui.exceptionsList.value
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean),
      showTabCount: ui.showTabCount.checked,
      syncEnabled: ui.syncEnabled.checked,
      logLevel: ui.logLevel.value,
      domainSanitizationTlds: ui.domainSanitizationTlds.value
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean),
      titleSanitizationNoise: ui.titleSanitizationNoise.value
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean),
      titleDelimiters: ui.titleDelimiters.value,
      customRules: currentSettings.customRules || [], // Regras de agrupamento
      // NOVO: Renomeação de Abas
      tabRenamingEnabled: ui.tabRenamingEnabled.checked,
      tabRenamingRules: currentSettings.tabRenamingRules || [],
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimeout);
    updateSaveStatus("saving");

    saveTimeout = setTimeout(async () => {
      const newSettings = collectSettingsFromForm();
      try {
        const response = await browser.runtime.sendMessage({
          action: "updateSettings",
          settings: newSettings,
        });
        // Usar a resposta do background para garantir que as configurações são as validadas
        currentSettings = response;
        populateForm(currentSettings); // Repopula o formulário com as settings validadas
        updateSaveStatus("saved");
        await testCurrentRule();
      } catch (e) {
        updateSaveStatus("error");
        // Fornece feedback mais específico para erros de sincronização.
        if (e.message && e.message.toLowerCase().includes("sync")) {
          showNotification(
            "Falha ao sincronizar. Verifique se a sincronização está ativa no seu navegador.",
            "error"
          );
        } else {
          showNotification("Erro ao guardar as configurações.", "error");
        }
        console.error("Erro ao guardar configurações:", e);
      }
    }, 750);
  }

  function updateSaveStatus(status) {
    const statusMap = {
      saving: ["Salvando...", "text-yellow-500"],
      saved: ["Alterações salvas.", "text-green-500"],
      error: ["Erro ao salvar.", "text-red-500"],
    };
    const [text, color] = statusMap[status] || ["", ""];
    ui.saveStatus.textContent = text;
    ui.saveStatus.className = `h-6 text-center font-semibold transition-colors ${color}`;
  }

  // --- FUNÇÕES DE UI E RENDERIZAÇÃO ---

  // CORRIGIDO: Tornar a função mais robusta para evitar erros com regras malformadas.
  function renderRulesList() {
    ui.rulesList.innerHTML = "";
    const rules = currentSettings.customRules || [];
    if (rules.length === 0) {
      ui.rulesList.innerHTML =
        '<p class="text-slate-500 italic text-center p-4 dark:text-slate-400">Nenhuma regra personalizada ainda.</p>';
      return;
    }

    rules.forEach((rule, index) => {
      // Verificação de segurança para a estrutura da regra
      const hasConditionGroup =
        rule.conditionGroup && Array.isArray(rule.conditionGroup.conditions);
      const conditions = hasConditionGroup
        ? rule.conditionGroup.conditions
        : [];
      const operator = hasConditionGroup ? rule.conditionGroup.operator : "E";

      let summary = "Regra vazia ou inválida";
      if (conditions.length > 0) {
        const firstCond = conditions[0];
        summary = `${firstCond.property} ${firstCond.operator} "${firstCond.value}"`;
        if (conditions.length > 1) {
          summary += ` ${operator.toLowerCase()} mais ${
            conditions.length - 1
          }...`;
        }
      }

      const ruleElement = document.createElement("div");
      const colorMap = {
        grey: "#5A5A5A",
        blue: "#3498db",
        red: "#e74c3c",
        yellow: "#f1c40f",
        green: "#2ecc71",
        pink: "#e91e63",
        purple: "#9b59b6",
        cyan: "#1abc9c",
        orange: "#e67e22",
      };
      ruleElement.className =
        "rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm dark:bg-slate-700/50";
      ruleElement.dataset.index = index;
      const tooltipTitle = hasConditionGroup
        ? conditions
            .map((c) => `${c.property} ${c.operator} ${c.value}`)
            .join(` ${operator} `)
        : "Regra em formato antigo. Edite para corrigir.";

      ruleElement.innerHTML = `<div class="flex items-center space-x-4 flex-grow min-w-0"><span class="drag-handle cursor-move p-2 text-slate-400 dark:text-slate-500">☰</span><span class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${
        colorMap[rule.color] || "#ccc"
      }"></span><div class="flex-grow min-w-0"><strong class="text-indigo-700 dark:text-indigo-400">${
        rule.name
      }</strong><p class="text-sm text-slate-600 dark:text-slate-300 truncate" title="${tooltipTitle}">${summary}</p></div></div><div class="flex space-x-1 flex-shrink-0"><button data-action="duplicate" class="text-slate-500 hover:text-blue-600 p-2 rounded-md" title="Duplicar Regra">❐</button><button data-action="edit" class="text-slate-500 hover:text-indigo-600 p-2 rounded-md" title="Editar Regra">✏️</button><button data-action="delete" class="text-slate-500 hover:text-red-600 p-2 rounded-md" title="Excluir Regra">🗑️</button></div>`;
      ui.rulesList.appendChild(ruleElement);
    });

    initSortable();
  }

  function initSortable() {
    if (sortableInstance) sortableInstance.destroy();
    if (
      ui.rulesList &&
      currentSettings.customRules &&
      currentSettings.customRules.length > 0
    ) {
      sortableInstance = new Sortable(ui.rulesList, {
        group: "rules-list",
        handle: ".drag-handle",
        animation: 150,
        onEnd: (evt) => {
          const movedItem = currentSettings.customRules.splice(
            evt.oldIndex,
            1
          )[0];
          currentSettings.customRules.splice(evt.newIndex, 0, movedItem);
          renderRulesList();
          scheduleSave();
        },
      });
    }
  }

  // NOVO: Renderiza a lista de regras de renomeação
  function renderRenamingRulesList() {
    ui.renamingRulesList.innerHTML = "";
    const rules = currentSettings.tabRenamingRules || [];
    if (rules.length === 0) {
      ui.renamingRulesList.innerHTML =
        '<p class="text-slate-500 italic text-center p-4 dark:text-slate-400">Nenhuma regra de renomeação personalizada ainda.</p>';
      return;
    }

    rules.forEach((rule, index) => {
      const ruleElement = document.createElement("div");
      ruleElement.className =
        "rule-item flex items-center justify-between bg-slate-100 p-3 rounded-lg shadow-sm dark:bg-slate-700/50";
      ruleElement.dataset.id = rule.id; // Usar ID único para renomeação
      ruleElement.dataset.index = index; // Manter índice para ordenação

      let summaryText;
      if (
        rule.conditions &&
        Array.isArray(rule.conditions) &&
        rule.conditions.length > 0
      ) {
        const firstCond = rule.conditions[0];
        const conditionOperator = rule.conditionOperator || "AND";
        const operatorMap = {
          contains: "contém",
          not_contains: "não contém",
          starts_with: "começa com",
          ends_with: "termina com",
          equals: "é igual a",
          regex: "corresponde a regex",
          wildcard: "corresponde a wildcard",
        };
        const propertyMap = {
          url: "URL",
          title: "Título",
          hostname: "Domínio",
          url_path: "Caminho da URL",
        };
        const propertyText =
          propertyMap[firstCond.property] || firstCond.property;
        const operatorText =
          operatorMap[firstCond.operator] || firstCond.operator;
        summaryText = `Se ${propertyText} ${operatorText} "${firstCond.value}"`;
        if (rule.conditions.length > 1) {
          summaryText += ` ${conditionOperator.toLowerCase()} mais ${
            rule.conditions.length - 1
          }...`;
        }
      } else {
        summaryText = "Nenhuma condição definida";
      }

      ruleElement.innerHTML = `
        <div class="flex items-center space-x-4 flex-grow min-w-0">
          <span class="drag-handle cursor-move p-2 text-slate-400 dark:text-slate-500">☰</span>
          <div class="flex-grow min-w-0">
            <strong class="text-indigo-700 dark:text-indigo-400">${
              rule.name
            }</strong>
            <p class="text-sm text-slate-600 dark:text-slate-300 truncate" title="${summaryText}">${summaryText}</p>
          </div>
          <span class="text-xs font-semibold px-2 py-1 rounded-full ${
            rule.enabled
              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
          }">
            ${rule.enabled ? "Ativa" : "Inativa"}
          </span>
        </div>
        <div class="flex space-x-1 flex-shrink-0">
          <button data-action="duplicate" class="text-slate-500 hover:text-blue-600 p-2 rounded-md" title="Duplicar Regra">❐</button>
          <button data-action="edit" class="text-slate-500 hover:text-indigo-600 p-2 rounded-md" title="Editar Regra">✏️</button>
          <button data-action="delete" class="text-slate-500 hover:text-red-600 p-2 rounded-md" title="Excluir Regra">🗑️</button>
        </div>
      `;
      ui.renamingRulesList.appendChild(ruleElement);
    });

    initRenamingSortable();
  }

  // NOVO: Inicializa o Sortable.js para regras de renomeação
  function initRenamingSortable() {
    if (renamingSortableInstance) renamingSortableInstance.destroy();
    if (
      ui.renamingRulesList &&
      currentSettings.tabRenamingRules &&
      currentSettings.tabRenamingRules.length > 0
    ) {
      renamingSortableInstance = new Sortable(ui.renamingRulesList, {
        group: "renaming-rules-list",
        handle: ".drag-handle",
        animation: 150,
        onEnd: (evt) => {
          const movedItem = currentSettings.tabRenamingRules.splice(
            evt.oldIndex,
            1
          )[0];
          currentSettings.tabRenamingRules.splice(evt.newIndex, 0, movedItem);
          renderRenamingRulesList();
          scheduleSave();
        },
      });
    }
  }

  // --- TESTADOR DE REGRAS ---

  async function testCurrentRule() {
    const url = ui.ruleTesterUrl.value.trim();
    const title = ui.ruleTesterTitle.value.trim();
    if (!url && !title) {
      ui.ruleTesterResult.innerHTML = "Aguardando entrada...";
      return;
    }

    const mockTab = { url, title, id: -1, hostname: "", pathname: "" };
    try {
      const parsedUrl = new URL(url);
      mockTab.hostname = parsedUrl.hostname;
      mockTab.pathname = parsedUrl.pathname;
    } catch (e) {
      // URL inválida, mas podemos continuar testando o título
    }

    try {
      // Simula a lógica de evaluateRule com validação
      const evaluateCondition = (cond) => {
        // Validação básica da condição
        if (!cond || typeof cond !== "object" || Array.isArray(cond)) {
          console.warn("Condição inválida:", cond);
          return false;
        }

        if (!cond.property || !cond.operator || cond.value === undefined) {
          console.warn("Condição incompleta:", cond);
          return false;
        }

        const tabProperties = {
          url: mockTab.url || "",
          title: mockTab.title || "",
          hostname: mockTab.hostname || "",
          url_path: mockTab.pathname || "",
        };

        // Validação da propriedade
        if (!tabProperties.hasOwnProperty(cond.property)) {
          console.warn("Propriedade inválida:", cond.property);
          return false;
        }

        const propValue = String(tabProperties[cond.property] || "");
        const condValue = String(cond.value || "").trim();

        if (condValue === "") {
          console.debug("Valor da condição vazio");
          return false;
        }

        try {
          switch (cond.operator) {
            case "contains":
              return propValue.toLowerCase().includes(condValue.toLowerCase());
            case "not_contains":
              return !propValue.toLowerCase().includes(condValue.toLowerCase());
            case "starts_with":
              return propValue
                .toLowerCase()
                .startsWith(condValue.toLowerCase());
            case "ends_with":
              return propValue.toLowerCase().endsWith(condValue.toLowerCase());
            case "equals":
              return propValue.toLowerCase() === condValue.toLowerCase();
            case "regex":
              try {
                return new RegExp(condValue, "i").test(propValue);
              } catch (regexError) {
                console.warn("Regex inválida:", condValue, regexError.message);
                return false;
              }
            case "wildcard":
              try {
                const wildcardRegex = new RegExp(
                  "^" +
                    condValue
                      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                      .replace(/\\\*/g, ".*") +
                    "$",
                  "i"
                );
                return wildcardRegex.test(propValue);
              } catch (wildcardError) {
                console.warn(
                  "Wildcard inválido:",
                  condValue,
                  wildcardError.message
                );
                return false;
              }
            default:
              console.warn("Operador desconhecido:", cond.operator);
              return false;
          }
        } catch (error) {
          console.error("Erro ao avaliar condição:", error);
          return false;
        }
      };

      // Teste de regras de agrupamento
      const matchingGroupingRule = (currentSettings.customRules || []).find(
        (rule) => {
          if (!rule.conditionGroup) return false;
          const { operator, conditions } = rule.conditionGroup;
          if (!conditions || conditions.length === 0) return false;

          if (operator === "AND") return conditions.every(evaluateCondition);
          if (operator === "OR") return conditions.some(evaluateCondition);
          return false;
        }
      );

      // NOVO: Teste de regras de renomeação
      let finalTitle = mockTab.title;
      let appliedRenamingRule = null;

      if (ui.tabRenamingEnabled.checked) {
        // O `globalTabRenamingEngine` agora é importado estaticamente no topo do arquivo,
        // então não precisamos mais de importação dinâmica aqui.
        // Isso remove um ponto potencial de falha de carregamento.
        const { globalTabRenamingEngine } = await import(
          "./tab-renaming-engine.js"
        ); // Mantido para garantir que o módulo seja carregado, mas a variável já está disponível.
        const renamingRules = currentSettings.tabRenamingRules || [];

        // Simular o findApplicableRules e executeRenamingRules
        const applicableRenamingRules = renamingRules
          .filter(
            (rule) =>
              rule.enabled &&
              globalTabRenamingEngine.matchesConditions(
                mockTab,
                rule.conditions
              )
          )
          .sort((a, b) => (a.priority || 999) - (b.priority || 999));

        for (const rule of applicableRenamingRules) {
          // Risco: executeRule pode falhar. Mitigação: try-catch.
          try {
            const tempTitle = await globalTabRenamingEngine.executeRule(
              mockTab,
              rule
            );
            if (tempTitle && tempTitle.trim()) {
              finalTitle = tempTitle.trim();
              appliedRenamingRule = rule;
              break; // Aplica a primeira regra que gerar um título válido
            }
          } catch (ruleError) {
            console.warn(
              `Erro ao aplicar regra de renomeação no testador (${rule.name}):`,
              ruleError
            );
            // Continua para a próxima regra ou usa o título original
          }
        }
      }

      let resultHtml = "";
      if (matchingGroupingRule) {
        resultHtml += `Agrupamento: <strong class="text-indigo-600 dark:text-indigo-400">${matchingGroupingRule.name}</strong><br>`;
      } else {
        resultHtml += `Agrupamento: Nenhuma regra personalizada correspondeu. Usará a nomenclatura inteligente/domínio.<br>`;
      }

      if (ui.tabRenamingEnabled.checked) {
        if (appliedRenamingRule) {
          resultHtml += `Renomeação: <strong class="text-indigo-600 dark:text-indigo-400">${appliedRenamingRule.name}</strong><br>`;
          resultHtml += `Título Final: <strong class="text-green-600 dark:text-green-400">${finalTitle}</strong>`;
        } else {
          resultHtml += `Renomeação: Nenhuma regra de renomeação correspondeu ou gerou título. Título original: <strong class="text-orange-600 dark:text-orange-400">${mockTab.title}</strong>`;
        }
      } else {
        resultHtml += `Renomeação: Desativada. Título original: <strong class="text-orange-600 dark:text-orange-400">${mockTab.title}</strong>`;
      }

      ui.ruleTesterResult.innerHTML = resultHtml;
    } catch (e) {
      ui.ruleTesterResult.innerHTML = `<span class="text-red-500">Erro na avaliação da regra: ${e.message}</span>`;
      console.error("Erro no testador de regras:", e);
    }
  }

  // --- MODAIS E AÇÕES ---

  function openModalForEdit(index) {
    const rule = currentSettings.customRules[index];
    ui.modalTitle.textContent = "Editar Regra";
    ui.ruleIndex.value = index;
    ui.ruleName.value = rule.name;
    ui.ruleColor.value = rule.color || "grey";
    ui.ruleMinTabs.value = rule.minTabs || 1;

    // Assegura que a regra a ser editada tem o formato correto
    const conditionGroup = rule.conditionGroup || {
      operator: "AND",
      conditions: [],
    };
    ui.ruleOperator.value = conditionGroup.operator;

    ui.conditionsContainer.innerHTML = "";
    if (conditionGroup.conditions.length === 0) {
      ui.conditionsContainer.appendChild(createConditionElement());
    } else {
      conditionGroup.conditions.forEach((c) =>
        ui.conditionsContainer.appendChild(createConditionElement(c))
      );
    }

    ui.ruleModal.classList.remove("hidden");
  }

  function openModalForAdd() {
    ui.modalTitle.textContent = "Adicionar Nova Regra";
    ui.ruleForm.reset();
    ui.ruleIndex.value = "";
    ui.ruleColor.value = "grey";
    ui.ruleMinTabs.value = 1;
    ui.ruleOperator.value = "AND";
    ui.conditionsContainer.innerHTML = "";
    ui.conditionsContainer.appendChild(createConditionElement());
    ui.ruleModal.classList.remove("hidden"); // CORRIGIDO: Mostra o modal de agrupamento
  }

  function handleRuleFormSubmit(e) {
    e.preventDefault();
    const index = ui.ruleIndex.value;
    const conditions = Array.from(ui.conditionsContainer.children)
      .map((div) => ({
        property: div.querySelector(".condition-property").value,
        operator: div.querySelector(".condition-operator").value,
        value: div.querySelector(".condition-value").value.trim(),
      }))
      .filter((c) => c.value); // Filtra condições sem valor

    if (conditions.length === 0) {
      showNotification(
        "Uma regra deve ter pelo menos uma condição válida.",
        "error"
      );
      return;
    }

    const newRule = {
      name: ui.ruleName.value.trim(),
      color: ui.ruleColor.value,
      minTabs: parseInt(ui.ruleMinTabs.value, 10) || 1,
      conditionGroup: {
        operator: ui.ruleOperator.value,
        conditions,
      },
    };

    if (index !== "") {
      currentSettings.customRules[parseInt(index, 10)] = newRule;
    } else {
      currentSettings.customRules.push(newRule);
    }

    renderRulesList();
    scheduleSave();
    ui.ruleModal.classList.add("hidden");
  }

  function deleteRule(index) {
    const ruleName = currentSettings.customRules[index].name;
    showConfirmModal(
      `Tem a certeza que deseja excluir a regra "${ruleName}"?`,
      () => {
        currentSettings.customRules.splice(index, 1);
        renderRulesList();
        scheduleSave();
        showNotification(`Regra "${ruleName}" excluída.`, "info");
      }
    );
  }

  function duplicateRule(index) {
    const originalRule = currentSettings.customRules[index];
    const newRule = JSON.parse(JSON.stringify(originalRule));
    newRule.name += " (cópia)";
    currentSettings.customRules.splice(index + 1, 0, newRule);
    renderRulesList();
    scheduleSave();
    showNotification(`Regra "${originalRule.name}" duplicada.`, "info");
  }

  // NOVO: Funções para regras de renomeação
  function openModalForRenamingRuleAdd() {
    ui.renamingModalTitle.textContent = "Adicionar Nova Regra de Renomeação";
    ui.renamingRuleForm.reset();
    ui.renamingRuleId.value = "";
    ui.renamingRuleName.value = "";
    ui.renamingRulePriority.value = 100;
    ui.renamingRuleEnabled.checked = true;
    ui.renamingRuleConditionOperator.value = "AND";
    ui.renamingConditionsContainer.innerHTML = "";
    ui.renamingConditionsContainer.appendChild(
      createRenamingConditionElement()
    );
    ui.renamingStrategiesContainer.innerHTML = "";
    ui.renamingStrategiesContainer.appendChild(createRenamingStrategyElement());
    ui.renamingOptionWaitForLoad.checked = false;
    ui.renamingOptionCacheResult.checked = true;
    ui.renamingOptionRespectManualChanges.checked = true;
    ui.renamingOptionRetryAttempts.value = 1;

    ui.renamingRuleModal.classList.remove("hidden");
  }

  function openModalForRenamingRuleEdit(ruleId) {
    const rule = currentSettings.tabRenamingRules.find((r) => r.id === ruleId);
    if (!rule) {
      showNotification("Regra de renomeação não encontrada.", "error");
      return;
    }

    ui.renamingModalTitle.textContent = "Editar Regra de Renomeação";
    ui.renamingRuleId.value = rule.id;
    ui.renamingRuleName.value = rule.name;
    ui.renamingRulePriority.value = rule.priority || 100;
    ui.renamingRuleEnabled.checked = rule.enabled !== false; // Padrão é true
    ui.renamingRuleConditionOperator.value = rule.conditionOperator || "AND";

    ui.renamingConditionsContainer.innerHTML = "";
    // Lógica simplificada: assume que as regras estão sempre no novo formato
    // devido à migração que acontece na função loadSettings().
    const conditionsToRender = rule.conditions || [];

    if (conditionsToRender.length > 0) {
      conditionsToRender.forEach((c) =>
        ui.renamingConditionsContainer.appendChild(
          createRenamingConditionElement(c)
        )
      );
    } else {
      ui.renamingConditionsContainer.appendChild(
        createRenamingConditionElement()
      );
    }

    ui.renamingStrategiesContainer.innerHTML = "";
    if (rule.renamingStrategies && rule.renamingStrategies.length > 0) {
      rule.renamingStrategies.forEach((s) =>
        ui.renamingStrategiesContainer.appendChild(
          createRenamingStrategyElement(s)
        )
      );
    } else {
      ui.renamingStrategiesContainer.appendChild(
        createRenamingStrategyElement()
      );
    }

    // Opções avançadas
    ui.renamingOptionWaitForLoad.checked = rule.options?.waitForLoad || false;
    ui.renamingOptionCacheResult.checked = rule.options?.cacheResult !== false; // Padrão é true
    ui.renamingOptionRespectManualChanges.checked =
      rule.options?.respectManualChanges !== false; // Padrão é true
    ui.renamingOptionRetryAttempts.value = rule.options?.retryAttempts || 1;

    ui.renamingRuleModal.classList.remove("hidden");
  }

  function handleRenamingRuleFormSubmit(e) {
    e.preventDefault();
    const ruleId = ui.renamingRuleId.value;

    // Coletar condições
    const conditions = Array.from(ui.renamingConditionsContainer.children)
      .map((div) => ({
        property: div.querySelector(".condition-property").value,
        operator: div.querySelector(".condition-operator").value,
        value: div.querySelector(".condition-value").value.trim(),
      }))
      .filter((c) => c.value);

    if (conditions.length === 0) {
      showNotification(
        "Uma regra de renomeação deve ter pelo menos uma condição válida.",
        "error"
      );
      return;
    }

    // Coletar estratégias
    const strategiesElements = Array.from(
      ui.renamingStrategiesContainer.children
    );
    const renamingStrategies = strategiesElements
      .map((strategyDiv) => {
        const collectStrategyData = (container, type) => {
          const strategy = { type };
          if (type === "css_extract") {
            strategy.selector =
              container.querySelector(".strategy-selector")?.value.trim() || "";
            strategy.attribute =
              container.querySelector(".strategy-attribute")?.value.trim() ||
              null;
          } else if (type === "title_manipulation") {
            const opsContainer = container.querySelector(
              ".text-operations-container"
            );
            if (opsContainer) {
              strategy.operations = Array.from(opsContainer.children)
                .map((opDiv) => {
                  const action = opDiv.querySelector(".operation-action").value;
                  const operation = { action };
                  // ... (código de coleta de operações de texto)
                  if (
                    action === "replace" ||
                    action === "remove" ||
                    action === "extract"
                  ) {
                    operation.pattern =
                      opDiv.querySelector(".operation-pattern")?.value.trim() ||
                      "";
                    operation.flags =
                      opDiv.querySelector(".operation-flags")?.value.trim() ||
                      null;
                    if (action === "replace") {
                      operation.replacement =
                        opDiv.querySelector(".operation-replacement")?.value ||
                        "";
                    }
                    if (action === "extract") {
                      const groupVal =
                        opDiv.querySelector(".operation-group")?.value;
                      operation.group = groupVal
                        ? parseInt(groupVal, 10)
                        : undefined;
                    }
                  } else if (action === "prepend" || action === "append") {
                    operation.text =
                      opDiv.querySelector(".operation-text")?.value || "";
                  } else if (action === "truncate") {
                    operation.maxLength = parseInt(
                      opDiv.querySelector(".operation-max-length")?.value,
                      10
                    );
                    operation.ellipsis =
                      opDiv
                        .querySelector(".operation-ellipsis")
                        ?.value.trim() || null;
                  }
                  return operation;
                })
                .filter(
                  (op) =>
                    !(
                      (op.action === "replace" ||
                        op.action === "remove" ||
                        op.action === "extract") &&
                      !op.pattern
                    ) &&
                    !(
                      (op.action === "prepend" || op.action === "append") &&
                      !op.text
                    ) &&
                    !(
                      op.action === "truncate" &&
                      (isNaN(op.maxLength) || op.maxLength <= 0)
                    )
                );
            }
          }
          return strategy;
        };

        const mainStrategyType =
          strategyDiv.querySelector(".strategy-type").value;
        const mainFieldsContainer =
          strategyDiv.querySelector(".strategy-fields");
        const mainStrategy = collectStrategyData(
          mainFieldsContainer,
          mainStrategyType
        );

        const fallbackSelect = strategyDiv.querySelector(".strategy-fallback");
        const fallbackType = fallbackSelect.value;
        if (fallbackType) {
          const fallbackContainer = strategyDiv.querySelector(
            ".fallback-config-container"
          );
          mainStrategy.fallback = collectStrategyData(
            fallbackContainer,
            fallbackType
          );
        } else {
          mainStrategy.fallback = null;
        }

        return mainStrategy;
      })
      .filter((s) => {
        // Filtra estratégias vazias ou inválidas
        if (s.type === "css_extract" && !s.selector) return false;
        if (
          s.type === "title_manipulation" &&
          (!s.operations || s.operations.length === 0)
        )
          return false;
        return true;
      });

    if (renamingStrategies.length === 0) {
      showNotification(
        "Pelo menos uma estratégia de renomeação válida é obrigatória.",
        "error"
      );
      return;
    }

    const newRule = {
      id:
        ruleId ||
        `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: ui.renamingRuleName.value.trim(),
      priority: parseInt(ui.renamingRulePriority.value, 10) || 100,
      enabled: ui.renamingRuleEnabled.checked,
      conditionOperator: ui.renamingRuleConditionOperator.value,
      conditions: conditions,
      renamingStrategies: renamingStrategies,
      options: {
        waitForLoad: ui.renamingOptionWaitForLoad.checked,
        cacheResult: ui.renamingOptionCacheResult.checked,
        respectManualChanges: ui.renamingOptionRespectManualChanges.checked,
        retryAttempts: parseInt(ui.renamingOptionRetryAttempts.value, 10) || 1,
      },
    };

    // Validação final da regra antes de salvar
    // Importar dinamicamente para evitar dependência circular no carregamento inicial
    // O import dinâmico foi movido para o topo do arquivo e alterado para estático.
    // Agora, validateTabRenamingRule está disponível diretamente.
    const validationResult = validateTabRenamingRule(newRule); // Usar a função diretamente
    if (!validationResult.isValid) {
      showNotification(
        `Erro na regra: ${validationResult.errors.join("; ")}`,
        "error"
      );
      console.error(
        "Erro de validação da regra de renomeação:",
        validationResult.errors
      );
      return;
    }

    const existingRuleIndex = currentSettings.tabRenamingRules.findIndex(
      (r) => r.id === newRule.id
    );
    if (existingRuleIndex !== -1) {
      currentSettings.tabRenamingRules[existingRuleIndex] = newRule;
    } else {
      currentSettings.tabRenamingRules.push(newRule);
    }

    // Reordenar as regras por prioridade
    currentSettings.tabRenamingRules.sort(
      (a, b) => (a.priority || 999) - (b.priority || 999)
    );

    renderRenamingRulesList();
    scheduleSave();
    ui.renamingRuleModal.classList.add("hidden");
  }

  function deleteRenamingRule(ruleId) {
    const rule = currentSettings.tabRenamingRules.find((r) => r.id === ruleId);
    if (!rule) return;

    showConfirmModal(
      `Tem a certeza que deseja excluir a regra de renomeação "${rule.name}"?`,
      () => {
        currentSettings.tabRenamingRules =
          currentSettings.tabRenamingRules.filter((r) => r.id !== ruleId);
        renderRenamingRulesList();
        scheduleSave();
        showNotification(`Regra "${rule.name}" excluída.`, "info");
      }
    );
  }

  function duplicateRenamingRule(ruleId) {
    const originalRule = currentSettings.tabRenamingRules.find(
      (r) => r.id === ruleId
    );
    if (!originalRule) return;

    const newRule = JSON.parse(JSON.stringify(originalRule));
    newRule.id = `rule-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`; // Novo ID
    newRule.name += " (cópia)";

    currentSettings.tabRenamingRules.push(newRule);
    currentSettings.tabRenamingRules.sort(
      (a, b) => (a.priority || 999) - (b.priority || 999)
    ); // Reordenar

    renderRenamingRulesList();
    scheduleSave();
    showNotification(`Regra "${originalRule.name}" duplicada.`, "info");
  }

  /**
   * Exibe um modal de confirmação genérico.
   * @param {string} text - A mensagem a ser exibida no modal.
   * @param {function} callback - A função a ser executada se o utilizador confirmar.
   * @param {object} [options] - Opções para personalizar o botão de confirmação.
   * @param {string} [options.confirmText='Confirmar'] - O texto do botão de confirmação.
   * @param {string} [options.confirmClass='bg-red-600...'] - As classes CSS para o botão de confirmação.
   */
  function showConfirmModal(text, callback, options = {}) {
    ui.confirmModalText.textContent = text;
    confirmCallback = callback;

    // Redefine para o estilo padrão (vermelho, para exclusão)
    ui.confirmOkBtn.textContent = "Confirmar";
    ui.confirmOkBtn.className =
      "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors";

    // Aplica personalizações se fornecidas
    if (options.confirmText) {
      ui.confirmOkBtn.textContent = options.confirmText;
    }
    if (options.confirmClass) {
      ui.confirmOkBtn.className = options.confirmClass;
    }

    ui.confirmModal.classList.remove("hidden");
  }

  function validateSettingsObject(imported) {
    if (typeof imported !== "object" || imported === null) {
      return {
        valid: false,
        error: "O ficheiro não contém um objeto de configurações válido.",
      };
    }
    // Validação mais rigorosa para importação
    if (
      typeof imported.autoGroupingEnabled !== "boolean" ||
      !Array.isArray(imported.customRules) ||
      (imported.tabRenamingEnabled !== undefined &&
        typeof imported.tabRenamingEnabled !== "boolean") || // NOVO
      (imported.tabRenamingRules !== undefined &&
        !Array.isArray(imported.tabRenamingRules)) // NOVO
    ) {
      return {
        valid: false,
        error:
          "O formato do ficheiro é inválido ou de uma versão incompatível.",
      };
    }
    return { valid: true, settings: { ...currentSettings, ...imported } };
  }

  function showNotification(message, type = "info") {
    const n = document.createElement("div");
    const c = {
      success:
        "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/50 dark:border-green-600 dark:text-green-200",
      error:
        "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/50 dark:border-red-600 dark:text-red-200",
      info: "bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/50 dark:border-blue-600 dark:text-blue-200",
    };
    n.className = `p-4 border-l-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out opacity-0 translate-y-2 ${c[type]}`;
    n.textContent = message;
    ui.notificationContainer.appendChild(n);
    setTimeout(() => n.classList.remove("opacity-0", "translate-y-2"), 10);
    setTimeout(() => {
      n.classList.add("opacity-0");
      n.addEventListener("transitionend", () => n.remove());
    }, 4000);
  }
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
  function updateDynamicUI() {
    ui.ungroupSingleTabsTimeout.disabled = !ui.ungroupSingleTabs.checked;
    ui.ungroupSingleTabsTimeout.parentElement.style.opacity = ui
      .ungroupSingleTabs.checked
      ? 1
      : 0.6;

    // NOVO: Habilita/desabilita a seção de regras de renomeação
    const renamingSection = ui.renamingRulesList.closest("section");
    if (renamingSection) {
      const isDisabled = !ui.tabRenamingEnabled.checked;
      renamingSection.classList.toggle("disabled-section", isDisabled);
      renamingSection
        .querySelectorAll("button, input, select, textarea")
        .forEach((el) => {
          el.disabled = isDisabled;
        });
      // Re-habilita o próprio toggle de renomeação
      ui.tabRenamingEnabled.disabled = false;
    }
  }

  // --- INICIALIZAÇÃO E EVENT LISTENERS ---

  async function initialize() {
    await loadSettings();

    const autoSaveFields = [
      "theme",
      "groupingMode",
      "minTabsForAutoGroup",
      "uncollapseOnActivate",
      "autoCollapseTimeout",
      "ungroupSingleTabs",
      "ungroupSingleTabsTimeout",
      "exceptionsList",
      "showTabCount",
      "syncEnabled",
      "logLevel",
      "titleDelimiters",
      "domainSanitizationTlds",
      "titleSanitizationNoise",
      "tabRenamingEnabled", // NOVO
    ];
    autoSaveFields.forEach((id) => {
      const el = ui[id];
      if (!el) return;
      const ev =
        el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, scheduleSave);
    });

    ui.theme.addEventListener("change", () => applyTheme(ui.theme.value));
    ui.ungroupSingleTabs.addEventListener("change", updateDynamicUI);
    ui.tabRenamingEnabled.addEventListener("change", updateDynamicUI); // NOVO
    ui.ruleTesterUrl.addEventListener("input", testCurrentRule);
    ui.ruleTesterTitle.addEventListener("input", testCurrentRule);

    // Agrupamento
    ui.addRuleBtn.addEventListener("click", openModalForAdd);
    ui.cancelRuleBtn.addEventListener("click", () =>
      ui.ruleModal.classList.add("hidden")
    );
    ui.ruleForm.addEventListener("submit", handleRuleFormSubmit);
    ui.rulesList.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      const index = parseInt(button.closest(".rule-item").dataset.index, 10);
      if (action === "edit") openModalForEdit(index);
      else if (action === "delete") deleteRule(index);
      else if (action === "duplicate") duplicateRule(index);
    });

    // NOVO: Renomeação
    ui.addRenamingRuleBtn.addEventListener(
      "click",
      openModalForRenamingRuleAdd
    );
    ui.cancelRenamingRuleBtn.addEventListener("click", () =>
      ui.renamingRuleModal.classList.add("hidden")
    );
    ui.renamingRuleForm.addEventListener(
      "submit",
      handleRenamingRuleFormSubmit
    );
    ui.renamingRulesList.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      const ruleItem = button.closest(".rule-item");
      const ruleId = ruleItem.dataset.id;
      if (action === "edit") openModalForRenamingRuleEdit(ruleId);
      else if (action === "delete") deleteRenamingRule(ruleId);
      else if (action === "duplicate") duplicateRenamingRule(ruleId);
    });

    ui.importBtn.addEventListener("click", () => ui.importFile.click());
    ui.exportBtn.addEventListener("click", async () => {
      const settingsToExport = await browser.runtime.sendMessage({
        action: "getSettings",
      });
      const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], {
        type: "application/json",
      });
      browser.downloads.download({
        url: URL.createObjectURL(blob),
        filename: `auto-tab-grouper-settings-${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        saveAs: true,
      });
    });
    ui.importFile.addEventListener("change", (e) => {
      // CORRIGIDO: Lógica de importação robusta
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const importedObject = JSON.parse(ev.target.result);
          const {
            valid,
            error,
            settings: validatedSettings,
          } = validateSettingsObject(importedObject);

          if (!valid) {
            showNotification(error, "error");
            return;
          }

          showConfirmModal(
            "Tem a certeza que deseja substituir as suas configurações atuais por aquelas do ficheiro importado? Esta ação não pode ser desfeita.",
            async () => {
              try {
                await browser.runtime.sendMessage({
                  action: "updateSettings",
                  settings: validatedSettings,
                });
                await loadSettings();
                showNotification(
                  "Configurações importadas com sucesso!",
                  "success"
                );
              } catch (updateError) {
                console.error(
                  "Erro ao aplicar configurações importadas:",
                  updateError
                );
                showNotification(
                  "Ocorreu um erro ao aplicar as configurações importadas.",
                  "error"
                );
              }
            },
            {
              confirmText: "Sim, Importar",
              confirmClass:
                "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors",
            }
          );
        } catch (err) {
          showNotification(
            "Erro ao processar o ficheiro. Verifique se é um JSON válido.",
            "error"
          );
        } finally {
          e.target.value = "";
        }
      };
      reader.readAsText(file);
    });
    ui.confirmCancelBtn.addEventListener("click", () =>
      ui.confirmModal.classList.add("hidden")
    );
    ui.confirmOkBtn.addEventListener("click", () => {
      if (typeof confirmCallback === "function") confirmCallback();
      ui.confirmModal.classList.add("hidden");
    });

    // NOVO: Processa os parâmetros da URL para abrir o modal
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new_rule") {
      openModalForAdd(); // Abre o modal

      // Preenche os campos a partir dos parâmetros
      if (params.has("name")) {
        ui.ruleName.value = params.get("name");
      }

      if (params.has("patterns")) {
        const patterns = params.get("patterns").split("\n");
        ui.conditionsContainer.innerHTML = ""; // Limpa a condição padrão
        patterns.forEach((pattern) => {
          const value = pattern.replace(/\*/g, ""); // Remove wildcards
          ui.conditionsContainer.appendChild(
            createConditionElement({
              property: "hostname",
              operator: "contains",
              value: value,
            })
          );
        });
        ui.ruleOperator.value = "OR";
      }

      if (params.has("url")) {
        try {
          const url = new URL(params.get("url"));
          if (!ui.ruleName.value) {
            ui.ruleName.value = url.hostname.replace(/^www\./, "");
          }
          ui.conditionsContainer.innerHTML = ""; // Limpa a condição padrão
          ui.conditionsContainer.appendChild(
            createConditionElement({
              property: "hostname",
              operator: "equals",
              value: url.hostname,
            })
          );
        } catch (e) {
          /* Ignora URLs inválidas */
        }
      }
    }
  }

  // --- Funções de Diagnóstico de Memória ---

  async function updateMemoryStats() {
    try {
      const stats = await browser.runtime.sendMessage({
        action: "getMemoryStats",
      });
      console.log("Estatísticas recebidas:", stats); // Debug log

      if (stats) {
        // Atualiza tamanhos dos mapas
        if (stats.sizes) {
          ui.memoryTabGroupMap.textContent = stats.sizes.tabGroupMap || "0";
          ui.memoryTitleUpdaters.textContent =
            stats.sizes.debouncedTitleUpdaters || "0";
          ui.memoryGroupActivity.textContent = stats.sizes.groupActivity || "0";
          ui.memorySmartCache.textContent = stats.sizes.smartNameCache || "0";
          ui.memoryInjectionFailures.textContent =
            stats.sizes.injectionFailureMap || "0";
          ui.memoryPendingGroups.textContent =
            stats.sizes.pendingAutomaticGroups || "0";
        } else {
          // Se sizes não está disponível, mostra 0
          ui.memoryTabGroupMap.textContent = "0";
          ui.memoryTitleUpdaters.textContent = "0";
          ui.memoryGroupActivity.textContent = "0";
          ui.memorySmartCache.textContent = "0";
          ui.memoryInjectionFailures.textContent = "0";
          ui.memoryPendingGroups.textContent = "0";
        }

        // Atualiza estatísticas de limpeza
        if (stats.lastCleanup) {
          ui.lastCleanupTime.textContent = new Date(
            stats.lastCleanup
          ).toLocaleString();
        } else {
          ui.lastCleanupTime.textContent = "Nunca";
        }

        ui.totalCleaned.textContent = stats.totalCleaned || "0";
        ui.cleanupCycles.textContent = stats.cleanupCycles || "0";
      } else {
        console.warn("Nenhuma estatística recebida");
        // Define valores padrão se não houver dados
        ui.memoryTabGroupMap.textContent = "N/A";
        ui.memoryTitleUpdaters.textContent = "N/A";
        ui.memoryGroupActivity.textContent = "N/A";
        ui.memorySmartCache.textContent = "N/A";
        ui.memoryInjectionFailures.textContent = "N/A";
        ui.memoryPendingGroups.textContent = "N/A";
        ui.lastCleanupTime.textContent = "N/A";
        ui.totalCleaned.textContent = "N/A";
        ui.cleanupCycles.textContent = "N/A";
      }
    } catch (error) {
      console.error("Erro ao obter estatísticas de memória:", error);
      showNotification("Erro ao obter estatísticas de memória", "error");
      // Define valores de erro
      ui.memoryTabGroupMap.textContent = "Erro";
      ui.memoryTitleUpdaters.textContent = "Erro";
      ui.memoryGroupActivity.textContent = "Erro";
      ui.memorySmartCache.textContent = "Erro";
      ui.memoryInjectionFailures.textContent = "Erro";
      ui.memoryPendingGroups.textContent = "Erro";
      ui.lastCleanupTime.textContent = "Erro";
      ui.totalCleaned.textContent = "Erro";
      ui.cleanupCycles.textContent = "Erro";
    }
  }

  async function performMemoryCleanup() {
    try {
      ui.cleanupMemory.disabled = true;
      ui.cleanupMemory.textContent = "Limpando...";

      const result = await browser.runtime.sendMessage({
        action: "cleanupMemory",
      });
      if (result) {
        showNotification(
          `Limpeza concluída: ${result.cleaned || 0} entradas removidas`,
          "success"
        );
        await updateMemoryStats(); // Atualiza estatísticas após limpeza
      }
    } catch (error) {
      console.error("Erro durante limpeza de memória:", error);
      showNotification("Erro durante limpeza de memória", "error");
    } finally {
      ui.cleanupMemory.disabled = false;
      ui.cleanupMemory.textContent = "Limpar Memória";
    }
  }

  // Event listeners para diagnóstico de memória
  if (ui.refreshMemoryStats) {
    ui.refreshMemoryStats.addEventListener("click", updateMemoryStats);
  }

  if (ui.cleanupMemory) {
    ui.cleanupMemory.addEventListener("click", performMemoryCleanup);
  }

  // NOVO: Limpeza de Cache
  async function performCacheClear() {
    showConfirmModal(
      "Tem a certeza que deseja limpar todo o cache de nomes? Esta ação não pode ser desfeita e pode impactar a performance temporariamente.",
      async () => {
        try {
          ui.clearCacheBtn.disabled = true;
          ui.clearCacheBtn.textContent = "Limpando...";
          clearSmartNameCache();
          showNotification("Cache de nomes limpo com sucesso!", "success");
          await updateMemoryStats(); // Atualiza as estatísticas para refletir o cache limpo
        } catch (error) {
          console.error("Erro ao limpar o cache:", error);
          showNotification("Ocorreu um erro ao limpar o cache.", "error");
        } finally {
          ui.clearCacheBtn.disabled = false;
          ui.clearCacheBtn.textContent = "Limpar Cache";
        }
      },
      {
        confirmText: "Sim, Limpar Cache",
      }
    );
  }

  if (ui.clearCacheBtn) {
    ui.clearCacheBtn.addEventListener("click", performCacheClear);
  }

  // --- Funções de Configuração de Performance ---

  async function loadPerformanceConfig() {
    try {
      const config = await browser.runtime.sendMessage({
        action: "getPerformanceConfig",
      });
      if (config) {
        if (ui.queueDelay) ui.queueDelay.value = config.QUEUE_DELAY || 500;
        if (ui.batchSize) ui.batchSize.value = config.BATCH_SIZE || 50;
        if (ui.maxInjectionRetries)
          ui.maxInjectionRetries.value = config.MAX_INJECTION_RETRIES || 3;
        if (ui.performanceLogging)
          ui.performanceLogging.checked = config.BATCH_PERFORMANCE_LOG || false;
      }
    } catch (error) {
      console.error("Erro ao carregar configuração de performance:", error);
    }
  }

  async function savePerformanceConfig() {
    try {
      const config = {
        QUEUE_DELAY: parseInt(ui.queueDelay?.value) || 500,
        BATCH_SIZE: parseInt(ui.batchSize?.value) || 50,
        MAX_INJECTION_RETRIES: parseInt(ui.maxInjectionRetries?.value) || 3,
        BATCH_PERFORMANCE_LOG: ui.performanceLogging?.checked || false,
      };

      await browser.runtime.sendMessage({
        action: "updatePerformanceConfig",
        config,
      });

      showNotification("Configurações de performance salvas", "success");
    } catch (error) {
      console.error("Erro ao salvar configuração de performance:", error);
      showNotification("Erro ao salvar configurações de performance", "error");
    }
  }

  async function resetPerformanceConfig() {
    // Substituído `confirm` por `showConfirmModal`
    showConfirmModal(
      "Restaurar todas as configurações de performance para os valores padrão?",
      async () => {
        try {
          const defaultConfig = {
            QUEUE_DELAY: 500,
            BATCH_SIZE: 50,
            MAX_INJECTION_RETRIES: 3,
            BATCH_PERFORMANCE_LOG: false,
          };

          await browser.runtime.sendMessage({
            action: "updatePerformanceConfig",
            config: defaultConfig,
          });

          await loadPerformanceConfig(); // Recarrega a interface
          showNotification("Configurações restauradas para padrão", "success");
        } catch (error) {
          console.error("Erro ao resetar configurações:", error);
          showNotification("Erro ao restaurar configurações", "error");
        }
      }
    );
  }

  // Event listeners para configuração de performance
  if (ui.savePerformanceConfig) {
    ui.savePerformanceConfig.addEventListener("click", savePerformanceConfig);
  }

  if (ui.resetPerformanceConfig) {
    ui.resetPerformanceConfig.addEventListener("click", resetPerformanceConfig);
  }

  initialize();
  initializeHelpTooltips();

  // Carrega configurações iniciais
  setTimeout(updateMemoryStats, 1000);
  setTimeout(loadPerformanceConfig, 1500);
});
