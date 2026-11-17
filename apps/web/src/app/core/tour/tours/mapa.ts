import type { Tour } from "../tour.types";

export const TOUR_MAPA: Tour = {
  id: "mapa",
  pasos: [
    {
      titulo: "Mapa del flujo",
      texto:
        "<p>Muestra en una sola vista cómo viaja un pedido por la florería y te lleva a la pantalla de cada etapa.</p>" +
        "<p><strong>Quién la usa:</strong> todos los roles. Cada uno ve enlaces solo a las pantallas que tiene permitidas.</p>" +
        "<p><strong>En el flujo:</strong> es el punto de partida para ubicarte. Desde aquí entras a la etapa en la que trabajas.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>La vendedora registra el pedido y el sistema reserva los insumos.</li>" +
        "<li>Se cobra el adelanto con un link de pago.</li>" +
        "<li>Producción arma el pedido y confirma lo que usó; lo que excede la receta es merma.</li>" +
        "<li>Almacén repone con compras; el Kardex registra cada movimiento.</li>" +
        "<li>Delivery despacha (con link del saldo si falta pagar) y marca la entrega.</li>" +
        "<li>El administrador revisa margen, envíos y merma en Reportes.</li>" +
        "</ol>",
    },
    {
      elemento: "mapa-pasos",
      titulo: "Las 7 etapas",
      texto:
        "<p>Cada tarjeta es una etapa, en orden: entrada del pedido, cambios y stock, envío y cotización, pago, producción, inventario y compras, despacho y reportes.</p>",
      lado: "top",
    },
    {
      elemento: "mapa-paso",
      titulo: "Una etapa",
      texto:
        "<p>El número es el orden en el flujo y el texto resume qué se resuelve ahí. Una tarjeta atenuada es una etapa en la que tu rol no interviene.</p>",
      lado: "right",
    },
    {
      elemento: "mapa-enlaces",
      titulo: "Entrar a la etapa",
      texto:
        "<p>Estos botones abren las pantallas de la etapa. Solo aparecen las que tu rol puede usar; las mismas están en el menú de la izquierda.</p>",
      lado: "bottom",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Cada rol solo puede mover el pedido en su etapa: Producción arma, Delivery entrega, la vendedora vende y cobra.</li>" +
        "<li>Sin stock no se puede crear un pedido.</li>" +
        "<li>Un pedido con una consulta abierta no pasa a armado hasta que Producción la responda.</li>" +
        "</ul>",
    },
  ],
};
