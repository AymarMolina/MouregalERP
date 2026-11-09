import { eq, sql as rawSql } from 'drizzle-orm';
import type { Db } from './client';
import {
  costosVehiculo,
  distritos,
  extras,
  insumos,
  kardexMovimientos,
  productoFloresPermitidas,
  productoTallas,
  productos,
  recetaLineas,
  reglasCambio,
} from './schema';

// Datos de ejemplo de la sección 11 del spec.

const INSUMOS = [
  {
    codigo: 'ROS-ROJ',
    nombre: 'Rosa roja',
    categoria: 'flor',
    unidadBase: 'tallo',
    stockMinimo: 200,
    costo: 1.8,
    apertura: 480,
    esFlor: true,
  },
  {
    codigo: 'ROS-BLA',
    nombre: 'Rosa blanca',
    categoria: 'flor',
    unidadBase: 'tallo',
    stockMinimo: 150,
    costo: 2.0,
    apertura: 30,
    esFlor: true,
  },
  {
    codigo: 'ROS-ROS',
    nombre: 'Rosa rosada',
    categoria: 'flor',
    unidadBase: 'tallo',
    stockMinimo: 150,
    costo: 1.9,
    apertura: 260,
    esFlor: true,
  },
  {
    codigo: 'GIR-AMA',
    nombre: 'Girasol',
    categoria: 'flor',
    unidadBase: 'tallo',
    stockMinimo: 40,
    costo: 3.5,
    apertura: 58,
    esFlor: true,
  },
  {
    codigo: 'LIR-BLA',
    nombre: 'Lirio blanco',
    categoria: 'flor',
    unidadBase: 'tallo',
    stockMinimo: 40,
    costo: 4.2,
    apertura: 44,
    esFlor: true,
  },
  {
    codigo: 'EUC-VER',
    nombre: 'Eucalipto',
    categoria: 'follaje',
    unidadBase: 'g',
    stockMinimo: 1500,
    costo: 0.03,
    apertura: 3200,
    esFlor: false,
  },
  {
    codigo: 'GYP-BLA',
    nombre: 'Gypsophila',
    categoria: 'follaje',
    unidadBase: 'g',
    stockMinimo: 1000,
    costo: 0.05,
    apertura: 900,
    esFlor: false,
  },
  {
    codigo: 'PAP-KRA',
    nombre: 'Papel coreano kraft',
    categoria: 'papel',
    unidadBase: 'hoja',
    stockMinimo: 200,
    costo: 0.9,
    apertura: 340,
    esFlor: false,
  },
  {
    codigo: 'PAP-NEG',
    nombre: 'Papel coreano negro',
    categoria: 'papel',
    unidadBase: 'hoja',
    stockMinimo: 150,
    costo: 1.1,
    apertura: 60,
    esFlor: false,
  },
  {
    codigo: 'PAP-CEL',
    nombre: 'Celofán transparente',
    categoria: 'papel',
    unidadBase: 'm',
    stockMinimo: 50,
    costo: 0.6,
    apertura: 80,
    esFlor: false,
  },
  {
    codigo: 'CIN-SAT',
    nombre: 'Cinta satín',
    categoria: 'accesorio',
    unidadBase: 'm',
    stockMinimo: 60,
    costo: 0.5,
    apertura: 120,
    esFlor: false,
  },
  {
    codigo: 'REL-MUS',
    nombre: 'Relleno musgo',
    categoria: 'relleno',
    unidadBase: 'g',
    stockMinimo: 2000,
    costo: 0.02,
    apertura: 5000,
    esFlor: false,
  },
  {
    codigo: 'PEL-OSS',
    nombre: 'Peluche oso talla S',
    categoria: 'peluche',
    unidadBase: 'und',
    stockMinimo: 6,
    costo: 18.0,
    apertura: 8,
    esFlor: false,
  },
  {
    codigo: 'PEL-OSM',
    nombre: 'Peluche oso talla M',
    categoria: 'peluche',
    unidadBase: 'und',
    stockMinimo: 5,
    costo: 30.0,
    apertura: 0,
    esFlor: false,
  },
  {
    codigo: 'CAJ-RED',
    nombre: 'Caja redonda',
    categoria: 'accesorio',
    unidadBase: 'und',
    stockMinimo: 10,
    costo: 12.0,
    apertura: 22,
    esFlor: false,
  },
  {
    codigo: 'TAR-DED',
    nombre: 'Tarjeta dedicatoria',
    categoria: 'accesorio',
    unidadBase: 'und',
    stockMinimo: 100,
    costo: 0.4,
    apertura: 300,
    esFlor: false,
  },
] as const;

