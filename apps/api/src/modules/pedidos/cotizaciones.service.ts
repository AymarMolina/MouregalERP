import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import {
  calcularEnvio,
  faltantes,
  sumarRecetas,
  type CotizacionPedidoInput,
  type AjusteAplicado,
  type CotizacionInput,
  type RecetaLineaBase,
  type Talla,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { distritos, productoTallas, recetaLineas } from '../../db/schema';
import { DisponibilidadService } from './disponibilidad.service';
import {
  ItemResolverService,
  type ContextoCatalogo,
  type ItemResuelto,
  type ItemSolicitado,
} from './item-resolver.service';

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

export interface OpcionTalla {
  talla: Talla;
  precioBase: number;
  disponible: boolean;
  motivo?: string;
}

export interface FaltanteDetalle {
  insumoId: string;
  nombre: string;
  necesario: number;
  disponible: number;
}

export interface ResultadoCotizacion {
  productoId: string;
  talla: Talla;
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
  /** La selección actual completa cabe en el stock disponible. */
  disponible: boolean;
  faltantes: FaltanteDetalle[];
  /** La selección generará una consulta a Producción al crear el pedido. */
  requiereConsulta: boolean;
  consultas: string[];
  opciones: {
    tallas: OpcionTalla[];
    flores: OpcionCotizacion[];
    papeles: OpcionCotizacion[];
    extras: OpcionExtra[];
  };
}

@Injectable()
export class CotizacionesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly disponibilidad: DisponibilidadService,
    private readonly resolver: ItemResolverService,
  ) {}

  async cotizar(input: CotizacionInput): Promise<ResultadoCotizacion> {
    const [distrito] = await this.db
      .select()
      .from(distritos)
      .where(eq(distritos.id, input.distritoId))
      .limit(1);
    if (!distrito || !distrito.activo)
      throw new NotFoundException('Distrito no encontrado o inactivo');

    const ctx = await this.resolver.cargarContexto(this.db);
    const producto = await this.resolver.cargarProducto(
      this.db,
      input.productoId,
    );
    const { talla, lineasBase } = await this.resolver.cargarTalla(
      this.db,
      producto,
      input.talla,
    );
    const disponibleBase = await this.disponibilidad.disponibleDe(this.db);
    // Lo que ya está en el carrito de este pedido también consume stock.
    const enCarrito = new Map<string, number>();
    for (const otro of input.itemsEnCarrito) {
      const r = await this.resolver.resolver(this.db, ctx, otro);
      for (const l of r.recetaEfectiva)
        enCarrito.set(
          l.insumoId,
          (enCarrito.get(l.insumoId) ?? 0) + l.cantidad,
        );
    }
    const disponibleDe = (id: string) =>
      Math.round((disponibleBase(id) - (enCarrito.get(id) ?? 0)) * 1000) / 1000;

    const seleccion: ItemSolicitado = {
      productoId: producto.id,
      talla: input.talla,
      cantidad: input.cantidad,
      florId: input.florId,
      papelId: input.papelId,
      extraIds: input.extraIds,
      cambioNoListado: input.cambioNoListado,
    };
    const item = this.resolver.resolverConReceta(
      ctx,
      producto,
      talla,
      lineasBase,
      seleccion,
    );
    const faltan = this.detallarFaltantes(ctx, item, disponibleDe);

    // Cada opción se evalúa con la receta efectiva COMPLETA que resultaría de elegirla (5.3).
    const evaluar = (
      cambio: Partial<ItemSolicitado>,
      tallaRow = talla,
      lineas = lineasBase,
    ): { disponible: boolean; motivo?: string } => {
      try {
        const alt = this.resolver.resolverConReceta(
          ctx,
          producto,
          tallaRow,
          lineas,
          {
            ...seleccion,
            florId: item.florId,
            papelId: item.papelId,
            extraIds: item.extras.map((e) => e.id),
            ...cambio,
          },
        );
        const f = this.detallarFaltantes(ctx, alt, disponibleDe);
        return f.length
          ? { disponible: false, motivo: this.motivo(f) }
          : { disponible: true };
      } catch (e) {
        return { disponible: false, motivo: (e as Error).message };
      }
    };

    // Tallas
    const tallasRows = await this.db
      .select()
      .from(productoTallas)
      .where(eq(productoTallas.productoId, producto.id));
    const tallasActivas = tallasRows.filter((t) => t.activo);
    const lineasTallas = tallasActivas.length
      ? await this.db
          .select()
          .from(recetaLineas)
          .where(
            inArray(
              recetaLineas.productoTallaId,
              tallasActivas.map((t) => t.id),
            ),
          )
      : [];
    const opcionesTallas: OpcionTalla[] = tallasActivas.map((t) => {
      const lineas: RecetaLineaBase[] = lineasTallas
        .filter((l) => l.productoTallaId === t.id)
        .map((l) => ({
          insumoId: l.insumoId,
          cantidad: Number(l.cantidad),
          rol: l.rol as RecetaLineaBase['rol'],
        }));
      const ev = lineas.length
        ? evaluar({ talla: t.talla }, t, lineas)
        : { disponible: false, motivo: 'Sin receta cargada' };
      return { talla: t.talla, precioBase: Number(t.precioBase), ...ev };
    });

    // Flores: la principal + reglas de flor del producto + flores permitidas.
    const floresIds = new Set<string>([producto.florPrincipalId]);
    for (const r of ctx.reglasActivas) {
      if (
        r.tipo === 'flor' &&
        r.insumoOrigenId === producto.florPrincipalId &&
        r.insumoDestinoId &&
        (r.productoId === null || r.productoId === producto.id)
      )
        floresIds.add(r.insumoDestinoId);
    }
    for (const id of ctx.floresPermitidas.get(producto.id) ?? [])
      floresIds.add(id);
    const cantidadFlorBase =
      lineasBase.find((l) => l.rol === 'flor_principal')?.cantidad ?? 0;
    const opcionesFlores = [...floresIds]
      .filter((id) => ctx.insumoPorId.get(id)?.activo)
      .map((id) =>
        this.opcion(
          ctx,
          id,
          producto.florPrincipalId,
          () =>
            this.resolver.evaluarCambio(ctx, {
              tipo: 'flor',
              productoId: producto.id,
              origenId: producto.florPrincipalId,
              destinoId: id,
              cantidadBase: cantidadFlorBase,
            }),
          evaluar({ florId: id }),
        ),
      );

    // Papeles: el default + reglas de papel desde el default.
    let opcionesPapeles: OpcionCotizacion[] = [];
    if (producto.usaPapel && producto.papelDefaultId) {
      const papelDefault = producto.papelDefaultId;
      const papelesIds = new Set<string>([papelDefault]);
      for (const r of ctx.reglasActivas) {
        if (
          r.tipo === 'papel' &&
          r.insumoOrigenId === papelDefault &&
          r.insumoDestinoId &&
          (r.productoId === null || r.productoId === producto.id)
        )
          papelesIds.add(r.insumoDestinoId);
      }
      const cantidadPapelBase =
        lineasBase.find((l) => l.rol === 'papel')?.cantidad ?? 0;
      opcionesPapeles = [...papelesIds]
        .filter((id) => ctx.insumoPorId.get(id)?.activo)
        .map((id) =>
          this.opcion(
            ctx,
            id,
            papelDefault,
            () =>
              this.resolver.evaluarCambio(ctx, {
                tipo: 'papel',
                productoId: producto.id,
                origenId: papelDefault,
                destinoId: id,
                cantidadBase: cantidadPapelBase,
              }),
            evaluar({ papelId: id }),
          ),
        );
    }

    // Extras: se evalúa la selección con el extra agregado.
    const seleccionados = new Set(item.extras.map((e) => e.id));
    const opcionesExtras: OpcionExtra[] = [...ctx.extraPorId.values()]
      .filter((e) => e.activo)
      .map((e) => {
        const ev = evaluar({
          extraIds: [...new Set([...seleccionados, e.id])],
        });
        return {
          id: e.id,
          insumoId: e.insumoId,
          nombre: e.nombre,
          precio: Number(e.precio),
          ...ev,
        };
      });

    const costoEnvio = calcularEnvio(item.vehiculo, {
      tarifaMoto: Number(distrito.tarifaMoto),
      tarifaCarro: Number(distrito.tarifaCarro),
    });

    return {
      productoId: producto.id,
      talla: input.talla,
      cantidad: input.cantidad,
      florId: item.florId,
      papelId: item.papelId,
      extraIds: item.extras.map((e) => e.id),
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal,
      ajustes: item.ajustes.map(({ descripcion, ajuste }) => ({
        descripcion,
        ajuste,
      })),
      vehiculo: item.vehiculo,
      costoEnvio,
      total:
        Math.round((item.subtotal + costoEnvio + Number.EPSILON) * 100) / 100,
      disponible: faltan.length === 0,
      faltantes: faltan,
      requiereConsulta: item.consultas.length > 0,
      consultas: item.consultas,
      opciones: {
        tallas: opcionesTallas,
        flores: opcionesFlores,
        papeles: opcionesPapeles,
        extras: opcionesExtras,
      },
    };
  }

  /**
   * Cotiza el pedido completo (varios ítems) con las mismas reglas que usa
   * POST /pedidos: precio por ítem, vehículo (carro si algún ítem lo
   * requiere), envío, total, stock combinado y consultas que se abrirán.
   */
  async cotizarPedido(input: CotizacionPedidoInput) {
    const [distrito] = await this.db
      .select()
      .from(distritos)
      .where(eq(distritos.id, input.distritoId))
      .limit(1);
    if (!distrito || !distrito.activo)
      throw new NotFoundException('Distrito no encontrado o inactivo');

    const ctx = await this.resolver.cargarContexto(this.db);
    const items: ItemResuelto[] = [];
    for (const it of input.items)
      items.push(await this.resolver.resolver(this.db, ctx, it));

    const disponibleDe = await this.disponibilidad.disponibleDe(this.db);
    const faltan = faltantes(
      sumarRecetas(items.map((i) => i.recetaEfectiva)),
      disponibleDe,
    ).map((f) => ({
      ...f,
      nombre: ctx.insumoPorId.get(f.insumoId)?.nombre ?? '—',
    }));

    const subtotalProductos =
      Math.round(items.reduce((acc, i) => acc + i.subtotal, 0) * 100) / 100;
    const vehiculo = items.some((i) => i.vehiculo === 'carro')
      ? 'carro'
      : 'moto';
    const costoEnvio = calcularEnvio(vehiculo, {
      tarifaMoto: Number(distrito.tarifaMoto),
      tarifaCarro: Number(distrito.tarifaCarro),
    });

    return {
      items: items.map((i) => ({
        productoId: i.producto.id,
        producto: i.producto.nombre,
        talla: i.talla.talla,
        cantidad: i.cantidad,
        flor: ctx.insumoPorId.get(i.florId)?.nombre ?? '—',
        papel: i.papelId
          ? (ctx.insumoPorId.get(i.papelId)?.nombre ?? '—')
          : null,
        extras: i.extras.map((e) => e.nombre),
        precioUnitario: i.precioUnitario,
        subtotal: i.subtotal,
        ajustes: i.ajustes.map(({ descripcion, ajuste }) => ({
          descripcion,
          ajuste,
        })),
        vehiculo: i.vehiculo,
        consultas: i.consultas,
      })),
      subtotalProductos,
      vehiculo,
      costoEnvio,
      total: Math.round((subtotalProductos + costoEnvio) * 100) / 100,
      disponible: faltan.length === 0,
      faltantes: faltan,
      requiereConsulta: items.some((i) => i.consultas.length > 0),
    };
  }

  private opcion(
    ctx: ContextoCatalogo,
    insumoId: string,
    defaultId: string,
    evaluarCambio: () => ReturnType<ItemResolverService['evaluarCambio']>,
    stock: { disponible: boolean; motivo?: string },
  ): OpcionCotizacion {
    const ev =
      insumoId === defaultId
        ? { ajuste: 0, ajusteModo: null, estado: 'aprobado' as const }
        : evaluarCambio();
    return {
      insumoId,
      nombre: ctx.insumoPorId.get(insumoId)?.nombre ?? '—',
      ajusteModo: ev.ajusteModo,
      ajuste: ev.ajuste,
      estado: ev.estado,
      ...stock,
    };
  }

  private detallarFaltantes(
    ctx: ContextoCatalogo,
    item: ItemResuelto,
    disponibleDe: (id: string) => number,
  ): FaltanteDetalle[] {
    return faltantes(item.recetaEfectiva, disponibleDe).map((f) => ({
      ...f,
      nombre: ctx.insumoPorId.get(f.insumoId)?.nombre ?? '—',
    }));
  }

  private motivo(f: FaltanteDetalle[]): string {
    const partes = f
      .slice(0, 2)
      .map(
        (x) =>
          `${x.nombre} (necesita ${x.necesario}, hay ${Math.max(0, x.disponible)})`,
      );
    return `Sin stock: ${partes.join(', ')}${f.length > 2 ? '…' : ''}`;
  }
}
