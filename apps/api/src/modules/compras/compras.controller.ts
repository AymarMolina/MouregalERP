import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ESTADO_OC,
  ordenCompraInputSchema,
  ordenCompraUpdateSchema,
  proveedorInputSchema,
  recepcionInputSchema,
  type EstadoOc,
} from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { ComprasService } from './compras.service';

@Controller()
@Roles('admin', 'almacen')
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Get('proveedores')
  listProveedores() {
    return this.compras.listProveedores();
  }

  @Post('proveedores')
  crearProveedor(@Body() body: unknown) {
    return this.compras.crearProveedor(proveedorInputSchema.parse(body));
  }

  @Patch('proveedores/:id')
  actualizarProveedor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.compras.actualizarProveedor(
      id,
      proveedorInputSchema.partial().parse(body),
    );
  }

  @Get('compras/sugeridas')
  sugeridas(@Query('dias') dias?: string) {
    const n = Number(dias ?? 3);
    return this.compras.sugeridas(
      Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), 60) : 3,
    );
  }

  @Get('ordenes-compra')
  listOrdenes(@Query('estado') estado?: string) {
    return this.compras.listOrdenes(
      ESTADO_OC.includes(estado as EstadoOc) ? (estado as EstadoOc) : undefined,
    );
  }

  @Get('ordenes-compra/:id')
  getOrden(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.getOrden(id);
  }

  @Post('ordenes-compra')
  crearOrden(@Body() body: unknown) {
    return this.compras.crearOrden(ordenCompraInputSchema.parse(body));
  }

  @Patch('ordenes-compra/:id')
  actualizarOrden(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.compras.actualizarOrden(
      id,
      ordenCompraUpdateSchema.parse(body),
    );
  }

  @Post('ordenes-compra/:id/recepcion')
  recepcion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.compras.recepcion(
      id,
      recepcionInputSchema.parse(body),
      req.user.sub,
    );
  }
}
