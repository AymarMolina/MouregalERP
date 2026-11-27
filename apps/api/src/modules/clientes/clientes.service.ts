import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { clienteFechas, clientes, distritos, pedidos } from '../../db/schema';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pedidos que cuentan para el historial y la deuda (los cancelados no). */
const vigente = sql`${pedidos.estado} <> 'cancelado'`;

@Injectable()
export class ClientesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Lista con lo que hace falta para elegir: pedidos, gastado y deuda. */
  async list(q?: string) {
    const texto = q?.trim();
    const patron = texto ? `%${texto.replace(/[%_\\]/g, '\\$&')}%` : null;
    const filas = await this.db
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        telefono: clientes.telefono,
        createdAt: clientes.createdAt,
        pedidos:
          sql<number>`count(${pedidos.id}) filter (where ${vigente})`.mapWith(
            Number,
          ),
        gastado: sql<string>`coalesce(sum(${pedidos.total}) filter (where ${vigente}), 0)`,
        pagado: sql<string>`coalesce(sum(${pedidos.totalPagado}) filter (where ${vigente}), 0)`,
        ultimo: sql<string | null>`max(${pedidos.createdAt})`,
      })
      .from(clientes)
      .leftJoin(pedidos, eq(pedidos.clienteId, clientes.id))
      .where(
        and(
          // Las ventas sin datos quedan a nombre de "Cliente de mostrador": no es un cliente real.
          sql`not (${clientes.nombre} = 'Cliente de mostrador' and ${clientes.telefono} is null)`,
          patron
            ? or(
                ilike(clientes.nombre, patron),
                ilike(clientes.telefono, patron),
              )
            : undefined,
        ),
      )
      .groupBy(clientes.id)
      .orderBy(
        sql`max(${pedidos.createdAt}) desc nulls last`,
        asc(clientes.nombre),
      )
      .limit(300);
    return filas.map((f) => ({
      ...f,
      gastado: r2(Number(f.gastado)),
      debe: r2(Math.max(0, Number(f.gastado) - Number(f.pagado))),
    }));
  }

  /** Ficha: datos, totales, fechas especiales, direcciones frecuentes e historial. */
  async ficha(id: string) {
    const [cliente] = await this.db
      .select()
      .from(clientes)
      .where(eq(clientes.id, id))
      .limit(1);
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    const [historial, fechas, direcciones] = await Promise.all([
      this.db
        .select({
          id: pedidos.id,
          codigo: pedidos.codigo,
          estado: pedidos.estado,
          fechaEntrega: pedidos.fechaEntrega,
          total: pedidos.total,
          totalPagado: pedidos.totalPagado,
          resumen: sql<
            string | null
          >`(select string_agg(pr.nombre || ' ' || t.talla::text, ', ') from pedido_items i join producto_tallas t on t.id = i.producto_talla_id join productos pr on pr.id = t.producto_id where i.pedido_id = "pedidos"."id")`,
        })
        .from(pedidos)
        .where(eq(pedidos.clienteId, id))
        .orderBy(desc(pedidos.createdAt))
        .limit(100),
      this.db
        .select()
        .from(clienteFechas)
        .where(eq(clienteFechas.clienteId, id))
        .orderBy(asc(clienteFechas.mes), asc(clienteFechas.dia)),
      this.db
        .select({
          direccion: pedidos.direccion,
          distrito: distritos.nombre,
          veces: sql<number>`count(*)`.mapWith(Number),
        })
        .from(pedidos)
        .leftJoin(distritos, eq(distritos.id, pedidos.distritoId))
        .where(
          and(eq(pedidos.clienteId, id), sql`${pedidos.direccion} is not null`),
        )
        .groupBy(pedidos.direccion, distritos.nombre)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ]);
    const vigentes = historial.filter((h) => h.estado !== 'cancelado');
    const gastado = r2(vigentes.reduce((a, h) => a + Number(h.total), 0));
    const pagado = r2(vigentes.reduce((a, h) => a + Number(h.totalPagado), 0));
    return {
      cliente,
      pedidos: vigentes.length,
      gastado,
      debe: r2(Math.max(0, gastado - pagado)),
      fechas,
      direcciones,
      historial,
    };
  }

  async agregarFecha(
    clienteId: string,
    input: { descripcion: string; dia: number; mes: number },
  ) {
    const [c] = await this.db
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.id, clienteId));
    if (!c) throw new NotFoundException('Cliente no encontrado');
    const [f] = await this.db
      .insert(clienteFechas)
      .values({ clienteId, ...input })
      .returning();
    return f;
  }

  async quitarFecha(clienteId: string, fechaId: string) {
    const borradas = await this.db
      .delete(clienteFechas)
      .where(
        and(
          eq(clienteFechas.id, fechaId),
          eq(clienteFechas.clienteId, clienteId),
        ),
      )
      .returning({ id: clienteFechas.id });
    if (!borradas.length) throw new NotFoundException('Fecha no encontrada');
    return { ok: true };
  }

  /** Fechas especiales de los próximos `dias` días (para el aviso de la semana). */
  async proximasFechas(dias = 7) {
    const todas = await this.db
      .select({
        id: clienteFechas.id,
        clienteId: clientes.id,
        cliente: clientes.nombre,
        telefono: clientes.telefono,
        descripcion: clienteFechas.descripcion,
        dia: clienteFechas.dia,
        mes: clienteFechas.mes,
      })
      .from(clienteFechas)
      .innerJoin(clientes, eq(clientes.id, clienteFechas.clienteId));
    const hoy = new Date(
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) +
        'T12:00:00Z',
    );
    return todas
      .map((f) => {
        let fecha = new Date(
          Date.UTC(hoy.getUTCFullYear(), f.mes - 1, f.dia, 12),
        );
        if (fecha < hoy)
          fecha = new Date(
            Date.UTC(hoy.getUTCFullYear() + 1, f.mes - 1, f.dia, 12),
          );
        return {
          ...f,
          enDias: Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000),
        };
      })
      .filter((f) => f.enDias <= dias)
      .sort((a, b) => a.enDias - b.enDias);
  }
}
