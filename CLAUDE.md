# CLAUDE.md — ERP Florería Mouregal

Contexto para Claude Code. La especificación funcional completa está en [`ERP-Floreria-Especificacion-Claude-Code.md`](ERP-Floreria-Especificacion-Claude-Code.md) (no existe `SPEC.md`). El manual de usuario está en [`docs/Manual-de-usuario-ERP-Mouregal.pdf`](docs/Manual-de-usuario-ERP-Mouregal.pdf). Todo el código, la UI y los mensajes están en **español**.

## Estado del proyecto

- **Fases 1–5 del spec: hechas.** Base, catálogo e inventario, cotizador y pedidos (varios ítems), producción con Kardex y merma, delivery, pagos, compras y reportes.
- **Fase 6 (Shopify + WhatsApp): pendiente.** Necesita credenciales de la tienda y los nombres de los campos del checkout (dedicatoria, fecha y hora de entrega). Las notificaciones al cliente hoy son un stub que solo escribe en el log (`apps/api/src/modules/notificaciones`).

## Stack y comandos

pnpm workspaces: `apps/api` (NestJS 10 + Drizzle + Postgres/Neon), `apps/web` (Angular 19 standalone + signals + Tailwind 3 + Chart.js), `packages/shared` (zod, enums, reglas de negocio puras).

```bash
pnpm install
pnpm demo              # build shared + API (:3000) + web (:4200) juntos
pnpm build:shared      # OBLIGATORIO antes de compilar api/web si tocaste packages/shared
pnpm db:migrate        # aplica migraciones (usa DATABASE_URL_UNPOOLED)
pnpm db:seed           # usuarios dev + catálogo de la sección 11 (idempotente)
pnpm --filter @erp/shared test   # vitest, reglas puras
pnpm --filter api test           # jest: unitarios + integración + e2e HTTP sobre PGlite (sin DB ni .env)
                                 # src/test/flujos.e2e.spec.ts: flujos completos por rol (venta→armado→despacho→cobro→entrega,
                                 # entrega con saldo, 409 sin stock, consulta con ajustePrecio, cancelación y merma, compras)
pnpm --filter api lint           # eslint --fix (también formatea con prettier)
cd apps/web && npx ng build      # verifica plantillas y tipos de la web
```

**Producción (Railway + Neon):** guía en [`docs/DESPLIEGUE-RAILWAY.md`](docs/DESPLIEGUE-RAILWAY.md).
- Un solo servicio: `railway.json` corre `pnpm run build:prod` y `pnpm run start:prod`.
  - `start:prod` aplica las migraciones con `dist/db/migrar.js` (drizzle-orm, sin drizzle-kit) y levanta el API.
  - Con `NODE_ENV=production`, el API sirve la web compilada (`apps/web/dist/web/browser`) y responde `index.html` a toda ruta que no sea `/api`.
- Salud: `GET /api/salud` (pública).
- Producción **no** usa `db:seed`.
  - Los usuarios se crean con `pnpm --filter api usuario:crear --email … --nombre "…" --rol …`. Sin `--password`, genera una contraseña y la muestra una vez.
  - El catálogo de ejemplo, opcional, se carga con `pnpm --filter api db:seed:produccion`.
- La lista de dependencias con scripts de instalación permitidos (`onlyBuiltDependencies`) está en `pnpm-workspace.yaml`. pnpm 10 ya no la lee desde `package.json`.

Usuarios dev (seed): `admin|vendedora|produccion|almacen|delivery@mouregal.pe`, contraseña `dev12345`.

`apps/api/.env` **no está en git** (tiene la URL de Neon). Copia `apps/api/.env.example` y pide los valores. Variables nuevas además de las del spec: `CORS_ORIGIN`, `TRUST_PROXY`, `PAGOS_LINK_BASE` (stub de links de pago), `PERMITIR_ENTREGA_CON_SALDO`.

## App instalable y modo sin conexión (PWA)

