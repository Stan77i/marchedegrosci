// Marché de Gros CI — Écosystème des familles : matières, physique légère et scènes.
// Les scènes ne dessinent rien elles-mêmes hors de leur carte : elles émettent / reçoivent des matières via le moteur
// (v2/familles.js) qui gère le canevas partagé, le bus d'événements, les interactions et le passage d'une carte à l'autre.
//
// Chaque scène : 1 mouvement principal · 2–4 phénomènes secondaires · 1 matière · 1 entrée · 1 sortie.
//   Céréales    : vent dans les tiges   · entrée pollen-drift      · sortie seed-release
//   Tubercules  : croissance sous terre · entrée seed-release      · sortie soil-disturbance
//   Légumes     : maturation            · entrée soil-disturbance  · sortie pollen-drift
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
export const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

export const BG = { 'cereales-et-riz-local': '#EEE2C3', 'tubercules-et-feculents': '#E9D9C6', 'legumes-et-fruits': '#F0DCCB' };

/* ═════════ MaterialSystem : une seule palette de matières pour tout l'écosystème ═════════ */
export function makeKit(T) {
  const C = {
    soil: '#6B4A2F', soilTop: '#8A6847', soilDeep: '#3F2B1C', grain: '#D6A83E', grainGreen: '#8FA34B', glint: '#FFF1C4',
    stem: '#7E8F47', leaf: '#5E8A42', leaf2: '#7FA14F', pollen: '#F1CF6E', water: '#CFE3E4', tomato: '#C9452D', unripe: '#86A44A', orange: '#E07A3F', yam: '#7B5534', mineral: '#D9B98E',
  };
  const U = { scale: { value: 300 } };
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const ray = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.35, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new T.CanvasTexture(c); })();
  const mats = new Map();
  const mat = (c, o = {}) => { const { own, ...rest } = o, k = c + JSON.stringify(rest); if (!own && mats.has(k)) return mats.get(k); const m = new T.MeshStandardMaterial({ color: new T.Color(C[c] || c), roughness: .78, metalness: 0, ...rest }); if (!own) mats.set(k, m); return m; };
  const pointsMat = (c, size, op = 1) => new T.ShaderMaterial({
    uniforms: { uMap: { value: dot }, uColor: { value: new T.Color(C[c] || c) }, uSize: { value: size }, uScale: U.scale, uOp: { value: op } },
    vertexShader: 'attribute float a;varying float vA;uniform float uSize,uScale;void main(){vA=a;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=uSize*uScale/-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform sampler2D uMap;uniform vec3 uColor;uniform float uOp;varying float vA;void main(){vec4 t=texture2D(uMap,gl_PointCoord);gl_FragColor=vec4(uColor,t.a*vA*uOp);if(gl_FragColor.a<.01)discard;\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false,
  });
  // géométries communes
  const leafShape = (w, l) => { const s = new T.Shape(); s.moveTo(0, 0); s.bezierCurveTo(w, l * .25, w * .9, l * .5, 0, l); s.bezierCurveTo(-w * .9, l * .5, -w, l * .25, 0, 0); return s; };
  const bend = (g, l, k) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * k * 1.5 + Math.sin(y / l * Math.PI) * k); } g.computeVertexNormals(); return g; };
  const leafGeo = (w = .3, l = 1, k = .25) => bend(new T.ShapeGeometry(leafShape(w, l), 10), l, k);
  const heartGeo = (s = .5) => { const h = new T.Shape(); h.moveTo(0, 0); h.bezierCurveTo(s * .9, s * .25, s * .85, s * 1.15, 0, s * 1.5); h.bezierCurveTo(-s * .85, s * 1.15, -s * .9, s * .25, 0, 0); return bend(new T.ShapeGeometry(h, 10), s * 1.5, s * .2); };
  const grainGeo = (() => { const g = new T.SphereGeometry(.052, 7, 5); g.scale(1, 2.1, 1); return g; })();
  const lathe = (pr, seg = 18) => new T.LatheGeometry(pr.map(([x, y]) => new T.Vector2(x, y)), seg);
  const bumpy = (g, k, seed = 1) => { const p = g.attributes.position, r = rng(seed * 997 + 3), off = Array.from({ length: 64 }, () => r() - .5); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = off[Math.abs(Math.round(x * 9 + y * 13 + z * 7)) % 64], s = 1 + n * k; p.setXYZ(i, x * s, y * (1 + n * k * .3), z * s); } g.computeVertexNormals(); return g; };
  // lumière commune : ciel chaud + soleil + contre-jour ; la brume fond la scène dans le fond de sa carte (profondeur)
  const stage = (s, bg, near, far) => {
    const B = new T.Color(bg); s.fog = new T.Fog(B, near, far);
    s.add(new T.HemisphereLight(0xfff4e0, B.clone().multiplyScalar(.6), 1.15));
    const sun = new T.DirectionalLight(0xffe2b8, 1.9); sun.position.set(-3.5, 5, 4); s.add(sun); s.add(sun.target);
    const rim = new T.DirectionalLight(0xffffff, .45); rim.position.set(4, 2, -4); s.add(rim);
    return sun;
  };
  const shade = (s, x, z, w, d, o, y = -1.3) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: dot, color: 0x5a4320, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, y + .002, z); s.add(m); return m; };
  // passage carte ↔ monde
  const V = new T.Vector3();
  const toCard = (v, cam) => { V.copy(v).project(cam); return { x: (V.x + 1) / 2, y: (1 - V.y) / 2 }; };
  const fromCard = (nx, ny, cam, z = 0, out = new T.Vector3()) => { V.set(nx * 2 - 1, 1 - ny * 2, .5).unproject(cam).sub(cam.position).normalize(); const d = (z - cam.position.z) / V.z; return out.copy(cam.position).addScaledVector(V, d); };
  return { T, C, U, dot, ray, mat, pointsMat, leafGeo, heartGeo, grainGeo, lathe, bumpy, stage, shade, toCard, fromCard, rng };
}

/* ═════════ ParticleSystem : réservoir de particules, physique visuelle légère ═════════
   forces : gravité · traînée (air) · vent global · attraction/répulsion locale (doigt) · force propre · sol (rebond, frottement) */
