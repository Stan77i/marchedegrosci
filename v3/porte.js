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
  const C = { v: '#6CC58C', a: '#F2C94C', l: '#F2C94C', terre: '#C9A27A', sable: '#F5F0E6' };
  const REDUIT = matchMedia('(prefers-reduced-motion: reduce)');
  const CIBLE = { repos: .18, saisie: .38, envoi: .78, ok: 1, erreur: .1 };

  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  // ——— application sur téléphone : le sac, notre personnage, à la porte du marché (demande du propriétaire, 22/10/2026 :
  // « l'entrée doit être en harmonie : notre logo phare, c'est le sac ») ———
  // Le bandeau de 132 px montre le sac v2 (app/sac.js) sous une lumière chaude. Son humeur suit l'état réel du formulaire :
  // repos → il attend et regarde autour ; saisie → il se redresse, la lumière monte ; envoi → les produits tombent (il se remplit) ;
  // réussite → plein, il saute ; erreur → triste ; hors connexion → ficelé, il dort. La scène « deux mondes » reste pour le site.
  const scene = (k = 'ps') => `<svg class="ps" viewBox="0 0 400 132" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="${k}L" cx="50%" cy="78%" r="60%"><stop offset="0" stop-color="#FCE6B8"/><stop offset=".45" stop-color="#E9A35E" stop-opacity=".55"/><stop offset="1" stop-color="#E07A3F" stop-opacity="0"/></radialGradient>
    <linearGradient id="${k}D" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3D6"/><stop offset="1" stop-color="#F2B872"/></linearGradient>
    <linearGradient id="${k}Sol" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9A27A" stop-opacity="0"/><stop offset=".5" stop-color="#C9A27A" stop-opacity=".5"/><stop offset="1" stop-color="#F5F0E6" stop-opacity="0"/></linearGradient>
    <clipPath id="${k}C"><path d="M178 112V52a22 22 0 0 1 44 0v60z"/></clipPath>
  </defs>
  <ellipse class="ps-halo" cx="200" cy="104" rx="150" ry="58" fill="url(#${k}L)"/>
  <g class="ps-champ" fill="none" stroke="#C9A27A" stroke-linecap="round">
    <path d="M-10 128C60 118 120 112 176 110" stroke-opacity=".5"/><path d="M-10 116C55 110 118 107 176 106" stroke-opacity=".38"/>
    <path d="M-10 104C52 101 116 101 176 102" stroke-opacity=".28"/><path d="M-10 92C50 92 114 95 176 99" stroke-opacity=".2"/>
    <path d="M-10 80C48 83 112 89 176 96" stroke-opacity=".13"/>
    <g fill="#6CC58C" stroke="none" fill-opacity=".5"><g class="ps-pousse"><path d="M34 96c-4-7-2-14 2-17 1 6 1 11-2 17z"/><path d="M36 96c3-6 9-9 13-8-3 5-7 8-13 8z"/></g><g class="ps-pousse" style="animation-delay:-1.3s"><path d="M92 94c-3-6-1-12 2-14 1 5 1 9-2 14z"/><path d="M94 94c3-5 7-7 11-6-2 4-6 6-11 6z"/></g><g class="ps-pousse" style="animation-delay:-2.4s"><path d="M140 101c-2-5-1-9 2-11 0 4 0 7-2 11z"/></g></g>
  </g>
  <g class="ps-marche" fill="none" stroke="#F5F0E6" stroke-linejoin="round">
    <g stroke-opacity=".34"><path d="M236 106V84M282 106V84"/><path d="M230 84h58l-5-12h-48z"/><path d="M230 84q4.8 5 9.7 0t9.6 0 9.7 0 9.7 0 9.6 0 9.7 0" /></g>
    <g stroke-opacity=".24"><path d="M300 106V80M352 106V80"/><path d="M294 80h64l-6-13h-52z"/><path d="M294 80q5.3 5 10.7 0t10.6 0 10.7 0 10.7 0 10.6 0 10.7 0"/></g>
    <g stroke-opacity=".15"><path d="M366 106V78M412 106V78"/><path d="M360 78h58l-5-12h-48z"/></g>
    <g fill="#F2C94C" stroke="none" fill-opacity=".35"><rect x="244" y="96" width="9" height="9" rx="1.5"/><rect x="256" y="98" width="7" height="7" rx="1.5"/><rect x="312" y="95" width="10" height="10" rx="1.5"/><rect x="326" y="98" width="7" height="7" rx="1.5"/></g>
  </g>
  <path d="M0 112.5H400" stroke="url(#${k}Sol)"/>
  <g class="ps-porte">
    <path d="M172 112V52a28 28 0 0 1 56 0v60" fill="none" stroke="#F5F0E6" stroke-opacity=".55" stroke-width="1.5"/>
    <path d="M178 112V52a22 22 0 0 1 44 0v60z" fill="#120f0b"/>
    <g clip-path="url(#${k}C)"><rect class="ps-jour" x="178" y="28" width="44" height="86" fill="url(#${k}D)"/>
      <path class="ps-battant" d="M178 112V30h22v82z" fill="#2b231a" stroke="#F5F0E6" stroke-opacity=".3"/></g>
    <g class="ps-poussiere" fill="#FFF3D6" clip-path="url(#${k}C)"><circle cx="190" cy="104" r="1"/><circle cx="204" cy="108" r="1.2" style="animation-delay:-1.4s"/><circle cx="213" cy="102" r=".9" style="animation-delay:-2.6s"/><circle cx="196" cy="110" r=".8" style="animation-delay:-3.5s"/></g>
    <path class="ps-faisceau" d="M180 112h40l38 20H142z" fill="#FCE6B8" fill-opacity=".22"/>
  </g>
  <path d="M70 118Q200 76 330 118" fill="none" stroke="#F2C94C" stroke-opacity=".18" stroke-dasharray="2 5"/>
  <g class="ps-lien" fill="none" stroke="#F2C94C" stroke-width="1.6" stroke-linecap="round"><path d="M70 118Q135 97 200 97" pathLength="1"/><path d="M330 118Q265 97 200 97" pathLength="1"/></g>
  <g class="ps-flux" fill="#F5F0E6">
    <circle r="1.6" opacity="0"><animateMotion dur="3.4s" repeatCount="indefinite" path="M70 118Q135 97 200 97"/><animate attributeName="opacity" values="0;.9;0" dur="3.4s" repeatCount="indefinite"/></circle>
    <circle r="1.3" opacity="0"><animateMotion dur="3.4s" begin="-1.7s" repeatCount="indefinite" path="M70 118Q135 97 200 97"/><animate attributeName="opacity" values="0;.8;0" dur="3.4s" begin="-1.7s" repeatCount="indefinite"/></circle>
    <circle r="1.6" opacity="0"><animateMotion dur="3.8s" begin="-.9s" repeatCount="indefinite" path="M330 118Q265 97 200 97"/><animate attributeName="opacity" values="0;.9;0" dur="3.8s" begin="-.9s" repeatCount="indefinite"/></circle>
    <circle r="1.3" opacity="0"><animateMotion dur="3.8s" begin="-2.8s" repeatCount="indefinite" path="M330 118Q265 97 200 97"/><animate attributeName="opacity" values="0;.8;0" dur="3.8s" begin="-2.8s" repeatCount="indefinite"/></circle>
  </g>
  <circle class="ps-v" cx="70" cy="118" r="7" fill="#6CC58C"/>
  <rect class="ps-a" x="323" y="111" width="14" height="14" rx="2.5" fill="#F2C94C"/>
  <circle class="ps-r" cx="200" cy="97" r="3.2" fill="#F2C94C"/>
</svg>`;
  const SVG = scene('ps');
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
.ps-pousse{transform-origin:50% 100%;animation:psVent 4.2s ease-in-out infinite}@keyframes psVent{0%,100%{rotate:-4deg}50%{rotate:5deg}}
.ps-jour{animation:psJour 6s ease-in-out infinite}@keyframes psJour{50%{filter:brightness(1.08)}}
.ps-poussiere circle{animation:psMonte 4.6s linear infinite;opacity:0}@keyframes psMonte{0%{opacity:0;translate:0 0}20%{opacity:.8}100%{opacity:0;translate:3px -58px}}
.ps-flux{opacity:.55;transition:opacity .6s}.pt[data-etat=saisie] .ps-flux{opacity:.85}.pt[data-etat=envoi] .ps-flux,.pt[data-etat=ok] .ps-flux{opacity:1}.pt[data-etat=erreur] .ps-flux{opacity:.15}
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
.pt[data-etat=ferme] .ps-jour{opacity:.28}.pt[data-etat=ferme] .ps-faisceau{opacity:.08}.pt[data-etat=ferme] .ps-halo{opacity:.18;animation:none}.pt[data-etat=ferme] .ps-lien{opacity:.3}
.pt[data-etat=erreur] .ps-battant{transform:scaleX(.6)}.pt[data-etat=erreur] .ps-lien path{stroke-dashoffset:.85}.pt[data-etat=erreur] .ps-lien{opacity:.4}
@media (prefers-reduced-motion:reduce){.ps *{animation:none!important;transition:none!important}}`;

  const SCSS = `.pt--sac .ps-fond{position:absolute;inset:0;width:100%;height:100%;display:block}
