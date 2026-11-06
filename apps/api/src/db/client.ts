import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** El cliente que recibe el callback de `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createDb(connectionString: string): {
  db: Db;
  sql: postgres.Sql;
} {
  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });
  return { db, sql };
}
