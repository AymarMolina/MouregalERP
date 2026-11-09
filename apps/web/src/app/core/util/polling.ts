import { DestroyRef, inject } from "@angular/core";

/** Intervalo de refresco de los tableros en vivo (spec sección 8: polling cada 15 s). */
export const POLLING_MS = 15_000;

/**
 * Ejecuta `fn` cada `ms` mientras el componente exista y la pestaña esté
 * visible; al volver a la pestaña refresca de inmediato. Llamar desde el
 * constructor o un inicializador de campo (usa inject()).
 * No encadena llamadas: si una sigue en curso, se salta el tick.
 */
export function usarPolling(fn: () => Promise<unknown>, ms = POLLING_MS): void {
  const destroyRef = inject(DestroyRef);
  let enCurso = false;

  const tick = async () => {
    if (enCurso || document.visibilityState !== "visible") return;
    enCurso = true;
    try {
      await fn();
    } catch {
      // Un fallo transitorio no debe romper el tablero; el próximo tick reintenta.
    } finally {
      enCurso = false;
    }
  };

  const id = setInterval(tick, ms);
  const alVolver = () => {
    if (document.visibilityState === "visible") void tick();
  };
  document.addEventListener("visibilitychange", alVolver);

  destroyRef.onDestroy(() => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", alVolver);
  });
}
