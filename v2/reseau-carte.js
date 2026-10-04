// Marché de Gros CI — « Le réseau » : carte en points de la Côte d'Ivoire où l'offre et la demande se rencontrent.
// Point plein = une offre (producteur, coopérative, grossiste), cercle = une demande (restaurant, hôtel, commerçant…).
// Un fil relie une offre et une demande du même produit, d'une ville à l'autre : aucun point de passage obligé,
// aucune destination par défaut. Canvas 2D, sans bibliothèque ni réseau.
// API : dock / undock / setState / setInsets / home / zoom / focusProducer / focusZone / focusUser / fit / hover.
const OUT = [[-7.53,4.37],[-6.85,4.66],[-6.64,4.73],[-6.08,4.95],[-5.3,5.15],[-5.02,5.12],[-4.6,5.17],[-4.02,5.25],[-3.74,5.18],[-3.3,5.11],[-3.1,5.1],[-2.95,5.5],[-3.1,6.0],[-3.24,6.5],[-3.1,7.0],[-2.95,7.4],[-2.75,8.0],[-2.55,8.25],[-2.65,8.9],[-2.7,9.45],[-3.0,9.85],[-3.6,9.92],[-4.3,9.62],[-4.7,9.72],[-5.1,10.25],[-5.5,10.42],[-6.0,10.2],[-6.25,10.5],[-6.9,10.3],[-7.6,10.45],[-8.0,10.2],[-8.2,9.8],[-8.1,9.3],[-7.85,8.8],[-8.2,8.45],[-8.47,7.6],[-8.3,7.2],[-7.9,6.75],[-7.55,6.2],[-7.4,5.7],[-7.6,5.1]];
const GEO = [['GOLFE DE GUINÉE', 4.2, -5.4], ['LIBÉRIA', 6.3, -9.0], ['GUINÉE', 9.6, -9.0], ['MALI', 10.95, -6.9], ['BURKINA FASO', 10.9, -4.0], ['GHANA', 7.4, -2.05]];
const LON0 = -5.45, LAT0 = 7.4, KX = Math.cos(7.5 * Math.PI / 180), TILT = .5, CT = Math.cos(TILT), ST = Math.sin(TILT), DEPTH = 7, SEG = 32;
const XZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), fract = x => x - Math.floor(x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
const IVOIRE = '#F5F0E6', SABLE = '#B9AD98';
const volR = q => 1.5 + 1.05 * Math.log10(1 + (q || 0) / 40);

export function create({ data, reduced = false }) {
  const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  const root = document.createElement('div'); root.className = 'tj-world';
  const cv = document.createElement('canvas'); cv.className = 'tj-cv'; cv.setAttribute('aria-hidden', 'true');
  const layer = document.createElement('div'); layer.className = 'tj-labels';
  root.append(cv, layer);
  const ctx = cv.getContext('2d'); if (!ctx) return null;

  /* ——— Terre en points ——— */
  const poly = OUT.map(([lo, la]) => XZ(la, lo));
  const inside = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; };
  const NB = 6, BCOL = [...Array(5)].map((_, i) => mixHex('#86A483', '#D2B17C', i / 4)).concat(['#8C806C']), BALPHA = [.42, .44, .46, .48, .5, .09];
  const buckets = [...Array(NB)].map(() => []), step = mobile ? .082 : .056;
  for (let x = -3.9; x <= 3.9; x += step) for (let z = -3.9; z <= 3.9; z += step) {
    const jx = x + (Math.random() - .5) * step * .4, jz = z + (Math.random() - .5) * step * .4, ins = inside(jx, jz);
    if (!ins && Math.random() > .17) continue;
    buckets[ins ? Math.round(clamp((1.6 - jz) / 4.8, 0, 1) * 4) : 5].push(jx, jz, Math.random());
  }
  const dots = buckets.map(a => new Float32Array(a));

  /* ——— Acteurs du marché ——— */
  const node = (o, k) => { const [x, z] = XZ(o.lat, o.lon); return { ...o, k, x, z, hi: .3, hiT: .3, seed: Math.random(), q: 0, lit: false }; };
  const OF = (data.producers || []).map(p => node(p, 'o'));
  const DM = (data.demands || []).map(d => node(d, 'd'));
  const ALL = OF.concat(DM), byId = Object.fromEntries(ALL.map(n => [n.id, n]));
  const ZN = (data.zones || []).map(z => { const [x, zz] = XZ(z.lat, z.lon); return { ...z, x, z: zz }; });
  const me = { x: 0, z: 0, on: false, k: 'u', id: 'me', hi: 1, seed: .37 };
  let state = { hl: null, products: null, sel: null, zone: null, user: null, userLabel: 'Vous', labels: {} }, hov = null, links = [], filtering = false;
  let mode = { interactive: true, onPick: null, onDemand: null, onZone: null };
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
  GEO.forEach(g => { const [x, z] = XZ(g[1], g[2]); g.x = x; g.z = z; g.el = mk('tj-geo'); g.el.textContent = g[0]; });
  ALL.forEach(n => {
    n.el = mk('tj-pin' + (n.k === 'd' ? ' d' : ''), 'button'); n.el.innerHTML = '<b></b><small></small>';
    n.el.setAttribute('aria-label', n.k === 'd' ? `Demande : ${n.name}, ${n.city}` : `Offre : ${n.name}, ${n.city}`);
    n.el.onclick = () => pickNode(n);
    n.el.onmouseenter = () => { hov = n.id; wake(); }; n.el.onmouseleave = () => { if (hov === n.id) hov = null; };
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
    if (state.user) { const [x, z] = XZ(state.user[0], state.user[1]); me.x = x; me.z = z; me.on = true; } else me.on = false;
    compute(); labelsTxt(); wake();
  }

  /* ——— Caméra (vue inclinée, perspective douce) ——— */
  const cam = { x: 0, z: 0, s: 80 }, camT = { x: 0, z: 0, s: 80 };
  let W = 0, H = 0, dpr = 1, ins = { left: 0, bottom: 0 }, pending = null, OX = 0, OY = 0;
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
    const aw = Math.max(80, W - ins.left - pad * 2), ah = Math.max(80, H - ins.bottom - pad * 2);
    camT.x = (x0 + x1) / 2; camT.z = (z0 + z1) / 2 + h * .05; camT.s = clamp(Math.min(aw / w, ah / (h * CT)), 28, 460);
  }
  const fitHome = () => fitPts(poly.map(([x, z]) => ({ x, z })), { pad: mobile ? 14 : 40 });
  const withLinks = pts => { const s = new Set(pts); links.forEach(l => { if (s.has(l.A) || s.has(l.B)) { s.add(l.A); s.add(l.B); } }); return [...s]; };

  /* ——— Gestes ——— */
  const ptr = new Map(); let gd = null;
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function pick(x, y) {
    let best = null, bd = mobile ? 30 : 22;
    ALL.forEach(n => { if (n.hi < .08 || !proj(n.x, 0, n.z)) return; const d = Math.hypot(P.x - x, P.y - y); if (d < bd) { bd = d; best = n; } });
    return best;
  }
  cv.addEventListener('pointerdown', e => { const l = local(e); ptr.set(e.pointerId, l); if (ptr.size === 1) gd = { x: l.x, y: l.y, moved: 0 }; if (mode.interactive) { try { cv.setPointerCapture(e.pointerId); } catch (_) {} } });
  cv.addEventListener('pointermove', e => {
    const l = local(e);
    if (!ptr.has(e.pointerId)) { if (e.pointerType === 'mouse') { const n = pick(l.x, l.y); cv.style.cursor = n ? 'pointer' : ''; const id = n ? n.id : null; if (id !== hov) { hov = id; ALL.forEach(q => q.el.classList.toggle('hov', q.id === id)); wake(); } } return; }
    const prev = ptr.get(e.pointerId); ptr.set(e.pointerId, l);
    if (!mode.interactive) return;
    if (ptr.size === 1 && gd) {
      const dx = l.x - prev.x, dy = l.y - prev.y; gd.moved += Math.abs(dx) + Math.abs(dy);
      if (gd.moved > 5) root.classList.add('grab');
      camT.x = clamp(camT.x - dx / cam.s, -4, 4); camT.z = clamp(camT.z - dy / (cam.s * CT), -4, 4); cam.x = camT.x; cam.z = camT.z; wake();
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gd && gd.d) { camT.s = clamp(camT.s * d / gd.d, 28, 900); cam.s = camT.s; wake(); }
      if (gd) { gd.d = d; gd.moved = 99; }
    }
  });
  const up = e => {
    const had = ptr.has(e.pointerId); ptr.delete(e.pointerId); root.classList.remove('grab');
    if (had && gd && gd.moved < 6 && ptr.size === 0) { const l = local(e), n = pick(l.x, l.y); if (n) pickNode(n); }
    if (ptr.size === 0) gd = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    if (!mode.interactive) return; e.preventDefault();
    const l = local(e), s = clamp(camT.s * Math.exp(-e.deltaY * .0016), 28, 900);
    const wx = camT.x + (l.x - OX) / camT.s, wz = camT.z + (l.y - OY) / (camT.s * CT);
    camT.x = clamp(wx - (l.x - OX) / s, -4, 4); camT.z = clamp(wz - (l.y - OY) / (s * CT), -4, 4); camT.s = s; wake();
  }, { passive: false });

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
    ALL.forEach(n => { const t = hov === n.id ? Math.max(n.hiT, .9) : n.hiT; n.hi = clamp(n.hi + (t - n.hi) * hk, 0, 1); });
    links.forEach(l => { const t = hov && (l.A.id === hov || l.B.id === hov) ? 1 : l.hiT; l.hi = clamp(l.hi + (t - l.hi) * hk, 0, 1); l.prog = reduced ? 1 : Math.min(1, l.prog + dt / 1.1); });
    try { if (nF++ % 20 === 0) readAccent(); draw(); place(); }
    catch (e) { console.warn('[réseau]', e); }
    finally { raf = requestAnimationFrame(frame); }
  }
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(.5, r), 0, 7); };
  function draw() {
    OX = ins.left + (W - ins.left) / 2; OY = (H - ins.bottom) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const sz = clamp(cam.s / 68, .9, 2.6), rev = intro * 1.4;
    for (let b = 0; b < NB; b++) {
      const D = dots[b]; ctx.fillStyle = BCOL[b]; ctx.globalAlpha = BALPHA[b];
      for (let i = 0; i < D.length; i += 3) {
        if (D[i + 2] > rev) continue;
        const rx = D[i] - cam.x, rz = D[i + 1] - cam.z, d = DEPTH - rz * ST; if (d < .6) continue;
        const k = DEPTH / d, x = OX + rx * cam.s * k, y = OY + rz * CT * cam.s * k; if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        const s = sz * k; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = .2 * intro; ctx.strokeStyle = '#D8CCB6'; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.beginPath();
    poly.forEach(([x, z], i) => { if (proj(x, 0, z)) i ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y); }); ctx.closePath(); ctx.stroke();

    // fils : une offre et une demande du même produit, tirés depuis les deux bouts
    const ri = sstep(.3, .85, intro); ctx.lineCap = 'round';
    links.forEach(l => {
      if (l.hi < .02 || ri <= 0) return; const S = l.S, half = Math.max(1, Math.floor(SEG / 2 * l.prog * ri));
      if (!proj(S[0], S[1], S[2])) return; const ax = P.x, ay = P.y;
      if (!proj(S[SEG * 3], S[SEG * 3 + 1], S[SEG * 3 + 2])) return;
      const g = ctx.createLinearGradient(ax, ay, P.x, P.y); g.addColorStop(0, accent); g.addColorStop(1, IVOIRE);
      ctx.strokeStyle = g; ctx.beginPath();
      for (let k = 0; k <= half; k++) if (proj(S[k * 3], S[k * 3 + 1], S[k * 3 + 2])) k ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y);
      for (let k = SEG; k >= SEG - half; k--) if (proj(S[k * 3], S[k * 3 + 1], S[k * 3 + 2])) k === SEG ? ctx.moveTo(P.x, P.y) : ctx.lineTo(P.x, P.y);
      if (l.hi > .45) { ctx.globalAlpha = .1 * l.hi; ctx.lineWidth = 6; ctx.stroke(); }
      ctx.globalAlpha = .06 + .55 * l.hi; ctx.lineWidth = .8 + 1 * l.hi; ctx.stroke();
    });
    if (ri > .6) links.forEach(l => {
      if (l.hi < .05) return; const S = l.S;
      for (let j = 0; j < l.n; j++) {
        const sd = fract(l.A.seed * 13.7 + l.B.seed * 5.3 + j * .618), fromA = j % 2 === 0, sp = (.05 + .04 * fract(sd * 7.1)) * (.7 + .6 * l.hi);
        const u = fract(sd + time * sp) * .5, t = fromA ? u : 1 - u; if (u > l.prog * .5) continue;
        const f = t * SEG, i = Math.min(SEG - 1, Math.floor(f)), fr = f - i, a = i * 3, b = a + 3, off = (fract(sd * 3.3) - .5) * .05 * (1 - u * 2);
        if (!proj(S[a] + (S[b] - S[a]) * fr + l.nx * off, S[a + 1] + (S[b + 1] - S[a + 1]) * fr, S[a + 2] + (S[b + 2] - S[a + 2]) * fr + l.nz * off)) continue;
        ctx.globalAlpha = l.hi * sstep(0, .05, u) * (1 - sstep(.4, .5, u)); ctx.fillStyle = fromA ? accent : IVOIRE;
        const s = (1.2 + 1.5 * l.hi) * clamp(P.k, .8, 1.3); ctx.fillRect(P.x - s / 2, P.y - s / 2, s, s);
      }
      // point de rencontre
      if (l.hi > .5 && l.prog > .95 && proj(S[SEG / 2 * 3], S[SEG / 2 * 3 + 1], S[SEG / 2 * 3 + 2])) {
        const ph = fract(time * .5 + l.A.seed); ctx.globalAlpha = .55 * l.hi * (1 - ph); ctx.strokeStyle = IVOIRE; ctx.lineWidth = 1; circle(P.x, P.y, 2 + 6 * ph); ctx.stroke();
      }
    });

    const zi = sstep(.15, .7, intro);
    OF.forEach(p => {
      if (!proj(p.x, 0, p.z)) return; const k = clamp(P.k, .85, 1.25), r = volR(p.q) * (.7 + .6 * p.hi) * k * clamp(cam.s / 90, .8, 1.8);
      ctx.globalAlpha = (.28 + .72 * p.hi) * zi; ctx.fillStyle = p.hi > .5 ? accent : SABLE; circle(P.x, P.y, r); ctx.fill();
    });
    DM.forEach(d => {
      if (!proj(d.x, 0, d.z)) return; const k = clamp(P.k, .85, 1.25), r = volR(d.q) * (.7 + .6 * d.hi) * k * clamp(cam.s / 90, .8, 1.8) + 1;
      ctx.globalAlpha = (.3 + .7 * d.hi) * zi; ctx.strokeStyle = IVOIRE; ctx.lineWidth = 1.4; circle(P.x, P.y, r); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
      if (d.hi > .5) { const ph = fract(time * .35 + d.seed); ctx.globalAlpha = (1 - ph) * .6 * d.hi * zi; ctx.lineWidth = 1; circle(P.x, P.y, r + 3 + 16 * ph); ctx.stroke(); }
    });
    if (me.on && proj(me.x, 0, me.z)) {
      ctx.globalAlpha = zi; ctx.fillStyle = IVOIRE; circle(P.x, P.y, 4.5); ctx.fill();
      const ph = fract(time * .6); ctx.globalAlpha = (1 - ph) * .7 * zi; ctx.strokeStyle = IVOIRE; ctx.lineWidth = 1; circle(P.x, P.y, 7 + 18 * ph); ctx.stroke();
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
      if (pri < 0 || !proj(n.x, 0, n.z)) { put(n.el, 0, 0, false); return; }
      items.push({ el: n.el, x: P.x, y: P.y, pri, w: (n.el.firstChild.textContent.length + n.el.lastChild.textContent.length) * 7.8 + 38 });
    });
    items.sort((a, b) => b.pri - a.pri).forEach(it => {
      let r = { x: it.x + 6, y: it.y - 12, w: it.w, h: 24 }, left = false;
      if (hit(r)) { const l = { x: it.x - 6 - it.w, y: it.y - 12, w: it.w, h: 24 }; if (!hit(l)) { r = l; left = true; } else if (it.pri < 4) return put(it.el, 0, 0, false); }
      it.el.classList.toggle('l', left); kept.push(r); put(it.el, it.x, it.y, z > .01, z);
    });
    GEO.forEach(g => { const ok = proj(g.x, 0, g.z) && P.x > 30 && P.x < W - 30 && P.y > 20 && P.y < H - 20; put(g.el, P.x, P.y, ok && cam.s < 200, .9 * z); });
  }

  function resize() {
    const r = root.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (pending && W > 1) { const [a, b] = pending; pending = null; fitPts(a, b); }
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
      mode = { interactive: true, onPick: null, onDemand: null, onZone: null, ...m };
      root.classList.toggle('int', !!mode.interactive); root.classList.toggle('card', !mode.interactive); root.classList.remove('on', 'grab');
      el.appendChild(root); docked = true; ins = { left: 0, bottom: 0 }; resize();
      const f = firstDock; firstDock = false;
      if (f) { fitHome(); Object.assign(cam, camT); cam.s *= .82; intro = 0; }
      visible = true; wake(); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
      return f;
    },
    undock() { if (!docked) return; docked = false; ptr.clear(); gd = null; hov = null; root.classList.remove('on', 'grab'); root.remove(); },
    setState,
    setInsets(o) { ins = { ...ins, ...o }; wake(); },
    home() { fitHome(); wake(); },
    zoom(f) { camT.s = clamp(camT.s / f, 28, 900); wake(); },
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
