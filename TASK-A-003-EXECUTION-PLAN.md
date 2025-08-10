# TASK-A-003: Execução — Compatibilidade de Tab Groups no Firefox via Container Tabs

## 1. Visão Geral e Objetivos

**Problema:**  
O Firefox não possui a API nativa `tabGroups` disponível no Chrome. Para garantir paridade de funcionalidades, é necessário implementar um polyfill que utilize a API de Container Tabs (`contextualIdentities`) como alternativa, mantendo a experiência de agrupamento de abas.

**Critérios de Aceitação:**

- 90% das funcionalidades de agrupamento do Chrome devem funcionar no Firefox.
- Container Tabs devem simular grupos de abas.
- Feature detection robusta para diferenciar navegadores e APIs disponíveis.
- Fallbacks graciosos para APIs ausentes.
- Testes automatizados e manuais garantindo UX consistente.

## 2. Análise Técnica

### Desafios

- **Mapeamento de Funcionalidades:** Nem todos os recursos do `tabGroups` têm equivalentes diretos em `contextualIdentities`.
- **Limitações Conhecidas:**
  - Container Tabs não agrupam visualmente abas como o Chrome, mas permitem isolamento e identificação.
  - Algumas operações (ex: mover abas entre grupos) exigem lógica adicional.
  - Restrições de permissão: a API `contextualIdentities` requer permissões específicas no manifest.
- **Sincronização de Estado:** Manter o estado dos grupos consistente entre abas, containers e UI.
- **Detecção de Navegador:** Garantir que o polyfill só atue no Firefox.

### Mapeamento de Funcionalidades

| Chrome Tab Groups API | Firefox Container Tabs (Polyfill)    | Observações                      |
| --------------------- | ------------------------------------ | -------------------------------- |
| create                | create (contextualIdentity)          | Nome, cor, ícone customizados    |
| update                | update (contextualIdentity)          | Limitações em propriedades       |
| query                 | query tabs by containerId            | Filtro manual por container      |
| move                  | move tab to container (recreate tab) | Requer recriação/migração de aba |
| remove                | remove container + reatribuir abas   | Migrar abas para default         |
| collapse/expand       | Não suportado nativamente            | Não implementável                |

## 3. Arquitetura Proposta

### Modificações em [`browser-api-wrapper.js`](browser-api-wrapper.js)

- **Feature Detection:**  
  Adicionar lógica para detectar se `browser.tabGroups` existe. Se não, injetar o polyfill baseado em `contextualIdentities`.

- **Estrutura do Polyfill:**  
  Implementar um objeto `tabGroupsPolyfill` que simula os métodos principais da API:

  - `create`
  - `update`
  - `query`
  - `move` (simulado via recriação de abas)
  - `remove`

- **Proxy Adaptativo:**  
  O método `createTabGroupsProxy` deve retornar o proxy nativo se disponível, ou o polyfill se não.

#### Diagrama de Arquitetura (Mermaid)

```mermaid
flowchart TD
    A[Chamada WrappedBrowserAPI.tabGroups] --> B{Feature Detection}
    B -- Chrome: tabGroups existe --> C[Proxy para browser.tabGroups]
    B -- Firefox: tabGroups ausente --> D[tabGroupsPolyfill (contextualIdentities)]
    D --> E[Operaçõs: create, update, query, move, remove]
```

#### Exemplo de Estrutura do Polyfill

```javascript
const tabGroupsPolyfill = {
  async create(props) {
    /* cria contextualIdentity */
  },
  async update(groupId, props) {
    /* atualiza contextualIdentity */
  },
  async query(queryInfo) {
    /* lista containers e mapeia abas */
  },
  async move(tabId, groupId) {
    /* recria aba no container */
  },
  async remove(groupId) {
    /* remove container, migra abas */
  },
};
```

## 4. Fases de Implementação

1. **Fase 1: Detecção de Feature e Setup do Polyfill**

   - Implementar detecção robusta de suporte à API `tabGroups`.
   - Injetar o polyfill apenas no Firefox.

2. **Fase 2: Implementação dos Métodos Principais**

   - `create`: Criar novo container (`contextualIdentity`).
   - `update`: Atualizar propriedades do container.
   - `query`: Listar containers e mapear abas por containerId.
   - `move`: Migrar aba para outro container (recriar aba).
   - `remove`: Remover container e reatribuir abas.

3. **Fase 3: Sincronização e Fallbacks**

   - Garantir que abas migradas mantenham estado (URL, título, etc).
   - Implementar fallbacks para métodos não suportados (ex: collapse/expand).
   - Documentar limitações no código.

4. **Fase 4: Integração e Testes**

   - Integrar o polyfill ao wrapper principal.
   - Testar integração com `grouping-logic.js` e outros módulos.
   - Validar permissões no manifest.

5. **Fase 5: Testes Automatizados e Manuais**
   - Criar testes unitários e de integração para o polyfill.
   - Realizar testes manuais de UX no Firefox.
   - Validar paridade funcional com Chrome.

## 5. Estratégia de Testes

- **Testes Automatizados:**

  - Unitários para cada método do polyfill.
  - Integração com fluxo de agrupamento de abas.
  - Testes de regressão para garantir que o wrapper não quebre no Chrome.

- **Testes Manuais:**

  - Agrupamento, atualização, remoção e movimentação de abas em múltiplos containers.
  - Verificação visual e funcional da experiência no Firefox.
  - Teste de fallback e mensagens de erro para métodos não suportados.

- **Critérios de Sucesso:**
  - 90%+ das operações de agrupamento funcionam no Firefox.
  - Nenhum erro crítico ou perda de abas durante operações.
  - UX consistente e sem crashes.

---

**Referências:**

- [Firefox Container Tabs](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities)
- [Cross-browser Compatibility](https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/)
- [Chrome Tab Groups API](https://developer.chrome.com/docs/extensions/reference/tabGroups/)
