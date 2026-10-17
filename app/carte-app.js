/* Marché de Gros — carte du réseau (application mobile).
   Canvas 2D, frontières réelles Natural Earth 1:50m (world-atlas, chargé à la demande ; repli sur le contour simplifié hors ligne).
   Caméra : glisser, pincer, double-toucher, molette ; vols animés (dézoom puis zoom) vers une ville ; inertie.
   Distances : à vol d'oiseau (haversine), cercles 50 / 100 / 200 km autour de vous, échelle qui suit le zoom.
   Eau : fleuves et lacs Natural Earth 1:10m (vendor/ci-hydro.json) ; côte en trait plein, frontière terrestre en tirets ;
   un repère dit ce que l'on regarde (le pays, une partie du pays, les alentours d'un chef-lieu) — même langage que la carte du site.
   Positions des publications : chef-lieu du district (aucune position inventée).
   Octobre 2026 : la carte occupe tout l'écran (opt.insets() = place prise en haut et en bas par l'interface), sans frontières
   ni pays voisins ; marqueurs parlants : 🧺 offres (vert), 🛒 demandes (jaune), 🔥 forte demande posée par l'administration,
   chacun avec son nombre. */
(function () {
  'use strict';
  const D2R = Math.PI / 180;
  const MY = lat => -Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) / D2R;
  const NEIGH = { '430': ['LIBÉRIA', 6.7, -9.55], '324': ['GUINÉE', 9.75, -9.1], '466': ['MALI', 11.0, -6.9], '854': ['BURKINA FASO', 10.95, -3.9], '288': ['GHANA', 7.4, -1.75] };
  const PRIO = { abidjan: 9, yamoussoukro: 8, 'vallee-du-bandama': 8, savanes: 6, 'bas-sassandra': 6, 'sassandra-marahoue': 5, montagnes: 5, zanzan: 4, denguele: 4, 'goh-djiboua': 4, comoe: 3, woroba: 3, lacs: 2, lagunes: 1 };
  let geoP = null, hydroP = null;
  const hydro = () => hydroP || (hydroP = fetch('vendor/ci-hydro.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { hydroP = null; throw e; }));
  const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  function geo() {
    return geoP || (geoP = Promise.all([
      fetch('vendor/countries-50m.json').then(r => r.json()),
      window.topojson ? 0 : script('vendor/topojson-client.min.js')
    ]).then(([t]) => {
      const fs = window.topojson.feature(t, t.objects.countries).features;
      const pick = id => { const f = fs.find(x => String(x.id) === id); if (!f) return null; const g = f.geometry; return g.type === 'Polygon' ? [g.coordinates] : g.coordinates; };
      const n = {}; Object.keys(NEIGH).forEach(k => { n[k] = pick(k); });
      const key = q => q[0].toFixed(3) + ',' + q[1].toFixed(3), shared = new Set();
      Object.values(n).forEach(pp => pp && pp.forEach(poly => poly.forEach(ring => ring.forEach(q => shared.add(key(q))))));
      const c = pick('384'); return { civ: c, n, bd: c ? c.map(poly => poly.map(ring => ring.map(q => shared.has(key(q))))) : null, real: true };
    }).catch(e => { geoP = null; throw e; }));
  }
  const W2 = polys => polys.map(poly => poly.map(ring => ring.map(p => [p[0], MY(p[1])])));
  const dest = (lat, lon, km, brg) => { const d = km / 6371, b = brg * D2R, f1 = lat * D2R, l1 = lon * D2R;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2)); return [f2 / D2R, l2 / D2R]; };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const RM = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mount(host, opt) {
    opt = opt || {};
    const A = window.MDGApp;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.style.touchAction = 'none'; host.style.userSelect = 'none';
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    const ins = () => { const i = opt.insets ? opt.insets() : null; return { t: (i && i.t) || 0, b: (i && i.b) || 0 }; };
    const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;right:10px;top:' + (ins().t + 10) + 'px;display:flex;flex-direction:column;gap:6px;z-index:2;transition:top .3s';
    const btn = (svg, lab, fn) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', lab); b.innerHTML = svg;
      b.style.cssText = 'width:40px;height:40px;border-radius:20px;border:1px solid rgba(245,240,230,.14);background:rgba(23,21,18,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#F5F0E6;display:flex;align-items:center;justify-content:center;padding:0';
      b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); fn(); }); ui.appendChild(b); return b; };
    const ic = d => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' + d + '</svg>';
    btn(ic('<path d="M12 5v14M5 12h14"/>'), 'Zoomer', () => zoomBy(1.8));
    btn(ic('<path d="M5 12h14"/>'), 'Dézoomer', () => zoomBy(1 / 1.8));
    btn(ic('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'), 'Tout le pays', () => { opt.onSelect && opt.onSelect(''); fly(home(), 900); });
    host.appendChild(ui);
    const note = document.createElement('div'); note.style.cssText = 'position:absolute;left:10px;top:' + (ins().t + 10) + 'px;font:500 10.5px Jost,sans-serif;letter-spacing:.06em;color:rgba(245,240,230,.55);pointer-events:none;z-index:2;max-width:60%';
    note.textContent = 'Chargement des frontières…'; host.appendChild(note);

    let W = 0, H = 0, dpr = 1, civ = null, civBd = null, nb = {}, lakes = [], rivers = [], real = false, bb = null, cam = { x: -5.5, y: MY(7.5), z: 40 }, anim = null, inert = null, raf = 0, dirty = true, data = { pts: {}, pairs: [], me: '', sel: '', zones: [] }, alive = true, t0 = performance.now();
    const fallback = () => { const o = (A.OUT || []).map(p => [p[0], p[1]]); return [[o.concat([o[0]])]]; };
    const setGeo = (c, n, r) => { civ = W2(c); nb = {}; Object.keys(n || {}).forEach(k => { if (n[k]) nb[k] = W2(n[k]); }); real = r;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; civ.forEach(p => p[0].forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }));
      bb = { x0, x1, y0, y1 }; dirty = true; };
    setGeo(fallback(), {}, false);
    geo().then(g => { if (!alive || !g.civ) return; setGeo(g.civ, g.n, true); civBd = g.bd; note.textContent = ''; kick(); }).catch(() => { note.textContent = 'Hors ligne : contour simplifié'; });

    hydro().then(h => { if (!alive) return; const w = pts => pts.map(q => [q[0], MY(q[1])]);
      lakes = h.lakes.map(l => l.p.map(w)); rivers = h.rivers.map(r => ({ w: r.r <= 5 ? 1.3 : r.r <= 7 ? 1 : .7, pts: w(r.p) })); dirty = true; kick(); }).catch(() => {});
    // vue d'ensemble : le pays tient dans la partie visible (entre l'interface du haut et celle du bas)
    const home = () => { const i = ins(), pad = 18, padX = 30, vh = Math.max(120, H - i.t - i.b), z = Math.min((W - padX * 2) / (bb.x1 - bb.x0), (vh - pad * 2 - 10) / (bb.y1 - bb.y0)); return { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 + ((i.b - i.t) / 2) / z, z }; };
    const zMin = () => home().z * .8, zMax = () => home().z * 4.5; // jusqu'au district : plus près ne montrerait rien de vrai
    const clampCam = c => { const h = home(); c.z = Math.max(zMin(), Math.min(zMax(), c.z)); const mx = (bb.x1 - bb.x0) * .6, my = (bb.y1 - bb.y0) * .6; c.x = Math.max(h.x - mx, Math.min(h.x + mx, c.x)); c.y = Math.max(h.y - my, Math.min(h.y + my, c.y)); return c; };
    const S = (wx, wy) => [(wx - cam.x) * cam.z + W / 2, (wy - cam.y) * cam.z + H / 2];
    const SL = (lat, lon) => S(lon, MY(lat));
    const toW = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];

    function resize() { const first = !W; W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight); dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); if (first) cam = home(); clampCam(cam); ui.style.top = note.style.top = (ins().t + 10) + 'px'; dirty = true; kick(); }
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null; ro ? ro.observe(host) : addEventListener('resize', resize);

    function fly(to, dur) {
      to = clampCam(Object.assign({}, to)); inert = null;
      if (RM()) { cam = to; dirty = true; kick(); return; }
      const fr = Object.assign({}, cam), dist = Math.hypot(to.x - fr.x, to.y - fr.y) * Math.min(fr.z, to.z), dip = Math.min(.9, dist / Math.max(W, H) * .9);
      const l0 = Math.log(fr.z), l1 = Math.log(to.z);
      anim = { t: performance.now(), dur: dur || 1000, step: k => { const e = ease(k);
        cam = { x: fr.x + (to.x - fr.x) * e, y: fr.y + (to.y - fr.y) * e, z: Math.exp(l0 + (l1 - l0) * e - dip * Math.sin(Math.PI * e)) }; } };
      kick();
    }
    function flyTo(slug, zf) { const r = A.REG[slug]; if (!r) return; const z = home().z * (zf || 2.4), i = ins(); fly({ x: r[1], y: MY(r[0]) + ((i.b - i.t) / 2) / z, z }, 1100); }
    function zoomBy(f, sx, sy) { if (sx == null) { sx = W / 2; sy = H / 2; } const w = toW(sx, sy), z = Math.max(zMin(), Math.min(zMax(), cam.z * f));
      fly({ x: w[0] - (sx - W / 2) / z, y: w[1] - (sy - H / 2) / z, z }, 420); }

    /* ——— gestes ——— */
    const P = new Map(); let g = null, lastTap = null;
    const rel = e => { const r = cv.getBoundingClientRect(), k = r.width / (cv.clientWidth || r.width) || 1; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; };
    cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (_) {} anim = null; inert = null; const p = rel(e); P.set(e.pointerId, p);
      if (P.size === 1) g = { k: 'pan', s: p, c: Object.assign({}, cam), moved: 0, t: performance.now(), v: [0, 0], lp: p, lt: performance.now() };
      else if (P.size === 2) { const [a, b] = [...P.values()]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; g = { k: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: cam.z, w: toW(m[0], m[1]), moved: 99 }; } });
    cv.addEventListener('pointermove', e => { if (!P.has(e.pointerId) || !g) return; const p = rel(e); P.set(e.pointerId, p);
      if (g.k === 'pan' && P.size === 1) { const dx = p[0] - g.s[0], dy = p[1] - g.s[1]; g.moved = Math.max(g.moved, Math.hypot(dx, dy));
        const now = performance.now(), dt = Math.max(1, now - g.lt); g.v = [(p[0] - g.lp[0]) / dt, (p[1] - g.lp[1]) / dt]; g.lp = p; g.lt = now;
        cam = clampCam({ x: g.c.x - dx / cam.z, y: g.c.y - dy / cam.z, z: cam.z }); dirty = true; kick(); }
      else if (g.k === 'pinch' && P.size >= 2) { const [a, b] = [...P.values()]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const z = Math.max(zMin(), Math.min(zMax(), g.z * d / g.d)); cam = clampCam({ x: g.w[0] - (m[0] - W / 2) / z, y: g.w[1] - (m[1] - H / 2) / z, z }); dirty = true; kick(); } });
    const up = e => { if (!P.has(e.pointerId)) return; const p = rel(e); P.delete(e.pointerId);
      if (g && g.k === 'pan' && P.size === 0) {
        if (g.moved < 7 && performance.now() - g.t < 350) {
          const now = performance.now();
          if (lastTap && now - lastTap.t < 320 && Math.hypot(p[0] - lastTap.p[0], p[1] - lastTap.p[1]) < 30) { lastTap = null; zoomBy(2, p[0], p[1]); }
          else { lastTap = { t: now, p }; const hit = hitTest(p[0], p[1]); setTimeout(() => { if (lastTap && lastTap.t === now) { lastTap = null; opt.onSelect && opt.onSelect(hit === data.sel ? '' : hit || ''); } }, 260); }
        } else if (Math.hypot(g.v[0], g.v[1]) > .15 && !RM()) { inert = { v: [g.v[0] * 16, g.v[1] * 16] }; kick(); }
      }
      if (P.size === 1) { const q = [...P.values()][0]; g = { k: 'pan', s: q, c: Object.assign({}, cam), moved: 99, t: 0, v: [0, 0], lp: q, lt: performance.now() }; } else if (!P.size) g = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = rel(e), w = toW(p[0], p[1]); const z = Math.max(zMin(), Math.min(zMax(), cam.z * Math.exp(-e.deltaY * .0022)));
      anim = null; cam = clampCam({ x: w[0] - (p[0] - W / 2) / z, y: w[1] - (p[1] - H / 2) / z, z }); dirty = true; kick(); }, { passive: false });

    function hitTest(x, y) { let best = null, bd = 30; Object.keys(A.REG).forEach(s => { const r = A.REG[s], q = SL(r[0], r[1]), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = s; } }); return best; }

    /* ——— dessin ——— */
    const path = polys => { ctx.beginPath(); polys.forEach(poly => poly.forEach(ring => { ring.forEach((q, i) => { const s = S(q[0], q[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); })); };
    const kmPerPx = () => { const lat = -Math.atan(Math.sinh(-cam.y * D2R)) / D2R; return 111.32 * Math.cos(lat * D2R) / cam.z; };
    const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
    const boxHit = (b, L) => L.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);

    function draw(now) {
      const t = (now - t0) / 1000, A2 = A;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createRadialGradient(W / 2, H * .45, 10, W / 2, H * .45, Math.max(W, H) * .8); bg.addColorStop(0, '#1f2226'); bg.addColorStop(1, '#121417');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // océan : légères lignes de houle
      ctx.strokeStyle = 'rgba(140,170,200,.05)'; ctx.lineWidth = 1;
      for (let lat = 2.4; lat < 5.4; lat += .32) { const a = SL(lat, -11), b = SL(lat, 0); if (a[1] < -10 || a[1] > H + 10) continue; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      // pas de pays voisins ni de frontières : seul le territoire, et la mer au sud
      { const s = SL(3.6, -5.4); ctx.font = 'italic 500 13px "Cormorant Garamond",serif'; ctx.fillStyle = 'rgba(160,190,215,.32)'; ctx.fillText('Golfe de Guinée', s[0], s[1]); }
      // Côte d'Ivoire : socle en relief
      ctx.save(); ctx.translate(0, Math.min(8, 2 + cam.z / 60)); path(civ); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill(); ctx.restore();
      path(civ); const gf = ctx.createLinearGradient(0, S(0, bb.y0)[1], 0, S(0, bb.y1)[1]); gf.addColorStop(0, '#2f2920'); gf.addColorStop(1, '#262119'); ctx.fillStyle = gf; ctx.fill();
      // grain du territoire
      ctx.save(); path(civ); ctx.clip();
      let st = .08; while (st * cam.z < 9) st *= 2; const w0 = toW(0, 0), w1 = toW(W, H);
      ctx.fillStyle = 'rgba(245,240,230,.075)';
      for (let x = Math.floor(w0[0] / st) * st; x < w1[0]; x += st) for (let y = Math.floor(w0[1] / st) * st; y < w1[1]; y += st) { const s = S(x, y); ctx.fillRect(s[0] - .6, s[1] - .6, 1.2, 1.2); }
      ctx.restore();
      // l'eau : lacs remplis, fleuves en trait fin (gris-vert : le bleu reste réservé aux offres et demandes compatibles)
      if (lakes.length) { ctx.beginPath(); lakes.forEach(l => l.forEach(ring => { ring.forEach((q, i) => { const s = S(q[0], q[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); }));
        ctx.fillStyle = 'rgba(95,118,113,.55)'; ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(143,167,161,.55)'; ctx.lineWidth = .8; ctx.stroke(); }
      const wk = Math.max(.8, Math.min(1.8, cam.z / 140)); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      rivers.forEach(r => { ctx.beginPath(); r.pts.forEach((q, i) => { const s = S(q[0], q[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.strokeStyle = 'rgba(143,167,161,' + (r.w > 1 ? .5 : .36) + ')'; ctx.lineWidth = r.w * wk; ctx.stroke(); });
      // côte en trait plein (avec liseré d'eau peu profonde), frontière terrestre en tirets
      const segs = want => { ctx.beginPath(); civ.forEach((poly, a) => poly.forEach((ring, b) => { let pen = false; ring.forEach((q, i) => { const j = i + 1 < ring.length ? i + 1 : 0, f = civBd && civBd[a] && civBd[a][b], isB = f ? (f[i] && f[j]) : false;
        if (isB !== want) { pen = false; return; } const s0 = S(q[0], q[1]), s1 = S(ring[j][0], ring[j][1]); if (!pen) { ctx.moveTo(s0[0], s0[1]); pen = true; } ctx.lineTo(s1[0], s1[1]); }); })); };
      // la côte seulement, en liseré doux (aucune frontière terrestre)
      segs(false); ctx.strokeStyle = 'rgba(160,190,215,.07)'; [14, 6].forEach(w => { ctx.lineWidth = w; ctx.stroke(); });
      ctx.strokeStyle = 'rgba(224,196,140,.28)'; ctx.lineWidth = 1; ctx.stroke();

      const me = data.me && A2.REG[data.me], sel = data.sel && A2.REG[data.sel];
      // cercles de distance autour de vous
      if (me) { ctx.save(); ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.font = '500 9.5px Jost,sans-serif'; ctx.textAlign = 'center';
        [50, 100, 200].forEach(km => { ctx.beginPath(); for (let i = 0; i <= 72; i++) { const d = dest(me[0], me[1], km, i * 5), s = SL(d[0], d[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }
          ctx.strokeStyle = 'rgba(176,149,240,.32)'; ctx.stroke(); const d = dest(me[0], me[1], km, 0), s = SL(d[0], d[1]); ctx.fillStyle = 'rgba(176,149,240,.75)'; ctx.fillText(km + ' km', s[0], s[1] - 4); });
        ctx.restore(); }
      // fils offre ↔ demande
      data.pairs.forEach((pr, i) => { const a = A2.REG[pr[0]], b = A2.REG[pr[1]]; if (!a || !b) return; const p = SL(a[0], a[1]), q = SL(b[0], b[1]);
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, c = [mx - dy / L * L * .22, my + dx / L * L * .22];
        ctx.save(); ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 18; ctx.strokeStyle = 'rgba(106,174,240,.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]); ctx.stroke(); ctx.restore();
        const k = ((t / 2.4) + i * .27) % 1, u = 1 - k, x = u * u * p[0] + 2 * u * k * c[0] + k * k * q[0], y = u * u * p[1] + 2 * u * k * c[1] + k * k * q[1];
        ctx.fillStyle = '#9fcbf5'; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, 7); ctx.fill(); });
      // trait de mesure vous → sélection
      if (me && sel && data.me !== data.sel) { const p = SL(me[0], me[1]), q = SL(sel[0], sel[1]), km = A2.km(me, sel);
        ctx.save(); ctx.strokeStyle = '#B095F0'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.restore();
        const lab = '≈ ' + km + ' km', mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; ctx.font = '600 12px Jost,sans-serif'; const w = ctx.measureText(lab).width + 16;
        ctx.fillStyle = 'rgba(23,21,18,.9)'; ctx.strokeStyle = 'rgba(176,149,240,.6)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mx - w / 2, my - 12, w, 24, 12) : ctx.rect(mx - w / 2, my - 12, w, 24); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#E6DCFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, mx, my + .5); ctx.textBaseline = 'alphabetic'; }

      // villes, marqueurs, étiquettes sans chevauchement
      const occ = [], ent = Object.keys(A2.REG).map(s => { const r = A2.REG[s], q = SL(r[0], r[1]), v = data.pts[s] || {}; return { s, r, q, o: v.o || 0, d: v.d || 0 }; });
      ent.forEach(e => { e.q[0] < -40 || e.q[0] > W + 40 || e.q[1] < -40 || e.q[1] > H + 40 ? (e.off = 1) : 0; });
      // marqueurs d'abord (ils réservent leur place) : 🧺 offres, 🛒 demandes, chacun avec son nombre ; 🔥 forte demande
      const zs = {}; (data.zones || []).forEach(z => { if (A2.REG[z.region]) (zs[z.region] = zs[z.region] || []).push(z); });
      const pin = (x, y, r, fill, emo, n, rond) => {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; ctx.fillStyle = fill; ctx.beginPath();
        if (rond) ctx.arc(x, y, r, 0, 7); else if (ctx.roundRect) ctx.roundRect(x - r, y - r, r * 2, r * 2, r * .42); else ctx.rect(x - r, y - r, r * 2, r * 2);
        ctx.fill(); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6; ctx.beginPath();
        if (rond) ctx.arc(x, y, r, 0, 7); else if (ctx.roundRect) ctx.roundRect(x - r, y - r, r * 2, r * 2, r * .42); else ctx.rect(x - r, y - r, r * 2, r * 2); ctx.stroke();
        ctx.font = Math.round(r * 1.05) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emo, x, y + 1);
        if (n) { const tx = String(n), bw = Math.max(16, 8 + tx.length * 6.5), bx = x + r * .72, by = y - r * .72; ctx.fillStyle = '#171512'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx - bw / 2, by - 8, bw, 16, 8); else ctx.rect(bx - bw / 2, by - 8, bw, 16); ctx.fill();
          ctx.strokeStyle = fill; ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = '#F5F0E6'; ctx.font = '700 10.5px Jost,sans-serif'; ctx.fillText(tx, bx, by + .5); }
        ctx.textBaseline = 'alphabetic'; };
      ent.forEach(e => { if (e.off) return; const [x, y] = e.q, both = e.o && e.d, z = zs[e.s];
        ctx.fillStyle = e.o || e.d || z || e.s === data.sel ? '#E9E1D2' : 'rgba(245,240,230,.45)'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); occ.push([x - 5, y - 5, x + 5, y + 5]);
        if (e.s === data.sel) { const pr = 18 + Math.sin(t * 3) * 1.5; ctx.strokeStyle = '#E07A3F'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, pr, 0, 7); ctx.stroke(); }
        if (z) { const w = (t * .5) % 1, cy = y + 2; [0, .5].forEach(k => { const ww = (w + k) % 1; ctx.strokeStyle = 'rgba(226,115,91,' + (1 - ww) * .75 + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, cy, 16 + ww * 30, 0, 7); ctx.stroke(); });
          const g2 = ctx.createRadialGradient(x, cy, 2, x, cy, 34); g2.addColorStop(0, 'rgba(226,115,91,.35)'); g2.addColorStop(1, 'rgba(226,115,91,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, cy, 34, 0, 7); ctx.fill();
          pin(x, y + 22, 12, '#E2735B', '🔥', z.length > 1 ? z.length : 0, true); occ.push([x - 13, y + 9, x + 13, y + 35]);
          const lab = 'Forte demande' + (z[0].label ? ' : ' + z[0].label : ''); ctx.font = '600 11px Jost,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(18,20,23,.9)'; ctx.strokeText(lab, x, y + 48); ctx.fillStyle = '#F3A08C'; ctx.fillText(lab, x, y + 48);
          const lw = ctx.measureText(lab).width; occ.push([x - lw / 2, y + 38, x + lw / 2, y + 51]); }
        if (e.o) { const r = 13 + Math.min(e.o, 8) * .6, cx = x - (both ? r + 2 : 0), cy = y - r - 5; pin(cx, cy, r, '#6CC58C', '🧺', e.o, true); occ.push([cx - r, cy - r - 8, cx + r + 10, cy + r]); }
        if (e.d) { const r = 12 + Math.min(e.d, 8) * .6, cx = x + (both ? r + 2 : 0), cy = y - r - 5, w = (t * .42 + e.s.length * .1) % 1;
          ctx.strokeStyle = 'rgba(242,201,76,' + (1 - w) * .6 + ')'; ctx.lineWidth = 1.2; const zz = r * (1 + w * 1.1); ctx.strokeRect(cx - zz, cy - zz, zz * 2, zz * 2);
          pin(cx, cy, r, '#F2C94C', '🛒', e.d, false); occ.push([cx - r, cy - r - 8, cx + r + 10, cy + r]); } });
      if (me) { const [x, y] = SL(me[0], me[1]), w = (t / 2.2) % 1; ctx.strokeStyle = 'rgba(176,149,240,' + (1 - w) + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y - 6, 9 + w * 16, 0, 7); ctx.stroke();
        ctx.fillStyle = '#B095F0'; ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x + 8, y - 2); ctx.lineTo(x - 8, y - 2); ctx.closePath(); ctx.fill(); occ.push([x - 9, y - 17, x + 9, y]); }
      // étiquettes : priorité sélection > vous > publications > grandes villes ; essais à droite, gauche, dessous, dessus ; sinon masquée
      const order = ent.filter(e => !e.off).sort((a, b) => ((b.s === data.sel) * 100 + (b.s === data.me) * 50 + (b.o + b.d) * 10 + (PRIO[b.s] || 0)) - ((a.s === data.sel) * 100 + (a.s === data.me) * 50 + (a.o + a.d) * 10 + (PRIO[a.s] || 0)));
      order.forEach(e => { const strong = e.o || e.d || e.s === data.sel || e.s === data.me, fs = strong ? 12 : 10.5; ctx.font = (strong ? '600 ' : '400 ') + fs + 'px Jost,sans-serif';
        const tw = ctx.measureText(e.r[2]).width, [x, y] = e.q, hgt = fs + 2;
        const cand = [[x + 7, y + fs / 2 - 1, 'left'], [x - 7, y + fs / 2 - 1, 'right'], [x, y + fs + 6, 'center'], [x, y - 9, 'center']];
        for (const c of cand) { const bx = c[2] === 'left' ? c[0] : c[2] === 'right' ? c[0] - tw : c[0] - tw / 2, b = [bx - 2, c[1] - hgt + 1, bx + tw + 2, c[1] + 3];
          const it = ins(); if (b[0] < 2 || b[2] > W - 52 && b[1] < it.t + 140 || b[2] > W - 2 || b[1] < it.t + 2 || b[3] > H - it.b - 26) continue;
          if (boxHit(b, occ)) continue; occ.push(b);
          ctx.textAlign = c[2]; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(18,20,23,.85)'; ctx.strokeText(e.r[2], c[0], c[1]);
          ctx.fillStyle = e.s === data.sel ? '#F3B48A' : strong ? '#F5F0E6' : 'rgba(245,240,230,.62)'; ctx.fillText(e.r[2], c[0], c[1]); break; } });
      // échelle
      const kpp = kmPerPx(), km = nice(kpp * 90), px = km / kpp, HB = H - ins().b; ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(245,240,230,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(12, HB - 14); ctx.lineTo(12, HB - 10); ctx.lineTo(12 + px, HB - 10); ctx.lineTo(12 + px, HB - 14); ctx.stroke();
      ctx.font = '500 10px Jost,sans-serif'; ctx.fillStyle = 'rgba(245,240,230,.75)'; ctx.fillText(km + ' km', 16 + px, HB - 9);
      ctx.font = '500 15px "Cormorant Garamond",serif'; ctx.fillStyle = '#F5F0E6'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(18,20,23,.8)'; const wh = where(); ctx.strokeText(wh, 12, HB - 22); ctx.fillText(wh, 12, HB - 22);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(245,240,230,.32)'; ctx.font = '400 9px Jost,sans-serif'; ctx.fillText(real ? '© Natural Earth' : 'Contour simplifié', W - 10, HB - 9); ctx.fillStyle = 'rgba(245,240,230,.5)'; ctx.fillText('Points au chef-lieu du district', W - 10, HB - 21);
    }

    // ce que l'on regarde : le pays, une partie du pays, puis les alentours du chef-lieu le plus proche (distance et direction réelles)
    function where() {
      const r = cam.z / home().z, lon = cam.x, lat = Math.atan(Math.sinh(-cam.y * D2R)) / D2R;
      if (r < 1.3) return 'Tout le pays';
      if (r < 2.4) { const ns = lat > 8.6 ? 'Nord' : lat < 6.4 ? 'Sud' : 'Centre', ew = lon < -6.3 ? 'ouest' : lon > -4.6 ? 'est' : ''; return (ew ? ns + '-' + ew : ns) + ' du pays'; }
      let best = null, bk = 1e9; Object.keys(A.REG).forEach(k => { const R = A.REG[k], d = A.km([lat, lon], R); if (d < bk) { bk = d; best = R; } });
      if (!best) return ''; const de = (/^[AEIOUYÉÈ]/i.test(best[2]) ? "d'" : 'de ') + best[2];
      if (bk < 15) return 'Autour ' + de;
      const D = ['à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest', 'au nord', 'au nord-est'], dx = (lon - best[1]) * Math.cos(lat * D2R), dz = best[0] - lat, i = ((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      return Math.round(bk / 5) * 5 + ' km ' + D[i] + ' ' + de;
    }
    function frame(now) {
      raf = 0; if (!alive) return; let more = false;
      if (anim) { const k = Math.min(1, (now - anim.t) / anim.dur); anim.step(k); dirty = true; if (k >= 1) anim = null; else more = true; }
      if (inert) { cam = clampCam({ x: cam.x - inert.v[0] / cam.z, y: cam.y - inert.v[1] / cam.z, z: cam.z }); inert.v = [inert.v[0] * .9, inert.v[1] * .9]; dirty = true; if (Math.hypot(inert.v[0], inert.v[1]) < .3) inert = null; else more = true; }
      const live = !RM() && (data.pairs.length || data.me || data.sel || (data.zones && data.zones.length) || Object.values(data.pts).some(v => v.d));
      if (dirty || live) { draw(now); dirty = false; }
      if ((more || live) && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!alive) return; if (document.hidden) { if (anim) { anim.step(1); anim = null; } draw(performance.now()); dirty = false; return; } if (!raf) raf = requestAnimationFrame(frame); }
    const vis = () => { if (!document.hidden) kick(); }; document.addEventListener('visibilitychange', vis);
    resize();

    const api = {
      set(d) { const prev = data; data = Object.assign({ pts: {}, pairs: [], me: '', sel: '', zones: [] }, d); dirty = true;
        if (data.sel !== prev.sel) { if (data.sel) flyTo(data.sel, 2.6); else if (prev.sel) fly(home(), 1000); }
        else if (data.me !== prev.me && data.me) flyTo(data.me, 1.7);
        kick(); },
      flyTo, home: () => fly(home(), 900), relayout: () => { ui.style.top = note.style.top = (ins().t + 10) + 'px'; dirty = true; kick(); },
      destroy() { alive = false; cancelAnimationFrame(raf); ro && ro.disconnect(); document.removeEventListener('visibilitychange', vis); [cv, ui, note].forEach(n => n.remove()); }   // seulement ses propres éléments : la carte en relief peut partager l'hôte
    };
    return api;
  }
  window.MDGCarte = { mount };
})();
