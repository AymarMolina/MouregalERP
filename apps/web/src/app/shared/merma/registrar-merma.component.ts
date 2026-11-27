import { Component, computed, EventEmitter, inject, Input, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MOTIVO_MERMA, MOTIVO_MERMA_ETIQUETA, esUnidadEntera, type MotivoMerma } from "@erp/shared";
import { AvisosService } from "../../core/avisos/avisos.service";
import type { Insumo } from "../../core/catalogo/catalogo.types";
import { InsumosService } from "../../core/catalogo/insumos.service";
import { mensajeError } from "../../core/http/errores";
import { cantidad, soles } from "../../core/util/formato";

/**
 * Modal "Registrar merma": lo que se pierde fuera de un pedido (se marchitó en la
 * cámara, llegó dañado, se cayó). Sale del stock y aparece en Reportes → Merma.
 */
@Component({
  selector: "app-registrar-merma",
  imports: [FormsModule],
  template: `
    <div class="modal-fondo" (click)="fondo($event)">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="merma-titulo">
        <div class="modal-cabecera">
          <h2 id="merma-titulo" class="text-[22px] font-bold text-brand-darker">Registrar merma</h2>
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-brand-soft" (click)="cerrar.emit()" aria-label="Cerrar" title="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <p class="text-[14px] leading-snug text-muted">
            Para lo que se pierde fuera de un pedido. Lo que se rompe mientras armas un ramo se anota en el pedido, en «Se perdió».
          </p>
          <label class="flex flex-col gap-1.5 text-[14px] font-semibold">
            Insumo
            <select class="input" [ngModel]="insumo()?.id" (ngModelChange)="insumoId.set($event)">
              @for (i of activos(); track i.id) {
                <option [value]="i.id">{{ i.nombre }}</option>
              }
            </select>
          </label>
          @if (insumo(); as i) {
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 rounded-xl border-2 border-brand-darker px-3.5 py-3 text-[13px] text-muted">
                Cantidad perdida ({{ i.unidadBase }})
                <input type="number" min="0" [step]="esUnidadEntera(i.unidadBase) ? 1 : 0.001" [ngModel]="cantidadTxt()" (ngModelChange)="cantidadTxt.set($event)" placeholder="0" class="w-full border-0 bg-transparent p-0 text-[24px] font-bold text-text outline-none" />
              </label>
              <div class="rounded-xl bg-brand-soft px-3.5 py-3">
                <div class="text-[13px] text-muted">Queda en almacén</div>
                <div class="text-[24px] font-bold" [class.text-error]="quedaria() < 0">{{ cantidad(quedaria()) }} <span class="text-[14px] font-medium">{{ i.unidadBase }}</span></div>
                @if (valor() > 0) {
                  <div class="text-[12px] text-muted">Pérdida aprox. {{ soles(valor()) }}</div>
                }
              </div>
            </div>
          }
          <fieldset class="flex flex-col gap-2">
            <legend class="mb-1.5 text-[14px] font-semibold">¿Qué pasó?</legend>
            <div class="flex flex-wrap gap-2">
              @for (m of motivos; track m) {
                <button type="button" class="chip" [class.chip-sel]="motivo() === m" [attr.aria-pressed]="motivo() === m" (click)="motivo.set(m)">{{ etiqueta[m] }}</button>
              }
            </div>
          </fieldset>
          <input class="input" [ngModel]="nota()" (ngModelChange)="nota.set($event)" [placeholder]="motivo() === 'otro' ? 'Explica qué pasó' : 'Detalle (opcional)'" aria-label="Detalle" maxlength="200" />
          @if (error()) {
            <p class="text-[14px] font-semibold text-error" role="alert">{{ error() }}</p>
          }
        </div>
        <div class="modal-pie">
          <button type="button" class="btn-secondary" (click)="cerrar.emit()">Cancelar</button>
          <button type="button" class="btn-primary" [disabled]="guardando()" (click)="guardar()">{{ guardando() ? "Guardando..." : "Registrar merma" }}</button>
        </div>
      </div>
    </div>
  `,
})
export class RegistrarMermaComponent {
  private readonly api = inject(InsumosService);
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) set insumos(lista: Insumo[]) {
    this.lista.set(lista);
  }
  @Input() set inicial(id: string | null) {
    if (id) this.insumoId.set(id);
  }
  @Output() readonly cerrar = new EventEmitter<void>();
  @Output() readonly guardado = new EventEmitter<void>();

  readonly cantidad = cantidad;
  readonly soles = soles;
  readonly esUnidadEntera = esUnidadEntera;
  readonly motivos = MOTIVO_MERMA;
  readonly etiqueta = MOTIVO_MERMA_ETIQUETA;

  private readonly lista = signal<Insumo[]>([]);
  /** Flores primero (es lo que más se marchita), luego el resto por nombre. */
  readonly activos = computed(() =>
    this.lista()
      .filter((i) => i.activo)
      .sort((x, y) => Number(y.esFlor) - Number(x.esFlor) || x.nombre.localeCompare(y.nombre, "es")),
  );
  readonly insumoId = signal("");
  readonly cantidadTxt = signal<string | number>("");
  readonly motivo = signal<MotivoMerma | "">("");
  readonly nota = signal("");
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly insumo = computed<Insumo | null>(() => this.activos().find((i) => i.id === this.insumoId()) ?? this.activos()[0] ?? null);
  readonly cant = computed(() => {
    const c = Number(this.cantidadTxt());
    return isNaN(c) ? 0 : c;
  });
  readonly quedaria = computed(() => Math.round((Number(this.insumo()?.stockActual ?? 0) - this.cant()) * 1000) / 1000);
  readonly valor = computed(() => this.cant() * Number(this.insumo()?.costoPromedio ?? 0));

  async guardar(): Promise<void> {
    const i = this.insumo();
    if (!i) return;
    if (this.cant() <= 0) return this.error.set("Escribe cuánto se perdió.");
    if (this.quedaria() < 0) return this.error.set(`En el sistema solo hay ${cantidad(i.stockActual)} ${i.unidadBase}. Si no cuadra, usa «Ajustar por conteo».`);
    const motivo = this.motivo();
    if (!motivo) return this.error.set("Elige qué pasó.");
    const nota = this.nota().trim();
    if (motivo === "otro" && !nota) return this.error.set("Explica qué pasó.");
    this.error.set(null);
    this.guardando.set(true);
    try {
      const r = await this.api.registrarMerma({ insumoId: i.id, cantidad: this.cant(), motivo, nota: nota || undefined });
      this.avisos.exito("Merma registrada", `${cantidad(this.cant())} ${i.unidadBase} de ${i.nombre}. Quedan ${cantidad(r.stock)}.`);
      this.guardado.emit();
    } catch (err) {
      const m = mensajeError(err, "No se pudo registrar la merma.");
      this.error.set(m);
      this.avisos.error("No se registró la merma", m);
    } finally {
      this.guardando.set(false);
    }
  }

  fondo(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.cerrar.emit();
  }
}
