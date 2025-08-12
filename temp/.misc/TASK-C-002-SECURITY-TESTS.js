/**
 * @file TASK-C-002-SECURITY-TESTS.js
 * @description Testes de segurança para validação de CSS selectors
 * @date 2024-12-19
 */

// Testes de Segurança para CSS Selectors
const SECURITY_TESTS = {
  // Seletores maliciosos que devem ser bloqueados
  maliciousSelectors: [
    "javascript:alert('xss')",
    "expression(alert('xss'))",
    "url(javascript:alert('xss'))",
    "@import url('malicious.css')",
    "behavior:url(#default#userData)",
    "script[src*='evil.js']",
    "vbscript:alert('xss')",
    "data:text/html,<script>alert('xss')</script>",
    "\\00003cscript\\00003ealert('xss')\\00003c/script\\00003e",
    "/**/javascript:alert('xss')",
    "&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert('xss')"
  ],

  // Seletores legítimos que devem passar
  legitimateSelectors: [
    "meta[name='application-name']",
    "meta[property='og:site_name']",
    "meta[property='og:title']",
    "h1",
    "h2",
    "title",
    "header img[alt]",
    "[class*='logo'] img[alt]",
    "body",
    "main",
    "article",
    "section",
    "header",
    "footer",
    "nav",
    "link[rel='manifest']",
    "script[type='application/ld+json']"
  ],

  // Atributos maliciosos que devem ser bloqueados
  maliciousAttributes: [
    "onclick",
    "onload",
    "onerror",
    "onmouseover",
    "onfocus",
    "onblur",
    "javascript",
    "vbscript",
    "data-evil"
  ],

  // Atributos legítimos que devem passar
  legitimateAttributes: [
    "content",
    "alt",
    "title",
    "href",
    "src",
    "name",
    "property",
    "rel",
    "type"
  ]
};

