import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { ExtraInput } from '@erp/shared';
import { DB } from '../../../db/db.module';
import type { Db } from '../../../db/client';
import { extras } from '../../../db/schema';

@Injectable()
export class ExtrasService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(extras).orderBy(asc(extras.nombre));
  }

  create(input: ExtraInput) {
    return this.db
      .insert(extras)
      .values({
        nombre: input.nombre,
        insumoId: input.insumoId,
        precio: String(input.precio),
        fuerzaCarro: input.fuerzaCarro,
      })
      .returning();
  }

  async update(id: string, input: Partial<ExtraInput>) {
    await this.ensureExists(id);
    const [extra] = await this.db
      .update(extras)
      .set({
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.insumoId !== undefined && { insumoId: input.insumoId }),
        ...(input.precio !== undefined && { precio: String(input.precio) }),
        ...(input.fuerzaCarro !== undefined && {
          fuerzaCarro: input.fuerzaCarro,
        }),
        ...(input.activo !== undefined && { activo: input.activo }),
        updatedAt: new Date(),
      })
      .where(eq(extras.id, id))
      .returning();
    return extra;
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.db
      .update(extras)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(extras.id, id));
  }

  private async ensureExists(id: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(extras)
      .where(eq(extras.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Extra no encontrado');
  }
}
