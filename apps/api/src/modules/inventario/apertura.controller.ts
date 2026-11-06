import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { aperturaInputSchema } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { InsumosService } from './insumos.service';

@Controller('inventario')
export class AperturaController {
  constructor(private readonly insumos: InsumosService) {}

  @Roles('admin', 'almacen')
  @Post('apertura')
  cargarApertura(
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.insumos.cargarApertura(
      aperturaInputSchema.parse(body),
      req.user.sub,
    );
  }
}
