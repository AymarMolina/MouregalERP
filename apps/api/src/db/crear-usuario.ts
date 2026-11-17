import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { ROL_USUARIO, type RolUsuario } from '@erp/shared';
import { createDb } from './client';
import { usuarios } from './schema';

/**
 * Crea un usuario real (producción no usa los usuarios semilla de `dev12345`).
 *
 *   pnpm --filter api usuario:crear --email ana@mouregal.pe --nombre "Ana Pérez" --rol vendedora
 *
 * Sin `--password` genera una contraseña aleatoria y la muestra una sola vez.
 * Si el email ya existe, no lo toca.
 */
function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg('email')?.trim().toLowerCase();
  const nombre = arg('nombre')?.trim();
  const rol = arg('rol') as RolUsuario | undefined;
  let password = arg('password');

  if (!email || !nombre || !rol) {
    throw new Error(
      'Uso: usuario:crear --email <email> --nombre "<nombre>" --rol <rol> [--password <clave>]',
    );
  }
  if (!ROL_USUARIO.includes(rol)) {
    throw new Error(
      `Rol inválido "${rol}". Opciones: ${ROL_USUARIO.join(', ')}`,
    );
  }
  if (password && password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }
  const generada = !password;
  password ??= randomBytes(9).toString('base64url');

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const { db, sql } = createDb(url);
  try {
    const creados = await db
      .insert(usuarios)
      .values({
        nombre,
        email,
        rol,
        passwordHash: await bcrypt.hash(password, 10),
      })
      .onConflictDoNothing({ target: usuarios.email })
      .returning({ id: usuarios.id });

    if (creados.length === 0) {
      console.log(
        `Ya existe un usuario con el email ${email}; no se cambió nada.`,
      );
      return;
    }
    console.log(`Usuario creado: ${nombre} <${email}> (${rol})`);
    if (generada)
      console.log(
        `Contraseña: ${password}  (guárdala; no se vuelve a mostrar)`,
      );
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
