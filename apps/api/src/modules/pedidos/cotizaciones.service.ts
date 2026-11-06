import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  calcularDisponible,
  calcularEnvio,
  calcularPrecio,
  calcularVehiculo,
  recetaEfectiva,
  type AjusteAplicado,
  type CotizacionInput,
  type RecetaLineaBase,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import {
  distritos,
  extras,
  insumos,
  productoTallas,
  productos,
  recetaLineas,
  reglasCambio,
} from '../../db/schema';
import { DisponibilidadService } from './disponibilidad.service';

export interface OpcionCotizacion {
  insumoId: string;
  nombre: string;
  ajusteModo: 'fijo' | 'por_unidad' | null;
  ajuste: number;
  estado: 'aprobado' | 'consultar';
  disponible: boolean;
  motivo?: string;
}

export interface OpcionExtra {
  id: string;
  insumoId: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  motivo?: string;
}

export interface ResultadoCotizacion {
  productoId: string;
  talla: string;
  cantidad: number;
  florId: string;
  papelId: string | null;
  extraIds: string[];
  precioUnitario: number;
  subtotal: number;
  ajustes: AjusteAplicado[];
  vehiculo: 'moto' | 'carro';
  costoEnvio: number;
  total: number;
  opciones: {
    flores: OpcionCotizacion[];
    papeles: OpcionCotizacion[];
    extras: OpcionExtra[];
  };
}

