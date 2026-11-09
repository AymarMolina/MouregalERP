import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import type { RolUsuario } from "@erp/shared";
import { authGuard } from "./core/auth/auth.guard";
import { AuthService } from "./core/auth/auth.service";
import { rutaInicio } from "./core/auth/inicio";
import { roleGuard } from "./core/auth/role.guard";
import { ShellComponent } from "./layout/shell/shell.component";
import { LoginComponent } from "./pages/login/login.component";

const TODOS: RolUsuario[] = ["admin", "vendedora", "produccion", "almacen", "delivery"];

export const routes: Routes = [
  { path: "login", component: LoginComponent },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: () => rutaInicio(inject(AuthService).user()?.rol),
      },
      {
        path: "mapa",
        loadComponent: () => import("./pages/mapa/mapa.component").then((m) => m.MapaComponent),
        canActivate: [roleGuard],
        data: { roles: TODOS },
      },
      {
        path: "hoy",
        loadComponent: () => import("./pages/hoy/hoy.component").then((m) => m.HoyComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora", "produccion"] },
      },
      {
        path: "pedidos/nuevo",
        loadComponent: () => import("./pages/pedido-nuevo/pedido-nuevo.component").then((m) => m.PedidoNuevoComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora"] },
      },
      {
        path: "pedidos/:id",
        loadComponent: () => import("./pages/pedido-detalle/pedido-detalle.component").then((m) => m.PedidoDetalleComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora", "produccion", "delivery"] },
      },
      {
        path: "produccion",
        loadComponent: () => import("./pages/produccion/produccion.component").then((m) => m.ProduccionComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "produccion"] },
      },
      {
        path: "delivery",
        loadComponent: () => import("./pages/delivery/delivery.component").then((m) => m.DeliveryComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "delivery", "vendedora"] },
      },
      {
        path: "pagos",
        loadComponent: () => import("./pages/pagos/pagos.component").then((m) => m.PagosComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora"] },
      },
      {
        path: "inventario",
        loadComponent: () => import("./pages/inventario/inventario.component").then((m) => m.InventarioComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "almacen"] },
      },
      {
        path: "compras",
        loadComponent: () => import("./pages/compras/compras.component").then((m) => m.ComprasComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "almacen"] },
      },
      {
        path: "config/recetas",
        loadComponent: () => import("./pages/config-recetas/config-recetas.component").then((m) => m.ConfigRecetasComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin", "produccion", "almacen"] },
      },
      {
        path: "config/reglas",
        loadComponent: () => import("./pages/config-reglas/config-reglas.component").then((m) => m.ConfigReglasComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin"] },
      },
      {
        path: "config/tarifario",
        loadComponent: () => import("./pages/config-tarifario/config-tarifario.component").then((m) => m.ConfigTarifarioComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin"] },
      },
      {
        path: "reportes",
        loadComponent: () => import("./pages/reportes/reportes.component").then((m) => m.ReportesComponent),
        canActivate: [roleGuard],
        data: { roles: ["admin"] },
      },
      {
        path: "config/integraciones",
        loadComponent: () => import("./pages/placeholder/placeholder.component").then((m) => m.PlaceholderComponent),
        canActivate: [roleGuard],
        data: { titulo: "Integraciones", roles: ["admin"] },
      },
    ],
  },
  { path: "**", redirectTo: "" },
];
