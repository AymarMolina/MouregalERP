import { describe, expect, it } from "vitest";
import { desglosarConsumo, faltantes, repartirUsado, sumarRecetas, validarTransicion } from "./pedidos-reglas";

describe("validarTransicion", () => {
  it("producción pasa un pedido pendiente a en_armado", () => {
    expect(validarTransicion("produccion", "pendiente", "en_armado")).toEqual({ ok: true });
  });

  it("delivery no puede pasar a en_armado ni cancelar", () => {
    expect(validarTransicion("delivery", "pendiente", "en_armado").ok).toBe(false);
    expect(validarTransicion("delivery", "pendiente", "cancelado").ok).toBe(false);
  });

  it("delivery despacha y entrega", () => {
    expect(validarTransicion("delivery", "listo", "en_camino").ok).toBe(true);
    expect(validarTransicion("delivery", "en_camino", "entregado").ok).toBe(true);
  });

  it("la vendedora cancela solo antes de consumir inventario", () => {
    expect(validarTransicion("vendedora", "pendiente", "cancelado").ok).toBe(true);
    expect(validarTransicion("vendedora", "en_armado", "cancelado").ok).toBe(true);
    expect(validarTransicion("vendedora", "listo", "cancelado").ok).toBe(false);
    expect(validarTransicion("admin", "listo", "cancelado").ok).toBe(true);
  });

  it("rechaza saltos fuera del grafo, incluso para admin", () => {
    expect(validarTransicion("admin", "pendiente", "entregado").ok).toBe(false);
    expect(validarTransicion("admin", "en_armado", "listo").ok).toBe(false);
    expect(validarTransicion("admin", "entregado", "cancelado").ok).toBe(false);
  });

  it("almacén no transiciona pedidos", () => {
    expect(validarTransicion("almacen", "pendiente", "en_armado").ok).toBe(false);
  });
});

describe("desglosarConsumo", () => {
  it("receta 50, usado 53 → consumo 50 + merma 3", () => {
    expect(desglosarConsumo(50, 53)).toEqual({ consumo: 50, merma: 3 });
  });

  it("usado menor que la receta → solo consumo, sin merma", () => {
    expect(desglosarConsumo(50, 48)).toEqual({ consumo: 48, merma: 0 });
  });

  it("maneja decimales sin error de coma flotante", () => {
    expect(desglosarConsumo(1.5, 1.7)).toEqual({ consumo: 1.5, merma: 0.2 });
  });
});

describe("repartirUsado", () => {
  it("reparte proporcional a la receta y la suma es exacta", () => {
    const r = repartirUsado(
      [
        { id: "a", cantidadReceta: 1 },
        { id: "b", cantidadReceta: 1 },
        { id: "c", cantidadReceta: 1 },
      ],
      10,
    );
    expect(r.reduce((acc, x) => acc + x.usado, 0)).toBeCloseTo(10, 9);
    expect(r[0].usado).toBe(3.333);
  });

  it("un solo ítem recibe todo lo usado", () => {
    expect(repartirUsado([{ id: "a", cantidadReceta: 50 }], 53)).toEqual([{ id: "a", usado: 53 }]);
  });
});

describe("sumarRecetas / faltantes", () => {
  it("suma por insumo y detecta lo que no alcanza", () => {
    const total = sumarRecetas([
      [{ insumoId: "rosa", cantidad: 24 }],
      [
        { insumoId: "rosa", cantidad: 12 },
        { insumoId: "papel", cantidad: 4 },
      ],
    ]);
    expect(total).toContainEqual({ insumoId: "rosa", cantidad: 36 });
    const disp: Record<string, number> = { rosa: 30, papel: 10 };
    expect(faltantes(total, (id) => disp[id] ?? 0)).toEqual([{ insumoId: "rosa", necesario: 36, disponible: 30 }]);
  });

  it("no marca faltante cuando cabe justo", () => {
    expect(faltantes([{ insumoId: "x", cantidad: 5 }], () => 5)).toEqual([]);
  });
});