export class Swarm {
  constructor(kit, { n, color = 'grain', size = .06, op = 1, mesh = null, g = 0, drag = 1, windK = 1, life = 2, floor = null, bounce = 0, onFloor = null, spin = 0 }) {
    const T = kit.T; Object.assign(this, { n, g, drag, windK, L: life, floor, bounce, onFloor, spin, k: 0 });
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.age = new Float32Array(n); this.life = new Float32Array(n); this.on = new Uint8Array(n); this.sc = new Float32Array(n).fill(1);
    if (mesh) { this.obj = new T.InstancedMesh(mesh.geo, mesh.mat, n); this.r = new Float32Array(n * 3); this.m = new T.Matrix4(); this.q = new T.Quaternion(); this.e = new T.Euler(); this.s = new T.Vector3(); this.P = new T.Vector3(); }
    else { const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(this.p, 3)); this.a = new Float32Array(n); gg.setAttribute('a', new T.BufferAttribute(this.a, 1)); this.obj = new T.Points(gg, kit.pointsMat(color, size, op)); }
    this.obj.frustumCulled = false; this.sync();
  }
  spawn(x, y, z, vx = 0, vy = 0, vz = 0, life = this.L, sc = 1) {
    let i = -1; for (let j = 0; j < this.n; j++) { const c = (this.k + j) % this.n; if (!this.on[c]) { i = c; break; } } if (i < 0) i = this.k; this.k = (i + 1) % this.n;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.age[i] = 0; this.life[i] = life; this.on[i] = 1; this.sc[i] = sc;
    if (this.r) this.r.set([Math.random() * TAU, Math.random() * TAU, Math.random() * TAU], i * 3);
    return i;
  }
  kill(i) { this.on[i] = 0; }
  alive() { let n = 0; for (let i = 0; i < this.n; i++) n += this.on[i]; return n; }
  step(dt, F = {}) {
    const { p, v } = this, dr = Math.exp(-this.drag * dt), wind = (F.wind || 0) * this.windK, P = F.ptr;
    for (let i = 0; i < this.n; i++) {
      if (!this.on[i]) continue;
      this.age[i] += dt; if (this.age[i] > this.life[i]) { this.on[i] = 0; continue; }
      const o = i * 3;
      v[o + 1] += this.g * dt; v[o] += wind * dt;
      if (P && P.s) { const dx = P.x - p[o], dy = P.y - p[o + 1], dz = P.z - p[o + 2], d = Math.hypot(dx, dy, dz) + 1e-3; if (d < P.r) { const f = P.s * (1 - d / P.r) * dt / d; v[o] += dx * f; v[o + 1] += dy * f; v[o + 2] += dz * f * .3; } }
      if (F.fn) F.fn(i, p, v, o, dt);
      v[o] *= dr; v[o + 1] *= dr; v[o + 2] *= dr;
      p[o] += v[o] * dt; p[o + 1] += v[o + 1] * dt; p[o + 2] += v[o + 2] * dt;
      if (this.floor != null && p[o + 1] < this.floor) { p[o + 1] = this.floor; if (this.onFloor && this.onFloor(i, p, v, o) === false) continue; v[o + 1] *= -this.bounce; v[o] *= .55; v[o + 2] *= .55; }
      if (this.r) { const s = this.spin * dt * (Math.abs(v[o]) + Math.abs(v[o + 1]) + .2); this.r[o] += s; this.r[o + 2] += s * .6; }
    }
  }
  sync() {
    if (this.r) {
      for (let i = 0; i < this.n; i++) { const o = i * 3; if (!this.on[i]) { this.s.setScalar(0); this.P.set(0, -50, 0); } else { const f = Math.min(1, this.age[i] / .12) * (1 - sm(.8, 1, this.age[i] / this.life[i])); this.s.setScalar(this.sc[i] * Math.max(.001, f)); this.P.set(this.p[o], this.p[o + 1], this.p[o + 2]); } this.e.set(this.r[o], this.r[o + 1], this.r[o + 2]); this.q.setFromEuler(this.e); this.m.compose(this.P, this.q, this.s); this.obj.setMatrixAt(i, this.m); }
      this.obj.instanceMatrix.needsUpdate = true;
    } else {
      for (let i = 0; i < this.n; i++) this.a[i] = this.on[i] ? Math.min(1, this.age[i] / .25) * (1 - sm(.65, 1, this.age[i] / this.life[i])) * this.sc[i] : 0;
      this.obj.geometry.attributes.position.needsUpdate = true; this.obj.geometry.attributes.a.needsUpdate = true;
    }
  }
}

/* ═════════ CÉRÉALES — le vent dans les tiges ═════════
   Les épis mûrissent (vert → doré), lâchent leurs grains qui tombent (gravité, air, vent, doigt) et s'accumulent en un
   tas qui scintille. Tas plein : il s'efface dans la terre, les épis reverdissent. Un grain emporté par une rafale peut
   quitter la carte (seed-release). Le pollen reçu des Légumes fait mûrir et briller les épis. */
