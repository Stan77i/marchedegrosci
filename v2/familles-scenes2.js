// Marché de Gros CI — Écosystème des familles : les 8 autres scènes. Mêmes règles physiques (Swarm), même kit de
// matières (makeKit), même bus. Chaque scène : 1 mouvement principal, quelques phénomènes secondaires, 1 entrée, 1 sortie.
//   Forêt (viande de brousse) : respiration du feuillage · entrée leaf-drift      · sortie light-pulse
//   Poissons                  : flux aquatique           · entrée light-pulse     · sortie water-ripple
//   Œufs                      : œuf en lévitation        · entrée water-ripple    · sortie straw-drift
//   Volaille                  : plumes en suspension     · entrée straw-drift     · sortie air-current
//   Épices                    : flux de poudres          · entrée air-current     · sortie powder-drift
//   Surgelés                  : cristallisation          · entrée water-ripple    · sortie condensation (→ Légumes)
//   Arachide                  : coque → graines          · entrée soil-disturbance· sortie kernel-roll
//   Autres vivriers           : convergence des matières · entrées powder-drift, kernel-roll · sortie leaf-drift
import { Swarm, clamp, lerp, sm } from './familles-scenes.js';
const TAU = Math.PI * 2;

export const BG2 = {
  'viande-de-brousse': '#DEDCC8', 'poissons': '#D6E2E0', 'volaille': '#EEE5D4', 'oeufs': '#ECE2CF',
  'produits-surgeles': '#DAE4E9', 'assaisonnements-epices-condiments': '#EFD8C1', 'arachide-noix-et-oleagineux': '#EADCC4', 'autres-produits-vivriers': '#E1E5D2',
};

/* ——— outils communs ——— */
// porteur : une matière choisie sort de la carte, poussée vers la carte voisine ; à la sortie, elle part dans le flux global
function carrier(ctx, sw, type, material, push = 6, lift = 0) {
  const { kit, cam, T } = ctx, W = new T.Vector3(); let ids = null, dir = null;
  return {
    get busy() { return !!ids; },
    launch(tap, make) { if (ids) return false; const d = ctx.canSend(type, tap); if (!d) return false; dir = d; ids = [].concat(make(d)); return true; },
    force(i, p, v, o, dt) { if (ids && ids.includes(i)) { v[o] += dir.x * push * dt; v[o + 1] += (-dir.y * push + lift) * dt; } },
    check() { if (!ids) return; const i0 = ids[0], o = i0 * 3; W.set(sw.p[o], sw.p[o + 1], sw.p[o + 2]); const c = kit.toCard(W, cam); if (!sw.on[i0] || c.x < .02 || c.x > .98 || c.y < .02 || c.y > .98) { if (sw.on[i0]) ctx.send(type, { x: c.x, y: c.y, vx: dir.x, vy: dir.y, material }); ids.forEach(i => sw.kill(i)); ids = null; } },
  };
}
const entry = (ctx, d, z = 0) => ctx.kit.fromCard(clamp(d.x, .04, .96), clamp(d.y, .04, .9), ctx.cam, z, new ctx.T.Vector3());
const look = (cam, P, L, I, a = .35, b = .2) => { cam.position.set(P[0] + I.px * a * I.k, P[1] - I.py * b * I.k, P[2]); cam.lookAt(L); };
const both = (...fs) => (i, p, v, o, dt) => fs.forEach(f => f && f(i, p, v, o, dt));
const ringPool = (T, s, n, y, color, op) => Array.from({ length: n }, () => { const g = new T.RingGeometry(.94, 1, 56); g.rotateX(-Math.PI / 2); const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: new T.Color(color), transparent: true, opacity: 0, depthWrite: false })); m.position.y = y; m.visible = false; s.add(m); return { m, t: 9, op, life: 2.6, max: 1.6 }; });
const ripple = (pool, x, z, max = 1.6, life = 2.6, op) => { const r = pool.find(o => o.t >= o.life) || pool[0]; r.t = 0; r.max = max; r.life = life; if (op != null) r.op = op; r.m.position.x = x; r.m.position.z = z; r.m.visible = true; };
const stepRings = (pool, dt) => pool.forEach(r => { if (r.t >= r.life) { r.m.visible = false; return; } r.t += dt; const u = r.t / r.life; r.m.scale.setScalar(.05 + u * r.max); r.m.material.opacity = (1 - u) * (1 - u) * r.op; });
function straws(T, kit, s, n, place, seed) {
  const r = kit.rng(seed), g = new T.CylinderGeometry(.012, .012, .5, 3), im = new T.InstancedMesh(g, kit.mat('#C9A564', { roughness: 1 }), n), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), base = [];
  for (let i = 0; i < n; i++) { const [x, z] = place(r, i); e.set(Math.PI / 2 + (r() - .5) * .2, 0, r() * TAU); q.setFromEuler(e); const sc = .5 + r() * .9; base.push({ x, z, e: e.clone(), sc, y: 0, vy: 0 }); m.compose(new T.Vector3(x, -1.285, z), q, new T.Vector3(1, sc, 1)); im.setMatrixAt(i, m); im.setColorAt(i, new T.Color('#C9A564').offsetHSL(0, 0, (r() - .5) * .14)); }
  s.add(im);
  return { im, base, hop(x, z, k = 1) { base.forEach(b => { const d = Math.hypot(b.x - x, b.z - z); if (d < 1.2) b.vy = Math.max(b.vy, (1.2 - d) * 2.2 * k); }); },
    step(dt) { let moved = false; base.forEach((b, i) => { if (!b.vy && !b.y) return; b.vy -= 9 * dt; b.y += b.vy * dt; if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) > .4 ? -b.vy * .3 : 0; } q.setFromEuler(b.e); m.compose(new T.Vector3(b.x, -1.285 + b.y, b.z), q, new T.Vector3(1, b.sc, 1)); im.setMatrixAt(i, m); moved = true; }); if (moved) im.instanceMatrix.needsUpdate = true; } };
}

/* ═════════ FORÊT (viande de brousse) — profondeur et respiration du feuillage ═════════
   Aucune bête : des troncs dans la brume, un feuillage qui respire, des lucioles, des braises très loin, une lumière
   filtrée. Une feuille reçue (Autres vivriers) tombe en voletant et fait frémir le feuillage. Les lucioles réunies
   peuvent partir comme une impulsion de lumière (light-pulse → Poissons). */
