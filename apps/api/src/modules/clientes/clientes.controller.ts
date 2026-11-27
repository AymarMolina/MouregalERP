import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientesService } from './clientes.service';

const fechaSchema = z
  .object({
    descripcion: z.string().trim().min(2),
    dia: z.coerce.number().int().min(1).max(31),
    mes: z.coerce.number().int().min(1).max(12),
  })
  .refine((f) => f.dia <= new Date(Date.UTC(2024, f.mes, 0)).getUTCDate(), {
    message: 'Ese día no existe en ese mes',
  });

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Roles('admin', 'vendedora')
  @Get()
  list(@Query('q') q?: string) {
    return this.clientes.list(q);
  }

  @Roles('admin', 'vendedora')
  @Get('fechas-proximas')
  proximas(@Query('dias') dias?: string) {
    const n = Number(dias);
    return this.clientes.proximasFechas(
      Number.isInteger(n) && n > 0 && n <= 60 ? n : 7,
    );
  }

  @Roles('admin', 'vendedora')
  @Get(':id')
  ficha(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.ficha(id);
  }

  @Roles('admin', 'vendedora')
  @Post(':id/fechas')
  agregarFecha(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.clientes.agregarFecha(id, fechaSchema.parse(body));
  }

  @Roles('admin', 'vendedora')
  @Delete(':id/fechas/:fechaId')
  quitarFecha(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fechaId', ParseUUIDPipe) fechaId: string,
  ) {
    return this.clientes.quitarFecha(id, fechaId);
  }
}
