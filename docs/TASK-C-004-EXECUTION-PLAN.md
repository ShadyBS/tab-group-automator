# 🔧 PLANO DE EXECUÇÃO ROBUSTO - TASK-C-004

**Data:** 2024-12-19  
**Tarefa:** Implementar CSP Rigorosa para Tab Extensions  
**Prioridade:** CRÍTICA  
**Estimativa:** 8 horas  
**Responsável:** Security Engineer + Frontend Developer  

---

## 📋 RESUMO DA TASK

### 🎯 Objetivo
Remover 'unsafe-inline' da CSP e refatorar código para usar práticas seguras, mantendo todas as funcionalidades de tab management.

### 💥 Problema Atual
- CSP permite 'unsafe-inline', criando vulnerabilidades XSS
- Uso extensivo de `innerHTML` em popup.js e options.js
- Sem proteção contra scripts maliciosos
- Não atende padrões de segurança Manifest V3

### ✅ Critérios de Aceitação
- [ ] CSP sem 'unsafe-inline' implementada
- [ ] Popup e options funcionam normalmente
- [ ] Tab grouping funciona corretamente
- [ ] Zero CSP violations no console
- [ ] Security scan passa

---

## 🔍 ANÁLISE TÉCNICA

### Arquivos Afetados
1. **manifest.json** - CSP atual com 'unsafe-inline'
2. **popup/popup.js** - 1 uso de innerHTML (linha ~85)
3. **options/options.js** - 29 usos de innerHTML (múltiplas linhas)

### Vulnerabilidades Identificadas
```javascript
// popup/popup.js - Linha ~85
groupAllButton.innerHTML = `<div class="flex items-center...`;

// options/options.js - Múltiplas ocorrências
tooltipContent.innerHTML = text; // Linha ~200
conditionDiv.innerHTML = `<div class="grid...`; // Linha ~250
// ... mais 27 ocorrências
```

---

## 🚀 PLANO DE EXECUÇÃO

### FASE 1: PREPARAÇÃO (30 min)
#### 1.1 Backup e Validação
```bash
# Criar backup dos arquivos críticos
cp manifest.json manifest.json.backup
cp popup/popup.js popup/popup.js.backup  
cp options/options.js options/options.js.backup
```

#### 1.2 Análise de Dependências
- [x] Identificar todos os usos de innerHTML
- [x] Mapear funcionalidades que dependem de HTML dinâmico
- [x] Verificar compatibilidade com nonce-based CSP

### FASE 2: REFATORAÇÃO DE CÓDIGO (5 horas)

#### 2.1 Criar Utilitários Seguros (45 min)
**Arquivo:** `src/dom-utils.js`
```javascript
/**
 * Utilitários seguros para manipulação DOM sem innerHTML
 */

// Função para criar elementos com atributos e texto
export function createElement(tag, attributes = {}, textContent = '') {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (textContent) {
    element.textContent = textContent;
  }
  
  return element;
}

// Função para criar estruturas complexas
export function createElementTree(structure) {
  const { tag, attributes, textContent, children } = structure;
  const element = createElement(tag, attributes, textContent);
  
  if (children) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(createElementTree(child));
      }
    });
  }
  
  return element;
}

// Função segura para substituir innerHTML
export function replaceContent(container, newContent) {
  // Limpa conteúdo existente
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  // Adiciona novo conteúdo
  if (typeof newContent === 'string') {
    container.textContent = newContent;
  } else if (newContent instanceof Node) {
    container.appendChild(newContent);
  } else if (Array.isArray(newContent)) {
    newContent.forEach(item => {
      if (typeof item === 'string') {
        container.appendChild(document.createTextNode(item));
      } else {
        container.appendChild(item);
      }
    });
  }
}
```

#### 2.2 Refatorar popup/popup.js (30 min)
**Localização:** Linha ~85
```javascript
// ANTES (inseguro)
groupAllButton.innerHTML = `<div class="flex items-center justify-center space-x-2">...`;

// DEPOIS (seguro)
import { createElement, replaceContent } from '../src/dom-utils.js';

// Criar estrutura do loading button
const loadingContent = createElement('div', {
  className: 'flex items-center justify-center space-x-2'
});

const spinner = createElement('svg', {
  className: 'animate-spin h-5 w-5 text-white',
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  viewBox: '0 0 24 24'
});

const circle = createElement('circle', {
  className: 'opacity-25',
  cx: '12',
  cy: '12', 
  r: '10',
  stroke: 'currentColor',
  'stroke-width': '4'
});

const path = createElement('path', {
  className: 'opacity-75',
  fill: 'currentColor',
  d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
});

spinner.appendChild(circle);
spinner.appendChild(path);
loadingContent.appendChild(spinner);
loadingContent.appendChild(createElement('span', {}, 'Agrupando...'));

replaceContent(groupAllButton, loadingContent);
```

#### 2.3 Refatorar options/options.js (3.5 horas)

##### 2.3.1 Tooltips Seguros (30 min)
```javascript
// ANTES
tooltipContent.innerHTML = text;