- La web es una **PWA**: `@angular/service-worker` (`ngsw-config.json`, solo en el build de producción) y `public/manifest.webmanifest`. Se instala desde Chrome/Edge en PC, laptop o tablet y abre sin internet.
- **Lectura sin conexión** (`core/offline/`):
  - `offline.interceptor.ts` guarda cada GET del API en IndexedDB (`mouregal-erp`, clave `<userId>|<url>`). Si un GET falla por red, responde con la última copia.
  - `esFallaDeRed()` cuenta como "sin red" los estados 0, 502, 503 y **504**: sin red, el service worker de Angular devuelve 504, no 0.
  - `ConexionService` muestra el aviso "Sin conexión" en el marco y prueba `/api/salud` cada 15 s. Al volver, el aviso se quita solo.
  - Sin red, la sesión **no** se cierra: se entra con el usuario guardado (`erp_usuario`) y el token se renueva al volver. Logout borra la copia de ese usuario.
- **Lo que no es GET falla** con "Sin conexión… necesita conexión". No hay cola de escrituras: crear pedidos, cobrar o cambiar estados necesita al servidor (stock compartido). Una cola para acciones seguras (consumo, entregado, cobro en efectivo) es el siguiente paso posible.
- Probar el modo sin conexión exige el build de producción (`ng build` + API con `NODE_ENV=production`); con `ng serve` el service worker está apagado.

## Base de datos y migraciones

- Migraciones en `apps/api/drizzle/`. Nunca `drizzle-kit push`: `pnpm db:generate` → revisar el SQL → `pnpm db:migrate`.
- `drizzle-kit generate` no se conecta, pero el config exige la variable: `DATABASE_URL_UNPOOLED=postgres://x@localhost/x npx drizzle-kit generate --name <nombre>`.
- `0000` — esquema completo (sección 4 del spec).
- `0001_insumo_caja_token_version` — agrega `insumos.es_caja` (reemplaza la detección por prefijo `CAJ`; la migración marca las cajas existentes con un UPDATE) y `usuarios.token_version` (revocación de sesiones al hacer logout). Solo agrega columnas.
- `0008_caja_clientes_cobrador` (2026-11-26, diseño Mouregal) — agrega `cajas`, `caja_movimientos`, `cliente_fechas`, `pagos.registrado_por` y un índice único parcial (una caja abierta por usuario, escrito a mano al final del SQL). Solo agrega.
- **Rama de desarrollo de Neon (estado al 2026-11-08):** tiene `0000` y `0001` aplicadas. Se vació (TRUNCATE de las tablas de la app, sin tocar `drizzle.__drizzle_migrations`) y se volvió a sembrar: 16 insumos que cuadran con su Kardex (solo apertura), 3 productos con receta S/M/L, 5 reglas, 3 extras, 8 distritos, 5 usuarios, **0 pedidos**. Antes tenía restos de una prueba vieja (consumos de un pedido borrado y un producto "Ramo de Prueba E2E"); ya no.

## Arquitectura y dónde vive cada regla

Todo cálculo de negocio está en el backend o en `packages/shared` como funciones puras con tests. El frontend solo muestra lo que devuelve la API.

| Regla (sección del spec) | Dónde |
|---|---|
| Receta efectiva, precio, vehículo, envío (5.1, 5.2, 5.5) | `packages/shared/src/pricing.ts` |
| Transiciones y permisos por rol, consumo/merma, repartos (5.6, 5.7) | `packages/shared/src/pedidos-reglas.ts` (`validarTransicion`, `desglosarConsumo`, `repartirUsado`, `faltantes`) |
| Costo promedio, compra sugerida, despacho y entrega con saldo (5.8–5.11) | `packages/shared/src/operacion-reglas.ts` |
| Resolver un ítem (reglas de cambio, flores permitidas, consultas, validaciones) | `apps/api/src/modules/pedidos/item-resolver.service.ts` — lo usan **el cotizador y la creación del pedido**, así el precio siempre coincide |
| Disponibilidad = stock − reservado (pendiente + en_armado) | `apps/api/src/modules/pedidos/disponibilidad.service.ts` |
| Único punto de escritura del stock (bloquea la fila del insumo, recalcula costo en compras) | `apps/api/src/modules/inventario/kardex.service.ts` |

