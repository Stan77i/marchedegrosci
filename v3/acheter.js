/* ═════════ V3 — ACHETER : explorer l'offre (prototype desktop) ═════════
   En-tête : accroche, chiffres, recherche, familles en photo (aucune scène 3D).
   Index : quoi → où → disponible → quantité → prix → vendeur ; survoler une ligne allume ses producteurs sur la mini-carte. */
(function () {
  'use strict';
  const V3 = window.MDGV3 = window.MDGV3 || {};
  V3.tw = () => window.MDGTW || { grain: 1, touch: 1 };
    // une teinte par famille, prise dans les rampes du site (récolte, terre, forêt, ambre, sable)
  const FAMC = ['#dcb04f', '#e0774e', '#9dc2a7', '#b65e3d', '#61846b', '#fec5b0', '#ffe5b0', '#c1b6a2', '#fe9a64', '#c09004', '#B9AD98'];
  const proj = (lat, lon) => [(lon + 5.16) * 0.62, -(lat - 7.13) * 0.62];
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  Object.assign(V3, { FAMC, proj, hex });
  const libs = () => new Promise(res => {
    const ok = () => window.gsap && window.ScrollTrigger;
    const done = () => res(ok());
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(done, 0), { once: true }); else done();
  });

  V3.acheter = function (view, qs) {
    const C = window.MDGCTX, { M, OFFERS, prodBy, prBy, catBy, regBy, esc, fmt, plural, img, go, reduced } = C;
    const L = C.LIGHT; if (L && (L.fam || L.source === 'recherche')) L.off();
    const st = { cat: qs.get('cat') || '', region: qs.get('region') || '', qmin: +qs.get('qmin') || 0, pmax: +qs.get('pmax') || 0 };
    const famIdx = Object.fromEntries(M.categories.map((c, i) => [c.slug, i]));
    const famCol = slug => FAMC[famIdx[slug] % FAMC.length];
    const fams = M.categories.map(c => ({ c, n: OFFERS.filter(o => prodBy[o.productSlug].categorySlug === c.slug).length })).filter(f => f.n || !OFFERS.length);
    const nProd = new Set(OFFERS.map(o => o.productSlug)).size, nPr = new Set(OFFERS.map(o => o.producerId)).size, nReg = new Set(OFFERS.map(o => o.regionSlug)).size;
    const unitOf = o => esc(o.unit);
    const priceOf = o => o.price == null ? 'à discuter' : `${fmt(o.price)} F/${unitOf(o)}`;

    view.innerHTML = `<div class="v3a">
  ${V3.head('acheter', { label: 'Acheter — en-tête', kicker: 'Acheter', title: 'Ce qui est disponible maintenant, là où ça pousse.', sub: 'Vous contactez directement le producteur, sans intermédiaire.',
    extra: `${OFFERS.length ? `<p class="pg-num"><span><b>${OFFERS.length}</b> ${OFFERS.length > 1 ? 'offres' : 'offre'}</span><i></i><span><b>${nProd}</b> ${nProd > 1 ? 'produits' : 'produit'}</span><i></i><span><b>${nPr}</b> ${nPr > 1 ? 'vendeurs' : 'vendeur'}</span><i></i><span><b>${nReg}</b> ${nReg > 1 ? 'régions' : 'région'}</span></p>` : ''}<div class="pg-search">${C.searchBox('')}</div>` })}
  <section class="ax" id="ax" data-tone="dark" aria-labelledby="axT">
    <div class="wrap">
      <div class="ax-top"><h2 class="ax-t" id="axT">Le marché, produit par produit</h2>
        <div class="ax-bar">
          <div class="ax-chips" role="group" aria-label="Familles"><button type="button" class="fbtn" data-c="">Tout</button>${fams.map(f => `<button type="button" class="fbtn" data-c="${f.c.slug}">${esc(f.c.name)}</button>`).join('')}</div>
          <div class="ax-fl">
            <label class="sr" for="axR">Région</label><select class="sel" id="axR"><option value="">Toutes les régions</option>${M.regions.filter(r => OFFERS.some(o => o.regionSlug === r.slug)).map(r => `<option value="${r.slug}">${esc(r.name)}</option>`).join('')}</select>
            <label class="ac-num"><span class="sr">Quantité minimale</span><input id="axQ" inputmode="numeric" placeholder="Qté min."></label>
            <label class="ac-num"><span class="sr">Prix maximum (FCFA)</span><input id="axP" inputmode="numeric" placeholder="Prix max."></label>
          </div>
        </div>
      </div>
      <div class="ax-grid">
        <div class="ax-list" id="axList"></div>
        <aside class="ax-map" id="axMap" aria-label="Où se trouve l'offre"></aside>
      </div>
    </div>
  </section>
</div>`;
    C.bindSearch(view);
    const $ = (s, r = view) => r.querySelector(s), $$ = (s, r = view) => [...r.querySelectorAll(s)];
    const offs = []; const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };

    /* ——— index ——— */
    const keep = o => (!st.qmin || o.quantity >= st.qmin) && (!st.pmax || (o.price != null && o.price <= st.pmax)) && (!st.region || o.regionSlug === st.region) && (!st.cat || prodBy[o.productSlug].categorySlug === st.cat);
    let cur = [];
    const rowHTML = ({ p, os }) => {
      const cities = [...new Set(os.map(o => o.city))], units = [...new Set(os.map(o => o.unit))], sellers = new Set(os.map(o => o.producerId)).size;
      const qty = units.length === 1 ? `${fmt(os.reduce((s, o) => s + o.quantity, 0))} ${esc(units[0])}` : os.slice(0, 2).map(o => `${fmt(o.quantity)} ${unitOf(o)}`).join(' + ');
      const pr = os.filter(o => o.price != null).map(o => o.price), mn = Math.min(...pr), mx = Math.max(...pr), PX = window.MDGMarche.prix(p.slug);
      // prix : « observé » seulement au-dessus du seuil (§ XXII), sinon « prix vendeur », jamais présenté comme prix du marché
      const price = PX.type === 'observe' ? `<small class="ax-pk ax-pk--obs">Prix observé</small>${fmt(PX.min)}–${fmt(PX.max)} F / ${esc(PX.unit)}`
        : pr.length ? `<small class="ax-pk">${pr.length > 1 ? 'Prix vendeurs' : 'Prix vendeur'}</small>${mn === mx ? fmt(mn) : `${fmt(mn)}–${fmt(mx)}`} F${units.length === 1 ? ' / ' + esc(units[0]) : ''}` : 'Prix à discuter';
      // quand ? disponible maintenant ou à partir d'une date (§ XVII)
      const now = Date.now(), later = os.filter(o => o.availableFrom && o.availableFrom !== 'maintenant' && !isNaN(new Date(o.availableFrom)) && new Date(o.availableFrom) > now), nNow = os.length - later.length;
      const first = later.map(o => new Date(o.availableFrom)).sort((a, b) => a - b)[0];
      const when = later.length ? `<small class="ax-when">${nNow ? nNow + ' maintenant · ' : ''}${later.length > 1 || nNow ? 'dès le ' : 'dès le '}${first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small>` : '<small class="ax-when ax-when--on">maintenant</small>';
      const im = img(p.slug);
      const href = '#/catalogue?q=' + encodeURIComponent(p.name) + (st.region ? '&region=' + st.region : '');
      return `<a class="ax-row" href="${href}" data-s="${p.slug}">
        <span class="ax-q"><i class="ax-im">${im ? `<img src="${im}" alt="" loading="lazy">` : ''}</i><span><b>${esc(p.name)}</b><small>${esc(catBy[p.categorySlug].name)}</small><em class="ax-o">${cities.slice(0, 3).map(esc).join(', ')}${cities.length > 3 ? ` +${cities.length - 3}` : ''}</em></span></span>
        <span class="ax-d"><span class="ax-dots" aria-hidden="true">${os.slice(0, 6).map(() => '<i></i>').join('')}</span>${plural(os.length, 'offre', 'offres')}${when}</span>
        <span class="ax-n">${qty}</span>
        <span class="ax-p${pr.length ? '' : ' disc'}">${price}</span>
        <span class="ax-v">${plural(sellers, 'vendeur', 'vendeurs')}<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span></a>`;
    };
    const reveal = () => {
      const rows = $$('.ax-row');
      if (reduced) { rows.forEach(r => r.classList.add('in')); return; }
      const io = new IntersectionObserver(es => { let k = 0; es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); e.target.style.setProperty('--d', (k++ * 45) + 'ms'); e.target.classList.add('in'); }); }, { rootMargin: '0px 0px -8% 0px' });
      rows.forEach(r => io.observe(r)); offs.push(() => io.disconnect());
    };
    function renderList() {
      const by = {}; OFFERS.filter(keep).forEach(o => (by[o.productSlug] ||= []).push(o));
      cur = Object.entries(by).map(([s, os]) => ({ p: prodBy[s], os })).sort((a, b) => b.os.length - a.os.length || a.p.name.localeCompare(b.p.name, 'fr'));
      const rest = M.products.filter(p => !by[p.slug] && (!st.cat || p.categorySlug === st.cat) && !OFFERS.some(o => o.productSlug === p.slug));
      const nF = [st.cat, st.region, st.qmin, st.pmax].filter(Boolean).length;
      if (!OFFERS.length) {
        // aucune offre : la page ne devient pas une impasse (§ XIX) — chaque produit peut devenir une demande
        const I = window.MDGMarche.ICO, fam = M.categories.filter(c => !st.cat || c.slug === st.cat).map(c => ({ c, ps: M.products.filter(p => p.categorySlug === c.slug) })).filter(f => f.ps.length);
        $('#axList').innerHTML = `<div class="ax-zero"><p class="ax-zk"><i aria-hidden="true">${I.demande}</i>Personne n’a encore publié d’offre</p><h3>Dites ce que vous cherchez : votre demande devient visible des vendeurs.</h3>
          <ul class="ax-zl">${fam.map(f => `<li><b>${esc(f.c.name)}</b><span>${f.ps.slice(0, 8).map(p => `<button type="button" class="ax-zp" data-match="cherche" data-slug="${p.slug}">${esc(p.name)}</button>`).join('')}${f.ps.length > 8 ? `<a class="ax-zm" href="#/categories?f=${f.c.slug}">+${f.ps.length - 8}</a>` : ''}</span></li>`).join('')}</ul>
          <p class="ax-zf">Vous avez un produit ? <a href="#/vendre">Publier la première offre</a></p></div>`;
        $$('.ax-chips .fbtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === st.cat));
        const fl = $('.ax-fl'); if (fl) fl.hidden = true; // filtres région / quantité / prix sans objet tant qu'aucune offre n'existe
        mapDraw(); return;
      }
      $('#axList').innerHTML = (cur.length ? `<div class="ax-head" aria-hidden="true"><span>Produit · où</span><span>Disponible</span><span>Quantité</span><span>Prix</span><span>Vendeurs</span></div>${cur.map(rowHTML).join('')}`
        : `<p class="ax-empty">Aucune offre ne correspond${nF ? ' à ces filtres' : ''}. ${nF ? '<button type="button" id="axX">Effacer les filtres</button> ou ' : ''}<a href="#/demande">publier une demande</a>.</p>`)
        + (rest.length ? `<details class="ax-rest"><summary>${plural(rest.length, 'autre produit', 'autres produits')} sans offre en ce moment</summary><div class="ax-rl">${rest.map(p => `<a href="#/produits/${p.slug}">${esc(p.name)}</a>`).join('')}</div><p>Vous en cherchez un ? <a href="#/demande">Publier une demande</a></p></details>` : '');
      { const fl = $('.ax-fl'); if (fl) fl.hidden = false; }
      const x = $('#axX'); if (x) x.onclick = () => { Object.assign(st, { cat: '', region: '', qmin: 0, pmax: 0 }); sync(); };
      $$('.ax-chips .fbtn').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === st.cat));
      $('#axR').value = st.region; $('#axQ').value = st.qmin || ''; $('#axP').value = st.pmax || '';
      $$('.ax-row').forEach(r => { r.onmouseenter = () => mapHi(r.dataset.s); r.onfocus = () => mapHi(r.dataset.s); });
      $('#axList').onmouseleave = () => mapHi(null);
      $('#axList').onpointermove = e => { const r = e.target.closest && e.target.closest('.ax-row'); if (!r) return; const b = r.getBoundingClientRect(); r.style.setProperty('--rx', (e.clientX - b.left) + 'px'); r.style.setProperty('--ry', (e.clientY - b.top) + 'px'); };
      mapDraw(); reveal();
    }
    function sync() {
      const n = new URLSearchParams(); ['cat', 'region', 'qmin', 'pmax'].forEach(k => st[k] && n.set(k, st[k]));
      history.replaceState(history.state, '', '#/catalogue' + (n.toString() ? '?' + n : ''));
      renderList();
    }
    $$('.ax-chips .fbtn').forEach(b => b.onclick = () => { st.cat = b.dataset.c; sync(); });
    const num = v => +String(v || '').replace(/\D/g, '') || 0;
    $('#axR').onchange = e => { st.region = e.target.value; sync(); };
    $('#axQ').onchange = e => { st.qmin = num(e.target.value); sync(); };
    $('#axP').onchange = e => { st.pmax = num(e.target.value); sync(); };

    /* ——— mini-carte : même projection que la scène ——— */
    const grid = []; for (let x = -1.6; x <= 1.6; x += .16) for (let z = -1.55; z <= 1.55; z += .16) grid.push(`<circle class="g" cx="${x.toFixed(2)}" cy="${z.toFixed(2)}" r=".008"/>`);
    $('#axMap').innerHTML = `<svg viewBox="-1.75 -1.7 3.5 3.4" role="img" aria-label="Producteurs du réseau">${grid.join('')}<g id="axPr">${M.producers.map(pr => { const [x, z] = proj(pr.latitude, pr.longitude); return `<circle class="pr" data-id="${pr.id}" cx="${x.toFixed(3)}" cy="${z.toFixed(3)}" r=".04"/><text data-id="${pr.id}" x="${(x + .08).toFixed(3)}" y="${(z + .025).toFixed(3)}">${esc(pr.city)}</text>`; }).join('')}</g></svg>
      <p class="ax-cap" id="axCap"></p><a href="#/carte">Ouvrir la carte du territoire<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></a>`;
    function mapDraw() {
      const cnt = {}; cur.forEach(r => r.os.forEach(o => cnt[o.producerId] = (cnt[o.producerId] || 0) + 1));
      $$('#axPr circle').forEach(c => c.setAttribute('r', cnt[c.dataset.id] ? (.035 + .022 * cnt[c.dataset.id]).toFixed(3) : .02));
      mapHi(null);
    }
    function mapHi(slug) {
      const row = slug && cur.find(r => r.p.slug === slug), ids = new Set(row ? row.os.map(o => o.producerId) : []);
      $$('#axPr circle, #axPr text').forEach(e => { const o = ids.has(e.dataset.id); e.classList.toggle('on', o); e.classList.toggle('dim', !!row && !o); });
      $$('.ax-row').forEach(r => r.classList.toggle('hl', r.dataset.s === slug));
      const n = cur.reduce((s, r) => s + r.os.length, 0), prs = new Set(cur.flatMap(r => r.os.map(o => o.producerId))).size;
      $('#axCap').innerHTML = row ? `<b>${esc(row.p.name)}</b>${plural(row.os.length, 'offre', 'offres')} · ${[...new Set(row.os.map(o => esc(o.city)))].join(', ')}`
        : !n ? `<b>La carte attend ses premières offres</b>Chaque offre publiée apparaît ici, à sa région.` : `<b>${plural(prs, 'vendeur', 'vendeurs')}</b>${plural(n, 'offre affichée', 'offres affichées')}${st.region ? ' en ' + esc(regBy[st.region].name) : ''}. Survolez un produit pour voir où il se trouve.`;
    }
    renderList();

    /* ——— en-tête commun : « Depuis l'étal » amène au produit dans l'index ——— */
    let lenis = null, tick = null, alive = true;
    offs.push(V3.headBind(view, p => {
      if (!OFFERS.some(o => o.productSlug === p.slug)) { go('#/demande?p=' + p.slug); return; }
      Object.assign(st, { cat: p.categorySlug, region: '', qmin: 0, pmax: 0 }); sync();
      const row = $('.ax-row[data-s="' + p.slug + '"]'), tgt = row || $('#ax'), y = tgt.getBoundingClientRect().top + scrollY - 140;
      lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      if (row) { mapHi(p.slug); row.classList.add('pulse'); setTimeout(() => row.classList.remove('pulse'), 1800); }
    }));

    /* ——— chorégraphie : GSAP + ScrollTrigger + Lenis ——— */
    const trig = [];
    libs().then(ok => {
      if (!alive) return;
      if (!ok || reduced) return;
      const { gsap, ScrollTrigger } = window; gsap.registerPlugin(ScrollTrigger);
      if (window.Lenis) { lenis = new window.Lenis({ lerp: .11 }); lenis.on('scroll', ScrollTrigger.update); tick = t => lenis.raf(t * 1000); gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0); }
    });

    return () => {
      alive = false; offs.forEach(f => f());
      trig.forEach(t => t && t.kill());
      if (lenis) { lenis.destroy(); lenis = null; } if (tick) window.gsap.ticker.remove(tick);
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  };

})();
