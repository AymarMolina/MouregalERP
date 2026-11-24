import { describe, expect, it } from "vitest";
import { calcularDisponible, calcularEnvio, calcularPrecio, calcularVehiculo, recetaEfectiva, totalPedido, validarDescuento } from "./pricing";

describe("recetaEfectiva", () => {
  const lineasBase = [
    { insumoId: "flor-roja", cantidad: 12, rol: "flor_principal" as const },
    { insumoId: "eucalipto", cantidad: 60, rol: "otro" as const },
    { insumoId: "papel-kraft", cantidad: 4, rol: "papel" as const },
  ];

  it("reemplaza la flor principal por la elegida y escala por cantidad", () => {
    const r = recetaEfectiva({
      lineasBase,
      florId: "flor-blanca",
      usaPapel: true,
      papelId: null,
      extraInsumoIds: [],
      cantidad: 2,
    });
    expect(r).toContainEqual({ insumoId: "flor-blanca", cantidad: 24 });
    expect(r).toContainEqual({ insumoId: "eucalipto", cantidad: 120 });
    expect(r).toContainEqual({ insumoId: "papel-kraft", cantidad: 8 });
    expect(r.find((l) => l.insumoId === "flor-roja")).toBeUndefined();
  });

  it("suma los adicionales del inventario (mezcla de flores) por unidad del ítem", () => {
    const r = recetaEfectiva({
      lineasBase,
      florId: "flor-roja",
      usaPapel: true,
      papelId: null,
      extraInsumoIds: [],
      adicionalesInsumo: [
        { insumoId: "girasol", cantidad: 3 },
        { insumoId: "flor-roja", cantidad: 2 },
      ],
      cantidad: 2,
    });
    expect(r).toContainEqual({ insumoId: "girasol", cantidad: 6 });
    expect(r).toContainEqual({ insumoId: "flor-roja", cantidad: 28 });
  });

  it("reemplaza el papel cuando se especifica uno distinto", () => {
    const r = recetaEfectiva({
      lineasBase,
      florId: "flor-roja",
      usaPapel: true,
      papelId: "papel-negro",
      extraInsumoIds: [],
      cantidad: 1,
    });
    expect(r).toContainEqual({ insumoId: "papel-negro", cantidad: 4 });
  });

  it("omite la línea de papel cuando el producto no usa papel", () => {
    const r = recetaEfectiva({
      lineasBase,
      florId: "flor-roja",
      usaPapel: false,
      papelId: null,
      extraInsumoIds: [],
      cantidad: 1,
    });
    expect(r.some((l) => l.insumoId === "papel-kraft")).toBe(false);
  });

  it("agrega 1 unidad por cada extra, multiplicada por la cantidad", () => {
    const r = recetaEfectiva({
      lineasBase,
      florId: "flor-roja",
      usaPapel: true,
      papelId: null,
      extraInsumoIds: ["caja-redonda", "peluche-s"],
      cantidad: 3,
    });
    expect(r).toContainEqual({ insumoId: "caja-redonda", cantidad: 3 });
    expect(r).toContainEqual({ insumoId: "peluche-s", cantidad: 3 });
  });
});

describe("calcularPrecio", () => {
  it("suma precio base, ajustes y extras, y calcula el subtotal", () => {
    const r = calcularPrecio({
      precioBase: 89,
      ajustes: [{ descripcion: "flor blanca", ajuste: 6 }],
      extrasPrecio: [35],
      cantidad: 2,
    });
    expect(r.precioUnitario).toBe(130);
    expect(r.subtotal).toBe(260);
  });

  it("redondea a 2 decimales", () => {
    const r = calcularPrecio({ precioBase: 10.005, ajustes: [], extrasPrecio: [], cantidad: 1 });
    expect(r.precioUnitario).toBe(10.01);
  });
});

describe("calcularVehiculo", () => {
  const base = { recetaEfectiva: [], insumosCaja: new Set<string>(), algunExtraFuerzaCarro: false };

  it("es carro si la talla es L", () => {
    expect(calcularVehiculo({ ...base, talla: "L" })).toBe("carro");
  });

  it("es moto si la talla es S o M sin cajas ni extras que fuercen carro", () => {
    expect(calcularVehiculo({ ...base, talla: "S" })).toBe("moto");
    expect(calcularVehiculo({ ...base, talla: "M" })).toBe("moto");
  });

  it("es carro si la receta efectiva incluye un insumo de caja", () => {
    expect(
      calcularVehiculo({
        ...base,
        talla: "M",
        recetaEfectiva: [{ insumoId: "caja-redonda", cantidad: 1 }],
        insumosCaja: new Set(["caja-redonda"]),
      }),
    ).toBe("carro");
  });

  it("es carro si algún extra fuerza carro", () => {
    expect(calcularVehiculo({ ...base, talla: "S", algunExtraFuerzaCarro: true })).toBe("carro");
  });
});

describe("calcularEnvio", () => {
  it("usa la tarifa del vehículo correspondiente", () => {
    const distrito = { tarifaMoto: 12, tarifaCarro: 20 };
    expect(calcularEnvio("moto", distrito)).toBe(12);
    expect(calcularEnvio("carro", distrito)).toBe(20);
  });
});

describe("calcularDisponible", () => {
  it("resta lo reservado del stock actual", () => {
    expect(calcularDisponible(480, 50)).toBe(430);
    expect(calcularDisponible(10, 15)).toBe(-5);
  });
});

describe("validarDescuento y totalPedido", () => {
  it("la vendedora descuenta hasta el 10 % de los productos", () => {
    expect(validarDescuento({ descuento: 18.4, subtotalProductos: 184, rol: "vendedora" }).ok).toBe(true);
    expect(validarDescuento({ descuento: 20, subtotalProductos: 184, rol: "vendedora" }).ok).toBe(false);
  });

  it("el admin no tiene tope, pero no puede pasar del subtotal", () => {
    expect(validarDescuento({ descuento: 100, subtotalProductos: 184, rol: "admin" }).ok).toBe(true);
    expect(validarDescuento({ descuento: 200, subtotalProductos: 184, rol: "admin" }).ok).toBe(false);
  });

  it("total = productos − descuento + envío", () => {
    expect(totalPedido({ subtotalProductos: 184, descuento: 10, costoEnvio: 12 })).toBe(186);
    expect(totalPedido({ subtotalProductos: 89, descuento: 0, costoEnvio: 0 })).toBe(89);
  });
});
