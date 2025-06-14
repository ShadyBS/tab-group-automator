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

details; // The value of the last expression is returned by executeScript.
