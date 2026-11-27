import { z } from "zod";
import { CANAL, ESTADO_PEDIDO, METODOS_COBRO_DIRECTO, MOTIVO_MERMA, TALLA, TIPO_ENTREGA } from "../enums";

/**
 * Algo que el cliente pide y no está en el catálogo de extras (una planta, unos
 * girasoles, un chocolate…): la vendedora lo describe y le pone precio. Suma al
 * precio del ítem y Producción lo ve en la comanda. Si es un insumo del
 * inventario (`insumoId`), se reserva y se descuenta del stock como el resto
 * de la receta (`cantidad` por unidad del ítem). Sin insumo no toca stock.
 */
export const adicionalInputSchema = z.object({
  descripcion: z.string().trim().min(1, "Describe el adicional").max(80),
  precio: z.coerce.number().positive("El precio del adicional debe ser mayor que 0").max(10000),
  insumoId: z.string().uuid().optional(),
  cantidad: z.coerce.number().positive().max(1000).optional(),
});
export type AdicionalInput = z.infer<typeof adicionalInputSchema>;

export const pedidoItemInputSchema = z.object({
  productoId: z.string().uuid(),
  talla: z.enum(TALLA),
  cantidad: z.coerce.number().int().positive().default(1),
  florId: z.string().uuid(),
  papelId: z.string().uuid().optional().nullable(),
  extraIds: z.array(z.string().uuid()).default([]),
  adicionales: z.array(adicionalInputSchema).max(10).optional(),
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
  adicionales: z.array(adicionalInputSchema).max(10).optional(),
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

/** Una parte de un cobro directo: método y monto. */
export const parteCobroSchema = z.object({
  metodo: z.enum(METODOS_COBRO_DIRECTO),
  monto: z.coerce.number().positive("Cada monto debe ser mayor que 0"),
  referencia: textoOpcional,
});
export type ParteCobro = z.input<typeof parteCobroSchema>;

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
    /** Adelanto en soles (p. ej. 127 de 250). Si llega, gana sobre el porcentaje. */
    montoAdelanto: z.coerce.number().min(0).optional(),
    /**
     * Lo que el cliente ya pagó al crear el pedido, en uno o varios métodos
     * (10 en efectivo + 20 por Yape). Se registra pagado y no se crea link.
     * Vacío: se crea un link pendiente por el adelanto.
     */
    pagos: z.array(parteCobroSchema).max(5).default([]),
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

export const consumoLineaInputSchema = z
  .object({
    insumoId: z.string().uuid(),
    /** Todo lo que salió del almacén para este insumo (lo que va en el arreglo + lo que se perdió). */
    cantidadUsada: z.coerce.number().nonnegative(),
    /**
     * Lo que se perdió (se rompió, se descartó). Lo demás va en el arreglo aunque
     * pase la receta: a veces se ponen flores de más para que se vea mejor.
     * Sin este dato, todo lo que pasa de la receta cuenta como merma (comportamiento anterior).
     */
    merma: z.coerce.number().nonnegative().optional(),
  })
  .refine((l) => l.merma === undefined || l.merma <= l.cantidadUsada, {
    message: "Lo que se perdió no puede ser más que lo usado",
    path: ["merma"],
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

/** Merma registrada a mano (lo que se pierde fuera de un pedido). Con motivo "otro" la nota es obligatoria. */
export const mermaInputSchema = z
  .object({
    insumoId: z.string().uuid(),
    cantidad: z.coerce.number().positive("La cantidad debe ser mayor que 0"),
    motivo: z.enum(MOTIVO_MERMA),
    nota: z.string().trim().max(200).optional(),
  })
  .refine((m) => m.motivo !== "otro" || !!m.nota, { message: "Explica el motivo", path: ["nota"] });
export type MermaInput = z.infer<typeof mermaInputSchema>;

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