const DISTRITOS = [
  { nombre: 'Miraflores', tarifaMoto: 12, tarifaCarro: 20 },
  { nombre: 'San Isidro', tarifaMoto: 12, tarifaCarro: 20 },
  { nombre: 'Lince', tarifaMoto: 12, tarifaCarro: 20 },
  { nombre: 'Jesús María', tarifaMoto: 13, tarifaCarro: 21 },
  { nombre: 'San Borja', tarifaMoto: 14, tarifaCarro: 22 },
  { nombre: 'Barranco', tarifaMoto: 15, tarifaCarro: 24 },
  { nombre: 'Surco', tarifaMoto: 15, tarifaCarro: 25 },
  { nombre: 'La Molina', tarifaMoto: 20, tarifaCarro: 32 },
];

export async function seedCatalogo(db: Db, adminUserId: string): Promise<void> {
  const codigoAId = await seedInsumos(db, adminUserId);
  const productoIds = await seedProductos(db, codigoAId);
  await seedReglasCambio(db, productoIds, codigoAId);
  await seedExtras(db, codigoAId);
  await seedDistritos(db);
  await seedCostosVehiculo(db);
}

async function seedInsumos(
  db: Db,
  adminUserId: string,
): Promise<Map<string, string>> {
  const codigoAId = new Map<string, string>();

  for (const row of INSUMOS) {
    const [existente] = await db
      .select()
      .from(insumos)
      .where(eq(insumos.codigo, row.codigo))
      .limit(1);
    if (existente) {
      codigoAId.set(row.codigo, existente.id);
      continue;
    }

    const [creado] = await db
      .insert(insumos)
      .values({
        codigo: row.codigo,
        nombre: row.nombre,
        categoria: row.categoria,
        unidadBase: row.unidadBase,
        stockMinimo: String(row.stockMinimo),
        costoPromedio: String(row.costo),
        stockActual: String(row.apertura),
        esFlor: row.esFlor,
        esCaja: row.codigo.startsWith('CAJ'),
      })
      .returning();
    codigoAId.set(row.codigo, creado.id);

    if (row.apertura > 0) {
      await db.insert(kardexMovimientos).values({
        insumoId: creado.id,
        tipo: 'apertura',
        entrada: String(row.apertura),
        salida: '0',
        costoUnitario: String(row.costo),
        saldoResultante: String(row.apertura),
        referenciaTipo: 'apertura',
        usuarioId: adminUserId,
      });
    }
  }

  return codigoAId;
}

