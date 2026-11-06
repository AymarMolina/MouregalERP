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
        const { db } = createDb(config.getOrThrow<string>('DATABASE_URL'));
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
