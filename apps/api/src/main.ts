import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Detrás de un proxy (Render, Fly, Nginx...) para que req.ip sea la IP real del cliente.
  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  // CORS_ORIGIN="https://erp.ejemplo.pe,http://localhost:4200"; sin definir se permite todo (solo desarrollo).
  const origenes = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors(origenes?.length ? { origin: origenes } : undefined);
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
