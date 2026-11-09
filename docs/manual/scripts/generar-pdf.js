// Convierte manual/manual.html a PDF A4 con numeración de páginas.
const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const [, , html, salida] = process.argv;
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: salida,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#9ca3af;padding:0 16mm;display:flex;justify-content:space-between">
      <span>Mouregal · Manual de usuario del ERP</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
  console.log('PDF:', salida);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
