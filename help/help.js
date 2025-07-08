// IIFE para criar um escopo e não poluir o global.
(function () {
  // Fallback para ambientes não-extensão (como testes locais ou pré-visualizações)
  // onde as APIs 'browser' não estão disponíveis.
  if (
    typeof browser === "undefined" ||
    !browser.runtime ||
    !browser.runtime.sendMessage
  ) {
    console.warn(
      "Auto Tab Grouper: Não foi possível aceder às APIs do browser. A aplicar tema do sistema como fallback."
    );

    const applySystemTheme = () => {
      const htmlEl = document.documentElement;
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        htmlEl.classList.remove("light");
        htmlEl.classList.add("dark");
      } else {
        htmlEl.classList.remove("dark");
        htmlEl.classList.add("light");
      }
    };

    applySystemTheme();
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", applySystemTheme);
    return; // Para a execução, pois não podemos comunicar com a extensão.
  }

  // --- Lógica para quando o script é executado dentro do contexto da extensão ---

  function applyTheme(theme) {
    const htmlEl = document.documentElement;
    if (theme === "dark") {
      htmlEl.classList.remove("light");
      htmlEl.classList.add("dark");
    } else if (theme === "light") {
      htmlEl.classList.remove("dark");
      htmlEl.classList.add("light");
    } else {
      // 'auto' ou caso padrão
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        htmlEl.classList.remove("light");
        htmlEl.classList.add("dark");
      } else {
        htmlEl.classList.remove("dark");
        htmlEl.classList.add("light");
      }
    }
  }

  function handleSystemThemeChange(event) {
    // Re-busca as configurações para garantir que ainda devemos seguir o sistema.
    browser.runtime.sendMessage({ action: "getSettings" }).then((settings) => {
      if (settings && settings.theme === "auto") {
        applyTheme("auto");
      }
    });
  }

  async function initializeTheme() {
    try {
      const settings = await browser.runtime.sendMessage({
        action: "getSettings",
      });
      if (settings && settings.theme) {
        applyTheme(settings.theme);
        // Remove listener antigo para evitar duplicados.
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .removeEventListener("change", handleSystemThemeChange);
        // Adiciona o listener apenas se o tema for 'auto'
        if (settings.theme === "auto") {
          window
            .matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", handleSystemThemeChange);
        }
      } else {
        applyTheme("auto"); // Fallback
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", handleSystemThemeChange);
      }
    } catch (e) {
      console.error(
        "Auto Tab Grouper: Não foi possível obter as configurações de tema. Usando preferência do sistema.",
        e
      );
      applyTheme("auto"); // Fallback em caso de erro
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", handleSystemThemeChange);
    }
  }

  // Ouve por mensagens de que as configurações foram atualizadas em outro lugar (ex: na página de opções)
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "settingsUpdated") {
      initializeTheme();
    }
  });

  // Configuração inicial do tema
  initializeTheme();
})();
