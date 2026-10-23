/* ═════════ Marché de Gros CI — la scène du marché, à l'entrée (connexion) ═════════
   Demandé par le propriétaire (23/10/2026) : « laisse le marché bien s'exprimer tranquillement ; pas de sac, pas d'écriture ;
   des personnages qui s'expriment, bien propres, un vrai dessin, expressif, beau, réaliste ». Le sac n'arrive qu'après une
   connexion réussie, pour dire bienvenue (v3/porte.js, entrer()). Le fond de l'accueil n'utilise PAS cette scène.
   Un dessin vectoriel (SVG 400 × 190), écrit ici, aucune image empruntée :
     • le soir sur un marché de gros : ciel vert nuit qui chauffe à l'horizon, hangars et un grand fromager au fond,
       passants lointains, deux étals éclairés (bâche terre cuite, bâche verte), vendeuses et vendeur, tas de tomates,
       oignons, régimes de plantain, sacs de jute ouverts (maïs, riz, haricots), ampoules ;
     • devant, des gens passent en marchant vraiment (jambes, bras, léger balancement), chacun à son pas :
       une femme portant une bassine de tomates sur la tête, un homme poussant une brouette de sacs, un jeune homme un sac
       sur l'épaule, une femme tenant son enfant par la main ; derrière eux, un camion de vivriers bâché passe lentement.
   Couleurs de la marque : vert forêt #10392B, maïs #F2C230, crème #F3EFE4, terre cuite, jute.
   Pourquoi pas WebGL / three.js : le dessin tient en formes simples ; le CSS anime sans bibliothèque ni batterie, sur tout téléphone.
   Mouvement réduit : tout est immobile, les passants posés dans la rue.
   Piège : ne JAMAIS poser `transform-box` sur tout le dessin — les attributs SVG transform="…" partiraient de travers.
   API : MDGScene.svg(k) → markup SVG · MDGScene.css() → pose la feuille de style */
