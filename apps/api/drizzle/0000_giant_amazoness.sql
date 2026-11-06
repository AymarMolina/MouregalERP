CREATE TYPE "public"."canal" AS ENUM('shopify', 'whatsapp', 'vendedora');--> statement-breakpoint
CREATE TYPE "public"."estado_consulta" AS ENUM('abierta', 'aprobada', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."estado_oc" AS ENUM('borrador', 'enviada', 'recibida_parcial', 'recibida', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('pendiente', 'pagado', 'fallido', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."estado_pedido" AS ENUM('pendiente', 'en_armado', 'listo', 'en_camino', 'entregado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."estado_regla" AS ENUM('aprobado', 'consultar');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago" AS ENUM('shopify', 'link', 'yape', 'plin', 'transferencia', 'efectivo');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'vendedora', 'produccion', 'almacen', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."talla" AS ENUM('S', 'M', 'L');--> statement-breakpoint
CREATE TYPE "public"."tipo_cambio" AS ENUM('flor', 'papel', 'color', 'tamano', 'extra', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('apertura', 'compra', 'consumo', 'merma', 'ajuste_positivo', 'ajuste_negativo', 'devolucion');--> statement-breakpoint
CREATE TYPE "public"."tipo_pago" AS ENUM('adelanto', 'saldo');--> statement-breakpoint
CREATE TYPE "public"."unidad_base" AS ENUM('tallo', 'g', 'hoja', 'm', 'und');--> statement-breakpoint
CREATE TYPE "public"."vehiculo" AS ENUM('moto', 'carro');--> statement-breakpoint
CREATE TYPE "public"."insumo_categoria" AS ENUM('flor', 'follaje', 'papel', 'accesorio', 'relleno', 'peluche');--> statement-breakpoint
CREATE TYPE "public"."fuente_integracion" AS ENUM('shopify', 'whatsapp');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol_usuario" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"categoria" "insumo_categoria" NOT NULL,
	"unidad_base" "unidad_base" NOT NULL,
	"stock_minimo" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_actual" numeric(12, 3) DEFAULT '0' NOT NULL,
	"costo_promedio" numeric(12, 4) DEFAULT '0' NOT NULL,
	"es_flor" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kardex_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"entrada" numeric(12, 3) DEFAULT '0' NOT NULL,
	"salida" numeric(12, 3) DEFAULT '0' NOT NULL,
	"costo_unitario" numeric(12, 4) NOT NULL,
	"saldo_resultante" numeric(12, 3) NOT NULL,
	"referencia_tipo" text,
	"referencia_id" uuid,
	"nota" text,
	"usuario_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kardex_entrada_salida_check" CHECK ("kardex_movimientos"."entrada" >= 0 AND "kardex_movimientos"."salida" >= 0 AND ("kardex_movimientos"."entrada" = 0 OR "kardex_movimientos"."salida" = 0))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"insumo_id" uuid NOT NULL,
	"precio" numeric(12, 2) NOT NULL,
	"fuerza_carro" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "producto_flores_permitidas" (
	"producto_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	CONSTRAINT "producto_flores_permitidas_producto_id_insumo_id_pk" PRIMARY KEY("producto_id","insumo_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "producto_tallas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"talla" "talla" NOT NULL,
	"precio_base" numeric(12, 2) NOT NULL,
	"shopify_variant_id" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "producto_tallas_shopify_variant_id_unique" UNIQUE("shopify_variant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"descripcion" text,
	"flor_principal_id" uuid NOT NULL,
	"usa_papel" boolean DEFAULT true NOT NULL,
	"papel_default_id" uuid,
	"imagen_url" text,
	"shopify_product_id" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_slug_unique" UNIQUE("slug"),
	CONSTRAINT "productos_shopify_product_id_unique" UNIQUE("shopify_product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "receta_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_talla_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad" numeric(12, 3) NOT NULL,
	"rol" text DEFAULT 'otro' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reglas_cambio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_cambio" NOT NULL,
	"producto_id" uuid,
	"insumo_origen_id" uuid,
	"insumo_destino_id" uuid,
	"descripcion" text,
	"ajuste_modo" text NOT NULL,
	"ajuste_monto" numeric(12, 2) NOT NULL,
	"estado" "estado_regla" DEFAULT 'aprobado' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "costos_vehiculo" (
	"vehiculo" "vehiculo" PRIMARY KEY NOT NULL,
	"costo_por_viaje" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "distritos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"tarifa_moto" numeric(12, 2) NOT NULL,
	"tarifa_carro" numeric(12, 2) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "distritos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"shopify_customer_id" text,
	"whatsapp_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_shopify_customer_id_unique" UNIQUE("shopify_customer_id"),
	CONSTRAINT "clientes_whatsapp_id_unique" UNIQUE("whatsapp_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consultas_produccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"estado" "estado_consulta" DEFAULT 'abierta' NOT NULL,
	"respuesta" text,
	"ajuste_precio" numeric(12, 2),
	"creada_por" uuid NOT NULL,
	"resuelta_por" uuid,
	"resuelta_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_consumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_item_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad_receta" numeric(12, 3) NOT NULL,
	"cantidad_usada" numeric(12, 3) NOT NULL,
	"confirmado_por" uuid NOT NULL,
	"confirmado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_historial_estado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"estado_anterior" "estado_pedido",
	"estado_nuevo" "estado_pedido" NOT NULL,
	"usuario_id" uuid,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_item_cambios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_item_id" uuid NOT NULL,
	"regla_id" uuid,
	"descripcion" text NOT NULL,
	"ajuste" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_item_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_item_id" uuid NOT NULL,
	"extra_id" uuid NOT NULL,
	"precio" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedido_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"producto_talla_id" uuid NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"flor_id" uuid NOT NULL,
	"papel_id" uuid,
	"precio_unitario" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"canal" "canal" NOT NULL,
	"cliente_id" uuid NOT NULL,
	"estado" "estado_pedido" DEFAULT 'pendiente' NOT NULL,
	"fecha_entrega" date NOT NULL,
	"hora_entrega" time NOT NULL,
	"distrito_id" uuid NOT NULL,
	"direccion" text NOT NULL,
	"referencia" text,
	"telefono_receptor" text NOT NULL,
	"nombre_receptor" text NOT NULL,
	"dedicatoria" text,
	"vehiculo" "vehiculo" NOT NULL,
	"subtotal_productos" numeric(12, 2) NOT NULL,
	"costo_envio" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"total_pagado" numeric(12, 2) DEFAULT '0' NOT NULL,
	"encargada_id" uuid,
	"repartidor_id" uuid,
	"shopify_order_id" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_numero_unique" UNIQUE("numero"),
	CONSTRAINT "pedidos_shopify_order_id_unique" UNIQUE("shopify_order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"tipo" "tipo_pago" NOT NULL,
	"metodo" "metodo_pago" NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"estado" "estado_pago" DEFAULT 'pendiente' NOT NULL,
	"link_url" text,
	"referencia_externa" text,
	"pagado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orden_compra_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_compra_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"paquetes" numeric(12, 3) NOT NULL,
	"unidades_por_paquete" numeric(12, 3) NOT NULL,
	"cantidad_base" numeric(12, 3) GENERATED ALWAYS AS (paquetes * unidades_por_paquete) STORED,
	"costo_total" numeric(12, 2) NOT NULL,
	"costo_unitario" numeric(12, 4) NOT NULL,
	"cantidad_recibida" numeric(12, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ordenes_compra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" serial NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"estado" "estado_oc" DEFAULT 'borrador' NOT NULL,
	"fecha" date NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_compra_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"ruc" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integraciones_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fuente" "fuente_integracion" NOT NULL,
	"topic" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"procesado" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kardex_movimientos" ADD CONSTRAINT "kardex_movimientos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kardex_movimientos" ADD CONSTRAINT "kardex_movimientos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extras" ADD CONSTRAINT "extras_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_flores_permitidas" ADD CONSTRAINT "producto_flores_permitidas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_flores_permitidas" ADD CONSTRAINT "producto_flores_permitidas_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_tallas" ADD CONSTRAINT "producto_tallas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_flor_principal_id_insumos_id_fk" FOREIGN KEY ("flor_principal_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_papel_default_id_insumos_id_fk" FOREIGN KEY ("papel_default_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receta_lineas" ADD CONSTRAINT "receta_lineas_producto_talla_id_producto_tallas_id_fk" FOREIGN KEY ("producto_talla_id") REFERENCES "public"."producto_tallas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "receta_lineas" ADD CONSTRAINT "receta_lineas_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_cambio" ADD CONSTRAINT "reglas_cambio_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_cambio" ADD CONSTRAINT "reglas_cambio_insumo_origen_id_insumos_id_fk" FOREIGN KEY ("insumo_origen_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reglas_cambio" ADD CONSTRAINT "reglas_cambio_insumo_destino_id_insumos_id_fk" FOREIGN KEY ("insumo_destino_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultas_produccion" ADD CONSTRAINT "consultas_produccion_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultas_produccion" ADD CONSTRAINT "consultas_produccion_creada_por_usuarios_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultas_produccion" ADD CONSTRAINT "consultas_produccion_resuelta_por_usuarios_id_fk" FOREIGN KEY ("resuelta_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_consumos" ADD CONSTRAINT "pedido_consumos_pedido_item_id_pedido_items_id_fk" FOREIGN KEY ("pedido_item_id") REFERENCES "public"."pedido_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_consumos" ADD CONSTRAINT "pedido_consumos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_consumos" ADD CONSTRAINT "pedido_consumos_confirmado_por_usuarios_id_fk" FOREIGN KEY ("confirmado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_historial_estado" ADD CONSTRAINT "pedido_historial_estado_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_historial_estado" ADD CONSTRAINT "pedido_historial_estado_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_item_cambios" ADD CONSTRAINT "pedido_item_cambios_pedido_item_id_pedido_items_id_fk" FOREIGN KEY ("pedido_item_id") REFERENCES "public"."pedido_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_item_cambios" ADD CONSTRAINT "pedido_item_cambios_regla_id_reglas_cambio_id_fk" FOREIGN KEY ("regla_id") REFERENCES "public"."reglas_cambio"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_item_extras" ADD CONSTRAINT "pedido_item_extras_pedido_item_id_pedido_items_id_fk" FOREIGN KEY ("pedido_item_id") REFERENCES "public"."pedido_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_item_extras" ADD CONSTRAINT "pedido_item_extras_extra_id_extras_id_fk" FOREIGN KEY ("extra_id") REFERENCES "public"."extras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_producto_talla_id_producto_tallas_id_fk" FOREIGN KEY ("producto_talla_id") REFERENCES "public"."producto_tallas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_flor_id_insumos_id_fk" FOREIGN KEY ("flor_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_papel_id_insumos_id_fk" FOREIGN KEY ("papel_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_distrito_id_distritos_id_fk" FOREIGN KEY ("distrito_id") REFERENCES "public"."distritos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_encargada_id_usuarios_id_fk" FOREIGN KEY ("encargada_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_repartidor_id_usuarios_id_fk" FOREIGN KEY ("repartidor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orden_compra_lineas" ADD CONSTRAINT "orden_compra_lineas_orden_compra_id_ordenes_compra_id_fk" FOREIGN KEY ("orden_compra_id") REFERENCES "public"."ordenes_compra"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orden_compra_lineas" ADD CONSTRAINT "orden_compra_lineas_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kardex_insumo_fecha_idx" ON "kardex_movimientos" USING btree ("insumo_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "producto_tallas_producto_talla_idx" ON "producto_tallas" USING btree ("producto_id","talla");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "receta_lineas_talla_insumo_idx" ON "receta_lineas" USING btree ("producto_talla_id","insumo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_fecha_hora_idx" ON "pedidos" USING btree ("fecha_entrega","hora_entrega");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pedidos_estado_idx" ON "pedidos" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integraciones_log_idempotencia_idx" ON "integraciones_log" USING btree ("fuente","topic","external_id");