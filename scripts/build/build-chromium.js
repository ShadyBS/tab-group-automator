const fs = require('fs-extra');
const path = require('path');

const buildDir = path.resolve(__dirname, '../../dist/chromium');
const manifestSrc = path.resolve(__dirname, '../../manifest-chromium.json');
const manifestDest = path.join(buildDir, 'manifest.json');

// Criar diretório de build
fs.ensureDirSync(buildDir);

// Copiar manifest específico
fs.copyFileSync(manifestSrc, manifestDest);

// Copiar arquivos essenciais
const essentialJs = [
  'background.js',
  'app-state.js',
  'context-menu-manager.js',
  'grouping-logic.js',
  'logger.js',
  'settings-manager.js',
  'initialization-cache.js',
  'module-loader.js',
  'cache-warmer.js',
  'worker-manager.js',
  'performance-config.js',
  'performance-monitor.js',
  'performance-optimizations.js',
  'performance-validator.js',
  'performance-worker.js',
  'validation-utils.js',
  'tab-renaming-engine.js',
  'learning-engine.js',
  'adaptive-error-handler.js',
  'adaptive-memory-manager.js',
  'browser-api-wrapper.js',
  'api-rate-limiter.js',
  'parallel-batch-processor.js',
  'intelligent-cache-manager.js',
];

const copyOperations = [
  ...essentialJs.map((js) =>
    fs.copy(path.resolve(__dirname, `../../${js}`), path.join(buildDir, js))
  ),
  fs.copy(
    path.resolve(__dirname, '../../content-script.js'),
    path.join(buildDir, 'content-script.js')
  ),
  fs.copy(path.resolve(__dirname, '../../popup'), path.join(buildDir, 'popup')),
  fs.copy(
    path.resolve(__dirname, '../../options'),
    path.join(buildDir, 'options')
  ),
  fs.copy(path.resolve(__dirname, '../../help'), path.join(buildDir, 'help')),
  fs.copy(path.resolve(__dirname, '../../icons'), path.join(buildDir, 'icons')),
  fs.copy(
    path.resolve(__dirname, '../../vendor'),
    path.join(buildDir, 'vendor')
  ),
  fs.copy(path.resolve(__dirname, '../../src'), path.join(buildDir, 'src')),
];

Promise.all(copyOperations)
  .then(() => console.log('Build Chromium completo em:', buildDir))
  .catch((err) => {
    console.error('Erro no build Chromium:', err);
    process.exit(1);
  });
