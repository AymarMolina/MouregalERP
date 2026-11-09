ALTER TABLE "usuarios" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "insumos" ADD COLUMN "es_caja" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Datos: los insumos que antes se detectaban como caja por el prefijo de código quedan marcados.
UPDATE "insumos" SET "es_caja" = true WHERE upper("codigo") LIKE 'CAJ%';
