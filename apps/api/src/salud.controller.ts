import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/** `GET /api/salud`: lo usa el hosting (Railway) para saber que el API arrancó. */
@Controller('salud')
export class SaludController {
  @Public()
  @Get()
  salud(): { ok: true } {
    return { ok: true };
  }
}
