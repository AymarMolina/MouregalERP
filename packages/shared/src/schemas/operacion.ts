import { z } from "zod";
import { ESTADO_OC, METODO_PAGO, TIPO_PAGO } from "../enums";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato AAAA-MM-DD");
const positivo = z.coerce.number().finite().positive();

// ---------- Pagos (5.11) ----------

/** Registro manual de un pago ya cobrado (Yape, Plin, efectivo, transferencia...). */
export const pagoManualInputSchema = z.object({
  tipo: z.enum(TIPO_PAGO),
  metodo: z.enum(METODO_PAGO).refine((m) => m !== "link" && m !== "shopify", {
    message: "Los pagos por link o Shopify se confirman, no se registran a mano",
  }),
  monto: positivo,
  referenciaExterna: z.string().trim().max(200).optional(),
});
export type PagoManualInput = z.infer<typeof pagoManualInputSchema>;

export const confirmarPagoInputSchema = z.object({
  referenciaExterna: z.string().trim().max(200).optional(),
});
export type ConfirmarPagoInput = z.infer<typeof confirmarPagoInputSchema>;

// ---------- Compras (5.9, 5.10) ----------

export const proveedorInputSchema = z.object({
  nombre: z.string().trim().min(1),
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "El RUC tiene 11 dígitos")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  telefono: z.string().trim().optional(),
  activo: z.boolean().optional(),
});
export type ProveedorInput = z.infer<typeof proveedorInputSchema>;

export const ordenCompraLineaInputSchema = z.object({
  insumoId: z.string().uuid(),
  paquetes: positivo,
  unidadesPorPaquete: positivo,
  /** Costo total de la línea (todos los paquetes). */
  costoTotal: z.coerce.number().finite().nonnegative(),
});
export type OrdenCompraLineaInput = z.infer<typeof ordenCompraLineaInputSchema>;

export const ordenCompraInputSchema = z.object({
  proveedorId: z.string().uuid(),
  fecha: fecha.optional(),
  nota: z.string().trim().optional(),
  lineas: z.array(ordenCompraLineaInputSchema).min(1),
});
export type OrdenCompraInput = z.infer<typeof ordenCompraInputSchema>;

export const ordenCompraUpdateSchema = z.object({
  estado: z.enum(ESTADO_OC).optional(),
  nota: z.string().trim().optional(),
  /** Solo se pueden reemplazar las líneas mientras la orden está en borrador. */
  lineas: z.array(ordenCompraLineaInputSchema).min(1).optional(),
});
export type OrdenCompraUpdate = z.infer<typeof ordenCompraUpdateSchema>;

export const recepcionInputSchema = z.object({
  lineas: z
    .array(
      z.object({
        lineaId: z.string().uuid(),
        paquetes: positivo,
        unidadesPorPaquete: positivo,
        costoTotal: z.coerce.number().finite().nonnegative(),
      }),
    )
    .min(1),
  nota: z.string().trim().optional(),
});
export type RecepcionInput = z.infer<typeof recepcionInputSchema>;

// ---------- Reportes ----------

export const rangoFechasSchema = z
  .object({ desde: fecha, hasta: fecha })
  .refine((r) => r.desde <= r.hasta, { message: "'desde' debe ser anterior o igual a 'hasta'" });
export type RangoFechas = z.infer<typeof rangoFechasSchema>;
