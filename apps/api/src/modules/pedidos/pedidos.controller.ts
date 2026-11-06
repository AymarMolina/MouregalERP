import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  asignarInputSchema,
  consumoInputSchema,
  pedidoInputSchema,
  transicionInputSchema,
  type Canal,
  type EstadoPedido,
} from '@erp/shared';
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

  @Roles('admin', 'produccion')
  @Patch(':id/asignar')
  asignar(@Param('id') id: string, @Body() body: unknown) {
    const input = asignarInputSchema.parse(body);
    return this.pedidos.asignar(id, {
      encargadaId: input.encargadaId,
      repartidorId: input.repartidorId,
    });
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Post(':id/transicion')
  transicion(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const input = transicionInputSchema.parse(body);
    return this.pedidos.transicion(id, input.a, input.nota, req.user.sub);
  }

  @Roles('admin', 'produccion')
  @Get(':id/receta-efectiva')
  recetaEfectiva(@Param('id') id: string) {
    return this.pedidos.recetaEfectivaDelPedido(id);
  }

  @Roles('admin', 'produccion')
  @Post(':id/consumo')
  consumo(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.pedidos.confirmarConsumo(
      id,
      consumoInputSchema.parse(body),
      req.user.sub,
    );
  }
}
