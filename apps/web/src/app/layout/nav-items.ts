import type { RolUsuario } from "@erp/shared";

export interface NavItem {
  path: string;
  label: string;
  roles: RolUsuario[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const TODOS: RolUsuario[] = ["admin", "vendedora", "produccion", "almacen", "delivery"];

// Mismo alcance por rol que la tabla de la sección 8 del spec, agrupado
// visualmente siguiendo las 7 partes del flujo (sección 1).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { path: "/mapa", label: "Mapa del flujo", roles: TODOS },
      { path: "/hoy", label: "Hoy", roles: ["admin", "vendedora", "produccion"] },
    ],
  },
  {
    label: "Pedidos",
    items: [
      { path: "/pedidos/nuevo", label: "Nuevo pedido", roles: ["admin", "vendedora"] },
      { path: "/pagos", label: "Pagos", roles: ["admin", "vendedora"] },
      { path: "/delivery", label: "Delivery", roles: ["admin", "delivery", "vendedora"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { path: "/produccion", label: "Producción", roles: ["admin", "produccion"] },
      { path: "/inventario", label: "Inventario", roles: ["admin", "almacen"] },
      { path: "/compras", label: "Compras", roles: ["admin", "almacen"] },
    ],
  },
  {
    label: "Configuración",
    items: [
      { path: "/config/recetas", label: "Recetas", roles: ["admin", "produccion", "almacen"] },
      { path: "/config/reglas", label: "Reglas de cambio", roles: ["admin"] },
      { path: "/config/tarifario", label: "Tarifario", roles: ["admin"] },
      { path: "/config/integraciones", label: "Integraciones", roles: ["admin"] },
    ],
  },
  {
    label: "Análisis",
    items: [{ path: "/reportes", label: "Reportes", roles: ["admin"] }],
  },
];

// Mantiene compatibilidad con quien espere la lista plana.
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
