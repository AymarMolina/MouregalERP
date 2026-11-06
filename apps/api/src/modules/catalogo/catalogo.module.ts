import { Module } from '@nestjs/common';
import { CostosVehiculoController } from './costos-vehiculo/costos-vehiculo.controller';
import { CostosVehiculoService } from './costos-vehiculo/costos-vehiculo.service';
import { DistritosController } from './distritos/distritos.controller';
import { DistritosService } from './distritos/distritos.service';
import { ExtrasController } from './extras/extras.controller';
import { ExtrasService } from './extras/extras.service';
import { ProductosController } from './productos/productos.controller';
import { ProductosService } from './productos/productos.service';
import { ReglasCambioController } from './reglas-cambio/reglas-cambio.controller';
import { ReglasCambioService } from './reglas-cambio/reglas-cambio.service';

@Module({
  controllers: [
    ProductosController,
    ReglasCambioController,
    ExtrasController,
    DistritosController,
    CostosVehiculoController,
  ],
  providers: [
    ProductosService,
    ReglasCambioService,
    ExtrasService,
    DistritosService,
    CostosVehiculoService,
  ],
})
export class CatalogoModule {}
