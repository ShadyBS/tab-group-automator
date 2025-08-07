# 🔧 TASK-C-002: Plano de Execução Robusto
## Validar CSS Selectors Básicos

**Data:** 2024-12-19  
**Responsável:** Developer  
**Estimativa:** 3 horas  
**Prioridade:** CRÍTICA  

---

## 📋 RESUMO DA TASK

### 🎯 Objetivo
Implementar validação básica de CSS selectors no content script para prevenir manipulação DOM maliciosa e quebra de páginas web.

### 📁 Arquivos Afetados
- `content-script.js` (principal)
- `validation-utils.js` (melhorias)
- `background.js` (validação adicional)

### 🔍 Problema Identificado
O content script executa seletores CSS sem validação básica adequada, criando vulnerabilidades de segurança e possibilidade de quebra de funcionalidades.

---

## 🚨 ANÁLISE ATUAL

### ✅ Pontos Positivos Existentes
1. **Whitelist básica** já implementada no `content-script.js`
2. **Regex de validação** básica já presente
3. **Timeout de 3 segundos** já implementado
4. **Tratamento de erros** básico já existe
5. **Logging** adequado já configurado

### ❌ Pontos de Melhoria Identificados
1. **Whitelist incompleta** - faltam seletores comuns
2. **Regex muito permissiva** - permite caracteres potencialmente perigosos
3. **Validação de atributos** insuficiente
4. **Rate limiting** ausente para content script
5. **Sanitização de output** pode ser melhorada

---

## 🎯 OBJETIVOS ESPECÍFICOS

### 1. Segurança
- [ ] Expandir whitelist de seletores seguros
- [ ] Melhorar regex de validação
- [ ] Implementar rate limiting por aba
- [ ] Validar atributos permitidos

### 2. Funcionalidade
- [ ] Manter compatibilidade com funcionalidades existentes
- [ ] Não quebrar tab renaming
- [ ] Preservar performance
- [ ] Manter timeout adequado

### 3. Robustez
- [ ] Tratamento de edge cases
- [ ] Logging detalhado para debug
- [ ] Fallbacks seguros
- [ ] Testes de validação

---

## 🔄 PLANO DE EXECUÇÃO

### FASE 1: Análise e Preparação (30 min)
1. **Revisar implementação atual**
   - Analisar whitelist existente
   - Verificar regex atual
   - Identificar gaps de segurança

2. **Definir requisitos de segurança**
   - Listar seletores CSS seguros
   - Definir caracteres permitidos
   - Estabelecer limites de rate

3. **Preparar ambiente de teste**
   - Configurar cenários de teste
   - Preparar páginas de exemplo
   - Definir casos de edge

### FASE 2: Implementação Core (90 min)

#### 2.1 Melhorar Whitelist de Seletores (20 min)
```javascript
// Expandir lista de seletores permitidos
const ALLOWED_SELECTORS = [
  // Meta tags (já existentes)
  'meta[name="application-name"]',
  'meta[property="og:site_name"]',
  'meta[property="og:title"]',
  'meta[name="apple-mobile-web-app-title"]',
  'meta[name="twitter:site"]',
  'meta[name="twitter:app:name:iphone"]',
  'meta[name="twitter:app:name:googleplay"]',
  'meta[name="DC.publisher"]',
  
  // Estruturais básicos
  'title',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  
  // Links e manifests
  'link[rel="manifest"]',
  
  // Schema e scripts
  'script[type="application/ld+json"]',
  
  // Logos e imagens
  'header img[alt]',
  'a[href="/"] img[alt]',
  '[class*="logo"] img[alt]',
  'img[alt*="logo"]',
  
  // Seletores básicos seguros
  'body',
  'main',
  'article',
  'section',
  'header',
  'footer',
  'nav'
];
```

