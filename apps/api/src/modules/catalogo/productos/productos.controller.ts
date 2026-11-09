import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  copiarRecetaInputSchema,
  floresPermitidasInputSchema,
  productoInputSchema,
  recetaInputSchema,
  type Talla,
} from '@erp/shared';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Roles('admin', 'produccion', 'almacen', 'vendedora')
  @Get()
  list() {
    return this.productos.list();
  }

  @Roles('admin', 'produccion', 'almacen', 'vendedora')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productos.findOne(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() body: unknown) {
    return this.productos.create(productoInputSchema.parse(body));
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.productos.update(id, productoInputSchema.partial().parse(body));
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productos.softDelete(id);
  }

  @Roles('admin', 'produccion', 'almacen')
  @Get(':id/tallas/:talla/receta')
  getReceta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('talla') talla: Talla,
  ) {
    return this.productos.getReceta(id, talla);
  }

  @Roles('admin')
  @Put(':id/tallas/:talla/receta')
  replaceReceta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('talla') talla: Talla,
    @Body() body: unknown,
  ) {
    const { lineas } = recetaInputSchema.parse(body);
    return this.productos.replaceReceta(id, talla, lineas);
  }

  @Roles('admin')
  @Post(':id/tallas/:talla/copiar-receta')
  copiarReceta(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('talla') talla: Talla,
    @Body() body: unknown,
  ) {
    const { a } = copiarRecetaInputSchema.parse(body);
    return this.productos.copiarReceta(id, talla, a);
  }

  @Roles('admin', 'produccion', 'almacen')
  @Get(':id/flores-permitidas')
  getFloresPermitidas(@Param('id', ParseUUIDPipe) id: string) {
    return this.productos.getFloresPermitidas(id);
  }

  @Roles('admin')
  @Put(':id/flores-permitidas')
  replaceFloresPermitidas(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { insumoIds } = floresPermitidasInputSchema.parse(body);
    return this.productos.replaceFloresPermitidas(id, insumoIds);
  }
}
