import type { EstadoOc } from "./enums";

/**
 * Sección 5.8 — costo promedio ponderado tras una entrada de compra:
 * (stock × costo_prom + cantidad × costo_unit) / (stock + cantidad).
 * Un stock negativo (descuadre) se trata como 0 para no distorsionar el costo.
 */
export function costoPromedioPonderado(params: {
  stockActual: number;
  costoPromedio: number;
  cantidad: number;
  costoUnitario: number;
}): number {
  const stock = Math.max(0, params.stockActual);
  const total = stock + params.cantidad;
  if (total <= 0) return round4(params.costoUnitario);
  return round4((stock * params.costoPromedio + params.cantidad * params.costoUnitario) / total);
}

/** Sección 5.10 — la recepción se registra en unidad base: paquetes × unidades por paquete. */
export function cantidadEnUnidadBase(paquetes: number, unidadesPorPaquete: number): number {
  return round3(paquetes * unidadesPorPaquete);
}

/** Costo unitario en unidad base de una línea de compra. */
export function costoUnitarioCompra(costoTotal: number, cantidadBase: number): number {
  return cantidadBase > 0 ? round4(costoTotal / cantidadBase) : 0;
}

/**
 * Sección 5.9 — sugerido = max(0, ceil(stock_mínimo + reservado + demanda − stock_actual)).
 */
export function compraSugerida(params: {
  stockMinimo: number;
  reservado: number;
  demanda: number;
  stockActual: number;
}): number {
  const faltante = params.stockMinimo + params.reservado + params.demanda - params.stockActual;
  return Math.max(0, Math.ceil(round3(faltante)));
}

/** Estado de la orden de compra según lo recibido en cada línea. */
export function estadoOrdenTrasRecepcion(lineas: { cantidadBase: number; cantidadRecibida: number }[]): EstadoOc {
  const algo = lineas.some((l) => l.cantidadRecibida > 0);
  const todo = lineas.every((l) => l.cantidadRecibida + 1e-9 >= l.cantidadBase);
  if (todo) return "recibida";
  return algo ? "recibida_parcial" : "enviada";
}

/** Sección 5.11 — saldo = total − total_pagado (nunca negativo). */
export function calcularSaldo(total: number, totalPagado: number): number {
  return Math.max(0, round2(total - totalPagado));
}

export type ResultadoRegla = { ok: true; advertencia?: string } | { ok: false; motivo: string };

/** Sección 5.6 — listo → en_camino: si hay saldo, primero debe existir el link del saldo. */
export function validarDespacho(params: { saldo: number; linkSaldoGenerado: boolean }): ResultadoRegla {
  if (params.saldo > 0 && !params.linkSaldoGenerado) {
    return {
      ok: false,
      motivo: `El pedido tiene saldo de S/ ${params.saldo.toFixed(2)}: genera y envía el link del saldo antes de despachar`,
    };
  }
  return { ok: true };
}

/**
 * Sección 5.6 — en_camino → entregado: con saldo pendiente se permite solo
 * si la configuración lo autoriza, y queda una advertencia en el historial.
 */
export function validarEntrega(params: { saldo: number; permitirConSaldo: boolean }): ResultadoRegla {
  if (params.saldo <= 0) return { ok: true };
  const texto = `Entregado con saldo pendiente de S/ ${params.saldo.toFixed(2)}`;
  return params.permitirConSaldo
    ? { ok: true, advertencia: texto }
    : { ok: false, motivo: `${texto}: cobra el saldo antes de marcar entregado` };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
