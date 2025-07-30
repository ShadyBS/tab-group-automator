# Documentação de Permissões - Auto Tab Grouper

## Justificativa para Cada Permissão

### Permissões Obrigatórias

#### `tabs`
- **Uso:** Acesso às informações das abas (título, URL, status)
- **Justificativa:** Essencial para o agrupamento automático e renomeação de abas
- **Funcionalidades dependentes:** 
  - Detecção de novas abas
  - Leitura de títulos e URLs para agrupamento
  - Monitoramento de mudanças de status

#### `tabGroups`
- **Uso:** Criação, modificação e gerenciamento de grupos de abas
- **Justificativa:** Funcionalidade principal da extensão
- **Funcionalidades dependentes:**
  - Criação automática de grupos
  - Atualização de títulos de grupos
  - Colapso/expansão de grupos

#### `storage`
- **Uso:** Armazenamento de configurações e cache
- **Justificativa:** Persistência de configurações do usuário e cache de nomes inteligentes
- **Funcionalidades dependentes:**
  - Salvamento de regras customizadas
  - Cache de nomenclatura inteligente
  - Sincronização de configurações

#### `menus` e `contextMenus`
- **Uso:** Menu de contexto para criação rápida de regras
- **Justificativa:** Interface conveniente para criação de regras
- **Funcionalidades dependentes:**
  - Menu "Criar regra para este site"
  - Conversão entre grupos manuais/automáticos

#### `scripting`
- **Uso:** Injeção de content scripts para extração de metadados
- **Justificativa:** Necessário para nomenclatura inteligente de grupos
- **Funcionalidades dependentes:**
  - Extração de nomes de sites via meta tags
  - Análise de schema.org e manifests

### Host Permissions

#### `<all_urls>`
- **Uso:** Acesso a todas as páginas web para extração de metadados
- **Justificativa:** A extensão precisa acessar o conteúdo das páginas para:
  - Extrair nomes reais dos sites (meta tags, JSON-LD)
  - Implementar renomeação inteligente de abas
  - Funcionar em qualquer site que o usuário visite
- **Limitações implementadas:**
  - Content scripts são injetados apenas quando necessário
  - Acesso limitado apenas aos metadados da página
  - Nenhum dado sensível é coletado ou transmitido

## Permissões Removidas

### `downloads`
- **Motivo da remoção:** Não utilizada pela extensão
- **Impacto:** Nenhum - funcionalidade não implementada

### `alarms`
- **Motivo da remoção:** Não utilizada pela extensão
- **Impacto:** Nenhum - funcionalidade não implementada

## Política de Privacidade

- **Dados locais apenas:** Todas as configurações e cache são armazenados localmente
- **Sem transmissão:** Nenhum dado é enviado para servidores externos
- **Acesso mínimo:** Content scripts acessam apenas metadados públicos das páginas
- **Transparência:** Código fonte aberto disponível no GitHub

## Conformidade com Políticas das Stores

Esta configuração de permissões atende aos requisitos de:
- Chrome Web Store Developer Program Policies
- Firefox Add-on Policies
- Edge Add-ons Store Policies

Todas as permissões são justificadas por funcionalidades documentadas e implementadas.