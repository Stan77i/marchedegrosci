/* ═════════ Marché de Gros CI — les pages produits du site public (site/produits/<id>/) ═════════
   Une page par produit important, seulement quand elle apporte quelque chose de propre (pas de pages en série pour Google) :
   - la photo et les autres noms du produit (catalogue v2/data.js) ;
   - les annonces et les meilleurs prix du moment, en direct (site/site.js : fil_public, tableau_produits) ;
   - quand on le récolte, seulement si une source publique le dit (v2/saisons.js, chaque entrée a sa source) ;
   - les boutons qui ouvrent l'application déjà remplie (#/publier?sens=…&produit=…) ;
   - les produits voisins (liens internes).
   Rien n'est inventé : pas de prix, de tonnage ni de région sans source. */
'use strict';
const path = require('path');

// les produits qui ont leur page (les plus échangés en gros ; photo obligatoire)
const LISTE = ['tomate', 'igname', 'banane-plantain', 'manioc', 'oignon', 'mais-grain', 'riz-local', 'attieke', 'piment-frais', 'aubergine', 'gombo', 'mangue',
  'noix-de-cajou', 'arachide-decortiquee', 'haricot-niebe', 'patate-douce', 'ananas', 'avocat', 'banane-douce', 'chou', 'poivron', 'gari', 'huile-de-palme-rouge', 'poulet-de-chair', 'oeufs-de-poule-alveole-de-30', 'concombre', 'soja'];
const BASE = 'https://stan77i.github.io/marchedegrosci/site/';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const INI = 'JFMAMJJASOND';
const NIV = { plein: 'pleine récolte', debut: 'ça commence', fin: 'ça se termine' };

// le calendrier sourcé (module ES de l'application : on n'en lit que l'objet SAISONS) et les noms des régions
function lireSaisons(lire, vm) {
  const t = lire('v2/saisons.js'), a = t.indexOf('export const SAISONS ='), b = t.indexOf('\n};\n', a);
  const cx = {}; vm.createContext(cx); vm.runInContext('SAISONS = ' + t.slice(t.indexOf('{', a), b + 2), cx);
  const SA = cx.SAISONS, SRC = Object.fromEntries(SA.meta.sources.map(s => [s.id, s]));
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lire('v2/data.js'), ctx);
  const REGN = Object.fromEntries((ctx.MDG.regions || []).map(r => [r.slug, r.name]));
  const zones = r => r.startsWith('zone:') ? (SA.meta.zones[r.slice(5)] || []) : [r];
  return { SA, SRC, REGN, zones, ctx };
}
// une ligne du calendrier (un produit, une ou plusieurs régions, ses mois, sa source)
// vers : chemin vers site/regions/ (les noms de districts deviennent des liens vers leur page) ; vide = texte simple
function ligneMois(e, nom, { SRC, REGN, zones }, esc, vers) {
  const ids = [...new Set(e.regions.flatMap(zones))], regs = ids.map(r => vers && REGN[r] ? `<a href="${vers}${r}/">${esc(REGN[r])}</a>` : esc(REGN[r] || r));
  return `<div class="mois-l"><div class="mois-t"><b>${esc(e.note ? e.note.charAt(0).toUpperCase() + e.note.slice(1) : nom)}</b>${regs.length ? `<span>${regs.join(', ')}</span>` : ''}</div>
        <ol class="mois" aria-label="Mois de récolte">${INI.split('').map((c, i) => { const n = e.months[i + 1]; return `<li class="${n || ''}" title="${MOIS[i]}${n ? ' : ' + NIV[n] : ''}"><span aria-hidden="true">${c}</span><span class="vh">${MOIS[i]}${n ? ' : ' + NIV[n] : ''}</span></li>`; }).join('')}</ol>
        <p class="src">Source : <a href="${esc(SRC[e.source].url)}" rel="noopener" target="_blank">${esc(SRC[e.source].label)}</a></p></div>`;
}
const LEGENDE = '<p class="mois-leg"><span class="plein">pleine récolte</span><span class="debut">ça commence</span><span class="fin">ça se termine</span></p>';
const de = n => (/^[aeiouyhâéèêîôœ]/i.test(n) ? 'd’' : 'de ') + n;

