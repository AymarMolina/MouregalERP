import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const clientes = pgTable('clientes', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  telefono: text('telefono'),
  email: text('email'),
  shopifyCustomerId: text('shopify_customer_id').unique(),
  whatsappId: text('whatsapp_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
