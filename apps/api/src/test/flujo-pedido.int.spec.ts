import { BadRequestException, ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PedidoInput } from '@erp/shared';
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
      items: input.items,
      distritoId: input.distritoId,
    });
    const pedido = await e.pedidos.crear(input, e.usuarios.vendedora);

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
      e.pedidos.crear(input, e.usuarios.vendedora),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el stock reservado por un pedido pendiente reduce lo disponible para el siguiente', async () => {
    const rosaBlanca = await e.insumo('ROS-BLA');
    // 24 de 30 rosas blancas reservadas...
    await e.pedidos.crear(
      await pedidoBase(e, { talla: 'M', florId: rosaBlanca.id }),
      e.usuarios.vendedora,
    );
    // ...un ramo S con 12 más ya no cabe.
    await expect(
      e.pedidos.crear(
        await pedidoBase(e, { talla: 'S', florId: rosaBlanca.id }),
        e.usuarios.vendedora,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('receta 50, usado 53 → consumo 50 + merma 3; stock baja 53 y el Kardex muestra el saldo (spec fase 4)', async () => {
    const rosaRoja = await e.insumo('ROS-ROJ');
    const stockInicial = Number(rosaRoja.stockActual);
    const pedido = await e.pedidos.crear(
      await pedidoBase(e, { talla: 'L' }),
      e.usuarios.vendedora,
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
      e.usuarios.vendedora,
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
      e.usuarios.vendedora,
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
      e.usuarios.vendedora,
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
      e.usuarios.vendedora,
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
      e.usuarios.vendedora,
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

    const proveedor = await e.compras.crearProveedor({ nombre: 'Vivero' });
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
      e.usuarios.vendedora,
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
