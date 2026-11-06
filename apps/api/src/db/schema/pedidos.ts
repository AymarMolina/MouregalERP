import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  canalEnum,
  estadoConsultaEnum,
  estadoPedidoEnum,
  vehiculoEnum,
} from './enums';
import { clientes } from './clientes';
import { distritos } from './logistica';
import { extras, productoTallas, reglasCambio } from './productos';
import { insumos } from './insumos';
import { usuarios } from './usuarios';

export const pedidos = pgTable(
  'pedidos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    numero: serial('numero').notNull().unique(),
    canal: canalEnum('canal').notNull(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id),
    estado: estadoPedidoEnum('estado').notNull().default('pendiente'),
    fechaEntrega: date('fecha_entrega').notNull(),
    horaEntrega: time('hora_entrega').notNull(),
    distritoId: uuid('distrito_id')
      .notNull()
      .references(() => distritos.id),
    direccion: text('direccion').notNull(),
    referencia: text('referencia'),
    telefonoReceptor: text('telefono_receptor').notNull(),
    nombreReceptor: text('nombre_receptor').notNull(),
    dedicatoria: text('dedicatoria'),
    vehiculo: vehiculoEnum('vehiculo').notNull(),
    subtotalProductos: numeric('subtotal_productos', {
      precision: 12,
      scale: 2,
    }).notNull(),
    costoEnvio: numeric('costo_envio', { precision: 12, scale: 2 }).notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    // Caché de pagos con estado 'pagado'.
    totalPagado: numeric('total_pagado', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    encargadaId: uuid('encargada_id').references(() => usuarios.id),
    repartidorId: uuid('repartidor_id').references(() => usuarios.id),
    shopifyOrderId: text('shopify_order_id').unique(),
    creadoPor: uuid('creado_por').references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('pedidos_fecha_hora_idx').on(t.fechaEntrega, t.horaEntrega),
    index('pedidos_estado_idx').on(t.estado),
  ],
);

export const pedidoItems = pgTable('pedido_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoId: uuid('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  productoTallaId: uuid('producto_talla_id')
    .notNull()
    .references(() => productoTallas.id),
  cantidad: integer('cantidad').notNull().default(1),
  florId: uuid('flor_id')
    .notNull()
    .references(() => insumos.id),
  papelId: uuid('papel_id').references(() => insumos.id),
  precioUnitario: numeric('precio_unitario', {
    precision: 12,
    scale: 2,
  }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
});

export const pedidoItemExtras = pgTable('pedido_item_extras', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoItemId: uuid('pedido_item_id')
    .notNull()
    .references(() => pedidoItems.id),
  extraId: uuid('extra_id')
    .notNull()
    .references(() => extras.id),
  precio: numeric('precio', { precision: 12, scale: 2 }).notNull(),
});

// Foto de los ajustes al momento de vender: un cambio de precio futuro en
// reglas_cambio no debe alterar pedidos ya vendidos.
export const pedidoItemCambios = pgTable('pedido_item_cambios', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoItemId: uuid('pedido_item_id')
    .notNull()
    .references(() => pedidoItems.id),
  reglaId: uuid('regla_id').references(() => reglasCambio.id),
  descripcion: text('descripcion').notNull(),
  ajuste: numeric('ajuste', { precision: 12, scale: 2 }).notNull(),
});

export const pedidoConsumos = pgTable('pedido_consumos', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoItemId: uuid('pedido_item_id')
    .notNull()
    .references(() => pedidoItems.id),
  insumoId: uuid('insumo_id')
    .notNull()
    .references(() => insumos.id),
  cantidadReceta: numeric('cantidad_receta', {
    precision: 12,
    scale: 3,
  }).notNull(),
  cantidadUsada: numeric('cantidad_usada', {
    precision: 12,
    scale: 3,
  }).notNull(),
  confirmadoPor: uuid('confirmado_por')
    .notNull()
    .references(() => usuarios.id),
  confirmadoAt: timestamp('confirmado_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const consultasProduccion = pgTable('consultas_produccion', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoId: uuid('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  descripcion: text('descripcion').notNull(),
  estado: estadoConsultaEnum('estado').notNull().default('abierta'),
  respuesta: text('respuesta'),
  ajustePrecio: numeric('ajuste_precio', { precision: 12, scale: 2 }),
  creadaPor: uuid('creada_por')
    .notNull()
    .references(() => usuarios.id),
  resueltaPor: uuid('resuelta_por').references(() => usuarios.id),
  resueltaAt: timestamp('resuelta_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pedidoHistorialEstado = pgTable('pedido_historial_estado', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoId: uuid('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  estadoAnterior: estadoPedidoEnum('estado_anterior'),
  estadoNuevo: estadoPedidoEnum('estado_nuevo').notNull(),
  usuarioId: uuid('usuario_id').references(() => usuarios.id),
  nota: text('nota'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
