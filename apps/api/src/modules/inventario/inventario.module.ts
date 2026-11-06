import { Module } from '@nestjs/common';
import { AjustesController } from './ajustes.controller';
import { AperturaController } from './apertura.controller';
import { InsumosController } from './insumos.controller';
import { InsumosService } from './insumos.service';
import { KardexService } from './kardex.service';

@Module({
  controllers: [InsumosController, AperturaController, AjustesController],
  providers: [InsumosService, KardexService],
  exports: [KardexService],
})
export class InventarioModule {}