function foret(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(81), bg = BG2['viande-de-brousse'];
  const sun = kit.stage(s, bg, 3.5, 15); sun.color.set('#FFE7BE'); sun.position.set(-2, 6, -3);
  const CAM = [0, 0, 6.6], LOOK = new T.Vector3(0, .25, -2);
  const trunkM = kit.mat('#55503F', { roughness: 1 }), leafM = kit.mat('#3E5E39', { roughness: .9, flatShading: true }), leafM2 = kit.mat('#557A45', { roughness: .9, flatShading: true });
  const NT = q.low ? 10 : 15;
  for (let i = 0; i < NT; i++) { const z = -1 - r() * 11, h = 7, rad = .07 + r() * .14, t = new T.Mesh(new T.CylinderGeometry(rad * .7, rad, h, 7), trunkM); t.position.set((r() - .5) * (6 + -z * .8), -1.3 + h / 2, z); t.rotation.z = (r() - .5) * .08; s.add(t); }
  const NB = q.low ? 18 : 30, blobG = new T.IcosahedronGeometry(1, 1), blobs = [];
  const iA = new T.InstancedMesh(blobG, leafM, NB), iB = new T.InstancedMesh(blobG, leafM2, NB); s.add(iA, iB);
  for (let i = 0; i < NB * 2; i++) blobs.push({ im: i < NB ? iA : iB, k: i % NB, x: (r() - .5) * 12, y: 1.4 + r() * 1.8, z: -r() * 11 + .5, s: .6 + r() * 1.1, ph: r() * TAU });
  const ferns = Array.from({ length: q.low ? 4 : 6 }, (_, i) => { const l = new T.Mesh(kit.leafGeo(.18, 1.1, .3), kit.mat(i % 2 ? 'leaf' : '#4C7038', { side: T.DoubleSide, roughness: .6 })); l.position.set(-2.6 + i * 1.05 + (r() - .5) * .3, -1.3, .6 + r() * .6); l.rotation.set(-.6, (r() - .5) * 1.5, (r() - .5) * .8); s.add(l); return { l, ph: r() * TAU, rx: l.rotation.x }; });
  const mist = Array.from({ length: 4 }, (_, i) => { const m = new T.Mesh(new T.PlaneGeometry(10, 1.8), new T.MeshBasicMaterial({ map: kit.dot, color: 0xF6F3E8, transparent: true, opacity: .4, depthWrite: false })); m.position.set((r() - .5) * 6, -.9 + i * .35, -2 - i * 2.6); s.add(m); return { m, sp: .08 + r() * .08 }; });
  const rays = [[-1.2, .3], [.9, .22], [2.4, .35]].map(([x, rz]) => { const m = new T.Mesh(new T.PlaneGeometry(.7, 8), new T.MeshBasicMaterial({ map: kit.ray, color: 0xFFF0C8, transparent: true, opacity: .08, depthWrite: false, blending: T.AdditiveBlending, fog: false })); m.position.set(x, 1.6, -3.5); m.rotation.z = rz; s.add(m); return m; });
  const flies = new Swarm(kit, { n: q.low ? 12 : 18, color: '#F2D46F', size: .075, drag: 1.8, windK: .3, life: 1e9 }); s.add(flies.obj);
  const fPh = []; for (let i = 0; i < flies.n; i++) { flies.spawn((r() - .5) * 5, -.8 + r() * 2, -r() * 3 + .5, 0, 0, 0, 1e9); fPh.push(r() * TAU); }
  const embers = new Swarm(kit, { n: 6, color: '#E0703A', size: .09, life: 1e9 }); s.add(embers.obj);
  for (let i = 0; i < 6; i++) embers.spawn(-1 + i * .45 + (r() - .5) * .2, -1.18 + r() * .08, -9.5, 0, 0, 0, 1e9);
  const fallen = new Swarm(kit, { n: 6, mesh: { geo: kit.leafGeo(.12, .36, .1), mat: kit.mat('leaf2', { side: T.DoubleSide }) }, g: -.6, drag: 2.2, windK: 1.2, life: 9, floor: -1.28, bounce: 0, spin: 2.5 }); s.add(fallen.obj);
  const out = new Swarm(kit, { n: 4, color: '#F6DC86', size: .11, drag: 1.2, life: 5 }); s.add(out.obj); const C = carrier(ctx, out, 'light-pulse', 'light', 5, .5);
  let rustle = 0, pulse = 0; const ptr = new T.Vector3(), tp = new T.Vector3(), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), E = new T.Euler();
  const offer = tap => C.launch(tap, () => { const i = (Math.random() * flies.n) | 0, o = i * 3; return [0, 1, 2].map(k => out.spawn(flies.p[o] + k * .05, flies.p[o + 1], flies.p[o + 2], 0, .2, 0, 5)); });
  return {
    offer,
    tap(nx, ny) { kit.fromCard(nx, ny, cam, 0, tp); rustle = 1; pulse = 1; ctx.energy(.3); for (let i = 0; i < flies.n; i++) { const o = i * 3, dx = flies.p[o] - tp.x, dy = flies.p[o + 1] - tp.y, d = Math.hypot(dx, dy) + .2; flies.v[o] += dx / d * 1.6; flies.v[o + 1] += dy / d * 1.6; } if (Math.random() < .5) offer(true); },
    receive(type, d) { const p = entry(ctx, d, .3); for (let k = 0; k < 3; k++) fallen.spawn(p.x + k * .1, p.y, p.z - k * .2, (d.vx || 0) * .6, -.1, 0, 9); rustle = 1; },
    update(t, dt, I) {
      const w = I.wind; kit.fromCard(I.nx, I.ny, cam, 0, ptr); rustle *= Math.exp(-dt * .8); pulse *= Math.exp(-dt * 1.4);
      blobs.forEach(b => { const br = 1 + Math.sin(t * .55 + b.ph) * .045 + rustle * Math.sin(t * 8 + b.ph) * .05; E.set(Math.sin(t * .4 + b.ph) * .05, b.ph, w * .04); Q.setFromEuler(E); V.set(b.x + w * .08 * (b.y - 1), b.y, b.z); S.set(b.s * br, b.s * .75 * br, b.s * br); M.compose(V, Q, S); b.im.setMatrixAt(b.k, M); });
      iA.instanceMatrix.needsUpdate = iB.instanceMatrix.needsUpdate = true;
      ferns.forEach(f => { f.l.rotation.x = f.rx + Math.sin(t * .9 + f.ph) * .07 + w * .1 + rustle * Math.sin(t * 9 + f.ph) * .1; });
      mist.forEach(m => { m.m.position.x += (m.sp + w * .1) * dt; if (m.m.position.x > 6) m.m.position.x = -6; });
      rays.forEach((m, i) => { m.material.opacity = .06 + .04 * Math.sin(t * .3 + i * 2.1) + pulse * .1 + I.energy * .04; });
      flies.step(dt, { wind: w * .3, ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: 3 * I.k, r: 1.8 }, fn: (i, p, v, o, d) => { v[o] += Math.sin(t * .7 + fPh[i] * 3) * .5 * d; v[o + 1] += Math.cos(t * .9 + fPh[i] * 2) * .4 * d + (-.1 - p[o + 1]) * .15 * d; v[o + 2] += Math.sin(t * .5 + fPh[i]) * .2 * d; if (Math.abs(p[o]) > 3.4) v[o] -= p[o] * .5 * d; } });
      for (let i = 0; i < flies.n; i++) flies.sc[i] = .25 + .75 * Math.pow(Math.max(0, Math.sin(t * 1.7 + fPh[i] * 5)), 3) + pulse * .5;
      flies.sync(); for (let i = 0; i < 6; i++) embers.sc[i] = .5 + .3 * Math.sin(t * 6 + i * 2) + .2 * Math.sin(t * 13 + i); embers.sync();
      fallen.step(dt, { wind: w * .8, fn: (i, p, v, o, d) => { v[o] += Math.cos(t * 2.2 + i) * .9 * d; } }); fallen.sync();
      out.step(dt, { fn: C.force }); C.check(); out.sync();
      look(cam, CAM, LOOK, I, .45, .25);
    },
  };
}

/* ═════════ POISSONS — l'eau vue de l'intérieur ═════════
   La surface ondule au-dessus, la lumière y entre en rayons, un banc de points brillants suit son guide, des bulles
   montent. Une impulsion de lumière reçue (Forêt) frappe la surface et attire le banc. Un tap fait une onde ; une onde
   peut partir (water-ripple → Œufs ou Surgelés). */
