// Usage : npm pack @fontsource/jost @mapbox/tiny-sdf@2 (décompressés), puis JOST=…/files TINYSDF=…/index.js node tools/glyphes-carte.js vendor/glyphs
// Génère les glyphes de carte (format PBF MapLibre) en Jost, avec TinySDF dans Chromium.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const J = process.env.JOST || 'node_modules/@fontsource/jost/files', OUT = process.argv[2];
const cps = JSON.parse(fs.readFileSync(process.env.CPS || 'tools/glyphes-cps.json'));
const sdf = fs.readFileSync(process.env.TINYSDF || 'node_modules/@mapbox/tiny-sdf/index.js', 'utf8').replace('export default class TinySDF', 'window.TinySDF = class TinySDF');
const STACKS = [['Regular', 'normal', 400], ['Medium', 'normal', 500], ['Italic', 'italic', 400]];
// protobuf minimal
const varint = (n, a) => { n = n >>> 0; while (n > 127) { a.push((n & 127) | 128); n >>>= 7; } a.push(n); };
const key = (f, t, a) => varint((f << 3) | t, a);
const zz = n => ((n << 1) ^ (n >> 31)) >>> 0;
const bytes = (f, b, a) => { key(f, 2, a); varint(b.length, a); for (const x of b) a.push(x); };
const uint = (f, v, a) => { key(f, 0, a); varint(v, a); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
  await p.setContent('<html><body></body></html>');
  let css = '';
  for (const [, st, w] of STACKS) for (const sub of ['latin', 'latin-ext']) css += `@font-face{font-family:JostGen;font-style:${st};font-weight:${w};src:url(data:font/woff;base64,${fs.readFileSync(path.join(J, `jost-${sub}-${w}-${st}.woff`)).toString('base64')}) format('woff')}`;
  await p.addStyleTag({ content: css }); await p.addScriptTag({ content: sdf });
  for (const [nom, st, w] of STACKS) {
    await p.evaluate(([st, w]) => Promise.all([document.fonts.load(`${st} ${w} 24px JostGen`, 'aé'), document.fonts.load(`${st} ${w} 24px JostGen`, 'ĀŒ’')]), [st, w]);
    const dir = path.join(OUT, 'Jost ' + nom); fs.mkdirSync(dir, { recursive: true });
    for (const r of [0, 1, 32]) {
      const G = await p.evaluate(([st, w, ids]) => { const t = new TinySDF({ fontSize: 24, buffer: 3, radius: 8, cutoff: .25, fontFamily: 'JostGen', fontWeight: String(w), fontStyle: st });
        return ids.map(id => { const c = t.draw(String.fromCodePoint(id)); return { id, w: c.glyphWidth, h: c.glyphHeight, left: c.glyphLeft, top: c.glyphTop, adv: Math.round(c.glyphAdvance), data: c.glyphWidth ? Array.from(c.data) : [] }; }); }, [st, w, cps[nom][r]]);
      const stack = []; bytes(1, Buffer.from('Jost ' + nom), stack); bytes(2, Buffer.from(`${r * 256}-${r * 256 + 255}`), stack);
      for (const g of G) { const a = []; uint(1, g.id, a); if (g.data.length) bytes(2, g.data, a); uint(3, g.w, a); uint(4, g.h, a); uint(5, zz(g.left), a); uint(6, zz(g.top - 25), a); uint(7, g.adv, a); bytes(3, a, stack); }
      const all = []; bytes(1, stack, all);
      fs.writeFileSync(path.join(dir, `${r * 256}-${r * 256 + 255}.pbf`), Buffer.from(all));
      const H = G.find(g => g.id === 72); console.log(nom, r, G.length, 'glyphes', H ? `H w${H.w} h${H.h} left${H.left} top${H.top - 25} adv${H.adv}` : '');
    }
  }
  await b.close();
})();
