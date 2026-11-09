import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, from, switchMap, throwError } from "rxjs";
import { AuthService } from "./auth.service";

function conToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Agrega el access token y, si la API responde 401 (token vencido, dura
 * 15 min), lo renueva una vez con el refresh token y reintenta la petición.
 * Si la renovación falla, cierra la sesión y manda al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isAuthEndpoint = req.url.includes("/auth/login") || req.url.includes("/auth/refresh");
  if (isAuthEndpoint) return next(req);

  const token = auth.getAccessToken();
  return next(token ? conToken(req, token) : req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);

      return from(auth.renovarAccessToken()).pipe(
        switchMap((nuevo) => {
          if (!nuevo) {
            auth.logout();
            return throwError(() => err);
          }
          return next(conToken(req, nuevo));
        }),
      );
    }),
  );
};
