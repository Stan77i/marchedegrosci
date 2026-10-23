// Marché de Gros CI : les pages des 14 districts (site/regions/<id>/) et leur sommaire (site/regions/).
// Rien d'inventé : le nom et le chef-lieu (catalogue de l'application), les récoltes sourcées de v2/saisons.js qui couvrent le district,
// et, en direct dans le navigateur, les annonces et les meilleurs prix publiés dans le district (fil_public, tableau_produits(p_region)).
const { lireSaisons, ligneMois, LEGENDE } = require('./site-produits.js').outils;
const LISTE = require('./site-produits.js').LISTE;
const BASE = 'https://stan77i.github.io/marchedegrosci/site/';
// « district d'Abidjan », « du Zanzan », « des Savanes »… (noms officiels des districts)
const DU = { abidjan: 'le district autonome d’Abidjan', yamoussoukro: 'le district autonome de Yamoussoukro', 'bas-sassandra': 'le district du Bas-Sassandra', comoe: 'le district de la Comoé',
  denguele: 'le district du Denguélé', 'goh-djiboua': 'le district du Gôh-Djiboua', lacs: 'le district des Lacs', lagunes: 'le district des Lagunes', montagnes: 'le district des Montagnes',
  'sassandra-marahoue': 'le district du Sassandra-Marahoué', savanes: 'le district des Savanes', 'vallee-du-bandama': 'le district de la Vallée du Bandama', woroba: 'le district du Woroba', zanzan: 'le district du Zanzan' };
const CHEF = { abidjan: 'Abidjan', yamoussoukro: 'Yamoussoukro', 'bas-sassandra': 'San-Pédro', comoe: 'Abengourou', denguele: 'Odienné', 'goh-djiboua': 'Gagnoa', lacs: 'Dimbokro', lagunes: 'Dabou',
  montagnes: 'Man', 'sassandra-marahoue': 'Daloa', savanes: 'Korhogo', 'vallee-du-bandama': 'Bouaké', woroba: 'Séguéla', zanzan: 'Bondoukou' };
// les marchés de gros du guide (sourcés là-bas) qui se trouvent dans le district
const MARCHE = { abidjan: 'le marché Gouro d’Adjamé et les dépôts d’igname d’Abidjan', 'vallee-du-bandama': 'le marché de gros de Bouaké', 'sassandra-marahoue': 'le futur marché de gros de Daloa (annoncé)', comoe: 'le futur marché de gros d’Abengourou (annoncé)' };

function fabriquer({ NOM, esc, lire, vm, photo }) {
  const L = lireSaisons(lire, vm), { SA, SRC, REGN, zones } = L;
  const E = SA.entries.filter(e => SRC[e.source] && NOM[e.product]);
  const ids = Object.keys(DU).filter(r => REGN[r]);
  const pages = ids.map(r => {
    const nom = REGN[r], dans = DU[r].replace(/^le /, 'dans le ');
    // seulement les entrées qui nomment le district (une période donnée pour tout le pays ne dit pas ce qui pousse ici)
    const ici = E.filter(e => e.regions.flatMap(zones).includes(r));
    const prods = [...new Set(ici.map(e => e.product))];
    const recoltes = prods.map(sl => {
      const n = NOM[sl], lien = LISTE.includes(sl) ? `../../produits/${sl}/` : '';
      const im = photo(sl) ? `<img src="../../img/${sl}-160.webp" alt="" width="64" height="64" loading="lazy">` : '';
      const mo = {}; ici.filter(e => e.product === sl).forEach(e => Object.entries(e.months).forEach(([m, l]) => { if (!mo[m] || l === 'plein') mo[m] = l; }));
      return `<section class="cal-p" aria-labelledby="cal-${sl}" data-mois='${JSON.stringify(mo)}' data-nom="${esc(n)}"${lien ? ` data-lien="${lien}"` : ''}><h3 id="cal-${sl}">${im}<span>${lien ? `<a href="${lien}">${esc(n)}</a>` : esc(n)}</span></h3>
      ${ici.filter(e => e.product === sl).map(e => ligneMois(e, n, L, esc)).join('')}</section>`;
    }).join('');
    const titre = `Vivrier en gros ${dans} (${CHEF[r]}) : annonces, prix, récoltes · Marché de Gros CI`;
    const desc = `Acheter ou vendre du vivrier en gros ${dans}, autour de ${CHEF[r]} : annonces et meilleurs prix publiés en direct, et ce qui s’y récolte selon des sources publiques.`;
    const canon = BASE + 'regions/' + r + '/';
    const fil = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Marché de Gros CI', item: BASE }, { '@type': 'ListItem', position: 2, name: 'Les districts', item: BASE + 'regions/' }, { '@type': 'ListItem', position: 3, name: nom, item: canon }] };
    return { r, nom, nbProd: prods.length, v: {
      REGION: r, NOM: esc(nom), CHEF: esc(CHEF[r]), DANS: esc(dans), TITRE: esc(titre), DESCRIPTION: esc(desc), CANON: canon, JSONLD_FIL: JSON.stringify(fil).replace(/</g, '\\u003c'),
      MARCHE: MARCHE[r] ? `<p class="pr-sous">On y trouve ${esc(MARCHE[r])} : voir <a href="../../guides/grands-marches-de-gros/">les grands marchés de gros du vivrier</a>.</p>` : '',
      RECOLTES: prods.length ? recoltes + LEGENDE : '<p>Aucune période de récolte sourcée pour ce district pour l’instant.</p>',
      NB_RECOLTES: String(prods.length),
      ETAL: prods.filter(photo).slice(0, 6).map(sl => `<li><img src="../../img/${sl}-480.webp" alt="" width="160" height="160" loading="lazy"><span>${esc(NOM[sl])}</span></li>`).join(''),
      AUTRES: ids.filter(x => x !== r).map(x => `<a href="../${x}/">${esc(REGN[x])}</a>`).join('') } };
  });
  const sommaire = pages.map(p => `<li><a href="${p.r}/"><b>${esc(p.nom)}</b>${CHEF[p.r] !== p.nom ? `<small>Chef-lieu : ${esc(CHEF[p.r])}</small>` : ''}<small><span class="nbul">${p.nbProd}</span> produits au calendrier</small></a></li>`).join('');
  return { pages, sommaire };
}
module.exports = fabriquer;
