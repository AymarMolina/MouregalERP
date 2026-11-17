import type { RolUsuario } from "@erp/shared";

/**
 * Un paso del tutorial. `elemento` es el valor del atributo `data-tour` de la
 * sección que se ilumina; sin `elemento` el paso se muestra centrado.
 */
export interface PasoTour {
  elemento?: string;
  titulo: string;
  /**
   * HTML simple y estático (se inserta tal cual): `<p>`, `<ol>`/`<ul>` con `<li>`
   * y `<strong>`. Nunca interpolar datos del usuario o del API aquí.
   */
  texto: string;
  /** Solo para estos roles. Sin `roles`, lo ven todos los que entran a la pantalla. */
  roles?: RolUsuario[];
  lado?: "top" | "right" | "bottom" | "left";
}

export interface Tour {
  /** Identificador estable; también es la clave con la que se recuerda que ya se vio. */
  id: string;
  pasos: PasoTour[];
}
