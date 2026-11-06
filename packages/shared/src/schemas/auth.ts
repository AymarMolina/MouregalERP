import { z } from "zod";
import { ROL_USUARIO } from "../enums";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  email: z.string().email(),
  rol: z.enum(ROL_USUARIO),
});
export type AuthUser = z.infer<typeof authUserSchema>;
