import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { insumoInputSchema } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { InsumosService } from './insumos.service';

@Controller('insumos')
export class InsumosController {
  constructor(private readonly insumos: InsumosService) {}

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
}
