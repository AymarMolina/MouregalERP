import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from './client';
import { seedCatalogo } from './seed-catalogo';
import { usuarios } from './schema';

/**
 * Carga solo el catálogo de ejemplo (sección 11 del spec), sin los usuarios de
 * `dev12345`. Necesita un admin real creado antes con `usuario:crear`.
 * Es idempotente, igual que `db:seed`.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const { db, sql } = createDb(url);
  try {
    const [admin] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.rol, 'admin'))
      .limit(1);
    if (!admin) {
      throw new Error(
        'No hay ningún admin. Créalo primero con usuario:crear --rol admin',
      );
    }
    await seedCatalogo(db, admin.id);
    console.log(
      'Catálogo listo: insumos, productos, recetas, reglas, extras y distritos.',
    );
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
