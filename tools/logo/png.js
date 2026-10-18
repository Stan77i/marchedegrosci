// PNG des icônes à partir des SVG (Chromium de Playwright). Usage : node tools/logo/png.js
// Variable CHROMIUM pour indiquer un navigateur précis.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ic = path.join(__dirname, '..', '..', 'icons');
const L = [
  ['favicon.svg', 'favicon-16.png', 16], ['favicon.svg', 'favicon-32.png', 32], ['favicon-noir.svg', 'favicon-noir-32.png', 32],
  ['icon-plein.svg', 'icon-192.png', 192], ['icon-plein.svg', 'icon-512.png', 512], ['icon-plein.svg', 'apple-touch-icon.png', 180],
  ['icon-plein-noir.svg', 'icon-noir-512.png', 512], ['icon-plein-noir.svg', 'apple-touch-icon-noir.png', 180],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512], ['badge.svg', 'badge-96.png', 96],
];
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await b.newPage();
  for (const [src, out, t] of L) {
    const svg = fs.readFileSync(path.join(ic, src), 'utf8');
    await p.setViewportSize({ width: t, height: t });
    await p.setContent('<style>html,body{margin:0;background:transparent}</style>' + svg.replace('<svg ', `<svg width="${t}" height="${t}" `));
    await p.screenshot({ path: path.join(ic, out), omitBackground: true });
    console.log(out, t);
  }
  await b.close();
})();
