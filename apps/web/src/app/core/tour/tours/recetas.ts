import type { Tour } from "../tour.types";

export const TOUR_RECETAS: Tour = {
  id: "recetas",
  pasos: [
    {
      titulo: "Recetas",
      texto:
        "<p>Define cada producto del catálogo: su precio por talla (S, M y L) y la receta, es decir, qué insumos lleva y cuántos.</p>" +
        "<p><strong>Quién la usa:</strong> administración edita; Producción y almacén consultan.</p>" +
        "<p><strong>En el flujo:</strong> usa los insumos de Inventario. El precio alimenta Nuevo pedido, la receta decide el stock que se reserva y en Producción lo usado se compara con ella para calcular la merma.</p>",
    },
    {
      titulo: "Cómo funciona una receta",
      texto:
        "<ol>" +
        "<li>Cada talla tiene su propia lista de insumos con cantidad y rol: flor principal, papel u otro.</li>" +
        "<li>Si el cliente cambia la flor o el papel, esa línea se reemplaza por la elegida; si no quiere papel, se quita.</li>" +
        "<li>Cada extra suma una unidad de su insumo, y todo se multiplica por la cantidad pedida.</li>" +
        "<li>El costo sale del costo promedio de los insumos; margen = precio − costo.</li>" +
        "</ol>",
    },
    {
      titulo: "Cómo se edita",
      texto:
        "<ol>" +
        "<li>Crea el producto con <strong>Nuevo producto</strong> o ábrelo desde el menú de tres puntos de la tabla.</li>" +
        "<li>Ajusta datos y precios, y presiona <strong>Guardar datos</strong>.</li>" +
        "<li>Marca las flores permitidas para cambio y guárdalas.</li>" +
        "<li>Elige la talla, agrega líneas y presiona <strong>Guardar receta</strong>. «Copiar a» la duplica en otra talla.</li>" +
        "</ol>",
      roles: ["admin"],
    },
    {
      titulo: "Cómo se consulta",
      texto:
        "<ol>" +
        "<li>Abre un producto desde el menú de tres puntos de la tabla.</li>" +
        "<li>Revisa la flor principal, el papel y las flores permitidas.</li>" +
        "<li>Cambia de talla para ver qué insumos y cuántos lleva cada una.</li>" +
        "</ol>" +
        "<p>Con tu rol no se guardan cambios; los hace administración.</p>",
      roles: ["produccion", "almacen"],
    },
    {
      elemento: "recetas-nuevo",
      titulo: "Nuevo producto",
      texto:
        "<p>Abre el formulario para crear un producto con su flor principal, papel por defecto y el precio de cada talla. Después le cargas la receta.</p>",
      roles: ["admin"],
      lado: "left",
    },
    {
      elemento: "recetas-productos",
      titulo: "Productos",
      texto:
        "<p>Precio y margen por talla de cada producto activo. Un margen bajo indica que la receta cuesta casi lo que se cobra.</p>" +
        "<p>El menú de tres puntos abre la ficha y la receta; administración también puede desactivar el producto.</p>",
      lado: "top",
    },
    {
      elemento: "recetas-datos",
      titulo: "Datos del producto",
      texto:
        "<p>Nombre, flor principal, papel por defecto, si usa papel y el precio base de cada talla. El precio base es el punto de partida del cotizador.</p>",
      lado: "bottom",
    },
    {
      elemento: "recetas-flores",
      titulo: "Flores permitidas",
      texto:
        "<p>Las flores por las que se puede cambiar la principal. Si no hay una regla de cambio para esa flor, se acepta sin recargo. Una flor no permitida y sin regla abre una consulta a Producción.</p>",
      lado: "top",
    },
    {
      elemento: "recetas-tallas",
      titulo: "Talla de la receta",
      texto: "<p>Elige la talla que quieres ver o editar. Cada una tiene su propia receta.</p>",
      lado: "left",
    },
    {
      elemento: "recetas-lineas",
      titulo: "Líneas de la receta",
      texto:
        "<p>Cada línea es un insumo, su cantidad y su rol. El rol importa: la línea <strong>flor principal</strong> es la que cambia si el cliente elige otra flor, y la de <strong>papel</strong> la que cambia o se quita.</p>",
      lado: "top",
    },
    {
      elemento: "recetas-guardar",
      titulo: "Guardar y copiar",
      texto:
        "<p><strong>Guardar receta</strong> reemplaza la receta de la talla activa. <strong>Copiar a</strong> la duplica en otra talla para no cargarla desde cero.</p>",
      roles: ["admin"],
      lado: "top",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li>El precio de un pedido es precio base + ajustes de reglas + extras (Nuevo pedido).</li>" +
        "<li>Al crear el pedido se reserva el stock de la receta; si falta algo, no se crea.</li>" +
        "<li>En Producción, lo usado por encima de la receta se registra como merma.</li>" +
        "<li>La talla L siempre sale en carro, igual que una receta con caja.</li>" +
        "</ul>",
    },
  ],
};
