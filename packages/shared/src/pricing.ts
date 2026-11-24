import { DESCUENTO_MAX_VENDEDORA_PCT, type RolRecetaLinea, type RolUsuario, type Talla, type Vehiculo } from "./enums";

export interface RecetaLineaBase {
  insumoId: string;
  cantidad: number;
  rol: RolRecetaLinea;
}

export interface LineaCantidad {
  insumoId: string;
  cantidad: number;
}

export interface ItemSeleccion {
  lineasBase: RecetaLineaBase[];
  florId: string;
  usaPapel: boolean;
  papelId?: string | null;
  extraInsumoIds: string[];
  cantidad: number;
}

/**
 * Sección 5.1 — receta efectiva de un ítem: reemplaza flor principal y papel,
 * agrega 1 unidad del insumo de cada extra, y multiplica todo por la
 * cantidad del ítem.
 */
export function recetaEfectiva(sel: ItemSeleccion): LineaCantidad[] {
  const porInsumo = new Map<string, number>();

  for (const linea of sel.lineasBase) {
    if (linea.rol === "papel" && !sel.usaPapel) continue;

    const insumoId =
      linea.rol === "flor_principal" ? sel.florId : linea.rol === "papel" ? (sel.papelId ?? linea.insumoId) : linea.insumoId;

    porInsumo.set(insumoId, (porInsumo.get(insumoId) ?? 0) + linea.cantidad);
  }

  for (const extraInsumoId of sel.extraInsumoIds) {
    porInsumo.set(extraInsumoId, (porInsumo.get(extraInsumoId) ?? 0) + 1);
  }

  return [...porInsumo.entries()]
    .map(([insumoId, cantidadPorUnidad]) => ({ insumoId, cantidad: cantidadPorUnidad * sel.cantidad }))
    .filter((l) => l.cantidad > 0);
}

export interface AjusteAplicado {
  descripcion: string;
  ajuste: number;
  reglaId?: string;
}

/**
 * Sección 5.2 — precio: precio_base + ajustes de reglas + precio de extras,
 * multiplicado por la cantidad para el subtotal.
 */
export function calcularPrecio(params: {
  precioBase: number;
  ajustes: AjusteAplicado[];
  extrasPrecio: number[];
  cantidad: number;
}): { precioUnitario: number; subtotal: number } {
  const totalAjustes = params.ajustes.reduce((acc, a) => acc + a.ajuste, 0);
  const totalExtras = params.extrasPrecio.reduce((acc, p) => acc + p, 0);
  const precioUnitario = round2(params.precioBase + totalAjustes + totalExtras);
  const subtotal = round2(precioUnitario * params.cantidad);
  return { precioUnitario, subtotal };
}

/**
 * Sección 5.5 — vehículo: carro si la talla es L, si la receta efectiva
 * incluye un insumo marcado como "caja", o si algún extra fuerza carro.
 */
export function calcularVehiculo(params: {
  talla: Talla;
  recetaEfectiva: LineaCantidad[];
  insumosCaja: ReadonlySet<string>;
  algunExtraFuerzaCarro: boolean;
}): Vehiculo {
  if (params.talla === "L") return "carro";
  if (params.recetaEfectiva.some((l) => params.insumosCaja.has(l.insumoId))) return "carro";
  if (params.algunExtraFuerzaCarro) return "carro";
  return "moto";
}

/** Sección 5.5 — costo de envío y total del pedido. */
export function calcularEnvio(
  vehiculo: Vehiculo,
  distrito: { tarifaMoto: number; tarifaCarro: number },
): number {
  return vehiculo === "carro" ? distrito.tarifaCarro : distrito.tarifaMoto;
}

/** Sección 5.3 — disponible = stock actual - reservado. */
export function calcularDisponible(stockActual: number, reservado: number): number {
  return round3(stockActual - reservado);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Descuento sobre los productos (no sobre el envío). La vendedora tiene tope
 * (`DESCUENTO_MAX_VENDEDORA_PCT`); el admin no, salvo no pasar del subtotal.
 */
export function validarDescuento(p: {
  descuento: number;
  subtotalProductos: number;
  rol: RolUsuario;
}): { ok: true } | { ok: false; motivo: string } {
  if (p.descuento < 0) return { ok: false, motivo: "El descuento no puede ser negativo" };
  if (p.descuento > p.subtotalProductos) {
    return { ok: false, motivo: "El descuento no puede ser mayor que el valor de los productos" };
  }
  if (p.rol !== "admin") {
    const tope = round2((p.subtotalProductos * DESCUENTO_MAX_VENDEDORA_PCT) / 100);
    if (p.descuento > tope + 0.001) {
      return {
        ok: false,
        motivo: `Tu rol puede descontar hasta ${DESCUENTO_MAX_VENDEDORA_PCT} % (S/ ${tope.toFixed(2)}). Para más, pide al admin.`,
      };
    }
  }
  return { ok: true };
}

/** Total del pedido: productos − descuento + envío (el envío es 0 en recojo). */
export function totalPedido(p: { subtotalProductos: number; descuento: number; costoEnvio: number }): number {
  return round2(p.subtotalProductos - p.descuento + p.costoEnvio);
}
