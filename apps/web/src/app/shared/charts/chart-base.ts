import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
  type ChartType,
  type Plugin,
} from "chart.js";
import { formatoEje } from "./escala";

// Solo lo que usamos: mantiene el bundle pequeño (tree-shaking de Chart.js).
Chart.register(LineController, LineElement, PointElement, BarController, BarElement, CategoryScale, LinearScale, Filler, Tooltip);

Chart.defaults.font.family = "Inter, ui-sans-serif, system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = "#6b7280";

export const TOKENS = {
  texto: "#1f2329",
  muted: "#6b7280",
  grilla: "#eceef1",
  superficie: "#ffffff",
  crosshair: "#9ca3af",
};

/** Tooltip claro: valor en negrita arriba, detalle debajo (spec de interacción). */
export function tooltipBase(formato: (v: number) => string, detalle: (i: number) => string): ChartOptions["plugins"] {
  return {
    legend: { display: false },
    tooltip: {
      backgroundColor: TOKENS.superficie,
      borderColor: TOKENS.grilla,
      borderWidth: 1,
      titleColor: TOKENS.texto,
      bodyColor: TOKENS.muted,
      titleFont: { size: 13, weight: 600 },
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
      caretSize: 0,
      callbacks: {
        title: (items) => (items.length ? formato(Number(items[0].parsed.y ?? items[0].parsed.x)) : ""),
        label: (item) => detalle(item.dataIndex),
      },
    },
  };
}

/** Eje de valores: hairline sólida, sin borde, ticks redondos y compactos. */
export function ejeValores(enteros = false) {
  return {
    beginAtZero: true,
    border: { display: false },
    grid: { color: TOKENS.grilla, drawTicks: false },
    ticks: {
      padding: 8,
      maxTicksLimit: 5,
      precision: enteros ? 0 : undefined,
      callback: (v: string | number) => formatoEje(Number(v)),
    },
  };
}

/** Línea vertical que sigue al punto activo (el crosshair encuentra la X). */
export const crosshair: Plugin<"line"> = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const activo = chart.tooltip?.getActiveElements?.()[0];
    if (!activo) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.strokeStyle = TOKENS.crosshair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(activo.element.x, chartArea.top);
    ctx.lineTo(activo.element.x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * Etiqueta directa selectiva: dibuja el valor de UN punto (el último o el
 * pico), nunca de todos. Se oculta mientras hay tooltip para no duplicar.
 */
export function etiquetaDirecta<T extends ChartType>(
  indice: (valores: number[]) => number,
  formato: (v: number) => string,
): Plugin<T> {
  return {
    id: "etiquetaDirecta",
    afterDatasetsDraw(chart) {
      if (chart.tooltip?.getActiveElements?.().length) return;
      const valores = (chart.data.datasets[0]?.data ?? []) as number[];
      const i = indice(valores);
      if (i < 0 || !valores[i]) return;
      const el = chart.getDatasetMeta(0).data[i];
      if (!el) return;
      const { ctx, chartArea } = chart;
      const esLinea = (chart.config as { type?: string }).type === "line";
      const horizontal = (chart.options as { indexAxis?: string }).indexAxis === "y";
      if (horizontal) {
        ctx.save();
        ctx.font = `500 11px ${Chart.defaults.font.family}`;
        ctx.fillStyle = TOKENS.texto;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(formato(valores[i]), el.x + 6, el.y);
        ctx.restore();
        return;
      }
      const anterior = valores[i - 1] ?? valores[i];
      // En líneas, la etiqueta va del lado libre: debajo si la curva llega desde arriba.
      const abajo = esLinea && anterior > valores[i];
      ctx.save();
      ctx.font = `500 11px ${Chart.defaults.font.family}`;
      ctx.fillStyle = TOKENS.texto;
      ctx.textAlign = esLinea ? "right" : "center";
      ctx.textBaseline = abajo ? "top" : "bottom";
      const x = esLinea ? Math.min(el.x - 8, chartArea.right) : el.x;
      const y = abajo ? el.y + 10 : el.y - 8;
      ctx.fillText(formato(valores[i]), x, y);
      ctx.restore();
    },
  };
}

export { Chart };
