import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  calcularPrecio,
  calcularVehiculo,
  recetaEfectiva,
  type AjusteAplicado,
  type LineaCantidad,
  type RecetaLineaBase,
  type Talla,
  type Vehiculo,
} from '@erp/shared';
import type { Exec } from '../../db/client';
import {
  extras,
  insumos,
  productoFloresPermitidas,
  productoTallas,
  productos,
  recetaLineas,
  reglasCambio,
} from '../../db/schema';

type Insumo = typeof insumos.$inferSelect;
type Regla = typeof reglasCambio.$inferSelect;
type Extra = typeof extras.$inferSelect;
type Producto = typeof productos.$inferSelect;
type ProductoTalla = typeof productoTallas.$inferSelect;

/** Catálogo que se necesita para resolver ítems; se carga una vez por request. */
export interface ContextoCatalogo {
  insumoPorId: Map<string, Insumo>;
  /** Insumos de tipo caja (fuerzan carro, sección 5.5). */
  insumosCaja: Set<string>;
  reglasActivas: Regla[];
  extraPorId: Map<string, Extra>;
  /** productoId → flores aceptadas como cambio (producto_flores_permitidas). */
  floresPermitidas: Map<string, Set<string>>;
}

export interface ItemSolicitado {
  productoId: string;
  talla: Talla;
  cantidad: number;
  florId?: string;
  papelId?: string | null;
  extraIds: string[];
  cambioNoListado?: string;
}

export interface ItemResuelto {
  producto: Producto;
  talla: ProductoTalla;
  lineasBase: RecetaLineaBase[];
  cantidad: number;
  florId: string;
  papelId: string | null;
  extras: Extra[];
  precioUnitario: number;
  subtotal: number;
  ajustes: AjusteAplicado[];
  recetaEfectiva: LineaCantidad[];
  vehiculo: Vehiculo;
  /** Motivos por los que el ítem necesita una consulta a Producción (5.4). Vacío = no requiere. */
  consultas: string[];
}

/** Resultado de evaluar un cambio de flor o papel contra reglas y flores permitidas. */
export interface EvaluacionCambio {
  ajuste: number;
  ajusteModo: 'fijo' | 'por_unidad' | null;
  estado: 'aprobado' | 'consultar';
  reglaId?: string;
  /** false = no hay regla ni flor permitida: es un cambio no listado. */
  listado: boolean;
}

/**
 * Resuelve un ítem de pedido (5.1, 5.2, 5.4, 5.5) con las mismas reglas para
 * el cotizador y para la creación del pedido, así el precio cotizado y el
 * precio guardado son siempre el mismo.
 */
@Injectable()
export class ItemResolverService {
  async cargarContexto(exec: Exec): Promise<ContextoCatalogo> {
    const todosInsumos = await exec.select().from(insumos);
    const reglasActivas = await exec
      .select()
      .from(reglasCambio)
      .where(eq(reglasCambio.activo, true));
    const todosExtras = await exec.select().from(extras);
    const permitidas = await exec.select().from(productoFloresPermitidas);

    const floresPermitidas = new Map<string, Set<string>>();
    for (const p of permitidas) {
      const set = floresPermitidas.get(p.productoId) ?? new Set<string>();
      set.add(p.insumoId);
      floresPermitidas.set(p.productoId, set);
    }

    return {
      insumoPorId: new Map(todosInsumos.map((i) => [i.id, i])),
      insumosCaja: new Set(
        todosInsumos.filter((i) => i.esCaja).map((i) => i.id),
      ),
      reglasActivas,
      extraPorId: new Map(todosExtras.map((e) => [e.id, e])),
      floresPermitidas,
    };
  }

  async cargarProducto(exec: Exec, productoId: string): Promise<Producto> {
    const [producto] = await exec
      .select()
      .from(productos)
      .where(eq(productos.id, productoId))
      .limit(1);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (!producto.activo)
      throw new BadRequestException(
        `El producto "${producto.nombre}" está inactivo`,
      );
    return producto;
  }

