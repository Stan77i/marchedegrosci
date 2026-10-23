/* ═════════ Marché de Gros CI — la scène du marché : un marché de gros au crépuscule, dans les couleurs de la marque ═════════
   Demandé par le propriétaire le 23/10/2026 : « un marché, des gens qui passent devant (femmes avec bagages, camion, hommes…),
   comme un vrai marché de gros, passage en fondu, en harmonie avec le sac ; une fois connecté, on retrouve ce marché derrière
   le sélectionneur orbital, en verre dépoli, marié au défilement des produits ».
   Un seul dessin (SVG 400 × 132, dessiné ici, aucune image empruntée), deux usages :
     • la porte d'entrée (v3/porte.js) : la scène nette, les passants traversent devant les étals, le sac (app/sac.js) devant ;
     • l'accueil (<mdg-marche>, v3/porte.js) : la même scène floutée derrière la roue, les passants nets mais discrets par-dessus.
   Couleurs : nuit (#171512), vert forêt (#10392B), maïs (#F2C230), crème (#F3EFE4), jute. La lumière chaude des étals suit
   la teinte du produit affiché (variable CSS --mk-tint, posée par l'accueil : tomate rouge, aubergine violette…).
   Pourquoi pas WebGL : une vingtaine de formes et cinq silhouettes en déplacement ; le CSS suffit, sans batterie ni bibliothèque,
   et rien n'échoue sur un petit téléphone. Mouvement réduit : tout est immobile.
   API : MDGScene.svg(k, { passants: 'oui' | 'non' | 'seuls' }) → markup SVG · MDGScene.css() → pose la feuille de style */
