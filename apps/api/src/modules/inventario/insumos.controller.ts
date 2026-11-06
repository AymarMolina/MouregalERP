import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { insumoInputSchema } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { KardexService } from './kardex.service';
import { InsumosService } from './insumos.service';

@Controller('insumos')
export class InsumosController {
  constructor(
    private readonly insumos: InsumosService,
    private readonly kardex: KardexService,
  ) {}

  @Roles('admin', 'almacen', 'produccion', 'vendedora')
  @Get()
  list() {
    return this.insumos.list();
  }

  @Roles('admin', 'almacen')
  @Post()
  create(@Body() body: unknown) {
    return this.insumos.create(insumoInputSchema.parse(body));
  }

  @Roles('admin', 'almacen')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.insumos.update(id, insumoInputSchema.partial().parse(body));
  }

  @Roles('admin', 'almacen', 'produccion')
  @Get(':id/kardex')
  kardexDe(
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.kardex.historial(id, desde, hasta);
  }
}
