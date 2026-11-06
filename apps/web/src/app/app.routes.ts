import { Routes } from "@angular/router";
import type { RolUsuario } from "@erp/shared";
import { authGuard } from "./core/auth/auth.guard";
import { roleGuard } from "./core/auth/role.guard";
import { ShellComponent } from "./layout/shell/shell.component";
import { ConfigRecetasComponent } from "./pages/config-recetas/config-recetas.component";
import { ConfigReglasComponent } from "./pages/config-reglas/config-reglas.component";
import { ConfigTarifarioComponent } from "./pages/config-tarifario/config-tarifario.component";
import { HoyComponent } from "./pages/hoy/hoy.component";
import { InventarioComponent } from "./pages/inventario/inventario.component";
import { LoginComponent } from "./pages/login/login.component";
import { PedidoDetalleComponent } from "./pages/pedido-detalle/pedido-detalle.component";
import { PedidoNuevoComponent } from "./pages/pedido-nuevo/pedido-nuevo.component";
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
        component: HoyComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora", "produccion"] },
      },
      {
        path: "pedidos/nuevo",
        component: PedidoNuevoComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora"] },
      },
      {
        path: "pedidos/:id",
        component: PedidoDetalleComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin", "vendedora", "produccion", "delivery"] },
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
        component: InventarioComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin", "almacen"] },
      },
      {
        path: "compras",
        component: PlaceholderComponent,
        canActivate: [roleGuard],
        data: { titulo: "Compras", roles: ["admin", "almacen"] },
      },
      {
        path: "config/recetas",
        component: ConfigRecetasComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin", "produccion", "almacen"] },
      },
      {
        path: "config/reglas",
        component: ConfigReglasComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin"] },
      },
      {
        path: "config/tarifario",
        component: ConfigTarifarioComponent,
        canActivate: [roleGuard],
        data: { roles: ["admin"] },
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
