import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { descargarExcel } from "../../shared/tabla/excel";
import { IconComponent } from "../../shared/icon/icon.component";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { mensajeError } from "../../core/http/errores";
import { DeliveryApi } from "../../core/operacion/operacion.service";
import type { PedidoDelivery, TableroDelivery } from "../../core/operacion/operacion.types";
import { CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, cuando, hora, hoyLima, soles } from "../../core/util/formato";
import { usarPolling } from "../../core/util/polling";

type Columna = { titulo: string; vacio: string; pedidos: PedidoDelivery[] };

@Component({
  selector: "app-delivery",
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: "./delivery.component.html",
})
export class DeliveryComponent implements OnInit {
  private readonly api = inject(DeliveryApi);
  private readonly auth = inject(AuthService);

  readonly soles = soles;
  readonly hora = hora;
  readonly cuando = cuando;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;

  readonly fecha = signal(hoyLima());
  readonly tablero = signal<TableroDelivery | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly trabajando = signal<string | null>(null);
  readonly soloMios = signal(false);
  /** Repartidor elegido por pedido (admin/vendedora). */
  readonly repartidorPorPedido = signal<Partial<Record<string, string>>>({});

  exportarExcel(): void {
    const pedidos = this.tablero()?.pedidos ?? [];
    descargarExcel(
      "delivery",
      pedidos.map((p) => ({
        pedido: p.numero,
        estado: ETIQUETA_ESTADO_PEDIDO[p.estado],
        fechaEntrega: p.fechaEntrega,
        hora: hora(p.horaEntrega),
        distrito: p.distrito,
        direccion: p.direccion,
        referencia: p.referencia,
        recibe: p.nombreReceptor,
        telefono: p.telefonoReceptor,
        vehiculo: p.vehiculo,
        repartidor: p.repartidor ?? "Sin asignar",
        total: Number(p.total),
        pagado: Number(p.totalPagado),
        saldo: p.saldo,
      })),
      "Delivery",
    );
  }

  readonly esRepartidor = computed(() => this.auth.user()?.rol === "delivery");
  readonly puedeEntregar = computed(() => ["admin", "delivery"].includes(this.auth.user()?.rol ?? ""));

  readonly columnas = computed<Columna[]>(() => {
    const t = this.tablero();
    if (!t) return [];
    const uid = this.auth.user()?.id;
    const visibles = this.soloMios() ? t.pedidos.filter((p) => !p.repartidorId || p.repartidorId === uid) : t.pedidos;
    return [
      {
        titulo: "Listos para despachar",
        vacio: "No hay pedidos listos.",
        pedidos: visibles.filter((p) => p.estado === "listo"),
      },
      { titulo: "En camino", vacio: "Nada en camino.", pedidos: visibles.filter((p) => p.estado === "en_camino") },
      {
        titulo: "Entregados del día",
        vacio: "Aún no hay entregas.",
        pedidos: visibles.filter((p) => p.estado === "entregado"),
      },
    ];
  });

  constructor() {
    usarPolling(() => this.cargar(false));
  }

  async ngOnInit(): Promise<void> {
    this.soloMios.set(this.esRepartidor());
    await this.cargar(true);
  }

  async cargar(mostrarCarga: boolean): Promise<void> {
    if (mostrarCarga) this.loading.set(true);
    try {
      this.tablero.set(await this.api.tablero(this.fecha()));
      this.error.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cargar el tablero de despacho."));
    } finally {
      this.loading.set(false);
    }
  }

  elegirRepartidor(pedidoId: string, repartidorId: string): void {
    this.repartidorPorPedido.update((m) => ({ ...m, [pedidoId]: repartidorId }));
  }

  async despachar(p: PedidoDelivery): Promise<void> {
    this.trabajando.set(p.id);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const repartidorId = this.esRepartidor() ? undefined : this.repartidorPorPedido()[p.id] || undefined;
      await this.api.despachar(p.id, repartidorId);
      this.aviso.set(
        p.saldo > 0 && !p.linkSaldo
          ? `#${p.numero} despachado. Se envió al cliente el link del saldo (${soles(p.saldo)}).`
          : `#${p.numero} despachado.`,
      );
      await this.cargar(false);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo despachar el pedido."));
    } finally {
      this.trabajando.set(null);
    }
  }

  async entregar(p: PedidoDelivery): Promise<void> {
    if (p.saldo > 0 && !confirm(`El pedido #${p.numero} aún debe ${soles(p.saldo)}. ¿Marcar entregado igual?`)) return;
    this.trabajando.set(p.id);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await this.api.entregar(p.id);
      this.aviso.set(`#${p.numero} entregado.`);
      await this.cargar(false);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo marcar como entregado."));
    } finally {
      this.trabajando.set(null);
    }
  }

  async copiarLink(url: string | null): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.aviso.set("Link copiado al portapapeles.");
    } catch {
      this.aviso.set(url);
    }
  }

  telefonoWhatsapp(tel: string): string {
    const digitos = tel.replace(/\D/g, "");
    return `https://wa.me/${digitos.length === 9 ? `51${digitos}` : digitos}`;
  }
}
