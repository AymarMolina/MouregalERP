import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { estadoPagoEnum, metodoPagoEnum, tipoPagoEnum } from './enums';
import { pedidos } from './pedidos';

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
  pagadoAt: timestamp('pagado_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
