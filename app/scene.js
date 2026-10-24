/* ═════════ Marché de Gros CI — le court film de l'écran de connexion ═════════
   Décision du propriétaire (24/10/2026) : la scène de la connexion devient un court film en boucle de 17 s,
   « le marché qui relie tout le pays ». C'est une exception assumée à « l'accueil calmé », limitée à cet écran.
   Le film, sur une seule horloge (D = 17 s ; chaque animation dure D et place ses étapes en secondes, voir kf()) :
     0 → 8,4 s   deux commerçantes, l'une à Abidjan, l'autre à Bouaké, se parlent au téléphone (tête, main, regard, buste) ;
     7,6 s       Abidjan valide sa commande : une lumière sort de son téléphone, descend au sol puis monte vers le ciel ;
     8,1 → 9,5 s la caméra monte avec elle (le premier plan descend plus que le ciel) ;
     9,2 → 11,1  la carte de Côte d'Ivoire s'allume : Abidjan, Bouaké et leur ligne, puis Yamoussoukro, Daloa, San-Pédro, Korhogo, Man ;
     10 → 11,8   le camion part (phares, roues, caisse qui suit) ; une impulsion fait la même route Abidjan → Yamoussoukro → Bouaké ;
     11 → 13,9   le réseau vit : des impulsions décalées, puis tout converge vers le centre ;
     12,4 → 14   le camion revient chargé, l'impulsion du retour arrive à Abidjan au même instant ; la lumière fait le tour de la carte ;
     14,05       une impulsion descend vers le titre du formulaire : « de Gros » laisse la place à « du pays » (v3/nuage.js, .mk-ta / .mk-tb) ;
     15 → 17     les lignes s'effacent, les étoiles reviennent, la caméra redescend, les deux femmes reprennent leur téléphone : image de départ.
   La carte est juste : contour Natural Earth (app/geo/ci.json, simplifié une fois, domaine public), villes à leurs vraies coordonnées
   (projection : x = 200 + (lon + 5,55) × 16, y = 2 + (10,74 − lat) × 16).
   Dessin vectoriel (SVG 400 × 190), animé en CSS (transform, opacity, stroke-dashoffset) : aucune bibliothèque.
   Pause quand la scène n'est plus visible (onglet caché, hors de l'écran, porte fermée) : lancer(). Téléphone modeste (≤ 4 cœurs ou ≤ 2 Go) :
   moins d'impulsions, pas de poussière. Mouvement réduit : une image fixe prise dans le film (réseau allumé, camion à sa place).
   Piège : ne JAMAIS poser `transform-box` sur tout le dessin — les attributs SVG transform="…" partiraient de travers.
   API : MDGScene.svg(k) → markup SVG · MDGScene.css() → pose la feuille de style · MDGScene.lancer(svg) → { lier(el), pause(raison, oui), arreter() } */
