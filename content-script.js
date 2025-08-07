/**
 * @file content-script.js
 * @description Este script é injetado sob demanda em páginas web para extrair informações de nomenclatura.
 * Ele retorna o objeto 'details' como sua expressão final.
 */

(async () => {
  function getMetaContent(selector) {
    const tag = document.querySelector(selector);
    return tag ? tag.content.trim() : null;
  }

  function getSchemaName() {
    try {
      const schemaScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const script of schemaScripts) {
        const schemaData = JSON.parse(script.textContent);
        if (typeof schemaData !== "object" || schemaData === null) continue;

        const graph = schemaData["@graph"] || [schemaData];
        for (const item of graph) {
          if (
            item &&
            (item["@type"] === "WebSite" || item["@type"] === "Organization") &&
            item.name
          ) {
            return item.name;
          }
        }
      }
    } catch (e) {
      // Ignora erros de parsing.
    }
    return null;
  }

  async function getManifestName() {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink || !manifestLink.href) return null;

    try {
      // Resolve o URL do manifesto em relação ao URL base do documento
      const manifestUrl = new URL(manifestLink.href, document.baseURI);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(manifestUrl, {
        signal: controller.signal,
        cache: "force-cache", // Use cache to avoid repeated requests
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const manifestData = await response.json();
      // Prefere short_name se existir, pois é muitas vezes mais limpo.
      const name = (manifestData.short_name || manifestData.name || "").trim();
      return name.length > 0 && name.length <= 50 ? name : null;
    } catch (e) {
      // Ignora erros de fetch ou de parsing de JSON.
      return null;
    }
  }

  function getLogoAltText(hostname) {
    if (!hostname) return null;
    const logo = document.querySelector(
      'header a img[alt], a[href="/"] img[alt], [class*="logo"] img[alt]'
    );
    if (!logo || !logo.alt) return null;

    const altText = logo.alt.trim();
    const genericAltTexts = ["logo", "logotipo"];
    if (genericAltTexts.includes(altText.toLowerCase())) {
      return null;
    }

    const domainCore = hostname.split(".")[0].toLowerCase();
    if (altText.toLowerCase().includes(domainCore)) {
      return altText;
    }
    return null;
  }

  // NOVO: Extrai o conteúdo do primeiro h1, se existir.
  const h1 = document.querySelector("h1");

  const hostname = window.location.hostname;

  // Espera pelo nome do manifesto, que é uma operação assíncrona.
  const manifestName = await getManifestName();

  const details = {
    manifestName: manifestName, // Adicionado
    appleWebAppTitle: getMetaContent('meta[name="apple-mobile-web-app-title"]'), // Adicionado
    ogSiteName: getMetaContent('meta[property="og:site_name"]'), // Movido para consistência
    applicationName: getMetaContent('meta[name="application-name"]'),
    schemaName: getSchemaName(),
    ogTitle: getMetaContent('meta[property="og:title"]'), // Adicionado
    h1Content: h1 ? h1.textContent.trim() : null, // Adicionado
    twitterSite: getMetaContent('meta[name="twitter:site"]'),
    twitterAppName:
      getMetaContent('meta[name="twitter:app:name:iphone"]') ||
      getMetaContent('meta[name="twitter:app:name:googleplay"]'),
    dcPublisher: getMetaContent('meta[name="DC.publisher"]'),
    logoAltText: getLogoAltText(hostname),
    pageTitle: document.title || null,
  };

  browser.runtime
    .sendMessage({
      action: "log",
      level: "debug",
      context: `ContentScript:${hostname}`,
      message: "Detalhes da página extraídos.",
      details: [details],
    })
    .catch(() => {
      /* Ignora o erro intencionalmente */
    });

  // --- NOVO: Listener para extração de conteúdo via CSS ---
  // Este listener permite que o background script solicite a extração de conteúdo
  // da página usando um seletor CSS com validação de segurança robusta.

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
    'img[alt*="logo"]',
    'header a img[alt]'
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
    
    // 6. Verificação adicional para seletores script perigosos
    if (selector.toLowerCase().includes('script') && selector !== 'script[type="application/ld+json"]') {
      return { valid: false, reason: 'Seletor script não permitido' };
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
      .replace(/on\w+\s*=\s*[^,\s]*/gi, '') // Remove event handlers (melhorado)
      .replace(/data:[^,\s]*/gi, '') // Remove data URLs (melhorado)
      .trim()
      .slice(0, 500); // Limita tamanho
      
    return sanitized.length > 0 ? sanitized : null;
  }

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
        
        // 4. Timeout para operação (reduzido para 2 segundos)
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
  // --- FIM NOVO ---

  return details;
})();
