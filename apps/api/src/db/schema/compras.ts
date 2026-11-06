import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { estadoOcEnum } from './enums';
import { insumos } from './insumos';

export const proveedores = pgTable('proveedores', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  ruc: text('ruc'),
  telefono: text('telefono'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ordenesCompra = pgTable('ordenes_compra', {
  id: uuid('id').defaultRandom().primaryKey(),
  numero: serial('numero').notNull().unique(),
  proveedorId: uuid('proveedor_id')
    .notNull()
    .references(() => proveedores.id),
  estado: estadoOcEnum('estado').notNull().default('borrador'),
  fecha: date('fecha').notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  nota: text('nota'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ordenCompraLineas = pgTable('orden_compra_lineas', {
  id: uuid('id').defaultRandom().primaryKey(),
  ordenCompraId: uuid('orden_compra_id')
    .notNull()
    .references(() => ordenesCompra.id),
  insumoId: uuid('insumo_id')
    .notNull()
    .references(() => insumos.id),
  paquetes: numeric('paquetes', { precision: 12, scale: 3 }).notNull(),
  unidadesPorPaquete: numeric('unidades_por_paquete', {
    precision: 12,
    scale: 3,
  }).notNull(),
  cantidadBase: numeric('cantidad_base', {
    precision: 12,
    scale: 3,
  }).generatedAlwaysAs(
    (): ReturnType<typeof sql> => sql`paquetes * unidades_por_paquete`,
  ),
  costoTotal: numeric('costo_total', { precision: 12, scale: 2 }).notNull(),
  costoUnitario: numeric('costo_unitario', {
    precision: 12,
    scale: 4,
  }).notNull(),
  cantidadRecibida: numeric('cantidad_recibida', { precision: 12, scale: 3 })
    .notNull()
    .default('0'),
});
