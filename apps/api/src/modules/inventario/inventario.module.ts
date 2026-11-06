import { Module } from '@nestjs/common';
import { AperturaController } from './apertura.controller';
import { InsumosController } from './insumos.controller';
import { InsumosService } from './insumos.service';

@Module({
  controllers: [InsumosController, AperturaController],
  providers: [InsumosService],
})
export class InventarioModule {}
