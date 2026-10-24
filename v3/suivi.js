/* ═════════ Marché de Gros CI — la carte de suivi d'une commande ═════════
   Comme une application de course : un seul tracé (déjà parcouru en gris, reste à faire en vert), le camion vu du dessus
   POSÉ SUR LA ROUTE et tourné dans le sens de la marche, le sac sur la remorque, la livraison au bout.
   Au-dessus de la carte : l'heure réelle de la dernière position ; en bas : distance restante et heure d'arrivée estimée.
   Honnêteté :
     • le camion est posé sur la route seulement si la vraie position en est à moins de 250 m ; sinon il est montré où il est ;
     • rien ne bouge entre deux positions reçues du serveur ; au-delà de 5 min, le camion pâlit et le texte le dit ;
     • si le trajet routier n'a pas pu être calculé, le tracé est pointillé et marqué « approximatif ».
   Carte MapLibre (vendor/), fond OpenFreeMap « positron » (gratuit, sans clé). Les crédits obligatoires des données
   (OpenStreetMap…) restent accessibles derrière le petit « i » replié de la carte, sans texte affiché.
   API : MDGSuivi.monter(div, commande) → Promise<{ el, maj(pos), redim(), detruire() }> ; MDGSuivi.texte(pos)
   La div est créée par l'appelant : il peut la déplacer d'un rendu à l'autre sans recréer la carte. */
