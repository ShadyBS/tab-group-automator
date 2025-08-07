# 🚀 Guia de Instalação de MCPs para QODO GEN

## 📋 Pré-requisitos

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- **Claude Desktop** instalado
- **QODO GEN** configurado

## 🔧 Instalação dos MCPs

### Passo 1: Instalar Pacotes MCP

Execute os comandos abaixo no terminal:

```bash
# MCPs essenciais para desenvolvimento de extensões
npm install -g @modelcontextprotocol/server-browser-extension
npm install -g @modelcontextprotocol/server-javascript
npm install -g @modelcontextprotocol/server-web-apis
npm install -g @modelcontextprotocol/server-css
npm install -g @modelcontextprotocol/server-testing
npm install -g @modelcontextprotocol/server-build
npm install -g @modelcontextprotocol/server-security
npm install -g @modelcontextprotocol/server-docs
```

### Passo 2: Localizar Arquivo de Configuração

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Passo 3: Configurar MCPs

Copie o conteúdo do arquivo `mcp-config-example.json` para o arquivo de configuração do Claude Desktop.

### Passo 4: Reiniciar Claude Desktop

Feche completamente o Claude Desktop e abra novamente para carregar as configurações.

## 🎯 MCPs Específicos para Tab Group Automator

### 1. Browser Extension Development MCP
```json
{
  "browser-extension-dev": {
    "command": "npx",
    "args": ["@modelcontextprotocol/server-browser-extension"],
    "env": {
      "PROJECT_TYPE": "webextension",
      "TARGET_BROWSERS": "chrome,firefox",
      "MANIFEST_VERSION": "3",
      "PERMISSIONS": "tabs,storage,activeTab"
    }
  }
}
```

**Funcionalidades:**
- Validação de manifest.json
- Compatibilidade cross-browser
- Gerenciamento de permissões
- APIs específicas de extensões

### 2. JavaScript Advanced MCP
```json
{
  "javascript-advanced": {
    "command": "npx",
    "args": ["@modelcontextprotocol/server-javascript"],
    "env": {
      "TYPESCRIPT_SUPPORT": "true",
      "ES_VERSION": "2022",
      "MODULE_SYSTEM": "esm",
      "LINT_CONFIG": "eslint"
    }
  }
}
```

**Funcionalidades:**
- Refatoração inteligente
- Detecção de anti-padrões
- Otimização de performance
- Modularização de código

### 3. Web APIs MCP
```json
{
  "web-apis": {
    "command": "npx",
    "args": ["@modelcontextprotocol/server-web-apis"],
    "env": {
      "DOM_APIS": "true",
      "BROWSER_APIS": "chrome.tabs,browser.tabs,chrome.storage,chrome.contextMenus",
      "ASYNC_PATTERNS": "promises,async-await"
    }
  }
}
```

**Funcionalidades:**
- Manipulação de abas
- Gerenciamento de storage
- Context menus
- Eventos assíncronos

## 🔍 Verificação da Instalação

### Teste 1: Verificar MCPs Carregados
No Claude Desktop, digite:
```
Quais MCPs estão disponíveis?
```

### Teste 2: Testar Funcionalidade Específica
```
Analise o manifest.json do projeto Tab Group Automator
```

### Teste 3: Validar Configuração
```
Verifique a compatibilidade cross-browser do código JavaScript
```

## 🛠️ Configurações Avançadas

### Configuração por Projeto
Crie um arquivo `.mcp-config.json` na raiz do projeto:

```json
{
  "project": "tab-group-automator",
  "mcpSettings": {
    "browser-extension-dev": {
      "manifestPath": "./manifest.json",
      "srcPath": "./src",
      "buildPath": "./dist"
    },
    "javascript-advanced": {
      "entryPoints": ["background.js", "content-script.js"],
      "moduleSystem": "esm",
      "targetBrowsers": ["chrome", "firefox"]
    }
  }
}
```

### Variáveis de Ambiente
Configure variáveis específicas do projeto:

```bash
# Windows
set MCP_PROJECT_ROOT=c:\tab-group-automator
set MCP_BUILD_TARGET=production

# macOS/Linux
export MCP_PROJECT_ROOT=/path/to/tab-group-automator
export MCP_BUILD_TARGET=production
```

## 🚨 Troubleshooting

### Problema: MCPs não carregam
**Solução:**
1. Verificar se Node.js está instalado
2. Reinstalar pacotes MCP globalmente
3. Verificar sintaxe do arquivo de configuração
4. Reiniciar Claude Desktop

### Problema: Permissões negadas
**Solução:**
```bash
# Windows (executar como administrador)
npm install -g --force @modelcontextprotocol/server-*

# macOS/Linux
sudo npm install -g @modelcontextprotocol/server-*
```

### Problema: Configuração não reconhecida
**Solução:**
1. Validar JSON com ferramenta online
2. Verificar caminhos dos arquivos
3. Confirmar versões dos pacotes

## 📊 Monitoramento e Logs

### Habilitar Logs Detalhados
```json
{
  "mcpServers": {
    "browser-extension-dev": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-browser-extension", "--verbose"],
      "env": {
        "DEBUG": "true",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Localização dos Logs
- **Windows:** `%APPDATA%\Claude\logs\`
- **macOS:** `~/Library/Logs/Claude/`
- **Linux:** `~/.local/share/Claude/logs/`

## 🎯 Próximos Passos

1. **Testar MCPs** com comandos específicos do projeto
2. **Configurar workflows** automatizados
3. **Personalizar** configurações por necessidade
4. **Monitorar performance** e ajustar conforme necessário

## 📚 Recursos Adicionais

- [Documentação Oficial MCP](https://modelcontextprotocol.io/)
- [Claude Desktop Configuration](https://docs.anthropic.com/claude/desktop)
- [WebExtension APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)