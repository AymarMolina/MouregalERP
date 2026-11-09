import { Module } from '@nestjs/common';
import { InventarioModule } from '../inventario/inventario.module';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { DisponibilidadService } from './disponibilidad.service';
import { ItemResolverService } from './item-resolver.service';
import { DeliveryController, PedidosController } from './pedidos.controller';
import { PagosModule } from '../pagos/pagos.module';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [InventarioModule, PagosModule],
  controllers: [
    CotizacionesController,
    PedidosController,
    DeliveryController,
    ConsultasController,
  ],
  providers: [
    DisponibilidadService,
    ItemResolverService,
    CotizacionesService,
    PedidosService,
    ConsultasService,
  ],
  exports: [DisponibilidadService],
})
export class PedidosModule {}
