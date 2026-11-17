import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Aplica las migraciones de `apps/api/drizzle/` al arrancar en producción
 * (`node dist/db/migrar.js`). Usa la misma tabla de control que `drizzle-kit
 * migrate` (`drizzle.__drizzle_migrations`), así que ambos son intercambiables.
 * No depende de drizzle-kit ni de dotenv: las variables las pone el hosting.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL_UNPOOLED (o DATABASE_URL)');

  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: join(__dirname, '..', '..', 'drizzle'),
    });
    console.log('Migraciones al día.');
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error('Fallaron las migraciones:', err);
  process.exit(1);
});
