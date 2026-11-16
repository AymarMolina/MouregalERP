import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { DB } from '../db/db.module';
import * as schema from '../db/schema';
import { crearEntornoDePrueba, type EntornoDePrueba } from './db-test';

jest.setTimeout(60_000);

/**
 * Prueba de punta a punta por HTTP: la app Nest completa (guards JWT y de
 * roles, validación zod, filtro de errores) sobre Postgres en memoria.
 */
describe('API por HTTP (e2e)', () => {
  let e: EntornoDePrueba;
  let app: INestApplication;
  const PASSWORD = 'clave-de-prueba';

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgres://no-se-usa';
    process.env.JWT_SECRET = 'test-access';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    e = await crearEntornoDePrueba();
    const hash = await bcrypt.hash(PASSWORD, 4);
    await e.db.update(schema.usuarios).set({ passwordHash: hash });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DB)
      .useValue(e.db)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await e?.cerrar();
  });

  async function login(rol: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `${rol}@test.pe`, password: PASSWORD })
      .expect(200);
    return res.body as { accessToken: string; refreshToken: string };
  }

  it('flujo completo: cotizar, vender, armar, consumir, despachar con link, cobrar y entregar', async () => {
    const http = app.getHttpServer();
    const vendedora = (await login('vendedora')).accessToken;
    const produccion = (await login('produccion')).accessToken;
    const delivery = (await login('delivery')).accessToken;
    const admin = (await login('admin')).accessToken;

    const rosaRoja = await e.insumo('ROS-ROJ');
    const item = {
      productoId: await e.productoId('ramo-clasico-de-rosas'),
      talla: 'M',
      cantidad: 1,
      florId: rosaRoja.id,
      extraIds: [],
    };
    const distritoId = await e.distritoId('Surco');

    const cot = await request(http)
      .post('/api/cotizaciones/pedido')
      .auth(vendedora, { type: 'bearer' })
      .send({ items: [item], distritoId })
      .expect(201);
    expect(cot.body).toMatchObject({
      vehiculo: 'moto',
      costoEnvio: 15,
      total: 164,
    });

    const creado = await request(http)
      .post('/api/pedidos')
      .auth(vendedora, { type: 'bearer' })
      .send({
        canal: 'vendedora',
        cliente: { nombre: 'Carla', telefono: '987654321' },
        items: [item],
        fechaEntrega: '2026-11-12',
        horaEntrega: '15:30',
        distritoId,
        direccion: 'Av. Primavera 100',
        telefonoReceptor: '912345678',
        nombreReceptor: 'Rosa',
        porcentajeAdelanto: 100,
      })
      .expect(201);
    const id = creado.body.id as string;
    expect(creado.body.items[0]).toMatchObject({
      producto: 'Ramo Clásico de Rosas',
      talla: 'M',
      flor: 'Rosa roja',
    });

    // Delivery no puede armar; producción sí.
    await request(http)
      .post(`/api/pedidos/${id}/transicion`)
      .auth(delivery, { type: 'bearer' })
      .send({ a: 'en_armado' })
      .expect(400);
    await request(http)
      .patch(`/api/pedidos/${id}/asignar`)
      .auth(produccion, { type: 'bearer' })
      .send({ encargadaId: e.usuarios.produccion })
      .expect(200);
    await request(http)
      .post(`/api/pedidos/${id}/transicion`)
      .auth(produccion, { type: 'bearer' })
      .send({ a: 'en_armado' })
      .expect(201);
    await request(http)
      .post(`/api/pedidos/${id}/consumo`)
      .auth(produccion, { type: 'bearer' })
      .send({ lineas: [{ insumoId: rosaRoja.id, cantidadUsada: 25 }] })
      .expect(201);

    // Despacho desde el tablero de delivery: genera el link del saldo.
    const tablero = await request(http)
      .get('/api/delivery')
      .auth(delivery, { type: 'bearer' })
      .expect(200);
    expect(
      tablero.body.pedidos.find((p: { id: string }) => p.id === id),
    ).toMatchObject({ estado: 'listo', saldo: 164 });
    await request(http)
      .post(`/api/pedidos/${id}/despachar`)
      .auth(delivery, { type: 'bearer' })
      .send({})
      .expect(201);

    const pagos = await request(http)
      .get(`/api/pedidos/${id}/pagos`)
      .auth(vendedora, { type: 'bearer' })
      .expect(200);
    const link = pagos.body.find(
      (p: { tipo: string; estado: string }) =>
        p.tipo === 'saldo' && p.estado === 'pendiente',
    );
    await request(http)
      .post(`/api/pagos/${link.id}/confirmar`)
      .auth(vendedora, { type: 'bearer' })
      .send({ referenciaExterna: 'OP-1' })
      .expect(201);
    await request(http)
      .post(`/api/pedidos/${id}/transicion`)
      .auth(delivery, { type: 'bearer' })
      .send({ a: 'entregado' })
      .expect(201);

    // Reportes: la merma de 1 rosa aparece, y solo el admin los ve.
    const merma = await request(http)
      .get('/api/reportes/merma?desde=2000-01-01&hasta=2100-01-01')
      .auth(admin, { type: 'bearer' })
      .expect(200);
    expect(
      merma.body.filas.find((f: { codigo: string }) => f.codigo === 'ROS-ROJ')
        .cantidadProduccion,
    ).toBe(1);
    await request(http)
      .get('/api/reportes/merma')
      .auth(vendedora, { type: 'bearer' })
      .expect(403);
    // Envíos cuenta el día en que el pedido salió (hoy), no su fecha de
    // entrega programada (2026-11-12).
    const hoy = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
    });
    const envios = await request(http)
      .get(`/api/reportes/envios?desde=${hoy}&hasta=${hoy}`)
      .auth(admin, { type: 'bearer' })
      .expect(200);
    expect(envios.body.totales).toMatchObject({
      viajes: 1,
      cobrado: 15,
      costo: 10,
    });
    const cobros = await request(http)
      .get(`/api/reportes/cobros?desde=${hoy}&hasta=${hoy}`)
      .auth(admin, { type: 'bearer' })
      .expect(200);
    expect(cobros.body.totales.cobros).toBeGreaterThan(0);
    if (hoy !== '2026-11-12') {
      const programada = await request(http)
        .get('/api/reportes/envios?desde=2026-11-12&hasta=2026-11-12')
        .auth(admin, { type: 'bearer' })
        .expect(200);
      expect(programada.body.totales.viajes).toBe(0);
    }
  });

  it('permisos de rol y validación de entrada', async () => {
    const http = app.getHttpServer();
    const delivery = (await login('delivery')).accessToken;
    const almacen = (await login('almacen')).accessToken;

    await request(http)
      .get('/api/pagos')
      .auth(delivery, { type: 'bearer' })
      .expect(403);
    await request(http)
      .get('/api/compras/sugeridas')
      .auth(almacen, { type: 'bearer' })
      .expect(200);
    await request(http)
      .get('/api/pedidos/no-es-uuid')
      .auth(delivery, { type: 'bearer' })
      .expect(400);
    const malo = await request(http)
      .post('/api/proveedores')
      .auth(almacen, { type: 'bearer' })
      .send({ nombre: 'X', ruc: '123' })
      .expect(400);
    expect(malo.body.code).toBe('VALIDATION_ERROR');
  });

  it('logout revoca el refresh token', async () => {
    const http = app.getHttpServer();
    const { accessToken, refreshToken } = await login('almacen');
    await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    await request(http)
      .post('/api/auth/logout')
      .auth(accessToken, { type: 'bearer' })
      .expect(204);
    await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('bloquea el login tras 5 intentos fallidos', async () => {
    const http = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(http)
        .post('/api/auth/login')
        .send({ email: 'admin@test.pe', password: 'mala' })
        .expect(401);
    }
    await request(http)
      .post('/api/auth/login')
      .send({ email: 'admin@test.pe', password: PASSWORD })
      .expect(429);
  });

  it('un usuario desactivado no puede renovar su sesión', async () => {
    const http = app.getHttpServer();
    const { refreshToken } = await login('vendedora');
    await e.db
      .update(schema.usuarios)
      .set({ activo: false })
      .where(eq(schema.usuarios.email, 'vendedora@test.pe'));
    await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
