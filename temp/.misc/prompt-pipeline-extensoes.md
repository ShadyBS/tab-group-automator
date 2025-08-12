# Pipeline CI/CD Simplificado para Extensão de Navegador — Execução por Agente de AI

## Objetivo

Pipeline enxuto, modular e documentado, sem etapas de testing automatizado ou upload para stores, focado em build multi-browser, validação, documentação e manutenção.

---

## 1. Validação e Qualidade

- Linting (ESLint, Prettier, StyleLint)
- Type Checking (TypeScript)
- Análise de permissões e segurança do manifest
- Checagem de políticas de store e privacidade
- Detecção de código morto e análise de complexidade

## 2. Build Multi-Browser

- Build para Chromium (Chrome, Edge, Brave, etc) — Manifest V3
- Build para Firefox (WebExtensions API)
- Otimização de assets e minificação
- Geração de source maps

## 3. Configuração e Documentação

- Versionamento automático
- Geração de changelog
- Notas de versão dos releases geradas automaticamente a partir do changelog
- Documentação automática dos scripts e pipeline
- Remoção de scripts e pipelines antigos suplantados

## 4. Validação Final

- Checagem de integridade do build
- Validação de performance básica (tamanho, inicialização)
- Geração de pacotes (.crx, .xpi, .zip)

## 5. Monitoramento Essencial

- Setup de monitoramento de erros e alertas de segurança (opcional)

---

### Observações para agente de AI

- Não incluir etapas de testes automatizados ou upload para stores.
- Não usar dependências externas dinâmicas.
- Priorizar clareza, modularidade e documentação.
- Garantir que scripts antigos sejam removidos para evitar conflitos.
- Gerar documentação detalhada de cada etapa e comando do pipeline.
