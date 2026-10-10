/* ═════════ Marché de Gros — Recherche (loupe de l'en-tête) ═════════
   Une seule boîte qui comprend une phrase : produit (nom local, faute légère), intention (j'ai / je cherche / prix),
   quantité, lieu. Elle propose l'action utile tout de suite : J'ai / Je cherche, la fiche, la carte du lieu,
   la famille, la page ou le mois. Vide : recherches récentes et produits en récolte ce mois-ci (sources de v2/saisons.js).
   Aucune donnée inventée : les compteurs n'apparaissent que s'ils ne valent pas zéro.
   Ouverture : loupe, « / », Ctrl/⌘ K. Échap ferme. ↑ ↓ Entrée. */
(function () {
  'use strict';
  const CX = () => window.MDGCTX, MK = () => window.MDGMarche;
  const RK = 'mdg-v2:recherches';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const PAGES = [
    ['Accueil', '#/', 'accueil debut maison'], ['Acheter', '#/catalogue', 'acheter achat disponible offres'],
    ['Vendre', '#/vendre', 'vendre vente publier offre'], ['Demander', '#/demande', 'demander demande besoin'],
    ['Catégories', '#/categories', 'categories familles'], ['Carte du marché', '#/carte', 'carte territoire reseau autour'],
    ['Prix du marché', '#/prix', 'prix tarif cout combien'], ['L’année du marché', '#/annee', 'annee saisons calendrier recolte soudure'],
  ];
  // chefs-lieux et grandes villes → district (référence administrative), pour comprendre « à Bouaké »
  const VILLES = { 'bouake': 'vallee-du-bandama', 'katiola': 'vallee-du-bandama', 'san pedro': 'bas-sassandra', 'soubre': 'bas-sassandra', 'sassandra': 'bas-sassandra', 'abengourou': 'comoe', 'aboisso': 'comoe', 'grand bassam': 'comoe', 'odienne': 'denguele', 'gagnoa': 'goh-djiboua', 'divo': 'goh-djiboua', 'lakota': 'goh-djiboua', 'dimbokro': 'lacs', 'toumodi': 'lacs', 'bongouanou': 'lacs', 'daoukro': 'lacs', 'dabou': 'lagunes', 'agboville': 'lagunes', 'adzope': 'lagunes', 'tiassale': 'lagunes', 'man': 'montagnes', 'duekoue': 'montagnes', 'guiglo': 'montagnes', 'danane': 'montagnes', 'daloa': 'sassandra-marahoue', 'bouafle': 'sassandra-marahoue', 'sinfra': 'sassandra-marahoue', 'issia': 'sassandra-marahoue', 'korhogo': 'savanes', 'ferkessedougou': 'savanes', 'boundiali': 'savanes', 'seguela': 'woroba', 'touba': 'woroba', 'mankono': 'woroba', 'bondoukou': 'zanzan', 'bouna': 'zanzan', 'tanda': 'zanzan', 'abidjan': 'abidjan', 'yamoussoukro': 'yamoussoukro' };
  const VNOM = { 'san pedro': 'San-Pédro', 'grand bassam': 'Grand-Bassam' };
  const ville = (C, t) => { const w = ' ' + t.replace(/[^a-z0-9]+/g, ' ') + ' '; for (const k in VILLES) if (w.includes(' ' + k + ' ')) { const r = C.regBy[VILLES[k]]; const nm = VNOM[k] || C.S.normalizeText(r.name) === k && r.name || k[0].toUpperCase() + k.slice(1); return { name: nm.replace('Bouake', 'Bouaké').replace('Seguela', 'Séguéla').replace('Odienne', 'Odienné').replace('Duekoue', 'Duékoué').replace('Daloa', 'Daloa').replace('Ferkessedougou', 'Ferkessédougou').replace('Adzope', 'Adzopé').replace('Bouafle', 'Bouaflé').replace('Soubre', 'Soubré').replace('Tiassale', 'Tiassalé').replace('Danane', 'Danané'), kind: 'ville', regionSlug: r.slug, regionName: r.name }; } return null; };
  const INT = { acheter: 'Je cherche', vendre: 'J’ai', prix: 'Prix' };
  let od, inp, list, und, pv, ghost, rows = [], sel = -1, last = null, season = null, smap = {}, opener = null, scope = 'all', curQ = '', ghostTxt = '';
  const SCOPES = [['all', 'Tout'], ['prod', 'Produits'], ['lieu', 'Lieux'], ['pages', 'Pages']];
  const ABR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // met en valeur la partie tapée dans le nom (sans accents ni casse)
  const hl = (name, q) => { const n = N(name), t = N(q).trim(); if (t.length < 2) return esc(name); const w = t.split(/\s+/).filter(x => x.length > 1).sort((a, b) => b.length - a.length); for (const x of w) { const i = n.indexOf(x); if (i >= 0) return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + x.length)) + '</mark>' + esc(name.slice(i + x.length)); } return esc(name); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const N = s => (CX() ? CX().S.normalizeText(s) : String(s).toLowerCase());
  const recents = () => { try { return JSON.parse(localStorage.getItem(RK) || '[]'); } catch (_) { return []; } };
  const remember = v => { v = v.trim(); if (v.length < 2) return; try { localStorage.setItem(RK, JSON.stringify([v, ...recents().filter(x => N(x) !== N(v))].slice(0, 5))); } catch (_) {} };
  const ICO = {
    s: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/></svg>',
    go: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 10h16M9 3.5v4M15 3.5v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    fam: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  };

  function build() {
    od = document.createElement('div'); od.className = 'sx'; od.hidden = true;
    od.innerHTML = `<div class="sx__bk" data-x></div>
      <section class="sx__card" role="dialog" aria-modal="true" aria-label="Rechercher dans le marché">
        <div class="sx__bar"><span class="sx__i">${ICO.s}</span>
          <span class="sx__f"><span class="sx__ghost" aria-hidden="true"></span><input class="sx__in" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="true" aria-controls="sxL" aria-autocomplete="list"
            placeholder="Un produit, un lieu, ou une phrase" aria-label="Rechercher"></span>
          <button type="button" class="sx__mic" hidden aria-label="Dicter la recherche" aria-pressed="false">${ICO.mic}</button>
          <button type="button" class="sx__x" data-x aria-label="Fermer"><span>Échap</span></button></div>
        <p class="sx__und" aria-live="polite"></p>
        <div class="sx__sc" role="group" aria-label="Filtrer les résultats">${SCOPES.map(([k, l]) => `<button type="button" data-sc="${k}" aria-pressed="${k === 'all'}">${l}<span></span></button>`).join('')}</div>
        <div class="sx__body"><div class="sx__list" id="sxL" role="listbox" aria-label="Résultats"></div><aside class="sx__pv" aria-live="polite"></aside></div>
        <p class="sx__foot"><span>Essayez « je cherche 10 sacs d’igname à Bouaké » ou « j’ai du piment ».</span><span class="sx__keys"><kbd>↑</kbd><kbd>↓</kbd> choisir · <kbd>Tab</kbd> compléter · <kbd>Entrée</kbd> ouvrir</span></p>
      </section>`;
    document.body.appendChild(od);
    inp = od.querySelector('.sx__in'); list = od.querySelector('.sx__list'); und = od.querySelector('.sx__und'); pv = od.querySelector('.sx__pv'); ghost = od.querySelector('.sx__ghost');
    od.querySelector('.sx__sc').addEventListener('click', e => { const b = e.target.closest('[data-sc]'); if (!b) return; scope = b.dataset.sc; render(); inp.focus(); });
    pv.addEventListener('click', e => { const b = e.target.closest('[data-pv]'); if (!b) return; const r = rows[sel]; if (!r) return; if (b.dataset.pv === 'carte') { remember(inp.value || CX().prodBy[r.slug].name); close(); CX().go('#/carte?q=' + encodeURIComponent(CX().prodBy[r.slug].name)); } else run(r, b.dataset.pv); });
    // dictée (français), si le navigateur la propose
    const mic = od.querySelector('.sx__mic');
    if (SR) { mic.hidden = false; let rec = null;
      mic.addEventListener('click', () => {
        if (rec) { rec.stop(); return; }
        rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = true; rec.maxAlternatives = 1;
        mic.setAttribute('aria-pressed', 'true'); od.classList.add('is-listening'); inp.placeholder = 'Je vous écoute…';
        rec.onresult = ev => { inp.value = [...ev.results].map(r => r[0].transcript).join(' '); render(); };
        rec.onend = rec.onerror = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); od.classList.remove('is-listening'); inp.placeholder = 'Un produit, un lieu, ou une phrase'; inp.focus(); };
        try { rec.start(); } catch (_) { rec.onend(); }
      });
    }
    od.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); });
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', key);
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault();
      run(rows[+b.dataset.i], b.dataset.act, b);
    });
    list.addEventListener('mousemove', e => { const r = e.target.closest('.sx__row'); if (r && +r.dataset.i !== sel) mark(+r.dataset.i, false); });
    od.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = [...od.querySelectorAll('input,button,[tabindex="0"]')].filter(x => !x.hidden && x.offsetParent);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }

  function loadSeason() {
    if (season) return;
    season = [];
    import(new URL('v2/saisons.js', document.baseURI).href).then(m => {
      const C = CX(), mo = new Date().getMonth() + 1;
      const all = m.validate(C.prodBy, C.regBy).entries.filter(e => C.prodBy[e.product]);
      all.forEach(e => { const z = smap[e.product] ||= {}; Object.keys(e.months).forEach(k => { z[k] = e.months[k] === 'plein' || z[k] === 'plein' ? 'plein' : 'part'; }); });
      const ent = all.filter(e => e.months[mo]);
      season = [...new Set(ent.map(e => e.product))];
      if (od && !od.hidden && !inp.value.trim()) render();
    }).catch(() => {});
  }

  function productRow(C, slug, p) {
    const x = C.prodBy[slug], o = C.offersOf(slug).length, d = C.demandsOf(slug).length, im = C.img(slug);
    const meta = [C.catBy[x.categorySlug].name];
    if (p && p.matched && !N(x.name).includes(N(p.matched))) meta.unshift('« ' + p.matched + ' »');
    return { k: 'prod', slug, h: `<span class="sx__th">${im ? `<img src="${im}" alt="" loading="lazy">` : `<b>${esc(x.name[0])}</b>`}</span>
      <span class="sx__t"><b>${hl(x.name, curQ)}</b><small>${esc(meta.join(' · '))}${season && season.includes(slug) ? '<em>En récolte</em>' : ''}</small></span>
      <span class="sx__n">${o ? `<span title="Offres">${window.MDGMarq ? window.MDGMarq.svg('offre') : ''}${o}</span>` : ''}${d ? `<span title="Demandes">${window.MDGMarq ? window.MDGMarq.svg('demande') : ''}${d}</span>` : ''}</span>
      <span class="sx__acts"><button type="button" tabindex="-1" class="sx__b sx__b--jai" data-act="jai" data-i="__I__">J’ai</button><button type="button" tabindex="-1" class="sx__b" data-act="cherche" data-i="__I__">Je cherche</button></span>` };
  }
  const linkRow = (ico, title, sub, href) => ({ k: 'link', href, h: `<span class="sx__th sx__th--i">${ico}</span><span class="sx__t"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="sx__go">${ICO.go}</span>` });

  function render() {
    const C = CX(); if (!C) return;
    const v = inp.value, t = N(v).trim(), groups = [];
    rows = []; last = null; curQ = v;
    if (!t) {
      und.innerHTML = '';
      const r = recents();
      if (r.length) groups.push(['Récemment', 'all', r.map(s => ({ k: 'recent', q: s, h: `<span class="sx__th sx__th--i">${ICO.clk}</span><span class="sx__t"><b>${esc(s)}</b></span><span class="sx__go">${ICO.go}</span>` }))]);
      if (season && season.length) groups.push(['En récolte en ' + MOIS[new Date().getMonth()], 'prod', season.slice(0, 6).map(s => productRow(C, s))]);
      const act = [...new Set(C.OFFERS.map(o => o.productSlug).concat(C.M.products.filter(p => C.demandsOf(p.slug).length).map(p => p.slug)))].filter(s => !(season || []).includes(s)).slice(0, 4);
      if (act.length) groups.push(['Sur le marché', 'prod', act.map(s => productRow(C, s))]);
      if (!groups.length) groups.push(['Pages', 'pages', PAGES.slice(1, 5).map(([n, h]) => linkRow(ICO.go, n, '', h))]);
    } else {
      const p = C.S.parse(v); last = p;
      if (!p.location) p.location = ville(C, t);
      const chips = [];
      if (p.intent) chips.push(INT[p.intent]);
      if (p.product) chips.push(p.product.name);
      if (p.quantity != null) chips.push(p.quantity.toLocaleString('fr-FR') + (p.unit ? ' ' + p.unit.label + (p.quantity > 1 && !/s$/.test(p.unit.label) ? 's' : '') : ''));
      if (p.location) chips.push(p.location.name + (p.location.kind === 'ville' && p.location.regionName ? ' (' + p.location.regionName + ')' : ''));
      und.innerHTML = chips.length > 1 || p.intent || p.location ? `<span>Compris</span>${chips.map(c => `<b>${esc(c)}</b>`).join('')}` : '';
      // produits : reconnu, puis candidats, puis suggestions par préfixe
      const seen = new Set(), prods = [];
      const add = (slug, matched) => { if (!slug || seen.has(slug) || !C.prodBy[slug]) return; seen.add(slug); prods.push(productRow(C, slug, { matched })); };
      if (p.product) add(p.product.slug, p.product.matchedTerm);
      p.candidates.forEach(c => add(c.slug, c.matchedTerm));
      C.S.suggest(p.productText || v.replace(/\d[\d\s.,]*/g, ' '), 8).forEach(s => add(s.slug, s.matchedAlias));
      if (p.product && prods[0]) prods[0].top = true;
      if (prods.length) groups.push([p.product ? 'Produit' : 'Produits', 'prod', prods.slice(0, p.product ? 4 : 7)]);
      // lieu
      const L = [];
      const regs = p.location ? [{ slug: p.location.regionSlug, name: p.location.name }] : C.M.regions.filter(r => t.length > 1 && N(r.name).split(/[\s-]+/).some(w => w.startsWith(t))).slice(0, 3).map(r => ({ slug: r.slug, name: r.name }));
      regs.forEach(r => {
        const prod = p.product, n = prod ? C.offersOf(prod.slug).filter(o => o.regionSlug === r.slug).length : C.OFFERS.filter(o => o.regionSlug === r.slug).length;
        const q = new URLSearchParams({ region: r.slug }); if (prod) q.set('q', prod.name);
        L.push(linkRow(ICO.pin, prod ? `${prod.name} à ${r.name}` : `Le marché à ${r.name}`, n ? (n > 1 ? n + ' offres' : '1 offre') + ' · sur la carte' : 'Voir sur la carte', '#/carte?' + q));
      });
      if (L.length) groups.push(['Lieu', 'lieu', L]);
      // familles, mois, pages
      const O = [];
      if (t.length > 1) {
        C.M.categories.filter(c => N(c.name).split(/[\s,-]+/).some(w => w.length > 2 && w.startsWith(t))).slice(0, 2)
          .forEach(c => O.push(linkRow(ICO.fam, c.name, c.productCount + ' produits', '#/categories?f=' + c.slug)));
        MOIS.forEach((m, i) => { if (N(m).startsWith(t)) O.push(linkRow(ICO.cal, m[0].toUpperCase() + m.slice(1), 'L’année du marché : ce qui se récolte', '#/annee?m=' + (i + 1))); });
        PAGES.forEach(([n, h, kw]) => { if (kw.split(' ').some(w => w.startsWith(t)) || N(n).startsWith(t)) O.push(linkRow(ICO.go, n, 'Page', h)); });
      }
      if (O.length) groups.push(['Aller à', 'pages', O.slice(0, 4)]);
      if (!groups.length) groups.push(['', 'all', [{ k: 'none', h: `<span class="sx__t"><b>Rien de connu pour « ${esc(v.trim())} »</b><small>Ce produit n’est pas encore dans le marché. Dites-le dans une demande : on l’ajoutera.</small></span><span class="sx__acts"><button type="button" tabindex="-1" class="sx__b" data-act="ask" data-i="__I__">Faire une demande</button></span>` }]]);
    }
    // filtres : compte par type (seulement si une recherche est tapée), puis on ne garde que le type choisi
    const cnt = { all: 0, prod: 0, lieu: 0, pages: 0 }; groups.forEach(([, k, rs]) => { if (k !== 'all') { cnt[k] += rs.length; cnt.all += rs.length; } });
    od.querySelector('.sx__sc').classList.toggle('is-on', !!t);
    od.querySelectorAll('[data-sc]').forEach(b => { const k = b.dataset.sc; b.setAttribute('aria-pressed', k === scope); b.disabled = !!t && k !== 'all' && !cnt[k]; b.querySelector('span').textContent = t && cnt[k] ? cnt[k] : ''; });
    const shown = scope === 'all' || !t ? groups : groups.filter(([, k]) => k === scope);
    list.innerHTML = shown.map(([g, , rs]) => `<div class="sx__g">${g ? `<p class="sx__gh">${esc(g)}</p>` : ''}${rs.map(r => { const n = rows.push(r) - 1; return `<div class="sx__row${r.top ? ' is-top' : ''}" style="--i:${Math.min(n, 10)}" role="option" id="sxR${n}" data-i="${n}" data-act="main" aria-selected="false">${r.h.replace(/__I__/g, n)}</div>`; }).join('')}</div>`).join('');
    // complétion fantôme : le premier produit qui commence par ce qu'on tape
    const fp = rows.find(r => r.k === 'prod'); ghostTxt = '';
    if (fp && t.length > 1 && !/\s$/.test(v)) { const nm = CX().prodBy[fp.slug].name; if (N(nm).startsWith(N(v)) && nm.length > v.length) ghostTxt = v + nm.slice(v.length); }
    ghost.innerHTML = ghostTxt ? '<i>' + esc(v) + '</i>' + esc(ghostTxt.slice(v.length)) : '';
    mark(rows.length && t ? 0 : (rows.findIndex(r => r.k === 'prod')), false);
  }

  // aperçu (ordinateur) : tout ce qu'on sait du produit sélectionné, sans quitter la recherche
  function preview(n) {
    const r = rows[n], C = CX();
    if (!r || r.k !== 'prod' || !C) { pv.classList.remove('is-on'); pv.innerHTML = ''; return; }
    if (pv.dataset.slug === r.slug && pv.classList.contains('is-on')) return;
    const x = C.prodBy[r.slug], im = C.img(r.slug), o = C.offersOf(r.slug).length, d = C.demandsOf(r.slug).length, z = smap[r.slug] || {};
    const P = window.MDGMarche && MDGMarche.prix ? MDGMarche.prix(r.slug, C.OFFERS) : { type: 'aucun' };
    const fmt = v => Math.round(v).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
    const price = P.type === 'observe' ? `<b>${fmt(P.min)} – ${fmt(P.max)} FCFA</b><small>Prix observé du marché · ${P.n} prix, 30 jours</small>`
      : P.type === 'vendeur' ? `<b>${fmt(P.offre.price)} FCFA${P.offre.unit ? ' / ' + esc(P.offre.unit) : ''}</b><small>Prix vendeur le plus bas · ${P.n > 1 ? P.n + ' offres' : '1 offre'}</small>`
      : '<small>Pas assez de données pour un prix du marché.</small>';
    const mo = new Date().getMonth() + 1, hasS = Object.keys(z).length;
    pv.dataset.slug = r.slug;
    pv.innerHTML = `<div class="sx__pvi">${im ? `<img src="${im}" alt="">` : `<b>${esc(x.name[0])}</b>`}</div>
      <p class="sx__pvk">${esc(C.catBy[x.categorySlug].name)}</p><h3 class="sx__pvt">${esc(x.name)}</h3>
      ${window.mdgAlias(x).length ? `<p class="sx__pva">aussi appelé ${esc(window.mdgAlias(x).slice(0, 3).join(', '))}</p>` : ''}
      <div class="sx__pvp">${price}</div>
      ${o || d ? `<p class="sx__pvn">${o ? `<span>${window.MDGMarq ? window.MDGMarq.svg('offre') : ''}${o} offre${o > 1 ? 's' : ''}</span>` : ''}${d ? `<span>${window.MDGMarq ? window.MDGMarq.svg('demande') : ''}${d} demande${d > 1 ? 's' : ''}</span>` : ''}</p>` : ''}
      ${hasS ? `<div class="sx__pvs" aria-label="Mois de récolte">${ABR.map((a, i) => `<span class="${z[i + 1] ? 'is-' + z[i + 1] : ''}${i + 1 === mo ? ' is-now' : ''}"><i></i>${a}</span>`).join('')}</div><p class="sx__pvsk">Récolte (sources publiques)</p>` : ''}
      <div class="sx__pvb"><button type="button" class="sx__b sx__b--jai" data-pv="jai">J’ai</button><button type="button" class="sx__b" data-pv="cherche">Je cherche</button></div>
      <div class="sx__pvl"><button type="button" data-pv="fiche">Voir la fiche</button><button type="button" data-pv="carte">Sur la carte</button></div>`;
    pv.classList.remove('is-on'); void pv.offsetWidth; pv.classList.add('is-on');
  }

  function mark(n, scroll = true) {
    sel = n;
    list.querySelectorAll('.sx__row').forEach(r => { const on = +r.dataset.i === n; r.classList.toggle('is-sel', on); r.setAttribute('aria-selected', on); });
    inp.setAttribute('aria-activedescendant', n >= 0 ? 'sxR' + n : '');
    preview(n);
    if (scroll && n >= 0) { const r = list.querySelector('#sxR' + n); if (r) { const a = r.offsetTop, b = a + r.offsetHeight; if (a < list.scrollTop) list.scrollTop = a - 30; else if (b > list.scrollTop + list.clientHeight) list.scrollTop = b - list.clientHeight + 8; } }
  }

  function key(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!rows.length) return; const d = e.key === 'ArrowDown' ? 1 : -1; mark((sel + d + rows.length) % rows.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (sel >= 0) run(rows[sel], 'main'); else if (inp.value.trim()) { remember(inp.value); close(); CX().go('#/catalogue?q=' + encodeURIComponent(inp.value.trim())); } }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if ((e.key === 'Tab' && !e.shiftKey || e.key === 'ArrowRight' && inp.selectionStart === inp.value.length) && ghostTxt) { e.preventDefault(); inp.value = ghostTxt + ' '; render(); }
  }

  function run(r, act, btn) {
    if (!r) return;
    const C = CX();
    if (r.k === 'recent') { inp.value = r.q; render(); inp.focus(); return; }
    if (r.k === 'none') { remember(inp.value); close(); C.go('#/demande'); return; }
    if (r.k === 'link') { remember(inp.value); close(); C.go(r.href); return; }
    if (r.k === 'prod') {
      let mode = act;
      if (act === 'fiche') mode = 'fiche';
      else if (act === 'main') mode = last && last.product && last.product.slug === r.slug ? (last.intent === 'acheter' ? 'cherche' : last.intent === 'vendre' ? 'jai' : 'fiche') : 'fiche';
      remember(inp.value || C.prodBy[r.slug].name);
      close();
      if (mode === 'fiche') { C.go('#/produits/' + r.slug); return; }
      const M = window.MDGV3 && window.MDGV3.match;
      if (M && M.open) M.open({ slug: r.slug, mode, anchor: opener }); else C.go(mode === 'jai' ? '#/vendre?p=' + r.slug : '#/demande');
    }
  }

  function open(from) {
    if (!CX()) return;
    if (!od) build();
    opener = from || document.activeElement;
    loadSeason();
    od.hidden = false; document.documentElement.classList.add('sx-open');
    requestAnimationFrame(() => od.classList.add('is-open'));
    inp.value = ''; scope = 'all'; pv.dataset.slug = ''; render(); inp.focus();
  }
  function close() {
    if (!od || od.hidden) return;
    od.classList.remove('is-open'); document.documentElement.classList.remove('sx-open');
    setTimeout(() => { if (!od.classList.contains('is-open')) od.hidden = true; }, 180);
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  document.addEventListener('click', e => {
    // seule la loupe de l'en-tête ouvre cette boîte ; les champs de recherche des pages gardent leur propre fonctionnement
    const a = e.target.closest('a[data-search],button[data-search]'); if (!a || !a.closest('#top, .site-header')) return;
    e.preventDefault(); open(a);
  }, true);
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); od && !od.hidden ? close() : open(); }
    else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open(); }
  });
  addEventListener('hashchange', close);
  (window.MDGV3 = window.MDGV3 || {}).cherche = { open, close };
})();
