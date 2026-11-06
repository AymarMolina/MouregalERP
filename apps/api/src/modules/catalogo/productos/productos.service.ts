import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { ProductoInput, RecetaLineaInput, Talla } from '@erp/shared';
import { DB } from '../../../db/db.module';
import type { Db } from '../../../db/client';
import {
  insumos,
  productoFloresPermitidas,
  productoTallas,
  productos,
  recetaLineas,
} from '../../../db/schema';

@Injectable()
export class ProductosService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list() {
    const rows = await this.db
      .select()
      .from(productos)
      .orderBy(asc(productos.nombre));
    return this.withTallasYCosto(rows);
  }

  async findOne(id: string) {
    const producto = await this.oneProducto(id);
    const [conTallas] = await this.withTallasYCosto([producto]);
    return conTallas;
  }

  async create(input: ProductoInput) {
    const [producto] = await this.db
      .insert(productos)
      .values({
        nombre: input.nombre,
        slug: input.slug,
        descripcion: input.descripcion,
        florPrincipalId: input.florPrincipalId,
        usaPapel: input.usaPapel,
        papelDefaultId: input.papelDefaultId ?? null,
        imagenUrl: input.imagenUrl ?? null,
      })
      .returning();

    if (input.tallas?.length) {
      await this.db.insert(productoTallas).values(
        input.tallas.map((t) => ({
          productoId: producto.id,
          talla: t.talla,
          precioBase: String(t.precioBase),
        })),
      );
    }

    return this.findOne(producto.id);
  }

  async update(id: string, input: Partial<ProductoInput>) {
    await this.oneProducto(id);

    await this.db
      .update(productos)
      .set({
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.descripcion !== undefined && {
          descripcion: input.descripcion,
        }),
        ...(input.florPrincipalId !== undefined && {
          florPrincipalId: input.florPrincipalId,
        }),
        ...(input.usaPapel !== undefined && { usaPapel: input.usaPapel }),
        ...(input.papelDefaultId !== undefined && {
          papelDefaultId: input.papelDefaultId,
        }),
        ...(input.imagenUrl !== undefined && { imagenUrl: input.imagenUrl }),
        ...(input.activo !== undefined && { activo: input.activo }),
        updatedAt: new Date(),
      })
      .where(eq(productos.id, id));

    if (input.tallas?.length) {
      for (const t of input.tallas) {
        const [existing] = await this.db
          .select()
          .from(productoTallas)
          .where(
            and(
              eq(productoTallas.productoId, id),
              eq(productoTallas.talla, t.talla),
            ),
          )
          .limit(1);

        if (existing) {
          await this.db
            .update(productoTallas)
            .set({ precioBase: String(t.precioBase), updatedAt: new Date() })
            .where(eq(productoTallas.id, existing.id));
        } else {
          await this.db.insert(productoTallas).values({
            productoId: id,
            talla: t.talla,
            precioBase: String(t.precioBase),
          });
        }
      }
    }

    return this.findOne(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.oneProducto(id);
    await this.db
      .update(productos)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(productos.id, id));
  }

  async getReceta(productoId: string, talla: Talla) {
    const productoTalla = await this.oneProductoTalla(productoId, talla);
    return this.db
      .select()
      .from(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, productoTalla.id));
  }

  async replaceReceta(
    productoId: string,
    talla: Talla,
    lineas: RecetaLineaInput[],
  ) {
    const productoTalla = await this.oneProductoTalla(productoId, talla);

    await this.db
      .delete(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, productoTalla.id));
    if (lineas.length) {
      await this.db.insert(recetaLineas).values(
        lineas.map((l) => ({
          productoTallaId: productoTalla.id,
          insumoId: l.insumoId,
          cantidad: String(l.cantidad),
          rol: l.rol,
        })),
      );
    }

    return this.getReceta(productoId, talla);
  }

  async copiarReceta(
    productoId: string,
    tallaOrigen: Talla,
    destinos: Talla[],
  ) {
    const origen = await this.oneProductoTalla(productoId, tallaOrigen);
    const lineasOrigen = await this.db
      .select()
      .from(recetaLineas)
      .where(eq(recetaLineas.productoTallaId, origen.id));

    for (const talla of destinos) {
      const destino = await this.oneProductoTalla(productoId, talla);
      await this.db
        .delete(recetaLineas)
        .where(eq(recetaLineas.productoTallaId, destino.id));
      if (lineasOrigen.length) {
        await this.db.insert(recetaLineas).values(
          lineasOrigen.map((l) => ({
            productoTallaId: destino.id,
            insumoId: l.insumoId,
            cantidad: l.cantidad,
            rol: l.rol,
          })),
        );
      }
    }

    return this.findOne(productoId);
  }

  async getFloresPermitidas(productoId: string) {
    await this.oneProducto(productoId);
    return this.db
      .select()
      .from(productoFloresPermitidas)
      .where(eq(productoFloresPermitidas.productoId, productoId));
  }

  async replaceFloresPermitidas(productoId: string, insumoIds: string[]) {
    await this.oneProducto(productoId);
    await this.db
      .delete(productoFloresPermitidas)
      .where(eq(productoFloresPermitidas.productoId, productoId));
    if (insumoIds.length) {
      await this.db
        .insert(productoFloresPermitidas)
        .values(insumoIds.map((insumoId) => ({ productoId, insumoId })));
    }
    return this.getFloresPermitidas(productoId);
  }

  private async oneProducto(id: string) {
    const [producto] = await this.db
      .select()
      .from(productos)
      .where(eq(productos.id, id))
      .limit(1);
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  private async oneProductoTalla(productoId: string, talla: Talla) {
    const [productoTalla] = await this.db
      .select()
      .from(productoTallas)
      .where(
        and(
          eq(productoTallas.productoId, productoId),
          eq(productoTallas.talla, talla),
        ),
      )
      .limit(1);
    if (!productoTalla)
      throw new NotFoundException(`El producto no tiene la talla ${talla}`);
    return productoTalla;
  }

  private async withTallasYCosto(rows: (typeof productos.$inferSelect)[]) {
    if (!rows.length) return [];

    const tallas = await this.db
      .select()
      .from(productoTallas)
      .where(
        inArray(
          productoTallas.productoId,
          rows.map((p) => p.id),
        ),
      );
    const costos = await this.costoPorTalla(tallas.map((t) => t.id));

    const tallasPorProducto = new Map<
      string,
      (typeof productoTallas.$inferSelect)[]
    >();
    for (const t of tallas) {
      const lista = tallasPorProducto.get(t.productoId) ?? [];
      lista.push(t);
      tallasPorProducto.set(t.productoId, lista);
    }

    return rows.map((p) => ({
      ...p,
      tallas: (tallasPorProducto.get(p.id) ?? []).map((t) => {
        const costo = costos.get(t.id) ?? 0;
        const precioBase = Number(t.precioBase);
        return {
          ...t,
          costo: costo.toFixed(2),
          margen: (precioBase - costo).toFixed(2),
        };
      }),
    }));
  }

  private async costoPorTalla(
    tallaIds: string[],
  ): Promise<Map<string, number>> {
    if (!tallaIds.length) return new Map();

    const rows = await this.db
      .select({
        productoTallaId: recetaLineas.productoTallaId,
        cantidad: recetaLineas.cantidad,
        costoPromedio: insumos.costoPromedio,
      })
      .from(recetaLineas)
      .innerJoin(insumos, eq(recetaLineas.insumoId, insumos.id))
      .where(inArray(recetaLineas.productoTallaId, tallaIds));

    const costos = new Map<string, number>();
    for (const row of rows) {
      const actual = costos.get(row.productoTallaId) ?? 0;
      costos.set(
        row.productoTallaId,
        actual + Number(row.cantidad) * Number(row.costoPromedio),
      );
    }
    return costos;
  }
}
