import { BadRequestException, ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PedidoEntrada as PedidoInput } from '@erp/shared';
import * as schema from '../db/schema';
import { crearEntornoDePrueba, type EntornoDePrueba } from './db-test';

jest.setTimeout(60_000);

/** Pedido base: Ramo Clásico a Miraflores (moto 12 / carro 20). */
async function pedidoBase(
  e: EntornoDePrueba,
  item: Partial<PedidoInput['items'][number]> & { talla: 'S' | 'M' | 'L' },
  extra: Partial<PedidoInput> = {},
): Promise<PedidoInput> {
  const rosaRoja = await e.insumo('ROS-ROJ');
  return {
    canal: 'vendedora',
    cliente: { nombre: 'Ana', telefono: '999111222' },
    items: [
      {
        productoId: await e.productoId('ramo-clasico-de-rosas'),
        cantidad: 1,
        florId: rosaRoja.id,
        extraIds: [],
        ...item,
      },
    ],
    fechaEntrega: '2026-11-10',
    horaEntrega: '10:00',
    distritoId: await e.distritoId('Miraflores'),
    direccion: 'Av. Larco 123',
    telefonoReceptor: '988777666',
    nombreReceptor: 'Luis',
    porcentajeAdelanto: 50,
    ...extra,
  };
}

