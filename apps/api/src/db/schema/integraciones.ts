import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const fuenteIntegracionEnum = pgEnum('fuente_integracion', [
  'shopify',
  'whatsapp',
]);

// Unique (fuente, topic, external_id) hace los webhooks idempotentes.
export const integracionesLog = pgTable(
  'integraciones_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fuente: fuenteIntegracionEnum('fuente').notNull(),
    topic: text('topic').notNull(),
    externalId: text('external_id').notNull(),
    payload: jsonb('payload').notNull(),
    procesado: boolean('procesado').notNull().default(false),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('integraciones_log_idempotencia_idx').on(
      t.fuente,
      t.topic,
      t.externalId,
    ),
  ],
);
