import { Component, computed, inject, signal } from "@angular/core";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";
import { AuthService } from "../../core/auth/auth.service";
import { IconComponent } from "../../shared/icon/icon.component";
import { NAV_GROUPS } from "../nav-items";

@Component({
  selector: "app-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  templateUrl: "./shell.component.html",
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly menuAbierto = signal(false);
  readonly currentUrl = signal(this.router.url);

  readonly groups = computed(() => {
    const rol = this.user()?.rol;
    if (!rol) return [];
    return NAV_GROUPS.map((g) => ({
      label: g.label,
      items: g.items.filter((item) => item.roles.includes(rol)),
    })).filter((g) => g.items.length > 0);
  });

  readonly seccionActual = computed(() => {
    const url = this.currentUrl();
    for (const g of this.groups()) {
      if (g.items.some((item) => url === item.path || url.startsWith(item.path + "/"))) return g.label;
    }
    return "";
  });

  /** Nombre de la pantalla actual para la barra superior. */
  readonly paginaActual = computed(() => {
    const url = this.currentUrl().split("?")[0];
    for (const g of this.groups()) {
      const item = g.items.find((i) => url === i.path);
      if (item) return item.label;
    }
    if (url.startsWith("/pedidos/")) return "Detalle del pedido";
    return "";
  });

  readonly iniciales = computed(() => {
    const nombre = this.user()?.nombre ?? "";
    return nombre
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.menuAbierto.set(false);
    });
  }

  toggleMenu(): void {
    this.menuAbierto.set(!this.menuAbierto());
  }

  logout(): void {
    this.auth.logout();
  }
}