function poissons(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(91), bg = BG2['poissons'];
  const sun = kit.stage(s, bg, 3.5, 13); sun.position.set(.5, 7, 1); sun.color.set('#F1FBFF');
  const CAM = [0, -.15, 6.5], LOOK = new T.Vector3(0, .15, 0), SY = 1.9;
  const sg = new T.PlaneGeometry(16, 11, q.low ? 22 : 30, q.low ? 15 : 20); sg.rotateX(-Math.PI / 2); const sp = sg.attributes.position, s0 = Float32Array.from(sp.array);
  const surf = new T.Mesh(sg, new T.MeshStandardMaterial({ color: 0xF4FBF9, emissive: 0xBFDCD8, emissiveIntensity: .45, transparent: true, opacity: .6, side: T.DoubleSide, flatShading: true, roughness: .2 })); surf.position.y = SY; s.add(surf);
  const rays = Array.from({ length: q.low ? 3 : 5 }, (_, i) => { const m = new T.Mesh(new T.PlaneGeometry(.55 + r() * .5, 6.5), new T.MeshBasicMaterial({ map: kit.ray, color: 0xFFFFFF, transparent: true, opacity: .12, depthWrite: false, blending: T.AdditiveBlending, fog: false })); m.position.set(-2.6 + i * 1.3 + (r() - .5) * .4, .1, -1.5 - r() * 2); m.rotation.z = -.25 + r() * .1; s.add(m); return { m, ph: r() * TAU }; });
  kit.shade(s, 0, -.5, 7, 3, .16);
  for (let i = 0; i < 6; i++) { const p = new T.Mesh(kit.bumpy(new T.DodecahedronGeometry(.12 + r() * .14, 0), .15, i), kit.mat('#9FB2AD', { roughness: 1 })); p.position.set((r() - .5) * 5, -1.25, -r() * 2 + .4); p.scale.y = .6; s.add(p); }
  const weeds = [-2.2, -1.7, 1.9, 2.4].map((x, i) => { const g = new T.Group(); const c = new T.CatmullRomCurve3([0, .5, 1, 1.5, 2].map(y => new T.Vector3(Math.sin(y * 1.5 + i) * .15, y, 0))); g.add(new T.Mesh(new T.TubeGeometry(c, 20, .025, 4), kit.mat('#6F9271', { roughness: .8 }))); g.position.set(x, -1.3, -.6 - i * .3); g.scale.y = .8 + r() * .5; s.add(g); return { g, ph: r() * TAU }; });
  const NS = q.low ? 30 : 46, school = new Swarm(kit, { n: NS, color: '#FFFFFF', size: .065, op: .95, drag: 2.6, windK: 0, life: 1e9 }); s.add(school.obj);
  const off = Array.from({ length: NS }, () => [(r() - .5) * 1.4, (r() - .5) * .35, (r() - .5) * .5]); for (let i = 0; i < NS; i++) school.spawn((r() - .5) * 2, 0, 0, 0, 0, 0, 1e9);
  const specks = new Swarm(kit, { n: q.low ? 18 : 30, color: '#F4F8F0', size: .035, op: .6, drag: 2, life: 1e9 }); s.add(specks.obj); for (let i = 0; i < specks.n; i++) specks.spawn((r() - .5) * 7, -1.2 + r() * 3, -r() * 4 + 1, 0, 0, 0, 1e9);
  const bubbles = new Swarm(kit, { n: 18, color: '#FFFFFF', size: .06, g: 1.6, drag: 1.1, life: 3 }); s.add(bubbles.obj);
  const rings = ringPool(T, s, 3, SY - .02, '#FFFFFF', .6);
  const out = new Swarm(kit, { n: 4, color: 'water', size: .1, drag: 1, life: 5 }); s.add(out.obj); const C = carrier(ctx, out, 'water-ripple', 'water', 6, .4);
  let flash = 0, lure = null, nextB = 1, nextR = 6; const L = new T.Vector3(), ptr = new T.Vector3(), tp = new T.Vector3();
  const offer = tap => C.launch(tap, () => { ripple(rings, L.x, L.z * .3, 1.4); return [0, 1].map(k => out.spawn(L.x + k * .1, SY - .1, .5, 0, -.2, 0, 5)); });
  return {
    offer,
    tap(nx, ny) { kit.fromCard(nx, ny, cam, 0, tp); ripple(rings, tp.x, 0, 1.8); ctx.energy(.3); for (let i = 0; i < NS; i++) { const o = i * 3, dx = school.p[o] - tp.x, dy = school.p[o + 1] - tp.y, d = Math.hypot(dx, dy) + .3; school.v[o] += dx / d * 2.4; school.v[o + 1] += dy / d * 1.6; } for (let k = 0; k < 5; k++) bubbles.spawn(tp.x + (Math.random() - .5) * .3, Math.min(tp.y, 1.2), .3, 0, .4, 0, 3); if (Math.random() < .6) setTimeout(() => offer(true), 400); },
    receive(type, d) { const p = entry(ctx, d, 0); flash = 1; lure = { x: p.x, y: Math.min(p.y, 1), t: 3.5 }; ripple(rings, p.x, 0, 2.2, 3, .8); },
    update(t, dt, I) {
      const w = I.wind; kit.fromCard(I.nx, I.ny, cam, .3, ptr); flash *= Math.exp(-dt * 1.1);
      for (let i = 0; i < sp.count; i++) { const x = s0[i * 3], z = s0[i * 3 + 2]; sp.setY(i, Math.sin(x * .9 + t * .9 + w) * .09 + Math.cos(z * 1.3 - t * .7) * .07 + Math.sin((x - z) * 1.8 + t * 1.6) * .03); } sp.needsUpdate = true;
      surf.material.emissiveIntensity = .45 + flash * .5;
      rays.forEach(o => { o.m.material.opacity = .08 + .06 * Math.sin(t * .6 + o.ph) + flash * .18; o.m.rotation.z = -.22 + Math.sin(t * .35 + o.ph) * .05; });
      weeds.forEach(o => { o.g.rotation.z = Math.sin(t * .8 + o.ph) * .08 + w * .05; });
      // guide du banc : une boucle lente ; une lumière reçue l'attire un moment
      if (lure) { lure.t -= dt; L.lerp(tp.set(lure.x, lure.y, .2), Math.min(1, dt * 1.2)); if (lure.t <= 0) lure = null; } else L.set(Math.sin(t * .33) * 2.2, Math.sin(t * .51) * .45 + .05, Math.cos(t * .33) * 1.1 - .4);
      const hd = Math.atan2(Math.cos(t * .33) * 2.2 * .33, -Math.sin(t * .33) * 1.1 * .33), ch = Math.cos(hd), sh = Math.sin(hd);
      school.step(dt, { ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: 5 * I.k, r: 1.5 }, fn: (i, p, v, o, d) => { const [a, b, c] = off[i]; v[o] += (L.x + a * ch - c * sh - p[o]) * 3 * d; v[o + 1] += (L.y + b - p[o + 1]) * 3 * d; v[o + 2] += (L.z + a * sh + c * ch - p[o + 2]) * 3 * d; } });
      for (let i = 0; i < NS; i++) school.sc[i] = .55 + .45 * Math.pow(Math.max(0, Math.sin(t * 2.6 + i * 1.7)), 6) + flash * .4; school.sync();
      specks.step(dt, { fn: (i, p, v, o, d) => { v[o] += (Math.sin(t * .4 + i) * .05 + w * .03) * d; v[o + 1] += Math.cos(t * .3 + i * 2) * .04 * d; if (Math.abs(p[o]) > 3.6) p[o] *= -.97; } }); specks.sync();
      if (t > nextB) { nextB = t + .6 + Math.random() * 1.4; bubbles.spawn(-2 + Math.random() * 4, -1.2, -.2 + Math.random() * .5, 0, .3, 0, 3); }
      bubbles.step(dt, { fn: (i, p, v, o, d) => { v[o] += Math.sin(t * 4 + i) * .4 * d; if (p[o + 1] > SY - .05) bubbles.kill(i); } }); bubbles.sync();
      if (t > nextR) { nextR = t + 5 + Math.random() * 5; ripple(rings, (Math.random() - .5) * 4, (Math.random() - .5) * 2, 1.3, 3, .35); }
      stepRings(rings, dt);
      out.step(dt, { fn: C.force }); C.check(); out.sync();
      look(cam, CAM, LOOK, I);
    },
  };
}

/* ═════════ ŒUFS — un œuf en lévitation douce ═════════
   La lumière tourne lentement et glisse sur la coquille. À chaque descente, une onde calme s'étend sur le sol de paille.
   Une onde reçue (Poissons) fait plonger l'œuf un instant et ouvre une grande onde. Des brins de paille peuvent se
   soulever et partir (straw-drift → Volaille). */
