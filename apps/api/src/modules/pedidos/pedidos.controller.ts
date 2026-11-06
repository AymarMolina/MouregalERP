import { Controller, Body, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { pedidoInputSchema, type Canal, type EstadoPedido } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get()
  list(
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: EstadoPedido,
    @Query('canal') canal?: Canal,
    @Query('q') q?: string,
  ) {
    return this.pedidos.list({ fecha, estado, canal, q });
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pedidos.findOne(id);
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get(':id/historial')
  historial(@Param('id') id: string) {
    return this.pedidos.historial(id);
  }

  @Roles('admin', 'vendedora')
  @Post()
  crear(@Body() body: unknown, @Req() req: Request & { user: JwtPayload }) {
    return this.pedidos.crear(pedidoInputSchema.parse(body), req.user.sub);
  }
}
