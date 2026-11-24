import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, from, Observable, of, switchMap, tap, throwError } from "rxjs";
import { AuthService } from "../auth/auth.service";
import { guardarRespuesta, leerRespuesta } from "./cache-local";
import { ConexionService, esFallaDeRed } from "./conexion.service";

/** Lo que no se guarda: sesión y salud. */
function cacheable(url: string, method: string, responseType: string): boolean {
  return (
    method === "GET" &&
    responseType === "json" &&
    url.includes("/api/") &&
    !url.includes("/auth/") &&
    !url.includes("/salud")
  );
}

/**
 * Modo sin conexión de solo lectura.
 *
 * - Cada GET del API que responde bien se guarda en IndexedDB.
 * - Si un GET falla por red (ver `esFallaDeRed`), se responde con la última copia
 *   guardada y la barra superior avisa de que los datos son de antes.
 * - Lo que no es GET (crear, cobrar, despachar…) no se guarda ni se encola:
 *   falla con "Sin conexión", porque necesita al servidor para validar stock.
 *
 * Va antes que el interceptor de auth para ver el resultado final (con el
 * reintento tras renovar el token ya hecho).
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const conexion = inject(ConexionService);
  const auth = inject(AuthService);

  const usarCache = cacheable(req.url, req.method, req.responseType);
  const userId = auth.user()?.id;
  const clave = usarCache && userId ? `${userId}|${req.urlWithParams}` : null;

  const desdeCache = (err: unknown): Observable<HttpResponse<unknown>> => {
    if (!clave) return throwError(() => err);
    return from(leerRespuesta(clave)).pipe(
      switchMap((g) => {
        if (!g) return throwError(() => err);
        conexion.registrarDatosDe(g.guardado);
        return of(
          new HttpResponse({
            status: 200,
            body: g.body,
            url: req.urlWithParams,
            headers: new HttpHeaders({ "X-Desde-Cache": g.guardado }),
          }),
        );
      }),
    );
  };

  // Sin red en el equipo: ni se intenta, va directo a la copia.
  if (clave && !navigator.onLine) {
    conexion.marcarSinConexion();
    return desdeCache(new HttpErrorResponse({ status: 0, statusText: "Sin conexión", url: req.urlWithParams }));
  }

  return next(req).pipe(
    tap((ev) => {
      if (!(ev instanceof HttpResponse)) return;
      conexion.marcarEnLinea();
      if (clave) void guardarRespuesta(clave, ev.body);
    }),
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      if (!esFallaDeRed(err)) {
        // El servidor respondió (aunque sea con error): hay conexión.
        conexion.marcarEnLinea();
        return throwError(() => err);
      }
      conexion.marcarSinConexion();
      return desdeCache(err);
    }),
  );
};
