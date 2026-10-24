/* ═════════ Marché de Gros CI — les personnages du marché (avatars) ═════════
   Des produits du marché avec un visage, dessinés ici en SVG (aucune image, aucun service, rien à payer) :
   tomate, oignon, igname, banane plantain, ananas, mangue, piment, aubergine, avocat, orange, sac de riz, coco, maïs,
   cabosse de cacao, chou, pastèque, carotte, arachide, patate, poivron, œuf.
   Chacun se compose : couleur, yeux, bouche, joues, chapeau (et sa couleur), lunettes, moustache, objet en main,
   chaussures, fond et motif. Cela fait des dizaines de milliards de combinaisons : deux membres ont très peu de chances
   d'avoir le même. Avec { anime: true }, le personnage respire et cligne des yeux ; il ne saute que s'il y a du nouveau
   (rien ne bouge si le téléphone demande moins d'animations). { saut: true } : un petit saut à l'affichage.
   Code enregistré dans le profil : « mg:b=0;p=0;y=0;m=0;j=1;h=0;hc=0;l=0;s=0;i=0;c=0;f=0;g=0 ».
   API : MDGPerso.svg(o, { size, nom, anime, saut, seed }) · CHOIX (listes nommées) · CLES · hasard() · parse(code) · code(o) */
