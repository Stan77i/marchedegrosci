/* ═════════ Marché de Gros CI — la carte de suivi d'une commande ═════════
   Une petite carte MapLibre (déjà dans vendor/, chargée seulement à l'ouverture) avec :
     • l'itinéraire, calculé UNE fois par commande par la fonction Edge « itineraire » (openrouteservice) ;
       s'il n'a pas pu être calculé, une ligne pointillée « à vol d'oiseau » le dit clairement ;
     • le départ et la livraison ;
     • le camion (avec le sac) à la DERNIÈRE position reçue du serveur, et la trace récente ;
       au-delà de 5 min sans position, le camion pâlit et le texte dit « position non actualisée ».
   Rien n'est animé entre deux positions : on ne fait pas croire à un suivi en direct qu'on n'a pas.
   Fond de carte : OpenFreeMap (gratuit, sans clé ; © OpenMapTiles, données © OpenStreetMap), tuiles gardées par sw.js.
   API : MDGSuivi.monter(div, commande) → Promise<{ el, legende, onLegende, maj(pos), redim(), detruire() }> ; MDGSuivi.texte(pos)
   La div est créée par l'appelant : il peut la déplacer d'un rendu à l'autre sans recréer la carte. */
(function () {
  'use strict';
  if (window.MDGSuivi) return;
  const N = () => window.MDGNuage;
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const VIEUX = 5 * 60 * 1000;
  const MOUV = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ilya = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'le ' + new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const kmTxt = m => m == null ? '' : m >= 10000 ? Math.round(m / 1000) + ' km' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  const dureeTxt = s => { if (s == null) return ''; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + String(m).padStart(2, '0') : m + ' min'; };

  let libP = null;
  function lib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    return libP || (libP = new Promise((ok, ko) => {
      if (!document.querySelector('link[href$="maplibre-gl.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/maplibre/maplibre-gl.css'; document.head.appendChild(l); }
      const s = document.createElement('script'); s.src = 'vendor/maplibre/maplibre-gl.js'; s.onload = () => window.maplibregl ? ok(window.maplibregl) : ko(new Error('maplibre'));
      s.onerror = e => { libP = null; ko(e); }; document.head.appendChild(s);
    }));
  }

  const CSS = `.sv{position:relative;height:240px;border-radius:18px;overflow:hidden;background:#E7E0CF;margin:0 0 6px}
.sv .maplibregl-ctrl-attrib{font-size:10px}
.sv-camion{width:58px;height:40px;position:relative;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:filter .3s,opacity .3s}
.sv-camion.vieux{filter:grayscale(1);opacity:.55}
.sv-camion .sac{position:absolute;left:4px;bottom:13px;width:24px;height:24px}.sv-camion .sac svg{width:24px;height:24px}
.sv-pt{width:16px;height:16px;border-radius:50%;border:3px solid #FFFDF8;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.sv-pt.d{background:#10392B}.sv-pt.a{background:#F2C230}
.sv-voile{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:16px;color:#5E5546;font-size:13.5px}`;
  function css() { if (document.getElementById('svCss')) return; const s = document.createElement('style'); s.id = 'svCss'; s.textContent = CSS; document.head.appendChild(s); }
  const CAMION = `<svg viewBox="0 0 150 96" width="58" height="40" aria-hidden="true"><rect x="4" y="52" width="92" height="22" rx="4" fill="#10392B"/><path d="M96 34h26l18 20v20H96z" fill="#10392B"/><path d="M102 40h17l12 14h-29z" fill="#BFD8CB"/><circle cx="28" cy="78" r="11" fill="#171512"/><circle cx="116" cy="78" r="11" fill="#171512"/><rect x="4" y="50" width="92" height="4" rx="2" fill="#F2C230"/></svg>`;

  // le texte qui accompagne la carte : toujours l'heure réelle de la dernière position
  function texte(pos) {
    const d = pos && pos.derniere;
    if (!d) return { t: 'Le chauffeur ne partage pas sa position : le suivi se fait par étapes, avec leur heure.', vieux: true };
    const age = Date.now() - new Date(d.at);
    return age > VIEUX ? { t: 'Position non actualisée depuis ' + ilya(d.at).replace('il y a ', '') + '. Le camion est montré où il était.', vieux: true }
      : { t: 'Position du camion : ' + ilya(d.at) + (d.precision ? ' (à ' + Math.round(d.precision) + ' m près)' : '') + '.', vieux: false };
  }

  async function itineraire(id) {
    try { return await N().api('/functions/v1/itineraire', { method: 'POST', body: { commande_id: id }, auth: true }); }
    catch (_) { return null; }
  }

  async function monter(el, c) {
    css();
    el.className = 'sv'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Carte du trajet de la commande');
    el.innerHTML = `<div class="sv-voile">${window.MDGSac ? MDGSac.charge('La carte se prépare…', { t: 54 }) : 'La carte se prépare…'}</div>`;
    if (navigator.onLine === false) { el.querySelector('.sv-voile').textContent = 'Hors connexion : la carte reviendra avec le réseau.'; return { el, maj() {}, redim() {}, detruire() {}, legende: '' }; }
    let gl; try { gl = await lib(); } catch (_) { el.querySelector('.sv-voile').textContent = 'La carte ne peut pas s’afficher sur ce téléphone. Le suivi par étapes reste disponible.'; return { el, maj() {}, redim() {}, detruire() {}, legende: '' }; }
    const map = new gl.Map({ container: el, style: STYLE, center: [-5.55, 7.54], zoom: 5.3, attributionControl: { compact: true, customAttribution: 'Itinéraire © openrouteservice' },
      dragRotate: false, pitchWithRotate: false, touchPitch: false, cooperativeGestures: false });
    map.touchZoomRotate.disableRotation();
    let camion = null, dernier = null, it = null, pret = false;
    const api = { el, legende: '', maj, redim: () => { try { map.resize(); } catch (_) {} }, detruire: () => { try { map.remove(); } catch (_) {} } };
    map.on('error', () => {});
    map.on('load', async () => {
      pret = true;
      const v = el.querySelector('.sv-voile'); if (v) v.remove();
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-bord', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFDF8', 'line-width': 7 } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', filter: ['!=', ['get', 'vol'], 1], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#10392B', 'line-width': 4 } });
      map.addLayer({ id: 'route-vol', type: 'line', source: 'route', filter: ['==', ['get', 'vol'], 1], paint: { 'line-color': '#10392B', 'line-width': 3, 'line-dasharray': [1.5, 1.5] } });
      map.addSource('trace', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'trace', type: 'line', source: 'trace', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#C9A24A', 'line-width': 3, 'line-opacity': .9 } });
      it = await itineraire(c.id);
      if (it && it.ligne && it.ligne.length > 1) {
        map.getSource('route').setData({ type: 'Feature', properties: { vol: it.source === 'vol_oiseau' ? 1 : 0 }, geometry: { type: 'LineString', coordinates: it.ligne } });
        const pt = (cls, ll) => { const d = document.createElement('div'); d.className = 'sv-pt ' + cls; new gl.Marker({ element: d }).setLngLat(ll).addTo(map); };
        if (it.depart) pt('d', it.depart); if (it.arrivee) pt('a', it.arrivee);
      }
      api.legende = !it ? 'Itinéraire indisponible pour l’instant.' : it.erreur ? 'Itinéraire indisponible : ' + it.erreur
        : it.source === 'ors' ? 'Itinéraire routier pour camion' + (it.distance_m ? ' · ' + kmTxt(it.distance_m) : '') + (it.duree_s ? ' · environ ' + dureeTxt(it.duree_s) + ' sans arrêt' : '')
        : it.source === 'vol_oiseau' ? 'Ligne à vol d’oiseau (' + kmTxt(it.distance_m) + ') : l’itinéraire routier n’a pas pu être calculé.'
        : 'Départ ou livraison introuvable sur la carte : itinéraire non tracé.';
      if (api.onLegende) api.onLegende(api.legende);
      if (dernier) maj(dernier); else cadrer();
    });
    function cadrer() {
      if (!pret) return;
      const pts = [].concat(it && it.ligne ? it.ligne : [], dernier && dernier.derniere ? [[dernier.derniere.lon, dernier.derniere.lat]] : []);
      if (!pts.length) return;
      const b = pts.reduce((bb, p) => bb.extend(p), new gl.LngLatBounds(pts[0], pts[0]));
      try { map.fitBounds(b, { padding: 36, maxZoom: 13, duration: MOUV() ? 600 : 0 }); } catch (_) {}
    }
    function maj(pos) {
      dernier = pos; if (!pret) return;
      const d = pos && pos.derniere;
      if (pos && pos.trace && pos.trace.length > 1) map.getSource('trace').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pos.trace } });
      if (d) {
        if (!camion) {
          const e = document.createElement('div'); e.className = 'sv-camion';
          e.innerHTML = CAMION + `<div class="sac">${window.MDGSac ? MDGSac.svg('plein', { t: 24 }) : ''}</div>`;
          camion = new gl.Marker({ element: e, anchor: 'bottom' }).setLngLat([d.lon, d.lat]).addTo(map);
          cadrer();
        } else camion.setLngLat([d.lon, d.lat]);
        camion.getElement().classList.toggle('vieux', texte(pos).vieux);
        camion.getElement().title = texte(pos).t;
      }
    }
    return api;
  }

  window.MDGSuivi = { monter, texte };
})();
