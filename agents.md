# 🧑‍💻 AGENTS.MD — Extensão de Produtividade: Agrupador de Abas

## 🎯 INSTRUÇÃO OBRIGATÓRIA PARA TODOS OS AGENTES

**ANTES DE QUALQUER MODIFICAÇÃO, VOCÊ DEVE:**

1. **LER COMPLETAMENTE este arquivo agents.md**
2. **SEGUIR TODAS as orientações e fluxos definidos**
3. **RESPEITAR as prioridades e regras invioláveis**
4. **USAR OS PADRÕES e convenções especificados**

---

## 🏷️ IDENTIDADE DO AGENTE

- **Especialização:**
  - Extensões de navegador (Chrome e Firefox)
  - Manipulação e agrupamento de abas
  - Implementação de regras embutidas e customizadas
  - UI de popup, opções e help
  - Gerenciamento de dependências locais (pasta vendor)
- **Tecnologias-chave:**
  - JavaScript/TypeScript, HTML, CSS
  - APIs de extensões Chrome/Firefox (chrome.tabs, browser.tabs, etc.)
  - WebExtension Polyfill
  - Modularização e boas práticas de UX

- **Contexto:**
  - Projeto de extensão para produtividade, agrupando e renomeando abas conforme regras
  - Suporte a múltiplos navegadores
  - Interface de configuração e ajuda acessível via popup
  - Dependências locais em vendor, sem dependências externas dinâmicas

---

## 🥇 PRIORIDADES ABSOLUTAS

1. **Consistência e segurança do código**
2. **Compatibilidade total entre Chrome e Firefox**
3. **Performance e responsividade da extensão**
4. **Experiência do usuário clara e intuitiva**
5. **Integridade das dependências locais (vendor)**

**Ordem de importância:**
1. Segurança > 2. Compatibilidade > 3. Performance > 4. UX > 5. Organização

**Validações obrigatórias:**
- Lint e formatação de código
- Testes de agrupamento e renomeação de abas
- Testes de regras customizadas
- Verificação de funcionamento do popup, opções e help
- Conferência de integridade da pasta vendor

---

## 🗂️ ESTRUTURA DO PROJETO

- **src/**: Código-fonte principal da extensão
- **popup/**: Interface de popup/configuração
- **options/**: Tela de opções avançadas
- **help/**: Documentação e ajuda ao usuário
- **vendor/**: Dependências locais (NUNCA editar manualmente)
- **rules/**: Regras embutidas e customizadas
- **manifest.json**: Manifesto da extensão
- **agents.md**: Este arquivo (referência obrigatória)
- **changelog.md**: Histórico de mudanças

**Padrões de nomenclatura:**
- Arquivos e pastas em inglês, nomes descritivos
- Funções e variáveis em camelCase
- Classes em PascalCase

---

## 🔄 FLUXO DE TRABALHO OBRIGATÓRIO

1. 📖 Ler este agents.md completamente
2. 🎯 Identificar prioridades e regras
3. 📝 Implementar mudanças seguindo padrões
4. ✅ Executar validações obrigatórias (lint, testes, build)
5. 📋 Atualizar documentação (changelog, help, etc.)
6. 🔄 Verificar arquivos gerados no build
7. 💾 Commit seguindo convenções
8. ✅ Confirmar tarefa completa

**NUNCA pule etapas!**

---

## 🛠️ SCRIPTS E VALIDAÇÕES

- **Lint:**
  - `npm run lint` ou equivalente
- **Testes:**
  - `npm test` ou script de testes definido
- **Build:**
  - `npm run build` (gera versão para Chrome e Firefox)
- **Validação de regras:**
  - Testar agrupamento e renomeação de abas
  - Testar criação/edição de regras customizadas
- **Verificação de dependências:**
  - Conferir integridade da pasta vendor

---

## 💻 PADRÕES DE CÓDIGO

- Modularize funções e regras
- Use nomes claros e descritivos
- Evite duplicação de código
- Sempre documente funções públicas
- Siga exemplos de código do projeto
- **Anti-padrões proibidos:**
  - Código "spaghetti"
  - Funções muito longas (>40 linhas)
  - Variáveis globais não controladas
  - Modificação manual de arquivos em vendor

---

## 🚫 AVISOS CRÍTICOS

- **NUNCA** modifique arquivos em vendor manualmente
- **NUNCA** exponha dados sensíveis do usuário
- **NUNCA** pule validações obrigatórias
- **NUNCA** suba código sem passar por todos os testes
- **NUNCA** ignore este agents.md

**Riscos de não seguir:**
- Bugs graves em produção
- Incompatibilidade entre navegadores
- Perda de produtividade e retrabalho
- Quebra de funcionalidades críticas

---

## ✅ CHECKLIST DE QUALIDADE

### Antes de iniciar:
- [ ] Li completamente o agents.md
- [ ] Compreendi prioridades e regras
- [ ] Identifiquei fluxo obrigatório
- [ ] Conheço padrões de código
- [ ] Entendi validações obrigatórias

### Durante a execução:
- [ ] Seguindo todos os padrões
- [ ] Executando validações
- [ ] Mantendo consistência
- [ ] Documentando mudanças
- [ ] Testando funcionalidades

### Após completar:
- [ ] Validei todas as regras e testes
- [ ] Atualizei documentação
- [ ] Segui convenções de commit
- [ ] Verifiquei build e arquivos
- [ ] Confirmei qualidade final

---

## 📢 MENSAGEM FINAL

O arquivo `agents.md` é a referência máxima deste projeto. Siga todas as orientações para garantir qualidade, consistência e produtividade. NUNCA inicie tarefas sem consultá-lo. O sucesso do projeto depende do cumprimento rigoroso deste guia.
