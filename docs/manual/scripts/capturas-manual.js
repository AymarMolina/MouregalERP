// Capturas de todas las pantallas para el manual. Web real (localhost:4200);
// las llamadas al API se redirigen al API de demostración en memoria (3001).
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const WEB = 'http://localhost:4200';
const DEMO = 'http://localhost:3001/api';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const login = await (await fetch(`${DEMO}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@mouregal.pe', password: 'dev12345' }) })).json();
  const pedidos = await (await fetch(`${DEMO}/pedidos`, { headers: { authorization: `Bearer ${login.accessToken}` } })).json();
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const detalle = pedidos.find((p) => p.fechaEntrega === hoy && p.estado === 'en_camino') ?? pedidos[0];

  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().startsWith('http://localhost:3000/') ? r.continue({ url: r.url().replace('localhost:3000', 'localhost:3001') }) : r.continue()));
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.dismiss());

  const shot = async (nombre, opts = {}) => {
    await espera(600);
    await page.screenshot({ path: path.join(OUT, `${nombre}.png`), captureBeyondViewport: false, ...opts });
    console.log('ok', nombre);
  };
  const ir = async (ruta) => {
    await page.goto(`${WEB}${ruta}`, { waitUntil: 'networkidle0' });
    await espera(500);
  };
  const clicTexto = async (selector, texto) => {
    const ok = await page.evaluate(
      (sel, t) => {
        const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.replace(/\s+/g, ' ').trim().includes(t));
        if (el) el.click();
        return !!el;
      },
      selector,
      texto,
    );
    if (!ok) console.log('  (no encontrado)', selector, texto);
    await espera(700);
    return ok;
  };

  // 1. Login
  await ir('/login');
  await shot('01-login');
  await page.type('input[formcontrolname=email]', 'admin@mouregal.pe');
  await page.type('input[formcontrolname=password]', 'dev12345');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')]);

  // 2. Mapa y Hoy
  await ir('/mapa');
  await shot('02-mapa');
  await ir('/hoy');
  await shot('03-hoy');
  await shot('03-hoy-completo', { fullPage: true, captureBeyondViewport: true });

  // 3. Nuevo pedido con dos productos
  await ir('/pedidos/nuevo');
  const distritos = await page.$$eval('select[formcontrolname=distritoId] option', (o) => o.map((x) => [x.value, x.textContent.trim()]));
  await page.select('select[formcontrolname=distritoId]', distritos.find((d) => d[1] === 'Miraflores')[0]);
  await espera(400);
  const productos = await page.$$eval('select[formcontrolname=productoId] option', (o) => o.map((x) => [x.value, x.textContent.trim()]));
  await page.select('select[formcontrolname=productoId]', productos.find((p) => p[1].startsWith('Ramo Clásico'))[0]);
  await espera(900);
  await page.select('select[formcontrolname=talla]', 'M');
  await espera(900);
  await clicTexto('button', 'Rosa rosada');
  await clicTexto('button', 'Agregar al pedido');
  await page.select('select[formcontrolname=productoId]', productos.find((p) => p[1].startsWith('Ramo Sol'))[0]);
  await espera(900);
  await clicTexto('button', 'Peluche oso talla S');
  await page.type('input[formcontrolname=clienteNombre]', 'Carla Ruiz');
  await page.type('input[formcontrolname=clienteTelefono]', '987111222');
  await page.type('input[formcontrolname=horaEntrega]', '1530');
  await page.type('input[formcontrolname=direccion]', 'Av. Larco 345, Miraflores');
  await page.type('input[formcontrolname=nombreReceptor]', 'María');
  await page.type('input[formcontrolname=telefonoReceptor]', '912345678');
  await page.type('textarea[formcontrolname=dedicatoria]', 'Feliz aniversario, mi amor');
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await shot('04-nuevo-pedido');
  await shot('04-nuevo-pedido-completo', { fullPage: true, captureBeyondViewport: true });

  // 4. Detalle de pedido
  await ir(`/pedidos/${detalle.id}`);
  await shot('05-detalle');

  // 5. Producción: abrir un pedido en armado (panel de consumo)
  await ir('/produccion');
  await shot('06-produccion');
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim().startsWith('En armado'));
    h?.parentElement?.querySelector('button')?.click();
  });
  await espera(1200);
  await shot('06-produccion-consumo', { fullPage: true, captureBeyondViewport: true });

  // 6. Delivery
  await ir('/delivery');
  await shot('07-delivery');

  // 7. Pagos con panel abierto
  await ir('/pagos');
  await page.evaluate(() => document.querySelector('tbody tr')?.click());
  await espera(800);
  await shot('08-pagos');

  // 8. Inventario + Kardex
  await ir('/inventario');
  await shot('09-inventario');
  await page.evaluate(() => {
    const fila = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('ROS-ROJ'));
    [...(fila?.querySelectorAll('button') ?? [])].find((b) => b.textContent.includes('Kardex'))?.click();
  });
  await espera(1200);
  await shot('09-kardex', { fullPage: true, captureBeyondViewport: true });

  // 9. Compras
  await ir('/compras');
  await shot('10-compras-sugeridas');
  await clicTexto('nav button', 'Órdenes de compra');
  await page.evaluate(() => {
    const fila = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('Recibida parcial'));
    fila?.click();
  });
  await espera(1200);
  await shot('10-compras-orden');
  await clicTexto('nav button', 'Proveedores');
  await shot('10-compras-proveedores');

  // 10. Configuración
  await ir('/config/recetas');
  await shot('11-recetas');
  await page.evaluate(() => {
    const fila = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('Ramo Clásico'));
    [...(fila?.querySelectorAll('button') ?? [])].find((b) => b.textContent.includes('Editar'))?.click();
  });
  await espera(1200);
  await shot('11-recetas-detalle', { fullPage: true, captureBeyondViewport: true });
  await ir('/config/reglas');
  await shot('12-reglas');
  await ir('/config/tarifario');
  await shot('13-tarifario');

  // 11. Reportes
  await ir('/reportes');
  await shot('14-reportes-margen');
  await clicTexto('nav button', 'Merma');
  await shot('14-reportes-merma');
  await clicTexto('nav button', 'Más vendidos');
  await shot('14-reportes-vendidos');
  await clicTexto('nav button', 'Envíos');
  await shot('14-reportes-envios');

  console.log('errores:', errores.length ? errores : 'ninguno');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
