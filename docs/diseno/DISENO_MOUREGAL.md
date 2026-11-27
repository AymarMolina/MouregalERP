# Mouregal ERP: especificación de diseño

Esta guía describe el nuevo diseño del ERP de Florería Mouregal. Sirve para aplicarlo al proyecto actual (Angular 17, servido desde Railway, API REST bajo `/api`) sin cambiar la lógica del backend.

La carpeta `pantallas/` trae una maqueta de cada pantalla. Las maquetas son archivos `.dc.html` de un editor de diseño:

- **El aspecto visual** está en el HTML, con estilos en línea.
- **El comportamiento** (validaciones, estados, avisos) está en el bloque `<script type="text/x-dc">` de cada archivo, dentro de `renderVals()` o `_rv()`.
- La sintaxis `{{variable}}`, `<sc-for>` y `<sc-if>` equivale a la interpolación, `@for` y `@if` de Angular.
- **No copies los archivos tal cual.** Úsalos como referencia exacta de colores, medidas, textos y reglas.

---

## 1. Principios

1. **El pedido es una "etiqueta".** Cada pedido se ve como la misma tarjeta en todas las pantallas: Hoy, Producción, Delivery, Pagos y Detalle. Arriba a la derecha lleva un círculo pequeño, como el agujero de una etiqueta de florería. La dedicatoria va siempre en itálica serif.
2. **El saldo siempre se ve.** Si alguien debe dinero, aparece en ámbar en todas las pantallas.
3. **Una sola acción rosada por pantalla:** la acción principal. El resto son botones con contorno.
4. **Todo en el idioma de la tienda.** Nunca se muestran valores técnicos como `en_armado`, `tamano` o `por_unidad`. Las fechas van como 26/11/2026 y los montos como `S/ 1,240.00`.
5. **Fondo blanco con detalles morados**, como el logo. Los colores de estado (verde, ámbar, rojo, azul) se usan solo para estados.

## 2. Tokens

### Colores

| Token | Hex | Uso |
|---|---|---|
| `--morado-menu` | `#4A2A55` | Menú lateral, pestañas activas, píldoras activas, bordes destacados |
| `--morado-hover` | `#64407A` | Ítem activo del menú, fondo de pestañas en móvil |
| `--tinta` | `#3A1F45` | Texto principal, botones secundarios (borde y texto) |
| `--tinta-suave` | `#6B5573` | Texto secundario, etiquetas, notas |
| `--rosa` | `#C2185B` | Acción principal, foco, marca "ahora" |
| `--blanco` | `#FFFFFF` | Fondo de página y tarjetas |
| `--lila-tinte` | `#F4EBF7` | Fila seleccionada, cajas de nota dentro de tarjetas, chips neutros |
| `--lila-borde` | `#E3D8E7` | Borde de tarjetas |
| `--lila-borde-input` | `#D6C8DC` | Borde de inputs y botones sin seleccionar |
| `--lila-divisor` | `#EEE7F1` | Líneas entre filas |
| `--lila-agujero` | `#CDB6D6` | Círculo "agujero" de la etiqueta, textos del menú atenuados |
| `--menu-texto` | `#EFE4F3` | Texto del menú lateral |
| `--menu-grupo` | `#CDB6D6` | Títulos de grupo del menú |

Colores de estado: fondo y texto, ambos con contraste AA.

| Estado | Fondo | Texto |
|---|---|---|
| Pendiente | `#EFEAF1` | `#4A3D52` |
| En armado / consulta | `#E3ECF8` | `#1F4E8C` |
| Listo / éxito | `#E2F0E6` | `#1F6B3A` |
| En camino | `#EFE6F7` | `#5B2F86` |
| Entregado | sin fondo | `#6B5573` + "✓" |
| Cancelado / agotado | `#FBE4E2` | `#9B1C15` |
| Saldo / merma / aviso | `#FBEFDF` | `#8F4A00` (texto largo: `#5A2E00`) |
| Atrasado / error | borde o texto | `#B3261E` |

Gráficos: un solo tono, `#7E4E90`, para las barras.

### Tipografía (Google Fonts)

