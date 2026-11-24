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
        "<li>Elige el canal y si el cliente lo recoge en tienda o va por delivery (con distrito).</li>" +
        "<li>Toca un producto, elige tamaño, flor, papel y extras, y agrégalo. Puedes sumar varios.</li>" +
        "<li>Completa cuándo se entrega. En tienda basta «Se lo lleva ahora»; en delivery, quién recibe y la dirección.</li>" +
        "<li>Elige cuánto paga ahora y cómo (efectivo, Yape, tarjeta…). Si ya te pagó, queda registrado al confirmar.</li>" +
        "<li>El sistema revisa el stock, reserva los insumos y abre el detalle del pedido.</li>" +
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
      elemento: "nuevo-tipo-entrega",
      titulo: "Recoge en tienda o delivery",
      texto:
        "<p><strong>Recoge en tienda:</strong> no se pide dirección ni se cobra envío. Sirve para el cliente que se lo lleva ahora y para el que pasa después.</p><p><strong>Delivery:</strong> elige el distrito.</p>",
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
      titulo: "Pago",
      texto:
        "<p>Cuánto paga ahora (todo, 50 % o nada) y cómo. Con efectivo, Yape, Plin, tarjeta o transferencia el cobro queda registrado al confirmar; con «Enviar link» se le manda un link y se confirma cuando pague.</p>" +
        "<p>«Aplicar descuento» pide monto y motivo. La vendedora puede hasta 10 % de los productos.</p>",
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
