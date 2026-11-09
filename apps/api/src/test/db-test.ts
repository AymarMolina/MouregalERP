import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { seedCatalogo } from '../db/seed-catalogo';
import { ComprasService } from '../modules/compras/compras.service';
import { KardexService } from '../modules/inventario/kardex.service';
import { NotificacionesService } from '../modules/notificaciones/notificaciones.service';
import { PagosService } from '../modules/pagos/pagos.service';
import { ConsultasService } from '../modules/pedidos/consultas.service';
import { CotizacionesService } from '../modules/pedidos/cotizaciones.service';
import { DisponibilidadService } from '../modules/pedidos/disponibilidad.service';
import { ItemResolverService } from '../modules/pedidos/item-resolver.service';
import { PedidosService } from '../modules/pedidos/pedidos.service';
import { ReportesService } from '../modules/reportes/reportes.service';

/**
 * Base de datos Postgres en memoria (PGlite) con las migraciones reales de
 * `drizzle/` y el seed de la sección 11. Cada llamada crea una base nueva.
 */
export async function crearEntornoDePrueba(env: Record<string, string> = {}) {
  Logger.overrideLogger(['error', 'warn']);
  const pg = new PGlite();
  const dir = join(__dirname, '..', '..', 'drizzle');
  const migraciones = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const archivo of migraciones) {
    const sqlText = readFileSync(join(dir, archivo), 'utf8');
    for (const sentencia of sqlText.split('--> statement-breakpoint')) {
      if (sentencia.trim()) await pg.exec(sentencia);
    }
  }

  const db = drizzle(pg, { schema }) as unknown as Db;

  const usuarios: Record<string, string> = {};
  for (const rol of [
    'admin',
    'vendedora',
    'produccion',
    'almacen',
    'delivery',
  ] as const) {
    const [u] = await db
      .insert(schema.usuarios)
      .values({
        nombre: `Usuario ${rol}`,
        email: `${rol}@test.pe`,
        passwordHash: 'x',
        rol,
      })
      .returning();
    usuarios[rol] = u.id;
  }
  await seedCatalogo(db, usuarios.admin);

  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  const notificaciones = new NotificacionesService();
  const kardex = new KardexService(db);
  const disponibilidad = new DisponibilidadService(db);
  const resolver = new ItemResolverService();
  const pagos = new PagosService(db, config, notificaciones);
  const pedidos = new PedidosService(
    db,
    kardex,
    disponibilidad,
    resolver,
    pagos,
    config,
    notificaciones,
  );

  const insumoId = async (codigo: string) => {
    const [i] = await db
      .select()
      .from(schema.insumos)
      .where(eq(schema.insumos.codigo, codigo));
    return i;
  };
  const productoId = async (slug: string) => {
    const [p] = await db
      .select()
      .from(schema.productos)
      .where(eq(schema.productos.slug, slug));
    return p.id;
  };
  const distritoId = async (nombre: string) => {
    const [d] = await db
      .select()
      .from(schema.distritos)
      .where(eq(schema.distritos.nombre, nombre));
    return d.id;
  };

  return {
    pg,
    db,
    usuarios,
    notificaciones,
    kardex,
    disponibilidad,
    pagos,
    pedidos,
    cotizaciones: new CotizacionesService(db, disponibilidad, resolver),
    consultas: new ConsultasService(db),
    compras: new ComprasService(db, kardex, disponibilidad),
    reportes: new ReportesService(db),
    insumo: insumoId,
    productoId,
    distritoId,
    cerrar: () => pg.close(),
  };
}

export type EntornoDePrueba = Awaited<ReturnType<typeof crearEntornoDePrueba>>;
