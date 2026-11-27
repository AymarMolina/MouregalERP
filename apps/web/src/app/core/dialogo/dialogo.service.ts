import { Injectable, signal } from "@angular/core";

export interface PedidoDialogo {
  titulo: string;
  /** Texto debajo del título (qué pasará). */
  detalle?: string;
  /** Aviso ámbar dentro del cuerpo (por ejemplo, dinero ya cobrado). */
  aviso?: string;
  /** Texto del botón principal. */
  aceptar: string;
  cancelar?: string;
  /** Botón principal en rojo (acciones que no se deshacen). */
  peligro?: boolean;
  /** Si viene, el modal pide un texto. */
  campo?: {
    etiqueta: string;
    placeholder?: string;
    opcional?: boolean;
    /** Respuestas rápidas; la última opción "Otro" abre el campo de texto. */
    opciones?: string[];
  };
}

interface DialogoAbierto extends PedidoDialogo {
  resolver: (valor: string | null) => void;
}

/**
 * Modales propios que reemplazan confirm() y prompt() del navegador.
 * `confirmar` devuelve true/false; `pedirTexto` devuelve el texto o null si se cancela.
 */
@Injectable({ providedIn: "root" })
export class DialogoService {
  readonly abierto = signal<DialogoAbierto | null>(null);

  confirmar(d: Omit<PedidoDialogo, "campo">): Promise<boolean> {
    return this.abrir(d).then((v) => v !== null);
  }

  pedirTexto(d: PedidoDialogo & { campo: NonNullable<PedidoDialogo["campo"]> }): Promise<string | null> {
    return this.abrir(d);
  }

  cerrar(valor: string | null): void {
    const d = this.abierto();
    if (!d) return;
    this.abierto.set(null);
    d.resolver(valor);
  }

  private abrir(d: PedidoDialogo): Promise<string | null> {
    // Si había otro abierto, se cancela.
    this.cerrar(null);
    return new Promise((resolver) => this.abierto.set({ ...d, resolver }));
  }
}
