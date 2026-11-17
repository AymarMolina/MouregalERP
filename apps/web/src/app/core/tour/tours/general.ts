import type { Tour } from "../tour.types";

/** Se antepone al primer tutorial que ve cada usuario: explica el sistema y el marco común. */
export const TOUR_GENERAL: Tour = {
  id: "general",
  pasos: [
    {
      titulo: "Bienvenida al ERP Mouregal",
      texto:
        "<p>Este sistema lleva cada pedido de la florería de principio a fin: la venta, el armado, el despacho, el cobro y la entrega. También controla el stock de insumos y las compras.</p><p>Puedes cerrar el recorrido cuando quieras con la X o la tecla Esc.</p>",
    },
    {
      titulo: "Cómo viaja un pedido",
      texto:
        "<ol><li><strong>Venta:</strong> la vendedora registra el pedido y el sistema calcula el precio y reserva los insumos.</li><li><strong>Producción:</strong> se arma, se anota lo que se usó y el stock se descuenta.</li><li><strong>Delivery:</strong> se despacha y luego se marca como entregado.</li><li><strong>Pagos:</strong> se registran el adelanto y el saldo.</li><li><strong>Almacén:</strong> repone los insumos con órdenes de compra.</li></ol><p>Cada rol ve solo las pantallas de su parte.</p>",
    },
    {
      elemento: "nav",
      titulo: "Menú",
      texto:
        "<p>Las pantallas a las que tiene acceso tu rol, agrupadas por etapa: pedidos, operación, configuración y análisis.</p><p><strong>Mapa del flujo</strong> muestra el recorrido completo de un pedido, por si te pierdes.</p>",
      lado: "right",
    },
    {
      elemento: "buscador",
      titulo: "Ir a una pantalla",
      texto: "Escribe el nombre de una pantalla (por ejemplo «Pagos») y presiona Enter para ir directo.",
      lado: "bottom",
    },
    {
      elemento: "ayuda",
      titulo: "Ayuda en cada pantalla",
      texto:
        "Cada pantalla tiene su propio tutorial, que explica para qué sirve y cómo se usa. Se abre solo la primera vez. Para verlo de nuevo, usa este botón.",
      lado: "bottom",
    },
    {
      elemento: "usuario",
      titulo: "Tu sesión",
      texto: "Tu nombre y tu rol. El botón de la derecha cierra la sesión en este equipo.",
      lado: "top",
    },
  ],
};
