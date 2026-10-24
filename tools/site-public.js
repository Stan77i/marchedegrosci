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
// l'étal du haut de page : de vrais sacs, cartons et cagettes, posés en trois rangs (positions en % de l'étal)
const NOM = Object.fromEntries(produits.map(p => [p.s, p.n]));
const img = (sl, t) => 'img/' + sl + '-' + t + '.webp';
const ETAL_P = [
  // [produit, gauche %, bas %, largeur %, profondeur 0 = fond]
  ['riz-local', 3, 45, 29, 0], ['mais-grain', 24, 50, 28, 0], ['banane-plantain', 45, 52, 29, 0], ['oignon', 67, 47, 29, 0],
  ['igname', -5, 19, 35, 1], ['manioc', 19, 23, 33, 1], ['ananas', 44, 25, 31, 1], ['aubergine', 66, 19, 35, 1],
  ['tomate', 2, -2, 45, 2], ['mangue', 42, -1, 39, 2], ['attieke', 73, 2, 29, 2]
].filter(e => NOM[e[0]] && fs.existsSync(path.join(SITE, img(e[0], 480))));
const ETAL = '<div class="etal-sol"></div>' + ETAL_P.map((e, i) => `<img src="${img(e[0], 480)}" alt="" width="480" height="480" style="left:${e[1]}%;bottom:${e[2]}%;width:${e[3]}%;--d:${(e[4] * 4 + (i % 4)) * 70}ms" class="r${e[4]}"${i < 4 ? '' : ' decoding="async"'}>`).join('');
const PROS_P = [['riz-local', 0, 18, 46], ['mangue', 40, 6, 46], ['tomate', 14, 0, 50]].filter(e => NOM[e[0]] && fs.existsSync(path.join(SITE, img(e[0], 480))));
const PROS = PROS_P.map((e, i) => `<img src="${img(e[0], 480)}" alt="" width="480" height="480" loading="lazy" style="left:${e[1]}%;bottom:${e[2]}%;width:${e[3]}%;z-index:${i}">`).join('');

const parCat = CAT.map(c => ({ c, p: produits.filter(p => p.c === c.slug && p.f) })).filter(g => g.p.length);
// les étagères : 4 familles choisies en photos ; les autres en une ligne
const ETAGERES = ['cereales-et-riz-local', 'tubercules-et-feculents', 'legumes-et-fruits', 'poissons'];
const etg = ETAGERES.map(k => parCat.find(g => g.c.slug === k)).filter(Boolean), reste = parCat.filter(g => !ETAGERES.includes(g.c.slug));
const AVEC_PAGE = new Set(require('./site-produits.js').LISTE);
const lienProduit = sl => AVEC_PAGE.has(sl) ? `href="produits/${sl}/"` : `href="../application.dc.html#/produits/${sl}" data-app="#/produits/${sl}" data-intention="produit"`;
const RAYONS = etg.map(g => `<div class="etagere"><h3>${esc(g.c.name)}</h3><ul>${g.p.slice(0, 10).map(p => `<li><a ${lienProduit(p.s)}><span class="plateau"><img src="${img(p.s, 160)}" alt="${esc(p.n)} en gros" width="160" height="160" loading="lazy" decoding="async"></span><span class="nom">${esc(p.n)}</span></a></li>`).join('')}</ul></div>`).join('')
  + `<p class="autres-rayons"><b>Aussi au marché :</b> ${reste.map(g => esc(g.c.name.toLowerCase())).join(' · ')}. En tout, ${produits.length} produits dans l’application.</p>`;
const DATE = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
const DONNEES = { produits: produits.filter(p => p.f).map(p => [p.s, p.n]), villes };

// le nom dessiné (app/marque.js), écrit dans la page : pas d'image à charger
const mq = { document: { readyState: 'complete', addEventListener() {}, querySelectorAll: () => [], querySelector: () => null } }; mq.window = mq; vm.createContext(mq); vm.runInContext(lire('app/marque.js'), mq);
const LOGO = mq.MDGMarque.ligne({ fond: 'vert', h: 26, cls: 'marque-nom' }).replace(' role="img" aria-label="Marché de Gros"', ' aria-hidden="true"');
// version des fichiers du site : empreinte de leur contenu (le cache du navigateur suit tout seul)
const crypto = require('crypto');
const VERSION = crypto.createHash('md5').update(['site.css', 'site.js', 'garde.js', 'carte.js'].map(f => { try { return fs.readFileSync(path.join(SITE, f), 'utf8'); } catch (_) { return ''; } }).join('') + lire('app/admin-pc.js')).digest('hex').slice(0, 8);
const fine = t => String(t).replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0')
  .replace(/(\d) (%|kg|t\b|°C|km|FCFA|F\b|000)/g, '$1\u00a0$2').replace(/(\d) (000)/g, '$1\u00a0$2');  // « 10 % », « 3 000 », « 50 kg » : jamais coupés
