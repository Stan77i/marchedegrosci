/* ═════════ Marché de Gros CI — avatars vectoriels ═════════
   Des portraits dessinés en SVG (aucune image, aucun service) : coiffure ou foulard, teint, couleur, fond, détail.
   Le choix appartient à la personne : rien n'est déduit du nom ou du numéro. Par défaut : ses initiales.
   Code compact enregistré dans le profil (≤ 200 caractères) : « v1:c=foulard;t=2;k=0;f=1;a=boucles » ou « ini:f=3 ».
   Photo (12/10/2026) : « ph:u=<uid>;v=<version>;f=<fond> » → l'image publique avatars/<uid>.jpg (Supabase Storage, supabase/schema-5.sql) ;
   tant qu'elle charge ou si elle manque, les initiales restent dessous.
   Personnages du marché (23/10/2026) : « mg:b=…;p=… » → v3/personnages.js (tomate, igname, sac de riz…), animés avec { anime: true }.
   API : MDGAvatar.svg(code, { size, nom, seed, anime, saut }) · uri(code, opt) (pour une balise <img>) · STYLES · TEINTS · COULEURS · FONDS · parse · code */
(function () {
  'use strict';
  const TEINTS = ['#4A2E1F', '#5E3A26', '#7A4B2E', '#94603C', '#B47A50', '#D5A27A'];
  const CHEVEUX = ['#17110D', '#3A2618', '#6B4A2F', '#A88A6A', '#8C8C8C', '#C9C2B8'];
  const TISSUS = ['#E07A3F', '#31543C', '#D6A83E', '#B85C38', '#3D5A80', '#8E3B5B', '#6CC58C', '#F5F0E6'];
  const FONDS = ['#2B2620', '#31543C', '#8C3F22', '#B8882A', '#2E4560', '#5B2A35'];
  const HABITS = ['#E07A3F', '#F5F0E6', '#D6A83E', '#6CC58C', '#B85C38', '#3D5A80'];
  // les styles se nomment par ce qu'ils montrent, jamais par un genre
  const STYLES = [
    { id: 'foulard', nom: 'Foulard', tissu: true }, { id: 'tresses', nom: 'Tresses' }, { id: 'chignon', nom: 'Chignon' },
    { id: 'afro', nom: 'Afro' }, { id: 'nattes', nom: 'Nattes' }, { id: 'court', nom: 'Coupe courte' },
    { id: 'ras', nom: 'Ras' }, { id: 'barbe', nom: 'Barbe' }, { id: 'bonnet', nom: 'Bonnet', tissu: true }
  ];
  const DETAILS = [{ id: '', nom: 'Aucun' }, { id: 'boucles', nom: 'Boucles d’oreilles' }, { id: 'lunettes', nom: 'Lunettes' }];

  const parse = code => {
    const s = String(code || ''), m = /^(v1|ini):(.*)$/.exec(s), o = { mode: 'ini', c: 'court', t: 2, k: 0, f: -1, a: '', u: '', v: 0 };
    const ph = /^ph:(.*)$/.exec(s);
    if (/^mg:/.test(s) && window.MDGPerso) return Object.assign(MDGPerso.parse(s), { mode: 'mg', f0: o.f });
    if (ph) { o.mode = 'ph'; ph[1].split(';').forEach(kv => { const [k, v] = kv.split('='); if (k === 'u' && /^[0-9a-f-]{36}$/i.test(v)) o.u = v; if (k === 'v') o.v = +v || 0; if (k === 'f') o.f = +v; }); if (!o.u) o.mode = 'ini'; return o; }
    if (!m) return o; o.mode = m[1];
    m[2].split(';').forEach(kv => { const [k, v] = kv.split('='); if (k in o) o[k] = /^-?\d+$/.test(v) ? +v : v; });
    if (!STYLES.some(x => x.id === o.c)) o.c = 'court';
    return o;
  };
  const BASE = 'https://catmsypctymgkjkfzdkt.supabase.co/storage/v1/object/public/avatars/';
  const photoUrl = o => BASE + o.u + '.jpg?v=' + (o.v || 0);
  const code = o => o.mode === 'mg' && window.MDGPerso ? MDGPerso.code(o) : o.mode === 'ph' ? 'ph:u=' + o.u + ';v=' + (o.v || 0) + ';f=' + (o.f >= 0 ? o.f : 0) : o.mode === 'ini' ? 'ini:f=' + (o.f >= 0 ? o.f : 0) : 'v1:c=' + o.c + ';t=' + o.t + ';k=' + o.k + ';f=' + o.f + (o.a ? ';a=' + o.a : '');
  const hash = s => { let h = 7; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // seulement des mots avec des lettres : un numéro de téléphone donnait « 00 »
  const initiales = nom => { const p = String(nom || '').trim().split(/\s+/).filter(w => /\p{L}/u.test(w)); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); };

  function coiffure(c, col, peau) {
    switch (c) {
      case 'foulard': return `<path d="M15 27c0-10 7.6-17 17-17s17 7 17 17c-3-3.2-9-5-17-5s-14 1.8-17 5Z" fill="${col}"/><path d="M14.5 27.5c3-4.6 9.6-7 17.5-7s14.5 2.4 17.5 7c-.6-2.4-1.6-4.6-3-6.4-3.4-1.6-8.4-2.6-14.5-2.6s-11.1 1-14.5 2.6c-1.4 1.8-2.4 4-3 6.4Z" fill="#000" opacity=".16"/><path d="M40 11.5c4.5-2.2 9-1 10.4 2.2 1.3 3-1.4 6.2-5.2 6.6 1.6-2.6.6-6.4-5.2-8.8Z" fill="${col}"/><path d="M41 12c3.4-1 6.3 0 7 2" stroke="#000" stroke-opacity=".2" stroke-width="1" fill="none"/>`;
      case 'tresses': return `<path d="M17 30c-1-11 6-19 15-19s16 8 15 19c-2-6-7.5-10-15-10s-13 4-15 10Z" fill="${col}"/><g fill="${col}"><rect x="15.4" y="27" width="4.4" height="22" rx="2.2"/><rect x="44.2" y="27" width="4.4" height="22" rx="2.2"/></g><g stroke="#000" stroke-opacity=".25" stroke-width=".9"><path d="M15.6 32h4M15.6 36.5h4M15.6 41h4M15.6 45.5h4M44.4 32h4M44.4 36.5h4M44.4 41h4M44.4 45.5h4"/></g>`;
      case 'chignon': return `<circle cx="32" cy="11.5" r="6.5" fill="${col}"/><path d="M17.5 29c-.5-9.5 6-16.5 14.5-16.5S47 19.5 46.5 29c-2.4-5-7.6-8-14.5-8s-12.1 3-14.5 8Z" fill="${col}"/>`;
      case 'afro': return `<path d="M32 6c10.5 0 19 7.6 19 17.5 0 5-2 8.6-4.4 10.6.2-1.3.4-2.7.4-4.1 0-7.9-6.7-13-15-13s-15 5.1-15 13c0 1.4.2 2.8.4 4.1C15 32.1 13 28.5 13 23.5 13 13.6 21.5 6 32 6Z" fill="${col}"/><g fill="#000" opacity=".12"><circle cx="22" cy="14" r="1.2"/><circle cx="31" cy="10" r="1.2"/><circle cx="41" cy="13" r="1.2"/><circle cx="46" cy="21" r="1.2"/><circle cx="18" cy="22" r="1.2"/></g>`;
      case 'nattes': return `<path d="M17.4 28.5c-.4-10 6-17 14.6-17s15 7 14.6 17c-2.6-5.6-7.8-8.6-14.6-8.6s-12 3-14.6 8.6Z" fill="${col}"/><g stroke="#000" stroke-opacity=".28" stroke-width="1" fill="none"><path d="M24 14.5c-1.8 3.6-2.6 7-2.4 9.8M28.5 12.4c-1 3.8-1.3 7.2-1 9.6M32 12v9.2M35.5 12.4c1 3.8 1.3 7.2 1 9.6M40 14.5c1.8 3.6 2.6 7 2.4 9.8"/></g>`;
      case 'court': return `<path d="M17.6 28.5c-.6-9.8 5.8-16.6 14.4-16.6s15 6.8 14.4 16.6c-1.2-3.8-3.6-6.4-7.4-7.6-2 1.2-4.4 1.8-7 1.8s-5-.6-7-1.8c-3.8 1.2-6.2 3.8-7.4 7.6Z" fill="${col}"/>`;
      case 'ras': return `<path d="M18.4 26.5c.6-8.4 6.4-13.8 13.6-13.8s13 5.4 13.6 13.8c-3-3.8-7.8-5.8-13.6-5.8s-10.6 2-13.6 5.8Z" fill="${col}" opacity=".55"/>`;
      case 'barbe': return `<path d="M17.6 28.5c-.6-9.8 5.8-16.6 14.4-16.6s15 6.8 14.4 16.6c-1.2-3.8-3.6-6.4-7.4-7.6-2 1.2-4.4 1.8-7 1.8s-5-.6-7-1.8c-3.8 1.2-6.2 3.8-7.4 7.6Z" fill="${col}"/><path d="M19.6 31.5c.8 7.4 5.8 12.5 12.4 12.5s11.6-5.1 12.4-12.5c-1.4 2-3 3-4.6 3.2-1.8-1.6-4.6-2.4-7.8-2.4s-6 .8-7.8 2.4c-1.6-.2-3.2-1.2-4.6-3.2Z" fill="${col}"/><path d="M28.6 37.2c2.2.9 4.6.9 6.8 0" stroke="${peau}" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
      case 'bonnet': return `<path d="M16.8 26c0-9 6.8-15.6 15.2-15.6S47.2 17 47.2 26Z" fill="${col}"/><rect x="15.6" y="23.6" width="32.8" height="5.4" rx="2.7" fill="${col}"/><rect x="15.6" y="23.6" width="32.8" height="5.4" rx="2.7" fill="#000" opacity=".18"/><circle cx="32" cy="9.6" r="3" fill="${col}"/>`;
    }
    return '';
  }
  let uid = 0;
  function svg(c0, opt = {}) {
    const o = parse(c0), size = opt.size || 40, label = opt.nom ? esc(opt.nom) : 'Avatar';
    if (o.mode === 'mg') return MDGPerso.svg(o, Object.assign({}, opt, { nom: opt.nom || 'Avatar' }));   // les personnages du marché (v3/personnages.js)
    const fi = o.f >= 0 ? o.f % FONDS.length : hash(opt.seed || opt.nom) % FONDS.length, fond = FONDS[fi];
    const id = ++uid, head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${label}"><title>${label}</title><defs><clipPath id="avc${id}"><circle cx="32" cy="32" r="32"/></clipPath><radialGradient id="avl${id}" cx=".32" cy=".22" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs><g clip-path="url(#avc${id})"><rect width="64" height="64" fill="${fond}"/><rect width="64" height="64" fill="url(#avl${id})"/>`;
    if (o.mode === 'ph') return head + `<text x="32" y="41.5" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="27" font-weight="600" fill="#F5F0E6">${esc(initiales(opt.nom))}</text><image href="${photoUrl(o)}" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid slice"/></g><circle cx="32" cy="32" r="31.5" fill="none" stroke="#fff" stroke-opacity=".1"/></svg>`;
    if (o.mode === 'ini') return head + `<text x="32" y="41.5" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="27" font-weight="600" fill="#F5F0E6">${esc(initiales(opt.nom))}</text></g></svg>`;
    const peau = TEINTS[o.t % TEINTS.length], st = STYLES.find(x => x.id === o.c) || STYLES[5];
    const col = st.tissu ? TISSUS[o.k % TISSUS.length] : CHEVEUX[o.k % CHEVEUX.length], habit = HABITS[(fi + 1) % HABITS.length];
    const derriere = o.c === 'afro' || o.c === 'tresses' ? coiffure(o.c, col, peau) : '';
    return head + '<g transform="translate(32 35) scale(1.14) translate(-32 -32)">' + derriere
      + `<path d="M8 66c1.6-11.4 11.4-18.6 24-18.6S54.4 54.6 56 66Z" fill="${habit}"/><path d="M8 66c1.6-11.4 11.4-18.6 24-18.6 3 0 5.8.4 8.4 1.2C30 50 20 56.6 17.6 66Z" fill="#fff" opacity=".1"/><path d="M24.4 48.2c2.2 2.6 4.8 4 7.6 4s5.4-1.4 7.6-4" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M26.6 44.6h10.8v6.2c-1.6 1.4-3.4 2.1-5.4 2.1s-3.8-.7-5.4-2.1Z" fill="${peau}"/><path d="M26.6 44.6h10.8v2.6c-1.7.9-3.5 1.3-5.4 1.3s-3.7-.4-5.4-1.3Z" fill="#000" opacity=".2"/>`
      + `<ellipse cx="32" cy="31" rx="13.4" ry="15" fill="${peau}"/><path d="M39.6 18.6c3.6 2.6 5.8 7 5.8 12.4 0 8.3-6 15-13.4 15-2.6 0-5-.8-7-2.2 7.6.4 13.6-5.6 14.6-13.6.5-4.4-.1-8.4 0-11.6Z" fill="#000" opacity=".13"/><ellipse cx="25.4" cy="36.4" rx="2.6" ry="1.6" fill="#E2735B" opacity=".16"/><ellipse cx="38.6" cy="36.4" rx="2.6" ry="1.6" fill="#E2735B" opacity=".16"/>`
      + `<ellipse cx="18.8" cy="32" rx="2" ry="3" fill="${peau}"/><ellipse cx="45.2" cy="32" rx="2" ry="3" fill="${peau}"/>`
      + `<path d="M23.6 27.6c1.6-1 3.4-1.2 5.2-.6M35.2 27c1.8-.6 3.6-.4 5.2.6" stroke="#1a120c" stroke-opacity=".6" stroke-width="1.1" stroke-linecap="round" fill="none"/><circle cx="26.8" cy="31.6" r="1.45" fill="#1a120c"/><circle cx="37.2" cy="31.6" r="1.45" fill="#1a120c"/><circle cx="27.3" cy="31.1" r=".45" fill="#fff" opacity=".8"/><circle cx="37.7" cy="31.1" r=".45" fill="#fff" opacity=".8"/><path d="M31.2 33.4c-.5 1.4-.6 2.4.2 2.8.4.2 1 .2 1.6 0" stroke="#000" stroke-opacity=".22" stroke-width="1" stroke-linecap="round" fill="none"/>`
      + (o.c === 'barbe' ? '' : `<path d="M28.4 38.4c2.3 1.5 4.9 1.5 7.2 0" stroke="#1a120c" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round" fill="none"/>`)
      + (derriere ? (o.c === 'afro' ? '' : coiffure(o.c, col, peau).replace(/<g fill[\s\S]*?<\/g>|<g stroke[\s\S]*?<\/g>/g, '')) : coiffure(o.c, col, peau))
      + (o.a === 'boucles' ? `<circle cx="18.6" cy="37" r="1.6" fill="#D6A83E"/><circle cx="45.4" cy="37" r="1.6" fill="#D6A83E"/>` : '')
      + (o.a === 'lunettes' ? `<g fill="none" stroke="#17110D" stroke-width="1.3"><circle cx="26.8" cy="31.6" r="3.8"/><circle cx="37.2" cy="31.6" r="3.8"/><path d="M30.6 31.4h2.8M23 31l-3.4-1M41 31l3.4-1"/></g>` : '')
      + `</g></g><circle cx="32" cy="32" r="31.5" fill="none" stroke="#fff" stroke-opacity=".1"/></svg>`;
  }
  const uri = (c0, opt) => { const o = parse(c0); return o.mode === 'ph' ? photoUrl(o) : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(c0, Object.assign({ fixe: true }, opt))); };

  window.MDGAvatar = { svg, uri, parse, code, photoUrl, initiales, STYLES, DETAILS, TEINTS, CHEVEUX, TISSUS, FONDS };
})();
