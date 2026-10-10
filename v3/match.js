/* ═════════ Marché de Gros — « J'ai / Je cherche » ═════════
   L'action centrale du site (remplace le panier). Fonctionne dans les deux sens (PHILOSOPHIE § 8) :
   J'ai      → publier une offre déjà remplie avec le produit, et voir les demandes qui correspondent ;
   Je cherche → voir les offres qui correspondent ; s'il n'y en a pas, publier une demande tout de suite.
   Panneau ancré sur ordinateur, feuille qui monte du bas sur téléphone. Peu de champs, le reste replié.
   Données : enregistrées sur cet appareil pour l'instant (aucun serveur). */
(function () {
  'use strict';
  const V3 = window.MDGV3 = window.MDGV3 || {};
  const MK = () => window.MDGMarche, CX = () => window.MDGCTX;
  const WHEN = [['vite', 'Dès que possible'], ['semaine', 'Cette semaine'], ['mois', 'Ce mois-ci']];
  const mqDesk = matchMedia('(min-width: 760px)');
  let od = null, card = null, cur = null, anchor = null, drag = null, lastRegion = 'abidjan';
  const q = s => od.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const regName = s => { const r = CX().regBy[s]; return r ? r.name : ''; };
  const contactBtns = (phone, text) => {
    const t = MK().tel(phone); if (!t) return '';
    return '<span class="mt-ct"><a class="mt-cb" href="tel:+225' + t + '">Appeler</a><a class="mt-cb" href="https://wa.me/225' + t + '?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">WhatsApp</a></span>';
  };

  // § 7 — compatibilité : une offre est classée sur plusieurs critères, et chaque critère est dit en clair
  const km = (a, b) => { const R = MK().REG, A = R[a], B = R[b]; if (!A || !B) return null; const r = Math.PI / 180, x = (B[1] - A[1]) * r * Math.cos((A[0] + B[0]) / 2 * r), y = (B[0] - A[0]) * r; return Math.round(Math.hypot(x, y) * 6371); };
  function rank(offs, want) {
    const pr = offs.map(o => o.price).filter(v => v != null), lo = pr.length ? Math.min(...pr) : 0, hi = pr.length ? Math.max(...pr) : 0;
    return offs.map(o => {
      const d = km(want.r, o.regionSlug), sameU = !want.q || o.unit === want.u, cov = want.q && sameU ? Math.min(1, o.quantity / want.q) : null, now = (o.availableFrom || 'maintenant') === 'maintenant';
      const s = (cov == null ? .5 : cov) * 3 + (d == null ? .3 : 1 - Math.min(d, 600) / 600) * 2 + (now ? 1 : .3) + (o.price != null && hi > lo ? (hi - o.price) / (hi - lo) * .5 : .25);
      const why = [];
      if (want.q) why.push(!sameU ? ['', 'vendu en ' + o.unit] : cov >= 1 ? ['ok', 'couvre vos ' + fmt(want.q) + ' ' + want.u] : ['', fmt(o.quantity) + ' sur ' + fmt(want.q) + ' ' + want.u]);
      why.push(d === 0 ? ['ok', 'même région'] : d != null ? [d <= 120 ? 'ok' : '', '≈ ' + fmt(d) + ' km'] : ['', '']);
      why.push(now ? ['ok', 'disponible maintenant'] : ['', 'dans 2 semaines']);
      return { o, s, why: why.filter(w => w[1]) };
    }).sort((a, b) => b.s - a.s);
  }
  function offList(p, want) {
    const offs = CX().offersOf(p.slug), R = rank(offs, want), full = want.q && R.length && R[0].why[0] && R[0].why[0][0] === 'ok';
    return R.slice(0, 3).map((x, i) => { const o = x.o; return '<li' + (i === 0 && full ? ' class="is-best"' : '') + '><span class="odv__q">' + fmt(o.quantity) + ' ' + esc(o.unit) + (i === 0 && full ? '<em class="mt-best">la plus adaptée</em>' : '') + '</span><span class="odv__c">' + esc(o.seller || o.producerName || '') + ' · ' + esc(o.city) + '</span><span class="odv__pr">' + (o.price != null ? fmt(o.price) + ' F<small>/ ' + esc(o.unit) + ' · prix vendeur</small>' : 'À discuter') + '</span>'
      + '<span class="mt-why">' + x.why.map(w => '<i' + (w[0] ? ' class="ok"' : '') + '>' + esc(w[1]) + '</i>').join('') + '</span>' + contactBtns(o.phone, 'Bonjour, je cherche du ' + p.name.toLowerCase() + ', votre offre sur Marché de Gros m\'intéresse.') + '</li>'; }).join('');
  }

  function build() {
    const I = MK().ICO;
    od = document.createElement('div'); od.id = 'mtOD'; od.className = 'odv mt';
    od.innerHTML = `<div class="odv__bk"></div>
      <section class="odv__card" role="dialog" aria-modal="true" aria-labelledby="mtT" tabindex="-1">
        <div class="odv__grip" aria-hidden="true"><i></i></div>
        <header class="odv__head"><span class="odv__thumb"></span><div class="odv__ttl"><p class="odv__fam"></p><h2 class="odv__title" id="mtT"></h2></div>
          <button type="button" class="odv__x" aria-label="Fermer">✕</button></header>
        <div class="odv__tabs" role="tablist" aria-label="J'ai ou je cherche"><i class="odv__ind" aria-hidden="true"></i>
          <button type="button" role="tab" class="odv__tab" data-t="jai" aria-controls="mtJai"><span class="mt-ti">${I.offre}</span>J'ai</button>
          <button type="button" role="tab" class="odv__tab" data-t="cherche" aria-controls="mtCh"><span class="mt-ti">${I.demande}</span>Je cherche</button></div>
        <p class="odv__msg" aria-live="polite"></p>
        <div class="odv__pane" id="mtJai" role="tabpanel" data-p="jai"></div>
        <div class="odv__pane" id="mtCh" role="tabpanel" data-p="cherche"></div>
        <p class="mt-local">Enregistré sur cet appareil pour l'instant : l'envoi aux autres utilisateurs arrive avec le serveur.</p>
      </section>`;
    document.body.appendChild(od);
    card = q('.odv__card');
    q('.odv__bk').addEventListener('click', () => close());
    q('.odv__x').addEventListener('click', () => close());
    od.querySelectorAll('.odv__tab').forEach(b => b.addEventListener('click', () => tab(b.dataset.t)));
    q('.odv__tabs').addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const t = q('.odv__tabs').dataset.t === 'jai' ? 'cherche' : 'jai'; tab(t); q('.odv__tab[data-t="' + t + '"]').focus(); });
    od.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = [...card.querySelectorAll('button,a[href],input,select,summary')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === card)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    const pull = e => !mqDesk.matches && (e.target.closest('.odv__grip') || (e.target.closest('.odv__head') && !e.target.closest('button')));
    card.addEventListener('pointerdown', e => { if (!pull(e)) return; drag = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId }; try { card.setPointerCapture(e.pointerId); } catch (_) {} od.classList.add('is-drag'); });
    card.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; drag.dy = Math.max(0, e.clientY - drag.y); card.style.transform = 'translateY(' + drag.dy + 'px)'; });
    const end = () => { if (!drag) return; const d = drag; drag = null; od.classList.remove('is-drag'); const v = d.dy / Math.max(1, performance.now() - d.t); if (d.dy > 90 || (d.dy > 28 && v > .5)) close(); else card.style.transform = ''; };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    addEventListener('resize', () => { if (isOpen()) place(); }, { passive: true });
    addEventListener('scroll', () => { if (isOpen() && mqDesk.matches) place(); }, { passive: true });
  }

  function tab(t) {
    const tabs = q('.odv__tabs'); tabs.dataset.t = t;
    od.querySelectorAll('.odv__tab').forEach(b => { const on = b.dataset.t === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    od.querySelectorAll('.odv__pane').forEach(p => { p.hidden = p.dataset.p !== t; });
    q('.odv__msg').textContent = od._msg && od._msg[t] || '';
    if (od.classList.contains('is-desk')) place();
  }

  const units = p => { const U = CX().UNITS || ['kg', 'sac', 'tonne']; const o = CX().offersOf(p.slug)[0]; const u = (o && o.unit) || 'kg'; return { list: U.includes(u) ? U : [u].concat(U), u }; };
  const qtyField = (p, name) => { const { list, u } = units(p); return '<label class="odv__f"><span>Quantité</span><span class="odv__qty"><input name="q" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex. 500" required><select name="u" aria-label="Unité">' + list.map(x => '<option' + (x === u ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></span></label>'; };
  const regField = () => '<label class="odv__f"><span>Où</span><select name="r">' + CX().M.regions.map(r => '<option value="' + r.slug + '"' + (r.slug === lastRegion ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></label>';
  const telField = () => '<label class="odv__f"><span>Téléphone (WhatsApp)</span><span class="mt-tel"><b aria-hidden="true">+225</b><input name="t" type="tel" inputmode="tel" autocomplete="tel" placeholder="07 01 02 03 04" required></span></label>';

  function fill(p, mode) {
    const C = CX(), offs = C.offersOf(p.slug).slice().sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12)), dems = C.demandsOf ? C.demandsOf(p.slug) : [];
    const im = C.img(p.slug), cat = C.catBy[p.categorySlug];
    q('.odv__thumb').innerHTML = im ? '<img src="' + im + '" alt="">' : '<i>' + esc(p.name.slice(0, 1)) + '</i>';
    q('.odv__fam').textContent = cat ? cat.name : ''; q('.odv__title').textContent = p.name;
    // J'ai : les demandes qui correspondent, puis l'offre (déjà remplie avec le produit)
    q('#mtJai').innerHTML = (dems.length
      ? '<p class="mt-k">' + dems.length + (dems.length > 1 ? ' demandes correspondent' : ' demande correspond') + '</p><ul class="odv__offers">' + dems.slice(0, 3).map(d => '<li><span class="odv__q">' + fmt(d.quantity) + ' ' + esc(d.unit) + '</span><span class="odv__c">' + esc(d.city || regName(d.regionSlug)) + (d.mine ? ' · votre demande' : '') + '</span>' + (d.phone ? contactBtns(d.phone, 'Bonjour, j\'ai du ' + p.name.toLowerCase() + ' pour votre demande sur Marché de Gros.') : '') + '</li>').join('') + '</ul>'
      : '<p class="mt-k">Aucune demande pour l\'instant</p>')
      + '<form class="mt-form" data-k="offre" novalidate><div class="odv__row">' + qtyField(p) + regField() + '</div>' + telField()
      + '<details class="odv__more"><summary>Prix, nom, disponibilité</summary>'
      + '<label class="odv__f"><span>Prix vendeur (F par unité)</span><input name="pr" type="number" min="0" inputmode="numeric" placeholder="Vide = à discuter"></label>'
      + '<div class="odv__row"><label class="odv__f"><span>Votre nom</span><input name="n" autocomplete="name" placeholder="Facultatif"></label><label class="odv__f"><span>Ville</span><input name="c" placeholder="Facultatif"></label></div>'
      + '<fieldset class="odv__f"><legend>Disponible</legend><div class="odv__seg"><label><input type="radio" name="a" value="maintenant" checked><span>Maintenant</span></label><label><input type="radio" name="a" value="bientot"><span>Dans 2 semaines</span></label></div></fieldset></details>'
      + '<p class="odv__err" role="alert"></p><button type="submit" class="odv__cta">Publier mon offre</button></form>'
      + '<a class="mt-all" href="#/vendre?p=' + p.slug + '">Formulaire complet : photo, date, agent</a>';
    // Je cherche : les offres qui correspondent ; sinon, la demande tout de suite
    q('#mtCh').innerHTML = (offs.length
      ? '<p class="mt-k">' + offs.length + (offs.length > 1 ? ' offres correspondent' : ' offre correspond') + '</p><p class="mt-hint" id="mtHint">Indiquez quantité et lieu ci-dessous : les offres se classent selon ce qui vous convient.</p><ul class="odv__offers" id="mtOL">' + offList(p, { r: lastRegion }) + '</ul>'
        + (offs.length > 3 ? '<a class="mt-all" href="#/catalogue?cat=' + p.categorySlug + '">Voir les ' + offs.length + ' offres</a>' : '') + '<p class="mt-k mt-k--or">Pas ce qu\'il vous faut ? Publiez votre demande</p>'
      : '')
      + '<form class="mt-form" data-k="demande" novalidate><div class="odv__row">' + qtyField(p) + regField() + '</div>' + telField()
      + '<details class="odv__more"><summary>Délai, budget</summary><fieldset class="odv__f"><legend>Quand</legend><div class="odv__seg">' + WHEN.map(([v, l], i) => '<label><input type="radio" name="d" value="' + v + '"' + (i === 1 ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div></fieldset>'
      + '<label class="odv__f"><span>Budget (F par unité)</span><input name="b" type="number" min="0" inputmode="numeric" placeholder="Facultatif"></label></details>'
      + '<p class="odv__err" role="alert"></p><button type="submit" class="odv__cta">Publier ma demande</button></form>';
    od.querySelectorAll('.mt-form').forEach(f => f.addEventListener('submit', submit));
    const fd = q('#mtCh .mt-form'), ol = q('#mtOL');
    if (fd && ol) { const re = () => { const v = parseInt(fd.q.value, 10); ol.innerHTML = offList(p, { q: v >= 1 ? v : 0, u: fd.u.value, r: fd.r.value }); const h = q('#mtHint'); if (h) h.hidden = v >= 1; if (od.classList.contains('is-desk')) place(); }; fd.addEventListener('input', re); fd.addEventListener('change', re); }
    od._msg = { cherche: offs.length ? '' : 'Pas encore d\'offre, publiez votre demande.', jai: '' };
    tab(mode === 'jai' ? 'jai' : 'cherche');
  }

  function submit(e) {
    e.preventDefault();
    const f = e.target, p = cur, C = CX(), err = f.querySelector('.odv__err'), qv = parseInt(f.q.value, 10), t = MK().tel(f.t.value);
    if (!(qv >= 1)) { err.textContent = 'Indiquez une quantité (chiffres uniquement).'; f.q.focus(); return; }
    if (!t) { err.textContent = 'Numéro ivoirien : 10 chiffres, par exemple 07 01 02 03 04.'; f.t.focus(); return; }
    lastRegion = f.r.value;
    const base = { id: (f.dataset.k === 'offre' ? 'off-' : 'dem-') + Date.now(), createdAt: new Date().toISOString(), productSlug: p.slug, productLabel: p.name, productName: p.name, quantity: qv, unit: f.u.value, regionSlug: f.r.value, regionName: regName(f.r.value) };
    let ok;
    if (f.dataset.k === 'offre') {
      const pr = f.pr.value ? +f.pr.value : null, name = f.n.value.trim() || 'Vendeur', city = f.c.value.trim() || (MK().REG[f.r.value] || [])[2] || regName(f.r.value);
      ok = C.store('offres', [{ ...base, price: pr, city, availableFrom: (f.querySelector('input[name="a"]:checked') || {}).value || 'maintenant', producer: { name, phone: t }, producerName: name }].concat(C.store('offres')).slice(0, 12));
    } else {
      ok = C.store('demandes', [{ ...base, deadline: (f.querySelector('input[name="d"]:checked') || {}).value || 'semaine', budget: f.b.value ? +f.b.value : null, buyerContact: { tel: t, via: 'whatsapp' }, phone: t, status: 'affichee' }].concat(C.store('demandes')).slice(0, 12));
    }
    if (!ok) { err.textContent = 'La mémoire de ce navigateur est pleine : supprimez une ancienne publication.'; return; }
    try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
    const offre = f.dataset.k === 'offre';
    f.outerHTML = '<div class="odv__ok"><b>' + (offre ? 'Offre publiée' : 'Demande publiée') + '</b><p>' + fmt(qv) + ' ' + esc(base.unit) + ' de ' + esc(p.name.toLowerCase()) + ' · ' + esc(base.regionName) + '. ' + (offre ? 'Les acheteurs la voient dans Acheter et sur la carte.' : 'Elle devient une donnée visible du marché : les vendeurs la voient.') + '</p><a href="' + (offre ? '#/vendre' : '#/demande') + '">' + (offre ? 'Mes offres' : 'Mes demandes') + '</a></div>';
    od._msg = {}; q('.odv__msg').textContent = '';
    C.toast && C.toast(offre ? 'Offre publiée sur cet appareil' : 'Demande publiée sur cet appareil');
    V3.onMarket && V3.onMarket();
    if (od.classList.contains('is-desk')) place();
  }

  function place() {
    if (!od) return;
    const desk = mqDesk.matches && anchor && anchor.isConnected; od.classList.toggle('is-desk', !!desk);
    if (!desk) { card.style.left = card.style.top = ''; return; }
    const r = anchor.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)), above = r.top - h - 14 > 12;
    card.style.left = left + 'px';
    card.style.top = (above ? r.top - h - 14 : Math.max(12, Math.min(innerHeight - h - 12, r.bottom + 14))) + 'px';
    card.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px'); card.dataset.side = above ? 'top' : 'bottom';
  }
  const isOpen = () => !!od && od.classList.contains('is-open');
  function open(o) {
    const C = CX(); if (!C) return; const p = C.prodBy[o.slug]; if (!p) return;
    if (!od) build();
    cur = p; anchor = o.anchor || null; fill(p, o.mode);
    od.classList.add('is-on'); card.style.transform = ''; place();
    requestAnimationFrame(() => requestAnimationFrame(() => od.classList.add('is-open')));
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    if (!mqDesk.matches) document.documentElement.style.overflow = 'hidden';
    setTimeout(() => card && card.focus({ preventScroll: true }), 40);
  }
  function close(silent) {
    if (!isOpen()) return;
    od.classList.remove('is-open'); document.documentElement.style.overflow = ''; card.style.transform = '';
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (od && !od.classList.contains('is-open')) od.classList.remove('is-on'); }, 300);
    if (!silent && anchor && anchor.isConnected) anchor.focus({ preventScroll: true });
  }
  // boutons « J'ai / Je cherche » n'importe où : data-match="jai|cherche" data-slug="…"
  document.addEventListener('click', e => { const b = e.target.closest('[data-match]'); if (!b || !b.dataset.slug) return; e.preventDefault(); open({ slug: b.dataset.slug, mode: b.dataset.match, anchor: b }); });
  addEventListener('hashchange', () => close(true));
  V3.match = { open, close, get isOpen() { return isOpen(); } };
})();