async function seedProductos(
  db: Db,
  codigoAId: Map<string, string>,
): Promise<Map<string, string>> {
  const slugAId = new Map<string, string>();
  const id = (codigo: string): string => {
    const value = codigoAId.get(codigo);
    if (!value) throw new Error(`Insumo "${codigo}" no fue sembrado`);
    return value;
  };

  const PRODUCTOS = [
    {
      slug: 'ramo-clasico-de-rosas',
      nombre: 'Ramo Clásico de Rosas',
      florPrincipal: 'ROS-ROJ',
      usaPapel: true,
      papelDefault: 'PAP-KRA',
      precios: { S: 89, M: 149, L: 289 },
      cantidadFlor: { S: 12, M: 24, L: 50 },
      cantidadEucalipto: { S: 60, M: 120, L: 220 },
      cantidadGypsophila: { S: 20, M: 40, L: 80 } as Record<
        string,
        number
      > | null,
      cantidadPapel: { S: 4, M: 6, L: 10 } as Record<string, number> | null,
      cantidadCinta: { S: 1, M: 1.5, L: 2 } as Record<string, number> | null,
      cantidadCaja: null as Record<string, number> | null,
      cantidadMusgo: null as Record<string, number> | null,
      floresPermitidas: [
        {
          codigo: 'ROS-BLA',
          ajusteModo: 'por_unidad' as const,
          ajusteMonto: 0.5,
          descripcion: 'Rosa roja → rosa blanca',
        },
        {
          codigo: 'ROS-ROS',
          ajusteModo: 'por_unidad' as const,
          ajusteMonto: 0,
          descripcion: 'Rosa roja → rosa rosada',
        },
      ],
    },
    {
      slug: 'ramo-sol',
      nombre: 'Ramo Sol',
      florPrincipal: 'GIR-AMA',
      usaPapel: true,
      papelDefault: 'PAP-KRA',
      precios: { S: 79, M: 129, L: 219 },
      cantidadFlor: { S: 6, M: 12, L: 24 },
      cantidadEucalipto: { S: 60, M: 120, L: 220 },
      cantidadGypsophila: null,
      cantidadPapel: { S: 4, M: 6, L: 10 },
      cantidadCinta: { S: 1, M: 1.5, L: 2 },
      cantidadCaja: null,
      cantidadMusgo: null,
      floresPermitidas: [],
    },
    {
      slug: 'box-de-lirios',
      nombre: 'Box de Lirios',
      florPrincipal: 'LIR-BLA',
      usaPapel: false,
      papelDefault: null,
      precios: { S: 139, M: 199, L: 269 },
      cantidadFlor: { S: 5, M: 9, L: 14 },
      cantidadEucalipto: { S: 60, M: 120, L: 220 },
      cantidadGypsophila: { S: 20, M: 40, L: 80 },
      cantidadPapel: null,
      cantidadCinta: null,
      cantidadCaja: { S: 1, M: 1, L: 1 },
      cantidadMusgo: { S: 150, M: 250, L: 400 },
      floresPermitidas: [],
    },
  ];

  for (const p of PRODUCTOS) {
    const [existente] = await db
      .select()
      .from(productos)
      .where(eq(productos.slug, p.slug))
      .limit(1);
    if (existente) {
      slugAId.set(p.slug, existente.id);
      continue;
    }

    const [creado] = await db
      .insert(productos)
      .values({
        nombre: p.nombre,
        slug: p.slug,
        florPrincipalId: id(p.florPrincipal),
        usaPapel: p.usaPapel,
        papelDefaultId: p.papelDefault ? id(p.papelDefault) : null,
      })
      .returning();
    slugAId.set(p.slug, creado.id);

    for (const talla of ['S', 'M', 'L'] as const) {
      const [productoTalla] = await db
        .insert(productoTallas)
        .values({
          productoId: creado.id,
          talla,
          precioBase: String(p.precios[talla]),
        })
        .returning();

      const lineas: {
        insumoId: string;
        cantidad: number;
        rol: 'flor_principal' | 'papel' | 'otro';
      }[] = [
        {
          insumoId: id(p.florPrincipal),
          cantidad: p.cantidadFlor[talla],
          rol: 'flor_principal',
        },
        {
          insumoId: id('EUC-VER'),
          cantidad: p.cantidadEucalipto[talla],
          rol: 'otro',
        },
      ];
      if (p.cantidadGypsophila)
        lineas.push({
          insumoId: id('GYP-BLA'),
          cantidad: p.cantidadGypsophila[talla],
          rol: 'otro',
        });
      if (p.cantidadPapel && p.papelDefault) {
        lineas.push({
          insumoId: id(p.papelDefault),
          cantidad: p.cantidadPapel[talla],
          rol: 'papel',
        });
      }
      if (p.cantidadCinta)
        lineas.push({
          insumoId: id('CIN-SAT'),
          cantidad: p.cantidadCinta[talla],
          rol: 'otro',
        });
      if (p.cantidadCaja)
        lineas.push({
          insumoId: id('CAJ-RED'),
          cantidad: p.cantidadCaja[talla],
          rol: 'otro',
        });
      if (p.cantidadMusgo)
        lineas.push({
          insumoId: id('REL-MUS'),
          cantidad: p.cantidadMusgo[talla],
          rol: 'otro',
        });
      lineas.push({ insumoId: id('TAR-DED'), cantidad: 1, rol: 'otro' });

      await db.insert(recetaLineas).values(
        lineas.map((l) => ({
          productoTallaId: productoTalla.id,
          insumoId: l.insumoId,
          cantidad: String(l.cantidad),
          rol: l.rol,
        })),
      );
    }

    if (p.floresPermitidas.length) {
      await db.insert(productoFloresPermitidas).values(
        p.floresPermitidas.map((f) => ({
          productoId: creado.id,
          insumoId: id(f.codigo),
        })),
      );
    }
  }

  return slugAId;
}

