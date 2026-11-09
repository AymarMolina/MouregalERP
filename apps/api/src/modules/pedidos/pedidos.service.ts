import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  calcularEnvio,
  calcularSaldo,
  desglosarConsumo,
  faltantes,
  repartirUsado,
  sumarRecetas,
  validarDespacho,
  validarEntrega,
  validarTransicion,
  type ConsumoInput,
  type DespacharInput,
  type EstadoPedido,
  type Canal,
  type LineaCantidad,
  type PedidoInput,
  type RolUsuario,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db, Exec, Tx } from '../../db/client';
import { KardexService } from '../inventario/kardex.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PagosService } from '../pagos/pagos.service';
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
  usuarios,
} from '../../db/schema';
import { DisponibilidadService } from './disponibilidad.service';
import {
  ItemResolverService,
  type ItemResuelto,
} from './item-resolver.service';

export interface Actor {
  sub: string;
  rol: RolUsuario;
}

const MENSAJE_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'Recibimos tu pedido.',
  en_armado: 'Estamos armando tu pedido.',
  listo: 'Tu pedido está listo para salir.',
  en_camino: 'Tu pedido va en camino.',
  entregado: 'Tu pedido fue entregado. ¡Gracias!',
  cancelado: 'Tu pedido fue cancelado.',
};

/** Serializa la reserva de stock entre creaciones de pedido concurrentes (5.3). */
const LOCK_RESERVA_STOCK = sql`select pg_advisory_xact_lock(hashtext('erp:reserva_stock'))`;