- **Albert Sans** (400, 500, 600, 700): toda la interfaz. Usa `font-variant-numeric: tabular-nums` en montos y horas.
- **Cormorant Garamond Italic** (500): solo dedicatorias y notas para Producción, entre 20 y 24 px.
- **Comfortaa** (700): solo el nombre "Mouregal" en el menú lateral, a 24 px, para parecerse al logo.

Escala:

| Elemento | Tamaño | Peso |
|---|---|---|
| Título de página | 34 px | 700, letter-spacing −0.015em |
| Subtítulo | 17 px | 400, color `--tinta-suave` |
| Título de sección | 18 a 20 px | 700 |
| Texto | 14 a 15 px | 400 |
| Notas | 13 px | 400 |
| Chips | 12 a 13 px | 600 |

No uses MAYÚSCULAS en etiquetas: todo va en minúscula normal.

### Medidas

- Radio: 14 px en tarjetas, 10 px en botones e inputs, 16 px en modales, 999 px en píldoras de filtro, 6 px en chips.
- Alto mínimo de botones e inputs: 44 px. La acción principal mide 48 a 52 px.
- Espacio: 24 a 28 px entre bloques y 12 a 16 px dentro de las tarjetas. Las páginas tienen padding `32px 40px 56px`.
- Sombra solo en modales (`0 24px 60px rgba(58,31,69,.28)`) y avisos (`0 14px 36px rgba(58,31,69,.18)`). Las tarjetas no llevan sombra: usan borde.
- Foco visible: `outline: 2px solid #C2185B; outline-offset: 2px`.

## 3. Componentes

- **Menú lateral** (`Sidebar.dc.html`): fondo `#4A2A55` y 232 px de ancho. En móvil pasa arriba de la página; nunca es `sticky` ni `100vh`. Grupos:
  - Principal: Mapa del flujo, Hoy.
  - Pedidos: Nuevo pedido, Venta rápida, Todos los pedidos, Clientes, Pagos, Caja, Delivery.
  - Operación: Producción, Inventario, Compras.
  - Configuración: Recetas, Reglas de cambio, Tarifario, Usuarios y permisos, Integraciones.
  - Análisis: Reportes.
- **Botones:**
  - Principal: rosa, texto blanco, 600.
  - Secundario: borde 1.5 px `--tinta`, fondo blanco.
  - Peligro: `#B3261E`, solo para "Cancelar pedido".
  - Texto subrayado: para acciones menores como "Reiniciar" o "Dividir en dos métodos".
- **Píldoras de opción** (talla, método de pago, filtros): sin elegir tienen borde `--lila-borde-input`. Elegidas tienen fondo `--tinta` y texto blanco. Usan `aria-pressed`. Las agotadas llevan borde punteado, están deshabilitadas y muestran el texto "sin stock".
- **Etiqueta de pedido:** número, distrito y hora en 13 px `--tinta-suave`. Debajo, el producto en 19 a 22 px 700, el detalle, la dedicatoria en serif y un pie con línea punteada que muestra el chip de estado a la izquierda y el saldo a la derecha.
- **Avisos flotantes** (toasts):
  - Posición: `position: fixed; top: 20px; right: 20px`, ancho máximo 380 px, fondo blanco y borde `--lila-borde`.
  - Línea izquierda de 5 px: **verde `#1F8A4C` si salió bien** y **roja `#B3261E` si hay error o urgencia**, con un ícono a juego.
  - Título en 15 px 700, detalle en 13 px `--tinta-suave` y botón para cerrar con fondo `--lila-tinte`.
  - Entran deslizándose desde la derecha en 0.25 s, sin animación si el usuario tiene `prefers-reduced-motion`. Se cierran solos a los 5 s.
  - Usan `role="status" aria-live="polite"`.
  - En una sola pieza de texto el formato es `"Título|detalle"`.
  - Los errores de formulario, además del aviso, se muestran junto al campo.
- **Modales:** fondo oscuro `rgba(58,31,69,.45)`. El diálogo es blanco, de 600 a 620 px, con cabecera (título, subtítulo y X de 44 px), cuerpo con scroll y pie (nota a la izquierda, Cancelar y la acción principal a la derecha).
  - Llevan `role="dialog" aria-modal="true"`.
  - **Reemplazan todos los `confirm()` y `prompt()` nativos.**
