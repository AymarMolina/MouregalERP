import { Controller, Get, Module, Query } from '@nestjs/common';
import { rangoFechasSchema, type RangoFechas } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportesService } from './reportes.service';

/** Rango por defecto: últimos 30 días hasta hoy (hora de Lima). */
function rango(desde?: string, hasta?: string): RangoFechas {
  const hoy = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Lima',
  });
  const hace30 = new Date(
    Date.now() - 29 * 24 * 3600 * 1000,
  ).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  return rangoFechasSchema.parse({
    desde: desde || hace30,
    hasta: hasta || hoy,
  });
}

@Controller('reportes')
@Roles('admin')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('margen')
  margen(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.margen(rango(desde, hasta));
  }

  @Get('merma')
  merma(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.merma(rango(desde, hasta));
  }

  @Get('mas-vendidos')
  masVendidos(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.masVendidos(rango(desde, hasta));
  }

  @Get('envios')
  envios(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.envios(rango(desde, hasta));
  }
}

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
