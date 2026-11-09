import { BadRequestException } from '@nestjs/common';
import type { RecetaLineaBase } from '@erp/shared';
import {
  ItemResolverService,
  type ContextoCatalogo,
} from './item-resolver.service';

/** Catálogo mínimo basado en el seed (sección 11): Ramo Clásico de Rosas. */
function crearContexto(): ContextoCatalogo {
  const insumo = (id: string, codigo: string, nombre: string, esFlor = false) =>
    [
      id,
      {
        id,
        codigo,
        nombre,
        esFlor,
        activo: true,
        categoria: esFlor ? 'flor' : 'accesorio',
        unidadBase: 'und',
        stockMinimo: '0',
        stockActual: '0',
        costoPromedio: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as const;

  const extra = (
    id: string,
    insumoId: string,
    precio: string,
    fuerzaCarro = false,
    activo = true,
  ) =>
    [
      id,
      {
        id,
        nombre: id,
        insumoId,
        precio,
        fuerzaCarro,
        activo,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as const;

  const regla = (
    id: string,
    tipo: 'flor' | 'papel',
    origen: string,
    destino: string,
    modo: 'fijo' | 'por_unidad',
    monto: string,
    estado: 'aprobado' | 'consultar',
    productoId: string | null = 'ramo',
  ) => ({
    id,
    tipo,
    productoId,
    insumoOrigenId: origen,
    insumoDestinoId: destino,
    descripcion: null,
    ajusteModo: modo,
    ajusteMonto: monto,
    estado,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    insumoPorId: new Map([
      insumo('ros-roj', 'ROS-ROJ', 'Rosa roja', true),
      insumo('ros-bla', 'ROS-BLA', 'Rosa blanca', true),
      insumo('lir-bla', 'LIR-BLA', 'Lirio blanco', true),
      insumo('gir-ama', 'GIR-AMA', 'Girasol', true),
      insumo('pap-kra', 'PAP-KRA', 'Papel kraft'),
      insumo('pap-neg', 'PAP-NEG', 'Papel negro'),
      insumo('euc', 'EUC-VER', 'Eucalipto'),
      insumo('caj', 'CAJ-RED', 'Caja redonda'),
      insumo('pel', 'PEL-OSS', 'Peluche S'),
    ]) as unknown as ContextoCatalogo['insumoPorId'],
    insumosCaja: new Set(['caj']),
    reglasActivas: [
      regla(
        'r-bla',
        'flor',
        'ros-roj',
        'ros-bla',
        'por_unidad',
        '0.50',
        'aprobado',
      ),
      regla('r-gir', 'flor', 'ros-roj', 'gir-ama', 'fijo', '0', 'consultar'),
      regla(
        'r-neg',
        'papel',
        'pap-kra',
        'pap-neg',
        'fijo',
        '5.00',
        'aprobado',
        null,
      ),
    ] as unknown as ContextoCatalogo['reglasActivas'],
    extraPorId: new Map([
      extra('peluche', 'pel', '35.00'),
      extra('caja', 'caj', '25.00', true),
      extra('viejo', 'pel', '10.00', false, false),
    ]) as unknown as ContextoCatalogo['extraPorId'],
    floresPermitidas: new Map([['ramo', new Set(['ros-bla', 'lir-bla'])]]),
  };
}

const producto = {
  id: 'ramo',
  nombre: 'Ramo Clásico de Rosas',
  slug: 'ramo-clasico',
  descripcion: null,
  florPrincipalId: 'ros-roj',
  usaPapel: true,
  papelDefaultId: 'pap-kra',
  imagenUrl: null,
  shopifyProductId: null,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const talla = (t: 'S' | 'M' | 'L', precio: string) => ({
  id: `talla-${t}`,
  productoId: 'ramo',
  talla: t,
  precioBase: precio,
  shopifyVariantId: null,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const lineas = (flores: number): RecetaLineaBase[] => [
  { insumoId: 'ros-roj', cantidad: flores, rol: 'flor_principal' },
  { insumoId: 'euc', cantidad: 60, rol: 'otro' },
  { insumoId: 'pap-kra', cantidad: 4, rol: 'papel' },
];

describe('ItemResolverService.resolverConReceta', () => {
  const service = new ItemResolverService();
  const ctx = crearContexto();
  const base = {
    productoId: 'ramo',
    cantidad: 1,
    extraIds: [] as string[],
  };

  it('Ramo Clásico L con rosa roja → carro (spec fase 3)', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('L', '289'),
      lineas(50),
      {
        ...base,
        talla: 'L',
        florId: 'ros-roj',
      },
    );
    expect(r.vehiculo).toBe('carro');
    expect(r.precioUnitario).toBe(289);
    expect(r.consultas).toEqual([]);
  });

  it('talla S sin caja ni extras → moto', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('S', '89'),
      lineas(12),
      {
        ...base,
        talla: 'S',
      },
    );
    expect(r.vehiculo).toBe('moto');
    expect(r.florId).toBe('ros-roj');
    expect(r.papelId).toBe('pap-kra');
  });

  it('aplica la regla por_unidad de cambio de flor (12 × 0.50)', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('S', '89'),
      lineas(12),
      {
        ...base,
        talla: 'S',
        florId: 'ros-bla',
      },
    );
    expect(r.precioUnitario).toBe(95);
    expect(r.ajustes[0]).toMatchObject({ ajuste: 6, reglaId: 'r-bla' });
    expect(r.consultas).toEqual([]);
  });

  it('una flor permitida sin regla se acepta sin recargo ni consulta', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('S', '89'),
      lineas(12),
      {
        ...base,
        talla: 'S',
        florId: 'lir-bla',
      },
    );
    expect(r.precioUnitario).toBe(89);
    expect(r.consultas).toEqual([]);
  });

  it('una regla en estado "consultar" genera consulta a Producción', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('S', '89'),
      lineas(12),
      {
        ...base,
        talla: 'S',
        florId: 'gir-ama',
      },
    );
    expect(r.consultas).toHaveLength(1);
  });

  it('el texto de cambio no listado genera consulta aunque no cambie flor ni papel', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('S', '89'),
      lineas(12),
      {
        ...base,
        talla: 'S',
        cambioNoListado: 'Agregar lazo dorado',
      },
    );
    expect(r.consultas).toEqual(['Agregar lazo dorado']);
  });

  it('extra que fuerza carro y regla de papel suman al precio', () => {
    const r = service.resolverConReceta(
      ctx,
      producto,
      talla('S', '89'),
      lineas(12),
      {
        ...base,
        talla: 'S',
        papelId: 'pap-neg',
        extraIds: ['caja', 'caja'],
      },
    );
    expect(r.precioUnitario).toBe(89 + 5 + 25);
    expect(r.extras).toHaveLength(1);
    expect(r.vehiculo).toBe('carro');
  });

  it('rechaza extras inactivos o inexistentes', () => {
    for (const extraIds of [['viejo'], ['no-existe']]) {
      expect(() =>
        service.resolverConReceta(ctx, producto, talla('S', '89'), lineas(12), {
          ...base,
          talla: 'S',
          extraIds,
        }),
      ).toThrow(BadRequestException);
    }
  });

  it('rechaza un insumo que no es flor como flor', () => {
    expect(() =>
      service.resolverConReceta(ctx, producto, talla('S', '89'), lineas(12), {
        ...base,
        talla: 'S',
        florId: 'euc',
      }),
    ).toThrow(BadRequestException);
  });
});
