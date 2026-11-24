import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import {
  calcularDisponible,
  recetaEfectiva,
  type LineaCantidad,
  type RecetaLineaBase,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db, Exec } from '../../db/client';
import {
  extras,
  insumos,
  pedidoItemCambios,
  pedidoItemExtras,
  pedidoItems,
  pedidos,
  productoTallas,
  productos,
  recetaLineas,
} from '../../db/schema';

export interface ItemParaReceta {
  id: string;
  productoTallaId: string;
  cantidad: number;
  florId: string;
  papelId: string | null;
}

/**
 * Sección 5.3 — disponible(insumo) = stock_actual - reservado, donde
 * reservado es la receta efectiva de todos los ítems en pedidos con
 * estado pendiente | en_armado.
 */
@Injectable()
export class DisponibilidadService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Receta efectiva (5.1) de ítems ya guardados, en lote: 3 consultas en
   * total sin importar cuántos ítems haya.
   */
  async recetasDeItems(
    exec: Exec,
    items: ItemParaReceta[],
  ): Promise<Map<string, LineaCantidad[]>> {
    const resultado = new Map<string, LineaCantidad[]>();
    if (!items.length) return resultado;

    const tallaIds = [...new Set(items.map((i) => i.productoTallaId))];
    // Las tres consultas son independientes: van en paralelo.
    const itemIds = items.map((i) => i.id);
    const [tallas, lineas, extrasDeItems, adicionales] = await Promise.all([
      exec
        .select({ id: productoTallas.id, usaPapel: productos.usaPapel })
        .from(productoTallas)
        .innerJoin(productos, eq(productoTallas.productoId, productos.id))
        .where(inArray(productoTallas.id, tallaIds)),
      exec
        .select()
        .from(recetaLineas)
        .where(inArray(recetaLineas.productoTallaId, tallaIds)),
      exec
        .select({
          pedidoItemId: pedidoItemExtras.pedidoItemId,
          insumoId: extras.insumoId,
        })
        .from(pedidoItemExtras)
        .innerJoin(extras, eq(pedidoItemExtras.extraId, extras.id))
        .where(inArray(pedidoItemExtras.pedidoItemId, itemIds)),
      // Adicionales que salen del inventario (pedido_item_cambios con insumo).
      exec
        .select({
          pedidoItemId: pedidoItemCambios.pedidoItemId,
          insumoId: pedidoItemCambios.insumoId,
          cantidad: pedidoItemCambios.cantidad,
        })
        .from(pedidoItemCambios)
        .where(
          and(
            inArray(pedidoItemCambios.pedidoItemId, itemIds),
            isNotNull(pedidoItemCambios.insumoId),
          ),
        ),
    ]);
    const adicionalesPorItem = new Map<string, LineaCantidad[]>();
    for (const a of adicionales) {
      const lista = adicionalesPorItem.get(a.pedidoItemId) ?? [];
      lista.push({ insumoId: a.insumoId!, cantidad: Number(a.cantidad ?? 1) });
      adicionalesPorItem.set(a.pedidoItemId, lista);
    }
    const usaPapelPorTalla = new Map(tallas.map((t) => [t.id, t.usaPapel]));
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

    const extrasPorItem = new Map<string, string[]>();
    for (const e of extrasDeItems) {
      const lista = extrasPorItem.get(e.pedidoItemId) ?? [];
      lista.push(e.insumoId);
      extrasPorItem.set(e.pedidoItemId, lista);
    }

    for (const item of items) {
      resultado.set(
        item.id,
        recetaEfectiva({
          lineasBase: lineasPorTalla.get(item.productoTallaId) ?? [],
          florId: item.florId,
          usaPapel: usaPapelPorTalla.get(item.productoTallaId) ?? false,
          papelId: item.papelId,
          extraInsumoIds: extrasPorItem.get(item.id) ?? [],
          adicionalesInsumo: adicionalesPorItem.get(item.id) ?? [],
          cantidad: item.cantidad,
        }),
      );
    }
    return resultado;
  }

  async calcularReservados(exec: Exec = this.db): Promise<Map<string, number>> {
    const reservado = new Map<string, number>();

    const items = await exec
      .select({
        id: pedidoItems.id,
        productoTallaId: pedidoItems.productoTallaId,
        cantidad: pedidoItems.cantidad,
        florId: pedidoItems.florId,
        papelId: pedidoItems.papelId,
      })
      .from(pedidoItems)
      .innerJoin(pedidos, eq(pedidoItems.pedidoId, pedidos.id))
      .where(inArray(pedidos.estado, ['pendiente', 'en_armado']));

    const recetas = await this.recetasDeItems(exec, items);
    for (const receta of recetas.values()) {
      for (const l of receta) {
        reservado.set(
          l.insumoId,
          (reservado.get(l.insumoId) ?? 0) + l.cantidad,
        );
      }
    }
    return reservado;
  }

  /** Devuelve una función disponible(insumoId) = stock_actual - reservado. */
  async disponibleDe(
    exec: Exec = this.db,
  ): Promise<(insumoId: string) => number> {
    const [reservados, stock] = await Promise.all([
      this.calcularReservados(exec),
      exec
        .select({ id: insumos.id, stockActual: insumos.stockActual })
        .from(insumos),
    ]);
    const stockPorId = new Map(stock.map((i) => [i.id, Number(i.stockActual)]));
    return (insumoId: string) =>
      calcularDisponible(
        stockPorId.get(insumoId) ?? 0,
        reservados.get(insumoId) ?? 0,
      );
  }
}
