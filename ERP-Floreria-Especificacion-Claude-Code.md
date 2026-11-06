# ERP Florería — Especificación para Claude Code

> Pega este documento completo en Claude Code (o guárdalo como `SPEC.md` en la raíz del repo y dile: "Lee SPEC.md y construye el proyecto por fases. Antes de cada fase muéstrame el plan y espera mi OK").

---

## 0. Instrucciones para Claude

- Construye el sistema **por fases** (sección 10). Al terminar cada fase: corre lint, tests y migraciones, y resume qué hiciste.
- **Nunca** uses `drizzle-kit push` contra producción. Todo cambio de esquema va por `drizzle-kit generate` → revisar el SQL → `drizzle-kit migrate`.
- Todo cálculo de negocio (precio, vehículo, stock, merma, costo) vive en el **backend**, en servicios puros y testeados. El frontend solo muestra lo que devuelve la API.
- Montos en `numeric(12,2)`, cantidades de insumo en `numeric(12,3)`. Nunca `float`.
- Zona horaria del negocio: `America/Lima`. Moneda: `PEN` (S/).
- Si algo de esta especificación es ambiguo, pregunta antes de inventar.

---

## 1. Contexto del negocio

Florería en Lima. Hoy el pedido se reescribe varias veces (WhatsApp → formulario de Google → Excel → comanda impresa). El ERP pone el pedido en el centro: **se escribe una sola vez** y de ahí salen el precio, la comanda, el consumo de inventario y el envío.

Canales de entrada: **Shopify** (web), **chatbot de WhatsApp** y **vendedora** (solo casos especiales).

Flujo en 7 partes:

