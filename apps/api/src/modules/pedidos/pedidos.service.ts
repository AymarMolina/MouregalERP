import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, like } from 'drizzle-orm';
import {
  calcularEnvio,
  calcularPrecio,
  calcularVehiculo,
  recetaEfectiva,
  type AjusteAplicado,
  type ConsumoInput,
  type PedidoInput,
  type PedidoItemInput,
  type RecetaLineaBase,
} from '@erp/shared';
import type { EstadoPedido, Canal } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { KardexService } from '../inventario/kardex.service';
import {
  clientes,
  consultasProduccion,
  distritos,
  extras,
  insumos,
  pagos,
  pedidoConsumos,
  pedidoHistorialEstado,
  pedidoItemCambios,
  pedidoItemExtras,
  pedidoItems,
  pedidos,
  productoTallas,
  productos,
  recetaLineas,
  reglasCambio,
} from '../../db/schema';

const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ['en_armado', 'cancelado'],
  en_armado: ['cancelado'], // en_armado -> listo solo vía POST /pedidos/:id/consumo
  listo: ['en_camino', 'cancelado'],
  en_camino: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

interface ItemResuelto {
  input: PedidoItemInput;
  productoTallaId: string;
  papelId: string | null;
  precioUnitario: number;
  subtotal: number;
  ajustes: (AjusteAplicado & { reglaId?: string })[];
  recetaEfectiva: { insumoId: string; cantidad: number }[];
  requiereConsulta: boolean;
  descripcionConsulta?: string;
}

