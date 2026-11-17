import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Carpeta de la web compilada (`ng build`). En producción el API la sirve en
 * el mismo dominio, así la web llama a `/api` sin CORS. En desarrollo no existe
 * o no se usa: la web corre aparte con `ng serve`.
 */
const WEB_DIST =
  process.env.WEB_DIST ??
  join(__dirname, '..', '..', 'web', 'dist', 'web', 'browser');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Detrás de un proxy (Railway, Render, Nginx...) para que req.ip sea la IP real del cliente.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  // CORS_ORIGIN="https://erp.ejemplo.pe,http://localhost:4200"; sin definir se permite todo (solo desarrollo).
  const origenes = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors(origenes?.length ? { origin: origenes } : undefined);
  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.NODE_ENV === 'production' && existsSync(WEB_DIST)) {
    app.useStaticAssets(WEB_DIST, { index: false, maxAge: '1h' });
    // Rutas de Angular (/hoy, /pedidos/123...): siempre index.html, salvo /api.
    const indexHtml = join(WEB_DIST, 'index.html');
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
