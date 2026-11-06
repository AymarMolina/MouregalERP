import { Component, computed, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { NAV_ITEMS } from "../nav-items";

@Component({
  selector: "app-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: "./shell.component.html",
})
export class ShellComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly navItems = computed(() => {
    const rol = this.user()?.rol;
    return rol ? NAV_ITEMS.filter((item) => item.roles.includes(rol)) : [];
  });

  logout(): void {
    this.auth.logout();
  }
}
