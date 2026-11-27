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
import { COLORES_DONA } from "../../shared/charts/donut-chart.component";
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

/** Minutos desde la medianoche en Lima. */
function minutosLima(): number {
  const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return h * 60 + m;
}

@Component({
  selector: "app-hoy",
  imports: [RouterLink, FormsModule, IconComponent, RowMenuComponent, ...TABLA_CONTROLES],
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

  /** Hora actual en Lima, en minutos desde la medianoche (se renueva con cada carga). */
  private readonly ahoraMin = signal(minutosLima());

  /** Resumen del día en una frase. */
  readonly resumen = computed(() => {
    const k = this.data()?.kpis;
    return {
      pedidos: `${k?.pedidosHoy ?? 0} ${k?.pedidosHoy === 1 ? "pedido" : "pedidos"}`,
      ventas: soles(k?.ventasHoy ?? 0),
      porCobrar: soles(k?.porCobrar ?? 0),
    };
  });

  /** Franjas del riel: 9, 11, 13, 15, 17 y 19 h. Lo anterior a las 11 cae en 9, lo posterior a las 19 en 19. */
  readonly riel = computed(() => {
    const franjas = [9, 11, 13, 15, 17, 19];
    const ahoraH = Math.floor(this.ahoraMin() / 60);
    const delivery = (this.data()?.pedidos ?? []).filter((p) => p.tipoEntrega !== "recojo" && p.estado !== "cancelado");
    return franjas.map((desde, i) => {
      const hasta = franjas[i + 1] ?? 24;
      const enFranja = (h: number) => (i === 0 ? h < hasta : h >= desde && h < hasta);
      return {
        desde,
        etiqueta: `${desde}:00`,
        ahora: enFranja(ahoraH),
        pedidos: delivery.filter((p) => enFranja(Number(p.horaEntrega.slice(0, 2)))).sort((a, b) => a.horaEntrega.localeCompare(b.horaEntrega)),
      };
    });
  });

  readonly recojos = computed(() =>
    (this.data()?.pedidos ?? []).filter((p) => p.tipoEntrega === "recojo" && p.estado !== "cancelado").sort((a, b) => a.horaEntrega.localeCompare(b.horaEntrega)),
  );

  readonly atrasadosLista = computed(() => (this.data()?.pedidos ?? []).filter((p) => this.atrasado(p)));
  readonly atrasados = computed(() => this.atrasadosLista().length);

  /** Ya pasó la hora de entrega y el pedido aún no salió ni se entregó. */
  atrasado(p: PedidoDelDia): boolean {
    if (!["pendiente", "en_armado", "listo"].includes(p.estado)) return false;
    const [h, m] = p.horaEntrega.split(":").map(Number);
    return h * 60 + (m || 0) < this.ahoraMin();
  }

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

  /** Pedidos activos del día por estado, para la dona y su leyenda. */
  readonly estados = computed(() => {
    const conteo = this.data()?.kpis.conteoPorEstado ?? {};
    const total = ESTADOS_DIA.reduce((a, e) => a + (conteo[e] ?? 0), 0);
    return {
      total,
      partes: ESTADOS_DIA.map((e, i) => ({
        estado: e,
        n: conteo[e] ?? 0,
        pct: total ? Math.round(((conteo[e] ?? 0) / total) * 100) : 0,
        color: COLORES_DONA[i % COLORES_DONA.length],
      })),
      dona: ESTADOS_DIA.map<Punto>((e) => ({
        etiqueta: ETIQUETA_ESTADO_PEDIDO[e],
        detalle: ETIQUETA_ESTADO_PEDIDO[e],
        valor: conteo[e] ?? 0,
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
          p.codigo.toLowerCase().includes(q) ||
          (p.nombreReceptor ?? "").toLowerCase().includes(q) ||
          p.cliente.toLowerCase().includes(q) ||
          (p.distrito ?? "tienda").toLowerCase().includes(q)),
    );
  });

  readonly tabla = new Tabla(() => this.pedidosFiltrados(), {
    id: (p) => p.id,
    porPagina: 10,
    nombreCsv: "pedidos-hoy",
    titulo: "Pedidos del día",
    totales: ["total", "saldo"],
    csv: (p) => ({
      pedido: p.codigo,
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
      this.ahoraMin.set(minutosLima());
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
