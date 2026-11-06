import type { RolUsuario } from "@erp/shared";

export interface NavItem {
  path: string;
  label: string;
  roles: RolUsuario[];
}

const TODOS: RolUsuario[] = ["admin", "vendedora", "produccion", "almacen", "delivery"];

// Mismo orden y alcance por rol que la tabla de la sección 8 del spec.
export const NAV_ITEMS: NavItem[] = [
  { path: "/mapa", label: "Mapa del flujo", roles: TODOS },
  { path: "/hoy", label: "Hoy", roles: ["admin", "vendedora", "produccion"] },
  { path: "/pedidos/nuevo", label: "Nuevo pedido", roles: ["admin", "vendedora"] },
  { path: "/produccion", label: "Producción", roles: ["admin", "produccion"] },
  { path: "/delivery", label: "Delivery", roles: ["admin", "delivery", "vendedora"] },
  { path: "/pagos", label: "Pagos", roles: ["admin", "vendedora"] },
  { path: "/inventario", label: "Inventario", roles: ["admin", "almacen"] },
  { path: "/compras", label: "Compras", roles: ["admin", "almacen"] },
  { path: "/config/recetas", label: "Recetas", roles: ["admin", "produccion", "almacen"] },
  { path: "/config/reglas", label: "Reglas de cambio", roles: ["admin"] },
  { path: "/config/tarifario", label: "Tarifario", roles: ["admin"] },
  { path: "/reportes", label: "Reportes", roles: ["admin"] },
  { path: "/config/integraciones", label: "Integraciones", roles: ["admin"] },
];
