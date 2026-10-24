/* ═════════ Marché de Gros CI — la carte du réseau, en profondeur (MapLibre GL) ═════════
   Une vraie carte : routes, rail, fleuves, lacs, villes et 3 700 localités de Côte d'Ivoire, EMBARQUÉES (app/geo/ci.json) —
   elle s'ouvre sans connexion. En ligne, elle gagne l'ombrage du relief (Terrarium, AWS Open Data) et, de près, les rues,
   les quartiers et les bâtiments en volume (OpenFreeMap, données OpenStreetMap).
   Les annonces sont des bulles de prix (« 350 F/kg ») posées dans la ville déclarée par le membre (jamais une adresse exacte) ;
   de loin, elles se regroupent par district. Un calque « chaleur » montre où la demande se concentre.
   Repli : sans WebGL, sur un appareil faible, ou si un fichier manque, l'application garde la carte Canvas (app/carte-app.js).
   Carte figée : vue du dessus, nord en haut, ni rotation ni inclinaison ; on ne dézoome pas au-delà du pays entier.
   API : MDGCarteGL.capable() · mount(host, opt) → Promise<api|null> ; api.set(data) · relayout() · destroy() · home() · localiser().
   opt : onSelect(region) · onPick(ids) · onLocate(lat, lon) · insets() → { t, b } (place prise par l'interface en haut et en bas). */
