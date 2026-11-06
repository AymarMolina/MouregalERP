import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { AjusteInventarioInput } from '@erp/shared';
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
  costoUnitario: number;
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

    const saldoResultante =
      Math.round(
        (Number(insumo.stockActual) + entrada - salida + Number.EPSILON) * 1000,
      ) / 1000;

    await tx.insert(kardexMovimientos).values({
      insumoId: input.insumoId,
      tipo: input.tipo,
      entrada: String(entrada),
      salida: String(salida),
      costoUnitario: String(input.costoUnitario),
      saldoResultante: String(saldoResultante),
      referenciaTipo: input.referenciaTipo,
      referenciaId: input.referenciaId,
      nota: input.nota,
      usuarioId: input.usuarioId,
    });

    await tx
      .update(insumos)
      .set({ stockActual: String(saldoResultante), updatedAt: new Date() })
      .where(eq(insumos.id, input.insumoId));

    return saldoResultante;
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
    if (desde) condiciones.push(gte(kardexMovimientos.fecha, new Date(desde)));
    if (hasta)
      condiciones.push(
        lte(kardexMovimientos.fecha, new Date(`${hasta}T23:59:59`)),
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
    const [insumo] = await this.db
      .select()
      .from(insumos)
      .where(eq(insumos.id, input.insumoId))
      .limit(1);
    if (!insumo) throw new NotFoundException('Insumo no encontrado');

    await this.db.transaction(async (tx) => {
      await this.registrarMovimiento(tx, {
        insumoId: input.insumoId,
        tipo: input.tipo,
        entrada: input.tipo === 'ajuste_positivo' ? input.cantidad : 0,
        salida: input.tipo === 'ajuste_negativo' ? input.cantidad : 0,
        costoUnitario: Number(insumo.costoPromedio),
        referenciaTipo: 'ajuste',
        nota: input.nota,
        usuarioId,
      });
    });
  }
}
