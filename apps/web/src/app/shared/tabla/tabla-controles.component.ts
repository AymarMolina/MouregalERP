import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { IconComponent } from "../icon/icon.component";
import type { Tabla } from "./tabla";

/** "Página 1 de 4" con flechas, para la esquina superior derecha de la tabla. */
@Component({
  selector: "app-paginacion",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "ml-auto flex items-center gap-2 text-[12px] text-gray-500" },
  template: `
    @if (tabla.exportable) {
      <button
        type="button"
        class="btn-secondary mr-1 px-2.5 py-1 text-[12px] shadow-none"
        (click)="tabla.exportarExcel()"
        [disabled]="tabla.total() === 0"
        [title]="tabla.cantidadSeleccionada() ? 'Descargar las filas seleccionadas en Excel' : 'Descargar todas las filas en Excel'"
      >
        <app-icon name="excel" [size]="14" class="text-green-700" /> Excel
      </button>
    }
    <span class="tabular">{{ rango() }}</span>
    <span class="hidden text-gray-300 sm:inline">·</span>
    <span class="hidden tabular sm:inline">Página {{ tabla.paginaActual() }} de {{ tabla.paginas() }}</span>
    <div class="flex items-center">
      <button
        type="button"
        class="btn-action h-7 w-7 rounded-md border border-gray-200 bg-white"
        (click)="tabla.anterior()"
        [disabled]="tabla.paginaActual() <= 1"
        title="Página anterior"
        aria-label="Página anterior"
      >
        <app-icon name="izquierda" [size]="15" />
      </button>
      <button
        type="button"
        class="btn-action ml-1 h-7 w-7 rounded-md border border-gray-200 bg-white"
        (click)="tabla.siguiente()"
        [disabled]="tabla.paginaActual() >= tabla.paginas()"
        title="Página siguiente"
        aria-label="Página siguiente"
      >
        <app-icon name="derecha" [size]="15" />
      </button>
    </div>
  `,
})
export class PaginacionComponent {
  @Input({ required: true }) tabla!: Tabla<any>;

  rango(): string {
    const total = this.tabla.total();
    if (total === 0) return "0 resultados";
    const desde = (this.tabla.paginaActual() - 1) * this.tabla.porPagina + 1;
    const hasta = Math.min(total, desde + this.tabla.porPagina - 1);
    return `${desde}–${hasta} de ${total}`;
  }
}

/** Barra que aparece al marcar filas: cuántas hay, exportar y limpiar. */
@Component({
  selector: "app-seleccion-bar",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tabla.cantidadSeleccionada() > 0) {
      <div class="seleccion-bar" role="status">
        <span class="font-medium text-gray-900 tabular">{{ tabla.cantidadSeleccionada() }} {{ tabla.cantidadSeleccionada() === 1 ? "seleccionado" : "seleccionados" }}</span>
        <span class="text-gray-300">·</span>
        @if (tabla.exportable) {
          <button type="button" class="btn-text py-0.5 text-[12px]" (click)="tabla.exportarExcel()">
            <app-icon name="excel" [size]="14" /> Exportar selección a Excel
          </button>
        }
        <ng-content />
        <button type="button" class="btn-text ml-auto py-0.5 text-[12px]" (click)="tabla.limpiar()">Quitar selección</button>
      </div>
    }
  `,
})
export class SeleccionBarComponent {
  @Input({ required: true }) tabla!: Tabla<any>;
}

/** Checkbox de la cabecera: marca o desmarca la página visible. */
@Component({
  selector: "app-check-todos",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input
    type="checkbox"
    class="checkbox"
    [checked]="tabla.todosMarcados()"
    [indeterminate]="tabla.algunosMarcados()"
    (change)="tabla.alternarPagina()"
    aria-label="Seleccionar todas las filas de la página"
  />`,
  host: { class: "inline-flex" },
})
export class CheckTodosComponent {
  @Input({ required: true }) tabla!: Tabla<any>;
}

/** Checkbox de una fila. */
@Component({
  selector: "app-check-fila",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input
    type="checkbox"
    class="checkbox"
    [checked]="tabla.marcado(fila)"
    (change)="tabla.alternar(fila)"
    (click)="$event.stopPropagation()"
    [attr.aria-label]="etiqueta"
  />`,
  host: { class: "inline-flex" },
})
export class CheckFilaComponent {
  @Input({ required: true }) tabla!: Tabla<any>;
  @Input({ required: true }) fila: unknown;
  @Input() etiqueta = "Seleccionar fila";
}

export const TABLA_CONTROLES = [PaginacionComponent, SeleccionBarComponent, CheckTodosComponent, CheckFilaComponent] as const;
