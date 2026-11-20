import { Component, computed, inject, input } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { linkAbrirMaps, linkEmbedMaps } from "@erp/shared";
import { IconComponent } from "../icon/icon.component";

/** Mapa de Google incrustado (sin clave de API) con un botón para abrirlo en Maps. */
@Component({
  selector: "app-mapa",
  imports: [IconComponent],
  template: `
    <div class="overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50">
      <iframe
        [src]="embed()"
        [class]="'block w-full ' + alto()"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="Mapa de la ubicación de entrega"
      ></iframe>
      <div class="flex items-center justify-between gap-2 border-t border-gray-100 bg-white px-3 py-2">
        <span class="text-[13px] text-muted tabular">{{ lat().toFixed(5) }}, {{ lng().toFixed(5) }}</span>
        <a [href]="abrir()" target="_blank" rel="noopener" class="btn-text text-[13.5px]">
          <app-icon name="mapa" [size]="15" /> Abrir en Google Maps
        </a>
      </div>
    </div>
  `,
})
export class MapaComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly lat = input.required<number>();
  readonly lng = input.required<number>();
  readonly alto = input("h-64");

  // Seguro: la URL se arma solo con dos números, no con texto del usuario.
  readonly embed = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(linkEmbedMaps({ lat: this.lat(), lng: this.lng() })),
  );
  readonly abrir = computed(() => linkAbrirMaps({ lat: this.lat(), lng: this.lng() }));
}