(function () {
  'use strict';
  if (window.MDGSuivi) return;
  const N = () => window.MDGNuage;
  const STYLE = 'https://tiles.openfreemap.org/styles/positron';
  const VIEUX = 5 * 60 * 1000, COLLE = 250;
  const MOUV = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ilya = t => { const s = Math.round((Date.now() - new Date(t)) / 1000); return s < 60 ? 'il y a ' + Math.max(s, 1) + ' s' : s < 3600 ? 'il y a ' + Math.round(s / 60) + ' min' : s < 86400 ? 'il y a ' + Math.round(s / 3600) + ' h' : 'le ' + new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const kmTxt = m => m == null ? '' : m >= 10000 ? Math.round(m / 1000) + ' km' : m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m';
  const dureeTxt = x => { const h = Math.floor(x / 3600), m = Math.round((x % 3600) / 60); return h ? h + ' h ' + String(m).padStart(2, '0') : m + ' min'; };
  const heure = d => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ——— géométrie simple (distances en mètres, assez précise à l'échelle d'un trajet) ———
  const R = Math.PI / 180;
  const metres = (a, b) => { const x = Math.sin((b[1] - a[1]) * R / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin((b[0] - a[0]) * R / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(x)); };
  const cap = (a, b) => { const y = Math.sin((b[0] - a[0]) * R) * Math.cos(b[1] * R), x = Math.cos(a[1] * R) * Math.sin(b[1] * R) - Math.sin(a[1] * R) * Math.cos(b[1] * R) * Math.cos((b[0] - a[0]) * R); return (Math.atan2(y, x) / R + 360) % 360; };
  // le point du tracé le plus proche d'une position : segment, point projeté, distance
  function surRoute(L, p) {
    let best = null;
    const k = Math.cos(p[1] * R);
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1], ax = (b[0] - a[0]) * k, ay = b[1] - a[1], px = (p[0] - a[0]) * k, py = p[1] - a[1];
      const t = Math.max(0, Math.min(1, (px * ax + py * ay) / ((ax * ax + ay * ay) || 1e-12)));
      const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d = metres(q, p);
      if (!best || d < best.d) best = { i, q, d };
    }
    return best;
  }
  const longueur = L => { let s = 0; for (let i = 0; i < L.length - 1; i++) s += metres(L[i], L[i + 1]); return s; };

  let libP = null;
  function lib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    return libP || (libP = new Promise((ok, ko) => {
      if (!document.querySelector('link[rel="stylesheet"][href$="maplibre-gl.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/maplibre/maplibre-gl.css'; document.head.appendChild(l); }
      const s = document.createElement('script'); s.src = 'vendor/maplibre/maplibre-gl.js'; s.onload = () => window.maplibregl ? ok(window.maplibregl) : ko(new Error('maplibre'));
      s.onerror = e => { libP = null; ko(e); }; document.head.appendChild(s);
    }));
  }

  const CSS = `.sv{position:relative;height:340px;margin:0 -18px 10px;overflow:hidden;background:#EEF0EC}
.sv .sv-carte{position:absolute;inset:0;width:100%;height:100%}
.sv .maplibregl-ctrl-attrib.maplibregl-compact{min-height:24px;background:rgba(255,253,248,.85)}
.sv .maplibregl-ctrl-bottom-right{bottom:84px}
.sv-haut{position:absolute;left:12px;top:12px;right:12px;display:flex;pointer-events:none}
.sv-puce{display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:0 14px 0 12px;border-radius:17px;background:#FFFDF8;color:#171512;font:600 13.5px Jost,sans-serif;box-shadow:0 2px 10px rgba(23,21,18,.16)}
.sv-puce i{width:9px;height:9px;border-radius:50%;background:#2FA36B;box-shadow:0 0 0 0 rgba(47,163,107,.5)}
.sv-puce.frais i{animation:svPouls 2s ease-out 2}.sv-puce.vieux i{background:#B5AE9F}
@keyframes svPouls{70%{box-shadow:0 0 0 8px rgba(47,163,107,0)}100%{box-shadow:0 0 0 0 rgba(47,163,107,0)}}
.sv-bas{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:#10392B;color:#F3EFE4;box-shadow:0 6px 18px rgba(16,57,43,.32)}
.sv-bas b{display:block;font:800 22px/1.05 Jost,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.sv-bas small{display:block;color:rgba(243,239,228,.78);font-size:12.5px;margin-top:2px}
.sv-bas .eta{margin-left:auto;text-align:right}.sv-bas .eta b{color:#F2C230}
.sv-camion{width:30px;height:56px;filter:drop-shadow(0 3px 4px rgba(16,57,43,.4));transition:opacity .3s,filter .3s}
.sv-camion.vieux{opacity:.5;filter:grayscale(1)}
.sv-arrivee{display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)}
.sv-arrivee span{padding:4px 10px;border-radius:12px;background:#F2C230;color:#10392B;font:700 12px Jost,sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.sv-arrivee i{width:3px;height:10px;background:#10392B}.sv-arrivee em{width:12px;height:12px;border-radius:50%;background:#10392B;border:3px solid #FFFDF8;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.sv.arrive .sv-arrivee em{animation:svOnde 1.6s ease-out 3}
@keyframes svOnde{0%{box-shadow:0 0 0 0 rgba(242,194,48,.75)}100%{box-shadow:0 0 0 18px rgba(242,194,48,0)}}
.sv-bas .sac{width:44px;height:44px;flex:none}.sv-bas .sac svg{width:44px;height:44px}
.sv.arrive .sv-bas .sac{animation:svSaut 1.1s ease-in-out 2}
@keyframes svSaut{30%{transform:translateY(-10px) rotate(-6deg)}60%{transform:translateY(0)}75%{transform:translateY(-4px)}}
.sv-depart{width:12px;height:12px;border-radius:50%;background:#FFFDF8;border:3px solid #9AA59F}
.sv [hidden]{display:none!important}
.sv-voile{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:16px;color:#5E5546;font-size:13.5px}
@media (prefers-reduced-motion:reduce){.sv-puce.frais i,.sv.arrive .sv-arrivee em,.sv.arrive .sv-bas .sac{animation:none}}`;
  function css() { if (document.getElementById('svCss')) return; const s = document.createElement('style'); s.id = 'svCss'; s.textContent = CSS; document.head.appendChild(s); }

  // le camion vu du dessus, cabine vers le haut (le marqueur tourne avec la route) ; le sac de jute posé sur la remorque
  const CAMION = `<svg viewBox="0 0 40 74" width="30" height="56" aria-hidden="true">
    <rect x="5" y="22" width="30" height="50" rx="5" fill="#10392B"/><rect x="8" y="25" width="24" height="44" rx="3" fill="#1B4D3B"/>
    <rect x="5" y="22" width="30" height="3" fill="#F2C230"/>
    <rect x="8" y="3" width="24" height="18" rx="6" fill="#10392B"/><rect x="10.5" y="5" width="19" height="6" rx="2.5" fill="#BFD8CB"/>
    <rect x="4" y="9" width="3" height="5" rx="1.5" fill="#10392B"/><rect x="33" y="9" width="3" height="5" rx="1.5" fill="#10392B"/>
    <ellipse cx="20" cy="47" rx="10.5" ry="12" fill="#B08A57"/><ellipse cx="20" cy="47" rx="7.5" ry="8.6" fill="#C9A46A"/>
    <path d="M14 47c2-3 10-3 12 0" stroke="#8C6B3E" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="16.5" cy="44" r="2.2" fill="#E2573B"/><circle cx="21" cy="42.5" r="2.2" fill="#6CC58C"/><circle cx="24" cy="45.5" r="2.2" fill="#F2C230"/></svg>`;

  function texte(pos) {
    const d = pos && pos.derniere;
    if (!d) return { t: 'Le chauffeur ne partage pas sa position : le suivi se fait par étapes, avec leur heure.', vieux: true, court: 'Suivi par étapes' };
    const age = Date.now() - new Date(d.at);
    return age > VIEUX ? { t: 'Position non actualisée depuis ' + ilya(d.at).replace('il y a ', '') + '. Le camion est montré où il était.', vieux: true, court: 'Dernière position ' + ilya(d.at) }
      : { t: 'Position du camion ' + ilya(d.at) + (d.precision ? ', à ' + Math.round(d.precision) + ' m près' : '') + '.', vieux: false, court: 'Position ' + ilya(d.at) };
  }

  async function itineraire(id) {
    try { return await N().api('/functions/v1/itineraire', { method: 'POST', body: { commande_id: id }, auth: true }); }
    catch (_) { return null; }
  }

  async function monter(el, c) {
    css();
    el.className = 'sv';
    el.innerHTML = `<div class="sv-carte" role="img" aria-label="Carte du trajet : départ, livraison et position du camion"></div>
      <div class="sv-voile">${window.MDGSac ? MDGSac.charge('La carte se prépare…', { t: 54 }) : 'La carte se prépare…'}</div>
      <div class="sv-haut" hidden><span class="sv-puce"><i></i><span data-sv-puce></span></span></div>
      <div class="sv-bas" hidden><div><b data-sv-km></b><small data-sv-km2></small></div><div class="eta"><b data-sv-eta></b><small data-sv-eta2></small></div></div>`;
    const voile = el.querySelector('.sv-voile'), vide = { el, maj() {}, etape() {}, redim() {}, detruire() {} };
    if (navigator.onLine === false) { voile.textContent = 'Hors connexion : la carte reviendra avec le réseau.'; return vide; }
    let gl; try { gl = await lib(); } catch (_) { voile.textContent = 'La carte ne peut pas s’afficher sur ce téléphone. Le suivi par étapes reste disponible.'; return vide; }
    const map = new gl.Map({ container: el.querySelector('.sv-carte'), style: STYLE, center: [-5.55, 7.54], zoom: 5.3, attributionControl: false,
      dragRotate: false, pitchWithRotate: false, touchPitch: false });
    map.touchZoomRotate.disableRotation();
    // crédits des données : obligatoires, mais repliés derrière le « i »
    map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
    let camion = null, dernier = null, L = null, approx = false, it = null, pret = false, total = null, touche = false, ici0 = null, etapeC = null;
    const api = { el, maj, etape: e => { const avant = etapeC; etapeC = e; el.classList.toggle('arrive', e === 'arrivee'); if (avant !== e && pret) maj(dernier); }, redim: () => { try { map.resize(); } catch (_) {} if (!touche) cadrer(ici0); }, detruire: () => { clearTimeout(delai); try { map.remove(); } catch (_) {} } };
    // dès que la personne déplace ou zoome la carte, on ne recadre plus à sa place
    ['dragstart', 'zoomstart'].forEach(ev => map.on(ev, e => { if (e.originalEvent) touche = true; }));
    const ligne = coords => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [] } });
    // si le fond de carte ne vient pas (réseau trop faible, service indisponible) : un message clair au lieu d'une attente sans fin
    const echec = () => { if (pret || !voile.isConnected) return; voile.innerHTML = 'Le fond de carte ne se charge pas pour l’instant (réseau). Le suivi par étapes, avec leur heure, reste à jour ci-dessous.'; };
    const delai = setTimeout(echec, 15000);
    map.on('error', e => {
      try { console.warn('[suivi] carte :', (e && e.error && e.error.message) || e); } catch (_) {}
      if (!pret && e && e.error && /style|Failed to fetch|AJAXError/i.test(String(e.error.message || ''))) echec();
    });
    map.on('load', async () => {
      pret = true; clearTimeout(delai); voile.remove();
      el.querySelectorAll('.maplibregl-compact-show').forEach(x => x.classList.remove('maplibregl-compact-show'));
      map.addSource('fait', { type: 'geojson', data: ligne([]) });
      map.addSource('reste', { type: 'geojson', data: ligne([]) });
      map.addLayer({ id: 'fait', type: 'line', source: 'fait', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#A9B1AC', 'line-width': 6 } });
      map.addLayer({ id: 'reste-bord', type: 'line', source: 'reste', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 10 } });
      map.addLayer({ id: 'reste', type: 'line', source: 'reste', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#10392B', 'line-width': 6 } });
      it = await itineraire(c.id);
      if (it && it.ligne && it.ligne.length > 1) {
        L = it.ligne; approx = it.source !== 'ors'; total = longueur(L);
        if (approx) { map.setPaintProperty('reste', 'line-dasharray', [1.2, 1.2]); map.setPaintProperty('reste-bord', 'line-opacity', 0); }
        const dep = document.createElement('div'); dep.className = 'sv-depart'; new gl.Marker({ element: dep }).setLngLat(L[0]).addTo(map);
        const arr = document.createElement('div'); arr.className = 'sv-arrivee';
        arr.innerHTML = `<span>${esc(c.lieu_livraison || 'Livraison')}</span><i></i><em></em>`;
        new gl.Marker({ element: arr, anchor: 'bottom' }).setLngLat(L[L.length - 1]).addTo(map);
      }
      maj(dernier);
    });

    function maj(pos) {
      dernier = pos; if (!pret) return;
      const T = texte(pos), d = pos && pos.derniere, puce = el.querySelector('.sv-haut');
      puce.hidden = false; puce.firstElementChild.className = 'sv-puce ' + (T.vieux ? 'vieux' : 'frais'); el.querySelector('[data-sv-puce]').textContent = T.court;
      let ici = d ? [d.lon, d.lat] : null, angle = 0, coupe = null;
      if (ici && L) {
        const s = surRoute(L, ici);
        if (s && s.d <= COLLE) { ici = s.q; coupe = s; angle = cap(L[s.i], L[s.i + 1]); }
        else if (pos.trace && pos.trace.length > 1) angle = cap(pos.trace[pos.trace.length - 2], pos.trace[pos.trace.length - 1]);
        if (s && s.d <= 2000 && !coupe) coupe = s;   // assez près pour estimer le reste, pas pour poser le camion sur la route
      }
      // le tracé : parcouru en gris, reste à faire en vert
      if (L) {
        if (coupe) { map.getSource('fait').setData(ligne(L.slice(0, coupe.i + 1).concat([coupe.q]))); map.getSource('reste').setData(ligne([coupe.q].concat(L.slice(coupe.i + 1)))); }
        else { map.getSource('fait').setData(ligne([])); map.getSource('reste').setData(ligne(L)); }
      }
      // en bas : distance restante et arrivée estimée (seulement avec une position récente et proche du tracé)
      const bas = el.querySelector('.sv-bas');
      if (etapeC === 'arrivee') {
        bas.innerHTML = `<span class="sac" aria-hidden="true">${window.MDGSac ? MDGSac.svg('plein', { t: 44 }) : ''}</span><div><b>Le chauffeur est arrivé</b><small>Vérifiez la marchandise avant de confirmer la réception.</small></div>`;
        bas.hidden = false;
      } else if (L && it) {
        if (!bas.querySelector('[data-sv-km]')) bas.innerHTML = '<div><b data-sv-km></b><small data-sv-km2></small></div><div class="eta"><b data-sv-eta></b><small data-sv-eta2></small></div>';
        const reste = coupe ? metres(coupe.q, L[coupe.i + 1]) + longueur(L.slice(coupe.i + 1)) : total;
        el.querySelector('[data-sv-km]').textContent = kmTxt(reste);
        el.querySelector('[data-sv-km2]').textContent = coupe ? 'restants jusqu’à la livraison' : 'de trajet' + (approx ? ' (à vol d’oiseau)' : '');
        const eta = coupe && !T.vieux && it.duree_s && total ? new Date(Date.now() + it.duree_s * (reste / total) * 1000) : null;
        el.querySelector('[data-sv-eta]').textContent = eta ? heure(eta) : it.duree_s && !coupe ? dureeTxt(it.duree_s) : '—';
        el.querySelector('[data-sv-eta2]').textContent = eta ? 'arrivée estimée' : it.duree_s && !coupe ? 'de route, sans arrêt' : approx ? 'trajet approximatif' : 'arrivée non estimée';
        bas.hidden = false;
      } else bas.hidden = true;
      // le camion
      if (ici) {
        if (!camion) {
          const e = document.createElement('div'); e.className = 'sv-camion'; e.innerHTML = CAMION;
          camion = new gl.Marker({ element: e, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(ici).setRotation(angle).addTo(map);
          if (!touche) cadrer(ici);
        } else { camion.setLngLat(ici).setRotation(angle); }
        camion.getElement().classList.toggle('vieux', T.vieux);
        camion.getElement().setAttribute('title', T.t);
      } else cadrer(null);
      ici0 = ici;
    }
    // cadrage : le camion et ce qui reste à parcourir (comme une application de course)
    function cadrer(ici) {
      const pts = [].concat(ici ? [ici] : [], L ? (ici ? [L[L.length - 1]] : L) : []);
      if (!pts.length) return;
      const b = pts.reduce((bb, p) => bb.extend(p), new gl.LngLatBounds(pts[0], pts[0]));
      try { map.fitBounds(b, { padding: { top: 104, bottom: 150, left: 56, right: 56 }, maxZoom: 14, duration: MOUV() ? 700 : 0 }); } catch (_) {}
    }
    return api;
  }

  window.MDGSuivi = { monter, texte };
})();
