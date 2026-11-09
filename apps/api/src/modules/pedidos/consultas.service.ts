import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { ESTADO_CONSULTA, type ConsultaResolverInput } from '@erp/shared';
import type { EstadoConsulta } from '@erp/shared';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import {
  consultasProduccion,
  pagos,
  pedidoItemCambios,
  pedidoItems,
  pedidos,
} from '../../db/schema';

@Injectable()
export class ConsultasService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list(estado?: EstadoConsulta) {
    if (estado && !ESTADO_CONSULTA.includes(estado))
      throw new BadRequestException(`Estado de consulta inválido: ${estado}`);
    return this.db
      .select()
      .from(consultasProduccion)
      .where(estado ? eq(consultasProduccion.estado, estado) : undefined)
      .orderBy(desc(consultasProduccion.createdAt));
  }

  /**
   * Resuelve una consulta abierta (solo una vez). Si se aprueba con
   * `ajustePrecio`, el ajuste se aplica al pedido: queda registrado como un
   * cambio del primer ítem, sube/baja el subtotal y el total, y se recalcula
   * el adelanto pendiente manteniendo su porcentaje.
   */
  async resolver(
    id: string,
    input: ConsultaResolverInput,
    resueltaPor: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [consulta] = await tx
        .select()
        .from(consultasProduccion)
        .where(eq(consultasProduccion.id, id))
        .for('update')
        .limit(1);
      if (!consulta) throw new NotFoundException('Consulta no encontrada');
      if (consulta.estado !== 'abierta')
        throw new ConflictException(
          `La consulta ya fue resuelta (${consulta.estado})`,
        );

      const ajuste =
        input.estado === 'aprobada' && input.ajustePrecio
          ? round2(input.ajustePrecio)
          : 0;

      if (ajuste !== 0) {
        const [pedido] = await tx
          .select()
          .from(pedidos)
          .where(eq(pedidos.id, consulta.pedidoId))
          .for('update')
          .limit(1);
        if (!pedido) throw new NotFoundException('Pedido no encontrado');
        if (pedido.estado !== 'pendiente')
          throw new BadRequestException(
            `Solo se puede ajustar el precio de un pedido pendiente (está en "${pedido.estado}")`,
          );

        const nuevoSubtotal = round2(Number(pedido.subtotalProductos) + ajuste);
        const nuevoTotal = round2(Number(pedido.total) + ajuste);
        if (nuevoTotal < 0)
          throw new BadRequestException(
            'El ajuste dejaría el total en negativo',
          );

        const [primerItem] = await tx
          .select()
          .from(pedidoItems)
          .where(eq(pedidoItems.pedidoId, pedido.id))
          .orderBy(asc(pedidoItems.id))
          .limit(1);
        if (primerItem) {
          await tx.insert(pedidoItemCambios).values({
            pedidoItemId: primerItem.id,
            reglaId: null,
            descripcion: `Consulta aprobada: ${input.respuesta}`,
            ajuste: String(ajuste),
          });
          await tx
            .update(pedidoItems)
            .set({
              subtotal: String(round2(Number(primerItem.subtotal) + ajuste)),
            })
            .where(eq(pedidoItems.id, primerItem.id));
        }

        await tx
          .update(pedidos)
          .set({
            subtotalProductos: String(nuevoSubtotal),
            total: String(nuevoTotal),
            updatedAt: new Date(),
          })
          .where(eq(pedidos.id, pedido.id));

        // El adelanto aún no pagado mantiene su porcentaje sobre el nuevo total.
        const totalAnterior = Number(pedido.total);
        const adelantosPendientes = await tx
          .select()
          .from(pagos)
          .where(
            and(
              eq(pagos.pedidoId, pedido.id),
              eq(pagos.tipo, 'adelanto'),
              eq(pagos.estado, 'pendiente'),
            ),
          );
        for (const pago of adelantosPendientes) {
          const proporcion =
            totalAnterior > 0 ? Number(pago.monto) / totalAnterior : 0;
          await tx
            .update(pagos)
            .set({ monto: String(round2(nuevoTotal * proporcion)) })
            .where(eq(pagos.id, pago.id));
        }
      }

      const [actualizada] = await tx
        .update(consultasProduccion)
        .set({
          estado: input.estado,
          respuesta: input.respuesta,
          ajustePrecio: ajuste !== 0 ? String(ajuste) : null,
          resueltaPor,
          resueltaAt: new Date(),
        })
        .where(eq(consultasProduccion.id, id))
        .returning();

      return actualizada;
    });
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
