// scripts/validation/validate-manifest.js
const fs = require('fs');
const path = require('path');

function validateManifest() {
  const manifestPath = path.join(process.cwd(), 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Manifest file not found.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    console.error('Manifest version must be 3.');
    process.exit(1);
  }
  if (!manifest.name || !manifest.version) {
    console.error('Manifest must have name and version.');
    process.exit(1);
  }
  console.log('Manifest basic validation passed.');
}

validateManifest();
