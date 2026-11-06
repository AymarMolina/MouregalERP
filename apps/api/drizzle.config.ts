import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error('Falta DATABASE_URL_UNPOOLED en apps/api/.env');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
