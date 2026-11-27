import { Component, computed, HostListener, inject, signal } from "@angular/core";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";
import { AuthService } from "../../core/auth/auth.service";
import { ConexionService } from "../../core/offline/conexion.service";
import { TourService } from "../../core/tour/tour.service";
import { AvisosComponent } from "../../shared/avisos/avisos.component";
import { DialogoComponent } from "../../shared/dialogo/dialogo.component";
import { IconComponent } from "../../shared/icon/icon.component";
import { NAV_GROUPS } from "../nav-items";

@Component({
  selector: "app-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent, AvisosComponent, DialogoComponent],
  templateUrl: "./shell.component.html",
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly tour = inject(TourService);

  readonly conexion = inject(ConexionService);

  readonly user = this.auth.user;
  /** Menú lateral en pantallas angostas (tablet vertical, celular). */
  readonly menuAbierto = signal(false);
  /** Menú desplegable del usuario en la barra superior. */
  readonly menuUsuario = signal(false);
  readonly currentUrl = signal(this.router.url);

  /** "hoy 14:42" o "21 nov, 18:05": de cuándo son los datos que se ven sin conexión. */
  readonly datosDe = computed(() => {
    const iso = this.conexion.datosDe();
    if (!iso) return "";
    const d = new Date(iso);
    const zona = { timeZone: "America/Lima" } as const;
    const dia = (x: Date) => x.toLocaleDateString("es-PE", zona);
    const horaTxt = d.toLocaleTimeString("es-PE", { ...zona, hour: "2-digit", minute: "2-digit", hour12: false });
    if (dia(d) === dia(new Date())) return `hoy ${horaTxt}`;
    return `${d.toLocaleDateString("es-PE", { ...zona, day: "numeric", month: "short" })}, ${horaTxt}`;
  });

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
      this.menuUsuario.set(false);
    });
  }

  /** Cierra el menú del usuario con Escape o al hacer clic fuera. */
  @HostListener("document:keydown.escape")
  cerrarMenus(): void {
    this.menuUsuario.set(false);
    this.menuAbierto.set(false);
  }

  @HostListener("document:click", ["$event"])
  alHacerClic(ev: MouseEvent): void {
    if (!this.menuUsuario()) return;
    const dentro = (ev.target as HTMLElement | null)?.closest("[data-menu-usuario]");
    if (!dentro) this.menuUsuario.set(false);
  }

  readonly busqueda = signal("");

  /** Va a la primera pantalla cuyo nombre coincide con lo escrito. */
  irA(ev: Event): void {
    ev.preventDefault();
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return;
    // Número de pedido (NO-0031, 31, #31): va a la lista con la búsqueda puesta.
    if (/^#?([a-z]{2}-)?\d+$/.test(q)) {
      this.busqueda.set("");
      void this.router.navigate(["/pedidos"], { queryParams: { q: q.replace(/^#/, "").toUpperCase() } });
      return;
    }
    const item = this.groups()
      .flatMap((g) => g.items)
      .find((i) => i.label.toLowerCase().includes(q));
    if (item) {
      this.busqueda.set("");
      void this.router.navigateByUrl(item.path);
    }
  }

  toggleMenu(): void {
    this.menuAbierto.set(!this.menuAbierto());
  }

  logout(): void {
    this.auth.logout();
  }
}
