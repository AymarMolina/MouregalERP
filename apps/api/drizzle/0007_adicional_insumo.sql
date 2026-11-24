ALTER TABLE "pedido_item_cambios" ADD COLUMN "insumo_id" uuid;--> statement-breakpoint
ALTER TABLE "pedido_item_cambios" ADD COLUMN "cantidad" numeric(12, 3);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_item_cambios" ADD CONSTRAINT "pedido_item_cambios_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