describe('Flujo de pedido (integración, Postgres en memoria)', () => {
  let e: EntornoDePrueba;
  const actor = (rol: 'admin' | 'vendedora' | 'produccion' | 'delivery') => ({
    sub: e.usuarios[rol],
    rol,
  });

  beforeEach(async () => {
    e = await crearEntornoDePrueba();
  });
  afterEach(async () => {
    await e.cerrar();
  });

  it('Ramo Clásico L con rosa roja → carro; el total del servidor coincide con la cotización', async () => {
    const input = await pedidoBase(e, { talla: 'L' });
    const cot = await e.cotizaciones.cotizarPedido({
      items: input.items.map((i) => ({ cantidad: 1, extraIds: [], ...i })),
      distritoId: input.distritoId,
    });
    const pedido = await e.pedidos.crear(input, actor('vendedora'));

    expect(pedido.vehiculo).toBe('carro');
    expect(Number(pedido.costoEnvio)).toBe(20);
    expect(Number(pedido.total)).toBe(289 + 20);
    expect(cot.total).toBe(Number(pedido.total));
    expect(cot.vehiculo).toBe('carro');

    const pagos = await e.pagos.listPorPedido(pedido.id);
    expect(pagos).toHaveLength(1);
    expect(Number(pagos[0].monto)).toBe(154.5);
    expect(pagos[0].linkUrl).toContain(pagos[0].id);
  });

  it('opción deshabilitada y pedido rechazado cuando el disponible no alcanza', async () => {
    // Rosa blanca: apertura 30 tallos. Un ramo M lleva 24 → dos ramos no caben.
    const rosaBlanca = await e.insumo('ROS-BLA');
    const productoId = await e.productoId('ramo-clasico-de-rosas');
    const distritoId = await e.distritoId('Miraflores');

    const cot = await e.cotizaciones.cotizar({
      productoId,
      talla: 'M',
      cantidad: 2,
      extraIds: [],
      distritoId,
      itemsEnCarrito: [],
    });
    const opcion = cot.opciones.flores.find(
      (f) => f.insumoId === rosaBlanca.id,
    );
    expect(opcion?.disponible).toBe(false);
    expect(opcion?.motivo).toContain('Rosa blanca');

    const input = await pedidoBase(e, {
      talla: 'M',
      cantidad: 2,
      florId: rosaBlanca.id,
    });
    await expect(
      e.pedidos.crear(input, actor('vendedora')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el stock reservado por un pedido pendiente reduce lo disponible para el siguiente', async () => {
    const rosaBlanca = await e.insumo('ROS-BLA');
    // 24 de 30 rosas blancas reservadas...
    await e.pedidos.crear(
      await pedidoBase(e, { talla: 'M', florId: rosaBlanca.id }),
      actor('vendedora'),
    );
    // ...un ramo S con 12 más ya no cabe.
    await expect(
      e.pedidos.crear(
        await pedidoBase(e, { talla: 'S', florId: rosaBlanca.id }),
        actor('vendedora'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('receta 50, usado 53 → consumo 50 + merma 3; stock baja 53 y el Kardex muestra el saldo (spec fase 4)', async () => {
    const rosaRoja = await e.insumo('ROS-ROJ');
    const stockInicial = Number(rosaRoja.stockActual);
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, { talla: 'L' }),
      actor('vendedora'),
    );

    await e.pedidos.asignar(pedido.id, { encargadaId: e.usuarios.produccion });
    await e.pedidos.transicion(
      pedido.id,
      'en_armado',
      undefined,
      actor('produccion'),
    );

    const receta = await e.pedidos.recetaEfectivaDelPedido(pedido.id);
    expect(receta.find((l) => l.insumoId === rosaRoja.id)?.cantidad).toBe(50);

    const listo = await e.pedidos.confirmarConsumo(
      pedido.id,
      { lineas: [{ insumoId: rosaRoja.id, cantidadUsada: 53 }] },
      e.usuarios.produccion,
    );
    expect(listo.estado).toBe('listo');

    const despues = await e.insumo('ROS-ROJ');
    expect(Number(despues.stockActual)).toBe(stockInicial - 53);

    const movs = await e.db
      .select()
      .from(schema.kardexMovimientos)
      .where(
        and(
          eq(schema.kardexMovimientos.insumoId, rosaRoja.id),
          eq(schema.kardexMovimientos.referenciaId, pedido.id),
        ),
      );
    const consumo = movs.find((m) => m.tipo === 'consumo');
    const merma = movs.find((m) => m.tipo === 'merma');
    expect(Number(consumo?.salida)).toBe(50);
    expect(Number(merma?.salida)).toBe(3);
    expect(Number(merma?.saldoResultante)).toBe(stockInicial - 53);
    expect(Number(merma?.costoUnitario)).toBe(1.8);

    // Reportes: la merma de producción y el margen real (costo = 53 rosas + resto de la receta).
    const reporteMerma = await e.reportes.merma({
      desde: '2000-01-01',
      hasta: '2100-01-01',
    });
    const fila = reporteMerma.filas.find((f) => f.codigo === 'ROS-ROJ');
    expect(fila?.cantidadProduccion).toBe(3);
    expect(fila?.valorProduccion).toBe(5.4);
    // Margen cuenta el día en que el pedido se armó (hoy), no su fecha de
    // entrega programada.
    const hoyLima = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
    });
    const margen = await e.reportes.margen({ desde: hoyLima, hasta: hoyLima });
    expect(margen.filas[0]).toMatchObject({
      producto: 'Ramo Clásico de Rosas',
      talla: 'L',
      ingresos: 289,
    });
    expect(margen.filas[0].costo).toBeGreaterThan(53 * 1.8);

    // Confirmar otra vez no vuelve a descontar.
    await expect(
      e.pedidos.confirmarConsumo(
        pedido.id,
        { lineas: [] as never },
        e.usuarios.produccion,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(Number((await e.insumo('ROS-ROJ')).stockActual)).toBe(
      stockInicial - 53,
    );
  });

  it('no se despacha con saldo sin link; "despachar" lo genera; el pago cierra el saldo (spec fase 5)', async () => {
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, { talla: 'S' }),
      actor('vendedora'),
    );
    await e.pedidos.asignar(pedido.id, { encargadaId: e.usuarios.produccion });
    await e.pedidos.transicion(
      pedido.id,
      'en_armado',
      undefined,
      actor('produccion'),
    );
    await e.pedidos.confirmarConsumo(
      pedido.id,
      { lineas: [] as never },
      e.usuarios.produccion,
    );

    await expect(
      e.pedidos.despachar(pedido.id, {}, actor('delivery')),
    ).rejects.toThrow(/foto/);
    await e.subirFoto(pedido.id);

    await expect(
      e.pedidos.transicion(
        pedido.id,
        'en_camino',
        undefined,
        actor('delivery'),
      ),
    ).rejects.toThrow(/link del saldo/);

    const enCamino = await e.pedidos.despachar(
      pedido.id,
      {},
      actor('delivery'),
    );
    expect(enCamino.estado).toBe('en_camino');
    expect(enCamino.repartidorId).toBe(e.usuarios.delivery);

    const pagos = await e.pagos.listPorPedido(pedido.id);
    expect(pagos.find((p) => p.tipo === 'adelanto')?.estado).toBe('anulado');
    const link = pagos.find(
      (p) => p.tipo === 'saldo' && p.estado === 'pendiente',
    );
    expect(Number(link?.monto)).toBe(Number(pedido.total));
    expect(
      e.notificaciones.enviadas.some(
        (n) => n.evento === 'link_pago' && n.pedidoId === pedido.id,
      ),
    ).toBe(true);

    // Sin pagar no se entrega (configuración por defecto).
    await expect(
      e.pedidos.transicion(
        pedido.id,
        'entregado',
        undefined,
        actor('delivery'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await e.pagos.confirmar(link!.id, { referenciaExterna: 'OP-123' });
    const pagado = await e.pedidos.findOne(pedido.id);
    expect(Number(pagado.totalPagado)).toBe(Number(pedido.total));

    const entregado = await e.pedidos.transicion(
      pedido.id,
      'entregado',
      undefined,
      actor('delivery'),
    );
    expect(entregado.estado).toBe('entregado');
  });

  it('pago manual: no puede exceder el saldo y actualiza total_pagado', async () => {
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, { talla: 'S' }),
      actor('vendedora'),
    );
    const total = Number(pedido.total);
    await expect(
      e.pagos.registrarManual(pedido.id, {
        tipo: 'adelanto',
        metodo: 'yape',
        monto: total + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await e.pagos.registrarManual(pedido.id, {
      tipo: 'adelanto',
      metodo: 'yape',
      monto: 50,
    });
    expect(Number((await e.pedidos.findOne(pedido.id)).totalPagado)).toBe(50);
  });

  it('un cambio no listado abre consulta, bloquea el armado y el ajuste aprobado cambia el total', async () => {
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, {
        talla: 'S',
        cambioNoListado: 'Agregar lazo dorado',
      }),
      actor('vendedora'),
    );
    await e.pedidos.asignar(pedido.id, { encargadaId: e.usuarios.produccion });
    await expect(
      e.pedidos.transicion(
        pedido.id,
        'en_armado',
        undefined,
        actor('produccion'),
      ),
    ).rejects.toThrow(/consulta abierta/);

    const [consulta] = await e.consultas.list('abierta');
    expect(consulta.descripcion).toBe('Agregar lazo dorado');
    await e.consultas.resolver(
      consulta.id,
      {
        estado: 'aprobada',
        respuesta: 'Ok, +10 por el lazo',
        ajustePrecio: 10,
      },
      e.usuarios.produccion,
    );
    await expect(
      e.consultas.resolver(
        consulta.id,
        { estado: 'rechazada', respuesta: 'x' },
        e.usuarios.produccion,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const actualizado = await e.pedidos.findOne(pedido.id);
    expect(Number(actualizado.total)).toBe(Number(pedido.total) + 10);
    const [adelanto] = await e.pagos.listPorPedido(pedido.id);
    expect(Number(adelanto.monto)).toBe(
      Math.round(Number(actualizado.total) * 50) / 100,
    );

    const armado = await e.pedidos.transicion(
      pedido.id,
      'en_armado',
      undefined,
      actor('produccion'),
    );
    expect(armado.estado).toBe('en_armado');
  });

  it('permisos por transición: delivery no cancela, la vendedora no cancela un pedido listo', async () => {
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, { talla: 'S' }),
      actor('vendedora'),
    );
    await expect(
      e.pedidos.transicion(
        pedido.id,
        'cancelado',
        undefined,
        actor('delivery'),
      ),
    ).rejects.toThrow(/no puede/);

    await e.pedidos.asignar(pedido.id, { encargadaId: e.usuarios.produccion });
    await e.pedidos.transicion(
      pedido.id,
      'en_armado',
      undefined,
      actor('produccion'),
    );
    await e.pedidos.confirmarConsumo(
      pedido.id,
      { lineas: [] as never },
      e.usuarios.produccion,
    );
    await expect(
      e.pedidos.transicion(
        pedido.id,
        'cancelado',
        undefined,
        actor('vendedora'),
      ),
    ).rejects.toThrow(/Solo un admin/);

    const cancelado = await e.pedidos.transicion(
      pedido.id,
      'cancelado',
      undefined,
      actor('admin'),
    );
    expect(cancelado.estado).toBe('cancelado');
    const pagos = await e.pagos.listPorPedido(pedido.id);
    expect(pagos.every((p) => p.estado !== 'pendiente')).toBe(true);
  });

  it('Box de Lirios (caja) sale en carro aunque sea talla S', async () => {
    const lirio = await e.insumo('LIR-BLA');
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, {
        talla: 'S',
        productoId: await e.productoId('box-de-lirios'),
        florId: lirio.id,
      }),
      actor('vendedora'),
    );
    expect(pedido.vehiculo).toBe('carro');
  });
});

describe('Compras (integración)', () => {
  let e: EntornoDePrueba;
  beforeEach(async () => {
    e = await crearEntornoDePrueba();
  });
  afterEach(async () => {
    await e.cerrar();
  });

  it('recepción de 2 paquetes × 50 hojas suma 100 hojas y recalcula el costo promedio (spec fase 5)', async () => {
    const papelNegro = await e.insumo('PAP-NEG'); // apertura 60 hojas a 1.10
    const proveedor = await e.compras.crearProveedor({
      nombre: 'Papelera Lima',
      tipoIdentidad: 'ruc',
      numIdentidad: '20123456789',
    });
    const orden = await e.compras.crearOrden({
      proveedorId: proveedor.id,
      lineas: [
        {
          insumoId: papelNegro.id,
          paquetes: 4,
          unidadesPorPaquete: 50,
          costoTotal: 240,
        },
      ],
    });
    expect(orden.estado).toBe('borrador');
    expect(Number(orden.lineas[0].cantidadBase)).toBe(200);

    await expect(
      e.compras.recepcion(
        orden.id,
        {
          lineas: [
            {
              lineaId: orden.lineas[0].id,
              paquetes: 2,
              unidadesPorPaquete: 50,
              costoTotal: 120,
            },
          ],
        },
        e.usuarios.almacen,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await e.compras.actualizarOrden(orden.id, { estado: 'enviada' });
    const parcial = await e.compras.recepcion(
      orden.id,
      {
        lineas: [
          {
            lineaId: orden.lineas[0].id,
            paquetes: 2,
            unidadesPorPaquete: 50,
            costoTotal: 120,
          },
        ],
      },
      e.usuarios.almacen,
    );
    expect(parcial.estado).toBe('recibida_parcial');
    expect(Number(parcial.lineas[0].cantidadRecibida)).toBe(100);

    const despues = await e.insumo('PAP-NEG');
    expect(Number(despues.stockActual)).toBe(160);
    // (60 × 1.10 + 100 × 1.20) / 160 = 1.1625
    expect(Number(despues.costoPromedio)).toBe(1.1625);

    const completa = await e.compras.recepcion(
      orden.id,
      {
        lineas: [
          {
            lineaId: orden.lineas[0].id,
            paquetes: 2,
            unidadesPorPaquete: 50,
            costoTotal: 120,
          },
        ],
      },
      e.usuarios.almacen,
    );
    expect(completa.estado).toBe('recibida');
  });

  it('compras sugeridas: cubre mínimo + reservado − stock y descuenta lo pedido en órdenes abiertas', async () => {
    const sugeridas = await e.compras.sugeridas(3);
    const rosaBlanca = sugeridas.find((s) => s.codigo === 'ROS-BLA')!;
    // mínimo 150, stock 30, sin reservas ni consumo → 120
    expect(rosaBlanca.sugerido).toBe(120);

    const proveedor = await e.compras.crearProveedor({
      nombre: 'Vivero',
      tipoIdentidad: 'dni',
      numIdentidad: '12345678',
    });
    await e.compras.crearOrden({
      proveedorId: proveedor.id,
      lineas: [
        {
          insumoId: rosaBlanca.insumoId,
          paquetes: 4,
          unidadesPorPaquete: 25,
          costoTotal: 200,
        },
      ],
    });
    const otra = (await e.compras.sugeridas(3)).find(
      (s) => s.codigo === 'ROS-BLA',
    )!;
    expect(otra.pendienteEnOrdenes).toBe(100);
    expect(otra.aComprar).toBe(20);
  });
});

describe('Venta en tienda: recojo, cobro en el momento y descuento', () => {
  let e: EntornoDePrueba;
  const actor = (rol: 'admin' | 'vendedora' | 'produccion' | 'delivery') => ({
    sub: e.usuarios[rol],
    rol,
  });
  beforeEach(async () => {
    e = await crearEntornoDePrueba();
  });
  afterEach(async () => {
    await e.cerrar();
  });

  /** Cliente de mostrador: sin distrito, dirección ni receptor. */
  async function mostrador(
    extra: Partial<PedidoInput> = {},
  ): Promise<PedidoInput> {
    const rosaRoja = await e.insumo('ROS-ROJ');
    return {
      canal: 'vendedora',
      tipoEntrega: 'recojo',
      cliente: {},
      items: [
        {
          productoId: await e.productoId('ramo-clasico-de-rosas'),
          talla: 'S',
          florId: rosaRoja.id,
        },
      ],
      fechaEntrega: '2026-11-10',
      horaEntrega: '10:00',
      pagos: [{ metodo: 'efectivo', monto: 89 }],
      ...extra,
    };
  }

  it('se lo lleva y paga en efectivo: sin envío, pagado, y la vendedora lo entrega en el mostrador', async () => {
    const pedido = await e.pedidos.crear(await mostrador(), actor('vendedora'));
    expect(pedido).toMatchObject({
      tipoEntrega: 'recojo',
      distritoId: null,
      direccion: null,
      vehiculo: null,
      costoEnvio: '0.00',
      total: '89.00',
      totalPagado: '89.00',
    });
    const pagos = await e.pagos.listPorPedido(pedido.id);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({
      metodo: 'efectivo',
      estado: 'pagado',
      linkUrl: null,
    });

    const [cliente] = await e.db
      .select()
      .from(schema.clientes)
      .where(eq(schema.clientes.id, pedido.clienteId));
    expect(cliente.nombre).toBe('Cliente de mostrador');

    // Sin asignar: quien empieza a armar queda como encargada.
    const enArmado = await e.pedidos.transicion(
      pedido.id,
      'en_armado',
      undefined,
      actor('produccion'),
    );
    expect(enArmado.encargadaId).toBe(e.usuarios.produccion);
    await e.pedidos.confirmarConsumo(
      pedido.id,
      { lineas: [] as never },
      e.usuarios.produccion,
    );

    // No se despacha: se entrega en tienda, sin foto ni repartidor.
    await expect(
      e.pedidos.transicion(
        pedido.id,
        'en_camino',
        undefined,
        actor('vendedora'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const entregado = await e.pedidos.transicion(
      pedido.id,
      'entregado',
      undefined,
      actor('vendedora'),
    );
    expect(entregado.estado).toBe('entregado');

    // No aparece en el tablero de delivery.
    const tablero = await e.pedidos.tableroDelivery('2026-11-10');
    expect(tablero.pedidos.find((p) => p.id === pedido.id)).toBeUndefined();
  });

  it('recoge mañana: deja 50 % con tarjeta y paga el resto al recoger', async () => {
    const pedido = await e.pedidos.crear(
      await mostrador({
        cliente: { nombre: 'Rosa', telefono: '987654321' },
        pagos: [{ metodo: 'tarjeta', monto: 44.5, referencia: 'POS 0042' }],
      }),
      actor('vendedora'),
    );
    expect(Number(pedido.totalPagado)).toBe(44.5);
    // Mismo teléfono con otro nombre: se reconoce al cliente y se actualiza el nombre.
    const otra = await e.pedidos.crear(
      await mostrador({
        cliente: { nombre: 'Rosa Quispe', telefono: '987654321' },
      }),
      actor('vendedora'),
    );
    expect(otra.clienteId).toBe(pedido.clienteId);
    const [c] = await e.db
      .select()
      .from(schema.clientes)
      .where(eq(schema.clientes.id, otra.clienteId));
    expect(c.nombre).toBe('Rosa Quispe');

    const pago = await e.pagos.registrarManual(pedido.id, {
      metodo: 'yape',
      monto: 44.5,
    });
    expect(pago.tipo).toBe('saldo');
    const [actual] = await e.db
      .select()
      .from(schema.pedidos)
      .where(eq(schema.pedidos.id, pedido.id));
    expect(actual.totalPagado).toBe('89.00');
  });

  it('descuento: la vendedora hasta 10 % con motivo; más, solo el admin', async () => {
    await expect(
      e.pedidos.crear(await mostrador({ descuento: 20 }), actor('vendedora')),
    ).rejects.toThrow(/motivo/i);
    await expect(
      e.pedidos.crear(
        await mostrador({
          descuento: 20,
          motivoDescuento: 'Cliente frecuente',
        }),
        actor('vendedora'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const conDescuento = await e.pedidos.crear(
      await mostrador({
        descuento: 8.9,
        motivoDescuento: 'Cliente frecuente',
        pagos: [{ metodo: 'efectivo', monto: 80.1 }],
      }),
      actor('vendedora'),
    );
    expect(conDescuento).toMatchObject({
      descuento: '8.90',
      total: '80.10',
      totalPagado: '80.10',
    });

    const admin = await e.pedidos.crear(
      await mostrador({
        descuento: 20,
        motivoDescuento: 'Cortesía',
        pagos: [],
      }),
      actor('admin'),
    );
    expect(admin.total).toBe('69.00');
  });

  it('registrar a mano el adelanto anula el link pendiente (no se cobra dos veces)', async () => {
    const pedido = await e.pedidos.crear(
      await mostrador({ porcentajeAdelanto: 50, pagos: [] }),
      actor('vendedora'),
    );
    const [link] = await e.pagos.listPorPedido(pedido.id);
    expect(link).toMatchObject({ metodo: 'link', estado: 'pendiente' });

    await e.pagos.registrarManual(pedido.id, { metodo: 'yape', monto: 44.5 });
    const pagos = await e.pagos.listPorPedido(pedido.id);
    expect(pagos.find((p) => p.id === link.id)?.estado).toBe('anulado');
    expect(pagos.filter((p) => p.estado === 'pendiente')).toHaveLength(0);
  });

  it('paga un monto libre en dos métodos (10 efectivo + 20 Yape) y el resto también dividido', async () => {
    const pedido = await e.pedidos.crear(
      await mostrador({
        pagos: [
          { metodo: 'efectivo', monto: 10 },
          { metodo: 'yape', monto: 20, referencia: 'OP 123' },
        ],
      }),
      actor('vendedora'),
    );
    expect(pedido.totalPagado).toBe('30.00');
    const pagos = await e.pagos.listPorPedido(pedido.id);
    expect(pagos.map((p) => [p.metodo, p.monto, p.estado]).sort()).toEqual([
      ['efectivo', '10.00', 'pagado'],
      ['yape', '20.00', 'pagado'],
    ]);

    // El saldo (59) no puede pasarse, aunque venga repartido.
    await expect(
      e.pagos.registrarManual(pedido.id, {
        partes: [
          { metodo: 'efectivo', monto: 50 },
          { metodo: 'plin', monto: 10 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const saldo = await e.pagos.registrarManual(pedido.id, {
      partes: [
        { metodo: 'efectivo', monto: 9 },
        { metodo: 'plin', monto: 50 },
      ],
    });
    expect(saldo.tipo).toBe('saldo');
    const [actual] = await e.db
      .select()
      .from(schema.pedidos)
      .where(eq(schema.pedidos.id, pedido.id));
    expect(actual.totalPagado).toBe('89.00');
  });

  it('adelanto en soles (no en porcentaje) por link, y no se cobra más que el total', async () => {
    const pedido = await e.pedidos.crear(
      await mostrador({ pagos: [], montoAdelanto: 27.5 }),
      actor('vendedora'),
    );
    const [link] = await e.pagos.listPorPedido(pedido.id);
    expect(link).toMatchObject({
      metodo: 'link',
      monto: '27.50',
      estado: 'pendiente',
    });

    await expect(
      e.pedidos.crear(
        await mostrador({ pagos: [{ metodo: 'efectivo', monto: 100 }] }),
        actor('vendedora'),
      ),
    ).rejects.toThrow(/supera el total/);
  });

  it('adicional fuera de catálogo (una planta) suma a su precio y queda en la comanda', async () => {
    const rosaRoja = await e.insumo('ROS-ROJ');
    const pedido = await e.pedidos.crear(
      await mostrador({
        items: [
          {
            productoId: await e.productoId('ramo-clasico-de-rosas'),
            talla: 'S',
            florId: rosaRoja.id,
            adicionales: [{ descripcion: 'Suculenta en maceta', precio: 15 }],
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 104 }],
      }),
      actor('vendedora'),
    );
    expect(pedido.total).toBe('104.00');
    const cambios = await e.db.select().from(schema.pedidoItemCambios);
    expect(cambios).toEqual([
      expect.objectContaining({
        descripcion: 'Adicional: Suculenta en maceta',
        ajuste: '15.00',
        reglaId: null,
      }),
    ]);
    // Tiene precio: no abre consulta a Producción.
    const consultas = await e.db.select().from(schema.consultasProduccion);
    expect(consultas).toHaveLength(0);
  });

  it('adicional del inventario (3 girasoles en un ramo de rosas): reserva, valida y descuenta stock', async () => {
    const rosaRoja = await e.insumo('ROS-ROJ');
    const girasol = await e.insumo('GIR-AMA'); // 58 tallos de apertura
    const item = async (cantidad: number) => ({
      productoId: await e.productoId('ramo-clasico-de-rosas'),
      talla: 'S' as const,
      florId: rosaRoja.id,
      adicionales: [
        {
          descripcion: 'Girasoles',
          precio: 4 * cantidad,
          insumoId: girasol.id,
          cantidad,
        },
      ],
    });

    // Más de lo que hay: no se puede vender (igual que la receta).
    await expect(
      e.pedidos.crear(
        await mostrador({ items: [await item(60)], pagos: [] }),
        actor('vendedora'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const pedido = await e.pedidos.crear(
      await mostrador({
        items: [await item(3)],
        pagos: [{ metodo: 'efectivo', monto: 101 }],
      }),
      actor('vendedora'),
    );
    expect(pedido.total).toBe('101.00');
    const reservado = await e.disponibilidad.calcularReservados();
    expect(reservado.get(girasol.id)).toBe(3);

    await e.pedidos.transicion(
      pedido.id,
      'en_armado',
      undefined,
      actor('produccion'),
    );
    const receta = await e.pedidos.recetaEfectivaDelPedido(pedido.id);
    expect(receta.find((l) => l.insumoId === girasol.id)?.cantidad).toBe(3);
    await e.pedidos.confirmarConsumo(
      pedido.id,
      {
        lineas: receta.map((l) => ({
          insumoId: l.insumoId,
          cantidadUsada: l.cantidad,
        })),
      },
      e.usuarios.produccion,
    );
    const despues = await e.insumo('GIR-AMA');
    expect(Number(despues.stockActual)).toBe(55);
  });

  it('un delivery sigue exigiendo distrito, dirección y receptor', async () => {
    await expect(
      e.pedidos.crear(
        await mostrador({ tipoEntrega: 'delivery' }),
        actor('vendedora'),
      ),
    ).rejects.toThrow(/distrito/);
  });
});

describe('Dashboard /hoy (integración)', () => {
  let e: EntornoDePrueba;
  beforeEach(async () => {
    e = await crearEntornoDePrueba();
  });
  afterEach(async () => {
    await e.cerrar();
  });

  it('KPIs del día, serie de 14 días y pedidos por hora', async () => {
    const { DashboardService } =
      await import('../modules/dashboard/dashboard.service');
    const dashboard = new DashboardService(e.db);
    const hoy = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
    });

    const rosaRoja = await e.insumo('ROS-ROJ');
    await e.pedidos.crear(
      {
        canal: 'vendedora',
        cliente: { nombre: 'Ana', telefono: '999000111' },
        items: [
          {
            productoId: await e.productoId('ramo-clasico-de-rosas'),
            talla: 'S',
            cantidad: 1,
            florId: rosaRoja.id,
            extraIds: [],
          },
        ],
        fechaEntrega: hoy,
        horaEntrega: '11:30',
        distritoId: await e.distritoId('Miraflores'),
        direccion: 'Calle 1',
        telefonoReceptor: '911',
        nombreReceptor: 'Luis',
        porcentajeAdelanto: 50,
      },
      { sub: e.usuarios.vendedora, rol: 'vendedora' },
    );

    const d = await dashboard.hoy();
    expect(d.fecha).toBe(hoy);
    expect(d.kpis).toMatchObject({
      pedidosHoy: 1,
      ventasHoy: 101,
      ticketPromedio: 101,
      porCobrar: 101,
      pedidosConSaldo: 1,
      ventasVariacion: null, // sin pedidos la semana pasada no hay base de comparación
    });
    expect(d.serieVentas).toHaveLength(14);
    expect(d.serieVentas.at(-1)).toEqual({
      fecha: hoy,
      ventas: 101,
      pedidos: 1,
    });
    expect(d.pedidosPorHora.find((h) => h.hora === 11)?.pedidos).toBe(1);
    expect(d.stockBajo.map((s) => s.codigo)).toContain('ROS-BLA');
    expect(d.pedidos[0]).toMatchObject({
      distrito: 'Miraflores',
      cliente: 'Ana',
    });
  });
});