**Velocidad con la base lejos:** desde Lima a Neon (us-east-2) cada consulta tarda ~110 ms, y dentro de una transacción se atienden **de a una** aunque se envíen en paralelo. Por eso:
- Fuera de transacciones, lo independiente va con `Promise.all` (cotizador, contexto del catálogo, recetas).
- Dentro de transacciones se reduce el **número** de consultas: `KardexService.registrarSalidas` bloquea, inserta y actualiza todos los insumos en 3 consultas.
- `DB_CONEXION_DIRECTA=true` usa `DATABASE_URL_UNPOOLED`: el pooler de Neon no reutiliza consultas preparadas (2 viajes por consulta en vez de 1). Recomendado en un servidor que corre siempre.
- Lo que más ayuda: **servidor y base en la misma región** (o Postgres en el mismo VPS).

**Concurrencia:**
- Transiciones, consumo, pagos y recepciones bloquean la fila con `SELECT … FOR UPDATE` dentro de la transacción.
- Crear un pedido toma `pg_advisory_xact_lock` y revalida el stock, para que dos ventas simultáneas no reserven lo mismo.
- `pedidos.total_pagado` es un caché que solo recalcula `PagosService`.

## Decisiones ya tomadas (no revertir sin consultar)

- **Permisos por transición** (`validarTransicion`):
  - `en_armado`: produccion y admin.
  - `en_camino`: delivery, vendedora y admin.
  - `entregado`: delivery y admin; en **recojo**, vendedora y admin (listo → entregado en el mostrador, sin en_camino ni foto).
  - `cancelado`: la vendedora solo antes de consumir (pendiente o en_armado); desde listo o en_camino solo el admin, porque lo consumido cuenta como merma.
- Producción **no** despacha: el botón solo aparece a quien la regla lo permite.
- **No se puede crear un pedido sin stock** (409 con el detalle de lo que falta).
- **Texto de "pedido especial"** (`cambioNoListado`): abre una consulta a Producción aunque no cambie flor ni papel.
- Una **consulta abierta** bloquea pasar a en_armado. Si se aprueba con `ajustePrecio`, ajusta el ítem, el total y el adelanto pendiente (que mantiene su porcentaje).
- **Flores permitidas sin regla** se aceptan sin recargo. Una regla específica del producto gana sobre la regla general.
- **Compras sugeridas:** demanda = consumo promedio diario de 28 días × N. No se usa la receta de pedidos con fecha en N días, porque esos ya están en "reservado" y se contarían dos veces. Se descuenta lo pendiente en órdenes abiertas.
- **Link de saldo:** anula los cobros pendientes anteriores y crea uno solo por todo lo que falta. "Despachar" lo genera si falta.
- **Pedido cancelado tras armarse:** su consumo aparece como "merma por cancelación" en el reporte, sin nuevo movimiento de Kardex (el Kardex es solo de inserción).
- **KPIs de `/hoy`:** comparan contra el mismo día de la semana pasada.
- **Reportes por fecha real del hecho** (2026-11-09), no por fecha de entrega programada:
  - Cobros: por `pagos.pagado_at`.
  - Margen: por el paso a `listo` en el historial.
  - Envíos: por el paso a `en_camino`.
  - Más vendidos: por `pedidos.created_at`.
  - Merma: por la fecha del movimiento de Kardex.
  - Un pedido para el 19 que se arma y despacha hoy cuenta hoy.
  - Resumen de ventas (`GET /reportes/ventas`): pedidos por `created_at` sin cancelados y cobros por `pagado_at`; compara con el período anterior de igual duración; serie por día hasta 62 días y por mes si es más largo.
- **PDF:** se genera con el diálogo de impresión del navegador ("Guardar como PDF"), no en el servidor. `shared/tabla/imprimir.ts` copia el documento a un iframe, convierte los `canvas` de Chart.js en imágenes y pone A4 horizontal, colores exactos y pie con marca y "Página X de Y". Membrete común en `shared/tabla/membrete.component.ts`.
  - Reportes → «Resumen de ventas»: documento de 2 páginas con gráficos (`pages/reportes/reporte-ventas.component.ts`). Botones «Descargar PDF» y «Excel».
  - Cualquier `Tabla` con `csv`: botón «PDF» junto a «Excel» que abre la vista previa con membrete. Las clases `print:` fijan el diseño impreso (los breakpoints de pantalla no aplican al ancho de la hoja).
  - Gráficos categóricos: paleta de marca validada para daltonismo en `reporte-ventas.component.ts` (orden fijo; más de 5 categorías se agrupan en «Otros»).
