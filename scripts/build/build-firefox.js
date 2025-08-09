// scripts/build/build-firefox.js
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function buildFirefox() {
  const srcDir = path.join(process.cwd(), "src");
  const distDir = path.join(process.cwd(), "dist", "firefox");
  if (!fs.existsSync(srcDir)) {
    console.error("src/ directory not found.");
    process.exit(1);
  }
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  // Simplesmente copia arquivos para build demo (substitua por webpack/rollup se necessário)
  fs.cpSync(srcDir, distDir, { recursive: true });
  // Copia manifest
  fs.copyFileSync("manifest.json", path.join(distDir, "manifest.json"));
  console.log("Firefox build completed.");
}

buildFirefox();
