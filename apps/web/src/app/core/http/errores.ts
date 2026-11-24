import { HttpErrorResponse } from "@angular/common/http";
import { esFallaDeRed } from "../offline/conexion.service";

/**
 * Extrae el mensaje que devuelve la API (`{ code, message, details }`) para
 * mostrárselo al usuario; si no hay uno legible, usa el texto por defecto.
 */
export function mensajeError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse) {
    if (esFallaDeRed(err)) {
      return "Sin conexión a internet. Esta acción necesita conexión: vuelve a intentarlo cuando regrese.";
    }
    const message = (err.error as { message?: unknown } | null)?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message) && message.length) return message.join(". ");
  }
  return porDefecto;
}
