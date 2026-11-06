import { Component, OnInit, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DashboardService } from "../../core/pedidos/pedidos.service";
import type { DashboardHoy } from "../../core/pedidos/pedidos.types";

@Component({
  selector: "app-hoy",
  imports: [RouterLink],
  templateUrl: "./hoy.component.html",
})
export class HoyComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly data = signal<DashboardHoy | null>(null);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.data.set(await this.dashboardService.hoy());
    this.loading.set(false);
  }
}
