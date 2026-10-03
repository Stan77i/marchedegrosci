// Marché de Gros CI — Écosystème des familles : moteur.
//   SharedRenderer      un seul contexte WebGL hors écran ; chaque carte visible y est rendue (viewport + scissor)
//                       puis recopiée dans le canevas 2D de sa carte (drawImage). Les cartes restent libres (rail, grille).
//   EcosystemBus        emit / on + mémoire (dernier événement, énergie, vent, dernière matière, intensité d'interaction).
//   InteractionManager  défilement → vent + énergie · doigt/souris → force locale · tap → impulsion dans la scène.
//   Transit             une matière qui quitte une carte traverse la page (petite couche 2D) et entre dans la suivante.
//                       Si la carte voisine n'est pas à l'écran, la matière attend qu'elle apparaisse (mémoire).
//   VisibilityManager   rendu uniquement des cartes visibles ; arrêt hors écran / onglet masqué.
//   PerformanceManager  coût de rendu mesuré ; résolution abaissée si besoin, repli CSS en dernier recours.
import { makeKit, SCENES as S1, BG as B1, clamp } from './familles-scenes.js';
import { SCENES2, BG2, FLOW } from './familles-scenes2.js';
const SCENES = { ...S1, ...SCENES2 }, BG = { ...B1, ...BG2 };
const SOURCES = slug => Object.entries(FLOW).filter(([, v]) => v.to.includes(slug)).map(([, v]) => v.from);
const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
let T;
export { BG };
export const has = slug => !!SCENES[slug];

