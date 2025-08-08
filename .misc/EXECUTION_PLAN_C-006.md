# 📋 Plano de Execução: TASK-C-006 - Corrigir Memory Leaks em Tab Operations

**Data:** 2024-12-19
**Tarefa:** TASK-C-006
**Responsável:** Performance Engineer
**Foco:** Eliminar memory leaks no `background.js` para garantir estabilidade e performance da extensão.

---

## 🎯 1. Objetivo

Este plano detalha as etapas para corrigir os vazamentos de memória identificados no `background.js`, especificamente relacionados ao `debouncedTitleUpdaters` Map. O objetivo é garantir que os event listeners e timeouts sejam limpos adequadamente, prevenindo o esgotamento de memória e a degradação da performance ao gerenciar um grande volume de abas.

---

## 🔍 2. Análise e Preparação (Fase 0)

**Duração Estimada:** 1 hora

- **Ação 1: Análise de Código Fonte**
  - [ ] Revisar `background.js` entre as linhas 400-500 para entender a implementação atual do `debouncedTitleUpdaters`.
  - [ ] Mapear como os listeners e timeouts são criados, armazenados e (supostamente) removidos.
  - [ ] Identificar os pontos exatos onde a limpeza falha (ex: no fechamento de abas, na conclusão de uma operação).

- **Ação 2: Configurar Ambiente de Teste de Memória**
  - [ ] Preparar um cenário de teste para replicar o memory leak.
  - [ ] Usar o `DevTools for Extensions` para monitorar o consumo de memória do Service Worker.
  - [ ] Criar um script ou procedimento para abrir, fechar e atualizar rapidamente ~50 abas para observar o aumento de memória.

---

## 🛠️ 3. Plano de Execução Detalhado

### Etapa 1: Substituir `Map` por `WeakMap` para Referências de Abas

**Duração Estimada:** 1.5 horas

- **Justificativa:** Uma `WeakMap` permite que o garbage collector remova as entradas de abas que já foram fechadas, pois ela não mantém uma referência forte ao objeto da aba.
- **Ações:**
  - [ ] No `background.js`, alterar a declaração de `debouncedTitleUpdaters` de `new Map()` para `new WeakMap()`.
  - [ ] Ajustar o código que interage com o `debouncedTitleUpdaters` para garantir a compatibilidade com a `WeakMap` (se necessário). A chave da `WeakMap` deve ser o objeto da aba, não o `tabId`.
  - [ ] **Validação:** Executar o teste de memória inicial e verificar se o lixo de memória é coletado de forma mais eficaz quando as abas são fechadas.

### Etapa 2: Implementar Limpeza Automática de Timeouts Órfãos

**Duração Estimada:** 3 horas

- **Justificativa:** Garantir que cada `setTimeout` seja explicitamente limpo quando a operação associada for concluída ou a aba for fechada.
- **Ações:**
  - [ ] Associar diretamente o `timeoutID` à entrada no `debouncedTitleUpdaters`.
  - [ ] Implementar um listener para `chrome.tabs.onRemoved`.
  - [ ] Dentro do listener `onRemoved`, verificar se a aba removida possui um timeout pendente no `debouncedTitleUpdaters` e, em caso afirmativo, chamar `clearTimeout()` para ele.
  - [ ] **Validação:** Monitorar o console e o uso de memória para confirmar que os timeouts estão sendo limpos e não se acumulam.

### Etapa 3: Adicionar Limpeza Periódica com `chrome.alarms`

**Duração Estimada:** 2 horas

- **Justificativa:** Como uma camada extra de segurança, um alarme periódico garantirá que nenhum recurso órfão permaneça na memória por muito tempo.
- **Ações:**
  - [ ] Criar um alarme `chrome.alarms.create('periodicCleanup', { periodInMinutes: 3 })`.
  - [ ] Implementar um listener `chrome.alarms.onAlarm` que, para o alarme `periodicCleanup`, itera sobre as entradas restantes e verifica se a aba associada ainda existe.
  - [ ] Se a aba não existir mais (`chrome.tabs.get` falhar), o timeout associado é limpo.
  - [ ] **Validação:** Usar o DevTools para forçar a execução do alarme e verificar se ele limpa com sucesso as entradas órfãs.

### Etapa 4: Implementar Limite Máximo de Entradas (Safety Net)

**Duração Estimada:** 1.5 horas

- **Justificativa:** Prevenir um crescimento descontrolado do Map em cenários extremos, agindo como um disjuntor (circuit breaker).
- **Ações:**
  - [ ] Antes de adicionar uma nova entrada ao `debouncedTitleUpdaters`, verificar seu tamanho (`size`).
  - [ ] Se o tamanho exceder 500, registrar um aviso no console e impedir a adição de novas entradas ou remover a mais antiga.
  - [ ] **Nota:** Esta é uma medida de segurança. Com a `WeakMap` e a limpeza de timeouts, este limite raramente deve ser atingido.
  - [ ] **Validação:** Criar um teste de estresse que tenta adicionar mais de 500 entradas e confirmar que o limite é respeitado.

### Etapa 5: Implementar Monitoramento de Memória Específico

**Duração Estimada:** 1 hora

- **Justificativa:** Adicionar logs para monitorar a saúde do sistema em produção.
- **Ações:**
  - [ ] Adicionar logs no console que reportem o tamanho do `debouncedTitleUpdaters` a cada execução da limpeza periódica.
  - [ ] Usar `console.info` para não poluir os logs de erro. Ex: `console.info('Periodic cleanup executed. Map size:', debouncedTitleUpdaters.size);`
  - [ ] **Validação:** Observar os logs do Service Worker para garantir que as informações de monitoramento estão sendo registradas corretamente.

---

## ✅ 4. Validação e Critérios de Aceitação

**Duração Estimada:** 1 hora

- **Critério 1: Estabilidade de Memória**
  - [ ] Executar um teste de estresse abrindo e fechando 100+ abas. O consumo de memória do Service Worker deve permanecer estável, sem crescimento contínuo.
- **Critério 2: Funcionalidade da Limpeza**
  - [ ] Verificar nos logs que a limpeza automática (via `onRemoved`) e a limpeza periódica (via `alarms`) estão funcionando.
- **Critério 3: Respeito aos Limites**
  - [ ] O teste de estresse não deve ultrapassar o limite de 500 entradas no Map.
- **Critério 4: Funcionalidade da Extensão**
  - [ ] A funcionalidade de renomeação de abas (`debouncedTitleUpdaters`) deve continuar funcionando perfeitamente.
- **Critério 5: Ausência de Erros**
  - [ ] O console do Service Worker não deve apresentar erros relacionados à nova implementação.

---

##  timeline 5. Cronograma Estimado

- **Fase 0 (Análise):** 1 hora
- **Etapa 1 (WeakMap):** 1.5 horas
- **Etapa 2 (Limpeza de Timeouts):** 3 horas
- **Etapa 3 (Limpeza Periódica):** 2 horas
- **Etapa 4 (Limite Máximo):** 1.5 horas
- **Etapa 5 (Monitoramento):** 1 hora
- **Validação Final:** 1 hora
- **Total Estimado:** **11 horas**
