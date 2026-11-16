import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { mensajeError } from "../../core/http/errores";
import { ReportesApi } from "../../core/operacion/operacion.service";
import type {
  ReporteCobros,
  ReporteEnvios,
  ReporteMargen,
  ReporteMasVendidos,
  ReporteMerma,
} from "../../core/operacion/operacion.types";
import { RouterLink } from "@angular/router";
import { ETIQUETA_ESTADO_PEDIDO, cantidad, diasDesdeHoy, hoyLima, soles } from "../../core/util/formato";
import { BarChartComponent } from "../../shared/charts/bar-chart.component";
import type { Punto } from "../../shared/charts/escala";
import { Tabla } from "../../shared/tabla/tabla";
import { TABLA_CONTROLES } from "../../shared/tabla/tabla-controles.component";

type Pestana = "cobros" | "margen" | "merma" | "vendidos" | "envios";

@Component({
  selector: "app-reportes",
  imports: [FormsModule, RouterLink, BarChartComponent, ...TABLA_CONTROLES],
  templateUrl: "./reportes.component.html",
})
export class ReportesComponent implements OnInit {
  private readonly api = inject(ReportesApi);

  readonly soles = soles;
  readonly cantidad = cantidad;
  readonly pestanas: { id: Pestana; label: string }[] = [
    { id: "cobros", label: "Cobros" },
    { id: "margen", label: "Margen" },
    { id: "merma", label: "Merma" },
    { id: "vendidos", label: "Más vendidos" },
    { id: "envios", label: "Envíos" },
  ];
  readonly atajos = [
    { label: "7 días", dias: 7 },
    { label: "30 días", dias: 30 },
    { label: "90 días", dias: 90 },
  ];

  readonly pestana = signal<Pestana>("cobros");
  readonly desde = signal(diasDesdeHoy(-29));
  readonly hasta = signal(hoyLima());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly margen = signal<ReporteMargen | null>(null);
  readonly merma = signal<ReporteMerma | null>(null);
  readonly vendidos = signal<ReporteMasVendidos | null>(null);
  readonly envios = signal<ReporteEnvios | null>(null);
  readonly cobros = signal<ReporteCobros | null>(null);
  readonly etiquetaEstado = ETIQUETA_ESTADO_PEDIDO;

  /** Atajo de período elegido (solo para marcar la pestaña activa). */
  readonly atajo = signal<number | "mes" | null>(30);

  readonly tablaMargen = new Tabla(() => this.margen()?.filas ?? [], {
    id: (f) => `${f.producto}|${f.talla}`,
    porPagina: 10,
    nombreCsv: "reporte-margen",
    csv: (f) => ({ producto: f.producto, talla: f.talla, unidades: f.unidades, ingresos: f.ingresos, costo: f.costo, margen: f.margen, margenPct: f.margenPct }),
  });
  readonly tablaMerma = new Tabla(() => this.merma()?.filas ?? [], {
    id: (f) => f.insumoId,
    porPagina: 10,
    nombreCsv: "reporte-merma",
    csv: (f) => ({
      codigo: f.codigo,
      insumo: f.nombre,
      unidad: f.unidadBase,
      mermaProduccion: f.cantidadProduccion,
      valorProduccion: f.valorProduccion,
      mermaCancelacion: f.cantidadCancelacion,
      valorCancelacion: f.valorCancelacion,
      valorTotal: f.valorTotal,
    }),
  });
  readonly tablaVendidos = new Tabla(() => this.vendidos()?.filas ?? [], {
    id: (f) => `${f.producto}|${f.talla}`,
    porPagina: 10,
    nombreCsv: "reporte-mas-vendidos",
    csv: (f) => ({ producto: f.producto, talla: f.talla, unidades: f.unidades, pedidos: f.pedidos, ingresos: f.ingresos }),
  });
  readonly tablaEnvios = new Tabla(() => this.envios()?.filas ?? [], {
    id: (f) => `${f.distrito}|${f.vehiculo}`,
    porPagina: 10,
    nombreCsv: "reporte-envios",
    csv: (f) => ({ distrito: f.distrito, vehiculo: f.vehiculo, viajes: f.viajes, cobrado: f.cobrado, costo: f.costo, diferencia: f.diferencia }),
  });

  readonly tablaCobros = new Tabla(() => this.cobros()?.filas ?? [], {
    id: (f) => f.pagoId,
    porPagina: 15,
    nombreCsv: "reporte-cobros",
    csv: (f) => ({
      fecha: this.fechaHora(f.pagadoAt),
      pedido: f.numero,
      cliente: f.cliente,
      tipo: f.tipo,
      metodo: f.metodo,
      monto: f.monto,
      estadoPedido: ETIQUETA_ESTADO_PEDIDO[f.estadoPedido],
    }),
  });

  /** "09/11 17:01" en hora de Lima. */
  fechaHora(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  protected readonly Math = Math;
  readonly formatoUnidades = (v: number) => `${v} und.`;

  /** Top 10 para el ranking horizontal (la tabla de abajo tiene todos). */
  readonly topVendidos = computed<Punto[]>(() =>
    (this.vendidos()?.filas ?? []).slice(0, 10).map((f) => ({
      etiqueta: `${f.producto} ${f.talla}`,
      detalle: `${f.producto} talla ${f.talla} · ${f.pedidos} pedidos · ${soles(f.ingresos)}`,
      valor: f.unidades,
    })),
  );

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async usarAtajo(dias: number): Promise<void> {
    this.atajo.set(dias);
    this.desde.set(diasDesdeHoy(-(dias - 1)));
    this.hasta.set(hoyLima());
    await this.cargar();
  }

  async mesActual(): Promise<void> {
    this.atajo.set("mes");
    this.desde.set(`${hoyLima().slice(0, 8)}01`);
    this.hasta.set(hoyLima());
    await this.cargar();
  }

  async cargar(): Promise<void> {
    if (!this.desde() || !this.hasta()) return;
    if (this.desde() > this.hasta()) {
      this.error.set("La fecha 'desde' debe ser anterior o igual a 'hasta'.");
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const r = { desde: this.desde(), hasta: this.hasta() };
    try {
      const [margen, merma, vendidos, envios, cobros] = await Promise.all([
        this.api.margen(r),
        this.api.merma(r),
        this.api.masVendidos(r),
        this.api.envios(r),
        this.api.cobros(r),
      ]);
      this.margen.set(margen);
      this.merma.set(merma);
      this.vendidos.set(vendidos);
      this.envios.set(envios);
      this.cobros.set(cobros);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los reportes."));
    } finally {
      this.loading.set(false);
    }
  }

}
