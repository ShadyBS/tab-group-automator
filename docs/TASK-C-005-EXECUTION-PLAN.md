# 📋 Plano de Execução: TASK-C-005 - Otimizar Permissões para Tab Management

**Objetivo:** Revisar, otimizar e documentar as permissões da extensão para melhorar a segurança, a conformidade com as políticas da loja e a transparência para o usuário, seguindo as diretrizes do `agents.md`.

---

## 📝 Fases do Plano

### Fase 1: Análise e Documentação (Est: 1 hora)

1.  **Analisar `manifest.json` Atual:**
    *   **Ação:** Ler o arquivo `manifest.json` para listar todas as permissões atualmente declaradas (`permissions` e `host_permissions`).
    *   **Ferramenta:** `read_file`

2.  **Mapear Uso de Permissões no Código:**
    *   **Ação:** Pesquisar no código-fonte (`.js` files) o uso das APIs correspondentes a cada permissão para determinar sua necessidade. Foco especial em `tabs`, `storage`, `scripting`, e o motivo para `<all_urls>`.
    *   **Ferramenta:** `search_files`

3.  **Criar Documento de Justificativa:**
    *   **Ação:** Criar o arquivo `PERMISSIONS_JUSTIFICATION.md`. Nele, documentar a necessidade de cada permissão, com uma justificativa detalhada para `<all_urls>`, explicando que é essencial para a funcionalidade de renomeação de abas que precisa acessar o conteúdo da página.
    *   **Ferramenta:** `write_to_file`

### Fase 2: Refatoração do `manifest.json` (Est: 1 hora)

1.  **Remover Permissões Não Utilizadas:**
    *   **Ação:** Com base na análise da Fase 1, remover quaisquer permissões do `manifest.json` que não são ativamente utilizadas pela extensão.
    *   **Ferramenta:** `replace_in_file`

2.  **Implementar Permissões Opcionais:**
    *   **Ação:** Mover permissões que habilitam funcionalidades não essenciais para a seção `optional_permissions`. Um candidato provável é a permissão `notifications`.
    *   **Ferramenta:** `replace_in_file`

### Fase 3: Implementação do Fluxo de Requisição de Permissão (Est: 1.5 horas)

1.  **Identificar Pontos de Gatilho:**
    *   **Ação:** Localizar no código (provavelmente em `options.js` ou `popup.js`) onde uma funcionalidade que depende de uma permissão opcional é ativada.

2.  **Desenvolver o Fluxo Educativo:**
    *   **Ação:** Modificar a interface (ex: `options/options.html` e `options/options.js`) para:
        *   Exibir uma explicação clara e concisa sobre por que a permissão é necessária.
        *   Adicionar um botão ou switch que, ao ser clicado, chama `browser.permissions.request()` para solicitar a permissão opcional ao usuário.
    *   **Ferramentas:** `read_file`, `replace_in_file`

### Fase 4: Criação da Documentação Final (Est: 0.5 hora)

1.  **Criar `PERMISSIONS.md`:**
    *   **Ação:** Criar um novo arquivo `PERMISSIONS.md` que lista todas as permissões (obrigatórias e opcionais) e explica o que cada uma faz em termos simples e diretos para o usuário final.
    *   **Ferramenta:** `write_to_file`

---

## ✅ Critérios de Aceitação

1.  **`manifest.json` Limpo:** O `manifest.json` contém apenas as permissões estritamente necessárias na seção `permissions`, com permissões não essenciais movidas para `optional_permissions`.
2.  **Funcionalidade Preservada:** A extensão continua funcionando corretamente. A renomeação de abas e o agrupamento não são afetados.
3.  **Fluxo de Permissão Funcional:** O fluxo de solicitação de permissões opcionais funciona conforme o esperado, e a funcionalidade correspondente é ativada somente após o consentimento do usuário.
4.  **Documentação Completa:** Os arquivos `PERMISSIONS_JUSTIFICATION.md` (técnico) e `PERMISSIONS.md` (usuário final) estão criados, completos e claros.
5.  **Conformidade com `agents.md`:** Todo o processo segue as regras, padrões e fluxos definidos no `agents.md`.

---

##  timeline
- **Fase 1 & 2:** 2 horas
- **Fase 3 & 4:** 2 horas
- **Total Estimado:** 4 horas