- **Interruptores** (permisos, mensajes): 52 × 30 px, morado si están activos y lila si no. Llevan `role="switch"`.
- **Tablas:** cabecera en `--tinta-suave` 500, filas separadas con `--lila-divisor` y la fila seleccionada en `--lila-tinte`. Cuando es ancha, van dentro de una caja con `overflow-x: auto`. Los montos se alinean a la derecha.
- **Estados vacíos:** una frase que dice qué hacer y, si aplica, un botón (por ejemplo, "Quitar filtros").

## 4. Pantallas

Cada pantalla tiene su maqueta en `pantallas/` con el mismo nombre. Las rutas son las actuales del ERP o las sugeridas para las nuevas.

| Pantalla | Archivo | Ruta | Lo esencial |
|---|---|---|---|
| Mapa del flujo | `Mapa.dc.html` | `/mapa` | 7 pasos numerados con enlace a cada pantalla |
| Hoy | `Main.dc.html` | `/hoy` | Resumen en una frase. Riel de entregas por hora (9:00 a 19:00) con marca "ahora". Carril "Recojos en tienda" con "Entregado al cliente" o "Cobrar S/ X y entregar". Lista "Requiere atención". Al abrir, aviso rojo si hay pedidos atrasados |
| Nuevo pedido, paso 1 | `NuevoPaso1.dc.html` | `/pedidos/nuevo` | Canal, tipo de entrega y distrito con "envío desde S/". "En tienda" fija "Recoge en tienda" |
| Nuevo pedido, paso 2 | `NuevoPedido.dc.html` + `ModalProducto.dc.html` | | Catálogo a la izquierda y la etiqueta en construcción a la derecha, con el total. El modal de producto recalcula el precio al momento; si se elige un cambio sin regla o se escribe una nota, avisa "Irá a consulta" |
| Nuevo pedido, paso 3 | `NuevoPaso3.dc.html` | | Ver la sección 5 |
| Todos los pedidos | `Pedidos.dc.html` | `/pedidos` (nueva) | Busca por número, cliente, quien recibe o teléfono. Filtra por fecha, canal, vendedora y estado (con conteo). Estado vacío con "Quitar filtros". Exporta a Excel |
| Detalle del pedido | `Detalle.dc.html` | `/pedidos/:id` | Muestra al cliente y a quien recibe con sus teléfonos, la nota para Producción y el historial con los pagos. Acciones: Cobrar, Emitir comprobante, Imprimir comanda, Cancelar (con modal) |
| Venta rápida | `VentaRapida.dc.html` | `/venta-rapida` (nueva) | Vitrina con stock. Al cobrar, descuenta stock y crea el pedido ya entregado, sin pasar por Producción |
| Clientes | `Clientes.dc.html` | `/clientes` (nueva) | Lista con búsqueda. La ficha muestra pedidos, total gastado, deuda, saldo a favor, fechas especiales (con recordatorio por WhatsApp), direcciones frecuentes e historial |
| Pagos | `Pagos.dc.html` | `/pagos` | Ver la sección 5 |
| Caja | `Caja.dc.html` | `/caja` (nueva) | Abrir con fondo inicial. Ver el efectivo esperado y las ventas por método. Registrar egresos con motivo. Cerrar con el efectivo contado: muestra la diferencia y pide motivo si no cuadra |
| Delivery (móvil) | `Delivery.dc.html` | `/delivery` | Diseño móvil de 390 px. Pestañas Listos, En camino y Entregados. Con saldo, el repartidor elige el método y "Cobré S/ X y entregué" |
| Producción | `Produccion.dc.html` | `/produccion` | Ver la sección 5 |
| Inventario | `Inventario.dc.html` | `/inventario` | Estados Agotado y Bajo mínimo. El Kardex por insumo indica de qué pedido sale cada consumo y tiene saldo. Modales "Nuevo insumo" y "Ajustar por conteo" |
| Compras | `Compras.dc.html` | `/compras` | Lista sugerida y órdenes. El modal "Recibir compra" recalcula el total con el costo real y marca la orden como recibida completa o en parte |
| Recetas | `Recetas.dc.html` | `/config/recetas` | Precio y margen por talla, receta, flores que se pueden cambiar y avisos de datos faltantes |
| Reglas de cambio | `Reglas.dc.html` + `ModalRegla.dc.html` | `/config/reglas` | Etiquetas legibles. El modal muestra en una línea cómo verá la regla la vendedora |
| Tarifario | `Tarifario.dc.html` | `/config/tarifario` | Muestra cuánto se gana en cada envío; los márgenes bajos van en ámbar |
| Usuarios y permisos | `Usuarios.dc.html` | `/config/usuarios` (nueva) | Usuarios y una matriz de permisos por rol con interruptores. El admin no se puede editar. Tope de descuento |
| Integraciones | `Integraciones.dc.html` | `/config/integraciones` | Shopify, WhatsApp Business y SUNAT. Mensajes automáticos editables con variables `[cliente]`, `[arreglo]`, `[numero]`, `[distrito]` y `[hora]`, y vista previa |
| Reportes | `Reportes.dc.html` | `/reportes` | Rango de fechas. Gráfico de ventas por día con lectura al pasar el cursor. Barras horizontales de cobros por método, margen real (ya con el descuento restado) y merma |
| Comprobante | `ModalComprobante.dc.html` | modal en Detalle | Boleta (DNI de 8 dígitos, opcional) o factura (RUC de 11 dígitos que empieza en 10 o 20, razón social y dirección). Desglose de IGV 18 %. Al emitir: enviar por WhatsApp o imprimir |
| Cancelar pedido | `ModalCancelar.dc.html` | modal en Detalle | Motivo de una lista. Si ya pagó: devolver (método y monto) o dejar saldo a favor |

