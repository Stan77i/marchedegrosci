// Marché de Gros CI — couche WebGL (mode « Voir le marché »).
// Module isolé, chargé à la demande après le contenu. La scène LIT l'état du site via le pont
// (window.MDGBridge) et ne modifie jamais les données. Aucun produit alimentaire n'est modélisé :
// les produits n'existent qu'à travers les photos fournies (v2/img), posées sur des ardoises.
const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
let T;

// Palette du site (brief 03/10/2026)
const P = { cacao: '#171512', brun: '#24201A', ivoire: '#F2EBDD', ivoireT: '#F5F0E6', sable: '#B9AD98', terre: '#B85C38', foret: '#31543C', recolte: '#D6A83E', ambre: '#E07A3F' };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t;
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

export async function boot(opts) { T = T || await import(THREE_URL); return createWorld(opts); }

function createWorld({ tier, reduced, data, onLost }) {
  const C = (a, b, t) => b ? new T.Color(a).lerp(new T.Color(b), t) : new T.Color(a);
  const canvas = document.createElement('canvas');
  canvas.className = 'world'; canvas.setAttribute('aria-hidden', 'true'); canvas.tabIndex = -1;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: tier >= 2, alpha: false, powerPreference: tier >= 2 ? 'high-performance' : 'low-power' }); }
  catch (e) { return null; }
  const isMobile = matchMedia('(max-width: 760px)').matches;
  let dprCap = tier >= 2 ? (isMobile ? 1.5 : 2) : 1.25;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = tier >= 2; renderer.shadowMap.type = T.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; onLost && onLost(); });

  const scene = new T.Scene();
  const HAZE = C(P.ivoire, P.recolte, .22).lerp(C(P.sable), .25);
  scene.background = HAZE.clone();
  scene.fog = new T.Fog(HAZE, 30, tier >= 2 ? 190 : 140);
  const camera = new T.PerspectiveCamera(34, 1, .3, 420);
  const uTime = { value: 0 };
  const R = rng(20261003);
  const rr = (a, b) => a + (b - a) * R();

  // ——— Lumière : fin d'après-midi à Abidjan ———
  const sunDir = new T.Vector3(-0.62, 0.42, 0.66).normalize();
  const hemi = new T.HemisphereLight(C(P.ivoireT, P.recolte, .15), C(P.terre, P.brun, .55), 1.35); scene.add(hemi);
  const sun = new T.DirectionalLight(C(P.recolte, P.ivoireT, .55), 3.3);
  sun.position.copy(sunDir).multiplyScalar(60); sun.target.position.set(0, 0, -3); scene.add(sun, sun.target);
  if (tier >= 2) { sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 10, far: 130 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = .03; }
  const fill = new T.DirectionalLight(C(P.sable, P.foret, .2), .35); fill.position.set(30, 18, -20); scene.add(fill);

  // ——— Ciel : brume de chaleur, soleil bas ———
  const sky = new T.Mesh(new T.SphereGeometry(400, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C(P.sable, P.brun, .28) }, hor: { value: HAZE.clone() }, sunc: { value: C(P.recolte, P.ivoireT, .4) }, sd: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top,hor,sunc,sd; varying vec3 vD; void main(){ float h = clamp(vD.y*2.2,0.,1.); vec3 c = mix(hor, top, pow(h,.8)); float s = max(dot(vD, sd),0.); c += sunc * (pow(s,28.)*.55 + pow(s,4.)*.12); gl_FragColor = vec4(c,1.); }'
  }));
  sky.renderOrder = -1; scene.add(sky);

  // ——— Utilitaires de géométrie ———
  function merge(list) {
    const pos = [], nor = [], col = [], uv = [];
    list.forEach(({ g, m, c }) => {
      const geo = (g.index ? g.toNonIndexed() : g.clone()); if (m) geo.applyMatrix4(m);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv; const cc = c ? new T.Color(c) : null;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); if (cc) { col.push(cc.r, cc.g, cc.b); } else if (geo.attributes.color) { const k = geo.attributes.color; col.push(k.getX(i), k.getY(i), k.getZ(i)); } else col.push(1, 1, 1); }
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  }
  const M4 = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  const std = (o = {}) => new T.MeshStandardMaterial(Object.assign({ roughness: .9, metalness: 0 }, o));
  const vcol = (o = {}) => std(Object.assign({ vertexColors: true }, o));
  const shadowy = (m, cast = true, rec = true) => { m.castShadow = cast && tier >= 2; m.receiveShadow = rec && tier >= 2; return m; };
  function wind(mat, amp = .06) { mat.onBeforeCompile = s => { s.uniforms.uTime = uTime; s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec3 ip = instanceMatrix[3].xyz;\n#else\n vec3 ip = vec3(0.);\n#endif\n float sw = sin(uTime*1.25 + ip.x*.35 + ip.z*.27) * ${amp.toFixed(3)} * max(position.y,0.);\n transformed.x += sw; transformed.z += sw*.45;`); }; return mat; }
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; }

  // ——— Sol : terre battue, routes, collines lointaines ———
  {
    const g = new T.PlaneGeometry(320, 320, tier >= 2 ? 96 : 60, tier >= 2 ? 96 : 60); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = [];
    const base = C(P.sable, P.terre, .32), dark = C(P.brun, P.sable, .45), grass = C(P.foret, P.sable, .35), dry = C(P.recolte, P.sable, .55);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
      const n = vnoise(x * .08, z * .08), n2 = vnoise(x * .5, z * .5);
      if (d > 34) p.setY(i, (vnoise(x * .02, z * .02) - .4) * clamp((d - 34) / 60, 0, 1) * 9);
      let c = base.clone().lerp(dark, n2 * .18);
      const veg = clamp((d - 18) / 16, 0, 1) * clamp(n * 1.6 - .25, 0, 1); c.lerp(grass, veg * .85); c.lerp(dry, clamp(n2 - .55, 0, 1) * .5 * clamp((d - 14) / 10, 0, 1));
      const road = Math.min(Math.abs(z - 7.5), d > 6 && z < 7.5 && Math.abs(x - (-6 - (7.5 - z) * .08)) < 2.2 ? 0 : 99);
      if (road < 2.3) c.lerp(dark, .55 * (1 - road / 2.3) + .15);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    scene.add(shadowy(new T.Mesh(g, vcol({ roughness: 1 })), false, true));
  }
  // Lagune (sud-est) et ligne de ville en silhouette
  {
    const lag = new T.Mesh(new T.CircleGeometry(1, 48), std({ color: C(P.brun, P.foret, .35).lerp(C(P.sable), .25), roughness: .18, metalness: .35 }));
    lag.rotation.x = -Math.PI / 2; lag.scale.set(120, 46, 1); lag.position.set(120, .12, 34); scene.add(lag);
    const city = []; const r = rng(7);
    for (let i = 0; i < 46; i++) { const h = 3 + r() * r() * 26, w = 3 + r() * 6; city.push({ g: new T.BoxGeometry(w, h, 3 + r() * 5), m: M4(70 + r() * 70, h / 2, -26 + r() * 22, r() * .4), c: C(P.sable, P.brun, .35 + r() * .2) }); }
    scene.add(new T.Mesh(merge(city), vcol({ roughness: 1 })));
  }

  // ——— Matériaux du marché ———
  const woodTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#9b8a72'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(36,32,26,${.12 + Math.random() * .15})`; x.fillRect(0, i * 16 + 13, w, 3); } for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(36,32,26,${Math.random() * .08})`; x.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 1); } });
  const jute = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#c9b892'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { x.fillStyle = 'rgba(36,32,26,.13)'; x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); } });
  const waxTex = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#efe6d4'; x.fillRect(0, 0, w, h); x.fillStyle = '#7d6c55'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 16 + 8, j * 16 + 8, 5, 0, 7); x.fill(); } x.fillStyle = '#b9ad98'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 16 + 15, w, 2); });
  waxTex.repeat.set(2, 2);

  // ——— Hangars à toit de tôle ———
  const ROOFS = [
    { x: -6.5, z: -4, w: 9, d: 5.2, h: 3.2, c: C(P.terre, P.sable, .25), r: .05 },
    { x: 4.8, z: -4.8, w: 8.4, d: 5, h: 3.1, c: C(P.sable, P.brun, .25), r: -.04 },
    { x: -1, z: -12.5, w: 13, d: 6, h: 3.6, c: C(P.foret, P.sable, .38), r: .02 },
  ];
  const posts = [], roofs = [];
  ROOFS.forEach(o => {
    const g = new T.PlaneGeometry(o.w, o.d, Math.round(o.w * 6), 2); const p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 13) * .035); const rust = clamp(vnoise(x * .6 + o.x, y * .9) * 1.4 - .55, 0, 1); const c = o.c.clone().lerp(C(P.terre, P.brun, .4), rust * .7); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    roofs.push({ g, m: M4(o.x, o.h, o.z, o.r, 1, 1, 1, -Math.PI / 2 + .12) });
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([a, b]) => posts.push({ g: new T.CylinderGeometry(.06, .07, o.h - (b > 0 ? .3 : -.3), 6), m: M4(o.x + a * (o.w / 2 - .25), (o.h - (b > 0 ? .3 : -.3)) / 2, o.z + b * (o.d / 2 - .25), 0), c: C(P.brun, P.sable, .3) }));
  });
  scene.add(shadowy(new T.Mesh(merge(roofs), vcol({ roughness: .55, metalness: .45, side: T.DoubleSide }))));
  // muret du fond, poteaux, étals (tables) — statiques, fusionnés
  const statics = [...posts];
  for (let i = 0; i < 9; i++) statics.push({ g: new T.BoxGeometry(4.2, .9 + (i % 3) * .1, .25), m: M4(-17 + i * 4.3, .45, -17.5, 0), c: C(P.sable, P.ivoire, .35 + (i % 2) * .15) });
  [[-9, -2.6], [-6.4, -2.6], [-3.8, -2.6], [2.4, -3.4], [5, -3.4], [7.6, -3.4], [-5, -11.2], [-1, -11.2], [3, -11.2]].forEach(([x, z], i) => {
    statics.push({ g: new T.BoxGeometry(2.1, .08, .95), m: M4(x, .82, z, 0), c: C(P.brun, P.sable, .5) });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => statics.push({ g: new T.BoxGeometry(.07, .8, .07), m: M4(x + a * .95, .4, z + b * .4, 0), c: C(P.brun, P.sable, .35) }));
  });
  scene.add(shadowy(new T.Mesh(merge(statics), vcol())));

  // ——— Contenants (jamais de produit visible) ———
  const sackGeo = (() => { const pts = [[0, 0], [.2, 0], [.27, .05], [.31, .18], [.3, .4], [.25, .55], [.13, .63], [.06, .65], [.08, .7], [.03, .73], [0, .73]].map(([r, y]) => new T.Vector2(r, y)); const g = new T.LatheGeometry(pts, tier >= 2 ? 12 : 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (vnoise(x * 6 + 3, z * 6 + y * 4) - .5) * .16; p.setX(i, x * k); p.setZ(i, z * k * .82); } g.computeVertexNormals(); return g; })();
  const sackMat = std({ map: jute, roughness: .95 });
  const SACKS = []; // {x,y,z,ry,s,sy,tilt,c}
  const addSack = (x, y, z, o = {}) => SACKS.push(Object.assign({ x, y, z, ry: rr(0, 6.28), s: rr(.9, 1.1), sy: rr(.85, 1.05), tilt: rr(-.12, .12), c: C(P.ivoire, P.sable, rr(.1, .6)) }, o));
  function pyramid(cx, cz, rows, ry0 = 0) { let y = .14; for (let r = rows; r > 0; r--) { for (let i = 0; i < r; i++) addSack(cx + (i - (r - 1) / 2) * .58 * Math.cos(ry0) + rr(-.05, .05), y, cz + (i - (r - 1) / 2) * .58 * Math.sin(ry0) + rr(-.05, .05), { ry: ry0 + Math.PI / 2 + rr(-.3, .3), tilt: rr(-.08, .08) }); y += .5; } }
  pyramid(-12.8, -.4, 4, .2); pyramid(-15.6, 1.8, 3, -.5); pyramid(8.6, -.6, 3, .1); pyramid(-1.6, -15.6, 4, 0);
  for (let i = 0; i < 9; i++) addSack(-14 + rr(-3, 3), 0, -8 + rr(-2, 2), { tilt: rr(-.35, .35), sy: rr(.7, .95) });
  // pile qui grandit au déchargement
  const PILE = []; for (let k = 0; k < 24; k++) { const row = Math.floor(k / 6), i = k % 6; PILE.push({ x: 1.2 + (i % 3) * .62 + rr(-.04, .04) + (row % 2) * .3, y: .39 + row * .44, z: 2.6 + Math.floor(i / 3) * .6, ry: Math.PI / 2 + rr(-.25, .25), s: rr(.95, 1.05), sy: .8, tilt: Math.PI / 2 * 0 + rr(-.06, .06), lying: true, c: C(P.ivoire, P.sable, rr(.15, .55)) }); }
  const PILE_BASE = 6;
  const sackIM = shadowy(new T.InstancedMesh(sackGeo, sackMat, SACKS.length + PILE.length + 6));
  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpV = new T.Vector3(), tmpS = new T.Vector3();
  function setSack(i, o, visible = true) {
    if (!visible) { tmpM.makeScale(0, 0, 0); sackIM.setMatrixAt(i, tmpM); return; }
    tmpE.set(o.lying ? Math.PI / 2 : o.tilt, o.ry, o.lying ? o.tilt : 0); tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpV.set(o.x, o.y, o.z), tmpQ, tmpS.set(o.s, o.sy * o.s, o.s)); sackIM.setMatrixAt(i, tmpM); sackIM.setColorAt(i, o.c);
  }
  SACKS.forEach((o, i) => setSack(i, o));
  let pileN = PILE_BASE; const pileStart = SACKS.length;
  function refreshPile() { PILE.forEach((o, k) => setSack(pileStart + k, o, k < pileN)); sackIM.instanceMatrix.needsUpdate = true; if (sackIM.instanceColor) sackIM.instanceColor.needsUpdate = true; }
  const carryStart = pileStart + PILE.length; for (let k = 0; k < 6; k++) { setSack(carryStart + k, null, false); sackIM.setColorAt(carryStart + k, C(P.ivoire, P.sable, .3)); }
  refreshPile(); scene.add(sackIM);

  const crates = [], pallets = [], bassines = [], cloths = [];
  for (let i = 0; i < 14; i++) { const x = rr(-11, 10), z = rr(-14, -1); if (Math.abs(z + 3) < 1 && Math.abs(x) < 10) continue; const st = R() < .4 ? 2 : 1; for (let k = 0; k < st; k++) crates.push(M4(x, .2 + k * .36, z, rr(-.3, .3) + k * .2, 1, 1, 1)); }
  [[-9, -2.6], [-6.4, -2.6], [2.4, -3.4], [7.6, -3.4], [-5, -11.2], [3, -11.2]].forEach(([x, z]) => { crates.push(M4(x + rr(-.6, .6), 1.04, z + rr(-.15, .15), rr(-.4, .4), .8, .8, .8)); });
  [[1.8, 2.9], [-12.8, -.4], [-15.6, 1.8], [8.6, -.6], [-1.6, -15.6]].forEach(([x, z]) => pallets.push(M4(x + .3, .07, z, rr(-.1, .1), 1.35, 1, 1.15)));
  [[-10, 4.2], [-4.6, 5.2], [7, 3.6], [10.4, 4.6], [-7.8, -2.4], [5.6, -3.2], [-2.6, -11], [.6, -11.3]].forEach(([x, z], i) => { const y = Math.abs(z) > 5 && Math.abs(z) < 12 || (z < 0 && z > -4) ? .86 : .02; bassines.push(M4(x, y, z, 0)); cloths.push({ m: M4(x, y + .19, z, rr(0, 6)), c: [P.terre, P.recolte, P.foret, P.ivoire, P.sable][i % 5] }); });
  const crateIM = shadowy(new T.InstancedMesh(new T.BoxGeometry(.62, .36, .42), std({ map: woodTex, color: C(P.sable, P.terre, .2) }), crates.length)); crates.forEach((m, i) => crateIM.setMatrixAt(i, m)); scene.add(crateIM);
  const palIM = shadowy(new T.InstancedMesh(new T.BoxGeometry(1.2, .13, 1), std({ map: woodTex, color: C(P.sable, P.brun, .25) }), pallets.length)); pallets.forEach((m, i) => palIM.setMatrixAt(i, m)); scene.add(palIM);
  const basIM = shadowy(new T.InstancedMesh(new T.CylinderGeometry(.34, .24, .19, 18, 1, true), std({ color: C(P.sable, P.ivoire, .3), metalness: .55, roughness: .4, side: T.DoubleSide }), bassines.length)); bassines.forEach((m, i) => basIM.setMatrixAt(i, tmpM.copy(m).multiply(M4(0, .095, 0)))); scene.add(basIM);
  const clothGeo = (() => { const g = new T.CircleGeometry(.4, 14); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z); p.setY(i, d > .3 ? -(d - .3) * 1.2 + Math.sin(Math.atan2(z, x) * 5) * .02 : .02 - d * .05); } g.computeVertexNormals(); return g; })();
  const clothIM = shadowy(new T.InstancedMesh(clothGeo, std({ map: waxTex, side: T.DoubleSide }), cloths.length)); cloths.forEach((o, i) => { clothIM.setMatrixAt(i, o.m); clothIM.setColorAt(i, C(o.c, P.ivoire, .25)); }); scene.add(clothIM);
  // bâches froissées sur deux tas
  const tarpGeo = (w, d, s) => { const g = new T.PlaneGeometry(w, d, 14, 10); g.rotateX(-Math.PI / 2); const p = g.attributes.position, r = rng(s); for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2); const dome = Math.max(0, 1 - (x * x + z * z) * .8); p.setY(i, dome * 1.1 + (r() - .5) * .06 + (vnoise(x * 3 + s, z * 3) - .5) * .18); } g.computeVertexNormals(); return g; };
  const tarp1 = shadowy(new T.Mesh(tarpGeo(3, 2.4, 3), std({ color: C(P.foret, P.sable, .3), roughness: .6, side: T.DoubleSide }))); tarp1.position.set(-14.3, 0, -8); scene.add(tarp1);
  const tarp2 = shadowy(new T.Mesh(tarpGeo(2.6, 2, 9), std({ color: C(P.sable, P.brun, .2), roughness: .7, side: T.DoubleSide }))); tarp2.position.set(10.2, 0, -10); tarp2.rotation.y = .4; scene.add(tarp2);
  // parasols
  const PARA = [[-10, 4.2, P.terre], [-4.6, 5.2, P.recolte], [7, 3.6, P.foret], [10.4, 4.6, P.ivoire]];
  const paraIM = shadowy(new T.InstancedMesh(new T.ConeGeometry(1.35, .5, 10, 1, true), std({ side: T.DoubleSide, roughness: .8 }), PARA.length));
  const poleIM = shadowy(new T.InstancedMesh(new T.CylinderGeometry(.025, .03, 2.3, 5), std({ color: C(P.brun, P.sable, .4) }), PARA.length));
  PARA.forEach(([x, z, c], i) => { paraIM.setMatrixAt(i, M4(x, 2.35, z, i, 1, 1, 1, rr(-.06, .06))); paraIM.setColorAt(i, C(c, P.ivoire, .15)); poleIM.setMatrixAt(i, M4(x, 1.15, z)); });
  scene.add(paraIM, poleIM);
  // tabourets
  const stoolIM = shadowy(new T.InstancedMesh(new T.CylinderGeometry(.18, .2, .42, 8), std({ map: woodTex, color: C(P.terre, P.sable, .4) }), 3));
  [[6.4, .9], [-10.6, 3.4], [-15.2, 3.4]].forEach(([x, z], i) => stoolIM.setMatrixAt(i, M4(x, .21, z))); scene.add(stoolIM);

  // ——— Ardoises avec les photos fournies ———
  const loader = new T.TextureLoader();
  const STALLS = [[-9, -2.6], [-6.4, -2.6], [-3.8, -2.6], [2.4, -3.4], [5, -3.4], [7.6, -3.4], [-5, -11.2], [-1, -11.2], [3, -11.2]];
  const boards = [], stallBy = {};
  const boardIM = shadowy(new T.InstancedMesh(merge([{ g: new T.BoxGeometry(.78, .92, .05), m: M4(0, .46, 0), c: C(P.cacao, P.brun, .5) }, { g: new T.PlaneGeometry(.66, .66), m: M4(0, .5, .03), c: C(P.ivoireT) }]), vcol({ roughness: .9 }), STALLS.length)); boardIM.count = 0; scene.add(boardIM);
  (data.products || []).slice(0, STALLS.length).forEach((p, i) => {
    const [x, z] = STALLS[i]; const g = new T.Group(); g.position.set(x + .55, .86, z + .32); g.rotation.set(-.22, rr(-.15, .15), 0);
    g.updateMatrix(); boardIM.setMatrixAt(boardIM.count++, g.matrix);
    const mat = std({ transparent: true, alphaTest: .35, roughness: .9, emissive: new T.Color('#ffffff'), emissiveIntensity: 0 });
    const ph = new T.Mesh(new T.PlaneGeometry(.6, .6), mat); ph.position.set(0, .5, .034); g.add(ph);
    loader.load(p.img, t => { t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true; kick(); });
    scene.add(g); const s = { slug: p.slug, cat: p.categorySlug, x, z, g, mat }; boards.push(s); stallBy[p.slug] = s;
  });
  // pool de lumière posée sur l'étal ciblé (décal additive, pas de lumière en plus)
  const poolTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(245,240,230,.9)'); g.addColorStop(1, 'rgba(245,240,230,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const pool = new T.Mesh(new T.PlaneGeometry(4.2, 3), new T.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, color: C(P.recolte, P.ivoireT, .5) }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = .03; scene.add(pool);

  // ——— Végétation : palmiers, manguiers, fromager, herbes ———
  const PALMS = [[-14, -6], [-19, 6], [14, -2], [16.5, 8], [12, -17], [-21, -14], [-25, 1], [22, -4], [-23, 17], [26, 10], [-30, -22], [30, -26]];
  const trunk = [], fronds = [];
  const frondGeo = (() => { const g = new T.PlaneGeometry(.55, 2.6, 1, 6); g.translate(0, 1.3, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -(y * y) * .12); p.setX(i, p.getX(i) * (1 - y / 3)); } g.rotateX(Math.PI / 2 - .5); g.computeVertexNormals(); return g; })();
  PALMS.forEach(([x, z], i) => {
    const h = rr(6, 9.5), lean = rr(-.15, .15); for (let k = 0; k < 6; k++) trunk.push({ g: new T.CylinderGeometry(.16 - k * .012, .19 - k * .012, h / 6, 7), m: M4(x + Math.sin(lean) * k * h / 6 * .6, h / 12 + k * h / 6, z, 0, 1, 1, 1, 0, lean * .6), c: C(P.sable, P.brun, .35 + k * .03) });
    const tx = x + Math.sin(lean) * h * .6, n = 9; for (let k = 0; k < n; k++) fronds.push(M4(tx, h, z, k / n * 6.283 + rr(-.2, .2), 1, 1, rr(.8, 1.15), rr(-.1, .25)));
  });
  scene.add(shadowy(new T.Mesh(merge(trunk), vcol())));
  const frondIM = shadowy(new T.InstancedMesh(frondGeo, wind(std({ color: C(P.foret, P.recolte, .18), side: T.DoubleSide, roughness: .8 }), .05), fronds.length)); fronds.forEach((m, i) => { frondIM.setMatrixAt(i, m); frondIM.setColorAt(i, C(P.foret, P.recolte, rr(.05, .3))); }); scene.add(frondIM);
  const TREES = [[-27, 15, 1], [18, -10, 1.6], [-24, -6, 1.1], [21, 14, 1], [-34, 8, 1.3], [36, -14, 1.2], [-6, -24, 1.4], [8, -26, 1.2]];
  const canopy = [], tTrunks = [];
  TREES.forEach(([x, z, s], i) => { const big = i === 1; tTrunks.push({ g: new T.CylinderGeometry(.25 * s, .4 * s, (big ? 9 : 3.2) * s, 7), m: M4(x, (big ? 4.5 : 1.6) * s, z), c: C(P.sable, P.brun, .5) }); const n = big ? 5 : 6; for (let k = 0; k < n; k++) canopy.push(M4(x + rr(-1.4, 1.4) * s, (big ? 8.4 + k * .35 : 3.5 + rr(0, 1.4)) * s, z + rr(-1.4, 1.4) * s, rr(0, 6), (big ? 3.2 : 1.9) * s, (big ? .7 : 1.4) * s * rr(.8, 1.1), (big ? 3.2 : 1.9) * s)); });
  scene.add(shadowy(new T.Mesh(merge(tTrunks), vcol())));
  const canIM = shadowy(new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), wind(std({ color: C(P.foret, P.recolte, .22), roughness: .95, flatShading: true, emissive: C(P.foret, P.cacao, .3), emissiveIntensity: .35 }), .015), canopy.length)); canopy.forEach((m, i) => { canIM.setMatrixAt(i, m); canIM.setColorAt(i, C(P.foret, P.recolte, rr(.1, .4))); }); scene.add(canIM);
  if (tier >= 2) {
    const blades = []; for (let i = 0; i < 900; i++) { const a = R() * 6.283, d = rr(13, 34); const x = Math.cos(a) * d, z = Math.sin(a) * d * .8 - 2; if (Math.abs(z - 7.5) < 3) continue; blades.push(M4(x, 0, z, rr(0, 6), rr(.6, 1.2), rr(.5, 1.3), 1, rr(-.2, .2))); }
    const bg = new T.ConeGeometry(.05, .8, 3); bg.translate(0, .4, 0);
    const grIM = new T.InstancedMesh(bg, wind(std({ color: C(P.recolte, P.foret, .45), roughness: 1 }), .12), blades.length); blades.forEach((m, i) => { grIM.setMatrixAt(i, m); grIM.setColorAt(i, C(P.recolte, P.foret, rr(.25, .75))); }); scene.add(grIM);
  }

  // ——— Zones de production (positions = données des producteurs, même direction que la carte) ———
  const ABJ = { lat: 5.36, lon: -4.01 };
  const zones = (data.zones || []).filter(z => z.slug !== 'abidjan');
  const maxD = Math.max(1, ...zones.map(z => Math.hypot(z.lon - ABJ.lon, z.lat - ABJ.lat)));
  const zoneBy = {}; const fields = [], huts = [];
  zones.forEach((zn, i) => {
    const dx = zn.lon - ABJ.lon, dz = -(zn.lat - ABJ.lat); const d = Math.hypot(dx, dz); const k = (30 + 50 * d / maxD) / Math.max(d, 1e-3);
    const x = dx * k, z = Math.min(dz * k, -14) - 6; zoneBy[zn.slug] = { x, z, name: zn.name };
    for (let f = 0; f < 6; f++) fields.push({ g: new T.PlaneGeometry(rr(4, 9), rr(3, 7)), m: M4(x + rr(-7, 7), .06 + f * .004, z + rr(-5, 5), rr(0, 3), 1, 1, 1, -Math.PI / 2), c: C(f % 2 ? P.foret : P.recolte, P.sable, rr(.2, .5)) });
    huts.push({ g: new T.BoxGeometry(2.2, 1.6, 1.8), m: M4(x + 2, .8, z + 1, rr(0, 3)), c: C(P.ivoire, P.sable, .4) }, { g: new T.ConeGeometry(1.8, 1.1, 4), m: M4(x + 2, 2.15, z + 1, Math.PI / 4), c: C(P.terre, P.brun, .3) });
  });
  if (fields.length) { scene.add(new T.Mesh(merge(fields), vcol({ roughness: 1 }))); scene.add(new T.Mesh(merge(huts), vcol())); }
  // pistes vers les zones
  const tracks = []; Object.values(zoneBy).forEach(zn => { const len = Math.hypot(zn.x, zn.z + 2), a = Math.atan2(zn.x, -(zn.z + 2)); tracks.push({ g: new T.PlaneGeometry(1.4, len), m: M4(zn.x / 2, .05, (zn.z - 2) / 2, -a, 1, 1, 1, -Math.PI / 2), c: C(P.brun, P.sable, .5) }); });
  tracks.push({ g: new T.PlaneGeometry(4, 160), m: M4(-10, .05, -78, .08, 1, 1, 1, -Math.PI / 2), c: C(P.brun, P.sable, .5) });
  scene.add(new T.Mesh(merge(tracks), vcol({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })));

  // ——— Personnes : corps articulés, parties instanciées (squelette partagé) ———
  const BATCH = {};
  function batch(name, geo, mat) { BATCH[name] = { geo, mat, items: [] }; }
  const cap = (r, l, drop = true) => { const g = new T.CapsuleGeometry(r, l, 3, 8); if (drop) g.translate(0, -(l / 2 + r) + r * .6, 0); return g; };
  const skinMat = std({ roughness: .75 }), clothMat = std({ roughness: .92 });
  batch('head', new T.SphereGeometry(.105, tier >= 2 ? 12 : 9, tier >= 2 ? 10 : 7), skinMat);
  batch('torso', (() => { const g = new T.CapsuleGeometry(.16, .3, 3, 10); g.translate(0, .3, 0); g.scale(1, 1, .72); return g; })(), clothMat);
  batch('pelvis', (() => { const g = new T.CylinderGeometry(.15, .155, .2, 10); g.translate(0, -.04, 0); g.scale(1, 1, .75); return g; })(), clothMat);
  batch('pagne', (() => { const g = new T.CylinderGeometry(.16, .23, .74, 12, 1, true); g.translate(0, -.36, 0); g.scale(1, 1, .8); return g; })(), std({ map: waxTex, roughness: .9, side: T.DoubleSide }));
  batch('upper', cap(.046, .22), clothMat);
  batch('fore', merge([{ g: cap(.04, .2) }, { g: new T.SphereGeometry(.045, 6, 5), m: M4(0, -.3, 0) }]), skinMat);
  batch('thigh', cap(.066, .32), clothMat);
  batch('shin', merge([{ g: cap(.052, .32) }, { g: new T.BoxGeometry(.09, .06, .22), m: M4(0, -.42, .05) }]), clothMat);
  batch('wrap', (() => { const g = new T.SphereGeometry(.13, 10, 8); g.scale(1.05, .8, 1.05); g.translate(0, .08, -.01); return g; })(), std({ map: waxTex, roughness: .9 }));
  batch('capH', merge([{ g: new T.SphereGeometry(.11, 10, 6, 0, 6.29, 0, 1.5), m: M4(0, .03, 0) }, { g: new T.BoxGeometry(.16, .015, .14), m: M4(0, .035, .12) }]), clothMat);
  batch('hat', merge([{ g: new T.CylinderGeometry(.24, .24, .015, 16), m: M4(0, .06, 0) }, { g: new T.CylinderGeometry(.1, .12, .12, 12), m: M4(0, .12, 0) }]), std({ color: C(P.recolte, P.sable, .4), roughness: 1 }));
  batch('basH', (() => { const g = new T.CylinderGeometry(.3, .2, .17, 16, 1, true); g.translate(0, .21, 0); return g; })(), std({ color: C(P.sable, P.ivoire, .3), metalness: .55, roughness: .4, side: T.DoubleSide }));
  batch('basCloth', (() => { const g = clothGeo.clone(); g.scale(.82, 1, .82); g.translate(0, .29, 0); return g; })(), std({ map: waxTex, side: T.DoubleSide }));
  batch('vest', (() => { const g = new T.CapsuleGeometry(.175, .26, 3, 10, ); g.translate(0, .32, 0); g.scale(1, 1, .76); return g; })(), std({ color: C(P.foret, P.ivoire, .08), roughness: .7 }));
  batch('phone', new T.BoxGeometry(.04, .075, .008), std({ color: C(P.cacao), roughness: .3, metalness: .2 }));
  const SKIN = ['#3b271b', '#4a3122', '#5a3a26', '#6b4630', '#7a5236', '#3f2a1e', '#553624'].map(c => new T.Color(c));
  const TOPS = [P.ivoire, P.terre, P.foret, P.recolte, P.sable, P.brun, P.ivoireT].map(c => new T.Color(c));
  const WAX = [P.terre, P.recolte, P.foret, P.ivoire, P.sable].map(c => C(c, P.ivoire, .1));
  const PANTS = [P.brun, P.sable, P.cacao, P.foret].map(c => C(c, P.sable, .15));
  const people = [];
  function person(o) {
    const r = rng(o.seed || people.length * 97 + 13);
    const pick = a => a[Math.floor(r() * a.length)];
    const female = o.female ?? r() < .5, height = o.height ?? (female ? 1.55 + r() * .17 : 1.64 + r() * .2), girth = .88 + r() * .32;
    const root = new T.Object3D(); root.position.set(o.x, 0, o.z); root.rotation.y = o.ry || 0; root.scale.setScalar(height / 1.7);
    const hips = new T.Object3D(); hips.position.y = .9; root.add(hips);
    const torso = new T.Object3D(); hips.add(torso);
    const neck = new T.Object3D(); neck.position.y = .66; torso.add(neck);
    const head = new T.Object3D(); head.position.y = .1; neck.add(head);
    const mk = (par, x, y) => { const n = new T.Object3D(); n.position.set(x, y, 0); par.add(n); return n; };
    const shL = mk(torso, .2 * girth, .57), shR = mk(torso, -.2 * girth, .57), elL = mk(shL, 0, -.29), elR = mk(shR, 0, -.29);
    const hipL = mk(hips, .085, -.02), hipR = mk(hips, -.085, -.02), knL = mk(hipL, 0, -.42), knR = mk(hipR, 0, -.42);
    const handR = mk(elR, 0, -.3); const carry = mk(torso, -.1, .7);
    const skin = pick(SKIN).clone().offsetHSL(0, 0, (r() - .5) * .04), top = (o.top ? new T.Color(o.top) : pick(TOPS)).clone().lerp(new T.Color(P.sable), r() * .2), low = pick(PANTS), wax = pick(WAX);
    const parts = []; const add = (b, node, color, m) => { const it = { node, color, off: m || null, idx: BATCH[b].items.length }; BATCH[b].items.push(it); parts.push(it); return it; };
    const G = new T.Matrix4().makeScale(girth, 1, girth * (female ? .95 : 1));
    const isPagne = o.pagne ?? (female && r() < .8);
    add('head', head, skin); add('torso', torso, top, G); add(isPagne ? 'pagne' : 'pelvis', hips, isPagne ? wax : low, G);
    add('upper', shL, r() < .5 ? top : skin); add('upper', shR, parts[parts.length - 1].color); add('fore', elL, skin); add('fore', elR, skin);
    const leg = isPagne ? skin : low;
    add('thigh', hipL, leg); add('thigh', hipR, leg); add('shin', knL, leg); add('shin', knR, isPagne ? skin : low);
    const hw = o.head || (female ? (r() < .6 ? 'wrap' : null) : (r() < .35 ? 'capH' : r() < .2 ? 'hat' : null));
    if (hw) add(hw, head, hw === 'wrap' ? wax.clone().lerp(new T.Color(P.terre), .3) : pick(TOPS));
    if (o.bassine) { add('basH', head, new T.Color('#fff')); add('basCloth', head, wax.clone().lerp(new T.Color(P.recolte), .3)); }
    if (o.vest) add('vest', torso, new T.Color('#fff'), G);
    const phone = o.phone ? add('phone', handR, new T.Color('#fff'), M4(0, -.04, .05)) : null;
    const p = { root, hips, torso, neck, head, shL, shR, elL, elR, hipL, hipR, knL, knR, handR, carry, parts, r, female, phone, seed: r() * 100, phase: r() * 6, look: null, pose: 'idle', speed: 0, tasks: o.tasks || [], loop: o.loop !== false, ti: 0, tt: 0, carrying: -1, talk: 0, phoneUp: 0, photo: 0, sit: o.sit || 0, bend: 0, armUp: o.bassine ? 1 : 0, name: o.name, blob: true, hidden: false, lookAt: null, breathe: .8 + r() * .5 };
    people.push(p); return p;
  }

  // ——— Véhicules ———
  function wheel(x, z) { const g = new T.CylinderGeometry(.36, .36, .24, 12); g.rotateZ(Math.PI / 2); return { g, m: M4(x, .36, z), c: C(P.cacao, P.brun, .3) }; }
  function bachee() { // pick-up bâché, sans marque
    const g = new T.Group();
    const body = merge([
      { g: new T.BoxGeometry(1.85, .55, 4.8), m: M4(0, .78, 0), c: C(P.ivoire, P.sable, .35) },
      { g: new T.BoxGeometry(1.8, .75, 1.7), m: M4(0, 1.4, 1.35), c: C(P.ivoire, P.sable, .3) },
      { g: new T.BoxGeometry(1.82, .42, 1.2), m: M4(0, 1.5, 1.5), c: C(P.cacao, P.brun, .4) },
      { g: new T.BoxGeometry(1.86, .3, .2), m: M4(0, .6, 2.42), c: C(P.brun, P.sable, .3) },
      wheel(-.92, 1.55), wheel(.92, 1.55), wheel(-.92, -1.5), wheel(.92, -1.5),
    ]);
    g.add(shadowy(new T.Mesh(body, vcol({ roughness: .55, metalness: .25 }))));
    const tg = new T.CylinderGeometry(.95, .95, 2.9, 14, 1, true, 0, Math.PI); tg.rotateZ(Math.PI / 2); tg.rotateY(Math.PI / 2);
    const tarp = shadowy(new T.Mesh(tg, std({ color: C(P.foret, P.sable, .25), roughness: .75, side: T.DoubleSide }))); tarp.position.set(0, 1.05, -.9); tarp.scale.set(1, .85, 1); g.add(tarp);
    return g;
  }
  function camion() {
    const g = new T.Group();
    g.add(shadowy(new T.Mesh(merge([
      { g: new T.BoxGeometry(2.3, 1.7, 1.9), m: M4(0, 1.6, 3), c: C(P.foret, P.sable, .45) },
      { g: new T.BoxGeometry(2.32, .5, 1.1), m: M4(0, 1.95, 3.4), c: C(P.cacao, P.brun, .4) },
      { g: new T.BoxGeometry(2.5, 2.4, 5.2), m: M4(0, 2.05, -.8), c: C(P.sable, P.brun, .3) },
      { g: new T.BoxGeometry(2.4, .3, 7.4), m: M4(0, .75, .2), c: C(P.cacao, P.brun, .3) },
      wheel(-1.1, 3), wheel(1.1, 3), wheel(-1.1, -1.8), wheel(1.1, -1.8), wheel(-1.1, -2.7), wheel(1.1, -2.7),
    ]), vcol({ roughness: .7, metalness: .15 }))));
    return g;
  }
  function tricycle() {
    const g = new T.Group();
    g.add(shadowy(new T.Mesh(merge([
      { g: new T.BoxGeometry(1.4, .5, 1.6), m: M4(0, .75, -.6), c: C(P.terre, P.sable, .35) },
      { g: new T.BoxGeometry(.5, .5, .9), m: M4(0, .85, .8), c: C(P.terre, P.brun, .2) },
      { g: new T.BoxGeometry(1.1, .9, 1), m: M4(0, 1.45, -.6), c: C(P.ivoire, P.sable, .5) },
      wheel(-.6, -.9), wheel(.6, -.9), wheel(0, 1.2),
    ]), vcol({ roughness: .6, metalness: .2 }))));
    return g;
  }
  const truck = bachee(); truck.rotation.y = Math.PI / 2; scene.add(truck);
  const lorry = camion(); lorry.position.set(13.5, 0, -6.5); lorry.rotation.y = -.25; scene.add(lorry);
  const trike = tricycle(); scene.add(trike);

  // ——— Population et comportements ———
  // chaîne logistique : la bâchée arrive, s'arrête, deux manutentionnaires déchargent, la commerçante vérifie, elle repart
  const TR = { state: 'away', t: 2, x: -80, stopX: .6, z: 7.6, left: 0 };
  const W = (x, z, sp = 1) => ({ type: 'walk', x, z, sp });
  const I = (d, look, extra) => Object.assign({ type: 'idle', d, look }, extra || {});
  const commer = person({ x: 3.2, z: 4.4, ry: Math.PI, female: true, top: P.terre, name: 'commerçante', tasks: [I(3, () => handlerA.root.position), { type: 'check', d: 2.4 }], loop: true });
  const handlerA = person({ x: .2, z: 4.6, female: false, top: P.sable, name: 'manutentionnaire A', tasks: [] });
  const handlerB = person({ x: 1.4, z: 5.1, female: false, top: P.brun, head: 'capH', name: 'manutentionnaire B', tasks: [] });
  [handlerA, handlerB].forEach((h, k) => { h.tasks = [{ type: 'until', fn: () => TR.state === 'stopped' && TR.left > 0, idle: true, look: () => k ? handlerA.head.getWorldPosition(new T.Vector3()) : truck.position }, W(TR.stopX - 1.1 + k * 1.3, 6.2, 1.1), { type: 'pick', d: .9, look: () => truck.position }, { type: 'take' }, W(1.6 + k * .6, 3.7, .85), { type: 'drop', d: .7 }, { type: 'stack' }]; });
  const driver = person({ x: TR.stopX + 1.2, z: 6.5, female: false, top: P.ivoire, head: 'hat', name: 'chauffeur', tasks: [{ type: 'until', fn: () => TR.state === 'stopped', idle: true }, { type: 'show' }, I(2.5, () => commer.head.getWorldPosition(new T.Vector3()), { talk: 1 }), { type: 'until', fn: () => TR.state === 'stopped' && TR.left <= 0, idle: true, look: () => handlerA.root.position }, { type: 'hide' }, { type: 'until', fn: () => TR.state !== 'stopped', idle: true }] });
  driver.hidden = true;
  // acheteur : inspecte un étal, discute, sort son téléphone, passe à un autre étal
  const vendors = [person({ x: -6.6, z: -3.6, ry: 0, female: true, name: 'vendeuse 1', tasks: [I(4, null), { type: 'idle', d: 3, lookTarget: 'buyer' }] }), person({ x: 4.8, z: -4.4, ry: 0, female: true, name: 'vendeuse 2', tasks: [I(5, null), I(3, null, { talk: .6 })] }), person({ x: -1.2, z: -12.2, ry: 0, female: false, name: 'vendeur 3', tasks: [I(6, null)] })];
  const buyer = person({ x: -2, z: 1.5, female: false, top: P.foret, phone: true, name: 'acheteur', tasks: [W(-6.2, -1.6, .8), I(2.6, () => stallLook(1), { bend: .5 }), I(2.2, () => vendors[0].head.getWorldPosition(new T.Vector3()), { talk: 1 }), { type: 'phone', d: 3.2 }, W(-1.5, 1.2, .8), W(4.6, -2.3, .8), I(2.8, () => stallLook(4), { bend: .45 }), I(2.4, () => vendors[1].head.getWorldPosition(new T.Vector3()), { talk: 1 }), W(1, 1.8, .9), I(3, null)] });
  vendors[0].tasks[1].lookTarget = buyer;
  // agent terrain : photographie la récolte d'un producteur (c'est ainsi que l'offre arrive sur le site)
  const producer = person({ x: -13.6, z: 1.6, ry: -.9, female: false, top: P.recolte, head: 'hat', name: 'producteur', tasks: [I(4, () => agent.head.getWorldPosition(new T.Vector3()), { talk: .7 }), I(3, () => new T.Vector3(-12.8, .6, -.4))] });
  const agent = person({ x: -11.6, z: 2.6, ry: -2.2, female: true, vest: true, phone: true, head: 'wrap', name: 'agent terrain', tasks: [I(2, () => new T.Vector3(-12.8, .6, -.4)), { type: 'photo', d: 3.4, look: () => new T.Vector3(-12.8, .6, -.4) }, I(3, () => producer.head.getWorldPosition(new T.Vector3()), { talk: 1 }), { type: 'photo', d: 2.4, look: () => new T.Vector3(-15.6, .5, 1.8) }, I(2.5, () => producer.head.getWorldPosition(new T.Vector3()))] });
  // petit groupe qui discute, une personne assise, une porteuse de bassine, des passants
  const g1 = person({ x: -3.4, z: 2.6, ry: .9, female: true, name: 'groupe 1', tasks: [I(3.5, () => g2.head.getWorldPosition(new T.Vector3()), { talk: 1 }), I(4, () => g3.head.getWorldPosition(new T.Vector3()))] });
  const g2 = person({ x: -2.5, z: 2.2, ry: -1.6, female: false, name: 'groupe 2', tasks: [I(4, () => g1.head.getWorldPosition(new T.Vector3())), I(3, () => g1.head.getWorldPosition(new T.Vector3()), { talk: 1 })] });
  const g3 = person({ x: -3, z: 3.4, ry: 3, female: true, head: 'wrap', name: 'groupe 3', tasks: [I(5, () => g2.head.getWorldPosition(new T.Vector3())), I(2.5, () => g1.head.getWorldPosition(new T.Vector3()), { talk: .8 })] });
  person({ x: 6.4, z: .9, ry: -2.6, female: false, sit: 1, name: 'assis', tasks: [I(6, null), I(4, () => commer.head.getWorldPosition(new T.Vector3()))] });
  person({ x: -18, z: 5.6, ry: 1.5, female: true, bassine: true, name: 'porteuse', tasks: [W(-8, 5.8, .7), W(2, 5.4, .7), W(11, 5.9, .7), W(19, 5.2, .7), { type: 'idle', d: 6 }, { type: 'warp', x: -19, z: 5.6 }] });
  if (tier >= 2 || !isMobile) {
    person({ x: 9, z: -1, female: false, name: 'passant 1', tasks: [W(-1, -7.4, 1.05), W(-9, -7.6, 1.05), I(3, () => stallLook(6)), W(-12, -2, 1), W(9, 1, 1.05)] });
    person({ x: -8, z: -7.2, female: true, head: 'wrap', name: 'passante 2', tasks: [I(4, () => stallLook(7)), W(2, -8, .75), I(3, () => stallLook(8), { bend: .4 }), W(-8, -7.2, .75)] });
    person({ x: 12, z: 1.2, female: true, bassine: true, name: 'porteuse 2', tasks: [W(9.6, -1.4, .7), I(4, () => vendors[1].head.getWorldPosition(new T.Vector3()), { talk: .6 }), W(15, -4, .7), I(5, null), W(12, 1.2, .7)] });
    person({ x: 11.6, z: -5.6, ry: 2.5, female: false, head: 'capH', name: 'chauffeur camion', tasks: [I(5, () => lorry.position), I(3, null, { talk: 0 })] });
    vendors.push(person({ x: 2.4, z: -4.2, ry: 0, female: true, name: 'vendeuse 4', tasks: [I(7, null)] }), person({ x: -9.2, z: -3.5, ry: .2, female: true, head: 'wrap', name: 'vendeuse 5', tasks: [I(5, null), I(3, () => g1.root.position)] }));
  }
  const rider = person({ x: 0, z: -30, female: false, top: P.ivoire, head: 'capH', name: 'conducteur tricycle', sit: 1, tasks: [I(99, null)] });
  function stallLook(i) { const s = STALLS[i] || STALLS[0]; return new T.Vector3(s[0], .9, s[1]); }

  // création des batches
  const IM = {};
  Object.entries(BATCH).forEach(([k, b]) => { if (!b.items.length) return; const m = new T.InstancedMesh(b.geo, b.mat, b.items.length); m.frustumCulled = false; shadowy(m, true, false); b.items.forEach(it => m.setColorAt(it.idx, it.color)); m.instanceColor.needsUpdate = true; IM[k] = m; scene.add(m); });
  // ombres de contact (toujours, même sans shadow map)
  const blobTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(23,21,18,.55)'); g.addColorStop(1, 'rgba(23,21,18,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const blobs = new T.InstancedMesh((() => { const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })(), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), people.length + 3); blobs.frustumCulled = false; scene.add(blobs);

  function poseUpdate(p, dt, t) {
    const w = p.walkAmp || 0, ph = p.phase;
    const br = Math.sin(t * p.breathe + p.seed) * .012;
    const sitK = p.sit, bend = p.bend, pick = p.pickK || 0;
    p.hips.position.y = .9 - sitK * .45 - pick * .38 + Math.abs(Math.cos(ph)) * .025 * w;
    p.hips.position.x = Math.sin(t * .35 + p.seed) * .012 * (1 - w);
    p.torso.rotation.x = .04 + bend * .45 + pick * .6 + br + w * .05 - (p.carrying >= 0 ? .08 : 0);
    p.torso.rotation.y = Math.sin(ph) * .08 * w;
    const thigh = Math.sin(ph) * .5 * w;
    p.hipL.rotation.x = -thigh - sitK * 1.5 - pick * 1.25; p.hipR.rotation.x = thigh - sitK * 1.5 - pick * 1.25;
    p.knL.rotation.x = Math.max(0, Math.sin(ph + 1.9)) * .75 * w + sitK * 1.5 + pick * 1.7; p.knR.rotation.x = Math.max(0, Math.sin(ph + 1.9 + Math.PI)) * .75 * w + sitK * 1.5 + pick * 1.7;
    // bras
    const swing = Math.sin(ph) * .38 * w;
    let lx = swing, rx = -swing, le = -.18 - w * .15, re = -.18 - w * .15, lz = .06, rz = -.06;
    const talk = p.talkK || 0; if (talk > .01) { const g = Math.sin(t * 2.6 + p.seed) * .5 + Math.sin(t * 4.1 + p.seed * 2) * .3; rx = rx * (1 - talk) + (-.55 + g * .25) * talk; re = re * (1 - talk) + (-1.25 + g * .35) * talk; }
    const pu = p.phoneUpK || 0; if (pu > .01) { rx = rx * (1 - pu) - .35 * pu; re = re * (1 - pu) - 2.35 * pu; rz = rz * (1 - pu) - .35 * pu; }
    const ft = p.photoK || 0; if (ft > .01) { rx = rx * (1 - ft) - 1.25 * ft; re = re * (1 - ft) - .55 * ft; lx = lx * (1 - ft) - 1.15 * ft; le = le * (1 - ft) - .75 * ft; rz = rz * (1 - ft) + .25 * ft; lz = lz * (1 - ft) - .25 * ft; }
    if (p.armUp) { lx = -2.75; le = -.35; lz = .2; }
    if (p.carrying >= 0) { rx = -2.55; re = -1.35; rz = -.15; }
    if (pick > .01) { lx = lx * (1 - pick) - .9 * pick; rx = rx * (1 - pick) - .9 * pick; }
    p.shL.rotation.set(lx, 0, lz); p.shR.rotation.set(rx, 0, rz); p.elL.rotation.x = le; p.elR.rotation.x = re;
    if (p.checkK > .01) { p.shL.rotation.x = -1.1 * p.checkK; p.elL.rotation.x = -.3; }
    // regard : la tête regarde vraiment quelque chose
    let yaw = 0, pitch = .05 + bend * .4;
    const L = p.lookTarget instanceof Object && p.lookTarget.root ? p.lookTarget.head.getWorldPosition(tmpV) : (typeof p.look === 'function' ? p.look() : null);
    if (L) { p.root.updateMatrixWorld(); const local = p.root.worldToLocal(tmpV.copy(L)); yaw = clamp(Math.atan2(local.x, local.z), -1.1, 1.1); pitch = clamp(-Math.atan2(local.y - 1.55 * (1 - sitK * .25), Math.hypot(local.x, local.z)), -.3, .7) + bend * .2; }
    else yaw = Math.sin(t * .23 + p.seed) * .35 * (1 - w);
    p.neck.rotation.y += (yaw - p.neck.rotation.y) * Math.min(1, dt * 3); p.neck.rotation.x += (pitch - p.neck.rotation.x) * Math.min(1, dt * 3);
    if (ft > .5 || pu > .5) p.neck.rotation.x = Math.min(p.neck.rotation.x, .1);
  }
  function stepTask(p, dt) {
    const k = p.tasks[p.ti]; if (!k) return;
    const done = () => { p.tt = 0; p.ti++; if (p.ti >= p.tasks.length) p.ti = p.loop ? 0 : p.tasks.length; };
    const tgt = (v, x) => v + (x - v) * Math.min(1, dt * 3);
    p.talkK = tgt(p.talkK || 0, k.talk && k.type === 'idle' ? k.talk : 0); p.phoneUpK = tgt(p.phoneUpK || 0, k.type === 'phone' ? 1 : 0); p.photoK = tgt(p.photoK || 0, k.type === 'photo' ? 1 : 0);
    p.bend = tgt(p.bend, k.bend || 0); p.pickK = tgt(p.pickK || 0, (k.type === 'pick' || k.type === 'drop') ? 1 : 0); p.checkK = tgt(p.checkK || 0, k.type === 'check' ? 1 : 0);
    p.look = k.look || null; p.lookTarget = k.lookTarget || null;
    p.tt += dt;
    if (k.type === 'walk') {
      const dx = k.x - p.root.position.x, dz = k.z - p.root.position.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz); let da = want - p.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
      p.root.rotation.y += clamp(da, -dt * 2.4, dt * 2.4);
      const turnSlow = 1 - Math.min(1, Math.abs(da) / 1.6) * .8;
      const target = k.sp * 1.15 * turnSlow * Math.min(1, d / .9);
      p.speed += (target - p.speed) * Math.min(1, dt * 2.5);
      const step = p.speed * dt; p.root.position.x += Math.sin(p.root.rotation.y) * step; p.root.position.z += Math.cos(p.root.rotation.y) * step;
      p.phase += step / .62 * Math.PI; p.walkAmp = Math.min(1, p.speed / .7);
      if (d < .12) { p.speed = 0; done(); }
    } else {
      p.speed *= Math.max(0, 1 - dt * 5); p.walkAmp = Math.max(0, (p.walkAmp || 0) - dt * 2.5);
      if (k.type === 'idle' || k.type === 'phone' || k.type === 'photo' || k.type === 'check') { if (p.tt > (k.d || 3) * (k._j ||= .8 + p.r() * .5)) { k._j = 0; done(); } }
      else if (k.type === 'until') { if (k.fn()) done(); }
      else if (k.type === 'pick' || k.type === 'drop') { if (p.tt > k.d) done(); }
      else if (k.type === 'take') { if (TR.left > 0) { TR.left--; p.carrying = 1; } done(); }
      else if (k.type === 'stack') { if (p.carrying >= 0) { p.carrying = -1; pileN = Math.min(PILE.length, pileN + 1); refreshPile(); } done(); }
      else if (k.type === 'show') { p.hidden = false; done(); } else if (k.type === 'hide') { p.hidden = true; done(); }
      else if (k.type === 'warp') { p.root.position.set(k.x, 0, k.z); done(); }
    }
  }
  const hideM = new T.Matrix4().makeScale(0, 0, 0);
  function writePeople() {
    people.forEach(p => p.root.updateMatrixWorld(true));
    Object.entries(BATCH).forEach(([k, b]) => { const m = IM[k]; if (!m) return; b.items.forEach(it => { const p = it.owner; if (p.hidden) { m.setMatrixAt(it.idx, hideM); return; } tmpM.copy(it.node.matrixWorld); if (it.off) tmpM.multiply(it.off); m.setMatrixAt(it.idx, tmpM); }); m.instanceMatrix.needsUpdate = true; });
    people.forEach((p, i) => { if (p.hidden) { blobs.setMatrixAt(i, hideM); return; } const s = p.root.scale.x * (p.sit ? 1.1 : .85); blobs.setMatrixAt(i, M4(p.root.position.x, .035, p.root.position.z, 0, s, 1, s)); });
    // sacs portés
    let c = 0; people.forEach(p => { if (p.carrying >= 0 && !p.hidden && c < 6) { p.carry.updateMatrixWorld(); tmpM.copy(p.carry.matrixWorld).multiply(M4(0, 0, 0, Math.PI / 2, .9, .75, .9, 0, Math.PI / 2 - .2)); sackIM.setMatrixAt(carryStart + c++, tmpM); } });
    for (; c < 6; c++) sackIM.setMatrixAt(carryStart + c, hideM);
    sackIM.instanceMatrix.needsUpdate = true;
    [truck, trike].forEach((v, k) => blobs.setMatrixAt(people.length + k, M4(v.position.x, .03, v.position.z, v.rotation.y, k ? 1.8 : 2.6, 1, k ? 3 : 5.6)));
    blobs.setMatrixAt(people.length + 2, M4(lorry.position.x, .03, lorry.position.z, lorry.rotation.y, 3, 1, 8.2));
    blobs.instanceMatrix.needsUpdate = true;
  }
  people.forEach(p => p.parts.forEach(it => it.owner = p));

  // tricycle : part vers l'intérieur du pays par la route du nord
  const TK = { t: 0, dur: 38 };
  function updateVehicles(dt) {
    TR.t -= dt;
    if (TR.state === 'away' && TR.t <= 0) { TR.state = 'arrive'; TR.t0 = 0; TR.left = 4 + Math.floor(R() * 3); if (pileN >= PILE.length - 4) { pileN = PILE_BASE; refreshPile(); } }
    if (TR.state === 'arrive') { TR.t0 += dt; const k = Math.min(1, TR.t0 / 9); TR.x = -80 + (TR.stopX + 80) * easeOut(k); if (k >= 1) TR.state = 'stopped'; }
    if (TR.state === 'stopped' && TR.left <= 0 && handlerA.carrying < 0 && handlerB.carrying < 0 && driver.hidden && handlerA.ti === 0 && handlerB.ti === 0) { TR.state = 'leave'; TR.t0 = 0; }
    if (TR.state === 'leave') { TR.t0 += dt; const k = Math.min(1, TR.t0 / 9); TR.x = TR.stopX + 95 * easeIn(k); if (k >= 1) { TR.state = 'away'; TR.t = 6 + R() * 8; TR.x = -80; } }
    truck.position.set(TR.x, 0, TR.z);
    TK.t = (TK.t + dt) % TK.dur; const k = TK.t / TK.dur;
    const a = new T.Vector3(-6.6, 0, 6), b = new T.Vector3(-14, 0, -150);
    trike.position.lerpVectors(a, b, ease(k)); trike.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); trike.visible = k > .02 && k < .98;
    rider.root.position.copy(trike.position).add(new T.Vector3(Math.sin(trike.rotation.y) * .75, .35, Math.cos(trike.rotation.y) * .75)); rider.root.rotation.y = trike.rotation.y; rider.hidden = !trike.visible;
  }

  // ——— Micro-détails : poussière dans la lumière, oiseaux lointains, fumée d'un fumoir ———
  let dust = null, birds = null, smoke = null;
  if (tier >= 2 || !isMobile) {
    const n = tier >= 2 ? 160 : 70, g = new T.BufferGeometry(), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = rr(-12, 12); pos[i * 3 + 1] = rr(.3, 4); pos[i * 3 + 2] = rr(-8, 8); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    dust = new T.Points(g, new T.PointsMaterial({ size: .045, color: C(P.ivoireT, P.recolte, .3), transparent: true, opacity: .5, depthWrite: false, sizeAttenuation: true })); scene.add(dust);
  }
  {
    const sTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(185,173,152,.5)'); g.addColorStop(1, 'rgba(185,173,152,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    if (tier >= 2) { const n = 14; smoke = []; const sm = new T.SpriteMaterial({ map: sTex, transparent: true, depthWrite: false, opacity: .5 });
    for (let i = 0; i < n; i++) { const s = new T.Sprite(sm.clone()); s.userData.o = i / n; scene.add(s); smoke.push(s); }
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute([-.4, 0, 0, 0, 0, 0, 0, 0, 0, .4, 0, 0], 3)); bg.setIndex([0, 1, 1, 2, 2, 3]);
    birds = []; for (let i = 0; i < 3; i++) { const l = new T.LineSegments(bg.clone(), new T.LineBasicMaterial({ color: C(P.brun, P.sable, .3), transparent: true, opacity: .7 })); l.userData = { s: rr(0, 6), r: rr(22, 40), h: rr(14, 22), sp: rr(.05, .09) }; scene.add(l); birds.push(l); } }
  }
  const SMOKE_AT = new T.Vector3(-19, 0, -21);
  // un fumoir (four en banco) au fond : la source de la fumée
  scene.add(shadowy(new T.Mesh(merge([{ g: new T.CylinderGeometry(1, 1.15, 1.1, 12), m: M4(SMOKE_AT.x, .55, SMOKE_AT.z), c: C(P.terre, P.sable, .4) }, { g: new T.CylinderGeometry(1.6, 1.6, .06, 4), m: M4(SMOKE_AT.x, 2.2, SMOKE_AT.z, .7), c: C(P.sable, P.brun, .3) }, ...[-1, 1].map(a => ({ g: new T.BoxGeometry(.08, 2.2, .08), m: M4(SMOKE_AT.x + a * 1.1, 1.1, SMOKE_AT.z + 1), c: C(P.brun) }))]), vcol())));

  // ——— Ligne directe & effet Yango (orange ambré réservé à ce qui relie) ———
  const AMBRE = C(P.ambre);
  const MARKET = new T.Vector3(0, 1.2, 1);
  const arcs = {}; const pulses = [];
  const pulseGeo = new T.SphereGeometry(.55, 12, 8);
  function arcTo(slug) {
    if (arcs[slug]) return arcs[slug]; const zn = zoneBy[slug]; if (!zn) return null;
    const end = new T.Vector3(zn.x, 1.2, zn.z), mid = MARKET.clone().lerp(end, .5); mid.y = 6 + MARKET.distanceTo(end) * .18;
    const curve = new T.QuadraticBezierCurve3(MARKET.clone(), mid, end);
    const m = new T.Mesh(new T.TubeGeometry(curve, 48, .09, 5), new T.MeshBasicMaterial({ color: AMBRE, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const ring = new T.Mesh(new T.RingGeometry(2.2, 2.6, 40), new T.MeshBasicMaterial({ color: AMBRE, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(zn.x, .25, zn.z);
    scene.add(m, ring); return arcs[slug] = { curve, m, ring, op: 0, want: 0, ringK: 0 };
  }
  function sendPulse(slug, back, delay = 0, onArrive) { const a = arcTo(slug); if (!a) return; const s = new T.Mesh(pulseGeo, new T.MeshBasicMaterial({ color: back ? C(P.ambre, P.ivoireT, .35) : AMBRE, fog: false, transparent: true })); s.scale.setScalar(back ? .6 : 1); s.visible = false; scene.add(s); pulses.push({ s, a, back, t: -delay, dur: 2.4 + a.curve.getLength() * .015, onArrive }); }
  const marketRing = new T.Mesh(new T.RingGeometry(3, 3.4, 48), new T.MeshBasicMaterial({ color: AMBRE, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false })); marketRing.rotation.x = -Math.PI / 2; marketRing.position.set(0, .2, 1); scene.add(marketRing);
  let marketRingK = 0;
  function updateLinks(dt) {
    Object.values(arcs).forEach(a => { a.op += (a.want - a.op) * Math.min(1, dt * 2); a.m.material.opacity = a.op * .85; a.m.visible = a.op > .01; a.ringK = Math.max(0, a.ringK - dt * .6); a.ring.material.opacity = a.ringK; a.ring.scale.setScalar(1 + (1 - a.ringK) * .6); a.ring.visible = a.ringK > .01; });
    marketRingK = Math.max(0, marketRingK - dt * .5); marketRing.material.opacity = marketRingK; marketRing.scale.setScalar(1 + (1 - marketRingK) * .8); marketRing.visible = marketRingK > .01;
    for (let i = pulses.length - 1; i >= 0; i--) { const q = pulses[i]; q.t += dt; if (q.t < 0) continue; const k = Math.min(1, q.t / q.dur); q.s.visible = true; q.s.position.copy(q.a.curve.getPoint(q.back ? 1 - ease(k) : ease(k))); if (k >= 1) { scene.remove(q.s); q.s.material.dispose(); pulses.splice(i, 1); if (q.back) marketRingK = 1; else q.a.ringK = 1; q.onArrive && q.onArrive(); } }
  }

  // ——— Caméra : états, parcours, inertie ———
  const S = {
    arrivee: { p: [-14, 7.2, 24], t: [-.5, 2.4, -7], fov: 36 },
    recolte: { p: [-21, 3.8, 10.5], t: [-13.2, 1.1, .6], fov: 34 },
    besoin: { p: [-7.6, 2.8, 3.4], t: [-5, 1.1, -2.4], fov: 36 },
    ligne: { p: [5, 16, 27], t: [-3, 0, -22], fov: 38 },
    reseau: { p: [4, 58, 46], t: [-3, 0, -26], fov: 40 },
  };
  const cam = { p: new T.Vector3(...S.arrivee.p), t: new T.Vector3(...S.arrivee.t), fov: 34 };
  const goal = { p: cam.p.clone(), t: cam.t.clone(), fov: 34 };
  let mode = 'home', scrollP = 0, focusSlug = null, slowK = 0, px = 0, py = 0, pointerX = 0, pointerY = 0;
  function portraitize(st) { const a = renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight); const p = new T.Vector3(...st.p), t = new T.Vector3(...st.t); let fov = st.fov; if (a < 1) { const k = clamp(1.6 - a * .6, 1, 1.45); p.sub(t).multiplyScalar(k).add(t); p.y += 2; fov = st.fov + (1 - a) * 22; } return { p, t, fov }; }
  function computeGoal() {
    let st;
    if (mode === 'reseau') st = portraitize(S.reseau);
    else { const seq = ['arrivee', 'recolte', 'besoin', 'ligne'].map(k => portraitize(S[k])); const f = clamp(scrollP, 0, 1) * (seq.length - 1), i = Math.min(seq.length - 2, Math.floor(f)), k = ease(f - i); st = { p: seq[i].p.clone().lerp(seq[i + 1].p, k), t: seq[i].t.clone().lerp(seq[i + 1].t, k), fov: seq[i].fov + (seq[i + 1].fov - seq[i].fov) * k }; }
    const s = focusSlug && stallBy[focusSlug]; if (s && mode === 'home' && scrollP < .34) { const k = .32 * (1 - scrollP * 3); st.t.lerp(new T.Vector3(s.x, 1, s.z), k); st.p.lerp(new T.Vector3(s.x + 3, 3.2, s.z + 9), k * .55); }
    goal.p.copy(st.p); goal.t.copy(st.t); goal.fov = st.fov;
  }
  if (matchMedia('(hover: hover)').matches) addEventListener('pointermove', e => { pointerX = e.clientX / innerWidth - .5; pointerY = e.clientY / innerHeight - .5; }, { passive: true });
  function updateCamera(dt, t) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 1.8);
    cam.p.lerp(goal.p, k); cam.t.lerp(goal.t, k); cam.fov += (goal.fov - cam.fov) * k;
    px += (pointerX - px) * Math.min(1, dt * 2); py += (pointerY - py) * Math.min(1, dt * 2);
    camera.position.copy(cam.p); if (!reduced) { camera.position.x += px * .8 + Math.sin(t * .11) * .06; camera.position.y += -py * .35 + Math.sin(t * .17) * .04; }
    camera.lookAt(cam.t); if (Math.abs(camera.fov - cam.fov) > .01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  }

  // ——— Focus produit / catégorie (la lumière se pose sur l'étal) ———
  let poolK = 0, poolWant = 0, dimK = 0;
  function focus(slug) {
    focusSlug = slug; const s = stallBy[slug];
    boards.forEach(b => b.hot = s ? (b === s ? 1 : b.cat === s.cat ? .35 : 0) : 0);
    if (s) { pool.position.set(s.x + .2, .03, s.z + .6); poolWant = 1; } else poolWant = 0;
    computeGoal(); kick();
  }

  // ——— Labels HTML (2 ou 3 au plus) ———
  let labelsEl = null; const labels = [];
  function setLabels(list) { if (!labelsEl) return; labelsEl.innerHTML = ''; labels.length = 0; list.slice(0, 3).forEach(l => { const e = document.createElement('span'); e.className = 'wlabel'; e.textContent = l.text; labelsEl.appendChild(e); labels.push({ e, v: l.v }); }); }
  function placeLabels() { if (!labels.length) return; const w = canvas.clientWidth, h = canvas.clientHeight; labels.forEach(l => { tmpV.copy(l.v).project(camera); const vis = tmpV.z < 1 && Math.abs(tmpV.x) < .95 && Math.abs(tmpV.y) < .95; l.e.style.opacity = vis ? 1 : 0; l.e.style.transform = `translate(${((tmpV.x + 1) / 2 * w).toFixed(1)}px,${((1 - tmpV.y) / 2 * h).toFixed(1)}px) translate(-50%,-140%)`; }); }

  // ——— Boucle, pause hors écran, qualité adaptative ———
  let running = false, visible = true, dock = null, last = 0, raf = 0, needs = 2, fpsAcc = 0, fpsN = 0, quality = tier, frameSkip = 0;
  const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) start(); }, { threshold: 0 });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  function kick() { needs = Math.max(needs, 2); start(); }
  function start() { if (!running && dock && visible && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function resize() { if (!dock) return; const w = dock.clientWidth, h = dock.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); computeGoal(); kick(); }
  const ro = new ResizeObserver(resize);
  function degrade() { if (quality >= 2) { quality = 1; renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); dprCap = 1.25; } else { dprCap = Math.max(.75, dprCap - .25); frameSkip = 1; } renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap)); resize(); }
  let simT = 0;
  function loop(now) {
    if (!dock || !visible || document.hidden) { running = false; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const animate = !reduced;
    if (animate) {
      simT += dt * (1 - slowK * .75); const sdt = dt * (1 - slowK * .75); uTime.value = simT;
      updateVehicles(sdt); people.forEach(p => { stepTask(p, sdt); poseUpdate(p, sdt, simT); });
      writePeople(); updateLinks(dt);
      if (dust) { const a = dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { a.setY(i, a.getY(i) + Math.sin(simT * .3 + i) * .002); a.setX(i, a.getX(i) + .003 * Math.sin(simT * .1 + i * 3)); } a.needsUpdate = true; }
      if (smoke) smoke.forEach(s => { const k = ((simT * .05 + s.userData.o) % 1); s.position.set(SMOKE_AT.x + Math.sin(k * 4) * .6 + k * 2.4, 1.2 + k * 9, SMOKE_AT.z - k * 1.2); s.scale.setScalar(1 + k * 4.5); s.material.opacity = (1 - k) * .42 * Math.min(1, k * 6); });
      if (birds) birds.forEach(b => { const u = b.userData, a = u.s + simT * u.sp; b.position.set(Math.cos(a) * u.r - 6, u.h + Math.sin(simT * .3 + u.s) * .8, Math.sin(a) * u.r * .6 - 30); b.rotation.y = -a; const f = Math.sin(simT * 7 + u.s) * .25; const p = b.geometry.attributes.position; p.setY(0, f); p.setY(3, f); p.needsUpdate = true; });
    } else if (needs > 0) { people.forEach(p => { p.walkAmp = 0; poseUpdate(p, 1, 0); }); writePeople(); updateLinks(1); }
    poolK += (poolWant - poolK) * Math.min(1, dt * 2.5); pool.material.opacity = poolK * .55;
    dimK += ((focusSlug ? 1 : 0) - dimK) * Math.min(1, dt * 2); hemi.intensity = 1.35 - dimK * .16;
    boards.forEach(b => { b.k = (b.k || 0) + ((b.hot || 0) - (b.k || 0)) * Math.min(1, dt * 3); b.mat.emissiveIntensity = b.k * .28; });
    updateCamera(dt, simT); placeLabels();
    if (frameSkip && (fpsN & 1)) { /* rendu à fréquence réduite en niveau 1 dégradé */ } else renderer.render(scene, camera);
    fpsAcc += dt; fpsN++; if (fpsAcc > 2.5) { const fps = fpsN / fpsAcc; api.fps = Math.round(fps); if (fps < (quality >= 2 ? 40 : 26) && !reduced) degrade(); fpsAcc = 0; fpsN = 0; }
    needs = Math.max(0, needs - 1);
    if (reduced && needs <= 0) { running = false; return; }
    raf = requestAnimationFrame(loop);
  }

  // ——— API (pont) ———
  const api = {
    canvas, fps: 0,
    dock(el, m = 'home') { if (!el) return; if (dock) { ro.unobserve(dock); io.unobserve(dock); } dock = el; mode = m; el.prepend(canvas); labelsEl = el.querySelector('.wlabels'); ro.observe(el); io.observe(el); resize(); if (m === 'reseau') setLabels([]); computeGoal(); cam.p.copy(goal.p); cam.t.copy(goal.t); kick(); },
    undock() { if (dock) { ro.unobserve(dock); io.unobserve(dock); } dock = null; canvas.remove(); running = false; cancelAnimationFrame(raf); },
    scroll(p) { scrollP = p; computeGoal(); kick(); },
    on(type, d = {}) {
      if (type === 'focusProduct') focus(d.slug);
      else if (type === 'reset') { focus(null); Object.values(arcs).forEach(a => a.want = 0); setLabels([]); }
      else if (type === 'slow') { slowK = d.on ? 1 : 0; }
      else if (type === 'focusRegion') { Object.values(arcs).forEach(a => a.want = 0); const zn = zoneBy[d.slug]; if (zn) { const a = arcTo(d.slug); a.want = .35; a.ringK = 1; setLabels([{ text: zn.name, v: new T.Vector3(zn.x, 3, zn.z) }]); } kick(); }
      else if (type === 'showRequest') {
        const regs = [...new Set(d.regions || [])].filter(s => zoneBy[s]); marketRingK = 1;
        Object.values(arcs).forEach(a => a.want = 0);
        const targets = regs.length ? regs : Object.keys(zoneBy).slice(0, 4);
        targets.forEach((s, i) => { arcTo(s).want = regs.length ? .9 : .35; sendPulse(s, false, .4 + i * .35, () => { if (regs.length) sendPulse(s, true, .5 + Math.random() * .8); }); });
        setLabels([{ text: 'Votre besoin', v: MARKET.clone().add(new T.Vector3(0, 2, 0)) }, ...targets.slice(0, 2).map(s => ({ text: zoneBy[s].name, v: new T.Vector3(zoneBy[s].x, 3, zoneBy[s].z) }))]);
        kick(); if (reduced) { needs = 1; }
      }
      else if (type === 'contactStarted') { const zn = zoneBy[d.region]; if (zn) { const a = arcTo(d.region); a.want = 1; sendPulse(d.region, true, 0, () => { a.want = 0; }); } kick(); }
    },
    snap() { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', .8); },
    info() { const i = renderer.info.render; return { calls: i.calls, triangles: i.triangles, people: people.length, quality, dpr: renderer.getPixelRatio(), fps: api.fps, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; },
    dispose() { api.undock(); renderer.dispose(); scene.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); }); },
  };
  computeGoal();
  return api;
}
