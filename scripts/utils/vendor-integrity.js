// scripts/utils/vendor-integrity.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashDir(dir) {
  let hash = crypto.createHash('sha256');
  function walk(d) {
    fs.readdirSync(d).forEach((file) => {
      const filePath = path.join(d, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) walk(filePath);
      else hash.update(fs.readFileSync(filePath));
    });
  }
  walk(dir);
  return hash.digest('hex');
}

function checkVendorIntegrity() {
  const vendorDir = path.join(process.cwd(), 'vendor');
  const hashFile = path.join(process.cwd(), 'vendor.hash');
  if (!fs.existsSync(vendorDir)) {
    console.error('vendor/ directory not found.');
    process.exit(1);
  }
  const currentHash = hashDir(vendorDir);
  if (!fs.existsSync(hashFile)) {
    fs.writeFileSync(hashFile, currentHash);
    console.log('Vendor hash created.');
    return;
  }
  const savedHash = fs.readFileSync(hashFile, 'utf8').trim();
  if (currentHash !== savedHash) {
    console.error('Vendor integrity check failed! vendor/ was modified.');
    process.exit(1);
  }
  console.log('Vendor integrity check passed.');
}

checkVendorIntegrity();
