/**
 * @file content-script.js
 * @description This script is injected on-demand into web pages to extract naming information.
 * It returns the 'details' object as its final expression.
 */

function getMetaContent(selector) {
    const tag = document.querySelector(selector);
    return tag ? tag.content : null;
}

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

function getLogoAltText(hostname) {
    if (!hostname) return null;
    const logo = document.querySelector('header a img[alt], a[href="/"] img[alt], [class*="logo"] img[alt]');
    if (!logo || !logo.alt) return null;
    const altText = logo.alt;
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
browser.runtime.sendMessage({
  action: 'log',
  level: 'debug', // Usa 'debug' para não poluir a consola por defeito.
  context: `ContentScript:${hostname}`,
  message: 'Detalhes da página extraídos.',
  details: [details] // Envia o objeto de detalhes para inspeção.
}).catch(e => {
  // Ignora o erro, que é comum se o background script for recarregado
  // ou a página for fechada enquanto a mensagem está em trânsito.
});


// A última expressão é retornada para o chamador de `executeScript`.
details;
