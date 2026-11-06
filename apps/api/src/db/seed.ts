import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { ROL_USUARIO } from '@erp/shared';
import { createDb } from './client';
import { usuarios } from './schema';

const DEV_PASSWORD = 'dev12345';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL en apps/api/.env');

  const { db, sql } = createDb(connectionString);
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  for (const rol of ROL_USUARIO) {
    await db
      .insert(usuarios)
      .values({
        nombre: `Usuario ${rol}`,
        email: `${rol}@mouregal.pe`,
        passwordHash,
        rol,
      })
      .onConflictDoNothing({ target: usuarios.email });
  }

  console.log(`Usuarios semilla listos (contraseña dev: "${DEV_PASSWORD}"):`);
  for (const rol of ROL_USUARIO) console.log(`  - ${rol}@mouregal.pe`);

  await sql.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
