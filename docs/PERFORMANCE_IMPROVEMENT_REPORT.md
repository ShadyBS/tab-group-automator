# Relatório Técnico de Melhoria de Performance

## Sumário Executivo

Este relatório detalha a análise de performance da extensão de agrupamento de abas, com foco em `grouping-logic.js` e `background.js`. Embora a arquitetura atual seja robusta, foram identificados quatro gargalos principais que impactam a latência e o consumo de recursos:

1.  **Injeção de Scripts em `fetchSmartName`:** Operação de alta latência e consumo de CPU, especialmente em lote.
2.  **Consultas Redundantes em `processTabQueue`:** Reprocessamento de todas as abas da janela, mesmo quando poucas mudam, e consultas sequenciais por janela.
3.  **Gerenciamento de Estado com `storage.local`:** Latência de I/O em operações críticas da fila de processamento.
4.  **Avaliação de Regras:** Custo computacional que escala linearmente com o número de abas e regras complexas.

As recomendações focam em otimizar o fluxo de dados, reduzir operações de I/O, e implementar um cache mais eficiente para minimizar o reprocessamento e a injeção de scripts, resultando em uma experiência de usuário mais rápida e responsiva.

---

## Análise Detalhada dos Gargalos

### 1. Injeção de Scripts em `fetchSmartName` (Operação Custosa)

- **Descrição:** A função `fetchSmartName` injeta um script de conteúdo para extrair metadados da página (como o título ou `meta tags`) e gerar um nome inteligente para o grupo. Esta é a operação mais lenta e imprevisível do fluxo.
- **Impacto:**
  - **Latência Elevada:** A performance depende da velocidade de carregamento da página e da complexidade do seu DOM. Em sites pesados ou conexões lentas, a injeção pode demorar, e o `timeout` configurado (`SCRIPT_INJECTION_TIMEOUT`), embora seja uma mitigação, pode causar falhas que atrasam o agrupamento.
  - **Pico de Consumo de Recursos:** A execução paralela de `fetchSmartName` para múltiplas abas (`batchProcessGroupNames`) pode causar picos de uso de CPU e memória, sobrecarregando o navegador. A lógica de concorrência adaptativa (`adaptiveItemConcurrency`) minimiza, mas não elimina, o risco.

### 2. Consultas Redundantes e em Cascata em `processTabQueue`

- **Descrição:** A função `processTabQueue` orquestra o processo de agrupamento, mas seu fluxo de execução pode ser otimizado para reduzir consultas desnecessárias.
- **Impacto:**
  - **Consultas Sequenciais por Janela:** O processamento é feito por janela (`for (const windowIdStr in tabsByWindow)`), gerando múltiplas chamadas sequenciais à API para obter abas e grupos, em vez de uma única consulta global.
  - **Reprocessamento Desnecessário:** A lógica atual processa **todas** as abas de uma janela (`const tabIdToGroupName = await batchProcessGroupNames(allTabsInWindow);`), mesmo que a fila (`processTabQueue`) contenha apenas um subconjunto de abas que foram alteradas. Isso leva a um trabalho redundante, especialmente a re-injeção de scripts em abas que não mudaram.

### 3. Gerenciamento de Estado e Comunicação

- **Descrição:** Com a migração para o Manifest V3, o estado da extensão, incluindo a fila de processamento, é mantido no `chrome.storage.local`.
- **Impacto:**
  - **Latência de I/O:** O acesso ao disco (`storage.local`) é inerentemente mais lento que o acesso à memória. Operações frequentes de leitura e escrita para gerenciar a fila (`getTabProcessingQueue`, `updateTabGroupMap`) introduzem pequenas latências que se acumulam, tornando o processo menos responsivo.
  - **Atraso Percebido pelo Usuário:** O `debounce` com `QUEUE_DELAY` é uma estratégia eficaz para evitar sobrecarga de eventos, mas pode fazer com que a interface pareça lenta, pois o agrupamento é intencionalmente adiado.

### 4. Avaliação de Regras e Lógica de Nomenclatura

- **Descrição:** A função `getFinalGroupName` itera sobre todas as regras personalizadas para cada aba para determinar o nome do grupo.
- **Impacto:**
  - **Escalabilidade Linear:** O custo computacional aumenta linearmente com o número de abas e a quantidade de regras. Regras com expressões regulares (regex) complexas podem degradar significativamente a performance quando aplicadas a um grande volume de abas.

---

## Recomendações de Otimização

### 1. Otimizar `fetchSmartName` e Injeção de Scripts

