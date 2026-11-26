import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { Canal, EstadoPedido } from "@erp/shared";
import { mensajeError } from "../../core/http/errores";
import { PedidosService } from "../../core/pedidos/pedidos.service";
import type { PedidoListado } from "../../core/pedidos/pedidos.types";
import { CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, cuando, diasDesdeHoy, soles } from "../../core/util/formato";
import { IconComponent } from "../../shared/icon/icon.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";

const ESTADOS: EstadoPedido[] = ["pendiente", "en_armado", "listo", "en_camino", "entregado", "cancelado"];
const CANAL: Record<Canal, string> = { shopify: "Web (Shopify)", whatsapp: "WhatsApp", vendedora: "En tienda" };

/** Historial de todos los pedidos: buscar uno viejo, ver qué pasó con él. */
@Component({
  selector: "app-pedidos-lista",
  imports: [FormsModule, RouterLink, IconComponent, ...TABLA_CONTROLES],
  templateUrl: "./pedidos-lista.component.html",
})
export class PedidosListaComponent implements OnInit {
  private readonly api = inject(PedidosService);

  readonly soles = soles;
  readonly cuando = cuando;
  readonly canal = CANAL;
  readonly estados = ESTADOS;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;

  // Por defecto: entregas de los últimos 30 días y de los próximos 30.
  readonly desde = signal(diasDesdeHoy(-30));
  readonly hasta = signal(diasDesdeHoy(30));
  readonly busqueda = signal("");
  readonly filtroEstado = signal<EstadoPedido | null>(null);
  readonly filas = signal<PedidoListado[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly buscadas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.filas();
    return this.filas().filter((p) =>
      [p.codigo, p.clienteNombre, p.clienteTelefono, p.nombreReceptor, p.telefonoReceptor, p.distrito, p.direccion].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  });

  readonly visibles = computed(() => {
    const e = this.filtroEstado();
    return e ? this.buscadas().filter((p) => p.estado === e) : this.buscadas();
  });

  conteo(e: EstadoPedido | null): number {
    return e ? this.buscadas().filter((p) => p.estado === e).length : this.buscadas().length;
  }

  saldo(p: PedidoListado): number {
    return p.estado === "cancelado" ? 0 : Math.max(0, Number(p.total) - Number(p.totalPagado));
  }

  readonly tabla = new Tabla(() => this.visibles(), {
    id: (p) => p.id,
    porPagina: 15,
    nombreCsv: "pedidos",
    titulo: "Pedidos",
    totales: ["total", "pagado", "saldo"],
    csv: (p) => ({
      pedido: p.codigo,
      vendido: p.createdAt.slice(0, 10),
      entrega: `${p.fechaEntrega} ${p.horaEntrega.slice(0, 5)}`,
      canal: CANAL[p.canal],
      cliente: p.clienteNombre,
      telefono: p.clienteTelefono ?? "",
      destino: p.tipoEntrega === "recojo" ? "Recoge en tienda" : (p.distrito ?? ""),
      estado: ETIQUETA_ESTADO_PEDIDO[p.estado],
      total: Number(p.total),
      pagado: Number(p.totalPagado),
      saldo: this.saldo(p),
    }),
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      this.filas.set(await this.api.list({ desde: this.desde() || undefined, hasta: this.hasta() || undefined }));
      this.error.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los pedidos."));
    } finally {
      this.loading.set(false);
    }
  }
}
