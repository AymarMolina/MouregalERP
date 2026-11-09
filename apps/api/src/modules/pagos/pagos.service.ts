import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  calcularSaldo,
  type ConfirmarPagoInput,
  type PagoManualInput,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db, Exec, Tx } from '../../db/client';
import { clientes, distritos, pagos, pedidos } from '../../db/schema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

type Pedido = typeof pedidos.$inferSelect;

/**
 * Sección 5.11 — pagos. `pedidos.total_pagado` es un caché de la suma de
 * pagos con estado "pagado" y solo se recalcula aquí, dentro de la misma
 * transacción que cambia el pago.
 */
@Injectable()
export class PagosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** URL del link de pago. Stub hasta definir pasarela (Shopify Draft Order u otra). */
  urlLinkPago(pagoId: string): string {
    const base =
      this.config.get<string>('PAGOS_LINK_BASE') ??
      'https://pagos.mouregal.pe/stub';
    return `${base.replace(/\/$/, '')}/${pagoId}`;
  }

  listPorPedido(pedidoId: string) {
    return this.db
      .select()
      .from(pagos)
      .where(eq(pagos.pedidoId, pedidoId))
      .orderBy(asc(pagos.createdAt));
  }

  /** Pedidos (no cancelados) con su total, lo pagado, el saldo y sus pagos. */
  async resumen(filtros: { soloConSaldo: boolean; fecha?: string }) {
    const condiciones = [ne(pedidos.estado, 'cancelado')];
    if (filtros.fecha)
      condiciones.push(eq(pedidos.fechaEntrega, filtros.fecha));
    if (filtros.soloConSaldo)
      condiciones.push(sql`${pedidos.total} > ${pedidos.totalPagado}`);

    const filas = await this.db
      .select({
        id: pedidos.id,
        numero: pedidos.numero,
        estado: pedidos.estado,
        canal: pedidos.canal,
        fechaEntrega: pedidos.fechaEntrega,
        horaEntrega: pedidos.horaEntrega,
        total: pedidos.total,
        totalPagado: pedidos.totalPagado,
        clienteNombre: clientes.nombre,
        clienteTelefono: clientes.telefono,
        distrito: distritos.nombre,
      })
      .from(pedidos)
      .innerJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .innerJoin(distritos, eq(pedidos.distritoId, distritos.id))
      .where(and(...condiciones))
      .orderBy(asc(pedidos.fechaEntrega), asc(pedidos.horaEntrega))
      .limit(500);

    const ids = filas.map((f) => f.id);
    const todosPagos = ids.length
      ? await this.db
          .select()
          .from(pagos)
          .where(inArray(pagos.pedidoId, ids))
          .orderBy(desc(pagos.createdAt))
      : [];

    return filas.map((f) => ({
      ...f,
      saldo: calcularSaldo(Number(f.total), Number(f.totalPagado)),
      pagos: todosPagos.filter((p) => p.pedidoId === f.id),
    }));
  }

  /** Registro manual de un pago ya cobrado (Yape, Plin, efectivo...). */
  async registrarManual(pedidoId: string, input: PagoManualInput) {
    return this.db.transaction(async (tx) => {
      const pedido = await this.bloquearPedido(tx, pedidoId);
      const saldo = calcularSaldo(
        Number(pedido.total),
        Number(pedido.totalPagado),
      );
      if (input.monto > saldo + 0.001)
        throw new BadRequestException(
          `El monto (S/ ${input.monto.toFixed(2)}) supera el saldo del pedido (S/ ${saldo.toFixed(2)})`,
        );

      const [pago] = await tx
        .insert(pagos)
        .values({
          pedidoId,
          tipo: input.tipo,
          metodo: input.metodo,
          monto: String(input.monto),
          estado: 'pagado',
          referenciaExterna: input.referenciaExterna,
          pagadoAt: new Date(),
        })
        .returning();

      await this.anularLinksSiQuedaSinSaldo(tx, pedido, input.monto);
      await this.recalcularTotalPagado(tx, pedidoId);
      await this.avisarPago(tx, pedido, input.monto);
      return pago;
    });
  }

  /** Marca como pagado un pago pendiente (link cobrado, verificado a mano o por webhook). */
  async confirmar(pagoId: string, input: ConfirmarPagoInput) {
    return this.db.transaction(async (tx) => {
      const pago = await this.bloquearPago(tx, pagoId);
      if (pago.estado !== 'pendiente')
        throw new ConflictException(`El pago ya está "${pago.estado}"`);
      const pedido = await this.bloquearPedido(tx, pago.pedidoId);
      const saldo = calcularSaldo(
        Number(pedido.total),
        Number(pedido.totalPagado),
      );
      if (Number(pago.monto) > saldo + 0.001)
        throw new ConflictException(
          `El pago (S/ ${Number(pago.monto).toFixed(2)}) supera el saldo actual (S/ ${saldo.toFixed(2)}); anúlalo y genera uno nuevo`,
        );

      const [actualizado] = await tx
        .update(pagos)
        .set({
          estado: 'pagado',
          pagadoAt: new Date(),
          referenciaExterna: input.referenciaExterna ?? pago.referenciaExterna,
        })
        .where(eq(pagos.id, pagoId))
        .returning();

      await this.anularLinksSiQuedaSinSaldo(
        tx,
        pedido,
        Number(pago.monto),
        pagoId,
      );
      await this.recalcularTotalPagado(tx, pago.pedidoId);
      await this.avisarPago(tx, pedido, Number(pago.monto));
      return actualizado;
    });
  }

  async anular(pagoId: string) {
    return this.db.transaction(async (tx) => {
      const pago = await this.bloquearPago(tx, pagoId);
      if (pago.estado !== 'pendiente')
        throw new ConflictException(
          `Solo se anulan pagos pendientes (este está "${pago.estado}")`,
        );
      const [actualizado] = await tx
        .update(pagos)
        .set({ estado: 'anulado' })
        .where(eq(pagos.id, pagoId))
        .returning();
      return actualizado;
    });
  }

  /** Genera (o regenera) y envía el link del saldo del pedido. */
  async generarLinkSaldo(pedidoId: string) {
    return this.db.transaction(async (tx) => {
      const pedido = await this.bloquearPedido(tx, pedidoId);
      return this.generarLinkSaldoEnTx(tx, pedido);
    });
  }

  /**
   * Anula los cobros pendientes anteriores (adelanto o saldo) y crea un único
   * link por todo lo que falta pagar. Debe llamarse con el pedido bloqueado.
   */
  async generarLinkSaldoEnTx(tx: Tx, pedido: Pedido) {
    if (pedido.estado === 'cancelado')
      throw new BadRequestException('El pedido está cancelado');
    const saldo = calcularSaldo(
      Number(pedido.total),
      Number(pedido.totalPagado),
    );
    if (saldo <= 0)
      throw new BadRequestException('El pedido no tiene saldo pendiente');

    await tx
      .update(pagos)
      .set({ estado: 'anulado' })
      .where(and(eq(pagos.pedidoId, pedido.id), eq(pagos.estado, 'pendiente')));

    const [pago] = await tx
      .insert(pagos)
      .values({
        pedidoId: pedido.id,
        tipo: 'saldo',
        metodo: 'link',
        monto: String(saldo),
        estado: 'pendiente',
      })
      .returning();
    const linkUrl = this.urlLinkPago(pago.id);
    const [conLink] = await tx
      .update(pagos)
      .set({ linkUrl })
      .where(eq(pagos.id, pago.id))
      .returning();

    this.notificaciones.notificarCliente({
      pedidoId: pedido.id,
      numero: pedido.numero,
      telefono: await this.telefonoCliente(tx, pedido.clienteId),
      evento: 'link_pago',
      mensaje: `Saldo de S/ ${saldo.toFixed(2)}. Paga aquí: ${linkUrl}`,
    });
    return conLink;
  }

  /** ¿Hay un link de saldo vigente (pendiente o ya pagado)? Requisito para despachar (5.6). */
  async tieneLinkSaldo(exec: Exec, pedidoId: string): Promise<boolean> {
    const [fila] = await exec
      .select({ id: pagos.id })
      .from(pagos)
      .where(
        and(
          eq(pagos.pedidoId, pedidoId),
          eq(pagos.tipo, 'saldo'),
          inArray(pagos.estado, ['pendiente', 'pagado']),
        ),
      )
      .limit(1);
    return !!fila;
  }

  async recalcularTotalPagado(tx: Tx, pedidoId: string): Promise<number> {
    const [{ total }] = await tx
      .select({
        total: sql<string>`coalesce(sum(${pagos.monto}), 0)`,
      })
      .from(pagos)
      .where(and(eq(pagos.pedidoId, pedidoId), eq(pagos.estado, 'pagado')));
    await tx
      .update(pedidos)
      .set({ totalPagado: String(total), updatedAt: new Date() })
      .where(eq(pedidos.id, pedidoId));
    return Number(total);
  }

  /** Si un pago cubre todo el saldo, los otros cobros pendientes ya no aplican. */
  private async anularLinksSiQuedaSinSaldo(
    tx: Tx,
    pedido: Pedido,
    montoPagado: number,
    exceptoPagoId?: string,
  ) {
    const saldoRestante = calcularSaldo(
      Number(pedido.total),
      Number(pedido.totalPagado) + montoPagado,
    );
    if (saldoRestante > 0) return;
    const condiciones = [
      eq(pagos.pedidoId, pedido.id),
      eq(pagos.estado, 'pendiente'),
    ];
    if (exceptoPagoId) condiciones.push(ne(pagos.id, exceptoPagoId));
    await tx
      .update(pagos)
      .set({ estado: 'anulado' })
      .where(and(...condiciones));
  }

  private async avisarPago(tx: Tx, pedido: Pedido, monto: number) {
    this.notificaciones.notificarCliente({
      pedidoId: pedido.id,
      numero: pedido.numero,
      telefono: await this.telefonoCliente(tx, pedido.clienteId),
      evento: 'pago_recibido',
      mensaje: `Recibimos tu pago de S/ ${monto.toFixed(2)}. ¡Gracias!`,
    });
  }

  private async telefonoCliente(exec: Exec, clienteId: string) {
    const [c] = await exec
      .select({ telefono: clientes.telefono })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);
    return c?.telefono ?? null;
  }

  private async bloquearPedido(tx: Tx, id: string): Promise<Pedido> {
    const [pedido] = await tx
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, id))
      .for('update')
      .limit(1);
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'cancelado')
      throw new BadRequestException('El pedido está cancelado');
    return pedido;
  }

  private async bloquearPago(tx: Tx, id: string) {
    const [pago] = await tx
      .select()
      .from(pagos)
      .where(eq(pagos.id, id))
      .for('update')
      .limit(1);
    if (!pago) throw new NotFoundException('Pago no encontrado');
    return pago;
  }
}
