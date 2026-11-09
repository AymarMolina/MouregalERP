import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

/**
 * Íconos de línea (24×24, trazo 1.75) dibujados en SVG en línea: sin
 * dependencias y heredan el color del texto (currentColor).
 */
const ICONOS = {
  mapa: ["M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z", "M9 4v14", "M15 6v14"],
  hoy: ["M3 13h4l3-8 4 14 3-6h4"],
  nuevo: ["M12 5v14", "M5 12h14"],
  pagos: ["M3 7h18v10H3z", "M3 10h18", "M7 14h3"],
  delivery: ["M3 6h11v9H3z", "M14 9h4l3 3v3h-7", "M7.5 18.5a1.5 1.5 0 1 0 0-.01", "M17.5 18.5a1.5 1.5 0 1 0 0-.01"],
  produccion: ["M12 21v-9", "M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z", "M12 12c3 0 5-2 5-5-3 0-5 2-5 5z", "M8 21h8"],
  inventario: ["M3 7l9-4 9 4-9 4-9-4z", "M3 7v10l9 4 9-4V7", "M12 11v10"],
  compras: ["M3 4h2l2.5 11h11L21 7H6.2", "M9 20a1 1 0 1 0 0-.01", "M18 20a1 1 0 1 0 0-.01"],
  recetas: ["M5 4h11l3 3v13H5z", "M9 9h6", "M9 13h6", "M9 17h4"],
  reglas: ["M7 4v16", "M4 7l3-3 3 3", "M17 20V4", "M14 17l3 3 3-3"],
  tarifario: ["M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z", "M12 12.5a2.5 2.5 0 1 0 0-.01"],
  integraciones: ["M9 7V3", "M15 7V3", "M6 7h12v4a6 6 0 0 1-12 0V7z", "M12 17v4"],
  reportes: ["M4 20h16", "M7 16v-5", "M12 16V7", "M17 16v-8"],
  buscar: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-4-4"],
  salir: ["M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3", "M10 16l-4-4 4-4", "M6 12h10"],
  ventas: ["M12 3v18", "M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"],
  ticket: ["M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6z", "M14 6v12"],
  pedido: ["M6 3h12l1 4H5l1-4z", "M5 7h14v13H5z", "M9 11h6"],
  alerta: ["M12 4 2.5 20h19L12 4z", "M12 10v4", "M12 17.2v.1"],
  consulta: ["M5 5h14v10H9l-4 4V5z", "M12 8.5v2.5", "M12 13v.1"],
  flecha: ["M5 12h14", "M13 6l6 6-6 6"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  // Acciones
  editar: ["M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z", "M13.5 6.5l3 3"],
  eliminar: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"],
  cerrar: ["M6 6l12 12", "M18 6 6 18"],
  copiar: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  historial: ["M3 12a9 9 0 1 0 2.6-6.4", "M3 4v4.5h4.5", "M12 7.5V12l3 2"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  confirmar: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M8 12.5l2.8 2.8L16.5 9.5"],
  anular: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M5.7 5.7l12.6 12.6"],
  restaurar: ["M3 12a9 9 0 1 0 2.6-6.4", "M3 4v4.5h4.5"],
  telefono: ["M5 4h3.5l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"],
  whatsapp: ["M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.2-4.2a8.5 8.5 0 1 1 15.8-4.3z", "M9 9.5c0 3 2.5 5.5 5.5 5.5"],
  enlace: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
} as const;

export type NombreIcono = keyof typeof ICONOS;

@Component({
  selector: "app-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (d of trazos; track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  host: { class: "inline-flex shrink-0" },
})
export class IconComponent {
  @Input({ required: true }) name!: NombreIcono;
  @Input() size = 18;

  get trazos(): readonly string[] {
    return ICONOS[this.name] ?? [];
  }
}
