const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const archiver = require("archiver");

const DIST_DIR = path.join(__dirname, "dist");
const SOURCE_DIR = __dirname;

// Lista de arquivos e pastas a serem incluídos no zip.
// Usar uma lista de permissão é mais seguro e limpo.
const FILES_TO_INCLUDE = [
  "background.js",
  "app-state.js",
  "context-menu-manager.js",
  "grouping-logic.js",
  "logger.js",
  "settings-manager.js",
  "icons",
  "options",
  "popup",
  "help",
  "vendor",
];

// Garante que o diretório de distribuição exista.
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR);
}

/**
 * Cria um arquivo zip para um navegador específico.
 * @param {string} browser - 'firefox' ou 'chrome'.
 */
function createZip(browser) {
  const manifestName =
    browser === "firefox" ? "manifest.json" : "manifest-chromium.json";
  const outputFileName = `auto-tab-grouper-${browser}.zip`;
  const outputPath = path.join(DIST_DIR, outputFileName);

  console.log(`A criar o pacote para ${browser}...`);

  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Nível máximo de compressão
  });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      console.log(
        `✅ Pacote para ${browser} criado com sucesso em: ${outputPath}`
      );
      console.log(`   Tamanho: ${(archive.pointer() / 1024).toFixed(2)} KB`);
      resolve();
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn(`Aviso do Archiver: ${err}`);
      } else {
        reject(err);
      }
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Adiciona o manifesto correto com o nome 'manifest.json'
    archive.file(path.join(SOURCE_DIR, manifestName), {
      name: "manifest.json",
    });

    // Adiciona os outros arquivos e pastas
    FILES_TO_INCLUDE.forEach((fileOrDir) => {
      const fullPath = path.join(SOURCE_DIR, fileOrDir);
      if (fs.existsSync(fullPath)) {
        if (fs.lstatSync(fullPath).isDirectory()) {
          archive.directory(fullPath, fileOrDir);
        } else {
          archive.file(fullPath, { name: fileOrDir });
        }
      } else {
        console.warn(
          `Aviso: O arquivo/diretório '${fileOrDir}' não foi encontrado e será ignorado.`
        );
      }
    });

    archive.finalize();
  });
}

async function buildAll() {
  try {
    console.log("A iniciar o processo de empacotamento...");

    console.log("\nPasso 1: A compilar o CSS com Tailwind...");
    // Executa o comando do Tailwind para gerar o CSS otimizado.
    execSync("npx tailwindcss -o ./vendor/tailwind.css --minify");
    console.log("✅ CSS compilado com sucesso.");

    console.log("\nPasso 2: A criar os pacotes da extensão...");
    await createZip("firefox");
    await createZip("chromium");
    console.log("\nProcesso concluído!");
  } catch (error) {
    console.error("❌ Erro durante o processo de empacotamento:", error);
    process.exit(1);
  }
}

buildAll();
