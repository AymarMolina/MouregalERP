/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // Estilo SaaS claro (blancos y grises sutiles). La marca Mouregal queda
        // como acento institucional: #9b73a1 en checkboxes, pestaña activa,
        // foco y gráficos. Paleta completa del logo:
        //   acento   #b584b9 #b48dbb #a382ac #9b73a1
        //   oscuros  #4e345a  apagados #987f9c #73607c #6d5d72
        bg: "#f8f9fa",
        surface: "#ffffff",
        // Superficie suave (dedicatorias, pies de tabla, resaltados)
        sidebar: "#f9fafb",
        "sidebar-act": "#f3f4f6",
        // Barra lateral blanca
        nav: {
          DEFAULT: "#ffffff",
          hover: "#f3f4f6",
          text: "#4b5563",
          muted: "#9ca3af",
          line: "#e5e7eb",
        },
        text: "#111827",
        muted: "#6b7280",
        line: "#e5e7eb",
        accent: "#9b73a1",
        "accent-hover": "#73607c",
        "accent-soft": "#f3f4f6",
        // Énfasis oscuro (≥ 4.5:1 sobre blanco)
        "accent-2": "#111827",
        brand: {
          DEFAULT: "#9b73a1",
          soft: "#f6f0f7",
          dark: "#4e345a",
        },
        positivo: "#15803d",
        negativo: "#b91c1c",
        estado: {
          pendiente: { bg: "#fef9c3", fg: "#854d0e" },
          "en-armado": { bg: "#f3e8ff", fg: "#6b21a8" },
          listo: { bg: "#dcfce7", fg: "#166534" },
          "en-camino": { bg: "#e0f2fe", fg: "#075985" },
          entregado: { bg: "#f3f4f6", fg: "#4b5563" },
          cancelado: { bg: "#fee2e2", fg: "#991b1b" },
        },
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(17, 24, 39, 0.04)",
        pop: "0 10px 30px -8px rgba(17, 24, 39, 0.18), 0 2px 6px -2px rgba(17, 24, 39, 0.06)",
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
