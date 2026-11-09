/** Utilidades de escala compartidas por los gráficos (sin dependencias). */

export interface Punto {
  /** Etiqueta corta del eje X (ej. "08/11"). */
  etiqueta: string;
  /** Etiqueta completa para tooltip y tabla (ej. "sáb 8 nov"). */
  detalle: string;
  valor: number;
}

/** Tick compacto para el eje: 0 / 500 / 1,000 / 12K. */
export function formatoEje(v: number): string {
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  return v.toLocaleString("es-PE", { maximumFractionDigits: 1 });
}

