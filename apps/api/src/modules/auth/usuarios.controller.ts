import { Controller, Get, Inject, Query } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { RolUsuario } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { usuarios } from '../../db/schema';

@Controller('usuarios')
export class UsuariosController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles('admin', 'produccion', 'almacen')
  @Get()
  async list(@Query('rol') rol?: RolUsuario) {
    const rows = await this.db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        rol: usuarios.rol,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(rol ? eq(usuarios.rol, rol) : undefined);
    return rows.filter((u) => u.activo);
  }
}