const remplir = (gab, v) => gab.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in v)) throw new Error('gabarit : {{' + k + '}} inconnu'); return v[k]; });
const VAL = { CARTE, LOGO, VERSION, ETAL, PROS, RAYONS, DATE, DONNEES: JSON.stringify(DONNEES).replace(/</g, '\\u003c'), NB_PRODUITS: String(produits.length), NB_PHOTOS: String(produits.filter(p => p.f).length) };
// une page = _debut (avec sa tête propre) + _entete + son corps + _fin ; S = chemin vers site/, R = chemin vers la racine du dépôt
const partiel = n => fs.readFileSync(path.join(GAB, '_' + n + '.html'), 'utf8');
function page(gab, v) {
  const m = gab.split(/<!--@tete-->|<!--@corps-->/); if (m.length !== 3) throw new Error('gabarit sans <!--@tete--> / <!--@corps-->');
  const html = remplir(partiel('debut').replace('{{TETE}}', m[1].trim()) + partiel('entete') + m[2] + partiel('fin'), v);
  // typographie française sur tout le texte visible (hors <script>, <style> et attributs) : espace insécable avant « : ; ! ? »
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/).map((bout, i) => i % 2 ? bout : bout.replace(/>([^<]+)</g, (x, t) => '>' + fine(t) + '<')).join('');
}
const GG = fs.readFileSync(path.join(GAB, 'guide.html'), 'utf8'), GD = path.join(GAB, 'guides');
const ACTION = { offre: ['#/publier?sens=offre', 'Publiez votre offre : les acheteurs du réseau vous écrivent. Gratuit.'], demande: ['#/publier?sens=demande', 'Publiez ce que vous cherchez : les vendeurs vous font leur prix. Gratuit.'], appro: ['#/appro', 'Publiez vos besoins de la semaine : plusieurs vendeurs vous répondent.'], groupes: ['#/groupes', 'Rejoignez un achat groupé ouvert, ou ouvrez-en un sur votre offre.'] };
const GUIDES = fs.readdirSync(GD).filter(f => f.endsWith('.html')).sort().map(f => {
  const t = fs.readFileSync(path.join(GD, f), 'utf8'), m = /<!--@meta (\{[\s\S]*?\}) -->/.exec(t); if (!m) throw new Error('guide sans @meta : ' + f);
  return Object.assign(JSON.parse(m[1]), { slug: f.replace(/\.html$/, ''), corps: t.slice(m.index + m[0].length).trim() });
});
const dateTxt = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const carteGuide = (g, pre) => `<li><a href="${pre}${g.slug}/"><img src="${pre === '' ? '../' : ''}img/${g.photo}-160.webp" alt="" width="160" height="160" loading="lazy"><span><b>${fine(esc(g.h1))}</b><small>${fine(esc(g.resume))}</small></span></a></li>`;
VAL.GUIDES_ACCUEIL = GUIDES.map(g => carteGuide(g, 'guides/')).join('');
const COMMUN = { BASE: '', SCRIPTS_PAGE: '' };
ecrire('index.html', page(fs.readFileSync(path.join(GAB, 'index.html'), 'utf8'), Object.assign({}, VAL, COMMUN, { S: '', R: '../' })));
// la carte du réseau : <base> à la racine du dépôt, pour que la carte de l'application (app/carte-gl.js) trouve ses fichiers
ecrire('carte/index.html', page(fs.readFileSync(path.join(GAB, 'carte.html'), 'utf8'), Object.assign({}, VAL, COMMUN, { S: 'site/', R: '', BASE: '<base href="../../">\n',
  SCRIPTS_PAGE: '<script src="app/icones.js?v=20261025a"></script>\n<script src="app/carte-gl.js?v=20261124e"></script>\n<script src="site/carte.js?v=' + VERSION + '"></script>\n' })));