- **Excel con marca:** logo incrustado, membrete, cifras en tarjetas, cabecera morada, formatos S/ y %, fila de totales con `SUBTOTAL` (opciones `titulo`, `totales` y `formatos` de `Tabla`), listo para imprimir.
- **Exportar a Excel:** `.xlsx` real generado sin dependencias en `shared/tabla/excel.ts`. Cada `Tabla` con `csv` muestra el botón "Excel" junto a la paginación (exporta lo seleccionado o, si no hay selección, todo lo filtrado). Delivery, Producción y Compras sugeridas tienen su propio botón.
- **Venta en tienda** (2026-11-24, migración `0006_venta_mostrador`):
  - `pedidos.tipo_entrega`: `delivery` (por defecto) o `recojo`. En recojo no hay distrito, dirección, receptor ni vehículo, el envío es 0 y no aparece en Delivery ni en el reporte de envíos. El cliente puede ir vacío ("Cliente de mostrador").
  - En "Nuevo pedido", el canal En tienda propone **Recoge en tienda** y en el paso 3 marca **Se lo lleva ahora** (hoy, a esta hora) y **paga todo en efectivo**: no hay que escribir nada.
  - **pagos** al crear: lista de `{metodo, monto, referencia}` (`efectivo|yape|plin|tarjeta|transferencia`), se registran pagados, sin link. Un mismo cobro puede repartirse (10 en efectivo + 20 por Yape). Vacío: link pendiente por `montoAdelanto` (en soles, 127 de 250) o, si no llega, por `porcentajeAdelanto`. Nunca más que el total. `tarjeta` es método nuevo.
  - **Cobro manual** (`POST /pedidos/:id/pagos`): `metodo`+`monto` o `partes: [...]` (varios métodos en una transacción; la suma no pasa del saldo).
  - En la web, `shared/cobro` (`app-cobro`) es el bloque de cobro de Nuevo pedido, Pagos y "Cobrar y entregar": la primera línea se lleva lo que falta, "Dividir en otro método" agrega líneas, y en efectivo calcula el vuelto. En Nuevo pedido, "¿Cuánto paga ahora?" es Todo / La mitad / Otro monto (S/) / Nada ahora, no porcentaje.
  - **Personalizar un producto:** el color se cambia eligiendo otra flor ("Flor o color", con su regla de precio o flor permitida). Los extras del catálogo suman su precio y descuentan stock. Lo que no está en la lista va como **adicional** `{descripcion, precio, insumoId?, cantidad?}` del ítem: suma al precio, se guarda en `pedido_item_cambios` sin regla (migración `0007_adicional_insumo`: `insumo_id`, `cantidad`) y no abre consulta. Si es un **insumo del inventario** (la web lo reconoce al escribir su nombre: "3 Girasol" en un ramo de rosas), entra a la receta efectiva: **se reserva, se valida el stock (409) y se descuenta al confirmar consumo**. Sin insumo (texto libre) no toca stock. Si hace falta que Producción lo apruebe, se usa "¿Algo especial?" (consulta).
  - **Regla del usuario: el stock siempre al día.** Toda forma nueva de vender que use inventario debe pasar por `recetaEfectiva` / `DisponibilidadService.recetasDeItems`. Nuevo pedido vuelve a cotizar solo cada 20 s (`usarPolling`) para mostrar lo que vendieron otras vendedoras; crear el pedido revalida con lock.
  - **Descuento** en soles sobre los productos, con motivo obligatorio (queda en el historial). La vendedora hasta `DESCUENTO_MAX_VENDEDORA_PCT` (10 %); el admin sin tope.
  - **Registrar un pago a mano anula los links pendientes** (si no, el cliente podía pagar dos veces). El tipo (adelanto/saldo) lo deduce el API.
  - El teléfono reconoce al cliente; si se escribe otro nombre, se actualiza.
  - Producción: si quien empieza a armar no eligió encargada, queda como encargada.
  - Tutorial: solo el general (3 pasos) se abre solo; los de cada pantalla, con "?".
