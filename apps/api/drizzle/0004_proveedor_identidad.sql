CREATE TYPE "public"."tipo_identidad" AS ENUM('ruc', 'dni', 'ce');--> statement-breakpoint
-- Los proveedores existentes quedan como RUC.
ALTER TABLE "proveedores" ADD COLUMN "tipo_identidad" "tipo_identidad" DEFAULT 'ruc' NOT NULL;--> statement-breakpoint
ALTER TABLE "proveedores" RENAME COLUMN "ruc" TO "num_identidad";
