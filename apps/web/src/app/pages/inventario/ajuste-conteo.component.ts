import { Component, computed, EventEmitter, inject, Input, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AvisosService } from "../../core/avisos/avisos.service";
import { InsumosService } from "../../core/catalogo/insumos.service";
import type { Insumo } from "../../core/catalogo/catalogo.types";
import { mensajeError } from "../../core/http/errores";
import { cantidad } from "../../core/util/formato";

const MOTIVOS = ["Flores marchitas", "Rotura o daño", "Error de registro", "Otro"];

/** Modal "Ajustar por conteo": compara lo contado con el sistema y registra el ajuste en el Kardex. */
@Component({
  selector: "app-ajuste-conteo",
  imports: [FormsModule],
  template: `
    <div class="modal-fondo" (click)="fondo($event)">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ajuste-titulo">
        <div class="modal-cabecera">
          <h2 id="ajuste-titulo" class="text-[22px] font-bold text-brand-darker">Ajustar por conteo</h2>
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-brand-soft" (click)="cerrar.emit()" aria-label="Cerrar" title="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <label class="flex flex-col gap-1.5 text-[14px] font-semibold">
            Insumo
            <select class="input" [ngModel]="insumo()?.id" (ngModelChange)="insumoId.set($event); contado.set('')">
              @for (i of insumos; track i.id) {
                <option [value]="i.id">{{ i.nombre }}</option>
              }
            </select>
          </label>
          @if (insumo(); as i) {
            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-xl border border-brand-input px-3.5 py-3">
                <div class="text-[13px] text-muted">Según el sistema</div>
                <div class="text-[24px] font-bold">{{ cantidad(i.stockActual) }} <span class="text-[14px] font-medium">{{ i.unidadBase }}</span></div>
              </div>
              <label class="flex flex-col gap-1 rounded-xl border-2 border-brand-darker px-3.5 py-3 text-[13px] text-muted">
                Contaste
                <input type="number" min="0" step="any" [ngModel]="contado()" (ngModelChange)="contado.set($event)" placeholder="0" class="w-full border-0 bg-transparent p-0 text-[24px] font-bold text-text outline-none" />
              </label>
              <div class="rounded-xl px-3.5 py-3" [class]="tono()">
                <div class="text-[13px]">Diferencia</div>
                <div class="text-[24px] font-bold">{{ diferenciaTexto() }}</div>
              </div>
            </div>
          }
          <label class="flex flex-col gap-1.5 text-[14px] font-semibold">
            Motivo
            <select class="input" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)">
              <option value="">Elige un motivo</option>
              @for (m of motivos; track m) {
                <option [value]="m">{{ m }}</option>
              }
            </select>
          </label>
          @if (motivo() === "Otro") {
            <input class="input" [ngModel]="detalle()" (ngModelChange)="detalle.set($event)" placeholder="Explica la diferencia" aria-label="Detalle del motivo" />
          }
          <p class="text-[14px] text-muted">Se agrega al Kardex como ajuste, con tu nombre y la hora.</p>
          @if (error()) {
            <p class="text-[14px] font-semibold text-error" role="alert">{{ error() }}</p>
          }
        </div>
        <div class="modal-pie">
          <button type="button" class="btn-secondary" (click)="cerrar.emit()">Cancelar</button>
          <button type="button" class="btn-primary" [disabled]="guardando()" (click)="guardar()">{{ guardando() ? "Guardando..." : "Guardar ajuste" }}</button>
        </div>
      </div>
    </div>
  `,
})
export class AjusteConteoComponent {
  private readonly api = inject(InsumosService);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) insumos: Insumo[] = [];
  @Input() set inicial(id: string | null) {
    if (id) this.insumoId.set(id);
  }
  @Output() readonly cerrar = new EventEmitter<void>();
  @Output() readonly guardado = new EventEmitter<void>();

  readonly cantidad = cantidad;
  readonly motivos = MOTIVOS;
  readonly insumoId = signal("");
  readonly contado = signal<string | number>("");
  readonly motivo = signal("");
  readonly detalle = signal("");
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly insumo = computed<Insumo | null>(() => this.insumos.find((i) => i.id === this.insumoId()) ?? this.insumos[0] ?? null);
  readonly diferencia = computed(() => {
    const i = this.insumo();
    const c = this.contado();
    if (!i || c === "" || c === null || isNaN(Number(c))) return null;
    return Math.round((Number(c) - Number(i.stockActual)) * 1000) / 1000;
  });
  readonly diferenciaTexto = computed(() => {
    const d = this.diferencia();
    if (d === null) return "—";
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${cantidad(Math.abs(d))}`;
  });
  readonly tono = computed(() => {
    const d = this.diferencia();
    if (!d) return "bg-brand-soft text-text";
    return d < 0 ? "bg-saldo-bg text-saldo-fuerte" : "bg-estado-listo-bg text-estado-listo-fg";
  });

  async guardar(): Promise<void> {
    const i = this.insumo();
    const d = this.diferencia();
    if (!i) return;
    if (d === null) return this.error.set("Escribe cuánto contaste.");
    if (d === 0) return this.error.set("El conteo coincide con el sistema. No hay nada que ajustar.");
    if (!this.motivo()) return this.error.set("Elige el motivo de la diferencia.");
    const nota = this.motivo() === "Otro" ? this.detalle().trim() : this.motivo();
    if (!nota) return this.error.set("Explica el motivo de la diferencia.");
    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.api.ajustar({ insumoId: i.id, tipo: d > 0 ? "ajuste_positivo" : "ajuste_negativo", cantidad: Math.abs(d), nota: `Conteo físico: ${nota}` });
      this.avisos.exito("Ajuste guardado", `${i.nombre} queda en ${cantidad(Number(this.contado()))} ${i.unidadBase}.`);
      this.guardado.emit();
    } catch (err) {
      const m = mensajeError(err, "No se pudo guardar el ajuste.");
      this.error.set(m);
      this.avisos.error("No se guardó el ajuste", m);
    } finally {
      this.guardando.set(false);
    }
  }

  fondo(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.cerrar.emit();
  }
}
