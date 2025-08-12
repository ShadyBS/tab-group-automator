// scripts/utils/changelog-generator.js
const fs = require('fs');
const path = require('path');

function generateReleaseNotes() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found.');
    process.exit(1);
  }
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const match = changelog.match(
    /##\s*\[?([\d.]+)\]?\s*-\s*\d{4}-\d{2}-\d{2}([\s\S]*?)(?=##|$)/
  );
  if (!match) {
    console.error('No release entry found in CHANGELOG.md.');
    process.exit(1);
  }
  const version = match[1];
  const notes = match[2].trim();
  const notesPath = path.join(process.cwd(), `release-notes-v${version}.md`);
  fs.writeFileSync(notesPath, `# Release ${version}\n\n${notes}\n`);
  console.log(`Release notes generated: release-notes-v${version}.md`);
}

generateReleaseNotes();
