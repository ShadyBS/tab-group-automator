# 🔒 Nossas Permissões: O que a Extensão Faz e Por Quê

Olá! Para que o **Tab Group Automator** possa organizar suas abas de forma mágica, ele precisa de algumas permissões. Queremos que você saiba exatamente por que cada uma delas é necessária.

---

### Permissões que Pedimos

#### 1. **Acessar e gerenciar suas abas e grupos de abas (`tabs` e `tabGroups`)**

*   **O que faz:** Esta é a permissão principal. Ela nos permite ver quais abas estão abertas para que possamos agrupá-las, renomear os grupos e organizá-las para você.
*   **Por que precisamos:** Sem isso, não conseguiríamos criar ou gerenciar nenhum grupo de abas. É o coração da extensão!

#### 2. **Salvar dados localmente (`storage`)**

*   **O que faz:** Usamos isso para salvar suas regras personalizadas e configurações. Por exemplo, se você criar uma regra para sempre agrupar abas do "Google Drive", nós a guardamos para que ela funcione da próxima vez que você abrir o navegador.
*   **Por que precisamos:** Para que suas preferências e regras não desapareçam cada vez que você fecha e abre o navegador.

#### 3. **Adicionar itens ao menu de contexto (`menus` / `contextMenus`)**

*   **O que faz:** Sabe quando você clica com o botão direito em uma página? Esta permissão nos permite adicionar atalhos úteis ali, como "Criar regra para este site" ou "Agrupar abas semelhantes agora".
*   **Por que precisamos:** Para oferecer a você uma forma rápida e fácil de usar as funcionalidades da extensão sem precisar abrir o popup toda vez.

#### 4. **Acessar dados de todas as páginas da web (`<all_urls>` e `scripting`)**

*   **O que faz:** Esta permissão pode parecer assustadora, mas nós a usamos de forma muito específica e limitada. Ela nos permite injetar um pequeno script na página para ler informações públicas, como o título principal de um artigo ou o nome de um projeto no GitHub.
*   **Por que precisamos:** Para a nossa funcionalidade de **renomeação inteligente**. Por exemplo, se você agrupar várias abas de um projeto no GitHub, podemos usar essa permissão para pegar o nome do projeto e usá-lo como nome do grupo, o que é muito mais útil do que um nome genérico.

--- 

### Nosso Compromisso com a sua Privacidade

*   **Nós NUNCA coletamos seu histórico de navegação.**
*   **Nós NUNCA enviamos seus dados para servidores externos.** Tudo é processado localmente no seu navegador.
*   **Nós SÓ usamos as permissões para as funcionalidades descritas acima.**

Se tiver qualquer dúvida, por favor, entre em contato ou verifique nosso código-fonte, que é aberto para todos verem!
