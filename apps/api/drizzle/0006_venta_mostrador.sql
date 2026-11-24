CREATE TYPE "public"."tipo_entrega" AS ENUM('delivery', 'recojo');--> statement-breakpoint
ALTER TYPE "public"."metodo_pago" ADD VALUE 'tarjeta';--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "distrito_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "direccion" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "telefono_receptor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "nombre_receptor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "vehiculo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "tipo_entrega" "tipo_entrega" DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "descuento" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "motivo_descuento" text;