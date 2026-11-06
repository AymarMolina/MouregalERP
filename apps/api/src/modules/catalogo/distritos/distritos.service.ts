import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { DistritoInput } from '@erp/shared';
import { DB } from '../../../db/db.module';
import type { Db } from '../../../db/client';
import { distritos } from '../../../db/schema';

@Injectable()
export class DistritosService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(distritos).orderBy(asc(distritos.nombre));
  }

  create(input: DistritoInput) {
    return this.db
      .insert(distritos)
      .values({
        nombre: input.nombre,
        tarifaMoto: String(input.tarifaMoto),
        tarifaCarro: String(input.tarifaCarro),
      })
      .returning();
  }

  async update(id: string, input: Partial<DistritoInput>) {
    await this.ensureExists(id);
    const [distrito] = await this.db
      .update(distritos)
      .set({
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.tarifaMoto !== undefined && {
          tarifaMoto: String(input.tarifaMoto),
        }),
        ...(input.tarifaCarro !== undefined && {
          tarifaCarro: String(input.tarifaCarro),
        }),
        ...(input.activo !== undefined && { activo: input.activo }),
        updatedAt: new Date(),
      })
      .where(eq(distritos.id, id))
      .returning();
    return distrito;
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.db
      .update(distritos)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(distritos.id, id));
  }

  private async ensureExists(id: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(distritos)
      .where(eq(distritos.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Distrito no encontrado');
  }
}
