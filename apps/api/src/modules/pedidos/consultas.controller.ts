import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { consultaResolverSchema, type EstadoConsulta } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { ConsultasService } from './consultas.service';

@Controller('consultas')
export class ConsultasController {
  constructor(private readonly consultas: ConsultasService) {}

  @Roles('admin', 'produccion', 'vendedora')
  @Get()
  list(@Query('estado') estado?: EstadoConsulta) {
    return this.consultas.list(estado);
  }

  @Roles('admin', 'produccion')
  @Post(':id/resolver')
  resolver(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.consultas.resolver(
      id,
      consultaResolverSchema.parse(body),
      req.user.sub,
    );
  }
}