- **Merma** (2026-11-26, sin migración):
  - Al confirmar el consumo, Producción anota «Usado» (todo lo que salió) y «Se perdió» (`merma` en cada línea de `POST /pedidos/:id/consumo`). Lo que pasa de la receta y no se perdió **va en el ramo** (a veces ponen flores de más para que luzca): cuenta como consumo, no como merma. Sin `merma` en la línea se mantiene lo anterior (todo lo de más es merma).
  - Merma fuera de un pedido: `POST /inventario/merma` `{insumoId, cantidad, motivo, nota?}` (admin, almacén y producción; motivos en `MOTIVO_MERMA`). Kardex tipo `merma` con `referencia_tipo = 'almacen'`; no deja el stock en negativo. Botón «Registrar merma» en Inventario y Producción. En «Ajustar por conteo», un faltante por «Flores marchitas» o «Rotura o daño» se registra como merma.
  - Reporte de merma: columnas producción, almacén y cancelación.
- **Login:** máximo 5 fallos en 15 min por IP+email (en memoria; con varias instancias habría que pasarlo a Redis). Logout incrementa `token_version`.

## Guía de diseño (UI/UX) — obligatoria

**Diseño Mouregal** (2026-11-26, a pedido del usuario: "usa el diseño al 100%"). Reemplaza la paleta azul marino y la estructura NeuroLee. La especificación completa con tokens, componentes y pantallas está en [`docs/diseno/DISENO_MOUREGAL.md`](docs/diseno/DISENO_MOUREGAL.md). Las maquetas interactivas son el artefacto "Mouregal ERP — Dirección visual" en claude.ai.

- **Principios:**
  - El pedido se ve como una **etiqueta** (`.etiqueta-pedido`: agujero arriba a la derecha y pie punteado) en Hoy, Producción, Delivery, Pagos y Detalle.
  - La **dedicatoria** va en serif itálica (`.dedicatoria`).
  - El **saldo** siempre en ámbar (`.saldo`).
  - **Una sola acción rosada** por pantalla.
- **Colores** (tokens en `tailwind.config.js`):
  - Fondo blanco.
  - Morado del logo: `brand` / `brand-dark` `#4A2A55` en el menú lateral y en lo seleccionado, `brand-darker` / `text` `#3A1F45` en la tinta, `muted` `#6B5573`.
  - Lilas: `brand-soft` `#F4EBF7`, `brand-line` `#E3D8E7`, `brand-input` `#D6C8DC`, `brand-divisor` `#EEE7F1`, `brand-agujero` `#CDB6D6`.
  - **Acción principal `rosa` `#C2185B`**, también en el foco.
  - Estados `estado.*`, `saldo` (ámbar), `exito` `#1F8A4C` y `error` `#B3261E`.
  - `oro` quedó como alias del ámbar; no se usa dorado.
- **Tipografía:**
  - **Albert Sans** en toda la UI (`font-sans` y `font-display`).
  - **Cormorant Garamond** itálica (`font-serif`) solo para dedicatorias y notas.
  - **Comfortaa** (`font-marca`) solo para la marca.
  - Texto de 14 px. Los títulos de página (`.page-title`) van en 32 px bold, sin recuadro.
  - Nunca MAYÚSCULAS en etiquetas ni en cabeceras de tabla. Números tabulares.
- **Layout** (`layout/shell`):
  - Barra superior blanca: logo, buscador, "?" y usuario.
  - Menú lateral `#4A2A55`. El ítem activo usa `#64407A`, sin barra dorada.
  - Contenido sobre blanco con migas.
- **Botones:**
  - `btn-primary`: rosa, solo para la acción principal.
  - `btn-secondary`: borde de 1.5 px en la tinta.
  - `btn-peligro`: rojo, para cancelar o anular.
  - `btn-text`: subrayado al pasar.
  - Mínimo 40 a 44 px de alto.
