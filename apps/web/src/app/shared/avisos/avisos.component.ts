import { Component, inject } from "@angular/core";
import { AvisosService } from "../../core/avisos/avisos.service";

/** Pila de avisos flotantes. Se monta una sola vez en el marco (shell). */
@Component({
  selector: "app-avisos",
  template: `
    <div class="pointer-events-none fixed right-5 top-5 z-[60] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2.5" aria-live="polite">
      @for (a of avisos.avisos(); track a.id) {
        <div
          role="status"
          class="aviso-flotante pointer-events-auto flex items-start gap-3 rounded-xl border border-brand-line bg-white py-3.5 pl-3.5 pr-2.5 shadow-pop"
          [class.border-l-exito]="a.tipo === 'exito'"
          [class.border-l-error]="a.tipo === 'error'"
          style="border-left-width: 5px"
        >
          @if (a.tipo === "exito") {
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F8A4C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mt-px shrink-0">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="m8 12.5 2.5 2.5L16 9.5"></path>
            </svg>
          } @else {
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B3261E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mt-px shrink-0">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7.5v5.5M12 16.5h.01"></path>
            </svg>
          }
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[15px] font-bold leading-snug text-brand-darker">{{ a.titulo }}</span>
            @if (a.detalle) {
              <span class="text-[13px] leading-snug text-muted">{{ a.detalle }}</span>
            }
          </div>
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand hover:bg-brand-line"
            (click)="avisos.cerrar(a.id)"
            aria-label="Cerrar aviso"
            title="Cerrar aviso"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class AvisosComponent {
  readonly avisos = inject(AvisosService);
}
