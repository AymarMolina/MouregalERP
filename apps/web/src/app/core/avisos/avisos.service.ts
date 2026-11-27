import { Injectable, signal } from "@angular/core";

export type TipoAviso = "exito" | "error";

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  detalle?: string;
}

/**
 * Avisos flotantes (arriba a la derecha): blancos con línea verde si algo salió
 * bien y roja si hubo un error o algo urgente. Se cierran solos a los 5 s.
 * Mensajes directos, sin emojis: "Pago registrado", "Pedido NO-0037 creado".
 */
@Injectable({ providedIn: "root" })
export class AvisosService {
  private siguiente = 1;
  readonly avisos = signal<Aviso[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  exito(titulo: string, detalle?: string): void {
    this.mostrar("exito", titulo, detalle);
  }

  error(titulo: string, detalle?: string): void {
    this.mostrar("error", titulo, detalle);
  }

  cerrar(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.avisos.update((l) => l.filter((a) => a.id !== id));
  }

  private mostrar(tipo: TipoAviso, titulo: string, detalle?: string): void {
    const id = this.siguiente++;
    // Máximo 3 a la vez: el más viejo sale primero.
    this.avisos.update((l) => [...l.slice(-2), { id, tipo, titulo, detalle }]);
    this.timers.set(
      id,
      setTimeout(() => this.cerrar(id), 5000),
    );
  }
}