(function () {
  'use strict';
  if (window.MDGScene) return;

  const D = 17;
  const PEAU = ['#6A4127', '#57351F', '#7A4D2E'], OMBRE = 'rgba(20,12,6,.28)', JOST = 'font-family="Jost,system-ui,sans-serif"';
  // les courbes : sortie douce (o), entrée-sortie (io), accélération (i), sinus (s), linéaire (l)
  const E = { o: 'cubic-bezier(.22,1,.36,1)', io: 'cubic-bezier(.65,0,.35,1)', i: 'cubic-bezier(.55,0,.9,.55)', s: 'cubic-bezier(.37,0,.63,1)', l: 'linear' };
  const pc = t => +(t / D * 100).toFixed(3) + '%';
  // une piste du film : [[seconde, valeur, courbe vers l'étape suivante], …] → @keyframes en pourcentages de D
  const kf = (nom, rendu, pts) => `@keyframes ${nom}{${pts.map(([t, v, e]) => `${pc(t)}{${rendu(v)};animation-timing-function:${E[e || 's']}}`).join('')}}`;
  const tr = (x, y) => `transform:translate(${x}px,${y}px)`;
  const rot = a => `transform:rotate(${a}deg)`;
  const op = v => `opacity:${v}`;
  let PISTES = '';
  const piste = (sel, nom, rendu, pts, extra) => { PISTES += kf(nom, rendu, pts) + `${sel}{animation:${nom} ${D}s linear infinite${extra ? ';' + extra : ''}}`; };

  const tete = (y, peau, cou) => `<path d="M-1.8 ${y + 4}h3.6v${cou || 4}h-3.6z" fill="${peau}"/><ellipse cx="0" cy="${y}" rx="4.5" ry="5.3" fill="${peau}"/>` +
    `<path d="M4.1 ${y - .6}l1.6 2-1.4.6z" fill="${peau}"/><ellipse cx="-.9" cy="${y + .4}" rx="1" ry="1.4" fill="${OMBRE}"/><circle cx="2.6" cy="${y - 1.2}" r=".55" fill="#1A120C"/>`;

  // ——— la carte : coordonnées réelles ———
  const CARTE = 'M161 11.2L168.8 6.5L176.5 11.6L177.4 8.3L182 8.3L182.1 3.4L185.7 5L188.7 2.2L189 9.8L192.5 10.8L199.3 6.6L206.6 9L213.9 18.9L216.6 17.9L218.9 20.5L228.7 14.9L237.4 15.2L243.8 23.3L245.8 22L244.4 29L248.7 42.5L244.1 46.8L236.6 68L240.3 82.6L244.2 84.3L244.7 91L238.6 91.6L226.9 91.2L214 91.6L203.6 92.2L195.2 93.4L167.6 103.8L169.6 80.3L164.2 78.5L162.2 73.5L150.9 70L156.2 61.9L153 52.9L157.1 53.1L161.4 45.6L160.8 42.9L156.5 41.9L156.7 38.7L166.2 39.8L165.6 35.8L161.3 32.8L164.8 28.6L161.9 26.9L163 23.3L158.3 21.3L158 14.8Z';
  // [x, y, nom, ancre, dx, dy, taille, seconde où elle s'allume]
  const V = {
    abj: [224.7, 88.1, 'ABIDJAN', 'start', 4.6, 2.5, 7.4, 9.2],
    bke: [208.3, 50.8, 'BOUAKÉ', 'start', 4.6, 2.4, 7.4, 9.7],
    yam: [204.4, 64.7, 'YAMOUSSOUKRO', 'start', 4.4, 3.8, 6.4, 10.15],
    dal: [185.6, 63.8, 'DALOA', 'end', -4.2, 4, 6.4, 10.55],
    spd: [182.6, 97.9, 'SAN-PÉDRO', 'end', -4.2, 2.4, 6.4, 10.8],
    kor: [198.7, 22.5, 'KORHOGO', 'start', 4.4, 2.2, 6.4, 10.95],
    man: [167.9, 55.2, 'MAN', 'end', -4.2, 1.2, 6.4, 11.1]
  };
  // les routes : courbe douce entre deux villes (point de contrôle décalé de côté)
  const ctrl = (a, b, k) => { const [x1, y1] = V[a], [x2, y2] = V[b]; return [(x1 + x2) / 2 - (y2 - y1) * k, (y1 + y2) / 2 + (x2 - x1) * k]; };
  const n1 = v => +v.toFixed(1);
  const route = (pas, k = .14) => pas.reduce((d, v, i) => i ? d + `Q${ctrl(pas[i - 1], v, k).map(n1).join(' ')} ${V[v][0]} ${V[v][1]}` : `M${V[v][0]} ${V[v][1]}`, '');
  // [id, villes, courbure, début, fin du tracé]
  const ROUTES = [['ab', ['abj', 'bke'], .32, 9.3, 9.7], ['ay', ['abj', 'yam'], .14, 9.75, 10.15], ['yb', ['yam', 'bke'], -.2, 10.1, 10.4], ['yd', ['yam', 'dal'], .18, 10.2, 10.55],
    ['as', ['abj', 'spd'], -.12, 10.4, 10.8], ['bk', ['bke', 'kor'], .12, 10.6, 10.95], ['dm', ['dal', 'man'], -.16, 10.75, 11.1], ['sd', ['spd', 'dal'], .1, 10.8, 11.15]];
  const RK = {}; ROUTES.forEach(([id, p, k]) => { RK[id] = [p, k]; });
  const chemin = (...ids) => ids.reduce((d, id) => { const rev = id[0] === '-', [p, k] = RK[rev ? id.slice(1) : id], pas = rev ? [...p].reverse() : p; const s = route(pas, rev ? -k : k); return d ? d + s.replace(/^M[^Q]+/, '') : s; }, '');
  // le trajet du camion (et de son impulsion) : la progression p au fil des secondes ; Yamoussoukro est à 68 % de la route
  const ALLER = [[10, 0, 'i'], [10.9, .3, 'l'], [11.4, .68, 'l'], [11.8, 1]], RETOUR = [[12.4, 0, 'l'], [12.8, .32, 'l'], [13.3, .7, 'o'], [14, 1]];
  // les impulsions : [id, chemin, début, fin, éclat, léger (cachée sur téléphone modeste), étapes propres]
  const TEL = 'M148.8 104.3C149.2 124 156 140 170 141C196 143 228 128 224.7 88.1';
  const IMP = [
    ['tel', TEL, 7.6, 9.2, 1.25],
    ['va', chemin('ay', 'yb'), 0, 0, 1.3, 0, ALLER],
    ['vr', chemin('-yb', '-ay'), 0, 0, 1.3, 0, RETOUR],
    ['s4', chemin('ab'), 11, 11.6, .8, 1],
    ['s1', chemin('-as'), 11.3, 12, 1],
    ['s2', chemin('-bk'), 11.6, 12.3, .85, 1],
    ['s3', chemin('-dm', '-yd'), 11.9, 12.8, .9],
    ['c1', chemin('-bk', '-yb'), 12.6, 13.6, .8, 1],
    ['c2', chemin('-sd', '-yd'), 12.7, 13.7, .9, 1],
    ['c3', chemin('-as'), 12.9, 13.8, .9],
    ['ti', 'M224.7 88.1C226 120 241 150 236 206', 14.05, 14.6, 1.1]
  ];

  function carte() {
    const routes = ROUTES.map(([id, p, k]) => `<path class="mk-r mk-r-${id}" d="${route(p, k)}" pathLength="1"/>`).join('');
    const imp = IMP.map(([id, d, , , , leger]) => `<g class="mk-i${leger ? ' mk-x' : ''}"><path class="mk-iq mk-iq-${id}" d="${d}" pathLength="1"/><path class="mk-ic mk-ic-${id}" d="${d}" pathLength="1"/></g>`).join('');
    const villes = Object.keys(V).map(id => { const [x, y, nom, an, dx, dy, fs] = V[id];
      return `<g class="mk-v mk-v-${id}"><circle class="mk-vp" cx="${x}" cy="${y}" r="3.4" fill="#F2C230" fill-opacity=".2"/><circle class="mk-vh mk-vh-${id}" cx="${x}" cy="${y}" r="3" fill="none" stroke="#FFE08A" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="1.75" fill="#FFE08A"/>` +
        `<text x="${x + dx}" y="${y + dy}" text-anchor="${an}" ${JOST} font-weight="600" font-size="${fs}" letter-spacing="${fs > 7 ? .7 : .6}" fill="#F3EFE4" stroke="#0B231A" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke">${nom}</text></g>`; }).join('');
    return `<g class="mk-carte"><path class="mk-pays" d="${CARTE}" fill="#F2C230" fill-opacity=".05" stroke="#F2C230" stroke-opacity=".42" stroke-width=".8" stroke-linejoin="round"/></g>` +
      `<g class="mk-rs" fill="none" stroke="#F2C230" stroke-linecap="butt">${routes}</g><g fill="none" stroke-linecap="round">${imp}</g>${villes}`;
  }

  // ——— les deux commerçantes : de profil vers la droite, pieds en y = 0 ; elles tiennent leur téléphone (logo du sac sur l'écran) ———
  function femme(k, peau, pagne, motif, haut, foulard) {
    return `<path d="M-4.2 -3h4v3h-6q0-2 2-3zM.6 -3h4q2.4 1.2 2.2 3h-6.2z" fill="#2A1D14"/>` +
      `<g class="mk-${k}-saut">` +
      `<path d="M-8.6 -42.5Q-10.4 -22 -7.8 -2.6H7.8Q10.6 -22 8.8 -42.5Z" fill="${pagne}"/>` +
      `<path d="M-9.4 -33H9.8M-9 -23.5H9.6M-8.3 -14H8.8" stroke="${motif}" stroke-width="1.4" stroke-dasharray="2 2.4"/><path d="M-9.2 -28H9.6M-8.6 -18.8H9.2" stroke="rgba(20,12,6,.3)" stroke-width="1"/>` +
      `<g class="mk-${k}-buste"><g class="mk-resp">` +
      // le bras qui tient le téléphone (derrière le corps), le téléphone, le buste
      `<path d="M2.6 -56.4L6.2 -47.4L11.4 -49.6" stroke="${peau}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M-7.4 -42.5L-6.6 -57.5Q0 -61.2 6.8 -57.4L7.6 -42.5Z" fill="${haut}"/>` +
      `<g><rect x="10.2" y="-57.6" width="5" height="8.8" rx="1.1" fill="#141210"/><rect class="mk-${k}-ecran" x="10.8" y="-56.8" width="3.8" height="7.2" rx=".5" fill="#F2C230"/>` +
      `<path d="M11.9 -54.4h1.6l.4 2.6h-2.4z" fill="#10392B"/><circle cx="11.5" cy="-49.8" r="1.7" fill="${peau}"/></g>` +
      // la tête : regard vers le téléphone, vers l'autre, vers le ciel
      `<g class="mk-${k}-tete">${tete(-66, peau)}<path d="M-5.2 -66.4Q-5.8 -75.6 .4 -75.8Q6.2 -75.4 5 -66.6Q.4 -70.6 -5.2 -66.4Z" fill="${foulard}"/>` +
      `<path d="M-1 -75.4q2.4 -3.2 5.6 -1.4q-2.4 .2 -2.8 2.4z" fill="${foulard}"/></g>` +
      // la main libre : elle parle, puis touche l'écran
      `<g class="mk-${k}-bras"><path d="M-1 -56.6L-1.6 -47L4 -43.6" stroke="${peau}" stroke-width="3.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M-2.4 -57.4h3.4l-.3 5.4h-3.2z" fill="${haut}"/><circle cx="4.4" cy="-43.4" r="1.8" fill="${peau}"/></g>` +
      `</g></g></g>`;
  }

  // ——— le camion de Marché de Gros : cabine vert forêt, liseré maïs, bâche verte au sac, phares ; les roues tournent, la caisse suit ———
  function camion() {
    const roue = x => `<g class="mk-roue"><circle cx="${x}" cy="-7.4" r="7.6" fill="#141210"/><circle cx="${x}" cy="-7.4" r="4.2" fill="#6E6A60"/>` +
      `<path d="M${x - 4.2} -7.4h8.4M${x} -11.6v8.4" stroke="#2A2722" stroke-width="1.3"/><circle cx="${x}" cy="-7.4" r="1.3" fill="#2A2722"/></g>`;
    const pouss = [0, 1, 2].map(i => `<circle class="mk-pf mk-pf${i}" cx="${-48 - i * 2}" cy="-4.4" r="${3.6 + i % 2}" fill="#C9AA78"/>`).join('');
    return `<ellipse cx="0" cy="0" rx="62" ry="3" fill="rgba(0,0,0,.4)"/><g class="mk-poussiere">${pouss}</g>` +
      `<g class="mk-caisse">` +
      `<path class="mk-phare" d="M58 -22.4L118 -34V-8Z" fill="url(#PFX-phare)"/>` +
      `<path d="M-58 -16h104v4h-104z" fill="#1A1611"/><path d="M-61 -21h3v3h-3z" fill="#C2402A"/>` +
      `<path d="M-58 -50Q-57 -58 -48 -58H20Q26 -58 26 -52V-16H-58Z" fill="#1F4D3B"/><path d="M-56 -50Q-55 -56 -48 -56H20" stroke="#2F6B4F" stroke-width="1.2" fill="none"/>` +
      `<path d="M-58 -26H26" stroke="#F2C230" stroke-width="2.2"/>` +
      `<circle cx="-16" cy="-40" r="8" fill="#F3EFE4"/><path d="M-19.4 -43.4h6.8l1.4 8.6h-9.6z" fill="#10392B"/><path d="M-18.6 -43.4q2.6 -2.4 5.2 0" stroke="#F2C230" stroke-width="1.2" fill="none"/>` +
      // le chargement du retour : des sacs à l'arrière
      `<g class="mk-charge"><ellipse cx="-50" cy="-22" rx="6" ry="4" fill="#B99C72"/><ellipse cx="-50" cy="-30" rx="6" ry="4" fill="#A88A5E"/><ellipse cx="-43" cy="-22" rx="5" ry="3.6" fill="#C9AA78"/></g>` +
      `<path d="M26 -46H44Q50 -46 53 -40L58 -29V-16H26Z" fill="#10392B"/><path d="M26 -26H58" stroke="#F2C230" stroke-width="2.2"/>` +
      `<path d="M30 -43H43Q47 -43 49.4 -38.6L52 -33H30Z" fill="#2A4A3F"/><path d="M31 -42.4l9 9" stroke="rgba(243,239,228,.18)" stroke-width="2"/>` +
      `<circle cx="38" cy="-37.6" r="2.6" fill="#1A120C"/><path d="M35.4 -34.6q2.6 -2.2 5.2 0v1.6h-5.2z" fill="#1A120C"/>` +
      `<path d="M55.6 -24.4h3.2v4.6h-3.2z" fill="#FFE08A"/></g>` +
      roue(-40) + roue(40);
  }

  // ——— le décor du marché (gardé : étals, vendeuses, vendeur, ampoules) ———
  const enseigne = (x, y, nom) => `<rect x="${x - 21}" y="${y - 6.4}" width="42" height="9.4" rx="1.6" fill="#2A1D14"/><text x="${x}" y="${y}" text-anchor="middle" ${JOST} font-weight="600" font-size="6.4" letter-spacing=".7" fill="#F3EFE4">${nom}</text>`;
  function etalTerreCuite() {
    return `<g>` +
      `<path d="M14 150V104M128 150V104" stroke="#3B2A1C" stroke-width="2.4"/>` +
      `<path d="M6 102Q71 116 136 102L132 92Q71 103 10 92Z" fill="#B5523B"/><path d="M10 92Q71 103 132 92" stroke="#D07254" stroke-width="1.4" fill="none"/><path d="M6 102Q71 116 136 102" stroke="#8E3C2A" stroke-width="1.2" fill="none"/>` +
      enseigne(80, 101.4, 'ABIDJAN') +
      `<g transform="translate(110 0)"><path d="M-9 132Q-8 116 0 115Q8 116 9 132Z" fill="#2F6B4F"/><path d="M-8 124h16" stroke="#F2C230" stroke-width="1" stroke-dasharray="1.2 2"/>` +
      `<path d="M-1.6 111h3.2v4h-3.2z" fill="${PEAU[0]}"/><ellipse cx="0" cy="107.4" rx="4.3" ry="5" fill="${PEAU[0]}"/><circle cx="2.4" cy="106.4" r=".55" fill="#1A120C"/><path d="M-4.8 107Q-5.2 99.6 0 99.4Q5.4 99.6 4.8 107Q0 103.6 -4.8 107Z" fill="#F2C230"/><path d="M2 99.6q3.6 -2.6 6 .4q-3 -.4 -4.4 2z" fill="#E2A92A"/>` +
      `<path d="M4.4 117.4L10.6 120.4L14.4 120" stroke="${PEAU[0]}" stroke-width="2.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>` +
      `<path d="M8 132H134V150H8Z" fill="#4E3A26"/><path d="M8 138H134M8 144H134" stroke="rgba(20,12,6,.35)" stroke-width="1"/>` +
      [[22, 130], [28, 130], [34, 130], [25, 125.6], [31, 125.6], [28, 121.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.1" fill="#D23B25"/><circle cx="${x - .9}" cy="${y - .9}" r=".9" fill="#F2876B"/>`).join('') +
      [[46, 130], [52, 130], [58, 130], [49, 125.6], [55, 125.6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.1" ry="2.9" fill="#B9709A"/><path d="M${x} ${y - 2.8}v-1.6" stroke="#6B8A4A" stroke-width=".8"/>`).join('') +
      `<path d="M66 131Q68 118 80 116Q90 116 92 131Z" fill="#C9B24A"/><path d="M68 128Q76 120 88 121M70 124Q78 117 86 117" stroke="#9C8A2E" stroke-width="1" fill="none"/><path d="M79 116v-4" stroke="#6B5A2E" stroke-width="2"/>` +
      `<circle class="mk-amp" cx="71" cy="111" r="2.2"/><path d="M71 104v4.6" stroke="#3B2A1C" stroke-width=".8"/>` +
      `</g>`;
  }
  function etalVert() {
    return `<g>` +
      `<path d="M272 150V102M386 150V102" stroke="#3B2A1C" stroke-width="2.4"/>` +
      `<path d="M264 100Q329 113 394 100L390 90Q329 100 268 90Z" fill="#10392B"/><path d="M268 90Q329 100 390 90" stroke="#2F6B4F" stroke-width="1.4" fill="none"/><path d="M264 100Q329 113 394 100" stroke="#F2C230" stroke-width="1.1" fill="none"/>` +
      enseigne(316, 99.6, 'BOUAKÉ') +
      `<g transform="translate(288 0)"><path d="M-7 134L-6 116Q0 113 6.4 116L7 134Z" fill="#E7DCC4"/><path d="M-1.6 108.6h3.2v4h-3.2z" fill="${PEAU[1]}"/><ellipse cx="-.4" cy="105" rx="4.3" ry="5" fill="${PEAU[1]}"/><circle cx="-2.8" cy="104" r=".55" fill="#1A120C"/>` +
      `<path d="M-4.4 103.4Q-3.4 99 1 99.4Q4.4 99.8 4 102.6Q0 101 -4.4 103.4Z" fill="#1A120C"/><g class="mk-geste"><path d="M-4.8 117L-10 123L-14 124" stroke="${PEAU[1]}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>` +
      `<path d="M266 134H392V150H266Z" fill="#4E3A26"/><path d="M266 140H392M266 145H392" stroke="rgba(20,12,6,.35)" stroke-width="1"/>` +
      [[318, '#F2C230', '#D9A81E'], [342, '#F3EFE4', '#D9D2C2'], [366, '#8C3A2A', '#6E2C20']].map(([x, c, c2]) =>
        `<path d="M${x - 10} 134Q${x - 12} 120 ${x - 9} 117H${x + 9}Q${x + 12} 120 ${x + 10} 134Z" fill="#B99C72"/><path d="M${x - 9} 117Q${x} 113 ${x + 9} 117Q${x} 121 ${x - 9} 117Z" fill="${c}"/>` +
        `<path d="M${x - 6} 117.6q3 -1 6 0M${x + 1} 116.4q3 -1 5 .4" stroke="${c2}" stroke-width=".9" fill="none"/><path d="M${x - 10} 120h20" stroke="#9C8058" stroke-width="1.4"/>`).join('') +
      `<circle class="mk-amp" cx="330" cy="110" r="2.2"/><path d="M330 103v4.6" stroke="#3B2A1C" stroke-width=".8"/>` +
      `</g>`;
  }

  // ——— les bulles : textes du propriétaire, mot pour mot ; largeurs mesurées en Jost 600 8,6 ———
  const bulle = (id, cx, lignes, w, queue) => { const h = lignes.length > 1 ? 26 : 17, y = 79 - h;
    return `<g class="mk-bu mk-bu-${id}"><rect x="${n1(cx - w / 2)}" y="${y}" width="${w}" height="${h}" rx="6.5" fill="#F3EFE4"/><path d="M${queue - 3.5} 78.6l3.5 4.6 3.5-4.6z" fill="#F3EFE4"/>` +
      `<text x="${cx}" y="${y + 11.6}" text-anchor="middle" ${JOST} font-weight="600" font-size="8.6" fill="#171512">${lignes.map((l, i) => `<tspan x="${cx}" dy="${i ? 10 : 0}">${l}</tspan>`).join('')}</text></g>`; };
  const BULLES = bulle('a1', 140, ['Tu as trouvé les tomates ?'], 116, 141) +
    bulle('b1', 256, ['Oui ! Je viens de commander', 'sur Marché de Gros.'], 129, 259) +
    bulle('a2', 142, ['Parfait. Moi aussi,', 'je passe ma commande.'], 109, 141);

  function svg(k) {
    const etoiles = [[40, 14, .7], [118, 26, .5], [210, 10, .6], [300, 22, .5], [362, 12, .7], [72, -8, .6], [140, -20, .5], [262, -14, .6], [330, -26, .5], [96, 46, .5], [286, 52, .6], [52, 62, .4], [352, 70, .5], [250, -2, .4], [24, 34, .5]];
    return `<svg class="mk" viewBox="0 0 400 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${k}ciel" gradientUnits="userSpaceOnUse" x1="0" y1="-40" x2="0" y2="150"><stop offset="0" stop-color="#07170F"/><stop offset=".3" stop-color="#0B231A"/><stop offset=".62" stop-color="#173126"/><stop offset=".86" stop-color="#5A3A22"/><stop offset="1" stop-color="#8A5428"/></linearGradient>
    <linearGradient id="${k}sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2B1C"/><stop offset="1" stop-color="#17110B"/></linearGradient>
    <radialGradient id="${k}lum" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD27A" stop-opacity=".5"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>
    <linearGradient id="${k}-phare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE08A" stop-opacity=".42"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></linearGradient>
  </defs>
  <g class="mk-ciel"><rect y="-60" width="400" height="260" fill="url(#${k}ciel)"/>
    <g fill="#F3EFE4" class="mk-et">${[0, 1, 2].map(g => `<g class="mk-et${g}">${etoiles.filter((e, i) => i % 3 === g).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`).join('')}</g></g>
  <g class="mk-sol">
  <!-- au fond : un grand fromager, les hangars du marché, quelques fenêtres allumées, des passants lointains -->
  <path d="M188 120V82M188 92Q170 78 150 82M188 88Q206 70 228 76" stroke="#0E1A13" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <g fill="#0E1A13"><ellipse cx="156" cy="74" rx="20" ry="10"/><ellipse cx="186" cy="66" rx="24" ry="13"/><ellipse cx="222" cy="70" rx="20" ry="10"/><ellipse cx="204" cy="78" rx="16" ry="8"/></g>
  <g fill="#120F0A"><path d="M-6 122V96l40 -12 40 12v26z"/><path d="M226 122V100l34 -10 34 10v22z"/><path d="M330 122V94l38 -11 38 11v28z"/></g>
  <g fill="#FFD27A" fill-opacity=".6"><rect x="10" y="104" width="5" height="4"/><rect x="40" y="104" width="5" height="4"/><rect x="250" y="106" width="5" height="4"/><rect x="350" y="102" width="5" height="4"/><rect x="378" y="102" width="5" height="4"/></g>
  <g fill="#1B1611" opacity=".85">${[[150, 2.2], [166, 2], [214, 2.3], [236, 1.9]].map(([x, s]) => `<g><circle cx="${x}" cy="${130 - s * 9}" r="${s * 1.1}"/><path d="M${x - s * 1.4} ${131 - s * 7.6}h${s * 2.8}l${s * .4} ${s * 7.6}h-${s * 3.6}z"/></g>`).join('')}</g>
  <rect y="146" width="400" height="60" fill="url(#${k}sol)"/>
  <path d="M0 168Q200 160 400 170M0 178Q200 171 400 181" stroke="rgba(243,239,228,.05)" stroke-width="1.2" fill="none"/>
  <ellipse cx="71" cy="140" rx="64" ry="22" fill="url(#${k}lum)"/><ellipse cx="329" cy="140" rx="64" ry="22" fill="url(#${k}lum)"/>
  ${etalTerreCuite()}${etalVert()}
  <g transform="translate(200 152) scale(.78)"><g class="mk-camion">${camion().replace('PFX', k)}</g></g>
  <g transform="translate(138 150) scale(.86)">${femme('fa', PEAU[0], '#B5523B', '#F2C230', '#E9B23A', '#C2402A')}</g>
  <g transform="translate(262 150) scale(-.86 .86)">${femme('fb', PEAU[1], '#2F6B4F', '#F2C230', '#F3EFE4', '#F2C230')}</g>
  <g class="mk-bulles">${BULLES}</g>
  </g>
  <g class="mk-ciel">${carte()}</g>
</svg>`;
  }

  // ——— la chronologie ———
  // la caméra : le premier plan descend de 30, le ciel de 6 (léger effet de profondeur)
  piste('.mk-sol', 'mkCamS', v => tr(0, v), [[0, 0], [8.1, 0, 'io'], [9.5, 30], [15, 30, 'io'], [16.4, 0], [17, 0]], 'will-change:transform');
  piste('.mk-ciel', 'mkCamC', v => tr(0, v), [[0, 0], [8.1, 0, 'io'], [9.5, 6], [15, 6, 'io'], [16.4, 0], [17, 0]]);
  piste('.mk-et', 'mkEtG', op, [[0, 1], [8.6, 1], [9.6, .35], [15.2, .35], [16.4, 1], [17, 1]]);
  piste('.mk-carte', 'mkCarte', op, [[0, 0], [9, 0], [9.9, 1], [15.2, 1], [16.3, 0], [17, 0]]);
  // les routes se tracent, restent allumées, puis s'effacent
  ROUTES.forEach(([id, , , a, b]) => piste(`.mk-r-${id}`, `mkR${id}`, ([o, d]) => `opacity:${o};stroke-dashoffset:${d}`,
    [[0, [1, 1]], [a, [1, 1], 'io'], [b, [1, 0]], [15.2, [1, 0]], [16.3, [0, 0]], [16.32, [0, 1]], [17, [1, 1]]]));
  // les villes : elles s'allument, battent doucement, s'éclairent quand une impulsion arrive, puis s'éteignent
  // (arrivées des impulsions ; à 14 s, la lumière fait le tour de la carte depuis Abidjan)
  const ECLAT = { abj: [12, 14], bke: [11.8, 14.24], yam: [11.4, 12.8, 14.12], dal: [13.2, 14.24], spd: [14.12], kor: [14.36], man: [14.36] };
  Object.keys(V).forEach(id => {
    const t = V[id][7];
    piste(`.mk-v-${id}`, `mkV${id}`, op, [[0, 0], [t - .02, 0, 'o'], [t + .25, 1], [15.4, 1], [16.3, 0], [17, 0]]);
    // l'éclat : un anneau qui s'élargit et s'efface (pas un disque plein)
    const ev = [t, ...ECLAT[id]].sort((a, b) => a - b).filter((e, i, a) => !i || e >= a[i - 1] + .75), pts = [[0, [0, 1]]];
    ev.forEach(e => { pts.push([e - .01, [0, 1], 'l'], [e, [.95, 1], 'o'], [e + .72, [0, 3.4]], [e + .73, [0, 1]]); });
    pts.push([17, [0, 1]]);
    piste(`.mk-vh-${id}`, `mkVh${id}`, ([o, v]) => `opacity:${o};transform:scale(${v})`, pts, 'transform-box:fill-box;transform-origin:center');
  });
  // les impulsions : une tête vive et une traîne, sur le même chemin (tête à la position p du chemin)
  IMP.forEach(([id, , a, b, eclat, , etapes]) => {
    const pts = etapes || [[a, 0, 'io'], [b, 1]], t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    [['iq', .2, .55 * eclat], ['ic', .05, eclat]].forEach(([c, L]) => {
      const p = [[0, [0, L]], [t0 - .02, [0, L]], [t0, [1, L], pts[0][2]]];
      pts.slice(1).forEach(([t, v, e]) => p.push([t, [1, L - v], e]));
      p.push([t1 + .22, [0, L - 1 - L]], [t1 + .24, [0, L]], [17, [0, L]]);
      piste(`.mk-${c}-${id}`, `mk${c}${id}`, ([o, d]) => `opacity:${o};stroke-dashoffset:${+d.toFixed(3)}`, p, `stroke-dasharray:${L} 3`);
    });
    PISTES += `.mk-iq-${id}{stroke-width:${+(3.2 * eclat).toFixed(2)}}.mk-ic-${id}{stroke-width:${+(1.8 * eclat).toFixed(2)}}`;
  });

  // le camion : la même progression que son impulsion (ALLER, RETOUR) ; il sort à droite, revient par la gauche, chargé ;
  // 334 unités = 7 tours de roue exactement (rayon 7,6) : la roue roule sans glisser et retombe sur son angle de départ
  const prog = (f) => [[0, f(0, 0)], ...ALLER.map(([t, p, e]) => [t, f(0, p), e]), [11.801, f(1, 0)], ...RETOUR.map(([t, p, e]) => [t, f(1, p), e]), [17, f(1, 1)]];
  piste('.mk-camion', 'mkCam', v => tr(v, 0), prog((r, p) => r ? -334 + 334 * p : 334 * p));
  piste('.mk-roue', 'mkRoue', rot, prog((r, p) => 2520 * (r + p)).map((x, i, a) => i === a.length - 1 ? [17, 5040] : x).filter(x => x[0] !== 11.801), 'transform-box:fill-box;transform-origin:center');
  piste('.mk-caisse', 'mkCaisse', ([a, y]) => `transform:translateY(${y}px) rotate(${a}deg)`,
    [[0, [0, 0]], [9.7, [0, 0], 'l'], [9.76, [0, .55]], [9.84, [0, 0]], [9.92, [0, .45]], [10, [0, 0], 'o'], [10.25, [-1.4, 0], 's'], [10.8, [0, 0]],
      [13.55, [0, 0], 's'], [13.95, [1.2, 0], 's'], [14.25, [-.4, 0], 's'], [14.55, [0, 0]], [17, [0, 0]]], 'transform-origin:-40px 0px');
  piste('.mk-phare', 'mkPhare', op, [[0, .32], [9.5, .32, 'o'], [9.75, 1], [14.6, 1], [15.3, .32], [17, .32]]);
  piste('.mk-charge', 'mkCharge', op, [[0, 0], [11.9, 0, 'l'], [11.92, 1], [16, 1], [16.6, 0], [17, 0]]);
  [[10.1, 12.85], [10.4, 13.15], [10.7, 13.45]].forEach(([e1, e2], i) => piste(`.mk-pf${i}`, `mkPf${i}`, ([o, x, y, s]) => `opacity:${o};transform:translate(${x}px,${y}px) scale(${s})`,
    [[0, [0, 0, 0, .4]], [e1 - .01, [0, 0, 0, .4], 'l'], [e1, [.5, 0, 0, .5], 'o'], [e1 + .75, [0, -18, -6, 2.3], 'l'], [e1 + .77, [0, 0, 0, .4]], [e2 - .01, [0, 0, 0, .4], 'l'], [e2, [.45, 0, 0, .5], 'o'], [e2 + .75, [0, -18, -6, 2.3], 'l'], [e2 + .77, [0, 0, 0, .4]], [17, [0, 0, 0, .4]]],
    'transform-box:fill-box;transform-origin:center'));

  // les deux femmes : tête (+ vers l'écran, − vers le ciel), main libre (− vers l'avant), buste penché, écran
  const geste = (k, tete, bras, buste, ecran) => {
    piste(`.mk-${k}-tete`, `mk${k}T`, rot, tete, 'transform-origin:0px -61px');
    piste(`.mk-${k}-bras`, `mk${k}B`, rot, bras, 'transform-origin:-1px -56.6px');
    piste(`.mk-${k}-buste`, `mk${k}C`, rot, buste, 'transform-origin:0px -42px');
    piste(`.mk-${k}-ecran`, `mk${k}E`, op, ecran);
  };
  // Femme A (Abidjan) : « Tu as trouvé les tomates ? » … « Parfait. Moi aussi, je passe ma commande. » (elle valide à 7,6 s)
  geste('fa',
    [[0, 12], [.75, 12, 'o'], [1.05, 0], [1.4, -3], [1.8, 1], [2.2, -2], [2.55, 0], [2.85, 12], [3.4, 14], [5.6, 14, 'o'], [5.75, 5], [5.9, 13], [6.05, 6], [6.3, 0], [6.95, 0], [7.25, 13], [8.2, 13], [8.95, -14], [15.3, -14], [16.2, 12], [17, 12]],
    [[0, 0], [.25, 0], [.4, -30], [.5, -26], [.62, -30], [.8, -6], [1.2, -22], [1.6, -8], [2, -20], [2.4, 0], [6.3, 0], [6.55, -20], [6.9, -6], [7.15, -28], [7.5, -31], [7.6, -35], [7.75, -29], [8.1, 0], [17, 0]],
    [[0, 2], [3.2, 2], [3.6, 5], [5.5, 5], [6, 1], [6.9, 1], [7.2, 4], [8, 4], [8.6, -1], [15.3, -1], [16.2, 2], [17, 2]],
    [[0, .55], [.4, .55, 'l'], [.48, 1, 'o'], [.9, .62], [3.05, .62, 'l'], [3.12, 1, 'o'], [3.6, .7], [7.56, .7, 'l'], [7.62, 1, 'o'], [8.3, .5], [15.5, .5], [16.4, .55], [17, .55]]);
  // Femme B (Bouaké) : « Oui ! Je viens de commander sur Marché de Gros. » (petit saut de joie sur « Oui ! »)
  geste('fb',
    [[0, 12], [2.55, 12, 'o'], [2.8, -3], [3.4, 2], [3.8, -3], [4.3, 2], [4.8, -1], [5.4, 0], [5.7, 12], [7.8, 12], [8.3, -4], [9.05, -14], [15.3, -14], [16.2, 12], [17, 12]],
    [[0, 0], [3, 0, 'o'], [3.3, -42], [3.8, -18], [4.3, -36], [4.8, -10], [5.3, 0], [17, 0]],
    [[0, 2], [.55, 2], [.9, 5], [2.5, 5], [2.8, 0], [5.5, 0], [5.9, 4], [7.8, 4], [8.4, -1], [15.3, -1], [16.2, 2], [17, 2]],
    [[0, .5], [.5, .5, 'l'], [.58, 1, 'o'], [1.2, .7], [3.2, .7], [3.3, 1], [3.8, .7], [6, .7, 'l'], [6.08, 1, 'o'], [6.6, .7], [8.3, .5], [15.5, .5], [16.4, .5], [17, .5]]);
  piste('.mk-fb-saut', 'mkfbS', v => tr(0, v), [[0, 0], [2.7, 0, 'o'], [2.86, -1.6, 's'], [3.06, 0], [17, 0]]);
  // les bulles, une à la fois
  [['a1', .5, 3], ['b1', 3, 6], ['a2', 6, 8.4]].forEach(([id, a, b]) => piste(`.mk-bu-${id}`, `mkBu${id}`, ([o, y]) => `opacity:${o};transform:translateY(${y}px)`,
    [[0, [0, 3]], [a, [0, 3], 'o'], [a + .28, [1, 0]], [b - .25, [1, 0], 's'], [b, [0, -2]], [b + .01, [0, 3]], [17, [0, 3]]]));
  // le titre du formulaire (v3/nuage.js) : « de Gros » ↔ « du pays », sur la même horloge ; le reflet suit les lettres
  // un mot sort par le haut, l'autre entre par le bas, presque l'un après l'autre (pas de double exposition), dans la fenêtre du titre
  piste('.mk-ta', 'mkTa', ([o, y, s]) => `opacity:${o};transform:translateY(${y}%) scale(${s})`,
    [[0, [1, 0, 1]], [14.5, [1, 0, 1], 'io'], [14.82, [0, -60, .94]], [16.28, [0, -60, .94], 'o'], [16.7, [1, 0, 1]], [17, [1, 0, 1]]], 'transform-origin:0 70%');
  piste('.mk-tb', 'mkTb', ([o, y, s]) => `opacity:${o};transform:translateY(${y}%) scale(${s})`,
    [[0, [0, 60, .94]], [14.78, [0, 60, .94], 'o'], [15.2, [1, 0, 1]], [16, [1, 0, 1], 'io'], [16.32, [0, 60, .94]], [17, [0, 60, .94]]], 'transform-origin:0 70%');
  piste('.mk-tr', 'mkTr', v => `background-position:${v}% 0`, [[0, 100], [14.85, 100, 'io'], [15.85, 0], [16.6, 0, 'l'], [16.61, 100], [17, 100]]);

  const CSS = `.mk{display:block;width:100%;height:100%}
.mk-amp{fill:#FFE08A;animation:mkAmp 4.25s ease-in-out infinite}
@keyframes mkAmp{0%,100%{opacity:.8}50%{opacity:1}}
/* les étoiles scintillent par groupes (3 animations au lieu de 15) */
.mk-et0{animation:mkEt 4.25s ease-in-out infinite}.mk-et1{animation:mkEt 4.25s ease-in-out -2.125s infinite}.mk-et2{animation:mkEt 8.5s ease-in-out infinite}
@keyframes mkEt{50%{opacity:.3}}
.mk-vp{transform-box:fill-box;transform-origin:center;animation:mkVp 2.125s ease-in-out infinite alternate}
@keyframes mkVp{from{opacity:.75}to{opacity:1;transform:scale(1.18)}}
.mk-resp{animation:mkResp 2.125s ease-in-out infinite alternate}
@keyframes mkResp{to{transform:translateY(-.35px)}}
.mk-geste{transform-box:fill-box;transform-origin:0 0;animation:mkGeste 2.125s ease-in-out infinite alternate}
@keyframes mkGeste{from{rotate:-9deg}to{rotate:7deg}}
.mk-r{stroke-width:.9;stroke-opacity:.62;stroke-dasharray:1 1}.mk-r-ab{stroke-width:1.1;stroke-opacity:.8}
.mk-iq{stroke:#F2C230;stroke-opacity:.24}.mk-ic{stroke:#FFE08A}
.mk-leger .mk-x,.mk-leger .mk-poussiere{display:none}.mk-leger .mk-et>g,.mk-leger .mk-vp,.mk-leger .mk-resp,.mk-leger .mk-amp{animation:none}
.mk-pause,.mk-pause *{animation-play-state:paused!important}
${PISTES}
@media (prefers-reduced-motion:reduce){
  .mk,.mk *{animation-play-state:paused!important;animation-delay:-15.12s!important}
  .mk-ta,.mk-tr{animation:none!important;opacity:1;transform:none}.mk-tb{animation:none!important;opacity:0}
}`;
  function css() { let st = document.getElementById('mkCss'); if (!st) { st = document.createElement('style'); st.id = 'mkCss'; document.head.appendChild(st); } st.textContent = CSS; }

  // ——— la mise en route : pause quand on ne voit pas la scène ; un élément lié (le titre) reste sur la même horloge ———
  function lancer(svgEl) {
    if (!svgEl) return { lier() {}, pause() {}, arreter() {} };
    const nav = navigator;
    if ((nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 2)) svgEl.classList.add('mk-leger');
    const liens = new Set(), raisons = new Set();
    const maitre = () => { const a = svgEl.querySelector('.mk-sol'); return a && a.getAnimations ? a.getAnimations().find(x => x.animationName === 'mkCamS') : null; };
    const poser = () => { const on = raisons.size > 0; svgEl.classList.toggle('mk-pause', on); liens.forEach(el => el.classList.toggle('mk-pause', on)); };
    const pause = (r, oui) => { if (oui) raisons.add(r); else raisons.delete(r); poser(); };
    const vis = () => pause('cache', document.hidden);
    document.addEventListener('visibilitychange', vis); vis();
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => pause('hors', !e.isIntersecting))) : null;
    io && io.observe(svgEl);
    return {
      lier(el) {
        if (!el) return; liens.add(el); poser();
        const m = maitre(); if (!m || !el.getAnimations) return;
        if (m.currentTime == null) { requestAnimationFrame(() => this.lier(el)); return; }
        el.getAnimations({ subtree: true }).forEach(a => { if (/^mk/.test(a.animationName || '')) a.currentTime = m.currentTime; });
      },
      pause,
      arreter() { document.removeEventListener('visibilitychange', vis); io && io.disconnect(); liens.clear(); }
    };
  }

  window.MDGScene = { svg, css, lancer, D };
})();