(function () {
  'use strict';
  if (window.MDGPerso) return;

  // couleurs
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const LIMB = '#3B2C22', BOUCHE = '#3A1A12', OEIL = '#1F1A16';

  // les produits : forme, couleurs, place du visage (fx, fy), haut de la tête (top), côtés (bras), bas (pieds)
  // G = remplissage en dégradé du corps, S = ombre, M = couleur principale, X = 3e couleur, U = identifiant unique
  const CORPS = [
    { id: 'tomate', nom: 'Tomate', pal: [['#E2412F', '#A8261A'], ['#F07A2A', '#C2541A'], ['#8DBF45', '#5E8F2A']], fx: 50, fy: 60, top: 40, cote: [24, 76], bas: 86,
      corps: c => `<ellipse cx="50" cy="63" rx="27" ry="24" fill="${c.G}"/>`,
      haut: () => `<path d="M50 43 41 40l6-2.4-4-6.4 7.2 4.2.2-6.4 3.8 6.2 6.2-4-3.4 6.4 7.4 1.2-8.4 3.6z" fill="#3E8A3A"/><path d="M50 37q1-5 4.4-7.4" stroke="#2F6B2C" stroke-width="2.6" stroke-linecap="round" fill="none"/>` },
    { id: 'oignon', nom: 'Oignon', pal: [['#A8466F', '#6E2347'], ['#D9A441', '#A5701F'], ['#EFE6D2', '#C9B994']], fx: 50, fy: 63, top: 41, cote: [26, 74], bas: 88,
      corps: c => `<path d="M50 32c3 8 22 12 24 30 2 18-10 27-24 27S24 80 26 62c2-18 21-22 24-30z" fill="${c.G}"/><path d="M50 35c-8 12-10 40-4 53m4-53c8 12 10 40 4 53" stroke="${c.S}" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`,
      haut: () => `<path d="M50 33c-1-7-3-11-6-14m6 14c2-7 5-11 8-13" stroke="#6FA83A" stroke-width="2.6" stroke-linecap="round" fill="none"/>` },
    { id: 'igname', nom: 'Igname', pal: [['#9A6A45', '#6B4429'], ['#B8875A', '#82593A'], ['#7E5A44', '#55392A']], fx: 50, fy: 58, top: 37, cote: [29, 71], bas: 88,
      corps: c => `<path d="M38 34c8-6 22-4 27 3 6 9 3 21 6 33 3 13-8 20-21 19-13-1-22-8-20-20 2-11-1-26 8-35z" fill="${c.G}"/><g stroke="${c.S}" stroke-width="1.1" stroke-linecap="round" opacity=".6"><path d="m31 52-3.4-1.2M70 60l3.4-1.2M33 77l-3.4 1.2M69 81l3.2 1.4"/></g><g fill="${c.S}" opacity=".35"><ellipse cx="40" cy="44" rx="1.7" ry="1"/><ellipse cx="62" cy="47" rx="1.5" ry="1"/><ellipse cx="38" cy="81" rx="1.6" ry="1"/><ellipse cx="61" cy="83" rx="1.7" ry="1"/></g>`, haut: () => '' },
    { id: 'plantain', nom: 'Banane plantain', pal: [['#F2C230', '#C9962A'], ['#A9C84A', '#76962E'], ['#E7B43A', '#9C6B26']], fx: 57, fy: 56, top: 30, cote: [42, 72], bas: 88, pieds: 53,
      corps: c => `<path d="M57 27c12 2 18 17 16 33-2 18-14 30-32 30-8 0-12-4-8-8 10-4 12-14 10-26-2-14 2-27 14-29z" fill="${c.G}"/><path d="M61 30c7 14 7 36-3 52" stroke="${c.S}" stroke-opacity=".35" stroke-width="1.4" fill="none"/><circle cx="33" cy="85.4" r="2.3" fill="#4A3A22"/>`,
      haut: () => `<path d="M55 28c0-3 1-5.4 3.2-7l2.2 2.2c-1.6 1.2-2.2 2.8-2.2 4.8z" fill="#5B4A2A"/>` },
    { id: 'ananas', nom: 'Ananas', pal: [['#F2A93B', '#C47A1E'], ['#E9C24A', '#B58F23']], fx: 50, fy: 64, top: 42, cote: [28, 72], bas: 89,
      corps: c => `<ellipse cx="50" cy="65" rx="22" ry="24" fill="${c.G}"/><clipPath id="an${c.U}"><ellipse cx="50" cy="65" rx="22" ry="24"/></clipPath><g clip-path="url(#an${c.U})" stroke="${c.S}" stroke-opacity=".28" stroke-width="1.1"><path d="m20 50 40 40M20 66l30 30M28 40l48 48M40 38l40 40M52 38l28 28M80 50 40 90m40-24L50 96m22-56L24 88m36-50L20 78m28-40L20 66"/></g>`,
      haut: () => `<path d="M50 43 43.5 23l6.5 9 2-14 3 14 7-10-4 21z" fill="#3E8A3A"/><path d="M42 44 31 30l16 8zm16 0 11-13-15 7z" fill="#4E9A3A"/>` },
    { id: 'mangue', nom: 'Mangue', pal: [['#F59E2E', '#D9532B'], ['#E5C03A', '#C08A1F'], ['#8DBF4A', '#5E8F2A']], fx: 51, fy: 60, top: 36, cote: [28, 73], bas: 88,
      corps: c => `<path d="M31 58c-1-16 14-25 28-24 15 2 18 19 14 34s-16 22-28 21c-12-2-14-18-14-31z" fill="${c.G}"/>`,
      haut: () => `<path d="M57 35q1-4.4 3-6.4" stroke="#5B3A1E" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M60 29c6-7 16-6 19-2-6 5-13 5-19 2z" fill="#4E9A3A"/>` },
    { id: 'piment', nom: 'Piment', pal: [['#D9302B', '#9E1D18'], ['#4E9A3A', '#2F6B24'], ['#F2B530', '#C4801E']], fx: 50, fy: 54, top: 35, cote: [33, 67], bas: 86, pieds: 49,
      corps: c => `<path d="M33 42c0-9 34-9 34 0 1 16-4 32-13 42-3 3-6 6-5 10-6-2-6-8-3-13-8-11-14-25-13-39z" fill="${c.G}"/>`,
      haut: () => `<path d="M38 38c4-6 20-6 24 0-4-2-20-2-24 0z" fill="#3E8A3A"/><path d="M50 34c0-6 3-10 8-12" stroke="#3E8A3A" stroke-width="3.2" fill="none" stroke-linecap="round"/>` },
    { id: 'aubergine', nom: 'Aubergine', pal: [['#5B2A6E', '#3A1648'], ['#E9E1EE', '#BFB0C9'], ['#8B4FA0', '#5B2A6E']], fx: 50, fy: 63, top: 39, cote: [30, 70], bas: 88,
      corps: c => `<path d="M50 38c10 0 14 8 16 17 4 16 0 34-16 34s-20-18-16-34c2-9 6-17 16-17z" fill="${c.G}"/>`,
      haut: () => `<path d="M38 45c2-8 22-8 24 0l-4-3-3 5-5-5-5 5-3-5z" fill="#4E8A34"/><path d="M50 38c0-6 2-9 5-11" stroke="#4E8A34" stroke-width="3.2" stroke-linecap="round" fill="none"/>` },
    { id: 'avocat', nom: 'Avocat', pal: [['#4A7A2C', '#2E5419'], ['#6C9A34', '#466E1F'], ['#3B3A24', '#24231A']], fx: 50, fy: 65, top: 40, cote: [29, 71], bas: 89,
      corps: c => `<path d="M50 36c8 0 12 8 13 16 8 8 9 20 5 28s-11 10-18 10-14-2-18-10-3-20 5-28c1-8 5-16 13-16z" fill="${c.G}"/><g fill="#fff" opacity=".12"><circle cx="40" cy="70" r="1"/><circle cx="58" cy="62" r="1"/><circle cx="62" cy="80" r="1"/><circle cx="44" cy="84" r="1"/></g>`,
      haut: () => `<path d="M50 37v-5" stroke="#5B3A1E" stroke-width="2.6" stroke-linecap="round"/>` },
    { id: 'orange', nom: 'Orange', pal: [['#F28C28', '#C8621A'], ['#9CC63B', '#6E9425'], ['#F2D23A', '#C4A51E']], fx: 50, fy: 62, top: 39, cote: [25, 75], bas: 87,
      corps: c => `<circle cx="50" cy="63" r="25" fill="${c.G}"/><g fill="${c.S}" opacity=".28"><circle cx="37" cy="50" r=".9"/><circle cx="62" cy="47" r=".9"/><circle cx="33" cy="70" r=".9"/><circle cx="67" cy="72" r=".9"/><circle cx="44" cy="82" r=".9"/><circle cx="58" cy="84" r=".9"/></g>`,
      haut: () => `<path d="M51 38c4-7 12-8 16-6-4 5-10 7-16 6z" fill="#4E9A3A"/><circle cx="50" cy="38.6" r="1.7" fill="#5B7A2A"/>` },
    { id: 'sac', nom: 'Sac de riz', pal: [['#C9A06A', '#9C7444', '#3E7A3A'], ['#EDE6D6', '#C4B89C', '#C0392B'], ['#D7B98A', '#A88956', '#2E4560']], fx: 50, fy: 62, top: 33, cote: [27, 73], bas: 89,
      corps: c => `<path d="M30 48c0-5 5-7 10-7h20c5 0 10 2 10 7l4 34c0 6-6 8-24 8s-24-2-24-8z" fill="${c.G}"/><rect x="27.4" y="73" width="45.6" height="5" fill="${c.X}" opacity=".85"/><g stroke="${c.S}" stroke-opacity=".22" stroke-width=".8"><path d="M30 52h40M29 58h42M28.6 64h43M28 70h44M27.6 84h45"/></g>`,
      haut: c => `<path d="M40 42c-2-6-4-11-7-14 9 2 25 2 34 0-3 3-5 8-7 14z" fill="${c.M}"/><path d="M38 41.4c8 3 16 3 24 0" stroke="#8A6A3A" stroke-width="2.6" fill="none" stroke-linecap="round"/>` },
    { id: 'coco', nom: 'Noix de coco', pal: [['#7A4E2C', '#4E301A'], ['#7DAE45', '#4F7A27']], fx: 50, fy: 63, top: 39, cote: [25, 75], bas: 88,
      corps: c => `<circle cx="50" cy="63" r="25" fill="${c.G}"/><g stroke="${c.S}" stroke-opacity=".45" stroke-width="1" fill="none" stroke-linecap="round"><path d="M33 47c4 2 6 1 8-1m17-2c3 3 6 3 9 1M29 67c3 2 6 2 8 0m27 8c3 1 5 0 7-2M44 83c3 1 6 1 8-1"/></g>`,
      haut: c => `<g fill="${c.S}" opacity=".75"><circle cx="46" cy="42.6" r="1.7"/><circle cx="54" cy="42.6" r="1.7"/></g>` },
    { id: 'mais', nom: 'Maïs', pal: [['#F2C230', '#C9962A'], ['#F5E3A0', '#D1B967'], ['#E8792E', '#B5521C']], fx: 50, fy: 56, top: 31, cote: [33, 67], bas: 88,
      corps: c => { let g = ''; for (let y = 34, r = 0; y < 86; y += 5, r++) for (let x = 38 + (r % 2 ? 2.5 : 0); x < 63; x += 5) g += `<circle cx="${x}" cy="${y}" r="1.8"/>`;
        return `<path d="M50 28c11 0 16 14 16 30 0 17-6 30-16 30s-16-13-16-30 5-30 16-30z" fill="${c.G}"/><clipPath id="mk${c.U}"><path d="M50 28c11 0 16 14 16 30 0 17-6 30-16 30s-16-13-16-30 5-30 16-30z"/></clipPath><g clip-path="url(#mk${c.U})" fill="${c.S}" opacity=".25">${g}</g><path d="M34 60c-4 14 2 28 14 32-6-8-10-18-10-30zm32 0c4 14-2 28-14 32 6-8 10-18 10-30z" fill="#6FA83A"/>`; },
      haut: () => `<path d="M50 28c-2-6-6-9-10-10m10 10c2-6 6-9 10-10M50 28V18" stroke="#C99A4A" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
    { id: 'cacao', nom: 'Cabosse de cacao', pal: [['#E38A2C', '#A85A17'], ['#D9B23A', '#A5821E'], ['#A33B2A', '#6E2218']], fx: 50, fy: 60, top: 33, cote: [30, 70], bas: 89,
      corps: c => `<path d="M50 32c14 0 20 14 20 28 0 16-8 29-20 29S30 76 30 60s6-28 20-28z" fill="${c.G}"/><path d="M41 34c-5 14-5 40 1 53m17-53c5 14 5 40-1 53" stroke="${c.S}" stroke-opacity=".35" stroke-width="1.4" fill="none"/>`,
      haut: () => `<path d="M50 33v-6" stroke="#5B3A1E" stroke-width="3.2" stroke-linecap="round"/>` },
    { id: 'chou', nom: 'Chou', pal: [['#8CC152', '#5E8F2A'], ['#7B3B7A', '#4E1E4E']], fx: 50, fy: 63, top: 40, cote: [24, 76], bas: 88,
      corps: c => `<circle cx="50" cy="64" r="26" fill="${c.G}"/><path d="M26 60c4-16 16-22 24-22-10 8-14 18-12 32-6 0-10-4-12-10zm48 0c-4-16-16-22-24-22 10 8 14 18 12 32 6 0 10-4 12-10z" fill="${c.L}" opacity=".45"/><path d="M50 40c-4 12-4 32 0 49M36 50c4 8 6 16 6 26m22-26c-4 8-6 16-6 26" stroke="#fff" stroke-opacity=".3" stroke-width="1.2" fill="none"/>`, haut: () => '' },
    { id: 'pasteque', nom: 'Pastèque', pal: [['#4E9A3A', '#2A5E22'], ['#6FAE45', '#3B6E25']], fx: 50, fy: 63, top: 39, cote: [24, 76], bas: 88,
      corps: c => `<circle cx="50" cy="64" r="26" fill="${c.G}"/><g fill="none" stroke="${c.S}" stroke-width="3.4" stroke-linecap="round" opacity=".7"><path d="M50 39c-6 14-6 36 0 50M38 42c-8 13-8 31-1 43m25-43c8 13 8 31 1 43"/></g>`,
      haut: () => `<path d="M50 39c0-4 2-6 4-7" stroke="#5B7A2A" stroke-width="2.2" stroke-linecap="round" fill="none"/>` },
    { id: 'carotte', nom: 'Carotte', pal: [['#F07A2A', '#C2541A'], ['#E8B43A', '#B5821E'], ['#9C3B5A', '#6A2238']], fx: 50, fy: 50, top: 35, cote: [35, 65], bas: 88,
      corps: c => `<path d="M34 38c4-5 28-5 32 0 1 18-7 36-16 54-9-18-17-36-16-54z" fill="${c.G}"/><path d="M38 66h6m13 8h5m-17 6h4" stroke="${c.S}" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/>`,
      haut: () => `<g fill="#4E9A3A"><path d="M50 35c-6-9-10-15-8-19 6 4 8 12 8 19z"/><path d="M50 35c2-11 6-17 10-18 0 7-5 13-10 18z"/><path d="M50 35c-3-7-4-13 0-21 3 8 2 14 0 21z"/></g>` },
    { id: 'arachide', nom: 'Arachide', pal: [['#D9B27A', '#A88553'], ['#C99A5C', '#94693A']], fx: 50, fy: 51, top: 34, cote: [31, 69], bas: 91,
      corps: c => `<g fill="${c.G}"><circle cx="50" cy="50" r="17"/><circle cx="50" cy="75" r="18"/><rect x="37" y="54" width="26" height="18"/></g><g stroke="${c.S}" stroke-opacity=".25" stroke-width=".9" fill="none"><path d="M36 44h28M34 52h32M33 78h34M35 86h30M42 34v56M58 34v56"/></g>`, haut: () => '' },
    { id: 'patate', nom: 'Patate', pal: [['#C9A26A', '#97733F'], ['#B4553A', '#7E3322']], fx: 50, fy: 62, top: 40, cote: [27, 73], bas: 88,
      corps: c => `<path d="M30 52c2-12 16-14 26-12 14 2 19 14 17 26-2 14-11 23-25 23S26 80 27 68c0-8 2-12 3-16z" fill="${c.G}"/><g fill="${c.S}" opacity=".4"><circle cx="38" cy="47" r="1.2"/><circle cx="64" cy="52" r="1.1"/><circle cx="34" cy="76" r="1.2"/><circle cx="64" cy="80" r="1.2"/></g>`, haut: () => '' },
    { id: 'poivron', nom: 'Poivron', pal: [['#D9302B', '#9E1D18'], ['#4E9A3A', '#2F6B24'], ['#F2B530', '#C4801E']], fx: 50, fy: 62, top: 40, cote: [29, 71], bas: 88,
      corps: c => `<path d="M30 48c0-10 10-12 20-7 10-5 20-3 20 7 2 18-4 38-16 40h-8c-12-2-18-22-16-40z" fill="${c.G}"/><path d="M44 42c-3 14-3 32 1 46m11-46c3 14 3 32-1 46" stroke="${c.S}" stroke-opacity=".35" stroke-width="1.4" fill="none"/>`,
      haut: () => `<path d="M44 42c2-4 10-4 12 0z" fill="#3E7A30"/><path d="M50 41c0-7 2-10 6-12" stroke="#3E7A30" stroke-width="3.4" stroke-linecap="round" fill="none"/>` },
    { id: 'oeuf', nom: 'Œuf', pal: [['#F3EBDD', '#CDBFA6'], ['#D9A877', '#A8784A']], fx: 50, fy: 63, top: 36, cote: [29, 71], bas: 88,
      corps: c => `<path d="M50 33c12 0 21 17 21 33 0 14-9 23-21 23s-21-9-21-23c0-16 9-33 21-33z" fill="${c.G}"/>`, haut: () => '' }
  ];

  // le visage
  const YEUX = [
    { nom: 'Ronds', d: (x, y) => `<circle cx="${x}" cy="${y}" r="3.1" fill="${OEIL}"/><circle cx="${x + 1}" cy="${y - 1.1}" r="1" fill="#fff"/>` },
    { nom: 'Joyeux', d: (x, y) => `<path d="M${x - 3.6} ${y + 1.2}q3.6-5 7.2 0" stroke="${OEIL}" stroke-width="2" stroke-linecap="round" fill="none"/>`, ferme: true },
    { nom: 'Clin d’œil', d: (x, y, d) => d ? `<path d="M${x - 3.6} ${y}h7.2" stroke="${OEIL}" stroke-width="2" stroke-linecap="round"/>` : `<circle cx="${x}" cy="${y}" r="3.1" fill="${OEIL}"/><circle cx="${x + 1}" cy="${y - 1.1}" r="1" fill="#fff"/>` },
    { nom: 'Grands', d: (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff"/><circle cx="${x + .4}" cy="${y + .4}" r="3.2" fill="${OEIL}"/><circle cx="${x + 1.5}" cy="${y - .8}" r="1.1" fill="#fff"/>` },
    { nom: 'Endormis', d: (x, y) => `<path d="M${x - 3.6} ${y}q3.6 3.4 7.2 0" stroke="${OEIL}" stroke-width="2" stroke-linecap="round" fill="none"/>`, ferme: true },
    { nom: 'Étonnés', d: (x, y) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#fff"/><circle cx="${x}" cy="${y}" r="1.8" fill="${OEIL}"/>` },
    { nom: 'Étoiles', d: (x, y) => `<path d="m${x} ${y - 4.6} 1.4 3.1 3.3.4-2.5 2.2.7 3.3L${x} ${y + 2.8}l-2.9 1.7.7-3.3-2.5-2.2 3.3-.4z" fill="#F2C230" stroke="${OEIL}" stroke-width=".6"/>`, ferme: true },
    { nom: 'Malins', d: (x, y) => `<circle cx="${x}" cy="${y}" r="4.4" fill="#fff"/><circle cx="${x + 1.8}" cy="${y + .3}" r="2.2" fill="${OEIL}"/><path d="M${x - 4.6} ${y - 3.4}q4.6-2 9.2 0" stroke="${OEIL}" stroke-width="1.4" stroke-linecap="round" fill="none"/>` },
    { nom: 'Cœurs', d: (x, y) => `<path d="M${x} ${y + 3.6}c-5-3.4-5.4-6.8-3.6-8 1.4-1 3-.4 3.6 1 .6-1.4 2.2-2 3.6-1 1.8 1.2 1.4 4.6-3.6 8z" fill="#E2412F"/>`, ferme: true },
    { nom: 'Sérieux', d: (x, y) => `<circle cx="${x}" cy="${y + .6}" r="2.6" fill="${OEIL}"/><path d="M${x - 3.8} ${y - 3.6}l7.6 1.4" stroke="${OEIL}" stroke-width="1.6" stroke-linecap="round"/>` }
  ];
  const BOUCHES = [
    { nom: 'Sourire', d: (x, y) => `<path d="M${x - 6} ${y}q6 6.4 12 0" stroke="${BOUCHE}" stroke-width="2" stroke-linecap="round" fill="none"/>` },
    { nom: 'Grand rire', d: (x, y) => `<path d="M${x - 7} ${y - 1}q7 11 14 0z" fill="${BOUCHE}"/><path d="M${x - 3.6} ${y + 3.6}q3.6-2.6 7.2 0q-3.6 2.4-7.2 0z" fill="#E2735B"/>` },
    { nom: 'Oh !', d: (x, y) => `<ellipse cx="${x}" cy="${y + 1.4}" rx="2.6" ry="3.2" fill="${BOUCHE}"/>` },
    { nom: 'En coin', d: (x, y) => `<path d="M${x - 5} ${y + 1}q6 3.6 11-2" stroke="${BOUCHE}" stroke-width="2" stroke-linecap="round" fill="none"/>` },
    { nom: 'Langue', d: (x, y) => `<path d="M${x - 6} ${y}q6 6 12 0" stroke="${BOUCHE}" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M${x + .4} ${y + 2.6}q.4 4.4 3.6 4.2 2.8-.4 2-4.6" fill="#E2735B" stroke="${BOUCHE}" stroke-width=".8"/>` },
    { nom: 'Dents', d: (x, y) => `<path d="M${x - 7} ${y - 1}q7 10 14 0z" fill="${BOUCHE}"/><path d="M${x - 6} ${y - .6}h12q-.6 2-1.4 2.6h-9.2q-.8-.6-1.4-2.6z" fill="#fff"/>` },
    { nom: 'Sifflote', d: (x, y) => `<circle cx="${x - 2}" cy="${y + 1}" r="2" fill="none" stroke="${BOUCHE}" stroke-width="1.6"/><path d="M${x + 6} ${y - 6}v5.4" stroke="${BOUCHE}" stroke-width="1" /><circle cx="${x + 5}" cy="${y - .6}" r="1.4" fill="${BOUCHE}"/>` },
    { nom: 'Chat', d: (x, y) => `<path d="M${x - 5.4} ${y}q2.7 3.6 5.4 0 2.7 3.6 5.4 0" stroke="${BOUCHE}" stroke-width="1.8" stroke-linecap="round" fill="none"/>` },
    { nom: 'Waouh', d: (x, y) => `<ellipse cx="${x}" cy="${y + 2}" rx="4.4" ry="5" fill="${BOUCHE}"/><ellipse cx="${x}" cy="${y + 4.6}" rx="2.6" ry="1.6" fill="#E2735B"/>` }
  ];
  // la tête : chapeaux (dessinés autour de (0,0), bas du chapeau en y = 0)
  const COUL = ['#E2412F', '#F2C230', '#2E6B4A', '#2E4560', '#8E3B5B', '#F07A2A', '#F5F0E6', '#1F1A16'];
  const CHAPEAUX = [
    { nom: 'Rien', d: () => '' },
    { nom: 'Paille', d: k => `<ellipse cx="0" cy="-1" rx="20" ry="4.6" fill="#E2B65C"/><path d="M-11-2c0-12 22-12 22 0z" fill="#E9C46A"/><rect x="-11" y="-5.4" width="22" height="3.2" fill="${k}"/><path d="M-17-1h34" stroke="#C99A4A" stroke-width=".6" opacity=".6"/>` },
    { nom: 'Foulard', d: (k, f) => `<path d="M-15 1c-1-13 8-19 16-18 9 1 15 7 14 18-7-4-23-4-30 0z" fill="${k}"/><path d="M8-15c6-7 14-3 10 3-2 3-6 1-10-3z" fill="${k}"/><path d="M8-15c6-7 14-3 10 3-2 3-6 1-10-3z" fill="${f}" opacity=".25"/><g fill="#fff" opacity=".55"><circle cx="-8" cy="-7" r="1.3"/><circle cx="-1" cy="-11" r="1.3"/><circle cx="6" cy="-7" r="1.3"/><circle cx="-3" cy="-4" r="1"/><circle cx="3" cy="-3.4" r="1"/></g>` },
    { nom: 'Casquette', d: (k, f) => `<path d="M-13 0c0-13 26-13 26 0z" fill="${k}"/><path d="M8-1c6-1 13 1 14 3-6 1-12 0-16-1z" fill="${f}"/><circle cx="0" cy="-12" r="1.4" fill="${f}"/>` },
    { nom: 'Bob', d: (k, f) => `<path d="M-12-2c0-12 24-12 24 0z" fill="${k}"/><path d="M-17 1c3-5 31-5 34 0-7-1-27-1-34 0z" fill="${f}"/>` },
    { nom: 'Couronne', d: () => `<path d="M-12 0-13-12l7 6 6-9 6 9 7-6-1 12z" fill="#F2C230" stroke="#C9962A" stroke-width="1" stroke-linejoin="round"/><circle cx="0" cy="-5" r="1.7" fill="#C0392B"/><circle cx="-7" cy="-3" r="1.1" fill="#3E8A3A"/><circle cx="7" cy="-3" r="1.1" fill="#2E4560"/>` },
    { nom: 'Bonnet', d: (k, f) => `<path d="M-13 0c0-16 26-16 26 0z" fill="${k}"/><rect x="-14" y="-4" width="28" height="5" rx="2.5" fill="${f}"/><circle cx="0" cy="-16" r="3.4" fill="#F5F0E6"/>` },
    { nom: 'Bandeau', front: true, d: (k, f) => `<rect x="-17" y="-2.6" width="34" height="5.2" rx="2.6" fill="${k}"/><path d="m15-1 7-3-1 6z" fill="${f}"/>` },
    { nom: 'Panier sur la tête', d: k => `<ellipse cx="0" cy="0" rx="9" ry="2.2" fill="${k}"/><path d="m-14-1 3-10h22l3 10z" fill="#C9963E"/><path d="M-12.6-4.6h25.2M-11.6-7.8h23.2" stroke="#8A6A2A" stroke-width="1"/><circle cx="-6" cy="-13" r="3.6" fill="#E2412F"/><circle cx="1" cy="-14" r="3.8" fill="#F07A2A"/><circle cx="7.4" cy="-12.4" r="3.4" fill="#E2412F"/><path d="m1-17.6 1.6-2" stroke="#3E8A3A" stroke-width="1.2"/>` },
    { nom: 'Toque', d: () => `<rect x="-9" y="-8" width="18" height="8" fill="#FFFDF8" stroke="#D8D0C0" stroke-width=".6"/><path d="M-11-8c-4-4-1-12 5-10 2-6 10-6 12 0 6-2 9 6 5 10z" fill="#FFFDF8" stroke="#D8D0C0" stroke-width=".6"/>` },
    { nom: 'Écouteurs', ecoute: true, d: () => '' },
    { nom: 'Calotte', d: k => `<path d="M-10 0c0-9 20-9 20 0z" fill="${k}"/><g fill="#fff" opacity=".6"><circle cx="-5" cy="-3" r=".9"/><circle cx="0" cy="-4.4" r=".9"/><circle cx="5" cy="-3" r=".9"/></g>` }
  ];
  const LUNETTES = [
    { nom: 'Rien', d: () => '' },
    { nom: 'Rondes', d: (x, y) => `<g fill="#fff" fill-opacity=".14" stroke="${OEIL}" stroke-width="1.4"><circle cx="${x - 8}" cy="${y}" r="5.2"/><circle cx="${x + 8}" cy="${y}" r="5.2"/></g><path d="M${x - 2.8} ${y}h5.6" stroke="${OEIL}" stroke-width="1.4"/>` },
    { nom: 'Soleil', d: (x, y) => `<g fill="${OEIL}"><rect x="${x - 14}" y="${y - 4}" width="11" height="7.6" rx="3"/><rect x="${x + 3}" y="${y - 4}" width="11" height="7.6" rx="3"/></g><path d="M${x - 3} ${y - 1.4}h6" stroke="${OEIL}" stroke-width="1.6"/><path d="M${x - 12} ${y - 2.4}l3 0M${x + 5} ${y - 2.4}l3 0" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>` },
    { nom: 'Carrées', d: (x, y) => `<g fill="#fff" fill-opacity=".12" stroke="#F2C230" stroke-width="1.8"><rect x="${x - 13.4}" y="${y - 4.6}" width="10.4" height="9" rx="2"/><rect x="${x + 3}" y="${y - 4.6}" width="10.4" height="9" rx="2"/></g><path d="M${x - 3} ${y - 1}h6" stroke="#F2C230" stroke-width="1.8"/>` },
    { nom: 'Monocle', d: (x, y) => `<circle cx="${x + 8}" cy="${y}" r="5.4" fill="#fff" fill-opacity=".14" stroke="#C9962A" stroke-width="1.5"/><path d="M${x + 13} ${y + 2}q4 8 1 16" stroke="#C9962A" stroke-width=".8" fill="none"/>` }
  ];
  const POILS = [
    { nom: 'Rien', d: () => '' },
    { nom: 'Moustache', d: (x, y) => `<path d="M${x - 7} ${y + 1}c2-3 6-3 7-1 1-2 5-2 7 1-3-1-5 0-7 0s-4-1-7 0z" fill="#2B1D14"/>` },
    { nom: 'Guidon', d: (x, y) => `<path d="M${x} ${y - .4}c-2-2-7-2-9 1-1 2-3 2-4 0 0 4 4 5 7 3 3-1 5-2 6-2 1 0 3 1 6 2 3 2 7 1 7-3-1 2-3 2-4 0-2-3-7-3-9-1z" fill="#2B1D14"/>` },
    { nom: 'Barbichette', d: (x, y) => `<path d="M${x - 3} ${y + 10}h6l-3 6z" fill="#2B1D14"/>` }
  ];
  // dans la main (dessiné autour de (0,0))
  const OBJETS = [
    { nom: 'Rien', d: () => '' },
    { nom: 'Téléphone', d: () => `<rect x="-4" y="-7" width="8" height="14" rx="1.8" fill="#222"/><rect x="-3" y="-5.4" width="6" height="9.6" rx=".8" fill="#6CC58C"/>` },
    { nom: 'Calculatrice', d: () => `<rect x="-5" y="-7" width="10" height="14" rx="1.6" fill="#E8E2D6" stroke="#6B6252" stroke-width=".8"/><rect x="-3.6" y="-5.6" width="7.2" height="3.4" fill="#9BC48A"/><g fill="#6B6252"><circle cx="-2.4" cy="0" r=".8"/><circle cx="0" cy="0" r=".8"/><circle cx="2.4" cy="0" r=".8"/><circle cx="-2.4" cy="2.6" r=".8"/><circle cx="0" cy="2.6" r=".8"/><circle cx="2.4" cy="2.6" r=".8" fill="#E07A3F"/></g>` },
    { nom: 'Panier', d: () => `<circle cx="-3" cy="-3" r="3" fill="#E2412F"/><circle cx="3" cy="-3.4" r="3" fill="#F07A2A"/><path d="M-7-1h14l-2 8h-10z" fill="#C9963E"/><path d="M-6-1a6 6 0 0 1 12 0" stroke="#8A6A2A" stroke-width="1.4" fill="none"/><path d="M-6 2h12M-5.4 4.6h10.8" stroke="#8A6A2A" stroke-width=".7"/>` },
    { nom: 'Mégaphone', d: () => `<path d="M-5-2 5-7.4V7.4L-5 2z" fill="#F2C230"/><rect x="-8.4" y="-2.6" width="4" height="5.2" rx="1" fill="#C0392B"/><path d="M8-4q2 4 0 8M10.6-6q3.4 6 0 12" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".8"/>` },
    { nom: 'Carnet', d: () => `<rect x="-5" y="-7" width="10" height="13" rx="1" fill="#FFFDF8" stroke="#6B6252" stroke-width=".8"/><path d="M-3-3h6m-6 2.6h6m-6 2.6h4" stroke="#9AA0A6" stroke-width=".7"/><path d="m4 5 5-11" stroke="#F2C230" stroke-width="1.8" stroke-linecap="round"/>` },
    { nom: 'Balance', d: () => `<path d="M0-9v4" stroke="#555" stroke-width="1"/><circle cx="0" cy="0" r="5" fill="#E8E2D6" stroke="#555" stroke-width="1"/><path d="m0 0 2.2-3" stroke="#C0392B" stroke-width="1"/><path d="M0 5v3.4" stroke="#555" stroke-width=".9"/><path d="M-6 8.4h12l-2 3h-8z" fill="#9AA0A6"/>` },
    { nom: 'Petit sac', d: () => `<path d="M-5-3c0-2 2-3 3-3h4c1 0 3 1 3 3l1 9c0 2-2 2-6 2s-6 0-6-2z" fill="#C9A06A"/><path d="M-3-5.6c2 1 4 1 6 0" stroke="#8A6A3A" stroke-width="1.2" fill="none"/><rect x="-5.4" y="1.4" width="10.8" height="1.8" fill="#3E7A3A" opacity=".8"/>` },
    { nom: 'Parasol', d: () => `<path d="M0-1v13" stroke="#5B3A1E" stroke-width="1.2"/><path d="M-11 0a11 9 0 0 1 22 0z" fill="#E2412F"/><path d="M-3.7 0a3.7 9 0 0 1 7.4 0z" fill="#F5F0E6"/><path d="M-11 0a2 2 0 0 0 4 0 2 2 0 0 0 4 0" fill="none"/>` },
    { nom: 'Pouce levé', d: (l) => `<circle cx="0" cy="0" r="3.6" fill="${l}"/><rect x="-1.3" y="-8.4" width="2.8" height="7" rx="1.4" fill="${l}"/>` }
  ];
  const SOULIERS = ['#3B2C22', '#C0392B', '#F5F0E6', '#F2C230'];
  const FONDS = ['#10392B', '#2E6B4A', '#8C3F22', '#B8882A', '#2E4560', '#5B2A35', '#F2C230', '#6CC58C', '#E07A3F', '#3D5A80', '#D9CBB0', '#2B2620'];
  const MOTIFS = [
    { nom: 'Uni', d: () => '' },
    { nom: 'Étal', d: () => { let s = ''; for (let i = 0; i < 8; i++) s += `<rect x="${i * 12.5}" y="0" width="6.25" height="18" fill="#fff" opacity=".2"/><circle cx="${i * 12.5 + 3.1}" cy="18" r="3.1" fill="#fff" opacity=".2"/>`; return s; } },
    { nom: 'Pois', d: () => { let s = ''; for (let y = 6, r = 0; y < 100; y += 10, r++) for (let x = r % 2 ? 11 : 6; x < 100; x += 10) s += `<circle cx="${x}" cy="${y}" r="1.6"/>`; return `<g fill="#fff" opacity=".14">${s}</g>`; } },
    { nom: 'Wax', d: () => `<g fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2.4">${[[12, 18], [88, 26], [14, 84], [86, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/><circle cx="${x}" cy="${y}" r="11"/>`).join('')}</g>` },
    { nom: 'Kente', d: () => `<g opacity=".2"><rect x="0" y="8" width="100" height="7" fill="#F2C230"/><rect x="0" y="16" width="100" height="3" fill="#E2412F"/><path d="M0 26l5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4" stroke="#fff" stroke-width="1.6" fill="none"/></g>` },
    { nom: 'Soleil', d: () => { let s = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, b = a + .14; s += `<path d="M50 62L${(50 + 80 * Math.cos(a)).toFixed(1)} ${(62 + 80 * Math.sin(a)).toFixed(1)}L${(50 + 80 * Math.cos(b)).toFixed(1)} ${(62 + 80 * Math.sin(b)).toFixed(1)}z"/>`; } return `<g fill="#fff" opacity=".1">${s}</g>`; } }
  ];

  // le code
  const CLES = { b: CORPS, y: YEUX, m: BOUCHES, h: CHAPEAUX, hc: COUL, l: LUNETTES, s: POILS, i: OBJETS, c: SOULIERS, f: FONDS, g: MOTIFS };
  const ORDRE = ['b', 'p', 'y', 'm', 'j', 'h', 'hc', 'l', 's', 'i', 'c', 'f', 'g'];
  const n = (v, L) => ((+v || 0) % L + L) % L;
  function normal(o) {
    const r = {}; ORDRE.forEach(k => { r[k] = Math.max(0, Math.floor(+o[k] || 0)); });
    r.b = n(r.b, CORPS.length); r.p = n(r.p, CORPS[r.b].pal.length); r.j = r.j ? 1 : 0;
    Object.keys(CLES).forEach(k => { if (k !== 'b') r[k] = n(r[k], CLES[k].length); });
    return r;
  }
  const parse = s => { const o = {}; String(s || '').replace(/^mg:/, '').split(';').forEach(kv => { const [k, v] = kv.split('='); if (ORDRE.includes(k)) o[k] = +v; }); return normal(o); };
  const code = o => { const r = normal(o); return 'mg:' + ORDRE.map(k => k + '=' + r[k]).join(';'); };
  // au hasard : quelques réglages plus fréquents pour garder des personnages lisibles
  const rnd = k => Math.floor(Math.random() * k);
  function hasard(garde) {
    const o = { b: rnd(CORPS.length), y: rnd(YEUX.length), m: rnd(BOUCHES.length), j: Math.random() < .6 ? 1 : 0,
      h: Math.random() < .25 ? 0 : rnd(CHAPEAUX.length), hc: rnd(COUL.length), l: Math.random() < .6 ? 0 : rnd(LUNETTES.length),
      s: Math.random() < .7 ? 0 : rnd(POILS.length), i: Math.random() < .3 ? 0 : rnd(OBJETS.length), c: rnd(SOULIERS.length), f: rnd(FONDS.length), g: rnd(MOTIFS.length) };
    o.p = rnd(CORPS[o.b].pal.length);
    return normal(Object.assign(o, garde || {}));
  }

  // le dessin
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = s => { let h = 7; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  let uid = 0;
  // au repos : il respire et cligne des yeux, rien de plus. Il saute seulement quand il se passe quelque chose
  // (classe « mg-saute » posée sur un parent par MDGPerso.saute(), ou { saut: true } à l'affichage).
  const ANIM = `<style>.mga{transform-box:view-box;transform-origin:50px 94px;animation:mgVie 4.8s ease-in-out infinite}
.mge{transform-box:fill-box;transform-origin:center;animation:mgCligne 5.2s infinite}
.mgb{transform-box:view-box}.mgo{transform-box:view-box;transform-origin:50px 95px}
.mgs,.mg-saute .mga{transform-box:view-box;transform-origin:50px 94px;animation:mgHop .8s cubic-bezier(.3,1.5,.5,1) 1,mgVie 4.8s .8s ease-in-out infinite}
.mg-saute .mgb,.mgs .mgb{animation:mgBras .3s ease-in-out 4 alternate}.mg-saute .mgo{animation:mgOmbre .8s 1}
@keyframes mgVie{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,.985)}}
@keyframes mgOmbre{0%,100%{transform:scale(1);opacity:.2}45%{transform:scale(.6);opacity:.1}}
@keyframes mgCligne{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes mgBras{from{transform:rotate(0)}to{transform:rotate(22deg)}}
@keyframes mgHop{0%{transform:translateY(0) scale(1.08,.9)}45%{transform:translateY(-14px) scale(.94,1.07)}80%{transform:translateY(0) scale(1.05,.94)}100%{transform:translateY(0) scale(1)}}
@media (prefers-reduced-motion:reduce){.mga,.mgo,.mge,.mgb,.mgs,.mg-saute .mga,.mg-saute .mgb,.mg-saute .mgo{animation:none!important}}</style>`;

  function svg(o0, opt = {}) {
    const o = normal(o0 || {}), C = CORPS[o.b], [M, S, X] = C.pal[o.p], size = opt.size || 40, id = opt.fixe ? 'u' : ++uid,   // fixe : image autonome (data:), le même dessin donne la même adresse
      an = !!opt.anime;
    const label = esc(opt.nom || C.nom), L = mix(M, '#ffffff', .38);
    const c = { M, S, X: X || S, L, U: id, G: `url(#pg${id})` };
    const fx = C.fx, fy = C.fy, px = C.pieds || 50, bas = C.bas, k = COUL[o.hc], kf = mix(k, '#000000', .28);
    const del = an ? ` style="animation-delay:-${(hash(opt.seed || code(o)) % 60) / 10}s"` : '';
    // pieds et ombre
    const pieds = `<path d="M${px - 8} ${bas - 3}v6m16-6v6" stroke="${LIMB}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="${px - 10}" cy="${bas + 4}" rx="5.4" ry="2.8" fill="${SOULIERS[o.c]}" stroke="${LIMB}" stroke-width=".8"/><ellipse cx="${px + 10}" cy="${bas + 4}" rx="5.4" ry="2.8" fill="${SOULIERS[o.c]}" stroke="${LIMB}" stroke-width=".8"/>`;
    // bras : le gauche salue, le droit tient l'objet (ou pend)
    const [cg, cd] = C.cote, obj = OBJETS[o.i], tient = o.i > 0, ox = Math.min(cd + 7, 76);   // l'objet reste dans le cercle
    // les bras partent de l'intérieur du corps et sont dessinés derrière lui : ils restent attachés
    const eg = cg + 6, ed = cd - 6;
    const brasG = `<g class="${an ? 'mgb' : ''}" style="transform-origin:${eg}px 64px"><path d="M${eg} 64Q${cg - 3} 66 ${cg - 7} 74" stroke="${LIMB}" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="${cg - 7}" cy="74.4" r="2.5" fill="${LIMB}"/></g>`;
    const brasD = tient ? `<path d="M${ed} 64Q${ox - 2} 64 ${ox} 56" stroke="${LIMB}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
      : `<path d="M${ed} 64Q${cd + 3} 66 ${cd + 7} 74" stroke="${LIMB}" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="${cd + 7}" cy="74.4" r="2.5" fill="${LIMB}"/>`;
    const main = tient ? `<g transform="translate(${ox} 51) scale(1.3)">${obj.d(LIMB)}</g>${o.i === 9 ? '' : `<circle cx="${ox}" cy="56.4" r="2.5" fill="${LIMB}"/>`}` : '';
    // visage
    const Y = YEUX[o.y], cache = o.l === 2;
    const yeux = cache ? '' : `<g class="${an && !Y.ferme ? 'mge' : ''}">${Y.d(fx - 8, fy, 0)}${Y.d(fx + 8, fy, 1)}</g>`;
    const joues = o.j ? `<ellipse cx="${fx - 12}" cy="${fy + 7}" rx="3.4" ry="2" fill="#E2735B" opacity=".45"/><ellipse cx="${fx + 12}" cy="${fy + 7}" rx="3.4" ry="2" fill="#E2735B" opacity=".45"/>` : '';
    const visage = joues + yeux + BOUCHES[o.m].d(fx, fy + 10) + POILS[o.s].d(fx, fy + 6) + LUNETTES[o.l].d(fx, fy);
    // tête
    const H = CHAPEAUX[o.h], larg = (cd - cg) / 2 + 1;
    const tete = H.ecoute ? `<path d="M${fx - larg} ${fy + 4}C${fx - larg} ${fy - 30} ${fx + larg} ${fy - 30} ${fx + larg} ${fy + 4}" stroke="#222" stroke-width="2.8" fill="none"/><rect x="${fx - larg - 3.4}" y="${fy}" width="6.8" height="11" rx="3" fill="${k}"/><rect x="${fx + larg - 3.4}" y="${fy}" width="6.8" height="11" rx="3" fill="${k}"/>`
      : H.front ? `<g transform="translate(${fx} ${fy - 10})">${H.d(k, kf)}</g>` : o.h ? `<g transform="translate(${fx} ${C.top + 2})">${H.d(k, kf)}</g>` : '';
    const F = FONDS[o.f];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 8 90 90" width="${size}" height="${size}" role="img" aria-label="${label}"><title>${label}</title>${an ? ANIM : ''}`
      + `<defs><clipPath id="pc${id}"><circle cx="50" cy="53" r="45"/></clipPath><radialGradient id="pg${id}" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${L}"/><stop offset=".55" stop-color="${M}"/><stop offset="1" stop-color="${S}"/></radialGradient></defs>`
      + `<g clip-path="url(#pc${id})"><rect width="100" height="100" fill="${F}"/>${MOTIFS[o.g].d()}`
      + `<ellipse class="${an ? 'mgo' : ''}" cx="${px}" cy="${bas + 6}" rx="19" ry="3.4" fill="#000" opacity=".2"${del}/>`
      + `<g class="${an ? (opt.saut ? 'mgs' : 'mga') : ''}"${del}>${pieds}${brasG}${brasD}${C.corps(c)}${C.haut(c)}${visage}${tete}${main}</g></g>`
      + `<circle cx="50" cy="53" r="44.6" fill="none" stroke="#fff" stroke-opacity=".12"/></svg>`;
  }

  const noms = L => L.map(x => typeof x === 'string' ? x : x.nom);
  const visage = b => { const C = CORPS[n(b, CORPS.length)]; return { x: (C.fx - 5) / .9, y: (C.fy + 4 - 8) / .9 }; };   // pour zoomer une vignette sur le visage
  // il saute quand il y a du nouveau : proposition de prix, message, notification, commande à traiter
  const CSS_SAUT = '.mg-saute>img,.mg-saute>span>img{animation:mgSautImg .8s cubic-bezier(.3,1.5,.5,1)}@keyframes mgSautImg{0%{transform:translateY(0) scale(1.06,.92)}45%{transform:translateY(-7px) scale(.96,1.05)}80%{transform:translateY(0) scale(1.03,.97)}100%{transform:none}}@media (prefers-reduced-motion:reduce){.mg-saute>img,.mg-saute>span>img{animation:none}}';
  function saute(cible) {
    if (!document.getElementById('mgSautCss')) { const st = document.createElement('style'); st.id = 'mgSautCss'; st.textContent = CSS_SAUT; document.head.appendChild(st); }
    (cible ? [cible] : [...document.querySelectorAll('.acc-r.av, .cp-hero-av, [data-mg-moi]')]).forEach(el => {
      el.classList.remove('mg-saute'); void el.getBoundingClientRect(); el.classList.add('mg-saute');
      clearTimeout(el._mgT); el._mgT = setTimeout(() => el.classList.remove('mg-saute'), 1400); });
  }
  const compte = () => { let t = 0; const f = (m, k) => { try { const v = m && typeof m[k] === 'function' ? +m[k]() || 0 : 0; t += v; } catch (_) {} };
    f(window.MDGNegoce, 'unread'); f(window.MDGMessages, 'unread'); f(window.MDGCompte, 'nonLues'); f(window.MDGActivite, 'aFaire'); return t; };
  let avant = null, tV = 0;   // pendant le démarrage, les modules arrivent un par un : on attend avant de prendre le point de départ
  const verifier = () => { if (avant === null) return; const t = compte(); if (t > avant) saute(); avant = t; };
  ['mdg:activite', 'mdg:negoce', 'mdg:dm', 'mdg:notifs'].forEach(e => addEventListener(e, () => { clearTimeout(tV); tV = setTimeout(verifier, 400); }));
  setTimeout(() => { avant = compte(); }, 6000);   // le point de départ : ce qui était déjà là ne le fait pas sauter

  window.MDGPerso = { saute, svg, parse, code, hasard, normal, visage, CLES, ORDRE,
    CHOIX: { b: noms(CORPS), y: noms(YEUX), m: noms(BOUCHES), h: noms(CHAPEAUX), l: noms(LUNETTES), s: noms(POILS), i: noms(OBJETS) },
    COULEURS: { hc: COUL, c: SOULIERS, f: FONDS, g: noms(MOTIFS), p: b => CORPS[n(b, CORPS.length)].pal.map(x => x[0]) },
    combinaisons: () => CORPS.reduce((t, x) => t + x.pal.length, 0) * YEUX.length * BOUCHES.length * 2 * CHAPEAUX.length * COUL.length * LUNETTES.length * POILS.length * OBJETS.length * SOULIERS.length * FONDS.length * MOTIFS.length };
})();
