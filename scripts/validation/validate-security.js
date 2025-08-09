// scripts/validation/validate-security.js
const fs = require("fs");
const path = require("path");

function validateSecurity() {
  const manifestPath = path.join(process.cwd(), "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Manifest file not found.");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    manifest.content_security_policy &&
    typeof manifest.content_security_policy === "string" &&
    manifest.content_security_policy.includes("unsafe-eval")
  ) {
    console.error("CSP contains unsafe-eval, which is not allowed.");
    process.exit(1);
  }
  console.log("Security validation passed.");
}

validateSecurity();