// ——— les pages produits (site/produits/<id>/) ———
const PP = require('./site-produits.js')({ produits, CAT, NOM, esc, lire, vm, photo: sl => fs.existsSync(path.join(SITE, img(sl, 480))) });
const GP = fs.readFileSync(path.join(GAB, 'produit.html'), 'utf8');
// les prix officiels de la semaine (OCPV, prix au détail) : un bloc par page produit et la page site/prix-de-la-semaine/
const PX = require('./site-prix.js')(esc);
PP.forEach(v => ecrire('produits/' + v.SLUG + '/index.html', page(GP, Object.assign({}, VAL, COMMUN, v, { S: '../../', R: '../../../', PRIX_OCPV: PX.blocProduit(v.SLUG, NOM[v.SLUG]) }))));
ecrire('prix-de-la-semaine/index.html', page(fs.readFileSync(path.join(GAB, 'prix-semaine.html'), 'utf8'), Object.assign({}, VAL, COMMUN, PX.page, { S: '../', R: '../../', LU_LE_TXT: dateTxt(PX.page.LU_LE) })));
// ——— les guides (site/guides/<id>/) : contenu écrit à la main dans tools/site/guides/<id>.html, chiffres sourcés ———
GUIDES.forEach(g => {
  const canon = 'https://stan77i.github.io/marchedegrosci/site/guides/' + g.slug + '/', mots = g.corps.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: g.h1, description: g.description, inLanguage: 'fr-CI', datePublished: g.publie, dateModified: g.maj || g.publie, image: 'https://stan77i.github.io/marchedegrosci/site/img/' + g.photo + '-480.webp', mainEntityOfPage: canon,
      author: { '@type': 'Organization', name: 'Marché de Gros CI', url: 'https://stan77i.github.io/marchedegrosci/site/' }, publisher: { '@id': 'https://stan77i.github.io/marchedegrosci/#org' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Marché de Gros CI', item: 'https://stan77i.github.io/marchedegrosci/site/' }, { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://stan77i.github.io/marchedegrosci/site/guides/' }, { '@type': 'ListItem', position: 3, name: g.h1, item: canon }] }] };
  const act = ACTION[g.sens] || ACTION.offre;
  ecrire('guides/' + g.slug + '/index.html', page(GG, Object.assign({}, VAL, COMMUN, { S: '../../', R: '../../../',
    TITRE: esc(g.titre), H1: fine(esc(g.h1)), DESCRIPTION: esc(g.description), RESUME: fine(esc(g.resume)), POUR: esc(g.pour), CANON: canon, OG_IMAGE: 'https://stan77i.github.io/marchedegrosci/site/img/' + g.photo + '-480.webp',
    DATE_ISO: g.publie, DATE_TXT: dateTxt(g.publie), MINUTES: String(Math.max(2, Math.round(mots / 200))), PHOTO: g.photo, SLUG: g.slug, CORPS: g.corps.replace(/>([^<]+)</g, (m, t) => '>' + fine(t) + '<'),
    JSONLD: JSON.stringify(ld).replace(/</g, '\\u003c'), CTA: esc(g.cta), CTA_APP: act[0], CTA_TEXTE: esc(act[1]),
    AUTRES: GUIDES.filter(x => x.slug !== g.slug).map(x => `<a href="../${x.slug}/">${fine(esc(x.h1))}</a>`).join('') })));
});
// ——— le calendrier des récoltes (site/saisons/) : seulement les périodes sourcées de v2/saisons.js ———
{
  const C = require('./site-produits.js').calendrier({ NOM, esc, lire, vm, photo: sl => fs.existsSync(path.join(SITE, img(sl, 160))) });
  ecrire('saisons/index.html', page(fs.readFileSync(path.join(GAB, 'saisons.html'), 'utf8'), Object.assign({}, VAL, COMMUN, C, { S: '../', R: '../../', MAJ_CAL_TXT: dateTxt(C.MAJ_CAL) })));
}
// ——— les districts (site/regions/) ———
const RG = require('./site-regions.js')({ NOM, esc, lire, vm, photo: sl => fs.existsSync(path.join(SITE, img(sl, 160))) });
{
  const GR = fs.readFileSync(path.join(GAB, 'region.html'), 'utf8');
  RG.pages.forEach(p => ecrire('regions/' + p.r + '/index.html', page(GR, Object.assign({}, VAL, COMMUN, p.v, { S: '../../', R: '../../../' }))));
  ecrire('regions/index.html', page(fs.readFileSync(path.join(GAB, 'regions.html'), 'utf8'), Object.assign({}, VAL, COMMUN, { S: '../', R: '../../', SOMMAIRE: RG.sommaire })));
}
ecrire('a-propos/index.html', page(fs.readFileSync(path.join(GAB, 'a-propos.html'), 'utf8'), Object.assign({}, VAL, COMMUN, { S: '../', R: '../../' })));
ecrire('guides/index.html', page(fs.readFileSync(path.join(GAB, 'guides.html'), 'utf8'), Object.assign({}, VAL, COMMUN, { S: '../', R: '../../', LISTE_GUIDES: GUIDES.map(g => carteGuide(g, '')).join('') })));
// ——— le plan du site (site/sitemap.xml), pour Google Search Console et Bing le jour de l'ouverture ———
// Pas de robots.txt possible (GitHub Pages : il serait à la racine de stan77i.github.io) : le plan se soumet à la main dans les deux consoles.
// Tant que les pages sont en noindex, ce fichier ne fait rien ; ne pas le soumettre avant l'ouverture décidée par le propriétaire.
{
  const B = 'https://stan77i.github.io/marchedegrosci/site/';
  const U = [[B, ''], [B + 'carte/', ''], [B + 'guides/', ''], [B + 'a-propos/', ''], [B + 'saisons/', ''], [B + 'regions/', ''], [B + 'prix-de-la-semaine/', PX.page.LU_LE]]
    .concat(PP.map(v => [B + 'produits/' + v.SLUG + '/', '']))
    .concat(RG.pages.map(p => [B + 'regions/' + p.r + '/', '']))
    .concat(GUIDES.map(g => [B + 'guides/' + g.slug + '/', g.maj || g.publie]));
  ecrire('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + U.map(([u, d]) => '  <url><loc>' + u + '</loc>' + (d ? '<lastmod>' + d + '</lastmod>' : '') + '</url>').join('\n') + '\n</urlset>\n');
}
console.log('site public : ' + PP.length + ' pages produits, ' + GUIDES.length + ' guides, ' + produits.length + ' produits, ' + DONNEES.produits.length + ' avec photo, carte ' + W + '×' + H + ', ' + Object.keys(lieux).length + ' lieux');