function oeufs(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(101), bg = BG2['oeufs'];
  const sun = kit.stage(s, bg, 6, 14);
  const CAM = [0, .35, 6.6], LOOK = new T.Vector3(0, -.15, 0);
  const prof = Array.from({ length: 21 }, (_, i) => { const a = i / 20 * Math.PI; return [Math.sin(a) * .42 * (1 - .17 * Math.cos(a)), -Math.cos(a) * .56]; });
  const egg = new T.Mesh(kit.lathe(prof, 32), new T.MeshStandardMaterial({ color: new T.Color('#F3EADB'), roughness: .3, emissive: new T.Color('#FFF3DE'), emissiveIntensity: 0 })); s.add(egg);
  const shadow = kit.shade(s, 0, 0, 1.6, 1.1, .3);
  const st = straws(T, kit, s, q.low ? 28 : 44, (rr) => { const a = rr() * TAU, d = 1.1 + rr() * 1.5; return [Math.cos(a) * d, Math.sin(a) * d * .6]; }, 7);
  const rings = ringPool(T, s, 4, -1.28, '#A8936E', .45);
  const out = new Swarm(kit, { n: 4, mesh: { geo: new T.CylinderGeometry(.012, .012, .5, 3), mat: kit.mat('#C9A564', { roughness: 1 }) }, g: -.6, drag: 1.2, life: 5, spin: 3 }); s.add(out.obj); const C = carrier(ctx, out, 'straw-drift', 'straw', 5, 2.2);
  let dip = 0, spin = 0, glow = 0, lastLow = 0, prevY = 0;
  const offer = tap => C.launch(tap, () => { const b = st.base[(Math.random() * st.base.length) | 0]; st.hop(b.x, b.z, .6); return [0, 1, 2].map(k => out.spawn(b.x + k * .08, -1.2, b.z, 0, 1.6, 0, 5)); });
  return {
    offer,
    tap(nx, ny) { spin = 1; glow = .6; ctx.energy(.25); ripple(rings, 0, 0, 2.2, 3, .5); st.hop(0, 0, .5); if (Math.random() < .55) setTimeout(() => offer(true), 500); },
    receive(type, d) { dip = 1; glow = 1; ripple(rings, 0, 0, 2.8, 3.4, .6); setTimeout(() => ripple(rings, 0, 0, 2, 3, .4), 500); st.hop(0, 0, .8); },
    update(t, dt, I) {
      dip *= Math.exp(-dt * 1.3); spin *= Math.exp(-dt * .7); glow *= Math.exp(-dt * 1.2);
      const y = .05 + Math.sin(t * .7) * .13 - dip * .45;
      egg.position.set(Math.sin(t * .23) * .05, y, 0);
      egg.rotation.set(.18 + I.py * .25 * I.k, egg.rotation.y + dt * (.12 + spin * 2.5), -.12 - I.px * .3 * I.k + Math.sin(t * .5) * .04);
      egg.material.emissiveIntensity = glow * .25;
      const h = y + 1.3; shadow.scale.setScalar(1.25 - h * .22); shadow.material.opacity = .32 - h * .06;
      if (y < prevY && Math.sin(t * .7) < -.97 && t - lastLow > 4) { lastLow = t; ripple(rings, 0, 0, 1.8, 3.2, .4); } prevY = y;
      stepRings(rings, dt); st.step(dt);
      const a = t * .28 + I.px * 2 * I.k; sun.position.set(Math.cos(a) * 4.5, 4 - I.py * 2 * I.k, Math.sin(a) * 3 + 2);
      out.step(dt, { wind: I.wind * .5, fn: C.force }); C.check(); out.sync();
      look(cam, CAM, LOOK, I, .3, .15);
    },
  };
}

/* ═════════ VOLAILLE — des plumes en suspension ═════════
   Les plumes descendent comme des feuilles mortes (poids faible, air fort, balancier), se posent sur la paille, puis
   l'air les reprend. Le doigt souffle sur elles. La paille reçue (Œufs) tombe et rebondit ; un courant d'air peut
   partir vers les Épices (air-current). */
function volaille(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(111), bg = BG2['volaille'];
  const sun = kit.stage(s, bg, 6, 14); sun.color.set('#FFD9A6');
  const CAM = [0, .25, 6.8], LOOK = new T.Vector3(0, -.1, 0), FLOOR = -1.24;
  kit.shade(s, 0, 0, 6, 2.6, .18);
  const st = straws(T, kit, s, q.low ? 40 : 64, rr => [(rr() - .5) * 6.5, (rr() - .5) * 2.4], 3);
  const ray = new T.Mesh(new T.PlaneGeometry(1.4, 7), new T.MeshBasicMaterial({ map: kit.ray, color: 0xFFDCA4, transparent: true, opacity: .14, depthWrite: false, blending: T.AdditiveBlending, fog: false })); ray.position.set(-1.2, 1.2, -1.5); ray.rotation.z = .35; s.add(ray);
  const cols = ['#F4EEE2', '#B9773D', '#8E4B2A', '#E5D1AC', '#5D3B27', '#F4EEE2', '#C99456'];
  const F = Array.from({ length: q.low ? 6 : 8 }, (_, i) => { const g = new T.Group(); g.add(new T.Mesh(kit.leafGeo(.16, .95, .08), kit.mat(cols[i % cols.length], { side: T.DoubleSide, roughness: .95 }))); const rc = new T.Mesh(new T.CylinderGeometry(.008, .014, 1.1, 4), kit.mat('#EFE6D4')); rc.position.y = .45; g.add(rc); g.scale.setScalar(.75 + r() * .3); s.add(g); return { g, p: new T.Vector3((r() - .5) * 5, r() * 4 - 1, (r() - .5) * 2 - .3), v: new T.Vector3(), ph: r() * TAU, sp: (r() - .5) * 2, rest: 0 }; });
  const motes = new Swarm(kit, { n: q.low ? 14 : 22, color: '#F2D9A8', size: .055, op: .7, drag: 1, windK: .6, life: 1e9 }); s.add(motes.obj); for (let i = 0; i < motes.n; i++) motes.spawn(-2.2 + r() * 2.4, r() * 3 - 1, (r() - .5) * 2, 0, 0, 0, 1e9);
  const strawIn = new Swarm(kit, { n: 8, mesh: { geo: new T.CylinderGeometry(.012, .012, .5, 3), mat: kit.mat('#C9A564', { roughness: 1 }) }, g: -2.5, drag: 1.2, windK: .6, life: 8, floor: -1.26, bounce: .25, spin: 3 }); s.add(strawIn.obj);
  const out = new Swarm(kit, { n: 6, color: '#FFFFFF', size: .09, drag: .9, life: 5 }); s.add(out.obj); const C = carrier(ctx, out, 'air-current', 'air', 6, .8);
  let gust = 0; const ptr = new T.Vector3(), tp = new T.Vector3();
  const offer = tap => C.launch(tap, () => { const f = F[(Math.random() * F.length) | 0]; f.v.y += 1.2; return [0, 1, 2, 3].map(k => out.spawn(f.p.x + k * .1, f.p.y + .2, f.p.z, 0, .4, 0, 5)); });
  return {
    offer,
    tap(nx, ny) { kit.fromCard(nx, ny, cam, 0, tp); gust = 1; ctx.energy(.3); F.forEach(f => { const d = f.p.distanceTo(tp); if (d < 2.4) { f.v.y += (2.4 - d) * .9; f.v.x += (f.p.x - tp.x) * .6; f.rest = 0; } }); st.hop(tp.x, 0, .6); if (Math.random() < .55) setTimeout(() => offer(true), 300); },
    receive(type, d) { const p = entry(ctx, d, .2); for (let k = 0; k < 4; k++) strawIn.spawn(p.x + k * .12, p.y, p.z, (d.vx || 0) * 1.2, .2, 0, 8); },
    update(t, dt, I) {
      const w = I.wind; kit.fromCard(I.nx, I.ny, cam, 0, ptr); gust *= Math.exp(-dt * .9);
      F.forEach((f, i) => {
        if (f.p.y <= FLOOR + .02 && f.v.y <= 0) { f.rest += dt; f.g.rotation.x = lerp(f.g.rotation.x, -Math.PI / 2, dt * 2); f.v.set(0, 0, 0); if (f.rest > 3.5 + i * .3 || Math.abs(w) > 1) { f.rest = 0; f.v.set(w * .5, 1.4 + Math.random(), 0); } }
        else {
          f.ph += dt * (1.3 + i * .07);
          f.v.y += (-.32 - f.v.y) * Math.min(1, dt * 1.6); f.v.x += (Math.cos(f.ph) * .8 + w * 1.4 - f.v.x) * Math.min(1, dt * 1.3); f.v.z += (Math.sin(f.ph * .7) * .2 - f.v.z) * dt;
          if (I.k) { const dx = f.p.x - ptr.x, dy = f.p.y - ptr.y, d = Math.hypot(dx, dy) + .1; if (d < 1.5) { f.v.x += dx / d * 2.4 * I.k * dt; f.v.y += dy / d * 2 * I.k * dt; } }
          f.p.addScaledVector(f.v, dt);
          f.g.rotation.set(Math.cos(f.ph * .8) * .5, f.g.rotation.y + f.sp * dt, Math.sin(f.ph) * .7);
          if (f.p.y > 3.4) f.p.y = 3.4; if (f.p.x > 4) f.p.x = -4; if (f.p.x < -4) f.p.x = 4; if (f.p.y < FLOOR) f.p.y = FLOOR;
        }
        f.g.position.copy(f.p);
      });
      ray.material.opacity = .11 + .03 * Math.sin(t * .4) + gust * .05;
      motes.step(dt, { wind: w * .4, ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: -2 * I.k, r: 1 }, fn: (i, p, v, o, d) => { v[o] += Math.sin(t * .5 + i) * .05 * d; v[o + 1] += Math.cos(t * .4 + i) * .05 * d; if (p[o + 1] > 2.2) p[o + 1] = -1; if (Math.abs(p[o]) > 3.6) p[o] *= -.95; } }); motes.sync();
      strawIn.step(dt, { wind: w * .3 }); strawIn.sync(); st.step(dt);
      out.step(dt, { wind: w, fn: both(C.force, (i, p, v, o, d) => { v[o + 1] += Math.sin(t * 6 + i) * .6 * d; }) }); C.check(); out.sync();
      look(cam, CAM, LOOK, I);
    },
  };
}

