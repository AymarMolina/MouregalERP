import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { RolUsuario } from "@erp/shared";
import { AuthService } from "../../core/auth/auth.service";
import { NAV_ITEMS } from "../../layout/nav-items";

interface Paso {
  numero: number;
  titulo: string;
  descripcion: string;
  rutas: string[];
}

/** Las 7 partes del flujo (spec sección 1), con los módulos que las cubren. */
const PASOS: Paso[] = [
  {
    numero: 1,
    titulo: "Entrada del pedido",
    descripcion: "Web, chatbot o vendedora: el pedido se escribe una sola vez.",
    rutas: ["/pedidos/nuevo", "/hoy"],
  },
  {
    numero: 2,
    titulo: "Cambios y stock",
    descripcion: "Solo se ofrecen cambios aprobados y con insumos disponibles.",
    rutas: ["/config/reglas", "/config/recetas"],
  },
  {
    numero: 3,
    titulo: "Envío y cotización",
    descripcion: "Moto o carro según el pedido, con la tarifa del distrito.",
    rutas: ["/config/tarifario", "/pedidos/nuevo"],
  },
  {
    numero: 4,
    titulo: "Entrega, pago y comanda",
    descripcion: "Adelanto, saldo y comanda digital con receta y dedicatoria.",
    rutas: ["/pagos"],
  },
  {
    numero: 5,
    titulo: "Producción",
    descripcion: "Se arma el pedido y se confirma lo usado; el exceso es merma.",
    rutas: ["/produccion"],
  },
  {
    numero: 6,
    titulo: "Inventario y compras",
    descripcion: "Kardex en unidad base, stock mínimo y compras sugeridas.",
    rutas: ["/inventario", "/compras"],
  },
  {
    numero: 7,
    titulo: "Despacho y reportes",
    descripcion: "Link del saldo antes de salir, entrega y reportes de margen y merma.",
    rutas: ["/delivery", "/reportes"],
  },
];

@Component({
  selector: "app-mapa",
  imports: [RouterLink],
  template: `
    <div class="p-6">
      <div class="page-header">
        <div>
          <h1 class="panel-title">Mapa del flujo</h1>
          <p class="panel-subtitle">Del pedido a la entrega en 7 partes. Entra a cada módulo desde aquí.</p>
        </div>
      </div>

      <ol class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (p of pasos(); track p.numero) {
          <li class="card flex flex-col gap-3 p-4" [class.opacity-60]="!p.enlaces.length">
            <div class="flex items-center gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white">
                {{ p.numero }}
              </span>
              <h2 class="font-semibold">{{ p.titulo }}</h2>
            </div>
            <p class="flex-1 text-muted">{{ p.descripcion }}</p>
            <div class="flex flex-wrap gap-2">
              @for (e of p.enlaces; track e.path) {
                <a [routerLink]="e.path" class="btn-secondary px-2.5 py-1">{{ e.label }} →</a>
              } @empty {
                <span class="text-xs text-muted">Sin acceso con tu rol</span>
              }
            </div>
          </li>
        }
      </ol>
    </div>
  `,
})
export class MapaComponent {
  private readonly auth = inject(AuthService);

  readonly pasos = computed(() => {
    const rol = this.auth.user()?.rol as RolUsuario | undefined;
    return PASOS.map((p) => ({
      ...p,
      enlaces: p.rutas
        .map((ruta) => NAV_ITEMS.find((n) => n.path === ruta))
        .filter((n): n is (typeof NAV_ITEMS)[number] => !!n && !!rol && n.roles.includes(rol)),
    }));
  });
}