  async cargarTalla(
    exec: Exec,
    producto: Producto,
    talla: Talla,
  ): Promise<{ talla: ProductoTalla; lineasBase: RecetaLineaBase[] }> {
    const [fila] = await exec
      .select()
      .from(productoTallas)
      .where(
        and(
          eq(productoTallas.productoId, producto.id),
          eq(productoTallas.talla, talla),
        ),
      )
      .limit(1);
    if (!fila || !fila.activo)
      throw new BadRequestException(
        `"${producto.nombre}" no se vende en talla ${talla}`,
      );

    const lineasRaw = await exec
      .select()
      .from(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, fila.id));
    if (!lineasRaw.length)
      throw new BadRequestException(
        `"${producto.nombre}" talla ${talla} no tiene receta cargada`,
      );

    return {
      talla: fila,
      lineasBase: lineasRaw.map((l) => ({
        insumoId: l.insumoId,
        cantidad: Number(l.cantidad),
        rol: l.rol as RecetaLineaBase['rol'],
      })),
    };
  }

  /**
   * Evalúa un cambio origen → destino. Prioridad: regla específica del
   * producto > regla general > flor permitida sin regla (sin recargo) >
   * cambio no listado.
   */
  evaluarCambio(
    ctx: ContextoCatalogo,
    params: {
      tipo: 'flor' | 'papel';
      productoId: string;
      origenId: string | null;
      destinoId: string;
      cantidadBase: number;
    },
  ): EvaluacionCambio {
    const candidatas = ctx.reglasActivas.filter(
      (r) =>
        r.tipo === params.tipo &&
        r.insumoOrigenId === params.origenId &&
        r.insumoDestinoId === params.destinoId &&
        (r.productoId === null || r.productoId === params.productoId),
    );
    const regla =
      candidatas.find((r) => r.productoId === params.productoId) ??
      candidatas[0];

    if (regla) {
      const modo = regla.ajusteModo as 'fijo' | 'por_unidad';
      return {
        ajuste:
          modo === 'por_unidad'
            ? Number(regla.ajusteMonto) * params.cantidadBase
            : Number(regla.ajusteMonto),
        ajusteModo: modo,
        estado: regla.estado,
        reglaId: regla.id,
        listado: true,
      };
    }

    if (
      params.tipo === 'flor' &&
      ctx.floresPermitidas.get(params.productoId)?.has(params.destinoId)
    ) {
      return { ajuste: 0, ajusteModo: null, estado: 'aprobado', listado: true };
    }

    return { ajuste: 0, ajusteModo: null, estado: 'consultar', listado: false };
  }

  async resolver(
    exec: Exec,
    ctx: ContextoCatalogo,
    solicitado: ItemSolicitado,
  ): Promise<ItemResuelto> {
    const producto = await this.cargarProducto(exec, solicitado.productoId);
    const { talla, lineasBase } = await this.cargarTalla(
      exec,
      producto,
      solicitado.talla,
    );
    return this.resolverConReceta(ctx, producto, talla, lineasBase, solicitado);
  }

  /** Parte pura de la resolución (sin acceso a BD), reutilizada por el cotizador. */
  resolverConReceta(
    ctx: ContextoCatalogo,
    producto: Producto,
    talla: ProductoTalla,
    lineasBase: RecetaLineaBase[],
    solicitado: ItemSolicitado,
  ): ItemResuelto {
    const nombre = (id: string) => ctx.insumoPorId.get(id)?.nombre ?? '—';
    const cantidadFlorBase =
      lineasBase.find((l) => l.rol === 'flor_principal')?.cantidad ?? 0;
    const cantidadPapelBase =
      lineasBase.find((l) => l.rol === 'papel')?.cantidad ?? 0;

    // Flor
    const florId = solicitado.florId ?? producto.florPrincipalId;
    const flor = ctx.insumoPorId.get(florId);
    if (!flor || !flor.activo || !flor.esFlor)
      throw new BadRequestException(
        'La flor elegida no existe o no está activa',
      );

    // Papel
    const papelId = producto.usaPapel
      ? (solicitado.papelId ?? producto.papelDefaultId)
      : null;
    if (papelId) {
      const papel = ctx.insumoPorId.get(papelId);
      if (!papel || !papel.activo)
        throw new BadRequestException(
          'El papel elegido no existe o no está activo',
        );
    }

    // Extras: todos deben existir y estar activos; se ignoran duplicados.
    const extraIds = [...new Set(solicitado.extraIds)];
    const invalidos = extraIds.filter((id) => !ctx.extraPorId.get(id)?.activo);
    if (invalidos.length)
      throw new BadRequestException(
        `Extras inexistentes o inactivos: ${invalidos.join(', ')}`,
      );
    const extrasSel = extraIds.map((id) => ctx.extraPorId.get(id) as Extra);

    const ajustes: AjusteAplicado[] = [];
    const consultas: string[] = [];

    if (florId !== producto.florPrincipalId) {
      const ev = this.evaluarCambio(ctx, {
        tipo: 'flor',
        productoId: producto.id,
        origenId: producto.florPrincipalId,
        destinoId: florId,
        cantidadBase: cantidadFlorBase,
      });
      ajustes.push({
        descripcion: `Cambio de flor: ${nombre(florId)}`,
        ajuste: ev.ajuste,
        reglaId: ev.reglaId,
      });
      if (ev.estado === 'consultar')
        consultas.push(
          `Cambio de flor ${nombre(producto.florPrincipalId)} → ${nombre(florId)} ${ev.listado ? 'requiere consulta' : 'no listado'} (${producto.nombre} ${talla.talla})`,
        );
    }

    if (papelId && papelId !== producto.papelDefaultId) {
      const ev = this.evaluarCambio(ctx, {
        tipo: 'papel',
        productoId: producto.id,
        origenId: producto.papelDefaultId,
        destinoId: papelId,
        cantidadBase: cantidadPapelBase,
      });
      ajustes.push({
        descripcion: `Cambio de papel: ${nombre(papelId)}`,
        ajuste: ev.ajuste,
        reglaId: ev.reglaId,
      });
      if (ev.estado === 'consultar')
        consultas.push(
          `Cambio de papel → ${nombre(papelId)} ${ev.listado ? 'requiere consulta' : 'no listado'} (${producto.nombre} ${talla.talla})`,
        );
    }

    // Pedido especial escrito por la vendedora: siempre va a Producción (5.4).
    const textoLibre = solicitado.cambioNoListado?.trim();
    if (textoLibre) consultas.push(textoLibre);

    const { precioUnitario, subtotal } = calcularPrecio({
      precioBase: Number(talla.precioBase),
      ajustes,
      extrasPrecio: extrasSel.map((e) => Number(e.precio)),
      cantidad: solicitado.cantidad,
    });

    const efectiva = recetaEfectiva({
      lineasBase,
      florId,
      usaPapel: producto.usaPapel,
      papelId,
      extraInsumoIds: extrasSel.map((e) => e.insumoId),
      cantidad: solicitado.cantidad,
    });

    const vehiculo = calcularVehiculo({
      talla: talla.talla,
      recetaEfectiva: efectiva,
      insumosCaja: ctx.insumosCaja,
      algunExtraFuerzaCarro: extrasSel.some((e) => e.fuerzaCarro),
    });

    return {
      producto,
      talla,
      lineasBase,
      cantidad: solicitado.cantidad,
      florId,
      papelId,
      extras: extrasSel,
      precioUnitario,
      subtotal,
      ajustes,
      recetaEfectiva: efectiva,
      vehiculo,
      consultas,
    };
  }
}