#### 2.2 Melhorar Regex de Validação (15 min)
```javascript
// Regex mais restritiva e segura
const SAFE_CSS_SELECTOR_REGEX = /^[a-zA-Z0-9\s\.\#\[\]\:\-\(\)\*\+\~\>\,\=\'\"\|_]+$/;
const DANGEROUS_PATTERNS = [
  /javascript:/i,
  /expression\(/i,
  /url\(/i,
  /@import/i,
  /behavior:/i,
  /binding:/i
];
```

#### 2.3 Implementar Rate Limiting (20 min)
```javascript
// Rate limiter específico para content script
class ContentScriptRateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 5; // máximo por janela
    this.windowMs = 1000; // 1 segundo
  }
  
  isAllowed() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
}
```

#### 2.4 Melhorar Validação de Atributos (15 min)
```javascript
// Lista expandida de atributos seguros
const ALLOWED_ATTRIBUTES = [
  'content',
  'alt', 
  'title', 
  'href', 
  'src',
  'name',
  'property',
  'rel',
  'type',
  'class',
  'id'
];
```

#### 2.5 Implementar Sanitização Avançada (20 min)
```javascript
function sanitizeExtractedContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  // Remove caracteres de controle e scripts
  const sanitized = content
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove caracteres de controle
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 500); // Limita tamanho
    
  return sanitized.length > 0 ? sanitized : null;
}
```

### FASE 3: Integração e Melhorias (60 min)

#### 3.1 Atualizar content-script.js (30 min)
- Integrar todas as melhorias
- Manter compatibilidade com código existente
- Adicionar logging detalhado
- Implementar fallbacks seguros

#### 3.2 Melhorar validation-utils.js (15 min)
- Adicionar funções específicas para CSS validation
- Exportar constantes de validação
- Integrar com sistema de logging

#### 3.3 Atualizar background.js (15 min)
- Adicionar validação adicional no message handler
- Implementar rate limiting no background
- Melhorar error handling

### FASE 4: Testes e Validação (30 min)

#### 4.1 Testes de Segurança (15 min)
- Testar seletores maliciosos
- Verificar rate limiting
- Validar sanitização

#### 4.2 Testes de Funcionalidade (15 min)
- Verificar tab renaming
- Testar extração de conteúdo
- Validar performance

---

## 🔧 IMPLEMENTAÇÃO DETALHADA

### 1. Arquivo: `content-script.js`

#### Melhorias na Validação de Seletores
```javascript
// CONSTANTES DE SEGURANÇA
const ALLOWED_SELECTORS = [
  // Meta tags essenciais
  'meta[name="application-name"]',
  'meta[property="og:site_name"]',
  'meta[property="og:title"]',
  'meta[name="apple-mobile-web-app-title"]',
  'meta[name="twitter:site"]',
  'meta[name="twitter:app:name:iphone"]',
  'meta[name="twitter:app:name:googleplay"]',
  'meta[name="DC.publisher"]',
  
  // Elementos estruturais
  'title',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'body', 'main', 'article', 'section', 'header', 'footer', 'nav',
  
  // Links e recursos
  'link[rel="manifest"]',
  'script[type="application/ld+json"]',
  
  // Imagens e logos
  'header img[alt]',
  'a[href="/"] img[alt]',
  '[class*="logo"] img[alt]',
  'img[alt*="logo"]'
];

const ALLOWED_ATTRIBUTES = [
  'content', 'alt', 'title', 'href', 'src', 'name', 'property', 'rel', 'type'
];

const SAFE_CSS_SELECTOR_REGEX = /^[a-zA-Z0-9\s\.\#\[\]\:\-\(\)\*\+\~\>\,\=\'\"\|_]+$/;

const DANGEROUS_PATTERNS = [
  /javascript:/i,
  /expression\(/i,
  /url\(/i,
  /@import/i,
  /behavior:/i,
  /binding:/i,
  /vbscript:/i,
  /data:/i
];

// Rate Limiter para Content Script
class ContentScriptRateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 5;
    this.windowMs = 1000;
  }
  
  isAllowed() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
}

const rateLimiter = new ContentScriptRateLimiter();

// Função de validação melhorada
function validateCSSSelector(selector) {
  // 1. Verificações básicas
  if (!selector || typeof selector !== 'string') {
    return { valid: false, reason: 'Seletor deve ser uma string não vazia' };
  }
  
  // 2. Limite de tamanho
  if (selector.length > 200) {
    return { valid: false, reason: 'Seletor muito longo' };
  }
  
  // 3. Verificar padrões perigosos
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(selector)) {
      return { valid: false, reason: 'Seletor contém padrão perigoso' };
    }
  }
  
  // 4. Verificar whitelist
  const isInWhitelist = ALLOWED_SELECTORS.some(allowed => 
    selector === allowed || selector.startsWith(allowed)
  );
  
  // 5. Verificar regex básica se não estiver na whitelist
  if (!isInWhitelist && !SAFE_CSS_SELECTOR_REGEX.test(selector)) {
    return { valid: false, reason: 'Seletor contém caracteres não permitidos' };
  }
  
  return { valid: true };
}

// Função de sanitização melhorada
function sanitizeExtractedContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  const sanitized = content
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove caracteres de controle
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data URLs
    .trim()
    .slice(0, 500); // Limita tamanho
    
  return sanitized.length > 0 ? sanitized : null;
}
```

