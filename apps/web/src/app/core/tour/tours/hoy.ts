import type { Tour } from "../tour.types";

export const TOUR_HOY: Tour = {
  id: "hoy",
  pasos: [
    {
      titulo: "Hoy",
      texto:
        "<p>Tablero del día: cuánto se vende, qué pedidos se entregan hoy, en qué etapa está cada uno y qué necesita atención.</p>" +
        "<p><strong>Quién la usa:</strong> administrador, vendedora y producción.</p>" +
        "<p><strong>En el flujo:</strong> reúne los pedidos con entrega hoy. Desde aquí abres el detalle de un pedido o registras uno nuevo.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Arriba ves el resumen del día y, debajo, cada pedido con delivery en su franja horaria.</li>" +
        "<li>Los datos se actualizan solos cada 15 segundos; se pausa si cambias de pestaña.</li>" +
        "<li>Filtra por estado o busca por número, cliente o distrito.</li>" +
        "<li>Abre un pedido para ver su comanda, pagos e historial.</li>" +
        "<li>Revisa «Requiere atención» para resolver consultas y faltantes antes de que frenen el armado.</li>" +
        "</ol>",
    },
    {
      elemento: "hoy-nuevo",
      titulo: "Nuevo pedido",
      texto: "<p>Abre el registro de un pedido. Al guardarlo, el sistema reserva los insumos y aparece aquí si su entrega es hoy.</p>",
      roles: ["admin", "vendedora"],
      lado: "left",
    },
    {
      elemento: "hoy-kpis",
      titulo: "Resumen del día",
      texto:
        "<p>Cuántos pedidos hay, cuánto se vendió y cuánto falta cobrar. Si algún pedido pasó su hora de entrega, aparece en rojo.</p>",
      lado: "bottom",
    },
    {
      elemento: "hoy-horas",
      titulo: "Entregas por hora",
      texto:
        "<p>Cada pedido con delivery aparece en su franja horaria. La franja con la línea rosada es la de ahora. Un borde rojo indica que ya pasó su hora y aún no sale. El saldo se ve en ámbar.</p>",
      lado: "top",
    },
    {
      elemento: "hoy-estados",
      titulo: "Recojos en tienda",
      texto:
        "<p>Los pedidos que el cliente pasa a recoger. Cuando están listos, ábrelos para cobrar lo que falte y entregarlos en un solo paso.</p>",
      lado: "top",
    },
    {
      elemento: "hoy-pedidos",
      titulo: "Pedidos del día",
      texto:
        "<p>Cada fila muestra hora de entrega, quién recibe, destino, vehículo, estado, total y saldo pendiente.</p>" +
        "<p>Toca el número del pedido para abrir su detalle. Puedes marcar filas para exportarlas a Excel.</p>",
      lado: "top",
    },
    {
      elemento: "hoy-filtros",
      titulo: "Filtrar por estado",
      texto: "<p>Cada pestaña filtra la tabla y muestra cuántos pedidos tiene. Se combina con el buscador.</p>",
      lado: "bottom",
    },
    {
      elemento: "hoy-atencion",
      titulo: "Requiere atención",
      texto:
        "<p>Lista las consultas abiertas a Producción y los insumos por debajo del stock mínimo.</p>" +
        "<p>Una consulta abierta bloquea el armado de ese pedido; un insumo bajo puede impedir vender nuevos pedidos.</p>",
      lado: "left",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Solo aparecen pedidos con <strong>entrega</strong> hoy; un pedido para mañana no se ve aquí aunque se haya creado hoy.</li>" +
        "<li>Las consultas se responden en Producción.</li>" +
        "<li>El cobro del saldo se gestiona en Pagos o al despachar en Delivery.</li>" +
        "</ul>",
    },
  ],
};
