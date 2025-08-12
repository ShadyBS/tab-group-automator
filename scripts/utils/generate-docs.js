// scripts/utils/generate-docs.js
const fs = require('fs');
const path = require('path');

function generateDocs() {
  const docPath = path.join(process.cwd(), 'scripts', 'README.md');
  const files = [
    {
      file: 'validation/validate-manifest.js',
      desc: 'Valida o manifest.json da extensão.',
    },
    {
      file: 'validation/validate-permissions.js',
      desc: 'Audita permissões declaradas.',
    },
    {
      file: 'validation/validate-security.js',
      desc: 'Verifica práticas de segurança.',
    },
    {
      file: 'validation/validate-csp.js',
      desc: 'Valida Content Security Policy.',
    },
    {
      file: 'validation/validate-performance.js',
      desc: 'Checa tamanho e performance do build.',
    },
    {
      file: 'build/build-chromium.js',
      desc: 'Gera build para navegadores Chromium.',
    },
    { file: 'build/build-firefox.js', desc: 'Gera build para Firefox.' },
    {
      file: 'utils/changelog-generator.js',
      desc: 'Gera release notes a partir do changelog.',
    },
    {
      file: 'utils/vendor-integrity.js',
      desc: 'Verifica integridade da pasta vendor.',
    },
    { file: 'utils/generate-summary.js', desc: 'Gera sumário do build.' },
    {
      file: 'utils/remove-legacy-scripts.js',
      desc: 'Remove scripts e pipelines legados.',
    },
  ];

  const content = [
    '# Scripts Utilitários e de Validação',
    '',
    '| Script | Descrição |',
    '|--------|-----------|',
    ...files.map((f) => `| \`scripts/${f.file}\` | ${f.desc} |`),
  ].join('\n');

  fs.writeFileSync(docPath, content);
  console.log('Documentação de scripts gerada:', docPath);
}

generateDocs();
