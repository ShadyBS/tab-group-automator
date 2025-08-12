// content-script.js
/**
 * @file content-script.js
 * @description Script injetado para extrair informações de nomenclatura.
 * Exporta a função extractSmartName para uso via browser.scripting.executeScript.
 */

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
      if (typeof schemaData !== 'object' || schemaData === null) continue;

      const graph = schemaData['@graph'] || [schemaData];
      for (const item of graph) {
        if (
          item &&
          (item['@type'] === 'WebSite' || item['@type'] === 'Organization') &&
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
    const manifestUrl = new URL(manifestLink.href, document.baseURI);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(manifestUrl, {
      signal: controller.signal,
      cache: 'force-cache',
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const manifestData = await response.json();
    const name = (manifestData.short_name || manifestData.name || '').trim();
    return name.length > 0 && name.length <= 50 ? name : null;
  } catch (e) {
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
  const genericAltTexts = ['logo', 'logotipo'];
  if (genericAltTexts.includes(altText.toLowerCase())) {
    return null;
  }

  const domainCore = hostname.split('.')[0].toLowerCase();
  if (altText.toLowerCase().includes(domainCore)) {
    return altText;
  }
  return null;
}

// Função principal exportada para uso pelo background
export async function extractSmartName() {
  const h1 = document.querySelector('h1');
  const hostname = window.location.hostname;
  const manifestName = await getManifestName();

  const details = {
    manifestName: manifestName,
    appleWebAppTitle: getMetaContent('meta[name="apple-mobile-web-app-title"]'),
    ogSiteName: getMetaContent('meta[property="og:site_name"]'),
    applicationName: getMetaContent('meta[name="application-name"]'),
    schemaName: getSchemaName(),
    ogTitle: getMetaContent('meta[property="og:title"]'),
    h1Content: h1 ? h1.textContent.trim() : null,
    twitterSite: getMetaContent('meta[name="twitter:site"]'),
    twitterAppName:
      getMetaContent('meta[name="twitter:app:name:iphone"]') ||
      getMetaContent('meta[name="twitter:app:name:googleplay"]'),
    dcPublisher: getMetaContent('meta[name="DC.publisher"]'),
    logoAltText: getLogoAltText(hostname),
    pageTitle: document.title || null,
  };

  return details;
}

// --- Listener e validação de extração via CSS (mantido para compatibilidade) ---

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
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body',
  'main',
  'article',
  'section',
  'header',
  'footer',
  'nav',
  'link[rel="manifest"]',
  'script[type="application/ld+json"]',
  'header img[alt]',
  'a[href="/"] img[alt]',
  '[class*="logo"] img[alt]',
  'img[alt*="logo"]',
  'header a img[alt]',
];

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
];

const SAFE_CSS_SELECTOR_REGEX = /^[\]a-zA-Z0-9\s.#:\-()*+~>,=''|_[]]+$/;

const DANGEROUS_PATTERNS = [
  /javascript:/i,
  /expression\(/i,
  /url\(/i,
  /@import/i,
  /behavior:/i,
  /binding:/i,
  /vbscript:/i,
  /data:/i,
];

class ContentScriptRateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 5;
    this.windowMs = 1000;
  }

  isAllowed() {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
}

const rateLimiter = new ContentScriptRateLimiter();

function validateCSSSelector(selector) {
  if (!selector || typeof selector !== 'string') {
    return { valid: false, reason: 'Seletor deve ser uma string não vazia' };
  }
  if (selector.length > 200) {
    return { valid: false, reason: 'Seletor muito longo' };
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(selector)) {
      return { valid: false, reason: 'Seletor contém padrão perigoso' };
    }
  }
  const isInWhitelist = ALLOWED_SELECTORS.some(
    (allowed) => selector === allowed || selector.startsWith(allowed)
  );
  if (!isInWhitelist && !SAFE_CSS_SELECTOR_REGEX.test(selector)) {
    return {
      valid: false,
      reason: 'Seletor contém caracteres não permitidos',
    };
  }
  if (
    selector.toLowerCase().includes('script') &&
    selector !== 'script[type="application/ld+json"]'
  ) {
    return { valid: false, reason: 'Seletor script não permitido' };
  }
  return { valid: true };
}

function sanitizeExtractedContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  const sanitized = content
    // eslint-disable-next-line no-control-regex -- needed for sanitizing control characters from extracted content
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*[^,\s]*/gi, '')
    .replace(/data:[^,\s]*/gi, '')
    .trim()
    .slice(0, 500);
  return sanitized.length > 0 ? sanitized : null;
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'extractContent') {
    try {
      if (!rateLimiter.isAllowed()) {
        throw new Error('Rate limit excedido para extração de conteúdo');
      }
      const validation = validateCSSSelector(message.selector);
      if (!validation.valid) {
        throw new Error(`Seletor inválido: ${validation.reason}`);
      }
      if (
        message.attribute &&
        !ALLOWED_ATTRIBUTES.includes(message.attribute)
      ) {
        throw new Error('Atributo não permitido');
      }
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Timeout na extração de conteúdo')),
          2000
        );
      });
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
          const sanitizedContent = sanitizeExtractedContent(extractedContent);
          resolve(sanitizedContent);
        } catch (error) {
          resolve(null);
        }
      });
      return Promise.race([extractionPromise, timeoutPromise]);
    } catch (error) {
      browser.runtime
        .sendMessage({
          action: 'log',
          level: 'error',
          context: `ContentScript:extractContent:${window.location.hostname}`,
          message: `Erro na validação: ${error.message}`,
          details: [
            {
              selector: message.selector,
              attribute: message.attribute,
              url: window.location.href,
            },
          ],
        })
        .catch(() => {});
      return Promise.resolve(null);
    }
  }
  return false;
});