export function cereales(ctx) {
  const { T, scene: s, cam, kit, q, mem } = ctx, r = kit.rng(11);
  const sun = kit.stage(s, BG['cereales-et-riz-local'], 6.5, 14);
  const CAM = [0, .8, 7.1], LOOK = new T.Vector3(.35, -.2, 0);
  kit.shade(s, -.4, -.4, 6, 2.6, .22); const pileShade = kit.shade(s, 1.2, .9, 1.9, 1.2, 0);
  const GREEN = new T.Color(kit.C.grainGreen), GOLD = new T.Color(kit.C.grain), GLINT = new T.Color(kit.C.glint);
  const stemM = kit.mat('#8D8A4C', { roughness: .9 }), panM = new T.MeshStandardMaterial({ color: GREEN.clone(), roughness: .5 });
  const blade = (() => { const sh = new T.Shape(); sh.moveTo(-.035, 0); sh.quadraticCurveTo(-.05, .9, 0, 1.75); sh.quadraticCurveTo(.05, .9, .035, 0); const g = new T.ShapeGeometry(sh, 8), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -y * y * .16); p.setX(i, p.getX(i) + y * y * .12); } g.computeVertexNormals(); return g; })();
  const bladeM = kit.mat('#7F9446', { side: T.DoubleSide, roughness: .7 });
  const NF = q.low ? 7 : 9, NB = q.low ? 5 : 9, PER = 16, stalks = [];
  const mkStalk = (x, z, h, back) => {
    const g = new T.Group(), lean = .5 + r() * .25;
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0), new T.Vector3(0, h * .72, 0), new T.Vector3(lean, h * .93, 0));
    g.add(new T.Mesh(new T.TubeGeometry(curve, back ? 8 : 14, back ? .018 : .024, 4), stemM));
    if (!back) for (let j = 0; j < 2; j++) { const bl = new T.Mesh(blade, bladeM); bl.position.y = .05 + j * .25; bl.rotation.set(0, j * 2.6 + r(), (j ? -1 : 1) * (.25 + r() * .2)); bl.scale.setScalar(.75 + r() * .4); g.add(bl); }
    const pan = new T.InstancedMesh(kit.grainGeo, panM, PER), m = new T.Matrix4(), qq = new T.Quaternion(), e = new T.Euler();
    for (let k = 0; k < PER; k++) { const u = .62 + k / PER * .38, p = curve.getPoint(u); p.x += (k % 2 ? .07 : -.07) * (1.3 - u); p.y -= (u - .62) * .95 + (k % 3) * .05; e.set(0, 0, (k % 2 ? -.6 : .6) - u * .8); qq.setFromEuler(e); m.compose(p, qq, new T.Vector3(1, 1, 1)); pan.setMatrixAt(k, m); }
    g.add(pan); g.position.set(x, -1.3, z); g.rotation.y = (r() - .5) * 1.1; s.add(g);
    stalks.push({ g, curve, ph: r() * TAU, sp: .75 + r() * .4, x, back });
  };
  for (let i = 0; i < NF; i++) mkStalk((i - (NF - 1) / 2) * .46 + (r() - .5) * .2 - .3, .3 - r() * 1.3, 2.25 + r() * .6, false);
  for (let i = 0; i < NB; i++) mkStalk((i - (NB - 1) / 2) * .8 + (r() - .5) * .3, -3 - r() * 3, 2.4 + r() * .8, true);
  const front = stalks.filter(o => !o.back);
  // tas : places calculées une fois, remplies dans l'ordre (le tas monte vraiment)
  const PN = q.low ? 40 : 64, PILE = new T.Vector3(1.2, -1.3, .9), slots = Array.from({ length: PN }, (_, i) => { const u = i / PN, a = i * 2.39996, rad = (1 - u) * .62 * Math.sqrt(.25 + r() * .75); return new T.Vector3(PILE.x + Math.cos(a) * rad, PILE.y + .05 + u * .34 * (1 - rad * .6), PILE.z + Math.sin(a) * rad * .7); });
  const pile = new T.InstancedMesh(kit.grainGeo, new T.MeshStandardMaterial({ roughness: .4 }), PN); pile.frustumCulled = false; s.add(pile);
  const P = { n: 0, from: slots.map(() => new T.Vector3()), t: new Float32Array(PN).fill(1), rot: slots.map(() => [r() * TAU, (r() - .5) * .6]), ph: slots.map(() => r() * 100) };
  for (let i = 0; i < PN; i++) pile.setColorAt(i, GOLD);
  // grains qui tombent
  const fall = new Swarm(kit, { n: q.low ? 18 : 28, mesh: { geo: kit.grainGeo, mat: kit.mat('grain', { roughness: .45 }) }, g: -2.4, drag: 1.3, windK: 1.4, life: 6, floor: -1.28, spin: 4,
    onFloor: (i, p, v, o) => { fall.kill(i); if (P.n < PN) { P.from[P.n].set(p[o], p[o + 1], p[o + 2]); P.t[P.n] = 0; P.n++; } return false; } });
  s.add(fall.obj);
  const pollen = new Swarm(kit, { n: 24, color: 'pollen', size: .07, g: .05, drag: 1.4, windK: .6, life: 4 }); s.add(pollen.obj);
  const motes = new Swarm(kit, { n: q.low ? 14 : 22, color: '#E7C26A', size: .06, op: .55, g: .02, drag: .8, windK: .5, life: 1e9 }); s.add(motes.obj);
  for (let i = 0; i < motes.n; i++) motes.spawn((r() - .5) * 6, r() * 3 - 1.2, (r() - .5) * 3, 0, .05, 0, 1e9);
  let rip = mem.rip ?? 0, phase = mem.phase || 'grow', sink = 0, shake = 0, glow = 0, nextDrop = 0, courier = -1, cDir = null;
  const W = new T.Vector3(), ptr = new T.Vector3(), col = new T.Color(), m = new T.Matrix4(), qq = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), tp = new T.Vector3();
  const release = (asCourier) => {
    const st = front[(Math.random() * front.length) | 0]; st.g.updateMatrixWorld(); W.copy(st.curve.getPoint(.8 + Math.random() * .15)).applyMatrix4(st.g.matrixWorld);
    const i = fall.spawn(W.x, W.y, W.z, (Math.random() - .3) * .4, -.1, (Math.random() - .5) * .2);
    if (asCourier) { courier = i; fall.life[i] = 4; }
    return i;
  };
  const offer = (tap) => { if (courier >= 0 || rip < .55) return false; const d = ctx.canSend('seed-release', tap); if (!d) return false; cDir = d; release(true); return true; };
  return {
    offer,
    tap(nx, ny) { shake = 1; ctx.energy(.35); if (rip > .5) { for (let k = 0; k < 4; k++) release(false); if (Math.random() < .7) offer(true); } else { kit.fromCard(nx, ny, cam, 0, tp); for (let k = 0; k < 8; k++) motes.spawn(tp.x, tp.y, tp.z, (Math.random() - .5) * 1.2, Math.random() * .8, 0, 2.5); } },
    receive(type, d) { if (type !== 'pollen-drift') return; kit.fromCard(d.x, d.y, cam, .2, tp); for (let k = 0; k < 9; k++) pollen.spawn(tp.x, tp.y, tp.z, (d.vx || 0) * 1.5 + (Math.random() - .5) * .6, (Math.random() - .5) * .4, (Math.random() - .5) * .3, 3.5); glow = 1; mem.boost = (mem.boost || 0) + .18; },
    update(t, dt, I) {
      const wind = I.wind;
      kit.fromCard(I.nx, I.ny, cam, .6, ptr);
      // vent : brise propre + vent global (rafales, défilement) + secousse du doigt
      shake *= Math.exp(-dt * 1.6); glow *= Math.exp(-dt * .5);
      stalks.forEach(o => { const gust = Math.sin(t * .9 - o.x * .55) * .5 + .5; o.g.rotation.z = -(Math.sin(t * o.sp + o.ph) * .045 + gust * .06 + wind * .1 * (o.back ? .6 : 1)) - I.px * .22 * I.k * (o.back ? .3 : 1) + Math.sin(t * 9 + o.ph) * .05 * shake + .03; o.g.rotation.x = Math.sin(t * o.sp * .6 + o.ph) * .025; });
      // cycle de la récolte (état, pas horloge : les événements le modifient)
      if (mem.boost) { rip = Math.min(1, rip + mem.boost); mem.boost = 0; }
      if (phase === 'grow') { rip = Math.min(1, rip + dt / 5.5); if (rip >= .85) phase = 'shed'; }
      else if (phase === 'shed') { if (t > nextDrop && fall.alive() < fall.n - 2) { release(false); nextDrop = t + .3 + Math.random() * .45; } if (P.n >= PN) { phase = 'rest'; sink = 0; } }
      else { sink = Math.min(1, sink + dt / 2.4); rip = Math.max(0, rip - dt / 2.4); if (sink >= 1) { P.n = 0; sink = 0; phase = 'grow'; } }
      mem.rip = rip; mem.phase = phase;
      col.copy(GREEN).lerp(GOLD, sm(0, .9, rip)).lerp(GLINT, glow * .35); panM.color.copy(col);
      // grains en vol : le messager est porté hors de la carte par une poussée vers la carte voisine
      fall.step(dt, { wind: wind * .8 + Math.sin(t * .7) * .15, ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: 7 * I.k, r: 1.6 }, fn: courier >= 0 ? (i, p, v, o, d) => { if (i !== courier) return; v[o] += cDir.x * 7 * d; v[o + 1] += (-cDir.y * 7 + 2.6) * d; } : null });
      if (courier >= 0) { if (!fall.on[courier]) courier = -1; else { const o = courier * 3; W.set(fall.p[o], fall.p[o + 1], fall.p[o + 2]); const c = kit.toCard(W, cam); if (c.x < .02 || c.x > .98 || c.y < .02 || c.y > .98) { ctx.send('seed-release', { x: c.x, y: c.y, vx: cDir.x, vy: cDir.y, material: 'grain' }); fall.kill(courier); courier = -1; } } }
      fall.sync();
      // tas : chaque grain glisse de son point d'impact à sa place, scintille, puis le tas s'enfonce
      for (let i = 0; i < PN; i++) {
        if (i >= P.n) { sc.setScalar(0); m.compose(slots[i], qq, sc); pile.setMatrixAt(i, m); continue; }
        P.t[i] = Math.min(1, P.t[i] + dt / .35); const u = sm(0, 1, P.t[i]);
        W.copy(P.from[i]).lerp(slots[i], u); W.y += Math.sin(u * Math.PI) * .06 - sink * .45;
        e.set(Math.PI / 2 * u + P.rot[i][1], P.rot[i][0], 0); qq.setFromEuler(e); sc.setScalar(1 - sink * .9); m.compose(W, qq, sc); pile.setMatrixAt(i, m);
        const gl = Math.pow(Math.max(0, Math.sin(t * 2.3 + P.ph[i] * 7.1)), 30) * (1 - sink); pile.setColorAt(i, col.copy(GOLD).lerp(GLINT, gl * .9));
      }
      pile.instanceMatrix.needsUpdate = true; pile.instanceColor.needsUpdate = true;
      pileShade.material.opacity = sm(0, 12, P.n) * (1 - sink) * .3;
      // pollen reçu : il dérive vers les épis puis s'y pose
      pollen.step(dt, { wind: wind * .4, fn: (i, p, v, o, d) => { v[o] += (-.3 - p[o]) * .5 * d; v[o + 1] += (.7 - p[o + 1]) * .6 * d; } }); pollen.sync();
      motes.step(dt, { wind: wind * .3, ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: -3 * I.k, r: 1.2 }, fn: (i, p, v, o) => { if (p[o + 1] > 2) p[o + 1] = -1.2; if (Math.abs(p[o]) > 3.5) p[o] *= -.95; v[o + 1] += .002; } }); motes.sync();
      sun.position.set(-3.5 + I.px * 5 * I.k, 5 - I.py * 2 * I.k, 4);
      cam.position.set(CAM[0] + I.px * .35 * I.k, CAM[1] - I.py * .2 * I.k, CAM[2]); cam.lookAt(LOOK);
    },
  };
}

