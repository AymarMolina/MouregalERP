import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  asignarInputSchema,
  consumoInputSchema,
  despacharInputSchema,
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
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidos.findOne(id);
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get(':id/historial')
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidos.historial(id);
  }

  @Roles('admin', 'vendedora')
  @Post()
  crear(@Body() body: unknown, @Req() req: Request & { user: JwtPayload }) {
    return this.pedidos.crear(pedidoInputSchema.parse(body), req.user.sub);
  }

  @Roles('admin', 'produccion')
  @Patch(':id/asignar')
  asignar(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = asignarInputSchema.parse(body);
    return this.pedidos.asignar(id, {
      encargadaId: input.encargadaId,
      repartidorId: input.repartidorId,
    });
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Post(':id/transicion')
  transicion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const input = transicionInputSchema.parse(body);
    return this.pedidos.transicion(id, input.a, input.nota, {
      sub: req.user.sub,
      rol: req.user.rol,
    });
  }

  @Roles('admin', 'produccion')
  @Get(':id/receta-efectiva')
  recetaEfectiva(@Param('id', ParseUUIDPipe) id: string) {
    return this.pedidos.recetaEfectivaDelPedido(id);
  }

  @Roles('admin', 'produccion')
  @Post(':id/consumo')
  consumo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.pedidos.confirmarConsumo(
      id,
      consumoInputSchema.parse(body),
      req.user.sub,
    );
  }

  /** Enviar link del saldo (si falta) y despachar. */
  @Roles('admin', 'delivery', 'vendedora')
  @Post(':id/despachar')
  despachar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.pedidos.despachar(id, despacharInputSchema.parse(body ?? {}), {
      sub: req.user.sub,
      rol: req.user.rol,
    });
  }
}

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly pedidos: PedidosService) {}

  @Roles('admin', 'delivery', 'vendedora')
  @Get()
  tablero(@Query('fecha') fecha?: string) {
    const hoy = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
    });
    return this.pedidos.tableroDelivery(
      fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy,
    );
  }
}
