import {
  boolean,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { vehiculoEnum } from './enums';

export const distritos = pgTable('distritos', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull().unique(),
  tarifaMoto: numeric('tarifa_moto', { precision: 12, scale: 2 }).notNull(),
  tarifaCarro: numeric('tarifa_carro', { precision: 12, scale: 2 }).notNull(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const costosVehiculo = pgTable('costos_vehiculo', {
  vehiculo: vehiculoEnum('vehiculo').primaryKey(),
  costoPorViaje: numeric('costo_por_viaje', {
    precision: 12,
    scale: 2,
  }).notNull(),
});
