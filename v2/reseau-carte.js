// Marché de Gros CI — « Le réseau » : carte en points de la Côte d'Ivoire où l'offre et la demande se rencontrent.
// Langage commun du site (v3/marqueurs.js) : cercle vert = offre, carré jaune = demande, triangle violet = votre recherche, ligne bleue = offre et demande compatibles.
// Territoire réel : frontières Natural Earth 1:50 000 000 (vendor/countries-50m.json, hors connexion), la Côte d'Ivoire, ses voisins et le golfe.
// Repli sur le contour simplifié si la géographie ne charge pas. Positions des offres et demandes : chef-lieu du district (aucune position inventée).
// La projection reste isolée (option « project(lat, lon) → [x, z] ») : marqueurs, fils et gestes n'en dépendent pas.
// Zoom à trois lectures : le pays, le district, les alentours d'une ville — toujours nommé, avec l'échelle en kilomètres.
// Un fil relie une offre et une demande du même produit, d'une ville à l'autre : aucun point de passage obligé,
// aucune destination par défaut. Canvas 2D, sans bibliothèque ni réseau.
// API : dock / undock / setState / setInsets / home / zoom / focusProducer / focusZone / focusUser / fit / hover.
const OUT = [[-7.53,4.37],[-6.85,4.66],[-6.64,4.73],[-6.08,4.95],[-5.3,5.15],[-5.02,5.12],[-4.6,5.17],[-4.02,5.25],[-3.74,5.18],[-3.3,5.11],[-3.1,5.1],[-2.95,5.5],[-3.1,6.0],[-3.24,6.5],[-3.1,7.0],[-2.95,7.4],[-2.75,8.0],[-2.55,8.25],[-2.65,8.9],[-2.7,9.45],[-3.0,9.85],[-3.6,9.92],[-4.3,9.62],[-4.7,9.72],[-5.1,10.25],[-5.5,10.42],[-6.0,10.2],[-6.25,10.5],[-6.9,10.3],[-7.6,10.45],[-8.0,10.2],[-8.2,9.8],[-8.1,9.3],[-7.85,8.8],[-8.2,8.45],[-8.47,7.6],[-8.3,7.2],[-7.9,6.75],[-7.55,6.2],[-7.4,5.7],[-7.6,5.1]];
const GEO = [['Golfe de Guinée', 4.05, -5.2, 'w'], ['LIBÉRIA', 6.5, -9.4], ['GUINÉE', 9.45, -9.2], ['MALI', 11.5, -6.6], ['BURKINA FASO', 11.2, -3.9], ['GHANA', 7.6, -1.8]];
const BOX = [-13, 2.2, 1.7, 14.4]; // fenêtre géographique en degrés (ouest, sud, est, nord) : le pays, ses voisins, le golfe
const PRIO = { abidjan: 9, yamoussoukro: 8, 'vallee-du-bandama': 7, savanes: 6, 'bas-sassandra': 6, 'sassandra-marahoue': 5, montagnes: 5, zanzan: 4, denguele: 4, 'goh-djiboua': 4, comoe: 3, woroba: 3, lacs: 2, lagunes: 2 };
let geoP = null; // partagé par toutes les cartes de la page
function loadGeo() {
  if (geoP) return geoP;
  const lib = window.topojson ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/topojson-client.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return (geoP = Promise.all([fetch('vendor/countries-50m.json').then(r => { if (!r.ok) throw new Error('géographie ' + r.status); return r.json(); }), lib]).then(([t]) => {
    const fs = window.topojson.feature(t, t.objects.countries).features;
    return fs.map(f => ({ id: String(f.id), rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flat().map(clip).filter(r => r.length > 2) })).filter(f => f.rings.length);
  }).catch(e => { geoP = null; throw e; }));
}
let hydroP = null;
const loadHydro = () => hydroP || (hydroP = fetch('vendor/ci-hydro.json').then(r => { if (!r.ok) throw new Error('eau ' + r.status); return r.json(); }).catch(e => { hydroP = null; throw e; }));
// Sutherland–Hodgman sur BOX ; les points posés sur le bord de la fenêtre ne sont ni côte ni frontière
const cut = (a, b, k, v) => { const t = (v - a[k]) / (b[k] - a[k]), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; p.box = 1; return p; };
function clip(ring) {
  let out = ring;
  for (const [k, v, lo] of [[0, BOX[0], 1], [0, BOX[2], 0], [1, BOX[1], 1], [1, BOX[3], 0]]) {
    const src = out, inn = p => lo ? p[k] >= v : p[k] <= v; out = [];
    for (let i = 0; i < src.length; i++) { const a = src[i], b = src[(i + 1) % src.length], ia = inn(a), ib = inn(b); if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b, k, v)); }
    if (!out.length) break;
  }
  return out;
}
// remplissage par balayage (pair-impair) : chaque ligne coupe les contours, les points tombent entre deux coupures
function scan(rings, step, cb) {
  let z0 = 1e9, z1 = -1e9; rings.forEach(r => r.forEach(p => { z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }));
  for (let z = z0 + step / 2; z < z1; z += step) {
    const xs = [];
    rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[j], b = r[i]; if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); } });
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] / step) * step; x < xs[k + 1]; x += step) cb(x, z);
  }
}
const LON0 = -5.45, LAT0 = 7.4, KX = Math.cos(7.5 * Math.PI / 180), TILT = .5, CT = Math.cos(TILT), ST = Math.sin(TILT), DEPTH = 7, SEG = 32;
const XZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), fract = x => x - Math.floor(x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
const IVOIRE = '#F5F0E6', SABLE = '#B9AD98';
const volR = q => 1.5 + 1.05 * Math.log10(1 + (q || 0) / 40);

export function create({ data, reduced = false, project = null }) {
  const PJ = project || XZ;
  const MQ = (typeof window !== 'undefined' && window.MDGMarq) || null;
  const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  const root = document.createElement('div'); root.className = 'tj-world';
  const cv = document.createElement('canvas'); cv.className = 'tj-cv'; cv.setAttribute('aria-hidden', 'true');
  const layer = document.createElement('div'); layer.className = 'tj-labels';
  root.append(cv, layer);
  const ctx = cv.getContext('2d'); if (!ctx) return null;

  /* ——— Terre ——— */
  // poly : contour principal du pays (cadrage et limites du déplacement) ; civ / ctxLand : contours réels, une fois chargés
  let poly = OUT.map(([lo, la]) => PJ(la, lo)), civ = [{ pts: poly, bd: poly.map(() => 0), co: poly.map(() => 1) }], ctxLand = [], real = false;
  let bx0, bx1, bz0, bz1;
  const bounds = () => { bx0 = 1e9; bx1 = -1e9; bz0 = 1e9; bz1 = -1e9; poly.forEach(([x, z]) => { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }); };
  bounds();
  const panX = v => clamp(v, bx0 - .2, bx1 + .2), panZ = v => clamp(v, bz0 - .2, bz1 + .2);
  const NB = 6, BCOL = [...Array(5)].map((_, i) => mixHex('#86A483', '#D2B17C', i / 4)).concat(['#9C907A']), BALPHA = [.42, .44, .46, .48, .5, .15];
  const step = mobile ? .082 : .056;
  let dots = [], fine = [], wetR = [];
  // l'eau interrompt le grain : un point qui tombe dans un lac n'est pas posé
  const wet = (x, z) => { for (const L of wetR) { if (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1) continue; let c = false; for (const R of L.rings) for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const a = R[i], b = R[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } if (c) return true; } return false; };
  function grain() {
    const B = [...Array(NB)].map(() => []), band = z => Math.round(clamp((1.6 - z) / 4.8, 0, 1) * 4), J = (v, st) => v + (Math.random() - .5) * st * .4;
    scan(civ.map(r => r.pts), step, (x, z) => { const jx = J(x, step), jz = J(z, step); if (!wet(jx, jz)) B[band(jz)].push(jx, jz, Math.random()); });
    const sn = step * 1.65; scan(ctxLand.flatMap(l => l.rings.map(r => r.pts)), sn, (x, z) => B[5].push(J(x, sn), J(z, sn), Math.random()));
    dots = B.map(a => new Float32Array(a));
    // grain fin : il prend le relais quand on s'approche (le territoire garde sa texture au lieu de grossir)
    const F = [...Array(5)].map(() => []), sf = step / 2; scan(civ.map(r => r.pts), sf, (x, z) => { const jx = J(x, sf), jz = J(z, sf); if (!wet(jx, jz)) F[band(jz)].push(jx, jz); }); fine = F.map(a => new Float32Array(a));
  }
  grain();
  loadGeo().then(G => {
    const key = p => p[0].toFixed(3) + ',' + p[1].toFixed(3), owners = new Map();
    G.forEach(f => f.rings.forEach(r => r.forEach(p => { const k = key(p), o = owners.get(k); if (!o) owners.set(k, new Set([f.id])); else o.add(f.id); })));
    const ring = r => ({ pts: r.map(([lo, la]) => PJ(la, lo)), bd: r.map(p => !p.box && owners.get(key(p)).size > 1 ? 1 : 0), co: r.map(p => !p.box && owners.get(key(p)).size === 1 ? 1 : 0), nb: r.map(p => { const o = owners.get(key(p)); return !p.box && o.size > 1 && !o.has('384') ? 1 : 0; }) });
    const C = G.find(f => f.id === '384'); if (!C) return;
    civ = C.rings.map(ring);
    ctxLand = G.filter(f => f.id !== '384').map(f => ({ id: f.id, rings: f.rings.map(ring) }));
    poly = civ.reduce((a, r) => r.pts.length > a.length ? r.pts : a, []); bounds(); real = true;
    grain(); intro = Math.min(intro, .5); if (atHome) fitHome(); wake();
  }).catch(e => console.warn('[réseau] géographie indisponible, contour simplifié', e));
  // l'eau : fleuves (tracés) et lacs ; leurs noms en italique, comme sur une carte
  let rivers = [], lakes = [], waterLbl = [];
  loadHydro().then(Hd => {
    const P2 = pts => pts.map(([lo, la]) => PJ(la, lo));
    rivers = Hd.rivers.map(r => ({ n: r.n, w: r.r <= 5 ? 1.4 : r.r <= 7 ? 1.1 : .8, pts: P2(r.p) }));
    lakes = Hd.lakes.map(l => ({ n: l.n, rings: l.p.map(P2) }));
    wetR = lakes.map(l => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; l.rings.forEach(R => R.forEach(([x, z]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); })); return { rings: l.rings, x0, x1, z0, z1 }; });
    grain();
    const long = {}; rivers.forEach(r => { if (r.n && (!long[r.n] || r.pts.length > long[r.n].pts.length)) long[r.n] = r; });
    const KEEP = ['Bandama', 'Comoé', 'Sassandra', 'Bandama blanc', 'Baoulé', 'Bagoé', 'Cess', 'Volta', 'Mouhoun', 'Niger'];
    waterLbl = lakes.filter(l => l.n).map(l => { const R = l.rings[0]; let x = 0, z = 0; R.forEach(q => { x += q[0]; z += q[1]; }); return { t: l.n, x: x / R.length, z: z / R.length, lake: true }; })
      .concat(KEEP.filter(n => long[n]).map(n => { const q = long[n].pts[Math.floor(long[n].pts.length / 2)]; return { t: n, x: q[0], z: q[1], lake: false }; }));
    waterLbl.forEach(w => { w.el = mk('tj-geo w sm'); w.el.textContent = w.t; });
    wake();
  }).catch(e => console.warn('[réseau] fleuves et lacs indisponibles', e));

  /* ——— Lieux : chefs-lieux des districts (géographie de référence, v3/marche.js) ——— */
  const REGN = (typeof window !== 'undefined' && window.MDGMarche && window.MDGMarche.REG) || {};
  /* ——— Acteurs du marché ——— */
  const node = (o, k) => { const [x, z] = PJ(o.lat, o.lon); return { ...o, k, x, z, hi: .3, hiT: .3, seed: Math.random(), q: 0, lit: false }; };
  const OF = (data.producers || []).map(p => node(p, 'o'));
  const DM = (data.demands || []).map(d => node(d, 'd'));
  const ALL = OF.concat(DM), byId = Object.fromEntries(ALL.map(n => [n.id, n]));
  const ZN = (data.zones || []).map(z => { const [x, zz] = PJ(z.lat, z.lon); return { ...z, x, z: zz }; });
  const me = { x: 0, z: 0, on: false, k: 'u', id: 'me', hi: 1, seed: .37 };
  let state = { hl: null, products: null, sel: null, zone: null, user: null, userLabel: 'Vous', labels: {}, searching: false, hide: {} }, hov = null, links = [], filtering = false;
  let mode = { interactive: true, onPick: null, onDemand: null, onZone: null, onHover: null };
  // survol venu de la carte (souris) : la page peut mettre en avant l'offre correspondante (onHover reçoit l'id d'une offre, ou null)
  const told = id => { if (mode.onHover) mode.onHover(id && byId[id] && byId[id].k === 'o' ? id : null); };
  const has = (p, s) => p.prods && p.prods[s] != null;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  function arc(A, B) {
    const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz) || 1e-3, bend = .1 * (A.seed > .5 ? 1 : -1);
    const p1x = A.x + dx * .5 - dz * bend, p1z = A.z + dz * .5 + dx * bend, h1 = .05 + len * .14, S = new Float32Array((SEG + 1) * 3);
    for (let k = 0; k <= SEG; k++) { const t = k / SEG, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; S[k * 3] = a * A.x + b * p1x + c * B.x; S[k * 3 + 1] = b * h1; S[k * 3 + 2] = a * A.z + b * p1z + c * B.z; }
    return { A, B, S, len, nx: -dz / len, nz: dx / len, n: mobile ? 6 : 8 + Math.round(len * 3), hi: 0, hiT: 0, prog: 0 };
  }
  function compute() {
    let scope = state.products ? new Set(state.products) : null;
    if (!scope && state.hl) { scope = new Set(); OF.forEach(p => state.hl.has(p.id) && Object.keys(p.prods || {}).forEach(s => scope.add(s))); }
    filtering = !!(state.hl || state.products || (state.user && me.on));
    const sel = state.sel && byId[state.sel] ? byId[state.sel] : null;
    OF.forEach(p => { p.lit = (!state.hl || state.hl.has(p.id)) && (!scope || Object.keys(p.prods || {}).some(s => scope.has(s))); p.q = Object.entries(p.prods || {}).reduce((a, [s, q]) => a + (!scope || scope.has(s) ? q : 0), 0); });
    DM.forEach(d => { d.lit = !scope || scope.has(d.productSlug); d.q = d.quantity; });
    const pairs = [];
    const linkDemand = (d, force) => OF.filter(p => has(p, d.productSlug) && (force || p.lit)).sort((a, b) => dist(a, d) - dist(b, d)).slice(0, 3).forEach(p => pairs.push([p, d]));
    if (sel && sel.k === 'd') linkDemand(sel, true);
    else if (sel && sel.k === 'o') DM.filter(d => has(sel, d.productSlug) && (!scope || scope.has(d.productSlug))).forEach(d => pairs.push([sel, d]));
    else DM.forEach(d => d.lit && linkDemand(d));
    if (me.on && filtering && state.hl) OF.filter(p => p.lit).sort((a, b) => dist(a, me) - dist(b, me)).slice(0, 5).forEach(p => pairs.push([p, me]));
    const old = Object.fromEntries(links.map(l => [l.A.id + '>' + l.B.id, l]));
    links = pairs.map(([a, b]) => { const k = a.id + '>' + b.id, o = old[k]; return o && b !== me ? o : arc(a, b); });
    const touch = new Set(); links.forEach(l => { touch.add(l.A.id); touch.add(l.B.id); });
    ALL.forEach(n => {
      n.hiT = sel ? (n === sel ? 1 : touch.has(n.id) ? .85 : n.lit ? .14 : .04) : filtering ? (n.lit ? 1 : .04) : .38;
      n.el.classList.toggle('hl', filtering && n.lit); n.el.classList.toggle('sel', n === sel);
    });
    links.forEach(l => { l.hiT = sel ? 1 : filtering ? .9 : .28; });
  }

  /* ——— Étiquettes ——— */
  const mk = (cls, tag = 'span') => { const e = document.createElement(tag); e.className = cls; if (tag === 'button') e.type = 'button'; layer.appendChild(e); return e; };
  GEO.forEach(g => { const [x, z] = PJ(g[1], g[2]); g.x = x; g.z = z; g.el = mk('tj-geo' + (g[3] ? ' w' : '')); g.el.textContent = g[0]; });
  const CITY = ZN.map(z => { const R = REGN[z.slug]; return { ...z, cap: R ? R[2] : z.name, pri: PRIO[z.slug] || 1, big: z.slug === 'abidjan' || z.slug === 'yamoussoukro' }; });
  CITY.forEach(c => { c.el = mk('tj-city' + (c.big ? ' cap' : '')); c.el.textContent = c.cap; });
  const hud = document.createElement('div'); hud.className = 'tj-hud'; hud.setAttribute('aria-live', 'polite');
  hud.innerHTML = '<span class="tj-where"></span><span class="tj-scale" aria-hidden="true"><i></i><b></b></span>'; root.appendChild(hud);
  const hWhere = hud.firstChild, hBar = hud.lastChild.firstChild, hKm = hud.lastChild.lastChild;
  ALL.forEach(n => {
    n.el = mk('tj-pin' + (n.k === 'd' ? ' d' : ''), 'button'); n.el.innerHTML = '<b></b><small></small>';
    n.el.setAttribute('aria-label', n.k === 'd' ? `Demande : ${n.name}, ${n.city}` : `Offre : ${n.name}, ${n.city}`);
    n.el.onclick = () => pickNode(n);
    n.el.onmouseenter = () => { hov = n.id; told(hov); wake(); }; n.el.onmouseleave = () => { if (hov === n.id) { hov = null; told(null); } };
  });
  const meEl = mk('tj-me');
  const fmtQ = (q, u) => q ? `${Math.round(q).toLocaleString('fr-FR')} ${u || ''}`.trim() : '';
  function labelsTxt() {
    ALL.forEach(n => {
      const L = state.labels && state.labels[n.id];
      n.el.firstChild.textContent = L && L.t ? L.t : n.city;
      n.el.lastChild.textContent = L && L.s != null ? L.s : n.k === 'd' ? n.buyerType || 'Demande' : (filtering && n.q ? fmtQ(n.q, n.unit) : '');
    });
    meEl.textContent = state.userLabel || 'Vous';
  }
  const pickNode = n => n.k === 'd' ? (mode.onDemand ? mode.onDemand(n.id) : null) : (mode.onPick && mode.onPick(n.id));

  function setState(o) {
    Object.assign(state, o);
    if (state.user) { const [x, z] = PJ(state.user[0], state.user[1]); me.x = x; me.z = z; me.on = true; } else me.on = false;
    compute(); labelsTxt(); wake();
  }

  /* ——— Caméra (vue inclinée, perspective douce) ——— */
  const cam = { x: 0, z: 0, s: 80 }, camT = { x: 0, z: 0, s: 80 };
  let W = 0, H = 0, dpr = 1, ins = { left: 0, bottom: 0, top: 0 }, pending = null, OX = 0, OY = 0;
  const P = { x: 0, y: 0, k: 1 };
  function proj(x, h, z) {
    const rx = x - cam.x, rz = z - cam.z, d = DEPTH - rz * ST - h * CT; if (d < .6) return false;
    const k = DEPTH / d; P.x = OX + rx * cam.s * k; P.y = OY + (rz * CT - h * ST) * cam.s * k; P.k = k; return true;
  }
  function fitPts(pts, opt = {}) {
    if (!pts.length) return;
    if (!W || !H || W < 2) { pending = [pts, opt]; return; }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
    const minE = opt.min || 1.3, w = Math.max(x1 - x0, minE), h = Math.max(z1 - z0, minE), pad = opt.pad ?? (mobile ? 34 : 80);
    const aw = Math.max(80, W - ins.left - pad * 2), ah = Math.max(80, H - ins.bottom - (ins.top || 0) - pad * 2);
    camT.x = panX((x0 + x1) / 2); camT.z = panZ((z0 + z1) / 2 + h * .05); camT.s = clamp(Math.min(aw / w, ah / (h * CT)), minS(), 460);
    atHome = !!opt.home;
  }
  // échelle « tout le pays » pour la fenêtre actuelle : le zoom ne descend jamais sous 85 % de cette échelle (le territoire ne rétrécit plus)
  const MX = mobile ? .25 : .9, MZ = mobile ? .2 : .55; // marge de voisinage autour du pays (unités monde)
  const homeS = () => { const pad = mobile ? 14 : 30, aw = Math.max(80, W - ins.left - pad * 2), ah = Math.max(80, H - ins.bottom - (ins.top || 0) - pad * 2); return Math.min(aw / Math.max(bx1 - bx0 + MX * 2, 1.3), ah / (Math.max(bz1 - bz0 + MZ * 2, 1.3) * CT * 1.12)); };
  const minS = () => W > 2 ? Math.max(28, homeS() * .85) : 28;
  const maxS = () => Math.max(200, (W > 2 ? homeS() : 80) * 4.5); // jusqu'au district : les positions sont au chef-lieu, plus près ne montrerait rien de vrai
  let atHome = false;
  const fitHome = () => { fitPts([{ x: bx0 - MX, z: bz0 - MZ }, { x: bx1 + MX, z: bz1 + MZ }], { pad: mobile ? 14 : 30, home: true, min: 1.3 }); camT.s = Math.max(minS(), Math.min(camT.s, homeS())); };
  const withLinks = pts => { const s = new Set(pts); links.forEach(l => { if (s.has(l.A) || s.has(l.B)) { s.add(l.A); s.add(l.B); } }); return [...s]; };

  /* ——— Gestes ——— */
  const ptr = new Map(); let gd = null, vel = null;
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function pick(x, y) {
    let best = null, bd = mobile ? 30 : 22;
    ALL.forEach(n => { if (n.hi < .08 || !proj(n.x, 0, n.z)) return; const d = Math.hypot(P.x - x, P.y - y); if (d < bd) { bd = d; best = n; } });
    return best;
  }
  cv.addEventListener('pointerdown', e => { vel = null; const l = local(e); ptr.set(e.pointerId, l); if (ptr.size === 1) gd = { x: l.x, y: l.y, moved: 0 }; if (mode.interactive) { try { cv.setPointerCapture(e.pointerId); } catch (_) {} } });
  // curseur = lanterne (ORDRE-DE-MISSION § VII, XXI) : il éclaire le territoire sous lui, écarte légèrement les grains, avive les offres et demandes proches
  const lan = { x: -1e4, y: -1e4, on: 0, a: 0 };
  cv.addEventListener('pointerleave', () => { lan.on = 0; });
  cv.addEventListener('pointermove', e => {
    const l = local(e);
    if (e.pointerType === 'mouse' && !reduced) { lan.x = l.x; lan.y = l.y; lan.on = 1; }
    if (!ptr.has(e.pointerId)) { if (e.pointerType === 'mouse') { const n = pick(l.x, l.y); cv.style.cursor = n ? 'pointer' : ''; const id = n ? n.id : null; if (id !== hov) { hov = id; told(id); ALL.forEach(q => q.el.classList.toggle('hov', q.id === id)); wake(); } } return; }
    const prev = ptr.get(e.pointerId); ptr.set(e.pointerId, l);
    if (!mode.interactive) return;
    if (ptr.size === 1 && gd) {
      const dx = l.x - prev.x, dy = l.y - prev.y; gd.moved += Math.abs(dx) + Math.abs(dy);
      if (gd.moved > 5) root.classList.add('grab');
      camT.x = panX(camT.x - dx / cam.s); camT.z = panZ(camT.z - dy / (cam.s * CT)); cam.x = camT.x; cam.z = camT.z; atHome = false; wake();
      const t = performance.now(), dtm = Math.max(8, t - (gd.t || t - 16)), vx = -dx / cam.s / dtm * 1000, vz = -dy / (cam.s * CT) / dtm * 1000;
      gd.vx = gd.vx == null ? vx : gd.vx * .55 + vx * .45; gd.vz = gd.vz == null ? vz : gd.vz * .55 + vz * .45; gd.t = t;
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gd && gd.d) { camT.s = clamp(camT.s * d / gd.d, minS(), maxS()); cam.s = camT.s; atHome = false; wake(); }
      if (gd) { gd.d = d; gd.moved = 99; }
    }
  });
  const up = e => {
    const had = ptr.has(e.pointerId); ptr.delete(e.pointerId); root.classList.remove('grab');
    if (had && gd && gd.moved < 6 && ptr.size === 0) { const l = local(e), n = pick(l.x, l.y); if (n) pickNode(n); }
    // la carte continue sur son élan, puis s'arrête : le geste a une fin lisible
    else if (had && gd && ptr.size === 0 && gd.vx != null && !gd.d && !reduced && performance.now() - gd.t < 90) { vel = { x: gd.vx, z: gd.vz }; wake(); }
    if (ptr.size === 0) gd = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  function zoomAt(l, f) {
    const s = clamp(camT.s * f, minS(), maxS()); atHome = false; vel = null;
    const wx = camT.x + (l.x - OX) / camT.s, wz = camT.z + (l.y - OY) / (camT.s * CT);
    camT.x = panX(wx - (l.x - OX) / s); camT.z = panZ(wz - (l.y - OY) / (s * CT)); camT.s = s; wake();
  }
  cv.addEventListener('wheel', e => { if (!mode.interactive) return; e.preventDefault(); zoomAt(local(e), Math.exp(-e.deltaY * .0016)); }, { passive: false });
  cv.addEventListener('dblclick', e => { if (!mode.interactive) return; e.preventDefault(); zoomAt(local(e), 2); });

  /* ——— Couleur du produit (offre) ——— */
  let accent = '#D6A83E';
  function readAccent() {
    const v = getComputedStyle(document.body).getPropertyValue('--p-accent').trim();
    ctx.fillStyle = '#010203'; if (v) ctx.fillStyle = v;
    accent = v && ctx.fillStyle !== '#010203' ? v : '#D6A83E';
  }

  /* ——— Rendu ——— */
  let raf = 0, running = false, visible = true, docked = false, firstDock = true, last = 0, time = 0, intro = 0, nF = 0;
  function frame(now) {
    if (!docked || !visible || document.hidden) { running = false; return; }
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; time += dt * (reduced ? .3 : 1);
    const ck = reduced ? 1 : 1 - Math.exp(-dt * 3.2), hk = 1 - Math.exp(-dt * 4);
    cam.x += (camT.x - cam.x) * ck; cam.z += (camT.z - cam.z) * ck; cam.s = Math.exp(Math.log(cam.s) + (Math.log(camT.s) - Math.log(cam.s)) * ck);
    intro = reduced ? 1 : Math.min(1, intro + dt / 1.8);
    if (vel && !ptr.size) { camT.x = panX(camT.x + vel.x * dt); camT.z = panZ(camT.z + vel.z * dt); cam.x = camT.x; cam.z = camT.z; const f = Math.exp(-dt * 4.2); vel.x *= f; vel.z *= f; if (Math.hypot(vel.x, vel.z) < .03) vel = null; }
    lan.a += ((ptr.size ? 0 : lan.on) - lan.a) * (1 - Math.exp(-dt * 5));
    ALL.forEach(n => { const t = hov === n.id ? Math.max(n.hiT, .9) : n.hiT; n.hi = clamp(n.hi + (t - n.hi) * hk, 0, 1); });
    links.forEach(l => { const t = hov && (l.A.id === hov || l.B.id === hov) ? 1 : l.hiT; l.hi = clamp(l.hi + (t - l.hi) * hk, 0, 1); l.prog = reduced ? 1 : Math.min(1, l.prog + dt / 1.1); });
    try { if (nF++ % 20 === 0) readAccent(); draw(); place(); }
    catch (e) { console.warn('[réseau]', e); }
    finally { raf = requestAnimationFrame(frame); }
  }
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(.5, r), 0, 7); };
  const hid = l => (state.hide.offre && l.A.k === 'o') || (state.hide.demande && l.B.k === 'd');
  let CO = '#6CC58C', CD = '#F2C94C', CR = '#B095F0', CB = '#6AAEF0';
  const readMk = () => { if (MQ) { CO = MQ.col('offre'); CD = MQ.col('demande'); CR = MQ.col('recherche'); CB = MQ.col('connexion'); } };
  readMk();
  function draw() {
    OX = ins.left + (W - ins.left) / 2; OY = (ins.top || 0) + (H - ins.bottom - (ins.top || 0)) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const sz = clamp(cam.s / 68, .9, 2.6), rev = intro * 1.4, r = W > 2 ? cam.s / homeS() : 1, kz = clamp(cam.s / 90, .8, 2.4), li = intro;
    const LR = mobile ? 0 : 150, LR2 = LR * LR, la = lan.a, lx = lan.x, ly = lan.y;
    const near = (x, y) => { if (la < .01) return 0; const d2 = (x - lx) * (x - lx) + (y - ly) * (y - ly); return d2 < LR2 ? (1 - d2 / LR2) * la : 0; };
    const ring = R => { let on = false; R.pts.forEach(([x, z]) => { if (!proj(x, 0, z)) return; if (on) ctx.lineTo(P.x, P.y); else { ctx.moveTo(P.x, P.y); on = true; } }); ctx.closePath(); };
    const segs = (R, f) => { let pen = false; const n = R.pts.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (!(R[f][i] && R[f][j])) { pen = false; continue; } if (!pen) { if (!proj(R.pts[i][0], 0, R.pts[i][1])) continue; ctx.moveTo(P.x, P.y); pen = true; } if (proj(R.pts[j][0], 0, R.pts[j][1])) ctx.lineTo(P.x, P.y); } };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // la terre : voisins plus sombres, le pays plus chaud ; la côte reçoit un liseré clair (le plateau, l'eau peu profonde)
    if (real) {
      ctx.strokeStyle = '#D8CCB6'; ctx.beginPath(); civ.forEach(R => segs(R, 'co')); ctxLand.forEach(L => L.rings.forEach(R => segs(R, 'co')));
      [[24, .03], [12, .045], [4, .07]].forEach(([w, a]) => { ctx.globalAlpha = a * li; ctx.lineWidth = w * kz; ctx.stroke(); });
      ctx.globalAlpha = .55 * li; ctx.fillStyle = '#0f0c09'; ctx.beginPath(); ctxLand.forEach(L => L.rings.forEach(ring)); ctx.fill('evenodd');
    }
    ctx.globalAlpha = .4 * li; ctx.fillStyle = '#2E261D'; ctx.beginPath(); civ.forEach(ring); ctx.fill('evenodd');
    // le grain : gros de loin, fin de près (le grain fin prend le relais à partir du district)
    const fo = sstep(1.5, 2.5, r);
    for (let b = 0; b < NB; b++) {
      const D = dots[b], ba = BALPHA[b] * (b < 5 ? 1 - fo * .8 : 1); if (!D || ba < .01) continue; ctx.fillStyle = BCOL[b]; ctx.globalAlpha = ba;
      for (let i = 0; i < D.length; i += 3) {
        if (D[i + 2] > rev) continue;
        const rx = D[i] - cam.x, rz = D[i + 1] - cam.z, d = DEPTH - rz * ST; if (d < .6) continue;
        const k = DEPTH / d, x = OX + rx * cam.s * k, y = OY + rz * CT * cam.s * k; if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        const s = sz * k, f = b < 5 ? near(x, y) : 0;
        if (f > 0) { const dx = x - lx, dy = y - ly, dd = Math.hypot(dx, dy) || 1, push = f * f * 6; ctx.globalAlpha = Math.min(1, ba + f * .55); ctx.fillRect(x + dx / dd * push - s / 2, y + dy / dd * push - s / 2, s * (1 + f * .5), s * (1 + f * .5)); ctx.globalAlpha = ba; }
        else ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    if (fo > .01) {
      const sf = clamp(cam.s / 150, .9, 2.2);
      for (let b = 0; b < 5; b++) {
        const D = fine[b]; if (!D) continue; ctx.fillStyle = BCOL[b]; ctx.globalAlpha = BALPHA[b] * fo;
        for (let i = 0; i < D.length; i += 2) {
          const rx = D[i] - cam.x, rz = D[i + 1] - cam.z, d = DEPTH - rz * ST; if (d < .6) continue;
          const k = DEPTH / d, x = OX + rx * cam.s * k, y = OY + rz * CT * cam.s * k; if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
          const s = sf * k; ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    }
    // l'eau : lacs remplis, fleuves en trait fin (gris-vert : le bleu reste réservé aux offres et demandes compatibles)
    if (lakes.length || rivers.length) {
      const wc = '#8FA7A1', wk = clamp(cam.s / 120, .8, 2);
      ctx.globalAlpha = .2 * li; ctx.fillStyle = '#5F7671'; ctx.beginPath(); lakes.forEach(l => l.rings.forEach(R => ring({ pts: R }))); ctx.fill('evenodd');
      ctx.globalAlpha = .42 * li; ctx.strokeStyle = wc; ctx.lineWidth = .8; ctx.stroke();
      rivers.forEach(R => { ctx.globalAlpha = (R.w > 1 ? .42 : .3) * li; ctx.lineWidth = R.w * wk; ctx.beginPath(); let on = false; R.pts.forEach(([x, z]) => { if (!proj(x, 0, z)) return; if (on) ctx.lineTo(P.x, P.y); else { ctx.moveTo(P.x, P.y); on = true; } }); ctx.stroke(); });
    }
    // frontières : entre voisins en trait fin ; celle du pays en tirets, la côte en trait plein (convention cartographique)
    if (real) { ctx.globalAlpha = .18 * li; ctx.strokeStyle = SABLE; ctx.lineWidth = 1; ctx.beginPath(); ctxLand.forEach(L => L.rings.forEach(R => segs(R, 'nb'))); ctx.stroke(); }
    ctx.strokeStyle = '#E4D9C4'; ctx.lineWidth = clamp(cam.s / 110, 1, 1.7);
    ctx.globalAlpha = .5 * li; ctx.beginPath(); civ.forEach(R => segs(R, 'co')); ctx.stroke();
    if (real) { ctx.globalAlpha = .45 * li; ctx.setLineDash([5, 4]); ctx.beginPath(); civ.forEach(R => segs(R, 'bd')); ctx.stroke(); ctx.setLineDash([]); }
    // chefs-lieux des districts : anneau ; Abidjan et Yamoussoukro, anneau pointé
    const ci = sstep(.3, .9, intro);
    CITY.forEach(c => {
      if (!proj(c.x, 0, c.z)) return; ctx.globalAlpha = (c.big ? .85 : .55) * ci; ctx.strokeStyle = IVOIRE; ctx.lineWidth = 1;
      circle(P.x, P.y, c.big ? 3.6 : 2.5); ctx.stroke(); if (c.big) { ctx.fillStyle = IVOIRE; circle(P.x, P.y, 1.3); ctx.fill(); }
    });

    // fils : une offre et une demande du même produit, tirés depuis les deux bouts
    const ri = sstep(.3, .85, intro); ctx.lineCap = 'round';
    links.forEach(l => {
      if (state.hide.connexion || hid(l) || l.hi < .02 || ri <= 0) return; const S = l.S, half = Math.max(1, Math.floor(SEG / 2 * l.prog * ri));
      if (!proj(S[0], S[1], S[2])) return; const ax = P.x, ay = P.y;
      if (!proj(S[SEG * 3], S[SEG * 3 + 1], S[SEG * 3 + 2])) return;
      ctx.strokeStyle = CB; ctx.beginPath();
      for (let k = 0; k <= half; k++) if (proj(S[k * 3], S[k * 3 + 1], S[k * 3 + 2])) k ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y);
      for (let k = SEG; k >= SEG - half; k--) if (proj(S[k * 3], S[k * 3 + 1], S[k * 3 + 2])) k === SEG ? ctx.moveTo(P.x, P.y) : ctx.lineTo(P.x, P.y);
      if (l.hi > .45) { ctx.globalAlpha = .1 * l.hi; ctx.lineWidth = 6; ctx.stroke(); }
      ctx.globalAlpha = .06 + .55 * l.hi; ctx.lineWidth = .8 + 1 * l.hi; ctx.stroke();
    });
    if (ri > .6 && !state.hide.connexion) links.forEach(l => {
      if (hid(l) || l.hi < .05) return; const S = l.S;
      for (let j = 0; j < l.n; j++) {
        const sd = fract(l.A.seed * 13.7 + l.B.seed * 5.3 + j * .618), fromA = j % 2 === 0, sp = (.05 + .04 * fract(sd * 7.1)) * (.7 + .6 * l.hi);
        const u = fract(sd + time * sp) * .5, t = fromA ? u : 1 - u; if (u > l.prog * .5) continue;
        const f = t * SEG, i = Math.min(SEG - 1, Math.floor(f)), fr = f - i, a = i * 3, b = a + 3, off = (fract(sd * 3.3) - .5) * .05 * (1 - u * 2);
        if (!proj(S[a] + (S[b] - S[a]) * fr + l.nx * off, S[a + 1] + (S[b + 1] - S[a + 1]) * fr, S[a + 2] + (S[b + 2] - S[a + 2]) * fr + l.nz * off)) continue;
        ctx.globalAlpha = l.hi * sstep(0, .05, u) * (1 - sstep(.4, .5, u)); ctx.fillStyle = fromA ? CO : CD;
        const s = (1.2 + 1.5 * l.hi) * clamp(P.k, .8, 1.3); ctx.fillRect(P.x - s / 2, P.y - s / 2, s, s);
      }
      // point de rencontre
      if (l.hi > .5 && l.prog > .95 && proj(S[SEG / 2 * 3], S[SEG / 2 * 3 + 1], S[SEG / 2 * 3 + 2])) {
        const ph = fract(time * .5 + l.A.seed); ctx.globalAlpha = .55 * l.hi * (1 - ph); ctx.strokeStyle = CB; ctx.lineWidth = 1; circle(P.x, P.y, 2 + 6 * ph); ctx.stroke();
      }
    });

    const zi = sstep(.15, .7, intro);
    if (!state.hide.offre) OF.forEach(p => {
      if (!proj(p.x, 0, p.z)) return; const k = clamp(P.k, .85, 1.25), r = volR(p.q) * (.7 + .6 * p.hi) * k * clamp(cam.s / 90, .8, 1.8) + .6;
      const nf = near(P.x, P.y), off = filtering && !p.lit, a = Math.min(1, (.45 + .55 * p.hi) * zi + nf * .4), sel = p.id === state.sel, hv = hov === p.id;
      if (MQ) MQ.draw(ctx, 'offre', P.x, P.y, r * (1 + nf * .35), { a, off, sel, halo: sel || hv ? 1 : 0 });
      else { ctx.globalAlpha = a; ctx.fillStyle = CO; circle(P.x, P.y, r); ctx.fill(); }
    });
    if (!state.hide.demande) DM.forEach(d => {
      if (!proj(d.x, 0, d.z)) return; const k = clamp(P.k, .85, 1.25), r = volR(d.q) * (.7 + .6 * d.hi) * k * clamp(cam.s / 90, .8, 1.8) + 1;
      const nf = near(P.x, P.y), off = filtering && !d.lit, a = Math.min(1, (.45 + .55 * d.hi) * zi + nf * .4), sel = d.id === state.sel, hv = hov === d.id;
      if (MQ) MQ.draw(ctx, 'demande', P.x, P.y, r, { a, off, sel, halo: sel || hv ? 1 : 0 });
      else { ctx.globalAlpha = a; ctx.fillStyle = CD; ctx.fillRect(P.x - r, P.y - r, r * 2, r * 2); }
      // une demande publiée attend une réponse : une onde carrée discrète, seulement quand elle est en avant
      if (d.hi > .5 && !off && MQ) { const ph = fract(time * .35 + d.seed); ctx.globalAlpha = (1 - ph) * .5 * d.hi * zi; ctx.strokeStyle = CD; ctx.lineWidth = 1; MQ.path(ctx, 'demande', P.x, P.y, r + 3 + 14 * ph); ctx.stroke(); }
    });
    if (me.on && proj(me.x, 0, me.z)) {
      if (state.searching && !state.hide.recherche && MQ) {
        // votre recherche en cours : triangle violet à l'endroit choisi (« Autour de moi » ou lieu tapé)
        MQ.draw(ctx, 'recherche', P.x, P.y, 6, { a: zi, sel: true, halo: .8 });
        const ph = fract(time * .6); ctx.globalAlpha = (1 - ph) * .6 * zi; ctx.strokeStyle = CR; ctx.lineWidth = 1; MQ.path(ctx, 'recherche', P.x, P.y, 9 + 16 * ph); ctx.stroke();
      } else {
        ctx.globalAlpha = zi; ctx.fillStyle = IVOIRE; circle(P.x, P.y, 4.5); ctx.fill();
        const ph = fract(time * .6); ctx.globalAlpha = (1 - ph) * .7 * zi; ctx.strokeStyle = IVOIRE; ctx.lineWidth = 1; circle(P.x, P.y, 7 + 18 * ph); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  const put = (el, x, y, show, o = 1) => { if (show) el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; el.style.opacity = show ? o : 0; el.style.visibility = show ? 'visible' : 'hidden'; };
  function place() {
    const card = !mode.interactive, kept = [], z = sstep(.4, 1, intro), items = [];
    const hit = r => r.x < 4 || r.y < 4 || r.x + r.w > W - 4 || r.y + r.h > H - 4 || kept.some(k => r.x < k.x + k.w && k.x < r.x + r.w && r.y < k.y + k.h && k.y < r.y + r.h);
    if (me.on && proj(me.x, 0, me.z)) items.push({ el: meEl, x: P.x, y: P.y, pri: 6, w: meEl.textContent.length * 8.4 + 30 }); else put(meEl, 0, 0, false);
    ALL.forEach(n => {
      const pri = n.id === state.sel ? 5 : hov === n.id ? 4.5 : n.hi > .6 ? 3 + (n.k === 'd' ? .2 : 0) : (card || filtering) ? -1 : 1;
      if (pri < 0 || (n.k === 'd' ? state.hide.demande : state.hide.offre) || !proj(n.x, 0, n.z)) { put(n.el, 0, 0, false); return; }
      items.push({ el: n.el, x: P.x, y: P.y, pri, zone: n.regionSlug, w: (n.el.firstChild.textContent.length + n.el.lastChild.textContent.length) * 7.8 + 38 });
    });
    const r = W > 2 ? cam.s / homeS() : 1, need = card ? 6 : r < 1.3 ? 5 : r < 1.9 ? 3 : 0;
    CITY.forEach(c => { if (c.pri < need || !proj(c.x, 0, c.z)) { put(c.el, 0, 0, false); return; } items.push({ el: c.el, x: P.x, y: P.y, pri: .2 + c.pri / 20, city: c.slug, w: c.cap.length * 6.6 + 18 }); });
    const named = new Set(); // un district déjà nommé par une offre ou une demande ne répète pas son chef-lieu
    items.sort((a, b) => b.pri - a.pri).forEach(it => {
      if (it.city && named.has(it.city)) return put(it.el, 0, 0, false);
      let r = { x: it.x + 6, y: it.y - 12, w: it.w, h: 24 }, left = false;
      if (hit(r)) { const l = { x: it.x - 6 - it.w, y: it.y - 12, w: it.w, h: 24 }; if (!hit(l)) { r = l; left = true; } else if (it.pri < 4) return put(it.el, 0, 0, false); }
      it.el.classList.toggle('l', left); kept.push(r); if (it.zone) named.add(it.zone); put(it.el, it.x, it.y, z > .01, z);
    });
    const lakeAt = [];
    waterLbl.forEach(w => {
      const show = (w.lake ? r >= 1.15 : r >= 1.7) && !card && proj(w.x, 0, w.z) && P.x > 30 + ins.left && P.x < W - 30 && P.y > 24 + (ins.top || 0) && P.y < H - 24 - ins.bottom
        && (w.lake || !lakeAt.some(q => Math.abs(q[0] - P.x) < 110 && Math.abs(q[1] - P.y) < 26));
      if (show && w.lake) lakeAt.push([P.x, P.y]);
      put(w.el, P.x, P.y + (w.lake ? 0 : -10), show, .85 * z);
    });
    GEO.forEach(g => { const ok = proj(g.x, 0, g.z) && P.x > 40 + ins.left && P.x < W - 40 && P.y > 24 + (ins.top || 0) && P.y < H - 24 - ins.bottom; put(g.el, P.x, P.y, ok, .9 * z); });
    if (!card && W > 2) {
      // où regarde-t-on ? le pays, puis le district, puis les alentours du chef-lieu ; l'échelle suit le zoom
      const pk = cam.s / 111.32; let km = 5; for (const v of [5, 10, 20, 25, 50, 100, 200, 300]) if (v * pk <= 140) km = v;
      let where = 'Tout le pays';
      if (r >= 1.3 && r < 2.4 && !project) {
        // entre le pays et la ville : la partie du pays que l'on regarde (centre de la vue, en degrés)
        const lat = LAT0 - cam.z, lon = LON0 + cam.x / KX, ns = lat > 8.6 ? 'Nord' : lat < 6.4 ? 'Sud' : 'Centre', ew = lon < -6.3 ? 'ouest' : lon > -4.6 ? 'est' : '';
        where = (ew ? ns + '-' + ew : ns) + ' du pays';
      } else if (r >= 1.3 && CITY.length) {
        const c = CITY.reduce((a, b) => Math.hypot(b.x - cam.x, b.z - cam.z) < Math.hypot(a.x - cam.x, a.z - cam.z) ? b : a), de = (/^[AEIOUYÉÈ]/i.test(c.cap) ? "d'" : 'de ') + c.cap;
        const dx = cam.x - c.x, dz = cam.z - c.z, km = Math.hypot(dx, dz) * 111.32;
        if (km < 15) where = 'Autour ' + de;
        else { const D = ['à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest', 'au nord', 'au nord-est'], i = ((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8; where = `${Math.round(km / 5) * 5} km ${D[i]} ${de}`; }
      }
      if (where !== hud.w) { hWhere.textContent = where; hud.w = where; }
      if (km !== hud.km) { hKm.textContent = km + ' km'; hud.km = km; }
      hBar.style.width = (km * pk).toFixed(1) + 'px'; hud.style.left = (ins.left + 20) + 'px'; hud.style.bottom = (ins.bottom + 20) + 'px'; hud.style.opacity = z;
    }
  }

  function resize() {
    const r = root.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (pending && W > 1) { const [a, b] = pending; pending = null; fitPts(a, b); }
    else if (atHome && W > 1) fitHome();
    else if (W > 1 && camT.s < minS()) camT.s = minS();
    wake();
  }
  function wake() { if (!running && docked && visible && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  const ro = new ResizeObserver(() => docked && resize()); ro.observe(root);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; wake(); }); io.observe(root);
  const vis = () => wake(); document.addEventListener('visibilitychange', vis);
  setState({});

  return {
    get docked() { return docked; },
    dock(el, m = {}) {
      mode = { interactive: true, onPick: null, onDemand: null, onZone: null, onHover: null, ...m };
      root.classList.toggle('int', !!mode.interactive); root.classList.toggle('card', !mode.interactive); root.classList.remove('on', 'grab');
      el.appendChild(root); docked = true; ins = { left: 0, bottom: 0, top: 0 }; resize();
      const f = firstDock; firstDock = false;
      if (f) { fitHome(); Object.assign(cam, camT); cam.s *= .82; intro = 0; }
      visible = true; wake(); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
      return f;
    },
    undock() { if (!docked) return; docked = false; ptr.clear(); gd = null; hov = null; root.classList.remove('on', 'grab'); root.remove(); },
    setState,
    setInsets(o) { ins = { ...ins, ...o }; wake(); },
    home() { fitHome(); wake(); },
    zoom(f) { camT.s = clamp(camT.s / f, minS(), maxS()); atHome = false; vel = null; wake(); },
    counts() { return { offre: OF.length, demande: DM.length, connexion: links.filter(l => l.B !== me).length, recherche: state.searching && me.on ? 1 : 0 }; },
    focusProducer(id) { const n = byId[id]; if (!n) return; fitPts(withLinks([n]), { min: .9 }); wake(); },
    focusZone(slug) { const pts = ALL.filter(n => n.regionSlug === slug), z = ZN.find(q => q.slug === slug); fitPts(pts.length ? pts : z ? [z] : [], { min: 1.6 }); wake(); },
    focusUser() { if (!me.on) return; const n = OF.filter(p => p.lit).sort((a, b) => dist(a, me) - dist(b, me)).slice(0, 3); fitPts([me, ...n]); wake(); },
    fit(ids) { fitPts(withLinks(ids.map(id => byId[id]).filter(Boolean)).concat(me.on && filtering ? [me] : [])); wake(); },
    hover(id) { hov = id; ALL.forEach(n => n.el.classList.toggle('hov', n.id === id)); wake(); },
    links() { return links.map(l => ({ a: l.A.id, b: l.B.id === 'me' ? null : l.B.id, km: Math.round(l.len * 111) })); },
    on() {},
    destroy() { cancelAnimationFrame(raf); docked = false; ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis); root.remove(); },
  };
}
