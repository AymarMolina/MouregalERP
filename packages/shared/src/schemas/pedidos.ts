import { z } from "zod";
import { CANAL, ESTADO_PEDIDO, METODOS_COBRO_DIRECTO, TALLA, TIPO_ENTREGA } from "../enums";

export const pedidoItemInputSchema = z.object({
  productoId: z.string().uuid(),
  talla: z.enum(TALLA),
  cantidad: z.coerce.number().int().positive().default(1),
  florId: z.string().uuid(),
  papelId: z.string().uuid().optional().nullable(),
  extraIds: z.array(z.string().uuid()).default([]),
  cambioNoListado: z.string().trim().optional(),
});
export type PedidoItemInput = z.infer<typeof pedidoItemInputSchema>;

export const cotizacionInputSchema = z.object({
  productoId: z.string().uuid(),
  talla: z.enum(TALLA),
  cantidad: z.coerce.number().int().positive().default(1),
  florId: z.string().uuid().optional(),
  papelId: z.string().uuid().optional().nullable(),
  extraIds: z.array(z.string().uuid()).default([]),
  /** Sin distrito (recojo en tienda) el envío es 0. */
  distritoId: z.string().uuid().optional(),
  cambioNoListado: z.string().trim().optional(),
  /** Ítems ya agregados al pedido: su receta se descuenta del disponible al evaluar las opciones. */
  itemsEnCarrito: z.array(pedidoItemInputSchema).max(20).default([]),
});
export type CotizacionInput = z.infer<typeof cotizacionInputSchema>;

/** Texto opcional: "" cuenta como no enviado. */
const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const pedidoInputSchema = z
  .object({
    canal: z.enum(CANAL),
    /** delivery (por defecto) o recojo en tienda / se lo lleva al momento. */
    tipoEntrega: z.enum(TIPO_ENTREGA).default("delivery"),
    cliente: z.object({
      /** En recojo puede ir vacío: queda como "Cliente de mostrador". */
      nombre: textoOpcional,
      telefono: textoOpcional,
      email: z.string().email().optional(),
    }),
    items: z.array(pedidoItemInputSchema).min(1),
    fechaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    horaEntrega: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    /** Solo delivery. */
    distritoId: z.string().uuid().optional(),
    direccion: textoOpcional,
    referencia: textoOpcional,
    /** Link de Google Maps (opcional). El API lo resuelve a coordenadas al crear el pedido. */
    ubicacionUrl: z.string().trim().url().max(500).optional(),
    telefonoReceptor: textoOpcional,
    nombreReceptor: textoOpcional,
    dedicatoria: textoOpcional,
    porcentajeAdelanto: z.coerce.number().min(0).max(100).default(50),
    /**
     * Si el cliente paga el adelanto en ese momento (en tienda, Yape al chat…):
     * se registra como pagado con este método y no se crea un link pendiente.
     */
    pagoAhora: z
      .object({
        metodo: z.enum(METODOS_COBRO_DIRECTO),
        referencia: textoOpcional,
      })
      .optional(),
    /** Descuento en soles sobre los productos (no sobre el envío). */
    descuento: z.coerce.number().min(0).default(0),
    motivoDescuento: textoOpcional,
  })
  .superRefine((p, ctx) => {
    if (p.tipoEntrega === "delivery") {
      const faltan: [keyof typeof p, string][] = [
        ["distritoId", "el distrito"],
        ["direccion", "la dirección"],
        ["nombreReceptor", "quién recibe"],
        ["telefonoReceptor", "el teléfono de quien recibe"],
      ];
      for (const [campo, nombre] of faltan) {
        if (!p[campo]) ctx.addIssue({ code: "custom", path: [campo], message: `Para delivery falta ${nombre}` });
      }
      if (!p.cliente.nombre) {
        ctx.addIssue({ code: "custom", path: ["cliente", "nombre"], message: "Falta el nombre del cliente" });
      }
    }
    if (p.descuento > 0 && !p.motivoDescuento) {
      ctx.addIssue({ code: "custom", path: ["motivoDescuento"], message: "Indica el motivo del descuento" });
    }
  });
export type PedidoInput = z.infer<typeof pedidoInputSchema>;
/** Lo que se envía al crear (antes de aplicar valores por defecto). */
export type PedidoEntrada = z.input<typeof pedidoInputSchema>;

export const consultaResolverSchema = z.object({
  estado: z.enum(["aprobada", "rechazada"]),
  respuesta: z.string().trim().min(1),
  ajustePrecio: z.coerce.number().optional(),
});
export type ConsultaResolverInput = z.infer<typeof consultaResolverSchema>;

export const transicionInputSchema = z.object({
  a: z.enum(ESTADO_PEDIDO),
  nota: z.string().trim().optional(),
});
export type TransicionInput = z.infer<typeof transicionInputSchema>;

export const asignarInputSchema = z.object({
  encargadaId: z.string().uuid().optional().nullable(),
  repartidorId: z.string().uuid().optional().nullable(),
});
export type AsignarInput = z.infer<typeof asignarInputSchema>;

export const consumoLineaInputSchema = z.object({
  insumoId: z.string().uuid(),
  cantidadUsada: z.coerce.number().nonnegative(),
});
export const consumoInputSchema = z.object({
  lineas: z.array(consumoLineaInputSchema).min(1),
});
export type ConsumoInput = z.infer<typeof consumoInputSchema>;

export const ajusteInventarioInputSchema = z.object({
  insumoId: z.string().uuid(),
  tipo: z.enum(["ajuste_positivo", "ajuste_negativo"]),
  cantidad: z.coerce.number().positive(),
  nota: z.string().trim().min(1),
});
export type AjusteInventarioInput = z.infer<typeof ajusteInventarioInputSchema>;

/** Cotización del pedido completo (varios ítems): total, vehículo, envío y stock combinado. */
export const cotizacionPedidoInputSchema = z.object({
  items: z.array(pedidoItemInputSchema).min(1),
  /** Sin distrito (recojo en tienda) el envío es 0. */
  distritoId: z.string().uuid().optional(),
});
export type CotizacionPedidoInput = z.infer<typeof cotizacionPedidoInputSchema>;

export const despacharInputSchema = z.object({
  repartidorId: z.string().uuid().optional(),
});
export type DespacharInput = z.infer<typeof despacharInputSchema>;
