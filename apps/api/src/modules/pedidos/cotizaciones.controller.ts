import { Body, Controller, Post } from '@nestjs/common';
import { cotizacionInputSchema } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CotizacionesService } from './cotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizaciones: CotizacionesService) {}

  @Roles('admin', 'vendedora')
  @Post()
  cotizar(@Body() body: unknown) {
    return this.cotizaciones.cotizar(cotizacionInputSchema.parse(body));
  }
}