// DEPOIS  
function createTooltipContent(htmlText) {
  const container = createElement('div');
  
  // Parser seguro para HTML simples (apenas tags permitidas)
  const allowedTags = ['ul', 'li', 'a', 'strong', 'code', 'br'];
  const sanitizedContent = sanitizeAndParseHTML(htmlText, allowedTags);
  
  replaceContent(container, sanitizedContent);
  return container;
}
```

##### 2.3.2 Condições de Regras (45 min)
```javascript
// ANTES
conditionDiv.innerHTML = `<div class="grid grid-cols-1...`;

// DEPOIS
function createConditionElement(condition = {}) {
  const conditionDiv = createElement('div', {
    className: 'condition-item bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-600'
  });
  
  const gridContainer = createElement('div', {
    className: 'grid grid-cols-1 md:grid-cols-12 gap-3 items-center'
  });
  
  // Criar select de propriedade
  const propertySelect = createElement('select', {
    className: 'condition-property w-full p-2 border border-slate-300 rounded-md shadow-sm dark:bg-slate-900 dark:border-slate-600'
  });
  
  // Adicionar options de forma segura
  const propertyOptions = [
    { value: 'url', text: 'URL Completa' },
    { value: 'hostname', text: 'Domínio (ex: google.com)' },
    { value: 'url_path', text: 'Caminho da URL (ex: /noticias)' },
    { value: 'title', text: 'Título da Aba' }
  ];
  
  propertyOptions.forEach(opt => {
    const option = createElement('option', { value: opt.value }, opt.text);
    propertySelect.appendChild(option);
  });
  
  // Continuar construção...
  const propertyDiv = createElement('div', { className: 'md:col-span-3' });
  propertyDiv.appendChild(propertySelect);
  gridContainer.appendChild(propertyDiv);
  
  conditionDiv.appendChild(gridContainer);
  return conditionDiv;
}
```

##### 2.3.3 Estratégias de Renomeação (1 hora)
```javascript
// Refatorar todas as funções que usam innerHTML para criar elementos
// usando o padrão createElement + appendChild
```

##### 2.3.4 Listas de Regras (1 hora)
```javascript
// ANTES
ui.rulesList.innerHTML = "";
ruleElement.innerHTML = `<div class="flex items-center...`;

// DEPOIS
function renderRulesList() {
  replaceContent(ui.rulesList, []);
  
  const rules = currentSettings.customRules || [];
  if (rules.length === 0) {
    const emptyMessage = createElement('p', {
      className: 'text-slate-500 italic text-center p-4 dark:text-slate-400'
    }, 'Nenhuma regra personalizada ainda.');
    
    ui.rulesList.appendChild(emptyMessage);
    return;
  }
  
  rules.forEach((rule, index) => {
    const ruleElement = createRuleElement(rule, index);
    ui.rulesList.appendChild(ruleElement);
  });
}
```

##### 2.3.5 Testador de Regras (30 min)
```javascript
// ANTES
ui.ruleTesterResult.innerHTML = resultHtml;

// DEPOIS
function updateRuleTesterResult(resultData) {
  const container = createElement('div');
  
  if (resultData.matchingRule) {
    const groupingText = createElement('div');
    groupingText.appendChild(document.createTextNode('Agrupamento: '));
    
    const ruleName = createElement('strong', {
      className: 'text-indigo-600 dark:text-indigo-400'
    }, resultData.matchingRule.name);
    
    groupingText.appendChild(ruleName);
    container.appendChild(groupingText);
  }
  
  replaceContent(ui.ruleTesterResult, container);
}
```

### FASE 3: IMPLEMENTAÇÃO CSP RIGOROSA (1.5 horas)

#### 3.1 Atualizar manifest.json (15 min)
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'self';"
  }
}
```

#### 3.2 Implementar Nonce-based CSP (45 min)
**Arquivo:** `src/csp-manager.js`
```javascript
/**
 * Gerenciador de CSP com nonce para scripts necessários
 */

// Gerar nonce único para cada carregamento
export function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array));
}

// Aplicar nonce a scripts dinâmicos se necessário
export function createSecureScript(src, nonce) {
  const script = document.createElement('script');
  script.src = src;
  script.nonce = nonce;
  return script;
}
```

#### 3.3 Configurar CSP Específica para Tab Operations (30 min)
```javascript
// Adicionar meta tag CSP específica se necessário
const cspMeta = document.createElement('meta');
cspMeta.httpEquiv = 'Content-Security-Policy';
cspMeta.content = "script-src 'self'; object-src 'none'; base-uri 'self';";
document.head.appendChild(cspMeta);
```

### FASE 4: TESTES E VALIDAÇÃO (1 hora)

#### 4.1 Testes Funcionais (30 min)
- [ ] Popup abre e funciona normalmente
- [ ] Toggle de agrupamento funciona
- [ ] Botão "Agrupar Abas Abertas" funciona
- [ ] Sugestões aparecem corretamente
- [ ] Página de opções carrega completamente
- [ ] Criação/edição de regras funciona
- [ ] Testador de regras funciona
- [ ] Import/export funciona