#### Message Listener Melhorado
```javascript
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "extractContent") {
    try {
      // 1. Rate limiting
      if (!rateLimiter.isAllowed()) {
        throw new Error("Rate limit excedido para extração de conteúdo");
      }
      
      // 2. Validação do seletor
      const validation = validateCSSSelector(message.selector);
      if (!validation.valid) {
        throw new Error(`Seletor inválido: ${validation.reason}`);
      }
      
      // 3. Validação do atributo
      if (message.attribute && !ALLOWED_ATTRIBUTES.includes(message.attribute)) {
        throw new Error("Atributo não permitido");
      }
      
      // 4. Timeout para operação
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout na extração de conteúdo")), 2000);
      });
      
      // 5. Extração com sanitização
      const extractionPromise = new Promise((resolve) => {
        try {
          const element = document.querySelector(message.selector);
          let extractedContent = null;
          
          if (element) {
            if (message.attribute) {
              extractedContent = element.getAttribute(message.attribute);
            } else {
              extractedContent = element.textContent;
            }
          }
          
          // Sanitiza o conteúdo extraído
          const sanitizedContent = sanitizeExtractedContent(extractedContent);
          resolve(sanitizedContent);
        } catch (error) {
          resolve(null);
        }
      });
      
      return Promise.race([extractionPromise, timeoutPromise]);
      
    } catch (error) {
      // Log detalhado do erro
      browser.runtime
        .sendMessage({
          action: "log",
          level: "error",
          context: `ContentScript:extractContent:${window.location.hostname}`,
          message: `Erro na validação: ${error.message}`,
          details: [{ 
            selector: message.selector, 
            attribute: message.attribute,
            url: window.location.href 
          }],
        })
        .catch(() => {});
      
      return Promise.resolve(null);
    }
  }
  
  return false;
});
```

### 2. Arquivo: `validation-utils.js`

