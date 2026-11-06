import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { rolUsuarioEnum } from './enums';

export const usuarios = pgTable('usuarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  rol: rolUsuarioEnum('rol').notNull(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
