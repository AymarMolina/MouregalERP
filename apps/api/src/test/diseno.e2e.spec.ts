import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { DB } from '../db/db.module';
import * as schema from '../db/schema';
import { crearEntornoDePrueba, type EntornoDePrueba } from './db-test';

jest.setTimeout(90_000);

const PASSWORD = 'clave-de-prueba';
type Rol = 'admin' | 'vendedora' | 'produccion';

/** Pantallas nuevas del diseño Mouregal: venta rápida, caja, clientes y usuarios. */
describe('Diseño Mouregal: venta rápida, caja, clientes y usuarios (e2e)', () => {
  let e: EntornoDePrueba;
  let app: INestApplication;
  const tokens = {} as Record<Rol, string>;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgres://no-se-usa';
    process.env.JWT_SECRET = 'test-access';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    e = await crearEntornoDePrueba();
    await e.db
      .update(schema.usuarios)
      .set({ passwordHash: await bcrypt.hash(PASSWORD, 4) });
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DB)
      .useValue(e.db)
      .compile();
    app = m.createNestApplication({ logger: ['error'] });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    for (const rol of ['admin', 'vendedora', 'produccion'] as const) {
      const r = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `${rol}@test.pe`, password: PASSWORD })
        .expect(200);
      tokens[rol] = r.body.accessToken;
    }
  });

  afterEach(async () => {
    await app?.close();
    await e?.cerrar();
  });

  const como = (rol: Rol) => {
    const http = app.getHttpServer();
    const a = { type: 'bearer' } as const;
    return {
      get: (u: string) => request(http).get(u).auth(tokens[rol], a),
      post: (u: string, b: object = {}) =>
        request(http).post(u).auth(tokens[rol], a).send(b),
      patch: (u: string, b: object) =>
        request(http).patch(u).auth(tokens[rol], a).send(b),
      del: (u: string) => request(http).delete(u).auth(tokens[rol], a),
    };
  };

  const itemRamoS = async () => ({
    productoId: await e.productoId('ramo-clasico-de-rosas'),
    talla: 'S',
    cantidad: 1,
    florId: (await e.insumo('ROS-ROJ')).id,
    extraIds: [],
  });

  it('venta rápida: cobra todo, descuenta la receta y queda entregada', async () => {
    const stock = Number((await e.insumo('ROS-ROJ')).stockActual);
    const r = await como('vendedora').post('/api/pedidos/venta-rapida', {
      items: [await itemRamoS()],
      pagos: [{ metodo: 'efectivo', monto: 89 }],
    });
    if (r.status !== 201) console.log(JSON.stringify(r.body));
    expect(r.status).toBe(201);
    expect(r.body.estado).toBe('entregado');
    expect(r.body.tipoEntrega).toBe('recojo');
    expect(Number(r.body.totalPagado)).toBe(89);
    // La venta sin datos no aparece como cliente.
    expect(
      (await como('vendedora').get('/api/clientes').expect(200)).body,
    ).toHaveLength(0);
    expect(Number((await e.insumo('ROS-ROJ')).stockActual)).toBe(stock - 12);
  });

  it('venta rápida sin pago completo: 400 y el stock no cambia', async () => {
    const stock = Number((await e.insumo('ROS-ROJ')).stockActual);
    const r = await como('vendedora')
      .post('/api/pedidos/venta-rapida', {
        items: [await itemRamoS()],
        pagos: [{ metodo: 'efectivo', monto: 50 }],
      })
      .expect(400);
    expect(r.body.message).toContain('faltan S/ 39.00');
    expect(Number((await e.insumo('ROS-ROJ')).stockActual)).toBe(stock);
  });

  it('caja: fondo + efectivo cobrado − egresos; cerrar con diferencia exige motivo', async () => {
    await como('vendedora')
      .get('/api/caja')
      .expect(200)
      .expect((r) => expect(r.body.abierta).toBeNull());
    await como('vendedora').post('/api/caja/abrir', { fondo: 200 }).expect(201);
    await como('vendedora').post('/api/caja/abrir', { fondo: 50 }).expect(409);
    await como('vendedora')
      .post('/api/pedidos/venta-rapida', {
        items: [await itemRamoS()],
        pagos: [
          { metodo: 'efectivo', monto: 39 },
          { metodo: 'yape', monto: 50, referencia: 'YP-9' },
        ],
      })
      .expect(201);
    await como('vendedora')
      .post('/api/caja/movimientos', {
        tipo: 'egreso',
        monto: 25,
        motivo: 'Taxi',
      })
      .expect(201);
    const c = (await como('vendedora').get('/api/caja').expect(200)).body
      .abierta;
    expect(c.porMetodo).toEqual({ efectivo: 39, yape: 50 });
    expect(c.efectivoEsperado).toBe(214); // 200 + 39 − 25
    await como('vendedora')
      .post('/api/caja/movimientos', {
        tipo: 'egreso',
        monto: 500,
        motivo: 'x',
      })
      .expect(400);
    await como('vendedora')
      .post('/api/caja/cerrar', { contado: 210 })
      .expect(400);
    const cierre = (
      await como('vendedora')
        .post('/api/caja/cerrar', { contado: 210, nota: 'Vuelto mal dado' })
        .expect(201)
    ).body;
    expect(cierre.diferencia).toBe(-4);
    // La caja de otra persona no se mezcla.
    await como('admin')
      .get('/api/caja')
      .expect(200)
      .expect((r) => expect(r.body.abierta).toBeNull());
  });

  it('clientes: lista con deuda, ficha con historial y fechas especiales', async () => {
    await como('vendedora')
      .post('/api/pedidos', {
        canal: 'whatsapp',
        tipoEntrega: 'recojo',
        cliente: { nombre: 'Carlos Mendoza', telefono: '945320118' },
        items: [await itemRamoS()],
        fechaEntrega: '2026-12-01',
        horaEntrega: '16:00',
        pagos: [{ metodo: 'yape', monto: 40 }],
      })
      .expect(201);
    const lista = (
      await como('vendedora').get('/api/clientes?q=945').expect(200)
    ).body;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      nombre: 'Carlos Mendoza',
      pedidos: 1,
      gastado: 89,
      debe: 49,
    });
    const id = lista[0].id;
    await como('vendedora')
      .post(`/api/clientes/${id}/fechas`, {
        descripcion: 'Aniversario',
        dia: 31,
        mes: 2,
      })
      .expect(400);
    const f = (
      await como('vendedora')
        .post(`/api/clientes/${id}/fechas`, {
          descripcion: 'Aniversario',
          dia: 14,
          mes: 12,
        })
        .expect(201)
    ).body;
    const ficha = (
      await como('vendedora').get(`/api/clientes/${id}`).expect(200)
    ).body;
    expect(ficha.fechas).toHaveLength(1);
    expect(ficha.historial[0].resumen).toBe('Ramo Clásico de Rosas S');
    await como('vendedora')
      .del(`/api/clientes/${id}/fechas/${f.id}`)
      .expect(200);
    await como('produccion').get('/api/clientes').expect(403);
  });

  it('usuarios: el admin crea, cambia rol y desactiva; el desactivado no entra', async () => {
    await como('vendedora').get('/api/usuarios/todos').expect(403);
    const r = (
      await como('admin')
        .post('/api/usuarios', {
          nombre: 'Rosa Huamán',
          email: 'Rosa@Mouregal.pe',
          rol: 'vendedora',
        })
        .expect(201)
    ).body;
    expect(r.usuario.email).toBe('rosa@mouregal.pe');
    expect(r.password).toHaveLength(12);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'rosa@mouregal.pe', password: r.password })
      .expect(200);
    await como('admin')
      .post('/api/usuarios', {
        nombre: 'Otra',
        email: 'rosa@mouregal.pe',
        rol: 'vendedora',
      })
      .expect(409);
    await como('admin')
      .patch(`/api/usuarios/${r.usuario.id}`, { rol: 'delivery' })
      .expect(200);
    await como('admin')
      .patch(`/api/usuarios/${r.usuario.id}`, { activo: false })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'rosa@mouregal.pe', password: r.password })
      .expect(401);
    const yo = (await como('admin').get('/api/auth/me')).body.id;
    await como('admin')
      .patch(`/api/usuarios/${yo}`, { activo: false })
      .expect(400);
  });
});
