// scripts/utils/generate-summary.js
const fs = require("fs");
const path = require("path");

function generateSummary() {
  const manifestPath = path.join(process.cwd(), "manifest.json");
  const chromiumManifest = path.join(
    process.cwd(),
    "dist",
    "chromium",
    "manifest.json"
  );
  const firefoxManifest = path.join(
    process.cwd(),
    "dist",
    "firefox",
    "manifest.json"
  );
  const summaryPath = path.join(process.cwd(), "build-summary.md");
  const now = new Date().toISOString();

  let versions = [];
  if (fs.existsSync(chromiumManifest)) {
    const m = JSON.parse(fs.readFileSync(chromiumManifest, "utf8"));
    versions.push(`- Chromium: ${m.version || "unknown"}`);
  }
  if (fs.existsSync(firefoxManifest)) {
    const m = JSON.parse(fs.readFileSync(firefoxManifest, "utf8"));
    versions.push(`- Firefox: ${m.version || "unknown"}`);
  }

  const summary = [
    `# Build Summary`,
    `Date: ${now}`,
    `Supported browsers:`,
    ...versions,
    `\nArtifacts:`,
    `- dist/chromium/`,
    `- dist/firefox/`,
  ].join("\n");

  fs.writeFileSync(summaryPath, summary);
  console.log("Build summary generated:", summaryPath);
}

generateSummary();
