# 📝 Justificativa de Permissões - Tab Group Automator

Este documento detalha a necessidade de cada permissão solicitada pela extensão Tab Group Automator, com foco na transparência e na conformidade com as políticas de segurança.

---

## Permissões Essenciais (Obrigatórias)

### 1. `tabs`

*   **Justificativa:** Esta é a permissão central da extensão. É usada para acessar informações sobre as abas (URL, título, ID), agrupá-las, desagrupá-las, movê-las e criar novas abas. Sem esta permissão, a funcionalidade principal de gerenciamento de abas é impossível.
*   **APIs Utilizadas:** `browser.tabs.query`, `browser.tabs.group`, `browser.tabs.ungroup`, `browser.tabs.create`, `browser.tabs.get`, `browser.tabs.onUpdated`, `browser.tabs.onRemoved`.

### 2. `tabGroups`

*   **Justificativa:** Permite que a extensão gerencie as propriedades dos grupos de abas, como título e cor. É essencial para organizar e personalizar os grupos criados.
*   **APIs Utilizadas:** `browser.tabGroups.update`, `browser.tabGroups.query`, `browser.tabGroups.get`, `browser.tabGroups.onCreated`, `browser.tabGroups.onUpdated`, `browser.tabGroups.onRemoved`.

### 3. `storage`

*   **Justificativa:** Utilizada para salvar as configurações do usuário, como regras de agrupamento personalizadas, preferências de interface e o estado dos grupos. Garante que as configurações do usuário persistam entre as sessões do navegador.
*   **APIs Utilizadas:** `browser.storage.local.get`, `browser.storage.local.set`, `browser.storage.sync.get`, `browser.storage.sync.set`.

### 4. `menus` / `contextMenus`

*   **Justificativa:** Usada para criar itens no menu de contexto (clique com o botão direito), oferecendo atalhos para ações comuns, como criar uma nova regra a partir de uma aba, agrupar abas semelhantes ou desativar o agrupamento para um domínio específico.
*   **APIs Utilizadas:** `browser.contextMenus.create`, `browser.contextMenus.update`, `browser.contextMenus.removeAll`, `browser.contextMenus.onClicked`.

### 5. `scripting`

*   **Justificativa:** Necessária para injetar scripts em páginas da web. A extensão utiliza essa permissão para duas finalidades principais:
    1.  **Renomeação Inteligente de Abas:** Extrair informações da página (como o título de um artigo ou o nome de um repositório no GitHub) para renomear grupos de abas de forma mais descritiva.
    2.  **Interação com a Área de Transferência:** Copiar URLs de um grupo de abas para a área de transferência do usuário de forma segura, conforme as diretrizes do Manifest V3.
*   **APIs Utilizadas:** `browser.scripting.executeScript`.

### 6. `host_permissions`: `<all_urls>`

*   **Justificativa Técnica:** A permissão `host_permissions` com o valor `<all_urls>` é uma dependência direta da permissão `scripting`. Para que a extensão possa executar `browser.scripting.executeScript` em qualquer aba que o usuário deseje organizar ou de onde queira extrair informações, ela precisa de acesso a todas as URLs. 
*   **Caso de Uso Principal:** A funcionalidade de "Renomear Grupo com Base no Título da Página" depende da capacidade de ler o conteúdo de qualquer página web. Sem esse acesso, a extensão não conseguiria oferecer nomes de grupo inteligentes e contextuais, limitando severamente uma de suas principais funcionalidades de produtividade.
*   **Mitigação de Riscos:** A extensão só injeta scripts quando explicitamente solicitado por uma ação do usuário (como a renomeação) e apenas para extrair informações específicas e não sensíveis (como o conteúdo da tag `<title>` ou `<h1>`). O código injetado é mínimo e focado na tarefa.

---

## Permissões Não Essenciais (Opcionais)

Atualmente, a extensão não implementa permissões opcionais. Todas as permissões listadas acima são consideradas essenciais para a funcionalidade principal. No futuro, funcionalidades como notificações (`notifications`) poderiam ser movidas para permissões opcionais para dar ao usuário mais controle.
