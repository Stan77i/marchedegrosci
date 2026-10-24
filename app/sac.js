/* ═════════ Marché de Gros CI — le sac, notre personnage (comme le pingouin d'une appli de paiement) ═════════
   Un seul héros dans toute l'application : l'écran d'ouverture, la porte d'entrée (connexion), l'en-tête, les notifications,
   les listes vides et les attentes montrent le même sac de jute. Version 2 (22/10/2026, demande du propriétaire : « le sac
   doit être plus poussé, comme une vraie app ») : du volume (lumière à gauche, ombre à droite et au fond), un revers plié,
   une couture, des fils au bord ; de vrais produits du pays (tomate, épi de maïs, mangue, plantain) à la place des ronds ;
   un regard vivant (clignement partout, le regard qui cherche quand le sac attend, un « non » de la tête quand il est triste).
   Humeurs, lisibles sans lire :
     plein  — c'est fait : les produits tombent, le sac encaisse, se remplit et fait un saut   (annonce publiée, réussite)
     vide   — rien ici pour l'instant : il attend, se balance, regarde autour de lui            (listes vides, repos)
     charge — ça arrive : les produits tombent sans arrêt, il respire                            (attente)
     triste — ça n'a pas marché : il se tasse et fait non de la tête                            (échec)
     ferme  — pas de réseau : ficelé, il dort                                                     (hors connexion, au revoir)
   API : MDGSac.svg(humeur, { t: taille en px, simple: true (petite taille : sans texture ni couture) })
         · MDGSac.vide(titre, texte, { t }) → bloc HTML d'état vide · charge(texte, { t }) · attente(hote, texte, { t, clair })
   Hors connexion : un bandeau rouge en haut de l'écran, « Pas de connexion · Réessayer » ; au retour du réseau, « De retour ». */
