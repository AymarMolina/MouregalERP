import type { Tour } from "../tour.types";

/**
 * La pantalla es un asistente de 3 pasos: el tutorial solo muestra las
 * secciones del paso visible. Con el botón "?" en el paso 2 o 3 se ven las demás.
 */
export const TOUR_PEDIDO_NUEVO: Tour = {
  id: "pedido-nuevo",
  pasos: [
    {
      titulo: "Nuevo pedido",
      texto:
        "<p>Registra un pedido tocando opciones. El sistema calcula precio, envío y stock; no se escriben montos a mano.</p>" +
        "<p><strong>Quién la usa:</strong> vendedora y administrador.</p>" +
        "<p><strong>En el flujo:</strong> el pedido llega por tienda, WhatsApp o web → aquí se registra como «pendiente» → pasa a Producción para armarse y a Pagos para cobrar el adelanto.</p>",
    },
    {
      titulo: "Cómo funciona",
      texto:
        "<ol>" +
        "<li>Elige el canal y el distrito de entrega.</li>" +
        "<li>Toca un producto, elige tamaño, flor, papel y extras, y agrégalo. Puedes sumar varios.</li>" +
        "<li>Completa cliente, fecha y hora, quién recibe, dirección y dedicatoria.</li>" +
        "<li>Elige el porcentaje de adelanto y confirma.</li>" +
        "<li>El sistema revisa el stock, reserva los insumos, crea el link de pago del adelanto y abre el detalle del pedido.</li>" +
        "</ol>",
    },
    {
      elemento: "nuevo-pasos",
      titulo: "Los tres pasos",
      texto:
        "<p>Destino, productos, y entrega y pago. Toca cualquier paso para volver a él; lo que ya llenaste se conserva.</p>",
      lado: "bottom",
    },
    {
      elemento: "nuevo-canal",
      titulo: "Canal",
      texto: "<p>Por dónde llegó el pedido: en tienda, WhatsApp o web. Queda guardado en el pedido y se usa en los reportes.</p>",
      lado: "bottom",
    },
    {
      elemento: "nuevo-distrito",
      titulo: "Distrito",
      texto:
        "<p>Define el costo de envío según el tarifario. La tarifa es de moto, salvo que el pedido requiera carro: talla L, un arreglo en caja o un extra que lo exige.</p>",
      lado: "top",
    },
    {
      elemento: "nuevo-productos",
      titulo: "Elegir el arreglo",
      texto:
        "<p>Al tocar un producto se abre su configurador. El precio sale del tamaño; cambiar flor o papel suma o resta según las reglas de cambio.</p>" +
        "<p>Las opciones sin stock aparecen bloqueadas. Las marcadas «consultar» o un texto en «¿Algo especial?» abren una consulta a Producción.</p>",
      lado: "top",
    },
    {
      elemento: "nuevo-fecha",
      titulo: "Fecha y hora",
      texto: "<p>Cuándo se entrega. Es obligatorio. Con los atajos eliges Hoy, Mañana o una hora frecuente.</p>",
      lado: "bottom",
    },
    {
      elemento: "nuevo-entrega",
      titulo: "Quién recibe",
      texto:
        "<p>Nombre, teléfono y dirección de quien recibe (obligatorios), una referencia y la dedicatoria. Producción y Delivery ven estos datos en la comanda.</p>",
      lado: "top",
    },
    {
      elemento: "nuevo-adelanto",
      titulo: "Adelanto",
      texto:
        "<p>Porcentaje del total que se cobra primero. Al confirmar, el sistema crea un cobro pendiente con link de pago; se marca como pagado en la pantalla Pagos.</p>" +
        "<p>El resto queda como saldo.</p>",
      lado: "top",
    },
    {
      elemento: "nuevo-carrito",
      titulo: "Tu pedido",
      texto:
        "<p>Suma productos y envío, y muestra total, adelanto y saldo. Se recalcula con cada cambio.</p>" +
        "<p>Si el pedido completo no cabe en el stock, aquí aparece qué insumo falta y cuánto.</p>",
      lado: "left",
    },
    {
      elemento: "nuevo-confirmar",
      titulo: "Confirmar pedido",
      texto:
        "<p>Crea el pedido en estado «pendiente» y abre su detalle. Se desactiva si falta stock o mientras se recalcula el total.</p>",
      lado: "left",
    },
    {
      titulo: "Reglas importantes",
      texto:
        "<ul>" +
        "<li><strong>Sin stock no se crea:</strong> si otra venta tomó los insumos mientras llenabas el formulario, verás qué falta y el resumen se actualiza.</li>" +
        "<li>Un pedido con consulta abierta no puede armarse hasta que Producción la responda; si aprueba con ajuste de precio, cambian el total y el adelanto.</li>" +
        "<li>Después: cobra el adelanto en Pagos y sigue el pedido desde Hoy.</li>" +
        "</ul>",
    },
  ],
};
