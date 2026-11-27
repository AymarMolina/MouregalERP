CREATE TYPE "public"."tipo_movimiento_caja" AS ENUM('egreso', 'ingreso');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "caja_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caja_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_caja" NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"motivo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cajas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"fondo" numeric(12, 2) NOT NULL,
	"abierta_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_at" timestamp with time zone,
	"esperado" numeric(12, 2),
	"contado" numeric(12, 2),
	"nota" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cliente_fechas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"dia" integer NOT NULL,
	"mes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "registrado_por" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_caja_id_cajas_id_fk" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cajas" ADD CONSTRAINT "cajas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cliente_fechas" ADD CONSTRAINT "cliente_fechas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Una persona tiene a lo más una caja abierta.
CREATE UNIQUE INDEX IF NOT EXISTS "cajas_una_abierta_por_usuario" ON "cajas" ("usuario_id") WHERE "cerrada_at" IS NULL;