@Injectable()
export class CotizacionesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly disponibilidadService: DisponibilidadService,
  ) {}

  async cotizar(input: CotizacionInput): Promise<ResultadoCotizacion> {
    const [producto] = await this.db
      .select()
      .from(productos)
      .where(eq(productos.id, input.productoId))
      .limit(1);
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const [talla] = await this.db
      .select()
      .from(productoTallas)
      .where(
        and(
          eq(productoTallas.productoId, producto.id),
          eq(productoTallas.talla, input.talla),
        ),
      )
      .limit(1);
    if (!talla)
      throw new NotFoundException(
        `El producto no tiene la talla ${input.talla}`,
      );

    const [distrito] = await this.db
      .select()
      .from(distritos)
      .where(eq(distritos.id, input.distritoId))
      .limit(1);
    if (!distrito) throw new NotFoundException('Distrito no encontrado');

    const lineasRaw = await this.db
      .select()
      .from(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, talla.id));
    const lineasBase: RecetaLineaBase[] = lineasRaw.map((l) => ({
      insumoId: l.insumoId,
      cantidad: Number(l.cantidad),
      rol: l.rol as RecetaLineaBase['rol'],
    }));
    const lineaFlor = lineasBase.find((l) => l.rol === 'flor_principal');
    const lineaPapel = lineasBase.find((l) => l.rol === 'papel');

    const reservados = await this.disponibilidadService.calcularReservados();
    const todosInsumos = await this.db.select().from(insumos);
    const insumoPorId = new Map(todosInsumos.map((i) => [i.id, i]));
    const insumosCaja = new Set(
      todosInsumos
        .filter((i) => i.codigo.toUpperCase().startsWith('CAJ'))
        .map((i) => i.id),
    );
    const disponibleDe = (insumoId: string): number => {
      const insumo = insumoPorId.get(insumoId);
      return calcularDisponible(
        Number(insumo?.stockActual ?? '0'),
        reservados.get(insumoId) ?? 0,
      );
    };

    const reglasActivas = await this.db
      .select()
      .from(reglasCambio)
      .where(eq(reglasCambio.activo, true));
    const reglasAplicables = reglasActivas.filter(
      (r) => r.productoId === null || r.productoId === producto.id,
    );

    const florId = input.florId ?? producto.florPrincipalId;
    const papelId = producto.usaPapel
      ? (input.papelId ?? producto.papelDefaultId)
      : null;

    const opcionesFlores = this.construirOpciones({
      insumoOrigenId: producto.florPrincipalId,
      insumoDestinoDefault: producto.florPrincipalId,
      tipo: 'flor',
      reglasAplicables,
      insumoPorId,
      cantidadBase: lineaFlor?.cantidad ?? 0,
      itemCantidad: input.cantidad,
      disponibleDe,
    });

    const opcionesPapeles = producto.usaPapel
      ? this.construirOpciones({
          insumoOrigenId: producto.papelDefaultId,
          insumoDestinoDefault: producto.papelDefaultId,
          tipo: 'papel',
          reglasAplicables,
          insumoPorId,
          cantidadBase: lineaPapel?.cantidad ?? 0,
          itemCantidad: input.cantidad,
          disponibleDe,
        })
      : [];

    const todosExtras = await this.db
      .select()
      .from(extras)
      .where(eq(extras.activo, true));
    const opcionesExtras: OpcionExtra[] = todosExtras.map((e) => {
      const disponible = disponibleDe(e.insumoId) >= input.cantidad;
      return {
        id: e.id,
        insumoId: e.insumoId,
        nombre: e.nombre,
        precio: Number(e.precio),
        disponible,
        motivo: disponible ? undefined : 'Stock insuficiente',
      };
    });

    const ajustes: AjusteAplicado[] = [];
    if (florId !== producto.florPrincipalId) {
      const opcion = opcionesFlores.find((o) => o.insumoId === florId);
      if (!opcion)
        throw new BadRequestException(
          'La flor elegida no está entre las opciones disponibles',
        );
      ajustes.push({
        descripcion: `Cambio de flor: ${opcion.nombre}`,
        ajuste: opcion.ajuste,
        reglaId: undefined,
      });
    }
    if (papelId && producto.usaPapel && papelId !== producto.papelDefaultId) {
      const opcion = opcionesPapeles.find((o) => o.insumoId === papelId);
      if (!opcion)
        throw new BadRequestException(
          'El papel elegido no está entre las opciones disponibles',
        );
      ajustes.push({
        descripcion: `Cambio de papel: ${opcion.nombre}`,
        ajuste: opcion.ajuste,
      });
    }

    const extrasSeleccionados = todosExtras.filter((e) =>
      input.extraIds.includes(e.id),
    );

    const { precioUnitario, subtotal } = calcularPrecio({
      precioBase: Number(talla.precioBase),
      ajustes,
      extrasPrecio: extrasSeleccionados.map((e) => Number(e.precio)),
      cantidad: input.cantidad,
    });

    const efectiva = recetaEfectiva({
      lineasBase,
      florId,
      usaPapel: producto.usaPapel,
      papelId,
      extraInsumoIds: extrasSeleccionados.map((e) => e.insumoId),
      cantidad: input.cantidad,
    });

    const vehiculo = calcularVehiculo({
      talla: input.talla,
      recetaEfectiva: efectiva,
      insumosCaja,
      algunExtraFuerzaCarro: extrasSeleccionados.some((e) => e.fuerzaCarro),
    });
    const costoEnvio = calcularEnvio(vehiculo, {
      tarifaMoto: Number(distrito.tarifaMoto),
      tarifaCarro: Number(distrito.tarifaCarro),
    });

    return {
      productoId: producto.id,
      talla: input.talla,
      cantidad: input.cantidad,
      florId,
      papelId,
      extraIds: extrasSeleccionados.map((e) => e.id),
      precioUnitario,
      subtotal,
      ajustes,
      vehiculo,
      costoEnvio,
      total: Math.round((subtotal + costoEnvio + Number.EPSILON) * 100) / 100,
      opciones: {
        flores: opcionesFlores,
        papeles: opcionesPapeles,
        extras: opcionesExtras,
      },
    };
  }

  private construirOpciones(params: {
    insumoOrigenId: string | null;
    insumoDestinoDefault: string | null;
    tipo: 'flor' | 'papel';
    reglasAplicables: (typeof reglasCambio.$inferSelect)[];
    insumoPorId: Map<string, typeof insumos.$inferSelect>;
    cantidadBase: number;
    itemCantidad: number;
    disponibleDe: (insumoId: string) => number;
  }): OpcionCotizacion[] {
    if (!params.insumoDestinoDefault) return [];
    const defaultInsumo = params.insumoPorId.get(params.insumoDestinoDefault);
    const necesario = params.cantidadBase * params.itemCantidad;

    const opciones: OpcionCotizacion[] = [
      {
        insumoId: params.insumoDestinoDefault,
        nombre: defaultInsumo?.nombre ?? '—',
        ajusteModo: null,
        ajuste: 0,
        estado: 'aprobado',
        disponible:
          params.disponibleDe(params.insumoDestinoDefault) >= necesario,
      },
    ];

    const reglasDelTipo = params.reglasAplicables.filter(
      (r) =>
        r.tipo === params.tipo &&
        r.insumoOrigenId === params.insumoOrigenId &&
        r.insumoDestinoId,
    );

    for (const regla of reglasDelTipo) {
      const destinoId = regla.insumoDestinoId as string;
      const insumoDestino = params.insumoPorId.get(destinoId);
      const disponible = params.disponibleDe(destinoId) >= necesario;
      const ajuste =
        regla.ajusteModo === 'por_unidad'
          ? Number(regla.ajusteMonto) * params.cantidadBase
          : Number(regla.ajusteMonto);
      opciones.push({
        insumoId: destinoId,
        nombre: insumoDestino?.nombre ?? '—',
        ajusteModo: regla.ajusteModo as 'fijo' | 'por_unidad',
        ajuste,
        estado: regla.estado as 'aprobado' | 'consultar',
        disponible,
        motivo: disponible ? undefined : 'Stock insuficiente',
      });
    }

    return opciones;
  }
}
