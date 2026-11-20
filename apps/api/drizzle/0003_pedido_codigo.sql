ALTER TABLE "pedidos" ADD COLUMN "codigo" text;--> statement-breakpoint
-- Rellena los pedidos existentes: mes de creación en Lima + correlativo del mes por orden de número.
UPDATE "pedidos" p SET "codigo" = x.codigo
FROM (
  SELECT id,
    (ARRAY['EN','FE','MR','AB','MY','JN','JL','AG','SE','OC','NO','DI'])[extract(month FROM created_at AT TIME ZONE 'America/Lima')::int]
      || '-' || lpad(row_number() OVER (
        PARTITION BY date_trunc('month', created_at AT TIME ZONE 'America/Lima') ORDER BY numero
      )::text, 4, '0') AS codigo
  FROM "pedidos"
) x
WHERE p.id = x.id;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "codigo" SET NOT NULL;
