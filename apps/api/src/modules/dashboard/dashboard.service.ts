import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import {
  clientes,
  consultasProduccion,
  distritos,
  insumos,
  pedidos,
} from '../../db/schema';

/** Fecha AAAA-MM-DD en Lima desplazada `dias` respecto de `base`. */
function fechaLima(base: Date, dias = 0): string {
  return new Date(base.getTime() + dias * 86_400_000).toLocaleDateString(
    'en-CA',
    { timeZone: 'America/Lima' },
  );
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Variación porcentual; null si no hay base de comparación. */
function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return r2(((actual - anterior) / anterior) * 100);
}

/** Días de historia que muestra el gráfico de ventas. */
const DIAS_SERIE = 14;

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async hoy() {
    const ahora = new Date();
    const hoy = fechaLima(ahora);
    const semanaPasada = fechaLima(ahora, -7);
    const inicioSerie = fechaLima(ahora, -(DIAS_SERIE - 1));

    const pedidosHoy = await this.db
      .select({
        id: pedidos.id,
        numero: pedidos.numero,
        codigo: pedidos.codigo,
        estado: pedidos.estado,
        canal: pedidos.canal,
        horaEntrega: pedidos.horaEntrega,
        fechaEntrega: pedidos.fechaEntrega,
        nombreReceptor: pedidos.nombreReceptor,
        total: pedidos.total,
        totalPagado: pedidos.totalPagado,
        vehiculo: pedidos.vehiculo,
        tipoEntrega: pedidos.tipoEntrega,
        distrito: distritos.nombre,
        cliente: clientes.nombre,
      })
      .from(pedidos)
      .leftJoin(distritos, eq(pedidos.distritoId, distritos.id))
      .innerJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(eq(pedidos.fechaEntrega, hoy))
      .orderBy(asc(pedidos.horaEntrega));

    // Ventas por día de venta (created_at en Lima), sin cancelados: el mismo criterio
    // que Reportes, para que las dos pantallas den la misma cifra.
    const diaVenta = sql<string>`to_char(${pedidos.createdAt} at time zone 'America/Lima', 'YYYY-MM-DD')`;
    const inicio = inicioSerie > semanaPasada ? semanaPasada : inicioSerie;
    const [porDia, entregasSemanaPasada] = await Promise.all([
      this.db
        .select({
          fecha: diaVenta,
          pedidos: sql<number>`count(*)::int`,
          ventas: sql<string>`coalesce(sum(${pedidos.total}), 0)`,
        })
        .from(pedidos)
        .where(
          and(
            sql`${diaVenta} >= ${inicio}`,
            sql`${diaVenta} <= ${hoy}`,
            ne(pedidos.estado, 'cancelado'),
          ),
        )
        .groupBy(diaVenta),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(pedidos)
        .where(
          and(
            eq(pedidos.fechaEntrega, semanaPasada),
            ne(pedidos.estado, 'cancelado'),
          ),
        ),
    ]);
    const dia = new Map(
      porDia.map((d) => [
        d.fecha,
        { pedidos: d.pedidos, ventas: Number(d.ventas) },
      ]),
    );
    const vacio = { pedidos: 0, ventas: 0 };

    const serieVentas = Array.from({ length: DIAS_SERIE }, (_, i) => {
      const fecha = fechaLima(ahora, i - (DIAS_SERIE - 1));
      const d = dia.get(fecha) ?? vacio;
      return { fecha, ventas: r2(d.ventas), pedidos: d.pedidos };
    });

    const activosHoy = pedidosHoy.filter((p) => p.estado !== 'cancelado');
    const vendidoHoy = dia.get(hoy) ?? vacio;
    const ventasHoy = r2(vendidoHoy.ventas);
    const anterior = dia.get(semanaPasada) ?? vacio;
    const ticketHoy = vendidoHoy.pedidos
      ? r2(ventasHoy / vendidoHoy.pedidos)
      : 0;
    const ticketAnterior = anterior.pedidos
      ? r2(anterior.ventas / anterior.pedidos)
      : 0;

    // Saldo por cobrar de pedidos vivos (cualquier fecha).
    const [{ porCobrar, pedidosConSaldo }] = await this.db
      .select({
        porCobrar: sql<string>`coalesce(sum(${pedidos.total} - ${pedidos.totalPagado}), 0)`,
        pedidosConSaldo: sql<number>`count(*)::int`,
      })
      .from(pedidos)
      .where(
        and(
          ne(pedidos.estado, 'cancelado'),
          sql`${pedidos.total} > ${pedidos.totalPagado}`,
        ),
      );

    const conteoPorEstado: Record<string, number> = {};
    for (const p of pedidosHoy)
      conteoPorEstado[p.estado] = (conteoPorEstado[p.estado] ?? 0) + 1;

    // Pedidos de hoy por hora de entrega (franja 8:00–20:00, más lo que caiga fuera).
    const horas = new Map<number, number>();
    for (const p of activosHoy) {
      const h = Number(p.horaEntrega.slice(0, 2));
      horas.set(h, (horas.get(h) ?? 0) + 1);
    }
    const desde = Math.min(8, ...horas.keys());
    const hasta = Math.max(20, ...horas.keys());
    const pedidosPorHora = Array.from(
      { length: hasta - desde + 1 },
      (_, i) => ({
        hora: desde + i,
        pedidos: horas.get(desde + i) ?? 0,
      }),
    );

    // Atrasados: la fecha de entrega ya pasó y siguen sin entregar.
    const atrasados = await this.db
      .select({
        id: pedidos.id,
        codigo: pedidos.codigo,
        estado: pedidos.estado,
        fechaEntrega: pedidos.fechaEntrega,
        horaEntrega: pedidos.horaEntrega,
        tipoEntrega: pedidos.tipoEntrega,
        total: pedidos.total,
        totalPagado: pedidos.totalPagado,
        cliente: clientes.nombre,
        distrito: distritos.nombre,
      })
      .from(pedidos)
      .leftJoin(distritos, eq(pedidos.distritoId, distritos.id))
      .innerJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(
        and(
          lt(pedidos.fechaEntrega, hoy),
          inArray(pedidos.estado, [
            'pendiente',
            'en_armado',
            'listo',
            'en_camino',
          ]),
        ),
      )
      .orderBy(asc(pedidos.fechaEntrega), asc(pedidos.horaEntrega));

    const consultasAbiertas = await this.db
      .select({
        id: consultasProduccion.id,
        pedidoId: consultasProduccion.pedidoId,
        descripcion: consultasProduccion.descripcion,
        createdAt: consultasProduccion.createdAt,
        numero: pedidos.numero,
        codigo: pedidos.codigo,
      })
      .from(consultasProduccion)
      .innerJoin(pedidos, eq(consultasProduccion.pedidoId, pedidos.id))
      .where(eq(consultasProduccion.estado, 'abierta'))
      .orderBy(asc(consultasProduccion.createdAt));

    const stockBajo = await this.db
      .select({
        id: insumos.id,
        codigo: insumos.codigo,
        nombre: insumos.nombre,
        unidadBase: insumos.unidadBase,
        stockActual: insumos.stockActual,
        stockMinimo: insumos.stockMinimo,
      })
      .from(insumos)
      .where(
        and(
          lt(insumos.stockActual, insumos.stockMinimo),
          eq(insumos.activo, true),
        ),
      )
      .orderBy(
        asc(sql`${insumos.stockActual} / nullif(${insumos.stockMinimo}, 0)`),
      );

    return {
      fecha: hoy,
      comparadoCon: semanaPasada,
      kpis: {
        pedidosHoy: activosHoy.length,
        pedidosVariacion: variacion(
          activosHoy.length,
          entregasSemanaPasada[0]?.n ?? 0,
        ),
        ventasHoy,
        ventasVariacion: variacion(ventasHoy, anterior.ventas),
        ticketPromedio: ticketHoy,
        ticketVariacion: variacion(ticketHoy, ticketAnterior),
        porCobrar: r2(Number(porCobrar)),
        pedidosConSaldo,
        // Compatibilidad con la versión anterior del contrato.
        totalHoy: ventasHoy,
        conteoPorEstado,
        consultasAbiertas: consultasAbiertas.length,
        stockBajo: stockBajo.length,
      },
      serieVentas,
      pedidosPorHora,
      pedidos: pedidosHoy,
      atrasados,
      consultasAbiertas,
      stockBajo,
    };
  }
}
