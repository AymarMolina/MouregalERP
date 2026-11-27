import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { DB } from '../../db/db.module';
import type { Db } from '../../db/client';
import { cajaMovimientos, cajas, pagos, pedidos } from '../../db/schema';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Caja por vendedora. El efectivo esperado es:
 * fondo + cobros en efectivo de esa persona desde que abrió + ingresos − egresos.
 * Los cobros por otros métodos se muestran para el cuadre del día, pero no
 * cuentan en el efectivo.
 */
@Injectable()
export class CajaService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Caja abierta del usuario con su resumen, o null si no tiene una abierta. */
  async actual(usuarioId: string) {
    const [caja] = await this.db
      .select()
      .from(cajas)
      .where(and(eq(cajas.usuarioId, usuarioId), isNull(cajas.cerradaAt)))
      .limit(1);
    if (!caja) {
      const [ultima] = await this.db
        .select()
        .from(cajas)
        .where(eq(cajas.usuarioId, usuarioId))
        .orderBy(desc(cajas.abiertaAt))
        .limit(1);
      return { abierta: null, ultima: ultima ?? null };
    }
    return { abierta: await this.resumen(caja), ultima: null };
  }

  async abrir(usuarioId: string, fondo: number) {
    if (!(fondo >= 0))
      throw new BadRequestException('El fondo no puede ser negativo');
    const [abierta] = await this.db
      .select({ id: cajas.id })
      .from(cajas)
      .where(and(eq(cajas.usuarioId, usuarioId), isNull(cajas.cerradaAt)))
      .limit(1);
    if (abierta) throw new ConflictException('Ya tienes una caja abierta');
    await this.db.insert(cajas).values({ usuarioId, fondo: String(r2(fondo)) });
    return this.actual(usuarioId);
  }

  async movimiento(
    usuarioId: string,
    input: { tipo: 'egreso' | 'ingreso'; monto: number; motivo: string },
  ) {
    const caja = await this.cajaAbierta(usuarioId);
    const monto = r2(input.monto);
    if (!(monto > 0))
      throw new BadRequestException('El monto debe ser mayor que cero');
    if (!input.motivo.trim())
      throw new BadRequestException('Escribe el motivo');
    if (input.tipo === 'egreso') {
      const { efectivoEsperado } = await this.resumen(caja);
      if (monto > efectivoEsperado + 0.001)
        throw new BadRequestException(
          `En caja solo hay S/ ${efectivoEsperado.toFixed(2)} en efectivo`,
        );
    }
    await this.db.insert(cajaMovimientos).values({
      cajaId: caja.id,
      tipo: input.tipo,
      monto: String(monto),
      motivo: input.motivo.trim(),
    });
    return this.actual(usuarioId);
  }

  async cerrar(usuarioId: string, contado: number, nota?: string) {
    const caja = await this.cajaAbierta(usuarioId);
    if (!(contado >= 0))
      throw new BadRequestException('Escribe el efectivo contado');
    const { efectivoEsperado } = await this.resumen(caja);
    const diferencia = r2(contado - efectivoEsperado);
    if (Math.abs(diferencia) > 0.001 && !nota?.trim())
      throw new BadRequestException('La caja no cuadra: explica la diferencia');
    await this.db
      .update(cajas)
      .set({
        cerradaAt: new Date(),
        esperado: String(efectivoEsperado),
        contado: String(r2(contado)),
        nota: nota?.trim() || null,
      })
      .where(eq(cajas.id, caja.id));
    const [cerrada] = await this.db
      .select()
      .from(cajas)
      .where(eq(cajas.id, caja.id));
    return { cerrada, diferencia };
  }

  private async cajaAbierta(usuarioId: string) {
    const [caja] = await this.db
      .select()
      .from(cajas)
      .where(and(eq(cajas.usuarioId, usuarioId), isNull(cajas.cerradaAt)))
      .limit(1);
    if (!caja) throw new NotFoundException('No tienes una caja abierta');
    return caja;
  }

  private async resumen(caja: typeof cajas.$inferSelect) {
    const [cobros, movimientos] = await Promise.all([
      this.db
        .select({
          id: pagos.id,
          metodo: pagos.metodo,
          monto: pagos.monto,
          pagadoAt: pagos.pagadoAt,
          codigo: pedidos.codigo,
          referencia: pagos.referenciaExterna,
        })
        .from(pagos)
        .innerJoin(pedidos, eq(pedidos.id, pagos.pedidoId))
        .where(
          and(
            eq(pagos.registradoPor, caja.usuarioId),
            eq(pagos.estado, 'pagado'),
            gte(pagos.pagadoAt, caja.abiertaAt),
          ),
        )
        .orderBy(desc(pagos.pagadoAt)),
      this.db
        .select()
        .from(cajaMovimientos)
        .where(eq(cajaMovimientos.cajaId, caja.id))
        .orderBy(desc(cajaMovimientos.createdAt)),
    ]);
    const porMetodo: Record<string, number> = {};
    for (const c of cobros)
      porMetodo[c.metodo] = r2((porMetodo[c.metodo] ?? 0) + Number(c.monto));
    const ingresos = movimientos
      .filter((m) => m.tipo === 'ingreso')
      .reduce((a, m) => a + Number(m.monto), 0);
    const egresos = movimientos
      .filter((m) => m.tipo === 'egreso')
      .reduce((a, m) => a + Number(m.monto), 0);
    const efectivoEsperado = r2(
      Number(caja.fondo) + (porMetodo['efectivo'] ?? 0) + ingresos - egresos,
    );
    return {
      caja,
      porMetodo,
      totalCobrado: r2(Object.values(porMetodo).reduce((a, v) => a + v, 0)),
      ingresos: r2(ingresos),
      egresos: r2(egresos),
      efectivoEsperado,
      cobros,
      movimientos,
    };
  }
}
