import { AvisosService } from "../../core/avisos/avisos.service";
import { Component, OnDestroy, effect, inject, input, output, signal, untracked } from "@angular/core";
import { FOTOS_PEDIDO } from "@erp/shared";
import { mensajeError } from "../../core/http/errores";
import { PedidosService } from "../../core/pedidos/pedidos.service";
import { IconComponent } from "../icon/icon.component";

interface FotoVista {
  id: string;
  url: string;
}

/** Lado mayor de la foto comprimida y calidad JPEG: ~150–300 KB por foto. */
const LADO_MAX = 1600;
const CALIDAD = 0.82;

/** Reduce la foto en el navegador antes de subirla (respeta la orientación EXIF). */
async function comprimir(archivo: File): Promise<Blob> {
  const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto"))), "image/jpeg", CALIDAD),
  );
}

/**
 * Fotos del arreglo terminado de un pedido. Con `editable`, Producción sube
 * (1 a 3) y quita fotos; sin él solo se muestran (Delivery).
 */
@Component({
  selector: "app-fotos-pedido",
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="space-y-2" data-tour="prod-fotos">
      <div class="flex items-center justify-between">
        <h3 class="font-medium">Fotos del arreglo</h3>
        @if (editable()) {
          <span class="text-muted tabular" [class.text-negativo]="fotos().length < min">{{ fotos().length }} de {{ max }}</span>
        }
      </div>
      @if (error()) {
        <p class="text-negativo">{{ error() }}</p>
      }
      <div class="flex flex-wrap gap-2">
        @for (f of fotos(); track f.id) {
          <div class="relative">
            <a [href]="f.url" target="_blank" rel="noopener" title="Ver foto en grande">
              <img [src]="f.url" alt="Foto del arreglo" class="h-24 w-24 rounded-lg border border-brand-line/80 object-cover" />
            </a>
            @if (editable()) {
              <button
                type="button"
                class="btn-action btn-action-danger absolute right-1 top-1 bg-white/90"
                (click)="quitar(f)"
                [disabled]="ocupado()"
                title="Quitar foto"
                aria-label="Quitar foto"
              >
                <app-icon name="eliminar" [size]="14" />
              </button>
            }
          </div>
        } @empty {
          @if (!editable()) {
            <p class="text-muted">Sin fotos todavía.</p>
          }
        }
        @if (editable() && fotos().length < max) {
          <label
            class="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand-input text-muted hover:bg-brand-band"
            [class.opacity-50]="ocupado()"
          >
            <app-icon name="foto" [size]="20" />
            <span>{{ ocupado() ? "Subiendo..." : "Agregar" }}</span>
            <input type="file" accept="image/*" multiple class="sr-only" [disabled]="ocupado()" (change)="elegir($event)" aria-label="Agregar fotos del arreglo" />
          </label>
        }
      </div>
      @if (editable() && fotos().length < min) {
        <p class="text-muted">Sube al menos {{ min }} foto para poder despachar.</p>
      }
    </div>
  `,
})
export class FotosPedidoComponent implements OnDestroy {
  private readonly avisosFlotantes = inject(AvisosService);
  private readonly api = inject(PedidosService);

  readonly pedidoId = input.required<string>();
  readonly editable = input(false);
  /** Avisa cuántas fotos hay (para habilitar "Pasar a en camino"). */
  readonly cantidad = output<number>();

  readonly min = FOTOS_PEDIDO.min;
  readonly max = FOTOS_PEDIDO.max;
  readonly fotos = signal<FotoVista[]>([]);
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.pedidoId();
      untracked(() => void this.cargar(id));
    });
  }

  ngOnDestroy(): void {
    this.liberar();
  }

  private liberar(): void {
    for (const f of this.fotos()) URL.revokeObjectURL(f.url);
  }

  private async cargar(id: string): Promise<void> {
    this.error.set(null);
    try {
      const lista = await this.api.listarFotos(id);
      const vistas = await Promise.all(
        lista.map(async (f) => ({ id: f.id, url: URL.createObjectURL(await this.api.fotoBlob(id, f.id)) })),
      );
      this.liberar();
      this.fotos.set(vistas);
      this.cantidad.emit(vistas.length);
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudieron cargar las fotos."));
    }
  }

  async elegir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivos = [...(entrada.files ?? [])].slice(0, this.max - this.fotos().length);
    entrada.value = "";
    if (!archivos.length) return;
    this.ocupado.set(true);
    this.error.set(null);
    try {
      for (const archivo of archivos) {
        await this.api.subirFoto(this.pedidoId(), await comprimir(archivo));
      }
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo subir la foto. Usa una imagen JPG o PNG."));
      this.avisosFlotantes.error(mensajeError(err, "No se pudo subir la foto. Usa una imagen JPG o PNG."));
    } finally {
      await this.cargar(this.pedidoId());
      this.ocupado.set(false);
    }
  }

  async quitar(f: FotoVista): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await this.api.eliminarFoto(this.pedidoId(), f.id);
      await this.cargar(this.pedidoId());
    } catch (err) {
      this.error.set(mensajeError(err, "No se pudo quitar la foto."));
      this.avisosFlotantes.error(mensajeError(err, "No se pudo quitar la foto."));
    } finally {
      this.ocupado.set(false);
    }
  }
}
