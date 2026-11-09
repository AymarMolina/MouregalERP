import type { RolUsuario } from "@erp/shared";

/**
 * Pantalla de inicio de cada rol. Tiene que ser una ruta a la que el rol
 * tenga acceso: si no, el roleGuard redirige a una ruta que vuelve a
 * rechazarlo y la navegación entra en bucle.
 */
const INICIO_POR_ROL: Record<RolUsuario, string> = {
  admin: "/hoy",
  vendedora: "/hoy",
  produccion: "/produccion",
  almacen: "/inventario",
  delivery: "/delivery",
};

export function rutaInicio(rol: RolUsuario | undefined | null): string {
  return rol ? INICIO_POR_ROL[rol] : "/login";
}
