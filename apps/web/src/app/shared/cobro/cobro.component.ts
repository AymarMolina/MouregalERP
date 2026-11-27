import { Component, computed, effect, input, output, signal, untracked } from "@angular/core";
import type { MetodoCobroDirecto } from "@erp/shared";
import { soles } from "../../core/util/formato";
import { IconComponent, type NombreIcono } from "../icon/icon.component";

export interface ParteCobroUi {
  metodo: MetodoCobroDirecto;
  monto: number;
  referencia?: string;
}

/** Lo que el bloque de cobro le cuenta a quien lo usa. */
export interface EstadoCobro {
  partes: ParteCobroUi[];
  /** null = todo cuadra. */
  error: string | null;
}

interface Linea {
  metodo: MetodoCobroDirecto;
  /** Solo las líneas 2+ tienen monto escrito; la primera se lleva lo que falta. */
  monto: number | null;
  referencia: string;
}

export const METODOS_COBRO: { valor: MetodoCobroDirecto; etiqueta: string; icono: NombreIcono }[] = [
  { valor: "efectivo", etiqueta: "Efectivo", icono: "ventas" },
  { valor: "yape", etiqueta: "Yape", icono: "telefono" },
  { valor: "plin", etiqueta: "Plin", icono: "telefono" },
  { valor: "tarjeta", etiqueta: "Tarjeta", icono: "pagos" },
  { valor: "transferencia", etiqueta: "Transferencia", icono: "enlace" },
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cobro en uno o varios métodos. La primera línea siempre se lleva lo que
 * falta (no hay que sumar a mano): "10 en efectivo y 20 por Yape" es elegir
 * Yape, tocar "Dividir", escribir 10 y elegir Efectivo. En efectivo calcula
 * el vuelto.
 */
@Component({
  selector: "app-cobro",
  imports: [IconComponent],
  template: `
    <div class="space-y-3">
      @for (l of lineas(); track $index; let i = $index) {
        <div class="rounded-xl border border-brand-line p-3" [class.bg-sidebar]="lineas().length > 1">
          <div class="flex flex-wrap items-center gap-2">
            @for (m of metodos; track m.valor) {
              <button
                type="button"
                class="chip py-2"
                [class.chip-sel]="l.metodo === m.valor"
                [attr.aria-pressed]="l.metodo === m.valor"
                (click)="cambiar(i, { metodo: m.valor })"
              >
                <app-icon [name]="m.icono" [size]="14" class="mr-1" /> {{ m.etiqueta }}
              </button>
            }
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            @if (i === 0) {
              <div class="text-[14px]">
                <span class="text-muted">{{ lineas().length > 1 ? "Resto" : "Monto" }}:</span>&nbsp;
                <strong class="tabular" [class.text-red-700]="montoPrimera() < 0">{{ soles(montoPrimera()) }}</strong>
              </div>
            } @else {
              <div class="relative">
                <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">S/</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  class="input w-32 py-2 pl-8 text-right tabular"
                  [value]="l.monto ?? ''"
                  (input)="cambiar(i, { monto: numero($any($event.target).value) })"
                  [attr.aria-label]="'Monto en ' + etiqueta(l.metodo)"
                  placeholder="0.00"
                />
              </div>
              <button type="button" class="btn-text text-red-700" (click)="quitar(i)">
                <app-icon name="eliminar" [size]="14" /> Quitar
              </button>
            }
            @if (l.metodo !== "efectivo") {
              <input
                class="input max-w-[13rem] flex-1 py-2"
                placeholder="N° de operación (opcional)"
                [value]="l.referencia"
                (input)="cambiar(i, { referencia: $any($event.target).value })"
                aria-label="Número de operación"
              />
            }
          </div>
        </div>
      }

      <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
        @if (lineas().length < 4) {
          <button type="button" class="btn-text -ml-2" (click)="dividir()">
            <app-icon name="nuevo" [size]="14" /> Dividir en otro método
          </button>
        }
        @if (efectivo() > 0) {
          <div class="flex items-center gap-2">
            <label class="text-[14px] text-muted" for="pagaCon">Paga con</label>
            <div class="relative">
              <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">S/</span>
              <input
                id="pagaCon"
                type="number"
                min="0"
                class="input w-28 py-2 pl-8 text-right tabular"
                [value]="pagaCon() ?? ''"
                (input)="pagaCon.set(numero($any($event.target).value))"
                placeholder="—"
              />
            </div>
            @if (vuelto() !== null) {
              <span class="text-[14px]" [class.text-red-700]="vuelto()! < 0">
                {{ vuelto()! < 0 ? "Faltan " + soles(-vuelto()!) : "Vuelto " + soles(vuelto()!) }}
              </span>
            }
          </div>
        }
      </div>
      @if (estado().error; as e) {
        <p class="text-[13px] text-red-700">{{ e }}</p>
      }
    </div>
  `,
})
export class CobroComponent {
  /** Cuánto se cobra en total (lo que se reparte entre los métodos). */
  readonly monto = input.required<number>();
  /** Método con el que arranca (p. ej. efectivo en tienda). */
  readonly metodoInicial = input<MetodoCobroDirecto>("efectivo");
  readonly cambio = output<EstadoCobro>();

  readonly soles = soles;
  readonly metodos = METODOS_COBRO;
  readonly lineas = signal<Linea[]>([{ metodo: "efectivo", monto: null, referencia: "" }]);
  readonly pagaCon = signal<number | null>(null);

  constructor() {
    effect(() => {
      const m = this.metodoInicial();
      untracked(() => this.lineas.update((ls) => (ls.length === 1 ? [{ ...ls[0], metodo: m }] : ls)));
    });
    effect(() => {
      const e = this.estado();
      untracked(() => this.cambio.emit(e));
    });
  }

  /** La primera línea se lleva lo que falta para llegar al monto. */
  readonly montoPrimera = computed(() =>
    r2(this.monto() - this.lineas().slice(1).reduce((acc, l) => acc + (l.monto ?? 0), 0)),
  );

  readonly estado = computed<EstadoCobro>(() => {
    const ls = this.lineas();
    const partes: ParteCobroUi[] = ls
      .map((l, i) => ({
        metodo: l.metodo,
        monto: i === 0 ? this.montoPrimera() : r2(l.monto ?? 0),
        referencia: l.referencia.trim() || undefined,
      }))
      .filter((p) => p.monto > 0);
    let error: string | null = null;
    if (this.montoPrimera() < 0) error = `Los montos suman más de ${soles(this.monto())}.`;
    else if (ls.slice(1).some((l) => !l.monto)) error = "Escribe el monto de cada método o quítalo.";
    return { partes, error };
  });

  /** Lo que se recibe en efectivo (para el vuelto). */
  readonly efectivo = computed(() =>
    this.estado()
      .partes.filter((p) => p.metodo === "efectivo")
      .reduce((acc, p) => acc + p.monto, 0),
  );

  readonly vuelto = computed(() => {
    const c = this.pagaCon();
    return c ? r2(c - this.efectivo()) : null;
  });

  cambiar(i: number, cambio: Partial<Linea>): void {
    this.lineas.update((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  }

  /** Agrega un método: el más común que aún no se usa. */
  dividir(): void {
    const usados = new Set(this.lineas().map((l) => l.metodo));
    const metodo = this.metodos.find((m) => !usados.has(m.valor))?.valor ?? "efectivo";
    this.lineas.update((ls) => [...ls, { metodo, monto: null, referencia: "" }]);
  }

  quitar(i: number): void {
    this.lineas.update((ls) => ls.filter((_, j) => j !== i));
  }

  numero(v: string): number | null {
    const n = Number(v);
    return v === "" || !Number.isFinite(n) || n < 0 ? null : n;
  }

  etiqueta(m: MetodoCobroDirecto): string {
    return this.metodos.find((x) => x.valor === m)?.etiqueta ?? m;
  }
}