#### Novas Funções de Validação
```javascript
/**
 * Valida um seletor CSS para uso seguro
 * @param {string} selector - Seletor CSS a validar
 * @returns {ValidationResult} - Resultado da validaç��o
 */
export function validateCSSSelector(selector) {
  const errors = [];
  
  if (!isNonEmptyString(selector, "selector")) {
    errors.push("Seletor deve ser uma string não vazia");
    return { isValid: false, errors };
  }
  
  // Limite de tamanho
  if (selector.length > 200) {
    errors.push("Seletor muito longo (máximo 200 caracteres)");
  }
  
  // Padrões perigosos
  const dangerousPatterns = [
    /javascript:/i,
    /expression\(/i,
    /url\(/i,
    /@import/i,
    /behavior:/i,
    /binding:/i,
    /vbscript:/i,
    /data:/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(selector)) {
      errors.push("Seletor contém padrão potencialmente perigoso");
      break;
    }
  }
  
  // Regex básica de segurança
  const safeRegex = /^[a-zA-Z0-9\s\.\#\[\]\:\-\(\)\*\+\~\>\,\=\'\"\|_]+$/;
  if (!safeRegex.test(selector)) {
    errors.push("Seletor contém caracteres não permitidos");
  }
  
  const isValid = errors.length === 0;
  if (!isValid) {
    try {
      Logger.warn("Validation", `Seletor CSS inválido: ${errors.join("; ")}`);
    } catch (logError) {
      console.warn(`Erro ao registrar validação de seletor: ${logError.message}`);
    }
  }
  
  return { isValid, errors };
}

/**
 * Lista de seletores CSS permitidos para extração de conteúdo
 */
export const ALLOWED_CSS_SELECTORS = new Set([
  'meta[name="application-name"]',
  'meta[property="og:site_name"]',
  'meta[property="og:title"]',
  'meta[name="apple-mobile-web-app-title"]',
  'meta[name="twitter:site"]',
  'meta[name="twitter:app:name:iphone"]',
  'meta[name="twitter:app:name:googleplay"]',
  'meta[name="DC.publisher"]',
  'title',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'body', 'main', 'article', 'section', 'header', 'footer', 'nav',
  'link[rel="manifest"]',
  'script[type="application/ld+json"]',
  'header img[alt]',
  'a[href="/"] img[alt]',
  '[class*="logo"] img[alt]',
  'img[alt*="logo"]'
]);

/**
 * Lista de atributos HTML permitidos para extração
 */
export const ALLOWED_HTML_ATTRIBUTES = new Set([
  'content',
  'alt',
  'title',
  'href',
  'src',
  'name',
  'property',
  'rel',
  'type'
]);
```

### 3. Arquivo: `background.js`

#### Melhorias no Message Handler
```javascript
// Na função processMessageAction, melhorar o case "extractContent"
case "extractContent":
  // Validação adicional no background
  const { validateCSSSelector, ALLOWED_HTML_ATTRIBUTES } = await import("./validation-utils.js");
  
  const selectorValidation = validateCSSSelector(message.selector);
  if (!selectorValidation.isValid) {
    throw new Error(`Seletor inválido: ${selectorValidation.errors.join("; ")}`);
  }
  
  if (message.attribute && !ALLOWED_HTML_ATTRIBUTES.has(message.attribute)) {
    throw new Error("Atributo não permitido para extração");
  }
  
  // Verifica se o sender é uma aba válida
  if (!sender.tab || typeof sender.tab.id !== "number") {
    throw new Error("Extração de conteúdo deve vir de uma aba válida");
  }
  
  // Log da operação para auditoria
  Logger.info("extractContent", `Solicitação de extração validada`, {
    selector: message.selector,
    attribute: message.attribute,
    tabId: sender.tab.id,
    url: sender.tab.url
  });
  
  return { success: true, validated: true };
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO

### 1. Segurança
- [ ] Apenas seletores da whitelist são aceitos
- [ ] Regex bloqueia caracteres perigosos
- [ ] Rate limiting funciona (máximo 5 req/seg por aba)
- [ ] Atributos são validados contra whitelist
- [ ] Conteúdo extraído é sanitizado

### 2. Funcionalidade
- [ ] Tab renaming continua funcionando
- [ ] Extração de meta tags funciona
- [ ] Timeout de 2 segundos funciona
- [ ] Logging detalhado funciona
- [ ] Fallbacks seguros funcionam

### 3. Performance
- [ ] Validação não adiciona delay perceptível
- [ ] Rate limiting não bloqueia uso normal
- [ ] Memory usage permanece estável
- [ ] CPU usage não aumenta significativamente

### 4. Robustez
- [ ] Edge cases são tratados
- [ ] Erros são logados adequadamente
- [ ] Fallbacks funcionam em caso de erro
- [ ] Não quebra funcionalidades existentes

---

## 🧪 PLANO DE TESTES

### Testes de Segurança
```javascript
// Seletores maliciosos que devem ser bloqueados
const maliciousSelectors = [
  "javascript:alert('xss')",
  "expression(alert('xss'))",
  "url(javascript:alert('xss'))",
  "@import url('malicious.css')",
  "behavior:url(#default#userData)",
  "script[src*='evil.js']"
];

