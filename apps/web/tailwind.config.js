/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // Canvas y superficies
        // Gris cálido muy claro: amplitud de lienzo con un guiño al marfil de la florería
        bg: "#f6f5f1",
        surface: "#ffffff",
        // Superficie cálida de acento (dedicatorias, pies de tabla, resaltados suaves)
        sidebar: "#fff6d1",
        "sidebar-act": "#fbe9a0",
        // Barra lateral oscura
        nav: {
          DEFAULT: "#1e2229",
          hover: "#2a2f38",
          text: "#c3c8d0",
          muted: "#7d848f",
          line: "#2c313a",
        },
        text: "#1f2329",
        muted: "#6b7280",
        line: "#eceef1",
        accent: "#e9b824",
        "accent-soft": "#fff3c4",
        // Ámbar oscuro: marcas de datos y textos de alerta (≥ 3:1 sobre blanco)
        "accent-2": "#b7791f",
        positivo: "#15803d",
        negativo: "#b91c1c",
        estado: {
          pendiente: { bg: "#ece7dd", fg: "#5d5848" },
          "en-armado": { bg: "#f6e2d5", fg: "#8f4a2a" },
          listo: { bg: "#dfeadb", fg: "#2f5a35" },
          "en-camino": { bg: "#dde7f3", fg: "#2c5585" },
          entregado: { bg: "#ecebe6", fg: "#8a877c" },
          cancelado: { bg: "#f3e3e3", fg: "#8a3b3b" },
        },
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        card: "0 2px 10px -3px rgba(16, 24, 40, 0.07)",
        pop: "0 8px 24px -6px rgba(16, 24, 40, 0.12)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        base: "13px",
      },
    },
  },
  plugins: [],
};
