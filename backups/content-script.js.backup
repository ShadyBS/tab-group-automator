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
  // da página usando um seletor CSS com validação de segurança.
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "extractContent") {
      try {
        // Validação básica de segurança do seletor CSS
        if (!message.selector || typeof message.selector !== "string") {
          throw new Error("Seletor CSS inválido");
        }

        // Lista de seletores permitidos (whitelist)
        const allowedSelectors = [
          'meta[name="application-name"]',
          'meta[property="og:site_name"]',
          'meta[property="og:title"]',
          'meta[name="apple-mobile-web-app-title"]',
          'meta[name="twitter:site"]',
          'meta[name="twitter:app:name:iphone"]',
          'meta[name="twitter:app:name:googleplay"]',
          'meta[name="DC.publisher"]',
          'script[type="application/ld+json"]',
          'link[rel="manifest"]',
          'h1',
          'title',
          'header a img[alt]',
          'a[href="/"] img[alt]',
          '[class*="logo"] img[alt]'
        ];

        // Verifica se o seletor está na whitelist ou é um seletor básico seguro
        const isAllowedSelector = allowedSelectors.some(allowed => 
          message.selector === allowed || 
          message.selector.startsWith(allowed)
        );

        // Validação adicional com regex para seletores básicos
        const basicSelectorRegex = /^[a-zA-Z0-9\s\.\#\[\]\:\-\(\)\*\+\~\>\,\=\'\"\|]+$/;
        
        if (!isAllowedSelector && !basicSelectorRegex.test(message.selector)) {
          throw new Error("Seletor CSS não permitido por motivos de segurança");
        }

        // Limita o comprimento do seletor
        if (message.selector.length > 200) {
          throw new Error("Seletor CSS muito longo");
        }

        // Timeout para prevenir operações que demorem muito
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout na extração de conteúdo")), 3000);
        });

        const extractionPromise = new Promise((resolve) => {
          const element = document.querySelector(message.selector);
          let extractedContent = null;

          if (element) {
            if (message.attribute && typeof message.attribute === "string") {
              // Validação do atributo
              const allowedAttributes = ["content", "alt", "title", "href", "src"];
              if (allowedAttributes.includes(message.attribute)) {
                extractedContent = element.getAttribute(message.attribute);
              }
            } else {
              extractedContent = element.textContent;
            }
          }

          resolve(extractedContent ? extractedContent.trim().slice(0, 500) : null);
        });

        return Promise.race([extractionPromise, timeoutPromise]);

      } catch (error) {
        // Registra o erro e retorna null para o background script
        browser.runtime
          .sendMessage({
            action: "log",
            level: "error",
            context: `ContentScript:extractContent`,
            message: `Erro ao extrair conteúdo com seletor "${message.selector}": ${error.message}`,
            details: [error],
          })
          .catch(() => {});
        return Promise.resolve(null);
      }
    }
    // Para outras mensagens, o comportamento padrão continua
    return false;
  });
  // --- FIM NOVO ---

  return details;
})();
