// scripts/utils/remove-legacy-scripts.js
const fs = require('fs');
const path = require('path');

const legacyPatterns = [
  'scripts/legacy/',
  'scripts/old/',
  'scripts/obsolete/',
  'scripts/deprecated/',
  '.github/workflows/old*',
  '.github/workflows/legacy*',
  '.github/workflows/deprecated*',
];

function removeLegacy() {
  legacyPatterns.forEach((pattern) => {
    const dir = pattern.replace(/[*\/]+$/, '');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`Removed legacy directory: ${dir}`);
    }
    // Remove matching files
    const parent = path.dirname(dir);
    if (fs.existsSync(parent)) {
      fs.readdirSync(parent).forEach((file) => {
        if (file.startsWith(path.basename(dir))) {
          const filePath = path.join(parent, file);
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`Removed legacy file: ${filePath}`);
        }
      });
    }
  });
}

removeLegacy();
