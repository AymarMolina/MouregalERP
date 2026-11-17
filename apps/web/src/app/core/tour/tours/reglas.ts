import type { Tour } from "../tour.types";

export const TOUR_REGLAS: Tour = {
  id: "reglas",
  pasos: [
    {
      titulo: "Reglas de cambio",
      texto:
        "<p>Define cuánto cambia el precio cuando el cliente pide otra flor u otro papel que los de la receta, y si ese cambio necesita la aprobación de Producción.</p>" +
        "<p><strong>Quién la usa:</strong> administración.</p>" +
        "<p><strong>En el flujo:</strong> usa productos de Recetas e insumos de Inventario. El cotizador de Nuevo pedido y la creación del pedido aplican estas reglas; las que piden consulta llegan a Producción.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Creas una regla: tipo, producto (o todos), insumo de origen y de destino, y el ajuste.</li>" +
        "<li>Cuando la vendedora cambia la flor o el papel, el sistema busca la regla de ese origen → destino.</li>" +
        "<li>Si el estado es <strong>aprobado</strong>, suma el ajuste al precio.</li>" +
        "<li>Si es <strong>consultar</strong>, también suma el ajuste y abre una consulta a Producción.</li>" +
        "</ol>",
    },
    {
      elemento: "reglas-nueva",
      titulo: "Nueva regla",
      texto:
        "<p>Abre el formulario. <strong>Fijo</strong> suma el monto una vez por unidad del producto; <strong>Por unidad</strong> lo multiplica por la cantidad de flor o papel de la receta. Un monto negativo baja el precio.</p>",
      lado: "left",
    },
    {
      elemento: "reglas-tabla",
      titulo: "Reglas vigentes",
      texto:
        "<p>Cada regla con su producto, el cambio origen → destino, el ajuste y su estado. El menú de tres puntos la desactiva: deja de aplicarse a los pedidos nuevos.</p>",
      lado: "top",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>Una regla del producto gana sobre una regla general (producto vacío).</li>" +
        "<li>Cambiar a una flor permitida del producto (Recetas) sin regla no tiene recargo.</li>" +
        "<li>Un cambio de flor o papel sin regla, y no permitido, abre una consulta a Producción.</li>" +
        "<li>Mientras haya una consulta abierta, el pedido no puede pasar a armado.</li>" +
        "<li>Hoy el cotizador aplica automáticamente solo las reglas de tipo flor y papel.</li>" +
        "</ul>",
    },
  ],
};