async function seedReglasCambio(
  db: Db,
  productoIds: Map<string, string>,
  codigoAId: Map<string, string>,
): Promise<void> {
  const [{ count }] = await db
    .select({ count: rawSql<number>`count(*)` })
    .from(reglasCambio);
  if (Number(count) > 0) return;

  const ramoClasicoId = productoIds.get('ramo-clasico-de-rosas');
  if (!ramoClasicoId) return;

  await db.insert(reglasCambio).values([
    {
      tipo: 'papel',
      insumoOrigenId: codigoAId.get('PAP-KRA'),
      insumoDestinoId: codigoAId.get('PAP-NEG'),
      ajusteModo: 'fijo',
      ajusteMonto: '5.00',
      estado: 'aprobado',
      descripcion: 'Papel kraft → negro',
    },
    {
      tipo: 'papel',
      insumoOrigenId: codigoAId.get('PAP-KRA'),
      insumoDestinoId: codigoAId.get('PAP-CEL'),
      ajusteModo: 'fijo',
      ajusteMonto: '-3.00',
      estado: 'aprobado',
      descripcion: 'Papel kraft → celofán',
    },
    {
      tipo: 'flor',
      productoId: ramoClasicoId,
      insumoOrigenId: codigoAId.get('ROS-ROJ'),
      insumoDestinoId: codigoAId.get('ROS-BLA'),
      ajusteModo: 'por_unidad',
      ajusteMonto: '0.50',
      estado: 'aprobado',
      descripcion: 'Rosa roja → rosa blanca',
    },
    {
      tipo: 'flor',
      productoId: ramoClasicoId,
      insumoOrigenId: codigoAId.get('ROS-ROJ'),
      insumoDestinoId: codigoAId.get('ROS-ROS'),
      ajusteModo: 'por_unidad',
      ajusteMonto: '0',
      estado: 'aprobado',
      descripcion: 'Rosa roja → rosa rosada',
    },
    {
      tipo: 'flor',
      productoId: ramoClasicoId,
      insumoOrigenId: codigoAId.get('ROS-ROJ'),
      insumoDestinoId: codigoAId.get('GIR-AMA'),
      ajusteModo: 'fijo',
      ajusteMonto: '0',
      estado: 'consultar',
      descripcion:
        'Rosas → girasol en Ramo Clásico (requiere consulta a producción)',
    },
  ]);
}

async function seedExtras(
  db: Db,
  codigoAId: Map<string, string>,
): Promise<void> {
  const [{ count }] = await db
    .select({ count: rawSql<number>`count(*)` })
    .from(extras);
  if (Number(count) > 0) return;

  await db.insert(extras).values([
    {
      nombre: 'Peluche oso talla S',
      insumoId: codigoAId.get('PEL-OSS')!,
      precio: '35.00',
      fuerzaCarro: false,
    },
    {
      nombre: 'Peluche oso talla M',
      insumoId: codigoAId.get('PEL-OSM')!,
      precio: '55.00',
      fuerzaCarro: false,
    },
    {
      nombre: 'Caja redonda',
      insumoId: codigoAId.get('CAJ-RED')!,
      precio: '25.00',
      fuerzaCarro: true,
    },
  ]);
}

async function seedDistritos(db: Db): Promise<void> {
  for (const d of DISTRITOS) {
    await db
      .insert(distritos)
      .values({
        nombre: d.nombre,
        tarifaMoto: String(d.tarifaMoto),
        tarifaCarro: String(d.tarifaCarro),
      })
      .onConflictDoNothing({ target: distritos.nombre });
  }
}

async function seedCostosVehiculo(db: Db): Promise<void> {
  await db
    .insert(costosVehiculo)
    .values({ vehiculo: 'moto', costoPorViaje: '10.00' })
    .onConflictDoNothing();
  await db
    .insert(costosVehiculo)
    .values({ vehiculo: 'carro', costoPorViaje: '19.00' })
    .onConflictDoNothing();
}