/* ═════════ ÉPICES — un flux de poudres ═════════
   Trois matières, trois comportements : le piment (lourd) retombe, le curcuma (léger) flotte et s'agglomère, le poivre
   (fin) est emporté par le vent. Tout tourne lentement autour des tas. Un courant d'air reçu (Volaille) disperse la
   poudre ; une bouffée colorée peut partir (powder-drift → Autres vivriers). */
function epices(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(121), bg = BG2['assaisonnements-epices-condiments'];
  kit.stage(s, bg, 6, 14);
  const CAM = [0, 1, 6.7], LOOK = new T.Vector3(.1, -.2, 0);
  kit.shade(s, 0, 0, 5, 2.2, .2);
  const piles = [['#B23A22', -1.05, .1, .6], ['#D69A2D', .2, -.2, .75], ['#4A3426', 1.35, .25, .45]].map(([c, x, z, h], i) => { const m = new T.Mesh(kit.bumpy(new T.ConeGeometry(.62, h, 26, 4), .07, i + 3), kit.mat(c, { roughness: 1 })); m.position.set(x, -1.3 + h / 2, z); s.add(m); return { x, z, top: -1.3 + h }; });
  const n = q.low ? [26, 26, 20] : [40, 40, 32];
  const red = new Swarm(kit, { n: n[0], color: '#B5402A', size: .065, g: -.4, drag: 1.2, windK: .6, life: 6 }), yel = new Swarm(kit, { n: n[1], color: '#DDA235', size: .085, g: .03, drag: 1.7, windK: .9, life: 7 }), blk = new Swarm(kit, { n: n[2], color: '#3E2C21', size: .045, g: -.08, drag: .9, windK: 1.9, life: 5 });
  const SW = [red, yel, blk]; SW.forEach(w => s.add(w.obj));
  const smoke = new Swarm(kit, { n: 8, color: '#F7E8D6', size: .55, op: .22, g: .12, drag: .6, windK: .5, life: 6 }); s.add(smoke.obj);
  const out = new Swarm(kit, { n: 6, color: '#DDA235', size: .1, drag: 1, life: 5 }); s.add(out.obj); const C = carrier(ctx, out, 'powder-drift', 'powder', 6, .6);
  let gust = 0, nextS = 0; const ptr = new T.Vector3(), tp = new T.Vector3(), CL = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  const emit = (w, k, pi, burst = 1) => { const p = piles[pi]; w.spawn(p.x + (Math.random() - .5) * .2, p.top, p.z + (Math.random() - .5) * .2, (Math.random() - .5) * .5 * burst, (.6 + Math.random() * .6) * burst, (Math.random() - .5) * .3, w.L * (.6 + Math.random() * .4)); };
  const vortex = (i, p, v, o, d) => { const dx = p[o], dz = p[o + 2] + .1, dd = Math.hypot(dx, dz) + .3; v[o] += -dz / dd * .9 * d; v[o + 2] += dx / dd * .5 * d; if (p[o + 1] < -1.28) { p[o + 1] = -1.28; v[o + 1] = 0; v[o] *= .5; } };
  const offer = tap => C.launch(tap, () => [0, 1, 2, 3].map(k => out.spawn(piles[1].x + k * .06, piles[1].top + .1, piles[1].z, 0, .8, 0, 5)));
  return {
    offer,
    tap(nx, ny) { kit.fromCard(nx, ny, cam, 0, tp); ctx.energy(.3); let best = 0; piles.forEach((p, i) => { if (Math.abs(p.x - tp.x) < Math.abs(piles[best].x - tp.x)) best = i; }); for (let k = 0; k < 14; k++) emit(SW[best], 1, best, 1.8); smoke.spawn(piles[best].x, piles[best].top, piles[best].z, 0, .5, 0, 6); if (Math.random() < .55) setTimeout(() => offer(true), 300); },
    receive(type, d) { gust = 1; ctx.energy(.2); },
    update(t, dt, I) {
      const w = I.wind + gust * 1.6 * Math.sign(I.wind || 1); gust *= Math.exp(-dt * .6); kit.fromCard(I.nx, I.ny, cam, 0, ptr);
      SW.forEach((sw, k) => { const want = sw.n * .8; if (sw.alive() < want && Math.random() < dt * 14) emit(sw, 1, k); });
      CL.forEach((c, i) => c.set(Math.sin(t * .3 + i * 2.1) * 1.4, .4 + Math.sin(t * .45 + i) * .35, Math.cos(t * .3 + i * 2.1) * .5));
      const P = { x: ptr.x, y: ptr.y, z: ptr.z, s: 4 * I.k, r: 1.4 };
      red.step(dt, { wind: w, ptr: P, fn: vortex }); red.sync();
      yel.step(dt, { wind: w, ptr: P, fn: both(vortex, (i, p, v, o, d) => { const c = CL[i % 3]; v[o] += (c.x - p[o]) * .25 * d; v[o + 1] += (c.y - p[o + 1]) * .3 * d; v[o + 2] += (c.z - p[o + 2]) * .25 * d; }) }); yel.sync();
      blk.step(dt, { wind: w, ptr: P, fn: vortex }); blk.sync();
      if (t > nextS) { nextS = t + 1.4 + Math.random() * 2; const pi = (Math.random() * 3) | 0; smoke.spawn(piles[pi].x, piles[pi].top + .1, piles[pi].z, 0, .25, 0, 6); }
      smoke.step(dt, { wind: w * .6, fn: (i, p, v, o, d) => { v[o] += Math.sin(t + i) * .1 * d; } }); smoke.sync();
      out.step(dt, { wind: w * .5, fn: C.force }); C.check(); out.sync();
      look(cam, CAM, LOOK, I);
    },
  };
}

