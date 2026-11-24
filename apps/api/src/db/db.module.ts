import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createDb, type Db } from './client';

export const DB = Symbol('DB');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Db => {
        // Un servidor que corre todo el tiempo (VPS, Railway) va mejor con la
        // conexión directa: el pooler de Neon no guarda las consultas
        // preparadas y cada consulta cuesta dos idas y vueltas en vez de una.
        const directa = config.get<string>('DB_CONEXION_DIRECTA') === 'true';
        const url = directa
          ? config.getOrThrow<string>('DATABASE_URL_UNPOOLED')
          : config.getOrThrow<string>('DATABASE_URL');
        const { db } = createDb(url);
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
