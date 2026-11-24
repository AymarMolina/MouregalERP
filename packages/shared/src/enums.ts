// Enums de negocio (sección 4.1 del spec). Son la fuente única de verdad:
// se usan tanto para los pgEnum de Drizzle como para los z.enum de validación.

export const ROL_USUARIO = ["admin", "vendedora", "produccion", "almacen", "delivery"] as const;
export type RolUsuario = (typeof ROL_USUARIO)[number];

export const UNIDAD_BASE = ["tallo", "g", "hoja", "m", "und"] as const;
export type UnidadBase = (typeof UNIDAD_BASE)[number];

/** Unidades que se cuentan (no se pesan ni se miden): solo admiten cantidades enteras. */
export const UNIDADES_ENTERAS: readonly UnidadBase[] = ["tallo", "hoja", "und"];

export function esUnidadEntera(unidad: string): boolean {
  return (UNIDADES_ENTERAS as readonly string[]).includes(unidad);
}

/** null si la cantidad es válida para la unidad; si no, el mensaje de error. */
export function errorCantidadPorUnidad(nombre: string, unidad: string, cantidad: number): string | null {
  if (esUnidadEntera(unidad) && !Number.isInteger(cantidad)) {
    return `${nombre} se cuenta por ${unidad === "und" ? "unidad" : unidad}: la cantidad debe ser entera (llegó ${cantidad}).`;
  }
  return null;
}

export const INSUMO_CATEGORIA = [
  "flor",
  "follaje",
  "papel",
  "accesorio",
  "relleno",
  "peluche",
] as const;
export type InsumoCategoria = (typeof INSUMO_CATEGORIA)[number];

export const ROL_RECETA_LINEA = ["flor_principal", "papel", "otro"] as const;
export type RolRecetaLinea = (typeof ROL_RECETA_LINEA)[number];

export const AJUSTE_MODO = ["fijo", "por_unidad"] as const;
export type AjusteModo = (typeof AJUSTE_MODO)[number];

export const TALLA = ["S", "M", "L"] as const;
export type Talla = (typeof TALLA)[number];

export const CANAL = ["shopify", "whatsapp", "vendedora"] as const;
export type Canal = (typeof CANAL)[number];

export const ESTADO_PEDIDO = [
  "pendiente",
  "en_armado",
  "listo",
  "en_camino",
  "entregado",
  "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADO_PEDIDO)[number];

export const VEHICULO = ["moto", "carro"] as const;

/**
 * Cómo llega el pedido al cliente:
 * - delivery: lo lleva un repartidor (distrito, dirección y receptor obligatorios, cobra envío).
 * - recojo: el cliente lo recoge en la tienda o se lo lleva al momento (sin envío ni dirección).
 */
export const TIPO_ENTREGA = ["delivery", "recojo"] as const;
export type TipoEntrega = (typeof TIPO_ENTREGA)[number];

/** Métodos que la vendedora registra a mano porque ya cobró (no son links ni Shopify). */
export const METODOS_COBRO_DIRECTO = ["efectivo", "yape", "plin", "tarjeta", "transferencia"] as const;
export type MetodoCobroDirecto = (typeof METODOS_COBRO_DIRECTO)[number];

/** Descuento máximo que puede dar una vendedora, en % de los productos. El admin no tiene tope. */
export const DESCUENTO_MAX_VENDEDORA_PCT = 10;
export type Vehiculo = (typeof VEHICULO)[number];

export const TIPO_MOVIMIENTO = [
  "apertura",
  "compra",
  "consumo",
  "merma",
  "ajuste_positivo",
  "ajuste_negativo",
  "devolucion",
] as const;
export type TipoMovimiento = (typeof TIPO_MOVIMIENTO)[number];

export const TIPO_CAMBIO = ["flor", "papel", "color", "tamano", "extra", "otro"] as const;
export type TipoCambio = (typeof TIPO_CAMBIO)[number];

export const ESTADO_REGLA = ["aprobado", "consultar"] as const;
export type EstadoRegla = (typeof ESTADO_REGLA)[number];

export const ESTADO_CONSULTA = ["abierta", "aprobada", "rechazada"] as const;
export type EstadoConsulta = (typeof ESTADO_CONSULTA)[number];

export const TIPO_PAGO = ["adelanto", "saldo"] as const;
export type TipoPago = (typeof TIPO_PAGO)[number];

export const METODO_PAGO = ["shopify", "link", "yape", "plin", "transferencia", "efectivo", "tarjeta"] as const;
export type MetodoPago = (typeof METODO_PAGO)[number];

export const ESTADO_PAGO = ["pendiente", "pagado", "fallido", "anulado"] as const;
export type EstadoPago = (typeof ESTADO_PAGO)[number];

export const ESTADO_OC = [
  "borrador",
  "enviada",
  "recibida_parcial",
  "recibida",
  "anulada",
] as const;
export type EstadoOc = (typeof ESTADO_OC)[number];

export const TIPO_IDENTIDAD = ["ruc", "dni", "ce"] as const;
export type TipoIdentidad = (typeof TIPO_IDENTIDAD)[number];
export const TIPO_IDENTIDAD_ETIQUETA: Record<TipoIdentidad, string> = {
  ruc: "RUC",
  dni: "DNI",
  ce: "Carnet de extranjería",
};
/** Formato de cada documento: RUC 11 dígitos, DNI 8 dígitos, CE 9 a 12 letras o dígitos. */
export const FORMATO_IDENTIDAD: Record<TipoIdentidad, { regex: RegExp; mensaje: string }> = {
  ruc: { regex: /^\d{11}$/, mensaje: "El RUC tiene 11 dígitos" },
  dni: { regex: /^\d{8}$/, mensaje: "El DNI tiene 8 dígitos" },
  ce: { regex: /^[A-Za-z0-9]{9,12}$/, mensaje: "El carnet de extranjería tiene de 9 a 12 letras o dígitos" },
};

/** Fotos del arreglo terminado: mínimo para pasar a en_camino y máximo por pedido. */
export const FOTOS_PEDIDO = { min: 1, max: 3 } as const;
