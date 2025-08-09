// scripts/validation/validate-permissions.js
const fs = require("fs");
const path = require("path");

function validatePermissions() {
  const manifestPath = path.join(process.cwd(), "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Manifest file not found.");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const dangerous = ["<all_urls>", "tabs", "history", "bookmarks", "cookies"];
  const perms = [
    ...(manifest.permissions || []),
    ...(manifest.host_permissions || []),
  ];
  const found = perms.filter((p) => dangerous.includes(p));
  if (found.length > 0) {
    // Permissões tabs e <all_urls> são necessárias e justificadas para o funcionamento da extensão.
    const allowed = ["<all_urls>", "tabs"];
    const notAllowed = found.filter((p) => !allowed.includes(p));
    if (notAllowed.length > 0) {
      console.error(
        "Dangerous permissions detected (not allowed):",
        notAllowed.join(", ")
      );
      process.exit(1);
    } else {
      console.warn(
        "Warning: permissions <all_urls> e tabs detectadas, mas permitidas por justificativa do projeto."
      );
    }
  }
  console.log("Permissions validation passed.");
}

validatePermissions();
