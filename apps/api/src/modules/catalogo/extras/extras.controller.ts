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
import { extraInputSchema } from '@erp/shared';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ExtrasService } from './extras.service';

@Controller('extras')
export class ExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  @Roles('admin', 'vendedora', 'produccion', 'almacen')
  @Get()
  list() {
    return this.extras.list();
  }

  @Roles('admin')
  @Post()
  create(@Body() body: unknown) {
    return this.extras.create(extraInputSchema.parse(body));
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.extras.update(id, extraInputSchema.partial().parse(body));
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.extras.softDelete(id);
  }
}
