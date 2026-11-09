// Rasteriza un PDF con pdf.js dentro de Chrome y guarda cada página (o una hoja de contacto).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , archivo, salida, desde = '1', hasta = '99'] = process.argv;
  fs.mkdirSync(salida, { recursive: true });
  const datos = fs.readFileSync(archivo).toString('base64');
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1200 });
  await page.setContent('<html><body style="margin:0;background:#888"></body></html>');
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
  const total = await page.evaluate(async (b64, d, h) => {
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    for (let i = Number(d); i <= Math.min(Number(h), doc.numPages); i++) {
      const p = await doc.getPage(i);
      const vp = p.getViewport({ scale: 1.45 });
      const c = document.createElement('canvas');
      c.width = vp.width;
      c.height = vp.height;
      c.id = `p${i}`;
      c.style.display = 'block';
      c.style.marginBottom = '10px';
      document.body.appendChild(c);
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    }
    return doc.numPages;
  }, datos, desde, hasta);
  console.log('paginas:', total);
  for (const c of await page.$$('canvas')) {
    const id = await c.evaluate((e) => e.id);
    await c.screenshot({ path: path.join(salida, `${id.replace('p', 'p').padStart(3, '0')}.png`) });
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
