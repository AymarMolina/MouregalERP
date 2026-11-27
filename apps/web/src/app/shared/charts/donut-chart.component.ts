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
import { Chart, TOKENS, tooltipBase } from "./chart-base";
import type { Punto } from "./escala";

/**
 * Tonos de azul marino para las porciones, del más oscuro al más claro.
 * Todos dan ≥ 3:1 sobre blanco y se distinguen por claridad, no solo por tono
 * (daltonismo). Los bordes blancos separan las porciones vecinas.
 */
// Paleta categórica de marca validada para daltonismo (la misma de reporte-ventas).
export const COLORES_DONA = ["#8a4fa3", "#eb6834", "#1baf7a", "#eda100", "#2a78d6"];

/**
 * Dona de una serie con Chart.js: anillo con bordes blancos, tooltip claro y
 * tabla accesible. Lo que se pase como contenido se centra en el hueco
 * (por ejemplo, el total).
 */
@Component({
  selector: "app-donut-chart",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [style.height.px]="alto">
      <canvas #lienzo role="img" [attr.aria-label]="titulo"></canvas>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <ng-content />
      </div>
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
export class DonutChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild("lienzo", { static: true }) lienzo!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) set datos(v: Punto[]) {
    this.serie.set(v ?? []);
  }
  @Input() titulo = "";
  @Input() alto = 220;
  @Input() colores: string[] = COLORES_DONA;
  @Input() formato: (v: number) => string = (v) => v.toLocaleString("es-PE");

  readonly serie = signal<Punto[]>([]);
  private chart?: Chart<"doughnut", number[], string>;

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
    const plugins = tooltipBase(this.formato, (i) => this.serie()[i]?.detalle ?? "");
    // En la dona el valor parseado es un número, no {x, y}.
    plugins!.tooltip!.callbacks!.title = (items) => (items.length ? this.formato(Number(items[0].parsed)) : "");
    this.chart = new Chart<"doughnut", number[], string>(this.lienzo.nativeElement, {
      type: "doughnut",
      data: {
        labels: datos.map((d) => d.etiqueta),
        datasets: [
          {
            data: datos.map((d) => d.valor),
            backgroundColor: this.colores,
            borderColor: TOKENS.superficie,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: "70%",
        layout: { padding: 6 },
        plugins,
      },
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
