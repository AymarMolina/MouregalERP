/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // Blanco y azul marino oscuro con toque floral (2026-11-20): títulos en
        // Poppins (texto en Roboto), botón primario azul marino y flores en trazo fino.
        // #1e3a6e en checkboxes, pestaña activa, foco y gráficos.
        //   acento   #5b74a6 #6f86b3 #4a6396 #1e3a6e
        //   oscuros  #14213d #0b1530  apagados #6b7fa6 #334a73 #475a7d
        // El login conserva los colores del logo (lila).
        bg: "#ffffff",
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
        accent: "#1e3a6e",
        "accent-hover": "#334a73",
        "accent-soft": "#f3f4f6",
        // Énfasis oscuro (≥ 4.5:1 sobre blanco)
        "accent-2": "#111827",
        brand: {
          DEFAULT: "#1e3a6e",
          soft: "#eef2f8",
          band: "#f5f7fb",
          line: "#dde3ee",
          dark: "#14213d",
          darker: "#0b1530",
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
        // Roboto para texto y UI; Poppins para títulos y cifras grandes.
        sans: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        base: "13px",
      },
    },
  },
  plugins: [],
};
