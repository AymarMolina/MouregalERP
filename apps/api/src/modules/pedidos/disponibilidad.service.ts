import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { recetaEfectiva, type RecetaLineaBase } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import {
  extras,
  pedidoItemExtras,
  pedidoItems,
  pedidos,
  productoTallas,
  productos,
  recetaLineas,
} from '../../db/schema';

/**
 * Sección 5.3 — disponible(insumo) = stock_actual - reservado, donde
 * reservado es la receta efectiva de todos los ítems en pedidos con
 * estado pendiente | en_armado.
 */
@Injectable()
export class DisponibilidadService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async calcularReservados(): Promise<Map<string, number>> {
    const reservado = new Map<string, number>();

    const pedidosActivos = await this.db
      .select({ id: pedidos.id })
      .from(pedidos)
      .where(inArray(pedidos.estado, ['pendiente', 'en_armado']));
    if (!pedidosActivos.length) return reservado;
    const pedidoIds = pedidosActivos.map((p) => p.id);

    const items = await this.db
      .select({
        id: pedidoItems.id,
        productoTallaId: pedidoItems.productoTallaId,
        cantidad: pedidoItems.cantidad,
        florId: pedidoItems.florId,
        papelId: pedidoItems.papelId,
      })
      .from(pedidoItems)
      .where(inArray(pedidoItems.pedidoId, pedidoIds));
    if (!items.length) return reservado;

    const tallaIds = [...new Set(items.map((i) => i.productoTallaId))];

    const tallas = await this.db
      .select({ id: productoTallas.id, usaPapel: productos.usaPapel })
      .from(productoTallas)
      .innerJoin(productos, eq(productoTallas.productoId, productos.id))
      .where(inArray(productoTallas.id, tallaIds));
    const usaPapelPorTalla = new Map(tallas.map((t) => [t.id, t.usaPapel]));

    const lineas = await this.db
      .select()
      .from(recetaLineas)
      .where(inArray(recetaLineas.productoTallaId, tallaIds));
    const lineasPorTalla = new Map<string, RecetaLineaBase[]>();
    for (const l of lineas) {
      const lista = lineasPorTalla.get(l.productoTallaId) ?? [];
      lista.push({
        insumoId: l.insumoId,
        cantidad: Number(l.cantidad),
        rol: l.rol as RecetaLineaBase['rol'],
      });
      lineasPorTalla.set(l.productoTallaId, lista);
    }

    const itemIds = items.map((i) => i.id);
    const extrasDeItems = await this.db
      .select({
        pedidoItemId: pedidoItemExtras.pedidoItemId,
        insumoId: extras.insumoId,
      })
      .from(pedidoItemExtras)
      .innerJoin(extras, eq(pedidoItemExtras.extraId, extras.id))
      .where(inArray(pedidoItemExtras.pedidoItemId, itemIds));
    const extrasPorItem = new Map<string, string[]>();
    for (const e of extrasDeItems) {
      const lista = extrasPorItem.get(e.pedidoItemId) ?? [];
      lista.push(e.insumoId);
      extrasPorItem.set(e.pedidoItemId, lista);
    }

    for (const item of items) {
      const lineasBase = lineasPorTalla.get(item.productoTallaId) ?? [];
      const efectiva = recetaEfectiva({
        lineasBase,
        florId: item.florId,
        usaPapel: usaPapelPorTalla.get(item.productoTallaId) ?? false,
        papelId: item.papelId,
        extraInsumoIds: extrasPorItem.get(item.id) ?? [],
        cantidad: item.cantidad,
      });
      for (const l of efectiva) {
        reservado.set(
          l.insumoId,
          (reservado.get(l.insumoId) ?? 0) + l.cantidad,
        );
      }
    }

    return reservado;
  }
}
