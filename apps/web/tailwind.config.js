/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        bg: "#fffdf3",
        surface: "#ffffff",
        sidebar: "#fff6d1",
        "sidebar-act": "#fbe9a0",
        text: "#22201a",
        muted: "#6e6a58",
        line: "#efe9cf",
        accent: "#e9b824",
        "accent-soft": "#fff3c4",
        "accent-2": "#b7791f",
        estado: {
          pendiente: { bg: "#ece7dd", fg: "#5d5848" },
          "en-armado": { bg: "#f6e2d5", fg: "#8f4a2a" },
          listo: { bg: "#dfeadb", fg: "#2f5a35" },
          "en-camino": { bg: "#dde7f3", fg: "#2c5585" },
          entregado: { bg: "#ecebe6", fg: "#8a877c" },
        },
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      fontFamily: {
        sans: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        base: "13px",
      },
    },
  },
  plugins: [],
};
