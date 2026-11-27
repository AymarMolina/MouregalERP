import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ROL_USUARIO, type RolUsuario } from '@erp/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { usuarios } from '../../db/schema';
import type { JwtPayload } from './strategies/jwt-access.strategy';

const crearSchema = z.object({
  nombre: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  rol: z.enum(ROL_USUARIO),
  password: z.string().min(8).optional(),
});

const editarSchema = z.object({
  nombre: z.string().trim().min(2).optional(),
  rol: z.enum(ROL_USUARIO).optional(),
  activo: z.boolean().optional(),
});

const columnas = {
  id: usuarios.id,
  nombre: usuarios.nombre,
  email: usuarios.email,
  rol: usuarios.rol,
  activo: usuarios.activo,
  createdAt: usuarios.createdAt,
};

/** Contraseña legible de 12 caracteres para entregar a la persona. */
const generarClave = () => randomBytes(9).toString('base64url');

@Controller('usuarios')
export class UsuariosController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Usuarios activos (para elegir encargada, repartidor o vendedora). */
  @Roles('admin', 'vendedora', 'produccion', 'almacen')
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

  /** Administración: todos los usuarios, activos e inactivos. */
  @Roles('admin')
  @Get('todos')
  todos() {
    return this.db
      .select(columnas)
      .from(usuarios)
      .orderBy(asc(usuarios.nombre));
  }

  /** Crea un usuario. Sin contraseña, genera una y la devuelve una sola vez. */
  @Roles('admin')
  @Post()
  async crear(@Body() body: unknown) {
    const d = crearSchema.parse(body);
    const password = d.password ?? generarClave();
    const [u] = await this.db
      .insert(usuarios)
      .values({
        nombre: d.nombre,
        email: d.email,
        rol: d.rol,
        passwordHash: await bcrypt.hash(password, 10),
      })
      .onConflictDoNothing({ target: usuarios.email })
      .returning(columnas);
    if (!u)
      throw new ConflictException(
        `Ya existe un usuario con el email ${d.email}`,
      );
    return { usuario: u, password: d.password ? null : password };
  }

  /** Cambia nombre, rol o estado. Desactivar cierra sus sesiones. */
  @Roles('admin')
  @Patch(':id')
  async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const d = editarSchema.parse(body);
    if (
      id === req.user.sub &&
      (d.activo === false || (d.rol && d.rol !== 'admin'))
    )
      throw new BadRequestException(
        'No puedes desactivarte ni quitarte el rol de admin a ti mismo',
      );
    const [u] = await this.db
      .update(usuarios)
      .set({
        ...d,
        updatedAt: new Date(),
        ...(d.activo === false || d.rol
          ? { tokenVersion: sql`${usuarios.tokenVersion} + 1` }
          : {}),
      })
      .where(eq(usuarios.id, id))
      .returning(columnas);
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  /** Genera una contraseña nueva y cierra las sesiones abiertas de ese usuario. */
  @Roles('admin')
  @Post(':id/clave')
  async nuevaClave(@Param('id', ParseUUIDPipe) id: string) {
    const password = generarClave();
    const [u] = await this.db
      .update(usuarios)
      .set({
        passwordHash: await bcrypt.hash(password, 10),
        tokenVersion: sql`${usuarios.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(usuarios.id, id))
      .returning(columnas);
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return { usuario: u, password };
  }
}
