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
import { reglaCambioInputSchema } from '@erp/shared';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ReglasCambioService } from './reglas-cambio.service';

@Controller('reglas-cambio')
@Roles('admin')
export class ReglasCambioController {
  constructor(private readonly reglasCambio: ReglasCambioService) {}

  @Get()
  list() {
    return this.reglasCambio.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.reglasCambio.create(reglaCambioInputSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.reglasCambio.update(
      id,
      reglaCambioInputSchema.partial().parse(body),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.reglasCambio.softDelete(id);
  }
}
