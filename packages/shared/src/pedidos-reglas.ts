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
 * proporcional a su receta, por el método del mayor resto: la suma es
 * exactamente `totalUsado` y ninguna parte queda negativa.
 *
 * Con `enteros` (tallos, hojas, unidades) reparte unidades completas; si no,
 * reparte en milésimas.
 */
export function repartirUsado(
  partes: { id: string; cantidadReceta: number }[],
  totalUsado: number,
  opciones: { enteros?: boolean } = {},
): { id: string; usado: number }[] {
  if (!partes.length) return [];
  const escala = opciones.enteros ? 1 : 1000;
  const totalUnidades = Math.max(0, Math.round(totalUsado * escala));
  const totalReceta = partes.reduce((acc, p) => acc + p.cantidadReceta, 0);

  // Sin receta de referencia: todo al primero.
  if (totalReceta <= 0) {
    return partes.map((p, i) => ({ id: p.id, usado: i === 0 ? totalUnidades / escala : 0 }));
  }

  const exactos = partes.map((p) => (totalUnidades * p.cantidadReceta) / totalReceta);
  const base = exactos.map((x) => Math.floor(x + 1e-9));
  let resto = totalUnidades - base.reduce((a, b) => a + b, 0);
  // Las unidades sobrantes van a los ítems con mayor parte decimal.
  const orden = exactos.map((x, i) => ({ i, frac: x - base[i] })).sort((a, b) => b.frac - a.frac);
  for (const { i } of orden) {
    if (resto <= 0) break;
    base[i] += 1;
    resto -= 1;
  }
  return partes.map((p, i) => ({ id: p.id, usado: base[i] / escala }));
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
