/* ═════════ Marché de Gros CI — le sac, notre personnage (comme le pingouin d'une appli de paiement) ═════════
   Le même sac de jute que l'écran d'ouverture (application.dc.html splashMark), avec trois humeurs qui se comprennent sans lire :
     plein  — c'est fait : le sac se remplit de produits et fait un petit saut   (annonce publiée)
     vide   — rien ici pour l'instant : le sac attend, ouvert, il se balance      (listes vides)
     ferme  — pas de réseau : le sac est ficelé et dort                          (hors connexion)
   API : MDGSac.svg(humeur, { t: taille en px }) · MDGSac.vide(titre, texte, { t }) → bloc HTML d'état vide
   Hors connexion : une petite bulle en bas de l'écran avec le sac qui dort ; au retour du réseau, « De retour ». */
(function () {
  'use strict';
  if (window.MDGSac) return;
  const SAC = 'M52 70Q40 150 46 214Q50 238 110 240Q170 238 174 214Q180 150 168 70Z';
  let n = 0;
  function svg(humeur, o) {
    o = o || {}; const t = o.t || 120, id = 'ms' + (++n);
    const plein = humeur === 'plein', ferme = humeur === 'ferme', charge = humeur === 'charge', triste = humeur === 'triste';
    // les yeux et la bouche, discrets, dessinés sur la toile
    const yeux = ferme
      ? '<path d="M84 150q8 6 16 0M120 150q8 6 16 0" stroke="#3B2E1C" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : '<circle class="ms-oeil" cx="92" cy="150" r="5" fill="#3B2E1C"/><circle class="ms-oeil" cx="128" cy="150" r="5" fill="#3B2E1C"/>';
    const bouche = triste ? '<path d="M98 176q12 -9 24 0" stroke="#3B2E1C" stroke-width="3.2" fill="none" stroke-linecap="round"/>' : charge ? '<circle cx="110" cy="173" r="4.5" fill="#3B2E1C"/>' : plein ? '<path d="M98 170q12 11 24 0" stroke="#3B2E1C" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : ferme ? '' : '<path d="M102 172h16" stroke="#3B2E1C" stroke-width="3" stroke-linecap="round"/>';
    const haut = ferme
      // ficelé : le haut serré, une ficelle et un nœud
      ? '<path d="M60 74Q110 96 160 74L150 60Q110 74 70 60Z" fill="#9C8058"/><path d="M66 84Q110 100 154 84" stroke="#C9A24A" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="110" cy="92" r="6" fill="#C9A24A"/>'
      : '<path d="M44 72Q110 52 176 72Q172 84 110 82Q48 84 44 72Z" fill="#9C8058"/>';
    // les produits qui tombent passent derrière le bord du sac ; le contenu monte à l'intérieur (découpé à sa forme)
    const tombent = plein || charge ? '<circle class="ms-t ms-t1" cx="92" cy="40" r="10" fill="#E2552F"/><circle class="ms-t ms-t2" cx="122" cy="30" r="9" fill="#6CC58C"/><circle class="ms-t ms-t3" cx="140" cy="46" r="8" fill="#F2C94C"/>' : '';
    const contenu = plein || charge
      ? `<g clip-path="url(#${id}c)"><g class="ms-monte"><rect x="30" y="92" width="160" height="160" fill="rgba(23,21,18,.14)"/>` +
        '<circle cx="70" cy="96" r="13" fill="#D9472B"/><circle cx="96" cy="90" r="14" fill="#E2552F"/><circle cx="124" cy="94" r="13" fill="#6CC58C"/><circle cx="150" cy="98" r="12" fill="#F2C94C"/></g></g>'
      : '';
    const zz = ferme ? '<g class="ms-z" fill="#F3EFE4" font-family="Jost,system-ui,sans-serif" font-weight="700"><text x="168" y="54" font-size="22">z</text><text x="186" y="34" font-size="15">z</text></g>' : '';
    return `<svg class="ms ms-${humeur}" viewBox="0 0 220 260" width="${t}" height="${Math.round(t * 260 / 220)}" aria-hidden="true" focusable="false">` +
      `<defs><clipPath id="${id}c"><path d="${SAC}"/></clipPath><pattern id="${id}j" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4H8M4 0V8" stroke="rgba(23,21,18,.18)" stroke-width="1.2"/></pattern></defs>` +
      `<ellipse class="ms-ombre" cx="110" cy="250" rx="58" ry="7" fill="rgba(0,0,0,.18)"/>` +
      `<g class="ms-corps">${tombent}<path d="${SAC}" fill="#B99C72"/><path d="${SAC}" fill="url(#${id}j)"/>${contenu}` +
      `${haut}${yeux}${bouche}</g>${zz}</svg>`;
  }

  // état vide : le sac qui attend, un titre et une phrase
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vide = (titre, texte, o) => `<div class="ms-etat">${svg('vide', { t: (o && o.t) || 92 })}${titre ? `<b>${esc(titre)}</b>` : ''}${texte ? `<span>${esc(texte)}</span>` : ''}</div>`;

  const CSS = `.ms{display:block;overflow:visible}
.ms .ms-corps{transform-box:view-box;transform-origin:110px 248px}
.ms-plein .ms-corps{animation:msSaut 1.1s 1.1s cubic-bezier(.3,1.6,.5,1) both}
.ms-plein .ms-monte{animation:msMonte 1.4s .35s cubic-bezier(.22,1,.36,1) both}
.ms-plein .ms-t{animation:msTombe .7s cubic-bezier(.5,0,.7,1) both}.ms-plein .ms-t2{animation-delay:.15s}.ms-plein .ms-t3{animation-delay:.3s}
.ms-plein .ms-ombre{transform-box:fill-box;transform-origin:center;animation:msOmbre 1.1s 1.1s ease both}
.ms-vide .ms-corps{animation:msBalance 3.2s ease-in-out infinite}
.ms-vide .ms-oeil{transform-box:fill-box;transform-origin:center;animation:msCligne 4.2s infinite}
.ms-ferme .ms-corps{animation:msDort 3.6s ease-in-out infinite}
.ms-ferme .ms-z text{animation:msZ 2.8s ease-in-out infinite}.ms-ferme .ms-z text+text{animation-delay:.7s}
.ms-charge .ms-t{animation:msTombe 1.25s cubic-bezier(.5,0,.7,1) infinite both}.ms-charge .ms-t2{animation-delay:.2s}.ms-charge .ms-t3{animation-delay:.4s}
.ms-charge .ms-monte{animation:msRemplit 3.75s cubic-bezier(.4,0,.2,1) infinite both}
.ms-charge .ms-corps{animation:msRespire 1.25s ease-in-out infinite}
.ms-triste .ms-corps{animation:msTasse .6s cubic-bezier(.3,1.4,.5,1) both}
@keyframes msRemplit{0%{transform:translateY(150px)}80%{transform:translateY(10px)}100%{transform:translateY(10px)}}
@keyframes msRespire{0%,100%{transform:none}50%{transform:scale(1.025,.975)}}
@keyframes msTasse{0%{transform:scale(1)}40%{transform:scale(1.06,.9)}100%{transform:scale(1,.97)}}
@keyframes msMonte{from{transform:translateY(150px)}to{transform:none}}
@keyframes msTombe{from{transform:translateY(-60px);opacity:0}60%{opacity:1}to{transform:translateY(70px);opacity:0}}
@keyframes msSaut{0%,100%{transform:none}30%{transform:translateY(-26px) scale(.97,1.04)}55%{transform:translateY(0) scale(1.05,.95)}75%{transform:translateY(-6px)}}
@keyframes msOmbre{30%{transform:scale(.7);opacity:.5}}
@keyframes msBalance{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}
@keyframes msCligne{0%,92%,100%{transform:none}95%{transform:scaleY(.1)}}
@keyframes msDort{0%,100%{transform:none}50%{transform:scale(1.03,.97)}}
@keyframes msZ{0%{opacity:0;transform:translateY(6px)}40%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
.ms-etat{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:18px 10px;color:inherit}
.ms-etat b{font:600 18px/1.25 Jost,system-ui,sans-serif}.ms-etat span{font-size:15px;line-height:1.45;opacity:.72;max-width:290px;text-wrap:pretty}
.ms-voile{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;background:inherit;color:#F3EFE4;transition:opacity .4s}
.ms-voile.clair{color:#171512}.ms-voile.part{opacity:0;pointer-events:none}
.ms-attente{padding:28px 10px}.ms-attente span{font-size:14px;letter-spacing:.01em}
.ms-hl{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9500;transform:translate(-50%,140%);opacity:0;display:flex;align-items:center;gap:10px;
  padding:8px 16px 8px 8px;border-radius:999px;background:#10392B;color:#F3EFE4;font:500 14px/1.3 Jost,system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35);
  transition:transform .45s cubic-bezier(.22,1,.36,1),opacity .3s;max-width:calc(100vw - 32px);pointer-events:none}
.ms-hl.on{transform:translate(-50%,0);opacity:1}.ms-hl b{display:block;font-weight:600;color:#F2C230}.ms-hl small{display:block;font-size:12.5px;opacity:.8}
@media (prefers-reduced-motion:reduce){.ms *{animation:none!important}.ms-plein .ms-t{display:none}.ms-hl{transition:opacity .2s}}`;
  function css() { if (document.getElementById('msCss')) return; const s = document.createElement('style'); s.id = 'msCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  css();

  // hors connexion : le sac dort en bas de l'écran tant que le réseau manque
  let bulle = null, tRetour = 0;
  function horsLigne() {
    if (!document.body) return;
    clearTimeout(tRetour);
    if (!bulle) { bulle = document.createElement('div'); bulle.className = 'ms-hl'; bulle.setAttribute('role', 'status'); bulle.setAttribute('aria-live', 'polite'); document.body.appendChild(bulle); }
    bulle.innerHTML = svg('ferme', { t: 34 }) + '<span><b>Pas de réseau</b><small>Vos annonces partiront dès son retour.</small></span>';
    requestAnimationFrame(() => bulle.classList.add('on'));
  }
  function enLigne() {
    if (!bulle || !bulle.classList.contains('on')) return;
    bulle.innerHTML = svg('plein', { t: 34 }) + '<span><b>De retour</b><small>Le réseau est revenu.</small></span>';
    tRetour = setTimeout(() => bulle.classList.remove('on'), 2600);
  }
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
  window.MDGSac = { svg, vide, charge, attente };
})();
