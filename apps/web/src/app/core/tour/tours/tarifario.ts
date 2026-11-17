import type { Tour } from "../tour.types";

export const TOUR_TARIFARIO: Tour = {
  id: "tarifario",
  pasos: [
    {
      titulo: "Tarifario",
      texto:
        "<p>Fija cuánto se cobra por el envío a cada distrito, en moto y en carro, y cuánto le cuesta a la florería cada viaje.</p>" +
        "<p><strong>Quién la usa:</strong> administración.</p>" +
        "<p><strong>En el flujo:</strong> Nuevo pedido toma de aquí el costo de envío según el distrito y el vehículo. El reporte de Envíos compara lo cobrado con el costo por viaje.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Cargas cada distrito con su tarifa en moto y en carro.</li>" +
        "<li>Al crear un pedido, la vendedora elige el distrito.</li>" +
        "<li>El sistema decide el vehículo: carro si la talla es L, si la receta lleva una caja o si un extra lo exige; si no, moto.</li>" +
        "<li>Cobra la tarifa de ese distrito para ese vehículo.</li>" +
        "</ol>",
    },
    {
      elemento: "tarifario-costos",
      titulo: "Costo por viaje",
      texto:
        "<p>Lo que paga la florería por cada viaje en moto o en carro. No se cobra al cliente: solo se usa en Reportes, donde viajes × costo se compara con el envío cobrado.</p>",
      lado: "bottom",
    },
    {
      elemento: "tarifario-nuevo",
      titulo: "Nuevo distrito",
      texto: "<p>Abre el formulario para agregar un distrito con su tarifa en moto y en carro.</p>",
      lado: "left",
    },
    {
      elemento: "tarifario-distritos",
      titulo: "Distritos",
      texto:
        "<p>Las tarifas que se cobran al cliente. Con el menú de tres puntos editas las tarifas en la misma fila o desactivas el distrito.</p>",
      lado: "top",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>El vehículo no se elige a mano: lo decide la talla, la caja de la receta o los extras.</li>" +
        "<li>Marcar un insumo como caja en Inventario hace que esos pedidos se cobren con tarifa de carro.</li>" +
        "<li>Cambiar una tarifa afecta a los pedidos nuevos.</li>" +
        "</ul>",
    },
  ],
};
