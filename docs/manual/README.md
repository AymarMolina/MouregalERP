# Manual de usuario — fuentes

El PDF final está en [`../Manual-de-usuario-ERP-Mouregal.pdf`](../Manual-de-usuario-ERP-Mouregal.pdf). Esta carpeta tiene lo necesario para regenerarlo cuando cambien las pantallas.

| Archivo | Qué es |
|---|---|
| `manual.html` | Texto y maquetación del manual (A4, Inter, estilo del ERP). Las imágenes se referencian como `img/c-*.png`. |
| `img/c-*.png` | Capturas recortadas que usa el manual. |
| `logo.png` | Logo de la portada. |
| `scripts/` | Pipeline para regenerar capturas y PDF (ver abajo). |

## Regenerar

Requisitos: Chrome instalado en `C:/Program Files/Google/Chrome/Application/chrome.exe` (o cambia la ruta en los scripts) y, en una carpeta de trabajo aparte, `npm i puppeteer-core@23 sharp@0.33` (no son dependencias del proyecto).

1. **API de demostración en memoria** (no toca Neon): compila el API (`pnpm --filter api build`) y ejecuta
   `node scripts/demo-api.js <ruta>/apps/api 3001`. Levanta Postgres en memoria (PGlite) con las migraciones reales y el seed, y carga dos semanas de pedidos pasando por todo el flujo vía HTTP. Espera a que imprima `DEMO LISTA`.
2. **Web** corriendo en `localhost:4200` (`pnpm web:dev` o `pnpm demo`).
3. **Capturas**: `node scripts/capturas-manual.js img` — inicia sesión como admin y redirige las llamadas del API de `:3000` a `:3001`.
4. **Recortes**: `node scripts/recortar.js img` — quita la barra lateral (292 px a escala 1.5) y recorta login, mapa y el panel de consumo.
5. **PDF**: `node scripts/generar-pdf.js manual.html ../Manual-de-usuario-ERP-Mouregal.pdf`.
6. **Revisión visual** (opcional): `node scripts/ver-pdf.js ../Manual-de-usuario-ERP-Mouregal.pdf paginas` rasteriza cada página con pdf.js para revisarlas.

Las capturas originales (`img/0*.png`, `img/1*.png`) están en `.gitignore`; solo se versionan los recortes.
