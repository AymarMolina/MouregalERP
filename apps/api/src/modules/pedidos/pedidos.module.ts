import { Module } from '@nestjs/common';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { DisponibilidadService } from './disponibilidad.service';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  controllers: [CotizacionesController, PedidosController, ConsultasController],
  providers: [
    DisponibilidadService,
    CotizacionesService,
    PedidosService,
    ConsultasService,
  ],
})
export class PedidosModule {}
