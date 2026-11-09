// API de demostración en memoria (PGlite) para las capturas del manual.
// No toca la base de Neon. Usa el build del API (dist) y sus migraciones reales.
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const API_DIR = process.argv[2];
const PUERTO = Number(process.argv[3] ?? 3001);
const req = createRequire(path.join(API_DIR, 'package.json'));

process.env.DATABASE_URL = 'postgres://demo-en-memoria';
process.env.JWT_SECRET = 'demo-access';
process.env.JWT_REFRESH_SECRET = 'demo-refresh';
process.env.PERMITIR_ENTREGA_CON_SALDO = 'false';

req('reflect-metadata');
const { PGlite } = req('@electric-sql/pglite');
const { drizzle } = req('drizzle-orm/pglite');
const { Test } = req('@nestjs/testing');
const bcrypt = req('bcryptjs');
const schema = req(path.join(API_DIR, 'dist/db/schema'));
const { seedCatalogo } = req(path.join(API_DIR, 'dist/db/seed-catalogo'));
const { AppModule } = req(path.join(API_DIR, 'dist/app.module'));
const { DB } = req(path.join(API_DIR, 'dist/db/db.module'));
const { HttpExceptionFilter } = req(path.join(API_DIR, 'dist/common/filters/http-exception.filter'));

const hoyLima = (n = 0) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

// Pseudoaleatorio determinista para que las capturas sean reproducibles.
let semilla = 7;
const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];