(function () {
  'use strict';
  if (window.MDGScene) return;

  const PEAU = ['#6A4127', '#57351F', '#7A4D2E'], OMBRE = 'rgba(20,12,6,.28)';

  // ——— morceaux de corps (coordonnées locales : pieds en y = 0, le personnage regarde vers la droite) ———
  // une jambe : cuisse + mollet + pied d'un seul tenant ; pivot en haut (la hanche), animée par .mk-j
  const jambe = (x, haut, couleur, peau, cls, pied) => `<g class="mk-j ${cls}"><path d="M${x - 2.7} ${haut}h5.4l-.5 ${-haut - 3.2}h-4.4z" fill="${couleur}"/>` +
    `<path d="M${x - 2.2} -3.4h4.2l.2 1.6h${pied || 3.4}q1.6 0 1.6 1.8h-${(pied || 3.4) + 6}z" fill="${peau === 'pied' ? '#2A1D14' : peau}"/></g>`;
  // un bras qui se balance : pivot à l'épaule ; .mk-b
  const bras = (x, y, long, peau, manche, cls) => `<g class="mk-b ${cls}"><path d="M${x - 1.8} ${y}h3.6l-.4 ${long}h-2.8z" fill="${peau}"/>` +
    (manche ? `<path d="M${x - 2.4} ${y - .5}h4.8l-.3 ${long * .38}h-4.2z" fill="${manche}"/>` : '') + `<circle cx="${x}" cy="${y + long + .4}" r="1.9" fill="${peau}"/></g>`;
  // une tête de profil (vers la droite) : visage, nez, oreille, cou
  const tete = (y, peau, cou) => `<path d="M-1.8 ${y + 4}h3.6v${cou || 4}h-3.6z" fill="${peau}"/><ellipse cx="0" cy="${y}" rx="4.5" ry="5.3" fill="${peau}"/>` +
    `<path d="M4.1 ${y - .6}l1.6 2-1.4.6z" fill="${peau}"/><ellipse cx="-.9" cy="${y + .4}" rx="1" ry="1.4" fill="${OMBRE}"/><circle cx="2.6" cy="${y - 1.2}" r=".55" fill="#1A120C"/>`;

  // ——— les passants ———
  // femme, bassine de tomates sur la tête ; pagne terre cuite à motifs maïs, foulard rouge, corsage maïs
  function femmeBassine() {
    const p = PEAU[0];
    return jambe(-1.5, -40, p, 'pied', 'mk-j1', 3) + jambe(1.5, -40, p, 'pied', 'mk-j2', 3) +
      `<g class="mk-corps">` +
      bras(-2.5, -57, 17, '#5A3620', '#E2A92A', 'mk-b1') +
      `<path d="M-8.6 -42.5Q-10.4 -22 -7.8 -8.6H7.8Q10.6 -22 8.8 -42.5Z" fill="#B5523B"/>` +
      `<path d="M-9.4 -34H9.8M-9 -24.5H9.6M-8.3 -15H8.8" stroke="#F2C230" stroke-width="1.6" stroke-dasharray="2.2 2.4"/><path d="M-9.3 -29H9.7M-8.6 -19.8H9.2" stroke="#10392B" stroke-width="1.1"/>` +
      `<path d="M-7.4 -42.5L-6.6 -57.5Q0 -61.2 6.8 -57.4L7.6 -42.5Z" fill="#E9B23A"/><path d="M-5 -52l2 2m3 -3l2 2m-6 5l2 2m3 -2l2 2" stroke="rgba(120,70,0,.35)" stroke-width=".9"/>` +
      tete(-66, p) +
      `<path d="M-5.1 -66.6Q-5.6 -74.2 0 -74.4Q5.8 -74.2 5 -66.4Q.4 -69.6 -5.1 -66.6Z" fill="#C2402A"/><path d="M-5 -68.8q-3.4 1.8 -2.2 5" stroke="#C2402A" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      // le bras levé qui tient la bassine
      `<path d="M5.6 -58.4L9 -66.2L9.8 -76.4" stroke="${p}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 -58.6l3.1 -5.4" stroke="#E2A92A" stroke-width="4.4" stroke-linecap="round"/>` +
      // la bassine émaillée et ses tomates
      `<path d="M-7.2 -74.4L-10.6 -80.4H10.6L7.2 -74.4Z" fill="#D8D2C2"/><path d="M-9.4 -78.4H9.4" stroke="#2F6B4F" stroke-width="1.4"/><ellipse cx="0" cy="-80.4" rx="10.8" ry="1.7" fill="#EFEADF"/>` +
      [[-7, -82.6], [-3.4, -83.6], [.4, -83.2], [4.2, -83.6], [7.4, -82.4], [-5, -86.4], [-1.2, -87.2], [2.8, -86.8], [.8, -90.2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.35" fill="#D23B25"/><circle cx="${x - .7}" cy="${y - .7}" r=".7" fill="#F2876B"/>`).join('') +
      `<g class="mk-tombe"><circle cx="8.6" cy="-85" r="2.35" fill="#D23B25"/><circle cx="7.9" cy="-85.7" r=".7" fill="#F2876B"/></g>` +
      `</g>`;
  }
  // homme qui pousse une brouette de sacs de jute ; bleu de travail, casquette
  function brouette() {
    const p = PEAU[1];
    return jambe(-2, -40, '#2E3E58', '#2A1D14', 'mk-j1', 3.6) + jambe(1.2, -40, '#34476A', '#2A1D14', 'mk-j2', 3.6) +
      `<g class="mk-corps">` +
      `<path d="M-6.2 -40.5L-4.2 -60.2Q2 -63.6 7.2 -59L6.4 -40.5Z" fill="#E7DCC4"/><path d="M-6.2 -40.5h12.6v2.6h-12.6z" fill="#3B2A1C"/>` +
      tete(-66.4, p, 3.6).replace('cx="0" cy="-66.4"', 'cx=".6" cy="-66.4"') +
      `<path d="M-4.4 -68.6Q-3.6 -73.6 1.4 -73.4Q5.8 -73 5.2 -68.6Z" fill="#10392B"/><path d="M3.6 -69.4h5.2q.8 0 .6 .9h-6z" fill="#0B2A1F"/>` +
      // les bras tendus vers les poignées
      `<path d="M4.4 -57.6L10.6 -47.6L15.4 -40.2" stroke="${p}" stroke-width="3.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 -58l3.6 5.8" stroke="#E7DCC4" stroke-width="4.4" stroke-linecap="round"/>` +
      // la brouette : poignées, bac, sacs, roue qui tourne, pied
      `<path d="M14 -40.6L28 -34.4" stroke="#3E4A44" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M24.6 -39L52 -42.8L47 -24.2L28.4 -22.6Z" fill="#4C5E55"/><path d="M27 -36.4L50.8 -39.8" stroke="#6B7F75" stroke-width="1.2"/>` +
      `<ellipse cx="34" cy="-43.4" rx="7.2" ry="5" fill="#A88A5E"/><ellipse cx="44.2" cy="-45" rx="7" ry="4.8" fill="#B99C72"/><ellipse cx="39" cy="-50.4" rx="6.4" ry="4.4" fill="#9C8058"/>` +
      `<path d="M30 -46.6q4 -1.4 8 0M40 -48.4q4 -1.4 8 0M35.4 -53.4q3.6 -1.4 7.2 0" stroke="rgba(59,42,20,.4)" stroke-width=".8" fill="none"/>` +
      `<path d="M32 -23L30.4 -1.4" stroke="#3E4A44" stroke-width="1.8" stroke-linecap="round"/>` +
      `<g class="mk-roue"><circle cx="47.4" cy="-7.2" r="7" fill="#1E1A15"/><circle cx="47.4" cy="-7.2" r="4.4" fill="none" stroke="#5A564E" stroke-width="1"/><path d="M47.4 -11.6v8.8M43 -7.2h8.8" stroke="#5A564E" stroke-width="1"/></g>` +
      `</g>`;
  }
  // jeune homme, un sac de jute sur l'épaule ; t-shirt vert, pantalon clair
  function sacEpaule() {
    const p = PEAU[2];
    return jambe(-1.6, -40, '#C9BBA0', '#2A1D14', 'mk-j1', 3.4) + jambe(1.6, -40, '#D6C9AE', '#2A1D14', 'mk-j2', 3.4) +
      `<g class="mk-corps">` +
      bras(-2.2, -57.4, 18, '#6B4227', '#1F5A43', 'mk-b1') +
      `<path d="M-6.4 -40.5L-5.6 -59.6Q1 -63.4 6.6 -59.4L6.8 -40.5Z" fill="#1F5A43"/><path d="M-1 -60.6q2 2.2 4.2 0" stroke="#174535" stroke-width="1.2" fill="none"/>` +
      tete(-66.6, p) + `<path d="M-4.6 -68.4Q-3.4 -73.4 1 -72.8Q4.8 -72.4 4.6 -69.6Q.8 -71.4 -4.6 -68.4Z" fill="#1A120C"/>` +
      // le sac sur l'épaule et le bras qui le tient
      `<path d="M-9.6 -66Q-6 -77.4 7.4 -73.2Q13.4 -70.4 9.4 -64.4Q1 -60.8 -9.6 -66Z" fill="#B99C72"/><path d="M-7.4 -67.6q7.6 -4.6 14.4 -2.4" stroke="rgba(59,42,20,.35)" stroke-width="1" fill="none"/><path d="M-9.6 -66l-2.6 1.4 2.4 1.8" fill="#9C8058"/>` +
      `<path d="M5.2 -58.4L8.6 -63.6L6.2 -69" stroke="${p}" stroke-width="3.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</g>`;
  }
  // femme qui tient son enfant par la main, un panier dans l'autre ; pagne vert à motifs, foulard maïs
  function femmeEnfant() {
    const p = PEAU[1], e = PEAU[2];
    const enfant = `<g transform="translate(-14 0)">` + jambe(-1, -19, '#2E3E58', e, 'mk-j1', 2.2).replace(/h5\.4/, 'h3.6').replace(/h-4\.4z/, 'h-3z') +
      jambe(1, -19, '#2E3E58', e, 'mk-j2', 2.2).replace(/h5\.4/, 'h3.6').replace(/h-4\.4z/, 'h-3z') +
      `<g class="mk-corps"><path d="M-4.2 -19.6L-3.4 -30.6Q0 -32.8 3.6 -30.6L4.2 -19.6Z" fill="#F2C230"/>` +
      `<path d="M-1.2 -33.4h2.4v3h-2.4z" fill="${e}"/><circle cx="0" cy="-36.4" r="3.6" fill="${e}"/><path d="M-3.4 -37.4q.6 -3.2 3.6 -3.2q3 0 3.2 2.6q-3.2 -1.2 -6.8 .6z" fill="#1A120C"/><circle cx="2" cy="-37" r=".45" fill="#1A120C"/>` +
      `<path d="M2.6 -29.4L8.4 -31.6L13.4 -36.8" stroke="${e}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
    return enfant + jambe(-1.5, -40, p, 'pied', 'mk-j1', 3) + jambe(1.5, -40, p, 'pied', 'mk-j2', 3) +
      `<g class="mk-corps">` +
      `<path d="M-8.6 -42.5Q-10.2 -22 -7.8 -8.6H7.8Q10.4 -22 8.8 -42.5Z" fill="#2F6B4F"/>` +
      [-36, -27, -18].map(y => `<path d="M-9 ${y}h18.4" stroke="#F2C230" stroke-width="1.2" stroke-dasharray="1.2 2.6"/><path d="M-9.2 ${y + 4}h18.8" stroke="#F3EFE4" stroke-width=".8" stroke-opacity=".7"/>`).join('') +
      `<path d="M-7.4 -42.5L-6.6 -57.5Q0 -61.2 6.8 -57.4L7.6 -42.5Z" fill="#F3EFE4"/><path d="M-6.8 -50h14" stroke="#2F6B4F" stroke-width="1.1"/>` +
      tete(-66, p) +
      `<path d="M-5.4 -66.4Q-6 -76.4 .4 -76.4Q6.4 -76 5.2 -66.6Q.4 -71.4 -5.4 -66.4Z" fill="#F2C230"/><path d="M-1 -76q2.4 -3.2 5.6 -1.4q-2.4 .2 -2.8 2.4z" fill="#E2A92A"/>` +
      // le bras qui tient l'enfant (en arrière, vers lui) et le bras qui porte le panier
      `<path d="M-3.4 -57.4L-6.6 -46L-10.6 -40" stroke="${p}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M5.2 -57.6L7.2 -47.6L8.4 -40.6" stroke="${p}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M4.4 -39.4Q8.6 -45.6 12.8 -39.4" stroke="#8C6A3E" stroke-width="1.2" fill="none"/><path d="M3.6 -39.6h10l-1.6 8h-6.8z" fill="#A9824F"/><path d="M4.4 -36.4h8.6M5 -33.6h7.4" stroke="#7A5A33" stroke-width=".8"/>` +
      `<circle cx="6.6" cy="-40.6" r="1.8" fill="#D23B25"/><circle cx="9.8" cy="-41" r="1.7" fill="#5B3A6E"/>` +
      `</g>`;
  }
  // le camion de vivriers : cabine vert forêt, liseré maïs, bâche de jute, sacs à l'arrière, phares
  function camion() {
    // la poussière soulevée par les roues et la fumée du pot : elles restent en arrière pendant que le camion avance
    const pouss = [0, .35, .7, 1.05].map((t, i) => `<circle class="mk-pf" style="animation-delay:${-t}s" cx="${-48 + i * 2}" cy="-5" r="${4 + i % 2}" fill="#C9AA78"/>`).join('') +
      [0, .6].map(t => `<circle class="mk-pf mk-fu" style="animation-delay:${-t}s" cx="-61" cy="-14" r="2.4" fill="#8A847A"/>`).join('');
    return `<g>${pouss}</g><path d="M-58 -16h104v4h-104z" fill="#1A1611"/><path d="M-60 -14h4v2.4h-4z" fill="#2A2722"/>` +
      `<path d="M-58 -50Q-57 -58 -48 -58H20Q26 -58 26 -52V-16H-58Z" fill="#8C7350"/><path d="M-56 -50Q-55 -56 -48 -56H20" stroke="#A88A5E" stroke-width="1.2" fill="none"/>` +
      [-46, -30, -14, 2, 16].map(x => `<path d="M${x} -57.6V-16.4" stroke="#6E5A3C" stroke-width="1"/>`).join('') +
      `<path d="M-58 -40H26" stroke="#6E5A3C" stroke-width="1.2"/>` +
      `<g><ellipse cx="-50" cy="-22" rx="6" ry="4" fill="#B99C72"/><ellipse cx="-50" cy="-30" rx="6" ry="4" fill="#A88A5E"/></g>` +
      `<path d="M26 -46H44Q50 -46 53 -40L58 -29V-16H26Z" fill="#10392B"/><path d="M26 -30H58" stroke="#F2C230" stroke-width="2"/>` +
      `<path d="M30 -43H43Q47 -43 49.4 -38.6L52 -33H30Z" fill="#2A4A3F"/><path d="M31 -42.4l9 9" stroke="rgba(243,239,228,.18)" stroke-width="2"/>` +
      `<circle cx="38" cy="-37.6" r="2.6" fill="#1A120C"/><path d="M35.4 -34.6q2.6 -2.2 5.2 0v1.6h-5.2z" fill="#1A120C"/>` +
      `<path d="M56 -24h3v5h-3z" fill="#FFE08A"/><path d="M59 -22.6L92 -30V-12Z" fill="#FFE08A" fill-opacity=".12"/>` +
      [-40, 40].map(x => `<g class="mk-roue"><circle cx="${x}" cy="-7.4" r="7.6" fill="#141210"/><circle cx="${x}" cy="-7.4" r="3.6" fill="#4A463F"/><path d="M${x - 3.6} -7.4h7.2M${x} -11v7.2" stroke="#2A2722" stroke-width="1.2"/></g>`).join('');
  }

  // chaque passant : silhouette, durée de la traversée, retard, sens (1 = vers la droite), taille, ligne de sol, durée du pas
  const PASSANTS = [
    ['camion', camion, 30, -16.2, 1, 1.45, 170, 0],   // à l'échelle des gens : un camion bâché fait 1,4 fois une personne (un peu en retrait)
    ['femmeBassine', femmeBassine, 30, -6, 1, 1, 183, 1.15],
    ['brouette', brouette, 38, -24, -1, 1, 184, 1.25],
    ['sacEpaule', sacEpaule, 26, -16, -1, 1, 183, 1.05],
    ['femmeEnfant', femmeEnfant, 36, -31, 1, .97, 184, 1.2]
  ];
  const passants = () => PASSANTS.map(([n, f, d, t, sens, s, y, pas]) =>
    `<g class="mk-p mk-${sens > 0 ? 'd' : 'g'}${n === 'camion' ? ' mk-v' : ''}" style="--d:${d}s;--t:${t}s;--y:${y}px;--s:${s};--pas:${pas || 1}s">` +
    `<ellipse class="mk-om" cx="0" cy="0" rx="${n === 'camion' ? 60 : n === 'brouette' ? 30 : 11}" ry="2.4" fill="rgba(0,0,0,.35)"/>` +
    `<g transform="scale(${sens} 1)"><g class="mk-pas">${f()}</g></g></g>`).join('');

  // ——— le décor ———
  // les deux étals, avec leurs conversations : on discute le prix, on se met d'accord, on paie ; on parle de ce que fait l'application
  // (les bulles se suivent ; le prix « ne bouge plus jusqu'à la livraison » : c'est la règle d'un accord conclu dans l'application)
  const BULLES_G = `<g class="mk-bu mk-cg" style="--n:0"><rect x="83.8" y="76.5" width="132.3" height="19.5" rx="7" fill="#F3EFE4"/><path d="M146.0 95.5l4 5.5 4-5.5z" fill="#F3EFE4"/><text x="150.0" y="89.7" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="9" fill="#171512"><tspan x="150.0" dy="0">La tomate, c'est combien ?</tspan></text></g><g class="mk-bu mk-cg" style="--n:1"><rect x="73.2" y="68.5" width="77.7" height="19.5" rx="7" fill="#F3EFE4"/><path d="M108.0 87.5l4 5.5 4-5.5z" fill="#F3EFE4"/><text x="112.0" y="81.7" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="9" fill="#171512"><tspan x="112.0" dy="0">350 F le kilo.</tspan></text></g><g class="mk-bu mk-cg" style="--n:2"><rect x="83.8" y="76.5" width="132.3" height="19.5" rx="7" fill="#F3EFE4"/><path d="M146.0 95.5l4 5.5 4-5.5z" fill="#F3EFE4"/><text x="150.0" y="89.7" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="9" fill="#171512"><tspan x="150.0" dy="0">D'accord, je prends 50 kg.</tspan></text></g>`;
  const BULLES_D = `<g class="mk-bu mk-cd" style="--n:0"><rect x="176.4" y="74.5" width="123.2" height="19.5" rx="7" fill="#F3EFE4"/><path d="M234.0 93.5l4 5.5 4-5.5z" fill="#F3EFE4"/><text x="238.0" y="87.7" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="9" fill="#171512"><tspan x="238.0" dy="0">Je paie à la livraison ?</tspan></text></g><g class="mk-bu mk-cd" style="--n:1"><rect x="227.0" y="56.0" width="145.9" height="30.0" rx="7" fill="#F3EFE4"/><path d="M296.0 85.5l4 5.5 4-5.5z" fill="#F3EFE4"/><text x="300.0" y="69.2" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="9" fill="#171512"><tspan x="300.0" dy="0">Oui. Et le prix ne bouge plus</tspan><tspan x="300.0" dy="10.5">jusqu'à la livraison.</tspan></text></g><g class="mk-bu mk-cd" style="--n:2"><rect x="194.6" y="64.0" width="86.8" height="30.0" rx="7" fill="#F3EFE4"/><path d="M234.0 93.5l4 5.5 4-5.5z" fill="#F3EFE4"/><text x="238.0" y="77.2" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="600" font-size="9" fill="#171512"><tspan x="238.0" dy="0">Je commande sur</tspan><tspan x="238.0" dy="10.5">Marché de Gros !</tspan></text></g>`;
  // un acheteur debout (coordonnées locales, regarde vers la droite) ; son bras avant fait un geste (.mk-geste)
  const acheteur = (peau, chemise, bas) => `<path d="M-4.4 -40h4l-.4 37h-3.4z" fill="${bas}"/><path d="M.6 -40h4l.2 37h-3.4z" fill="${bas}"/>` +
    `<path d="M-5 -3.4h4.2v3.4h-6.4q0-2 2.2-3.4zM.8 -3.4h4.2q2.6 1.4 2.4 3.4h-6.6z" fill="#2A1D14"/>` +
    `<path d="M-3.4 -57.4L-5.6 -46.4L-5 -40" stroke="${peau}" stroke-width="3.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M-6.4 -40.5L-5.6 -60Q1 -63.6 6.6 -59.6L6.8 -40.5Z" fill="${chemise}"/>` + tete(-66.4, peau) +
    `<g class="mk-geste"><path d="M4.4 -57.6L10.4 -51.6L15.6 -49.4" stroke="${peau}" stroke-width="3.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  const acheteuse = (peau, pagne, haut, foulard) => `<path d="M-2.6 -10h3v7h-3zM.6 -10h3v7h-3z" fill="${peau}"/><path d="M-4.4 -3.2h4v3.2h-6q0-2 2-3.2zM.8 -3.2h4q2.4 1.2 2.2 3.2h-6.2z" fill="#2A1D14"/>` +
    `<path d="M-8.4 -42Q-10 -22 -7.6 -8.6H7.6Q10 -22 8.6 -42Z" fill="${pagne}"/><path d="M-8.8 -30h17.6M-8.4 -20h17" stroke="#F3EFE4" stroke-width="1" stroke-dasharray="1.4 2.4" stroke-opacity=".8"/>` +
    `<path d="M-3.4 -57.4L-6.2 -46L-5.4 -41" stroke="${peau}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M-7.2 -42L-6.4 -57.4Q0 -61 6.6 -57.2L7.4 -42Z" fill="${haut}"/>` + tete(-66, peau) +
    `<path d="M-5.2 -66.4Q-5.8 -75.6 .4 -75.8Q6.2 -75.4 5 -66.6Q.4 -70.6 -5.2 -66.4Z" fill="${foulard}"/>` +
    `<g class="mk-geste"><path d="M4.6 -57.4L10.6 -50.6L15.4 -50" stroke="${peau}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  // des billets qui passent de la main de l'acheteur à celle de la vendeuse
  const billets = (x, y, dx, dy, cls) => `<g class="mk-argent ${cls}" style="--dx:${dx}px;--dy:${dy}px"><rect x="${x - 5}" y="${y - 3}" width="10" height="5.6" rx=".8" fill="#5E8C6A"/><rect x="${x - 4}" y="${y - 2}" width="10" height="5.6" rx=".8" fill="#7FAF8A"/><circle cx="${x + 1}" cy="${y + .8}" r="1.3" fill="#E9E1C8"/></g>`;

  function etalTerreCuite() {
    return `<g>` +
      `<path d="M14 150V104M128 150V104" stroke="#3B2A1C" stroke-width="2.4"/>` +
      `<path d="M6 102Q71 116 136 102L132 92Q71 103 10 92Z" fill="#B5523B"/><path d="M10 92Q71 103 132 92" stroke="#D07254" stroke-width="1.4" fill="none"/><path d="M6 102Q71 116 136 102" stroke="#8E3C2A" stroke-width="1.2" fill="none"/>` +
      // la vendeuse, assise au bout de la table, qui tend la main
      `<g transform="translate(110 0)"><path d="M-9 132Q-8 116 0 115Q8 116 9 132Z" fill="#2F6B4F"/><path d="M-8 124h16" stroke="#F2C230" stroke-width="1" stroke-dasharray="1.2 2"/>` +
      `<path d="M-1.6 111h3.2v4h-3.2z" fill="${PEAU[0]}"/><ellipse cx="0" cy="107.4" rx="4.3" ry="5" fill="${PEAU[0]}"/><circle cx="2.4" cy="106.4" r=".55" fill="#1A120C"/><path d="M-4.8 107Q-5.2 99.6 0 99.4Q5.4 99.6 4.8 107Q0 103.6 -4.8 107Z" fill="#F2C230"/><path d="M2 99.6q3.6 -2.6 6 .4q-3 -.4 -4.4 2z" fill="#E2A92A"/>` +
      `<path d="M4.4 117.4L10.6 120.4L14.4 120" stroke="${PEAU[0]}" stroke-width="2.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>` +
      `<path d="M8 132H134V150H8Z" fill="#4E3A26"/><path d="M8 138H134M8 144H134" stroke="rgba(20,12,6,.35)" stroke-width="1"/>` +
      // tas de tomates, d'oignons, régime de plantain
      [[22, 130], [28, 130], [34, 130], [25, 125.6], [31, 125.6], [28, 121.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.1" fill="#D23B25"/><circle cx="${x - .9}" cy="${y - .9}" r=".9" fill="#F2876B"/>`).join('') +
      [[46, 130], [52, 130], [58, 130], [49, 125.6], [55, 125.6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.1" ry="2.9" fill="#B9709A"/><path d="M${x} ${y - 2.8}v-1.6" stroke="#6B8A4A" stroke-width=".8"/>`).join('') +
      `<path d="M66 131Q68 118 80 116Q90 116 92 131Z" fill="#C9B24A"/><path d="M68 128Q76 120 88 121M70 124Q78 117 86 117" stroke="#9C8A2E" stroke-width="1" fill="none"/><path d="M79 116v-4" stroke="#6B5A2E" stroke-width="2"/>` +
      `<circle class="mk-amp" cx="71" cy="111" r="2.2"/><path d="M71 104v4.6" stroke="#3B2A1C" stroke-width=".8"/>` +
      // l'acheteur, debout au bout de l'étal, tourné vers la vendeuse ; il paie
      `<g transform="translate(147 157) scale(-.82 .82)">${acheteur(PEAU[2], '#E7DCC4', '#2E3E58')}</g>` +
      billets(134, 117.6, -10, 2, 'mk-ag') +
      `</g>`;
  }
  function etalVert() {
    return `<g>` +
      `<path d="M272 150V102M386 150V102" stroke="#3B2A1C" stroke-width="2.4"/>` +
      `<path d="M264 100Q329 113 394 100L390 90Q329 100 268 90Z" fill="#10392B"/><path d="M268 90Q329 100 390 90" stroke="#2F6B4F" stroke-width="1.4" fill="none"/><path d="M264 100Q329 113 394 100" stroke="#F2C230" stroke-width="1.1" fill="none"/>` +
      // le vendeur, debout au bout de la table, qui répond
      `<g transform="translate(288 0)"><path d="M-7 134L-6 116Q0 113 6.4 116L7 134Z" fill="#E7DCC4"/><path d="M-1.6 108.6h3.2v4h-3.2z" fill="${PEAU[1]}"/><ellipse cx="-.4" cy="105" rx="4.3" ry="5" fill="${PEAU[1]}"/><circle cx="-2.8" cy="104" r=".55" fill="#1A120C"/>` +
      `<path d="M-4.4 103.4Q-3.4 99 1 99.4Q4.4 99.8 4 102.6Q0 101 -4.4 103.4Z" fill="#1A120C"/><g class="mk-geste mk-geste2"><path d="M-4.8 117L-10 123L-14 124" stroke="${PEAU[1]}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>` +
      `<path d="M266 134H392V150H266Z" fill="#4E3A26"/><path d="M266 140H392M266 145H392" stroke="rgba(20,12,6,.35)" stroke-width="1"/>` +
      // sacs de jute ouverts : maïs, riz, haricots
      [[318, '#F2C230', '#D9A81E'], [342, '#F3EFE4', '#D9D2C2'], [366, '#8C3A2A', '#6E2C20']].map(([x, c, c2]) =>
        `<path d="M${x - 10} 134Q${x - 12} 120 ${x - 9} 117H${x + 9}Q${x + 12} 120 ${x + 10} 134Z" fill="#B99C72"/><path d="M${x - 9} 117Q${x} 113 ${x + 9} 117Q${x} 121 ${x - 9} 117Z" fill="${c}"/>` +
        `<path d="M${x - 6} 117.6q3 -1 6 0M${x + 1} 116.4q3 -1 5 .4" stroke="${c2}" stroke-width=".9" fill="none"/><path d="M${x - 10} 120h20" stroke="#9C8058" stroke-width="1.4"/>`).join('') +
      `<circle class="mk-amp" cx="330" cy="110" r="2.2"/><path d="M330 103v4.6" stroke="#3B2A1C" stroke-width=".8"/>` +
      // l'acheteuse, tournée vers le vendeur, un panier au bras
      `<g transform="translate(252 157) scale(.82 .82)">${acheteuse(PEAU[0], '#7A3B5C', '#F3EFE4', '#2F6B4F')}<path d="M-9.6 -42.4Q-6 -48 -2.4 -42.4" stroke="#8C6A3E" stroke-width="1.2" fill="none"/><path d="M-10.4 -42.6h8.6l-1.4 7h-5.8z" fill="#A9824F"/></g>` +
      `</g>`;
  }

  function svg(k) {
    return `<svg class="mk" viewBox="0 0 400 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${k}ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B231A"/><stop offset=".5" stop-color="#173126"/><stop offset=".78" stop-color="#5A3A22"/><stop offset="1" stop-color="#8A5428"/></linearGradient>
    <linearGradient id="${k}sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2B1C"/><stop offset="1" stop-color="#17110B"/></linearGradient>
    <radialGradient id="${k}lum" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD27A" stop-opacity=".5"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="400" height="150" fill="url(#${k}ciel)"/>
  <g fill="#F3EFE4" class="mk-et"><circle cx="40" cy="14" r=".7"/><circle cx="118" cy="26" r=".5"/><circle cx="210" cy="10" r=".6"/><circle cx="300" cy="22" r=".5"/><circle cx="362" cy="12" r=".7"/></g>
  <!-- au fond : un grand fromager, les hangars du marché, quelques fenêtres allumées -->
  <path d="M188 120V82M188 92Q170 78 150 82M188 88Q206 70 228 76" stroke="#0E1A13" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <g fill="#0E1A13"><ellipse cx="156" cy="74" rx="20" ry="10"/><ellipse cx="186" cy="66" rx="24" ry="13"/><ellipse cx="222" cy="70" rx="20" ry="10"/><ellipse cx="204" cy="78" rx="16" ry="8"/></g>
  <g fill="#120F0A"><path d="M-6 122V96l40 -12 40 12v26z"/><path d="M226 122V100l34 -10 34 10v22z"/><path d="M330 122V94l38 -11 38 11v28z"/></g>
  <g fill="#FFD27A" fill-opacity=".6"><rect x="10" y="104" width="5" height="4"/><rect x="40" y="104" width="5" height="4"/><rect x="250" y="106" width="5" height="4"/><rect x="350" y="102" width="5" height="4"/><rect x="378" y="102" width="5" height="4"/></g>
  <!-- des passants lointains, immobiles, dans la lumière du soir -->
  <g fill="#1B1611" opacity=".85">${[[150, 2.2], [166, 2], [214, 2.3], [236, 1.9]].map(([x, s]) => `<g><circle cx="${x}" cy="${130 - s * 9}" r="${s * 1.1}"/><path d="M${x - s * 1.4} ${131 - s * 7.6}h${s * 2.8}l${s * .4} ${s * 7.6}h-${s * 3.6}z"/></g>`).join('')}</g>
  <!-- le sol : terre battue, traces de roues -->
  <rect y="146" width="400" height="44" fill="url(#${k}sol)"/>
  <path d="M0 168Q200 160 400 170M0 178Q200 171 400 181" stroke="rgba(243,239,228,.05)" stroke-width="1.2" fill="none"/>
  <ellipse cx="71" cy="140" rx="64" ry="22" fill="url(#${k}lum)"/><ellipse cx="329" cy="140" rx="64" ry="22" fill="url(#${k}lum)"/>
  ${etalTerreCuite()}${etalVert()}
  <g class="mk-pass">${passants()}</g>
  <g class="mk-bulles">${BULLES_G}${BULLES_D}</g>
</svg>`;
  }

  const CSS = `.mk{display:block;width:100%;height:100%}
.mk-amp{fill:#FFE08A;filter:drop-shadow(0 0 3px #FFD27A);animation:mkAmp 3.6s ease-in-out infinite}
@keyframes mkAmp{0%,100%{opacity:.8}50%{opacity:1}}
.mk-et circle{animation:mkEt 5s ease-in-out infinite}.mk-et circle:nth-child(2n){animation-delay:-2.5s}
@keyframes mkEt{50%{opacity:.25}}
/* les passants traversent la rue, en fondu, chacun à son rythme */
.mk-p{transform-box:view-box;transform-origin:0 0;opacity:0;animation:mkD var(--d) linear infinite;animation-delay:var(--t);will-change:transform,opacity}
.mk-p.mk-g{animation-name:mkG}
.mk-p.mk-v{animation-name:mkV}
/* le camion passe une fois par cycle de 30 s, vite (6 s pour traverser), juste après le paiement à l'étal de gauche */
@keyframes mkV{0%{transform:translate(-170px,var(--y)) scale(var(--s));opacity:1}20%{transform:translate(580px,var(--y)) scale(var(--s));opacity:1}20.1%,100%{transform:translate(580px,var(--y)) scale(var(--s));opacity:0}}
@keyframes mkD{0%{transform:translate(-80px,var(--y)) scale(var(--s));opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translate(480px,var(--y)) scale(var(--s));opacity:0}}
@keyframes mkG{0%{transform:translate(480px,var(--y)) scale(var(--s));opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translate(-80px,var(--y)) scale(var(--s));opacity:0}}
/* la marche : les jambes et les bras se balancent depuis la hanche et l'épaule, le corps monte et descend à chaque pas */
.mk-j,.mk-b{transform-box:fill-box;transform-origin:50% 0}
.mk-j1{animation:mkJ var(--pas) ease-in-out infinite alternate}
.mk-j2{animation:mkJ var(--pas) ease-in-out infinite alternate-reverse}
@keyframes mkJ{from{rotate:-17deg}to{rotate:17deg}}
.mk-b1{animation:mkBr var(--pas) ease-in-out infinite alternate-reverse}
@keyframes mkBr{from{rotate:-14deg}to{rotate:14deg}}
.mk-corps{animation:mkPas calc(var(--pas) / 2) ease-in-out infinite alternate}
@keyframes mkPas{from{transform:translateY(0)}to{transform:translateY(-1.1px)}}
.mk-roue{transform-box:fill-box;transform-origin:center;animation:mkRoue 1.3s linear infinite}
@keyframes mkRoue{to{rotate:360deg}}
.mk-pf{transform-box:fill-box;transform-origin:center;opacity:0;animation:mkPf 1.4s linear infinite}
.mk-fu{animation-duration:1.8s}
@keyframes mkPf{0%{transform:translate(0,0) scale(.4);opacity:.5}100%{transform:translate(-38px,-12px) scale(2.4);opacity:0}}
/* la tomate qui tombe de la bassine : elle tombe, rebondit, roule et s'efface (elle part vers l'arrière : elle reste sur place pendant que la femme avance) */
.mk-tombe{animation:mkTombe 9s cubic-bezier(.4,0,.6,1) infinite}
@keyframes mkTombe{0%,62%{transform:translate(0,0);opacity:1}70%{transform:translate(-5px,83px)}75%{transform:translate(-10px,74px)}80%{transform:translate(-15px,83px)}96%{transform:translate(-40px,83px);opacity:1}100%{transform:translate(-44px,83px);opacity:0}}
/* les gens qui discutent : la main qui parle */
.mk-geste{transform-box:fill-box;transform-origin:0 0;animation:mkGeste 1.6s ease-in-out infinite alternate}
.mk-geste2{animation-duration:2.1s;animation-delay:-.8s}
@keyframes mkGeste{from{rotate:-9deg}to{rotate:7deg}}
/* les bulles : une seule à la fois (cycle de 30 s, 5 s chacune) : la conversation de gauche, puis celle de droite */
.mk-bu{opacity:0;animation:mkBu 30s ease-in-out infinite;animation-delay:calc(var(--n) * 5s)}
.mk-bu.mk-cd{animation-delay:calc(var(--n) * 5s + 15s)}
@keyframes mkBu{0%{opacity:0;transform:translateY(4px)}1.5%{opacity:1;transform:none}15%{opacity:1;transform:none}16.6%,100%{opacity:0;transform:translateY(-2px)}}
/* les billets : ils passent de la main de l'acheteur à celle de la vendeuse, pendant « je prends 50 kg » */
.mk-argent{opacity:0;animation:mkArgent 30s ease-in-out infinite}
@keyframes mkArgent{0%,36%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(0,0)}44%{opacity:1;transform:translate(var(--dx),var(--dy))}47%,100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
@media (prefers-reduced-motion:reduce){.mk *{animation:none!important}.mk-bu.mk-cg[style*="--n:1"],.mk-bu.mk-cd[style*="--n:1"]{opacity:1}.mk-tombe{opacity:1}.mk-p{opacity:1;transform:translate(var(--x0,200px),var(--y)) scale(var(--s))}
  .mk-p:nth-child(1){--x0:-300px}.mk-p:nth-child(2){--x0:150px}.mk-p:nth-child(3){--x0:250px}.mk-p:nth-child(4){--x0:205px}.mk-p:nth-child(5){--x0:330px}}`;
  function css() { if (document.getElementById('mkCss')) { document.getElementById('mkCss').textContent = CSS; return; } const st = document.createElement('style'); st.id = 'mkCss'; st.textContent = CSS; document.head.appendChild(st); }

  window.MDGScene = { svg, css };
})();
