import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { AperturaInput, InsumoInput } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { insumos, kardexMovimientos } from '../../db/schema';

export interface AperturaResultado {
  cargados: number;
}

@Injectable()
export class InsumosService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(insumos).orderBy(asc(insumos.codigo));
  }

  create(input: InsumoInput) {
    return this.db
      .insert(insumos)
      .values({
        codigo: input.codigo,
        nombre: input.nombre,
        categoria: input.categoria,
        unidadBase: input.unidadBase,
        stockMinimo: String(input.stockMinimo),
        esFlor: input.esFlor,
      })
      .returning();
  }

  async update(id: string, input: Partial<InsumoInput>) {
    await this.ensureExists(id);
    const [insumo] = await this.db
      .update(insumos)
      .set({
        ...(input.codigo !== undefined && { codigo: input.codigo }),
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.categoria !== undefined && { categoria: input.categoria }),
        ...(input.unidadBase !== undefined && { unidadBase: input.unidadBase }),
        ...(input.stockMinimo !== undefined && {
          stockMinimo: String(input.stockMinimo),
        }),
        ...(input.esFlor !== undefined && { esFlor: input.esFlor }),
        ...(input.activo !== undefined && { activo: input.activo }),
        updatedAt: new Date(),
      })
      .where(eq(insumos.id, id))
      .returning();
    return insumo;
  }

  /**
   * Carga el saldo de apertura del Kardex. Todo o nada: si algún insumo del
   * CSV no existe o ya tiene movimientos previos, no se aplica nada.
   */
  async cargarApertura(
    input: AperturaInput,
    usuarioId: string,
  ): Promise<AperturaResultado> {
    const errores: string[] = [];
    const resueltas: {
      insumoId: string;
      cantidad: number;
      costoUnitario: number;
    }[] = [];

    for (const linea of input.lineas) {
      const [insumo] = await this.db
        .select()
        .from(insumos)
        .where(eq(insumos.codigo, linea.codigo))
        .limit(1);
      if (!insumo) {
        errores.push(`Insumo con código "${linea.codigo}" no existe`);
        continue;
      }
      const [movimientoPrevio] = await this.db
        .select({ id: kardexMovimientos.id })
        .from(kardexMovimientos)
        .where(eq(kardexMovimientos.insumoId, insumo.id))
        .limit(1);
      if (movimientoPrevio) {
        errores.push(
          `Insumo "${linea.codigo}" ya tiene movimientos de Kardex; no se puede recargar apertura`,
        );
        continue;
      }
      resueltas.push({
        insumoId: insumo.id,
        cantidad: linea.cantidad,
        costoUnitario: linea.costoUnitario,
      });
    }

    if (errores.length) {
      throw new BadRequestException({
        message: 'No se cargó la apertura',
        errores,
      });
    }

    await this.db.transaction(async (tx) => {
      for (const r of resueltas) {
        await tx.insert(kardexMovimientos).values({
          insumoId: r.insumoId,
          tipo: 'apertura',
          entrada: String(r.cantidad),
          salida: '0',
          costoUnitario: String(r.costoUnitario),
          saldoResultante: String(r.cantidad),
          referenciaTipo: 'apertura',
          usuarioId,
        });
        await tx
          .update(insumos)
          .set({
            stockActual: String(r.cantidad),
            costoPromedio: String(r.costoUnitario),
            updatedAt: new Date(),
          })
          .where(eq(insumos.id, r.insumoId));
      }
    });

    return { cargados: resueltas.length };
  }

  private async ensureExists(id: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(insumos)
      .where(eq(insumos.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Insumo no encontrado');
  }
}
