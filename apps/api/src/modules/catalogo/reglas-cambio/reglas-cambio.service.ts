import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { ReglaCambioInput } from '@erp/shared';
import { DB } from '../../../db/db.module';
import type { Db } from '../../../db/client';
import { reglasCambio } from '../../../db/schema';

@Injectable()
export class ReglasCambioService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(reglasCambio).orderBy(asc(reglasCambio.tipo));
  }

  create(input: ReglaCambioInput) {
    return this.db
      .insert(reglasCambio)
      .values({
        tipo: input.tipo,
        productoId: input.productoId ?? null,
        insumoOrigenId: input.insumoOrigenId ?? null,
        insumoDestinoId: input.insumoDestinoId ?? null,
        descripcion: input.descripcion,
        ajusteModo: input.ajusteModo,
        ajusteMonto: String(input.ajusteMonto),
        estado: input.estado,
      })
      .returning();
  }

  async update(id: string, input: Partial<ReglaCambioInput>) {
    await this.ensureExists(id);
    const [regla] = await this.db
      .update(reglasCambio)
      .set({
        ...(input.tipo !== undefined && { tipo: input.tipo }),
        ...(input.productoId !== undefined && { productoId: input.productoId }),
        ...(input.insumoOrigenId !== undefined && {
          insumoOrigenId: input.insumoOrigenId,
        }),
        ...(input.insumoDestinoId !== undefined && {
          insumoDestinoId: input.insumoDestinoId,
        }),
        ...(input.descripcion !== undefined && {
          descripcion: input.descripcion,
        }),
        ...(input.ajusteModo !== undefined && { ajusteModo: input.ajusteModo }),
        ...(input.ajusteMonto !== undefined && {
          ajusteMonto: String(input.ajusteMonto),
        }),
        ...(input.estado !== undefined && { estado: input.estado }),
        ...(input.activo !== undefined && { activo: input.activo }),
        updatedAt: new Date(),
      })
      .where(eq(reglasCambio.id, id))
      .returning();
    return regla;
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.db
      .update(reglasCambio)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(reglasCambio.id, id));
  }

  private async ensureExists(id: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(reglasCambio)
      .where(eq(reglasCambio.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Regla de cambio no encontrada');
  }
}
