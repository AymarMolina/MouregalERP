import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  costoPromedioPonderado,
  errorCantidadPorUnidad,
  type AjusteInventarioInput,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db, Tx } from '../../db/client';
import { insumos, kardexMovimientos } from '../../db/schema';

export interface RegistrarMovimientoInput {
  insumoId: string;
  tipo:
    | 'apertura'
    | 'compra'
    | 'consumo'
    | 'merma'
    | 'ajuste_positivo'
    | 'ajuste_negativo'
    | 'devolucion';
  entrada?: number;
  salida?: number;
  /** Si se omite, se valoriza al costo_promedio vigente del insumo (leído con la fila bloqueada). */
  costoUnitario?: number;
  referenciaTipo?: string;
  referenciaId?: string;
  nota?: string;
  usuarioId?: string;
}

/**
 * Único punto de escritura del Kardex: bloquea la fila del insumo
 * (SELECT ... FOR UPDATE), calcula el saldo resultante y actualiza
 * insumos.stock_actual dentro de la misma transacción del movimiento.
 */
@Injectable()
export class KardexService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async registrarMovimiento(
    tx: Tx,
    input: RegistrarMovimientoInput,
  ): Promise<number> {
    const entrada = input.entrada ?? 0;
    const salida = input.salida ?? 0;
    if (entrada > 0 && salida > 0) {
      throw new BadRequestException(
        'Un movimiento de Kardex no puede tener entrada y salida a la vez',
      );
    }
    if (entrada === 0 && salida === 0)
      return this.stockActualDe(tx, input.insumoId);

    const [insumo] = await tx
      .select()
      .from(insumos)
      .where(eq(insumos.id, input.insumoId))
      .for('update')
      .limit(1);
    if (!insumo) throw new NotFoundException('Insumo no encontrado');

    // Tallos, hojas y unidades no se fraccionan.
    const error = errorCantidadPorUnidad(
      insumo.nombre,
      insumo.unidadBase,
      entrada || salida,
    );
    if (error) throw new BadRequestException(error);

    const saldoResultante =
      Math.round(
        (Number(insumo.stockActual) + entrada - salida + Number.EPSILON) * 1000,
      ) / 1000;

    await tx.insert(kardexMovimientos).values({
      insumoId: input.insumoId,
      tipo: input.tipo,
      entrada: String(entrada),
      salida: String(salida),
      costoUnitario: String(
        input.costoUnitario ?? Number(insumo.costoPromedio),
      ),
      saldoResultante: String(saldoResultante),
      referenciaTipo: input.referenciaTipo,
      referenciaId: input.referenciaId,
      nota: input.nota,
      usuarioId: input.usuarioId,
    });

    // 5.8 — cada compra recalcula el costo promedio ponderado.
    const costoPromedio =
      input.tipo === 'compra' && entrada > 0
        ? costoPromedioPonderado({
            stockActual: Number(insumo.stockActual),
            costoPromedio: Number(insumo.costoPromedio),
            cantidad: entrada,
            costoUnitario: input.costoUnitario ?? Number(insumo.costoPromedio),
          })
        : undefined;

    await tx
      .update(insumos)
      .set({
        stockActual: String(saldoResultante),
        ...(costoPromedio !== undefined && {
          costoPromedio: String(costoPromedio),
        }),
        updatedAt: new Date(),
      })
      .where(eq(insumos.id, input.insumoId));

    return saldoResultante;
  }

  /**
   * Varias salidas (consumo, merma) en lote: una sola consulta bloquea todos
   * los insumos, una sola inserta los movimientos y una sola actualiza el
   * stock. Mismas reglas que `registrarMovimiento` (fila bloqueada, unidades
   * enteras, costo promedio vigente), pero sin una ida y vuelta por insumo:
   * dentro de una transacción la base las atiende de a una y con 6 insumos
   * eran ~18 viajes. Los movimientos de un mismo insumo se aplican en orden.
   */
  async registrarSalidas(
    tx: Tx,
    movimientos: (Omit<
      RegistrarMovimientoInput,
      'entrada' | 'costoUnitario'
    > & {
      salida: number;
    })[],
  ): Promise<void> {
    const conSalida = movimientos.filter((m) => m.salida > 0);
    if (!conSalida.length) return;

    const ids = [...new Set(conSalida.map((m) => m.insumoId))].sort();
    // Ordenados por id: dos transacciones que bloquean los mismos insumos lo
    // hacen en el mismo orden y no se cruzan.
    const filas = await tx
      .select()
      .from(insumos)
      .where(inArray(insumos.id, ids))
      .orderBy(asc(insumos.id))
      .for('update');
    const porId = new Map(filas.map((f) => [f.id, f]));
    const saldo = new Map(filas.map((f) => [f.id, Number(f.stockActual)]));

    const valores: (typeof kardexMovimientos.$inferInsert)[] = [];
    for (const m of conSalida) {
      const insumo = porId.get(m.insumoId);
      if (!insumo) throw new NotFoundException('Insumo no encontrado');
      const error = errorCantidadPorUnidad(
        insumo.nombre,
        insumo.unidadBase,
        m.salida,
      );
      if (error) throw new BadRequestException(error);
      const nuevo =
        Math.round(
          (saldo.get(m.insumoId)! - m.salida + Number.EPSILON) * 1000,
        ) / 1000;
      saldo.set(m.insumoId, nuevo);
      valores.push({
        insumoId: m.insumoId,
        tipo: m.tipo,
        entrada: '0',
        salida: String(m.salida),
        costoUnitario: String(Number(insumo.costoPromedio)),
        saldoResultante: String(nuevo),
        referenciaTipo: m.referenciaTipo,
        referenciaId: m.referenciaId,
        nota: m.nota,
        usuarioId: m.usuarioId,
      });
    }
    await tx.insert(kardexMovimientos).values(valores);

    const nuevos = sql.join(
      ids.map((id) => sql`(${id}::uuid, ${String(saldo.get(id))}::numeric)`),
      sql`, `,
    );
    await tx.execute(
      sql`update ${insumos} set stock_actual = v.stock, updated_at = now()
          from (values ${nuevos}) as v(id, stock)
          where ${insumos.id} = v.id`,
    );
  }

  private async stockActualDe(tx: Tx, insumoId: string): Promise<number> {
    const [insumo] = await tx
      .select()
      .from(insumos)
      .where(eq(insumos.id, insumoId))
      .limit(1);
    return Number(insumo?.stockActual ?? 0);
  }

  async historial(insumoId: string, desde?: string, hasta?: string) {
    const condiciones = [eq(kardexMovimientos.insumoId, insumoId)];
    // Fechas de negocio en America/Lima (UTC-5 fijo, Perú no usa horario de verano).
    if (desde)
      condiciones.push(
        gte(kardexMovimientos.fecha, new Date(`${desde}T00:00:00-05:00`)),
      );
    if (hasta)
      condiciones.push(
        lte(kardexMovimientos.fecha, new Date(`${hasta}T23:59:59.999-05:00`)),
      );

    return this.db
      .select()
      .from(kardexMovimientos)
      .where(and(...condiciones))
      .orderBy(desc(kardexMovimientos.fecha));
  }

  async ajustar(
    input: AjusteInventarioInput,
    usuarioId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.registrarMovimiento(tx, {
        insumoId: input.insumoId,
        tipo: input.tipo,
        entrada: input.tipo === 'ajuste_positivo' ? input.cantidad : 0,
        salida: input.tipo === 'ajuste_negativo' ? input.cantidad : 0,
        referenciaTipo: 'ajuste',
        nota: input.nota,
        usuarioId,
      });
    });
  }
}
