import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { CajaService } from './caja.service';

type Req_ = Request & { user: JwtPayload };

const abrirSchema = z.object({ fondo: z.coerce.number().min(0) });
const movimientoSchema = z.object({
  tipo: z.enum(['egreso', 'ingreso']),
  monto: z.coerce.number().positive(),
  motivo: z.string().trim().min(1),
});
const cerrarSchema = z.object({
  contado: z.coerce.number().min(0),
  nota: z.string().trim().optional(),
});

/** Caja de quien está conectado (cada vendedora maneja la suya). */
@Controller('caja')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Roles('admin', 'vendedora')
  @Get()
  actual(@Req() req: Req_) {
    return this.caja.actual(req.user.sub);
  }

  @Roles('admin', 'vendedora')
  @Post('abrir')
  abrir(@Req() req: Req_, @Body() body: unknown) {
    return this.caja.abrir(req.user.sub, abrirSchema.parse(body).fondo);
  }

  @Roles('admin', 'vendedora')
  @Post('movimientos')
  movimiento(@Req() req: Req_, @Body() body: unknown) {
    return this.caja.movimiento(req.user.sub, movimientoSchema.parse(body));
  }

  @Roles('admin', 'vendedora')
  @Post('cerrar')
  cerrar(@Req() req: Req_, @Body() body: unknown) {
    const d = cerrarSchema.parse(body);
    return this.caja.cerrar(req.user.sub, d.contado, d.nota);
  }
}
