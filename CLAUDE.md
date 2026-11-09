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
pnpm --filter api lint           # eslint --fix (también formatea con prettier)
cd apps/web && npx ng build      # verifica plantillas y tipos de la web
```

Usuarios dev (seed): `admin|vendedora|produccion|almacen|delivery@mouregal.pe`, contraseña `dev12345`.

`apps/api/.env` **no está en git** (tiene la URL de Neon). Copia `apps/api/.env.example` y pide los valores. Variables nuevas además de las del spec: `CORS_ORIGIN`, `TRUST_PROXY`, `PAGOS_LINK_BASE` (stub de links de pago), `PERMITIR_ENTREGA_CON_SALDO`.

## Base de datos y migraciones

- Migraciones en `apps/api/drizzle/`. Nunca `drizzle-kit push`: `pnpm db:generate` → revisar el SQL → `pnpm db:migrate`.
- `drizzle-kit generate` no se conecta, pero el config exige la variable: `DATABASE_URL_UNPOOLED=postgres://x@localhost/x npx drizzle-kit generate --name <nombre>`.
- `0000` — esquema completo (sección 4 del spec).
- `0001_insumo_caja_token_version` — agrega `insumos.es_caja` (reemplaza la detección por prefijo `CAJ`; la migración marca las cajas existentes con un UPDATE) y `usuarios.token_version` (revocación de sesiones al hacer logout). Solo agrega columnas.
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

**Concurrencia:**
- Transiciones, consumo, pagos y recepciones bloquean la fila con `SELECT … FOR UPDATE` dentro de la transacción.
- Crear un pedido toma `pg_advisory_xact_lock` y revalida el stock, para que dos ventas simultáneas no reserven lo mismo.
- `pedidos.total_pagado` es un caché que solo recalcula `PagosService`.

## Decisiones ya tomadas (no revertir sin consultar)

- **Permisos por transición** (`validarTransicion`):
  - `en_armado`: produccion y admin.
  - `en_camino`: delivery, vendedora y admin.
  - `entregado`: delivery y admin.
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
- **Login:** máximo 5 fallos en 15 min por IP+email (en memoria; con varias instancias habría que pasarlo a Redis). Logout incrementa `token_version`.

## Guía de diseño (UI/UX) — obligatoria

Estética de **dashboard SaaS sobrio** (tipo Linear/Stripe), nada que parezca "app genérica de IA".

- **Layout:** sidebar oscuro `#1e2229` con texto claro; ítem activo con fondo `#e9b824` y texto oscuro. Canvas `#f6f5f1`. Tarjetas blancas `rounded-xl` con sombra sutil `shadow-card` y sin bordes gruesos.
- **Tipografía:** Inter. 400 para texto, 500 para etiquetas y UI, 600/700 para números y títulos. Números tabulares en tablas, inventarios y ejes.
- **Componentes base** en `apps/web/src/styles.css`, todos Tailwind con `@apply`: `card`, `kpi`, `toolbar`, `search`, `pill`/`pill-active`, `table-wrap`/`table`, `badge` (pastel por estado, sección 9), `btn-primary`/`btn-secondary`/`btn-text`, `btn-action` (+ `-danger`/`-ok`), `spinner`, `skeleton`. Tokens en `tailwind.config.js`.
- **Acciones de fila = íconos** (`<app-icon name="editar|eliminar|historial|copiar|confirmar|anular|check|cerrar|telefono|whatsapp|…">`, en `shared/icon/icon.component.ts`). Siempre con `title` y `aria-label`.
- **Gráficos con Chart.js** mediante `shared/charts/area-chart.component.ts` y `bar-chart.component.ts`, con plugins comunes en `chart-base.ts`.
  - Una serie: color `#b7791f`. Está validado ≥ 3:1 sobre blanco; `#e9b824` falla como color de datos.
  - Línea de 2 px monótona, degradado muy suave, cuadrícula hairline.
  - Etiqueta solo en el último valor o en el pico, tooltip blanco con el valor en negrita, y tabla `sr-only` accesible.
  - No hacer paletas multicolor sin validarlas para daltonismo.
- **Sin "fluff":** nada de emojis, toasts motivacionales ni loaders tipo "Pensando…". Mensajes directos ("Pedido #1041 actualizado"). Los errores se muestran con `mensajeError()` (`core/http/errores.ts`), que muestra el mensaje real del API.
- **Fechas y horas:** usar `cuando()`, `hora()`, `soles()` y `hoyLima()` de `core/util/formato.ts`. Zona horaria `America/Lima`.
- **Tableros en vivo** (`/hoy`, `/produccion`, `/delivery`): `usarPolling()` cada 15 s, que se pausa con la pestaña oculta.
- Todas las páginas cargan en diferido (`loadComponent` en `app.routes.ts`).

## Trampas conocidas

- Muchos archivos tienen fin de línea **CRLF** (Windows, `core.autocrlf=true`). Las ediciones con scripts deben normalizar `\r\n`; eslint/prettier los reescribe en LF y git lo normaliza al commitear.
- **Angular:** `@else if (x(); as y)` no compila (el alias solo va en el `@if` principal). Usa `@else if (x()) { @let y = x()!; … }`.
- **zod + TS 5.5:** un `.refine((m) => m !== "link")` estrecha el tipo inferido, así que los formularios deben usar el tipo estrecho.
- **`@erp/shared`** se publica en CJS (`dist/`, para Nest y Jest) y ESM (`dist/esm/`, para Angular). Siempre `pnpm build:shared` tras cambiarlo.
- **Tests del API** usan PGlite (Postgres en WASM), por eso el script `test` corre Jest con `--experimental-vm-modules`. `src/test/db-test.ts` crea una base nueva por test con las migraciones reales y el seed.
- **`tsconfig.build.json` del API** excluye `drizzle.config.ts` y `src/test/**`. Si no, `dist/main.js` queda en `dist/src/` y `start:prod` falla.
- **Sidebar:** la clase `w-60` mide 195 px reales porque la base de rem es 13 px.

## Pendientes conocidos

1. **Fase 6:** webhooks de Shopify (HMAC + `integraciones_log` idempotente), stock por variante, fulfillments, API para el chatbot de WhatsApp y la pantalla `/config/integraciones` (hoy es un placeholder).
2. **Modales** en vez de los `confirm()`/`prompt()` nativos que quedan: cancelar pedido, confirmar y anular pago, entregar con saldo y anular orden de compra.
3. **Pantallas sin construir:** ajustes manuales de stock (el API `POST /inventario/ajustes` existe, falta la UI) y administración de usuarios.
4. Aplicar `toolbar` + `pill` y `spinner`/`skeleton` en las tablas que aún usan filtros simples o el texto "Cargando…".
5. **Producción:** la UI de resolver consultas no tiene campo para `ajustePrecio` (el API sí lo acepta).
6. **Rate limit en memoria** (pasar a Redis si hay varias instancias) y **notificaciones reales** (hoy son stub).
