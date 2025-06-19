/**
 * @file content-script.js
 * @description Este script é injetado sob demanda em páginas web para extrair informações de nomenclatura.
 * Ele retorna o objeto 'details' como sua expressão final.
 */

// Usamos uma IIFE para evitar poluir o escopo global da página anfitriã.
(() => {
    /**
     * Obtém o conteúdo de uma meta tag com base num seletor CSS.
     * @param {string} selector - O seletor CSS para a meta tag.
     * @returns {string|null} O conteúdo da tag ou nulo se não for encontrada.
     */
    function getMetaContent(selector) {
        const tag = document.querySelector(selector);
        return tag ? tag.content.trim() : null;
    }

    /**
     * Analisa scripts JSON-LD na página para encontrar o nome do site ou organização.
     * @returns {string|null} O nome encontrado ou nulo.
     */
    function getSchemaName() {
        try {
            const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of schemaScripts) {
                const schemaData = JSON.parse(script.textContent);
                // Garante que schemaData é um objeto antes de prosseguir
                if (typeof schemaData !== 'object' || schemaData === null) continue;

                const graph = schemaData['@graph'] || [schemaData];
                for (const item of graph) {
                    if (item && (item['@type'] === 'WebSite' || item['@type'] === 'Organization') && item.name) {
                        return item.name;
                    }
                }
            }
        } catch (e) {
            // Ignora erros de parsing, comuns em páginas web.
        }
        return null;
    }

    /**
     * Procura por um logótipo e extrai o seu texto alternativo (alt text) se for relevante.
     * @param {string} hostname - O anfitrião da página atual.
     * @returns {string|null} O texto alternativo relevante ou nulo.
     */
    function getLogoAltText(hostname) {
        if (!hostname) return null;
        // Seletor que tenta encontrar imagens de logótipos em locais comuns.
        const logo = document.querySelector('header a img[alt], a[href="/"] img[alt], [class*="logo"] img[alt]');
        if (!logo || !logo.alt) return null;
        
        const altText = logo.alt.trim();
        // REFINAMENTO: Ignora textos alternativos genéricos.
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

    const hostname = window.location.hostname;

    const details = {
        ogSiteName: getMetaContent('meta[property="og:site_name"]'),
        applicationName: getMetaContent('meta[name="application-name"]'),
        schemaName: getSchemaName(),
        twitterSite: getMetaContent('meta[name="twitter:site"]'),
        twitterAppName: getMetaContent('meta[name="twitter:app:name:iphone"]') || getMetaContent('meta[name="twitter:app:name:googleplay"]'),
        dcPublisher: getMetaContent('meta[name="DC.publisher"]'),
        logoAltText: getLogoAltText(hostname),
        pageTitle: document.title || null
    };

    // Envia os detalhes para o background script para serem registados (log).
    // O catch() é importante para evitar erros se o script de fundo não estiver a ouvir.
    browser.runtime.sendMessage({
      action: 'log',
      level: 'debug',
      context: `ContentScript:${hostname}`,
      message: 'Detalhes da página extraídos.',
      details: [details]
    }).catch(() => { /* Ignora o erro intencionalmente */ });

    // A última expressão da IIFE é o que é retornado para o chamador de `executeScript`.
    return details;
})();