@Injectable()
export class PedidosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly kardexService: KardexService,
  ) {}

  async list(filtros: {
    fecha?: string;
    estado?: EstadoPedido;
    canal?: Canal;
    q?: string;
  }) {
    const condiciones = [];
    if (filtros.fecha)
      condiciones.push(eq(pedidos.fechaEntrega, filtros.fecha));
    if (filtros.estado) condiciones.push(eq(pedidos.estado, filtros.estado));
    if (filtros.canal) condiciones.push(eq(pedidos.canal, filtros.canal));
    if (filtros.q)
      condiciones.push(like(pedidos.nombreReceptor, `%${filtros.q}%`));

    return this.db
      .select()
      .from(pedidos)
      .where(condiciones.length ? and(...condiciones) : undefined)
      .orderBy(desc(pedidos.createdAt));
  }

  async findOne(id: string) {
    const [pedido] = await this.db
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, id))
      .limit(1);
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const items = await this.db
      .select()
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, id));
    const itemIds = items.map((i) => i.id);
    const itemExtras = itemIds.length
      ? await this.db
          .select()
          .from(pedidoItemExtras)
          .where(inArray(pedidoItemExtras.pedidoItemId, itemIds))
      : [];
    const cambios = await this.db.select().from(pedidoItemCambios);

    return {
      ...pedido,
      items,
      itemExtras,
      cambios: cambios.filter((c) => itemIds.includes(c.pedidoItemId)),
    };
  }

  async historial(id: string) {
    await this.findOne(id);
    return this.db
      .select()
      .from(pedidoHistorialEstado)
      .where(eq(pedidoHistorialEstado.pedidoId, id))
      .orderBy(desc(pedidoHistorialEstado.createdAt));
  }

  async asignar(
    id: string,
    asignacion: { encargadaId?: string | null; repartidorId?: string | null },
  ) {
    await this.findOne(id);
    const [actualizado] = await this.db
      .update(pedidos)
      .set({
        ...(asignacion.encargadaId !== undefined && {
          encargadaId: asignacion.encargadaId,
        }),
        ...(asignacion.repartidorId !== undefined && {
          repartidorId: asignacion.repartidorId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(pedidos.id, id))
      .returning();
    return actualizado;
  }

  /** Sección 5.6 — transiciones de estado (en_armado → listo va por confirmarConsumo). */
  async transicion(
    id: string,
    destino: EstadoPedido,
    nota: string | undefined,
    usuarioId: string,
  ) {
    const pedido = await this.findOne(id);

    const permitidas = TRANSICIONES_VALIDAS[pedido.estado];
    if (!permitidas.includes(destino)) {
      throw new BadRequestException(
        `No se puede pasar de "${pedido.estado}" a "${destino}"`,
      );
    }

    if (destino === 'en_armado') {
      if (!pedido.encargadaId) {
        throw new BadRequestException(
          'Asigna una encargada antes de pasar a en_armado',
        );
      }
      const [consultaAbierta] = await this.db
        .select({ id: consultasProduccion.id })
        .from(consultasProduccion)
        .where(
          and(
            eq(consultasProduccion.pedidoId, id),
            eq(consultasProduccion.estado, 'abierta'),
          ),
        )
        .limit(1);
      if (consultaAbierta) {
        throw new BadRequestException(
          'El pedido tiene una consulta abierta; resuélvela antes de armar',
        );
      }
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(pedidos)
        .set({ estado: destino, updatedAt: new Date() })
        .where(eq(pedidos.id, id));
      await tx.insert(pedidoHistorialEstado).values({
        pedidoId: id,
        estadoAnterior: pedido.estado,
        estadoNuevo: destino,
        usuarioId,
        nota:
          nota ??
          (destino === 'cancelado' &&
          (pedido.estado === 'listo' || pedido.estado === 'en_camino')
            ? 'Cancelado: los insumos ya consumidos quedan registrados como merma, no vuelven al stock'
            : undefined),
      });
    });

    return this.findOne(id);
  }

  /** Receta efectiva del pedido agregada por insumo, para la pantalla de confirmar consumo. */
  async recetaEfectivaDelPedido(
    id: string,
  ): Promise<{ insumoId: string; nombre: string; cantidad: number }[]> {
    const pedido = await this.findOne(id);
    if (pedido.estado !== 'en_armado') {
      throw new BadRequestException('Solo aplica a pedidos en_armado');
    }

    const items = await this.db
      .select()
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, id));
    const totalPorInsumo = new Map<string, number>();
    for (const item of items) {
      const efectiva = await this.recetaEfectivaDeItem(item);
      for (const l of efectiva) {
        totalPorInsumo.set(
          l.insumoId,
          (totalPorInsumo.get(l.insumoId) ?? 0) + l.cantidad,
        );
      }
    }

    const insumosInfo = await this.db
      .select()
      .from(insumos)
      .where(inArray(insumos.id, [...totalPorInsumo.keys()]));
    const nombrePorInsumo = new Map(insumosInfo.map((i) => [i.id, i.nombre]));

    return [...totalPorInsumo.entries()].map(([insumoId, cantidad]) => ({
      insumoId,
      nombre: nombrePorInsumo.get(insumoId) ?? '—',
      cantidad,
    }));
  }

  /**
   * Sección 5.7 — confirmar consumo (una sola transacción). `lineas` viene
   * agrupada por insumo a nivel de todo el pedido; se reparte entre los
   * ítems que usan ese insumo según su participación en la receta efectiva.
   */
  async confirmarConsumo(id: string, input: ConsumoInput, usuarioId: string) {
    const pedido = await this.findOne(id);
    if (pedido.estado !== 'en_armado') {
      throw new BadRequestException(
        'Solo se puede confirmar consumo de un pedido en_armado',
      );
    }

    const items = await this.db
      .select()
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, id));
    if (!items.length)
      throw new BadRequestException('El pedido no tiene ítems');

    // receta efectiva por ítem, y cuánto de cada insumo aporta cada ítem al total del pedido.
    const recetaPorItem = new Map<
      string,
      { insumoId: string; cantidad: number }[]
    >();
    const totalPorInsumo = new Map<string, number>();
    for (const item of items) {
      const efectiva = await this.recetaEfectivaDeItem(item);
      recetaPorItem.set(item.id, efectiva);
      for (const l of efectiva) {
        totalPorInsumo.set(
          l.insumoId,
          (totalPorInsumo.get(l.insumoId) ?? 0) + l.cantidad,
        );
      }
    }

    const usadoPorInsumo = new Map<string, number>();
    for (const [insumoId, cantidadReceta] of totalPorInsumo) {
      const linea = input.lineas.find((l) => l.insumoId === insumoId);
      usadoPorInsumo.set(
        insumoId,
        linea ? linea.cantidadUsada : cantidadReceta,
      );
    }

    const insumosInfo = await this.db
      .select()
      .from(insumos)
      .where(inArray(insumos.id, [...totalPorInsumo.keys()]));
    const costoPorInsumo = new Map(
      insumosInfo.map((i) => [i.id, Number(i.costoPromedio)]),
    );

    await this.db.transaction(async (tx) => {
      for (const [insumoId, cantidadReceta] of totalPorInsumo) {
        const cantidadUsada = usadoPorInsumo.get(insumoId) ?? cantidadReceta;
        const consumoSalida = Math.min(cantidadUsada, cantidadReceta);
        const mermaSalida = Math.max(0, cantidadUsada - cantidadReceta);
        const costoUnitario = costoPorInsumo.get(insumoId) ?? 0;

        await this.kardexService.registrarMovimiento(tx, {
          insumoId,
          tipo: 'consumo',
          salida: consumoSalida,
          costoUnitario,
          referenciaTipo: 'pedido',
          referenciaId: id,
          usuarioId,
        });
        if (mermaSalida > 0) {
          await this.kardexService.registrarMovimiento(tx, {
            insumoId,
            tipo: 'merma',
            salida: mermaSalida,
            costoUnitario,
            referenciaTipo: 'pedido',
            referenciaId: id,
            nota: `usó ${cantidadUsada} de ${cantidadReceta}`,
            usuarioId,
          });
        }

        // reparte lo usado entre los ítems que aportan a este insumo, proporcional a su receta.
        for (const item of items) {
          const lineaItem = (recetaPorItem.get(item.id) ?? []).find(
            (l) => l.insumoId === insumoId,
          );
          if (!lineaItem) continue;
          const participacion = lineaItem.cantidad / cantidadReceta;
          const usadoDelItem =
            Math.round(
              (cantidadUsada * participacion + Number.EPSILON) * 1000,
            ) / 1000;
          await tx.insert(pedidoConsumos).values({
            pedidoItemId: item.id,
            insumoId,
            cantidadReceta: String(lineaItem.cantidad),
            cantidadUsada: String(usadoDelItem),
            confirmadoPor: usuarioId,
          });
        }
      }

      await tx
        .update(pedidos)
        .set({ estado: 'listo', updatedAt: new Date() })
        .where(eq(pedidos.id, id));
      await tx.insert(pedidoHistorialEstado).values({
        pedidoId: id,
        estadoAnterior: 'en_armado',
        estadoNuevo: 'listo',
        usuarioId,
        nota: 'Consumo confirmado',
      });
    });

    return this.findOne(id);
  }

  private async recetaEfectivaDeItem(
    item: typeof pedidoItems.$inferSelect,
  ): Promise<{ insumoId: string; cantidad: number }[]> {
    const [talla] = await this.db
      .select()
      .from(productoTallas)
      .where(eq(productoTallas.id, item.productoTallaId))
      .limit(1);
    if (!talla) throw new NotFoundException('Talla de producto no encontrada');
    const [producto] = await this.db
      .select()
      .from(productos)
      .where(eq(productos.id, talla.productoId))
      .limit(1);
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const lineasRaw = await this.db
      .select()
      .from(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, talla.id));
    const lineasBase: RecetaLineaBase[] = lineasRaw.map((l) => ({
      insumoId: l.insumoId,
      cantidad: Number(l.cantidad),
      rol: l.rol as RecetaLineaBase['rol'],
    }));

    const itemExtras = await this.db
      .select({ insumoId: extras.insumoId })
      .from(pedidoItemExtras)
      .innerJoin(extras, eq(pedidoItemExtras.extraId, extras.id))
      .where(eq(pedidoItemExtras.pedidoItemId, item.id));

    return recetaEfectiva({
      lineasBase,
      florId: item.florId,
      usaPapel: producto.usaPapel,
      papelId: item.papelId,
      extraInsumoIds: itemExtras.map((e) => e.insumoId),
      cantidad: item.cantidad,
    });
  }

  async crear(input: PedidoInput, creadoPor: string) {
    const [distrito] = await this.db
      .select()
      .from(distritos)
      .where(eq(distritos.id, input.distritoId))
      .limit(1);
    if (!distrito) throw new NotFoundException('Distrito no encontrado');

    const todosInsumos = await this.db.select().from(insumos);
    const insumosCaja = new Set(
      todosInsumos
        .filter((i) => i.codigo.toUpperCase().startsWith('CAJ'))
        .map((i) => i.id),
    );
    const reglasActivas = await this.db
      .select()
      .from(reglasCambio)
      .where(eq(reglasCambio.activo, true));
    const todosExtras = await this.db.select().from(extras);

    const itemsResueltos: ItemResuelto[] = [];
    for (const itemInput of input.items) {
      itemsResueltos.push(
        await this.resolverItem(itemInput, {
          insumosCaja,
          reglasActivas,
          todosExtras,
        }),
      );
    }

    const subtotalProductos =
      Math.round(
        (itemsResueltos.reduce((acc, i) => acc + i.subtotal, 0) +
          Number.EPSILON) *
          100,
      ) / 100;
    // Carro si CUALQUIER ítem lo requiere (sección 5.5).
    const vehiculo = itemsResueltos.some(
      (i, idx) =>
        calcularVehiculo({
          talla: input.items[idx].talla,
          recetaEfectiva: i.recetaEfectiva,
          insumosCaja,
          algunExtraFuerzaCarro: todosExtras.some(
            (e) => i.input.extraIds.includes(e.id) && e.fuerzaCarro,
          ),
        }) === 'carro',
    )
      ? 'carro'
      : 'moto';
    const costoEnvio = calcularEnvio(vehiculo, {
      tarifaMoto: Number(distrito.tarifaMoto),
      tarifaCarro: Number(distrito.tarifaCarro),
    });
    const total =
      Math.round((subtotalProductos + costoEnvio + Number.EPSILON) * 100) / 100;

    const cliente = await this.resolverCliente(input.cliente);

    const pedido = await this.db.transaction(async (tx) => {
      const [creado] = await tx
        .insert(pedidos)
        .values({
          canal: input.canal,
          clienteId: cliente.id,
          estado: 'pendiente',
          fechaEntrega: input.fechaEntrega,
          horaEntrega: input.horaEntrega,
          distritoId: input.distritoId,
          direccion: input.direccion,
          referencia: input.referencia,
          telefonoReceptor: input.telefonoReceptor,
          nombreReceptor: input.nombreReceptor,
          dedicatoria: input.dedicatoria,
          vehiculo,
          subtotalProductos: String(subtotalProductos),
          costoEnvio: String(costoEnvio),
          total: String(total),
          creadoPor,
        })
        .returning();

      for (const item of itemsResueltos) {
        const [pedidoItem] = await tx
          .insert(pedidoItems)
          .values({
            pedidoId: creado.id,
            productoTallaId: item.productoTallaId,
            cantidad: item.input.cantidad,
            florId: item.input.florId,
            papelId: item.papelId,
            precioUnitario: String(item.precioUnitario),
            subtotal: String(item.subtotal),
          })
          .returning();

        for (const extraId of item.input.extraIds) {
          const extra = todosExtras.find((e) => e.id === extraId);
          if (!extra) continue;
          await tx.insert(pedidoItemExtras).values({
            pedidoItemId: pedidoItem.id,
            extraId,
            precio: extra.precio,
          });
        }

        for (const ajuste of item.ajustes) {
          await tx.insert(pedidoItemCambios).values({
            pedidoItemId: pedidoItem.id,
            reglaId: ajuste.reglaId ?? null,
            descripcion: ajuste.descripcion,
            ajuste: String(ajuste.ajuste),
          });
        }

        if (item.requiereConsulta) {
          await tx.insert(consultasProduccion).values({
            pedidoId: creado.id,
            descripcion:
              item.descripcionConsulta ??
              'Cambio no listado, requiere revisión de Producción',
            creadaPor: creadoPor,
          });
        }
      }

      await tx.insert(pedidoHistorialEstado).values({
        pedidoId: creado.id,
        estadoAnterior: null,
        estadoNuevo: 'pendiente',
        usuarioId: creadoPor,
        nota: 'Pedido creado',
      });

      const montoAdelanto =
        Math.round(
          (total * (input.porcentajeAdelanto / 100) + Number.EPSILON) * 100,
        ) / 100;
      await tx.insert(pagos).values({
        pedidoId: creado.id,
        tipo: 'adelanto',
        metodo: 'link',
        monto: String(montoAdelanto),
        estado: 'pendiente',
      });

      return creado;
    });

    return this.findOne(pedido.id);
  }

  private async resolverItem(
    itemInput: PedidoItemInput,
    ctx: {
      insumosCaja: Set<string>;
      reglasActivas: (typeof reglasCambio.$inferSelect)[];
      todosExtras: (typeof extras.$inferSelect)[];
    },
  ): Promise<ItemResuelto> {
    const [producto] = await this.db
      .select()
      .from(productos)
      .where(eq(productos.id, itemInput.productoId))
      .limit(1);
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const [talla] = await this.db
      .select()
      .from(productoTallas)
      .where(
        and(
          eq(productoTallas.productoId, producto.id),
          eq(productoTallas.talla, itemInput.talla),
        ),
      )
      .limit(1);
    if (!talla)
      throw new NotFoundException(
        `El producto no tiene la talla ${itemInput.talla}`,
      );

    const lineasRaw = await this.db
      .select()
      .from(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, talla.id));
    const lineasBase: RecetaLineaBase[] = lineasRaw.map((l) => ({
      insumoId: l.insumoId,
      cantidad: Number(l.cantidad),
      rol: l.rol as RecetaLineaBase['rol'],
    }));
    const cantidadFlorBase =
      lineasBase.find((l) => l.rol === 'flor_principal')?.cantidad ?? 0;
    const cantidadPapelBase =
      lineasBase.find((l) => l.rol === 'papel')?.cantidad ?? 0;

    const papelId = producto.usaPapel
      ? (itemInput.papelId ?? producto.papelDefaultId)
      : null;

    const ajustes: (AjusteAplicado & { reglaId?: string })[] = [];
    let requiereConsulta = false;
    let descripcionConsulta: string | undefined;

    if (itemInput.florId !== producto.florPrincipalId) {
      const regla = ctx.reglasActivas.find(
        (r) =>
          r.tipo === 'flor' &&
          (r.productoId === null || r.productoId === producto.id) &&
          r.insumoOrigenId === producto.florPrincipalId &&
          r.insumoDestinoId === itemInput.florId,
      );
      if (!regla || regla.estado === 'consultar') {
        requiereConsulta = true;
        descripcionConsulta =
          itemInput.cambioNoListado ??
          `Cambio de flor no aprobado (producto ${producto.nombre})`;
      }
      if (regla) {
        const ajuste =
          regla.ajusteModo === 'por_unidad'
            ? Number(regla.ajusteMonto) * cantidadFlorBase
            : Number(regla.ajusteMonto);
        ajustes.push({
          descripcion: 'Cambio de flor',
          ajuste,
          reglaId: regla.id,
        });
      }
    }

    if (papelId && producto.usaPapel && papelId !== producto.papelDefaultId) {
      const regla = ctx.reglasActivas.find(
        (r) =>
          r.tipo === 'papel' &&
          (r.productoId === null || r.productoId === producto.id) &&
          r.insumoOrigenId === producto.papelDefaultId &&
          r.insumoDestinoId === papelId,
      );
      if (!regla || regla.estado === 'consultar') {
        requiereConsulta = true;
        descripcionConsulta =
          descripcionConsulta ??
          itemInput.cambioNoListado ??
          `Cambio de papel no aprobado (producto ${producto.nombre})`;
      }
      if (regla) {
        const ajuste =
          regla.ajusteModo === 'por_unidad'
            ? Number(regla.ajusteMonto) * cantidadPapelBase
            : Number(regla.ajusteMonto);
        ajustes.push({
          descripcion: 'Cambio de papel',
          ajuste,
          reglaId: regla.id,
        });
      }
    }

    const extrasSeleccionados = ctx.todosExtras.filter((e) =>
      itemInput.extraIds.includes(e.id),
    );

    const { precioUnitario, subtotal } = calcularPrecio({
      precioBase: Number(talla.precioBase),
      ajustes,
      extrasPrecio: extrasSeleccionados.map((e) => Number(e.precio)),
      cantidad: itemInput.cantidad,
    });

    const efectiva = recetaEfectiva({
      lineasBase,
      florId: itemInput.florId,
      usaPapel: producto.usaPapel,
      papelId,
      extraInsumoIds: extrasSeleccionados.map((e) => e.insumoId),
      cantidad: itemInput.cantidad,
    });

    return {
      input: itemInput,
      productoTallaId: talla.id,
      papelId,
      precioUnitario,
      subtotal,
      ajustes,
      recetaEfectiva: efectiva,
      requiereConsulta,
      descripcionConsulta,
    };
  }

  private async resolverCliente(cliente: PedidoInput['cliente']) {
    if (cliente.telefono) {
      const [existente] = await this.db
        .select()
        .from(clientes)
        .where(eq(clientes.telefono, cliente.telefono))
        .limit(1);
      if (existente) return existente;
    }
    const [creado] = await this.db
      .insert(clientes)
      .values({
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        email: cliente.email,
      })
      .returning();
    return creado;
  }
}
