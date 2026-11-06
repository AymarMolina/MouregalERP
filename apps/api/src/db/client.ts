import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(connectionString: string): {
  db: Db;
  sql: postgres.Sql;
} {
  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });
  return { db, sql };
}
