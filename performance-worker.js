/**
 * @file performance-worker.js
 * @description Web Worker para processamento pesado sem bloquear a thread principal
 * Implementa operações assíncronas para regex, análise de tabs e processamento em lote
 */

// Web Worker para operações pesadas
self.onmessage = async function(e) {
  const { type, data, taskId } = e.data;
  const startTime = performance.now();
  
  try {
    let result;
    
    switch (type) {
      case 'HEAVY_REGEX_PROCESSING':
        result = await processRegexPatterns(data);
        break;
        
      case 'BULK_TAB_ANALYSIS':
        result = await analyzeTabs(data);
        break;
        
      case 'BATCH_URL_PROCESSING':
        result = await processBatchUrls(data);
        break;
        
      case 'PATTERN_MATCHING':
        result = await performPatternMatching(data);
        break;
        
      case 'DATA_AGGREGATION':
        result = await aggregateData(data);
        break;
        
      case 'CACHE_OPTIMIZATION':
        result = await optimizeCache(data);
        break;
        
      default:
        throw new Error(`Tipo de tarefa desconhecido: ${type}`);
    }
    
    const processingTime = performance.now() - startTime;
    
    self.postMessage({
      taskId,
      success: true,
      result,
      processingTime,
      type
    });
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    
    self.postMessage({
      taskId,
      success: false,
      error: error.message,
      processingTime,
      type
    });
  }
};

/**
 * Processa padrões regex pesados
 * @param {object} data - Dados com padrões e texto
 * @returns {Promise<object>} - Resultado do processamento
 */
async function processRegexPatterns(data) {
  const { patterns, texts, options = {} } = data;
  const results = [];
  
  for (const text of texts) {
    const textResults = {
      text: text.substring(0, 100), // Limita para evitar vazamento de dados
      matches: []
    };
    
    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern.pattern, pattern.flags || 'gi');
        const matches = text.match(regex);
        
        if (matches) {
          textResults.matches.push({
            pattern: pattern.name || pattern.pattern,
            count: matches.length,
            matches: options.includeMatches ? matches.slice(0, 10) : [] // Limita matches
          });
        }
      } catch (error) {
        textResults.matches.push({
          pattern: pattern.name || pattern.pattern,
          error: error.message
        });
      }
    }
    
    results.push(textResults);
    
    // Yield periodicamente para não bloquear
    if (results.length % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return {
    totalTexts: texts.length,
    totalPatterns: patterns.length,
    results,
    summary: generateRegexSummary(results)
  };
}

/**
 * Analisa tabs em lote
 * @param {object} data - Dados das tabs
 * @returns {Promise<object>} - Análise das tabs
 */
