import { Component, Input } from "@angular/core";

@Component({
  selector: "app-placeholder",
  template: `
    <div class="p-6">
      <h1 class="text-lg font-medium mb-2">{{ titulo }}</h1>
      <p class="text-muted">Esta pantalla se construye en una fase posterior del proyecto.</p>
    </div>
  `,
})
export class PlaceholderComponent {
  @Input() titulo = "";
}
