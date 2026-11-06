import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { ConsultaResolverInput } from '@erp/shared';
import type { EstadoConsulta } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { consultasProduccion } from '../../db/schema';

@Injectable()
export class ConsultasService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list(estado?: EstadoConsulta) {
    return this.db
      .select()
      .from(consultasProduccion)
      .where(estado ? eq(consultasProduccion.estado, estado) : undefined)
      .orderBy(desc(consultasProduccion.createdAt));
  }

  async resolver(
    id: string,
    input: ConsultaResolverInput,
    resueltaPor: string,
  ) {
    const [consulta] = await this.db
      .select()
      .from(consultasProduccion)
      .where(eq(consultasProduccion.id, id))
      .limit(1);
    if (!consulta) throw new NotFoundException('Consulta no encontrada');

    const [actualizada] = await this.db
      .update(consultasProduccion)
      .set({
        estado: input.estado,
        respuesta: input.respuesta,
        ajustePrecio:
          input.ajustePrecio !== undefined ? String(input.ajustePrecio) : null,
        resueltaPor,
        resueltaAt: new Date(),
      })
      .where(eq(consultasProduccion.id, id))
      .returning();

    return actualizada;
  }
}
