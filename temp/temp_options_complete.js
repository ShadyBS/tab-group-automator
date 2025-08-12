/**
 * @file options.js
 * @description Lógica para a página de opções da extensão, com suporte para regras complexas.
 */

// Importação estática do módulo de validação.
// Isso resolve problemas de carregamento dinâmico que podem ocorrer em alguns ambientes de extensão.
import { validateTabRenamingRule } from '../validation-utils.js';
import { clearSmartNameCache } from '../intelligent-cache-manager.js';

// Importar utilitários DOM seguros para CSP rigorosa
import {
  createElement,
  replaceContent,
  createSelect,
  // createInputWithLabel, // Removido para evitar warning de variável não usada
} from '../src/dom-utils.js';
import { safeInnerHTML } from '../src/html-sanitizer.js';

// Conteúdo para os tooltips de ajuda contextual.
const helpTexts = {
  groupingMode:
    'Define como os grupos são nomeados. <ul><li><strong>Nomenclatura Inteligente:</strong> Tenta descobrir o nome principal do site (ex: \'Google Docs\').</li><li><strong>Agrupar por Domínio:</strong> Usa o nome do site (ex: \'google.com\').</li><li><strong>Agrupar por Subdomínio:</strong> É mais específico (ex: \'docs.google.com\').</li></ul>',
  minTabsForAutoGroup:
    'Define o número mínimo de abas semelhantes que precisam estar abertas antes que um novo grupo seja criado automaticamente. Use \'1\' para agrupar imediatamente, ou \'2\' (padrão) para evitar grupos com uma única aba.',
  showTabCount:
    'Se ativado, o título de cada grupo mostrará o número de abas que ele contém. Ex: \'Notícias (5)\'. Desative para um visual mais limpo.',
  uncollapseOnActivate:
    'Se ativado, um grupo recolhido será automaticamente expandido quando você clicar em uma das suas abas na barra de abas do Firefox.',
  autoCollapseTimeout:
    'Recolhe automaticamente um grupo que não foi usado por um certo tempo. Isto ajuda a manter sua barra de abas organizada. Deixe \'0\' para desativar esta funcionalidade.',
  ungroupSingleTabs:
    'Se ativado, quando um grupo fica com apenas uma aba, essa aba será automaticamente removida do grupo após um tempo. Isto evita ter grupos com uma única aba.',
  ungroupSingleTabsTimeout:
    'Define o tempo de espera antes de desagrupar uma aba solitária, se a opção acima estiver ativa.',
  theme:
    'Escolha a aparência da extensão. \'Automático\' seguirá o tema claro/escuro do seu sistema operacional.',
  domainSanitizationTlds:
    'TLDs são as terminações de um site (ex: \'.com\', \'.gov.br\'). Listá-los aqui ajuda a criar nomes de grupo melhores (ex: `google.com.br` vira `Google`). Importante: Os mais longos (`.com.br`) devem vir antes dos mais curtos (`.br`).',
  titleSanitizationNoise:
    'Palavras \'ruidosas\' como \'Login\' ou \'Painel\' podem atrapalhar a Nomenclatura Inteligente. Liste aqui palavras que, se encontradas, devem ser ignoradas para ajudar a encontrar o nome verdadeiro do site.',
  titleDelimiters:
    'Caracteres como `|`, `-` ou `—` são frequentemente usados para separar o nome da marca do resto do título (ex: \'Seu Painel | NomeDaEmpresa\'). Informar estes caracteres aqui ajuda a Nomenclatura Inteligente a isolar e extrair o nome da marca com mais precisão.',
  exceptionsList:
    'Liste aqui os sites que você NUNCA quer que sejam agrupados. Insira o domínio (ex: `mail.google.com`), um por linha. Qualquer URL que contenha o texto inserido será ignorada.',
  customRules:
    'Crie regras poderosas para cenários complexos. As regras são verificadas de cima para baixo; a primeira que corresponder será usada. Arraste-as para reordenar a prioridade. <br><a href=\'../help/help.html\' target=\'_blank\' class=\'text-indigo-400 hover:underline\'>Aprenda a dominar as regras.</a>',
  ruleTester:
    'Use este campo para testar como uma URL e um título seriam agrupados com base nas suas regras e configurações atuais. O resultado mostrará qual regra personalizada correspondeu, ou se será usado o agrupamento padrão.',
  syncEnabled:
    'Se ativado, suas configurações e regras serão salvas na sua Conta Firefox e sincronizadas entre seus dispositivos. Se desativado, as configurações ficam salvas apenas neste computador.',
  tabRenaming:
    'Ative a renomeação automática de abas para personalizar os títulos. Crie regras com condições e estratégias para extrair ou manipular o texto do título da aba. As regras são aplicadas em ordem de prioridade.',
  renamingStrategy:
    'Define como o novo título será gerado. <ul><li><strong>Extração CSS:</strong> Tenta pegar texto de um elemento específico na página.</li><li><strong>Manipulação de Título:</strong> Modifica o título atual da aba.</li><li><strong>Baseado em Domínio:</strong> Usa o nome do domínio da aba.</li><li><strong>Título Original:</strong> Mantém o título original da aba (útil como fallback).</li></ul>',
  textOperations:
    'Sequência de operações para manipular o título. As operações são aplicadas uma após a outra. Por exemplo, você pode remover um padrão e depois adicionar um prefixo.',
  renamingRuleName:
    'Dê um nome descritivo para a sua regra, para que você possa identificá-la facilmente na lista. Ex: \'Títulos de Artigos de Notícias\'.',
  renamingPriority:
    'Define a ordem em que as regras são testadas. Um número menor significa uma prioridade maior. Se uma aba corresponder a várias regras, a que tiver o menor número de prioridade será aplicada.',
  renamingConditions:
    'Defina as condições que uma aba deve atender para que esta regra seja aplicada. Você pode combinar múltiplas condições usando \'TODAS\' (AND) ou \'QUALQUER UMA\' (OR).',
  renamingStrategies:
    'Define como o novo título será gerado. As estratégias são tentadas em ordem, de cima para baixo. A primeira que retornar um texto válido será usada.',
  cssSelector:
    'Um seletor CSS aponta para um elemento específico na página web. Use-o para extrair texto de cabeçalhos, títulos ou outros elementos. <br><strong>Exemplos:</strong><ul><li><code>h1</code> (para o cabeçalho principal)</li><li><code>.article-title</code> (para um elemento com a classe \'article-title\')</li><li><code>#main-header</code> (para um elemento com o ID \'main-header\')</li></ul>',
  cssAttribute:
    'Opcional. Se você precisa extrair o valor de um atributo de um elemento em vez do seu texto, especifique o nome do atributo aqui. Comum para imagens (use <code>alt</code>) ou links (use <code>title</code>).',
  regexPattern:
    'Expressões Regulares (Regex) são um padrão de busca poderoso para encontrar e manipular texto. <br><strong>Dica:</strong> Use parênteses <code>()</code> para criar um \'grupo de captura\'. Você pode então usar <code>$1</code>, <code>$2</code>, etc., no campo \'Substituir por\' para se referir ao texto capturado. <br><a href="https://regex101.com/" target="_blank" class="text-indigo-400 hover:underline">Aprenda e teste suas Regex aqui.</a>',
  advancedRenamingOptions:
    'Ajustes finos para o comportamento da regra:<ul><li><strong>Aguardar carregamento:</strong> Útil para sites que carregam o título dinamicamente após a página inicial carregar.</li><li><strong>Armazenar em cache:</strong> Melhora a performance ao salvar o resultado da renomeação, evitando reprocessamento.</li><li><strong>Respeitar alterações manuais:</strong> Se você renomear manualmente uma aba, a extensão não tentará renomeá-la novamente.</li><li><strong>Tentativas de Reaplicação:</strong> Quantas vezes a regra deve tentar ser aplicada se a primeira tentativa falhar (ex: o elemento ainda não apareceu na página).</li></ul>',
  suggestionsEnabled:
    'Ativa ou desativa as sugestões inteligentes de agrupamento. Quando ativado, a extensão analisará seus padrões de uso e sugerirá novos grupos baseados em abas similares que você tem abertas.',
  clearLearningHistory:
    'Remove todos os dados de aprendizado armazenados pela extensão. Isso inclui padrões de agrupamento que foram aprendidos com base nos seus grupos manuais. Use com cuidado, pois esta ação não pode ser desfeita.',
  showLearningData:
    'Mostra uma visão detalhada de todos os dados que a extensão aprendeu sobre seus padrões de agrupamento. Inclui informações sobre domínios, nomes de grupos e datas de expiração dos dados.',
  learningEnabled:
    'Controla se a extensão deve aprender automaticamente com os grupos que você cria manualmente. Quando ativado, a extensão observará seus padrões e melhorará as sugestões futuras. Todos os dados são armazenados localmente e respeitam sua privacidade.',
};

// ...restante do arquivo permanece inalterado...
