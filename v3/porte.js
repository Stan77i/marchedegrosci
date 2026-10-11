/* ═════════ Marché de Gros CI — la porte d'entrée : « Deux mondes. Un même marché. » ═════════
   Scène 2D (canvas) derrière la connexion et l'inscription : à gauche les sillons d'un champ et des points verts (ceux qui produisent),
   à droite les étals d'un marché et des carrés jaunes (ceux qui cherchent) ; des trajectoires les relient et une lumière commune
   apparaît au centre. Les formes reprennent le langage de la carte (cercle = offre, carré = demande, ligne = rencontre) :
   ce sont des métaphores, aucune donnée n'est affichée ni inventée.
   Pourquoi pas WebGL : quelques centaines de traits suffisent ; un canvas 2D coûte moins (batterie, petits téléphones) et n'échoue pas.
   L'intensité suit l'état réel du formulaire : repos · saisie · envoi · réussite · erreur. Mouvement réduit : une image fixe.
   Dans l'application (<html data-app>) sur téléphone : une illustration SVG, animée en CSS (voir monterSvg).
   API : MDGPorte.monter(el, { compact }) → { etat(nom), mode('in'|'up'|'sos'), arreter() } */
(function () {
  'use strict';
  const RECIT = [
    ['v', 'Ceux qui produisent', 'Tout commence par une récolte.'],
    ['a', 'Ceux qui cherchent', 'Chaque besoin ouvre une possibilité.'],
    ['v', 'Ceux qui produisent', 'Derrière chaque produit, il y a un territoire.'],
    ['a', 'Ceux qui cherchent', 'Le bon produit, au bon endroit, au bon moment.'],
    ['l', 'La rencontre', 'Deux mondes. Un même marché.']
  ];
  const C = { v: '#6CC58C', a: '#F2C94C', l: '#6AAEF0', terre: '#C9A27A', sable: '#F5F0E6' };
  const REDUIT = matchMedia('(prefers-reduced-motion: reduce)');
  const CIBLE = { repos: .18, saisie: .38, envoi: .78, ok: 1, erreur: .1 };

  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  // ——— application sur téléphone : une illustration SVG (la porte du marché) au lieu de la scène animée ———
  // Le bandeau ne fait que 132 px : des points mobiles y passaient sous le texte. Ici, une seule image lisible :
  // à gauche les sillons d'un champ, à droite les étals ; au centre une porte ouverte d'où vient la lumière.
  // Le cercle vert (qui produit) et le carré jaune (qui cherche) marchent vers elle ; la ligne bleue (la rencontre) passe le seuil.
  // L'état du formulaire ouvre la porte (saisie), allume la lumière (envoi), fait se rejoindre les deux (réussite).
  const SVG = `<svg class="ps" viewBox="0 0 400 132" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="psL" cx="50%" cy="78%" r="60%"><stop offset="0" stop-color="#FCE6B8"/><stop offset=".45" stop-color="#E9A35E" stop-opacity=".55"/><stop offset="1" stop-color="#E07A3F" stop-opacity="0"/></radialGradient>
    <linearGradient id="psD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3D6"/><stop offset="1" stop-color="#F2B872"/></linearGradient>
    <linearGradient id="psSol" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9A27A" stop-opacity="0"/><stop offset=".5" stop-color="#C9A27A" stop-opacity=".5"/><stop offset="1" stop-color="#F5F0E6" stop-opacity="0"/></linearGradient>
    <clipPath id="psC"><path d="M178 112V52a22 22 0 0 1 44 0v60z"/></clipPath>
  </defs>
  <ellipse class="ps-halo" cx="200" cy="104" rx="150" ry="58" fill="url(#psL)"/>
  <g class="ps-champ" fill="none" stroke="#C9A27A" stroke-linecap="round">
    <path d="M-10 128C60 118 120 112 176 110" stroke-opacity=".5"/><path d="M-10 116C55 110 118 107 176 106" stroke-opacity=".38"/>
    <path d="M-10 104C52 101 116 101 176 102" stroke-opacity=".28"/><path d="M-10 92C50 92 114 95 176 99" stroke-opacity=".2"/>
    <path d="M-10 80C48 83 112 89 176 96" stroke-opacity=".13"/>
    <g fill="#6CC58C" stroke="none" fill-opacity=".5"><path d="M34 96c-4-7-2-14 2-17 1 6 1 11-2 17z"/><path d="M36 96c3-6 9-9 13-8-3 5-7 8-13 8z"/><path d="M92 94c-3-6-1-12 2-14 1 5 1 9-2 14z"/><path d="M94 94c3-5 7-7 11-6-2 4-6 6-11 6z"/><path d="M140 101c-2-5-1-9 2-11 0 4 0 7-2 11z"/></g>
  </g>
  <g class="ps-marche" fill="none" stroke="#F5F0E6" stroke-linejoin="round">
    <g stroke-opacity=".34"><path d="M236 106V84M282 106V84"/><path d="M230 84h58l-5-12h-48z"/><path d="M230 84q4.8 5 9.7 0t9.6 0 9.7 0 9.7 0 9.6 0 9.7 0" /></g>
    <g stroke-opacity=".24"><path d="M300 106V80M352 106V80"/><path d="M294 80h64l-6-13h-52z"/><path d="M294 80q5.3 5 10.7 0t10.6 0 10.7 0 10.7 0 10.6 0 10.7 0"/></g>
    <g stroke-opacity=".15"><path d="M366 106V78M412 106V78"/><path d="M360 78h58l-5-12h-48z"/></g>
    <g fill="#F2C94C" stroke="none" fill-opacity=".35"><rect x="244" y="96" width="9" height="9" rx="1.5"/><rect x="256" y="98" width="7" height="7" rx="1.5"/><rect x="312" y="95" width="10" height="10" rx="1.5"/><rect x="326" y="98" width="7" height="7" rx="1.5"/></g>
  </g>
  <path d="M0 112.5H400" stroke="url(#psSol)"/>
  <g class="ps-porte">
    <path d="M172 112V52a28 28 0 0 1 56 0v60" fill="none" stroke="#F5F0E6" stroke-opacity=".55" stroke-width="1.5"/>
    <path d="M178 112V52a22 22 0 0 1 44 0v60z" fill="#120f0b"/>
    <g clip-path="url(#psC)"><rect class="ps-jour" x="178" y="28" width="44" height="86" fill="url(#psD)"/>
      <path class="ps-battant" d="M178 112V30h22v82z" fill="#2b231a" stroke="#F5F0E6" stroke-opacity=".3"/></g>
    <path class="ps-faisceau" d="M180 112h40l38 20H142z" fill="#FCE6B8" fill-opacity=".22"/>
  </g>
  <path d="M70 118Q200 76 330 118" fill="none" stroke="#6AAEF0" stroke-opacity=".18" stroke-dasharray="2 5"/>
  <g class="ps-lien" fill="none" stroke="#6AAEF0" stroke-width="1.6" stroke-linecap="round"><path d="M70 118Q135 97 200 97" pathLength="1"/><path d="M330 118Q265 97 200 97" pathLength="1"/></g>
  <circle class="ps-v" cx="70" cy="118" r="7" fill="#6CC58C"/>
  <rect class="ps-a" x="323" y="111" width="14" height="14" rx="2.5" fill="#F2C94C"/>
  <circle class="ps-r" cx="200" cy="97" r="3.2" fill="#6AAEF0"/>
</svg>`;
  const CSS = `.ps{position:absolute;inset:0;width:100%;height:100%;display:block}
.ps *{transform-box:fill-box}
.ps-halo{opacity:.55;transform-origin:50% 80%;transition:opacity .8s,transform .8s cubic-bezier(.22,1,.36,1)}
.ps-battant{transform-origin:0 50%;transform:scaleX(1);transition:transform .9s cubic-bezier(.22,1,.36,1)}
.ps-jour{opacity:.75;transition:opacity .6s}.ps-faisceau{opacity:.4;transition:opacity .6s}
.ps-lien path{stroke-dasharray:1;stroke-dashoffset:.72;transition:stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)}.ps-lien{opacity:.7;transition:opacity .6s}
.ps-v,.ps-a{transition:transform 1.1s cubic-bezier(.22,1,.36,1)}
.ps-r{opacity:0;transform-origin:50% 50%;transition:opacity .4s,transform .6s cubic-bezier(.22,1,.36,1)}
.ps-v{animation:psPas 3.2s ease-in-out infinite}.ps-a{animation:psPas 3.2s ease-in-out -1.6s infinite}
@keyframes psPas{50%{translate:0 -2px}}
.ps-halo{animation:psSouffle 5s ease-in-out infinite}@keyframes psSouffle{50%{opacity:.7}}
.pt[data-mode=in] .ps-battant{transform:scaleX(.55)}
.pt[data-mode=up] .ps-battant{transform:scaleX(.7)}
.pt[data-mode=up] .ps-v{transform:translate(18px,-5.4px)}.pt[data-mode=up] .ps-a{transform:translate(-18px,-5.4px)}
.pt[data-etat=saisie] .ps-battant{transform:scaleX(.22)}
.pt[data-etat=saisie] .ps-lien path{stroke-dashoffset:.45}.pt[data-etat=saisie] .ps-lien{opacity:.85}
.pt[data-etat=saisie] .ps-v{transform:translate(34px,-9.6px)}.pt[data-etat=saisie] .ps-a{transform:translate(-34px,-9.6px)}
.pt[data-etat=envoi] .ps-battant{transform:scaleX(.08)}.pt[data-etat=envoi] .ps-jour{opacity:1}.pt[data-etat=envoi] .ps-faisceau{opacity:.9}
.pt[data-etat=envoi] .ps-halo{transform:scale(1.12)}
.pt[data-etat=envoi] .ps-lien path{stroke-dashoffset:.15}.pt[data-etat=envoi] .ps-lien{opacity:1}
.pt[data-etat=envoi] .ps-v{transform:translate(70px,-16.5px)}.pt[data-etat=envoi] .ps-a{transform:translate(-70px,-16.5px)}
.pt[data-etat=ok] .ps-battant{transform:scaleX(0)}.pt[data-etat=ok] .ps-jour,.pt[data-etat=ok] .ps-faisceau{opacity:1}
.pt[data-etat=ok] .ps-halo{transform:scale(1.25);opacity:.9}
.pt[data-etat=ok] .ps-lien path{stroke-dashoffset:0}.pt[data-etat=ok] .ps-lien{opacity:1}
.pt[data-etat=ok] .ps-v{transform:translate(112px,-20.6px)}.pt[data-etat=ok] .ps-a{transform:translate(-112px,-20.6px)}
.pt[data-etat=ok] .ps-r{opacity:1;transform:scale(1.5)}
.pt[data-etat=erreur] .ps-battant{transform:scaleX(.6)}.pt[data-etat=erreur] .ps-lien path{stroke-dashoffset:.85}.pt[data-etat=erreur] .ps-lien{opacity:.4}
@media (prefers-reduced-motion:reduce){.ps *{animation:none!important;transition:none!important}}`;

  function monterSvg(el) {
    if (!document.getElementById('psCss')) { const st = document.createElement('style'); st.id = 'psCss'; st.textContent = CSS; document.head.appendChild(st); }
    el.classList.add('pt', 'pt--svg'); el.dataset.mode = 'in'; el.dataset.etat = 'repos';
    el.innerHTML = SVG + `<p class="pt-sr">La porte du marché : ceux qui produisent et ceux qui cherchent s'y retrouvent.</p>`;
    return {
      etat(n) { if (n in CIBLE) el.dataset.etat = n; },
      mode(m) { el.dataset.mode = m; },
      arreter() {}
    };
  }

  function monter(el, opt = {}) {
    const compact = !!opt.compact;
    if (compact && document.documentElement.hasAttribute('data-app')) return monterSvg(el);  // l'application sur téléphone ; le site garde ses points partout
    el.classList.add('pt');
    el.innerHTML = `<canvas class="pt-cv" aria-hidden="true"></canvas><div class="pt-txt" aria-hidden="true"><span class="pt-k"><i></i><em></em></span><p class="pt-m"></p></div><p class="pt-sr">Deux mondes, un même marché : le Marché de Gros relie ceux qui produisent et ceux qui cherchent, partout en Côte d'Ivoire.</p>`;
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), tx = el.querySelector('.pt-txt'), k = el.querySelector('.pt-k em'), ki = el.querySelector('.pt-k i'), m = el.querySelector('.pt-m');
    let W = 0, H = 0, dpr = 1, raf = 0, t0 = performance.now(), vivant = true, etat = 'repos', I = CIBLE.repos, flash = 0, ix = 0, side = 'v', px = 0, py = 0, pxT = 0, pyT = 0;
    const R = rng(20261012);
    // les acteurs : positions relatives (0..1), fixes, tirées d'une graine (même image à chaque ouverture)
    const V = [...Array(compact ? 5 : 7)].map(() => ({ x: .06 + R() * .3, y: .2 + R() * .62, r: 3 + R() * 2.4, ph: R() * 6.28 }));
    const A = [...Array(compact ? 5 : 7)].map(() => ({ x: .64 + R() * .3, y: .2 + R() * .62, r: 3 + R() * 2.2, ph: R() * 6.28 }));
    // chaque producteur rejoint l'acheteur de même rang en hauteur : des trajectoires qui se croisent peu, comme des routes
    const Vs = [...V].sort((p, q) => p.y - q.y), As = [...A].sort((p, q) => p.y - q.y);
    const L = Vs.map((v, i) => ({ v, a: As[i % As.length], off: R(), sp: .05 + R() * .05 }));
    function taille() {
      const b = el.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, b.width); H = Math.max(1, b.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { taille(); if (REDUIT.matches) dessin(0); }) : null; ro && ro.observe(el); taille();
    function dessin(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const cx = W * .5 + px * 10, cy = H * (compact ? .5 : .46) + py * 8;
      // sol : chaleur à gauche, fraîcheur de la ville à droite, une lumière commune au centre qui grandit avec l'intensité
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * (.25 + I * .4));
      g.addColorStop(0, `rgba(245,214,160,${.05 + I * .16 + flash * .25})`); g.addColorStop(1, 'rgba(245,214,160,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // champ : sillons courbes qui dérivent lentement
      ctx.lineWidth = 1; ctx.strokeStyle = C.terre;
      const nS = compact ? 7 : 12;
      for (let i = 0; i < nS; i++) {
        const y0 = H * (.12 + i * (.8 / nS)); ctx.globalAlpha = (side === 'v' ? .2 : .11) * (1 - i / nS * .4);
        ctx.beginPath();
        for (let x = 0; x <= W * .46; x += 8) { const y = y0 + Math.sin(x / (W * .16) + i * .5 + t * .00012) * H * .025 + (x / W) * H * .06; x ? ctx.lineTo(x + px * 4, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      // marché : étals en perspective douce
      const nC = compact ? 5 : 7, nR = compact ? 3 : 5;
      for (let r = 0; r < nR; r++) for (let c = 0; c < nC; c++) {
        const x = W * (.58 + c * (.4 / nC)) + px * 4, y = H * (.18 + r * (.66 / nR)), s = 6 + r * 1.4;
        ctx.globalAlpha = (side === 'a' ? .16 : .08); ctx.strokeStyle = C.sable; ctx.strokeRect(x, y, s * 1.8, s);
      }
      // trajectoires : chaque producteur rejoint un acheteur ; plus l'intensité monte, plus les lignes se tendent vers la lumière centrale
      L.forEach((l, i) => {
        const ax = l.v.x * W, ay = l.v.y * H, bx = l.a.x * W, by = l.a.y * H, qx = cx + (ax + bx - 2 * cx) * .12 * (1 - I), qy = cy + ((ay + by) / 2 - cy) * (1 - I * .85);
        ctx.globalAlpha = .1 + I * .32 + (side === 'l' ? .12 : 0); ctx.strokeStyle = C.l; ctx.lineWidth = 1 + I * .6;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by); ctx.stroke();
        // la lumière qui circule
        const u = ((t * .001 * l.sp * (1 + I * 2.4)) + l.off) % 1, w = 1 - u;
        const x = w * w * ax + 2 * w * u * qx + u * u * bx, y = w * w * ay + 2 * w * u * qy + u * u * by;
        ctx.globalAlpha = (.35 + I * .6) * Math.sin(u * Math.PI); ctx.fillStyle = C.sable;
        ctx.beginPath(); ctx.arc(x, y, 1.6 + I * 1.2, 0, 6.283); ctx.fill();
      });
      // les deux mondes : cercles verts, carrés jaunes (respiration lente)
      V.forEach(v => { const r = v.r * (1 + Math.sin(t * .0012 + v.ph) * .08); ctx.globalAlpha = side === 'v' ? .95 : .6; ctx.fillStyle = C.v; ctx.beginPath(); ctx.arc(v.x * W + px * 6, v.y * H + py * 4, r, 0, 6.283); ctx.fill(); });
      A.forEach(a => { const s = a.r * 2 * (1 + Math.sin(t * .0012 + a.ph) * .08); ctx.globalAlpha = side === 'a' ? .95 : .6; ctx.fillStyle = C.a; ctx.fillRect(a.x * W - s / 2 + px * 6, a.y * H - s / 2 + py * 4, s, s); });
      // le point de rencontre
      ctx.globalAlpha = .2 + I * .7 + flash * .3; ctx.fillStyle = C.l; ctx.beginPath(); ctx.arc(cx, cy, 2.5 + I * 3 + flash * 6, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function boucle(now) {
      if (!vivant) return;
      const t = now - t0;
      I += (CIBLE[etat] - I) * .045; flash *= .94; px += (pxT - px) * .06; py += (pyT - py) * .06;
      dessin(t);
      raf = requestAnimationFrame(boucle);
    }
    // récit : un message toutes les 6,5 s, fondu lent ; l'écran ne bouge pas pendant la lecture
    function montrer(i) {
      const [s, kk, mm] = RECIT[i % RECIT.length]; side = s;
      tx.classList.add('is-out');
      setTimeout(() => { if (!vivant) return; k.textContent = kk; m.textContent = mm; ki.className = 'pt-i-' + s; tx.classList.remove('is-out'); if (REDUIT.matches) dessin(0); }, REDUIT.matches ? 0 : 420);
    }
    montrer(0);
    const tm = setInterval(() => { if (document.hidden) return; ix++; montrer(ix); }, 6500);
    const onMove = e => { const b = el.getBoundingClientRect(); pxT = ((e.clientX - b.left) / b.width - .5) * 2; pyT = ((e.clientY - b.top) / b.height - .5) * 2; };
    const fin = matchMedia('(pointer:fine)').matches; if (fin && !compact) addEventListener('pointermove', onMove, { passive: true });
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (vivant && !REDUIT.matches) raf = requestAnimationFrame(boucle); };
    document.addEventListener('visibilitychange', onVis);
    if (REDUIT.matches) dessin(0); else raf = requestAnimationFrame(boucle);
    return {
      mode() {},
      etat(n) { if (!(n in CIBLE)) return; etat = n; if (n === 'ok') { flash = 1; side = 'l'; k.textContent = 'La rencontre'; m.textContent = 'La bonne connexion change la suite.'; ki.className = 'pt-i-l'; } if (REDUIT.matches) { I = CIBLE[n]; dessin(0); } },
      arreter() { vivant = false; cancelAnimationFrame(raf); clearInterval(tm); ro && ro.disconnect(); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); }
    };
  }
  window.MDGPorte = { monter };
})();