function fabriquer({ produits, CAT, NOM, esc, lire, vm, photo }) {
  const L = lireSaisons(lire, vm), { SA, SRC, ctx } = L;
  return LISTE.filter(sl => NOM[sl] && photo(sl)).map(sl => {
    const p = produits.find(x => x.s === sl), cat = CAT.find(c => c.slug === p.c) || { name: '' };
    const brut = ctx.MDG.products.find(x => x.slug === sl) || {};
    const nom = p.n, min = nom.toLowerCase();
    const alias = (brut.aliases || []).filter(x => x && ![min, min + 's', min + 'x'].includes(x.toLowerCase()));
    // ——— le calendrier ———
    const E = SA.entries.filter(e => e.product === sl && SRC[e.source]);
    const saisons = !E.length ? '' : `<section class="bloc saison" aria-labelledby="t-saison"><div class="bloc-tete"><h2 id="t-saison">Les récoltes ${esc(de(min))}</h2>
      <p>${esc(SA.meta.note)} Chaque ligne cite sa source.</p></div>
      ${E.map(e => ligneMois(e, nom, L, esc, '../../regions/')).join('')}
      ${LEGENDE}
      <p><a class="lien" href="../../saisons/">Le calendrier de tous les produits</a></p></section>`;
    // ——— les voisins (même famille) ———
    const vois = produits.filter(x => x.c === p.c && x.s !== sl && x.f).slice(0, 8);
    const voisins = vois.map(x => `<li><a ${LISTE.includes(x.s) ? `href="../${x.s}/"` : `href="../../../application.dc.html#/produits/${x.s}" data-app="#/produits/${x.s}" data-intention="produit"`}><img src="../../img/${x.s}-160.webp" alt="" width="160" height="160" loading="lazy"><span>${esc(x.n)}</span></a></li>`).join('');
    const titre = `${nom} en gros en Côte d’Ivoire : prix et annonces`;
    const desc = `${nom} en gros en Côte d’Ivoire : annonces et meilleurs prix en direct${E.length ? ', calendrier des récoltes sourcé' : ''}. Négociation sans numéro affiché, gratuite.`;
    const canon = BASE + 'produits/' + sl + '/';
    const fil = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Marché de Gros CI', item: BASE },
      { '@type': 'ListItem', position: 2, name: cat.name, item: BASE + '#rayons' },
      { '@type': 'ListItem', position: 3, name: nom, item: canon }] };
    return {
      SLUG: sl, NOM: esc(nom), NOM_MIN: esc(min), DE_NOM: esc(de(min)), CATN: esc(cat.name),
      ALIAS: alias.length ? `<p class="alias">Aussi appelé : ${alias.map(x => `<b>${esc(x)}</b>`).join(', ')}</p>` : '',
      TITRE: esc(titre), DESCRIPTION: esc(desc), CANON: canon, OG_IMAGE: BASE + 'img/' + sl + '-480.webp',
      JSONLD_FIL: JSON.stringify(fil).replace(/</g, '\\u003c'), SAISONS: saisons, VOISINS: voisins
    };
  });
}
// ——— la page « Calendrier des récoltes » (site/saisons/) : toutes les entrées sourcées, produit par produit ———
function calendrier({ NOM, esc, lire, vm, photo }) {
  const L = lireSaisons(lire, vm), { SA, SRC } = L;
  const E = SA.entries.filter(e => SRC[e.source] && NOM[e.product]);
  const ordre = [...new Set(E.map(e => e.product))];
  const blocs = ordre.map(sl => {
    const nom = NOM[sl], lien = LISTE.includes(sl) ? `../produits/${sl}/` : '';
    const img = photo(sl) ? `<img src="../img/${sl}-160.webp" alt="" width="80" height="80" loading="lazy">` : '';
    const titre = lien ? `<a href="${lien}">${esc(nom)}</a>` : esc(nom);
    const mo = {}; E.filter(e => e.product === sl).forEach(e => Object.entries(e.months).forEach(([m, l]) => { if (!mo[m] || l === 'plein') mo[m] = l; }));
    return `<section class="cal-p" aria-labelledby="cal-${sl}" data-mois='${JSON.stringify(mo)}' data-nom="${esc(nom)}"${lien ? ` data-lien="${lien}"` : ''}><h2 id="cal-${sl}">${img}<span>${titre}</span></h2>
      ${E.filter(e => e.product === sl).map(e => ligneMois(e, nom, L, esc, '../regions/')).join('')}</section>`;
  }).join('');
  const srcs = [...new Set(E.map(e => e.source))].map(id => `<li><a href="${esc(SRC[id].url)}" rel="noopener" target="_blank">${esc(SRC[id].label)}</a></li>`).join('');
  return { CALENDRIER: blocs + LEGENDE, NB_CAL: String(ordre.length), SOURCES_CAL: srcs, NOTE_CAL: esc(SA.meta.note), MAJ_CAL: SA.meta.updated };
}
module.exports = fabriquer;
module.exports.calendrier = calendrier;
module.exports.LISTE = LISTE;
module.exports.outils = { lireSaisons, ligneMois, LEGENDE, MOIS };
