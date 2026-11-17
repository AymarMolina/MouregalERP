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
        "<li>Al abrir la pantalla ves los indicadores y los pedidos con entrega hoy.</li>" +
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
      titulo: "Indicadores del día",
      texto:
        "<p>Pedidos, ventas, ticket promedio y saldo por cobrar. La flecha compara contra el mismo día de la semana pasada (verde sube, rojo baja).</p>" +
        "<p>El saldo por cobrar indica cuántos pedidos aún deben dinero.</p>",
      lado: "bottom",
    },
    {
      elemento: "hoy-ventas",
      titulo: "Ventas de 14 días",
      texto:
        "<p>Ventas por fecha de entrega, sin pedidos cancelados. Pasa el cursor por la línea para ver el monto de cada día.</p>",
      lado: "top",
    },
    {
      elemento: "hoy-estados",
      titulo: "Pedidos por estado",
      texto:
        "<p>Cuántos pedidos de hoy hay en cada etapa. Si muchos siguen en «pendiente» cerca de la hora de entrega, Producción está atrasada.</p>",
      lado: "left",
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
