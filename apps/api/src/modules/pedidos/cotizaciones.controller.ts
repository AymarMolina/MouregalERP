import { Body, Controller, Post } from '@nestjs/common';
import {
  cotizacionInputSchema,
  cotizacionPedidoInputSchema,
} from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CotizacionesService } from './cotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizaciones: CotizacionesService) {}

  /** Cotiza el ítem que se está configurando, con sus opciones y disponibilidad. */
  @Roles('admin', 'vendedora')
  @Post()
  cotizar(@Body() body: unknown) {
    return this.cotizaciones.cotizar(cotizacionInputSchema.parse(body));
  }

  /** Cotiza el pedido completo (varios ítems). */
  @Roles('admin', 'vendedora')
  @Post('pedido')
  cotizarPedido(@Body() body: unknown) {
    return this.cotizaciones.cotizarPedido(
      cotizacionPedidoInputSchema.parse(body),
    );
  }
}
