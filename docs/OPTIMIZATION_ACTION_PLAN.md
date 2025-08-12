# Plano de Ação para Otimização de Performance

Este documento detalha o plano de ação técnico para implementar as melhorias de performance identificadas no `PERFORMANCE_IMPROVEMENT_REPORT.md`. As tarefas estão organizadas por prioridade, focando nos maiores ganhos de performance primeiro.

---

## Prioridade 1: Refatorar `processTabQueue` e Implementar Cache de Nomes Inteligentes

**Objetivo:** Reduzir drasticamente a latência eliminando o reprocessamento desnecessário de abas e o uso excessivo de injeção de scripts, que é a operação mais custosa.

### Tarefa 1.1: Implementar Cache para Nomes Inteligentes (Smart Names)

- **Descrição:** Criar um mecanismo de cache para armazenar os nomes inteligentes gerados para URLs. Isso evitará a reinjeção de scripts em abas cuja URL já foi processada.
- **Arquivos a Modificar:**
  - `grouping-logic.js`: Onde a lógica de `fetchSmartName` e `batchProcessGroupNames` reside.
  - `background.js`: Para gerenciar a invalidação do cache nos eventos de atualização de abas.
- **Passos Técnicos:**

  - [ ] **Criar Módulo de Cache:** Em um novo arquivo (`intelligent-cache-manager.js` ou similar) ou dentro de `grouping-logic.js`, criar funções para `get`, `set`, e `invalidate` itens do cache. O cache deve usar `chrome.storage.local` para persistência entre sessões do service worker, com um fallback para um objeto em memória para acesso rápido.
  - [ ] **Modificar `fetchSmartName`:** Antes de injetar o script, a função deve verificar se a URL da aba já possui um "smart name" válido no cache. Se existir, retornar o valor do cache.
  - [ ] **Armazenar Resultados:** Após uma injeção de script bem-sucedida, o resultado deve ser armazenado no cache com a URL da aba como chave.
  - [ ] **Implementar Invalidação de Cache:** No `background.js`, usar o listener `chrome.tabs.onUpdated` para observar mudanças no `title` ou `url` de uma aba. Se uma mudança relevante for detectada, chamar a função de invalidação para remover a entrada correspondente do cache.

- **Análise de Risco e Mitigação:**
- **Risco:** O cache pode se tornar obsoleto (`stale`) se o conteúdo de uma página for alterado sem um recarregamento completo (comum em Single-Page Applications), fazendo com que nomes de grupo antigos sejam exibidos. Uma falha na lógica de invalidação pode prender o usuário com nomes incorretos.
- **Mitigação:**
  - **Feature Flag:** Adicionar uma opção de configuração para desabilitar o cache de nomes inteligentes, permitindo que os usuários contornem o problema se o encontrarem.
  - **Invalidação Manual:** Incluir um botão "Limpar Cache de Nomes" na interface do popup ou nas opções para intervenção manual do usuário.
  - **Testes Específicos:** Criar casos de teste para validar que o cache é invalidado corretamente quando o `url` ou `title` de uma aba muda. Testar o comportamento em sites que usam navegação dinâmica.

### Tarefa 1.2: Refatorar `processTabQueue` para Processamento Focado

- **Descrição:** Alterar a lógica de processamento para que `batchProcessGroupNames` opere apenas sobre o conjunto de abas que precisam ser processadas (a fila), em vez de todas as abas da janela.
- **Arquivos a Modificar:**
  - `background.js`: Onde `processTabQueue` é orquestrado.
  - `grouping-logic.js`: Onde `batchProcessGroupNames` é definido.
- **Passos Técnicos:**

  - [ ] **Coletar Detalhes das Abas da Fila:** Em `processTabQueue`, antes de chamar `batchProcessGroupNames`, obter os objetos `Tab` completos para os `tabId`s que estão na fila (`tabsToProcess`).
  - [ ] **Modificar `batchProcessGroupNames`:** Ajustar a função para receber diretamente a lista de abas a serem processadas, em vez de consultar todas as abas da janela.
  - [ ] **Ajustar a Chamada:** Em `background.js`, modificar a chamada para `batchProcessGroupNames`, passando a lista de abas filtrada.

