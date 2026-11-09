import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  cantidadEnUnidadBase,
  compraSugerida,
  costoUnitarioCompra,
  estadoOrdenTrasRecepcion,
  type EstadoOc,
  type OrdenCompraInput,
  type OrdenCompraLineaInput,
  type OrdenCompraUpdate,
  type ProveedorInput,
  type RecepcionInput,
} from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db, Tx } from '../../db/client';
import {
  insumos,
  kardexMovimientos,
  ordenCompraLineas,
  ordenesCompra,
  proveedores,
} from '../../db/schema';
import { KardexService } from '../inventario/kardex.service';
import { DisponibilidadService } from '../pedidos/disponibilidad.service';

/** Días de historia para estimar la demanda diaria (consumo + merma). */
const DIAS_HISTORIA = 28;

/** Transiciones de estado de una orden que se hacen a mano (la recepción las demás). */
const TRANSICIONES_OC: Partial<Record<EstadoOc, EstadoOc[]>> = {
  borrador: ['enviada', 'anulada'],
  enviada: ['anulada'],
};

const ESTADOS_ABIERTOS: EstadoOc[] = [
  'borrador',
  'enviada',
  'recibida_parcial',
];

@Injectable()
export class ComprasService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly kardex: KardexService,
    private readonly disponibilidad: DisponibilidadService,
  ) {}

  // ---------------- Proveedores ----------------

  listProveedores() {
    return this.db.select().from(proveedores).orderBy(asc(proveedores.nombre));
  }

  async crearProveedor(input: ProveedorInput) {
    const [p] = await this.db
      .insert(proveedores)
      .values({
        nombre: input.nombre,
        ruc: input.ruc,
        telefono: input.telefono,
      })
      .returning();
    return p;
  }

  async actualizarProveedor(id: string, input: Partial<ProveedorInput>) {
    const [p] = await this.db
      .update(proveedores)
      .set({
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.ruc !== undefined && { ruc: input.ruc }),
        ...(input.telefono !== undefined && { telefono: input.telefono }),
        ...(input.activo !== undefined && { activo: input.activo }),
        updatedAt: new Date(),
      })
      .where(eq(proveedores.id, id))
      .returning();
    if (!p) throw new NotFoundException('Proveedor no encontrado');
    return p;
  }

  // ---------------- Compras sugeridas (5.9) ----------------

  /**
   * sugerido = max(0, ceil(stock_mínimo + reservado + demanda − stock_actual)).
   * - reservado: receta efectiva de pedidos pendiente | en_armado (todas las fechas).
   * - demanda: consumo + merma promedio diario de los últimos 28 días × N días.
   *   (Los pedidos ya registrados están en "reservado"; contar su receta otra
   *   vez como demanda duplicaría la compra.)
   * - pendienteEnOrdenes: lo pedido en órdenes abiertas y aún no recibido; se
   *   descuenta para no volver a comprarlo.
   */
  async sugeridas(dias: number) {
    const [lista, reservados, consumos, pendientes] = await Promise.all([
      this.db
        .select()
        .from(insumos)
        .where(eq(insumos.activo, true))
        .orderBy(asc(insumos.codigo)),
      this.disponibilidad.calcularReservados(),
      this.db
        .select({
          insumoId: kardexMovimientos.insumoId,
          salida: sql<string>`sum(${kardexMovimientos.salida})`,
        })
        .from(kardexMovimientos)
        .where(
          and(
            inArray(kardexMovimientos.tipo, ['consumo', 'merma']),
            gte(
              kardexMovimientos.fecha,
              new Date(Date.now() - DIAS_HISTORIA * 24 * 3600 * 1000),
            ),
          ),
        )
        .groupBy(kardexMovimientos.insumoId),
      this.db
        .select({
          insumoId: ordenCompraLineas.insumoId,
          pendiente: sql<string>`sum(greatest(${ordenCompraLineas.cantidadBase} - ${ordenCompraLineas.cantidadRecibida}, 0))`,
        })
        .from(ordenCompraLineas)
        .innerJoin(
          ordenesCompra,
          eq(ordenCompraLineas.ordenCompraId, ordenesCompra.id),
        )
        .where(inArray(ordenesCompra.estado, ESTADOS_ABIERTOS))
        .groupBy(ordenCompraLineas.insumoId),
    ]);

    const consumoPorInsumo = new Map(
      consumos.map((c) => [c.insumoId, Number(c.salida)]),
    );
    const pendientePorInsumo = new Map(
      pendientes.map((p) => [p.insumoId, Number(p.pendiente)]),
    );

    return lista.map((i) => {
      const reservado = round3(reservados.get(i.id) ?? 0);
      const demanda = round3(
        ((consumoPorInsumo.get(i.id) ?? 0) / DIAS_HISTORIA) * dias,
      );
      const stockActual = Number(i.stockActual);
      const sugerido = compraSugerida({
        stockMinimo: Number(i.stockMinimo),
        reservado,
        demanda,
        stockActual,
      });
      const pendienteEnOrdenes = round3(pendientePorInsumo.get(i.id) ?? 0);
      return {
        insumoId: i.id,
        codigo: i.codigo,
        nombre: i.nombre,
        unidadBase: i.unidadBase,
        stockActual,
        stockMinimo: Number(i.stockMinimo),
        costoPromedio: Number(i.costoPromedio),
        reservado,
        demanda,
        sugerido,
        pendienteEnOrdenes,
        aComprar: Math.max(0, Math.ceil(sugerido - pendienteEnOrdenes)),
      };
    });
  }

  // ---------------- Órdenes de compra ----------------

  async listOrdenes(estado?: EstadoOc) {
    const filas = await this.db
      .select({
        id: ordenesCompra.id,
        numero: ordenesCompra.numero,
        estado: ordenesCompra.estado,
        fecha: ordenesCompra.fecha,
        total: ordenesCompra.total,
        nota: ordenesCompra.nota,
        proveedorId: ordenesCompra.proveedorId,
        proveedor: proveedores.nombre,
        lineas: sql<number>`(select count(*)::int from ${ordenCompraLineas} where ${ordenCompraLineas.ordenCompraId} = ${ordenesCompra.id})`,
      })
      .from(ordenesCompra)
      .innerJoin(proveedores, eq(ordenesCompra.proveedorId, proveedores.id))
      .where(estado ? eq(ordenesCompra.estado, estado) : undefined)
      .orderBy(desc(ordenesCompra.numero))
      .limit(200);
    return filas;
  }

  async getOrden(id: string) {
    const [orden] = await this.db
      .select({
        id: ordenesCompra.id,
        numero: ordenesCompra.numero,
        estado: ordenesCompra.estado,
        fecha: ordenesCompra.fecha,
        total: ordenesCompra.total,
        nota: ordenesCompra.nota,
        proveedorId: ordenesCompra.proveedorId,
        proveedor: proveedores.nombre,
      })
      .from(ordenesCompra)
      .innerJoin(proveedores, eq(ordenesCompra.proveedorId, proveedores.id))
      .where(eq(ordenesCompra.id, id))
      .limit(1);
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');

    const lineas = await this.db
      .select({
        id: ordenCompraLineas.id,
        insumoId: ordenCompraLineas.insumoId,
        codigo: insumos.codigo,
        nombre: insumos.nombre,
        unidadBase: insumos.unidadBase,
        paquetes: ordenCompraLineas.paquetes,
        unidadesPorPaquete: ordenCompraLineas.unidadesPorPaquete,
        cantidadBase: ordenCompraLineas.cantidadBase,
        costoTotal: ordenCompraLineas.costoTotal,
        costoUnitario: ordenCompraLineas.costoUnitario,
        cantidadRecibida: ordenCompraLineas.cantidadRecibida,
      })
      .from(ordenCompraLineas)
      .innerJoin(insumos, eq(ordenCompraLineas.insumoId, insumos.id))
      .where(eq(ordenCompraLineas.ordenCompraId, id))
      .orderBy(asc(insumos.codigo));

    return { ...orden, lineas };
  }

  async crearOrden(input: OrdenCompraInput) {
    const id = await this.db.transaction(async (tx) => {
      await this.validarProveedor(tx, input.proveedorId);
      await this.validarInsumos(tx, input.lineas);
      const [orden] = await tx
        .insert(ordenesCompra)
        .values({
          proveedorId: input.proveedorId,
          estado: 'borrador',
          fecha: input.fecha ?? hoyLima(),
          nota: input.nota,
          total: String(totalLineas(input.lineas)),
        })
        .returning();
      await this.insertarLineas(tx, orden.id, input.lineas);
      return orden.id;
    });
    return this.getOrden(id);
  }

  async actualizarOrden(id: string, input: OrdenCompraUpdate) {
    await this.db.transaction(async (tx) => {
      const orden = await this.bloquearOrden(tx, id);

      if (input.lineas) {
        if (orden.estado !== 'borrador')
          throw new BadRequestException(
            'Solo se pueden cambiar las líneas de una orden en borrador',
          );
        await this.validarInsumos(tx, input.lineas);
        await tx
          .delete(ordenCompraLineas)
          .where(eq(ordenCompraLineas.ordenCompraId, id));
        await this.insertarLineas(tx, id, input.lineas);
      }

      if (input.estado && input.estado !== orden.estado) {
        const permitidas = TRANSICIONES_OC[orden.estado] ?? [];
        if (!permitidas.includes(input.estado))
          throw new BadRequestException(
            `No se puede pasar una orden de "${orden.estado}" a "${input.estado}"`,
          );
      }

      await tx
        .update(ordenesCompra)
        .set({
          ...(input.estado && { estado: input.estado }),
          ...(input.nota !== undefined && { nota: input.nota }),
          ...(input.lineas && { total: String(totalLineas(input.lineas)) }),
          updatedAt: new Date(),
        })
        .where(eq(ordenesCompra.id, id));
    });
    return this.getOrden(id);
  }

  /**
   * Sección 5.10 — recepción (puede ser parcial). Cada línea recibida se
   * registra en unidad base (paquetes × unidades), inserta un movimiento
   * "compra" en el Kardex y recalcula el costo promedio del insumo.
   */
  async recepcion(id: string, input: RecepcionInput, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const orden = await this.bloquearOrden(tx, id);
      if (orden.estado !== 'enviada' && orden.estado !== 'recibida_parcial')
        throw new ConflictException(
          `Solo se recibe una orden enviada o recibida parcialmente (está "${orden.estado}")`,
        );

      const lineas = await tx
        .select()
        .from(ordenCompraLineas)
        .where(eq(ordenCompraLineas.ordenCompraId, id));
      const porId = new Map(lineas.map((l) => [l.id, l]));

      const vistos = new Set<string>();
      for (const r of input.lineas) {
        const linea = porId.get(r.lineaId);
        if (!linea)
          throw new BadRequestException(
            'Una de las líneas recibidas no pertenece a esta orden',
          );
        if (vistos.has(r.lineaId))
          throw new BadRequestException('Línea repetida en la recepción');
        vistos.add(r.lineaId);

        const cantidad = cantidadEnUnidadBase(r.paquetes, r.unidadesPorPaquete);
        const costoUnitario = costoUnitarioCompra(r.costoTotal, cantidad);

        await this.kardex.registrarMovimiento(tx, {
          insumoId: linea.insumoId,
          tipo: 'compra',
          entrada: cantidad,
          costoUnitario,
          referenciaTipo: 'orden_compra',
          referenciaId: id,
          nota: `OC #${orden.numero}: ${r.paquetes} × ${r.unidadesPorPaquete}${input.nota ? ` · ${input.nota}` : ''}`,
          usuarioId,
        });

        const recibida = round3(Number(linea.cantidadRecibida) + cantidad);
        await tx
          .update(ordenCompraLineas)
          .set({ cantidadRecibida: String(recibida) })
          .where(eq(ordenCompraLineas.id, linea.id));
        linea.cantidadRecibida = String(recibida);
      }

      const estado = estadoOrdenTrasRecepcion(
        lineas.map((l) => ({
          cantidadBase: Number(l.cantidadBase),
          cantidadRecibida: Number(l.cantidadRecibida),
        })),
      );
      await tx
        .update(ordenesCompra)
        .set({ estado, updatedAt: new Date() })
        .where(eq(ordenesCompra.id, id));
    });
    return this.getOrden(id);
  }

  // ---------------- helpers ----------------

  private async bloquearOrden(tx: Tx, id: string) {
    const [orden] = await tx
      .select()
      .from(ordenesCompra)
      .where(eq(ordenesCompra.id, id))
      .for('update')
      .limit(1);
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    return orden;
  }

  private async validarProveedor(tx: Tx, proveedorId: string) {
    const [p] = await tx
      .select()
      .from(proveedores)
      .where(eq(proveedores.id, proveedorId))
      .limit(1);
    if (!p || !p.activo)
      throw new BadRequestException('Proveedor inexistente o inactivo');
  }

  private async validarInsumos(tx: Tx, lineas: OrdenCompraLineaInput[]) {
    const ids = [...new Set(lineas.map((l) => l.insumoId))];
    if (ids.length !== lineas.length)
      throw new BadRequestException('Hay insumos repetidos en la orden');
    const encontrados = await tx
      .select({ id: insumos.id })
      .from(insumos)
      .where(and(inArray(insumos.id, ids), eq(insumos.activo, true)));
    if (encontrados.length !== ids.length)
      throw new BadRequestException('Hay insumos inexistentes o inactivos');
  }

  private async insertarLineas(
    tx: Tx,
    ordenId: string,
    lineas: OrdenCompraLineaInput[],
  ) {
    await tx.insert(ordenCompraLineas).values(
      lineas.map((l) => {
        const cantidad = cantidadEnUnidadBase(l.paquetes, l.unidadesPorPaquete);
        return {
          ordenCompraId: ordenId,
          insumoId: l.insumoId,
          paquetes: String(l.paquetes),
          unidadesPorPaquete: String(l.unidadesPorPaquete),
          costoTotal: String(l.costoTotal),
          costoUnitario: String(costoUnitarioCompra(l.costoTotal, cantidad)),
        };
      }),
    );
  }
}

function totalLineas(lineas: OrdenCompraLineaInput[]): number {
  return (
    Math.round(lineas.reduce((acc, l) => acc + l.costoTotal, 0) * 100) / 100
  );
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}
