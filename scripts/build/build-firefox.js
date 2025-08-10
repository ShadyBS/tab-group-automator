// scripts/build/build-firefox.js
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function buildFirefox() {
  const pathRoot = process.cwd();
  const distDir = path.join(pathRoot, "dist", "firefox");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  // Copiar manifest
  fs.copyFileSync(
    path.join(pathRoot, "manifest.json"),
    path.join(distDir, "manifest.json")
  );

  // Copiar arquivos essenciais
  const essentialJs = [
    "background.js",
    "app-state.js",
    "context-menu-manager.js",
    "grouping-logic.js",
    "logger.js",
    "settings-manager.js",
    "initialization-cache.js",
    "module-loader.js",
    "cache-warmer.js",
    "worker-manager.js",
    "performance-config.js",
    "performance-monitor.js",
    "performance-optimizations.js",
    "performance-validator.js",
    "performance-worker.js",
    "validation-utils.js",
    "tab-renaming-engine.js",
    "learning-engine.js",
    "adaptive-error-handler.js",
    "adaptive-memory-manager.js",
    "browser-api-wrapper.js",
    "api-rate-limiter.js",
    "parallel-batch-processor.js",
    "intelligent-cache-manager.js",
  ];

  essentialJs.forEach((js) => {
    fs.copyFileSync(path.join(pathRoot, js), path.join(distDir, js));
  });

  fs.copyFileSync(
    path.join(pathRoot, "content-script.js"),
    path.join(distDir, "content-script.js")
  );

  // Copiar diretórios essenciais
  const dirsToCopy = ["popup", "options", "help", "icons", "vendor", "src"];
  dirsToCopy.forEach((dir) => {
    const srcDir = path.join(pathRoot, dir);
    const destDir = path.join(distDir, dir);
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, destDir, { recursive: true });
    }
  });

  console.log("Firefox build completed.");
}

buildFirefox();
