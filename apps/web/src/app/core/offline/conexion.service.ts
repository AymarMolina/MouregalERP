import { HttpErrorResponse } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { environment } from "../../../environments/environment";

/**
 * La petición no llegó al API: sin internet o servidor caído.
 *
 * - 0: el navegador no pudo conectar.
 * - 504: lo que devuelve el service worker de Angular cuando no hay red.
 * - 502/503: el proxy del hosting (Railway, Nginx) cuando el API no responde.
 */
export function esFallaDeRed(err: unknown): boolean {
  return err instanceof HttpErrorResponse && [0, 502, 503, 504].includes(err.status);
}

/** Cada cuánto se prueba el servidor mientras no hay conexión. */
const REINTENTO_MS = 15_000;

/**
 * Estado de la conexión con el servidor.
 *
 * `enLinea` no se fía solo de `navigator.onLine` (que dice si hay red, no si
 * el servidor responde): lo baja cualquier petición que falle por red y lo
 * sube cualquier respuesta del servidor. Mientras está abajo, prueba
 * `/api/salud` cada 15 s para enterarse de que volvió.
 */
@Injectable({ providedIn: "root" })
export class ConexionService {
  readonly enLinea = signal(typeof navigator === "undefined" ? true : navigator.onLine);
  /** Fecha (ISO) del dato guardado más antiguo que se está mostrando sin conexión. */
  readonly datosDe = signal<string | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    window.addEventListener("online", () => void this.comprobar());
    window.addEventListener("offline", () => this.marcarSinConexion());
    if (!this.enLinea()) this.iniciarReintentos();
  }

  marcarEnLinea(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.enLinea()) return;
    this.enLinea.set(true);
    this.datosDe.set(null);
  }

  marcarSinConexion(): void {
    if (this.enLinea()) this.enLinea.set(false);
    this.iniciarReintentos();
  }

  registrarDatosDe(iso: string): void {
    const actual = this.datosDe();
    if (!actual || iso < actual) this.datosDe.set(iso);
  }

  /** Pregunta al servidor si ya responde. */
  async comprobar(): Promise<boolean> {
    try {
      const res = await fetch(`${environment.apiUrl}/salud`, { cache: "no-store" });
      if (res.ok) {
        this.marcarEnLinea();
        return true;
      }
    } catch {
      // sigue sin conexión
    }
    this.marcarSinConexion();
    return false;
  }

  private iniciarReintentos(): void {
    this.timer ??= setInterval(() => void this.comprobar(), REINTENTO_MS);
  }
}