(function () {
  'use strict';
  const D2R = Math.PI / 180;
  const MOTION = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cle = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const km = (a, b) => { const R = 6371, dLa = (b[1] - a[1]) * D2R, dLo = (b[0] - a[0]) * D2R, x = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.sin(dLo / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(x))); };
  const fmt = n => n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M' : n >= 1e4 ? Math.round(n / 1e3) + ' k' : Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const abs = p => new URL(p, document.baseURI).href;   // document.baseURI : l'adresse de la page, ou celle de <base> (site/carte/)

  // chargement à la demande (le moteur ne pèse rien tant que la carte n'est pas ouverte)
  let libP = null, geoP = null;
  function lib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    return libP || (libP = new Promise((ok, ko) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/maplibre/maplibre-gl.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = 'vendor/maplibre/maplibre-gl.js'; s.onload = () => window.maplibregl ? ok(window.maplibregl) : ko(new Error('maplibre'));
      s.onerror = e => { libP = null; ko(e); }; document.head.appendChild(s);
    }));
  }
  const geo = () => geoP || (geoP = fetch('app/geo/ci.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { geoP = null; throw e; }));
  function capable() {
    try {
      if (navigator.deviceMemory && navigator.deviceMemory < 2) return false;            // appareil très modeste : la carte Canvas suffit
      if (navigator.connection && navigator.connection.saveData) return false;           // économiseur de données
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      return !!gl;
    } catch (_) { return false; }
  }

  // deux ambiances, mêmes repères : nuit (l'application) et jour (comme les applications de transport)
  const PAL = {
    nuit: { mer: '#0f1417', voisin: '#1a1814', civ: '#2a241b', ville: '#3a3023', lac: '#1b2e34', fleuve: '#3d6166', r1: '#d9b07a', r2: '#9d8463', r3: '#5f5344', casing: '#14110d', rail: '#6f6455',
      t1: '#F5F0E6', t2: '#E6DCCB', t3: '#B9AD98', halo: 'rgba(15,13,10,.92)', bat: '#4a3e2e', batBord: '#5d4f3b', solHab: '#30291f', solCom: '#3a2d22', solInd: '#2c2a26', solPub: '#2b2e2a', parc: '#24301f', piste: '#7a6a52', marche: '#F3B48A', ombre: 'rgba(0,0,0,.45)',
      ciel: '#1a1e24', horizon: '#3a2f25', brume: '#2a2620' },
    jour: { mer: '#bcdbe6', voisin: '#e9e3d6', civ: '#f7f2e8', ville: '#f0e2c9', lac: '#a9d0de', fleuve: '#86bdd0', r1: '#ea9a4e', r2: '#f2c27e', r3: '#ddcfb7', casing: '#c98a4a', rail: '#a99d8a',
      t1: '#231f19', t2: '#3b342a', t3: '#6f6553', halo: 'rgba(255,253,248,.95)', bat: '#e8dcc6', batBord: '#d2c1a3', solHab: '#f1e8d8', solCom: '#f4e0cf', solInd: '#ebe6dc', solPub: '#e9eadf', parc: '#dde8cf', piste: '#b9a27e', marche: '#B85C38', ombre: 'rgba(80,60,30,.2)',
      ciel: '#cfe6f2', horizon: '#f6ead8', brume: '#efe6d6' }
  };
  const FONT_R = ['Jost Regular'], FONT_M = ['Jost Medium'], FONT_I = ['Jost Italic'];   // la police unique du site (vendor/glyphs, tools/glyphes-carte.js)

  function style(base, P) {
    return {
      version: 8, glyphs: abs('vendor/glyphs/') + '{fontstack}/{range}.pbf',
      sources: { base: { type: 'geojson', data: base, attribution: 'Natural Earth · GeoNames' }, heat: { type: 'geojson', data: vide() }, arcs: { type: 'geojson', data: vide() }, zones: { type: 'geojson', data: vide() }, trajet: { type: 'geojson', data: vide() }, moi: { type: 'geojson', data: vide() } },
      layers: [
        { id: 'fond', type: 'background', paint: { 'background-color': P.voisin } },
        { id: 'mer', type: 'fill', source: 'base', filter: ['==', ['get', 'k'], 'mer'], paint: { 'fill-color': P.mer } },
        { id: 'civ', type: 'fill', source: 'base', filter: ['==', ['get', 'k'], 'civ'], paint: { 'fill-color': P.civ } },
        { id: 'cote', type: 'line', source: 'base', filter: ['==', ['get', 'k'], 'civ'], paint: { 'line-color': P.fleuve, 'line-opacity': .35, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .6, 10, 1.4] } },
        { id: 'ville', type: 'fill', source: 'base', filter: ['==', ['get', 'k'], 'ville'], paint: { 'fill-color': P.ville, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, .5, 10, .9] } },
        { id: 'lac', type: 'fill', source: 'base', filter: ['==', ['get', 'k'], 'lac'], paint: { 'fill-color': P.lac } },
        { id: 'fleuve', type: 'line', source: 'base', filter: ['==', ['get', 'k'], 'fleuve'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': P.fleuve, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .7, 9, 1.8, 13, 3] } },
        { id: 'rail', type: 'line', source: 'base', filter: ['==', ['get', 'k'], 'rail'], paint: { 'line-color': P.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .8, 10, 1.6], 'line-dasharray': [3, 2] } },
        { id: 'route-bord', type: 'line', source: 'base', filter: ['all', ['==', ['get', 'k'], 'route'], ['<=', ['get', 'r'], 2]], minzoom: 6.5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': P.casing, 'line-opacity': .55, 'line-width': ['interpolate', ['linear'], ['zoom'], 6.5, 2.4, 10, 6, 13, 10] } },
        { id: 'route', type: 'line', source: 'base', filter: ['==', ['get', 'k'], 'route'], layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['match', ['get', 'r'], 1, P.r1, 2, P.r2, P.r3], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'r'], 1, 1.1, 2, .7, .4], 10, ['match', ['get', 'r'], 1, 3.6, 2, 2.4, 1.2], 13, ['match', ['get', 'r'], 1, 7, 2, 5, 2.5]] } },
        { id: 'route-nom', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'k'], 'route'], ['!=', ['get', 'n'], '']], minzoom: 8,
          layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': FONT_M, 'text-size': 10.5, 'symbol-spacing': 320, 'text-rotation-alignment': 'viewport' },
          paint: { 'text-color': P.t2, 'text-halo-color': P.halo, 'text-halo-width': 1.6 } },
        { id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#6AAEF0', 'line-opacity': .75, 'line-width': 1.6, 'line-dasharray': [1.2, 1.6] } },
        { id: 'chaleur', type: 'heatmap', source: 'heat', layout: { visibility: 'none' }, paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 10, 2.6],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 60, 9, 110, 13, 170], 'heatmap-opacity': .85,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(242,201,76,0)', .25, 'rgba(242,201,76,.35)', .55, 'rgba(224,122,63,.6)', .85, 'rgba(226,115,91,.85)', 1, 'rgba(184,60,40,.95)'] } },
        // zones de forte demande : un halo posé SUR LE SOL, sous les noms des villes (il ne cache rien)
        { id: 'zone-halo', type: 'circle', source: 'zones', paint: { 'circle-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 22, 8, 46, 11, 110], 'circle-color': 'rgba(226,115,91,.16)', 'circle-blur': .35, 'circle-stroke-color': 'rgba(226,115,91,.55)', 'circle-stroke-width': 1.2, 'circle-pitch-alignment': 'map' } },
        { id: 'trajet-bord', type: 'line', source: 'trajet', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': P.casing, 'line-opacity': .6, 'line-width': 7 } },
        { id: 'trajet', type: 'line', source: 'trajet', filter: ['==', ['get', 'route'], 1], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#B095F0', 'line-width': 3.5 } },
        { id: 'trajet-vol', type: 'line', source: 'trajet', filter: ['==', ['get', 'route'], 0], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#B095F0', 'line-width': 2.5, 'line-dasharray': [1.5, 1.5] } },
        { id: 'lieu-point', type: 'circle', source: 'base', filter: ['all', ['==', ['get', 'k'], 'lieu'], ['==', ['get', 'r'], 4]], minzoom: 10, paint: { 'circle-radius': 2, 'circle-color': P.t3, 'circle-opacity': .7 } },
        { id: 'lieu-4', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'k'], 'lieu'], ['==', ['get', 'r'], 4]], minzoom: 10,
          layout: { 'text-field': ['get', 'n'], 'text-font': FONT_R, 'text-size': 11, 'text-offset': [0, .9], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': P.t3, 'text-halo-color': P.halo, 'text-halo-width': 1.4 } },
        { id: 'lieu-3', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'k'], 'lieu'], ['==', ['get', 'r'], 3]], minzoom: 7.4,
          layout: { 'text-field': ['get', 'n'], 'text-font': FONT_R, 'text-size': ['interpolate', ['linear'], ['zoom'], 7.4, 11, 11, 13.5], 'text-anchor': 'top', 'text-offset': [0, .35] }, paint: { 'text-color': P.t2, 'text-halo-color': P.halo, 'text-halo-width': 1.6 } },
        { id: 'lieu-2', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'k'], 'lieu'], ['==', ['get', 'r'], 2]], minzoom: 5.1,
          layout: { 'text-field': ['get', 'n'], 'text-font': FONT_M, 'text-size': ['interpolate', ['linear'], ['zoom'], 5.6, 11.5, 10, 15], 'text-anchor': 'top', 'text-offset': [0, .35] }, paint: { 'text-color': P.t1, 'text-halo-color': P.halo, 'text-halo-width': 1.8 } },
        { id: 'lieu-1', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'k'], 'lieu'], ['==', ['get', 'r'], 1]],
          layout: { 'text-field': ['get', 'n'], 'text-font': FONT_M, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 10, 18], 'text-letter-spacing': .04, 'text-anchor': 'top', 'text-offset': [0, .35] }, paint: { 'text-color': P.t1, 'text-halo-color': P.halo, 'text-halo-width': 2 } },
        { id: 'moi-halo', type: 'circle', source: 'moi', paint: { 'circle-radius': ['get', 'rayon'], 'circle-color': 'rgba(176,149,240,.14)', 'circle-stroke-color': 'rgba(176,149,240,.5)', 'circle-stroke-width': 1, 'circle-pitch-alignment': 'map' } }
      ]
    };
  }
  const vide = () => ({ type: 'FeatureCollection', features: [] });

  // styles des bulles et des contrôles (préfixe cgl-)
  const CSS = `.cgl{position:absolute;inset:0;opacity:0;transition:opacity .5s ease}.cgl.on{opacity:1}.cgl .maplibregl-canvas{outline:none}
.cgl .maplibregl-ctrl-attrib{background:rgba(23,21,18,.55)!important;color:rgba(245,240,230,.6);font:400 9.5px Jost,sans-serif;border-radius:8px 0 0 0}.cgl .maplibregl-ctrl-attrib a{color:inherit}
.cgl.jour .maplibregl-ctrl-attrib{background:rgba(255,255,255,.7)!important;color:#5d5444}
.cgl-pill{position:relative;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px 0 9px;border:0;border-radius:15px;background:#FAF4E9;color:#171512;font:700 13px Jost,sans-serif;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(23,21,18,.08);cursor:pointer;transform-origin:50% 100%;transition:transform .18s cubic-bezier(.22,1,.36,1),background .18s,color .18s}
.cgl-pill::after{content:"";position:absolute;left:50%;bottom:-5px;width:10px;height:10px;margin-left:-5px;background:inherit;transform:rotate(45deg);border-radius:0 0 3px 0;box-shadow:2px 2px 3px rgba(0,0,0,.12)}
.cgl-pill i{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;border-radius:50%;background:rgba(108,197,140,.22);box-shadow:inset 0 0 0 1px rgba(108,197,140,.55);font:normal 11px/1 "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}.cgl-pill i::before{content:"";display:block;width:74%;height:74%;background:var(--sym-o) center/contain no-repeat}.cgl-pill i.d{border-radius:30%;background:rgba(242,194,48,.24);box-shadow:inset 0 0 0 1px rgba(242,194,48,.6)}.cgl-pill i.d::before{content:"";display:block;width:74%;height:74%;background:var(--sym-d) center/contain no-repeat}
.cgl-v{flex:none;display:inline-flex;color:#2C6CB0;margin-left:-2px}
.cgl-pill small{font-weight:500;font-size:11px;color:#655C4D}.cgl-pill b{font-weight:700}
.cgl-pill.d{background:#FFF6DA}.cgl-pill.approx{box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1.5px rgba(23,21,18,.25)}
.cgl-pill:hover,.cgl-pill:focus-visible{transform:scale(1.06);z-index:3;outline:2px solid #10392B;outline-offset:2px;box-shadow:0 0 0 2px #FFFDF8}
.cgl-pill.sel{background:#171512;color:#F5F0E6;transform:scale(1.12);z-index:4}.cgl-pill.sel small{color:#B9AD98}
.cgl-m{position:absolute}
.cgl-amas{display:flex;align-items:center;gap:8px;height:28px;padding:0 9px;border:0;border-radius:14px;background:rgba(23,21,18,.9);color:#F5F0E6;font:600 12.5px Jost,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4),0 0 0 1px rgba(245,240,230,.16);cursor:pointer;transition:transform .18s cubic-bezier(.22,1,.36,1)}
.cgl-amas span{display:inline-flex;align-items:center;gap:3px;font-size:13px}.cgl-s{display:inline-block;width:15px;height:15px;background:var(--sym-o) center/contain no-repeat}.cgl-s.d{background-image:var(--sym-d)}.cgl-amas b{font-weight:700}.cgl-amas:hover,.cgl-amas:focus-visible{transform:scale(1.08);outline:2px solid #10392B;outline-offset:2px;box-shadow:0 0 0 2px #FFFDF8}
.cgl.jour .cgl-amas{background:rgba(255,253,248,.96);color:#171512;box-shadow:0 4px 14px rgba(80,60,30,.25),0 0 0 1px rgba(23,21,18,.08)}
.cgl-feu{display:flex;align-items:center;gap:4px;height:22px;min-width:22px;padding:0 3px;border-radius:11px;background:rgba(23,21,18,.82);color:#F3A08C;font:600 11px Jost,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 0 0 1.5px rgba(226,115,91,.75),0 3px 8px rgba(0,0,0,.35)}
.cgl-feu b{font-weight:600;padding-left:5px}.cgl-feu span{font-size:12px;line-height:1;display:inline-flex;animation:cglFeu 2.4s ease-in-out 2;transform-origin:50% 90%}
.cgl.jour .cgl-feu{background:rgba(255,253,248,.95);color:#B4472F}
@keyframes cglFeu{50%{transform:scale(1.18)}}
.cgl-moi{width:18px;height:18px;border-radius:50%;background:#B095F0;box-shadow:0 0 0 4px rgba(255,255,255,.9),0 4px 12px rgba(0,0,0,.4)}
.cgl-moi::after{content:"";position:absolute;inset:-12px;border-radius:50%;border:2px solid rgba(176,149,240,.6);animation:cglOnde 2.4s ease-out infinite}
@keyframes cglOnde{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}
.cgl-dist{padding:4px 9px;border-radius:12px;background:rgba(23,21,18,.9);color:#E6DCFF;font:600 12px Jost,sans-serif;white-space:nowrap;box-shadow:0 0 0 1px rgba(176,149,240,.5)}
.cgl-ui{position:absolute;right:10px;display:flex;flex-direction:column;gap:8px;z-index:2;transition:bottom .3s}.cgl-ui .cgl-z1{margin-top:8px;border-radius:22px 22px 0 0!important;border-bottom-color:transparent!important}.cgl-ui .cgl-z2{margin-top:-9px;border-radius:0 0 22px 22px!important;border-top:1px solid rgba(245,240,230,.14)!important}@media (max-height:640px){.cgl-ui{gap:5px}.cgl-ui button{width:40px!important;height:40px!important}}
.cgl-ui button{width:44px;height:44px;border-radius:22px;border:1px solid rgba(245,240,230,.14);background:rgba(23,21,18,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#F5F0E6;display:flex;align-items:center;justify-content:center;padding:0;font:700 11.5px Jost,sans-serif;cursor:pointer}
.cgl-ui button[aria-pressed=true]{background:#F5F0E6;color:#171512}
.cgl.jour .cgl-ui button{background:rgba(255,253,248,.92);color:#171512;border-color:rgba(23,21,18,.1);box-shadow:0 2px 8px rgba(80,60,30,.15)}.cgl.jour .cgl-ui button[aria-pressed=true]{background:#171512;color:#F5F0E6}
.cgl-etat{position:absolute;left:10px;z-index:2;display:flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:13px;background:rgba(23,21,18,.72);color:#E6DCCB;font:500 11px Jost,sans-serif;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:none;transition:top .3s}
.cgl-etat:not(.hors){display:none}.cgl-etat i{width:7px;height:7px;border-radius:50%;background:#6CC58C}.cgl-etat.hors i{background:#B9AD98}
.cgl.jour .cgl-etat{background:rgba(255,253,248,.9);color:#3b342a;box-shadow:0 2px 8px rgba(80,60,30,.15)}
.cgl-echelle{position:absolute;left:12px;z-index:2;font:600 17px Jost,system-ui,sans-serif;color:#F5F0E6;text-shadow:0 1px 8px rgba(0,0,0,.8);pointer-events:none;transition:top .3s}
.cgl.jour .cgl-echelle{color:#231f19;text-shadow:0 1px 6px rgba(255,255,255,.9)}
@media (prefers-reduced-motion:reduce){.cgl,.cgl-pill{transition:none}.cgl-feu,.cgl-moi::after{animation:none}}`;

  function mount(host, opt) {
    opt = opt || {};
    if (!capable()) return Promise.resolve(null);
    return Promise.all([lib(), geo()]).then(([ml, base]) => new Promise(resolve => {
      if (!document.getElementById('cglCss')) { const st = document.createElement('style'); st.id = 'cglCss'; st.textContent = CSS; document.head.appendChild(st); }
      const A = window.MDGApp, LS = k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, SS = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
      let theme = LS('mdg-carte:theme') === 'jour' ? 'jour' : 'nuit', P = PAL[theme], chaleur = LS('mdg-carte:chaleur') === 'oui';
      const box = document.createElement('div'); box.className = 'cgl' + (theme === 'jour' ? ' jour' : ''); host.appendChild(box);
      // toucher un repère ne doit jamais faire défiler la page qui contient la carte (le navigateur « montre » l'élément touché)
      const bloque = [], fige = e => { const t = e.currentTarget; if (t.scrollTop || t.scrollLeft) { t.scrollTop = 0; t.scrollLeft = 0; } };
      for (let n = host; n && n !== document.body; n = n.parentElement) { n.addEventListener('scroll', fige); bloque.push(n); if (n.hasAttribute && n.hasAttribute('data-pg')) break; }
      const ins = () => { const i = opt.insets ? opt.insets() : null; return { t: (i && i.t) || 0, b: (i && i.b) || 0 }; };

      // les localités par nom : la ville d'une annonce devient un point réel
      const villes = {}; base.features.forEach(f => { if (f.properties.k === 'lieu') { const k = cle(f.properties.n); if (!villes[k] || f.properties.r < villes[k].r) villes[k] = { xy: f.geometry.coordinates, r: f.properties.r, n: f.properties.n }; } });
      const civ = base.features.find(f => f.properties.k === 'civ');
      let bb = [180, 90, -180, -90]; civ.geometry.coordinates.forEach(p => p[0].forEach(q => { bb = [Math.min(bb[0], q[0]), Math.min(bb[1], q[1]), Math.max(bb[2], q[0]), Math.max(bb[3], q[1])]; }));
      const regXY = s => { const r = A.REG[s]; return r ? [r[1], r[0]] : null; };
      // « Napié (près de Ferkessédougou) » : placée à la ville proche, signalée comme approximative
      const ou = x => { const pr = /\(près de ([^)]+)\)/.exec(x.city || ''), vp = pr && villes[cle(pr[1])]; if (vp) return { xy: vp.xy, approx: true, ville: vp.n }; const v = x.city && villes[cle(x.city)]; if (v) return { xy: v.xy, approx: false, ville: v.n }; const r = regXY(x.region); return r ? { xy: r, approx: true, ville: (A.REG[x.region] || [])[2] } : null; };

      const enLigne = () => navigator.onLine !== false;
      // une tuile en ligne qui échoue ne casse rien (la carte embarquée reste) ; on garde la trace pour le contrôle (MDGCarteGL.erreurs)
      const erreur = e => { const m = String((e && e.message) || e || ''); if (m && !/Failed to fetch|NetworkError|AbortError|aborted/i.test(m)) (window.MDGCarteGL.erreurs = window.MDGCarteGL.erreurs || []).push(m.slice(0, 200)); };
      const map = new ml.Map({ container: box, style: style(base, P), bounds: [[bb[0], bb[1]], [bb[2], bb[3]]], fitBoundsOptions: { padding: { top: ins().t + 20, bottom: ins().b + 20, left: 24, right: 24 } },
        minZoom: 4.6, maxZoom: 19, maxPitch: 0, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false, fadeDuration: 150 });
      // carte figée : vue du dessus, nord en haut ; on glisse et on zoome, on ne la tourne pas
      map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation();

      // contrôles : me localiser, tout le pays, jour/nuit, chaleur, zoomer
      const ui = document.createElement('div'); ui.className = 'cgl-ui'; box.appendChild(ui);
      const ic = d => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
      const I = n => window.MDGIco ? window.MDGIco.svg(n, 20, 2) : ic('');   // même jeu d'icônes que l'application (app/icones.js)
      const btn = (html, lab, fn, press) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; b.setAttribute('aria-label', lab); b.title = lab; if (press != null) b.setAttribute('aria-pressed', String(press));
        b.addEventListener('click', e => { e.stopPropagation(); fn(b); }); ui.appendChild(b); return b; };
      // une seule colonne à droite, au-dessus du panneau : se situer et l'affichage en haut, le zoom en bas (sous le pouce)
      btn(I('localiser'), 'Me localiser', () => localiser());
      btn(I('pays'), 'Tout le pays', () => { opt.onSelect && opt.onSelect(''); home(); });
      const bJour = btn(I('jour'), 'Carte de jour', b => { theme = theme === 'jour' ? 'nuit' : 'jour'; SS('mdg-carte:theme', theme); b.setAttribute('aria-pressed', String(theme === 'jour')); ambiance(); }, theme === 'jour');
      const bChal = btn(I('chaleur'), 'Chaleur de la demande', b => { chaleur = !chaleur; SS('mdg-carte:chaleur', chaleur ? 'oui' : 'non'); b.setAttribute('aria-pressed', String(chaleur)); map.setLayoutProperty('chaleur', 'visibility', chaleur ? 'visible' : 'none'); }, chaleur);
      const zp = btn(I('plus'), 'Zoomer', () => map.zoomIn()); zp.className = 'cgl-z1';
      const zm = btn(I('moins'), 'Dézoomer', () => map.zoomOut()); zm.className = 'cgl-z2';
      const etat = document.createElement('div'); etat.className = 'cgl-etat'; box.appendChild(etat);
      const ech = document.createElement('div'); ech.className = 'cgl-echelle'; box.appendChild(ech);
      // en haut à gauche : où l'on regarde, et l'état du réseau ; en bas à droite, sur la mer : les boutons (ils ne cachent pas le pays)
      const placer = () => { const i = ins(); etat.style.top = (i.t + 34) + 'px'; ech.style.top = (i.t + 4) + 'px'; ui.style.bottom = (i.b + 12) + 'px'; map.setPadding({ top: i.t + 30, bottom: i.b + 20, left: 0, right: 52 }); };
      const dire = (en, txt) => { etat.className = 'cgl-etat' + (en ? '' : ' hors'); etat.innerHTML = '<i></i>' + esc(txt); };

      // en ligne : relief (Terrarium) et rues, quartiers, bâtiments (OpenFreeMap) ; hors ligne : la carte embarquée seule
      let demOk = false, rues = false;
      function ajouterRelief() {
        if (demOk || !enLigne()) return;
        try {
          map.addSource('dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 12, attribution: 'Relief : Terrarium (AWS Open Data)' });
          map.addLayer({ id: 'relief', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': theme === 'jour' ? .35 : .5, 'hillshade-shadow-color': P.ombre, 'hillshade-highlight-color': theme === 'jour' ? 'rgba(255,255,255,.35)' : 'rgba(255,230,190,.12)', 'hillshade-accent-color': P.ombre } }, 'ville');
          demOk = true;
        } catch (_) {}
      }
      // le relief reste un ombrage (vue du dessus) : la profondeur sans inclinaison
      function appliquerRelief() {}
      function ajouterRues() {
        if (rues || !enLigne()) return;
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
        fetch('https://tiles.openfreemap.org/planet', { signal: ctl.signal }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(tj => {
          clearTimeout(t); if (!alive || rues) return; rues = true;
          // tuiles vectorielles OpenStreetMap (schéma OpenMapTiles) : chargées seulement pour la zone regardée, gardées ensuite dans le téléphone (sw.js)
          map.addSource('osm', { type: 'vector', tiles: tj.tiles, minzoom: tj.minzoom || 0, maxzoom: tj.maxzoom || 14, attribution: '© OpenStreetMap · OpenFreeMap' });
          const L = (o, avant) => { try { map.addLayer(o, avant); } catch (e) { erreur(e); } };
          const nom = ['coalesce', ['get', 'name:fr'], ['get', 'name']];
          const CL = { grandes: ['motorway', 'trunk', 'primary'], moyennes: ['secondary', 'tertiary'], petites: ['minor', 'service', 'street', 'residential', 'unclassified'], pistes: ['track', 'path', 'pedestrian'] };
          const larg = (a, b, c, d) => ['interpolate', ['exponential', 1.6], ['zoom'], 10, ['match', ['get', 'class'], CL.grandes, a[0], CL.moyennes, b[0], CL.petites, c[0], d[0]], 15, ['match', ['get', 'class'], CL.grandes, a[1], CL.moyennes, b[1], CL.petites, c[1], d[1]], 19, ['match', ['get', 'class'], CL.grandes, a[2], CL.moyennes, b[2], CL.petites, c[2], d[2]]];
          // le sol : quartiers d'habitation, commerces, parcs, bois, eau
          L({ id: 'osm-sol', type: 'fill', source: 'osm', 'source-layer': 'landuse', minzoom: 11, filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'industrial', 'school', 'hospital', 'cemetery', 'stadium'], true, false],
            paint: { 'fill-color': ['match', ['get', 'class'], ['commercial', 'retail'], P.solCom, ['industrial'], P.solInd, ['school', 'hospital'], P.solPub, ['cemetery'], P.parc, P.solHab], 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 1] } }, 'lac');
          L({ id: 'osm-parc', type: 'fill', source: 'osm', 'source-layer': 'park', minzoom: 11, paint: { 'fill-color': P.parc } }, 'lac');
          L({ id: 'osm-vert', type: 'fill', source: 'osm', 'source-layer': 'landcover', minzoom: 11, filter: ['match', ['get', 'class'], ['wood', 'grass', 'wetland'], true, false], paint: { 'fill-color': P.parc, 'fill-opacity': .7 } }, 'lac');
          L({ id: 'osm-eau', type: 'fill', source: 'osm', 'source-layer': 'water', minzoom: 8, paint: { 'fill-color': P.lac } }, 'fleuve');
          L({ id: 'osm-cours', type: 'line', source: 'osm', 'source-layer': 'waterway', minzoom: 12, paint: { 'line-color': P.lac, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, .6, 17, 3] } }, 'fleuve');
          // les bâtiments, un par un (vue du dessus : un aplat et un liseré)
          L({ id: 'osm-bati', type: 'fill', source: 'osm', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': P.bat, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, .9] } }, 'arcs');
          L({ id: 'osm-bati-bord', type: 'line', source: 'osm', 'source-layer': 'building', minzoom: 15.5, paint: { 'line-color': P.batBord, 'line-width': .6 } }, 'arcs');
          // les rues : bordure puis chaussée, des grands axes aux ruelles et pistes
          const routes = ['match', ['get', 'class'], [...CL.grandes, ...CL.moyennes, ...CL.petites, ...CL.pistes], true, false];
          L({ id: 'osm-rue-bord', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 13, filter: ['all', routes, ['!', ['match', ['get', 'class'], CL.pistes, true, false]]], layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': P.casing, 'line-width': larg([2.4, 16, 34], [1.6, 12, 26], [.8, 7, 18], [0, 0, 0]) } }, 'arcs');
          L({ id: 'osm-rue', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 10, filter: routes, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['match', ['get', 'class'], CL.grandes, P.r1, CL.moyennes, P.r2, CL.pistes, P.piste, P.r3],
              'line-width': larg([1.6, 13, 30], [.9, 9.5, 22], [.3, 5, 14], [.2, 1.4, 3.5]) } }, 'arcs');
          L({ id: 'osm-piste', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 14, filter: ['match', ['get', 'class'], CL.pistes, true, false], paint: { 'line-color': P.piste, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, .8, 19, 2.4], 'line-dasharray': [2, 1.5] } }, 'arcs');
          // les noms : quartiers, rues, lieux utiles, numéros de maison
          L({ id: 'osm-quartier', type: 'symbol', source: 'osm', 'source-layer': 'place', minzoom: 11, filter: ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet', 'isolated_dwelling'], true, false],
            layout: { 'text-field': nom, 'text-font': FONT_M, 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10.5, 16, 13.5], 'text-transform': 'uppercase', 'text-letter-spacing': .08, 'text-max-width': 8,
              'symbol-sort-key': ['match', ['get', 'class'], 'suburb', 0, 'quarter', 1, 'neighbourhood', 2, 3] },
            paint: { 'text-color': P.t3, 'text-halo-color': P.halo, 'text-halo-width': 1.4, 'text-opacity': ['step', ['zoom'], ['match', ['get', 'class'], ['suburb', 'village'], 1, 0], 13, 1] } }, 'lieu-point');
          L({ id: 'osm-nom-rue', type: 'symbol', source: 'osm', 'source-layer': 'transportation_name', minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': nom, 'text-font': FONT_R, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10.5, 18, 13], 'symbol-spacing': 280 },
            paint: { 'text-color': P.t2, 'text-halo-color': P.halo, 'text-halo-width': 1.4 } }, 'lieu-point');
          const UTILES = ['marketplace', 'grocery', 'shop', 'supermarket', 'school', 'college', 'university', 'place_of_worship', 'hospital', 'doctors', 'pharmacy', 'fuel', 'bank', 'bus', 'railway', 'police', 'townhall', 'post'];
          L({ id: 'osm-utile', type: 'symbol', source: 'osm', 'source-layer': 'poi', minzoom: 15, filter: ['all', ['has', 'name'], ['any', ['match', ['get', 'class'], UTILES, true, false], ['match', ['get', 'subclass'], ['marketplace', 'mosque', 'church'], true, false]]],
            layout: { 'text-field': nom, 'text-font': FONT_R, 'text-size': 11.5, 'text-max-width': 9, 'text-anchor': 'top', 'text-offset': [0, .55], 'symbol-sort-key': ['get', 'rank'] },
            paint: { 'text-color': ['match', ['get', 'subclass'], 'marketplace', P.marche, P.t2], 'text-halo-color': P.halo, 'text-halo-width': 1.4 } }, 'lieu-point');
          L({ id: 'osm-utile-pt', type: 'circle', source: 'osm', 'source-layer': 'poi', minzoom: 15, filter: ['all', ['has', 'name'], ['any', ['match', ['get', 'class'], UTILES, true, false], ['match', ['get', 'subclass'], ['marketplace', 'mosque', 'church'], true, false]]],
            paint: { 'circle-radius': ['match', ['get', 'subclass'], 'marketplace', 5, 3.2], 'circle-color': ['match', ['get', 'subclass'], 'marketplace', P.marche, ['match', ['get', 'class'], ['hospital', 'doctors', 'pharmacy'], '#E2735B', ['school', 'college', 'university'], '#6AAEF0', ['place_of_worship'], '#B095F0', P.t3]], 'circle-stroke-color': P.halo, 'circle-stroke-width': 1.2 } }, 'lieu-point');
          L({ id: 'osm-numero', type: 'symbol', source: 'osm', 'source-layer': 'housenumber', minzoom: 17, layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT_R, 'text-size': 10 }, paint: { 'text-color': P.t3, 'text-halo-color': P.halo, 'text-halo-width': 1.2 } }, 'lieu-point');
          ['route', 'route-bord'].forEach(id => map.setLayerZoomRange(id, 0, 10.5));   // de près, les rues d'OpenStreetMap prennent le relais
          majEtat();
        }).catch(() => { clearTimeout(t); majEtat(); });
      }
      const majEtat = () => dire(enLigne(), enLigne() ? (rues ? 'En ligne · relief et rues' : demOk ? 'En ligne · relief' : 'En ligne') : 'Hors connexion · carte embarquée');
      const surReseau = () => { majEtat(); if (enLigne()) { ajouterRelief(); appliquerRelief(false); ajouterRues(); } };
      addEventListener('online', surReseau); addEventListener('offline', majEtat);

      // nuit / jour : on recolore les calques sans recharger la carte
      function ambiance() {
        P = PAL[theme]; box.classList.toggle('jour', theme === 'jour');
        const set = (id, k, v) => { try { if (map.getLayer(id)) map.setPaintProperty(id, k, v); } catch (_) {} };
        set('fond', 'background-color', P.voisin); set('mer', 'fill-color', P.mer); set('civ', 'fill-color', P.civ); set('cote', 'line-color', P.fleuve);
        set('ville', 'fill-color', P.ville); set('lac', 'fill-color', P.lac); set('fleuve', 'line-color', P.fleuve); set('rail', 'line-color', P.rail);
        set('route-bord', 'line-color', P.casing); set('route', 'line-color', ['match', ['get', 'r'], 1, P.r1, 2, P.r2, P.r3]); set('trajet-bord', 'line-color', P.casing);
        ['route-nom', 'lieu-4', 'lieu-3', 'lieu-2', 'lieu-1', 'osm-quartier', 'osm-nom-rue'].forEach(id => set(id, 'text-halo-color', P.halo));
        set('route-nom', 'text-color', P.t2); set('lieu-4', 'text-color', P.t3); set('lieu-3', 'text-color', P.t2); set('lieu-2', 'text-color', P.t1); set('lieu-1', 'text-color', P.t1); set('lieu-point', 'circle-color', P.t3);
        set('osm-eau', 'fill-color', P.lac); set('osm-cours', 'line-color', P.lac); set('osm-parc', 'fill-color', P.parc); set('osm-vert', 'fill-color', P.parc); set('osm-bati-bord', 'line-color', P.batBord); set('osm-rue-bord', 'line-color', P.casing); set('osm-piste', 'line-color', P.piste);
        set('osm-sol', 'fill-color', ['match', ['get', 'class'], ['commercial', 'retail'], P.solCom, ['industrial'], P.solInd, ['school', 'hospital'], P.solPub, ['cemetery'], P.parc, P.solHab]);
        ['osm-utile', 'osm-numero'].forEach(id => set(id, 'text-halo-color', P.halo)); set('osm-numero', 'text-color', P.t3); set('osm-utile-pt', 'circle-stroke-color', P.halo); set('osm-rue', 'line-color', ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], P.r1, ['secondary', 'tertiary'], P.r2, ['track', 'path', 'pedestrian'], P.piste, P.r3]); set('osm-bati', 'fill-color', P.bat);
        set('osm-quartier', 'text-color', P.t3); set('osm-nom-rue', 'text-color', P.t2);
        set('relief', 'hillshade-shadow-color', P.ombre); set('relief', 'hillshade-accent-color', P.ombre); set('relief', 'hillshade-exaggeration', theme === 'jour' ? .35 : .5);
        appliquerRelief(false);
      }

      // annonces : bulles de prix par ville ; de loin, regroupées par district
      let data = { items: [], me: '', sel: '', zones: [] }, picked = [], markers = [], moiM = null, distM = null, gps = null, alive = true, pret = false;
      const Z_VILLE = 7.1;
      const court = (x) => { const off = x.kind === 'offre', p = off ? x.price : x.budget;
        if (off) return p ? '<b>' + fmt(p) + ' F</b><small>/' + esc(x.unit) + '</small>' : '<b>' + fmt(x.qty) + '</b><small>' + esc(x.unit) + '</small>';
        return '<small>cherche</small><b>' + fmt(x.qty) + '</b><small>' + esc(x.unit) + '</small>'; };
      // le moteur place chaque repère avec « transform » : le visuel (qui s'agrandit, s'anime) est un enfant, jamais le repère lui-même
      const enveloppe = el => { const w = document.createElement('div'); w.className = 'cgl-m'; w.appendChild(el); return w; };
      function dessinerAnnonces() {
        markers.forEach(m => m.remove()); markers = [];
        const z = map.getZoom(), groupes = {};
        (data.items || []).forEach(x => { const o = ou(x); if (!o) return;
          const k = z < Z_VILLE ? 'r:' + x.region : 'v:' + o.xy[0].toFixed(3) + ',' + o.xy[1].toFixed(3);
          const g = groupes[k] || (groupes[k] = { xy: z < Z_VILLE ? (regXY(x.region) || o.xy) : o.xy, items: [], approx: o.approx, region: x.region, ville: o.ville });
          g.items.push(x); });
        let G = Object.values(groupes);
        if (z >= Z_VILLE) {
          G.forEach(g => { const pt = map.project(g.xy); g.px = [pt.x, pt.y]; }); G.sort((a, b) => b.items.length - a.items.length);
          const garde = [];
          G.forEach(g => { const h = garde.find(k => Math.abs(k.px[0] - g.px[0]) < 104 && Math.abs(k.px[1] - g.px[1]) < 40);   // une bulle fait ≈ 100 × 34 px
            if (h) { h.items = h.items.concat(g.items); h.approx = h.approx || g.approx; h.ville = h.ville === g.ville ? h.ville : (h.ville + ', ' + g.ville); } else garde.push(Object.assign({}, g, { items: g.items.slice() })); });
          G = garde;
        }
        G.forEach(g => {
          const el = document.createElement('button'); el.type = 'button';
          const nO = g.items.filter(x => x.kind === 'offre').length, nD = g.items.length - nO, ids = g.items.map(x => x.id);
          if (z < Z_VILLE) {
            el.className = 'cgl-amas';
            el.innerHTML = (nO ? '<span><i class="cgl-s"></i><b>' + nO + '</b></span>' : '') + (nD ? '<span><i class="cgl-s d"></i><b>' + nD + '</b></span>' : '');
            el.setAttribute('aria-label', (nO ? nO + ' offre' + (nO > 1 ? 's' : '') : '') + (nO && nD ? ' et ' : '') + (nD ? nD + ' demande' + (nD > 1 ? 's' : '') : '') + ' près de ' + ((A.REG[g.region] || [])[2] || ''));
            el.addEventListener('click', e => { e.stopPropagation(); opt.onSelect && opt.onSelect(g.region); map.flyTo({ center: g.xy, zoom: 9, duration: MOTION() ? 1100 : 0, essential: true }); });
          } else {
            const sel = ids.some(id => picked.includes(id)), seul = g.items.length === 1, x = g.items[0];
            // sceau « identité vérifiée » (v3/statuts.js) : sur la bulle d'un membre vérifié, ou d'un groupe qui en contient un
            const verif = y => !!(y.uid && window.MDGStatut && MDGStatut.estVerifie(y.uid)), nV = g.items.filter(verif).length;
            const SCEAU = '<span class="cgl-v" title="Identité vérifiée"><svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.6l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.2L12 22.4l-2.6-1.9-3.2.2-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.2z"/><path d="m8 12.2 2.7 2.7L16.2 9.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
            el.className = 'cgl-pill' + (seul && x.kind !== 'offre' ? ' d' : '') + (g.approx ? ' approx' : '') + (sel ? ' sel' : '');
            if (seul) el.innerHTML = '<i class="' + (x.kind === 'offre' ? '' : 'd') + '"></i>' + court(x) + (nV ? SCEAU : '');
            else { const prix = g.items.filter(y => y.kind === 'offre' && y.price).map(y => y.price), mini = prix.length ? Math.min(...prix) : null;
              el.innerHTML = (nO ? '<i></i>' : '') + (nD ? '<i class="d"></i>' : '') + '<b>' + g.items.length + '</b>' + (mini ? '<small>dès ' + fmt(mini) + ' F</small>' : '<small>annonces</small>') + (nV ? SCEAU : ''); }
            el.setAttribute('aria-label', g.items.map(y => (y.kind === 'offre' ? 'Offre ' : 'Demande ') + y.product + ', ' + fmt(y.qty) + ' ' + y.unit).join(' ; ') + ' · ' + (g.ville || '') + (g.approx ? ' (position approchée : chef-lieu)' : '') + (nV ? (seul ? ' · identité vérifiée' : ' · dont ' + nV + ' vérifié' + (nV > 1 ? 's' : '')) : ''));
            el.addEventListener('click', e => { e.stopPropagation(); choisir(ids, g.xy); });
          }
          const m = new ml.Marker({ element: enveloppe(el), anchor: 'bottom', offset: z < Z_VILLE ? [0, -6] : [0, -6] }).setLngLat(g.xy).addTo(map); m.getElement().style.zIndex = g.items.some(y => picked.includes(y.id)) ? 5 : 1; markers.push(m);
        });
        // zones de forte demande (administration) : le halo est sur la carte (calque « zone-halo ») ;
        // ici, une petite pastille 🔥 posée AU-DESSUS du point : le nom de la ville, écrit dessous, reste lisible ;
        // une bulle d'annonce au même endroit passe devant
        const zf = [];
        (data.zones || []).forEach(zn => { const v = zn.city && villes[cle(zn.city)], xy = v ? v.xy : regXY(zn.region); if (!xy) return;
          zf.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: xy } });
          const el = document.createElement('div'); el.className = 'cgl-feu'; const txt = zn.label ? 'Forte demande : ' + zn.label : 'Forte demande';
          el.innerHTML = (z >= Z_VILLE + 1.4 ? '<b>' + esc(zn.label || 'Forte demande') + '</b>' : '') + '<span>' + (window.MDGIco ? MDGIco.svg('chaleur', 15, 2.2) : '') + '</span>'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', txt);
          const m = new ml.Marker({ element: enveloppe(el), anchor: 'bottom', offset: [0, -3] }).setLngLat(xy).addTo(map); m.getElement().style.zIndex = 0; markers.push(m); });
        map.getSource('zones').setData({ type: 'FeatureCollection', features: zf });
      }
      function choisir(ids, xy) {
        picked = ids; dessinerAnnonces(); calques(); opt.onPick && opt.onPick(ids);
        const z = Math.max(map.getZoom(), 9.5);
        map.easeTo({ center: xy, zoom: z, duration: MOTION() ? 700 : 0, essential: true });
        tracer(xy);
      }

      // moi : ma position (GPS précis, ou mon district) ; distance et trajet vers l'annonce choisie
      const moiXY = () => gps || regXY(data.me);
      function dessinerMoi() {
        if (moiM) { moiM.remove(); moiM = null; }
        const xy = moiXY(); if (!xy) { map.getSource('moi').setData(vide()); return; }
        const el = document.createElement('div'); el.className = 'cgl-moi'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', gps ? 'Votre position' : 'Votre district');
        moiM = new ml.Marker({ element: el }).setLngLat(xy).addTo(map);
        map.getSource('moi').setData({ type: 'FeatureCollection', features: gps ? [] : [{ type: 'Feature', properties: { rayon: 40 }, geometry: { type: 'Point', coordinates: xy } }] });
      }
      let trajetN = 0;
      function tracer(xy) {
        if (distM) { distM.remove(); distM = null; }
        const a = moiXY(); if (!a || !xy || (a[0] === xy[0] && a[1] === xy[1])) { map.getSource('trajet').setData(vide()); return; }
        const d = km(a, xy), n = ++trajetN, mid = [(a[0] + xy[0]) / 2, (a[1] + xy[1]) / 2];
        map.getSource('trajet').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { route: 0 }, geometry: { type: 'LineString', coordinates: [a, xy] } }] });
        const el = document.createElement('div'); el.className = 'cgl-dist'; el.textContent = '≈ ' + d + ' km à vol d’oiseau';
        distM = new ml.Marker({ element: el, anchor: 'top', offset: [0, 10] }).setLngLat(mid).addTo(map);
        if (!enLigne() || d < 2) return;
        // en ligne : le trajet par la route (OSRM), entre les points affichés — donc approché lui aussi
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
        fetch('https://router.project-osrm.org/route/v1/driving/' + a[0].toFixed(5) + ',' + a[1].toFixed(5) + ';' + xy[0].toFixed(5) + ',' + xy[1].toFixed(5) + '?overview=simplified&geometries=geojson', { signal: ctl.signal })
          .then(r => r.ok ? r.json() : Promise.reject(r.status)).then(j => { clearTimeout(t); if (!alive || n !== trajetN || !j.routes || !j.routes[0]) return;
            const r = j.routes[0], h = r.duration / 3600;
            map.getSource('trajet').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { route: 1 }, geometry: r.geometry }] });
            const c = r.geometry.coordinates[Math.floor(r.geometry.coordinates.length / 2)];
            el.textContent = '≈ ' + Math.round(r.distance / 1000) + ' km par la route · ' + (h < 1 ? Math.round(h * 60) + ' min' : Math.floor(h) + ' h ' + String(Math.round((h % 1) * 60)).padStart(2, '0'));
            distM.setLngLat(c); })
          .catch(() => clearTimeout(t));
      }
      function localiser() {
        const dire = t => { try { window.MDGToast && MDGToast.dire(t, { type: 'info' }); } catch (_) {} };   // même message que la carte simple
        if (!navigator.geolocation) { dire('Localisation indisponible : choisissez votre région'); return; }
        navigator.geolocation.getCurrentPosition(p => { gps = [p.coords.longitude, p.coords.latitude]; dessinerMoi(); map.flyTo({ center: gps, zoom: Math.max(map.getZoom(), 10), duration: MOTION() ? 1200 : 0 });
          opt.onLocate && opt.onLocate(p.coords.latitude, p.coords.longitude); }, () => dire('Position refusée : choisissez votre région'), { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
      }

      // calques de données : chaleur de la demande, liens offre ↔ demande
      function calques() {
        const D = (data.items || []).filter(x => x.kind !== 'offre'), mx = Math.max(1, ...D.map(x => x.qty || 1));
        map.getSource('heat').setData({ type: 'FeatureCollection', features: D.map(x => { const o = ou(x); return o && { type: 'Feature', properties: { w: .25 + .75 * Math.log(1 + (x.qty || 1)) / Math.log(1 + mx) }, geometry: { type: 'Point', coordinates: o.xy } }; }).filter(Boolean) });
        const O = (data.items || []).filter(x => x.kind === 'offre'), arcs = [], vu = {}, pk = new Set(picked.concat(data.lier || []));
        O.forEach(o => D.forEach(d => { if (o.slug !== d.slug || (o.uid && o.uid === d.uid) || !(pk.has(o.id) || pk.has(d.id))) return; const a = ou(o), b = ou(d); if (!a || !b) return;
          const k = a.xy.join() + '>' + b.xy.join(); if (vu[k] || km(a.xy, b.xy) < 5) return; vu[k] = 1;
          const pts = [], dx = b.xy[0] - a.xy[0], dy = b.xy[1] - a.xy[1], L = Math.hypot(dx, dy), c = [(a.xy[0] + b.xy[0]) / 2 - dy * .22, (a.xy[1] + b.xy[1]) / 2 + dx * .22];
          for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; pts.push([u * u * a.xy[0] + 2 * u * t * c[0] + t * t * b.xy[0], u * u * a.xy[1] + 2 * u * t * c[1] + t * t * b.xy[1]]); }
          arcs.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } }); }));
        map.getSource('arcs').setData({ type: 'FeatureCollection', features: arcs });
      }

      // la vue « tout le pays » : le pays occupe toute la largeur libre ; c'est aussi la limite : on ne dézoome pas plus loin,
      // on ne glisse pas au-delà (pas d'océan ni de pays voisins à perte de vue)
      let vuePays = null;
      function cadrer() {
        map.setMaxBounds(null); map.setMinZoom(0);
        const c = map.cameraForBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { top: 4, bottom: 4, left: 16, right: 16 } });
        if (!c) return;
        const avant = { center: map.getCenter(), zoom: map.getZoom() };
        map.jumpTo({ center: c.center, zoom: c.zoom, bearing: 0, pitch: 0 });
        const b = map.getBounds(), mx = (b.getEast() - b.getWest()) * .04, my = (b.getNorth() - b.getSouth()) * .04;
        vuePays = c;
        map.setMinZoom(c.zoom - .02);
        map.setMaxBounds([[b.getWest() - mx, b.getSouth() - my], [b.getEast() + mx, b.getNorth() + my]]);
        if (pret && avant.zoom > c.zoom + .05) map.jumpTo(avant);
      }
      function home(dur) { if (!vuePays) cadrer(); if (!vuePays) return; map.easeTo({ center: vuePays.center, zoom: vuePays.zoom, bearing: 0, pitch: 0, duration: dur != null ? dur : MOTION() ? 800 : 0 }); }
      const echelle = () => { const z = map.getZoom(), c = map.getCenter(), lat = c.lat;
        let best = null, bk = 1e9; Object.keys(A.REG).forEach(k => { const R = A.REG[k], d = km([c.lng, c.lat], [R[1], R[0]]); if (d < bk) { bk = d; best = R; } });
        ech.textContent = z < 6.4 ? 'Tout le pays' : z < 7.6 ? ((lat > 8.6 ? 'Nord' : lat < 6.4 ? 'Sud' : 'Centre') + (c.lng < -6.3 ? '-ouest' : c.lng > -4.6 ? '-est' : '') + ' du pays') : best ? (bk < 15 ? 'Autour de ' : 'Près de ') + best[2] : ''; };

      let zPrec = null;
      map.on('zoomend', () => { zPrec = map.getZoom(); dessinerAnnonces(); });
      const surStatuts = () => { if (alive && pret) dessinerAnnonces(); }; addEventListener('mdg:rep', surStatuts);   // les sceaux arrivent après les annonces   // les bulles se regroupent ou se séparent selon le zoom
      map.on('moveend', echelle);
      map.on('click', () => { if (picked.length) { picked = []; dessinerAnnonces(); calques(); opt.onPick && opt.onPick([]); tracer(null); } });
      map.on('error', e => erreur(e && e.error));   // une tuile en ligne qui échoue ne casse rien : la carte embarquée reste
      map.once('load', () => {
        placer(); cadrer(); pret = true; majEtat(); dessinerMoi(); calques(); dessinerAnnonces(); echelle();
        if (chaleur) map.setLayoutProperty('chaleur', 'visibility', 'visible');
        if (enLigne()) { ajouterRelief(); ajouterRues(); }
        appliquerRelief(false);
        requestAnimationFrame(() => box.classList.add('on')); window.MDGCarteGL.actif = api;
        resolve(api);
      });
      setTimeout(() => { if (!box.classList.contains('on')) resolve(null); }, 15000);   // trop lent : on garde la carte Canvas

      const api = {
        set(d) {
          const prev = data; data = Object.assign({ items: [], me: '', sel: '', zones: [] }, d || {});
          if (!pret) return;   // avant le chargement, on garde les données ; « load » les dessinera
          if (data.me !== prev.me) { dessinerMoi(); }
          calques(); dessinerAnnonces();
          if (data.sel && data.sel !== prev.sel) { const xy = regXY(data.sel); if (xy) map.flyTo({ center: xy, zoom: 8.6, duration: MOTION() ? 1100 : 0, essential: true }); }
          else if (!data.sel && prev.sel) home();
        },
        relayout() { placer(); map.resize(); cadrer(); },
        home, localiser,
        voir(lng, lat, z) { map.jumpTo({ center: [lng, lat], zoom: z == null ? 15 : z }); },
        pick(ids) { picked = ids || []; dessinerAnnonces(); calques(); if (!picked.length) tracer(null); },
        destroy() { bloque.forEach(n => n.removeEventListener('scroll', fige)); alive = false; removeEventListener('mdg:rep', surStatuts); removeEventListener('online', surReseau); removeEventListener('offline', majEtat); markers.forEach(m => m.remove()); if (moiM) moiM.remove(); if (distM) distM.remove(); try { map.remove(); } catch (_) {} box.remove(); }
      };
    })).catch(() => null);
  }

  window.MDGCarteGL = { capable, mount };
})();
