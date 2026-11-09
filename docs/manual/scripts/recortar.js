const sharp = require('sharp'); const fs = require('fs'); const path = require('path');
// Uso: node scripts/recortar.js img   (desde docs/manual)
const dir = process.argv[2] ?? 'img';
(async () => {
  for (const f of fs.readdirSync(dir).filter((x) => /^\d.*\.png$/.test(x))) {
    const src = path.join(dir, f);
    const { width, height } = await sharp(src).metadata();
    const out = path.join(dir, 'c-' + f);
    if (f.startsWith('01-login')) {
      await sharp(src).extract({ left: Math.round(width / 2 - 560), top: 150, width: 1120, height: Math.min(1000, height - 150) }).toFile(out);
    } else if (f.startsWith('02-mapa')) {
      await sharp(src).extract({ left: 0, top: 0, width, height: Math.min(820, height) }).toFile(out);
    } else if (f.startsWith('06-produccion-consumo')) {
      // Solo el panel "Receta vs. usado" (debajo del tablero).
      await sharp(src).extract({ left: 292, top: 690, width: width - 292, height: height - 690 }).toFile(out);
    } else if (f.startsWith('03-')) {
      fs.copyFileSync(src, out);
    } else {
      // Sin la barra lateral (292px a 1.5x): la pantalla se lee más grande en A4.
      await sharp(src).extract({ left: 292, top: 0, width: width - 292, height }).toFile(out);
    }
  }
  console.log('ok');
})();
