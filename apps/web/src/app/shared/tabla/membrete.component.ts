import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MARCA, fechaGenerado } from "./excel";

/**
 * Membrete de los documentos (vista previa, PDF, reporte de ventas): logo,
 * marca, título, período y fecha de generación, con la línea en degradado.
 */
@Component({
  selector: "app-membrete",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block" },
  template: `
    <header class="flex items-center gap-7">
      <img src="logo-mouregal.png" alt="Mouregal · Flores y Detalles Deluxe" class="h-[88px] w-auto shrink-0" />
      <div class="min-w-0 flex-1 border-l border-[#e7dcea] pl-7">
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9b73a1]">{{ marca }}</p>
        <h1 class="mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-[#4e345a]">{{ titulo() }}</h1>
        @if (periodo()) {
          <p class="mt-1 text-[13px] text-[#73607c]">{{ periodo() }}</p>
        }
      </div>
      <div class="shrink-0 self-start text-right text-[10px] leading-relaxed text-[#987f9c]">
        <p class="font-semibold uppercase tracking-[0.18em]">Generado</p>
        <p>{{ generado }}</p>
      </div>
    </header>
    <div class="mb-7 mt-6 h-[3px] rounded-full bg-gradient-to-r from-[#4e345a] via-[#b584b9] to-[#F4EBF7]"></div>
  `,
})
export class MembreteComponent {
  readonly titulo = input.required<string>();
  readonly periodo = input("");
  readonly marca = MARCA;
  readonly generado = fechaGenerado();
}
