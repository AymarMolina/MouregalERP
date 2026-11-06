import { Body, Controller, Get, Put } from '@nestjs/common';
import { costoVehiculoInputSchema } from '@erp/shared';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CostosVehiculoService } from './costos-vehiculo.service';

@Controller('costos-vehiculo')
@Roles('admin')
export class CostosVehiculoController {
  constructor(private readonly costosVehiculo: CostosVehiculoService) {}

  @Get()
  list() {
    return this.costosVehiculo.list();
  }

  @Put()
  update(@Body() body: unknown) {
    return this.costosVehiculo.update(costoVehiculoInputSchema.parse(body));
  }
}
