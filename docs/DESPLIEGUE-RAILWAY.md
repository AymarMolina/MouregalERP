# Despliegue en Railway

Un solo servicio en Railway sirve el API y la web (misma URL, sin CORS). La base de datos sigue en **Neon**.

Qué hace Railway en cada despliegue (`railway.json`):

1. **Build:** `pnpm run build:prod` → compila `packages/shared`, la web (Angular) y el API.
2. **Arranque:** `pnpm run start:prod` → aplica las migraciones pendientes (`dist/db/migrar.js`) y levanta el API, que también entrega la web.
3. **Salud:** Railway espera a que `GET /api/salud` responda antes de dar el despliegue por bueno.

Cada `git push` a `main` vuelve a desplegar solo.

---

## 1. Base de datos de producción en Neon

No uses la rama de desarrollo: tiene los usuarios de prueba con `dev12345`.

1. En Neon, crea una **base vacía** para producción (un proyecto nuevo, o una rama nueva sin datos).
2. Copia las dos cadenas de conexión:
   - **Pooled** (el host tiene `-pooler`) → será `DATABASE_URL`.
   - **Unpooled / Direct** → será `DATABASE_URL_UNPOOLED`.

## 2. Claves JWT

En una terminal, corre esto **dos veces** y guarda cada resultado (una para cada clave):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Crear el proyecto en Railway

1. En Railway → **+ New** → **Deploy from GitHub repo** → `MouregalERP`.
   Esto crea un **proyecto nuevo**, separado de los que ya tengas.
2. Antes de que termine el primer despliegue (o después, da igual), entra al servicio → pestaña **Variables** y agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la pooled de Neon |
| `DATABASE_URL_UNPOOLED` | la unpooled de Neon |
| `DB_CONEXION_DIRECTA` | `true`: el API usa la unpooled (1 ida y vuelta por consulta en vez de 2). Pon el servicio en la misma región que la base. |
| `JWT_SECRET` | la primera clave del paso 2 |
| `JWT_REFRESH_SECRET` | la segunda clave del paso 2 |
| `NODE_ENV` | `production` |
| `TZ` | `America/Lima` |
| `TRUST_PROXY` | `true` |
| `PERMITIR_ENTREGA_CON_SALDO` | `false` (o `true` si quieren permitirlo) |
| `PAGOS_LINK_BASE` | `https://pagos.mouregal.pe/stub` (stub hasta tener pasarela) |
| `FOTOS_DIR` | `/data/fotos` (carpeta dentro del volumen del paso 6) |

No hace falta `PORT`: Railway lo pone solo.

3. **Settings → Networking → Generate Domain.** Te da una URL tipo `https://mouregalerp-production.up.railway.app`.
4. Agrega la variable `CORS_ORIGIN` con esa URL (sin `/` al final).
5. Si el despliegue falló por falta de variables, dale **Redeploy**.
6. **Volumen para las fotos de los pedidos.** En el lienzo del proyecto, clic derecho sobre el servicio → **Attach Volume** (o `Ctrl+K` → "volume") con *mount path* `/data`. Sin volumen, las fotos que sube Producción se borran en cada despliegue.
   - Con un volumen, Railway no permite varias réplicas del servicio y cada despliegue tiene unos segundos sin servicio.
   - Respaldo: el volumen tiene *Backups* en su pestaña; actívalos si las fotos importan a largo plazo.

## 4. Crear los usuarios reales

Producción no tiene usuarios hasta que los crees. Se hace desde tu computadora, apuntando a la base de producción. En PowerShell, desde la carpeta del repo:

```powershell
$env:DATABASE_URL = "<pooled de producción>"
$env:DATABASE_URL_UNPOOLED = "<unpooled de producción>"
pnpm build:shared

# Si Railway todavía no desplegó, crea las tablas primero:
pnpm db:migrate

# Un usuario por persona. Sin --password genera una clave y la muestra una sola vez.
pnpm --filter api usuario:crear --email admin@mouregal.pe --nombre "Nombre Apellido" --rol admin
pnpm --filter api usuario:crear --email ventas@mouregal.pe --nombre "Nombre Apellido" --rol vendedora
```

Roles: `admin`, `vendedora`, `produccion`, `almacen`, `delivery`.

Las variables `$env:` solo duran mientras esté abierta esa ventana de PowerShell; ciérrala al terminar para no seguir apuntando a producción.

## 5. Catálogo (opcional)

Para cargar el catálogo de ejemplo de la sección 11 del spec (insumos con stock de apertura, productos con receta, reglas, extras y distritos), con las mismas variables del paso 4:

```powershell
pnpm --filter api db:seed:produccion
```

Necesita un admin creado. **Ojo:** el stock de apertura es de ejemplo. Si van a cargar su inventario real, mejor no lo corran y usen la carga de apertura de Inventario.

## 6. Comprobar

- `https://<tu-url>/api/salud` → `{"ok":true}`
- `https://<tu-url>/` → pantalla de login. Entra con el admin del paso 4.

## Dominio propio (opcional)

En Railway → **Settings → Networking → Custom Domain**, escribe por ejemplo `erp.mouregal.pe`. Railway te muestra un registro **CNAME** que hay que crear donde esté administrado el dominio. Después actualiza `CORS_ORIGIN` con el dominio nuevo.

## Problemas comunes

- **El despliegue falla en "Fallaron las migraciones":** revisa `DATABASE_URL_UNPOOLED`.
- **401 al entrar:** el usuario no existe en la base de producción (paso 4).
- **Login bloqueado:** 5 intentos fallidos en 15 minutos bloquean ese email desde esa IP. Espera o redeploya (el contador está en memoria).
