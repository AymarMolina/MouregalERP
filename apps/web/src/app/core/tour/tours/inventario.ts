import type { Tour } from "../tour.types";

export const TOUR_INVENTARIO: Tour = {
  id: "inventario",
  pasos: [
    {
      titulo: "Inventario",
      texto:
        "<p>Lleva el stock y el costo de cada insumo: flores, papeles, cajas y extras. Sirve para saber qué hay, qué falta y cuánto cuesta cada cosa.</p>" +
        "<p><strong>Quién la usa:</strong> almacén y administración.</p>" +
        "<p><strong>En el flujo:</strong> el stock sube con la apertura y las compras recibidas, y baja cuando Producción confirma lo usado. De aquí dependen las recetas (costo y margen), el control de stock al crear un pedido y las Compras sugeridas.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Das de alta cada insumo con su código, unidad y stock mínimo.</li>" +
        "<li>Cargas una sola vez el saldo de apertura con un CSV.</li>" +
        "<li>Las compras recibidas suman stock y recalculan el costo promedio.</li>" +
        "<li>Al pasar un pedido a listo, el sistema descuenta lo usado; lo que excede la receta queda como merma.</li>" +
        "<li>Si un insumo baja de su mínimo, aparece el aviso de reposición.</li>" +
        "</ol>",
    },
    {
      elemento: "inv-acciones",
      titulo: "Apertura y nuevos insumos",
      texto:
        "<p><strong>Cargar apertura (CSV)</strong> registra el saldo inicial con el formato codigo,cantidad,costoUnitario. Es todo o nada: si un código no existe o un insumo ya tiene movimientos, no se carga nada.</p>" +
        "<p><strong>Nuevo insumo</strong> abre el formulario. Marca <strong>Es flor</strong> para que se pueda elegir como flor, y <strong>Es caja</strong> si obliga a enviar en carro.</p>",
      lado: "bottom",
    },
    {
      elemento: "inv-alerta",
      titulo: "Aviso de reposición",
      texto:
        "<p>Cuenta los insumos agotados y los que están bajo su mínimo. <strong>Ver solo estos</strong> filtra la tabla; <strong>Compras sugeridas</strong> te lleva a armar la orden de compra.</p>",
      lado: "bottom",
    },
    {
      elemento: "inv-leyenda",
      titulo: "Colores del stock",
      texto:
        "<p>Rojo es agotado (sin stock) y ámbar es bajo el mínimo. Pasa el mouse sobre una alerta de la tabla para ver cuánto falta para llegar al mínimo.</p>",
      lado: "bottom",
    },
    {
      elemento: "inv-filtros",
      titulo: "Filtrar",
      texto: "<p>Cambia entre todos los insumos y solo los que necesitan reposición. El número indica cuántos hay en cada grupo.</p>",
      lado: "bottom",
    },
    {
      elemento: "inv-tabla",
      titulo: "Tabla de insumos",
      texto:
        "<p>Muestra mínimo, stock actual y costo promedio. Con el menú de tres puntos editas nombre, mínimo o si está activo; el stock no se edita aquí.</p>" +
        "<p>Haz clic en el nombre o en <strong>Kardex</strong> para ver cada entrada y salida con su saldo.</p>",
      lado: "top",
    },
    {
      elemento: "inv-paginacion",
      titulo: "Páginas y Excel",
      texto: "<p>Avanza entre páginas o descarga la tabla en Excel. Si marcas filas con las casillas, exporta solo esas.</p>",
      lado: "bottom",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>El Kardex es solo de inserción: nada se borra ni se corrige encima; cada cambio es un movimiento nuevo.</li>" +
        "<li>El costo promedio se recalcula con cada compra recibida y valoriza recetas, margen y merma en Reportes.</li>" +
        "<li>Un pedido no se puede crear si no hay disponible: stock menos lo reservado por pedidos pendientes y en armado.</li>" +
        "<li>Un insumo marcado como caja hace que el pedido salga en carro.</li>" +
        "</ul>",
    },
  ],
};