- **Avisos flotantes** (`core/avisos/avisos.service.ts` + `<app-avisos>` en el shell):
  - Arriba a la derecha, blancos, con línea verde (`avisos.exito`) o roja (`avisos.error`). Se cierran solos a los 5 s.
  - Toda acción que cambie datos confirma con un aviso. Los errores también se muestran junto al campo.
  - Mensajes directos y sin emojis: "Pago registrado", "NO-0031 entregado".
- **Modales** (`core/dialogo/dialogo.service.ts` + `<app-dialogo>`): `dialogo.confirmar()` y `dialogo.pedirTexto()` (con opciones rápidas). **Prohibido** usar `confirm()`, `prompt()` y `alert()`.
- **Tablas de datos** (`shared/tabla/`): toda lista usa `Tabla<T>` (paginación + selección múltiple + export CSV) con `TABLA_CONTROLES`:
  - Primera columna checkbox (`app-check-todos` / `app-check-fila`), barra `app-seleccion-bar` al marcar.
  - Paginación `app-paginacion` arriba a la derecha ("Página 1 de 4" con flechas).
  - Cabeceras en mayúscula pequeña gris, filas con padding generoso y hover muy suave.
  - Acciones de fila dentro de `<app-row-menu>` (tres puntos a la derecha): se le pasan los mismos `.btn-action` con `aria-label`, que se muestra como texto. Las filas en edición inline mantienen guardar/cancelar visibles.
  - Las tablas que son formularios (líneas de receta, consumo, líneas de compra) no llevan checkbox ni paginación.
- **Filtros por estado = pestañas** (`tabs`) con contador, no píldoras.
- **Íconos** en `shared/icon/icon.component.ts` (Lucide con nombres en español). Siempre con `title` y `aria-label`.
- **Gráficos con Chart.js** mediante `shared/charts/area-chart.component.ts` y `bar-chart.component.ts`, con plugins comunes en `chart-base.ts`.
  - Una serie: color `#9b73a1`, que da ≥ 3:1 sobre blanco. Los acentos más claros (`#b584b9`, `#b48dbb`) no llegan a 3:1 como color de datos.
  - Línea de 2 px monótona, degradado muy suave, cuadrícula hairline.
  - Etiqueta solo en el último valor o en el pico, tooltip blanco con el valor en negrita, y tabla `sr-only` accesible.
  - No hacer paletas multicolor sin validarlas para daltonismo.
- **Sin "fluff":** nada de emojis, toasts motivacionales ni loaders tipo "Pensando…". Mensajes directos ("Pedido #1041 actualizado"). Los errores se muestran con `mensajeError()` (`core/http/errores.ts`), que muestra el mensaje real del API.
- **Fechas y horas:** usar `cuando()`, `hora()`, `soles()` y `hoyLima()` de `core/util/formato.ts`. Zona horaria `America/Lima`.
- **Tableros en vivo** (`/hoy`, `/produccion`, `/delivery`): `usarPolling()` cada 15 s, que se pausa con la pestaña oculta.
- Todas las páginas cargan en diferido (`loadComponent` en `app.routes.ts`).
- **Filtros por estado = pestañas** (`tabs`) con contador. La pestaña activa se subraya en rosa.
- **Íconos** en `shared/icon/icon.component.ts` (Lucide con nombres en español). Siempre con `title` y `aria-label`.
- **Gráficos con Chart.js** mediante `shared/charts/*`:
  - Una serie: `#7E4E90`.
  - Categóricos: la paleta validada `COLORES_DONA` (la misma de `reporte-ventas`).
  - Tooltip blanco y tabla `sr-only` accesible.
