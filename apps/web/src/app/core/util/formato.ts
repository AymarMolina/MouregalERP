import type { EstadoOc, EstadoPago, EstadoPedido } from "@erp/shared";

/** Clases Tailwind de la insignia de cada estado de pedido (tokens de la sección 9). */
export const CLASE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: "bg-estado-pendiente-bg text-estado-pendiente-fg",
  en_armado: "bg-estado-en-armado-bg text-estado-en-armado-fg",
  listo: "bg-estado-listo-bg text-estado-listo-fg",
  en_camino: "bg-estado-en-camino-bg text-estado-en-camino-fg",
  entregado: "bg-estado-entregado-bg text-estado-entregado-fg",
  cancelado: "bg-estado-cancelado-bg text-estado-cancelado-fg",
};

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: "Pendiente",
  en_armado: "En armado",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const CLASE_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "bg-accent-soft text-accent-2",
  pagado: "bg-estado-listo-bg text-estado-listo-fg",
  fallido: "bg-red-50 text-red-700",
  anulado: "bg-estado-entregado-bg text-estado-entregado-fg line-through",
};

export const CLASE_ESTADO_OC: Record<EstadoOc, string> = {
  borrador: "bg-estado-pendiente-bg text-estado-pendiente-fg",
  enviada: "bg-estado-en-camino-bg text-estado-en-camino-fg",
  recibida_parcial: "bg-accent-soft text-accent-2",
  recibida: "bg-estado-listo-bg text-estado-listo-fg",
  anulada: "bg-estado-entregado-bg text-estado-entregado-fg",
};

/** S/ 1,234.50 */
export function soles(valor: number | string | null | undefined): string {
  const n = Number(valor ?? 0);
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Cantidad con hasta 3 decimales, sin ceros de más. */
export function cantidad(valor: number | string | null | undefined): string {
  return Number(valor ?? 0).toLocaleString("es-PE", { maximumFractionDigits: 3 });
}

/** Fecha de hoy en Lima (AAAA-MM-DD). */
export function hoyLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

/** Fecha AAAA-MM-DD desplazada n días respecto de hoy en Lima. */
export function diasDesdeHoy(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

/** "15:00" si la fecha es hoy; "09/11 · 10:00" si es otro día. */
export function cuando(fecha: string, h: string): string {
  if (fecha === hoyLima()) return hora(h);
  const [, m, d] = fecha.split("-");
  return `${d}/${m} · ${hora(h)}`;
}

/** "10:00:00" → "10:00" */
export function hora(h: string | null | undefined): string {
  return (h ?? "").slice(0, 5);
}
