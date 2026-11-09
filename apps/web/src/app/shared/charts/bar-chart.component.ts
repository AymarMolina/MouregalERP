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
import { Chart, TOKENS, ejeValores, etiquetaDirecta, tooltipBase } from "./chart-base";
import type { Punto } from "./escala";

/**
 * Barras de una sola serie con Chart.js: ≤ 24px de grosor, extremo de datos
 * redondeado (4px) y base recta, cuadrícula hairline, valor solo en la barra
 * pico, tooltip por barra y tabla accesible. `horizontal` para rankings.
 */
@Component({
  selector: "app-bar-chart",
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
export class BarChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild("lienzo", { static: true }) lienzo!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) set datos(v: Punto[]) {
    this.serie.set(v ?? []);
  }
  @Input() titulo = "";
  @Input() alto = 200;
  @Input() color = "#b7791f";
  @Input() enteros = true;
  @Input() horizontal = false;
  @Input() formato: (v: number) => string = (v) => v.toLocaleString("es-PE");

  readonly serie = signal<Punto[]>([]);
  private chart?: Chart<"bar", number[], string>;

  constructor() {
    effect(() => {
      const datos = this.serie();
      if (!this.chart) return;
      this.chart.data.labels = datos.map((d) => d.etiqueta);
      this.chart.data.datasets[0].data = datos.map((d) => d.valor);
      this.chart.update("none");
    });
  }

  ngAfterViewInit(): void {
    const datos = this.serie();
    const valores = { ...ejeValores(this.enteros) };
    const categorias = {
      grid: { display: false },
      border: { display: false },
      ticks: { autoSkip: false, maxRotation: 0, padding: 6, color: this.horizontal ? TOKENS.texto : TOKENS.muted },
    };
    this.chart = new Chart<"bar", number[], string>(this.lienzo.nativeElement, {
      type: "bar",
      data: {
        labels: datos.map((d) => d.etiqueta),
        datasets: [
          {
            data: datos.map((d) => d.valor),
            backgroundColor: this.color,
            hoverBackgroundColor: "#9a6519",
            borderRadius: 4,
            borderSkipped: "start",
            maxBarThickness: 24,
            categoryPercentage: 0.8,
            barPercentage: 0.9,
          },
        ],
      },
      options: {
        indexAxis: this.horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: this.horizontal ? 0 : 18, right: this.horizontal ? 36 : 4 } },
        interaction: { mode: "nearest", intersect: false, axis: this.horizontal ? "y" : "x" },
        plugins: tooltipBase(this.formato, (i) => this.serie()[i]?.detalle ?? ""),
        scales: this.horizontal ? { x: valores, y: categorias } : { x: categorias, y: valores },
      },
      plugins: [
        etiquetaDirecta<"bar">((v) => v.indexOf(Math.max(...v)), this.formato),
      ],
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
