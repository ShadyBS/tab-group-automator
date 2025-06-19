/** @type {import('tailwindcss').Config} */
module.exports = {
  // Adiciona a estratégia de classe para o modo escuro.
  // Agora o Tailwind vai procurar pela classe ".dark" no elemento <html>
  // para aplicar os estilos de tema escuro.
  darkMode: 'class',

  content: [
    './popup/*.{html,js,css}',
    './options/*.{html,js,css}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