/* ═════════ SURGELÉS — la cristallisation ═════════
   Un cristal de glace se forme branche après branche, le givre s'accroche aux pointes, des flocons fins tombent dans une
   lumière froide. Plein, il tient, puis fond : une goutte peut partir (condensation → Légumes : l'eau qui fait pousser).
   Une onde reçue (Poissons) apporte des gouttes qui gèlent au contact et relancent la croissance. */
function surgeles(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(131), bg = BG2['produits-surgeles'];
  const sun = kit.stage(s, bg, 5, 14); sun.color.set('#E2F0FF'); sun.intensity = 2.2;
  const CAM = [0, .2, 6.4], LOOK = new T.Vector3(0, .05, 0);
  const iceM = new T.MeshStandardMaterial({ color: 0xF5FBFE, emissive: 0xA9CBE0, emissiveIntensity: .3, roughness: .1, metalness: .15, transparent: true, opacity: .92 });
  const segG = new T.BoxGeometry(1, .04, .04); segG.translate(.5, 0, 0);
  const mkCrystal = (x, y, z, sc) => {
    const parts = []; for (let a = 0; a < 6; a++) { const A = a * Math.PI / 3; for (let k = 0; k < 5; k++) parts.push({ r: k * .3, a: A, l: .3, u: k / 5 * .55 }); for (let k = 1; k < 5; k++) [1, -1].forEach(sg => parts.push({ r: k * .3 + .05, a: A + sg * Math.PI / 3, base: A, l: .36 * (1 - k * .16), u: .55 * k / 5 + .14 })); }
    const im = new T.InstancedMesh(segG, iceM, parts.length), g = new T.Group(); g.add(im); g.position.set(x, y, z); g.scale.setScalar(sc); s.add(g); return { g, im, parts };
  };
  const C1 = mkCrystal(-.2, .25, 0, 1), C2 = mkCrystal(1.9, -.4, -2.2, .55), CR = [C1, C2];
  const frost = new Swarm(kit, { n: q.low ? 30 : 46, color: '#FFFFFF', size: .05, drag: 2, life: 3 }); s.add(frost.obj);
  const snow = new Swarm(kit, { n: q.low ? 26 : 40, color: '#FFFFFF', size: .045, op: .85, g: -.08, drag: 1.4, windK: .5, life: 1e9 }); s.add(snow.obj); for (let i = 0; i < snow.n; i++) snow.spawn((r() - .5) * 7, r() * 4 - 1.5, (r() - .5) * 3, 0, -.15, 0, 1e9);
  const drops = new Swarm(kit, { n: 10, color: 'water', size: .08, g: -.3, drag: 1.4, life: 4 }); s.add(drops.obj);
  const out = new Swarm(kit, { n: 3, color: 'water', size: .11, drag: .8, life: 5 }); s.add(out.obj); const C = carrier(ctx, out, 'condensation', 'water', 5, .3);
  let G = 0, phase = 'grow', hold = 0, melt = 0, wob = 0; const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(), tp = new T.Vector3(), ptr = new T.Vector3(), W = new T.Vector3();
  const tipWorld = (c, pt) => { V.set(Math.cos(pt.base ?? pt.a) * pt.r + Math.cos(pt.a) * pt.l, Math.sin(pt.base ?? pt.a) * pt.r + Math.sin(pt.a) * pt.l, 0); return V.applyMatrix4(c.g.matrixWorld); };
  const offer = tap => C.launch(tap, () => { C1.g.updateMatrixWorld(); const p = tipWorld(C1, C1.parts[(Math.random() * C1.parts.length) | 0]); return [out.spawn(p.x, p.y, p.z, 0, -.3, 0, 5)]; });
  return {
    offer,
    tap(nx, ny) { wob = 1; ctx.energy(.25); C1.g.updateMatrixWorld(); for (let k = 0; k < 10; k++) { const p = tipWorld(C1, C1.parts[(Math.random() * C1.parts.length) | 0]); frost.spawn(p.x, p.y, p.z, (Math.random() - .5) * .6, (Math.random() - .5) * .6, 0, 2); } if (phase === 'hold') hold = 99; else if (Math.random() < .5) offer(true); },
    receive(type, d) { const p = entry(ctx, d, 0); for (let k = 0; k < 6; k++) drops.spawn(p.x + (Math.random() - .5) * .3, p.y, p.z, (C1.g.position.x - p.x) * .7, (C1.g.position.y - p.y) * .7, 0, 4); },
    update(t, dt, I) {
      const w = I.wind; kit.fromCard(I.nx, I.ny, cam, 0, ptr); wob *= Math.exp(-dt * 2);
      if (phase === 'grow') { G = Math.min(1, G + dt / 9); if (G >= 1) { phase = 'hold'; hold = 0; } }
      else if (phase === 'hold') { hold += dt; if (hold > 4) { phase = 'melt'; melt = 0; offer(false); } }
      else { melt = Math.min(1, melt + dt / 2.6); if (Math.random() < dt * 4) { C1.g.updateMatrixWorld(); const p = tipWorld(C1, C1.parts[(Math.random() * C1.parts.length) | 0]); drops.spawn(p.x, p.y, p.z, 0, -.1, 0, 2.5); } if (melt >= 1) { phase = 'grow'; G = 0; melt = 0; } }
      iceM.opacity = .92 * (1 - melt * .9); iceM.emissiveIntensity = .3 + Math.sin(t * 1.3) * .05 + wob * .2;
      CR.forEach((c, ci) => { c.g.rotation.set(Math.sin(t * .2 + ci) * .25 + I.py * .4 * I.k, t * .12 + ci + I.px * .5 * I.k, t * .05 + Math.sin(t * 7) * .02 * wob); c.parts.forEach((pt, i) => { const gg = ci ? clamp(G * 1.25, 0, 1) : G, k = sm(pt.u, pt.u + .22, gg) * (1 - melt * .6); const bx = Math.cos(pt.base ?? pt.a) * pt.r, by = Math.sin(pt.base ?? pt.a) * pt.r; V.set(pt.base != null ? bx : Math.cos(pt.a) * pt.r, pt.base != null ? by : Math.sin(pt.a) * pt.r, 0); E.set(0, 0, pt.a); Q.setFromEuler(E); S.set(Math.max(.001, pt.l * k), Math.max(.001, k), Math.max(.001, k)); M.compose(V, Q, S); c.im.setMatrixAt(i, M); }); c.im.instanceMatrix.needsUpdate = true; });
      if (phase === 'grow' && Math.random() < dt * 6) { C1.g.updateMatrixWorld(); const pt = C1.parts.filter(p => sm(p.u, p.u + .22, G) > .9); if (pt.length) { const p = tipWorld(C1, pt[(Math.random() * pt.length) | 0]); frost.spawn(p.x, p.y, p.z, (Math.random() - .5) * .1, (Math.random() - .5) * .1, 0, 2.5); } }
      frost.step(dt); frost.sync();
      snow.step(dt, { wind: w * .4, ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: -2 * I.k, r: 1.2 }, fn: (i, p, v, o, d) => { v[o] += Math.sin(t * .6 + i) * .06 * d; v[o + 1] += (-.15 - v[o + 1]) * d; if (p[o + 1] < -1.5) p[o + 1] = 2.6; if (Math.abs(p[o]) > 3.6) p[o] *= -.95; } }); snow.sync();
      drops.step(dt, { fn: (i, p, v, o, d) => { if (phase !== 'melt') { W.set(p[o], p[o + 1], p[o + 2]); if (W.distanceTo(C1.g.position) < .5) { drops.kill(i); G = Math.min(1, G + .08); wob = .6; for (let k = 0; k < 4; k++) frost.spawn(p[o], p[o + 1], p[o + 2], (Math.random() - .5) * .5, (Math.random() - .5) * .5, 0, 1.5); if (phase === 'hold') hold = 0; } } else v[o + 1] -= 1.6 * d; } }); drops.sync();
      out.step(dt, { fn: C.force }); C.check(); out.sync();
      look(cam, CAM, LOOK, I);
    },
  };
}

