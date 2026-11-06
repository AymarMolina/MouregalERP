// Enums de negocio (sección 4.1 del spec). Son la fuente única de verdad:
// se usan tanto para los pgEnum de Drizzle como para los z.enum de validación.

export const ROL_USUARIO = ["admin", "vendedora", "produccion", "almacen", "delivery"] as const;
export type RolUsuario = (typeof ROL_USUARIO)[number];

export const UNIDAD_BASE = ["tallo", "g", "hoja", "m", "und"] as const;
export type UnidadBase = (typeof UNIDAD_BASE)[number];

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

export const METODO_PAGO = ["shopify", "link", "yape", "plin", "transferencia", "efectivo"] as const;
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
