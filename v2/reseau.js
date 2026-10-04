// Marché de Gros CI — « le réseau du marché » : couche WebGL des sections sous le sélecteur.
// Un seul canvas fixe, un seul programme, 1 à 3 appels de rendu par image. Vocabulaire unique :
// point = un lieu où l'on produit · fil = une relation directe · onde = une demande publiée.
// Aucun personnage, aucun produit dessiné : les produits n'existent que par les images de DG (dans le HTML).
// Repli : sans WebGL (ou appareil faible), le même dessin en Canvas 2D ; mouvement réduit = états finaux directs.
// Contour de la Côte d'Ivoire : Natural Earth 1:110m via world-atlas@2 (domaine public).
const TOPO = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const C = { ink: [23, 21, 18], terre: [184, 92, 56], foret: [49, 84, 60], sable: [185, 173, 152] };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = t => 1 - Math.pow(1 - t, 3), easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };

// ——— rendu : WebGL (instancié, SDF) ou Canvas 2D, même liste de primitives ———
function makeRenderer(cv, force2d) {
  let gl = null, inst = null, gl2 = false;
  if (!force2d) { try { gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true }); gl2 = !!gl; if (!gl) { gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true }); inst = gl && gl.getExtension('ANGLE_instanced_arrays'); if (!inst) gl = null; } } catch (_) { gl = null; } }
  if (!gl) {
    const x = cv.getContext('2d');
    return { kind: '2d', draw(groups, dpr) {
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.lineCap = 'round';
      groups.forEach(g => { x.save(); if (g.clip) { x.beginPath(); x.rect(g.clip.x, g.clip.y, g.clip.w, g.clip.h); x.clip(); }
        g.list.forEach(p => { const [r, gg, b] = p.c, s = `rgba(${r},${gg},${b},${p.a})`;
          if (p.k === 0) { x.fillStyle = s; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.2832); x.fill(); }
          else if (p.k === 1) { x.strokeStyle = s; x.lineWidth = p.w; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.2832); x.stroke(); }
          else if (p.k === 2) { x.strokeStyle = s; x.lineWidth = p.w; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x2, p.y2); x.stroke(); } });
        x.restore(); });
    }, lose() {} };
  }
  const vs = `attribute vec2 q; attribute vec4 ab; attribute vec4 pr; attribute vec4 col; uniform vec2 res;
  varying vec2 vp; varying vec4 vab; varying vec4 vpr; varying vec4 vcol;
  void main(){ float k = pr.y, w = pr.x; vec2 pos;
    if (k < 1.5) { float e = ab.z + w + 2.0; pos = ab.xy + q * e; }
    else if (k < 2.5) { vec2 d = ab.zw - ab.xy; float L = length(d); vec2 u = L > .001 ? d / L : vec2(1.,0.); vec2 n = vec2(-u.y, u.x); float e = w * .5 + 2.0; pos = (ab.xy + ab.zw) * .5 + u * q.x * (L * .5 + e) + n * q.y * e; }
    else { pos = ab.xy + (q * .5 + .5) * ab.zw; }
    vp = pos; vab = ab; vpr = pr; vcol = col; vec2 c = pos / res * 2. - 1.; gl_Position = vec4(c.x, -c.y, 0., 1.); }`;
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec2 vp; varying vec4 vab; varying vec4 vpr; varying vec4 vcol; uniform float dpr; uniform float sy;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){ float k = vpr.y, w = vpr.x, d;
    if (k > 2.5) { float n = h(floor(vec2(vp.x, vp.y + sy) * dpr / 2.)); float a = vcol.a * n; gl_FragColor = vec4(vcol.rgb * a, a); return; }
    if (k < .5) d = length(vp - vab.xy) - vab.z;
    else if (k < 1.5) d = abs(length(vp - vab.xy) - vab.z) - w * .5;
    else { vec2 pa = vp - vab.xy, ba = vab.zw - vab.xy; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0., 1.); d = length(pa - ba * t) - w * .5; }
    float a = clamp(.5 - d * dpr, 0., 1.) * vcol.a; gl_FragColor = vec4(vcol.rgb * a, a); }`;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pg); gl.useProgram(pg);
  const L = n => gl.getAttribLocation(pg, n), U = n => gl.getUniformLocation(pg, n);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(L('q')); gl.vertexAttribPointer(L('q'), 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); let cap = 0, data = new Float32Array(0);
  const div = (l, n) => gl2 ? gl.vertexAttribDivisor(l, n) : inst.vertexAttribDivisorANGLE(l, n);
  const A = ['ab', 'pr', 'col'].map(L); A.forEach(l => { gl.enableVertexAttribArray(l); div(l, 1); });
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return { kind: gl2 ? 'webgl2' : 'webgl', gl, draw(groups, dpr, sy) {
    const n = groups.reduce((s, g) => s + g.list.length, 0);
    if (n > cap) { cap = Math.ceil(n * 1.5) + 64; data = new Float32Array(cap * 12); }
    let o = 0; groups.forEach(g => g.list.forEach(p => {
      if (p.k === 2) { data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.x2; data[o + 3] = p.y2; }
      else if (p.k === 3) { data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.w2; data[o + 3] = p.h2; }
      else { data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.r; data[o + 3] = 0; }
      data[o + 4] = p.w || 0; data[o + 5] = p.k; data[o + 6] = 0; data[o + 7] = 0;
      data[o + 8] = p.c[0] / 255; data[o + 9] = p.c[1] / 255; data[o + 10] = p.c[2] / 255; data[o + 11] = p.a; o += 12; }));
    gl.viewport(0, 0, cv.width, cv.height); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U('res'), cv.width / dpr, cv.height / dpr); gl.uniform1f(U('dpr'), dpr); gl.uniform1f(U('sy'), sy || 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 12), gl.DYNAMIC_DRAW);
    let start = 0; groups.forEach(g => { const c = g.list.length; if (!c) return;
      if (g.clip) { gl.enable(gl.SCISSOR_TEST); const x = Math.max(0, g.clip.x * dpr), y = Math.max(0, cv.height - (g.clip.y + g.clip.h) * dpr); gl.scissor(x, y, Math.max(0, g.clip.w * dpr), Math.max(0, g.clip.h * dpr)); } else gl.disable(gl.SCISSOR_TEST);
      A.forEach((l, i) => gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 48, start * 48 + i * 16));
      if (gl2) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, c); else inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, c);
      start += c; });
  }, lose() { const e = gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); } };
}

export function init({ root, footer, data, reduced = false, weak = false, onRequest }) {
  let cv = document.createElement('canvas'); cv.className = 'netcv'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
  let R; try { R = makeRenderer(cv, weak); } catch (_) { R = makeRenderer(cv, true); }
  const still = reduced || weak; // états finaux, pas d'animation
  const stats = { renderer: R.kind, calls: 0, prims: 0, frame: 0 };
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const T = {}; let now = performance.now();
  const start = (k, force) => { if (force || T[k] == null) T[k] = now; };
  const prog = (k, dur, delay = 0) => T[k] == null ? 0 : still ? 1 : clamp((now - T[k] - delay) / dur);
  let live = false; const run = (k, dur, delay = 0) => { const p = prog(k, dur, delay); if (T[k] != null && p < 1) live = true; return p; };
  const rect = el => el.getBoundingClientRect();
  const inView = (r, f = .85) => r.top < innerHeight * f && r.bottom > innerHeight * (1 - f);
  const P = []; let groups = [];
  const disc = (x, y, r, c, a) => P.push({ k: 0, x, y, r, c, a });
  const ring = (x, y, r, w, c, a) => P.push({ k: 1, x, y, r, w, c, a });
  const seg = (x, y, x2, y2, w, c, a) => P.push({ k: 2, x, y, x2, y2, w, c, a });
  // fil tracé : cubique échantillonnée, coupée à t
  function wire(p0, p1, p2, p3, t, w, c, a, from = 0) {
    if (t <= from || a <= 0) return null; const N = 28; let prev = bez(p0, p1, p2, p3, from), end = prev;
    for (let i = 1; i <= N; i++) { const u = from + (1 - from) * i / N; if (u > t) { end = bez(p0, p1, p2, p3, t); seg(prev[0], prev[1], end[0], end[1], w, c, a); return end; } const q = bez(p0, p1, p2, p3, u); seg(prev[0], prev[1], q[0], q[1], w, c, a); prev = end = q; }
    return end;
  }
  const flush = clip => { groups.push({ clip, list: P.splice(0) }); };

  // ════════ 1 · Trois chemins, un seul marché ════════
  const S1 = $('[data-net-sec="paths"]', root), anchor = $('#netMarket', root), cards = $$('[data-net]', S1);
  const r1 = rng(11), DOTS1 = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * 6.283 + r1() * .5; return [Math.cos(a) * (.3 + r1() * .17), Math.sin(a) * (.28 + r1() * .16)]; });
  let act1 = null, hover1 = null;
  cards.forEach(c => { c.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover1 = c.dataset.net; need(); } }); c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover1 = null; need(); } }); c.addEventListener('focus', () => { hover1 = c.dataset.net; need(); }); c.addEventListener('blur', () => { hover1 = null; need(); }); });
  function scenePaths() {
    const ar = rect(anchor); if (ar.bottom < -200 || ar.top > innerHeight + 200) return;
    if (inView(ar, .9)) start('p_in');
    const mob = innerWidth < 760;
    // sur mobile, la carte au centre de l'écran s'active seule
    let want = hover1; if (mob && T.p_in != null) { let best = null, bd = 1e9; cards.forEach(c => { const r = rect(c), d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bd && d < r.height) { bd = d; best = c.dataset.net; } }); want = best; }
    if (want !== act1) { act1 = want; if (want) start('a_' + want, true); }
    const M = [ar.left + ar.width * (mob ? .5 : .55), ar.top + ar.height * .5], sx = Math.min(ar.width * (mob ? .9 : .7), 360), sy = ar.height;
    const D = DOTS1.map(([u, v]) => [M[0] + u * sx, M[1] + v * sy]);
    const pin = run('p_in', 900);
    // fils des trois cartes vers le marché
    cards.forEach((c, i) => {
      const r = rect(c), on = act1 === c.dataset.net, k = c.dataset.net;
      const p0 = [r.left + r.width / 2, r.top - 2], p3 = [M[0], M[1] + 9];
      const p1 = [p0[0], p0[1] - (mob ? 20 : 46)], p2 = [M[0] + (p0[0] - M[0]) * .35, M[1] + (mob ? 30 : 70)];
      const t = easeIO(run('p_in', 1100, 120 * i + 200));
      wire(p0, p1, p2, p3, t, on ? 2 : 1.2, C.terre, on ? .95 : act1 ? .22 : .5);
    });
    // points : des lieux de production
    const lit = new Set(); const kind = act1;
    if (kind === 'buy') [0, 2, 4, 6].forEach((d, j) => { const t = easeOut(run('a_buy', 700, 140 * j)); const e = wire(M, [M[0] + (D[d][0] - M[0]) * .3, M[1] - 18], [D[d][0], D[d][1] - 16], D[d], t, 1.4, C.terre, .85); if (t >= 1) lit.add(d); });
    if (kind === 'sell') { [1, 3, 5, 7].forEach((d, j) => { const t = easeIO(run('a_sell', 800, 160 * j)); wire(D[d], [D[d][0], D[d][1] - 18], [M[0] + (D[d][0] - M[0]) * .3, M[1] - 16], M, t, 1.4, C.terre, .85); lit.add(d); }); const pp = run('a_sell', 900, 1100); if (pp > 0 && pp < 1) ring(M[0], M[1], 9 + pp * 22, 1.5, C.terre, (1 - pp) * .8); }
    if (kind === 'ask') { const wv = run('a_ask', 1500); const maxR = Math.max(sx, sy) * .62; if (wv < 1) ring(M[0], M[1], 10 + wv * maxR, 1.6, C.foret, .75 * (1 - wv)); D.forEach((p, d) => { const dist = Math.hypot(p[0] - M[0], p[1] - M[1]); const hit = (10 + wv * maxR) >= dist || wv >= 1; if (hit && d % 2 === 0) { const key = 'ask_r' + d; if (T[key] == null || T[key] < T.a_ask) T[key] = now; const t = easeIO(run(key, 700, 120)); wire(p, [p[0], p[1] + 14], [M[0] + (p[0] - M[0]) * .3, M[1] + 14], M, t, 1.3, C.terre, .8); lit.add(d); } }); }
    D.forEach((p, d) => { const a = easeOut(run('p_in', 500, 300 + d * 70)); if (!a) return; const L = lit.has(d); disc(p[0], p[1], L ? 4.5 : 3.4, L ? C.terre : C.ink, a * (L ? 1 : kind ? .4 : .7)); });
    disc(M[0], M[1], 7 * pin, C.ink, pin); ring(M[0], M[1], 14, 1.2, C.terre, .55 * pin);
    flush(null);
  }

  // ════════ 2 · Catalogue : compteurs, étal qui fléchit ════════
  const counts = $$('[data-count]', root), rail = $('#rail', root);
  let bend = 0, bendV = 0, lastSL = rail ? rail.scrollLeft : 0, lastT = now;
  if (rail) rail.addEventListener('scroll', () => { const dt = Math.max(8, now - lastT), v = (rail.scrollLeft - lastSL) / dt; lastSL = rail.scrollLeft; lastT = now; if (!still) bendV += clamp(v * 3, -6, 6); need(); }, { passive: true });
  $$('.cat', root).forEach(c => c.addEventListener('click', e => { if (still || e.metaKey || e.ctrlKey || c.hasAttribute('data-dive')) return; e.preventDefault(); c.classList.add('go'); rail.classList.add('picking'); const h = c.getAttribute('href'); setTimeout(() => { location.hash = h; }, 220); }));
  function sceneCatalogue() {
    counts.forEach(el => { const r = rect(el); if (r.top < innerHeight * .9 && r.bottom > 0) start('c_in'); });
    if (T.c_in != null) { const t = easeOut(run('c_in', 900)); counts.forEach(el => { const n = +el.dataset.count; el.textContent = Math.round(n * t); }); }
    if (rail && !still) { bend += bendV; bendV *= .82; bend *= .86; if (Math.abs(bend) > .02 || Math.abs(bendV) > .02) live = true; else bend = 0; rail.style.setProperty('--bend', bend.toFixed(2)); }
  }

  // ════════ 3 · Comment ça marche : chercher → voir qui produit → contacter ════════
  const HS = $('#howScroll', root), map = $('#howMap', root), phone = $('#hPhone', root), steps = $$('.hstep', root);
  const qT = $('#hQt', root), qRes = $('#hRes', root), list = $('#hList', root), actEl = $('#hAct', root);
  const demo = (() => {
    const byP = {}; data.offers.forEach(o => (byP[o.productSlug] ||= []).push(o));
    // un vrai nom du marché (dictionnaire d'alias du site) dont le produit a au moins deux offres ; sinon le mieux fourni
    const short = n => n.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const cands = data.products.filter(p => p.aliases.some(x => x.toLowerCase() !== short(p.name).toLowerCase()) && (byP[p.slug] || []).length).sort((x, y) => byP[y.slug].length - byP[x.slug].length);
    const pref = ['djoumblé', 'aloco', 'gnangnan', 'attiéké'].map(w => { const r = data.parse(w).product; return r && cands.find(p => p.slug === r.slug && byP[p.slug].length >= 2) && { a: w, slug: r.slug }; }).find(Boolean);
    const pick = pref || (cands[0] && { a: cands[0].aliases.find(x => x.toLowerCase() !== short(cands[0].name).toLowerCase()), slug: cands[0].slug });
    if (!pick) return null; const prod = data.products.find(p => p.slug === pick.slug);
    return { alias: pick.a, prod, name: short(prod.name), offers: byP[prod.slug].slice(0, 3) };
  })();
  let geo = null, step = -1, hoverRow = null;
  const prById = Object.fromEntries(data.producers.map(p => [p.id, p]));
  Promise.all([fetch(TOPO).then(r => r.json()), window.MDGMap.libs()]).then(([topo]) => { const civ = window.topojson.feature(topo, topo.objects.countries).features.find(f => f.id === '384'); geo = { civ }; need(); }).catch(() => { geo = { civ: null }; });
  let proj = null, projKey = '';
  function project(mr) {
    const key = Math.round(mr.width) + 'x' + Math.round(mr.height); if (key === projKey) return proj; projKey = key;
    const d3 = window.d3; if (!d3 || !geo || !geo.civ) return proj = null;
    const pr = d3.geoMercator().fitExtent([[18, 18], [mr.width - 18, mr.height - 18]], geo.civ);
    const rings = (geo.civ.geometry.type === 'Polygon' ? [geo.civ.geometry.coordinates] : geo.civ.geometry.coordinates).flatMap(poly => poly.map(rg => rg.map(c => pr(c))));
    const pts = data.producers.map(p => ({ id: p.id, xy: pr([p.lon, p.lat]) }));
    return proj = { rings, pts };
  }
  if (demo && list) list.innerHTML = demo.offers.map((o, i) => `<li data-p="${o.producerId}" style="--i:${i}"><b>${esc(o.producerName)}</b> <span class="ex">Exemple</span><small>${fmt(o.quantity)} ${esc(o.unit)} · ${o.price != null ? fmt(o.price) + ' FCFA / ' + esc(o.unit) : 'prix à voir'} · ${esc(o.city)}</small></li>`).join('');
  if (demo && qRes) qRes.innerHTML = `<span class="hchip">Nom du marché</span> <b>${esc(demo.alias)}</b> → <b>${esc(demo.name)}</b>`;
  if (demo && $('#hSee', root)) { const a = $('#hSee', root); a.href = '#/produits/' + demo.prod.slug; a.querySelector('span').textContent = 'Voir les offres : ' + demo.name.toLowerCase(); }
  if (list) { list.addEventListener('pointerover', e => { const li = e.target.closest('li'); hoverRow = li ? li.dataset.p : null; need(); }); list.addEventListener('pointerleave', () => { hoverRow = null; need(); }); }
  if (map) { map.addEventListener('pointermove', e => { if (!proj) return; const mr = rect(map); let best = null, bd = 16; demo.offers.forEach(o => { const p = proj.pts.find(q => q.id === o.producerId); if (!p) return; const xy = toScreen(p.xy, mr); const d = Math.hypot(xy[0] - e.clientX, xy[1] - e.clientY); if (d < bd) { bd = d; best = o.producerId; } }); if (best !== hoverRow) { hoverRow = best; $$('li', list).forEach(li => li.classList.toggle('hot', li.dataset.p === best)); need(); } }); map.addEventListener('pointerleave', () => { hoverRow = null; $$('li', list).forEach(li => li.classList.remove('hot')); need(); }); }
  steps.forEach(b => b.addEventListener('click', () => { const r = rect(HS), span = HS.offsetHeight - innerHeight; const top = scrollY + r.top + Math.max(0, span) * (+b.dataset.s / 3 + .12); window.scrollTo({ top, behavior: still ? 'auto' : 'smooth' }); }));
  let zoom = 0, zc = null;
  function toScreen(xy, mr) { const s = 1 + zoom * .55; const cx = zc ? zc[0] : mr.width / 2, cy = zc ? zc[1] : mr.height / 2; return [mr.left + mr.width / 2 + (xy[0] - cx) * s + (cx - mr.width / 2) * (1 - zoom), mr.top + mr.height / 2 + (xy[1] - cy) * s + (cy - mr.height / 2) * (1 - zoom)]; }
  function setStep(s) {
    if (s === step) return; step = s; start('h' + s, true);
    steps.forEach((b, i) => { b.classList.toggle('on', i === s); b.classList.toggle('done', i < s); if (i === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    HS.dataset.step = s;
    if (s === 0 && qT) { qT.textContent = ''; qRes.classList.remove('on'); }
    if (actEl) actEl.classList.remove('lit');
  }
  function sceneHow() {
    if (!HS || !map || !demo) return; const hr = rect(HS); if (hr.bottom < 0 || hr.top > innerHeight) return;
    const span = Math.max(1, HS.offsetHeight - innerHeight), p = clamp(-hr.top / span);
    setStep(p < .34 ? 0 : p < .67 ? 1 : 2);
    const mr = rect(map), pj = project(mr); if (!pj) { flush(null); return; }
    const ids = new Set(demo.offers.map(o => o.producerId));
    // étape 1 : le mot du marché s'écrit, puis se résout
    const typed = run('h0', 900, 250), word = demo.alias;
    if (step === 0) { qT.textContent = word.slice(0, Math.round(typed * word.length)); if (run('h0', 10, 1300) >= 1) qRes.classList.add('on'); }
    else { qT.textContent = word; qRes.classList.add('on'); }
    const found = step > 0 ? 1 : easeOut(run('h0', 700, 1400));
    // étape 2 : la caméra se rapproche des producteurs trouvés
    const mine = pj.pts.filter(q => ids.has(q.id)); if (mine.length) zc = [mine.reduce((s, q) => s + q.xy[0], 0) / mine.length, mine.reduce((s, q) => s + q.xy[1], 0) / mine.length];
    const zt = step >= 1 ? easeIO(run('h1', 1100)) : 0; zoom += ((step >= 1 ? zt : 0) - zoom) * (still ? 1 : .2); if (Math.abs((step >= 1 ? zt : 0) - zoom) > .002) live = true;
    // contour (trait fin)
    pj.rings.forEach(rg => { for (let i = 1; i < rg.length; i++) { const a = toScreen(rg[i - 1], mr), b = toScreen(rg[i], mr); seg(a[0], a[1], b[0], b[1], 1.1, C.ink, .55); } });
    // points
    pj.pts.forEach((q, i) => { const xy = toScreen(q.xy, mr), on = ids.has(q.id); const dim = 1 - found * (on ? 0 : .6); disc(xy[0], xy[1], on ? 3.2 + 2 * found : 3, on && found > .2 ? C.terre : C.ink, (on ? 1 : .7) * dim); if (on && hoverRow === q.id) ring(xy[0], xy[1], 10, 1.4, C.terre, .9); });
    // étape 2 : les points trouvés pulsent, la liste apparaît (HTML)
    if (step >= 1) mine.forEach((q, j) => { const t = run('h1', 1400, 500 + j * 220); if (t > 0 && t < 1) { const xy = toScreen(q.xy, mr); ring(xy[0], xy[1], 5 + t * 16, 1.4, C.terre, (1 - t) * .9); } });
    // étape 3 : un fil direct jusqu'au téléphone, puis l'onde de la demande
    if (step === 2 && mine.length) {
      const pr = rect(phone), P3 = [pr.left + pr.width / 2, pr.top + 6], s0 = toScreen(mine[0].xy, mr);
      const t = easeIO(run('h2', 1200, 200)); wire(s0, [s0[0], s0[1] - 40], [P3[0] - 30, P3[1] - 60], P3, t, 2, C.terre, .95);
      if (t >= 1) actEl.classList.add('lit');
      const wv = run('h2', 2200, 2300), maxR = Math.hypot(mr.width, mr.height) * .9, rad = 10 + wv * maxR, PC = [pr.left + pr.width / 2, pr.top + pr.height / 2];
      if (wv > 0 && wv < 1) ring(PC[0], PC[1], rad, 1.6, C.foret, .7 * (1 - wv * .7));
      if (wv > 0) pj.pts.filter(q => !ids.has(q.id)).slice(0, 5).forEach((q, j) => { const xy = toScreen(q.xy, mr); if (Math.hypot(xy[0] - PC[0], xy[1] - PC[1]) > rad && wv < 1) return; const key = 'hr' + j; if (T[key] == null || T[key] < T.h2) T[key] = now; const u = easeIO(run(key, 900, 100)); wire(xy, [xy[0], xy[1] + 30], [PC[0] - 40, PC[1] + 20], PC, u, 1.2, C.terre, .6); disc(xy[0], xy[1], 4, C.foret, .9); });
    }
    flush({ x: mr.left, y: mr.top, w: mr.width, h: mr.height });
  }

  // ════════ 4 · Pour l'acheteur / le producteur / le marché ════════
  const FN = footer && $('#footNet', footer), cols = footer ? $$('.foot > div', footer) : [];
  let hoverCol = -1; cols.forEach((c, i) => { c.addEventListener('pointerenter', () => { hoverCol = i; need(); }); c.addEventListener('pointerleave', () => { hoverCol = -1; need(); }); });
  const r4 = rng(5), L4 = Array.from({ length: 6 }, () => [.03 + r4() * .2, .15 + r4() * .7]), R4 = Array.from({ length: 6 }, () => [.77 + r4() * .2, .15 + r4() * .7]), PAIR = [2, 0, 4, 1, 5, 3];
  function sceneFoot() {
    if (!FN || !FN.offsetParent) return; const fr = rect(FN); if (fr.bottom < 0 || fr.top > innerHeight) return;
    if (inView(fr, .95)) start('f_in');
    const at = ([u, v]) => [fr.left + u * fr.width, fr.top + v * fr.height];
    PAIR.forEach((j, i) => { if (i > 3) return; const a = at(L4[i]), b = at(R4[j]); const t = easeIO(run('f_in', 1300, 300 + i * 200)); wire(a, [fr.left + fr.width * .4, a[1]], [fr.left + fr.width * .6, b[1]], b, t, hoverCol === 2 ? 1.6 : 1.1, C.terre, hoverCol === 2 ? .8 : hoverCol >= 0 ? .2 : .42); });
    L4.forEach((p, i) => { const xy = at(p), a = easeOut(run('f_in', 500, i * 60)); disc(xy[0], xy[1], hoverCol === 0 ? 4.2 : 3.2, hoverCol === 0 ? C.terre : C.ink, a * (hoverCol === 0 ? 1 : hoverCol >= 0 ? .25 : .5)); });
    R4.forEach((p, i) => { const xy = at(p), a = easeOut(run('f_in', 500, 200 + i * 60)); disc(xy[0], xy[1], hoverCol === 1 ? 4.2 : 3.2, hoverCol === 1 ? C.foret : C.ink, a * (hoverCol === 1 ? 1 : hoverCol >= 0 ? .25 : .5)); });
    flush({ x: fr.left, y: fr.top, w: fr.width, h: fr.height });
  }

  // ——— grain du panneau (toile légère, fixe sur la page) ———
  function grain() { const r = rect(root); if (r.bottom < 0 || r.top > innerHeight) return; P.push({ k: 3, x: r.left, y: Math.max(0, r.top), w2: r.width, h2: Math.min(innerHeight, r.bottom) - Math.max(0, r.top), c: C.ink, a: .05 }); }

  // ——— boucle : rendu à la demande, arrêt hors écran / onglet masqué ———
  let raf = 0, visible = true, dpr = 1, slow = 0;
  const cap = () => Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 2) * (slow > 2 ? .75 : 1);
  function size() { dpr = cap(); const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } }
  function need() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0; const t0 = performance.now(); now = t; live = false; groups = []; P.length = 0; size();
    for (const f of [grain, scenePaths, sceneCatalogue, sceneHow, sceneFoot]) { try { f(); } catch (e) { stats.err = f.name + ': ' + e.message; P.length = 0; } }
    if (P.length) flush(null);
    try { R.draw(groups, dpr, scrollY); } catch (e) { stats.err = 'draw: ' + e.message; }
    stats.n = (stats.n || 0) + 1; stats.calls = groups.filter(g => g.list.length).length; stats.prims = groups.reduce((s, g) => s + g.list.length, 0);
    const ft = performance.now() - t0; stats.frame = +ft.toFixed(2); if (ft > 20) { slow++; } else slow = Math.max(0, slow - .1);
    if (live) need();
  }
  const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting) || [root, footer].some(el => { const r = el && rect(el); return r && r.top < innerHeight && r.bottom > 0; }); if (visible) need(); else R.draw([], dpr, 0); });
  [root, footer].forEach(el => el && io.observe(el));
  const onScroll = () => need(), onVis = () => { if (!document.hidden) need(); };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); document.addEventListener('visibilitychange', onVis);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); const c2 = cv.cloneNode(); cv.replaceWith(c2); cv = c2; R = makeRenderer(cv, true); stats.renderer = R.kind; need(); });
  need();
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmt(n) { return new Intl.NumberFormat('fr-FR').format(n); }
  return {
    stats,
    off() { cancelAnimationFrame(raf); io.disconnect(); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); document.removeEventListener('visibilitychange', onVis); R.lose(); cv.remove(); },
  };
}
