# API — ERP Florería (NestJS + Drizzle + Postgres)

API REST con prefijo `/api`. Toda la lógica de negocio (precio, vehículo, stock, merma, costo, saldos) vive aquí y en `packages/shared`; el frontend solo muestra lo que devuelve la API.

## Puesta en marcha

```bash
cp .env.example .env          # completar DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET...
pnpm db:migrate               # desde la raíz del repo
pnpm db:seed                  # usuarios de desarrollo + catálogo de ejemplo (spec sección 11)
pnpm api:dev                  # o `pnpm demo` para API + web juntos
```

Usuarios de desarrollo: `admin@mouregal.pe`, `vendedora@…`, `produccion@…`, `almacen@…`, `delivery@…` — contraseña `dev12345`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Postgres (Neon): pooled para la app, unpooled para migraciones |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Firmas del access token (15 min) y refresh token (7 días) |
| `CORS_ORIGIN` | Orígenes permitidos separados por coma (obligatorio en producción) |
| `TRUST_PROXY` | `true` detrás de un proxy, para que el rate limit del login vea la IP real |
| `PAGOS_LINK_BASE` | Base de los links de pago (stub hasta integrar la pasarela) |
| `PERMITIR_ENTREGA_CON_SALDO` | `true` permite marcar entregado con saldo (queda advertencia en el historial) |

## Migraciones

Nunca `drizzle-kit push` contra producción: `pnpm db:generate` → revisar el SQL → `pnpm db:migrate`.

- `0000` — esquema completo (sección 4).
- `0001` — `insumos.es_caja` (reemplaza la detección por prefijo `CAJ`; la migración marca las cajas existentes) y `usuarios.token_version` (revocación de sesiones). Solo agrega columnas: es reversible con `DROP COLUMN`.

## Tests

```bash
pnpm test
```

- **Unitarios** (`*.spec.ts` junto al código): resolución de ítems y precios.
- **Integración** (`src/test/flujo-pedido.int.spec.ts`): servicios reales contra Postgres en memoria ([PGlite](https://pglite.dev)) con las migraciones reales y el seed. Cubre los criterios de aceptación de las fases 3–5 (carro para L, stock insuficiente, receta 50 / usado 53, despacho con link, recepción 2×50 hojas y costo promedio).
- **E2E por HTTP** (`src/test/api.e2e.spec.ts`): la app Nest completa (JWT, roles, validación) sobre PGlite.

No necesitan base de datos ni `.env`. El script usa `--experimental-vm-modules` porque PGlite carga su WASM con `import()` dinámico.

## Módulos

| Módulo | Endpoints principales |
|---|---|
| auth | `POST /auth/login` (rate limit: 5 fallos / 15 min por IP+email), `/auth/refresh`, `/auth/logout` (revoca refresh tokens), `GET /auth/me` |
| catálogo | `/productos` (+ receta por talla, copiar receta, flores permitidas), `/reglas-cambio`, `/extras`, `/distritos`, `/costos-vehiculo` |
| inventario | `/insumos`, `/insumos/:id/kardex`, `/inventario/ajustes`, `/inventario/apertura` |
| pedidos | `POST /cotizaciones` (ítem con opciones y stock), `POST /cotizaciones/pedido` (pedido completo), `/pedidos`, `/pedidos/:id/transicion`, `/asignar`, `/consumo`, `/despachar`, `/consultas` |
| delivery | `GET /delivery` (listos, en camino y entregados del día) |
| pagos | `GET /pagos`, `/pedidos/:id/pagos` (+ registro manual), `/pedidos/:id/pagos/link-saldo`, `/pagos/:id/confirmar`, `/pagos/:id/anular` |
| compras | `/proveedores`, `GET /compras/sugeridas?dias=`, `/ordenes-compra` (+ `/:id/recepcion`) |
| reportes | `GET /reportes/margen`, `/merma`, `/mas-vendidos`, `/envios` (`?desde=&hasta=`) |
| dashboard | `GET /dashboard/hoy` |

Las notificaciones al cliente (cambios de estado, links de pago) son un stub que registra en el log (`NotificacionesService`), listo para conectar con WhatsApp Business en la fase de integraciones.
