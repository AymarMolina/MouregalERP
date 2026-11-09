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
  ParseUUIDPipe,
} from '@nestjs/common';
import { distritoInputSchema } from '@erp/shared';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DistritosService } from './distritos.service';

@Controller('distritos')
export class DistritosController {
  constructor(private readonly distritos: DistritosService) {}

  @Roles('admin', 'vendedora', 'produccion', 'almacen', 'delivery')
  @Get()
  list() {
    return this.distritos.list();
  }

  @Roles('admin')
  @Post()
  create(@Body() body: unknown) {
    return this.distritos.create(distritoInputSchema.parse(body));
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.distritos.update(id, distritoInputSchema.partial().parse(body));
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.distritos.softDelete(id);
  }
}
