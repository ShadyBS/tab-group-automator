#!/bin/bash

echo "🚀 Instalando MCPs para QODO GEN - Tab Group Automator"
echo

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js primeiro."
    echo "📥 Download: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo

echo "📦 Instalando pacotes MCP globalmente..."
echo

# Instalar MCPs essenciais
echo "Instalando Browser Extension MCP..."
npm install -g @modelcontextprotocol/server-browser-extension

echo "Instalando JavaScript Advanced MCP..."
npm install -g @modelcontextprotocol/server-javascript

echo "Instalando Web APIs MCP..."
npm install -g @modelcontextprotocol/server-web-apis

echo "Instalando CSS Framework MCP..."
npm install -g @modelcontextprotocol/server-css

echo "Instalando Testing & QA MCP..."
npm install -g @modelcontextprotocol/server-testing

echo "Instalando Build Automation MCP..."
npm install -g @modelcontextprotocol/server-build

echo "Instalando Security & Privacy MCP..."
npm install -g @modelcontextprotocol/server-security

echo "Instalando Documentation MCP..."
npm install -g @modelcontextprotocol/server-docs

echo
echo "✅ Todos os MCPs foram instalados com sucesso!"
echo

# Determinar o caminho de configuração baseado no OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
else
    # Linux
    CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
    CONFIG_DIR="$HOME/.config/Claude"
fi

echo "📁 Localizando arquivo de configuração do Claude Desktop..."
echo "Caminho: $CLAUDE_CONFIG"
echo

# Criar diretório se não existir
if [ ! -d "$CONFIG_DIR" ]; then
    echo "📂 Criando diretório de configuração do Claude..."
    mkdir -p "$CONFIG_DIR"
fi

# Copiar configuração se não existir
if [ ! -f "$CLAUDE_CONFIG" ]; then
    echo "📄 Criando arquivo de configuração inicial..."
    cp "mcp-config-example.json" "$CLAUDE_CONFIG"
    echo "✅ Configuração copiada para: $CLAUDE_CONFIG"
else
    echo "⚠️  Arquivo de configuração já existe."
    echo "📋 Para aplicar as configurações, copie manualmente o conteúdo de:"
    echo "   mcp-config-example.json"
    echo "📍 Para o arquivo:"
    echo "   $CLAUDE_CONFIG"
fi

echo
echo "���� Próximos passos:"
echo "1. Reinicie o Claude Desktop"
echo "2. Teste os MCPs com comandos específicos"
echo "3. Consulte o MCP_INSTALLATION_GUIDE.md para mais detalhes"
echo

echo "✨ Instalação concluída!"