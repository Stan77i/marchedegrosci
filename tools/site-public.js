#!/usr/bin/env node
/* ═════════ Marché de Gros CI — fabrique le nouveau site public (dossier site/) ═════════
   Décision du propriétaire (23/10/2026) : un site pour ordinateur, vitrine de l'application, lisible par Google
   (pages HTML toutes prêtes, sans JavaScript nécessaire pour lire le texte). Pendant la construction, il reste caché :
   noindex + garde administrateur (est_admin vérifié par le serveur).
   Ce script, sans dépendance :
   - lit le catalogue (v2/data.js) et les photos (v2/img/produit-*.webp) ;
   - simplifie le contour de la Côte d'Ivoire, les fleuves et les lacs (app/geo/ci.json) en un petit dessin SVG ;
   - écrit site/donnees/lieux.json (villes → coordonnées, pour placer les annonces) ;
   - remplit les gabarits tools/site/*.html → site/*.html.
   Commande : node tools/site-public.js   (la tâche .github/workflows/site-public.yml le relance) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..'), SITE = path.join(RACINE, 'site'), GAB = path.join(__dirname, 'site');
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const ecrire = (f, s) => { const p = path.join(SITE, f); fs.mkdirSync(path.dirname(p), { recursive: true }); const avant = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; if (avant !== s) { fs.writeFileSync(p, s); console.log('écrit', 'site/' + f); } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ——— le catalogue ———
const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire('v2/data.js'), ctx);
const CAT = ctx.MDG.categories.slice().sort((a, b) => a.order - b.order), PROD = ctx.MDG.products;
const photo = slug => fs.existsSync(path.join(RACINE, 'v2/img/produit-' + slug + '.webp'));
const produits = PROD.map(p => ({ s: p.slug, n: p.name, c: p.categorySlug, f: photo(p.slug) ? 1 : 0 }));

// ——— la carte : projection équirectangulaire corrigée (cos de la latitude moyenne) ———
const geo = JSON.parse(lire('app/geo/ci.json'));
const civ = geo.features.find(f => f.properties.k === 'civ');
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
civ.geometry.coordinates.forEach(poly => poly[0].forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
const PAD = 0.25, L = 1000, COS = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
const K = L / ((maxX - minX + 2 * PAD) * COS);
const P = { x0: minX - PAD, y1: maxY + PAD, k: K, c: COS };
const W = Math.round((maxX - minX + 2 * PAD) * COS * K), H = Math.round((maxY - minY + 2 * PAD) * K);
const proj = ([lon, lat]) => [((lon - P.x0) * P.c * P.k), ((P.y1 - lat) * P.k)];
// Douglas-Peucker sur les points projetés
function simplifier(pts, tol) {
  if (pts.length < 3) return pts;
  const garde = new Uint8Array(pts.length); garde[0] = garde[pts.length - 1] = 1; const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop(); let dmax = 0, im = 0; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    for (let i = a + 1; i < b; i++) { const [px, py] = pts[i]; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); const d = Math.hypot(px - ax - t * dx, py - ay - t * dy); if (d > dmax) { dmax = d; im = i; } }
    if (dmax > tol) { garde[im] = 1; pile.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => garde[i]);
}
const chemin = (lignes, tol, ferme) => lignes.map(l => { const s = simplifier(l.map(proj), tol); return s.length < 2 ? '' : 'M' + s.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + (ferme ? 'Z' : ''); }).join('');
const contour = chemin(civ.geometry.coordinates.map(p => p[0]).filter(r => r.length > 30), 1.2, true);
const fleuves = geo.features.filter(f => f.properties.k === 'fleuve').map(f => chemin(f.geometry.coordinates, 1.5, false)).join('');
const lacs = geo.features.filter(f => f.properties.k === 'lac').map(f => chemin(f.geometry.coordinates.map(p => p[0]), 1.2, true)).join('');
const CARTE = `<svg class="ci" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de la Côte d’Ivoire" data-proj='${JSON.stringify({ x0: +P.x0.toFixed(4), y1: +P.y1.toFixed(4), k: +P.k.toFixed(4), c: +P.c.toFixed(6) })}'>`
  + `<path class="ci-pays" d="${contour}"/><path class="ci-eau" d="${fleuves}"/><path class="ci-lac" d="${lacs}"/><g class="ci-points"></g></svg>`;

// villes et localités (pour placer une annonce à sa ville ; sinon au chef-lieu du district)
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const lieux = {};
geo.features.filter(f => f.properties.k === 'lieu').sort((a, b) => a.properties.r - b.properties.r).forEach(f => { const n = norm(f.properties.n); if (!lieux[n]) lieux[n] = [+f.geometry.coordinates[1].toFixed(3), +f.geometry.coordinates[0].toFixed(3)]; });
ecrire('donnees/lieux.json', JSON.stringify(lieux));
// grandes villes affichées sur la carte (rang 1)
const villes = geo.features.filter(f => f.properties.k === 'lieu' && f.properties.r === 1).map(f => { const [x, y] = proj(f.geometry.coordinates); return { n: f.properties.n, x: +x.toFixed(1), y: +y.toFixed(1) }; });

// ——— le contenu statique (lu par Google) ———
const parCat = CAT.map(c => ({ c, p: produits.filter(p => p.c === c.slug && p.f) })).filter(g => g.p.length);
const RAYONS = parCat.map(g => `<li><b>${esc(g.c.name)}</b><span>${g.p.slice(0, 9).map(p => esc(p.n)).join(' · ')}${g.p.length > 9 ? ' …' : ''}</span></li>`).join('');
const DATE = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
const DONNEES = { produits: produits.filter(p => p.f).map(p => [p.s, p.n]), villes };

// le nom dessiné (app/marque.js), écrit dans la page : pas d'image à charger
const mq = { document: { readyState: 'complete', addEventListener() {}, querySelectorAll: () => [], querySelector: () => null } }; mq.window = mq; vm.createContext(mq); vm.runInContext(lire('app/marque.js'), mq);
const LOGO = mq.MDGMarque.ligne({ fond: 'vert', h: 26, cls: 'marque-nom' }).replace(' role="img" aria-label="Marché de Gros"', ' aria-hidden="true"');
// version des fichiers du site : empreinte de leur contenu (le cache du navigateur suit tout seul)
const crypto = require('crypto');
const VERSION = crypto.createHash('md5').update(['site.css', 'site.js', 'garde.js'].map(f => { try { return fs.readFileSync(path.join(SITE, f), 'utf8'); } catch (_) { return ''; } }).join('') + lire('app/admin-pc.js')).digest('hex').slice(0, 8);
const remplir = (gab, v) => gab.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in v)) throw new Error('gabarit : {{' + k + '}} inconnu'); return v[k]; });
const VAL = { CARTE, LOGO, VERSION, RAYONS, DATE, DONNEES: JSON.stringify(DONNEES).replace(/</g, '\\u003c'), NB_PRODUITS: String(produits.length), NB_PHOTOS: String(produits.filter(p => p.f).length) };
fs.readdirSync(GAB).filter(f => f.endsWith('.html')).forEach(f => ecrire(f, remplir(fs.readFileSync(path.join(GAB, f), 'utf8'), VAL)));
console.log('site public : ' + produits.length + ' produits, ' + DONNEES.produits.length + ' avec photo, carte ' + W + '×' + H + ', ' + Object.keys(lieux).length + ' lieux');
