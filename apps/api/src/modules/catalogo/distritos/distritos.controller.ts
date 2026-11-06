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
} from '@nestjs/common';
import { distritoInputSchema } from '@erp/shared';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DistritosService } from './distritos.service';

@Controller('distritos')
@Roles('admin')
export class DistritosController {
  constructor(private readonly distritos: DistritosService) {}

  @Get()
  list() {
    return this.distritos.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.distritos.create(distritoInputSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.distritos.update(id, distritoInputSchema.partial().parse(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.distritos.softDelete(id);
  }
}