.pt--sac .ps-halo{opacity:.55;transform-box:fill-box;transform-origin:50% 100%;transition:opacity .7s,transform .9s cubic-bezier(.22,1,.36,1);animation:psSouffle 5s ease-in-out infinite}
.pt--sac .ps-scene{overflow:hidden}
.pt--sac .ps-scene .mk{--mk-tint:#F2C230;transition:filter .7s}
.pt[data-etat=saisie] .ps-scene .mk{filter:brightness(1.08)}
.pt[data-etat=envoi] .ps-scene .mk,.pt[data-etat=ok] .ps-scene .mk{filter:brightness(1.18) saturate(1.1)}
.pt[data-etat=erreur] .ps-scene .mk{filter:brightness(.7) saturate(.6)}
.pt[data-etat=ferme] .ps-scene .mk{filter:brightness(.55) saturate(.4)}
/* le sac devant les étals : une ombre chaude le pose au sol */
.pt--sac .ps-sac{position:absolute;left:50%;bottom:6px;line-height:0;transform:translateX(-50%);transition:transform .55s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 6px 10px rgba(0,0,0,.45))}
.pt--sac .ps-sac svg{display:block}
.pt--sac .ps-sac.chg svg{animation:psPose .4s cubic-bezier(.22,1,.36,1) both}
@keyframes psPose{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
.pt[data-etat=saisie] .ps-sac{transform:translateX(-50%) translateY(-5px) scale(1.04)}.pt[data-etat=saisie] .ps-halo{opacity:.85}
.pt[data-etat=envoi] .ps-halo{opacity:1;transform:scale(1.1)}
.pt[data-etat=ok] .ps-halo{opacity:1;transform:scale(1.25)}.pt[data-etat=ok] .ps-sac{transform:translateX(-50%) scale(1.06)}
.pt[data-etat=erreur] .ps-halo{opacity:.22;animation:none}
.pt[data-etat=ferme] .ps-halo{opacity:.14;animation:none}
@media (prefers-reduced-motion:reduce){.pt--sac .ps-halo,.pt--sac .ps-sac{transition:none;animation:none}.pt--sac .ps-sac.chg svg{animation:none}}`;
  const HUMEUR = { repos: 'vide', saisie: 'vide', envoi: 'charge', ok: 'plein', erreur: 'triste', ferme: 'ferme' };
  function monterSvg(el, large) {
    if (!document.getElementById('psSacCss')) { const st = document.createElement('style'); st.id = 'psSacCss'; st.textContent = SCSS; document.head.appendChild(st); }
    el.classList.add('pt', 'pt--sac'); el.dataset.mode = 'in'; el.dataset.etat = 'repos';
    // le marché (app/scene.js) s'exprime seul : pas de sac ici, il vient dire bienvenue une fois la connexion réussie (entrer())
    if (window.MDGScene) MDGScene.css();
    el.innerHTML = (window.MDGScene ? `<div class="ps-fond ps-scene">${MDGScene.svg('ps')}</div>` : `<svg class="ps-fond" viewBox="0 0 400 132" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs><radialGradient id="psH" cx="50%" cy="100%" r="62%"><stop offset="0" stop-color="#F2C230" stop-opacity=".4"/><stop offset=".55" stop-color="#E9A35E" stop-opacity=".14"/><stop offset="1" stop-color="#E07A3F" stop-opacity="0"/></radialGradient></defs>
      <ellipse class="ps-halo" cx="200" cy="134" rx="200" ry="104" fill="url(#psH)"/><path d="M0 123.5H400" stroke="rgba(245,240,230,.16)"/></svg>`) +
      `<p class="pt-sr">Un marché de gros le soir : des étals éclairés, des vendeuses, et des passants qui traversent la rue.</p>`;
    // grand écran : la colonne est haute ; on garde tout le marché, calé en bas, et le ciel continue au-dessus
    if (large) { el.classList.add('ps-large'); el.querySelector('.mk')?.setAttribute('preserveAspectRatio', 'xMidYMax meet'); }
    return {
      etat(n) { if (n in HUMEUR) el.dataset.etat = n; },
      mode(m) { el.dataset.mode = m; },
      arreter() {}
    };
  }

  function monter(el, opt = {}) {
    const compact = !!opt.compact;
    if (document.documentElement.hasAttribute('data-app')) return monterSvg(el, !compact);  // l'application : le marché à toutes les tailles ; le site garde ses points
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
  function cssScene() { if (!document.getElementById('psCss')) { const st = document.createElement('style'); st.id = 'psCss'; st.textContent = CSS; document.head.appendChild(st); } }

  /* ——— <mdg-marche> : le marché, derrière la roue des produits de l'accueil (application) ———
     Comme une photo prise avec un arrière-plan doux : la scène de la porte (champ, étals, porte éclairée), floutée et assourdie,
     posée sous le sac ; devant elle, nets, des points de lumière qui flottent lentement et des lueurs qui filent sur les fils.
     La couche floutée ne bouge pas (elle n'est calculée qu'une fois : rien ne se re-floute à chaque image, la batterie est épargnée) ;
     seuls les petits points nets s'animent, en transform/opacity. Mouvement réduit : tout est immobile. */
  const MCSS = `mdg-marche{position:absolute;inset:0;z-index:0;display:block;pointer-events:none;overflow:hidden;contain:strict}
.mf-cadre{position:absolute;left:-100%;width:300%;aspect-ratio:400/132;top:var(--mf-y,64%);transform:translateY(-85.3%);
  -webkit-mask:linear-gradient(to bottom,transparent 0%,#000 22%,#000 80%,transparent 100%);mask:linear-gradient(to bottom,transparent 0%,#000 22%,#000 80%,transparent 100%)}
.mf-flou{position:absolute;inset:0;filter:blur(5px) saturate(.95);opacity:.6;transform:translateZ(0)}
.mf-flou .ps *{animation:none!important;transition:none!important}
.mf-net{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.mf-bk{position:absolute;inset:0}
.mf-bk i{position:absolute;border-radius:50%;opacity:0;background:radial-gradient(circle,var(--c) 0%,transparent 70%);animation:mfFlotte var(--d) ease-in-out 2;animation-delay:var(--t)}
@keyframes mfFlotte{0%{opacity:0;transform:translate3d(0,0,0) scale(.8)}25%{opacity:var(--o)}70%{opacity:calc(var(--o) * .7)}100%{opacity:0;transform:translate3d(var(--x),-46px,0) scale(1.1)}}
@media (prefers-reduced-motion:reduce){.mf-bk i{animation:none;opacity:calc(var(--o) * .6)}}`;
  const BOKEH = [[12, 58, 14, '#FCE6B8', .32, 11], [24, 70, 8, '#6CC58C', .4, 13], [37, 52, 18, '#F5D6A0', .22, 15], [50, 66, 10, '#FFF3D6', .45, 10], [61, 57, 7, '#F2C94C', .38, 12],
    [72, 72, 16, '#FCE6B8', .26, 14], [84, 60, 9, '#F2C94C', .32, 11], [91, 74, 12, '#F5D6A0', .24, 16], [6, 76, 6, '#F2C94C', .36, 12], [44, 80, 7, '#6CC58C', .3, 13]];
  if (window.customElements && !customElements.get('mdg-marche')) customElements.define('mdg-marche', class extends HTMLElement {
    connectedCallback() {
      if (this._pret || this.closest('x-dc')) return; this._pret = true; cssScene();  // jamais dans le gabarit brut, avant que l'application ne le lise
      if (!document.getElementById('mfCss')) { const st = document.createElement('style'); st.id = 'mfCss'; st.textContent = MCSS; document.head.appendChild(st); }
      this.setAttribute('aria-hidden', 'true');
      const flux = (d, dur, t, r) => `<circle r="${r}" fill="url(#mfG)" opacity="0"><animateMotion dur="${dur}s" begin="${t}s" repeatCount="indefinite" path="${d}"/><animate attributeName="opacity" values="0;1;0" dur="${dur}s" begin="${t}s" repeatCount="indefinite"/></circle>`;
      const g = 'M70 118Q135 97 200 97', dr = 'M330 118Q265 97 200 97';
      this.innerHTML = `<div class="mf-cadre"><div class="mf-flou pt" data-etat="saisie">${scene('mf')}</div>
        <svg class="mf-net" viewBox="0 0 400 132" preserveAspectRatio="xMidYMax slice"><defs><radialGradient id="mfG"><stop offset="0" stop-color="#FFF6DE"/><stop offset=".4" stop-color="#FCE6B8" stop-opacity=".6"/><stop offset="1" stop-color="#FCE6B8" stop-opacity="0"/></radialGradient></defs>
        ${flux(g, 4.2, -.4, 3.2)}${flux(g, 4.2, -2.5, 2.4)}${flux(dr, 4.8, -1.3, 3.2)}${flux(dr, 4.8, -3.6, 2.4)}</svg></div>
        <div class="mf-bk">${BOKEH.map(([x, y, sz, c, o, d], i) => `<i style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;--c:${c};--o:${o};--d:${d}s;--t:${-(i * 1.7) % d}s;--x:${(i % 2 ? 1 : -1) * (6 + i % 4 * 4)}px"></i>`).join('')}</div>`;
      try { const sv = this.querySelector('.mf-flou svg'); sv.pauseAnimations(); sv.setCurrentTime(1); } catch (_) {}
      if (REDUIT.matches) try { this.querySelector('.mf-net').pauseAnimations(); } catch (_) {}
      // l'horizon de la scène se pose sous le sac (mesuré : la roue change de taille selon l'écran)
      this._place = () => { const pg = this.parentElement; if (!pg) return; const r0 = pg.getBoundingClientRect();
        const img = [...pg.querySelectorAll('img')].map(i => i.getBoundingClientRect()).filter(r => r.width > 120 && r.height > 120).sort((a, b) => b.width * b.height - a.width * a.height)[0];
        if (img && r0.height) this.style.setProperty('--mf-y', ((img.bottom - r0.top - img.height * .06) / r0.height * 100).toFixed(1) + '%'); };
      this._ro = 'ResizeObserver' in window ? new ResizeObserver(() => this._place()) : null; this._ro && this._ro.observe(this);
      setTimeout(this._place, 300); setTimeout(this._place, 1500);
    }
    disconnectedCallback() { this._ro && this._ro.disconnect(); this._pret = false; this.textContent = ''; }
  });

  /* ——— Entrer dans le marché : la transition après une connexion réussie (application) ———
     La porte s'ouvre en grand, on avance dans sa lumière jusqu'à la traverser ; un instant, « Vous êtes dans le marché. »,
     puis la lumière se retire sur l'accueil — et le marché flouté derrière la roue. ≈ 2,4 s. Mouvement réduit : rien, on arrive directement. */
  function entrer(fini, couvert) {
    const une = f => { let fait = false; return () => { if (fait) return; fait = true; try { f && f(); } catch (_) {} }; }, fin = une(fini), dessous = une(couvert);
    if (REDUIT.matches || !document.documentElement.hasAttribute('data-app') || !Element.prototype.animate || !window.MDGSac) { dessous(); return fin(); }
    const ov = document.createElement('div'); ov.setAttribute('aria-hidden', 'true');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:#10392B;overflow:hidden;opacity:0;display:grid;place-items:center';
    ov.innerHTML = `<div style="line-height:0;transform-origin:50% 29%;will-change:transform">${MDGSac.svg('plein', { t: 170 })}</div>
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#FFF6DE 0%,#FCE6B8 45%,#F2C230 100%);opacity:0"></div>
      <p style="position:absolute;left:24px;right:24px;top:50%;margin:-24px 0 0;text-align:center;font:600 26px/1.2 Jost,sans-serif;letter-spacing:-.015em;color:#171512;opacity:0">Bienvenue au <em style="font:900 italic 1em Jost,sans-serif;color:#10392B;padding:0 .06em;background:linear-gradient(transparent 62%,rgba(242,194,48,.65) 62%,rgba(242,194,48,.65) 94%,transparent 94%)">marché</em>.</p>`;
    document.body.appendChild(ov);
    const [sac, flash, txt] = ov.children, E = 'cubic-bezier(.22,1,.36,1)';
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, fill: 'forwards' }).onfinish = dessous;  // ce qui était dessous (la connexion) se ferme une fois couvert
    // le sac se remplit et saute (sa propre animation, ≈ 1,9 s), puis on avance dans son ouverture jusqu'à y entrer
    // le son suit le geste du sac : les trois notes partent quand il saute (v3/sons.js, réglable dans Sons)
    setTimeout(() => { try { window.MDGSons && MDGSons.confirmer && MDGSons.confirmer('entree'); } catch (_) {} }, 1250);
    sac.animate([{ transform: 'scale(1)', easing: 'cubic-bezier(.5,0,.85,.4)' }, { transform: 'scale(16)' }], { duration: 760, delay: 1900, fill: 'forwards' });
    flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 2380, easing: 'ease-in', fill: 'forwards' });
    txt.animate([{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 480, delay: 2600, easing: E, fill: 'forwards' });
    const out = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 3350, easing: 'ease-out', fill: 'forwards' });
    out.onfinish = () => { ov.remove(); fin(); };
    setTimeout(() => { if (ov.isConnected) { ov.remove(); dessous(); fin(); } }, 5200);  // filet de sécurité
  }

  /* ——— Sortir du marché : la transition de la déconnexion (application), l'inverse de l'entrée ———
     On est dans la lumière du marché, « À bientôt au marché. » ; la lumière se retire, on recule hors de la porte,
     le marché réapparaît derrière elle, puis la porte se referme et ses lumières baissent. ≈ 2,9 s.
     La déconnexion elle-même se fait dès que l'écran est couvert (l'accueil se met à jour dessous). Mouvement réduit : rien. */
  function sortir(fini, couvert) {
    const une = f => { let fait = false; return () => { if (fait) return; fait = true; try { f && f(); } catch (_) {} }; }, fin = une(fini), dessous = une(couvert);
    if (REDUIT.matches || !document.documentElement.hasAttribute('data-app') || !Element.prototype.animate || !window.MDGSac) { dessous(); return fin(); }
    const ov = document.createElement('div'); ov.setAttribute('aria-hidden', 'true');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:#10392B;overflow:hidden;opacity:0;display:grid;place-items:center;align-content:center;gap:26px;padding:24px;box-sizing:border-box';
    ov.innerHTML = `<div style="line-height:0;position:relative"><span>${MDGSac.svg('vide', { t: 150 })}</span><span style="position:absolute;inset:0;opacity:0">${MDGSac.svg('ferme', { t: 150 })}</span></div>
      <p style="margin:0;text-align:center;font:600 26px/1.2 Jost,sans-serif;letter-spacing:-.015em;color:#F3EFE4;opacity:0">À bientôt au <em style="font:900 italic 1em Jost,sans-serif;color:#F2C230;padding:0 .06em">marché</em>.</p>`;
    document.body.appendChild(ov);
    const [sacs, txt] = ov.children, [ouvert, ferme] = sacs.children, E = 'cubic-bezier(.22,1,.36,1)';
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).onfinish = dessous;  // la déconnexion se fait dès que l'écran est couvert
    txt.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 350, easing: E, fill: 'forwards' });
    // le sac se ficelle : l'ouvert s'efface, le ficelé prend sa place avec un petit resserrement
    setTimeout(() => { try { window.MDGSons && MDGSons.confirmer && MDGSons.confirmer('sortie'); } catch (_) {} }, 900);
    ouvert.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 900, fill: 'forwards' });
    ferme.animate([{ opacity: 0, transform: 'scale(1.03,.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 900, easing: E, fill: 'forwards' });
    const out = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, delay: 2300, easing: 'ease-in', fill: 'forwards' });
    out.onfinish = () => { ov.remove(); fin(); };
    setTimeout(() => { if (ov.isConnected) { ov.remove(); dessous(); fin(); } }, 4200);  // filet de sécurité
  }

  window.MDGPorte = { monter, entrer, sortir };
})();
