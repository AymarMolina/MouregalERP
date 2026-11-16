import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, ViewChild, signal } from "@angular/core";
import { IconComponent } from "../icon/icon.component";

/**
 * Menú de acciones de fila (tres puntos, alineado a la derecha).
 * Recibe los mismos botones `.btn-action` de siempre; dentro del menú se
 * muestran con su `aria-label` como texto. El panel es `fixed` para que el
 * `overflow-hidden` de la tabla no lo recorte.
 */
@Component({
  selector: "app-row-menu",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "flex justify-end" },
  template: `
    <button
      #disparador
      type="button"
      class="btn-action h-7 w-7"
      [class.bg-gray-100]="abierto()"
      [class.text-gray-900]="abierto()"
      (click)="alternar($event)"
      [attr.aria-expanded]="abierto()"
      aria-haspopup="menu"
      [title]="etiqueta"
      [attr.aria-label]="etiqueta"
    >
      <app-icon name="mas" [size]="16" />
    </button>
    <div
      class="row-menu-panel"
      role="menu"
      [class.hidden]="!abierto()"
      [style.top.px]="pos().top"
      [style.right.px]="pos().right"
      (click)="cerrar()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    .row-menu-panel {
      position: fixed;
      z-index: 60;
      min-width: 11rem;
      padding: 4px;
      border-radius: 10px;
      border: 1px solid rgb(229 231 235);
      background: #fff;
      box-shadow: 0 10px 30px -8px rgba(17, 24, 39, 0.18), 0 2px 6px -2px rgba(17, 24, 39, 0.06);
    }
    .row-menu-panel ::ng-deep .btn-action {
      display: flex;
      width: 100%;
      height: auto;
      justify-content: flex-start;
      gap: 0.6rem;
      padding: 0.45rem 0.6rem;
      border-radius: 6px;
      color: rgb(55 65 81);
      font-weight: 500;
      white-space: nowrap;
    }
    .row-menu-panel ::ng-deep .btn-action::after {
      content: attr(aria-label);
    }
    .row-menu-panel ::ng-deep .btn-action-danger {
      color: #b91c1c;
    }
  `,
})
export class RowMenuComponent {
  @Input() etiqueta = "Acciones";
  @ViewChild("disparador", { static: true }) disparador!: ElementRef<HTMLButtonElement>;

  readonly abierto = signal(false);
  readonly pos = signal({ top: 0, right: 0 });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  alternar(ev: Event): void {
    ev.stopPropagation();
    if (this.abierto()) return this.cerrar();
    const r = this.disparador.nativeElement.getBoundingClientRect();
    const alturaEstimada = 200;
    const abajo = r.bottom + 4;
    const top = abajo + alturaEstimada > window.innerHeight ? Math.max(8, r.top - alturaEstimada) : abajo;
    this.pos.set({ top, right: Math.max(8, window.innerWidth - r.right) });
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  @HostListener("document:pointerdown", ["$event"])
  fuera(ev: Event): void {
    if (this.abierto() && !this.host.nativeElement.contains(ev.target as Node)) this.cerrar();
  }

  @HostListener("document:keydown.escape")
  @HostListener("window:scroll")
  @HostListener("window:resize")
  alMover(): void {
    if (this.abierto()) this.cerrar();
  }
}
