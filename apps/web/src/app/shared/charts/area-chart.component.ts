import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  effect,
  signal,
} from "@angular/core";
import type { ScriptableContext } from "chart.js";
import { Chart, TOKENS, crosshair, ejeValores, etiquetaDirecta, tooltipBase } from "./chart-base";
import type { Punto } from "./escala";

/**
 * Área de una sola serie con Chart.js: línea curva monótona de 2px, relleno
 * con degradado muy suave, cuadrícula hairline, etiqueta solo en el último
 * valor, crosshair + tooltip (mouse y teclado) y tabla accesible.
 */
@Component({
  selector: "app-area-chart",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [style.height.px]="alto">
      <canvas #lienzo role="img" [attr.aria-label]="titulo"></canvas>
    </div>
    <table class="sr-only">
      <caption>{{ titulo }}</caption>
      <tbody>
        @for (d of serie(); track d.detalle) {
          <tr><th scope="row">{{ d.detalle }}</th><td>{{ formato(d.valor) }}</td></tr>
        }
      </tbody>
    </table>
  `,
  host: { class: "block" },
})
export class AreaChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild("lienzo", { static: true }) lienzo!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) set datos(v: Punto[]) {
    this.serie.set(v ?? []);
  }
  @Input() titulo = "";
  @Input() alto = 220;
  /** Color de la serie (validado ≥ 3:1 sobre blanco). */
  @Input() color = "#b7791f";
  @Input() formato: (v: number) => string = (v) => v.toLocaleString("es-PE");

  readonly serie = signal<Punto[]>([]);
  private chart?: Chart<"line", number[], string>;

  constructor() {
    // Polling del dashboard: actualiza los datos sin recrear el gráfico.
    effect(() => {
      const datos = this.serie();
      if (!this.chart) return;
      this.chart.data.labels = datos.map((d) => d.etiqueta);
      this.chart.data.datasets[0].data = datos.map((d) => d.valor);
      this.chart.data.datasets[0].pointRadius = datos.map((_, i) => (i === datos.length - 1 ? 4 : 0));
      this.chart.update("none");
    });
  }

  ngAfterViewInit(): void {
    const datos = this.serie();
    const color = this.color;
    this.chart = new Chart<"line", number[], string>(this.lienzo.nativeElement, {
      type: "line",
      data: {
        labels: datos.map((d) => d.etiqueta),
        datasets: [
          {
            data: datos.map((d) => d.valor),
            borderColor: color,
            borderWidth: 2,
            cubicInterpolationMode: "monotone",
            fill: "origin",
            backgroundColor: (ctx: ScriptableContext<"line">) => {
              const area = ctx.chart.chartArea;
              if (!area) return "transparent";
              const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              g.addColorStop(0, hexAlpha(color, 0.16));
              g.addColorStop(1, hexAlpha(color, 0));
              return g;
            },
            pointRadius: datos.map((_, i) => (i === datos.length - 1 ? 4 : 0)),
            pointHoverRadius: 4,
            pointBackgroundColor: color,
            pointBorderColor: TOKENS.superficie,
            pointBorderWidth: 2,
            pointHoverBorderWidth: 2,
            pointHitRadius: 12,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 18, right: 6 } },
        plugins: tooltipBase(this.formato, (i) => this.serie()[i]?.detalle ?? ""),
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, padding: 6 },
          },
          y: ejeValores(),
        },
      },
      plugins: [crosshair, etiquetaDirecta<"line">((v) => v.length - 1, this.formato)],
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}

function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