@Injectable()
export class PedidosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly kardexService: KardexService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly resolver: ItemResolverService,
    private readonly pagos: PagosService,
    private readonly config: ConfigService,
    private readonly notificaciones: NotificacionesService,
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
    const q = filtros.q?.trim();
    if (q) {
      const patron = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      const porTexto = or(
        ilike(pedidos.nombreReceptor, patron),
        ilike(pedidos.telefonoReceptor, patron),
        ilike(pedidos.direccion, patron),
      );
      const numero = Number(q.replace(/^#/, ''));
      condiciones.push(
        Number.isInteger(numero) && numero > 0
          ? or(porTexto, eq(pedidos.numero, numero))
          : porTexto,
      );
    }

    return this.db
      .select()
      .from(pedidos)
      .where(condiciones.length ? and(...condiciones) : undefined)
      .orderBy(desc(pedidos.createdAt));
  }

  async findOne(id: string, exec: Exec = this.db) {
    const [pedido] = await exec
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, id))
      .limit(1);
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const filas = await exec
      .select({
        item: pedidoItems,
        producto: productos.nombre,
        talla: productoTallas.talla,
      })
      .from(pedidoItems)
      .innerJoin(
        productoTallas,
        eq(pedidoItems.productoTallaId, productoTallas.id),
      )
      .innerJoin(productos, eq(productoTallas.productoId, productos.id))
      .where(eq(pedidoItems.pedidoId, id));
    const itemIds = filas.map((f) => f.item.id);
    const [itemExtras, cambios, extrasNombres] = itemIds.length
      ? await Promise.all([
          exec
            .select()
            .from(pedidoItemExtras)
            .where(inArray(pedidoItemExtras.pedidoItemId, itemIds)),
          exec
            .select()
            .from(pedidoItemCambios)
            .where(inArray(pedidoItemCambios.pedidoItemId, itemIds)),
          exec
            .select({
              pedidoItemId: pedidoItemExtras.pedidoItemId,
              nombre: extras.nombre,
            })
            .from(pedidoItemExtras)
            .innerJoin(extras, eq(pedidoItemExtras.extraId, extras.id))
            .where(inArray(pedidoItemExtras.pedidoItemId, itemIds)),
        ])
      : [[], [], []];

    const insumoIds = [
      ...new Set(
        filas.flatMap((f) =>
          [f.item.florId, f.item.papelId].filter((x): x is string => !!x),
        ),
      ),
    ];
    const nombres = insumoIds.length
      ? await exec
          .select({ id: insumos.id, nombre: insumos.nombre })
          .from(insumos)
          .where(inArray(insumos.id, insumoIds))
      : [];
    const nombreInsumo = new Map(nombres.map((n) => [n.id, n.nombre]));

    // Cada ítem con lo que la comanda necesita mostrar.
    const items = filas.map((f) => ({
      ...f.item,
      producto: f.producto,
      talla: f.talla,
      flor: nombreInsumo.get(f.item.florId) ?? null,
      papel: f.item.papelId ? (nombreInsumo.get(f.item.papelId) ?? null) : null,
      extras: extrasNombres
        .filter((e) => e.pedidoItemId === f.item.id)
        .map((e) => e.nombre),
      cambios: cambios
        .filter((c) => c.pedidoItemId === f.item.id)
        .map((c) => ({ descripcion: c.descripcion, ajuste: c.ajuste })),
    }));

    return { ...pedido, items, itemExtras, cambios };
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
    if (asignacion.encargadaId)
      await this.validarUsuarioConRol(
        asignacion.encargadaId,
        'produccion',
        'encargada',
      );
    if (asignacion.repartidorId)
      await this.validarUsuarioConRol(
        asignacion.repartidorId,
        'delivery',
        'repartidor',
      );

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

  private async validarUsuarioConRol(
    usuarioId: string,
    rol: RolUsuario,
    etiqueta: string,
  ) {
    const [u] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);
    if (!u || !u.activo || (u.rol !== rol && u.rol !== 'admin'))
      throw new BadRequestException(
        `El usuario elegido como ${etiqueta} no existe, está inactivo o no tiene rol ${rol}`,
      );
  }

  /** Bloquea la fila del pedido hasta el fin de la transacción. */
  private async bloquearPedido(tx: Tx, id: string) {
    const [pedido] = await tx
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, id))
      .for('update')
      .limit(1);
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    return pedido;
  }

  /**
   * Sección 5.6 — transiciones de estado (en_armado → listo va por
   * confirmarConsumo). Todo se valida con el pedido bloqueado, así dos
   * usuarios no pueden mover el mismo pedido a la vez.
   */
  async transicion(
    id: string,
    destino: EstadoPedido,
    nota: string | undefined,
    actor: Actor,
  ) {
    await this.db.transaction((tx) =>
      this.aplicarTransicion(tx, id, destino, nota, actor),
    );
    return this.findOne(id);
  }

  /**
   * "Enviar link y despachar" (pantalla Delivery): si hay saldo y aún no
   * hay link, lo genera y envía; asigna el repartidor y pasa a en_camino,
   * todo en una sola transacción.
   */
  async despachar(id: string, input: DespacharInput, actor: Actor) {
    await this.db.transaction(async (tx) => {
      const pedido = await this.bloquearPedido(tx, id);
      if (pedido.estado !== 'listo')
        throw new BadRequestException(
          `Solo se despachan pedidos listos (está en "${pedido.estado}")`,
        );

      // Un repartidor se asigna a sí mismo; admin/vendedora pueden elegir uno.
      const repartidorId =
        actor.rol === 'delivery'
          ? actor.sub
          : (input.repartidorId ?? pedido.repartidorId);
      if (repartidorId && repartidorId !== pedido.repartidorId) {
        if (actor.rol !== 'delivery')
          await this.validarUsuarioConRol(
            repartidorId,
            'delivery',
            'repartidor',
          );
        await tx
          .update(pedidos)
          .set({ repartidorId, updatedAt: new Date() })
          .where(eq(pedidos.id, id));
      }

      const saldo = calcularSaldo(
        Number(pedido.total),
        Number(pedido.totalPagado),
      );
      if (saldo > 0 && !(await this.pagos.tieneLinkSaldo(tx, id))) {
        await this.pagos.generarLinkSaldoEnTx(tx, pedido);
      }

      await this.aplicarTransicion(tx, id, 'en_camino', undefined, actor);
    });
    return this.findOne(id);
  }

  private async aplicarTransicion(
    tx: Tx,
    id: string,
    destino: EstadoPedido,
    nota: string | undefined,
    actor: Actor,
  ) {
    const pedido = await this.bloquearPedido(tx, id);

    const v = validarTransicion(actor.rol, pedido.estado, destino);
    if (!v.ok) throw new BadRequestException(v.motivo);

    const notas: string[] = [];
    if (nota) notas.push(nota);

    if (destino === 'en_armado') {
      if (!pedido.encargadaId) {
        throw new BadRequestException(
          'Asigna una encargada antes de pasar a en_armado',
        );
      }
      const [consultaAbierta] = await tx
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

    const saldo = calcularSaldo(
      Number(pedido.total),
      Number(pedido.totalPagado),
    );
    if (destino === 'en_camino') {
      const r = validarDespacho({
        saldo,
        linkSaldoGenerado: await this.pagos.tieneLinkSaldo(tx, id),
      });
      if (!r.ok) throw new BadRequestException(r.motivo);
    }
    if (destino === 'entregado') {
      const r = validarEntrega({
        saldo,
        permitirConSaldo: this.permitirEntregaConSaldo(),
      });
      if (!r.ok) throw new BadRequestException(r.motivo);
      if (r.advertencia) notas.push(r.advertencia);
    }
    if (
      destino === 'cancelado' &&
      (pedido.estado === 'listo' || pedido.estado === 'en_camino')
    ) {
      notas.push(
        'Cancelado: los insumos ya consumidos se reportan como merma, no vuelven al stock',
      );
    }
    if (destino === 'cancelado') {
      // Los cobros pendientes de un pedido cancelado ya no aplican.
      await tx
        .update(pagos)
        .set({ estado: 'anulado' })
        .where(and(eq(pagos.pedidoId, id), eq(pagos.estado, 'pendiente')));
    }

    await tx
      .update(pedidos)
      .set({ estado: destino, updatedAt: new Date() })
      .where(eq(pedidos.id, id));
    await tx.insert(pedidoHistorialEstado).values({
      pedidoId: id,
      estadoAnterior: pedido.estado,
      estadoNuevo: destino,
      usuarioId: actor.sub,
      nota: notas.length ? notas.join(' · ') : undefined,
    });

    await this.notificarEstado(tx, pedido, destino);
  }

  private permitirEntregaConSaldo(): boolean {
    const v = this.config.get<string>('PERMITIR_ENTREGA_CON_SALDO');
    return v === 'true' || v === '1';
  }

  private async notificarEstado(
    exec: Exec,
    pedido: typeof pedidos.$inferSelect,
    estado: EstadoPedido,
  ) {
    const [cliente] = await exec
      .select({ telefono: clientes.telefono })
      .from(clientes)
      .where(eq(clientes.id, pedido.clienteId))
      .limit(1);
    this.notificaciones.notificarCliente({
      pedidoId: pedido.id,
      numero: pedido.numero,
      telefono: cliente?.telefono ?? null,
      evento: 'estado_cambiado',
      mensaje: MENSAJE_ESTADO[estado],
    });
  }

  /** Tablero de despacho: listos y en camino (todas las fechas) + entregados del día. */
  async tableroDelivery(fecha: string) {
    const filas = await this.db
      .select({
        id: pedidos.id,
        numero: pedidos.numero,
        estado: pedidos.estado,
        fechaEntrega: pedidos.fechaEntrega,
        horaEntrega: pedidos.horaEntrega,
        direccion: pedidos.direccion,
        referencia: pedidos.referencia,
        nombreReceptor: pedidos.nombreReceptor,
        telefonoReceptor: pedidos.telefonoReceptor,
        vehiculo: pedidos.vehiculo,
        total: pedidos.total,
        totalPagado: pedidos.totalPagado,
        repartidorId: pedidos.repartidorId,
        distrito: distritos.nombre,
      })
      .from(pedidos)
      .innerJoin(distritos, eq(pedidos.distritoId, distritos.id))
      .where(
        or(
          inArray(pedidos.estado, ['listo', 'en_camino']),
          and(eq(pedidos.estado, 'entregado'), eq(pedidos.fechaEntrega, fecha)),
        ),
      )
      .orderBy(asc(pedidos.fechaEntrega), asc(pedidos.horaEntrega));

    const ids = filas.map((f) => f.id);
    const links = ids.length
      ? await this.db
          .select({
            pedidoId: pagos.pedidoId,
            linkUrl: pagos.linkUrl,
            estado: pagos.estado,
          })
          .from(pagos)
          .where(
            and(
              inArray(pagos.pedidoId, ids),
              eq(pagos.tipo, 'saldo'),
              inArray(pagos.estado, ['pendiente', 'pagado']),
            ),
          )
      : [];
    const repartidores = await this.db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(and(eq(usuarios.rol, 'delivery'), eq(usuarios.activo, true)));
    const nombreRepartidor = new Map(repartidores.map((r) => [r.id, r.nombre]));

    return {
      fecha,
      permitirEntregaConSaldo: this.permitirEntregaConSaldo(),
      repartidores,
      pedidos: filas.map((f) => {
        const link = links.find((l) => l.pedidoId === f.id);
        return {
          ...f,
          saldo: calcularSaldo(Number(f.total), Number(f.totalPagado)),
          linkSaldo: link ? { url: link.linkUrl, estado: link.estado } : null,
          repartidor: f.repartidorId
            ? (nombreRepartidor.get(f.repartidorId) ?? null)
            : null,
        };
      }),
    };
  }

  /** Receta efectiva del pedido agregada por insumo, para la pantalla de confirmar consumo. */
  async recetaEfectivaDelPedido(
    id: string,
  ): Promise<{ insumoId: string; nombre: string; cantidad: number }[]> {
    const pedido = await this.findOne(id);
    if (pedido.estado !== 'en_armado') {
      throw new BadRequestException('Solo aplica a pedidos en_armado');
    }

    const recetas = await this.disponibilidad.recetasDeItems(
      this.db,
      pedido.items,
    );
    const total = sumarRecetas([...recetas.values()]);
    if (!total.length) return [];

    const insumosInfo = await this.db
      .select({ id: insumos.id, nombre: insumos.nombre })
      .from(insumos)
      .where(
        inArray(
          insumos.id,
          total.map((l) => l.insumoId),
        ),
      );
    const nombrePorInsumo = new Map(insumosInfo.map((i) => [i.id, i.nombre]));

    return total.map((l) => ({
      insumoId: l.insumoId,
      nombre: nombrePorInsumo.get(l.insumoId) ?? '—',
      cantidad: l.cantidad,
    }));
  }

  /**
   * Sección 5.7 — confirmar consumo, en una sola transacción y con el pedido
   * bloqueado: si dos personas confirman a la vez, la segunda ve el pedido
   * ya en "listo" y falla, en vez de descontar el stock dos veces.
   * `lineas` viene agrupada por insumo a nivel de pedido; lo usado se reparte
   * entre los ítems según su participación en la receta efectiva.
   */
  async confirmarConsumo(id: string, input: ConsumoInput, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const pedido = await this.bloquearPedido(tx, id);
      if (pedido.estado !== 'en_armado') {
        throw new ConflictException(
          `Solo se puede confirmar consumo de un pedido en_armado (está en "${pedido.estado}")`,
        );
      }

      const items = await tx
        .select()
        .from(pedidoItems)
        .where(eq(pedidoItems.pedidoId, id));
      if (!items.length)
        throw new BadRequestException('El pedido no tiene ítems');

      const recetaPorItem = await this.disponibilidad.recetasDeItems(tx, items);
      const totalPorInsumo = new Map(
        sumarRecetas([...recetaPorItem.values()]).map((l) => [
          l.insumoId,
          l.cantidad,
        ]),
      );

      const ajenos = input.lineas.filter(
        (l) => !totalPorInsumo.has(l.insumoId),
      );
      if (ajenos.length)
        throw new BadRequestException(
          'Hay líneas de consumo con insumos que no están en la receta del pedido',
        );

      for (const [insumoId, cantidadReceta] of totalPorInsumo) {
        const linea = input.lineas.find((l) => l.insumoId === insumoId);
        const cantidadUsada = linea ? linea.cantidadUsada : cantidadReceta;
        const { consumo, merma } = desglosarConsumo(
          cantidadReceta,
          cantidadUsada,
        );

        // Sin costoUnitario: el Kardex valoriza al costo_promedio vigente con la fila bloqueada.
        await this.kardexService.registrarMovimiento(tx, {
          insumoId,
          tipo: 'consumo',
          salida: consumo,
          referenciaTipo: 'pedido',
          referenciaId: id,
          usuarioId,
        });
        if (merma > 0) {
          await this.kardexService.registrarMovimiento(tx, {
            insumoId,
            tipo: 'merma',
            salida: merma,
            referenciaTipo: 'pedido',
            referenciaId: id,
            nota: `usó ${cantidadUsada} de ${cantidadReceta}`,
            usuarioId,
          });
        }

        const partes = items
          .map((item) => ({
            id: item.id,
            cantidadReceta:
              (recetaPorItem.get(item.id) ?? []).find(
                (l) => l.insumoId === insumoId,
              )?.cantidad ?? 0,
          }))
          .filter((p) => p.cantidadReceta > 0);
        for (const parte of repartirUsado(partes, cantidadUsada)) {
          await tx.insert(pedidoConsumos).values({
            pedidoItemId: parte.id,
            insumoId,
            cantidadReceta: String(
              partes.find((p) => p.id === parte.id)?.cantidadReceta ?? 0,
            ),
            cantidadUsada: String(parte.usado),
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

  /**
   * Crea el pedido recalculando todo en el servidor. Dentro de la
   * transacción toma un lock de reserva de stock y verifica que la receta
   * efectiva de todos los ítems quepa en el disponible (5.3): dos ventas
   * simultáneas no pueden reservar el mismo stock.
   */
  async crear(input: PedidoInput, creadoPor: string) {
    const pedidoId = await this.db.transaction(async (tx) => {
      const [distrito] = await tx
        .select()
        .from(distritos)
        .where(eq(distritos.id, input.distritoId))
        .limit(1);
      if (!distrito || !distrito.activo)
        throw new NotFoundException('Distrito no encontrado o inactivo');

      const ctx = await this.resolver.cargarContexto(tx);
      const items: ItemResuelto[] = [];
      for (const itemInput of input.items) {
        items.push(await this.resolver.resolver(tx, ctx, itemInput));
      }

      await tx.execute(LOCK_RESERVA_STOCK);
      const disponibleDe = await this.disponibilidad.disponibleDe(tx);
      const necesario: LineaCantidad[] = sumarRecetas(
        items.map((i) => i.recetaEfectiva),
      );
      const faltan = faltantes(necesario, disponibleDe);
      if (faltan.length) {
        throw new ConflictException({
          message: `Stock insuficiente: ${faltan
            .map(
              (f) =>
                `${ctx.insumoPorId.get(f.insumoId)?.nombre ?? f.insumoId} (necesita ${f.necesario}, hay ${Math.max(0, f.disponible)})`,
            )
            .join(', ')}`,
          faltantes: faltan,
        });
      }

      const subtotalProductos = round2(
        items.reduce((acc, i) => acc + i.subtotal, 0),
      );
      // Carro si CUALQUIER ítem lo requiere (sección 5.5).
      const vehiculo = items.some((i) => i.vehiculo === 'carro')
        ? 'carro'
        : 'moto';
      const costoEnvio = calcularEnvio(vehiculo, {
        tarifaMoto: Number(distrito.tarifaMoto),
        tarifaCarro: Number(distrito.tarifaCarro),
      });
      const total = round2(subtotalProductos + costoEnvio);

      const cliente = await this.resolverCliente(tx, input.cliente);

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

      for (const item of items) {
        const [pedidoItem] = await tx
          .insert(pedidoItems)
          .values({
            pedidoId: creado.id,
            productoTallaId: item.talla.id,
            cantidad: item.cantidad,
            florId: item.florId,
            papelId: item.papelId,
            precioUnitario: String(item.precioUnitario),
            subtotal: String(item.subtotal),
          })
          .returning();

        for (const extra of item.extras) {
          await tx.insert(pedidoItemExtras).values({
            pedidoItemId: pedidoItem.id,
            extraId: extra.id,
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

        if (item.consultas.length) {
          await tx.insert(consultasProduccion).values({
            pedidoId: creado.id,
            descripcion: item.consultas.join(' · '),
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

      const montoAdelanto = round2(total * (input.porcentajeAdelanto / 100));
      if (montoAdelanto > 0) {
        const [adelanto] = await tx
          .insert(pagos)
          .values({
            pedidoId: creado.id,
            tipo: 'adelanto',
            metodo: 'link',
            monto: String(montoAdelanto),
            estado: 'pendiente',
          })
          .returning();
        await tx
          .update(pagos)
          .set({ linkUrl: this.pagos.urlLinkPago(adelanto.id) })
          .where(eq(pagos.id, adelanto.id));
      }
      this.notificaciones.notificarCliente({
        pedidoId: creado.id,
        numero: creado.numero,
        telefono: cliente.telefono,
        evento: 'pedido_creado',
        mensaje: `Recibimos tu pedido por S/ ${total.toFixed(2)}.${montoAdelanto > 0 ? ` Adelanto: S/ ${montoAdelanto.toFixed(2)}.` : ''}`,
      });

      return creado.id;
    });

    return this.findOne(pedidoId);
  }

  private async resolverCliente(tx: Tx, cliente: PedidoInput['cliente']) {
    if (cliente.telefono) {
      const [existente] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.telefono, cliente.telefono))
        .limit(1);
      if (existente) return existente;
    }
    const [creado] = await tx
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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