- **Fechas y horas:** `cuando()`, `hora()`, `soles()` y `hoyLima()` de `core/util/formato.ts`. Zona `America/Lima`.
- **Tableros en vivo** (`/hoy`, `/produccion`, `/delivery`): `usarPolling()` cada 15 s.
- Todas las páginas cargan en diferido (`loadComponent` en `app.routes.ts`).
- **Tutorial interactivo** (driver.js, `core/tour/`):
  - Ilumina secciones marcadas con `data-tour="<clave>"` y las explica.
  - Se abre solo la primera vez que cada usuario entra a una pantalla. La primera de todas agrega antes el recorrido general del menú.
  - El botón "?" de la barra superior lo repite.
  - Lo visto se guarda en `localStorage` (`erp_tours_vistos:<userId>`).
  - Los pasos de cada pantalla están en `core/tour/tours/<pantalla>.ts` y se pueden filtrar por `roles`. Un paso cuya sección no existe en ese momento se omite.
  - Si cambias o quitas una sección marcada, actualiza su tour.

## Trampas conocidas

- Fin de línea: **LF en todo el repo**, forzado por `.gitattributes` (`* text=auto eol=lf`), `endOfLine: "lf"` en Prettier y `.editorconfig`. Si un clon viejo de Windows aún tiene CRLF, se corrige una vez con `git rm --cached -r -q . && git reset --hard` (con el árbol limpio).
- **Angular:** `@else if (x(); as y)` no compila (el alias solo va en el `@if` principal). Usa `@else if (x()) { @let y = x()!; … }`.
- **zod + TS 5.5:** un `.refine((m) => m !== "link")` estrecha el tipo inferido, así que los formularios deben usar el tipo estrecho.
- **`@erp/shared`** se publica en CJS (`dist/`, para Nest y Jest) y ESM (`dist/esm/`, para Angular). Siempre `pnpm build:shared` tras cambiarlo.
- **Tests del API** usan PGlite (Postgres en WASM), por eso el script `test` corre Jest con `--experimental-vm-modules`. `src/test/db-test.ts` crea una base nueva por test con las migraciones reales y el seed.
- **`tsconfig.build.json` del API** excluye `drizzle.config.ts` y `src/test/**`. Si no, `dist/main.js` queda en `dist/src/` y `start:prod` falla.
- **Sidebar:** la clase `w-60` mide 195 px reales porque la base de rem es 13 px. Lleva el logo completo `public/logo-mouregal.png` (el mismo del login).
- **`ng serve` en Windows** a veces no detecta cambios de archivos y sigue sirviendo la versión vieja. Si la UI no refleja un cambio que sí compila con `npx ng build`, reinicia `pnpm demo`.
- **Heredocs en Git Bash:** un heredoc grande con comillas simples dentro puede fallar con "unexpected EOF". Usa Edit/Write o un script en archivo.

## Pendientes conocidos

1. **Fase 6:** webhooks de Shopify (HMAC + `integraciones_log` idempotente), stock por variante, fulfillments, API para el chatbot de WhatsApp y la pantalla `/config/integraciones` (hoy es un placeholder).
2. Revisar en Excel de escritorio los `.xlsx` exportados (se validó la estructura del ZIP y el XML, pero no se abrieron en Excel).
3. **Producción:** la UI de resolver consultas no tiene campo para `ajustePrecio` (el API sí lo acepta).
4. **Rate limit en memoria** (pasar a Redis si hay varias instancias) y **notificaciones reales** (hoy son stub).
5. **Imágenes del catálogo:** las fotos de producto que usa la web son `.webp` optimizados en `apps/web/public/productos/`. Los originales (`FOTOS/`, ~1 GB de .DNG/.MOV) **no están en git**: un archivo pasa el límite de 100 MB de GitHub. Se guardan fuera del repo (Drive o disco).
6. **Diseño Mouregal, pantallas nuevas** (ver `docs/diseno/DISENO_MOUREGAL.md`, sección 4): ya están Todos los pedidos (`/pedidos`), ajuste por conteo (Inventario) y Usuarios y permisos (`/config/usuarios`, endpoints `GET /usuarios/todos`, `POST /usuarios`, `PATCH /usuarios/:id`, `POST /usuarios/:id/clave`). También Venta rápida (`POST /pedidos/venta-rapida`), Caja (`/caja`) y Clientes (`/clientes`), con tests en `src/test/diseno.e2e.spec.ts`. Faltan comprobantes SUNAT (necesita proveedor OSE) e Integraciones.
