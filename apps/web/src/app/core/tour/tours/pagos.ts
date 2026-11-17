import type { Tour } from "../tour.types";

export const TOUR_PAGOS: Tour = {
  id: "pagos",
  pasos: [
    {
      titulo: "Pagos",
      texto:
        "<p>Aquí controlas lo que debe cada pedido y lo cobras: con un link de pago o registrando un pago que ya recibiste.</p>" +
        "<p><strong>Quién la usa:</strong> vendedora y administrador.</p>" +
        "<p><strong>En el flujo:</strong> los pedidos llegan desde «Nuevo pedido» con su total y adelanto → aquí se cobran el adelanto y el saldo → Delivery ve si el pedido sale pagado o con saldo.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Filtra por fecha de entrega o busca el pedido.</li>" +
        "<li>Haz clic en la fila para abrir su panel de cobro.</li>" +
        "<li>Genera el link del saldo y compártelo, o registra el pago si el cliente ya pagó por otro medio.</li>" +
        "<li>Cuando un cobro con link se paga, confírmalo en Movimientos.</li>" +
        "<li>El sistema recalcula lo pagado y el saldo del pedido.</li>" +
        "</ol>",
    },
    {
      elemento: "pagos-filtros",
      titulo: "Filtros",
      texto:
        "<p>Busca por número de pedido, cliente o teléfono. La fecha es la de <strong>entrega</strong> del pedido. «Solo con saldo pendiente» oculta los que ya están pagados.</p>",
      lado: "bottom",
    },
    {
      elemento: "pagos-total",
      titulo: "Saldo por cobrar",
      texto: "<p>La suma de lo que falta cobrar en los pedidos de la tabla, con los filtros actuales.</p>",
      lado: "left",
    },
    {
      elemento: "pagos-tabla",
      titulo: "Pedidos",
      texto:
        "<p>Cada fila muestra el estado del pedido, el total, lo pagado y el saldo.</p>" +
        "<p>La columna Cobro dice si hay un cobro pendiente (con su monto), si falta generar el link («sin link») o si ya está pagado. Haz clic en la fila para gestionarlo.</p>",
      lado: "top",
    },
    {
      elemento: "pagos-excel",
      titulo: "Páginas y Excel",
      texto:
        "<p>Cambia de página o descarga en Excel lo seleccionado. Si no marcas nada, se exporta todo lo filtrado.</p>",
      lado: "bottom",
    },
    {
      elemento: "pagos-cobro",
      titulo: "Panel de cobro",
      texto:
        "<p>Lo pagado, el saldo y todos los movimientos del pedido. En un cobro pendiente puedes copiar su link, confirmarlo cuando llegue el dinero o anularlo.</p>",
      lado: "left",
    },
    {
      elemento: "pagos-link",
      titulo: "Link del saldo",
      texto:
        "<p>Crea un solo cobro por todo lo que falta y anula los cobros pendientes anteriores, así el cliente nunca tiene dos links vigentes.</p>",
      lado: "left",
    },
    {
      elemento: "pagos-registrar",
      titulo: "Registrar un pago recibido",
      texto:
        "<p>Para pagos hechos por fuera del link, como efectivo o transferencia. Queda como pagado al momento. El monto no puede superar el saldo.</p>",
      lado: "left",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Generar un link nuevo anula los cobros pendientes anteriores del pedido.</li>" +
        "<li>Un pago registrado no puede ser mayor que el saldo.</li>" +
        "<li>Al despachar un pedido con saldo, el sistema genera el link si aún no existe.</li>" +
        "<li>Si se cancela un pedido, sus cobros pendientes se anulan.</li>" +
        "<li><strong>Después:</strong> Delivery ve el saldo en cada tarjeta antes de entregar.</li>" +
        "</ul>",
    },
  ],
};
