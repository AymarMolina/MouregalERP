import type { EstadoPedido, RolUsuario } from "./enums";
import type { LineaCantidad } from "./pricing";

/**
 * Sección 5.6 — grafo de estados. `en_armado → listo` no está aquí porque
 * solo ocurre al confirmar consumo (POST /pedidos/:id/consumo).
 */
export const TRANSICIONES_VALIDAS: Record<EstadoPedido, readonly EstadoPedido[]> = {
  pendiente: ["en_armado", "cancelado"],
  en_armado: ["cancelado"],
  listo: ["en_camino", "cancelado"],
  en_camino: ["entregado", "cancelado"],
  entregado: [],
  cancelado: [],
};

/**
 * Quién puede llevar un pedido a cada estado (sección 3):
 * - en_armado: producción arma el pedido.
 * - en_camino: delivery despacha; la vendedora también ("Enviar link y despachar").
 * - entregado: delivery marca la entrega.
 * - cancelado: la vendedora puede cancelar mientras no se haya consumido
 *   inventario (pendiente / en_armado). Desde listo o en_camino la
 *   cancelación genera merma, así que solo la hace el admin.
 * El admin puede todo.
 */
const ROLES_POR_DESTINO: Record<EstadoPedido, readonly RolUsuario[]> = {
  pendiente: [],
  en_armado: ["admin", "produccion"],
  listo: ["admin", "produccion"],
  en_camino: ["admin", "delivery", "vendedora"],
  entregado: ["admin", "delivery"],
  cancelado: ["admin", "vendedora"],
};

const ESTADOS_SIN_CONSUMO: readonly EstadoPedido[] = ["pendiente", "en_armado"];

export type ResultadoTransicion = { ok: true } | { ok: false; motivo: string };

export function validarTransicion(rol: RolUsuario, desde: EstadoPedido, hacia: EstadoPedido): ResultadoTransicion {
  if (!TRANSICIONES_VALIDAS[desde].includes(hacia)) {
    return { ok: false, motivo: `No se puede pasar de "${desde}" a "${hacia}"` };
  }
  if (!ROLES_POR_DESTINO[hacia].includes(rol)) {
    return { ok: false, motivo: `El rol "${rol}" no puede pasar un pedido a "${hacia}"` };
  }
  if (hacia === "cancelado" && rol !== "admin" && !ESTADOS_SIN_CONSUMO.includes(desde)) {
    return {
      ok: false,
      motivo: `Solo un admin puede cancelar un pedido en "${desde}" (los insumos ya se consumieron)`,
    };
  }
  return { ok: true };
}

/**
 * Sección 5.7 — separa lo usado en consumo (hasta lo que pide la receta) y
 * merma (lo que excede). Si usó menos que la receta no hay merma.
 */
export function desglosarConsumo(cantidadReceta: number, cantidadUsada: number): { consumo: number; merma: number } {
  return {
    consumo: round3(Math.min(cantidadUsada, cantidadReceta)),
    merma: round3(Math.max(0, cantidadUsada - cantidadReceta)),
  };
}

/**
 * Reparte lo usado de un insumo entre los ítems del pedido que lo llevan,
 * proporcional a su receta. El último ítem absorbe el redondeo para que la
 * suma sea exactamente `totalUsado`.
 */
export function repartirUsado(
  partes: { id: string; cantidadReceta: number }[],
  totalUsado: number,
): { id: string; usado: number }[] {
  const totalReceta = partes.reduce((acc, p) => acc + p.cantidadReceta, 0);
  if (!partes.length) return [];
  let asignado = 0;
  return partes.map((p, idx) => {
    if (idx === partes.length - 1) {
      return { id: p.id, usado: round3(totalUsado - asignado) };
    }
    const usado = totalReceta > 0 ? round3((totalUsado * p.cantidadReceta) / totalReceta) : 0;
    asignado = round3(asignado + usado);
    return { id: p.id, usado };
  });
}

/** Suma recetas efectivas agrupando por insumo. */
export function sumarRecetas(recetas: LineaCantidad[][]): LineaCantidad[] {
  const porInsumo = new Map<string, number>();
  for (const receta of recetas) {
    for (const l of receta) porInsumo.set(l.insumoId, round3((porInsumo.get(l.insumoId) ?? 0) + l.cantidad));
  }
  return [...porInsumo.entries()].map(([insumoId, cantidad]) => ({ insumoId, cantidad }));
}

export interface Faltante {
  insumoId: string;
  necesario: number;
  disponible: number;
}

/** Sección 5.3 — líneas de una receta efectiva que no caben en el disponible. */
export function faltantes(receta: LineaCantidad[], disponibleDe: (insumoId: string) => number): Faltante[] {
  const out: Faltante[] = [];
  for (const l of receta) {
    const disponible = disponibleDe(l.insumoId);
    if (l.cantidad > disponible + 1e-9) out.push({ insumoId: l.insumoId, necesario: l.cantidad, disponible });
  }
  return out;
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
