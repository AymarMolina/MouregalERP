import { Component, computed, effect, ElementRef, HostListener, inject, signal, viewChild } from "@angular/core";
import { DialogoService } from "../../core/dialogo/dialogo.service";

/** Modal único del marco. Se monta una vez en el shell. */
@Component({
  selector: "app-dialogo",
  template: `
    @if (svc.abierto(); as d) {
      <div class="modal-fondo" (click)="fondo($event)">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo" #caja>
          <div class="modal-cabecera">
            <div>
              <h2 id="dialogo-titulo" class="text-[22px] font-bold leading-tight text-brand-darker">{{ d.titulo }}</h2>
              @if (d.detalle) {
                <p class="mt-1 text-[14px] text-muted">{{ d.detalle }}</p>
              }
            </div>
            <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-brand-darker hover:bg-brand-soft" (click)="svc.cerrar(null)" aria-label="Cerrar" title="Cerrar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
            </button>
          </div>

          @if (d.aviso || d.campo) {
            <div class="modal-cuerpo">
              @if (d.aviso) {
                <div class="rounded-xl bg-saldo-bg px-3.5 py-3 text-[14px] leading-relaxed text-saldo-fuerte">{{ d.aviso }}</div>
              }
              @if (d.campo; as c) {
                <fieldset class="flex flex-col gap-2">
                  <legend class="pb-2 text-[15px] font-semibold text-text">{{ c.etiqueta }}</legend>
                  @for (o of c.opciones ?? []; track o) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="opcion() === o"
                      class="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-left text-[14px] font-semibold text-text"
                      [class]="opcion() === o ? 'border-2 border-brand-darker' : 'border border-brand-input'"
                      (click)="elegir(o)"
                    >
                      <span class="h-[18px] w-[18px] shrink-0 rounded-full" [class]="opcion() === o ? 'border-[6px] border-rosa' : 'border-2 border-brand-agujero'"></span>
                      {{ o }}
                    </button>
                  }
                  @if (mostrarTexto()) {
                    <input
                      #texto
                      class="input"
                      [placeholder]="c.placeholder ?? ''"
                      [value]="valor()"
                      (input)="valor.set(texto.value)"
                      (keydown.enter)="aceptar()"
                      [attr.aria-label]="c.etiqueta"
                    />
                  }
                </fieldset>
                @if (falta()) {
                  <p class="text-[14px] font-semibold text-error" role="alert">{{ falta() }}</p>
                }
              }
            </div>
          }

          <div class="modal-pie">
            <button type="button" class="btn-secondary" (click)="svc.cerrar(null)">{{ d.cancelar ?? "Volver" }}</button>
            <button type="button" [class]="d.peligro ? 'btn-peligro' : 'btn-primary'" (click)="aceptar()">{{ d.aceptar }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DialogoComponent {
  readonly svc = inject(DialogoService);
  readonly caja = viewChild<ElementRef<HTMLElement>>("caja");
  readonly opcion = signal<string | null>(null);
  readonly valor = signal("");
  readonly falta = signal<string | null>(null);

  readonly mostrarTexto = computed(() => {
    const c = this.svc.abierto()?.campo;
    if (!c) return false;
    if (!c.opciones?.length) return true;
    return this.opcion() === c.opciones[c.opciones.length - 1];
  });

  constructor() {
    // Al abrir: limpia el formulario y lleva el foco al modal.
    effect(() => {
      const d = this.svc.abierto();
      this.opcion.set(null);
      this.valor.set("");
      this.falta.set(null);
      if (d) setTimeout(() => this.caja()?.nativeElement.querySelector<HTMLElement>("input, [role=radio], .btn-primary, .btn-peligro")?.focus());
    });
  }

  elegir(o: string): void {
    this.opcion.set(o);
    this.falta.set(null);
  }

  aceptar(): void {
    const d = this.svc.abierto();
    if (!d) return;
    const c = d.campo;
    if (!c) return this.svc.cerrar("");
    const ultima = c.opciones?.[c.opciones.length - 1];
    const texto = this.mostrarTexto() ? this.valor().trim() : "";
    let respuesta = c.opciones?.length ? (this.opcion() === ultima ? texto : (this.opcion() ?? "")) : texto;
    if (c.opciones?.length && !this.opcion()) {
      if (!c.opcional) return this.falta.set("Elige una opción.");
      respuesta = "";
    } else if (!respuesta && !c.opcional) {
      return this.falta.set("Escribe el motivo.");
    }
    this.svc.cerrar(respuesta);
  }

  fondo(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.svc.cerrar(null);
  }

  @HostListener("document:keydown.escape")
  escape(): void {
    if (this.svc.abierto()) this.svc.cerrar(null);
  }
}
