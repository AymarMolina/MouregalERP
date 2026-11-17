import type { Tour } from "../tour.types";

export const TOUR_COMPRAS: Tour = {
  id: "compras",
  pasos: [
    {
      titulo: "Compras",
      texto:
        "<p>Aquí decides qué comprar, armas las órdenes para cada proveedor y registras lo que llega, para que nunca falte material para vender.</p>" +
        "<p><strong>Quién la usa:</strong> Almacén y el administrador.</p>" +
        "<p><strong>En el flujo:</strong> el consumo de Producción y lo reservado por pedidos → aquí se calcula y se compra → lo recibido entra al stock de Inventario, disponible para nuevas ventas.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>En «Compras sugeridas», elige cuántos días cubrir y presiona «Recalcular».</li>" +
        "<li>Marca los insumos, ajusta paquetes, unidades por paquete y costo, y crea la orden en borrador para un proveedor.</li>" +
        "<li>En «Órdenes de compra», márcala como enviada al pedirla.</li>" +
        "<li>Cuando llega la mercadería, registra la recepción (puede ser parcial).</li>" +
        "<li>El sistema suma el stock en el Kardex y recalcula el costo promedio de cada insumo.</li>" +
        "</ol>",
    },
    {
      elemento: "compras-tabs",
      titulo: "Tres secciones",
      texto:
        "<p><strong>Compras sugeridas</strong> calcula qué falta. <strong>Órdenes de compra</strong> lista las órdenes por estado y permite enviarlas, anularlas y recibirlas. <strong>Proveedores</strong> es donde los creas: necesitas al menos uno para armar una orden.</p>",
      lado: "bottom",
    },
    {
      elemento: "compras-parametros",
      titulo: "Cuántos días cubrir",
      texto:
        "<p>La demanda estimada es el consumo promedio diario de los últimos 28 días por los días que elijas. No usa los pedidos futuros, porque esos ya cuentan como reservado.</p>" +
        "<p>Cambia el número y presiona «Recalcular».</p>",
      lado: "bottom",
    },
    {
      elemento: "compras-sugeridas",
      titulo: "Lista sugerida",
      texto:
        "<p><strong>A comprar = mínimo + reservado + demanda − stock</strong>, menos lo ya pedido en órdenes abiertas («En órdenes»).</p>" +
        "<p>Marca una fila para habilitar paquetes, unidades por paquete y costo total. El stock en color está por debajo del mínimo.</p>",
      lado: "top",
    },
    {
      elemento: "compras-excel",
      titulo: "Exportar",
      texto: "<p>Descarga la lista sugerida en Excel para enviarla al proveedor o revisarla.</p>",
      lado: "bottom",
    },
    {
      elemento: "compras-crear-orden",
      titulo: "Crear la orden",
      texto:
        "<p>Elige el proveedor y presiona «Crear orden en borrador». La orden lleva los insumos marcados con sus cantidades y costos, y aparece en «Órdenes de compra».</p>",
      lado: "top",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Solo se recibe una orden enviada o recibida parcialmente; un borrador primero se marca como enviada.</li>" +
        "<li>La orden queda «recibida» cuando llega todo; si falta algo, sigue como recibida parcial.</li>" +
        "<li>Solo se anula una orden en borrador o enviada.</li>" +
        "<li>Cada recepción recalcula el costo promedio; los consumos siguientes se valorizan con ese costo, y de ahí sale el margen en Reportes.</li>" +
        "<li><strong>Después:</strong> revisa el stock nuevo en Inventario.</li>" +
        "</ul>",
    },
  ],
};
