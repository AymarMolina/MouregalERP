import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lt } from 'drizzle-orm';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { consultasProduccion, insumos, pedidos } from '../../db/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async hoy() {
    const hoy = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
    });

    const pedidosHoy = await this.db
      .select()
      .from(pedidos)
      .where(eq(pedidos.fechaEntrega, hoy))
      .orderBy(asc(pedidos.horaEntrega));

    const conteoPorEstado: Record<string, number> = {};
    for (const p of pedidosHoy) {
      conteoPorEstado[p.estado] = (conteoPorEstado[p.estado] ?? 0) + 1;
    }

    const consultasAbiertas = await this.db
      .select()
      .from(consultasProduccion)
      .where(eq(consultasProduccion.estado, 'abierta'));

    const stockBajo = await this.db
      .select()
      .from(insumos)
      .where(
        and(
          lt(insumos.stockActual, insumos.stockMinimo),
          eq(insumos.activo, true),
        ),
      );

    return {
      fecha: hoy,
      kpis: {
        pedidosHoy: pedidosHoy.length,
        totalHoy: pedidosHoy.reduce((acc, p) => acc + Number(p.total), 0),
        conteoPorEstado,
        consultasAbiertas: consultasAbiertas.length,
        stockBajo: stockBajo.length,
      },
      pedidosPorHora: pedidosHoy,
      consultasAbiertas,
      stockBajo,
    };
  }
}