#### 4.2 Testes de Segurança (30 min)
```javascript
// Verificar CSP violations no console
console.log('Verificando CSP violations...');

// Tentar injeção XSS (deve falhar)
try {
  document.body.innerHTML = '<script>alert("XSS")</script>';
  console.error('CSP FALHOU - XSS possível!');
} catch (e) {
  console.log('CSP funcionando - XSS bloqueado');
}

// Verificar se eval está bloqueado
try {
  eval('console.log("eval funcionando")');
  console.error('CSP FALHOU - eval possível!');
} catch (e) {
  console.log('CSP funcionando - eval bloqueado');
}
```

---

## 🔧 IMPLEMENTAÇÃO DETALHADA

### Estrutura de Arquivos
```
tab-group-automator/
├── src/
│   ├── dom-utils.js          # NOVO - Utilitários DOM seguros
│   ├── csp-manager.js        # NOVO - Gerenciador CSP
│   └── html-sanitizer.js     # NOVO - Sanitizador HTML
├── popup/
│   ├── popup.html           # Sem alterações
│   └── popup.js             # REFATORADO - Sem innerHTML
├── options/
│   ├── options.html         # Sem alterações  
│   └── options.js           # REFATORADO - Sem innerHTML
└── manifest.json            # ATUALIZADO - CSP rigorosa
```

### Funções Auxiliares Necessárias

#### HTML Sanitizer Seguro
```javascript
// src/html-sanitizer.js
export function sanitizeAndParseHTML(htmlString, allowedTags = []) {
  const container = document.createElement('div');
  
  // Parser simples para tags permitidas
  const tagRegex = /<(\/?)([\w-]+)([^>]*)>/g;
  let lastIndex = 0;
  const elements = [];
  
  htmlString.replace(tagRegex, (match, closing, tagName, attributes, offset) => {
    // Adicionar texto antes da tag
    if (offset > lastIndex) {
      const textContent = htmlString.slice(lastIndex, offset);
      elements.push(document.createTextNode(textContent));
    }
    
    if (allowedTags.includes(tagName.toLowerCase())) {
      if (closing) {
        // Tag de fechamento - implementar stack se necessário
      } else {
        // Tag de abertura
        const element = document.createElement(tagName);
        // Processar atributos seguros se necessário
        elements.push(element);
      }
    } else {
      // Tag não permitida - adicionar como texto
      elements.push(document.createTextNode(match));
    }
    
    lastIndex = offset + match.length;
  });
  
  // Adicionar texto restante
  if (lastIndex < htmlString.length) {
    elements.push(document.createTextNode(htmlString.slice(lastIndex)));
  }
  
  return elements;
}
```

---

## ⚠️ RISCOS E MITIGAÇÕES

### Riscos Identificados
1. **Quebra de Funcionalidade** - Refatoração pode quebrar features existentes
2. **Performance** - createElement pode ser mais lento que innerHTML
3. **Complexidade** - Código mais verboso e complexo
4. **Compatibilidade** - CSP rigorosa pode afetar bibliotecas externas

### Mitigações
1. **Testes Extensivos** - Testar cada funcionalidade após refatoração
2. **Backup Completo** - Manter backups de todos os arquivos
3. **Implementação Gradual** - Refatorar um arquivo por vez
4. **Rollback Plan** - Plano para reverter mudanças se necessário

---

## 📊 CHECKLIST DE EXECUÇÃO

### Pré-Implementação
- [ ] Backup de todos os arquivos críticos
- [ ] Análise completa de usos de innerHTML
- [ ] Identificação de dependências externas
- [ ] Preparação do ambiente de teste

### Durante Implementação
- [ ] Criar utilitários DOM seguros
- [ ] Refatorar popup.js
- [ ] Refatorar options.js (tooltips)
- [ ] Refatorar options.js (condições)
- [ ] Refatorar options.js (estratégias)
- [ ] Refatorar options.js (listas)
- [ ] Refatorar options.js (testador)
- [ ] Atualizar manifest.json
- [ ] Implementar CSP manager
- [ ] Configurar CSP específica

### Pós-Implementação
- [ ] Testes funcionais completos
- [ ] Verificação de CSP violations
- [ ] Testes de segurança
- [ ] Validação de performance
- [ ] Documentação de mudanças
- [ ] Commit das alterações

---

## 🎯 RESULTADO ESPERADO

### Segurança Melhorada
- CSP rigorosa sem 'unsafe-inline'
- Proteção contra XSS e code injection
- Conformidade com Manifest V3

### Funcionalidade Mantida
- Todas as features de tab management funcionando
- UI responsiva e intuitiva
- Performance aceitável

### Código Mais Seguro
- Eliminação de innerHTML
- Uso de createElement e textContent
- Validação de inputs

---

## 📝 NOTAS FINAIS

Este plano garante uma implementação segura e robusta da CSP rigorosa, mantendo todas as funcionalidades críticas da extensão. A abordagem gradual e os testes extensivos minimizam os riscos de quebra de funcionalidade.

**Tempo Total Estimado:** 8 horas  
**Prioridade:** CRÍTICA  
**Dependências:** TASK-C-003 (Melhorar Validação de Messages)

---

*Plano criado seguindo as orientações do agents.md e focando em soluções práticas e diretas.*