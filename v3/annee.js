// Marché de Gros CI — « L'année du marché » (#/annee). Mécanique de la frise : bandes de saisons, points par type d'événement, point actif entouré qui avance seul.
// Aucune donnée inventée : récoltes = entrées sourcées de v2/saisons.js ; soudure = FEWS NET ; saisons, forte demande, début des pluies = « à valider » tant qu'aucune source n'est vérifiée.
(function () {
  'use strict';
  const V3 = window.MDGV3 = window.MDGV3 || {};
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const ABR = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  const RANK = { plein: 3, debut: 2, fin: 1 };
  const AUTO_MS = 5000, RESUME_MS = 9000;
  // Phrase de récolte : générée depuis les sources, à valider avant publication définitive
  const PHRASE_VALIDEE = false;
  // Photos validées (docs/IMAGES.md) — jamais une photo d'un autre mois pour combler un manque
  const PHOTO = { 1: 'saison-01-janvier', 2: 'saison-02-fevrier', 5: 'saison-05-mai', 7: 'saison-07-juillet', 8: 'saison-08-aout', 9: 'saison-09-septembre', 10: 'saison-10-octobre', 11: 'saison-11-novembre', 12: 'saison-12-decembre' };
  // Photo d'événement : vignette affichée quand l'événement est actif ce mois-ci
  const EVIMG = { soudure: 'evenement-soudure-etal', demande: 'evenement-vendeuse-monnaie' };
  const thumb = k => EVIMG[k] ? `<img class="an-th" src="v2/img/${EVIMG[k]}-portrait.webp" alt="" loading="lazy" decoding="async">` : `<i class="ev-${k}" aria-hidden="true"></i>`;
  const CREDIT = 'Photo : Marché de Gros CI';
  const EV = { recolte: 'Récolte', soudure: 'Soudure', demande: 'Forte demande', pluies: 'Début des pluies' };
  const SOUDURE = { months: [5, 6, 7, 8], text: 'Soudure dans le nord et le centre : les stocks baissent, on dépend davantage du marché.', src: { label: 'FEWS NET, perspectives juin 2026', url: 'https://fews.net/fr/west-africa/cote-divoire/perspectives-sur-la-securite-alimentaire/juin-2026' } };
  // À valider (aucune source vérifiée) : affichés avec la mention, jamais comme un fait sourcé
  const DEMANDE = { 9: 'Rentrée scolaire', 12: 'Fêtes de fin d\u2019année' };
  const PLUIES = { 4: 'Début de la grande saison des pluies (Sud)', 10: 'Début de la petite saison des pluies (Sud)' };
  const BANDES = [
    { k: 'gss', a: 1, b: 3, f: 'Grande saison sèche', s: 'G. saison sèche', t: 'Sèche' },
    { k: 'gsp', a: 4, b: 7, f: 'Grande saison des pluies', s: 'G. saison des pluies', t: 'Pluies' },
    { k: 'pss', a: 8, b: 9, f: 'Petite saison sèche', s: 'P. saison sèche', t: 'Sèche' },
    { k: 'psp', a: 10, b: 11, f: 'Petite saison des pluies', s: 'P. s. des pluies', t: 'Pluies' },
    { k: 'gss', a: 12, b: 12, f: 'Grande saison sèche', s: 'Sèche', t: 'S.' },
  ];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const mod12 = m => ((m - 1) % 12 + 12) % 12 + 1;
  const portraitMQ = matchMedia('(max-width:759px) and (orientation:portrait)');
  const src = m => PHOTO[m] ? 'v2/img/' + PHOTO[m] + '-' + (portraitMQ.matches ? 'portrait' : 'paysage') + '.webp' : null;
  const cache = {};
  const preload = m => { const s = src(m); if (s && !cache[s]) { const i = new Image(); i.decoding = 'async'; i.src = s; cache[s] = i; } };
  const ICO = {
    prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
    pause: '<path d="M9 6v12M15 6v12"/>', play: '<path d="M8 5.5v13l10-6.5z" stroke-linejoin="round"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;

  V3.annee = function (view, qs, o) {
    const emb = !!(o && o.embed); let inView = !emb; // emb : bloc de l'Accueil, sous le sélecteur orbital
    const X = window.MDGCTX || {}, esc = X.esc || (s => String(s)), reduced = !!X.reduced;
    const qm = +(qs && qs.get('m')); let month = qm >= 1 && qm <= 12 ? qm : new Date().getMonth() + 1;
    let E = [], SRC = [], alive = true, playing = true, timer = 0, hold = false, prod = null;
    const tone = () => 'dark';
    // comme les autres pages : la page garde la lumière du produit choisi sur l'Accueil (sélecteur orbital), sans la changer

    view.innerHTML = `<section class="an${emb ? ' an--emb' : ''}" data-tone="${tone()}" data-screen-label="L'année du marché" aria-label="L'année du marché" aria-roledescription="frise">
      <div class="an-bg" aria-hidden="true"><img class="an-img" alt=""><img class="an-img" alt=""><span class="an-veil"></span></div>
      <div class="an-in">
        <header class="an-top"><div class="an-kr">${emb ? '<h2 class="an-ttl">L’année du marché</h2>' : ''}
          <details class="an-srcd" id="anSrcD"><summary><span>Sources</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></summary>
            <div class="an-srcp"><ul class="an-srcl" id="anSrc"></ul><p class="an-note">Saisons : sud du pays, dates à valider (ANAM, ANADER).</p><p class="an-cr" id="anCr" hidden></p></div></details></div>
          ${emb ? '<p class="an-fp" id="anFp" aria-live="polite"></p>' : ''}${emb ? '<p class="an-m" id="anM"></p>' : '<h1 class="an-m" id="anM"></h1>'}</header>
        <div class="an-mid" aria-live="polite">
          <p class="an-l" id="anL"></p>
          <ul class="an-ev" id="anEv"></ul>
        </div>
        <div class="an-fix"><div class="an-act" id="anAct"></div></div>
        <div class="an-tl" id="anTl">
          <div class="an-bar">
            <div class="an-nav">
              <button type="button" class="an-ar" id="anPrev" aria-label="Mois précédent">${svg('prev')}</button>
              <span class="an-c" id="anC"></span>
              <button type="button" class="an-ar" id="anNext" aria-label="Mois suivant">${svg('next')}</button>
              <span class="an-hint">← → au clavier</span>
            </div>
            <div class="an-lgw">
              <button type="button" class="an-lgb" id="anLgB" aria-expanded="false" aria-controls="anLg">Légende</button>
              <ul class="an-lg" id="anLg">${Object.entries(EV).map(([k, v]) => `<li><i class="ev-${k}"></i>${v}</li>`).join('')}</ul>
            </div>
          </div>
          <div class="an-sc" id="anSc">
            <div class="an-tr" id="anTr">
              <div class="an-bands" aria-label="Saisons (Sud, dates à valider)">${BANDES.map(b => `<span class="an-band b-${b.k}" style="grid-column:${b.a} / ${b.b + 1}" data-f="${b.f}" data-s="${b.s}" data-t="${b.t}" title="${b.f} (à valider)">${b.f}</span>`).join('')}</div>
              <div class="an-line" id="anFr" role="radiogroup" aria-label="Choisir un mois">${MOIS.map((n, i) => `<button type="button" role="radio" data-m="${i + 1}" aria-label="${cap(n)}"><span class="an-ab" aria-hidden="true">${ABR[i]}</span><span class="an-dots" aria-hidden="true"></span></button>`).join('')}
                <span class="an-ring" id="anRing" aria-hidden="true"></span><span class="an-lab" id="anLab" aria-hidden="true"></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
    if (!emb) document.body.classList.add('anmode');
    const $ = q => view.querySelector(q);
    const sec = $('.an'), imgs = [...view.querySelectorAll('.an-img')]; let front = 0;
    const fb = [...$('#anFr').querySelectorAll('button')], sc = $('#anSc'), ring = $('#anRing'), lab = $('#anLab');

    const at = m => {
      const by = {};
      E.forEach(e => { const l = e.months[m]; if (!l) return; if (!by[e.product] || RANK[l] > RANK[by[e.product].l]) by[e.product] = { l, src: by[e.product] ? by[e.product].src : [] }; });
      E.forEach(e => { if (e.months[m] && by[e.product] && !by[e.product].src.includes(e.source)) by[e.product].src.push(e.source); });
      return Object.entries(by).map(([slug, v]) => ({ slug, l: v.l, src: v.src })).sort((a, b) => RANK[b.l] - RANK[a.l]);
    };
    const events = m => [at(m).length && 'recolte', SOUDURE.months.includes(m) && 'soudure', DEMANDE[m] && 'demande', PLUIES[m] && 'pluies'].filter(Boolean);
    const monthsOf = s => { const z = new Set(); E.forEach(e => { if (e.product === s) Object.keys(e.months).forEach(k => z.add(+k)); }); return [...z].sort((x, y) => x - y); };
    // le produit choisi dans la roue de l'Accueil : ses mois de récolte s'allument dans la frise, la frise saute à sa saison
    function paintProd() {
      if (!emb) return;
      const T = track(), ms = T.ms;
      fb.forEach(b => { const on = ms.includes(+b.dataset.m); b.classList.toggle('is-prod', on && !T.fam); b.classList.toggle('is-fam', on && !!T.fam); });
      const el = $('#anFp'); if (!el) return;
      const nm = prod && X.prodBy && X.prodBy[prod] ? X.prodBy[prod].name : '';
      el.innerHTML = !prod || !E.length ? '' : !T.fam && ms.length ? '<b>' + esc(nm) + '</b> · en récolte : ' + ms.map(m => MOIS[m - 1]).join(', ')
        : T.fam && ms.length ? '<b>' + esc(nm) + '</b> · calendrier pas encore sourcé. Dans sa famille, ' + T.fam.map(s => '<b>' + esc(name(s)) + '</b>').join(', ') + ' : ' + ms.map(m => MOIS[m - 1]).join(', ')
        : '<b>' + esc(nm) + '</b> · calendrier de récolte pas encore sourcé';
    }
    // produit sans calendrier sourcé : on suit sa famille (produits sourcés de la même famille), signalé comme tel
    function track() {
      if (!prod) return { ms: [] };
      const own = monthsOf(prod); if (own.length) return { ms: own };
      const P = X.prodBy && X.prodBy[prod]; if (!P) return { ms: [] };
      const sib = [...new Set(E.map(e => e.product))].filter(s => s !== prod && X.prodBy[s] && X.prodBy[s].categorySlug === P.categorySlug);
      const z = new Set(); sib.forEach(s => monthsOf(s).forEach(m => z.add(m)));
      return { ms: [...z].sort((x, y) => x - y), fam: sib.length ? sib : null };
    }
    function focusProd(s) {
      if (!s || s === prod) return; prod = s; if (!E.length) return; paintProd();
      const ms = track().ms;
      if (ms.length && !ms.includes(month)) setMonth(ms.find(m => m > month) || ms[0]); else render(true);
      nudge();
    }
    const nextM = () => { const ms = prod ? track().ms : []; return ms.length > 1 ? (ms.find(m => m > month) || ms[0]) : month + 1; };
    const name = s => (X.prodBy && X.prodBy[s] ? X.prodBy[s].name : s).toLowerCase();
    const list = arr => arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];
    const srcLink = s => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>`;

    function paintDots() {
      fb.forEach((b, i) => { const ev = events(i + 1); b.querySelector('.an-dots').innerHTML = ev.map(k => `<i class="ev-${k}"></i>`).join(''); b.setAttribute('aria-label', cap(MOIS[i]) + (ev.length ? ' : ' + ev.map(k => EV[k].toLowerCase()).join(', ') : '')); b.dataset.n = ev.length; });
    }
    function fitBands() {
      view.querySelectorAll('.an-band').forEach(b => { for (const k of ['f', 's', 't']) { b.textContent = b.dataset[k]; if (b.scrollWidth <= b.clientWidth + 1) break; } });
    }
    function placeRing(smooth) {
      const b = fb[month - 1], n = +b.dataset.n || 1, x = b.offsetLeft + b.offsetWidth / 2;
      ring.style.width = Math.max(30, n * 14 + 16) + 'px';
      ring.style.transform = lab.style.transform = `translateX(${x}px) translateX(-50%)`;
      lab.textContent = cap(MOIS[month - 1]);
      if (sc.scrollWidth > sc.clientWidth + 4) sc.scrollTo({ left: x - sc.clientWidth / 2, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    }
    function showPhoto() {
      const s = src(month), back = imgs[1 - front], cur = imgs[front], cr = $('#anCr');
      cr.textContent = s ? CREDIT : ''; cr.hidden = !s; sec.classList.toggle('has-img', !!s);
      if (!s) { imgs.forEach(i => i.classList.remove('on')); return; }
      if (cur.classList.contains('on') && cur.getAttribute('src') === s) return;
      const swap = () => { if (!alive) return; back.classList.add('on'); cur.classList.remove('on'); front = 1 - front; };
      back.onload = swap; back.onerror = () => imgs.forEach(i => i.classList.remove('on'));
      back.setAttribute('src', s); if (back.complete && back.naturalWidth) swap();
    }
    // rien n'est jamais coupé à mi-ligne : si la hauteur manque, les lignes d'événements qui ne tiennent pas entièrement sont masquées (de la dernière à la première), puis la phrase passe à une ligne
    // le nom du mois tient toujours sur la largeur (« Septembre », « Novembre » sur téléphone)
    function fitM() { const h = $('#anM'); h.style.fontSize = ''; const w = h.clientWidth; if (!w) return; let fs = parseFloat(getComputedStyle(h).fontSize); while (h.scrollWidth > w + 1 && fs > 36) { fs -= 2; h.style.setProperty('font-size', fs + 'px', 'important'); } }
    function fitMid() {
      const mid = $('.an-mid'), L = $('#anL'), rows = [...view.querySelectorAll('#anEv li')];
      L.classList.remove('is-tight'); rows.forEach(li => { li.hidden = false; }); $('#anEv').hidden = !rows.length;
      const over = () => mid.scrollHeight > mid.clientHeight + 1;
      for (let i = rows.length - 1; i >= 0 && over(); i--) rows[i].hidden = true;
      if (rows.length && rows.every(li => li.hidden)) $('#anEv').hidden = true;
      if (over()) L.classList.add('is-tight');
    }
    function render(smooth) {
      const it0 = at(month), it = prod ? it0.filter(x => x.slug === prod).concat(it0.filter(x => x.slug !== prod)) : it0, M = MOIS[month - 1], used = new Set();
      $('#anM').textContent = cap(M); fitM();
      $('#anC').textContent = String(month).padStart(2, '0') + ' / 12';
      const shown = it.slice(0, 2), more = it.length - shown.length;
      const names = shown.map(x => `<a href="#/produits/${x.slug}">${esc(name(x.slug))}</a>`).concat(more > 0 ? [more + (more > 1 ? ' autres produits' : ' autre produit')] : []);
      $('#anL').innerHTML = it.length ? `${thumb('recolte')}<span>${PHRASE_VALIDEE ? '' : '<em class="an-tag">À valider</em> '}${cap(M)} : ${list(names)} en récolte.</span>` : '<span>Calendrier en cours de constitution pour ce produit.</span>';
      shown.forEach(x => x.src.slice(0, 1).forEach(id => used.add(id)));
      const rows = [];
      if (SOUDURE.months.includes(month)) rows.push(`<li>${thumb('soudure')}<span>${SOUDURE.text}</span></li>`);
      if (DEMANDE[month]) rows.push(`<li>${thumb('demande')}<span><em class="an-tag">À valider</em> Forte demande : ${esc(DEMANDE[month].toLowerCase())}.</span></li>`);
      if (PLUIES[month]) rows.push(`<li><i class="ev-pluies" aria-hidden="true"></i><span><em class="an-tag">À valider</em> ${esc(PLUIES[month])}.</span></li>`);
      $('#anEv').innerHTML = rows.join(''); $('#anEv').hidden = !rows.length;
      const top = it[0];
      $('#anAct').innerHTML = top ? `<button type="button" class="btn btn-primary" data-match="jai" data-slug="${top.slug}">J'ai ${esc(name(top.slug))}</button><button type="button" class="btn btn-secondary" data-match="cherche" data-slug="${top.slug}">Je cherche ${esc(name(top.slug))}</button>` : `<a class="btn btn-secondary" href="#/demande">Publier une demande</a>`;
      const S = SRC.filter(s => used.has(s.id));
      const SL = S.map(s => `<li><small>Récolte</small>${srcLink(s)}</li>`); if (SOUDURE.months.includes(month)) SL.push(`<li><small>Soudure</small>${srcLink(SOUDURE.src)}</li>`);
      $('#anSrc').innerHTML = SL.join(''); $('#anSrcD summary span').textContent = SL.length ? 'Sources (' + SL.length + ')' : 'Sources';
      fb.forEach(b => { const on = +b.dataset.m === month; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; b.classList.toggle('on', on); });
      placeRing(smooth); fitMid(); showPhoto(); preload(mod12(month + 1)); preload(mod12(month - 1));
    }
    const setMonth = (m, user) => {
      m = mod12(m); if (user) nudge(); if (m === month) return; month = m;
      if (!emb) try { history.replaceState(history.state, '', '#/annee?m=' + m); } catch (_) {}
      render(true);
      if (window.MDGFlou) window.MDGFlou.pulse(view.querySelectorAll('#anM, .an-mid, .an-act'));
    };

    // passage automatique de point à point ; onglet caché = arrêt ; un choix de l'utilisateur relance le compte à 9 s
    const schedule = d => { clearTimeout(timer); if (!playing || !alive) return; timer = setTimeout(() => { if (hold || document.hidden || !inView) return schedule(AUTO_MS); setMonth(nextM()); schedule(AUTO_MS); }, d); };
    const nudge = () => schedule(RESUME_MS);
    // défile seul ; seule exception : le clavier dans la frise (on ne déplace pas le mois sous le focus)
    const tl = $('#anTl');
    tl.addEventListener('focusin', e => { hold = e.target.matches(':focus-visible'); });
    tl.addEventListener('focusout', () => { hold = false; });

    const srcD = $('#anSrcD'); const closeSrc = e => { if (srcD.open && !srcD.contains(e.target)) srcD.open = false; }; document.addEventListener('pointerdown', closeSrc);
    fb.forEach(b => b.onclick = () => setMonth(+b.dataset.m, true));
    $('#anPrev').onclick = () => setMonth(month - 1, true);
    $('#anNext').onclick = () => setMonth(month + 1, true);
    const onKey = e => { if (emb && !sec.contains(document.activeElement)) return; if (e.target.closest('input,textarea,select')) return; const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault(); setMonth(month + k, true); if ($('#anFr').contains(document.activeElement)) fb[month - 1].focus(); };
    addEventListener('keydown', onKey);
    const lgB = $('#anLgB');
    lgB.onclick = () => { const o = lgB.getAttribute('aria-expanded') !== 'true'; lgB.setAttribute('aria-expanded', o); sec.classList.toggle('lg-open', o); };
    let x0 = null;
    sec.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !e.target.closest('a,button,.an-sc')) x0 = e.clientX; });
    sec.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 48) setMonth(month + (dx < 0 ? 1 : -1), true); });
    const onMQ = () => { imgs.forEach(i => { i.removeAttribute('src'); i.classList.remove('on'); }); showPhoto(); };
    portraitMQ.addEventListener('change', onMQ);
    const ro = new ResizeObserver(() => { fitBands(); placeRing(false); fitM(); fitMid(); }); ro.observe($('#anTr')); ro.observe($('.an-mid'));
    
    if (reduced) sec.classList.add('rm');
    const io = emb && 'IntersectionObserver' in window ? new IntersectionObserver(([en]) => { inView = en.isIntersecting; }, { threshold: 0.35 }) : null; if (io) io.observe(sec);

    paintDots(); render(false); fitBands(); schedule(AUTO_MS);
    import(new URL('v2/saisons.js', document.baseURI).href).then(m => {
      if (!alive) return;
      const v = m.validate(X.prodBy || {}, X.regBy || {}); E = v.entries; SRC = m.SAISONS.meta.sources;
      paintDots(); render(false);
      const p = prod; prod = null; if (p) focusProd(p);
    }).catch(() => { $('#anL').textContent = 'Calendrier en cours de constitution pour ce produit.'; });

    const cleanup = () => { alive = false; if (io) io.disconnect(); if (!emb) document.body.classList.remove('anmode'); clearTimeout(timer); ro.disconnect(); removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', closeSrc); portraitMQ.removeEventListener('change', onMQ); };
    cleanup.focus = focusProd; return cleanup;
  };
})();
