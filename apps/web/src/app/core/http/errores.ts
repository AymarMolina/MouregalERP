import { HttpErrorResponse } from "@angular/common/http";

/**
 * Extrae el mensaje que devuelve la API (`{ code, message, details }`) para
 * mostrárselo al usuario; si no hay uno legible, usa el texto por defecto.
 */
export function mensajeError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return "No hay conexión con el servidor.";
    const message = (err.error as { message?: unknown } | null)?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message) && message.length) return message.join(". ");
  }
  return porDefecto;
}
