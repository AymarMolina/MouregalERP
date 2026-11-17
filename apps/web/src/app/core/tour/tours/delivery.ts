import type { Tour } from "../tour.types";

export const TOUR_DELIVERY: Tour = {
  id: "delivery",
  pasos: [
    {
      titulo: "Delivery",
      texto:
        "<p>Aquí los pedidos armados salen a reparto y se cierran como entregados, cuidando que el saldo quede cobrado.</p>" +
        "<p><strong>Quién la usa:</strong> repartidores, vendedora y administrador.</p>" +
        "<p><strong>En el flujo:</strong> los pedidos llegan en estado Listo desde Producción → aquí se despachan y se entregan → el cobro del saldo se sigue en Pagos.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>En «Listos para despachar», elige el repartidor del pedido.</li>" +
        "<li>Presiona «Despachar»: el pedido pasa a «en camino».</li>" +
        "<li>Si aún debe saldo y no tiene link de pago, el sistema lo genera al despachar.</li>" +
        "<li>El repartidor marca «entregado» al dejarlo; el pedido pasa a «Entregados del día».</li>" +
        "</ol>",
      roles: ["admin", "vendedora"],
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>«Solo mis pedidos y sin asignar» viene marcado: ves tu ruta y lo que nadie ha tomado.</li>" +
        "<li>Presiona «Despachar» al salir: el pedido pasa a «en camino» y queda asignado a ti.</li>" +
        "<li>Si aún debe saldo y no tiene link de pago, el sistema lo genera al despachar.</li>" +
        "<li>Al dejarlo, presiona «Marcar entregado».</li>" +
        "</ol>",
      roles: ["delivery"],
    },
    {
      elemento: "deliv-tablero",
      titulo: "Tablero de reparto",
      texto:
        "<p>Tres columnas: listos para despachar, en camino y entregados del día. Cada tarjeta trae distrito, dirección, referencia, quién recibe y su teléfono, con botones para llamar o escribir por WhatsApp.</p>" +
        "<p>Abajo ves el total y si hay <strong>saldo</strong> pendiente o ya está pagado. Se actualiza solo cada 15 segundos.</p>",
      lado: "bottom",
    },
    {
      elemento: "deliv-col-0",
      titulo: "Listos para despachar",
      texto:
        "<p>Elige el repartidor en el selector y presiona «Despachar». Si el cliente debe saldo y aún no tiene link, el botón dice «Enviar link y despachar»: el link se genera en ese momento.</p>",
      lado: "right",
      roles: ["admin", "vendedora"],
    },
    {
      elemento: "deliv-col-0",
      titulo: "Listos para despachar",
      texto:
        "<p>Presiona «Despachar» cuando sales con el pedido; queda asignado a ti. Si el cliente debe saldo y aún no tiene link, el botón dice «Enviar link y despachar»: el link se genera en ese momento.</p>",
      lado: "right",
      roles: ["delivery"],
    },
    {
      elemento: "deliv-col-1",
      titulo: "En camino",
      texto:
        "<p>Pedidos en reparto. «Marcar entregado» los cierra. Si queda saldo, el sistema pide confirmación, o desactiva el botón si la tienda exige cobrar antes de entregar.</p>" +
        "<p>Con el ícono de copiar reenvías el link del saldo al cliente.</p>",
      lado: "bottom",
      roles: ["admin", "delivery"],
    },
    {
      elemento: "deliv-col-1",
      titulo: "En camino",
      texto:
        "<p>Pedidos en reparto. Solo el repartidor o el administrador pueden marcarlos entregados. Con el ícono de copiar reenvías el link del saldo al cliente.</p>",
      lado: "bottom",
      roles: ["vendedora"],
    },
    {
      elemento: "deliv-solo-mios",
      titulo: "Solo mis pedidos",
      texto: "<p>Filtra el tablero a los pedidos asignados a ti y a los que aún no tienen repartidor.</p>",
      lado: "bottom",
    },
    {
      elemento: "deliv-fecha",
      titulo: "Día de los entregados",
      texto: "<p>Cambia la fecha para ver en la tercera columna las entregas de otro día.</p>",
      lado: "bottom",
    },
    {
      elemento: "deliv-excel",
      titulo: "Exportar",
      texto: "<p>Descarga en Excel los pedidos del tablero, por ejemplo para armar la ruta del día.</p>",
      lado: "bottom",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Solo se despachan pedidos en Listo; Producción no despacha.</li>" +
        "<li>Despachar con saldo genera el link de pago si aún no existe.</li>" +
        "<li>Solo el repartidor y el administrador marcan «entregado».</li>" +
        "<li>Con saldo pendiente, la entrega pide confirmación o se bloquea, según la configuración de la tienda.</li>" +
        "<li><strong>Después:</strong> el saldo que quede se sigue en Pagos.</li>" +
        "</ul>",
    },
  ],
};
