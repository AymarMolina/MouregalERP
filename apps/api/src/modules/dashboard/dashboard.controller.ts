import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles('admin', 'vendedora', 'produccion')
  @Get('hoy')
  hoy() {
    return this.dashboard.hoy();
  }
}
