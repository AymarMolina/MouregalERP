import { DatePipe } from "@angular/common";
import { Component, Input, OnInit, inject, signal } from "@angular/core";
import { PedidosService } from "../../core/pedidos/pedidos.service";
import type { HistorialEstado, PedidoDetalle } from "../../core/pedidos/pedidos.types";

@Component({
  selector: "app-pedido-detalle",
  imports: [DatePipe],
  templateUrl: "./pedido-detalle.component.html",
})
export class PedidoDetalleComponent implements OnInit {
  private readonly pedidosService = inject(PedidosService);

  @Input() id = "";

  readonly pedido = signal<PedidoDetalle | null>(null);
  readonly historial = signal<HistorialEstado[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [pedido, historial] = await Promise.all([
        this.pedidosService.get(this.id),
        this.pedidosService.historial(this.id),
      ]);
      this.pedido.set(pedido);
      this.historial.set(historial);
    } catch {
      this.error.set("No se pudo cargar el pedido.");
    } finally {
      this.loading.set(false);
    }
  }
}
