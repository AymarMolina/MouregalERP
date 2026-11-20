CREATE TABLE IF NOT EXISTS "pedido_fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"archivo" text NOT NULL,
	"tipo_mime" text NOT NULL,
	"subida_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_fotos" ADD CONSTRAINT "pedido_fotos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_fotos" ADD CONSTRAINT "pedido_fotos_subida_por_usuarios_id_fk" FOREIGN KEY ("subida_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedido_fotos_pedido_idx" ON "pedido_fotos" USING btree ("pedido_id");