// Marché de Gros CI — « Le territoire » : carte 3D vivante de la Côte d'Ivoire, pilotée par les données du site.
// Le module ne possède aucune donnée : l'application lui passe producteurs, zones et état (filtre, sélection, position).
// Géométrie : frontières réelles Natural Earth (world-atlas 50m). Relief stylisé, construit à partir de la géographie
// générale (massif de Man / Dan à l'ouest, plateaux du nord, plaine côtière). Végétation : forêt au sud, savane au nord.
const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const TOPO = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
let T, topoP;
const P = { cacao: '#171512', brun: '#24201A', ivoire: '#F2EBDD', ivoireT: '#F5F0E6', sable: '#B9AD98', terre: '#B85C38', foret: '#31543C', recolte: '#D6A83E', ambre: '#E07A3F' };
const LON0 = -5.55, LAT0 = 7.55, S = 9, KX = Math.cos(LAT0 * Math.PI / 180), HALF = 36;
export const toXZ = (lat, lon) => [(lon - LON0) * KX * S, -(lat - LAT0) * S];
const toLL = (x, z) => [LAT0 - z / S, x / (KX * S) + LON0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2.1 + 5, y * 2.1) * .3 + vnoise(x * 4.3, y * 4.3 + 9) * .2;
const gauss = (lat, lon, la, lo, s) => Math.exp(-((lat - la) ** 2 + ((lon - lo) * KX) ** 2) / (2 * s * s));
function elevRaw(x, z) {
  const [lat, lon] = toLL(x, z);
  return Math.max(.05, .3 + .85 * smooth(6.2, 9.6, lat) + 3.1 * gauss(lat, lon, 7.45, -7.65, .5) + 2.1 * gauss(lat, lon, 7.62, -8.3, .32) + .8 * gauss(lat, lon, 8.4, -7.3, .75) + .55 * fbm(x * .13 + 3, z * .13 + 7) - .35 * smooth(5.7, 4.8, lat));
}
const ringsOf = f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(p => p[0]);

