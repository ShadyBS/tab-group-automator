// scripts/validation/validate-performance.js
const fs = require('fs');
const path = require('path');

function validatePerformance() {
  const distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    console.warn('dist/ directory not found. Skipping performance validation.');
    process.exit(0);
  }
  let totalSize = 0;
  function walk(dir) {
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) walk(filePath);
      else totalSize += stat.size;
    });
  }
  walk(distPath);
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (totalSize > maxSize) {
    console.error(`Build size ${totalSize} exceeds 10MB limit.`);
    process.exit(1);
  }
  console.log('Performance validation passed.');
}

validatePerformance();
