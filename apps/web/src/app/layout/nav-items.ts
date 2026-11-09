import type { RolUsuario } from "@erp/shared";
import type { NombreIcono } from "../shared/icon/icon.component";

export interface NavItem {
  path: string;
  label: string;
  icon: NombreIcono;
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
      { path: "/mapa", label: "Mapa del flujo", icon: "mapa", roles: TODOS },
      { path: "/hoy", label: "Hoy", icon: "hoy", roles: ["admin", "vendedora", "produccion"] },
    ],
  },
  {
    label: "Pedidos",
    items: [
      { path: "/pedidos/nuevo", label: "Nuevo pedido", icon: "nuevo", roles: ["admin", "vendedora"] },
      { path: "/pagos", label: "Pagos", icon: "pagos", roles: ["admin", "vendedora"] },
      { path: "/delivery", label: "Delivery", icon: "delivery", roles: ["admin", "delivery", "vendedora"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { path: "/produccion", label: "Producción", icon: "produccion", roles: ["admin", "produccion"] },
      { path: "/inventario", label: "Inventario", icon: "inventario", roles: ["admin", "almacen"] },
      { path: "/compras", label: "Compras", icon: "compras", roles: ["admin", "almacen"] },
    ],
  },
  {
    label: "Configuración",
    items: [
      { path: "/config/recetas", label: "Recetas", icon: "recetas", roles: ["admin", "produccion", "almacen"] },
      { path: "/config/reglas", label: "Reglas de cambio", icon: "reglas", roles: ["admin"] },
      { path: "/config/tarifario", label: "Tarifario", icon: "tarifario", roles: ["admin"] },
      { path: "/config/integraciones", label: "Integraciones", icon: "integraciones", roles: ["admin"] },
    ],
  },
  {
    label: "Análisis",
    items: [{ path: "/reportes", label: "Reportes", icon: "reportes", roles: ["admin"] }],
  },
];

// Mantiene compatibilidad con quien espere la lista plana.
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