export async function create({ tier = 2, reduced = false } = {}) {
  T = T || await import(THREE_URL);
  const kit = makeKit(T);
  const gl = document.createElement('canvas');
  const renderer = new T.WebGLRenderer({ canvas: gl, antialias: tier >= 2, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
  let GW = 2, GH = 2; renderer.setSize(GW, GH, false);
  const low = tier < 2 || matchMedia('(max-width:760px)').matches;
  const DPR = Math.min(devicePixelRatio || 1, tier >= 2 ? 1.75 : 1.25), FPS = tier >= 2 ? 30 : 24;

  /* ——— EcosystemBus ——— */
  const ls = {};
  const bus = {
    state: { lastEvent: null, energy: 0, wind: 0, windDirection: 1, lastMaterial: null, interactionIntensity: 0, mem: {} },
    on(type, fn) { (ls[type] ||= []).push(fn); return () => { ls[type] = ls[type].filter(f => f !== fn); }; },
    emit(type, p = {}) { bus.state.lastEvent = { type, t: performance.now(), from: p.from }; if (p.material) bus.state.lastMaterial = p.material; (ls[type] || []).forEach(f => f(p)); (ls['*'] || []).forEach(f => f(type, p)); },
  };
  if (typeof window !== 'undefined') window.MDGEcosystem = bus;

  /* ——— Vent global : brise lente + rafales rares + défilement ——— */
  const wind = { g: 0, gt: 0, dir: 1, next: performance.now() + 4000 + Math.random() * 6000, scroll: 0 };
  let lastY = scrollY, lastS = performance.now();
  addEventListener('scroll', () => { const n = performance.now(), dy = scrollY - lastY, d = Math.max(8, n - lastS); lastY = scrollY; lastS = n; const v = dy / d; wind.scroll = clamp(wind.scroll * .6 + v * .5, -1.4, 1.4); bus.state.energy = Math.min(1, bus.state.energy + Math.abs(v) * .02); wake(); }, { passive: true });
  function stepWind(now, dt) {
    if (now > wind.next) { wind.gt = .5 + Math.random() * .6; wind.dir = Math.random() < .7 ? 1 : -1; wind.next = now + 7000 + Math.random() * 11000; bus.emit('wind', { strength: wind.gt, dir: wind.dir }); }
    wind.g += (wind.gt - wind.g) * Math.min(1, dt * 1.6); wind.gt *= Math.exp(-dt * .7); wind.scroll *= Math.exp(-dt * 1.4);
    const base = Math.sin(now * .00031) * .22 + Math.sin(now * .00073 + 1) * .1;
    const w = base + wind.g * wind.dir + wind.scroll * .9;
    bus.state.wind = w; bus.state.windDirection = Math.sign(w) || 1;
    bus.state.energy *= Math.exp(-dt * .35); bus.state.interactionIntensity *= Math.exp(-dt * .6);
    return w;
  }

  /* ——— Cibles (cartes) ——— */
  const targets = new Set(), bySlug = {};
  let raf = 0, last = 0, lost = false, disabled = false;
  const io = new IntersectionObserver(es => es.forEach(en => { const tg = en.target.__fam; if (!tg) return; const was = tg.vis; tg.vis = en.isIntersecting; if (tg.vis) { tg.dirty = true; wake(); if (!was) arrived(tg); } }), { rootMargin: '40px' });
  gl.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; [...targets].forEach(tg => remove(tg.el)); });
  const wake = () => { if (!raf && !lost && !disabled) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  const onScreen = tg => { const r = tg.cv.getBoundingClientRect(); return r.bottom > 30 && r.top < innerHeight - 30 && r.right > 0 && r.left < innerWidth; };

  function add(el, slug) {
    const cv = document.createElement('canvas'); cv.className = 'fam-cv'; cv.setAttribute('aria-hidden', 'true'); el.prepend(cv);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(34, 1, .1, 60);
    const mem = bus.state.mem[slug] ||= {};
    const tg = { el, slug, cv, ctx2: cv.getContext('2d'), scene, cam, S: null, vis: false, dirty: true, k: 0, kT: 0, t: 0, dive: 0, diveT0: 0, pending: [], I: { nx: .5, ny: .5, px: 0, py: 0, tx: 0, ty: 0, k: 0, wind: 0, energy: 0 } };
    tg.ctx = { T, scene, cam, kit, q: { low }, mem, bus,
      energy: v => { bus.state.energy = Math.min(1, bus.state.energy + v); bus.state.interactionIntensity = Math.min(1, bus.state.interactionIntensity + v); },
      canSend: (type, tap) => canSend(tg, type, tap), send: (type, p) => send(tg, type, p) };
    el.__fam = tg; io.observe(el); targets.add(tg); (bySlug[slug] ||= new Set()).add(tg); el.classList.add('live');
    // InteractionManager : la carte transmet le doigt/la souris à sa scène ; un tap (tactile) est une impulsion
    const at = e => { const r = cv.getBoundingClientRect(); tg.I.tx = clamp((e.clientX - r.left) / r.width, 0, 1); tg.I.ty = clamp((e.clientY - r.top) / r.height, 0, 1); };
    let down = null, off = 0;
    el.addEventListener('pointerenter', e => { at(e); tg.kT = 1; wake(); });
    el.addEventListener('pointermove', e => { at(e); tg.kT = 1; });
    el.addEventListener('pointerdown', e => { at(e); tg.kT = 1; clearTimeout(off); down = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType }; wake(); });
    el.addEventListener('pointerup', e => {
      if (down && down.type !== 'mouse' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 450) {
        const r = cv.getBoundingClientRect(), ny = (e.clientY - r.top) / r.height;
        if (ny <= 1 && tg.S && tg.S.tap && !reduced) { el.__famTapped = performance.now(); tg.S.tap(tg.I.tx, tg.I.ty); bus.emit('tap', { from: slug }); }
      }
      down = null; if (e.pointerType !== 'mouse') off = setTimeout(() => tg.kT = 0, 1200);
    });
    el.addEventListener('pointercancel', () => { tg.kT = 0; down = null; });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tg.kT = 0; });
    el.addEventListener('focus', () => { tg.kT = 1; wake(); }, true); el.addEventListener('blur', () => { tg.kT = 0; }, true);
    wake(); return tg;
  }
  function build(tg) {
    tg.S = SCENES[tg.slug](tg.ctx);
    if (reduced) { for (let i = 0; i < 160; i++) { tg.t += 1 / 30; tg.S.update(tg.t, 1 / 30, tg.I); } }
  }

  /* ——— Transit : une matière passe d'une carte à l'autre ——— */
  let lastTransit = -1e9, overlay = null, octx = null;
  const msgs = [];
  function targetOf(type) { const F = FLOW[type]; if (!F) return null; for (const s of F.to) { const t = bySlug[s] && [...bySlug[s]].find(t => t.vis && t.el.isConnected && onScreen(t)); if (t) return t; } return null; }
  function canSend(src, type, tap) {
    if (reduced || disabled || msgs.length) return null;
    const now = performance.now(); if (now - lastTransit < (tap ? 2500 : 8000)) return null;
    const dst = targetOf(type); if (!dst || !onScreen(src) || !onScreen(dst)) return null;
    const a = src.cv.getBoundingClientRect(), b = dst.cv.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2), d = Math.hypot(dx, dy) || 1;
    lastTransit = now; return { x: dx / d, y: dy / d };
  }
  function send(src, type, p) {
    const dst = targetOf(type); bus.emit(type, { ...p, from: src.slug });
    const a = src.cv.getBoundingClientRect();
    if (!dst || !onScreen(dst)) { const F = FLOW[type]; const s = F && F.to.find(x => bySlug[x] && bySlug[x].size); if (s) [...bySlug[s]].forEach(t => { t.pending.push({ type, p }); if (t.pending.length > 2) t.pending.shift(); }); return; }
    const x = a.left + clamp(p.x, 0, 1) * a.width, y = a.top + clamp(p.y, 0, 1) * a.height;
    const b = dst.cv.getBoundingClientRect(), side = Math.abs(b.left + b.width / 2 - x) > Math.abs(b.top + b.height / 2 - y);
    const ex = side ? (b.left > x ? .07 : .93) : .42 + Math.random() * .2, ey = side ? .32 : (b.top > y ? .06 : .7);
    msgs.push({ type, p, dst, ex, ey, x, y, vx: (p.vx || 0) * 220, vy: (p.vy || 0) * 220, age: 0, trail: [], mat: p.material, jit: Array.from({ length: 4 }, () => [Math.random() * 6 - 3, Math.random() * 6 - 3]) });
    if (!overlay) { overlay = document.createElement('canvas'); overlay.className = 'eco-transit'; overlay.setAttribute('aria-hidden', 'true'); document.body.appendChild(overlay); octx = overlay.getContext('2d'); }
    wake();
  }
  function deliver(dst, type, p, ex, ey) { dst.S && dst.S.receive && dst.S.receive(type, { ...p, x: ex, y: ey }); bus.state.lastMaterial = p.material; dst.dirty = true; }
  function arrived(tg) {
    // une matière en attente entre quand la carte apparaît ; sinon, de temps en temps, la carte voisine en envoie une
    if (tg.pending.length && tg.S) { const m = tg.pending.shift(); setTimeout(() => deliver(tg, m.type, m.p, .5, .06), 500); return; }
    const ss = SOURCES(tg.slug), src = ss.map(x => bySlug[x] && [...bySlug[x]].find(t => t.vis)).find(Boolean);
    if (src && src.S && src.S.offer && Math.random() < .4) setTimeout(() => src.S && src.S.offer(false), 600 + Math.random() * 900);
  }
  function stepTransit(dt) {
    if (!overlay) return;
    const D = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    if (overlay.width !== Math.round(W * D) || overlay.height !== Math.round(H * D)) { overlay.width = Math.round(W * D); overlay.height = Math.round(H * D); }
    octx.setTransform(D, 0, 0, D, 0, 0); octx.clearRect(0, 0, W, H);
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]; m.age += dt;
      if (!m.dst.el.isConnected) { msgs.splice(i, 1); continue; }
      const b = m.dst.cv.getBoundingClientRect(), tx = b.left + m.ex * b.width, ty = b.top + m.ey * b.height, dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
      // poursuite douce de la carte voisine + vent + gravité propre à la matière
      const want = Math.min(460, d * 2.4 + 40), g = ({ pollen: -12, light: -20, air: -25, leaf: 10, powder: 20, soil: 120, kernel: 110, water: 80, straw: 40 })[m.mat] ?? 70;
      m.vx += ((dx / (d || 1)) * want - m.vx) * Math.min(1, dt * 3.2) + bus.state.wind * 40 * dt; m.vy += ((dy / (d || 1)) * want - m.vy) * Math.min(1, dt * 3.2) + g * dt;
      m.x += m.vx * dt; m.y += m.vy * dt; m.trail.push([m.x, m.y]); if (m.trail.length > 7) m.trail.shift();
      if (d < 12 || m.age > 3.4) { msgs.splice(i, 1); deliver(m.dst, m.type, { ...m.p, vx: m.vx / 260, vy: m.vy / 260 }, m.ex, m.ey); continue; }
      drawMsg(m);
    }
    if (!msgs.length) { overlay.remove(); overlay = null; }
  }
  function drawMsg(m) {
    const c = octx, a = Math.min(1, m.age / .15);
    if (m.mat === 'grain') {
      m.trail.forEach(([x, y], k) => { c.fillStyle = `rgba(214,168,62,${.05 * k * a})`; c.beginPath(); c.arc(x, y, 1.2, 0, 7); c.fill(); });
      c.save(); c.translate(m.x, m.y); c.rotate(Math.atan2(m.vy, m.vx) + Math.PI / 2 + m.age * 6); const g = c.createLinearGradient(-2.5, 0, 2.5, 0); g.addColorStop(0, '#B7862B'); g.addColorStop(.5, '#F0CB6A'); g.addColorStop(1, '#A87A24'); c.fillStyle = g; c.globalAlpha = a; c.beginPath(); c.ellipse(0, 0, 2.4, 5.2, 0, 0, 7); c.fill(); c.restore();
    } else if (m.mat === 'soil') {
      m.jit.forEach(([jx, jy], k) => { c.fillStyle = `rgba(${k % 2 ? '107,74,47' : '138,104,71'},${.9 * a})`; c.beginPath(); c.arc(m.x + jx + Math.sin(m.age * 9 + k) * 1.2, m.y + jy, 2 + (k % 2), 0, 7); c.fill(); });
    } else if (m.mat === 'light' || m.mat === 'air') {
      const col = m.mat === 'light' ? '246,220,134' : '255,255,255';
      m.trail.forEach(([x, y], k) => { const g = c.createRadialGradient(x, y, 0, x, y, 3 + k * .5); g.addColorStop(0, `rgba(${col},${.12 * k * a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, 3 + k * .5, 0, 7); c.fill(); });
    } else if (m.mat === 'water') {
      c.save(); c.translate(m.x, m.y); c.rotate(Math.atan2(m.vy, m.vx) - Math.PI / 2); c.globalAlpha = a; const g = c.createRadialGradient(-1, -1, 0, 0, 0, 5); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#9CC7CC'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 3.2, 4.6, 0, 0, 7); c.fill(); c.restore();
    } else if (m.mat === 'straw') {
      c.save(); c.translate(m.x, m.y); c.rotate(m.age * 4); c.strokeStyle = `rgba(201,165,100,${a})`; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(-5, 4); c.lineTo(6, 2); c.stroke(); c.restore();
    } else if (m.mat === 'kernel' || m.mat === 'leaf') {
      c.save(); c.translate(m.x, m.y); c.rotate(m.age * (m.mat === 'leaf' ? 3 : 8)); c.globalAlpha = a; c.fillStyle = m.mat === 'leaf' ? '#6E9046' : '#C77C5A'; c.beginPath(); c.ellipse(0, 0, m.mat === 'leaf' ? 7 : 4.5, m.mat === 'leaf' ? 3 : 5.5, 0, 0, 7); c.fill(); c.restore();
    } else if (m.mat === 'powder') {
      m.jit.forEach(([jx, jy], k) => { c.fillStyle = `rgba(${['221,162,53', '181,64,42', '62,44,33', '221,162,53'][k]},${.85 * a})`; c.beginPath(); c.arc(m.x + jx * 1.4 + Math.sin(m.age * 5 + k) * 2, m.y + jy * 1.4, 1.6, 0, 7); c.fill(); });
    } else {
      m.jit.slice(0, 3).forEach(([jx, jy], k) => { const x = m.x + jx * 1.6 + Math.sin(m.age * 3 + k * 2) * 3, y = m.y + jy * 1.6, g = c.createRadialGradient(x, y, 0, x, y, 4.5); g.addColorStop(0, `rgba(241,207,110,${.95 * a})`); g.addColorStop(1, 'rgba(241,207,110,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fill(); });
    }
  }

  /* ——— Événements rares : toutes les 8–20 s, une scène visible peut offrir sa matière… ou non ——— */
  let nextIdle = performance.now() + 6000 + Math.random() * 6000;
  function idle(now) {
    if (reduced || now < nextIdle) return; nextIdle = now + 8000 + Math.random() * 12000;
    if (Math.random() < .3) return;
    const c = [...targets].filter(t => t.vis && t.S && t.S.offer); if (!c.length) return;
    c[(Math.random() * c.length) | 0].S.offer(false);
  }

  /* ——— PerformanceManager ——— */
  const perf = { ema: 0, scale: 1, bad: 0 };
  function judge(cost, dt) {
    perf.ema = perf.ema * .92 + cost * .08;
    if (perf.ema > 22) perf.bad += dt; else perf.bad = Math.max(0, perf.bad - dt * .5);
    if (perf.bad > 2) { perf.bad = 0; if (perf.scale > .6) perf.scale *= .85; else if (perf.ema > 34) { disabled = true; [...targets].forEach(t => { t.el.classList.add('fam-off'); remove(t.el); }); } }
  }

  /* ——— SharedRenderer ——— */
  function renderTarget(tg, dt) {
    const r = tg.cv.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const k = DPR * perf.scale, w = Math.min(1400, Math.round(r.width * k)), h = Math.min(900, Math.round(r.height * k));
    if (tg.cv.width !== w || tg.cv.height !== h) { tg.cv.width = w; tg.cv.height = h; }
    if (w > GW || h > GH) { GW = Math.max(GW, w); GH = Math.max(GH, h); renderer.setSize(GW, GH, false); }
    if (!tg.S) build(tg);
    const I = tg.I, a = Math.min(1, dt * 5);
    tg.k += (tg.kT - tg.k) * Math.min(1, dt * 3);
    const tx = tg.kT ? tg.I.tx : .5, ty = tg.kT ? tg.I.ty : .5;
    I.nx += (tx - I.nx) * a; I.ny += (ty - I.ny) * a; I.px = I.nx - .5; I.py = I.ny - .5; I.k = tg.k; I.wind = bus.state.wind; I.energy = bus.state.energy;
    tg.cam.aspect = w / h; tg.cam.fov = 34;
    tg.S.update(tg.t, dt, I);
    if (tg.dive) { const d = clamp((performance.now() - tg.diveT0) / 650, 0, 1), e = d * d * d; tg.cam.translateZ(-e * 5); tg.cam.fov = 34 - d * 8; }
    tg.cam.updateProjectionMatrix();
    kit.U.scale.value = h / (2 * Math.tan(tg.cam.fov * Math.PI / 360));
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(tg.scene, tg.cam);
    tg.ctx2.clearRect(0, 0, w, h); tg.ctx2.drawImage(gl, 0, GH - h, w, h, 0, 0, w, h);
  }
  function loop(now) {
    raf = 0; if (document.hidden || lost || disabled) return;
    [...targets].forEach(tg => { if (!tg.el.isConnected) remove(tg.el); });
    const live = [...targets].filter(tg => tg.vis);
    if (!live.length && !msgs.length) return;
    const anim = !reduced || live.some(tg => tg.dive);
    if (now - last >= 1000 / FPS - 2 || live.some(tg => tg.dirty)) {
      const dt = Math.min(.1, (now - (last || now)) / 1000) || 1 / FPS; last = now;
      if (!reduced) { stepWind(now, dt); idle(now); }
      const t0 = performance.now();
      live.forEach(tg => { if (!reduced) tg.t += dt; if (anim || tg.dirty) renderTarget(tg, reduced ? 0 : dt); tg.dirty = false; });
      if (anim && live.length) judge(performance.now() - t0, dt);
      stepTransit(dt);
    }
    if (anim || msgs.length || live.some(tg => tg.kT !== tg.k)) raf = requestAnimationFrame(loop);
  }
  if (reduced) addEventListener('resize', () => { targets.forEach(tg => tg.dirty = true); wake(); });
  function remove(el) {
    const tg = el.__fam; if (!tg) return; io.unobserve(el); targets.delete(tg); bySlug[tg.slug] && bySlug[tg.slug].delete(tg); tg.cv.remove(); el.classList.remove('live');
    tg.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); }); el.__fam = null;
  }
  return {
    bus,
    family(el, slug) { if (disabled || !SCENES[slug]) return null; el.style.setProperty('--fam-bg', BG[slug]); return add(el, slug); },
    dive(el) { const tg = el.__fam; if (!tg || reduced) return Promise.resolve(); tg.dive = 1; tg.diveT0 = performance.now(); el.classList.add('diving'); wake(); return new Promise(res => setTimeout(res, 620)); },
    remove,
  };
}
