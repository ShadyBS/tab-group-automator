# Auto Tab Grouper

[![Versão](https://img.shields.io/badge/versão-3.2.2-blue.svg)](https://github.com/ShadyBS/tab-group-automator/releases)
[![Licença](https://img.shields.io/badge/licença-ISC-green.svg)](LICENSE)
[![Firefox Add-on](https://img.shields.io/badge/Firefox-obter-orange.svg?logo=firefox-browser)](https://addons.mozilla.org/firefox/addon/auto-tab-grouper/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-obter-blue.svg?logo=google-chrome)](https://chrome.google.com/webstore/detail/auto-tab-grouper/your-extension-id)

Uma extensão de navegador poderosa que organiza automaticamente as suas abas em grupos, mantendo a sua sessão de navegação limpa e focada. Diga adeus ao caos de abas!

_(Placeholder para uma imagem ou GIF de demonstração)_

---

## ✨ Funcionalidades Principais

- **Agrupamento Inteligente**: Utiliza múltiplos métodos (metadados da página, títulos, URLs) para nomear grupos de forma inteligente e precisa.
- **Regras Personalizadas Poderosas**: Crie regras complexas com lógica **E/OU** para agrupar abas com base em URL, domínio, ou título.
- **Controlo Total**:
  - **Listas de Exceções**: Impede que sites específicos sejam agrupados.
  - **Grupos Manuais**: Marque grupos com um pino (📌) para os proteger do agrupamento automático.
- **Comportamento Personalizável**:
  - **Contador de Abas**: Mostra o número de abas no título do grupo.
  - **Recolher Automaticamente**: Recolhe grupos inativos após um tempo definido por si.
  - **Desagrupar Abas Únicas**: Remove automaticamente grupos que ficam com apenas uma aba.
- **Sincronização entre Dispositivos**: Sincronize as suas regras e configurações através da sua conta Firefox ou Google.
- **Importar e Exportar**: Faça backup e partilhe facilmente as suas configurações.
- **Temas Claro e Escuro**: Adapta-se ao tema do seu sistema operativo para uma experiência visual consistente.
- **Menus de Contexto**: Ações rápidas diretamente do clique direito numa página.

## 🚀 Instalação

### A partir das Lojas Oficiais (Recomendado)

- [**Firefox Add-ons**](https://addons.mozilla.org/firefox/addon/auto-tab-grouper/)
- [**Chrome Web Store**](https://chrome.google.com/webstore/detail/auto-tab-grouper/your-extension-id) _(link a ser atualizado)_

### Para Desenvolvimento

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/ShadyBS/tab-group-automator.git
    cd tab-group-automator
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **Carregue a extensão no seu navegador:**

    - **Firefox:**

      1.  Abra o Firefox e navegue para `about:debugging`.
      2.  Clique em "This Firefox" e depois em "Load Temporary Add-on...".
      3.  Selecione o ficheiro `manifest.json` na raiz do projeto.

    - **Chrome/Edge:**
      1.  Abra o navegador e navegue para `chrome://extensions` (ou `edge://extensions`).
      2.  Ative o "Developer mode" (Modo de programador).
      3.  Clique em "Load unpacked" (Carregar desembalada).
      4.  Selecione a pasta raiz do projeto.

## 🛠️ Como Usar

- **Popup da Barra de Ferramentas**: Clique no ícone da extensão para ativar/desativar rapidamente o agrupamento automático ou para agrupar todas as abas abertas de uma só vez.
- **Página de Opções**: O coração da extensão. Aqui pode:
  - Definir a sua estratégia de agrupamento.
  - Criar e gerir regras personalizadas.
  - Configurar exceções e comportamento dos grupos.
  - Importar ou exportar as suas configurações.
- **Menu de Contexto**: Clique com o botão direito numa página para criar rapidamente uma nova regra para esse site, adicioná-lo a uma regra existente ou excluí-lo do agrupamento.

## 🏗️ Construir a Partir do Código Fonte

Se fez alterações e quer empacotar a extensão para distribuição, use o seguinte comando:

```bash
npm run package
```

Isto irá compilar o CSS do Tailwind e criar os ficheiros `.zip` para Firefox e Chromium no diretório `dist/`.

## 🤝 Contribuir

Contribuições são muito bem-vindas! Se encontrar um bug ou tiver uma ideia para uma nova funcionalidade, por favor, abra uma issue.

## 🔒 Privacidade

A sua privacidade é importante. Todas as suas configurações e regras são armazenadas localmente no seu computador ou, se ativada, através do serviço de sincronização seguro do seu navegador (Firefox Sync ou Google Account Sync). A extensão não recolhe nem envia quaisquer dados pessoais para servidores externos.