/* ═════════ TUBERCULES — la croissance sous terre ═════════
   Coupe de terre : strates, igname qui grossit, radicelles, particules en suspension, une liane qui perce vers la
   lumière. Une graine reçue des Céréales tombe, s'enfonce (elle reste visible dans la coupe : mémoire), la terre se
   soulève, l'igname grossit, une radicelle pousse. Puis une motte peut partir vers les Légumes (soil-disturbance). */
export function tubercules(ctx) {
  const { T, scene: s, cam, kit, q, mem } = ctx, r = kit.rng(23);
  const sun = kit.stage(s, BG['tubercules-et-feculents'], 7, 16);
  const CAM = [0, .95, 7.2], LOOK = new T.Vector3(.1, -.7, 0), FACE = .6, TOP = 0;
  // bloc de terre en coupe, strates en couleurs de sommets
  const bg = new T.BoxGeometry(18, 2.8, 9, 30, 12, 1); bg.translate(0, -1.4, FACE - 4.5);
  { const p = bg.attributes.position, c = new Float32Array(p.count * 3), a = new T.Color(kit.C.soilTop), b = new T.Color(kit.C.soilDeep), o = new T.Color(); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), d = clamp(-y / 2.8, 0, 1), band = .93 + .1 * Math.sin(y * 11 + Math.sin(x * .9) * 1.4) + (r() - .5) * .05; o.copy(a).lerp(b, d * .9).multiplyScalar(y > -.02 ? 1.06 : band); c.set([o.r, o.g, o.b], i * 3); } bg.setAttribute('color', new T.BufferAttribute(c, 3)); }
  s.add(new T.Mesh(bg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  // igname en coupe (moitié dans la terre, moitié visible) + radicelles
  const yamG = kit.bumpy(kit.lathe(Array.from({ length: 13 }, (_, i) => { const u = i / 12; return [Math.sin(u * Math.PI) ** .7 * .5 * (1 + .25 * Math.sin(u * 5 + 1)), (u - .5) * 2.6]; }), 18), .12, 1);
  const yam = new T.Mesh(yamG, kit.mat('yam', { roughness: .95 })); yam.rotation.z = Math.PI / 2 - .32; yam.position.set(-.1, -1.05, FACE); s.add(yam);
  const rootM = kit.mat('#B89670', { roughness: 1 }), roots = Array.from({ length: 6 }, (_, i) => { const a = -1.2 + i * .45 + (r() - .5) * .2, x0 = -.15 + (i - 2.5) * .32, y0 = -1.4 + Math.abs(i - 2.5) * .06; const c = new T.CatmullRomCurve3([new T.Vector3(x0, y0, FACE), new T.Vector3(x0 + Math.sin(a) * .4, y0 - .35, FACE + .02), new T.Vector3(x0 + Math.sin(a) * .9, y0 - .7 - r() * .3, FACE + .01)]); const g = new T.TubeGeometry(c, 16, .012, 3); g.setDrawRange(0, 0); const mm = new T.Mesh(g, rootM); s.add(mm); return { g, v: 0, t: 0 }; });
  // liane : du haut de l'igname à travers la terre, puis vers la lumière ; feuilles en cœur
  const vine = new T.CatmullRomCurve3([new T.Vector3(-.85, -.72, FACE), new T.Vector3(-.7, -.3, FACE - .05), new T.Vector3(-.6, TOP, FACE - .1), new T.Vector3(-.35, .7, FACE - .2), new T.Vector3(.1, 1.25, FACE - .3), new T.Vector3(.55, 1.65, FACE - .35)]);
  const vineG = new T.TubeGeometry(vine, 70, .03, 5), vineM = new T.Mesh(vineG, kit.mat('stem')); s.add(vineM);
  const hg = kit.heartGeo(.32), leaves = [.5, .62, .74, .86, .97].map((u, i) => { const g = new T.Group(), l = new T.Mesh(hg, kit.mat(i % 2 ? 'leaf' : 'leaf2', { side: T.DoubleSide, roughness: .6 })); l.rotation.x = -.4; g.add(l); g.position.copy(vine.getPoint(u)); g.rotation.set(0, i % 2 ? .6 : -.9, i % 2 ? -.9 : .9); s.add(g); return { g, l, u, ph: i * 1.7 }; });
  // rayons de lumière : ce vers quoi la liane pousse
  const rays = [[-1.6, .35, .55], [-.6, .3, .8]].map(([x, rz, w]) => { const m = new T.Mesh(new T.PlaneGeometry(w, 5.5), new T.MeshBasicMaterial({ map: kit.ray, color: 0xFFE8BC, transparent: true, opacity: .1, depthWrite: false, blending: T.AdditiveBlending, fog: false })); m.position.set(x, 2.2, -1.2); m.rotation.z = rz; s.add(m); return m; });
  // particules de terre en suspension dans la coupe (mouvement brownien, le doigt les écarte)
  const sus = new Swarm(kit, { n: q.low ? 34 : 56, color: 'mineral', size: .05, op: .75, drag: 2.2, windK: 0, life: 1e9 }); s.add(sus.obj);
  for (let i = 0; i < sus.n; i++) sus.spawn((r() - .5) * 8, -.2 - r() * 2.4, FACE + .03 + r() * .06, 0, 0, 0, 1e9);
  const dust = new Swarm(kit, { n: 60, color: kit.C.soilTop, size: .075, g: -3.2, drag: 1.4, windK: .8, life: 1.8, floor: TOP + .01, onFloor: i => { dust.kill(i); return false; } }); s.add(dust.obj);
  const clumpM = kit.mat('soil', { roughness: 1 }), clump = new Swarm(kit, { n: 8, mesh: { geo: new T.DodecahedronGeometry(.07, 0), mat: clumpM }, g: -1.6, drag: .6, windK: .4, life: 4, spin: 3 }); s.add(clump.obj);
  // graines reçues : chute, impact, enfoncement ; elles restent plantées dans la coupe
  const seedM = kit.mat('grain', { roughness: .45 }), seeds = [], planted = mem.planted || (mem.planted = []);
  const plantMesh = (x, y) => { const g = new T.Mesh(kit.grainGeo, seedM); g.position.set(x, y, FACE + .02); g.rotation.z = 1.2; s.add(g); return g; };
  planted.forEach(([x, y]) => plantMesh(x, y));
  let grow = mem.grow ?? .35, size = mem.size ?? .8, pulse = 0, sendAt = 0, courier = null, cDir = null, nextIdle = 2 + r() * 4;
  const W = new T.Vector3(), ptr = new T.Vector3(), tp = new T.Vector3();
  const burst = (x, n, k = 1) => { for (let j = 0; j < n; j++) dust.spawn(x + (Math.random() - .5) * .3, TOP + .02, FACE - .2 - Math.random() * .6, (Math.random() - .5) * 1.4 * k, (1.2 + Math.random() * 1.6) * k, (Math.random() - .5) * .5, 1.6); };
  const rootPulse = () => { const ro = roots.find(o => o.v < 1) || roots[(Math.random() * roots.length) | 0]; ro.t = Math.min(1, ro.v + .45); };
  roots.forEach((o, i) => { o.v = o.t = mem.roots ? mem.roots[i] : (i < 2 ? .5 : 0); });
  const offer = (tap) => { if (courier) return false; const d = ctx.canSend('soil-disturbance', tap); if (!d) return false; cDir = d; const x = .4 + Math.random() * .8; burst(x, 10, 1.2); courier = []; for (let j = 0; j < 5; j++) courier.push(clump.spawn(x + (Math.random() - .5) * .2, TOP + .05, FACE - .3, d.x * 2.2 + (Math.random() - .5) * .5, 2 + Math.random() * .8 - d.y * 1.2, 0, 4, .7 + Math.random() * .6)); return true; };
  return {
    offer,
    tap(nx, ny) { kit.fromCard(nx, ny, cam, FACE - .3, tp); burst(clamp(tp.x, -4, 4), 14); pulse = 1; ctx.energy(.3); if (Math.random() < .45) setTimeout(() => offer(true), 700); },
    receive(type, d) { if (type !== 'seed-release') return; kit.fromCard(d.x, Math.min(d.y, .25), cam, FACE - .25, tp); seeds.push({ m: plantMesh(tp.x, tp.y), p: tp.clone(), v: new T.Vector3((d.vx || 0) * 1.2, -.6, 0), st: 'fall', t: 0 }); },
    update(t, dt, I) {
      const wind = I.wind; kit.fromCard(I.nx, I.ny, cam, FACE + .05, ptr);
      pulse *= Math.exp(-dt * 1.2);
      // la liane pousse vers la lumière (une fois, puis à chaque graine reçue)
      grow = Math.min(1, grow + dt * (.06 + pulse * .2)); mem.grow = grow;
      vineG.setDrawRange(0, Math.floor(vineG.index.count * (.3 + grow * .7) / 6) * 6);
      leaves.forEach(L => { const o = sm(L.u - .12, L.u + .04, .3 + grow * .7); L.g.scale.setScalar(Math.max(.001, o)); L.l.rotation.z = Math.sin(t * 1.2 + L.ph) * .1 + wind * .18 - I.px * .3 * I.k; });
      // igname : grossit lentement, respire à peine
      size = Math.min(1.12, size + dt * .004 + pulse * dt * .05); mem.size = size; yam.scale.setScalar(size * (1 + Math.sin(t * .8) * .006 + pulse * .02));
      roots.forEach(o => { o.v += (o.t - o.v) * Math.min(1, dt * .9); o.g.setDrawRange(0, Math.floor(o.g.index.count * o.v / 6) * 6); }); mem.roots = roots.map(o => o.t);
      rays.forEach((m, i) => { m.material.opacity = .07 + .05 * Math.sin(t * .4 + i * 2) + pulse * .06 + I.energy * .05; });
      // graines : chute avec air et vent, impact, enfoncement dans la coupe
      for (const sd of seeds) {
        if (sd.st === 'fall') { sd.v.y -= 3 * dt; sd.v.x += wind * .6 * dt; sd.v.multiplyScalar(Math.exp(-.9 * dt)); sd.p.addScaledVector(sd.v, dt); sd.m.rotation.z += dt * 5; if (sd.p.y <= TOP + .03) { sd.p.y = TOP + .03; sd.st = 'sink'; sd.t = 0; sd.x = clamp(sd.p.x, -3.5, 3.5); burst(sd.x, 16); pulse = 1; rootPulse(); ctx.energy(.25); sendAt = t + 1.6; } }
        else if (sd.st === 'sink') { sd.t = Math.min(1, sd.t + dt / 1.3); sd.p.set(sd.x, lerp(TOP + .03, -.3, sm(0, 1, sd.t)), lerp(FACE - .25, FACE + .02, sm(0, .4, sd.t))); sd.m.rotation.z = lerp(sd.m.rotation.z, 1.2, dt * 3); if (sd.t >= 1) { sd.st = 'done'; planted.push([sd.p.x, sd.p.y]); if (planted.length > 6) planted.shift(); } }
        sd.m.position.copy(sd.p);
      }
      if (sendAt && t > sendAt) { sendAt = 0; if (Math.random() < .7) offer(false); }
      // de temps en temps, sans raison visible : la terre bouge un peu
      if (t > nextIdle) { nextIdle = t + 5 + Math.random() * 8; burst(-1.5 + Math.random() * 3, 4, .5); }
      sus.step(dt, { ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: -2.5 * I.k, r: .9 }, fn: (i, p, v, o, d) => { v[o] += (Math.random() - .5) * .5 * d * (1 + pulse * 4); v[o + 1] += (Math.random() - .5) * .5 * d * (1 + pulse * 4) - .01 * d; if (p[o + 1] > -.12) v[o + 1] -= .5 * d; if (p[o + 1] < -2.6) p[o + 1] = -.2; if (Math.abs(p[o]) > 4.2) p[o] *= -.98; p[o + 2] = FACE + .03 + (i % 3) * .02; } }); sus.sync();
      dust.step(dt, { wind: wind * .6 }); dust.sync();
      clump.step(dt, { wind: wind * .3, fn: courier ? (i, p, v, o, d) => { if (courier.includes(i)) { v[o] += cDir.x * 5 * d; v[o + 1] += (-cDir.y * 5 + 1.2) * d; } } : null });
      if (courier) { const i0 = courier[0], o = i0 * 3; W.set(clump.p[o], clump.p[o + 1], clump.p[o + 2]); const c = kit.toCard(W, cam); if (!clump.on[i0] || c.x < .02 || c.x > .98 || c.y < .02 || c.y > .98) { if (clump.on[i0]) ctx.send('soil-disturbance', { x: c.x, y: c.y, vx: cDir.x, vy: cDir.y, material: 'soil' }); courier.forEach(i => clump.kill(i)); courier = null; } }
      clump.sync();
      sun.position.set(-3 + I.px * 4 * I.k, 5.5, 4);
      cam.position.set(CAM[0] + I.px * .3 * I.k, CAM[1] - I.py * .15 * I.k, CAM[2]); cam.lookAt(LOOK);
    },
  };
}