// Un seul monde pour tout le site : créé une fois, puis « amarré » dans la page courante (carte plein écran, encart de fiche, demande).
export async function create(opts) {
  const { data, reduced = false, tier = 2 } = opts;
  let mode = { interactive: true, onPick: null, onZone: null };
  const onPick = id => mode.onPick && mode.onPick(id), onZone = s2 => mode.onZone && mode.onZone(s2);
  const root = document.createElement('div'); root.className = 'tz-world'; root.innerHTML = '<div class="tz-labels"></div>';
  T = T || await import(THREE_URL);
  const [topo] = await Promise.all([topoP || (topoP = fetch(TOPO).then(r => { if (!r.ok) throw new Error('topo'); return r.json(); })), window.MDGMap.libs()]);
  const feats = window.topojson.feature(topo, topo.objects.countries).features;
  const civ = feats.find(f => f.id === '384'); if (!civ) throw new Error('civ');
  const mobile = matchMedia('(max-width: 760px)').matches, hi = tier >= 2 && !mobile;

  /* ——— Rendu ——— */
  const canvas = document.createElement('canvas'); canvas.className = 'tz-cv'; canvas.setAttribute('aria-hidden', 'true');
  const renderer = new T.WebGLRenderer({ canvas, antialias: hi, powerPreference: hi ? 'high-performance' : 'low-power' });
  let dpr = Math.min(devicePixelRatio, hi ? 2 : 1.5); renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  root.prepend(canvas);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); visible = false; opts.onLost && opts.onLost(); });
  const scene = new T.Scene(), BG = new T.Color(P.cacao);
  scene.background = BG; scene.fog = new T.Fog(BG, 90, 260);
  const camera = new T.PerspectiveCamera(36, 1, .5, 600);
  const hemi = new T.HemisphereLight(new T.Color(P.ivoireT), new T.Color(P.brun), 1.15); scene.add(hemi);
  const sun = new T.DirectionalLight(new T.Color('#fff1dc'), 2.1); sun.position.set(-40, 60, 25); scene.add(sun);

  /* ——— Masque du pays (silhouette exacte) + champ de distance au bord pour le relief ——— */
  const MS = hi ? 1024 : 512, mk = document.createElement('canvas'); mk.width = mk.height = MS;
  const g = mk.getContext('2d'), px = v => (v + HALF) / (2 * HALF) * MS;
  g.fillStyle = '#000'; g.fillRect(0, 0, MS, MS); g.fillStyle = '#fff';
  ringsOf(civ).forEach(r => { g.beginPath(); r.forEach(([lon, lat], i) => { const [x, z] = toXZ(lat, lon); i ? g.lineTo(px(x), px(z)) : g.moveTo(px(x), px(z)); }); g.closePath(); g.fill(); });
  const maskTex = new T.CanvasTexture(mk);
  const BS = 256, sm = document.createElement('canvas'); sm.width = sm.height = BS; const sg = sm.getContext('2d'); sg.drawImage(mk, 0, 0, BS, BS);
  let fld = Float32Array.from(sg.getImageData(0, 0, BS, BS).data.filter((_, i) => i % 4 === 0), v => v / 255);
  const blur = (a, r) => { const o = new Float32Array(a.length); for (let pass = 0; pass < 2; pass++) { const src = pass ? o.slice() : a; for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = pass ? x : x + k, yy = pass ? y + k : y; if (xx < 0 || yy < 0 || xx >= BS || yy >= BS) { n++; continue; } s += src[yy * BS + xx]; n++; } o[y * BS + x] = s / n; } } return o; };
  fld = blur(fld, 5);
  const inside = (x, z) => { const i = clamp(Math.round(px(z) / MS * BS), 0, BS - 1) * BS + clamp(Math.round(px(x) / MS * BS), 0, BS - 1); return fld[i]; };
  const elev = (x, z) => elevRaw(x, z) * smooth(.5, .93, inside(x, z));
  const groundAt = (lat, lon) => { const [x, z] = toXZ(lat, lon); return [x, elev(x, z), z]; };

  /* ——— Terrain ——— */
  const N = hi ? 260 : 150, tg = new T.PlaneGeometry(2 * HALF, 2 * HALF, N, N); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, col = new Float32Array(pos.count * 3);
  const cF = new T.Color(P.foret), cF2 = new T.Color(P.foret).lerp(new T.Color(P.brun), .45), cS = new T.Color(P.sable).lerp(new T.Color(P.recolte), .22).lerp(new T.Color(P.terre), .08), cM = new T.Color(P.foret).lerp(new T.Color(P.cacao), .35), cC = new T.Color(P.foret).lerp(new T.Color(P.sable), .3), tmp = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = elev(x, z), [lat] = toLL(x, z), n = fbm(x * .2, z * .2);
    pos.setY(i, h);
    const sav = smooth(7.1, 9.1, lat + (n - .5) * 1.1);
    tmp.copy(cF).lerp(cF2, n * .6).lerp(cS, sav).lerp(cM, smooth(1.8, 3.2, h)).lerp(cC, smooth(5.4, 4.7, lat) * .5);
    const b = .9 + (vnoise(x * .9, z * .9) - .5) * .14; col[i * 3] = tmp.r * b; col[i * 3 + 1] = tmp.g * b; col[i * 3 + 2] = tmp.b * b;
  }
  tg.setAttribute('color', new T.BufferAttribute(col, 3)); tg.computeVertexNormals();
  const HL = 24, uHL = { value: Array.from({ length: HL }, () => new T.Vector4(0, 0, 1, 0)) }, uDim = { value: 0 }, uWarm = { value: new T.Color(P.ambre).lerp(new T.Color(P.recolte), .35) };
  const tmat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0, alphaMap: maskTex, alphaTest: .5 });
  tmat.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uHL, uDim, uWarm });
    s.vertexShader = 'varying vec3 vW;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    s.fragmentShader = `uniform vec4 uHL[${HL}];uniform float uDim;uniform vec3 uWarm;varying vec3 vW;\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float hl=0.;for(int i=0;i<${HL};i++){vec2 d=vW.xz-uHL[i].xy;hl=max(hl,uHL[i].w*exp(-dot(d,d)/(uHL[i].z*uHL[i].z)));}
      diffuseColor.rgb=mix(diffuseColor.rgb*(1.0-0.45*uDim),mix(diffuseColor.rgb,uWarm,.42)*1.15,hl);`);
  };
  const terrain = new T.Mesh(tg, tmat); scene.add(terrain);
  // socle : épaisseur du territoire posé sur la table
  const main = ringsOf(civ).sort((a, b) => b.length - a.length)[0];
  const shapeOf = r => new T.Shape(r.map(([lon, lat]) => { const [x, z] = toXZ(lat, lon); return new T.Vector2(x, -z); }));
  const slabG = new T.ExtrudeGeometry(shapeOf(main), { depth: 2.6, bevelEnabled: false, curveSegments: 1 }); slabG.rotateX(-Math.PI / 2); slabG.translate(0, -2.58, 0);
  scene.add(new T.Mesh(slabG, new T.MeshStandardMaterial({ color: new T.Color(P.brun).lerp(new T.Color(P.terre), .18), roughness: 1 })));
  // pays voisins : présents, mais au second plan
  const NB = { '430': 'Libéria', '324': 'Guinée', '466': 'Mali', '854': 'Burkina Faso', '288': 'Ghana' };
  const nbMat = new T.MeshStandardMaterial({ color: new T.Color(P.brun).lerp(new T.Color(P.sable), .07), roughness: 1 });
  feats.filter(f => NB[f.id]).forEach(f => ringsOf(f).forEach(r => { const ng = new T.ShapeGeometry(shapeOf(r)); ng.rotateX(-Math.PI / 2); ng.translate(0, -1.4, 0); scene.add(new T.Mesh(ng, nbMat)); }));
  const sea = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshStandardMaterial({ color: new T.Color('#1c1915'), roughness: .7 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -1.6; scene.add(sea);

  /* ——— Producteurs : un grenier par producteur (présence physique sur le territoire) ——— */
  const PR = data.producers.map((p, i) => { const [x, y, z] = groundAt(p.lat, p.lon); return { ...p, i, x, y, z, s: 0, sT: 1, c: new T.Color(P.terre), cT: new T.Color(P.terre), delay: 0 }; });
  const prBy = Object.fromEntries(PR.map(p => [p.id, p]));
  const n = Math.max(1, PR.length);
  const bodyG = new T.CylinderGeometry(.46, .54, .78, 12); bodyG.translate(0, .39, 0);
  const roofG = new T.ConeGeometry(.78, .82, 12); roofG.translate(0, .78 + .41, 0);
  const padG = new T.CircleGeometry(1, 20); padG.rotateX(-Math.PI / 2); padG.translate(0, .04, 0);
  const iBody = new T.InstancedMesh(bodyG, new T.MeshStandardMaterial({ color: new T.Color('#e8dbc3'), roughness: .9 }), n);
  const iRoof = new T.InstancedMesh(roofG, new T.MeshStandardMaterial({ color: 0xffffff, roughness: .85 }), n);
  const iPad = new T.InstancedMesh(padG, new T.MeshBasicMaterial({ color: new T.Color(P.cacao), transparent: true, opacity: .32, depthWrite: false }), n);
  [iBody, iRoof, iPad].forEach(m => { m.count = PR.length; scene.add(m); });
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SC = new T.Vector3();
  function writeInst(t) {
    PR.forEach(p => {
      const breathe = reduced ? 1 : 1 + Math.sin(t * .0011 + p.i * 1.7) * .025, k = p.s * breathe;
      V.set(p.x, p.y, p.z); SC.set(k, k, k); M4.compose(V, Q, SC); iBody.setMatrixAt(p.i, M4); iRoof.setMatrixAt(p.i, M4);
      SC.set(k * 1.25, 1, k * 1.25); M4.compose(V, Q, SC); iPad.setMatrixAt(p.i, M4);
      iRoof.setColorAt(p.i, p.c);
    });
    iBody.instanceMatrix.needsUpdate = iRoof.instanceMatrix.needsUpdate = iPad.instanceMatrix.needsUpdate = true; if (iRoof.instanceColor) iRoof.instanceColor.needsUpdate = true;
  }

  /* ——— Anneaux : marché principal (Abidjan) et position de l'acheteur ——— */
  const ringG = new T.RingGeometry(1.15, 1.42, 48); ringG.rotateX(-Math.PI / 2);
  const mkRing = c => { const m = new T.Mesh(ringG, new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0, depthWrite: false })); scene.add(m); return m; };
  const hub = data.hub ? (() => { const [x, y, z] = groundAt(data.hub.lat, data.hub.lon); return { x, y, z, ring: mkRing(P.ivoire) }; })() : null;
  if (hub) { hub.ring.position.set(hub.x, hub.y + .08, hub.z); hub.ring.material.opacity = .55; }
  const me = { ring: mkRing(P.ivoireT), x: 0, y: 0, z: 0, on: false };

  /* ——— Flux : production → marché (ou → acheteur). Arcs tracés progressivement, caisses qui circulent ——— */
  const FLOW_MAX = 40, crateG = new T.BoxGeometry(.34, .26, .34), crates = new T.InstancedMesh(crateG, new T.MeshStandardMaterial({ color: new T.Color(P.recolte), roughness: .8 }), FLOW_MAX * 3);
  crates.count = 0; scene.add(crates);
  let flows = [];
  const flowMat = () => new T.MeshBasicMaterial({ color: new T.Color(P.ambre), transparent: true, opacity: .85, depthWrite: false, fog: true });
  function clearFlows() { flows.forEach(f => { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }); flows = []; crates.count = 0; }
  function buildFlows(pairs, now) {
    clearFlows();
    pairs.slice(0, FLOW_MAX).forEach(([a, b], k) => {
      const A = new T.Vector3(a.x, a.y + 1.6, a.z), B = new T.Vector3(b.x, b.y + .3, b.z), len = A.distanceTo(B);
      if (len < 1.5) return;
      const mid = A.clone().lerp(B, .5); mid.y += 1.8 + len * .2;
      const curve = new T.QuadraticBezierCurve3(A, mid, B), geo = new T.TubeGeometry(curve, 48, .075, 5, false);
      const mesh = new T.Mesh(geo, flowMat()); geo.setDrawRange(0, 0); scene.add(mesh);
      flows.push({ curve, mesh, total: geo.index.count, t0: now + 350 + k * 110, len });
    });
    crates.count = reduced ? 0 : flows.length * 3;
  }

  /* ——— Étiquettes HTML : lisibles, accessibles, cibles tactiles ≥ 44 px ——— */
  const layer = root.querySelector('.tz-labels');
  const mkEl = (cls, html, tag = 'button') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; if (tag === 'button') e.type = 'button'; layer.appendChild(e); return e; };
  PR.forEach(p => { p.el = mkEl('tz-pin', `<b></b><small></small><em></em>`); p.el.dataset.p = p.id; p.el.onclick = () => { if (p.group && p.group.length > 1 && !p.el.classList.contains('sel')) zoomGroup(p); else onPick && onPick(p.id); }; });
  const ZN = data.zones.map(z => { const [x, y, z2] = groundAt(z.lat, z.lon); const el = mkEl('tz-zone', z.name); el.onclick = () => onZone && onZone(z.slug); el.setAttribute('aria-label', `Zone ${z.name}`); return { ...z, x, y: y + .2, z: z2, el }; });
  const zBy = Object.fromEntries(ZN.map(z => [z.slug, z]));
  const geoLbl = [['GOLFE DE GUINÉE', 4.0, -5.0], ...Object.entries({ 'LIBÉRIA': [6.6, -9.6], 'GUINÉE': [9.4, -9.4], 'MALI': [11.0, -6.9], 'BURKINA FASO': [11.0, -4.4], 'GHANA': [7.6, -1.8] }).map(([k, v]) => [k, ...v])]
    .map(([t, lat, lon]) => { const [x, z] = toXZ(lat, lon); return { x, y: -1.2, z, el: mkEl('tz-geo', t, 'span') }; });
  const hubEl = hub ? mkEl('tz-hub', `<b>${data.hub.label}</b>`, 'span') : null;
  const meEl = mkEl('tz-me', '<b>Vous</b>', 'span'); meEl.style.opacity = 0;

  /* ——— Caméra : cible + distance + inclinaison + orientation, transitions avec trajectoire ——— */
  const cam = { tx: 0, tz: 4, dist: 160, pol: .1, az: 0 };
  const LIM = { dmin: 13, dmax: 175 };
  let W = 1, H = 1, ins = { left: 0, bottom: 0 }, fly = null, camDirty = true;
  const homeDist = () => clamp(82 * Math.max(1, 1.25 / (W / Math.max(1, H - ins.bottom))), 70, 150);
  const HOME = () => ({ tx: 0, tz: 3, dist: homeDist(), pol: mobile ? .62 : .78, az: -.12 });
  function applyCam() {
    const { tx, tz, dist, pol, az } = cam, sp = Math.sin(pol);
    camera.position.set(tx + dist * sp * Math.sin(az), dist * Math.cos(pol) + 1, tz + dist * sp * Math.cos(az));
    camera.lookAt(tx, 1, tz); camera.updateMatrixWorld(); camDirty = true;
  }
  function flyTo(goal, dur = 1700) {
    const from = { ...cam }, to = { ...cam, ...goal };
    to.dist = clamp(to.dist, LIM.dmin, LIM.dmax); to.pol = clamp(to.pol, .08, 1.12);
    let da = to.az - from.az; da = Math.atan2(Math.sin(da), Math.cos(da)); to.az = from.az + da;
    const travel = Math.hypot(to.tx - from.tx, to.tz - from.tz);
    if (reduced) dur = 0;
    fly = { from, to, t0: performance.now(), dur: Math.max(1, dur), hump: Math.min(28, travel * .45) };
    wake();
  }
  const stepFly = now => {
    if (!fly) return false;
    const t = clamp((now - fly.t0) / fly.dur, 0, 1), e = ease(t), f = fly.from, g2 = fly.to;
    cam.tx = lerp(f.tx, g2.tx, e); cam.tz = lerp(f.tz, g2.tz, e); cam.az = lerp(f.az, g2.az, e);
    cam.pol = lerp(f.pol, g2.pol, e) - Math.sin(Math.PI * t) * .12 * (fly.hump > 4 ? 1 : 0);
    cam.dist = lerp(f.dist, g2.dist, e) + Math.sin(Math.PI * t) * fly.hump;
    applyCam(); if (t >= 1) fly = null; return true;
  };
  function fitPoints(pts, opt = {}) {
    if (!pts.length) return flyTo(HOME());
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
    const ext = Math.max(x1 - x0, (z1 - z0) * 1.15), asp = Math.max(.5, (W - ins.left) / Math.max(1, H - ins.bottom));
    flyTo({ tx: (x0 + x1) / 2, tz: (z0 + z1) / 2 + 2, dist: clamp(ext * 1.35 / Math.min(1, asp) + (opt.pad ?? 26), 24, 150), pol: opt.pol ?? .74, az: cam.az * .5 }, opt.dur ?? 1900);
  }
  function zoomGroup(p) { const pts = p.group.map(id => prBy[id]); fitPoints(pts, { pad: 10, pol: .8, dur: 1300 }); }

  /* ——— Gestes : glisser = déplacer · pincer = zoom + rotation · molette · Maj/clic droit = orbiter ——— */
  canvas.style.touchAction = 'none';
  const ptr = new Map(); let last = null;
  const wpp = () => 2 * cam.dist * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, H);
  const pan = (dx, dy) => { const k = wpp(), r = [Math.cos(cam.az), -Math.sin(cam.az)], f = [-Math.sin(cam.az), -Math.cos(cam.az)], ky = k * (1 + cam.pol * .9); cam.tx = clamp(cam.tx - r[0] * dx * k + f[0] * dy * ky, -34, 34); cam.tz = clamp(cam.tz - r[1] * dx * k + f[1] * dy * ky, -34, 38); };
  const gest = () => { const a = [...ptr.values()]; if (a.length < 2) return null; const [p, q] = a; return { d: Math.hypot(q.x - p.x, q.y - p.y), a: Math.atan2(q.y - p.y, q.x - p.x), mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 }; };
  canvas.addEventListener('pointerdown', e => { if (!mode.interactive && e.pointerType !== 'mouse') return; fly = null; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, rot: e.button === 2 || e.shiftKey }); last = gest(); root.classList.add('grab'); });
  canvas.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptr.size === 1) { if (p.rot) { cam.az -= dx * .006; cam.pol = clamp(cam.pol + dy * .004, .08, 1.12); } else pan(dx, dy); }
    else { const g2 = gest(); if (last && g2) { cam.dist = clamp(cam.dist * last.d / Math.max(1, g2.d), LIM.dmin, LIM.dmax); cam.az += (g2.a - last.a); pan(g2.mx - last.mx, g2.my - last.my); } last = g2; }
    applyCam(); wake();
  });
  const up = e => { ptr.delete(e.pointerId); last = gest(); if (!ptr.size) root.classList.remove('grab'); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { if (!mode.interactive) return; e.preventDefault(); fly = null; cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0011), LIM.dmin, LIM.dmax); applyCam(); wake(); }, { passive: false });

  /* ——— État piloté par l'application ——— */
  let state = { hl: null, sel: null, zone: null, user: null, flowTo: 'hub', labels: {} }, hlSig = '';
  function setState(s) {
    state = { ...state, ...s };
    const now = performance.now(), hl = state.hl, any = !!(hl || state.zone);
    const sig = (hl ? [...hl].sort().join(',') : '') + '|' + state.zone + '|' + (state.user || []).join(',') + '|' + state.flowTo;
    let k = 0;
    PR.forEach(p => {
      const on = hl ? hl.has(p.id) : true, sel = state.sel === p.id;
      p.sT = sel ? 1.4 : hl ? (on ? 1.3 : .62) : 1;
      p.cT.set(sel ? P.ivoire : hl ? (on ? P.ambre : P.sable) : P.terre);
      if (hl && on) p.delay = now + (k++) * 90; else p.delay = now;
      const L = state.labels[p.id] || {}; p.el.querySelector('b').textContent = L.t || p.city; p.el.querySelector('small').textContent = L.s || '';
      p.el.classList.toggle('hl', !!(hl && on)); p.el.classList.toggle('dim', !!(hl && !on)); p.el.classList.toggle('sel', sel);
      p.el.setAttribute('aria-label', `${p.name}, ${p.city}${L.s ? ', ' + L.s : ''}`);
      p.on = on;
    });
    ZN.forEach(z => z.el.classList.toggle('on', z.slug === state.zone));
    me.on = !!state.user;
    if (me.on) { const [x, y, z] = groundAt(state.user[0], state.user[1]); Object.assign(me, { x, y, z }); me.ring.position.set(x, y + .1, z); meEl.querySelector('b').textContent = state.userLabel || 'Vous'; }
    if (sig !== hlSig) {
      hlSig = sig;
      const tgt = state.flowTo === 'user' && me.on ? me : hub;
      const src = hl ? PR.filter(p => hl.has(p.id)) : [];
      buildFlows(tgt && src.length && src.length <= FLOW_MAX ? src.map(p => [p, tgt]) : [], now);
      // halos de lumière : zone choisie + producteurs concernés, allumés un par un
      const slots = []; if (state.zone && zBy[state.zone]) slots.push([zBy[state.zone].x, zBy[state.zone].z, 8.5, 1, now]);
      src.forEach((p, i) => slots.push([p.x, p.z, 3.4, .95, now + 200 + i * 110]));
      uHL.value.forEach((v, i) => { const s2 = slots[i]; v._t = s2 ? s2[3] : 0; v._d = s2 ? s2[4] : 0; if (s2) { v.x = s2[0]; v.y = s2[1]; v.z = s2[2]; } });
      uDimT = any ? 1 : 0;
    }
    wake();
  }
  let uDimT = 0;

  /* ——— Boucle : rendu à la demande, ~24 i/s au repos, arrêt hors écran ——— */
  let raf = 0, visible = false, lastT = 0, lastIdle = 0, slow = 0;
  const wake = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };
  const io = new IntersectionObserver(([en]) => { visible = docked && en.isIntersecting && !document.hidden; if (visible) wake(); }); io.observe(root);
  const vis = () => { visible = docked && !document.hidden; if (visible) wake(); }; document.addEventListener('visibilitychange', vis);
  function loop(now) {
    raf = 0; if (!visible) return;
    const dt = Math.min(64, now - (lastT || now)); lastT = now;
    let active = stepFly(now);
    // producteurs : échelle et couleur vers leur cible
    PR.forEach(p => { if (now < p.delay) return; const ds = p.sT - p.s; if (Math.abs(ds) > .002) { p.s += ds * Math.min(1, dt * .009); active = true; } else p.s = p.sT; if (!p.c.equals(p.cT)) { p.c.lerp(p.cT, Math.min(1, dt * .008)); active = true; if (Math.abs(p.c.r - p.cT.r) + Math.abs(p.c.g - p.cT.g) < .002) p.c.copy(p.cT); } });
    uHL.value.forEach(v => { const tg2 = now >= (v._d || 0) ? (v._t || 0) : 0; if (Math.abs(v.w - tg2) > .003) { v.w += (tg2 - v.w) * Math.min(1, dt * .005); active = true; } else v.w = tg2; });
    if (Math.abs(uDim.value - uDimT) > .003) { uDim.value += (uDimT - uDim.value) * Math.min(1, dt * .005); active = true; } else uDim.value = uDimT;
    // flux : tracé puis circulation
    let ci = 0;
    flows.forEach(f => { const t = clamp((now - f.t0) / 900, 0, 1); f.mesh.geometry.setDrawRange(0, Math.floor(f.total * ease(t) / 3) * 3); if (t < 1) active = true;
      if (!reduced) for (let j = 0; j < 3; j++) { const u = t < 1 ? 0 : ((now - f.t0 - 900) / (2600 + f.len * 90) + j / 3) % 1; f.curve.getPoint(u, V); SC.setScalar(t < 1 ? 0 : Math.sin(Math.PI * u) * 1.1 + .1); M4.compose(V, Q, SC); crates.setMatrixAt(ci++, M4); } });
    if (ci) crates.instanceMatrix.needsUpdate = true;
    const idle = !reduced && (flows.length || true);
    const pulse = reduced ? 1 : 1 + (Math.sin(now * .0022) * .5 + .5) * .5;
    if (me.on) { me.ring.material.opacity = lerp(me.ring.material.opacity, .9, .1); me.ring.scale.setScalar(pulse * 1.3); } else me.ring.material.opacity = lerp(me.ring.material.opacity, 0, .2);
    if (hub) hub.ring.scale.setScalar(1 + (pulse - 1) * .4);
    if (!reduced) { const a = now * .00002; sun.position.set(Math.cos(a) * -45, 60, Math.sin(a) * 30 + 20); }
    const due = active || camDirty || flows.length || (idle && now - lastIdle > 42);
    if (due) {
      lastIdle = now; writeInst(now); renderer.render(scene, camera); if (camDirty || active) place(); camDirty = false;
      if (active && dt > 30) { if (++slow > 40 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); resize(); slow = 0; } } else slow = Math.max(0, slow - 1);
    }
    if (active || flows.length || idle) raf = requestAnimationFrame(loop);
  }

  /* ——— Placement des étiquettes + regroupement à l'écran (clusters → zones → producteurs) ——— */
  const PV = new T.Vector3();
  const proj = (x, y, z) => { PV.set(x, y, z).project(camera); return [(PV.x * .5 + .5) * W, (-PV.y * .5 + .5) * H, PV.z < 1 && Math.abs(PV.x) < 1.2 && Math.abs(PV.y) < 1.2]; };
  const put = (el, x, y, show, o = 1) => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; el.style.opacity = show ? o : 0; el.style.visibility = show ? 'visible' : 'hidden'; };
  function place() {
    const R = mobile ? 54 : 62, items = PR.map(p => { const [x, y, ok] = proj(p.x, p.y + 2.2 * Math.max(.8, p.s), p.z); return { p, x, y, ok, pri: (p.id === state.sel ? 4 : 0) + (p.el.classList.contains('hl') ? 2 : 0) + (p.el.classList.contains('dim') ? -1 : 0) }; }).sort((a, b) => b.pri - a.pri);
    const kept = [];
    const card = root.classList.contains('card');
    items.forEach(it => { it.p.group = [it.p.id]; if (!it.ok || (card && it.p.el.classList.contains('dim'))) return put(it.p.el, it.x, it.y, false); const host = kept.find(k => Math.abs(k.x - it.x) < R * 1.6 && Math.abs(k.y - it.y) < R * .62); if (host) { host.p.group.push(it.p.id); put(it.p.el, it.x, it.y, false); } else kept.push(it); });
    kept.forEach(k => { const extra = k.p.group.length - 1; k.p.el.querySelector('em').textContent = extra ? `+${extra}` : ''; k.p.el.classList.toggle('grp', extra > 0); put(k.p.el, k.x, k.y, true, k.p.el.classList.contains('dim') ? .5 : 1); });
    const zoneShow = cam.dist > 40 || state.zone;
    ZN.forEach(z => { const [x, y, ok] = proj(z.x, z.y, z.z); const clash = kept.some(k => Math.abs(k.x - x) < 70 && Math.abs(k.y - (y)) < 34); put(z.el, x, y, ok && (zoneShow && !clash || z.slug === state.zone), z.slug === state.zone ? 1 : .85); });
    geoLbl.forEach(l => { const [x, y, ok] = proj(l.x, l.y, l.z); put(l.el, x, y, ok && cam.dist > 50, .7); });
    if (hubEl) { const [x, y, ok] = proj(hub.x, hub.y, hub.z); put(hubEl, x, y, ok && !kept.some(k => Math.hypot(k.x - x, k.y - y - 30) < 46)); }
    if (me.on) { const [x, y, ok] = proj(me.x, me.y, me.z); put(meEl, x, y, ok); } else put(meEl, 0, 0, false);
  }

  function resize() {
    if (!root.isConnected || !root.clientWidth) return;
    W = root.clientWidth; H = root.clientHeight; renderer.setSize(W, H, false);
    camera.aspect = W / Math.max(1, H);
    camera.setViewOffset(W, H, -ins.left / 2, ins.bottom / 2, W, H);
    camera.updateProjectionMatrix(); camDirty = true; wake();
  }
  const ro = new ResizeObserver(resize); ro.observe(root);
  applyCam(); writeInst(0);
  let docked = false, firstDock = true;

  return {
    get docked() { return docked; },
    dock(el, m = {}) {
      mode = { interactive: true, onPick: null, onZone: null, ...m };
      canvas.style.touchAction = mode.interactive ? 'none' : 'pan-y';
      root.classList.toggle('card', !mode.interactive); root.classList.remove('on');
      el.appendChild(root); docked = true; ins = { left: 0, bottom: 0 }; resize();
      visible = !document.hidden; wake(); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
      const f = firstDock; firstDock = false; if (f) flyTo(HOME(), 2800); return f;
    },
    undock() { if (!docked) return; docked = false; visible = false; ptr.clear(); root.classList.remove('on', 'grab'); root.remove(); },
    setState,
    setInsets(o) { ins = { ...ins, ...o }; resize(); },
    home() { flyTo(HOME()); },
    zoom(f) { fly = null; flyTo({ dist: cam.dist * f }, 450); },
    focusProducer(id) { const p = prBy[id]; if (!p) return; flyTo({ tx: p.x, tz: p.z + 2, dist: 36, pol: .86, az: cam.az + .2 }, 1900); },
    focusZone(slug) { const z = zBy[slug]; if (!z) return; const pts = PR.filter(p => p.regionSlug === slug); fitPoints(pts.length > 1 ? pts : [{ x: z.x - 6, z: z.z - 5 }, { x: z.x + 6, z: z.z + 5 }], { pad: 16, pol: .86 }); },
    focusUser() { if (!me.on) return; const near = PR.filter(p => !state.hl || state.hl.has(p.id)).map(p => ({ p, d: Math.hypot(p.x - me.x, p.z - me.z) })).sort((a, b) => a.d - b.d).slice(0, 3).map(o => o.p); fitPoints([me, ...near], { pad: 14, pol: .8 }); },
    fit(ids) { fitPoints(ids.map(id => prBy[id]).filter(Boolean)); },
    hover(id) { PR.forEach(p => p.el.classList.toggle('hov', p.id === id)); },
    destroy() {
      cancelAnimationFrame(raf); visible = false; ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis); clearFlows();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.alphaMap && m.alphaMap.dispose(); m.dispose(); }); });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (_) {} root.remove();
    },
  };
}
