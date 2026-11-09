import { describe, expect, it } from "vitest";
import {
  calcularSaldo,
  cantidadEnUnidadBase,
  compraSugerida,
  costoPromedioPonderado,
  costoUnitarioCompra,
  estadoOrdenTrasRecepcion,
  validarDespacho,
  validarEntrega,
} from "./operacion-reglas";

describe("recepción de compra", () => {
  it("2 paquetes × 50 hojas suman 100 hojas y recalculan el costo promedio (spec fase 5)", () => {
    const cantidad = cantidadEnUnidadBase(2, 50);
    expect(cantidad).toBe(100);
    const costoUnit = costoUnitarioCompra(120, cantidad); // S/ 120 por los 2 paquetes
    expect(costoUnit).toBe(1.2);
    // stock previo 340 hojas a 0.90 → (340×0.9 + 100×1.2) / 440
    expect(costoPromedioPonderado({ stockActual: 340, costoPromedio: 0.9, cantidad, costoUnitario: costoUnit })).toBe(
      0.9682,
    );
  });

  it("con stock 0 el costo promedio es el de la compra", () => {
    expect(costoPromedioPonderado({ stockActual: 0, costoPromedio: 5, cantidad: 10, costoUnitario: 2 })).toBe(2);
  });

  it("un stock negativo se trata como 0", () => {
    expect(costoPromedioPonderado({ stockActual: -3, costoPromedio: 5, cantidad: 10, costoUnitario: 2 })).toBe(2);
  });

  it("estado de la orden según lo recibido", () => {
    expect(estadoOrdenTrasRecepcion([{ cantidadBase: 100, cantidadRecibida: 0 }])).toBe("enviada");
    expect(estadoOrdenTrasRecepcion([{ cantidadBase: 100, cantidadRecibida: 40 }])).toBe("recibida_parcial");
    expect(
      estadoOrdenTrasRecepcion([
        { cantidadBase: 100, cantidadRecibida: 100 },
        { cantidadBase: 5, cantidadRecibida: 6 },
      ]),
    ).toBe("recibida");
  });
});

describe("compraSugerida", () => {
  it("redondea hacia arriba lo que falta para cubrir mínimo + reservado + demanda", () => {
    expect(compraSugerida({ stockMinimo: 150, reservado: 24, demanda: 10.2, stockActual: 30 })).toBe(155);
  });
  it("nunca es negativa", () => {
    expect(compraSugerida({ stockMinimo: 10, reservado: 0, demanda: 0, stockActual: 500 })).toBe(0);
  });
});

describe("saldo, despacho y entrega", () => {
  it("saldo = total − pagado, mínimo 0", () => {
    expect(calcularSaldo(149, 74.5)).toBe(74.5);
    expect(calcularSaldo(100, 120)).toBe(0);
  });

  it("no se puede despachar con saldo sin antes generar el link (spec fase 5)", () => {
    expect(validarDespacho({ saldo: 50, linkSaldoGenerado: false }).ok).toBe(false);
    expect(validarDespacho({ saldo: 50, linkSaldoGenerado: true }).ok).toBe(true);
    expect(validarDespacho({ saldo: 0, linkSaldoGenerado: false }).ok).toBe(true);
  });

  it("entregar con saldo depende de la configuración y deja advertencia", () => {
    expect(validarEntrega({ saldo: 20, permitirConSaldo: false }).ok).toBe(false);
    const r = validarEntrega({ saldo: 20, permitirConSaldo: true });
    expect(r).toMatchObject({ ok: true, advertencia: expect.stringContaining("20.00") });
    expect(validarEntrega({ saldo: 0, permitirConSaldo: false })).toEqual({ ok: true });
  });
});
