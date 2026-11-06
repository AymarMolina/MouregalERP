import {
  boolean,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { estadoReglaEnum, tallaEnum, tipoCambioEnum } from './enums';
import { insumos } from './insumos';

export const productos = pgTable('productos', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  slug: text('slug').notNull().unique(),
  descripcion: text('descripcion'),
  florPrincipalId: uuid('flor_principal_id')
    .notNull()
    .references(() => insumos.id),
  usaPapel: boolean('usa_papel').notNull().default(true),
  papelDefaultId: uuid('papel_default_id').references(() => insumos.id),
  imagenUrl: text('imagen_url'),
  shopifyProductId: text('shopify_product_id').unique(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productoTallas = pgTable(
  'producto_tallas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productoId: uuid('producto_id')
      .notNull()
      .references(() => productos.id),
    talla: tallaEnum('talla').notNull(),
    precioBase: numeric('precio_base', { precision: 12, scale: 2 }).notNull(),
    shopifyVariantId: text('shopify_variant_id').unique(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('producto_tallas_producto_talla_idx').on(t.productoId, t.talla),
  ],
);

export const recetaLineas = pgTable(
  'receta_lineas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productoTallaId: uuid('producto_talla_id')
      .notNull()
      .references(() => productoTallas.id),
    insumoId: uuid('insumo_id')
      .notNull()
      .references(() => insumos.id),
    cantidad: numeric('cantidad', { precision: 12, scale: 3 }).notNull(),
    // flor_principal | papel | otro — identifica qué línea reemplazar en un cambio.
    rol: text('rol').notNull().default('otro'),
  },
  (t) => [
    uniqueIndex('receta_lineas_talla_insumo_idx').on(
      t.productoTallaId,
      t.insumoId,
    ),
  ],
);

export const productoFloresPermitidas = pgTable(
  'producto_flores_permitidas',
  {
    productoId: uuid('producto_id')
      .notNull()
      .references(() => productos.id),
    insumoId: uuid('insumo_id')
      .notNull()
      .references(() => insumos.id),
  },
  (t) => [primaryKey({ columns: [t.productoId, t.insumoId] })],
);

export const reglasCambio = pgTable('reglas_cambio', {
  id: uuid('id').defaultRandom().primaryKey(),
  tipo: tipoCambioEnum('tipo').notNull(),
  productoId: uuid('producto_id').references(() => productos.id),
  insumoOrigenId: uuid('insumo_origen_id').references(() => insumos.id),
  insumoDestinoId: uuid('insumo_destino_id').references(() => insumos.id),
  descripcion: text('descripcion'),
  // fijo | por_unidad
  ajusteModo: text('ajuste_modo').notNull(),
  ajusteMonto: numeric('ajuste_monto', { precision: 12, scale: 2 }).notNull(),
  estado: estadoReglaEnum('estado').notNull().default('aprobado'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const extras = pgTable('extras', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  insumoId: uuid('insumo_id')
    .notNull()
    .references(() => insumos.id),
  precio: numeric('precio', { precision: 12, scale: 2 }).notNull(),
  fuerzaCarro: boolean('fuerza_carro').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
