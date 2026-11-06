import { Component, Input } from "@angular/core";

@Component({
  selector: "app-placeholder",
  template: `
    <div class="p-6">
      <div class="page-header">
        <div>
          <h1 class="panel-title text-lg">{{ titulo }}</h1>
        </div>
      </div>
      <div class="card flex flex-col items-center gap-2 py-16 text-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-2">⏳</div>
        <p class="font-medium text-text">Esta pantalla se construye en una fase posterior</p>
        <p class="max-w-sm text-muted">
          Todavía no hay datos ni lógica de negocio aquí. Sigue el avance del proyecto por fases en el spec.
        </p>
      </div>
    </div>
  `,
})
export class PlaceholderComponent {
  @Input() titulo = "";
}
