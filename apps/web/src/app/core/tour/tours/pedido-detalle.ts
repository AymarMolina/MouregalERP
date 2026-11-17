import type { Tour } from "../tour.types";

export const TOUR_PEDIDO_DETALLE: Tour = {
  id: "pedido-detalle",
  pasos: [
    {
      titulo: "Detalle del pedido",
      texto:
        "<p>Ficha completa de un pedido: qué se arma, a dónde va, cuánto se cobró y por qué estados pasó.</p>" +
        "<p><strong>Quién la usa:</strong> administrador, vendedora, producción y delivery.</p>" +
        "<p><strong>En el flujo:</strong> se abre al crear un pedido o desde Hoy. El avance de estado se hace en Producción y Delivery; los cobros, en Pagos.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Revisa el estado arriba y la comanda con lo que hay que armar.</li>" +
        "<li>Confirma los datos de entrega antes de despachar.</li>" +
        "<li>Mira el resumen para saber si queda saldo por cobrar.</li>" +
        "<li>Usa el historial para saber quién movió el pedido y cuándo.</li>" +
        "</ol>",
    },
    {
      titulo: "Cómo funciona para ti",
      texto:
        "<p>Si queda saldo, el botón «Ir a pagos» te lleva a cobrarlo. «Cancelar pedido» pide un motivo, anula los cobros pendientes y libera los insumos reservados.</p>",
      roles: ["admin", "vendedora"],
    },
    {
      elemento: "detalle-estado",
      titulo: "Estado",
      texto:
        "<p>Etapa actual: pendiente → en armado → listo → en camino → entregado, o cancelado. Cada paso lo da el rol que corresponde en su pantalla.</p>",
      lado: "bottom",
    },
    {
      elemento: "detalle-comanda",
      titulo: "Comanda",
      texto:
        "<p>Lo que Producción arma: cantidad, producto, talla, flor, papel, extras y cada cambio con su recargo. Abajo va la dedicatoria para la tarjeta.</p>",
      lado: "right",
    },
    {
      elemento: "detalle-entrega",
      titulo: "Entrega",
      texto:
        "<p>Quién recibe, su teléfono (tócalo para llamar), la dirección con referencia y el vehículo asignado. El vehículo es carro si algún producto lo requiere.</p>",
      lado: "right",
    },
    {
      elemento: "detalle-historial",
      titulo: "Historial",
      texto: "<p>Cada cambio de estado con fecha, hora y nota, incluido el motivo de una cancelación.</p>",
      lado: "right",
    },
    {
      elemento: "detalle-resumen",
      titulo: "Resumen",
      texto:
        "<p>Productos, envío y total. «Pagado» solo suma los cobros confirmados, así que el saldo baja recién cuando se marca un pago como pagado.</p>",
      lado: "left",
    },
    {
      elemento: "detalle-pagos",
      titulo: "Pagos",
      texto:
        "<p>Cobros del pedido (adelanto y saldo) con método y estado: pendiente, pagado, fallido o anulado. Aquí solo se consultan.</p>",
      lado: "left",
    },
    {
      elemento: "detalle-cancelar",
      titulo: "Cancelar pedido",
      texto:
        "<p>Pide un motivo y anula los cobros pendientes. Si el pedido ya estaba listo o en camino, lo consumido no vuelve al stock: cuenta como merma.</p>",
      roles: ["admin", "vendedora"],
      lado: "left",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>La vendedora solo puede cancelar en pendiente o en armado; desde listo o en camino solo el administrador.</li>" +
        "<li>Un pedido entregado o cancelado ya no cambia de estado.</li>" +
        "<li>Si tiene una consulta abierta, Producción debe responderla antes de armarlo.</li>" +
        "</ul>",
    },
  ],
};
