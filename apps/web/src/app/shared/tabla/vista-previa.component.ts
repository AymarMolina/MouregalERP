import { Component, ElementRef, HostListener, computed, input, output, viewChild } from "@angular/core";
import { IconComponent } from "../icon/icon.component";
import { MembreteComponent } from "./membrete.component";
import { MARCA, formatoColumna, formatoValor, titulo, type Celda, type FormatoColumna } from "./excel";
import { imprimirElemento } from "./imprimir";
import type { Tabla } from "./tabla";

export interface DatoResumen {
  etiqueta: string;
  valor: string;
}

/**
 * Vista previa de un reporte como documento: muestra exactamente las filas y
 * columnas que salen en el Excel, y desde aquí se descarga el Excel o se
 * imprime / guarda en PDF (el diálogo de impresión del navegador).
 */
@Component({
  selector: "app-vista-previa",
  imports: [IconComponent, MembreteComponent],
  template: `
    <div class="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-gray-900/40 p-4 backdrop-blur-[2px] sm:p-8" (click)="cerrar.emit()">
      <div role="dialog" aria-modal="true" [attr.aria-label]="'Vista previa: ' + titulo()" class="flex h-fit w-full max-w-5xl flex-col" (click)="$event.stopPropagation()">
        <!-- Barra de acciones -->
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-line/80 bg-white px-4 py-2.5">
          <p class="font-medium text-text">Vista previa · <span class="text-muted">{{ filas().length }} {{ filas().length === 1 ? "fila" : "filas" }}</span></p>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary" [disabled]="!filas().length" (click)="descargarExcel()">
              <app-icon name="excel" [size]="15" class="text-green-700" /> Descargar Excel
            </button>
            <button type="button" class="btn-primary" [disabled]="!filas().length" (click)="imprimir()">
              <app-icon name="descargar" [size]="15" /> Imprimir / PDF
            </button>
            <button type="button" class="btn-action" (click)="cerrar.emit()" title="Cerrar (Esc)" aria-label="Cerrar"><app-icon name="cerrar" [size]="18" /></button>
          </div>
        </div>

        <!-- Hoja: esto es lo que se imprime -->
        <article #hoja class="hoja rounded-xl border border-brand-line/80 bg-white px-10 py-9 text-[#3A1F45]">
          <app-membrete [titulo]="titulo()" [periodo]="periodo()" />

          @if (resumen().length) {
            <div class="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              @for (d of resumen(); track d.etiqueta) {
                <div class="rounded-r-lg border-l-[3px] border-[#b584b9] bg-[#F4EBF7] px-4 py-2.5">
                  <p class="text-[10px] font-medium uppercase tracking-[0.14em] text-[#73607c]">{{ d.etiqueta }}</p>
                  <p class="mt-0.5 font-display text-[18px] font-semibold tabular-nums text-[#4e345a]">{{ d.valor }}</p>
                </div>
              }
            </div>
          }

          @if (filas().length) {
            <table class="w-full border-collapse text-[11.5px]">
              <thead>
                <tr class="bg-[#4e345a] text-white">
                  @for (c of columnas(); track c.clave) {
                    <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em]" [class.text-right]="c.numerica">{{ c.titulo }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (f of filas(); track $index) {
                  <tr class="border-b border-[#ece4ee] even:bg-[#faf6fb]">
                    @for (c of columnas(); track c.clave) {
                      <td class="px-3 py-2" [class.text-right]="c.numerica" [class.tabular-nums]="c.numerica" [class.whitespace-nowrap]="c.numerica">{{ valor(f[c.clave], c.formato) }}</td>
                    }
                  </tr>
                }
              </tbody>
              @if (totales(); as t) {
                <tfoot>
                  <tr class="border-t-2 border-[#4e345a] font-semibold text-[#4e345a]">
                    @for (c of columnas(); track c.clave; let primera = $first) {
                      <td class="whitespace-nowrap px-3 py-2.5 tabular-nums" [class.text-right]="c.numerica">
                        {{ primera ? "Total" : t[c.clave] !== undefined ? valor(t[c.clave], c.formato) : "" }}
                      </td>
                    }
                  </tr>
                </tfoot>
              }
            </table>
          } @else {
            <p class="py-10 text-center text-muted">No hay datos en este período.</p>
          }

          <footer class="mt-10 flex items-center justify-between gap-4 border-t border-[#ece4ee] pt-3 text-[10px] text-[#987f9c]">
            <span class="font-semibold uppercase tracking-[0.18em] text-[#9b73a1]">{{ marca }}</span>
            <span>{{ filas().length }} {{ filas().length === 1 ? "registro" : "registros" }} · Documento generado por el ERP</span>
          </footer>
        </article>
      </div>
    </div>
  `,
})
export class VistaPreviaComponent {
  readonly tabla = input.required<Tabla<unknown>>();
  readonly titulo = input.required<string>();
  readonly periodo = input("");
  readonly resumen = input<DatoResumen[]>([]);
  readonly cerrar = output<void>();

  private readonly hoja = viewChild.required<ElementRef<HTMLElement>>("hoja");

  readonly marca = MARCA;

  readonly filas = computed(() => this.tabla().filasExportables());

  readonly columnas = computed(() => {
    const filas = this.filas();
    const formatos = this.tabla().meta.formatos;
    return Object.keys(filas[0] ?? {}).map((clave) => {
      const formato = formatoColumna(clave, filas, formatos);
      return { clave, titulo: titulo(clave), formato, numerica: formato !== "texto" };
    });
  });

  /** Suma de las columnas marcadas como totales (null si la tabla no tiene). */
  readonly totales = computed<Record<string, number> | null>(() => {
    const claves = (this.tabla().meta.totales ?? []).filter((k) => this.columnas().some((c) => c.clave === k));
    if (!claves.length || !this.filas().length) return null;
    return Object.fromEntries(
      claves.map((k) => [k, this.filas().reduce((t, f) => t + (typeof f[k] === "number" ? (f[k] as number) : 0), 0)]),
    );
  });

  valor(v: Celda, formato: FormatoColumna): string {
    return formatoValor(v, formato);
  }

  descargarExcel(): void {
    this.tabla().exportarExcel({ titulo: this.titulo(), periodo: this.periodo(), resumen: this.resumen() });
  }

  @HostListener("document:keydown.escape")
  onEsc(): void {
    this.cerrar.emit();
  }

  imprimir(): void {
    imprimirElemento(this.hoja().nativeElement, `${this.titulo()} ${this.periodo()}`.trim());
  }
}