La etiqueta del pedido en sus tres variantes (Producción, repartidor y mostrador) está en `Etiqueta.dc.html`.

## 5. Reglas de negocio que el diseño hace visibles

Corrigen los problemas del informe de pruebas:

1. **Recojos:** se cierran desde Hoy o desde Producción con "Avisar al mostrador" y "Entregado al cliente". La foto es opcional.
2. **Cancelar con pago:** siempre pregunta si se devuelve el dinero o queda saldo a favor. La devolución se descuenta del reporte de Cobros.
3. **Fecha y hora de entrega:** no se pueden elegir horas que ya pasaron.
4. **Producción:**
   - "Empezar a armar" asigna a la persona que está conectada.
   - La comanda completa se ve desde Pendiente: producto, talla, flor, papel, extras, extra libre y nota.
   - Si se usa más de lo que dice la receta, se registra como merma con aviso.
   - No se puede despachar sin foto, salvo en recojos.
5. **Cobro contra entrega:** el repartidor cobra desde Delivery.
6. **Pagos:**
   - El monto queda vacío después de registrar un pago.
   - Se bloquea el cobro de más con el mensaje "Es más de lo que debe".
   - El número de operación es obligatorio en Yape, Plin y transferencia.
   - Un pago completo no se llama "Adelanto".
7. **Teléfonos peruanos:** 9 dígitos que empiezan en 9. Si el número ya existe, se completa el cliente.
8. **Los pagos aparecen en el historial del pedido.**
9. **El margen resta el descuento.** Los extras libres tienen un costo estimado.
10. **El buscador global** encuentra pedidos por número o teléfono.
11. **Seguridad**, fuera del diseño: mover el refresh token a una cookie `httpOnly; Secure` y usar un dominio propio.

## 6. Textos

- Verbos claros en los botones, como "Registrar pago", "Cobrar S/ 80 y entregar" o "Pasar a en camino". La misma acción usa la misma palabra en todo el flujo, también en el aviso de confirmación ("Pago registrado").
- Los errores dicen qué pasó y cómo arreglarlo, sin disculparse. Ejemplo: "Falta el número de operación de Yape."
- Nada de lorem ipsum. Los datos de ejemplo de las maquetas se reemplazan por datos reales de la API.

## 7. Accesibilidad mínima

- Contraste AA en todos los textos, incluidas las notas en gris.
- Botones e inputs reales con `<label>`. Nunca `click` sobre un `div`.
- Áreas táctiles de 44 px como mínimo.
- Foco visible.
- Respetar `prefers-reduced-motion`.
- Los estados nunca se indican solo con color: siempre llevan texto (por ejemplo, "Debe S/ 80", "Atrasado 2 h").