- **Análise de Risco e Mitigação:**
- **Risco:** Se a lógica de coleta de abas da fila for falha, abas importantes podem ser ignoradas no processamento, resultando em grupos de abas incompletos ou não processados.
- **Mitigação:**
  - **Logging e Validação:** Adicionar logs para monitorar quais abas estão sendo passadas para `batchProcessGroupNames` e garantir que a contagem corresponde à da fila.
  - **Testes de Integração:** Criar testes que simulem a adição de múltiplas abas à fila e verifiquem se todas são corretamente processadas no lote seguinte.

---

## Prioridade 2: Melhorar o Gerenciamento de Estado

**Objetivo:** Reduzir a latência de I/O movendo o gerenciamento da fila de processamento para a memória e usando `storage.local` apenas para persistência.

### Tarefa 2.1: Mover a Fila de Processamento para a Memória

- **Descrição:** Manter a fila de abas a serem processadas em uma variável em memória no service worker para acesso instantâneo.
- **Arquivos a Modificar:**
  - `background.js`: Principal local de gerenciamento da fila.
- **Passos Técnicos:**
  - [ ] **Declarar Fila em Memória:** Criar uma variável no escopo global do `background.js` para armazenar a fila (ex: `let tabProcessingQueue = new Set();`).
  - [ ] **Modificar Funções de Enfileiramento:** As funções que adicionam abas à fila (`scheduleTabProcessing`) devem agora adicionar `tabId`s a esta variável em memória.
  - [ ] **Modificar `processTabQueue`:** A função deve ler diretamente da variável em memória, em vez de consultar `chrome.storage.local` no início de cada execução.

### Tarefa 2.2: Implementar Sincronização com `storage.local`

- **Descrição:** Usar `storage.local` como um backup da fila em memória, garantindo que o estado não seja perdido se o service worker for encerrado.
- **Arquivos a Modificar:**
  - `background.js`
- **Passos Técnicos:**

  - [ ] **Restaurar Fila na Inicialização:** No início do script `background.js`, ler a fila do `storage.local` para popular a variável em memória, caso o service worker esteja reiniciando.
  - [ ] **Sincronizar em Pontos Estratégicos:** Após modificar a fila em memória (adicionar ou processar itens), salvar o estado atualizado no `storage.local`. Isso pode ser feito de forma assíncrona para não bloquear o fluxo principal.
  - [ ] **Limpar Fila do Storage:** Após o processamento bem-sucedido de um lote, limpar a fila tanto da memória quanto do `storage.local`.

- **Análise de Risco e Mitigação:**
- **Risco:** Pode ocorrer uma dessincronização entre a fila em memória e o `storage.local` se o service worker for encerrado inesperadamente entre a modificação da memória e a escrita no disco. Isso pode levar a abas não processadas ou processadas duas vezes.
- **Mitigação:**
  - **Sincronização Atômica:** Garantir que a escrita no `storage.local` ocorra o mais próximo possível da atualização em memória.
  - **Reconciliação na Inicialização:** Ao reiniciar, após carregar a fila do `storage`, comparar com o estado real das abas (`chrome.tabs.query`) para remover `tabId`s que não existem mais.
  - **Testes de Resiliência:** Simular o encerramento e reinício do service worker para garantir que a fila seja restaurada e processada corretamente, sem perda ou duplicação de tarefas.

---

## Prioridade 3: Otimizar a Avaliação de Regras

**Objetivo:** Melhorar a eficiência da lógica de nomenclatura, especialmente para usuários com muitas regras customizadas.

### Tarefa 3.1: Pré-compilar Expressões Regulares (Regex)

- **Descrição:** Compilar as expressões regulares das regras de usuário uma única vez, quando são carregadas, em vez de a cada avaliação.
- **Arquivos a Modificar:**
  - `grouping-logic.js`: Onde as regras são avaliadas (`getFinalGroupName`).
  - `settings-manager.js` (ou similar): Onde as configurações e regras são carregadas.
- **Passos Técnicos:**

  - [ ] **Modificar Estrutura de Regras:** Ao carregar as regras do `storage`, iterar sobre elas e adicionar uma propriedade `compiledRegex` a cada objeto de regra, contendo o resultado de `new RegExp()`.
  - [ ] **Armazenar Regras Compiladas:** Manter a lista de regras com os regex compilados em uma variável em memória.
  - [ ] **Usar Regex Compilado:** Na função `getFinalGroupName`, usar a propriedade `rule.compiledRegex.test(url)` em vez de criar um novo objeto `RegExp` a cada chamada.

