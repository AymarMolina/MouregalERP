import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { estadoPagoEnum, metodoPagoEnum, tipoPagoEnum } from './enums';
import { pedidos } from './pedidos';
import { usuarios } from './usuarios';

export const pagos = pgTable('pagos', {
  id: uuid('id').defaultRandom().primaryKey(),
  pedidoId: uuid('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  tipo: tipoPagoEnum('tipo').notNull(),
  metodo: metodoPagoEnum('metodo').notNull(),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  estado: estadoPagoEnum('estado').notNull().default('pendiente'),
  linkUrl: text('link_url'),
  referenciaExterna: text('referencia_externa'),
  /** Quién cobró (para la caja de cada vendedora). Null en links y cobros antiguos. */
  registradoPor: uuid('registrado_por').references(() => usuarios.id),
  pagadoAt: timestamp('pagado_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
