import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ajusteInventarioInputSchema } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { KardexService } from './kardex.service';

@Controller('inventario')
export class AjustesController {
  constructor(private readonly kardex: KardexService) {}

  @Roles('admin', 'almacen')
  @Post('ajustes')
  async ajustar(
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.kardex.ajustar(
      ajusteInventarioInputSchema.parse(body),
      req.user.sub,
    );
    return { ok: true };
  }
}