// Seletores legítimos que devem passar
const legitimateSelectors = [
  "meta[name='application-name']",
  "h1",
  "title",
  "header img[alt]",
  "[class*='logo'] img[alt]"
];
```

### Testes de Rate Limiting
```javascript
// Simular múltiplas requisições rápidas
for (let i = 0; i < 10; i++) {
  browser.runtime.sendMessage({
    action: "extractContent",
    selector: "title"
  });
}
// Deve bloquear após 5 requisições
```

### Testes de Funcionalidade
```javascript
// Testar extração normal
browser.runtime.sendMessage({
  action: "extractContent",
  selector: "meta[name='application-name']",
  attribute: "content"
});

// Testar timeout
browser.runtime.sendMessage({
  action: "extractContent",
  selector: "title"
});
```

---

## 📊 MÉTRICAS DE SUCESSO

### Segurança
- **0** seletores maliciosos aceitos
- **100%** de seletores perigosos bloqueados
- **Rate limiting** ativo e funcional

### Performance
- **< 5ms** overhead de validação
- **< 2s** timeout para extração
- **Estável** uso de memória

### Funcionalidade
- **100%** compatibilidade com tab renaming
- **100%** compatibilidade com extração existente
- **0** regressões funcionais

---

## 🔄 ROLLBACK PLAN

### Se algo der errado:
1. **Reverter content-script.js** para versão anterior
2. **Manter apenas timeout** de segurança
3. **Desabilitar rate limiting** temporariamente
4. **Logs detalhados** para debug
5. **Hotfix** para problemas críticos

### Backup de segurança:
```javascript
// Versão mínima de fallback
if (message.action === "extractContent") {
  if (!message.selector || message.selector.length > 200) {
    return Promise.resolve(null);
  }
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Timeout")), 2000);
  });
  
  const extractionPromise = new Promise((resolve) => {
    try {
      const element = document.querySelector(message.selector);
      resolve(element ? element.textContent?.slice(0, 500) : null);
    } catch {
      resolve(null);
    }
  });
  
  return Promise.race([extractionPromise, timeoutPromise]);
}
```

---

## 📝 CHECKLIST DE EXECUÇÃO

### Pr��-execução
- [ ] Backup dos arquivos originais
- [ ] Ambiente de teste configurado
- [ ] Casos de teste preparados
- [ ] Métricas de baseline coletadas

### Durante execução
- [ ] Seguir ordem das fases
- [ ] Testar cada mudança incrementalmente
- [ ] Validar critérios de aceitação
- [ ] Documentar problemas encontrados

### Pós-execução
- [ ] Todos os testes passando
- [ ] Performance validada
- [ ] Segurança confirmada
- [ ] Documentação atualizada
- [ ] Commit com mensagem descritiva

---

## 🎯 CONCLUSÃO

Este plano de execução garante que a TASK-C-002 seja implementada de forma:

- **Segura**: Validação robusta de CSS selectors
- **Funcional**: Mantém compatibilidade existente
- **Performante**: Overhead mínimo de validação
- **Robusta**: Tratamento adequado de edge cases

A implementação seguirá as orientações do `agents.md` e manterá a qualidade e consistência do projeto.

**Tempo total estimado: 3 horas**
**Risco: BAIXO** (melhorias incrementais em código existente)
**Impacto: ALTO** (melhoria significativa de segurança)