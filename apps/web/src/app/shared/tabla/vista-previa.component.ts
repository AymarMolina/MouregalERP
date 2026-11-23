import { Component, ElementRef, HostListener, computed, input, output, viewChild } from "@angular/core";
import { IconComponent } from "../icon/icon.component";
import { titulo, type Celda } from "./excel";
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
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-gray-900/40 p-4 backdrop-blur-[2px] sm:p-8" (click)="cerrar.emit()">
      <div role="dialog" aria-modal="true" [attr.aria-label]="'Vista previa: ' + titulo()" class="flex h-fit w-full max-w-5xl flex-col" (click)="$event.stopPropagation()">
        <!-- Barra de acciones -->
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200/80 bg-white px-4 py-2.5">
          <p class="font-medium text-gray-900">Vista previa · <span class="text-muted">{{ filas().length }} {{ filas().length === 1 ? "fila" : "filas" }}</span></p>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary" [disabled]="!filas().length" (click)="tabla().exportarExcel()">
              <app-icon name="excel" [size]="15" class="text-green-700" /> Descargar Excel
            </button>
            <button type="button" class="btn-primary" [disabled]="!filas().length" (click)="imprimir()">
              <app-icon name="descargar" [size]="15" /> Imprimir / PDF
            </button>
            <button type="button" class="btn-action" (click)="cerrar.emit()" title="Cerrar (Esc)" aria-label="Cerrar"><app-icon name="cerrar" [size]="18" /></button>
          </div>
        </div>

        <!-- Hoja: esto es lo que se imprime -->
        <article #hoja class="hoja rounded-xl border border-gray-200/80 bg-white p-8 text-gray-900">
          <header class="mb-6 flex items-start justify-between gap-6 border-b border-gray-200 pb-4">
            <div>
              <h1 class="text-xl font-semibold">{{ titulo() }}</h1>
              <p class="mt-1 text-sm text-gray-500">{{ periodo() }}</p>
              <p class="text-xs text-gray-400">Generado el {{ generado }}</p>
            </div>
            <img src="logo-mouregal.png" alt="Mouregal" class="h-12 w-auto" />
          </header>

          @if (resumen().length) {
            <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              @for (d of resumen(); track d.etiqueta) {
                <div class="rounded-lg border border-gray-200 px-3 py-2">
                  <p class="text-xs text-gray-500">{{ d.etiqueta }}</p>
                  <p class="text-base font-semibold tabular-nums">{{ d.valor }}</p>
                </div>
              }
            </div>
          }

          @if (filas().length) {
            <table class="w-full border-collapse text-[12px]">
              <thead>
                <tr class="border-b-2 border-gray-300">
                  @for (c of columnas(); track c.clave) {
                    <th class="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-gray-500" [class.text-right]="c.numerica">{{ c.titulo }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (f of filas(); track $index) {
                  <tr class="border-b border-gray-100">
                    @for (c of columnas(); track c.clave) {
                      <td class="px-2 py-1.5" [class.text-right]="c.numerica" [class.tabular-nums]="c.numerica">{{ formato(f[c.clave]) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="py-10 text-center text-gray-500">No hay datos en este período.</p>
          }
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

  readonly generado = new Date().toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "long", timeStyle: "short" });

  readonly filas = computed(() => this.tabla().filasExportables());

  readonly columnas = computed(() => {
    const filas = this.filas();
    return Object.keys(filas[0] ?? {}).map((clave) => ({
      clave,
      titulo: titulo(clave),
      numerica: filas.every((f) => f[clave] == null || typeof f[clave] === "number"),
    }));
  });

  formato(v: Celda): string {
    if (v == null || v === "") return "—";
    if (typeof v === "number") {
      const dec = Number.isInteger(v) ? 0 : 2;
      return v.toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
    return String(v);
  }

  @HostListener("document:keydown.escape")
  onEsc(): void {
    this.cerrar.emit();
  }

  /**
   * Imprime solo la hoja: la copia a un iframe oculto con los mismos estilos.
   * El título del documento es el nombre que el navegador propone al guardar en PDF.
   */
  imprimir(): void {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow!;
    const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((e) => e.outerHTML)
      .join("");
    const nombre = `${this.titulo()} ${this.periodo()}`.replace(/[<>&"]/g, "");
    win.document.open();
    win.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${document.baseURI}"><title>${nombre}</title>${estilos}` +
        `<style>@page{margin:12mm}body{background:#fff}.hoja{border:0!important;padding:0!important}tr{break-inside:avoid}thead{display:table-header-group}</style>` +
        `</head><body>${this.hoja().nativeElement.outerHTML}</body></html>`,
    );
    win.document.close();
    // Espera a que carguen estilos y logo antes de abrir el diálogo.
    const lanzar = () => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
    };
    if (win.document.readyState === "complete") lanzar();
    else win.addEventListener("load", lanzar, { once: true });
  }
}
