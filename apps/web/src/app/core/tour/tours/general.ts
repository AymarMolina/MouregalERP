import type { Tour } from "../tour.types";

/**
 * Lo único que se abre solo, una vez por usuario: tres pasos para ubicarse.
 * El tutorial de cada pantalla se abre con el botón "?" cuando se necesita.
 */
export const TOUR_GENERAL: Tour = {
  id: "general",
  pasos: [
    {
      titulo: "Bienvenida al ERP Mouregal",
      texto:
        "<p>Aquí se registra cada pedido una sola vez: el sistema calcula el precio, reserva las flores, avisa a Producción y lleva el cobro.</p><p>Cierra este recorrido cuando quieras con la X o la tecla Esc.</p>",
    },
    {
      elemento: "nav",
      titulo: "Menú",
      texto: "<p>Solo ves las pantallas de tu rol. Para vender, empieza por <strong>Nuevo pedido</strong>.</p>",
      lado: "right",
    },
    {
      elemento: "ayuda",
      titulo: "¿Dudas en una pantalla?",
      texto:
        "Toca este botón y te explica la pantalla en la que estás. Tu nombre, a la derecha, abre el menú para cerrar sesión.",
      lado: "bottom",
    },
  ],
};
