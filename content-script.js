/**
 * @file content-script.js
 * @description This script is injected into web pages to extract a wide range of naming information.
 */

/**
 * Finds a specific meta tag and returns its content.
 * @param {string} selector - The CSS selector for the meta tag.
 * @returns {string|null} - The content of the tag or null if not found.
 */
function getMetaContent(selector) {
    const tag = document.querySelector(selector);
    return tag ? tag.content : null;
}

/**
 * Parses JSON-LD schema data to find a website or organization name.
 * @returns {string|null}
 */
function getSchemaName() {
    try {
        const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of schemaScripts) {
            const schemaData = JSON.parse(script.textContent);
            const graph = schemaData['@graph'] || [schemaData];
            for (const item of graph) {
                 if (item && (item['@type'] === 'WebSite' || item['@type'] === 'Organization') && item.name) {
                    return item.name;
                }
            }
        }
    } catch (e) { /* Ignore parsing errors */ }
    return null;
}

/**
 * Tries to find the site's logo and returns its alt text,
 * but only if the alt text seems related to the site's domain.
 * @param {string} hostname - The hostname of the current page (e.g., 'www.wikipedia.org').
 * @returns {string|null}
 */
function getLogoAltText(hostname) {
    if (!hostname) return null;
    
    // Tenta encontrar o logótipo com seletores comuns.
    const logo = document.querySelector('header a img[alt], a[href="/"] img[alt], [class*="logo"] img[alt]');
    if (!logo || !logo.alt) return null;

    const altText = logo.alt;
    
    // Extrai a parte principal do domínio para a verificação (ex: "wikipedia" de "wikipedia.org")
    const domainCore = hostname.split('.')[0].toLowerCase();
    
    // Verifica se o texto alt contém a parte principal do domínio.
    // Isto evita usar textos alt genéricos como "Logótipo" ou "Página Inicial".
    if (altText.toLowerCase().includes(domainCore)) {
        return altText; // Retorna o texto alt completo se for uma correspondência válida.
    }
    
    return null; // Retorna nulo se o texto alt não parecer estar relacionado com o domínio.
}


browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getPageDetails") {
        
        let hostname = null;
        try {
            // Obtém o hostname a partir da URL do remetente da mensagem.
            hostname = new URL(sender.url).hostname;
        } catch (e) { /* Ignora URLs inválidas ou sobre as quais não temos permissão. */ }

        const details = {
            // Prioridade 1: Open Graph
            ogSiteName: getMetaContent('meta[property="og:site_name"]'),
            
            // Prioridade 2: Nome da Aplicação HTML
            applicationName: getMetaContent('meta[name="application-name"]'),
            
            // Prioridade 3: Schema.org
            schemaName: getSchemaName(),
            
            // Prioridade 4: Twitter Cards
            twitterSite: getMetaContent('meta[name="twitter:site"]'),
            twitterAppName: getMetaContent('meta[name="twitter:app:name:iphone"]') || getMetaContent('meta[name="twitter:app:name:googleplay"]'),

            // Prioridade 5: Dublin Core
            dcPublisher: getMetaContent('meta[name="DC.publisher"]'),

            // Prioridade 6: Texto Alt do Logótipo (com a nova lógica de validação)
            logoAltText: getLogoAltText(hostname),
            
            // Fallback final: Título da página
            pageTitle: document.title || null
        };
        
        // --- Bloco de Debugging ---
        console.groupCollapsed(`[Auto Tab Grouper] Detalhes da Página para: ${hostname}`);
        console.log(`Open Graph (og:site_name):`, details.ogSiteName);
        console.log(`Nome da Aplicação (application-name):`, details.applicationName);
        console.log(`Schema.org (WebSite/Organization):`, details.schemaName);
        console.log(`Twitter Site (@...):`, details.twitterSite);
        console.log(`Twitter App Name:`, details.twitterAppName);
        console.log(`Dublin Core (Publisher):`, details.dcPublisher);
        console.log(`Texto Alt do Logótipo:`, details.logoAltText);
        console.log(`Título da Página:`, details.pageTitle);
        console.groupEnd();
        // --- FIM do Bloco de Debugging ---
        
        sendResponse(details);
    }
    return true; // Indica resposta assíncrona
});