1. **Entrada del pedido** — web, chatbot o vendedora.
2. **Validación de cambios y stock** — solo se ofrecen cambios aprobados (flor, color, papel, tamaño) y solo si hay insumos para la receta.
3. **Envío y cotización** — el ERP elige moto o carro según el tamaño y aplica la tarifa del distrito.
4. **Datos de entrega, pago y comanda digital** — adelanto, saldo, comanda con receta, cambios y dedicatoria.
5. **Producción** — la encargada arma el pedido y confirma lo que usó; la diferencia con la receta es **merma** (ej. receta 50 tallos, usó 53 → merma 3).
6. **Inventario y compras** — Kardex en unidad base, alerta de stock mínimo, compras sugeridas.
7. **Despacho, entrega y reportes** — link del saldo antes del despacho, estados visibles, reportes de margen y merma.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`) |
| Frontend | **Angular 19+** standalone components, signals, Angular Router, reactive forms |
| UI | Angular CDK + Tailwind CSS (tokens en sección 9) |
| Backend | **NestJS 10+** (TypeScript) |
| ORM | **Drizzle ORM** + `drizzle-kit` para migraciones |
| Base de datos | **PostgreSQL en Neon** (driver `@neondatabase/serverless` o `postgres` con pooling) |
| Validación | `zod` + `drizzle-zod`; los esquemas se comparten en `packages/shared` |
| Auth | JWT (access + refresh) con guard de roles |
| Tests | Vitest/Jest en servicios de negocio; Playwright para flujos e2e clave |
| Integraciones | Shopify Admin API (GraphQL) + webhooks; WhatsApp Business API (fase posterior) |

Drizzle es un ORM de Node, así que Angular nunca toca la base de datos: **Angular → API NestJS → Drizzle → Neon**.

### Estructura

```
erp-floreria/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ db/
│  │  │  │  ├─ schema/        # un archivo por dominio
│  │  │  │  ├─ client.ts
│  │  │  │  └─ seed.ts
│  │  │  ├─ modules/          # pedidos, produccion, inventario, compras, catalogo, envios, pagos, reportes, auth, integraciones
│  │  │  └─ main.ts
│  │  ├─ drizzle/             # migraciones SQL generadas (se versionan en git)
│  │  └─ drizzle.config.ts
│  └─ web/                    # Angular
└─ packages/shared/           # tipos, enums, esquemas zod, helpers de dinero
```

### Variables de entorno (`apps/api/.env`)

```
DATABASE_URL=postgres://...neon.tech/erp?sslmode=require      # pooled
DATABASE_URL_UNPOOLED=postgres://...neon.tech/erp?sslmode=require  # para migraciones
JWT_SECRET=
JWT_REFRESH_SECRET=
SHOPIFY_STORE_DOMAIN=
SHOPIFY_ADMIN_TOKEN=
SHOPIFY_WEBHOOK_SECRET=
TZ=America/Lima
```

### Migraciones

```jsonc
// apps/api/package.json
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:studio":   "drizzle-kit studio",
"db:seed":     "tsx src/db/seed.ts"
```

- `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED`, `schema: './src/db/schema/*'`, `out: './drizzle'`, `dialect: 'postgresql'`.
- Usa una **rama de Neon** por entorno (`dev`, `preview`, `main`). Prueba las migraciones en `dev` antes de `main`.
- Cada migración debe ser reversible a mano: si una migración borra o renombra columnas, documéntalo en el PR.

---

## 3. Roles y permisos

| Rol | Puede |
|---|---|
| `admin` | Todo, incluida la configuración |
| `vendedora` | Crear pedidos, ver pedidos y pagos, enviar links de saldo |
| `produccion` | Tablero de producción, asignar encargada, confirmar consumo, responder consultas, ver recetas |
| `almacen` | Inventario, Kardex, compras, recepción, ajustes de stock, ver recetas |
| `delivery` | Ver pedidos listos y en camino, despachar, marcar entregado |

Implementa un `@Roles()` decorator + `RolesGuard` en NestJS y un `roleGuard` en el router de Angular. El menú lateral se filtra por rol.

---

## 4. Modelo de datos (Drizzle)

Convenciones: `id uuid default gen_random_uuid()`, `created_at` y `updated_at timestamptz default now()`, nombres en `snake_case`, borrado lógico con `activo boolean` en catálogos.

### 4.1 Enums

```ts
rol_usuario:      admin | vendedora | produccion | almacen | delivery
unidad_base:      tallo | g | hoja | m | und
talla:            S | M | L
canal:            shopify | whatsapp | vendedora
estado_pedido:    pendiente | en_armado | listo | en_camino | entregado | cancelado
vehiculo:         moto | carro
tipo_movimiento:  apertura | compra | consumo | merma | ajuste_positivo | ajuste_negativo | devolucion
tipo_cambio:      flor | papel | color | tamano | extra | otro
estado_regla:     aprobado | consultar
estado_consulta:  abierta | aprobada | rechazada
tipo_pago:        adelanto | saldo
metodo_pago:      shopify | link | yape | plin | transferencia | efectivo
estado_pago:      pendiente | pagado | fallido | anulado
estado_oc:        borrador | enviada | recibida_parcial | recibida | anulada
```

### 4.2 Tablas

**usuarios**: `id, nombre, email (unique), password_hash, rol, activo`

**insumos**
- `id, codigo (unique, ej. ROS-ROJ), nombre, categoria (flor|follaje|papel|accesorio|relleno|peluche), unidad_base`
- `stock_minimo numeric(12,3)`
- `stock_actual numeric(12,3) default 0` → caché; solo lo actualiza `KardexService` dentro de la misma transacción del movimiento
- `costo_promedio numeric(12,4)` → promedio ponderado, se recalcula en cada compra
- `es_flor boolean` (puede ser flor principal o de cambio), `activo`

**kardex_movimientos** (solo se insertan filas, nunca se editan)
- `id, insumo_id → insumos, fecha timestamptz, tipo tipo_movimiento`
- `entrada numeric(12,3) default 0, salida numeric(12,3) default 0`
- `costo_unitario numeric(12,4)`, `saldo_resultante numeric(12,3)`
- `referencia_tipo text (pedido|orden_compra|ajuste|apertura)`, `referencia_id uuid`, `nota text`, `usuario_id`
- Índice `(insumo_id, fecha)`
- CHECK: `entrada >= 0 AND salida >= 0 AND (entrada = 0 OR salida = 0)`

**productos**: `id, nombre, slug (unique), descripcion, flor_principal_id → insumos, usa_papel boolean, papel_default_id → insumos, imagen_url, shopify_product_id (unique null), activo`

**producto_tallas**: `id, producto_id, talla, precio_base numeric(12,2), shopify_variant_id (unique null), activo` · unique `(producto_id, talla)`

**receta_lineas**
- `id, producto_talla_id, insumo_id, cantidad numeric(12,3)`
- `rol text (flor_principal | papel | otro)` → para saber qué línea reemplazar cuando hay un cambio de flor o de papel
- unique `(producto_talla_id, insumo_id)`

**producto_flores_permitidas**: `producto_id, insumo_id` (PK compuesta) → flores que se aceptan como cambio

**reglas_cambio**
- `id, tipo tipo_cambio, producto_id (null = todos), insumo_origen_id null, insumo_destino_id null, descripcion`
- `ajuste_modo text (fijo | por_unidad)`, `ajuste_monto numeric(12,2)` (puede ser negativo)
- `estado estado_regla`, `activo`

**extras**: `id, nombre, insumo_id → insumos, precio numeric(12,2), fuerza_carro boolean, activo`

**distritos**: `id, nombre (unique), tarifa_moto numeric(12,2), tarifa_carro numeric(12,2), activo`

**costos_vehiculo**: `vehiculo (PK), costo_por_viaje numeric(12,2)`

**clientes**: `id, nombre, telefono, email, shopify_customer_id (unique null), whatsapp_id (unique null)`

**pedidos**
- `id, numero serial unique (visible: #1041)`, `canal, cliente_id`
- `estado estado_pedido default 'pendiente'`
- `fecha_entrega date, hora_entrega time, distrito_id, direccion, referencia, telefono_receptor, nombre_receptor, dedicatoria`
- `vehiculo` (calculado), `subtotal_productos numeric(12,2), costo_envio numeric(12,2), total numeric(12,2)`
- `total_pagado numeric(12,2) default 0` (caché de pagos con estado `pagado`)
- `encargada_id → usuarios null, repartidor_id → usuarios null`
- `shopify_order_id (unique null), creado_por → usuarios null`
- Índices: `(fecha_entrega, hora_entrega)`, `(estado)`

**pedido_items**: `id, pedido_id, producto_talla_id, cantidad int default 1, flor_id → insumos, papel_id → insumos null, precio_unitario numeric(12,2), subtotal numeric(12,2)`

**pedido_item_extras**: `id, pedido_item_id, extra_id, precio numeric(12,2)`

**pedido_item_cambios** (foto de los ajustes al momento de vender): `id, pedido_item_id, regla_id null, descripcion, ajuste numeric(12,2)`

**pedido_consumos** (lo que confirma Producción)
- `id, pedido_item_id, insumo_id, cantidad_receta numeric(12,3), cantidad_usada numeric(12,3), confirmado_por, confirmado_at`
- merma = `max(0, cantidad_usada - cantidad_receta)`

**consultas_produccion**: `id, pedido_id, descripcion, estado estado_consulta default 'abierta', respuesta, ajuste_precio numeric(12,2) null, creada_por, resuelta_por, resuelta_at`

**pagos**: `id, pedido_id, tipo tipo_pago, metodo metodo_pago, monto numeric(12,2), estado estado_pago, link_url, referencia_externa, pagado_at`

**pedido_historial_estado**: `id, pedido_id, estado_anterior, estado_nuevo, usuario_id, nota, created_at`

**proveedores**: `id, nombre, ruc, telefono, activo`

**ordenes_compra**: `id, numero serial, proveedor_id, estado estado_oc, fecha, total numeric(12,2), nota`

**orden_compra_lineas**
- `id, orden_compra_id, insumo_id`
- `paquetes numeric(12,3), unidades_por_paquete numeric(12,3)`, `cantidad_base` = paquetes × unidades (columna generada o calculada en el servicio)
- `costo_total numeric(12,2)`, `costo_unitario numeric(12,4)` = costo_total / cantidad_base
- `cantidad_recibida numeric(12,3) default 0`

**integraciones_log**: `id, fuente (shopify|whatsapp), topic, external_id, payload jsonb, procesado boolean, error text, created_at` · unique `(fuente, topic, external_id)` para que los webhooks sean idempotentes

---

## 5. Reglas de negocio (servicios en `apps/api`)

Implementa cada regla como función pura en `packages/shared` o en un servicio de dominio, con tests unitarios.

### 5.1 Receta efectiva de un ítem
1. Toma las `receta_lineas` de la talla.
2. Reemplaza la línea con `rol = flor_principal` por `item.flor_id` (si es distinta).
3. Si `producto.usa_papel`, reemplaza la línea con `rol = papel` por `item.papel_id`.
4. Agrega 1 unidad del insumo de cada extra.
5. Multiplica todo por `item.cantidad`.

### 5.2 Precio
```
precio_unitario = precio_base(talla)
                + Σ ajustes de reglas aplicadas (fijo, o por_unidad × cantidad de flor principal)
                + Σ precio de extras
subtotal = precio_unitario × cantidad
```
El precio es el mismo para web, chatbot y vendedora. Al guardar el pedido, los ajustes se copian a `pedido_item_cambios`, así un cambio de precio futuro no altera pedidos viejos.

### 5.3 Disponibilidad (antes de vender)
```
reservado(insumo) = Σ receta efectiva de ítems en pedidos con estado pendiente | en_armado
disponible(insumo) = stock_actual - reservado
```
Una opción (talla, flor, papel o extra) **solo se ofrece** si la receta efectiva resultante cabe en `disponible`. El endpoint de cotización devuelve cada opción con `disponible: boolean` y `motivo`.

### 5.4 Cambios no listados
Si el cliente pide algo que no está en `reglas_cambio` (o una regla con estado `consultar`), se crea una fila en `consultas_produccion`. El pedido no puede pasar a `en_armado` mientras tenga una consulta `abierta`.

### 5.5 Vehículo y envío
- `carro` si algún ítem es talla `L`, si la receta efectiva incluye un insumo de caja, o si algún extra tiene `fuerza_carro`. Si no, `moto`.
- `costo_envio = distritos.tarifa_{vehiculo}`.
- `total = subtotal_productos + costo_envio`.

### 5.6 Estados del pedido
```
pendiente → en_armado → listo → en_camino → entregado
cualquiera (menos entregado) → cancelado
```
- `pendiente → en_armado`: requiere `encargada_id` y ninguna consulta abierta.
- `en_armado → listo`: requiere confirmar consumo (5.7).
- `listo → en_camino`: si hay saldo, primero se genera y envía el link de pago del saldo.
- `en_camino → entregado`: registra hora. Si aún hay saldo, se muestra una advertencia pero se permite (lo decide el admin con un flag de configuración).
- Cada transición inserta una fila en `pedido_historial_estado` y dispara una notificación al cliente (cola o stub en fase 1).
- `cancelado` desde `listo` o `en_camino`: los insumos ya consumidos no vuelven al stock (se registran como merma con nota "pedido cancelado").

### 5.7 Confirmar consumo (una sola transacción)
Para cada línea de la receta efectiva, la encargada ingresa `cantidad_usada` (por defecto igual a la receta).
1. Inserta `pedido_consumos`.
2. Kardex: `consumo` con `salida = min(usada, receta)`.
3. Si `usada > receta`: Kardex `merma` con `salida = usada - receta` y nota "usó X de Y".
4. Si `usada < receta`: registra solo lo usado (sin merma).
5. Actualiza `insumos.stock_actual` y `saldo_resultante`.
6. Cambia el pedido a `listo`.
Usa `SELECT ... FOR UPDATE` en los insumos afectados para evitar carreras.

### 5.8 Kardex y costo promedio
- Saldo de apertura: el conteo inicial del almacén se carga como movimiento `apertura`.
- En cada `compra`:
  `nuevo_costo_promedio = (stock × costo_prom + cantidad × costo_unit) / (stock + cantidad)`
- Los consumos y mermas se valorizan al `costo_promedio` vigente.
- Ajustes manuales (`ajuste_positivo` / `ajuste_negativo`) requieren rol `almacen` o `admin` y una nota obligatoria.

### 5.9 Compras sugeridas
```
sugerido(insumo) = max(0, ceil(stock_minimo + reservado + demanda_proximos_N_dias - stock_actual))
```
`demanda_proximos_N_dias` = receta efectiva de pedidos con `fecha_entrega` dentro de N días (N configurable, por defecto 3). Desde la lista sugerida se puede generar una orden de compra en borrador.

### 5.10 Recepción de compra
Se registra en unidad base: `paquetes × unidades_por_paquete`. Permite recepción parcial. Cada recepción inserta un movimiento `compra` y recalcula el costo promedio.

### 5.11 Pagos
- Adelanto configurable (50 % o 100 %) al crear el pedido.
- `saldo = total - total_pagado`.
- El link del saldo se genera con Shopify (Draft Order / checkout) o con la pasarela que se defina; se guarda en `pagos.link_url` con estado `pendiente`.
- Un webhook o un registro manual marca el pago como `pagado` y actualiza `pedidos.total_pagado`.

---

## 6. API (NestJS, REST, prefijo `/api`)

```
POST   /auth/login · POST /auth/refresh · GET /auth/me

# Catálogo
GET/POST/PATCH/DELETE  /productos
GET/PUT                /productos/:id/tallas/:talla/receta      # reemplaza todas las líneas
POST                   /productos/:id/tallas/:talla/copiar-receta   { a: ['S','L'] }
GET/PUT                /productos/:id/flores-permitidas
GET/POST/PATCH/DELETE  /reglas-cambio
GET/POST/PATCH/DELETE  /extras
GET/POST/PATCH/DELETE  /distritos
GET/PUT                /costos-vehiculo

# Pedidos
POST   /cotizaciones          # input del pedido → precio, ajustes, vehículo, envío, total y opciones con disponibilidad
POST   /pedidos               # recalcula todo en el servidor; nunca confía en el precio del cliente
GET    /pedidos?fecha=&estado=&canal=&q=
GET    /pedidos/:id
POST   /pedidos/:id/transicion   { a: 'en_armado' | ..., nota? }
PATCH  /pedidos/:id/asignar      { encargada_id?, repartidor_id? }
POST   /pedidos/:id/consumo      { lineas: [{ insumo_id, cantidad_usada }] }
GET    /pedidos/:id/historial

# Consultas
GET    /consultas?estado=abierta
POST   /consultas/:id/resolver   { estado: 'aprobada'|'rechazada', respuesta, ajuste_precio? }

# Pagos
GET    /pedidos/:id/pagos
POST   /pedidos/:id/pagos              # registro manual
POST   /pedidos/:id/pagos/link-saldo   # genera y envía link

# Inventario
GET    /insumos · POST · PATCH
GET    /insumos/:id/kardex?desde=&hasta=
POST   /inventario/ajustes          { insumo_id, tipo, cantidad, nota }
POST   /inventario/apertura         # carga masiva CSV del conteo inicial (solo una vez)
GET    /inventario/disponibilidad

# Compras
GET    /compras/sugeridas?dias=3
GET/POST/PATCH /ordenes-compra
POST   /ordenes-compra/:id/recepcion   { lineas: [{ linea_id, paquetes, unidades_por_paquete, costo_total }] }

# Reportes
GET /reportes/margen?desde=&hasta=      # precio vs costo real (consumo + merma) por producto y talla
GET /reportes/merma?desde=&hasta=       # cantidad y valor por insumo
GET /reportes/mas-vendidos?desde=&hasta=
GET /reportes/envios?desde=&hasta=      # cobrado vs costo por viaje
GET /dashboard/hoy                      # KPIs, conteo por estado, alertas de stock, consultas abiertas

# Integraciones
POST /webhooks/shopify/:topic           # verifica HMAC; idempotente vía integraciones_log
```

Valida todos los cuerpos con zod. Errores con formato `{ code, message, details }`. Paginación por cursor en los listados.

---

## 7. Integración con Shopify

- **Mapeo**: `productos.shopify_product_id` y `producto_tallas.shopify_variant_id`. Pantalla de configuración para vincular productos de Shopify con recetas.
- **Webhooks entrantes**: `orders/create`, `orders/paid`, `orders/cancelled`. Verificar `X-Shopify-Hmac-Sha256`. Guardar el payload en `integraciones_log` y procesarlo; si falla, queda con `error` y se puede reintentar desde la UI.
- **Datos del pedido**: dedicatoria, fecha y hora de entrega vienen como *line item properties* o *note attributes* del checkout (definir los nombres exactos con el tema de Shopify).
- **Stock saliente**: un job cada X minutos (y después de cada consumo o compra) calcula cuántas unidades de cada variante se pueden armar con el stock disponible y actualiza `inventoryLevel` en Shopify.
- **Estados salientes**: `en_camino` → crear fulfillment; `entregado` → marcarlo como entregado.

WhatsApp (fase 6): el chatbot llama a `POST /cotizaciones` y `POST /pedidos` con `canal = whatsapp`.

---

## 8. Pantallas (Angular)

Usa el prototipo del ERP como referencia visual y de flujo. Rutas:

| Ruta | Pantalla | Roles |
|---|---|---|
| `/mapa` | Mapa del flujo (las 7 partes con acceso a cada módulo) | todos |
| `/hoy` | Dashboard: KPIs, pipeline por estado (filtrable), pedidos por hora de entrega, consultas, stock bajo | admin, vendedora, produccion |
| `/pedidos/nuevo` | Cotizador: canal, producto, talla, flor, papel, extras (opciones sin stock deshabilitadas), cambio no listado, datos de entrega, adelanto. Resumen fijo con precio desglosado | admin, vendedora |
| `/pedidos/:id` | Detalle + historial + pagos | admin, vendedora |
| `/produccion` | Tablero: Pendiente / En armado / Listo, ordenado por hora; panel de comanda con dedicatoria, consulta, encargada y tabla receta vs. usado con merma en vivo | admin, produccion |
| `/delivery` | Tarjetas de despacho: destino, vehículo, saldo; botones "Enviar link y despachar" y "Marcar entregado" | admin, delivery, vendedora |
| `/pagos` | Tabla de pagos y saldos por pedido; enviar link o registrar pago | admin, vendedora |
| `/inventario` | Tabla de insumos (stock, mínimo, costo, valor) + panel Kardex con saldo acumulado | admin, almacen |
| `/compras` | Lista sugerida + recepción de compra en unidad base | admin, almacen |
| `/config/recetas` | CRUD de producto y talla, receta editable, flores permitidas, copiar receta entre tallas, margen | admin (produccion y almacen: solo lectura) |
| `/config/reglas` | CRUD de reglas de cambio | admin |
| `/config/tarifario` | CRUD de distritos, tarifas por vehículo y costo por viaje | admin |
| `/reportes` | Margen, merma, más vendidos, envío cobrado vs. costo | admin |
| `/config/integraciones` | Estado de Shopify, mapeo de productos, log de webhooks con reintento | admin |

Para ver cambios de estado en tiempo real, usa polling cada 15 s en `/hoy`, `/produccion` y `/delivery` (fase 1) o SSE (fase posterior).

---

## 9. Diseño (tokens para Tailwind)

```
Fuente: Roboto (400, 500, 700) para todo
bg            #fffdf3   fondo general (blanco amarillento)
surface       #ffffff   tarjetas
sidebar       #fff6d1   menú lateral
sidebar-act   #fbe9a0   ítem activo
text          #22201a
muted         #6e6a58
line          #efe9cf
accent        #e9b824   botón primario (texto #22201a)
accent-soft   #fff3c4   selección
accent-2      #b7791f   alertas / merma
radius        6px
Densidad compacta: texto base 13px, padding de celda 8px 12px

Estados:
pendiente  bg #ece7dd  fg #5d5848
en_armado  bg #f6e2d5  fg #8f4a2a
listo      bg #dfeadb  fg #2f5a35
en_camino  bg #dde7f3  fg #2c5585
entregado  bg #ecebe6  fg #8a877c
```

---

## 10. Fases de construcción

**Fase 1 — Base**
Monorepo, NestJS + Angular, conexión a Neon, `drizzle.config.ts`, esquema completo de la sección 4, primera migración, auth con roles, layout con menú filtrado por rol.
✔ `pnpm db:migrate` crea todas las tablas en una rama nueva de Neon. Login funcional con los 5 roles.

**Fase 2 — Catálogo y configuración**
Insumos, productos, tallas, recetas, flores permitidas, reglas, extras, distritos, costos por vehículo. Seed con datos de ejemplo (sección 11). Carga del saldo de apertura por CSV.
✔ Se puede crear un producto nuevo con receta S/M/L desde la UI y ver su costo y margen.

**Fase 3 — Pedidos y cotizador**
Servicios 5.1–5.5 con tests, `POST /cotizaciones`, `POST /pedidos`, pantalla Nuevo pedido, dashboard Hoy, consultas a Producción.
✔ Test: Ramo Clásico L con rosa roja → carro. Opción deshabilitada cuando el disponible no alcanza. El precio del servidor coincide con el de la UI.

**Fase 4 — Producción, Kardex y merma**
Transiciones (5.6), confirmación de consumo (5.7) transaccional, Kardex (5.8), pantallas Producción e Inventario.
✔ Test: receta 50, usado 53 → consumo 50 + merma 3, `stock_actual` baja en 53 y el Kardex muestra el saldo correcto.

**Fase 5 — Delivery, pagos, compras y reportes**
Links de saldo (stub si aún no hay pasarela), Delivery, Pagos, compras sugeridas, órdenes de compra, recepción, reportes.
✔ No se puede despachar con saldo sin antes generar el link. La recepción de 2 paquetes × 50 hojas suma 100 hojas y recalcula el costo promedio.

**Fase 6 — Integraciones**
Webhooks de Shopify, sincronización de stock por variante, fulfillments, mapeo de productos, log con reintento. API para el chatbot de WhatsApp.
✔ Un pedido de prueba en Shopify aparece en `/hoy` con canal Shopify y el webhook duplicado no crea un segundo pedido.

---

## 11. Datos semilla

**Insumos** (código, nombre, unidad, mínimo, costo, apertura)
```
ROS-ROJ  Rosa roja              tallo  200   1.80   480
ROS-BLA  Rosa blanca            tallo  150   2.00    30
ROS-ROS  Rosa rosada            tallo  150   1.90   260
GIR-AMA  Girasol                tallo   40   3.50    58
LIR-BLA  Lirio blanco           tallo   40   4.20    44
EUC-VER  Eucalipto              g     1500   0.03  3200
GYP-BLA  Gypsophila             g     1000   0.05   900
PAP-KRA  Papel coreano kraft    hoja   200   0.90   340
PAP-NEG  Papel coreano negro    hoja   150   1.10    60
PAP-CEL  Celofán transparente   m       50   0.60    80
CIN-SAT  Cinta satín            m       60   0.50   120
REL-MUS  Relleno musgo          g     2000   0.02  5000
PEL-OSS  Peluche oso talla S    und      6  18.00     8
PEL-OSM  Peluche oso talla M    und      5  30.00     0
CAJ-RED  Caja redonda           und     10  12.00    22
TAR-DED  Tarjeta dedicatoria    und    100   0.40   300
```

**Productos** (precio S/M/L · flores S/M/L)
```
Ramo Clásico de Rosas  89/149/289 · 12/24/50 · flor ROS-ROJ · permite ROS-BLA (+0.50/tallo), ROS-ROS (+0)
Ramo Sol               79/129/219 ·  6/12/24 · flor GIR-AMA
Box de Lirios         139/199/269 ·  5/9/14  · flor LIR-BLA · sin papel, con caja
```
Receta base por talla S/M/L: eucalipto 60/120/220 g, gypsophila 20/40/80 g (excepto Ramo Sol), papel 4/6/10 hojas, cinta 1/1.5/2 m, tarjeta 1. Box de Lirios: caja 1 + musgo 150/250/400 g en lugar de papel y cinta.

**Reglas**: papel kraft → negro +5.00 · kraft → celofán −3.00 · peluche S +35 · peluche M +55 · caja +25 (fuerza carro) · rosas → girasol en Ramo Clásico = consultar.

**Distritos** (moto/carro): Miraflores 12/20 · San Isidro 12/20 · Lince 12/20 · Jesús María 13/21 · San Borja 14/22 · Barranco 15/24 · Surco 15/25 · La Molina 20/32.
**Costo por viaje**: moto 10 · carro 19.

**Usuarios**: un usuario por rol (contraseñas solo para desarrollo).

---

## 12. Antes de producción (checklist del negocio)

- Ordenar, rotular y contar el almacén.
- Asignar código y unidad base a cada insumo.
- Escribir la receta de cada producto por tamaño.
- Definir con Producción qué cambios están permitidos y cuánto suma o resta cada uno.
- Cargar el tarifario por distrito y vehículo.
- Cargar el conteo inicial como saldo de apertura del Kardex.
