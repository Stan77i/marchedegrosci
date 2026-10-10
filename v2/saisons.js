// Marché de Gros CI — « L'année du marché » : ce qui se récolte, où et quand, raconté sur la carte du réseau (v2/reseau-carte.js, même carte, même code).
// Chaque entrée (produit, régions, mois) renvoie à une source publique de meta.sources. Une entrée sans source valide n'est jamais affichée.
// Intensités qualitatives seulement : debut / plein / fin. Aucun tonnage, aucun prix.
export const SAISONS = {
  meta: {
    updated: '2026-10-04',
    note: 'Calendrier indicatif : il varie selon les pluies et les régions.',
    zonesNote: 'Nord (une saison des pluies) et Centre-Sud (deux saisons) : rattachement des districts simplifié par le site, à valider avec les agents terrain.',
    zones: { nord: ['savanes', 'denguele', 'zanzan', 'woroba'], 'centre-sud': ['vallee-du-bandama', 'lacs', 'yamoussoukro', 'lagunes', 'comoe', 'goh-djiboua', 'bas-sassandra', 'sassandra-marahoue', 'montagnes'] },
    sources: [
      { id: 'giews-2024', label: 'FAO GIEWS, Côte d\u2019Ivoire (déc. 2024)', url: 'https://www.fao.org/giews/countrybrief/country.jsp?code=CIV' },
      { id: 'giews-2022', label: 'FAO GIEWS, Côte d\u2019Ivoire (oct. 2022)', url: 'https://www.fao.org/giews/countrybrief/country/CIV/pdf_archive/CIV_Archive.pdf' },
      { id: 'fews-2026', label: 'FEWS NET, perspectives août 2026', url: 'https://fews.net/fr/west-africa/cote-divoire/perspectives-sur-la-securite-alimentaire/aout-2026' },
      { id: 'idessa-igname', label: 'IDESSA Bouaké, stockage de l\u2019igname au nord (1997)', url: 'https://www.biw.kuleuven.be/aee/clo/idessa_files/Stessens1997.pdf' },
      { id: 'bouake-igname', label: 'Marché de gros d\u2019ignames de Bouaké (Le Banco)', url: 'https://lebanco.net/news/49951-cote-divoire-filiere-igname-il-ne-peut-pas-y-avoir-de-penurie-sg-marche-de-gros.html' },
      { id: 'aip-mangue', label: 'AIP, campagne mangue 2026', url: 'https://www.aip.ci/332817/cote-divoire-aip-filiere-mangue-le-prix-bord-champ-maintenu-a-2-450-fcfa-la-caisse-pour-la-campagne-2026/' },
      { id: 'hortifresh-mangue', label: 'Guide de production de la mangue (HortiFresh, 2022)', url: 'https://www.hortifresh.org/wp-content/uploads/MangoProduction_2022_online.pdf' },
      { id: 'aip-niakara', label: 'AIP, mangue de Niakara (avr. 2026)', url: 'https://www.aip.ci/348621/cote-divoire-aip-filiere-mangue-un-calendrier-de-commercialisation-juge-defavorable-aux-zones-precoces-de-niakara/' },
      { id: 'cajou-2026', label: 'Conseil coton-anacarde, campagne cajou 2026 (KOACI)', url: 'https://www.koaci.com/article/2026/02/17/cote-divoire/economie/cote-divoire-noix-de-cajou-brute-les-differents-prix-planchers-obligatoires-fixes-et-les-dispositions-presentees_194450.html' },
      { id: 'ccc-calendrier', label: 'Conseil café-cacao, nouveau calendrier (Africa Radio)', url: 'https://www.africaradio.com/actualite-116217-cote-d-ivoire-68-unites-mobilisees-pour-la-nouvelle-campagne-cafe-cacao' },
      { id: 'aip-daloa', label: 'AIP, lancement à Daloa', url: 'https://www.aip.ci/cote-divoire-aip-la-campagne-cafe-cacao-2026-2027-lancee-a-daloa-sous-le-signe-du-respect-des-prix-et-de-la-tracabilite/' },
      { id: 'aip-gagnoa', label: 'AIP, lancement à Gagnoa', url: 'https://www.aip.ci/cote-divoire-aip-campagne-cafe-cacao-2026-2027-le-conseil-presente-les-nouvelles-dispositions-de-la-commercialisation/' },
      { id: 'aip-agboville', label: 'AIP, lancement à Agboville', url: 'https://www.aip.ci/cote-divoire-aip-agboville-la-campagne-cafe-cacao-2026-2027-placee-sous-le-signe-de-la-tracabilite-et-de-la-lutte-contre-la-fraude/' },
      { id: 'aip-duekoue', label: 'AIP, lancement à Duékoué', url: 'https://www.aip.ci/cote-divoire-aip-cafe-cacao-les-acteurs-du-guemon-et-du-cavally-sensibilises-aux-exigences-de-la-campagne-2026-2027/' },
    ],
  },
  entries: [
    // igname : vraies fenêtres de récolte (avant : 12 mois « plein », qui décrivaient l'offre au marché de Bouaké, pas la récolte)
    { product: 'igname', regions: ['vallee-du-bandama', 'zanzan', 'savanes'], months: { 8: 'debut', 9: 'plein', 10: 'plein' }, note: 'précoces : wacrou, kponan, assawa', source: 'idessa-igname' },
    { product: 'igname', regions: ['vallee-du-bandama', 'zanzan', 'savanes'], months: { 12: 'debut', 1: 'plein', 2: 'plein', 3: 'fin' }, note: 'tardives : krenglè, bêtê-bêtê, florido', source: 'idessa-igname' },
    { product: 'mais-frais-epis', regions: ['zone:centre-sud'], months: { 8: 'debut', 9: 'plein' }, source: 'fews-2026' },
    { product: 'mais-grain', regions: ['zone:centre-sud'], months: { 12: 'plein', 1: 'fin' }, note: 'seconde récolte, surtout au sud', source: 'giews-2022' },
    { product: 'mais-grain', regions: ['zone:nord'], months: { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, source: 'giews-2024' },
    { product: 'riz-local', regions: ['zone:nord'], months: { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, source: 'giews-2022' },
    { product: 'mil', regions: ['zone:nord'], months: { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, source: 'giews-2022' },
    { product: 'sorgho', regions: ['zone:nord'], months: { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, source: 'giews-2022' },
    { product: 'mangue', regions: ['savanes', 'denguele'], months: { 3: 'debut', 4: 'plein', 5: 'plein', 6: 'fin' }, note: 'ouverture fin mars (28 mars en 2026)', source: 'aip-mangue' },
    { product: 'mangue', regions: ['savanes', 'denguele'], months: { 4: 'plein', 5: 'plein', 6: 'fin' }, note: 'Kent : mi-avril à début juin', source: 'hortifresh-mangue' },
    { product: 'mangue', regions: ['vallee-du-bandama'], months: { 3: 'debut', 4: 'plein' }, note: 'zones précoces : Niakara, Tafiré', source: 'aip-niakara' },
    { product: 'noix-de-cajou', regions: [], months: { 2: 'debut', 3: 'debut' }, note: 'campagne ouverte le 9 février 2026', source: 'cajou-2026' },
    { product: 'cacao-en-feves', regions: [], months: { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, note: 'grande campagne : 1er septembre au 28 février', source: 'ccc-calendrier' },
    { product: 'cacao-en-feves', regions: ['sassandra-marahoue'], months: { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, source: 'aip-daloa' },
    { product: 'cacao-en-feves', regions: ['goh-djiboua'], months: { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, source: 'aip-gagnoa' },
    { product: 'cacao-en-feves', regions: ['lagunes'], months: { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, source: 'aip-agboville' },
    { product: 'cacao-en-feves', regions: ['montagnes'], months: { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, source: 'aip-duekoue' },
    { product: 'cafe-en-grains', regions: ['sassandra-marahoue', 'goh-djiboua', 'lagunes', 'montagnes'], months: { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, note: 'même campagne que le cacao', source: 'ccc-calendrier' },
  ],
};

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const INI = 'JFMAMJJASOND';
const RANK = { plein: 3, debut: 2, fin: 1 }, LAB = { plein: 'pleine récolte', debut: 'début', fin: 'fin' };
const GROUPS = [['plein', 'En pleine récolte'], ['debut', 'Ça commence'], ['fin', 'Ça se termine']];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b) => `${n} ${n > 1 ? b : a}`;
const mod12 = m => ((m - 1) % 12 + 12) % 12 + 1;

// Validation (aussi exposée pour les tests) : source connue, produit du catalogue, régions connues
export function validate(prodBy, regBy) {
  const src = new Set(SAISONS.meta.sources.map(s => s.id)), Z = SAISONS.meta.zones, errs = [];
  const entries = SAISONS.entries.map(e => ({ ...e, regions: e.regions.flatMap(r => r.startsWith('zone:') ? Z[r.slice(5)] || ['?' + r] : [r]) })).filter(e => {
    const bad = !src.has(e.source) ? 'source' : !prodBy[e.product] ? 'produit' : e.regions.find(r => !regBy[r]) ? 'région' : e.demo ? 'demo' : null;
    if (bad) errs.push(`${e.product} : ${bad}`); return !bad;
  });
  return { entries, errs };
}

// Monté dans « Le marché, en réseau » : même section, même carte. L'interrupteur bascule entre le réseau du produit et l'année du marché.
export function mount(host, X) {
  const { entries: E, errs } = validate(X.prodBy, X.regBy); if (errs.length) console.warn('[saisons] entrées écartées', errs);
  const $ = q => host.querySelector(q), reduced = X.reduced;
  const PRODS = [...new Set(E.map(e => e.product))];
  const qsM = +new URLSearchParams(location.search).get('mois'), today = qsM >= 1 && qsM <= 12 ? qsM : new Date().getMonth() + 1;
  let month = today; try { const v = +sessionStorage.getItem('mdg-v2:saison'); if (v >= 1 && v <= 12) month = v; } catch (_) {}
  let focus = null, prevLight = null, on = false;

  const at = (slug, m) => {
    const es = E.filter(e => e.product === slug && e.months[m]); if (!es.length) return null;
    const lvl = es.reduce((a, e) => RANK[e.months[m]] > RANK[a] ? e.months[m] : a, 'fin');
    return { slug, lvl, regions: [...new Set(es.flatMap(e => e.regions))], notes: [...new Set(es.filter(e => e.months[m]).map(e => e.note).filter(Boolean))] };
  };
  const allItems = m => PRODS.map(p => at(p, m)).filter(Boolean).sort((a, b) => RANK[b.lvl] - RANK[a.lvl] || X.offersOf(b.slug).length - X.offersOf(a.slug).length);
  const items = m => allItems(m).filter(x => !focus || x.slug === focus);
  const offersIn = (slug, regions) => X.offersOf(slug).filter(o => !regions.length || regions.includes(o.regionSlug));
  const strength = m => { if (focus) { const a = at(focus, m); return a ? RANK[a.lvl] : 0; } return PRODS.reduce((n, p) => { const a = at(p, m); return n + (a ? RANK[a.lvl] : 0); }, 0); };
  const pname = s => X.prodBy[s].name, low = s => pname(s).toLowerCase();
  const rnames = rs => rs.length ? rs.slice(0, 3).map(r => X.regBy[r].name).join(', ') + (rs.length > 3 ? '…' : '') : 'tout le pays';

  /* ——— Les douze mois : une ligne, l'intensité de la saison sous chaque mois ——— */
  const frise = $('#snFrise');
  frise.innerHTML = MOIS.map((n, i) => '<button type="button" role="radio" data-m="' + (i + 1) + '" aria-label="' + cap(n) + '"><span class="f">' + cap(n) + '</span><span class="i" aria-hidden="true">' + INI[i] + '</span><i class="tr" aria-hidden="true"></i></button>').join('');
  const fb = [...frise.children];
  const scrolls = () => frise.scrollWidth > frise.clientWidth + 4;
  function syncFrise(smooth) { const b = fb[month - 1]; if (!b || !frise.offsetParent || !scrolls()) return; frise.scrollTo({ left: b.offsetLeft - (frise.clientWidth - b.offsetWidth) / 2, behavior: smooth && !reduced ? 'smooth' : 'auto' }); }
  fb.forEach(b => b.onclick = () => { setMonth(+b.dataset.m, 'frise'); syncFrise(true); });
  frise.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault(); setMonth(mod12(month + k), 'key'); fb[month - 1].focus(); syncFrise(true); });
  let fT = 0;
  frise.addEventListener('scroll', () => { if (!scrolls()) return; clearTimeout(fT); fT = setTimeout(() => { const c = frise.scrollLeft + frise.clientWidth / 2; let best = null, bd = 1e9; fb.forEach(b => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - c); if (d < bd) { bd = d; best = b; } }); if (best && +best.dataset.m !== month) setMonth(+best.dataset.m, 'frise'); }, 110); }, { passive: true });
  function paintTrace() { const max = Math.max(1, ...fb.map((_, i) => strength(i + 1))); fb.forEach((b, i) => { const v = strength(i + 1) / max, t = b.querySelector('.tr'); t.style.opacity = v ? (.3 + .7 * v).toFixed(2) : 0; t.style.height = v ? (1.5 + 2.5 * v).toFixed(1) + 'px' : '0'; }); }

  /* ——— Ce qui est utile : le mois en une phrase, le bassin le plus actif, ce que la carte allume ——— */
  const title = $('#snTitle'), lede = $('#snLede'), best = $('#snBest'), mapLine = $('#snMapLine'), act = $('#snAct'), vig = $('#snVig'), live = $('#snLive');
  function setLede(txt) {
    lede.classList.remove('run'); lede.innerHTML = '<span>' + txt + '</span>';
    // trop long pour la colonne : le texte passe, lentement, sans saturer (arrêt au survol, statique si mouvement réduit)
    requestAnimationFrame(() => { if (reduced || !lede.clientWidth) return; lede.style.whiteSpace = 'nowrap'; const w = lede.scrollWidth, cw = lede.clientWidth; lede.style.whiteSpace = ''; if (w > cw * 1.9) { lede.classList.add('run'); lede.innerHTML = '<span>' + txt + '</span><span aria-hidden="true">' + txt + '</span>'; lede.style.setProperty('--d', Math.round(w / 40) + 's'); } });
  }
  function lit() {
    const it = items(month), hl = new Set(), labels = {}, byReg = {};
    it.forEach(x => offersIn(x.slug, x.regions).forEach(o => { hl.add(o.producerId); byReg[o.regionSlug] = (byReg[o.regionSlug] || 0) + RANK[x.lvl]; const L = labels[o.producerId]; labels[o.producerId] = { t: o.city, s: L ? L.s + ' · ' + pname(x.slug) : pname(x.slug) + ' · ' + LAB[x.lvl] }; }));
    it.forEach(x => x.regions.forEach(r => { byReg[r] = (byReg[r] || 0) + RANK[x.lvl] * .01; }));
    return { it, hl, labels, region: Object.entries(byReg).sort((p, q) => q[1] - p[1]).map(e => e[0])[0] || null };
  }
  function render() {
    const L = lit(), it = L.it, M = MOIS[month - 1];
    if (focus) {
      const a = at(focus, month);
      title.innerHTML = '<em>' + esc(pname(focus)) + '</em> : ' + (a ? LAB[a.lvl] + ' en ' + M + '.' : 'hors saison en ' + M + '.');
      const mm = [...Array(12)].map((_, i) => at(focus, i + 1)).map((x, i) => x ? MOIS[i] : null).filter(Boolean);
      setLede(a ? 'Récolté en ' + esc(rnames(a.regions)) + (a.notes.length ? ' · ' + esc(a.notes.join(' · ')) : '') + '. Saison : ' + esc(mm[0]) + ' → ' + esc(mm[mm.length - 1]) + '.' : 'D\u2019après nos sources, sa saison va de ' + esc(mm[0] || '?') + ' à ' + esc(mm[mm.length - 1] || '?') + '. Choisissez un de ces mois.');
    } else {
      title.innerHTML = '<em>' + cap(M) + '</em> : ' + (it.length ? plural(it.length, 'produit en récolte.', 'produits en récolte.') : 'rien de sourcé.');
      setLede(it.length ? '' : 'Aucun calendrier public trouvé pour ce mois. Les agents terrain compléteront.');
    }
    // le bassin le plus actif (ou les producteurs du produit choisi)
    const r = L.region, ri = r ? it.filter(x => x.regions.includes(r)) : [], top = (ri[0] || it[0]), n = r ? ri.reduce((s, x) => s + offersIn(x.slug, [r]).length, 0) : 0, im = top && X.img(top.slug);
    lede.hidden = !lede.textContent.trim();
    best.hidden = !top; void im;
    if (top) best.innerHTML = '<div class="sn-bt"><span class="sn-bk">' + (focus ? 'Où le trouver' : 'Bassin le plus actif') + '</span></div><b>' + esc(r ? X.regBy[r].name : 'Tout le pays') + '</b><ul class="sn-bs"><li><strong>' + (n || 0) + '</strong>' + (n > 1 ? 'offres' : 'offre') + '</li><li><strong>' + L.hl.size + '</strong>' + (L.hl.size > 1 ? 'producteurs sur la carte' : 'producteur sur la carte') + '</li></ul>';
    mapLine.hidden = !!top; mapLine.innerHTML = L.hl.size ? 'Sur la carte : <b>' + plural(L.hl.size, 'producteur du site', 'producteurs du site') + '</b> ' + (L.hl.size > 1 ? 's\u2019allument' : 's\u2019allume') + ' ; les fils relient leurs offres aux demandes.' : 'Sur la carte : aucun producteur du site ne propose encore ' + (focus ? 'ce produit.' : 'ces produits.');
    const tp = focus || (top && top.slug);
    act.innerHTML = tp ? (X.offersOf(tp).length ? '<a class="tj-btn sn-go" href="#/produits/' + tp + '"><span><small>Voir les offres</small>' + esc(pname(tp)) + '</span><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></a>' : '<a class="tj-btn sn-go" href="#/vendre?p=' + tp + '"><span><small>Vous en produisez ?</small>Publier une offre</span><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></a>') + '<a class="tj-btn sn-ask" href="#/demande?p=' + tp + '">Publier une demande</a>' + (focus ? '<button type="button" class="tj-link sn-allb" id="snAll">Tout le marché</button>' : '') : '';
    const all = $('#snAll'); if (all) all.onclick = () => setFocus(null);
    // vignettes : les produits du mois, un toucher = suivre sa saison
    let list = allItems(month); if (focus && !list.some(x => x.slug === focus)) list = [{ slug: focus, lvl: null }, ...list];
    const chip = x => { const im2 = X.img(x.slug), k = X.offersOf(x.slug).length, nm = pname(x.slug); return '<button type="button" role="listitem" class="sn-v' + (x.lvl ? '' : ' off') + '" data-s="' + x.slug + '" aria-pressed="' + (focus === x.slug) + '" aria-label="' + esc(nm) + ' : ' + (x.lvl ? LAB[x.lvl] : 'hors saison') + ', ' + plural(k, 'offre', 'offres') + '">'
      + '<span class="sn-vi">' + (im2 ? '<img src="' + im2 + '" alt="" loading="lazy">' : '<i>' + esc(nm.charAt(0)) + '</i>') + '</span><span class="sn-vn">' + esc(nm) + '</span>' + (k ? '<b>' + k + '</b>' : '') + '</button>'; };
    const grp = [...GROUPS.map(([k, t]) => [t, list.filter(x => x.lvl === k)]), ['Hors saison', list.filter(x => !x.lvl)]].filter(g => g[1].length);
    vig.innerHTML = grp.map(([t, g]) => '<div class="sn-g"><p class="sn-gt">' + t + '<span>' + g.length + '</span></p><div class="sn-gl">' + g.map(chip).join('') + '</div></div>').join('');
    vig.querySelectorAll('.sn-v').forEach(b => b.onclick = () => setFocus(b.dataset.s === focus ? null : b.dataset.s));
    if (on) X.show({ hl: L.hl, products: new Set(it.map(x => x.slug)), labels: L.labels, region: L.region, fit: !!focus });
  }
  let liveT = 0;
  function speak() { clearTimeout(liveT); liveT = setTimeout(() => { if (on) live.textContent = title.textContent + ' ' + lede.firstChild.textContent; }, 400); }

  /* ——— « ? » : le principe, en pop-up ——— */
  const info = $('#snInfo'), pop = $('#snPop');
  const openPop = v => { pop.hidden = !v; info.setAttribute('aria-expanded', v); };
  info.onclick = e => { e.stopPropagation(); openPop(pop.hidden); };
  const outside = e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== info) openPop(false); };
  document.addEventListener('click', outside);

  /* ——— Sources et régions (repliées) ——— */
  const panel = $('#snPanel'), srcB = $('#snSrcB');
  $('#snSrcNote').textContent = SAISONS.meta.note + ' ' + SAISONS.meta.zonesNote;
  $('#snSrcList').innerHTML = SAISONS.meta.sources.filter(x => E.some(e => e.source === x.id)).map(x => '<li><a href="' + x.url + '" target="_blank" rel="noopener">' + esc(x.label) + '</a></li>').join('');
  const REGS = [...new Set(E.flatMap(e => e.regions))].sort((a, b) => X.regBy[a].name.localeCompare(X.regBy[b].name, 'fr'));
  $('#snRegs').innerHTML = REGS.map(r => '<button type="button" class="sn-rb" data-r="' + r + '">' + esc(X.regBy[r].name) + '</button>').join('');
  const fiche = $('#snReg');
  $('#snRegs').querySelectorAll('.sn-rb').forEach(b => b.onclick = () => {
    const r = b.dataset.r, its = items(month).filter(x => x.regions.includes(r)), n = its.reduce((a, x) => a + offersIn(x.slug, [r]).length, 0);
    fiche.hidden = false; fiche.innerHTML = '<b>' + esc(X.regBy[r].name) + '</b><p>' + (its.length ? cap(MOIS[month - 1]) + ' : ' + its.map(x => esc(low(x.slug)) + ' (' + LAB[x.lvl] + ')').join(', ') + '.' : 'Rien de sourcé en ' + MOIS[month - 1] + '.') + '</p><p>' + (n ? plural(n, 'offre sur le site', 'offres sur le site') : 'Aucune offre encore.') + '</p>';
    if (on) X.zone(r);
  });
  const openPanel = v => { panel.hidden = !v; srcB.setAttribute('aria-expanded', v); if (v) panel.querySelector('button').focus(); else srcB.focus(); };
  srcB.onclick = () => openPanel(panel.hidden); $('#snPanelX').onclick = () => openPanel(false);
  const onKey = e => { if (e.key !== 'Escape') return; if (!panel.hidden) openPanel(false); if (!pop.hidden) openPop(false); };
  addEventListener('keydown', onKey);

  function setMonth(m, from) {
    if (m === month && from !== 'init') return; month = m;
    try { sessionStorage.setItem('mdg-v2:saison', String(m)); } catch (_) {}
    fb.forEach(b => { const sel = +b.dataset.m === m; b.setAttribute('aria-checked', sel); b.tabIndex = sel ? 0 : -1; b.classList.toggle('now', +b.dataset.m === today); });
    if (from === 'frise') { try { navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive && navigator.vibrate(8); } catch (_) {} }
    render(); speak();
  }
  function setFocus(slug) {
    if (slug && !focus) prevLight = X.LIGHT.slug;
    focus = slug;
    if (slug) X.LIGHT.set(slug, 'saisons'); else if (prevLight) X.LIGHT.set(prevLight, 'saisons');
    paintTrace(); render(); speak();
  }
  setMonth(month, 'init'); paintTrace();

  return {
    activate(quiet) { on = true; render(); if (quiet) return; speak(); requestAnimationFrame(() => syncFrise(false)); },
    deactivate() { on = false; openPop(false); panel.hidden = true; if (focus) { const p = prevLight; focus = null; prevLight = null; if (p) X.LIGHT.set(p, 'saisons'); paintTrace(); render(); } },
    setMonth: m => setMonth(m, 'key'), get month() { return month; }, get focus() { return focus; }, get on() { return on; }, setFocus,
    off() { removeEventListener('keydown', onKey); document.removeEventListener('click', outside); },
  };
}
