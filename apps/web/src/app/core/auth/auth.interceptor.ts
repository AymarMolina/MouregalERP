import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "./auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();
  const isAuthEndpoint = req.url.includes("/auth/login") || req.url.includes("/auth/refresh");

  if (!token || isAuthEndpoint) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
