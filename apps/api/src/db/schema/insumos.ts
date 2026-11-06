import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  insumoCategoriaEnum,
  tipoMovimientoEnum,
  unidadBaseEnum,
} from './enums';
import { usuarios } from './usuarios';

export const insumos = pgTable('insumos', {
  id: uuid('id').defaultRandom().primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  categoria: insumoCategoriaEnum('categoria').notNull(),
  unidadBase: unidadBaseEnum('unidad_base').notNull(),
  stockMinimo: numeric('stock_minimo', { precision: 12, scale: 3 })
    .notNull()
    .default('0'),
  // Caché: solo la actualiza KardexService dentro de la misma transacción del movimiento.
  stockActual: numeric('stock_actual', { precision: 12, scale: 3 })
    .notNull()
    .default('0'),
  costoPromedio: numeric('costo_promedio', { precision: 12, scale: 4 })
    .notNull()
    .default('0'),
  esFlor: boolean('es_flor').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const kardexMovimientos = pgTable(
  'kardex_movimientos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    insumoId: uuid('insumo_id')
      .notNull()
      .references(() => insumos.id),
    fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
    tipo: tipoMovimientoEnum('tipo').notNull(),
    entrada: numeric('entrada', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    salida: numeric('salida', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    costoUnitario: numeric('costo_unitario', {
      precision: 12,
      scale: 4,
    }).notNull(),
    saldoResultante: numeric('saldo_resultante', {
      precision: 12,
      scale: 3,
    }).notNull(),
    // Valores de referencia: pedido | orden_compra | ajuste | apertura.
    referenciaTipo: text('referencia_tipo'),
    referenciaId: uuid('referencia_id'),
    nota: text('nota'),
    usuarioId: uuid('usuario_id').references(() => usuarios.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('kardex_insumo_fecha_idx').on(t.insumoId, t.fecha),
    check(
      'kardex_entrada_salida_check',
      sql`${t.entrada} >= 0 AND ${t.salida} >= 0 AND (${t.entrada} = 0 OR ${t.salida} = 0)`,
    ),
  ],
);
