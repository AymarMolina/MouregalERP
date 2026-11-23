import type { Tour } from "../tour.types";

export const TOUR_REPORTES: Tour = {
  id: "reportes",
  pasos: [
    {
      titulo: "Reportes",
      texto:
        "<p>Muestra cómo le fue al negocio en un período: cuánto se cobró, cuánto se ganó por producto, cuánto se perdió en merma, qué se vende más y si el envío cubre su costo.</p>" +
        "<p><strong>Quién la usa:</strong> administración.</p>" +
        "<p><strong>En el flujo:</strong> se alimenta de Pagos, Producción, Delivery, el Kardex de Inventario y el costo por viaje del Tarifario. Solo lee datos, no cambia nada.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Elige el período con las fechas o un atajo.</li>" +
        "<li>Presiona <strong>Aplicar</strong> si cambiaste las fechas a mano.</li>" +
        "<li>Cambia de reporte con las pestañas.</li>" +
        "<li>Abre un pedido desde su número o descarga la tabla en Excel.</li>" +
        "</ol>",
    },
    {
      elemento: "rep-periodo",
      titulo: "Período",
      texto: "<p>Fechas <strong>Desde</strong> y <strong>Hasta</strong>. Los cinco reportes se calculan para este mismo rango.</p>",
      lado: "bottom",
    },
    {
      elemento: "rep-atajos",
      titulo: "Atajos",
      texto: "<p>Últimos 7, 30 o 90 días, o el mes en curso, con un clic.</p>",
      lado: "bottom",
    },
    {
      elemento: "rep-pestanas",
      titulo: "Los cinco reportes",
      texto:
        "<ul>" +
        "<li><strong>Cobros:</strong> pagos confirmados, por fecha de pago.</li>" +
        "<li><strong>Margen:</strong> ingresos − costo real, por el día en que el pedido quedó listo.</li>" +
        "<li><strong>Merma:</strong> exceso de Producción y pedidos cancelados ya armados.</li>" +
        "<li><strong>Más vendidos:</strong> por fecha de venta, sin cancelados.</li>" +
        "<li><strong>Envíos:</strong> cobrado vs. costo, por el día en que salió.</li>" +
        "</ul>",
      lado: "bottom",
    },
    {
      elemento: "rep-previa",
      titulo: "Vista previa, Excel y PDF",
      texto:
        "<p>Muestra el reporte de la pestaña activa como documento: período, totales y todas las filas. Desde ahí lo descargas en Excel o lo imprimes / guardas en PDF.</p>" +
        "<p>Si marcaste filas en la tabla, la vista previa incluye solo esas.</p>",
      lado: "left",
    },
    {
      elemento: "rep-cobros-kpis",
      titulo: "Resumen de cobros",
      texto: "<p>Total cobrado en el rango y cuánto entró por cada método de pago. Solo cuenta cobros confirmados.</p>",
      lado: "bottom",
    },
    {
      elemento: "rep-cobros-tabla",
      titulo: "Detalle de cobros",
      texto:
        "<p>Cada cobro con su fecha de pago, cliente, tipo y método. Haz clic en el número para abrir el pedido.</p>",
      lado: "top",
    },
    {
      elemento: "rep-excel",
      titulo: "Exportar a Excel",
      texto: "<p>Descarga la tabla del reporte en Excel. Si marcas filas, exporta solo esas.</p>",
      lado: "bottom",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Cada reporte usa la fecha real del hecho, no la de entrega: un pedido para el 19 que se arma hoy cuenta hoy.</li>" +
        "<li>El costo real usa lo que Producción confirmó, incluida la merma, al costo del Kardex.</li>" +
        "<li>Un pedido cancelado después de armarse aparece como merma por cancelación.</li>" +
        "<li>El costo de envío sale del Tarifario: viajes × costo por viaje.</li>" +
        "</ul>",
    },
  ],
};
