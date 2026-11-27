import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { clientes } from './clientes';
import { usuarios } from './usuarios';

/**
 * Caja por vendedora: se abre con un fondo, suma lo cobrado en efectivo por
 * esa persona (pagos.registrado_por) y los movimientos manuales, y se cierra
 * con el efectivo contado. Una persona tiene a lo más una caja abierta.
 */
export const cajas = pgTable('cajas', {
  id: uuid('id').defaultRandom().primaryKey(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  fondo: numeric('fondo', { precision: 12, scale: 2 }).notNull(),
  abiertaAt: timestamp('abierta_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  cerradaAt: timestamp('cerrada_at', { withTimezone: true }),
  /** Al cerrar: lo que debía haber en efectivo y lo que se contó. */
  esperado: numeric('esperado', { precision: 12, scale: 2 }),
  contado: numeric('contado', { precision: 12, scale: 2 }),
  nota: text('nota'),
});

export const tipoMovimientoCajaEnum = pgEnum('tipo_movimiento_caja', [
  'egreso',
  'ingreso',
]);

export const cajaMovimientos = pgTable('caja_movimientos', {
  id: uuid('id').defaultRandom().primaryKey(),
  cajaId: uuid('caja_id')
    .notNull()
    .references(() => cajas.id),
  tipo: tipoMovimientoCajaEnum('tipo').notNull(),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  motivo: text('motivo').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Fechas especiales del cliente (cumpleaños, aniversario) para recordarle comprar. */
export const clienteFechas = pgTable('cliente_fechas', {
  id: uuid('id').defaultRandom().primaryKey(),
  clienteId: uuid('cliente_id')
    .notNull()
    .references(() => clientes.id),
  descripcion: text('descripcion').notNull(),
  dia: integer('dia').notNull(),
  mes: integer('mes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
