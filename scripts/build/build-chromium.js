const fs = require("fs-extra");
const path = require("path");

const buildDir = path.resolve(__dirname, "../../dist/chromium");
const manifestSrc = path.resolve(__dirname, "../../manifest-chromium.json");
const manifestDest = path.join(buildDir, "manifest.json");

// Criar diretório de build
fs.ensureDirSync(buildDir);

// Copiar manifest específico
fs.copyFileSync(manifestSrc, manifestDest);

// Copiar arquivos essenciais
const copyOperations = [
  fs.copy(
    path.resolve(__dirname, "../../background.js"),
    path.join(buildDir, "background.js")
  ),
  fs.copy(
    path.resolve(__dirname, "../../content-script.js"),
    path.join(buildDir, "content-script.js")
  ),
  fs.copy(path.resolve(__dirname, "../../popup"), path.join(buildDir, "popup")),
  fs.copy(
    path.resolve(__dirname, "../../options"),
    path.join(buildDir, "options")
  ),
  fs.copy(path.resolve(__dirname, "../../help"), path.join(buildDir, "help")),
  fs.copy(path.resolve(__dirname, "../../icons"), path.join(buildDir, "icons")),
];

Promise.all(copyOperations)
  .then(() => console.log("Build Chromium completo em:", buildDir))
  .catch((err) => {
    console.error("Erro no build Chromium:", err);
    process.exit(1);
  });
