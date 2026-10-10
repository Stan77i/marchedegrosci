/* ═════════ V3 — ACCUEIL : héros orbital (structure et comportements repris du héros IVT, contenu Marché de Gros) ═════════
   Desktop ≥ 760 px : anneau SVG, libellés incurvés, graduations = reste du catalogue, point lumineux, sac au centre, panneaux gauche/droite.
   Mobile < 760 px : roue tactile (le produit actif en haut, glisser fait tourner).
   Au cœur de l'anneau : « J'ai / Je cherche » (v3/match.js). Colonne de gauche : famille, produit, disponibilité, prix (v3/marche.js).
   Aucune donnée inventée : sans offre, l'état neutre invite à publier. Contrôles : « Tous les produits », dé (familles). */
(function () {
  'use strict';
  const V3 = window.MDGV3 || (window.MDGV3 = {});
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PIPS = { 1: [[16,16]], 2: [[10,10],[22,22]], 3: [[10,10],[16,16],[22,22]], 4: [[10,10],[22,10],[10,22],[22,22]], 5: [[10,10],[22,10],[16,16],[10,22],[22,22]], 6: [[10,9],[22,9],[10,16],[22,16],[10,23],[22,23]] };

  V3.hero = function (root, X) {
    const { M, prodBy, catBy, offersOf, img, esc, fmt, LIGHT, go } = X, MK = window.MDGMarche, ICO = MK.ICO, demandsOf = X.demandsOf || (() => []);
    const offs = [];
    const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); offs.push(() => t.removeEventListener(ev, f, o)); };
    const rafs = new Set(), timers = new Set();
    const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); f(); }, ms); timers.add(t); };

    /* ——— Données : un produit du catalogue, vu comme dans l'étal ——— */
    const cache = {};
    const P = slug => cache[slug] || (cache[slug] = (() => {
      const p = prodBy[slug], o = offersOf(slug), pr = o.filter(x => x.price != null).sort((a, b) => a.price - b.price);
      const best = pr[0], unite = (best || o[0] || { unit: 'kg' }).unit, villes = [...new Set(o.map(x => x.city))];
      return { slug, nom: p.name, cat: p.categorySlug, catNom: (catBy[p.categorySlug] || {}).name || '', unite, prix: best ? best.price : null,
        origine: villes.slice(0, 2).join(' · '), offres: o.length, demandes: demandsOf(slug).length, img: img(slug) };
    })());
    const TOUS = M.products.map(p => P(p.slug));
    const order = (X.order || []).filter(s => prodBy[s] && img(s));
    // familles : chaque position de l'indicateur = une famille du catalogue ; l'arc porte 8 libellés au plus, le reste de la famille en graduations
    const BUDGET = 60, rang = s => { const i = order.indexOf(s); return i < 0 ? 999 : i; };
    const FAM = M.categories.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(c => {
      const tous = TOUS.filter(p => p.cat === c.slug).sort((a, b) => (!!b.img - !!a.img) || (b.offres - a.offres) || (rang(a.slug) - rang(b.slug)));
      const labels = []; let n = 0;
      tous.forEach(p => { if (labels.length < 8 && n + p.nom.length <= BUDGET) { labels.push(p); n += p.nom.length; } });
      return { slug: c.slug, nom: c.name, tous, labels };
    }).filter(f => f.labels.length);
    const groupes = FAM.map(f => f.labels);

    const fmtF = n => fmt(Math.round(n)).replace(/\u202f/g, ' ');
    function animerNombre(el, de, vers, suffixe) {
      const duree = 620, debut = performance.now();
      cancelAnimationFrame(el._raf || 0);
      const pas = t => { const k = Math.min((t - debut) / duree, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtF(de + (vers - de) * e) + suffixe; if (k < 1) el._raf = requestAnimationFrame(pas); };
      el._raf = requestAnimationFrame(pas);
    }
    const mediaProduit = (p, classe) => p.img
      ? `<div class="packshot"><img class="${classe}" src="${p.img}" alt="${esc(p.nom)} en sac" draggable="false"></div>`
      : `<div class="packshot"><div class="packshot__fallback">${esc(p.nom)}</div></div>`;

    root.classList.add('ivh');
    root.innerHTML = `<div class="ivh-wrap"><div class="hero__stage">
      <div class="hero__sizes" role="group" aria-label="Famille affichée">
        <span class="hero__sizes-label"></span>
        <div class="hero__sizes-track"></div>
        <span class="hero__sizes-value"></span>
      </div>
      <div class="hero__orbit">
        <svg class="hero__orbit-svg" viewBox="0 0 500 500" aria-hidden="true">
          <circle class="hero__ring-path" cx="250" cy="260" r="186" pathLength="360"></circle>
          <circle class="hero__ring-path hero__ring-path--inner" cx="250" cy="260" r="172" pathLength="360"></circle>
          <defs></defs>
          <defs class="hero__fx">
            <radialGradient id="ivhHalo"><stop offset="0" class="hero__halo-0"></stop><stop offset=".38" class="hero__halo-1"></stop><stop offset="1" class="hero__halo-2"></stop></radialGradient>
            <linearGradient id="ivhShine" x1="-1" y1="0" x2="0" y2="0"><stop offset="0" class="hero__sh-a"></stop><stop offset=".42" class="hero__sh-a"></stop><stop offset=".5" class="hero__sh-b"></stop><stop offset=".58" class="hero__sh-a"></stop><stop offset="1" class="hero__sh-a"></stop>
              <animate attributeName="x1" values="-1;1" dur="3.2s" repeatCount="indefinite" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .25 1"></animate>
              <animate attributeName="x2" values="0;2" dur="3.2s" repeatCount="indefinite" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .25 1"></animate>
            </linearGradient>
            <filter id="ivhBloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
          </defs>
          <ellipse class="hero__glow" rx="30" ry="17" cx="250" cy="60"></ellipse>
          <circle class="hero__beam" cx="250" cy="260" r="186" pathLength="360"></circle>
          <g class="hero__ticks"></g>
          <g class="hero__arc-labels"></g>
          <circle class="hero__dot" r="3.2"></circle>
        </svg>
        <div class="hero__labels" role="tablist" aria-label="Produits"></div>
        <div class="hero__media"></div>
        <div class="hero__core" role="group" aria-label="J'ai ou je cherche ce produit">
          <button type="button" class="hero__core-b hero__core-b--jai" data-match="jai" aria-haspopup="dialog" aria-expanded="false"><i aria-hidden="true">${ICO.offre}</i><span><b>J'ai</b><small>une offre</small></span></button>
          <span class="hero__core-ln" aria-hidden="true">${ICO.match}</span>
          <button type="button" class="hero__core-b hero__core-b--ch" data-match="cherche" aria-haspopup="dialog" aria-expanded="false"><i aria-hidden="true">${ICO.demande}</i><span><b>Je cherche</b><small>une offre</small></span></button>
        </div>
        <a class="hero__deco hero__deco--a" href="#/"></a>
        <a class="hero__deco hero__deco--b" href="#/"></a>
      </div>
      <div class="hero__ctrls">
        <button type="button" class="hero__all" aria-haspopup="dialog">
          <span class="hero__all-plus" aria-hidden="true">+</span>
          <span>Tous les produits <b class="hero__all-n">(${TOUS.length})</b></span>
        </button>
        <div class="hero__dice-wrap"${groupes.length < 2 ? ' hidden' : ''} role="group" aria-label="Familles de produits">
          <span class="hero__fam" aria-hidden="true"></span>
          <button type="button" class="hero__dice" aria-keyshortcuts="ArrowLeft ArrowRight">
            <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="3.5" width="25" height="25" rx="7"></rect><g class="hero__pips"></g></svg>
          </button>
          <span class="hero__dice-meta"><span class="hero__dice-row"><button type="button" class="hero__step" data-d="-1" aria-label="Famille précédente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="hero__dice-n" aria-hidden="true"></span><button type="button" class="hero__step" data-d="1" aria-label="Famille suivante"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span><span class="hero__dice-dots">${FAM.map((f, i) => '<button type="button" tabindex="-1" data-i="' + i + '" aria-label="' + esc(f.nom) + '"></button>').join('')}</span></span>
        </div>
        <span class="hero__live" aria-live="polite"></span>
      </div>
      <div class="hero__panel hero__panel--left">
        <p class="hero__fk"></p>
        <h1 class="hero__name"></h1>
        <p class="hero__origin"></p>
        <div class="hero__px"></div>
        <a class="hero__link" href="#/">Voir la fiche</a>
      </div>
    </div></div>`;

    const q = s => root.querySelector(s);
    const labelsEl = q('.hero__labels'), svgEl = q('.hero__orbit-svg'), defsEl = svgEl.querySelector('defs'), arcGroup = svgEl.querySelector('.hero__arc-labels'),
      tickGroup = svgEl.querySelector('.hero__ticks'), dotEl = svgEl.querySelector('.hero__dot'), mediaEl = q('.hero__media'), nameEl = q('.hero__name'),
      originEl = q('.hero__origin'), linkEl = q('.hero__link'), fkEl = q('.hero__fk'), pxEl = q('.hero__px'), coreBtns = [...root.querySelectorAll('.hero__core-b')],
      sizesTrack = q('.hero__sizes-track'), sizesLabel = q('.hero__sizes-label'), sizesValue = q('.hero__sizes-value'), decoA = q('.hero__deco--a'), decoB = q('.hero__deco--b'),
      allBtn = q('.hero__all'), diceBtn = q('.hero__dice'), pipsEl = q('.hero__pips'), diceN = q('.hero__dice-n'),
      diceDots = [...root.querySelectorAll('.hero__dice-dots button')], famEl = q('.hero__fam'), diceWrap = q('.hero__dice-wrap'), liveEl = q('.hero__live'), orbitEl = q('.hero__orbit');

    on(allBtn, 'click', () => { V3.match && V3.match.close(true); ouvrirCatalogue(allBtn, slug => {
      const p = prodBy[slug]; if (!p) return false;
      const fi = FAM.findIndex(f => f.slug === p.categorySlug);
      if (fi >= 0 && fi !== gi) changerGroupe(fi, slug); else montrer(P(slug));
      return true;
    }); });

    const CX = 250, CY = 260, R = 195, DOT_R = 172;
    let gi = 0, groupe = groupes[0] || [], totalSpan = 0, maxDiff = 1, angleBySlug = {};
    const FONT = 10.5, LETTRE = 0.78, perCharDeg = (FONT * LETTRE / R) * (180 / Math.PI), PAD = 1.6, GAP = 3; // valeurs IVT boutique (app.js)
    const polar = (a, r) => { const rad = a * Math.PI / 180; return [CX + Math.sin(rad) * r, CY - Math.cos(rad) * r]; };

    let dotAngle = null, dotAnimId = 0;
    const animateDotTo = target => {
      if (dotAngle === null) { dotAngle = target; const [x, y] = polar(dotAngle, DOT_R); dotEl.setAttribute('cx', x); dotEl.setAttribute('cy', y); return; }
      cancelAnimationFrame(dotAnimId);
      const a0 = dotAngle, t0 = performance.now(), D = 300;
      const step = now => { const t = Math.min((now - t0) / D, 1), e = 1 - Math.pow(1 - t, 3), a = a0 + (target - a0) * e, [x, y] = polar(a, DOT_R); dotEl.setAttribute('cx', x); dotEl.setAttribute('cy', y); dotAngle = a; if (t < 1) dotAnimId = requestAnimationFrame(step); };
      dotAnimId = requestAnimationFrame(step);
    };

    let qte = 1;
    /* Mobile : roue tactile */
    const mqMobile = matchMedia('(max-width: 759px)'), reduitM = matchMedia('(prefers-reduced-motion: reduce)');
    // ordinateur : arc fixe, le point va au produit (comme IVT boutique) ; téléphone : roue tactile, sans inertie
    let mobile = mqMobile.matches, wheelS = 0, wheelAnim = 0, courant = null, halvesM = [];
    const FONT_M = 15, LETTRE_M = 0.8, GAP_M = 9, PAD_M = 2, VIS_M = 92, PX_CRAN = 62;
    const perCharM = (FONT_M * LETTRE_M / R) * (180 / Math.PI);
    const modN = (v, n) => ((v % n) + n) % n;
    function anglesPour(s) {
      const n = groupe.length, out = new Array(n), bySlot = {}, h = Math.floor(n / 2);
      for (let i = 0; i < n; i++) bySlot[modN(i - s + h, n) - h] = i;
      out[bySlot[0]] = 0;
      let a = 0;
      for (let k = 1; bySlot[k] !== undefined; k++) { a += halvesM[bySlot[k - 1]] + halvesM[bySlot[k]] + GAP_M; out[bySlot[k]] = a; }
      a = 0;
      for (let k = -1; bySlot[k] !== undefined; k--) { a -= halvesM[bySlot[k + 1]] + halvesM[bySlot[k]] + GAP_M; out[bySlot[k]] = a; }
      return out;
    }
    // largeur réelle des libellés (police chargée, capitales, gras de l'actif) : l'estimation par nombre de lettres faisait se chevaucher les noms longs
    let mesOk = false; const mesCv = document.createElement('canvas').getContext('2d');
    function mesureM() {
      const texts = arcGroup.children;
      halvesM = groupe.map((p, i) => {
        const est = (p.nom.length * perCharM) / 2 + PAD_M, t = texts[i]; if (!t) return est;
        const cs = getComputedStyle(t), fs = parseFloat(cs.fontSize) || FONT_M, ls = parseFloat(cs.letterSpacing) || 0;
        const txt = cs.textTransform === 'uppercase' ? p.nom.toUpperCase() : p.nom;
        mesCv.font = '600 ' + fs + 'px ' + cs.fontFamily;
        const L = mesCv.measureText(txt).width + ls * txt.length;
        return Math.max(est, (L / R) * (90 / Math.PI) + PAD_M);
      });
      mesOk = true;
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { mesOk = false; if (mobile && root.isConnected) renderRoue(wheelS); });
    function renderRoue(sf) {
      const n = groupe.length;
      if (!n || !mobile) return;
      if (!mesOk) mesureM();
      const a0 = Math.floor(sf), t = sf - a0, A = anglesPour(modN(a0, n)), B = anglesPour(modN(a0 + 1, n));
      const paths = defsEl.children, texts = arcGroup.children, btns = labelsEl.querySelectorAll('.hero__label:not(.hero__label--flat)');
      for (let i = 0; i < n; i++) {
        const ang = Math.abs(B[i] - A[i]) > 180 ? (t < 0.5 ? A[i] : B[i]) : A[i] + (B[i] - A[i]) * t;
        const h = halvesM[i], d = Math.abs(ang), [x1, y1] = polar(ang - h, R), [x2, y2] = polar(ang + h, R);
        if (paths[i]) paths[i].setAttribute('d', 'M ' + x1 + ',' + y1 + ' A ' + R + ',' + R + ' 0 0 1 ' + x2 + ',' + y2);
        let op = d >= VIS_M ? 0 : 1 - (d / VIS_M) * 0.4;
        if (d > VIS_M - 10) op *= Math.max(0, (VIS_M - d) / 10);
        if (texts[i]) { texts[i].style.opacity = op.toFixed(3); texts[i].classList.toggle('is-active', d < 7); }
        if (btns[i]) { const [bx, by] = polar(ang, R); btns[i].style.left = (bx / 5) + '%'; btns[i].style.top = (by / 5) + '%'; btns[i].style.visibility = op > 0.2 ? 'visible' : 'hidden'; }
      }
    }
    function tournerVers(cible, instant) {
      const n = groupe.length; let delta = modN(cible - wheelS, n); if (delta > n / 2) delta -= n;
      const from = wheelS, to = wheelS + delta;
      cancelAnimationFrame(wheelAnim); wheelAnim = 0;
      if (instant || reduitM.matches || Math.abs(delta) < 0.001) { wheelS = modN(to, n); renderRoue(wheelS); return; }
      const t0 = performance.now(), D = 460 + Math.min(Math.abs(delta), 3) * 70;
      const step = now => { const k = Math.min((now - t0) / D, 1), e = 1 - Math.pow(1 - k, 3); wheelS = from + (to - from) * e; renderRoue(wheelS); if (k < 1) wheelAnim = requestAnimationFrame(step); else { wheelAnim = 0; wheelS = modN(to, n); } };
      wheelAnim = requestAnimationFrame(step);
    }

    function construire() {
      defsEl.innerHTML = ''; arcGroup.innerHTML = ''; tickGroup.innerHTML = ''; labelsEl.innerHTML = '';
      const n = groupe.length, dans = new Set(groupe.map(p => p.slug)), autres = (FAM[gi] ? FAM[gi].tous : TOUS).filter(p => !dans.has(p.slug));
      const halves = groupe.map(p => (p.nom.length * perCharDeg) / 2 + PAD);
      totalSpan = halves.reduce((s, h) => s + 2 * h, 0) + GAP * (n - 1); maxDiff = totalSpan / 2 || 1;
      halvesM = groupe.map(p => (p.nom.length * perCharM) / 2 + PAD_M); mesOk = false; wheelS = 0;
      let cursor = -totalSpan / 2;
      const angles = groupe.map((p, i) => { const a = cursor + halves[i]; cursor += 2 * halves[i] + GAP; return a; });
      angleBySlug = {}; groupe.forEach((p, i) => { angleBySlug[p.slug] = angles[i]; });
      // graduations : le reste du catalogue, réparti dans les intervalles entre libellés (jamais hors de l'arc)
      tickGroup.classList.toggle('is-dense', autres.length / Math.max(1, n - 1) > 6);
      const buckets = angles.map(() => []);
      autres.forEach((p, i) => buckets[i % (n - 1 || 1)].push(p));
      buckets.forEach((bucket, i) => {
        if (i >= n - 1) return;
        const w0 = angles[i] + halves[i], margin = GAP * 0.15, usable = GAP - margin * 2;
        bucket.forEach((p, j) => { angleBySlug[p.slug] = w0 + margin + (bucket.length > 1 ? usable * (j + 0.5) / bucket.length : usable / 2); });
      });
      groupe.forEach((p, i) => {
        const angle = angles[i], b = document.createElement('button');
        b.type = 'button'; b.className = 'hero__label'; b.dataset.slug = p.slug; b.dataset.angle = angle;
        b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false'); b.setAttribute('aria-label', p.nom);
        const [bx, by] = polar(angle, R); b.style.left = (bx / 5) + '%'; b.style.top = (by / 5) + '%';
        b.textContent = p.nom; b.addEventListener('click', () => montrer(p)); labelsEl.appendChild(b);
        const half = halves[i], [x1, y1] = polar(angle - half, R), [x2, y2] = polar(angle + half, R), pathId = 'ivhArc' + gi + '-' + i;
        const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('id', pathId); path.setAttribute('d', `M ${x1},${y1} A ${R},${R} 0 0 1 ${x2},${y2}`); path.setAttribute('fill', 'none'); defsEl.appendChild(path);
        const text = document.createElementNS(SVG_NS, 'text'); text.setAttribute('class', 'hero__arc-label'); text.dataset.slug = p.slug; text.dataset.angle = angle;
        const tp = document.createElementNS(SVG_NS, 'textPath'); tp.setAttribute('href', '#' + pathId); tp.setAttribute('startOffset', '50%'); tp.style.textAnchor = 'middle'; tp.textContent = p.nom;
        text.appendChild(tp); text.addEventListener('click', () => montrer(p)); arcGroup.appendChild(text);
      });
      autres.forEach(p => {
        const angle = angleBySlug[p.slug]; if (angle == null) return;
        const [x1, y1] = polar(angle, R - 9), [x2, y2] = polar(angle, R + 9);
        const hit = document.createElementNS(SVG_NS, 'line'); hit.setAttribute('x1', x1); hit.setAttribute('y1', y1); hit.setAttribute('x2', x2); hit.setAttribute('y2', y2);
        hit.setAttribute('class', 'hero__tick-hit'); hit.dataset.slug = p.slug; hit.addEventListener('click', () => montrer(p));
        const tt = document.createElementNS(SVG_NS, 'title'); tt.textContent = p.nom; hit.appendChild(tt); tickGroup.appendChild(hit);
        const vis = document.createElementNS(SVG_NS, 'line'); vis.setAttribute('x1', x1); vis.setAttribute('y1', y1); vis.setAttribute('x2', x2); vis.setAttribute('y2', y2);
        vis.setAttribute('class', 'hero__tick'); vis.dataset.slug = p.slug; vis.dataset.angle = angle; tickGroup.appendChild(vis);
        const flat = document.createElement('button'); flat.type = 'button'; flat.className = 'hero__label hero__label--flat'; flat.dataset.slug = p.slug;
        flat.setAttribute('aria-selected', 'false'); flat.textContent = p.nom; flat.addEventListener('click', () => montrer(p)); labelsEl.appendChild(flat);
      });
      const nP = gi + 1, F = FAM[gi];
      pipsEl.innerHTML = PIPS[nP] ? PIPS[nP].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="2.6"></circle>').join('') : '<text x="16" y="20.4" text-anchor="middle">' + nP + '</text>';
      diceN.innerHTML = '<b>' + nP + '</b> / ' + FAM.length;
      if (!reduitM.matches && diceN.animate) diceN.animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
      diceDots.forEach((d, i) => { d.classList.toggle('is-on', i === gi); d.setAttribute('aria-current', String(i === gi)); });
      famEl.textContent = F.nom; diceBtn.title = F.nom;
      diceBtn.setAttribute('aria-label', 'Famille ' + nP + ' sur ' + FAM.length + ' : ' + F.nom + '. Famille suivante');
      renderRoue(0);
    }

    let enCours = false, attente = null, famT = 0;
    const flashFam = () => { diceWrap.classList.add('is-flash'); clearTimeout(famT); famT = setTimeout(() => diceWrap.classList.remove('is-flash'), 1800); };
    function changerGroupe(suivant, cible) {
      const N = FAM.length; if (N < 2 && !cible) return;
      suivant = modN(suivant, N);
      if (suivant === gi) { if (cible && prodBy[cible]) montrer(P(cible)); return; }
      if (enCours) { attente = [suivant, cible]; return; }
      enCours = true;
      const sens = modN(suivant - gi, N) <= N / 2 ? 1 : -1;
      const reduit = reduitM.matches, D = reduit ? 1 : 140, EASE = 'cubic-bezier(.16,1,.3,1)';
      diceBtn.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(' + (200 * sens) + 'deg) scale(.86)', offset: 0.55 }, { transform: 'rotate(' + (360 * sens) + 'deg) scale(1)' }], { duration: reduit ? 1 : 420, easing: EASE });
      const sorties = [
        ...[arcGroup, tickGroup].map(el => el.animate([{ opacity: 1, transform: 'rotate(0deg)' }, { opacity: 0, transform: 'rotate(' + (-14 * sens) + 'deg)' }], { duration: D, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' })),
        labelsEl.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-14 * sens) + 'px)' }], { duration: D, easing: 'ease-in', fill: 'forwards' }),
        mediaEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D, easing: 'ease-in', fill: 'forwards' })
      ];
      sorties[0].finished.then(() => {
        if (!root.isConnected) return;
        gi = suivant; groupe = groupes[gi]; construire(); montrer(cible && prodBy[cible] ? P(cible) : groupe[0]); labelsEl.scrollLeft = 0; sorties.forEach(a => a.cancel());
        [...arcGroup.children].forEach((t, i) => t.animate([{ opacity: 0, transform: 'rotate(' + (16 * sens) + 'deg)' }, { opacity: +(t.style.opacity || 1), transform: 'rotate(0deg)' }], { duration: reduit ? 1 : 340, delay: reduit ? 0 : i * 16, easing: EASE, fill: 'backwards' }));
        tickGroup.animate([{ opacity: 0, transform: 'rotate(' + (16 * sens) + 'deg)' }, { opacity: 1, transform: 'rotate(0deg)' }], { duration: reduit ? 1 : 340, easing: EASE });
        labelsEl.animate([{ opacity: 0, transform: 'translateX(' + (14 * sens) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: reduit ? 1 : 260, easing: EASE });
        flashFam();
        liveEl.textContent = FAM[gi].nom + ', famille ' + (gi + 1) + ' sur ' + N + ' : ' + groupe.map(p => p.nom).join(', ');
        later(() => { enCours = false; if (attente) { const a = attente; attente = null; changerGroupe(a[0], a[1]); } }, reduit ? 0 : 40);
      });
    }
    let sw = null, supprDice = false;
    on(diceBtn, 'click', () => { if (!supprDice) changerGroupe(gi + 1); });
    diceDots.forEach(d => on(d, 'click', () => changerGroupe(+d.dataset.i)));
    root.querySelectorAll('.hero__step').forEach(b => on(b, 'click', e => { e.stopPropagation(); changerGroupe(gi + +b.dataset.d); }));
    on(diceWrap, 'keydown', e => {
      const k = { ArrowRight: gi + 1, ArrowDown: gi + 1, ArrowLeft: gi - 1, ArrowUp: gi - 1, Home: 0, End: FAM.length - 1 }[e.key];
      if (k === undefined) return; e.preventDefault(); changerGroupe(k);
    });
    on(diceWrap, 'pointerdown', e => { sw = { x: e.clientX, y: e.clientY }; });
    on(diceWrap, 'pointerup', e => {
      if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) { supprDice = true; later(() => { supprDice = false; }, 60); changerGroupe(gi + (dx < 0 ? 1 : -1)); }
    });
    on(diceWrap, 'pointercancel', () => { sw = null; });

    function renderSizes() {}

    function montrer(p, initial) {
      courant = p;
      LIGHT.set(p.slug, 'hero', !!initial);
      X.onChange && X.onChange(p.slug);
      mediaEl.classList.remove('is-in'); mediaEl.innerHTML = mediaProduit(p, 'hero__img');
      requestAnimationFrame(() => mediaEl.classList.add('is-in'));
      nameEl.textContent = p.nom; fkEl.textContent = p.catNom;
      const dd = p.demandes ? ' · ' + p.demandes + (p.demandes > 1 ? ' demandes' : ' demande') : '';
      originEl.innerHTML = p.offres
        ? '<i class="hero__st hero__st--on"></i>' + p.offres + (p.offres > 1 ? ' offres disponibles' : ' offre disponible') + (p.origine ? ' · ' + esc(p.origine) : '') + dd
        : '<i class="hero__st"></i>Pas encore d\'offre pour ce produit' + dd;
      pxEl.innerHTML = MK.prixHTML(p.slug, { short: true });
      coreBtns.forEach(b => { b.dataset.slug = p.slug; });
      coreBtns[0].setAttribute('aria-label', "J'ai du " + p.nom.toLowerCase() + ' : publier une offre');
      coreBtns[1].setAttribute('aria-label', 'Je cherche du ' + p.nom.toLowerCase() + (p.offres ? ' : voir les offres' : ' : publier une demande'));
      linkEl.href = '#/produits/' + p.slug;
      later(() => root.dispatchEvent(new CustomEvent('ivh:focus', { detail: { slug: p.slug } })), 0);
      const angleSel = angleBySlug[p.slug] ?? 0;
      labelsEl.querySelectorAll('.hero__label').forEach(b => b.setAttribute('aria-selected', String(b.dataset.slug === p.slug)));
      if (mobile) {
        const iSel = groupe.findIndex(g => g.slug === p.slug);
        if (iSel >= 0) tournerVers(iSel);
        animateDotTo(0);
        const ir = svgEl.querySelector('.hero__ring-path--inner'); if (ir) { ir.style.strokeDasharray = ''; ir.style.strokeDashoffset = ''; }
      } else {
        arcGroup.querySelectorAll('.hero__arc-label').forEach(t => { const actif = t.dataset.slug === p.slug, norm = Math.min(Math.abs(+t.dataset.angle - angleSel) / maxDiff, 1); t.classList.toggle('is-active', actif); t.style.opacity = actif ? '1' : (1 - norm * 0.62).toFixed(2); });
        tickGroup.querySelectorAll('.hero__tick').forEach(t => { const actif = t.dataset.slug === p.slug, norm = Math.min(Math.abs(+t.dataset.angle - angleSel) / maxDiff, 1); t.classList.toggle('is-active', actif); t.style.opacity = actif ? '1' : (1 - norm * 0.7).toFixed(2); });
        animateDotTo(angleSel);
        const ir = svgEl.querySelector('.hero__ring-path--inner');
        // anneaux bornés à l'arc des libellés (jamais sur le sac), halo derrière le produit actif
        const bord = Math.min(108, Math.ceil(totalSpan / 2) + 2), len = 2 * bord, start = 270 - bord;
        const gl = svgEl.querySelector('.hero__glow'); if (gl) { const [gx, gy] = polar(angleSel, R + 4); gl.setAttribute('cx', gx); gl.setAttribute('cy', gy); gl.setAttribute('transform', `rotate(${angleSel} ${gx} ${gy})`); }
        svgEl.querySelectorAll('.hero__ring-path').forEach(c => { c.style.strokeDasharray = `${len} ${360 - len}`; c.style.strokeDashoffset = `${-start}`; });
      }
      { const bm = svgEl.querySelector('.hero__beam'), ix = groupe.indexOf(p); if (bm && ix > -1) { const s = 2 * (mobile ? halvesM[ix] : (p.nom.length * perCharDeg) / 2 + PAD) + 4, aS = mobile ? 0 : (angleBySlug[p.slug] || 0); bm.style.strokeDasharray = s + ' ' + (360 - s); bm.style.strokeDashoffset = String(-(270 + aS - s / 2)); bm.classList.remove('is-on'); void bm.getBBox; requestAnimationFrame(() => bm.classList.add('is-on')); } }
      { const gl = svgEl.querySelector('.hero__glow'); if (gl) { gl.setAttribute('rx', Math.max(28, (p.nom.length * (mobile ? perCharM : perCharDeg) * Math.PI / 180 * R) / 2 + 12)); if (mobile) { gl.setAttribute('cx', 250); gl.setAttribute('cy', 260 - R - 4); gl.removeAttribute('transform'); } } }
      renderSizes(p);
      const pool = TOUS.filter(x => x.img && !groupe.some(g => g.slug === x.slug) && x.slug !== p.slug);
      const src = pool.length ? pool : groupe.filter(x => x.slug !== p.slug), idx = Math.max(0, groupe.indexOf(p)), nn = src.length;
      [[decoA, src[(idx * 2) % nn]], [decoB, src[(idx * 2 + 1) % nn]]].forEach(([el, d]) => {
        if (!d) return;
        el.innerHTML = mediaProduit(d, 'hero__deco-img') + '<span class="hero__deco-tip">' + esc(d.nom) + ' <em>· + ' + (TOUS.length - groupe.length) + ' autres produits</em></span>';
        el.href = '#/produits/' + d.slug; el.setAttribute('aria-label', 'Voir la fiche ' + d.nom);
      });
    }

    /* Panneau « Tous les produits » */
    function ouvrirCatalogue(declencheur, choisir) {
      let dlg = document.getElementById('ivhCat');
      if (!dlg) {
        dlg = document.createElement('dialog'); dlg.id = 'ivhCat'; dlg.className = 'catdlg'; dlg.setAttribute('aria-labelledby', 'ivhCatT');
        const cats = M.categories.filter(c => TOUS.some(p => p.cat === c.slug));
        dlg.innerHTML = `
          <div class="catdlg__head"><div><p class="catdlg__eyebrow">Catalogue</p><h2 class="catdlg__title" id="ivhCatT">${TOUS.length} produits, <em>en direct entre vendeurs et acheteurs</em></h2></div>
            <button type="button" class="catdlg__close" aria-label="Fermer">✕</button></div>
          <div class="catdlg__tools">
            <label class="catdlg__search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input type="search" placeholder="Rechercher un produit…" aria-label="Rechercher un produit" autocomplete="off"></label>
            <div class="catdlg__cats" role="group" aria-label="Familles"><button type="button" class="catdlg__cat" aria-pressed="true" data-cat="">Tout</button>${cats.map(c => `<button type="button" class="catdlg__cat" aria-pressed="false" data-cat="${c.slug}">${esc(c.name)}</button>`).join('')}</div>
          </div>
          <ul class="catdlg__list">${TOUS.map(p => `<li data-cat="${p.cat}" data-q="${esc((p.nom + ' ' + p.catNom).toLowerCase())}"><a class="catdlg__item" href="#/produits/${p.slug}" data-dive data-slug="${p.slug}">
            <span class="catdlg__thumb">${p.img ? `<img src="${p.img}" alt="" loading="lazy">` : `<i>${esc(p.nom.slice(0, 1))}</i>`}</span>
            <span class="catdlg__name">${esc(p.nom)}<small>${esc(p.catNom)}</small></span>
            <span class="catdlg__price">${p.offres ? p.offres + (p.offres > 1 ? ' offres' : ' offre') : ''}<small>${p.offres ? 'disponible' + (p.offres > 1 ? 's' : '') : 'pas encore d’offre'}</small></span></a></li>`).join('')}</ul>
          <p class="catdlg__empty" hidden>Aucun produit ne correspond.</p>`;
        document.body.appendChild(dlg);
        const list = dlg.querySelector('.catdlg__list'), input = dlg.querySelector('input'), empty = dlg.querySelector('.catdlg__empty');
        let cat = '';
        const filtrer = () => { const v = input.value.trim().toLowerCase(); let vis = 0; list.querySelectorAll('li').forEach(li => { const ok = (!cat || li.dataset.cat === cat) && (!v || li.dataset.q.includes(v)); li.hidden = !ok; if (ok) vis++; }); empty.hidden = vis > 0; };
        input.addEventListener('input', filtrer);
        dlg.querySelectorAll('.catdlg__cat').forEach(b => b.addEventListener('click', () => { cat = b.dataset.cat; dlg.querySelectorAll('.catdlg__cat').forEach(x => x.setAttribute('aria-pressed', String(x === b))); filtrer(); }));
        const fermer = () => { dlg.classList.remove('is-open'); setTimeout(() => dlg.open && dlg.close(), 260); };
        dlg._fermer = fermer;
        dlg.querySelector('.catdlg__close').addEventListener('click', fermer);
        dlg.addEventListener('click', e => { if (e.target === dlg) fermer(); });
        dlg.addEventListener('cancel', e => { e.preventDefault(); fermer(); });
        dlg.addEventListener('close', () => { document.documentElement.style.overflow = ''; dlg._retour && dlg._retour.focus && dlg._retour.focus(); });
        list.addEventListener('click', e => {
          const a = e.target.closest('.catdlg__item'); if (!a) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          if (dlg._choisir && dlg._choisir(a.dataset.slug)) fermer(); else { fermer(); go(a.getAttribute('href')); }
        });
      }
      dlg._retour = declencheur; dlg._choisir = choisir;
      { const inp = dlg.querySelector('input'); inp.value = ''; const fb = dlg.querySelector('.catdlg__cat[data-cat="' + (FAM[gi] ? FAM[gi].slug : '') + '"]') || dlg.querySelector('.catdlg__cat'); fb && fb.click(); }
      document.documentElement.style.overflow = 'hidden';
      dlg.showModal();
      requestAnimationFrame(() => dlg.classList.add('is-open'));
      setTimeout(() => { const i = dlg.querySelector('input'); i && i.focus(); }, 60);
    }

    // une publication (J'ai / Je cherche) change le marché : la colonne se met à jour
    V3.onMarket = () => { Object.keys(cache).forEach(k => delete cache[k]); if (courant && root.isConnected) montrer(P(courant.slug)); };

    /* Glisser horizontalement sur l'anneau (mobile) ; le défilement vertical reste natif */
    let drag = null, supprClic = false;
    on(orbitEl, 'pointerdown', e => { if (!mobile || (e.pointerType === 'mouse' && e.button !== 0)) return; drag = { x: e.clientX, y: e.clientY, s: wheelS, dx: 0, on: false, id: e.pointerId }; });
    on(orbitEl, 'pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; cancelAnimationFrame(wheelAnim); wheelAnim = 0; drag.s = wheelS; try { orbitEl.setPointerCapture(e.pointerId); } catch (_) {} orbitEl.classList.add('is-dragging'); }
        else if (Math.abs(dy) > 10) { drag = null; return; } else return;
      }
      drag.dx = dx; wheelS = drag.s - dx / PX_CRAN; renderRoue(wheelS);
    });
    const finDrag = () => {
      if (!drag) return; const d = drag; drag = null; if (!d.on) return;
      orbitEl.classList.remove('is-dragging'); supprClic = true; later(() => { supprClic = false; }, 60);
      let cible = Math.round(wheelS);
      if (cible === Math.round(d.s) && Math.abs(d.dx) > 22) cible += d.dx < 0 ? 1 : -1;
      const p = groupe[modN(cible, groupe.length)];
      if (p && p !== courant && navigator.vibrate) { try { navigator.vibrate(6); } catch (_) {} }
      if (p) montrer(p);
    };
    on(orbitEl, 'pointerup', finDrag); on(orbitEl, 'pointercancel', finDrag);
    on(orbitEl, 'click', e => { if (supprClic) { e.preventDefault(); e.stopPropagation(); } }, true);
    const surChangement = e => { mobile = e.matches; construire(); if (courant) montrer(courant); };
    on(mqMobile, 'change', surChangement);

    /* Lumière qui suit le curseur (pointeur fin) */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduitM.matches) on(root, 'pointermove', e => { const r = root.getBoundingClientRect(); root.style.setProperty('--mx', (e.clientX - r.left) + 'px'); root.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive: true });

    // départ : le produit sous la lumière (ou le premier de l'étal)
    const start = X.start && prodBy[X.start] ? X.start : (groupe[0] && groupe[0].slug);
    { const sp = prodBy[start], g = sp ? FAM.findIndex(f => f.slug === sp.categorySlug) : -1; if (g > 0) { gi = g; groupe = groupes[g]; } }
    construire();
    montrer(P(start), true);
    // flèches au-dessus du dé : petite poussée dans le sens choisi
    root.querySelectorAll('.hero__step').forEach(b => b.addEventListener('click', () => { b.classList.remove('is-go'); void b.offsetWidth; b.classList.add('is-go'); }));

    // Phrase fondatrice : une seule fois par visite, en bulle discrète près de « J'ai / Je cherche » ; se referme seule
    (() => {
      const K = 'mdg-v2:phrase-vue'; let vu = false; try { vu = sessionStorage.getItem(K) === '1'; } catch (_) {}
      if (vu) return;
      const t = document.createElement('aside'); t.className = 'hero__pitch'; t.setAttribute('role', 'note'); t.setAttribute('aria-label', 'Le principe du marché');
      t.innerHTML = '<p><i class="hero__pitch-o" aria-hidden="true"></i><span><b>Tu as quelque chose ?</b> Trouvons ceux qui le cherchent.</span></p><p><i class="hero__pitch-c" aria-hidden="true"></i><span><b>Tu cherches quelque chose ?</b> Trouvons ceux qui l’ont.</span></p><button type="button" class="hero__pitch-x" aria-label="Fermer">×</button>';
      root.appendChild(t);
      let tm = 0; const fermer = () => { clearTimeout(tm); t.classList.remove('is-on'); setTimeout(() => t.remove(), 400); try { sessionStorage.setItem(K, '1'); } catch (_) {} };
      t.querySelector('.hero__pitch-x').onclick = fermer;
      later(() => { if (!root.isConnected) return; t.classList.add('is-on'); tm = setTimeout(fermer, 9000); }, 1400);
      t.addEventListener('pointerenter', () => clearTimeout(tm)); t.addEventListener('pointerleave', () => { tm = setTimeout(fermer, 4000); });
      root.addEventListener('click', e => { if (!t.contains(e.target) && e.target.closest('[data-match], .hero__core button')) fermer(); });
    })();

    if (mobile && !reduitM.matches) later(() => {
      if (drag || wheelAnim || courant !== groupe[0] || !mobile || !root.isConnected) return;
      const t0 = performance.now();
      const step = now => { const k = Math.min((now - t0) / 1100, 1); wheelS = Math.sin(k * Math.PI) * 0.32; renderRoue(wheelS); if (k < 1 && !drag) wheelAnim = requestAnimationFrame(step); else { wheelAnim = 0; if (!drag) { wheelS = 0; renderRoue(0); } } };
      wheelAnim = requestAnimationFrame(step);
    }, 1400);

    const sceneOff = V3.scene ? V3.scene(root) : null;
    return () => {
      sceneOff && sceneOff();
      offs.forEach(f => f()); timers.forEach(clearTimeout); cancelAnimationFrame(wheelAnim); cancelAnimationFrame(dotAnimId);
      clearTimeout(famT); V3.match && V3.match.close(true); V3.onMarket = null;
      const d = document.getElementById('ivhCat'); if (d) { if (d.open) d.close(); d.remove(); }
      document.documentElement.style.overflow = '';
    };
  };
})();
