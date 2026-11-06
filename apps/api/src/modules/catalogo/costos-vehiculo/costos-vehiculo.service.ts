import { Inject, Injectable } from '@nestjs/common';
import type { CostoVehiculoInput } from '@erp/shared';
import { DB } from '../../../db/db.module';
import type { Db } from '../../../db/client';
import { costosVehiculo } from '../../../db/schema';

@Injectable()
export class CostosVehiculoService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(costosVehiculo);
  }

  async update(input: CostoVehiculoInput) {
    await this.upsert('moto', input.moto);
    await this.upsert('carro', input.carro);
    return this.list();
  }

  private async upsert(
    vehiculo: 'moto' | 'carro',
    costoPorViaje: number,
  ): Promise<void> {
    await this.db
      .insert(costosVehiculo)
      .values({ vehiculo, costoPorViaje: String(costoPorViaje) })
      .onConflictDoUpdate({
        target: costosVehiculo.vehiculo,
        set: { costoPorViaje: String(costoPorViaje) },
      });
  }
}