/* ═════════ LÉGUMES ET FRUITS — la maturation ═════════
   Une pousse sort de terre (une seule fois : la plante garde sa taille d'une visite de page à l'autre), ses feuilles se
   déplient, une tomate grossit et mûrit (vert → orange → rouge) ; la lumière se réchauffe avec la maturité. Mûre, la
   fleur libère son pollen (pollen-drift vers les Céréales) et le fruit tombe, roule, se fond. Des gouttes perlent.
   Une motte reçue des Tubercules nourrit la plante : poussée de croissance, maturation plus rapide. */
export function legumes(ctx) {
  const { T, scene: s, cam, kit, q, mem } = ctx, r = kit.rng(37);
  const sun = kit.stage(s, BG['legumes-et-fruits'], 6.5, 14);
  const CAM = [0, .55, 6.8], LOOK = new T.Vector3(.2, -.05, 0), GROUND = -1.3;
  kit.shade(s, 0, 0, 4.5, 2.4, .2);
  const mound = new T.Mesh(kit.bumpy(new T.SphereGeometry(1, 24, 10, 0, TAU, 0, Math.PI / 2), .05, 4), kit.mat('soil', { roughness: 1 })); mound.scale.set(1.45, .32, 1); mound.position.y = GROUND; s.add(mound);
  const moundY = x => GROUND + .32 * Math.sqrt(Math.max(0, 1 - (x / 1.45) ** 2));
  const stemC = new T.CatmullRomCurve3([new T.Vector3(0, GROUND + .25, 0), new T.Vector3(.08, -.45, 0), new T.Vector3(-.1, .25, .05), new T.Vector3(.12, .95, 0), new T.Vector3(0, 1.55, .05)]);
  const stemG = new T.TubeGeometry(stemC, 60, .04, 6); s.add(new T.Mesh(stemG, kit.mat('stem')));
  const lg = kit.leafGeo(.27, .72, .22), leaves = [.22, .36, .5, .64, .78, .9].map((u, i) => { const g = new T.Group(), l = new T.Mesh(lg, kit.mat(i % 2 ? 'leaf' : 'leaf2', { side: T.DoubleSide, roughness: .55 })); g.add(l); g.rotation.y = i * 2.4; s.add(g); return { g, l, u, ph: i * 1.3 }; });
  // fleur (pollen) au sommet
  const fl = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? .04 : .12; fl[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  const flower = new T.Mesh(new T.ShapeGeometry(fl), kit.mat('#E9C23F', { side: T.DoubleSide, roughness: .5 })); s.add(flower);
  // fruit : pédoncule + tomate + calice
  const fruit = new T.Group(), body = kit.bumpy((() => { const g = new T.SphereGeometry(.28, 22, 16); g.scale(1, .84, 1); return g; })(), .03, 6);
  const fM = new T.MeshStandardMaterial({ color: new T.Color(kit.C.unripe), roughness: .3 }); fruit.add(new T.Mesh(body, fM));
  const cs = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? .03 : .13; cs[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  const cal = new T.Mesh(new T.ShapeGeometry(cs), kit.mat('#4F7136', { side: T.DoubleSide })); cal.rotation.x = -Math.PI / 2; cal.position.y = .23; fruit.add(cal); s.add(fruit);
  const ped = new T.Mesh(new T.CylinderGeometry(.014, .014, 1, 4), kit.mat('stem')); s.add(ped);
  const GREEN = new T.Color(kit.C.unripe), ORANGE = new T.Color(kit.C.orange), RED = new T.Color(kit.C.tomato), WARM = new T.Color('#FFC88E'), NEUTRAL = new T.Color('#FFE6C2');
  const pollen = new Swarm(kit, { n: 36, color: 'pollen', size: .065, g: .12, drag: 1.3, windK: 1.6, life: 3.6 }); s.add(pollen.obj);
  const drops = new Swarm(kit, { n: 4, mesh: { geo: (() => { const g = new T.SphereGeometry(.045, 10, 8); g.scale(1, 1.35, 1); return g; })(), mat: new T.MeshStandardMaterial({ color: new T.Color(kit.C.water), roughness: .05, transparent: true, opacity: .75 }) }, g: -5, drag: .25, windK: .2, life: 3 });
  s.add(drops.obj);
  const splash = new Swarm(kit, { n: 28, color: 'water', size: .05, g: -4, drag: .8, life: .5 }); s.add(splash.obj);
  const soil = new Swarm(kit, { n: 24, color: 'soil', size: .08, g: -3.2, drag: .9, windK: .3, life: 2.4, floor: GROUND, onFloor: i => { soil.kill(i); return false; } }); s.add(soil.obj);
  let growth = mem.growth ?? 0, age = mem.age ?? 0, ripe = mem.ripe ?? 0, hold = 0, falling = null, shake = 0, nextDrop = 3 + r() * 6, courier = null, cDir = null, spurt = 0;
  const W = new T.Vector3(), ptr = new T.Vector3(), tp = new T.Vector3(), fv = new T.Vector3(), att = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const tip = () => { const L = leaves[(Math.random() * leaves.length) | 0]; L.l.updateMatrixWorld(); return W.set(0, .7, 0).applyMatrix4(L.l.matrixWorld); };
  const drip = () => { if (growth < .4) return; const p = tip(); drops.spawn(p.x, p.y, p.z, 0, 0, 0, 3); };
  const puff = (n) => { flower.updateMatrixWorld(); for (let k = 0; k < n; k++) pollen.spawn(flower.position.x, flower.position.y, flower.position.z, (Math.random() - .5) * .6, .3 + Math.random() * .5, (Math.random() - .5) * .3, 3.6); };
  const offer = (tap) => { if (courier || growth < .8) return false; const d = ctx.canSend('pollen-drift', tap); if (!d) return false; cDir = d; courier = []; for (let k = 0; k < 3; k++) courier.push(pollen.spawn(flower.position.x, flower.position.y, flower.position.z, d.x * .6, .4, 0, 5)); return true; };
  return {
    offer,
    tap(nx, ny) { shake = 1; ctx.energy(.3); drip(); if (growth > .8) puff(8); if (ripe > .85 && !falling) hold = 99; if (Math.random() < .5) offer(true); },
    receive(type, d) { if (type === 'condensation') { kit.fromCard(d.x, Math.min(d.y, .4), cam, .2, tp); for (let k = 0; k < 3; k++) drops.spawn(tp.x + k * .08, tp.y, tp.z, (-tp.x) * .3, -.2, 0, 3); spurt = Math.max(spurt, .6); return; } if (type !== 'soil-disturbance') return; kit.fromCard(d.x, Math.min(d.y, .3), cam, 0, tp); for (let k = 0; k < 10; k++) soil.spawn(tp.x + (Math.random() - .5) * .25, tp.y, tp.z + (Math.random() - .5) * .2, (d.vx || 0) * .8 + (-tp.x) * .5, -.3 - Math.random() * .4, 0, 2.4); spurt = 1; },
    update(t, dt, I) {
      const wind = I.wind; kit.fromCard(I.nx, I.ny, cam, .3, ptr);
      shake *= Math.exp(-dt * 1.8); spurt *= Math.exp(-dt * .6);
      // croissance : lente, accélérée par la terre reçue
      growth = Math.min(1, growth + dt * (growth < .7 ? .16 : .02) + spurt * dt * .25); mem.growth = growth;
      stemG.setDrawRange(0, Math.floor(stemG.index.count * sm(0, .75, growth) / 6) * 6);
      const sway = Math.sin(t * .8) * .03 + wind * .05 + Math.sin(t * 11) * .04 * shake - I.px * .08 * I.k;
      leaves.forEach(L => { const o = sm(L.u * .7, L.u * .7 + .2, growth); L.g.position.copy(stemC.getPoint(L.u)); L.g.position.x += sway * L.u * 2; L.g.scale.setScalar(Math.max(.001, o * (1 - L.u * .35))); L.l.rotation.x = lerp(-1.5, -.55, o) + Math.sin(t * 1.2 + L.ph) * .08 + wind * .12; L.l.rotation.z = Math.sin(t * 9 + L.ph) * .1 * shake; });
      const top = stemC.getPoint(1); flower.position.set(top.x + sway * 2, top.y + .05, top.z); flower.lookAt(cam.position); flower.scale.setScalar(Math.max(.001, sm(.75, .95, growth)));
      // fruit : grossit puis mûrit ; la lumière se réchauffe avec lui
      if (!falling && growth > .55) { age = Math.min(1, age + dt / 4); ripe = Math.min(1, ripe + dt * (age >= 1 ? 1 / 13 : 0) * (1 + spurt * 2)); }
      mem.age = age; mem.ripe = ripe;
      fM.color.copy(GREEN).lerp(ORANGE, sm(0, .6, ripe)).lerp(RED, sm(.5, 1, ripe));
      sun.color.copy(NEUTRAL).lerp(WARM, ripe * .7);
      const anchor = stemC.getPoint(.6); anchor.x += sway * 1.2;
      if (!falling) {
        att.set(anchor.x + .42 + sway, anchor.y - .48, anchor.z + .15);
        fruit.position.copy(att); fruit.scale.setScalar(Math.max(.001, sm(0, 1, age)) * (1 + Math.sin(t * 1.1) * .01)); fruit.rotation.z = sway * 2;
        if (ripe >= 1) { hold += dt; if (hold > 2.5) { puff(12); offer(false); falling = { v: new T.Vector3(.2 + wind * .2, 0, .1), t: 0 }; hold = 0; } }
      } else {
        // le fruit mûr tombe, rebondit sur la butte, roule, se fond dans la terre ; un fruit vert se forme
        const F = falling; F.t += dt; F.v.y -= 5.5 * dt; F.v.x += wind * .3 * dt; fruit.position.addScaledVector(F.v, dt);
        const gy = moundY(fruit.position.x) + .24 * fruit.scale.x; if (fruit.position.y < gy) { fruit.position.y = gy; F.v.y *= -.32; F.v.x = F.v.x * .8 + fruit.position.x * .6 * dt * 10; }
        fruit.rotation.z -= F.v.x * dt * 4; fruit.scale.setScalar(Math.max(.001, 1 - sm(2.2, 3.2, F.t)));
        if (F.t > 3.2) { falling = null; age = 0; ripe = 0; }
      }
      W.copy(fruit.position); ped.visible = !falling; if (!falling) { fv.subVectors(anchor, W); const L = fv.length(); ped.position.copy(W).addScaledVector(fv, .5); ped.scale.set(1, L, 1); ped.quaternion.setFromUnitVectors(up, fv.normalize()); }
      if (t > nextDrop) { nextDrop = t + 9 + Math.random() * 8; drip(); }
      drops.step(dt, { wind: wind * .2, fn: (i, p, v, o) => { const gy = moundY(p[o]); if (p[o + 1] > gy) return; drops.kill(i); for (let k = 0; k < 7; k++) splash.spawn(p[o], gy + .02, p[o + 2], (Math.random() - .5), .6 + Math.random() * .8, (Math.random() - .5) * .4, .5); } }); drops.sync();
      splash.step(dt); splash.sync();
      soil.step(dt, { wind: wind * .3, fn: (i, p, v, o, d) => { if (p[o + 1] < moundY(p[o])) { p[o + 1] = moundY(p[o]); soil.kill(i); } } }); soil.sync();
      pollen.step(dt, { wind: wind * .9 + .1, ptr: { x: ptr.x, y: ptr.y, z: ptr.z, s: 4 * I.k, r: 1.4 }, fn: courier ? (i, p, v, o, d) => { if (courier.includes(i)) { v[o] += cDir.x * 3 * d; v[o + 1] += -cDir.y * 3 * d; } } : null });
      if (courier) { const i0 = courier[0], o = i0 * 3; W.set(pollen.p[o], pollen.p[o + 1], pollen.p[o + 2]); const c = kit.toCard(W, cam); if (!pollen.on[i0] || c.x < .02 || c.x > .98 || c.y < .02 || c.y > .98) { if (pollen.on[i0]) ctx.send('pollen-drift', { x: c.x, y: c.y, vx: cDir.x, vy: cDir.y, material: 'pollen' }); courier.forEach(i => pollen.kill(i)); courier = null; } }
      pollen.sync();
      sun.position.set(-3.5 + I.px * 5 * I.k, 5 - I.py * 2 * I.k, 4);
      cam.position.set(CAM[0] + I.px * .35 * I.k, CAM[1] - I.py * .2 * I.k, CAM[2]); cam.lookAt(LOOK);
    },
  };
}

export const SCENES = { 'cereales-et-riz-local': cereales, 'tubercules-et-feculents': tubercules, 'legumes-et-fruits': legumes };
// qui reçoit quoi : la boucle Céréales → Tubercules → Légumes → Céréales
export const GRAPH = { 'seed-release': 'tubercules-et-feculents', 'soil-disturbance': 'legumes-et-fruits', 'pollen-drift': 'cereales-et-riz-local' };
export const SOURCE = { 'tubercules-et-feculents': 'cereales-et-riz-local', 'legumes-et-fruits': 'tubercules-et-feculents', 'cereales-et-riz-local': 'legumes-et-fruits' };
