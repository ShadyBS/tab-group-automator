// scripts/validation/validate-csp.js
const fs = require("fs");
const path = require("path");

function validateCSP() {
  const manifestPath = path.join(process.cwd(), "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Manifest file not found.");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const csp = manifest.content_security_policy || "";
  if (!csp.includes("script-src") || !csp.includes("object-src")) {
    console.error("CSP must define script-src and object-src.");
    process.exit(1);
  }
  if (csp.includes("unsafe-inline") || csp.includes("unsafe-eval")) {
    console.error("CSP must not allow unsafe-inline or unsafe-eval.");
    process.exit(1);
  }
  console.log("CSP validation passed.");
}

validateCSP();
