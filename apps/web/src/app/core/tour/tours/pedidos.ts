import type { Tour } from "../tour.types";

export const TOUR_PEDIDOS: Tour = {
  id: "pedidos",
  pasos: [
    {
      titulo: "Pedidos",
      texto:
        "<p>El historial de todos los pedidos, de cualquier fecha y estado, cancelados incluidos.</p>" +
        "<p><strong>Quién la usa:</strong> administrador y vendedora.</p>" +
        "<p><strong>Para qué:</strong> encontrar el pedido de un cliente que llama, revisar qué pasó con uno viejo o exportar la lista a Excel.</p>",
    },
    {
      elemento: "pedidos-filtros",
      titulo: "Buscar y filtrar",
      texto:
        "<p>Busca por número, cliente, teléfono, receptor o distrito. Las fechas son las de <strong>entrega</strong>; por defecto, del último mes al próximo.</p>",
      lado: "bottom",
    },
    {
      elemento: "pedidos-tabla",
      titulo: "La lista",
      texto:
        "<p>Las pestañas filtran por estado. Toca el número del pedido para abrir su detalle. El saldo en rojo es lo que falta cobrar.</p>",
      lado: "top",
    },
  ],
};