async function analyzeTabs(data) {
  const { tabs, analysisType = 'basic' } = data;
  const analysis = {
    totalTabs: tabs.length,
    domains: new Map(),
    patterns: new Map(),
    categories: new Map(),
    duplicates: [],
    recommendations: []
  };
  
  for (const tab of tabs) {
    try {
      // Análise de domínio
      if (tab.url) {
        const domain = extractDomain(tab.url);
        if (domain) {
          analysis.domains.set(domain, (analysis.domains.get(domain) || 0) + 1);
        }
      }
      
      // Análise de padrões no título
      if (tab.title) {
        const patterns = extractTitlePatterns(tab.title);
        patterns.forEach(pattern => {
          analysis.patterns.set(pattern, (analysis.patterns.get(pattern) || 0) + 1);
        });
      }
      
      // Categorização
      const category = categorizeTab(tab);
      analysis.categories.set(category, (analysis.categories.get(category) || 0) + 1);
      
    } catch (error) {
      // Ignora erros individuais para não falhar toda a análise
      continue;
    }
    
    // Yield periodicamente
    if (analysis.totalTabs % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // Detecta duplicatas
  analysis.duplicates = findDuplicateTabs(tabs);
  
  // Gera recomendações
  analysis.recommendations = generateRecommendations(analysis);
  
  // Converte Maps para objetos para serialização
  return {
    totalTabs: analysis.totalTabs,
    domains: Object.fromEntries(analysis.domains),
    patterns: Object.fromEntries(analysis.patterns),
    categories: Object.fromEntries(analysis.categories),
    duplicates: analysis.duplicates,
    recommendations: analysis.recommendations
  };
}

/**
 * Processa URLs em lote
 * @param {object} data - URLs para processar
 * @returns {Promise<object>} - Resultado do processamento
 */
async function processBatchUrls(data) {
  const { urls, operations = ['domain', 'path', 'params'] } = data;
  const results = [];
  
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const result = { url: url.substring(0, 100) }; // Limita URL para privacidade
      
      if (operations.includes('domain')) {
        result.domain = urlObj.hostname;
      }
      
      if (operations.includes('path')) {
        result.path = urlObj.pathname;
      }
      
      if (operations.includes('params')) {
        result.paramCount = urlObj.searchParams.size;
      }
      
      if (operations.includes('protocol')) {
        result.protocol = urlObj.protocol;
      }
      
      results.push(result);
      
    } catch (error) {
      results.push({
        url: url.substring(0, 100),
        error: error.message
      });
    }
    
    // Yield periodicamente
    if (results.length % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return {
    totalUrls: urls.length,
    processed: results.length,
    results
  };
}

/**
 * Realiza matching de padrões
 * @param {object} data - Dados para matching
 * @returns {Promise<object>} - Resultado do matching
 */
async function performPatternMatching(data) {
  const { items, patterns, matchType = 'any' } = data;
  const matches = [];
  
  for (const item of items) {
    const itemMatches = [];
    
    for (const pattern of patterns) {
      try {
        let isMatch = false;
        
        switch (pattern.type) {
          case 'regex':
            const regex = new RegExp(pattern.value, pattern.flags || 'i');
            isMatch = regex.test(item.text || item.title || item.url || '');
            break;
            
          case 'substring':
            const text = (item.text || item.title || item.url || '').toLowerCase();
            isMatch = text.includes(pattern.value.toLowerCase());
            break;
            
          case 'exact':
            isMatch = (item.text || item.title || item.url || '') === pattern.value;
            break;
            
          default:
            isMatch = false;
        }
        
        if (isMatch) {
          itemMatches.push({
            pattern: pattern.name || pattern.value,
            type: pattern.type,
            confidence: calculateMatchConfidence(item, pattern)
          });
        }
        
      } catch (error) {
        // Ignora padrões inválidos
        continue;
      }
    }
    
    // Aplica lógica de matching
    let includeItem = false;
    if (matchType === 'any' && itemMatches.length > 0) {
      includeItem = true;
    } else if (matchType === 'all' && itemMatches.length === patterns.length) {
      includeItem = true;
    }
    
    if (includeItem) {
      matches.push({
        item: {
          id: item.id,
          title: item.title?.substring(0, 50) || '',
          domain: extractDomain(item.url)
        },
        matches: itemMatches
      });
    }
    
    // Yield periodicamente
    if (matches.length % 25 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return {
    totalItems: items.length,
    totalMatches: matches.length,
    matches
  };
}

/**
 * Agrega dados
 * @param {object} data - Dados para agregar
 * @returns {Promise<object>} - Dados agregados
 */
async function aggregateData(data) {
  const { items, groupBy, aggregations = ['count'] } = data;
  const groups = new Map();
  
  for (const item of items) {
    const groupKey = getGroupKey(item, groupBy);
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        items: [],
        count: 0,
        sum: 0,
        avg: 0,
        min: Infinity,
        max: -Infinity
      });
    }
    
    const group = groups.get(groupKey);
    group.items.push(item.id || item.title?.substring(0, 30) || 'unknown');
    group.count++;
    
    // Agregações numéricas se disponíveis
    if (item.value !== undefined) {
      group.sum += item.value;
      group.min = Math.min(group.min, item.value);
      group.max = Math.max(group.max, item.value);
    }
    
    // Yield periodicamente
    if (groups.size % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // Calcula médias
  for (const group of groups.values()) {
    if (group.count > 0 && group.sum > 0) {
      group.avg = group.sum / group.count;
    }
    if (group.min === Infinity) group.min = 0;
    if (group.max === -Infinity) group.max = 0;
  }
  
  return {
    totalItems: items.length,
    totalGroups: groups.size,
    groups: Object.fromEntries(groups)
  };
}

/**
 * Otimiza cache
 * @param {object} data - Dados do cache
 * @returns {Promise<object>} - Cache otimizado
 */
async function optimizeCache(data) {
  const { cacheEntries, maxSize, strategy = 'lru' } = data;
  const optimized = [];
  const removed = [];
  
  // Ordena entradas baseado na estratégia
  let sortedEntries;
  switch (strategy) {
    case 'lru':
      sortedEntries = cacheEntries.sort((a, b) => b.lastAccessed - a.lastAccessed);
      break;
    case 'frequency':
      sortedEntries = cacheEntries.sort((a, b) => b.accessCount - a.accessCount);
      break;
    case 'size':
      sortedEntries = cacheEntries.sort((a, b) => a.size - b.size);
      break;
    default:
      sortedEntries = cacheEntries;
  }
  
  let currentSize = 0;
  for (const entry of sortedEntries) {
    if (optimized.length < maxSize && currentSize + entry.size <= maxSize * 1.2) {
      optimized.push({
        key: entry.key,
        size: entry.size,
        lastAccessed: entry.lastAccessed,
        accessCount: entry.accessCount
      });
      currentSize += entry.size;
    } else {
      removed.push({
        key: entry.key,
        reason: optimized.length >= maxSize ? 'max_entries' : 'size_limit'
      });
    }
    
    // Yield periodicamente
    if ((optimized.length + removed.length) % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return {
    originalSize: cacheEntries.length,
    optimizedSize: optimized.length,
    removedCount: removed.length,
    spaceSaved: cacheEntries.length - optimized.length,
    optimized,
    removed
  };
}

// Funções auxiliares

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function extractTitlePatterns(title) {
  const patterns = [];
  
  // Padrões comuns
  if (title.includes(' - ')) patterns.push('dash_separator');
  if (title.includes(' | ')) patterns.push('pipe_separator');
  if (title.match(/\(\d+\)/)) patterns.push('number_parentheses');
  if (title.match(/^\[.*\]/)) patterns.push('bracket_prefix');
  if (title.length > 50) patterns.push('long_title');
  
  return patterns;
}

function categorizeTab(tab) {
  const url = tab.url || '';
  const title = tab.title || '';
  
  if (url.includes('github.com')) return 'development';
  if (url.includes('stackoverflow.com')) return 'development';
  if (url.includes('youtube.com')) return 'media';
  if (url.includes('gmail.com') || url.includes('outlook.com')) return 'email';
  if (url.includes('docs.google.com') || url.includes('office.com')) return 'documents';
  if (url.includes('amazon.com') || url.includes('ebay.com')) return 'shopping';
  if (title.toLowerCase().includes('news')) return 'news';
  
  return 'general';
}

function findDuplicateTabs(tabs) {
  const urlMap = new Map();
  const duplicates = [];
  
  for (const tab of tabs) {
    if (tab.url) {
      if (urlMap.has(tab.url)) {
        duplicates.push({
          url: tab.url.substring(0, 100),
          count: urlMap.get(tab.url) + 1
        });
        urlMap.set(tab.url, urlMap.get(tab.url) + 1);
      } else {
        urlMap.set(tab.url, 1);
      }
    }
  }
  
  return duplicates.filter(d => d.count > 1);
}

function generateRecommendations(analysis) {
  const recommendations = [];
  
  // Recomendações baseadas em domínios
  const topDomains = Object.entries(analysis.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  if (topDomains.length > 0 && topDomains[0][1] > 3) {
    recommendations.push({
      type: 'grouping',
      message: `Considere agrupar ${topDomains[0][1]} abas do domínio ${topDomains[0][0]}`,
      priority: 'high'
    });
  }
  
  // Recomendações baseadas em duplicatas
  if (analysis.duplicates.length > 0) {
    recommendations.push({
      type: 'cleanup',
      message: `${analysis.duplicates.length} URLs duplicadas encontradas`,
      priority: 'medium'
    });
  }
  
  return recommendations;
}

function generateRegexSummary(results) {
  const summary = {
    totalMatches: 0,
    patternsWithMatches: 0,
    averageMatchesPerText: 0
  };
  
  for (const result of results) {
    for (const match of result.matches) {
      if (match.count > 0) {
        summary.totalMatches += match.count;
        summary.patternsWithMatches++;
      }
    }
  }
  
  summary.averageMatchesPerText = results.length > 0 ? 
    summary.totalMatches / results.length : 0;
    
  return summary;
}

function calculateMatchConfidence(item, pattern) {
  // Calcula confiança baseada no tipo de match e contexto
  let confidence = 0.5; // Base
  
  if (pattern.type === 'exact') confidence = 1.0;
  else if (pattern.type === 'regex') confidence = 0.8;
  else if (pattern.type === 'substring') confidence = 0.6;
  
  // Ajusta baseado no comprimento do match
  const text = item.text || item.title || item.url || '';
  if (text.length > 0) {
    const matchRatio = pattern.value.length / text.length;
    confidence *= Math.min(1.0, matchRatio * 2);
  }
  
  return Math.round(confidence * 100) / 100;
}

function getGroupKey(item, groupBy) {
  switch (groupBy) {
    case 'domain':
      return extractDomain(item.url) || 'unknown';
    case 'category':
      return categorizeTab(item);
    case 'title_prefix':
      return (item.title || '').split(' ')[0] || 'unknown';
    default:
      return 'default';
  }
}