- **Solução Técnica:**
  1.  **Cache de Nomes Inteligentes:** Implementar um cache em `chrome.storage.local` (com fallback em memória) para armazenar os nomes gerados para URLs específicas. Antes de injetar um script, verificar se um nome para aquela URL já existe no cache.
  2.  **Invalidação de Cache:** Invalidar o cache de uma aba apenas quando seu título ou URL mudar significativamente, utilizando o evento `onUpdated`.
  3.  **Fila de Injeção Prioritária:** Criar uma fila de processamento para `fetchSmartName` que execute as injeções de forma mais controlada, limitando a concorrência real para evitar picos de consumo de recursos.

### 2. Refatorar `processTabQueue` para Reduzir Consultas

- **Solução Técnica:**
  1.  **Processamento Focado:** Modificar `processTabQueue` para que `batchProcessGroupNames` processe **apenas** as abas presentes na fila (`tabsToProcess`), em vez de todas as abas da janela.
  2.  **Consulta Global de Abas:** Antes de iniciar o processamento da fila, realizar uma única consulta global (`chrome.tabs.query({})`) para obter o estado de todas as abas e janelas, armazenando o resultado em memória para ser usado durante o ciclo de vida do processamento. Isso evita múltiplas chamadas à API.

### 3. Melhorar o Gerenciamento de Estado

- **Solução Técnica:**
  1.  **Cache em Memória Agressivo:** Manter a fila de processamento (`tabProcessingQueue`) primariamente em memória. Usar `storage.local` como um mecanismo de persistência (backup) em caso de o service worker ser encerrado, mas não como a fonte primária para cada operação de leitura/escrita.
  2.  **Sincronização Inteligente:** Sincronizar a fila em memória com o `storage.local` em momentos estratégicos: quando o service worker estiver prestes a se tornar inativo ou após um lote de processamento ser concluído.
  3.  **Ajuste Dinâmico do `QUEUE_DELAY`:** Tornar o `QUEUE_DELAY` adaptativo. Usar um delay menor para ações iniciadas pelo usuário (ex: clique no popup) e um delay maior para eventos de fundo (ex: `onUpdated`).

### 4. Otimizar a Avaliação de Regras

- **Solução Técnica:**
  1.  **Compilação de Regras:** Pré-compilar as expressões regulares das regras uma única vez quando as configurações são carregadas, em vez de a cada avaliação.
  2.  **Indexação de Regras (Opcional/Avançado):** Para cenários com um número muito grande de regras, criar um índice simples baseado em palavras-chave do `hostname` da URL. Isso permitiria aplicar apenas um subconjunto de regras relevantes para cada aba, em vez de iterar sobre todas elas.

---

## Plano de Ação Sugerido

A implementação das otimizações deve seguir uma ordem que priorize o maior impacto na performance percebida pelo usuário.

1.  **Prioridade 1: Refatorar `processTabQueue` e Implementar Cache de Nomes Inteligentes.**

    - **Justificativa:** Esta mudança oferece o maior ganho de performance ao eliminar o reprocessamento desnecessário, que é a causa raiz da lentidão em janelas com muitas abas. O cache reduzirá drasticamente as custosas injeções de script.
    - **Passos:**
      1.  Alterar `processTabQueue` para processar apenas as abas da fila.
      2.  Implementar o cache para `fetchSmartName` usando `storage.local`.

2.  **Prioridade 2: Melhorar o Gerenciamento de Estado.**

    - **Justificativa:** Reduzir a latência de I/O tornará o processo de enfileiramento e gerenciamento de estado mais rápido e responsivo.
    - **Passos:**
      1.  Mover a lógica da fila de processamento para um cache em memória.
      2.  Implementar a sincronização com `storage.local`.

3.  **Prioridade 3: Otimizar a Avaliação de Regras.**

    - **Justificativa:** Embora o impacto seja menor, esta otimização melhora a eficiência do núcleo da lógica de regras, beneficiando usuários com muitas regras customizadas.
    - **Passos:**
      1.  Implementar a pré-compilação de regex.

4.  **Prioridade 4: Implementar Consulta Global e `QUEUE_DELAY` Adaptativo.**
    - **Justificativa:** São refinamentos que melhoram ainda mais a robustez e a experiência do usuário, mas com ganhos menos imediatos que as prioridades anteriores.
    - **Passos:**
      1.  Refatorar o início do processamento para usar uma consulta global de abas.
      2.  Implementar a lógica para o `QUEUE_DELAY` adaptativo.