/* ═════════ ARACHIDE — la coque s'ouvre, les graines roulent ═════════
   Fermée, la coque vibre à peine ; elle s'ouvre sur sa charnière, les deux graines tombent, rebondissent, roulent et se
   posent ; puis tout se referme et de nouvelles graines se forment. De la terre reçue (Tubercules) la fait vibrer et
   s'ouvrir. Une graine peut rouler hors de la carte (kernel-roll → Autres vivriers). */
function arachide(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(141), bg = BG2['arachide-noix-et-oleagineux'];
  kit.stage(s, bg, 6, 14);
  const CAM = [0, .75, 6.2], LOOK = new T.Vector3(.1, -.55, 0), FLOOR = -1.3;
  kit.shade(s, 0, .2, 5, 2.2, .2);
  const prof = Array.from({ length: 19 }, (_, i) => { const u = i / 18; return [Math.max(.001, .3 * Math.pow(Math.sin(Math.PI * u), .6) * (1 - .2 * Math.exp(-Math.pow((u - .5) / .12, 2)))), (u - .5) * 1.5]; });
  const R = .3, shellM = kit.mat('#C9A675', { roughness: 1, side: T.DoubleSide });
  const half = (a) => kit.bumpy(new T.LatheGeometry(prof.map(([x, y]) => new T.Vector2(x, y)), 14, a, Math.PI), .08, a + 2);
  const shell = new T.Group(); shell.position.set(-.35, FLOOR + .28, .2); shell.rotation.set(0, .35, Math.PI / 2); s.add(shell);
  const bottom = new T.Mesh(half(Math.PI), shellM); shell.add(bottom);
  const pivot = new T.Group(); pivot.position.set(0, 0, -R); shell.add(pivot); const lid = new T.Mesh(half(0), shellM); lid.position.z = R; pivot.add(lid);
  const kG = new T.SphereGeometry(.17, 16, 12); kG.scale(1, 1.25, 1); const kM = kit.mat('#C77C5A', { roughness: .5 });
  const kin = [-.33, .33].map(y => { const m = new T.Mesh(kG, kM); m.position.set(0, y, 0); shell.add(m); return m; });
  const others = [[1.5, .7, .8], [-1.9, -.3, 1.6], [.9, -1.1, 2.5]].map(([x, z, ry], i) => { const g = new T.Mesh(kit.bumpy(kit.lathe(prof, 14), .08, i + 9), shellM); g.scale.setScalar(.6); g.position.set(x, FLOOR + .17, z); g.rotation.set(0, ry, Math.PI / 2); s.add(g); return g; });
  const free = new Swarm(kit, { n: 4, mesh: { geo: kG, mat: kM }, g: -6, drag: .5, windK: .1, life: 7, floor: FLOOR + .17, bounce: .35, spin: 7 }); s.add(free.obj);
  const dust = new Swarm(kit, { n: 30, color: '#B79A6E', size: .06, g: -1.5, drag: 2, life: 1.2 }); s.add(dust.obj);
  const soil = new Swarm(kit, { n: 16, color: 'soil', size: .08, g: -3, drag: .8, life: 2.4, floor: FLOOR, onFloor: i => { soil.kill(i); return false; } }); s.add(soil.obj);
  const C = carrier(ctx, free, 'kernel-roll', 'kernel', 4, 0);
  let phase = 'closed', ph = 0, open = 0, vib = 0, rolled = []; const W = new T.Vector3(), tp = new T.Vector3();
  free.onFloor = (i, p, v, o) => { if (Math.abs(v[o + 1]) > .8) for (let k = 0; k < 4; k++) dust.spawn(p[o], FLOOR + .02, p[o + 2], (Math.random() - .5) * .8, .3 + Math.random() * .4, 0, 1); v[o] *= .985; return true; };
  const release = () => { shell.updateMatrixWorld(); rolled = kin.map((m, k) => { m.getWorldPosition(W); m.visible = false; return free.spawn(W.x, W.y + .1, W.z + .1, (k ? 1 : -1) * (.6 + Math.random() * .5), 1.2, .5 + Math.random() * .4, 7); }); if (Math.random() < .65) C.launch(false, () => [rolled[1]]); };
  return {
    offer: tap => phase === 'rest' && C.launch(tap, () => { const i = rolled.find(j => free.on[j]); if (i == null) return []; free.v[i * 3 + 1] = 1.2; return [i]; }),
    tap(nx, ny) { vib = 1; ctx.energy(.25); if (phase === 'closed') { phase = 'opening'; ph = 0; } else if (phase === 'rest') { rolled.forEach(i => { if (free.on[i]) { free.v[i * 3] += (Math.random() - .5) * 2; free.v[i * 3 + 1] += 1; } }); if (Math.random() < .5) C.launch(true, () => [rolled.find(j => free.on[j])].filter(x => x != null)); } },
    receive(type, d) { const p = entry(ctx, d, .2); for (let k = 0; k < 10; k++) soil.spawn(p.x + (Math.random() - .5) * .3, p.y, p.z, (d.vx || 0) * .6, -.2, 0, 2.4); vib = 1; if (phase === 'closed') { phase = 'opening'; ph = 0; } },
    update(t, dt, I) {
      vib *= Math.exp(-dt * 2.2); ph += dt;
      if (phase === 'closed') { open = lerp(open, 0, dt * 3); if (ph > 3.5) { phase = 'opening'; ph = 0; } }
      else if (phase === 'opening') { open = sm(0, 1.6, ph) * 1.9; if (ph > 1.6) { release(); phase = 'rest'; ph = 0; } }
      else if (phase === 'rest') { if (ph > 4.5) { phase = 'closing'; ph = 0; } }
      else { open = (1 - sm(0, 1.4, ph)) * 1.9; kin.forEach(m => { m.visible = true; m.scale.setScalar(Math.max(.001, sm(.6, 1.6, ph))); }); if (ph > 1.6) { phase = 'closed'; ph = 0; } }
      pivot.rotation.y = open;
      shell.position.y = FLOOR + .28 + Math.abs(Math.sin(t * 31)) * .012 * vib + (phase === 'closed' ? Math.abs(Math.sin(t * 17)) * .004 : 0);
      shell.rotation.x = Math.sin(t * 27) * .03 * vib + I.py * .2 * I.k; shell.rotation.y = .35 + I.px * .4 * I.k;
      others.forEach((g, i) => { g.rotation.x = Math.sin(t * .5 + i) * .03; });
      free.step(dt, { wind: I.wind * .2, fn: both(C.force, (i, p, v, o, d) => { if (p[o + 1] <= FLOOR + .171) v[o] *= Math.exp(-.8 * d); }) }); C.check(); free.sync();
      dust.step(dt); dust.sync(); soil.step(dt); soil.sync();
      look(cam, CAM, LOOK, I, .3, .15);
    },
  };
}

/* ═════════ AUTRES VIVRIERS — la convergence ═════════
   Grains, petites feuilles et poussières venues des autres familles se rassemblent, se dispersent et se réorganisent :
   dérive libre → couronne (le panier du marché) → spirale qui monte (la pousse). Chaque matière reçue (poudre, graine)
   entre dans la ronde avec sa couleur. Une feuille peut s'échapper vers la Forêt (leaf-drift). */
