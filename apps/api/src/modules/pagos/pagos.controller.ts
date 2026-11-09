import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { confirmarPagoInputSchema, pagoManualInputSchema } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { PagosService } from './pagos.service';

@Controller()
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  /** Tabla de pagos y saldos (pantalla /pagos). `saldo=1` filtra los que deben algo. */
  @Roles('admin', 'vendedora')
  @Get('pagos')
  resumen(@Query('saldo') saldo?: string, @Query('fecha') fecha?: string) {
    return this.pagos.resumen({
      soloConSaldo: saldo === '1' || saldo === 'true',
      fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined,
    });
  }

  @Roles('admin', 'vendedora', 'delivery')
  @Get('pedidos/:id/pagos')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagos.listPorPedido(id);
  }

  @Roles('admin', 'vendedora')
  @Post('pedidos/:id/pagos')
  registrar(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.pagos.registrarManual(id, pagoManualInputSchema.parse(body));
  }

  @Roles('admin', 'vendedora', 'delivery')
  @Post('pedidos/:id/pagos/link-saldo')
  linkSaldo(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagos.generarLinkSaldo(id);
  }

  @Roles('admin', 'vendedora')
  @Post('pagos/:id/confirmar')
  confirmar(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.pagos.confirmar(id, confirmarPagoInputSchema.parse(body ?? {}));
  }

  @Roles('admin', 'vendedora')
  @Post('pagos/:id/anular')
  anular(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagos.anular(id);
  }
}