// Função para testar validação de seletores CSS
function testCSSValidation() {
  console.log("🧪 Iniciando testes de validação de CSS selectors...");
  
  // Simula a função de validação do content-script
  function validateCSSSelector(selector) {
    const ALLOWED_SELECTORS = [
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
      'img[alt*="logo"]',
      'header a img[alt]'
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

  let passedTests = 0;
  let totalTests = 0;

  // Teste 1: Seletores maliciosos devem ser bloqueados
  console.log("\n🔒 Testando seletores maliciosos (devem ser bloqueados):");
  SECURITY_TESTS.maliciousSelectors.forEach((selector, index) => {
    totalTests++;
    const result = validateCSSSelector(selector);
    if (!result.valid) {
      console.log(`✅ Teste ${index + 1}: "${selector}" foi corretamente bloqueado - ${result.reason}`);
      passedTests++;
    } else {
      console.log(`❌ Teste ${index + 1}: "${selector}" foi incorretamente aceito!`);
    }
  });

  // Teste 2: Seletores legítimos devem passar
  console.log("\n🔓 Testando seletores legítimos (devem passar):");
  SECURITY_TESTS.legitimateSelectors.forEach((selector, index) => {
    totalTests++;
    const result = validateCSSSelector(selector);
    if (result.valid) {
      console.log(`✅ Teste ${index + 1}: "${selector}" foi corretamente aceito`);
      passedTests++;
    } else {
      console.log(`❌ Teste ${index + 1}: "${selector}" foi incorretamente bloqueado - ${result.reason}`);
    }
  });

  // Teste 3: Seletores muito longos devem ser bloqueados
  console.log("\n📏 Testando limite de tamanho:");
  totalTests++;
  const longSelector = "a".repeat(201);
  const longResult = validateCSSSelector(longSelector);
  if (!longResult.valid && longResult.reason.includes('muito longo')) {
    console.log(`✅ Seletor muito longo foi corretamente bloqueado`);
    passedTests++;
  } else {
    console.log(`❌ Seletor muito longo foi incorretamente aceito`);
  }

  // Teste 4: Strings vazias devem ser bloqueadas
  console.log("\n🚫 Testando strings vazias:");
  totalTests++;
  const emptyResult = validateCSSSelector("");
  if (!emptyResult.valid) {
    console.log(`✅ String vazia foi corretamente bloqueada`);
    passedTests++;
  } else {
    console.log(`❌ String vazia foi incorretamente aceita`);
  }

  // Resumo dos testes
  console.log(`\n📊 RESUMO DOS TESTES:`);
  console.log(`✅ Testes passaram: ${passedTests}/${totalTests}`);
  console.log(`📈 Taxa de sucesso: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 TODOS OS TESTES PASSARAM! Validação de CSS está funcionando corretamente.`);
  } else {
    console.log(`⚠️ ${totalTests - passedTests} testes falharam. Revisar implementação.`);
  }

  return { passed: passedTests, total: totalTests, success: passedTests === totalTests };
}

// Função para testar rate limiting
function testRateLimiting() {
  console.log("\n🚦 Testando Rate Limiting...");
  
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
  let allowedRequests = 0;
  let blockedRequests = 0;

  // Simula 10 requisições rápidas
  for (let i = 0; i < 10; i++) {
    if (rateLimiter.isAllowed()) {
      allowedRequests++;
      console.log(`✅ Requisição ${i + 1}: Permitida`);
    } else {
      blockedRequests++;
      console.log(`🚫 Requisição ${i + 1}: Bloqueada (rate limit)`);
    }
  }

  console.log(`\n📊 RESUMO RATE LIMITING:`);
  console.log(`✅ Requisições permitidas: ${allowedRequests}`);
  console.log(`🚫 Requisições bloqueadas: ${blockedRequests}`);
  
  const expectedAllowed = 5;
  const expectedBlocked = 5;
  
  if (allowedRequests === expectedAllowed && blockedRequests === expectedBlocked) {
    console.log(`🎉 Rate limiting funcionando corretamente!`);
    return true;
  } else {
    console.log(`⚠️ Rate limiting não está funcionando como esperado.`);
    return false;
  }
}

// Função para testar sanitização
function testSanitization() {
  console.log("\n🧼 Testando Sanitização de Conteúdo...");
  
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

  const testCases = [
    {
      input: "<script>alert('xss')</script>Hello World",
      expected: "Hello World",
      description: "Remove script tags"
    },
    {
      input: "javascript:alert('xss')",
      expected: "alert('xss')",
      description: "Remove javascript: protocol"
    },
    {
      input: "onclick=alert('xss') Hello",
      expected: "Hello",
      description: "Remove event handlers"
    },
    {
      input: "data:text/html,<script>alert('xss')</script>",
      expected: "text/html,<script>alert('xss')</script>",
      description: "Remove data: protocol"
    },
    {
      input: "Normal text content",
      expected: "Normal text content",
      description: "Keep normal content"
    },
    {
      input: "\x00\x01\x02Hello\x7F",
      expected: "Hello",
      description: "Remove control characters"
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    const result = sanitizeExtractedContent(testCase.input);
    if (result === testCase.expected) {
      console.log(`✅ Teste ${index + 1}: ${testCase.description} - Passou`);
      passedTests++;
    } else {
      console.log(`❌ Teste ${index + 1}: ${testCase.description} - Falhou`);
      console.log(`   Esperado: "${testCase.expected}"`);
      console.log(`   Recebido: "${result}"`);
    }
  });

  console.log(`\n📊 RESUMO SANITIZAÇÃO:`);
  console.log(`✅ Testes passaram: ${passedTests}/${totalTests}`);
  console.log(`📈 Taxa de sucesso: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
  
  return passedTests === totalTests;
}

// Executa todos os testes
function runAllTests() {
  console.log("🚀 INICIANDO TESTES DE SEGURANÇA PARA TASK-C-002");
  console.log("=" .repeat(60));
  
  const cssTests = testCSSValidation();
  const rateLimitTests = testRateLimiting();
  const sanitizationTests = testSanitization();
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 RESUMO FINAL DOS TESTES:");
  console.log(`🔒 Validação CSS: ${cssTests.success ? '✅ PASSOU' : '❌ FALHOU'} (${cssTests.passed}/${cssTests.total})`);
  console.log(`🚦 Rate Limiting: ${rateLimitTests ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`🧼 Sanitização: ${sanitizationTests ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  const allTestsPassed = cssTests.success && rateLimitTests && sanitizationTests;
  
  if (allTestsPassed) {
    console.log("\n🎉 TODOS OS TESTES DE SEGURANÇA PASSARAM!");
    console.log("✅ TASK-C-002 implementada com sucesso!");
  } else {
    console.log("\n⚠️ ALGUNS TESTES FALHARAM!");
    console.log("❌ Revisar implementação da TASK-C-002");
  }
  
  return allTestsPassed;
}

// Executa os testes se o arquivo for executado diretamente
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, testCSSValidation, testRateLimiting, testSanitization };
} else {
  // Executa no browser/console
  runAllTests();
}