function autres(ctx) {
  const { T, scene: s, cam, kit, q } = ctx, r = kit.rng(151), bg = BG2['autres-produits-vivriers'];
  kit.stage(s, bg, 6, 14);
  const CAM = [0, .55, 6.6], LOOK = new T.Vector3(0, -.05, 0);
  kit.shade(s, 0, 0, 4.5, 2.2, .18);
  const NG = q.low ? 20 : 30, NL = q.low ? 8 : 12, N = NG + NL;
  const gIm = new T.InstancedMesh(kit.grainGeo, new T.MeshStandardMaterial({ roughness: .5 }), NG), lIm = new T.InstancedMesh(kit.leafGeo(.11, .36, .1), kit.mat('#6E9046', { side: T.DoubleSide, roughness: .6 }), NL); s.add(gIm, lIm);
  const gc = ['#D6A83E', '#E8D3A2', '#8A5A34', '#C9A675', '#B8863A'].map(c => new T.Color(c)); for (let i = 0; i < NG; i++) gIm.setColorAt(i, gc[i % gc.length]);
  const lc = ['#6E9046', '#86A257', '#557A3C'].map(c => new T.Color(c)); for (let i = 0; i < NL; i++) lIm.setColorAt(i, lc[i % 3]);
  const P = new Float32Array(N * 3), Vv = new Float32Array(N * 3), rot = Array.from({ length: N }, () => [r() * TAU, r() * TAU, r() * TAU]), seed = Array.from({ length: N }, () => [r(), r(), r()]), hide = new Float32Array(N);
  for (let i = 0; i < N; i++) P.set([(r() - .5) * 4, r() * 2 - 1, (r() - .5) * 1.5], i * 3);
  const dots = new Swarm(kit, { n: q.low ? 18 : 28, color: '#E9D28C', size: .05, op: .7, drag: 1.6, life: 1e9 }); s.add(dots.obj); for (let i = 0; i < dots.n; i++) dots.spawn((r() - .5) * 4, r() * 2 - 1, 0, 0, 0, 0, 1e9);
  const out = new Swarm(kit, { n: 2, mesh: { geo: kit.leafGeo(.11, .36, .1), mat: kit.mat('#6E9046', { side: T.DoubleSide }) }, g: .2, drag: 1, life: 5, spin: 3 }); s.add(out.obj); const C = carrier(ctx, out, 'leaf-drift', 'leaf', 5, .6);
  let mode = 0, modeT = 0; const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(), ptr = new T.Vector3(), tp = new T.Vector3(), tgt = new T.Vector3();
  const target = (i, t) => { const u = i / N, [a, b, c] = seed[i];
    if (mode === 0) return tgt.set(Math.sin(t * .2 + a * 9) * 2.2 + (b - .5) * 1.2, Math.sin(t * .27 + b * 7) * .9 + .1, (c - .5) * 1.4);
    if (mode === 1) { const A = u * TAU + t * .18; return tgt.set(Math.cos(A) * 1.35, -.45 + Math.sin(A * 3 + t) * .06 + (i % 3) * .07, Math.sin(A) * .55); }
    const A = u * 14 + t * .35, h = u * 2.2 - 1.15, rr = .25 + (1 - u) * .85; return tgt.set(Math.cos(A) * rr, h, Math.sin(A) * rr * .6); };
  const offer = tap => C.launch(tap, () => { const i = NG + ((Math.random() * NL) | 0); hide[i] = 4; return [out.spawn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], 0, .3, 0, 5)]; });
  return {
    offer,
    tap(nx, ny) { kit.fromCard(nx, ny, cam, 0, tp); ctx.energy(.3); for (let i = 0; i < N; i++) { const o = i * 3, dx = P[o] - tp.x, dy = P[o + 1] - tp.y, d = Math.hypot(dx, dy) + .25; Vv[o] += dx / d * 2.2; Vv[o + 1] += dy / d * 2; } mode = (mode + 1) % 3; modeT = 0; if (Math.random() < .5) setTimeout(() => offer(true), 600); },
    receive(type, d) { const p = entry(ctx, d, 0), col = new T.Color(d.material === 'kernel' ? '#C77C5A' : d.material === 'powder' ? '#DDA235' : '#D6A83E'); for (let k = 0; k < 4; k++) { const i = (Math.random() * NG) | 0; P.set([p.x, p.y, p.z], i * 3); Vv.set([(d.vx || 0) * 2, -(d.vy || 0) * 2, 0], i * 3); gIm.setColorAt(i, col); } gIm.instanceColor.needsUpdate = true; },
    update(t, dt, I) {
      const w = I.wind; kit.fromCard(I.nx, I.ny, cam, 0, ptr); modeT += dt; if (modeT > 7.5) { modeT = 0; mode = (mode + 1) % 3; }
      const dr = Math.exp(-2.1 * dt);
      for (let i = 0; i < N; i++) {
        const o = i * 3; target(i, t);
        Vv[o] += ((tgt.x - P[o]) * 1.7 + w * .4) * dt; Vv[o + 1] += (tgt.y - P[o + 1]) * 1.7 * dt; Vv[o + 2] += (tgt.z - P[o + 2]) * 1.7 * dt;
        if (I.k) { const dx = P[o] - ptr.x, dy = P[o + 1] - ptr.y, d = Math.hypot(dx, dy) + .1; if (d < 1.2) { Vv[o] += dx / d * 3 * I.k * dt; Vv[o + 1] += dy / d * 3 * I.k * dt; } }
        Vv[o] *= dr; Vv[o + 1] *= dr; Vv[o + 2] *= dr; P[o] += Vv[o] * dt; P[o + 1] += Vv[o + 1] * dt; P[o + 2] += Vv[o + 2] * dt;
        const sp = Math.hypot(Vv[o], Vv[o + 1]) + .15; rot[i][0] += sp * dt * 2; rot[i][2] += sp * dt;
        if (hide[i] > 0) hide[i] -= dt;
        E.set(rot[i][0], rot[i][1], rot[i][2]); Q.setFromEuler(E); V.set(P[o], P[o + 1], P[o + 2]); S.setScalar(hide[i] > 0 ? .001 : 1); M.compose(V, Q, S);
        if (i < NG) gIm.setMatrixAt(i, M); else lIm.setMatrixAt(i - NG, M);
      }
      gIm.instanceMatrix.needsUpdate = lIm.instanceMatrix.needsUpdate = true;
      dots.step(dt, { wind: w * .4, fn: (i, p, v, o, d) => { const j = (i * 7) % N; v[o] += (P[j * 3] - p[o]) * .5 * d + Math.sin(t + i) * .1 * d; v[o + 1] += (P[j * 3 + 1] + .15 - p[o + 1]) * .5 * d; v[o + 2] += (P[j * 3 + 2] - p[o + 2]) * .5 * d; } }); dots.sync();
      out.step(dt, { wind: w, fn: C.force }); C.check(); out.sync();
      look(cam, CAM, LOOK, I);
    },
  };
}

export const SCENES2 = { 'viande-de-brousse': foret, 'poissons': poissons, 'oeufs': oeufs, 'volaille': volaille, 'assaisonnements-epices-condiments': epices, 'produits-surgeles': surgeles, 'arachide-noix-et-oleagineux': arachide, 'autres-produits-vivriers': autres };
// le réseau complet des échanges : qui émet, qui reçoit
export const FLOW = {
  'seed-release': { from: 'cereales-et-riz-local', to: ['tubercules-et-feculents'] },
  'soil-disturbance': { from: 'tubercules-et-feculents', to: ['legumes-et-fruits', 'arachide-noix-et-oleagineux'] },
  'pollen-drift': { from: 'legumes-et-fruits', to: ['cereales-et-riz-local'] },
  'light-pulse': { from: 'viande-de-brousse', to: ['poissons'] },
  'water-ripple': { from: 'poissons', to: ['oeufs', 'produits-surgeles'] },
  'straw-drift': { from: 'oeufs', to: ['volaille'] },
  'air-current': { from: 'volaille', to: ['assaisonnements-epices-condiments'] },
  'powder-drift': { from: 'assaisonnements-epices-condiments', to: ['autres-produits-vivriers'] },
  'condensation': { from: 'produits-surgeles', to: ['legumes-et-fruits'] },
  'kernel-roll': { from: 'arachide-noix-et-oleagineux', to: ['autres-produits-vivriers'] },
  'leaf-drift': { from: 'autres-produits-vivriers', to: ['viande-de-brousse'] },
};
