@echo off
echo 🚀 Instalando MCPs para QODO GEN - Tab Group Automator
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado. Instale Node.js primeiro.
    echo 📥 Download: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js encontrado
echo.

echo 📦 Instalando pacotes MCP globalmente...
echo.

REM Instalar MCPs essenciais
echo Instalando Browser Extension MCP...
npm install -g @modelcontextprotocol/server-browser-extension

echo Instalando JavaScript Advanced MCP...
npm install -g @modelcontextprotocol/server-javascript

echo Instalando Web APIs MCP...
npm install -g @modelcontextprotocol/server-web-apis

echo Instalando CSS Framework MCP...
npm install -g @modelcontextprotocol/server-css

echo Instalando Testing & QA MCP...
npm install -g @modelcontextprotocol/server-testing

echo Instalando Build Automation MCP...
npm install -g @modelcontextprotocol/server-build

echo Instalando Security & Privacy MCP...
npm install -g @modelcontextprotocol/server-security

echo Instalando Documentation MCP...
npm install -g @modelcontextprotocol/server-docs

echo.
echo ✅ Todos os MCPs foram instalados com sucesso!
echo.

REM Localizar arquivo de configuração do Claude Desktop
set CLAUDE_CONFIG=%APPDATA%\Claude\claude_desktop_config.json

echo 📁 Localizando arquivo de configuração do Claude Desktop...
echo Caminho: %CLAUDE_CONFIG%
echo.

if not exist "%APPDATA%\Claude\" (
    echo 📂 Criando diretório de configuração do Claude...
    mkdir "%APPDATA%\Claude"
)

if not exist "%CLAUDE_CONFIG%" (
    echo 📄 Criando arquivo de configuração inicial...
    copy "mcp-config-example.json" "%CLAUDE_CONFIG%"
    echo ✅ Configuração copiada para: %CLAUDE_CONFIG%
) else (
    echo ⚠️  Arquivo de configuração já existe.
    echo 📋 Para aplicar as configurações, copie manualmente o conteúdo de:
    echo    mcp-config-example.json
    echo 📍 Para o arquivo:
    echo    %CLAUDE_CONFIG%
)

echo.
echo 🎯 Próximos passos:
echo 1. Reinicie o Claude Desktop
echo 2. Teste os MCPs com comandos específicos
echo 3. Consulte o MCP_INSTALLATION_GUIDE.md para mais detalhes
echo.

echo ✨ Instalação concluída!
pause