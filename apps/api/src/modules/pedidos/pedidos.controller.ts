import { createReadStream } from 'node:fs';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { z } from 'zod';
import {
  asignarInputSchema,
  parteCobroSchema,
  pedidoItemInputSchema,
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
import { UbicacionService } from './ubicacion.service';
import { FOTO_MAX_BYTES, FotosService } from './fotos.service';

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidos: PedidosService,
    private readonly ubicacion: UbicacionService,
    private readonly fotos: FotosService,
  ) {}

  /** Vista previa del mapa: resuelve un link de Google Maps a coordenadas. */
  @Roles('admin', 'vendedora')
  @Get('ubicacion')
  resolverUbicacion(@Query('url') url = '') {
    return this.ubicacion.resolver(url);
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get()
  list(
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: EstadoPedido,
    @Query('canal') canal?: Canal,
    @Query('q') q?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('creadoPor') creadoPor?: string,
  ) {
    const fechaOk = (f?: string) =>
      f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : undefined;
    const uuid = (v?: string) =>
      v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined;
    return this.pedidos.list({
      fecha: fechaOk(fecha),
      desde: fechaOk(desde),
      hasta: fechaOk(hasta),
      estado,
      canal,
      creadoPor: uuid(creadoPor),
      q,
    });
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

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get(':id/fotos')
  listarFotos(@Param('id', ParseUUIDPipe) id: string) {
    return this.fotos.listar(id);
  }

  @Roles('admin', 'vendedora', 'produccion', 'delivery')
  @Get(':id/fotos/:fotoId')
  async verFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
  ) {
    const f = await this.fotos.archivo(id, fotoId);
    return new StreamableFile(createReadStream(f.ruta), {
      type: f.tipoMime,
      disposition: 'inline',
    });
  }

  /** Foto del arreglo terminado (multipart, campo "foto"). Solo Producción. */
  @Roles('admin', 'produccion')
  @Post(':id/fotos')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: FOTO_MAX_BYTES, files: 1 } }),
  )
  subirFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: { buffer: Buffer } | undefined,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.fotos.subir(id, archivo?.buffer, req.user.sub);
  }

  @Roles('admin', 'produccion')
  @Delete(':id/fotos/:fotoId')
  eliminarFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
  ) {
    return this.fotos.eliminar(id, fotoId);
  }

  @Roles('admin', 'vendedora')
  @Post()
  crear(@Body() body: unknown, @Req() req: Request & { user: JwtPayload }) {
    return this.pedidos.crear(pedidoInputSchema.parse(body), {
      sub: req.user.sub,
      rol: req.user.rol,
    });
  }

  /**
   * Venta rápida de mostrador: el arreglo ya está armado en la vitrina. Se cobra
   * todo, se descuenta la receta y queda entregado en un solo paso.
   */
  @Roles('admin', 'vendedora')
  @Post('venta-rapida')
  ventaRapida(
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const input = z
      .object({
        items: z.array(pedidoItemInputSchema).min(1),
        pagos: z.array(parteCobroSchema).min(1).max(5),
        cliente: z
          .object({
            nombre: z.string().trim().optional(),
            telefono: z.string().trim().optional(),
          })
          .default({}),
      })
      .parse(body);
    return this.pedidos.ventaRapida(input, {
      sub: req.user.sub,
      rol: req.user.rol,
    });
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
