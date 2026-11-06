import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import type { RolUsuario } from "@erp/shared";
import { AuthService } from "./auth.service";

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  if (!user) return router.createUrlTree(["/login"]);

  const allowed = route.data["roles"] as RolUsuario[] | undefined;
  if (!allowed || allowed.length === 0 || allowed.includes(user.rol)) return true;

  return router.createUrlTree(["/hoy"]);
};