(function () {
  'use strict';
  if (window.MDGSac) return;
  const SAC = 'M52 70Q40 150 46 214Q50 238 110 240Q170 238 174 214Q180 150 168 70Z';
  let n = 0;

  // ——— les produits (dessinés une fois, posés où il faut) ———
  const P = {
    tomate: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="13" fill="#D9472B"/><ellipse cx="-4.5" cy="-5" rx="4.2" ry="2.6" fill="rgba(255,255,255,.26)"/><path d="M-6.5-11l3.5 4 3-6.5 3 6.5 3.5-4-2.5 6.5h-8z" fill="#3E8E4E"/></g>`,
    mais: (x, y, s = 1) => `<g transform="translate(${x} ${y}) rotate(-16) scale(${s})"><ellipse rx="8.6" ry="15.5" fill="#F2C230"/><g fill="rgba(120,80,0,.2)"><circle cx="-3.2" cy="-9" r="1.5"/><circle cx="2.4" cy="-10.5" r="1.5"/><circle cx="-4" cy="-3" r="1.5"/><circle cx="1.6" cy="-4" r="1.5"/><circle cx="-2" cy="3" r="1.5"/><circle cx="3.6" cy="2" r="1.5"/><circle cx="-3" cy="9" r="1.5"/><circle cx="2.6" cy="8" r="1.5"/></g><path d="M-8.5 7q-6.5 10 1.5 16.5q2-10 7-14.5z" fill="#5E9E4A"/><path d="M8.5 7q6.5 10-1.5 16.5q-2-10-7-14.5z" fill="#4C8A3E"/></g>`,
    mangue: (x, y, s = 1) => `<g transform="translate(${x} ${y}) rotate(18) scale(${s})"><path d="M-12-4q0-12 9.5-12q14.5 0 14.5 14q0 12.5-12 12.5q-12 0-12-14.5z" fill="#F0A43A"/><path d="M4-13q8 2 8 11q0 10-9 12q7-6 5-13q-1-6-4-10z" fill="#E2552F" fill-opacity=".75"/><ellipse cx="-5" cy="-7" rx="3" ry="2" fill="rgba(255,255,255,.26)"/><path d="M-2.5-16v-5.5" stroke="#5E4A2E" stroke-width="2" stroke-linecap="round"/></g>`,
    plantain: (x, y, s = 1) => `<g transform="translate(${x} ${y}) rotate(-28) scale(${s})"><path d="M-19 2Q0-19 19 2Q18.5 8.5 0 7Q-18.5 8.5-19 2Z" fill="#E9D36A" stroke="#C7AC45" stroke-width="1.2" stroke-linejoin="round"/><path d="M-19 2l-4.5-1.5" stroke="#6B5A2E" stroke-width="2.4" stroke-linecap="round"/><path d="M-10-5Q0-11 10-5" stroke="rgba(255,255,255,.35)" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`
  };

  function svg(humeur, o) {
    o = o || {}; const t = o.t || 120, id = 'ms' + (++n), simple = !!o.simple || t < 44;
    const plein = humeur === 'plein', ferme = humeur === 'ferme', charge = humeur === 'charge', triste = humeur === 'triste';
    // le regard : deux yeux avec un reflet (fermés quand il dort), la bouche selon l'humeur
    const oeil = (cx, cy) => `<g class="ms-oeil"><circle cx="${cx}" cy="${cy}" r="5.2" fill="#3B2E1C"/><circle cx="${cx - 1.7}" cy="${cy - 1.8}" r="1.6" fill="#FFF6E0"/></g>`;
    const yeux = ferme
      ? '<path d="M84 150q8 6 16 0M120 150q8 6 16 0" stroke="#3B2E1C" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : `<g class="ms-regard">${oeil(92, triste ? 152 : 150)}${oeil(128, triste ? 152 : 150)}</g>`;
    const bouche = triste ? '<path d="M98 178q12-9 24 0" stroke="#3B2E1C" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : charge ? '<circle cx="110" cy="173" r="4.5" fill="#3B2E1C"/>'
      : plein ? '<path d="M97 169q13 12 26 0" stroke="#3B2E1C" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M101 172q9 6 18 0z" fill="#3B2E1C"/>'
      : ferme ? '' : '<path d="M102 172h16" stroke="#3B2E1C" stroke-width="3" stroke-linecap="round"/>';
    // le haut : un revers plié en deux tons ; ficelé quand il dort
    const haut = ferme
      ? '<path d="M60 74Q110 96 160 74L150 60Q110 74 70 60Z" fill="#A88A5E"/><path d="M66 84Q110 100 154 84" stroke="#C9A24A" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="110" cy="92" r="6" fill="#C9A24A"/><path d="M104 96q-10 12-14 24M116 96q12 10 16 22" stroke="#C9A24A" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : '<path d="M44 72Q110 52 176 72Q172 86 110 84Q48 86 44 72Z" fill="#A88A5E"/><path d="M44 72Q110 52 176 72Q110 64 44 72Z" fill="#CBAE80"/>' +
        (simple ? '' : '<path d="M62 69l-3-6M104 59l-1-6.5M148 63l2.5-6" stroke="#B49A6F" stroke-width="1.6" stroke-linecap="round"/>');
    // les produits qui tombent passent derrière le bord du sac ; le contenu monte à l'intérieur (découpé à sa forme)
    const tombent = plein || charge ? `<g class="ms-t ms-t1">${P.tomate(92, 40, .95)}</g><g class="ms-t ms-t2">${P.mais(126, 30, .9)}</g><g class="ms-t ms-t3">${P.mangue(146, 46, .85)}</g>` : '';
    const contenu = plein || charge
      ? `<g clip-path="url(#${id}c)"><g class="ms-monte"><rect x="30" y="94" width="160" height="160" fill="rgba(23,21,18,.16)"/>` +
        `${P.plantain(150, 100, .95)}${P.mangue(128, 96, 1)}${P.tomate(70, 99, 1)}${P.mais(99, 92, 1)}</g></g>`
      : '';
    const zz = ferme ? '<g class="ms-z" fill="#F3EFE4" font-family="Jost,system-ui,sans-serif" font-weight="700"><text x="168" y="54" font-size="22">z</text><text x="186" y="34" font-size="15">z</text></g>' : '';
    const detail = simple ? '' :
      `<path d="${SAC}" fill="url(#${id}j)"/><path d="M64 84Q54 150 60 212" stroke="rgba(59,42,20,.32)" stroke-width="1.6" stroke-dasharray="3 4.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M156 84Q166 150 160 212" stroke="rgba(59,42,20,.18)" stroke-width="1.4" stroke-dasharray="3 4.5" fill="none" stroke-linecap="round"/>`;
    return `<svg class="ms ms-${humeur}" viewBox="0 0 220 260" width="${t}" height="${Math.round(t * 260 / 220)}" aria-hidden="true" focusable="false">` +
      `<defs><clipPath id="${id}c"><path d="${SAC}"/></clipPath>` +
      `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D8BC8E"/><stop offset=".55" stop-color="#BE9E70"/><stop offset="1" stop-color="#9C7F57"/></linearGradient>` +
      `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#3B2A14" stop-opacity="0"/><stop offset="1" stop-color="#3B2A14" stop-opacity=".3"/></linearGradient>` +
      (simple ? '' : `<pattern id="${id}j" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3H6M3 0V6" stroke="rgba(23,21,18,.13)" stroke-width="1"/></pattern>`) + '</defs>' +
      `<ellipse class="ms-ombre" cx="110" cy="250" rx="58" ry="7" fill="rgba(0,0,0,.18)"/>` +
      `<g class="ms-corps">${tombent}<path d="${SAC}" fill="url(#${id}g)"/>${detail}<path d="${SAC}" fill="url(#${id}b)"/>` +
      `<ellipse cx="84" cy="128" rx="20" ry="52" fill="#FFF6E0" fill-opacity=".09"/>${contenu}${haut}${yeux}${bouche}</g>${zz}</svg>`;
  }

  // état vide : le sac qui attend, un titre et une phrase
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vide = (titre, texte, o) => `<div class="ms-etat">${svg('vide', { t: (o && o.t) || 92 })}${titre ? `<b>${esc(titre)}</b>` : ''}${texte ? `<span>${esc(texte)}</span>` : ''}</div>`;

  const CSS = `.ms{display:block;overflow:visible}
.ms .ms-corps{transform-box:view-box;transform-origin:110px 248px}
.ms .ms-oeil{transform-box:fill-box;transform-origin:center;animation:msCligne 5.2s infinite}
.ms-corps{animation:msVit 3.8s ease-in-out infinite}
.ms-plein .ms-corps{animation:msSaut 1.25s .62s cubic-bezier(.3,1.5,.5,1) both,msVit 3.8s 1.9s ease-in-out infinite}
.ms-plein .ms-monte{animation:msMonte 1.3s .5s cubic-bezier(.22,1,.36,1) both}
.ms-plein .ms-t{animation:msTombe .72s cubic-bezier(.5,0,.75,1) both}.ms-plein .ms-t2{animation-delay:.14s}.ms-plein .ms-t3{animation-delay:.28s}
.ms-plein .ms-ombre{transform-box:fill-box;transform-origin:center;animation:msOmbre 1.25s .62s ease both}
.ms-vide .ms-corps{animation:msBalance 3.4s ease-in-out infinite}
.ms-vide .ms-regard{transform-box:fill-box;transform-origin:center;animation:msRegard 7s ease-in-out infinite}
.ms-ferme .ms-corps{animation:msDort 3.8s ease-in-out infinite}
.ms-ferme .ms-z text{animation:msZ 2.8s ease-in-out infinite}.ms-ferme .ms-z text+text{animation-delay:.7s}
.ms-charge .ms-t{animation:msTombe 1.25s cubic-bezier(.5,0,.75,1) infinite both}.ms-charge .ms-t2{animation-delay:.2s}.ms-charge .ms-t3{animation-delay:.4s}
.ms-charge .ms-monte{animation:msRemplit 3.75s cubic-bezier(.4,0,.2,1) infinite both}
.ms-charge .ms-corps{animation:msRespire 1.25s ease-in-out infinite}
.ms-triste .ms-corps{animation:msTasse .6s cubic-bezier(.3,1.4,.5,1) both,msNon 1.1s .7s ease-in-out 1}
@keyframes msVit{0%,100%{transform:none}50%{transform:scale(1.012,.988)}}
@keyframes msRemplit{0%{transform:translateY(150px)}80%{transform:translateY(10px)}100%{transform:translateY(10px)}}
@keyframes msRespire{0%,100%{transform:none}50%{transform:scale(1.025,.975)}}
@keyframes msTasse{0%{transform:scale(1)}40%{transform:scale(1.06,.9)}100%{transform:scale(1,.97)}}
@keyframes msNon{0%,100%{rotate:0deg}25%{rotate:-4deg}75%{rotate:4deg}}
@keyframes msMonte{from{transform:translateY(150px)}to{transform:none}}
@keyframes msTombe{from{transform:translateY(-60px);opacity:0}60%{opacity:1}to{transform:translateY(70px);opacity:0}}
@keyframes msSaut{0%{transform:none}14%{transform:scale(1.06,.93)}38%{transform:translateY(-26px) scale(.96,1.05)}60%{transform:translateY(0) scale(1.06,.94)}78%{transform:translateY(-6px)}100%{transform:none}}
@keyframes msOmbre{14%{transform:scale(1.08);opacity:1}38%{transform:scale(.7);opacity:.5}}
@keyframes msBalance{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
@keyframes msRegard{0%,38%,100%{transform:none}46%,62%{transform:translateX(5px)}70%,86%{transform:translateX(-5px)}}
@keyframes msCligne{0%,92%,100%{transform:none}95%{transform:scaleY(.1)}}
@keyframes msDort{0%,100%{transform:none}50%{transform:scale(1.03,.97)}}
@keyframes msZ{0%{opacity:0;transform:translateY(6px)}40%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
:is(.ap-vide,.gr-vide,.pz-vide,.rc-vide)>svg.ms{display:block;margin:0 auto}
.ms-etat{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:18px 10px;color:inherit}
.ms-etat b{font:600 18px/1.25 Jost,system-ui,sans-serif}.ms-etat span{font-size:15px;line-height:1.45;opacity:.72;max-width:290px;text-wrap:pretty}
.ms-voile{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;background:inherit;color:#F3EFE4;transition:opacity .4s}
.ms-voile.clair{color:#171512}.ms-voile.part{opacity:0;pointer-events:none}
.ms-attente{padding:28px 10px}.ms-attente span{font-size:14px;letter-spacing:.01em}
.ms-hl{position:fixed;left:0;right:0;top:0;z-index:9500;transform:translateY(-110%);display:flex;align-items:center;gap:10px;
  padding:calc(8px + env(safe-area-inset-top,0px)) 12px 8px 16px;background:#C0442B;color:#fff;font:600 15px/1.3 Jost,system-ui,sans-serif;
  box-shadow:0 6px 18px rgba(23,21,18,.22);transition:transform .3s cubic-bezier(.22,1,.36,1),background-color .3s}
.ms-hl.on{transform:none}.ms-hl.ok{background:#10392B}.ms-hl svg.wi{flex:none}
.ms-hl button{margin-left:auto;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#fff;color:#C0442B;font:700 15px Jost,system-ui,sans-serif;
  display:inline-flex;align-items:center;gap:7px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ms-hl button:active{background:#F3EFE4}.ms-hl.ok button{color:#10392B}.ms-hl button:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
.ms-hl.ok b{color:#F2C230}
@media (prefers-reduced-motion:reduce){.ms *{animation:none!important}.ms-plein .ms-t{display:none}.ms-hl{transition:none}}`;
  function css() { if (document.getElementById('msCss')) return; const s = document.createElement('style'); s.id = 'msCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  css();

  // hors connexion : un bandeau rouge en haut de l'écran, partout, tant que le réseau manque (choix B du propriétaire, 23/10/2026).
  // « Réessayer » relance la lecture des écrans ouverts (évènement « mdg:reessayer ») ; au retour : « De retour », en vert, puis il remonte.
  // Les écrans peuvent aussi le signaler eux-mêmes quand une lecture échoue faute de réseau : MDGSac.reseau(false / true).
  const WI = '<svg class="wi" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2-1.5M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>';
  const REC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  let bulle = null, tRetour = 0, coupe = false;
  function horsLigne() {
    if (!document.body) return;
    clearTimeout(tRetour); coupe = true;
    if (!bulle) { bulle = document.createElement('div'); bulle.className = 'ms-hl'; bulle.setAttribute('role', 'alert'); document.body.appendChild(bulle); }
    bulle.classList.remove('ok');
    bulle.innerHTML = WI + '<b>Pas de connexion</b><button type="button">' + REC + 'Réessayer</button>';
    bulle.querySelector('button').onclick = e => {
      const b = e.currentTarget; b.disabled = true; setTimeout(() => { b.disabled = false; }, 1500);
      dispatchEvent(new Event('mdg:reessayer'));
      // personne ne relit (aucun écran ouvert qui lit en direct) : on se fie au navigateur
      setTimeout(() => { if (coupe && navigator.onLine !== false && !document.querySelector('mdg-tableau')) enLigne(); }, 1200);
    };
    requestAnimationFrame(() => bulle.classList.add('on'));
  }
  function enLigne() {
    coupe = false;
    if (!bulle || !bulle.classList.contains('on')) return;
    bulle.classList.add('ok');
    bulle.innerHTML = svg('plein', { t: 30, simple: true }) + '<span><b>De retour</b> · le réseau est revenu</span>';
    clearTimeout(tRetour); tRetour = setTimeout(() => bulle.classList.remove('on'), 2400);
  }
  const reseau = ok => { if (ok) { if (coupe) enLigne(); } else horsLigne(); };
  addEventListener('offline', horsLigne);
  addEventListener('online', enLigne);
  const depart = () => { if (navigator.onLine === false) horsLigne(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(depart, 1500), { once: true }); else setTimeout(depart, 1500);

  // attente : le sac qui se remplit, et ce qu'on attend (« La carte se prépare… »)
  const charge = (texte, o) => `<div class="ms-etat ms-attente" role="status" aria-live="polite">${svg('charge', { t: (o && o.t) || 64 })}${texte ? `<span>${esc(texte)}</span>` : ''}</div>`;
  // voile d'attente posé sur un conteneur (la carte…) ; renvoie une fonction qui l'enlève en fondu
  function attente(hote, texte, o) {
    if (!hote) return () => {};
    const v = document.createElement('div'); v.className = 'ms-voile' + (o && o.clair ? ' clair' : ''); v.innerHTML = charge(texte, { t: (o && o.t) || 86 });
    hote.appendChild(v);
    let fini = false;
    return () => { if (fini) return; fini = true; v.classList.add('part'); setTimeout(() => v.remove(), 450); };
  }
  // le sac de l'en-tête fait un petit saut (réussite) : brand continuity, même langage partout
  function saluer() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate) return;
    document.querySelectorAll('.acc-sac .ms-corps').forEach(c => c.animate([{ transform: 'none' }, { transform: 'scale(1.06,.93)', offset: .18 }, { transform: 'translateY(-5px) scale(.97,1.04)', offset: .45 }, { transform: 'translateY(0) scale(1.05,.95)', offset: .7 }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
  }
  window.MDGSac = { svg, vide, charge, attente, saluer, reseau };
})();