- **Análise de Risco e Mitigação:**
- **Risco:** Se um usuário inserir uma expressão regular inválida nas configurações, a chamada `new RegExp()` lançará um erro. Se não for tratado, isso pode interromper o carregamento de todas as regras, desativando a funcionalidade.
- **Mitigação:**
  - **Tratamento de Erros:** Envolver a compilação do regex em um bloco `try...catch`. Se a compilação falhar, a regra deve ser marcada como inválida e ignorada, exibindo um aviso na interface de configurações.
  - **Validação em Tempo Real:** Implementar feedback na UI de opções para validar a expressão regular enquanto o usuário a digita.
  - **Testes com Dados Inválidos:** Adicionar casos de teste que usem expressões regulares inválidas para garantir que o sistema permaneça estável e o erro seja tratado de forma adequada.

---

## Prioridade 4: Refinamentos Adicionais

**Objetivo:** Melhorar a robustez geral e a experiência do usuário com otimizações de menor impacto, mas que complementam as mudanças anteriores.

### Tarefa 4.1: Implementar Consulta Global de Abas

- **Descrição:** Realizar uma única consulta `chrome.tabs.query({})` no início do ciclo de processamento para evitar múltiplas chamadas à API.
- **Arquivos a Modificar:**
  - `background.js`
- **Passos Técnicos:**

  - [ ] **Consulta Única:** No início de `processTabQueue`, executar `chrome.tabs.query({})` e armazenar o resultado (uma lista de todas as abas em todas as janelas) em uma variável local.
  - [ ] **Passar Dados como Parâmetro:** Passar subconjuntos desses dados para as funções que precisam deles (ex: `batchProcessGroupNames`), em vez de fazerem suas próprias consultas.

- **Análise de Risco e Mitigação:**
- **Risco:** Se abas forem abertas ou fechadas durante o ciclo de processamento, a lista de abas consultada no início ficará desatualizada, podendo causar erros se o código tentar operar em uma aba que não existe mais.
- **Mitigação:**
  - **Código Robusto:** Garantir que o código verifique a existência de uma aba antes de tentar acessá-la a partir da lista inicial.
  - **Processamento em Ciclos:** Novas abas criadas durante um ciclo devem ser adicionadas à fila para serem processadas no _próximo_ ciclo, garantindo consistência.
  - **Testes de Concorrência:** Simular a abertura e fechamento de abas enquanto um ciclo de processamento está em andamento para validar a estabilidade.

### Tarefa 4.2: Implementar `QUEUE_DELAY` Adaptativo

- **Descrição:** Ajustar o tempo de debounce dinamicamente, usando um delay menor para ações iniciadas pelo usuário e um maior para eventos de fundo.
- **Arquivos a Modificar:**
  - `background.js`: Onde o debounce é aplicado.
- **Passos Técnicos:**

  - [ ] **Diferenciar Gatilhos:** Modificar as funções que agendam o processamento para aceitar um parâmetro que indique a prioridade (ex: `'user'` ou `'background'`).
  - [ ] **Lógica de Delay Dinâmico:** Na lógica de debounce, verificar esse parâmetro e escolher um valor de delay apropriado (ex: 50ms para `'user'`, 500ms para `'background'`).

- **Análise de Risco e Mitigação:**
- **Risco:** Um delay muito curto, mesmo para ações do usuário, pode não ser suficiente para agrupar múltiplas ações rápidas (ex: abrir várias abas de uma vez), resultando em execuções de processamento desnecessárias.
- **Mitigação:**
  - **Reset do Debounce:** Garantir que o timer do debounce seja reiniciado a cada novo evento, independentemente da sua origem (`user` ou `background`). O delay adaptativo deve apenas definir a duração do timer.
  - **Configuração Opcional:** Permitir que o usuário defina um valor de delay fixo nas opções, caso o comportamento adaptativo não seja o ideal para seu fluxo de trabalho.
  - **Testes de Carga:** Simular sequências rápidas de ações do usuário para garantir que o processamento seja acionado apenas uma vez, após o término da sequência.
