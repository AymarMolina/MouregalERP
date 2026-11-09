import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { EstadoPedido, RangoFechas } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import {
  costosVehiculo,
  distritos,
  insumos,
  clientes,
  kardexMovimientos,
  pagos,
  pedidoConsumos,
  pedidoHistorialEstado,
  pedidoItems,
  pedidos,
  productoTallas,
  productos,
} from '../../db/schema';

/** Estados en los que el pedido ya consumió inventario. */
const CONSUMIDOS: EstadoPedido[] = ['listo', 'en_camino', 'entregado'];

/** Inicio y fin del rango en hora de Lima (UTC-5 fijo). */
function limitesLima(r: RangoFechas) {
  return {
    desde: new Date(`${r.desde}T00:00:00-05:00`),
    hasta: new Date(`${r.hasta}T23:59:59.999-05:00`),
  };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

@Injectable()
export class ReportesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Pedidos que pasaron a `estadoNuevo` dentro del rango (hora de Lima) y
   * hoy están en `estadosActuales`. Los reportes usan la fecha real del hecho
   * (cuándo se armó, cuándo salió), no la fecha de entrega programada: un
   * pedido para el 19 que se arma y despacha hoy cuenta hoy.
   */
  private async pedidosConTransicion(
    r: RangoFechas,
    estadoNuevo: EstadoPedido,
    estadosActuales: EstadoPedido[],
  ): Promise<string[]> {
    const { desde, hasta } = limitesLima(r);
    const filas = await this.db
      .selectDistinct({ id: pedidoHistorialEstado.pedidoId })
      .from(pedidoHistorialEstado)
      .innerJoin(pedidos, eq(pedidoHistorialEstado.pedidoId, pedidos.id))
      .where(
        and(
          eq(pedidoHistorialEstado.estadoNuevo, estadoNuevo),
          gte(pedidoHistorialEstado.createdAt, desde),
          lte(pedidoHistorialEstado.createdAt, hasta),
          inArray(pedidos.estado, estadosActuales),
        ),
      );
    return filas.map((f) => f.id);
  }

  private async itemsDePedidos(pedidoIds: string[]) {
    if (!pedidoIds.length) return [];
    return this.db
      .select({
        itemId: pedidoItems.id,
        pedidoId: pedidoItems.pedidoId,
        cantidad: pedidoItems.cantidad,
        subtotal: pedidoItems.subtotal,
        productoId: productos.id,
        producto: productos.nombre,
        talla: productoTallas.talla,
      })
      .from(pedidoItems)
      .innerJoin(
        productoTallas,
        eq(pedidoItems.productoTallaId, productoTallas.id),
      )
      .innerJoin(productos, eq(productoTallas.productoId, productos.id))
      .where(inArray(pedidoItems.pedidoId, pedidoIds));
  }

  /**
   * Margen por producto y talla: precio cobrado vs costo real (lo usado
   * en producción, consumo + merma, valorizado al costo del Kardex).
   * Cuenta los pedidos que quedaron listos (se armaron) dentro del rango.
   */
  async margen(r: RangoFechas) {
    const items = await this.itemsDePedidos(
      await this.pedidosConTransicion(r, 'listo', CONSUMIDOS),
    );
    if (!items.length)
      return { rango: r, filas: [], totales: totalesMargen([]) };

    const consumos = await this.db
      .select({
        itemId: pedidoConsumos.pedidoItemId,
        insumoId: pedidoConsumos.insumoId,
        cantidadUsada: pedidoConsumos.cantidadUsada,
      })
      .from(pedidoConsumos)
      .where(
        inArray(
          pedidoConsumos.pedidoItemId,
          items.map((i) => i.itemId),
        ),
      );
    const movimientos = await this.db
      .select({
        pedidoId: kardexMovimientos.referenciaId,
        insumoId: kardexMovimientos.insumoId,
        costoUnitario: kardexMovimientos.costoUnitario,
      })
      .from(kardexMovimientos)
      .where(
        and(
          eq(kardexMovimientos.referenciaTipo, 'pedido'),
          eq(kardexMovimientos.tipo, 'consumo'),
          inArray(kardexMovimientos.referenciaId, [
            ...new Set(items.map((i) => i.pedidoId)),
          ]),
        ),
      );
    const costoUnit = new Map(
      movimientos.map((m) => [
        `${m.pedidoId}:${m.insumoId}`,
        Number(m.costoUnitario),
      ]),
    );
    const pedidoDeItem = new Map(items.map((i) => [i.itemId, i.pedidoId]));
    const costoPorItem = new Map<string, number>();
    for (const c of consumos) {
      const unit =
        costoUnit.get(`${pedidoDeItem.get(c.itemId)}:${c.insumoId}`) ?? 0;
      costoPorItem.set(
        c.itemId,
        (costoPorItem.get(c.itemId) ?? 0) + Number(c.cantidadUsada) * unit,
      );
    }

    const grupos = new Map<
      string,
      {
        producto: string;
        talla: string;
        unidades: number;
        ingresos: number;
        costo: number;
      }
    >();
    for (const i of items) {
      const k = `${i.productoId}:${i.talla}`;
      const g = grupos.get(k) ?? {
        producto: i.producto,
        talla: i.talla,
        unidades: 0,
        ingresos: 0,
        costo: 0,
      };
      g.unidades += i.cantidad;
      g.ingresos += Number(i.subtotal);
      g.costo += costoPorItem.get(i.itemId) ?? 0;
      grupos.set(k, g);
    }

    const filas = [...grupos.values()]
      .map((g) => ({
        ...g,
        ingresos: r2(g.ingresos),
        costo: r2(g.costo),
        margen: r2(g.ingresos - g.costo),
        margenPct:
          g.ingresos > 0 ? r2(((g.ingresos - g.costo) / g.ingresos) * 100) : 0,
      }))
      .sort((a, b) => b.margen - a.margen);
    return { rango: r, filas, totales: totalesMargen(filas) };
  }

  /**
   * Merma por insumo: lo registrado como merma en producción (usó más que
   * la receta) + lo consumido en pedidos que luego se cancelaron (5.6).
   */
  async merma(r: RangoFechas) {
    const { desde, hasta } = limitesLima(r);
    const movs = await this.db
      .select({
        insumoId: kardexMovimientos.insumoId,
        tipo: kardexMovimientos.tipo,
        salida: kardexMovimientos.salida,
        costoUnitario: kardexMovimientos.costoUnitario,
        referenciaId: kardexMovimientos.referenciaId,
        referenciaTipo: kardexMovimientos.referenciaTipo,
      })
      .from(kardexMovimientos)
      .where(
        and(
          inArray(kardexMovimientos.tipo, ['merma', 'consumo']),
          gte(kardexMovimientos.fecha, desde),
          lte(kardexMovimientos.fecha, hasta),
        ),
      );

    const pedidoIds = [
      ...new Set(
        movs
          .filter((m) => m.tipo === 'consumo' && m.referenciaTipo === 'pedido')
          .map((m) => m.referenciaId)
          .filter((id): id is string => !!id),
      ),
    ];
    const cancelados = new Set(
      pedidoIds.length
        ? (
            await this.db
              .select({ id: pedidos.id })
              .from(pedidos)
              .where(
                and(
                  inArray(pedidos.id, pedidoIds),
                  eq(pedidos.estado, 'cancelado'),
                ),
              )
          ).map((p) => p.id)
        : [],
    );

    const info = await this.db
      .select({
        id: insumos.id,
        codigo: insumos.codigo,
        nombre: insumos.nombre,
        unidadBase: insumos.unidadBase,
      })
      .from(insumos);
    const infoPorId = new Map(info.map((i) => [i.id, i]));

    const grupos = new Map<
      string,
      {
        cantidadProduccion: number;
        valorProduccion: number;
        cantidadCancelacion: number;
        valorCancelacion: number;
      }
    >();
    for (const m of movs) {
      const esMerma = m.tipo === 'merma';
      const esCancelacion =
        m.tipo === 'consumo' &&
        !!m.referenciaId &&
        cancelados.has(m.referenciaId);
      if (!esMerma && !esCancelacion) continue;
      const g = grupos.get(m.insumoId) ?? {
        cantidadProduccion: 0,
        valorProduccion: 0,
        cantidadCancelacion: 0,
        valorCancelacion: 0,
      };
      const cant = Number(m.salida);
      const valor = cant * Number(m.costoUnitario);
      if (esMerma) {
        g.cantidadProduccion += cant;
        g.valorProduccion += valor;
      } else {
        g.cantidadCancelacion += cant;
        g.valorCancelacion += valor;
      }
      grupos.set(m.insumoId, g);
    }

    const filas = [...grupos.entries()]
      .map(([insumoId, g]) => ({
        insumoId,
        codigo: infoPorId.get(insumoId)?.codigo ?? '—',
        nombre: infoPorId.get(insumoId)?.nombre ?? '—',
        unidadBase: infoPorId.get(insumoId)?.unidadBase ?? '',
        cantidadProduccion: r3(g.cantidadProduccion),
        valorProduccion: r2(g.valorProduccion),
        cantidadCancelacion: r3(g.cantidadCancelacion),
        valorCancelacion: r2(g.valorCancelacion),
        valorTotal: r2(g.valorProduccion + g.valorCancelacion),
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal);

    return {
      rango: r,
      filas,
      totales: {
        valorProduccion: r2(filas.reduce((a, f) => a + f.valorProduccion, 0)),
        valorCancelacion: r2(filas.reduce((a, f) => a + f.valorCancelacion, 0)),
        valorTotal: r2(filas.reduce((a, f) => a + f.valorTotal, 0)),
      },
    };
  }

  /** Más vendidos por producto y talla: pedidos creados (vendidos) en el rango, sin cancelados. */
  async masVendidos(r: RangoFechas) {
    const { desde, hasta } = limitesLima(r);
    const vendidos = await this.db
      .select({ id: pedidos.id })
      .from(pedidos)
      .where(
        and(
          gte(pedidos.createdAt, desde),
          lte(pedidos.createdAt, hasta),
          inArray(pedidos.estado, [
            'pendiente',
            'en_armado',
            'listo',
            'en_camino',
            'entregado',
          ]),
        ),
      );
    const items = await this.itemsDePedidos(vendidos.map((v) => v.id));
    const grupos = new Map<
      string,
      {
        producto: string;
        talla: string;
        unidades: number;
        ingresos: number;
        pedidos: Set<string>;
      }
    >();
    for (const i of items) {
      const k = `${i.productoId}:${i.talla}`;
      const g = grupos.get(k) ?? {
        producto: i.producto,
        talla: i.talla,
        unidades: 0,
        ingresos: 0,
        pedidos: new Set<string>(),
      };
      g.unidades += i.cantidad;
      g.ingresos += Number(i.subtotal);
      g.pedidos.add(i.pedidoId);
      grupos.set(k, g);
    }
    return {
      rango: r,
      filas: [...grupos.values()]
        .map((g) => ({
          producto: g.producto,
          talla: g.talla,
          unidades: g.unidades,
          pedidos: g.pedidos.size,
          ingresos: r2(g.ingresos),
        }))
        .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos),
    };
  }

  /**
   * Envío cobrado vs costo por viaje, por vehículo y distrito.
   * Cuenta los pedidos que salieron a reparto (en camino) dentro del rango.
   */
  async envios(r: RangoFechas) {
    const salieron = await this.pedidosConTransicion(r, 'en_camino', [
      'en_camino',
      'entregado',
    ]);
    const [filas, costos] = await Promise.all([
      salieron.length
        ? this.db
            .select({
              vehiculo: pedidos.vehiculo,
              costoEnvio: pedidos.costoEnvio,
              distrito: distritos.nombre,
            })
            .from(pedidos)
            .innerJoin(distritos, eq(pedidos.distritoId, distritos.id))
            .where(inArray(pedidos.id, salieron))
        : Promise.resolve([]),
      this.db.select().from(costosVehiculo),
    ]);
    const costoViaje = new Map(
      costos.map((c) => [c.vehiculo, Number(c.costoPorViaje)]),
    );

    const grupos = new Map<
      string,
      {
        distrito: string;
        vehiculo: string;
        viajes: number;
        cobrado: number;
        costo: number;
      }
    >();
    for (const f of filas) {
      const k = `${f.distrito}:${f.vehiculo}`;
      const g = grupos.get(k) ?? {
        distrito: f.distrito,
        vehiculo: f.vehiculo,
        viajes: 0,
        cobrado: 0,
        costo: 0,
      };
      g.viajes += 1;
      g.cobrado += Number(f.costoEnvio);
      g.costo += costoViaje.get(f.vehiculo) ?? 0;
      grupos.set(k, g);
    }
    const lista = [...grupos.values()]
      .map((g) => ({
        ...g,
        cobrado: r2(g.cobrado),
        costo: r2(g.costo),
        diferencia: r2(g.cobrado - g.costo),
      }))
      .sort(
        (a, b) =>
          a.distrito.localeCompare(b.distrito) ||
          a.vehiculo.localeCompare(b.vehiculo),
      );
    return {
      rango: r,
      filas: lista,
      totales: {
        viajes: lista.reduce((a, f) => a + f.viajes, 0),
        cobrado: r2(lista.reduce((a, f) => a + f.cobrado, 0)),
        costo: r2(lista.reduce((a, f) => a + f.costo, 0)),
        diferencia: r2(lista.reduce((a, f) => a + f.diferencia, 0)),
      },
    };
  }

  /** Cobros confirmados (estado pagado) por fecha de pago: detalle y resumen por método. */
  async cobros(r: RangoFechas) {
    const { desde, hasta } = limitesLima(r);
    const filas = await this.db
      .select({
        pagoId: pagos.id,
        pagadoAt: pagos.pagadoAt,
        tipo: pagos.tipo,
        metodo: pagos.metodo,
        monto: pagos.monto,
        pedidoId: pedidos.id,
        numero: pedidos.numero,
        estadoPedido: pedidos.estado,
        cliente: clientes.nombre,
      })
      .from(pagos)
      .innerJoin(pedidos, eq(pagos.pedidoId, pedidos.id))
      .innerJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(
        and(
          eq(pagos.estado, 'pagado'),
          gte(pagos.pagadoAt, desde),
          lte(pagos.pagadoAt, hasta),
        ),
      )
      .orderBy(desc(pagos.pagadoAt));

    const detalle = filas.map((f) => ({
      ...f,
      pagadoAt: f.pagadoAt?.toISOString() ?? null,
      monto: r2(Number(f.monto)),
    }));
    const porMetodo = new Map<
      string,
      { metodo: string; cobros: number; monto: number }
    >();
    for (const f of detalle) {
      const g = porMetodo.get(f.metodo) ?? {
        metodo: f.metodo,
        cobros: 0,
        monto: 0,
      };
      g.cobros += 1;
      g.monto += f.monto;
      porMetodo.set(f.metodo, g);
    }
    return {
      rango: r,
      filas: detalle,
      porMetodo: [...porMetodo.values()]
        .map((g) => ({ ...g, monto: r2(g.monto) }))
        .sort((a, b) => b.monto - a.monto),
      totales: {
        cobros: detalle.length,
        monto: r2(detalle.reduce((a, f) => a + f.monto, 0)),
      },
    };
  }
}

function totalesMargen(filas: { ingresos: number; costo: number }[]) {
  const ingresos = r2(filas.reduce((a, f) => a + f.ingresos, 0));
  const costo = r2(filas.reduce((a, f) => a + f.costo, 0));
  return {
    ingresos,
    costo,
    margen: r2(ingresos - costo),
    margenPct: ingresos > 0 ? r2(((ingresos - costo) / ingresos) * 100) : 0,
  };
}
