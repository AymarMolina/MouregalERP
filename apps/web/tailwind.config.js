/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // Diseño Mouregal (2026-11-26): fondo blanco con detalles morados del logo,
        // acción principal rosada y estados con su propio color. Ver DISENO_MOUREGAL.md.
        //   morado menú #4A2A55 · tinta #3A1F45 · tinta suave #6B5573 · rosa #C2185B
        //   lila: tinte #F4EBF7 · borde #E3D8E7 · input #D6C8DC · divisor #EEE7F1
        bg: "#ffffff",
        surface: "#ffffff",
        sidebar: "#FBF9FC",
        "sidebar-act": "#F4EBF7",
        nav: {
          DEFAULT: "#4A2A55",
          hover: "#64407A",
          text: "#EFE4F3",
          muted: "#CDB6D6",
          line: "#64407A",
        },
        text: "#3A1F45",
        muted: "#6B5573",
        line: "#E3D8E7",
        accent: "#4A2A55",
        "accent-hover": "#3A1F45",
        "accent-soft": "#F4EBF7",
        "accent-2": "#3A1F45",
        // Acción principal (un solo botón rosado por pantalla) y foco.
        rosa: {
          DEFAULT: "#C2185B",
          hover: "#A3134C",
          soft: "#FBE7EF",
        },
        brand: {
          DEFAULT: "#4A2A55",
          soft: "#F4EBF7",
          band: "#FBF9FC",
          line: "#E3D8E7",
          input: "#D6C8DC",
          divisor: "#EEE7F1",
          agujero: "#CDB6D6",
          hover: "#64407A",
          dark: "#4A2A55",
          darker: "#3A1F45",
        },
        // Se conserva el nombre por compatibilidad: ahora es el ámbar de "saldo / aviso".
        oro: {
          DEFAULT: "#E0A43A",
          soft: "#FBEFDF",
          fg: "#8F4A00",
        },
        saldo: { bg: "#FBEFDF", fg: "#8F4A00", fuerte: "#5A2E00" },
        exito: "#1F8A4C",
        error: "#B3261E",
        positivo: "#1F6B3A",
        negativo: "#B3261E",
        estado: {
          pendiente: { bg: "#EFEAF1", fg: "#4A3D52" },
          "en-armado": { bg: "#E3ECF8", fg: "#1F4E8C" },
          listo: { bg: "#E2F0E6", fg: "#1F6B3A" },
          "en-camino": { bg: "#EFE6F7", fg: "#5B2F86" },
          entregado: { bg: "#F4EBF7", fg: "#6B5573" },
          cancelado: { bg: "#FBE4E2", fg: "#9B1C15" },
        },
      },
      borderRadius: {
        DEFAULT: "10px",
      },
      boxShadow: {
        card: "none",
        pop: "0 14px 36px rgba(58, 31, 69, 0.18)",
        modal: "0 24px 60px rgba(58, 31, 69, 0.28)",
      },
      fontFamily: {
        // Albert Sans en toda la interfaz; Cormorant Garamond itálica solo para
        // dedicatorias y notas; Comfortaa solo para la palabra "Mouregal" del menú.
        sans: ["Albert Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Albert Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        marca: ["Comfortaa", "Albert Sans", "sans-serif"],
      },
      fontSize: {
        base: "13px",
      },
    },
  },
  plugins: [],
};