(async () => {
  const pg = new PGlite();
  const dir = path.join(API_DIR, 'drizzle');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort())
    for (const s of fs.readFileSync(path.join(dir, f), 'utf8').split('--> statement-breakpoint'))
      if (s.trim()) await pg.exec(s);
  const db = drizzle(pg, { schema });

  const hash = await bcrypt.hash('dev12345', 6);
  const nombres = { admin: 'Mónica Regal', vendedora: 'Lucía Torres', produccion: 'Rosa Huamán', almacen: 'Carlos Mendoza', delivery: 'Jorge Salas' };
  const ids = {};
  for (const rol of Object.keys(nombres)) {
    const [u] = await db.insert(schema.usuarios).values({ nombre: nombres[rol], email: `${rol}@mouregal.pe`, passwordHash: hash, rol }).returning();
    ids[rol] = u.id;
  }
  // Un segundo repartidor y una segunda encargada, como en el taller real.
  await db.insert(schema.usuarios).values([
    { nombre: 'Kevin Rojas', email: 'kevin@mouregal.pe', passwordHash: hash, rol: 'delivery' },
    { nombre: 'Ana Pillaca', email: 'ana@mouregal.pe', passwordHash: hash, rol: 'produccion' },
  ]);
  await seedCatalogo(db, ids.admin);

  const modulo = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DB).useValue(db).compile();
  const app = modulo.createNestApplication({ logger: ['error'] });
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(PUERTO);
  const base = `http://localhost:${PUERTO}/api`;

  // ---------- cliente HTTP por rol ----------
  const tokens = {};
  for (const rol of Object.keys(nombres)) {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${rol}@mouregal.pe`, password: 'dev12345' }) });
    tokens[rol] = (await r.json()).accessToken;
  }
  const api = async (rol, metodo, ruta, cuerpo) => {
    const r = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[rol]}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const txt = await r.text();
    const json = txt ? JSON.parse(txt) : null;
    if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${json?.message}`);
    return json;
  };

  const catalogo = await api('admin', 'GET', '/productos');
  const insumos = await api('admin', 'GET', '/insumos');
  const distritos = await api('admin', 'GET', '/distritos');
  const ins = (c) => insumos.find((i) => i.codigo === c).id;
  const prod = (slug) => catalogo.find((p) => p.slug === slug);

  // ---------- Compras: proveedor, orden recibida y una en borrador ----------
  const vivero = await api('almacen', 'POST', '/proveedores', { nombre: 'Vivero Flores del Sur', ruc: '20601234567', telefono: '987 654 321' });
  const papelera = await api('almacen', 'POST', '/proveedores', { nombre: 'Distribuidora Papel Lima', ruc: '20509876543', telefono: '01 445 8899' });
  await api('almacen', 'POST', '/proveedores', { nombre: 'Peluches Andinos SAC', telefono: '944 112 233' });
  const linea = (c, paq, porPaq, total) => ({ insumoId: ins(c), paquetes: paq, unidadesPorPaquete: porPaq, costoTotal: total });
  const oc1 = await api('almacen', 'POST', '/ordenes-compra', {
    proveedorId: vivero.id,
    lineas: [linea('ROS-ROJ', 8, 100, 1400), linea('GIR-AMA', 4, 25, 360), linea('LIR-BLA', 4, 25, 430), linea('EUC-VER', 10, 1000, 280), linea('GYP-BLA', 3, 1000, 150)],
  });
  await api('almacen', 'PATCH', `/ordenes-compra/${oc1.id}`, { estado: 'enviada' });
  await api('almacen', 'POST', `/ordenes-compra/${oc1.id}/recepcion`, {
    lineas: oc1.lineas.map((l) => ({ lineaId: l.id, paquetes: Number(l.paquetes), unidadesPorPaquete: Number(l.unidadesPorPaquete), costoTotal: Number(l.costoTotal) })),
    nota: 'Guía 001-4521',
  });
  const oc2 = await api('almacen', 'POST', '/ordenes-compra', {
    proveedorId: papelera.id,
    lineas: [linea('PAP-KRA', 4, 100, 340), linea('CIN-SAT', 2, 100, 95), linea('TAR-DED', 2, 200, 150), linea('PAP-NEG', 2, 50, 115)],
  });
  await api('almacen', 'PATCH', `/ordenes-compra/${oc2.id}`, { estado: 'enviada' });
  // Recepción parcial: llegó el kraft y la cinta, falta el resto.
  await api('almacen', 'POST', `/ordenes-compra/${oc2.id}/recepcion`, {
    lineas: oc2.lineas.filter((l) => ['PAP-KRA', 'CIN-SAT'].includes(l.codigo)).map((l) => ({ lineaId: l.id, paquetes: Number(l.paquetes), unidadesPorPaquete: Number(l.unidadesPorPaquete), costoTotal: Number(l.costoTotal) })),
  });

  // ---------- Pedidos ----------
  const clientes = [
    ['Carla Ruiz', '987111222'], ['Diego Paredes', '956333444'], ['Lucía Fernández', '912555666'], ['Mario Quispe', '998777888'],
    ['Sofía Castro', '934222111'], ['Andrés Vela', '965444333'], ['Valeria Soto', '921666555'], ['Jorge Rivas', '978888777'],
    ['Camila Torres', '943111999'], ['Pedro Salazar', '987222000'], ['Renata León', '956000111'], ['Hugo Flores', '912999888'],
    ['Daniela Ríos', '998000222'], ['Gabriel Núñez', '934555777'], ['Fiorella Campos', '965777999'],
  ];
  const receptores = ['Ana', 'Luis', 'María', 'José', 'Elena', 'Ricardo', 'Patricia', 'Fernando', 'Claudia', 'Martín'];
  const dedicatorias = ['Feliz aniversario, mi amor', 'Feliz cumpleaños, mamá', 'Con cariño de toda la familia', 'Gracias por todo', 'Te quiero mucho', ''];
  const opciones = [
    () => ({ productoId: prod('ramo-clasico-de-rosas').id, talla: elegir(['S', 'M', 'M']), cantidad: 1, florId: ins('ROS-ROJ'), extraIds: [] }),
    () => ({ productoId: prod('ramo-clasico-de-rosas').id, talla: 'S', cantidad: 1, florId: ins('ROS-ROS'), extraIds: [] }),
    () => ({ productoId: prod('ramo-sol').id, talla: elegir(['S', 'M']), cantidad: 1, florId: ins('GIR-AMA'), extraIds: [] }),
    () => ({ productoId: prod('box-de-lirios').id, talla: elegir(['S', 'M']), cantidad: 1, florId: ins('LIR-BLA'), extraIds: [] }),
    () => ({ productoId: prod('ramo-clasico-de-rosas').id, talla: 'L', cantidad: 1, florId: ins('ROS-ROJ'), extraIds: [] }),
  ];
  const horas = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00', '15:30', '16:00', '17:00', '18:00'];

  const crear = async (fecha, hora, extra = {}) => {
    const [cn, ct] = elegir(clientes);
    const item = elegir(opciones)();
    return api('vendedora', 'POST', '/pedidos', {
      canal: elegir(['vendedora', 'vendedora', 'shopify', 'whatsapp']),
      cliente: { nombre: cn, telefono: ct },
      items: [item],
      fechaEntrega: fecha,
      horaEntrega: hora,
      distritoId: elegir(distritos).id,
      direccion: `${elegir(['Av. Larco', 'Calle Las Begonias', 'Av. Primavera', 'Jr. Huiracocha', 'Av. Javier Prado'])} ${100 + Math.floor(rnd() * 900)}`,
      referencia: elegir(['Frente al parque', 'Edificio azul, dpto. 502', '', 'Portón negro']),
      telefonoReceptor: `9${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}`,
      nombreReceptor: elegir(receptores),
      dedicatoria: elegir(dedicatorias) || undefined,
      porcentajeAdelanto: elegir([50, 50, 100]),
      ...extra,
    });
  };
  const armar = async (p, usadoExtra = 0) => {
    await api('produccion', 'PATCH', `/pedidos/${p.id}/asignar`, { encargadaId: ids.produccion });
    await api('produccion', 'POST', `/pedidos/${p.id}/transicion`, { a: 'en_armado' });
    const receta = await api('produccion', 'GET', `/pedidos/${p.id}/receta-efectiva`);
    const flor = receta[0];
    await api('produccion', 'POST', `/pedidos/${p.id}/consumo`, { lineas: [{ insumoId: flor.insumoId, cantidadUsada: flor.cantidad + usadoExtra }] });
  };
  const cobrarTodo = async (p) => {
    const pagos = await api('vendedora', 'GET', `/pedidos/${p.id}/pagos`);
    const pendiente = pagos.find((x) => x.estado === 'pendiente');
    if (pendiente) await api('vendedora', 'POST', `/pagos/${pendiente.id}/confirmar`, { referenciaExterna: `OP-${Math.floor(rnd() * 90000 + 10000)}` });
  };
  const pagarAdelanto = async (p) => {
    const pagos = await api('vendedora', 'GET', `/pedidos/${p.id}/pagos`);
    const adelanto = pagos.find((x) => x.tipo === 'adelanto' && x.estado === 'pendiente');
    if (adelanto) await api('vendedora', 'POST', `/pagos/${adelanto.id}/confirmar`, { referenciaExterna: `YP-${Math.floor(rnd() * 90000 + 10000)}` });
  };
  const entregarCompleto = async (p, merma = 0) => {
    await pagarAdelanto(p);
    await armar(p, merma);
    await api('delivery', 'POST', `/pedidos/${p.id}/despachar`, {});
    await cobrarTodo(p);
    await api('delivery', 'POST', `/pedidos/${p.id}/transicion`, { a: 'entregado' });
  };

  // Historia: 13 días anteriores, todos entregados (alguno con merma).
  const porDia = [3, 4, 3, 5, 6, 4, 3, 4, 5, 4, 6, 5, 4];
  for (let d = -13; d <= -1; d++) {
    const n = porDia[d + 13];
    for (let i = 0; i < n; i++) {
      const p = await crear(hoyLima(d), elegir(horas));
      await entregarCompleto(p, rnd() < 0.25 ? 1 + Math.floor(rnd() * 3) : 0);
    }
  }
  // Un pedido cancelado la semana pasada.
  const cancelado = await crear(hoyLima(-4), '12:00');
  await api('admin', 'POST', `/pedidos/${cancelado.id}/transicion`, { a: 'cancelado', nota: 'El cliente canceló por viaje' });

  // Hoy: pedidos en todos los estados.
  const hoy = hoyLima();
  const entregados = [await crear(hoy, '09:00'), await crear(hoy, '09:30')];
  for (const p of entregados) await entregarCompleto(p);
  const enCamino = [await crear(hoy, '10:30'), await crear(hoy, '11:00')];
  for (const p of enCamino) {
    await pagarAdelanto(p);
    await armar(p, p === enCamino[0] ? 2 : 0);
    await api('delivery', 'POST', `/pedidos/${p.id}/despachar`, {});
  }
  const listos = [await crear(hoy, '12:00'), await crear(hoy, '13:00'), await crear(hoy, '14:00')];
  for (const p of listos) {
    await pagarAdelanto(p);
    await armar(p);
  }
  const enArmado = [await crear(hoy, '15:00'), await crear(hoy, '15:30')];
  for (const p of enArmado) {
    await pagarAdelanto(p);
    await api('produccion', 'PATCH', `/pedidos/${p.id}/asignar`, { encargadaId: ids.produccion });
    await api('produccion', 'POST', `/pedidos/${p.id}/transicion`, { a: 'en_armado' });
  }
  const pendientes = [await crear(hoy, '16:00'), await crear(hoy, '17:00')];
  await pagarAdelanto(pendientes[0]);
  // Pedido especial: abre una consulta a Producción.
  await crear(hoy, '18:00', {
    items: [{ productoId: prod('ramo-clasico-de-rosas').id, talla: 'M', cantidad: 1, florId: ins('ROS-ROJ'), extraIds: [], cambioNoListado: 'Agregar lazo dorado y flores en tonos pastel' }],
    dedicatoria: 'Feliz graduación, Valeria',
  });
  // Mañana: dos pedidos agendados.
  await crear(hoyLima(1), '10:00');
  await crear(hoyLima(1), '16:30');

  console.log(`DEMO LISTA en ${base}`);
})().catch((e) => {
  console.error('FALLO DEMO', e);
  process.exit(1);
});
