import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { EstadoPedido } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import { mensajeError } from "../../core/http/errores";
import { DashboardService } from "../../core/pedidos/pedidos.service";
import type { DashboardHoy, PedidoDelDia } from "../../core/pedidos/pedidos.types";
import { CLASE_ESTADO_PEDIDO, ETIQUETA_ESTADO_PEDIDO, cantidad, hora, soles } from "../../core/util/formato";
import { usarPolling } from "../../core/util/polling";
import { AreaChartComponent } from "../../shared/charts/area-chart.component";
import { BarChartComponent } from "../../shared/charts/bar-chart.component";
import type { Punto } from "../../shared/charts/escala";
import { IconComponent, type NombreIcono } from "../../shared/icon/icon.component";
import { RowMenuComponent } from "../../shared/tabla/row-menu.component";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";

/** Estados que se siguen en el día, en orden del flujo. */
const ESTADOS_DIA: EstadoPedido[] = ["pendiente", "en_armado", "listo", "en_camino", "entregado"];

interface Kpi {
  icono: NombreIcono;
  etiqueta: string;
  valor: string;
  variacion: number | null;
  /** Texto bajo el valor cuando no hay variación que mostrar. */
  nota?: string;
}

const fechaCorta = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const fechaLarga = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fechaTitulo = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const deFecha = (f: string) => new Date(`${f}T12:00:00Z`);

@Component({
  selector: "app-hoy",
  imports: [RouterLink, FormsModule, IconComponent, AreaChartComponent, BarChartComponent, RowMenuComponent, ...TABLA_CONTROLES],
  templateUrl: "./hoy.component.html",
})
export class HoyComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly auth = inject(AuthService);

  readonly soles = soles;
  readonly hora = hora;
  readonly cantidad = cantidad;
  readonly claseEstado = CLASE_ESTADO_PEDIDO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;
  readonly estadosDia = ESTADOS_DIA;
  readonly formatoSoles = (v: number) => soles(v);
  readonly formatoPedidos = (v: number) => `${v} ${v === 1 ? "pedido" : "pedidos"}`;

  readonly data = signal<DashboardHoy | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actualizado = signal<Date | null>(null);
  readonly busqueda = signal("");
  readonly filtroEstado = signal<EstadoPedido | null>(null);

  readonly puedeVender = computed(() => ["admin", "vendedora"].includes(this.auth.user()?.rol ?? ""));

  readonly titulo = computed(() => {
    const d = this.data();
    if (!d) return "";
    const t = fechaTitulo.format(deFecha(d.fecha));
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  readonly comparadoCon = computed(() => {
    const d = this.data();
    return d ? fechaLarga.format(deFecha(d.comparadoCon)) : "";
  });

  readonly kpis = computed<Kpi[]>(() => {
    const k = this.data()?.kpis;
    if (!k) return [];
    return [
      { icono: "pedido", etiqueta: "Pedidos del día", valor: String(k.pedidosHoy), variacion: k.pedidosVariacion },
      { icono: "ventas", etiqueta: "Ventas del día", valor: soles(k.ventasHoy), variacion: k.ventasVariacion },
      { icono: "ticket", etiqueta: "Ticket promedio", valor: soles(k.ticketPromedio), variacion: k.ticketVariacion },
      {
        icono: "pagos",
        etiqueta: "Saldo por cobrar",
        valor: soles(k.porCobrar),
        variacion: null,
        nota: `${k.pedidosConSaldo} ${k.pedidosConSaldo === 1 ? "pedido" : "pedidos"} con saldo`,
      },
    ];
  });

  readonly serieVentas = computed<Punto[]>(() =>
    (this.data()?.serieVentas ?? []).map((d) => ({
      etiqueta: fechaCorta.format(deFecha(d.fecha)),
      detalle: `${fechaLarga.format(deFecha(d.fecha))} · ${d.pedidos} ${d.pedidos === 1 ? "pedido" : "pedidos"}`,
      valor: d.ventas,
    })),
  );

  readonly totalSerie = computed(() => (this.data()?.serieVentas ?? []).reduce((a, d) => a + d.ventas, 0));

  readonly porHora = computed<Punto[]>(() =>
    (this.data()?.pedidosPorHora ?? []).map((h) => ({
      etiqueta: String(h.hora),
      detalle: `${String(h.hora).padStart(2, "0")}:00 – ${String(h.hora).padStart(2, "0")}:59`,
      valor: h.pedidos,
    })),
  );

  /** Pedidos activos del día por estado, para la barra segmentada. */
  readonly estados = computed(() => {
    const conteo = this.data()?.kpis.conteoPorEstado ?? {};
    const total = ESTADOS_DIA.reduce((a, e) => a + (conteo[e] ?? 0), 0);
    return {
      total,
      partes: ESTADOS_DIA.map((e) => ({
        estado: e,
        n: conteo[e] ?? 0,
        pct: total ? ((conteo[e] ?? 0) / total) * 100 : 0,
      })),
    };
  });

  readonly pedidosFiltrados = computed<PedidoDelDia[]>(() => {
    const q = this.busqueda().trim().toLowerCase().replace(/^#/, "");
    const estado = this.filtroEstado();
    return (this.data()?.pedidos ?? []).filter(
      (p) =>
        (!estado || p.estado === estado) &&
        (!q ||
          String(p.numero).includes(q) ||
          p.nombreReceptor.toLowerCase().includes(q) ||
          p.cliente.toLowerCase().includes(q) ||
          p.distrito.toLowerCase().includes(q)),
    );
  });

  readonly tabla = new Tabla(() => this.pedidosFiltrados(), {
    id: (p) => p.id,
    porPagina: 10,
    nombreCsv: "pedidos-hoy",
    csv: (p) => ({
      pedido: p.numero,
      hora: hora(p.horaEntrega),
      cliente: p.cliente,
      recibe: p.nombreReceptor,
      distrito: p.distrito,
      estado: ETIQUETA_ESTADO_PEDIDO[p.estado],
      total: p.total,
      saldo: this.saldo(p),
    }),
  });

  /** Pedidos del día en un estado (para el contador de cada pestaña). */
  conteo(estado: EstadoPedido | null): number {
    const pedidos = this.data()?.pedidos ?? [];
    return estado ? pedidos.filter((p) => p.estado === estado).length : pedidos.length;
  }

  constructor() {
    // Spec sección 8: el tablero se refresca cada 15 s.
    usarPolling(() => this.cargar());
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
    this.loading.set(false);
  }

  async cargar(): Promise<void> {
    try {
      this.data.set(await this.dashboardService.hoy());
      this.actualizado.set(new Date());
      this.error.set(null);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo cargar el resumen del día."));
    }
  }

  saldo(p: PedidoDelDia): number {
    return Math.max(0, Number(p.total) - Number(p.totalPagado));
  }

  /** Signo y clase de la variación: subir es bueno en las tres métricas con variación. */
  delta(v: number): string {
    return `${v > 0 ? "+" : ""}${v.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
  }
}