(function () {
  'use strict';
  if (window.MDGScene) return;

  // ——— un étal : deux poteaux, une table, un auvent à rayures vert et crème, une guirlande d'ampoules, des caisses de produits ———
  function etal(x, k, produits) {
    const b = [];
    // ampoules : une guirlande qui pend entre les deux poteaux
    const amp = [0, 1, 2, 3, 4].map(i => `<circle class="mk-amp" style="--i:${i}" cx="${x + 14 + i * 20}" cy="${74 + Math.sin((i + .5) / 5 * Math.PI) * 5}" r="1.7"/>`).join('');
    b.push(`<path d="M${x + 6} 70Q${x + 55} 86 ${x + 104} 70" fill="none" stroke="#3B2E1C" stroke-width=".8"/>${amp}`);
    b.push(`<rect x="${x + 5}" y="70" width="3" height="42" fill="#3B2E1C"/><rect x="${x + 102}" y="70" width="3" height="42" fill="#3B2E1C"/>`);
    // la table et ses planches
    b.push(`<rect x="${x}" y="96" width="110" height="16" rx="1.5" fill="#4E3A26"/><path d="M${x} 102H${x + 110}M${x} 107H${x + 110}" stroke="rgba(23,21,18,.35)" stroke-width=".8"/>`);
    // l'auvent : fond vert, rayures crème, bord festonné
    b.push(`<rect x="${x - 4}" y="60" width="118" height="12" fill="#10392B"/>`);
    for (let i = 0; i < 5; i++) b.push(`<rect x="${x - 4 + 13 + i * 24}" y="60" width="10" height="12" fill="#F3EFE4" fill-opacity=".9"/>`);
    b.push(`<path d="M${x - 4} 72${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `q7.4 5 14.75 0`).join('')}" fill="#10392B"/>`);
    b.push(`<path d="M${x - 4} 60h118" stroke="#F2C230" stroke-width="1.2"/>`);
    // les caisses de produits posées sur la table
    produits.forEach((p, i) => b.push(caisse(x + 6 + i * 36, 84, p)));
    return `<g class="mk-etal">${b.join('')}</g>`;
  }
  // une caisse de bois avec son contenu : tomate, aubergine, maïs, mangue, plantain, oignon
  function caisse(x, y, p) {
    const C = { tomate: ['#D9472B', 'c'], aubergine: ['#5B3A6E', 'e'], mais: ['#F2C230', 'm'], mangue: ['#F0A43A', 'e'], plantain: ['#D9C45C', 'b'], oignon: ['#C9A0C4', 'c'], orange: ['#F2893B', 'c'], chou: ['#8FB36A', 'c'] };
    const [col, forme] = C[p] || C.tomate; const items = [];
    for (let i = 0; i < 4; i++) { const cx = x + 5 + i * 6.5, cy = y + 6 - (i % 2) * 2.2;
      // pas de transform SVG ici : la feuille de style pose transform-box sur tout le dessin, une rotation d'attribut partirait de travers
      items.push(forme === 'c' ? `<circle cx="${cx}" cy="${cy}" r="3.1" fill="${col}"/>` : forme === 'e' ? `<ellipse cx="${cx}" cy="${cy}" rx="2.7" ry="3.7" fill="${col}"/>` : forme === 'm' ? `<ellipse cx="${cx}" cy="${cy}" rx="2.3" ry="4" fill="${col}"/><path d="M${cx - 2} ${cy + 3}q-2 3 0 5" stroke="#5E9E4A" stroke-width="1.2" fill="none"/>` : `<path d="M${cx - 3} ${cy + 1}q3 -5 6 0" stroke="${col}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`); }
    return `<g><rect x="${x}" y="${y + 2}" width="30" height="11" rx="1" fill="#6B5035"/><path d="M${x} ${y + 6}h30M${x} ${y + 9.5}h30" stroke="rgba(23,21,18,.3)" stroke-width=".7"/>${items.join('')}<rect x="${x}" y="${y + 2}" width="30" height="3" fill="#7A5C3D"/></g>`;
  }

  // ——— les passants : des silhouettes, dessinées une fois, qui traversent devant les étals ———
  const INK = '#100E0A', RIM = 'rgba(243,239,228,.16)';
  const S = {
    // femme, bassine de tomates sur la tête, pagne
    femmeBassine: `<g><ellipse cx="0" cy="-33" rx="7.5" ry="2.6" fill="#2A211A" stroke="${RIM}" stroke-width=".6"/><circle cx="-3" cy="-35.5" r="1.7" fill="#D9472B"/><circle cx="1" cy="-36" r="1.8" fill="#D9472B"/><circle cx="4.5" cy="-35.2" r="1.5" fill="#E2552F"/>
      <circle cx="0" cy="-27" r="3.4" fill="${INK}"/><path d="M-3 -23q3 -2 6 0l2 9h-10z" fill="${INK}"/><path d="M-5 -14h10l2 14h-14z" fill="${INK}" stroke="${RIM}" stroke-width=".6"/><path d="M-4.5 -22l-2 -8M4.5 -22l2 -8" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
      <path class="mk-jambe" d="M-2.5 0v-3M2.5 0v-3" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></g>`,
    // homme avec un pousse-pousse chargé de sacs
    pousse: `<g><circle cx="-9" cy="-26" r="3.2" fill="${INK}"/><path d="M-12 -22q3 -2 6 0l1 11h-8z" fill="${INK}"/><path d="M-11 -11l-2 11M-7 -11l0 11" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M-7 -18l9 -1" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M1 -20h20l2 10h-22z" fill="#2A211A" stroke="${RIM}" stroke-width=".6"/><ellipse cx="7" cy="-22" rx="5" ry="3.2" fill="#8C7350"/><ellipse cx="15" cy="-23" rx="5" ry="3.2" fill="#A08560"/><ellipse cx="11" cy="-27" rx="4.5" ry="2.8" fill="#8C7350"/>
      <circle class="mk-roue" cx="6" cy="-6" r="4.2" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="6" cy="-6" r="1" fill="${INK}"/><circle class="mk-roue" cx="18" cy="-6" r="4.2" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="18" cy="-6" r="1" fill="${INK}"/></g>`,
    // camion de marché, bâché, phare allumé
    camion: `<g><rect x="-34" y="-28" width="46" height="20" rx="1.5" fill="#1E1812" stroke="${RIM}" stroke-width=".7"/><path d="M-34 -28q23 -7 46 0" fill="#2A211A"/><path d="M12 -22h12q4 0 6 4l3 6v4h-21z" fill="#1E1812" stroke="${RIM}" stroke-width=".7"/><rect x="15" y="-20" width="9" height="6" rx="1" fill="#3A3024"/>
      <rect x="-36" y="-9" width="70" height="3" fill="#1E1812"/><circle class="mk-roue" cx="-22" cy="-4" r="4.6" fill="${INK}"/><circle cx="-22" cy="-4" r="1.6" fill="#3A3024"/><circle class="mk-roue" cx="22" cy="-4" r="4.6" fill="${INK}"/><circle cx="22" cy="-4" r="1.6" fill="#3A3024"/>
      <circle cx="32" cy="-11" r="1.5" fill="#FFE08A"/><path d="M33 -11l14 -3v6z" fill="#FFE08A" fill-opacity=".14"/></g>`,
    // jeune homme, un sac de jute sur l'épaule
    sacEpaule: `<g><ellipse cx="4" cy="-33" rx="8" ry="4" fill="#8C7350" transform="rotate(-18 4 -33)"/><circle cx="-2" cy="-27" r="3.3" fill="${INK}"/><path d="M-5 -23q3 -2 6 0l1.5 10h-9z" fill="${INK}"/><path d="M-5 -13l-1.5 13M0 -13l1 13" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M1 -21l5 -9" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/></g>`,
    // femme avec un sac à la main, un enfant à côté
    femmeEnfant: `<g><circle cx="0" cy="-28" r="3.3" fill="${INK}"/><path d="M-3 -24q3 -2 6 0l2 9h-10z" fill="${INK}"/><path d="M-5 -15h10l1.5 15h-13z" fill="${INK}" stroke="${RIM}" stroke-width=".6"/><path d="M4 -22l5 9" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><rect x="7" y="-13" width="7" height="9" rx="1" fill="#2A211A" stroke="${RIM}" stroke-width=".6"/>
      <circle cx="-10" cy="-17" r="2.4" fill="${INK}"/><path d="M-12 -14q2 -1.5 4 0l1 7h-6z" fill="${INK}"/><path d="M-11 -7v7M-9 -7v7" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M-7 -13l3 -5" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/></g>`
  };
  // chaque passant : la silhouette, sa durée de traversée, son retard, son sens, sa taille (le camion passe derrière, plus petit = plus loin)
  const PASSANTS = [
    ['camion', 34, -6, 1, .78, 116],
    ['femmeBassine', 21, -3, 1, 1, 119],
    ['pousse', 26, -14, -1, .95, 119],
    ['sacEpaule', 17, -9, -1, 1, 119],
    ['femmeEnfant', 29, -20, 1, .92, 119]
  ];
  function passants() {
    return `<g class="mk-pass">${PASSANTS.map(([n, d, t, sens, s, y], i) => `<g class="mk-p" style="--d:${d}s;--t:${t}s;--y:${y}px;--s:${s}"><g class="mk-pi" style="transform:scaleX(${sens})">${S[n]}</g></g>`).join('')}</g>`;
  }

  function svg(k, o) {
    o = o || {}; const mode = o.passants || 'oui';
    if (mode === 'seuls') return `<svg class="mk mk-seuls" viewBox="0 0 400 132" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${passants()}</svg>`;
    return `<svg class="mk" viewBox="0 0 400 132" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${k}ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E2A20"/><stop offset=".55" stop-color="#1A1912"/><stop offset="1" stop-color="#2A2018"/></linearGradient>
    <radialGradient id="${k}lum" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="var(--mk-tint,#F2C230)" stop-opacity=".46"/><stop offset=".5" stop-color="var(--mk-tint,#F2C230)" stop-opacity=".14"/><stop offset="1" stop-color="var(--mk-tint,#F2C230)" stop-opacity="0"/></radialGradient>
    <linearGradient id="${k}sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1711"/><stop offset="1" stop-color="#110E0A"/></linearGradient>
  </defs>
  <rect width="400" height="132" fill="url(#${k}ciel)"/>
  <ellipse class="mk-lum" cx="200" cy="118" rx="230" ry="96" fill="url(#${k}lum)"/>
  <!-- au fond : les hangars du marché de gros, quelques fenêtres allumées -->
  <g fill="#131009"><path d="M-10 70v-22l34 -9 34 9v22z"/><path d="M70 70v-18l44 -10 44 10v18z"/><path d="M270 70v-20l38 -9 38 9v20z"/><path d="M356 70v-16l30 -8 30 8v16z"/></g>
  <g fill="#FFE08A" fill-opacity=".55"><rect x="12" y="56" width="4" height="3"/><rect x="24" y="56" width="4" height="3"/><rect x="100" y="58" width="4" height="3"/><rect x="128" y="58" width="4" height="3"/><rect x="296" y="56" width="4" height="3"/><rect x="330" y="56" width="4" height="3"/></g>
  <path d="M-10 70H410" stroke="rgba(243,239,228,.08)"/>
  <!-- le sol et les reflets chauds sous les étals -->
  <rect y="112" width="400" height="20" fill="url(#${k}sol)"/>
  <g fill="var(--mk-tint,#F2C230)" fill-opacity=".07"><ellipse cx="75" cy="116" rx="60" ry="5"/><ellipse cx="200" cy="117" rx="64" ry="5"/><ellipse cx="325" cy="116" rx="60" ry="5"/></g>
  <!-- les étals -->
  ${etal(20, k, ['tomate', 'aubergine', 'mais'])}${etal(145, k, ['mangue', 'tomate', 'plantain'])}${etal(270, k, ['oignon', 'chou', 'orange'])}
  <!-- l'enseigne, sur l'étal de gauche (au milieu, le sac la cacherait à l'entrée) -->
  <g><rect x="48" y="40" width="54" height="16" rx="3" fill="#10392B" stroke="#F2C230" stroke-width=".8"/><text x="75" y="47" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="6.2" fill="#F3EFE4">marché</text><text x="75" y="53.6" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="800" font-style="italic" font-size="6.4" fill="#F2C230">de Gros</text><path d="M69 40v-4M81 40v-4" stroke="#3B2E1C" stroke-width=".8"/></g>
  ${mode === 'non' ? '' : passants()}
</svg>`;
  }

  const CSS = `.mk{display:block;width:100%;height:100%}
.mk *{transform-box:fill-box}
.mk-amp{fill:#FFE08A;animation:mkAmp 3.4s ease-in-out infinite;animation-delay:calc(var(--i) * -.7s)}
@keyframes mkAmp{0%,100%{opacity:.55}50%{opacity:1}}
.mk-lum{transform-origin:50% 100%;animation:mkLum 6s ease-in-out infinite}
@keyframes mkLum{50%{opacity:.8}}
/* les passants : chacun traverse en fondu, à sa vitesse, et recommence ; --s = taille (le camion est plus loin) */
.mk-p{transform-box:view-box;transform-origin:0 0;animation:mkPasse var(--d) linear infinite;animation-delay:var(--t);opacity:0;will-change:transform}
.mk-p .mk-pi{transform-box:view-box;transform-origin:0 0}
@keyframes mkPasse{0%{transform:translate(-70px,var(--y)) scale(var(--s));opacity:0}7%{opacity:1}93%{opacity:1}100%{transform:translate(470px,var(--y)) scale(var(--s));opacity:0}}
.mk-p:nth-child(3),.mk-p:nth-child(4){animation-name:mkPasseInv}
@keyframes mkPasseInv{0%{transform:translate(470px,var(--y)) scale(var(--s));opacity:0}7%{opacity:1}93%{opacity:1}100%{transform:translate(-70px,var(--y)) scale(var(--s));opacity:0}}
.mk-roue{transform-box:fill-box;transform-origin:center;animation:mkRoue 1.2s linear infinite}
@keyframes mkRoue{to{rotate:360deg}}
.mk-seuls{position:absolute;inset:0}
@media (prefers-reduced-motion:reduce){.mk-amp,.mk-lum,.mk-roue{animation:none}.mk-p{animation:none;opacity:.9;transform:translate(var(--x0,120px),var(--y)) scale(var(--s))}.mk-p:nth-child(1){--x0:40px}.mk-p:nth-child(2){--x0:150px}.mk-p:nth-child(3){--x0:250px}.mk-p:nth-child(4){--x0:330px}.mk-p:nth-child(5){--x0:90px}}`;
  function css() { if (document.getElementById('mkCss')) return; const st = document.createElement('style'); st.id = 'mkCss'; st.textContent = CSS; document.head.appendChild(st); }

  window.MDGScene = { svg, css };
})();
