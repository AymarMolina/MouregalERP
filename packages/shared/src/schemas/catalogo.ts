import { z } from "zod";
import { AJUSTE_MODO, ESTADO_REGLA, INSUMO_CATEGORIA, ROL_RECETA_LINEA, TALLA, TIPO_CAMBIO, UNIDAD_BASE } from "../enums";

const money = z.coerce.number().finite();
const cantidadBase = z.coerce.number().finite().nonnegative();

export const insumoInputSchema = z.object({
  codigo: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  categoria: z.enum(INSUMO_CATEGORIA),
  unidadBase: z.enum(UNIDAD_BASE),
  stockMinimo: cantidadBase.default(0),
  esFlor: z.boolean().default(false),
  /** Insumo de tipo caja: el pedido que lo lleve sale en carro (5.5). */
  esCaja: z.boolean().default(false),
  activo: z.boolean().optional(),
});
export type InsumoInput = z.infer<typeof insumoInputSchema>;

export const recetaLineaInputSchema = z.object({
  insumoId: z.string().uuid(),
  cantidad: cantidadBase,
  rol: z.enum(ROL_RECETA_LINEA).default("otro"),
});
export type RecetaLineaInput = z.infer<typeof recetaLineaInputSchema>;

export const recetaInputSchema = z.object({
  lineas: z.array(recetaLineaInputSchema).min(1),
});
export type RecetaInput = z.infer<typeof recetaInputSchema>;

export const copiarRecetaInputSchema = z.object({
  a: z.array(z.enum(TALLA)).min(1),
});
export type CopiarRecetaInput = z.infer<typeof copiarRecetaInputSchema>;

export const productoTallaInputSchema = z.object({
  talla: z.enum(TALLA),
  precioBase: money.nonnegative(),
  activo: z.boolean().optional(),
});
export type ProductoTallaInput = z.infer<typeof productoTallaInputSchema>;

export const productoInputSchema = z.object({
  nombre: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug debe ser kebab-case"),
  descripcion: z.string().trim().optional(),
  florPrincipalId: z.string().uuid(),
  usaPapel: z.boolean().default(true),
  papelDefaultId: z.string().uuid().optional().nullable(),
  // URL completa o ruta servida por la propia web (ej. "/productos/susurro-pink.webp").
  imagenUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https?:\/\//.test(v) || /^\/[\w\-./]+$/.test(v), "imagenUrl debe ser una URL o una ruta que empiece con /")
    .optional()
    .nullable(),
  activo: z.boolean().optional(),
  tallas: z.array(productoTallaInputSchema).optional(),
});
export type ProductoInput = z.infer<typeof productoInputSchema>;

export const floresPermitidasInputSchema = z.object({
  insumoIds: z.array(z.string().uuid()),
});
export type FloresPermitidasInput = z.infer<typeof floresPermitidasInputSchema>;

export const reglaCambioInputSchema = z.object({
  tipo: z.enum(TIPO_CAMBIO),
  productoId: z.string().uuid().optional().nullable(),
  insumoOrigenId: z.string().uuid().optional().nullable(),
  insumoDestinoId: z.string().uuid().optional().nullable(),
  descripcion: z.string().trim().optional(),
  ajusteModo: z.enum(AJUSTE_MODO),
  ajusteMonto: money,
  estado: z.enum(ESTADO_REGLA).default("aprobado"),
  activo: z.boolean().optional(),
});
export type ReglaCambioInput = z.infer<typeof reglaCambioInputSchema>;

export const extraInputSchema = z.object({
  nombre: z.string().trim().min(1),
  insumoId: z.string().uuid(),
  precio: money.nonnegative(),
  fuerzaCarro: z.boolean().default(false),
  activo: z.boolean().optional(),
});
export type ExtraInput = z.infer<typeof extraInputSchema>;

export const distritoInputSchema = z.object({
  nombre: z.string().trim().min(1),
  tarifaMoto: money.nonnegative(),
  tarifaCarro: money.nonnegative(),
  activo: z.boolean().optional(),
});
export type DistritoInput = z.infer<typeof distritoInputSchema>;

export const costoVehiculoInputSchema = z.object({
  moto: money.nonnegative(),
  carro: money.nonnegative(),
});
export type CostoVehiculoInput = z.infer<typeof costoVehiculoInputSchema>;

export const aperturaLineaSchema = z.object({
  codigo: z.string().trim().min(1),
  cantidad: cantidadBase,
  costoUnitario: money.nonnegative(),
});
export const aperturaInputSchema = z.object({
  lineas: z.array(aperturaLineaSchema).min(1),
});
export type AperturaInput = z.infer<typeof aperturaInputSchema>;
