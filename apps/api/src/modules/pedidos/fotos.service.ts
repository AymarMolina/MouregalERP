import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, eq } from 'drizzle-orm';
import { FOTOS_PEDIDO } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db, Exec, Tx } from '../../db/client';
import { pedidoFotos, pedidos } from '../../db/schema';

/** Las fotos se suben o quitan solo con el arreglo terminado (listo). */
const ESTADOS_EDITABLES = ['listo'];
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Reconoce JPEG, PNG y WebP por sus primeros bytes (no confía en el nombre ni en el mimetype). */
export function tipoDeImagen(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { mime: 'image/jpeg', ext: 'jpg' };
  if (
    b.length > 8 &&
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: 'image/png', ext: 'png' };
  if (
    b.length > 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/**
 * Fotos del arreglo terminado. El archivo se guarda en FOTOS_DIR (en Railway,
 * un volumen persistente) y la fila en `pedido_fotos`.
 */
@Injectable()
export class FotosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService,
  ) {}

  private get dir(): string {
    return (
      this.config.get<string>('FOTOS_DIR') ||
      join(process.cwd(), 'uploads', 'fotos')
    );
  }

  async contar(exec: Exec, pedidoId: string): Promise<number> {
    const [r] = await exec
      .select({ n: count() })
      .from(pedidoFotos)
      .where(eq(pedidoFotos.pedidoId, pedidoId));
    return Number(r?.n ?? 0);
  }

  listar(pedidoId: string) {
    return this.db
      .select({
        id: pedidoFotos.id,
        tipoMime: pedidoFotos.tipoMime,
        createdAt: pedidoFotos.createdAt,
      })
      .from(pedidoFotos)
      .where(eq(pedidoFotos.pedidoId, pedidoId))
      .orderBy(asc(pedidoFotos.createdAt));
  }

  async archivo(pedidoId: string, fotoId: string) {
    const [f] = await this.db
      .select()
      .from(pedidoFotos)
      .where(
        and(eq(pedidoFotos.id, fotoId), eq(pedidoFotos.pedidoId, pedidoId)),
      )
      .limit(1);
    if (!f) throw new NotFoundException('Foto no encontrada');
    return { ruta: join(this.dir, f.archivo), tipoMime: f.tipoMime };
  }

  async subir(
    pedidoId: string,
    contenido: Buffer | undefined,
    usuarioId: string,
  ) {
    if (!contenido?.length) throw new BadRequestException('Adjunta una foto');
    if (contenido.length > FOTO_MAX_BYTES)
      throw new BadRequestException('La foto pesa más de 5 MB');
    const tipo = tipoDeImagen(contenido);
    if (!tipo)
      throw new BadRequestException('La foto debe ser JPG, PNG o WebP');

    return this.db.transaction(async (tx) => {
      await this.bloquearEditable(tx, pedidoId);
      if ((await this.contar(tx, pedidoId)) >= FOTOS_PEDIDO.max)
        throw new BadRequestException(
          `El pedido ya tiene ${FOTOS_PEDIDO.max} fotos; quita una para subir otra`,
        );
      const [fila] = await tx
        .insert(pedidoFotos)
        .values({
          pedidoId,
          archivo: '',
          tipoMime: tipo.mime,
          subidaPor: usuarioId,
        })
        .returning();
      const archivo = `${fila.id}.${tipo.ext}`;
      // Si escribir falla, la transacción se revierte y no queda una fila sin archivo.
      await mkdir(this.dir, { recursive: true });
      await writeFile(join(this.dir, archivo), contenido);
      await tx
        .update(pedidoFotos)
        .set({ archivo })
        .where(eq(pedidoFotos.id, fila.id));
      return { id: fila.id, tipoMime: tipo.mime, createdAt: fila.createdAt };
    });
  }

  async eliminar(pedidoId: string, fotoId: string) {
    const archivo = await this.db.transaction(async (tx) => {
      await this.bloquearEditable(tx, pedidoId);
      const [f] = await tx
        .delete(pedidoFotos)
        .where(
          and(eq(pedidoFotos.id, fotoId), eq(pedidoFotos.pedidoId, pedidoId)),
        )
        .returning();
      if (!f) throw new NotFoundException('Foto no encontrada');
      return f.archivo;
    });
    await unlink(join(this.dir, archivo)).catch(() => undefined);
  }

  private async bloquearEditable(tx: Tx, pedidoId: string) {
    const [p] = await tx
      .select({ estado: pedidos.estado })
      .from(pedidos)
      .where(eq(pedidos.id, pedidoId))
      .for('update')
      .limit(1);
    if (!p) throw new NotFoundException('Pedido no encontrado');
    if (!ESTADOS_EDITABLES.includes(p.estado))
      throw new BadRequestException(
        `Las fotos se suben con el pedido listo (está en "${p.estado}")`,
      );
  }
}
