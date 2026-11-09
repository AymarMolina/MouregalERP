import { DatePipe } from "@angular/common";
import { Component, Input, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { calcularSaldo, validarTransicion } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import { mensajeError } from "../../core/http/errores";
import { PagosApi } from "../../core/operacion/operacion.service";
import type { Pago } from "../../core/operacion/operacion.types";
import { PedidosService } from "../../core/pedidos/pedidos.service";
import type { HistorialEstado, PedidoDetalle } from "../../core/pedidos/pedidos.types";
import { CLASE_ESTADO_PAGO, CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, hora, soles } from "../../core/util/formato";

@Component({
  selector: "app-pedido-detalle",
  imports: [DatePipe, RouterLink],
  templateUrl: "./pedido-detalle.component.html",
})
export class PedidoDetalleComponent implements OnInit {
  private readonly pedidosService = inject(PedidosService);
  private readonly pagosApi = inject(PagosApi);
  private readonly auth = inject(AuthService);

  @Input() id = "";

  readonly soles = soles;
  readonly hora = hora;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;
  readonly clasePago = CLASE_ESTADO_PAGO;

  readonly pedido = signal<PedidoDetalle | null>(null);
  readonly historial = signal<HistorialEstado[]>([]);
  readonly pagos = signal<Pago[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly cancelando = signal(false);

  readonly saldo = computed(() => {
    const p = this.pedido();
    return p ? calcularSaldo(Number(p.total), Number(p.totalPagado)) : 0;
  });

  readonly puedeVerPagos = computed(() => ["admin", "vendedora"].includes(this.auth.user()?.rol ?? ""));

  /** Misma regla que la API: quién puede cancelar y desde qué estado. */
  readonly puedeCancelar = computed(() => {
    const p = this.pedido();
    const rol = this.auth.user()?.rol;
    return !!p && !!rol && validarTransicion(rol, p.estado, "cancelado").ok;
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      const [pedido, historial, pagos] = await Promise.all([
        this.pedidosService.get(this.id),
        this.pedidosService.historial(this.id),
        this.pagosApi.delPedido(this.id).catch(() => [] as Pago[]),
      ]);
      this.pedido.set(pedido);
      this.historial.set(historial);
      this.pagos.set(pagos);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cargar el pedido."));
    } finally {
      this.loading.set(false);
    }
  }

  async cancelar(): Promise<void> {
    const p = this.pedido();
    if (!p) return;
    const motivo = prompt(`¿Cancelar el pedido #${p.numero}? Escribe el motivo:`);
    if (motivo === null) return;
    this.cancelando.set(true);
    this.errorAccion.set(null);
    try {
      await this.pedidosService.transicion(p.id, "cancelado", motivo || undefined);
      await this.cargar();
    } catch (err) {
      this.errorAccion.set(mensajeError(err, "No se pudo cancelar el pedido."));
    } finally {
      this.cancelando.set(false);
    }
  }

  num(v: string | number): number {
    return Number(v);
  }
}
