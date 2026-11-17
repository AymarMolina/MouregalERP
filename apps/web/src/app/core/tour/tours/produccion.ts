import type { Tour } from "../tour.types";

export const TOUR_PRODUCCION: Tour = {
  id: "produccion",
  pasos: [
    {
      titulo: "Producción",
      texto:
        "<p>El taller: aquí cada pedido pasa de «pendiente» a «listo», y lo que se usa al armarlo sale del inventario.</p>" +
        "<p><strong>Quién la usa:</strong> Producción y el administrador.</p>" +
        "<p><strong>En el flujo:</strong> los pedidos llegan desde «Nuevo pedido» (vendedora) → aquí se arman y se registra lo usado → pasan a Delivery para el despacho.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Abre una tarjeta de la columna Pendiente.</li>" +
        "<li>Si tiene una consulta abierta, apruébala o recházala con una respuesta.</li>" +
        "<li>Asigna la encargada y presiona «Pasar a en armado».</li>" +
        "<li>Al terminar, anota lo que realmente usaste de cada insumo y presiona «Confirmar consumo».</li>" +
        "<li>El sistema descuenta el stock en el Kardex (consumo y merma) y deja el pedido en Listo.</li>" +
        "</ol>",
    },
    {
      elemento: "prod-tablero",
      titulo: "Tablero por estado",
      texto:
        "<p>Las tres etapas del armado. Cada tarjeta muestra el número, la hora de entrega, quién recibe, qué lleva y la encargada.</p>" +
        "<p>La hora se pinta en ámbar si la entrega está cerca y en rojo si ya está atrasada. Haz clic en una tarjeta para abrir el pedido debajo del tablero. Se actualiza solo cada 15 segundos.</p>",
      lado: "bottom",
    },
    {
      elemento: "prod-col-pendiente",
      titulo: "Pendiente",
      texto:
        "<p>Pedidos por armar. Al abrir uno ves la dedicatoria, las consultas y el selector de encargada.</p>" +
        "<p>Para pasarlo a «en armado» el sistema exige <strong>una encargada asignada</strong> y <strong>ninguna consulta abierta</strong>. Las consultas las crea la venta cuando el cliente pide un cambio o un pedido especial.</p>",
      lado: "right",
    },
    {
      elemento: "prod-col-en_armado",
      titulo: "En armado",
      texto:
        "<p>Al abrir un pedido aparece la tabla «Receta vs. usado», con la receta ya cargada. Corrige lo que realmente usaste.</p>" +
        "<p>Al confirmar, lo usado hasta la receta se registra como consumo y el exceso como merma, ambos en el Kardex. El pedido pasa a Listo.</p>",
      lado: "bottom",
    },
    {
      elemento: "prod-col-listo",
      titulo: "Listo",
      texto:
        "<p>Pedidos armados que esperan salir. Producción no los despacha: lo hace Delivery desde su pantalla.</p>",
      lado: "left",
      roles: ["produccion"],
    },
    {
      elemento: "prod-col-listo",
      titulo: "Listo",
      texto:
        "<p>Pedidos armados que esperan salir. Puedes pasarlos a «en camino» desde aquí, aunque normalmente lo hace Delivery al asignar el repartidor.</p>",
      lado: "left",
      roles: ["admin"],
    },
    {
      elemento: "prod-excel",
      titulo: "Hoja de producción",
      texto:
        "<p>Descarga en Excel los pedidos del tablero, con un renglón por producto, para imprimirla o repartir el trabajo en la mesa.</p>",
      lado: "bottom",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Sin encargada o con una consulta abierta, el pedido no pasa a «en armado».</li>" +
        "<li>El consumo solo se confirma una vez y el Kardex no se edita: revisa las cantidades antes de confirmar.</li>" +
        "<li>Si un pedido se cancela después de armado, lo consumido se reporta como merma; no vuelve al stock.</li>" +
        "<li><strong>Después:</strong> los pedidos en Listo aparecen en Delivery para despacharlos.</li>" +
        "</ul>",
    },
  ],
};
