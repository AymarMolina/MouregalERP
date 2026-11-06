import { z } from "zod";
import { CANAL, TALLA } from "../enums";

export const cotizacionInputSchema = z.object({
  productoId: z.string().uuid(),
  talla: z.enum(TALLA),
  cantidad: z.coerce.number().int().positive().default(1),
  florId: z.string().uuid().optional(),
  papelId: z.string().uuid().optional().nullable(),
  extraIds: z.array(z.string().uuid()).default([]),
  distritoId: z.string().uuid(),
});
export type CotizacionInput = z.infer<typeof cotizacionInputSchema>;

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

export const pedidoInputSchema = z.object({
  canal: z.enum(CANAL),
  cliente: z.object({
    nombre: z.string().trim().min(1),
    telefono: z.string().trim().optional(),
    email: z.string().email().optional(),
  }),
  items: z.array(pedidoItemInputSchema).min(1),
  fechaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaEntrega: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  distritoId: z.string().uuid(),
  direccion: z.string().trim().min(1),
  referencia: z.string().trim().optional(),
  telefonoReceptor: z.string().trim().min(1),
  nombreReceptor: z.string().trim().min(1),
  dedicatoria: z.string().trim().optional(),
  porcentajeAdelanto: z.coerce.number().min(0).max(100).default(50),
});
export type PedidoInput = z.infer<typeof pedidoInputSchema>;

export const consultaResolverSchema = z.object({
  estado: z.enum(["aprobada", "rechazada"]),
  respuesta: z.string().trim().min(1),
  ajustePrecio: z.coerce.number().optional(),
});
export type ConsultaResolverInput = z.infer<typeof consultaResolverSchema>;
