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

type Rol = 'admin' | 'vendedora' | 'produccion' | 'almacen' | 'delivery';
type Pago = { id: string; tipo: string; estado: string; monto: string };

const PASSWORD = 'clave-de-prueba';
const RANGO = 'desde=2000-01-01&hasta=2100-01-01';

/**
 * Flujos de negocio de punta a punta por HTTP, cada rol haciendo su paso.
 * Cada prueba levanta una base nueva (PGlite) y la app Nest completa, así
 * el stock y los pedidos no se arrastran de una prueba a otra.
 */
describe('Flujos de negocio por HTTP (e2e)', () => {
  let e: EntornoDePrueba;
  let app: INestApplication;
  let tokens: Record<Rol, string>;
  const envOriginal = process.env.PERMITIR_ENTREGA_CON_SALDO;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgres://no-se-usa';
    process.env.JWT_SECRET = 'test-access';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    // Explícito: un .env local no debe cambiar el resultado de las pruebas.
    process.env.PERMITIR_ENTREGA_CON_SALDO = 'false';

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

    tokens = {} as Record<Rol, string>;
    for (const rol of [
      'admin',
      'vendedora',
      'produccion',
      'almacen',
      'delivery',
    ] as const) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `${rol}@test.pe`, password: PASSWORD })
        .expect(200);
      tokens[rol] = res.body.accessToken as string;
    }
  });

  afterEach(async () => {
    await app?.close();
    await e?.cerrar();
    if (envOriginal === undefined)
      delete process.env.PERMITIR_ENTREGA_CON_SALDO;
    else process.env.PERMITIR_ENTREGA_CON_SALDO = envOriginal;
  });

  /** Petición autenticada con el token del rol. */
  const como = (rol: Rol) => {
    const http = app.getHttpServer();
    const auth = { type: 'bearer' } as const;
    return {
      get: (url: string) => request(http).get(url).auth(tokens[rol], auth),
      post: (url: string, body: object = {}) =>
        request(http).post(url).auth(tokens[rol], auth).send(body),
      patch: (url: string, body: object) =>
        request(http).patch(url).auth(tokens[rol], auth).send(body),
    };
  };

  /** Ramo Clásico talla S (12 rosas) a Surco (moto, envío 15). */
  async function nuevoPedido(
    extra: {
      talla?: 'S' | 'M' | 'L';
      cantidad?: number;
      flor?: string;
      cambioNoListado?: string;
      porcentajeAdelanto?: number;
    } = {},
  ) {
    const flor = await e.insumo(extra.flor ?? 'ROS-ROJ');
    return como('vendedora').post('/api/pedidos', {
      canal: 'vendedora',
      cliente: { nombre: 'Carla', telefono: '987654321' },
      items: [
        {
          productoId: await e.productoId('ramo-clasico-de-rosas'),
          talla: extra.talla ?? 'S',
          cantidad: extra.cantidad ?? 1,
          florId: flor.id,
          extraIds: [],
          ...(extra.cambioNoListado
            ? { cambioNoListado: extra.cambioNoListado }
            : {}),
        },
      ],
      fechaEntrega: '2026-11-12',
      horaEntrega: '15:30',
      distritoId: await e.distritoId('Surco'),
      direccion: 'Av. Primavera 100',
      telefonoReceptor: '912345678',
      nombreReceptor: 'Rosa',
      porcentajeAdelanto: extra.porcentajeAdelanto ?? 50,
    });
  }

  /** Producción asigna, arma y confirma el consumo según receta → listo. */
  async function armarYConsumir(id: string) {
    const rosaRoja = await e.insumo('ROS-ROJ');
    await como('produccion')
      .patch(`/api/pedidos/${id}/asignar`, {
        encargadaId: e.usuarios.produccion,
      })
      .expect(200);
    await como('produccion')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_armado' })
      .expect(201);
    await como('produccion')
      .post(`/api/pedidos/${id}/consumo`, {
        lineas: [{ insumoId: rosaRoja.id, cantidadUsada: 12 }],
      })
      .expect(201);
  }

  const pagosDe = async (id: string) =>
    (await como('vendedora').get(`/api/pedidos/${id}/pagos`).expect(200))
      .body as Pago[];

  it('camino feliz por roles: adelanto, armado, despacho con link de saldo, cobro y entrega', async () => {
    const stockInicial = Number((await e.insumo('ROS-ROJ')).stockActual);

    const creado = await nuevoPedido({ porcentajeAdelanto: 50 });
    expect(creado.status).toBe(201);
    const id = creado.body.id as string;
    const total = Number(creado.body.total);
    expect(total).toBe(104); // 89 (talla S) + 15 de envío en moto
    expect(creado.body.estado).toBe('pendiente');

    // La vendedora confirma el adelanto (50 %).
    const [adelanto] = (await pagosDe(id)).filter(
      (p) => p.tipo === 'adelanto' && p.estado === 'pendiente',
    );
    expect(Number(adelanto.monto)).toBe(52);
    await como('vendedora')
      .post(`/api/pagos/${adelanto.id}/confirmar`, {
        referenciaExterna: 'YP-1',
      })
      .expect(201);
    expect(
      Number(
        (await como('vendedora').get(`/api/pedidos/${id}`)).body.totalPagado,
      ),
    ).toBe(52);

    // La vendedora no arma; producción sí.
    await como('produccion')
      .patch(`/api/pedidos/${id}/asignar`, {
        encargadaId: e.usuarios.produccion,
      })
      .expect(200);
    await como('vendedora')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_armado' })
      .expect(400);
    await como('produccion')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_armado' })
      .expect(201);
    const rosaRoja = await e.insumo('ROS-ROJ');
    await como('produccion')
      .post(`/api/pedidos/${id}/consumo`, {
        lineas: [{ insumoId: rosaRoja.id, cantidadUsada: 12 }],
      })
      .expect(201);
    expect((await e.pedidos.findOne(id)).estado).toBe('listo');
    expect(Number((await e.insumo('ROS-ROJ')).stockActual)).toBe(
      stockInicial - 12,
    );

    // Producción no despacha: ni por el endpoint de despacho ni por transición.
    await como('produccion').post(`/api/pedidos/${id}/despachar`).expect(403);
    await como('produccion')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_camino' })
      .expect(400);
    // Con saldo y sin link tampoco se puede pasar a en_camino directamente.
    const sinLink = await como('vendedora')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_camino' })
      .expect(400);
    expect(sinLink.body.message).toMatch(/link del saldo/);

    // La vendedora despacha: se genera el link por el saldo (104 − 52).
    const enCamino = await como('vendedora')
      .post(`/api/pedidos/${id}/despachar`)
      .expect(201);
    expect(enCamino.body.estado).toBe('en_camino');
    let pagos = await pagosDe(id);
    expect(pagos.find((p) => p.tipo === 'adelanto')?.estado).toBe('pagado');
    const links = pagos.filter(
      (p) => p.tipo === 'saldo' && p.estado === 'pendiente',
    );
    expect(links).toHaveLength(1);
    expect(Number(links[0].monto)).toBe(52);

    // Regenerar el link anula el anterior y deja uno solo por todo el saldo.
    await como('delivery')
      .post(`/api/pedidos/${id}/pagos/link-saldo`)
      .expect(201);
    pagos = await pagosDe(id);
    const pendientes = pagos.filter((p) => p.estado === 'pendiente');
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].id).not.toBe(links[0].id);
    expect(pagos.find((p) => p.id === links[0].id)?.estado).toBe('anulado');

    // Sin cobrar el saldo no se entrega (PERMITIR_ENTREGA_CON_SALDO=false).
    const conSaldo = await como('delivery')
      .post(`/api/pedidos/${id}/transicion`, { a: 'entregado' })
      .expect(400);
    expect(conSaldo.body.message).toMatch(/saldo pendiente de S\/ 52\.00/);

    // Delivery no confirma pagos; la vendedora sí.
    await como('delivery')
      .post(`/api/pagos/${pendientes[0].id}/confirmar`)
      .expect(403);
    await como('vendedora')
      .post(`/api/pagos/${pendientes[0].id}/confirmar`, {
        referenciaExterna: 'OP-2',
      })
      .expect(201);
    // Un pago confirmado no se confirma dos veces.
    await como('vendedora')
      .post(`/api/pagos/${pendientes[0].id}/confirmar`)
      .expect(409);

    // La vendedora no marca entregado; delivery sí.
    await como('vendedora')
      .post(`/api/pedidos/${id}/transicion`, { a: 'entregado' })
      .expect(400);
    const entregado = await como('delivery')
      .post(`/api/pedidos/${id}/transicion`, { a: 'entregado' })
      .expect(201);
    expect(entregado.body.estado).toBe('entregado');
    expect(Number(entregado.body.totalPagado)).toBe(total);

    const historial = await como('vendedora')
      .get(`/api/pedidos/${id}/historial`)
      .expect(200);
    expect(
      (historial.body as { estadoNuevo: string }[]).map((h) => h.estadoNuevo),
    ).toEqual(
      expect.arrayContaining(['en_armado', 'listo', 'en_camino', 'entregado']),
    );
  });

  it('con PERMITIR_ENTREGA_CON_SALDO=true se entrega con saldo y queda la advertencia en el historial', async () => {
    process.env.PERMITIR_ENTREGA_CON_SALDO = 'true';
    const { body: pedido } = await nuevoPedido({ porcentajeAdelanto: 0 });
    await armarYConsumir(pedido.id);

    const tablero = await como('delivery').get('/api/delivery').expect(200);
    expect(tablero.body.permitirEntregaConSaldo).toBe(true);

    await como('delivery')
      .post(`/api/pedidos/${pedido.id}/despachar`)
      .expect(201);
    await como('delivery')
      .post(`/api/pedidos/${pedido.id}/transicion`, { a: 'entregado' })
      .expect(201);

    const historial = (
      await como('vendedora')
        .get(`/api/pedidos/${pedido.id}/historial`)
        .expect(200)
    ).body as { estadoNuevo: string; nota: string | null }[];
    expect(historial.find((h) => h.estadoNuevo === 'entregado')?.nota).toMatch(
      /Entregado con saldo pendiente de S\/ 104\.00/,
    );
  });

  it('no se crea un pedido sin stock: 409 con el detalle de lo que falta', async () => {
    // Rosa blanca: apertura 30 tallos; dos ramos M necesitan 48.
    const rosaBlanca = await e.insumo('ROS-BLA');
    const res = await nuevoPedido({
      talla: 'M',
      cantidad: 2,
      flor: 'ROS-BLA',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Stock insuficiente: Rosa blanca/);
    expect(res.body.details.faltantes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ insumoId: rosaBlanca.id, necesario: 48 }),
      ]),
    );
    expect(await e.db.select().from(schema.pedidos)).toHaveLength(0);

    // Un ramo M (24) sí cabe, y entonces un ramo S (12) más ya no.
    await nuevoPedido({ talla: 'M', flor: 'ROS-BLA' }).then((r) =>
      expect(r.status).toBe(201),
    );
    await nuevoPedido({ talla: 'S', flor: 'ROS-BLA' }).then((r) =>
      expect(r.status).toBe(409),
    );
  });

  it('una consulta abierta bloquea en_armado; producción la aprueba con ajuste de precio', async () => {
    const { body: pedido } = await nuevoPedido({
      cambioNoListado: 'Agregar lazo dorado',
      porcentajeAdelanto: 50,
    });
    const id = pedido.id as string;
    const total = Number(pedido.total);

    await como('produccion')
      .patch(`/api/pedidos/${id}/asignar`, {
        encargadaId: e.usuarios.produccion,
      })
      .expect(200);
    const bloqueado = await como('produccion')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_armado' })
      .expect(400);
    expect(bloqueado.body.message).toMatch(/consulta abierta/);

    const abiertas = await como('vendedora')
      .get('/api/consultas?estado=abierta')
      .expect(200);
    const consulta = (
      abiertas.body as { id: string; pedidoId: string; descripcion: string }[]
    ).find((c) => c.pedidoId === id);
    expect(consulta?.descripcion).toBe('Agregar lazo dorado');

    // La vendedora ve la consulta pero no la resuelve.
    await como('vendedora')
      .post(`/api/consultas/${consulta!.id}/resolver`, {
        estado: 'aprobada',
        respuesta: 'ok',
      })
      .expect(403);
    await como('produccion')
      .post(`/api/consultas/${consulta!.id}/resolver`, {
        estado: 'aprobada',
        respuesta: 'Ok, +10 por el lazo',
        ajustePrecio: 10,
      })
      .expect(201);

    const actualizado = (await como('vendedora').get(`/api/pedidos/${id}`))
      .body;
    expect(Number(actualizado.total)).toBe(total + 10);
    const adelanto = (await pagosDe(id)).find(
      (p) => p.tipo === 'adelanto' && p.estado === 'pendiente',
    );
    // El adelanto pendiente mantiene su 50 %.
    expect(Number(adelanto?.monto)).toBe((total + 10) / 2);

    await como('produccion')
      .post(`/api/pedidos/${id}/transicion`, { a: 'en_armado' })
      .expect(201);
  });

  it('cancelación: la vendedora cancela antes de consumir; tras armar solo el admin, y lo consumido sale como merma', async () => {
    // 1) Pendiente: la vendedora puede cancelar y no hay merma.
    const { body: p1 } = await nuevoPedido();
    await como('delivery')
      .post(`/api/pedidos/${p1.id}/transicion`, { a: 'cancelado' })
      .expect(400);
    await como('vendedora')
      .post(`/api/pedidos/${p1.id}/transicion`, { a: 'cancelado' })
      .expect(201);
    expect((await pagosDe(p1.id)).every((p) => p.estado !== 'pendiente')).toBe(
      true,
    );
    let merma = await como('admin').get(`/api/reportes/merma?${RANGO}`);
    expect(merma.body.filas).toHaveLength(0);

    // 2) Listo: la vendedora ya no puede; el admin sí.
    const { body: p2 } = await nuevoPedido();
    await armarYConsumir(p2.id);
    const stockTrasConsumo = Number((await e.insumo('ROS-ROJ')).stockActual);
    const denegado = await como('vendedora')
      .post(`/api/pedidos/${p2.id}/transicion`, { a: 'cancelado' })
      .expect(400);
    expect(denegado.body.message).toMatch(/Solo un admin/);
    await como('admin')
      .post(`/api/pedidos/${p2.id}/transicion`, { a: 'cancelado' })
      .expect(201);

    // Lo consumido no vuelve al stock (el Kardex es solo de inserción)...
    expect(Number((await e.insumo('ROS-ROJ')).stockActual)).toBe(
      stockTrasConsumo,
    );
    // ...y aparece como merma por cancelación, no como merma de producción.
    merma = await como('admin').get(`/api/reportes/merma?${RANGO}`).expect(200);
    const rosa = (
      merma.body.filas as {
        codigo: string;
        cantidadProduccion: number;
        cantidadCancelacion: number;
        valorCancelacion: number;
      }[]
    ).find((f) => f.codigo === 'ROS-ROJ');
    expect(rosa).toMatchObject({
      cantidadProduccion: 0,
      cantidadCancelacion: 12,
    });
    expect(rosa!.valorCancelacion).toBeGreaterThan(0);
    expect(merma.body.totales.valorProduccion).toBe(0);
    expect(merma.body.totales.valorCancelacion).toBeGreaterThan(0);

    // Un pedido cancelado no sale en "más vendidos".
    const vendidos = await como('admin')
      .get(`/api/reportes/mas-vendidos?${RANGO}`)
      .expect(200);
    expect(JSON.stringify(vendidos.body)).not.toMatch(/Ramo Clásico/);
  });

  it('compra: almacén crea la orden, la envía y la recepción sube stock y costo promedio', async () => {
    const papelNegro = await e.insumo('PAP-NEG'); // apertura 60 hojas a 1.10

    await como('vendedora').get('/api/ordenes-compra').expect(403);

    const proveedor = await como('almacen')
      .post('/api/proveedores', { nombre: 'Papelera Lima', ruc: '20123456789' })
      .expect(201);
    const orden = await como('almacen')
      .post('/api/ordenes-compra', {
        proveedorId: proveedor.body.id,
        lineas: [
          {
            insumoId: papelNegro.id,
            paquetes: 2,
            unidadesPorPaquete: 50,
            costoTotal: 120,
          },
        ],
      })
      .expect(201);
    expect(orden.body.estado).toBe('borrador');
    const lineaId = orden.body.lineas[0].id as string;
    const recibir = {
      lineas: [
        { lineaId, paquetes: 2, unidadesPorPaquete: 50, costoTotal: 120 },
      ],
    };

    // Un borrador no se recibe.
    await como('almacen')
      .post(`/api/ordenes-compra/${orden.body.id}/recepcion`, recibir)
      .expect(409);
    await como('almacen')
      .patch(`/api/ordenes-compra/${orden.body.id}`, { estado: 'enviada' })
      .expect(200);

    const recibida = await como('almacen')
      .post(`/api/ordenes-compra/${orden.body.id}/recepcion`, recibir)
      .expect(201);
    expect(recibida.body.estado).toBe('recibida');

    const despues = await e.insumo('PAP-NEG');
    expect(Number(despues.stockActual)).toBe(160);
    // (60 × 1.10 + 100 × 1.20) / 160 = 1.1625
    expect(Number(despues.costoPromedio)).toBe(1.1625);

    const kardex = await como('almacen')
      .get(`/api/insumos/${papelNegro.id}/kardex`)
      .expect(200);
    expect(JSON.stringify(kardex.body)).toMatch(/compra/);

    // Una orden recibida no se vuelve a recibir.
    await como('almacen')
      .post(`/api/ordenes-compra/${orden.body.id}/recepcion`, recibir)
      .expect(409);
  });
});
