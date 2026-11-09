import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { mensajeError } from "../../core/http/errores";
import { ReportesApi } from "../../core/operacion/operacion.service";
import type {
  ReporteEnvios,
  ReporteMargen,
  ReporteMasVendidos,
  ReporteMerma,
} from "../../core/operacion/operacion.types";
import { cantidad, diasDesdeHoy, hoyLima, soles } from "../../core/util/formato";
import { BarChartComponent } from "../../shared/charts/bar-chart.component";
import type { Punto } from "../../shared/charts/escala";

type Pestana = "margen" | "merma" | "vendidos" | "envios";

@Component({
  selector: "app-reportes",
  imports: [FormsModule, BarChartComponent],
  templateUrl: "./reportes.component.html",
})
export class ReportesComponent implements OnInit {
  private readonly api = inject(ReportesApi);

  readonly soles = soles;
  readonly cantidad = cantidad;
  readonly pestanas: { id: Pestana; label: string }[] = [
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

  readonly pestana = signal<Pestana>("margen");
  readonly desde = signal(diasDesdeHoy(-29));
  readonly hasta = signal(hoyLima());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly margen = signal<ReporteMargen | null>(null);
  readonly merma = signal<ReporteMerma | null>(null);
  readonly vendidos = signal<ReporteMasVendidos | null>(null);
  readonly envios = signal<ReporteEnvios | null>(null);

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
    this.desde.set(diasDesdeHoy(-(dias - 1)));
    this.hasta.set(hoyLima());
    await this.cargar();
  }

  async mesActual(): Promise<void> {
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
      const [margen, merma, vendidos, envios] = await Promise.all([
        this.api.margen(r),
        this.api.merma(r),
        this.api.masVendidos(r),
        this.api.envios(r),
      ]);
      this.margen.set(margen);
      this.merma.set(merma);
      this.vendidos.set(vendidos);
      this.envios.set(envios);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar los reportes."));
    } finally {
      this.loading.set(false);
    }
  }

}
