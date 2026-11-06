import { Routes } from "@angular/router";
import type { RolUsuario } from "@erp/shared";
import { authGuard } from "./core/auth/auth.guard";
import { roleGuard } from "./core/auth/role.guard";
import { ShellComponent } from "./layout/shell/shell.component";
import { LoginComponent } from "./pages/login/login.component";
import { PlaceholderComponent } from "./pages/placeholder/placeholder.component";

const TODOS: RolUsuario[] = ["admin", "vendedora", "produccion", "almacen", "delivery"];

export const routes: Routes = [
  { path: "login", component: LoginComponent },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "", redirectTo: "hoy", pathMatch: "full" },
      {
        path: "mapa",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Mapa del flujo", roles: TODOS },
      },
      {
        path: "hoy",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Hoy", roles: ["admin", "vendedora", "produccion"] },
      },
      {
        path: "pedidos/nuevo",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Nuevo pedido", roles: ["admin", "vendedora"] },
      },
      {
        path: "pedidos/:id",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Detalle de pedido", roles: ["admin", "vendedora"] },
      },
      {
        path: "produccion",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Producción", roles: ["admin", "produccion"] },
      },
      {
        path: "delivery",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Delivery", roles: ["admin", "delivery", "vendedora"] },
      },
      {
        path: "pagos",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Pagos", roles: ["admin", "vendedora"] },
      },
      {
        path: "inventario",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Inventario", roles: ["admin", "almacen"] },
      },
      {
        path: "compras",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Compras", roles: ["admin", "almacen"] },
      },
      {
        path: "config/recetas",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Recetas", roles: ["admin", "produccion", "almacen"] },
      },
      {
        path: "config/reglas",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Reglas de cambio", roles: ["admin"] },
      },
      {
        path: "config/tarifario",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Tarifario", roles: ["admin"] },
      },
      {
        path: "reportes",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Reportes", roles: ["admin"] },
      },
      {
        path: "config/integraciones",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Integraciones", roles: ["admin"] },
      },
    ],
  },
  { path: "**", redirectTo: "" },
];
