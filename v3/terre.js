/* ═════════ Marché de Gros — Terre (géographie commune des petites cartes) ═════════
   Le même territoire que la grande carte (v2/reseau-carte.js) pour les cartes d'encart en SVG :
   contour réel de la Côte d'Ivoire et de ses voisins (Natural Earth 1:50m), lacs (Natural Earth 1:10m), hors connexion (vendor/).
   API : MDGTerre.ready → Promise ; MDGTerre.paint(svg, proj, opt) dessine le territoire sous les marqueurs d'une carte SVG
   et renvoie inside(x, y) (dans le pays, en coordonnées projetées) pour poser le grain seulement sur la terre.
   Aucune donnée de marché ici : seulement la géographie de référence. */
(function () {
  'use strict';
  const BOX = [-9.6, 3.6, -1.6, 11.4]; // fenêtre utile des encarts (degrés : ouest, sud, est, nord)
  const NB = ['430', '324', '466', '854', '288'];
  const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const clip = ring => {
    let out = ring;
    for (const [k, v, lo] of [[0, BOX[0], 1], [0, BOX[2], 0], [1, BOX[1], 1], [1, BOX[3], 0]]) {
      const src = out, inn = p => lo ? p[k] >= v : p[k] <= v; out = [];
      for (let i = 0; i < src.length; i++) {
        const a = src[i], b = src[(i + 1) % src.length], ia = inn(a), ib = inn(b);
        if (ia) out.push(a);
        if (ia !== ib) { const t = (v - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      if (!out.length) break;
    }
    return out;
  };
  const rings = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat();
  const ready = Promise.all([
    fetch('vendor/countries-50m.json').then(r => { if (!r.ok) throw new Error('géographie ' + r.status); return r.json(); }),
    window.topojson ? 0 : script('vendor/topojson-client.min.js'),
    fetch('vendor/ci-hydro.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]).then(([t, , h]) => {
    const fs = window.topojson.feature(t, t.objects.countries).features, by = id => fs.find(f => String(f.id) === id);
    const civ = by('384'); if (!civ) throw new Error('Côte d\'Ivoire absente');
    return {
      civ: rings(civ.geometry),
      nb: NB.map(by).filter(Boolean).flatMap(f => rings(f.geometry).map(clip).filter(r => r.length > 2)),
      lakes: h ? h.lakes.flatMap(l => l.p) : [],
    };
  });
  const d = (rs, proj) => rs.map(r => r.map(([lo, la], i) => { const [x, y] = proj(la, lo); return (i ? 'L' : 'M') + x.toFixed(3) + ' ' + y.toFixed(3); }).join('') + 'Z').join('');
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

  // dessine voisins, pays et lacs en premier enfant du SVG (sous les marqueurs) ; renvoie inside(x, y) en coordonnées projetées
  function paint(svg, proj, T) {
    if (!svg || !T) return null;
    const NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'terre'); g.setAttribute('aria-hidden', 'true');
    const add = (cls, dd, rule) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); p.setAttribute('d', dd); if (rule) p.setAttribute('fill-rule', 'evenodd'); g.appendChild(p); };
    add('terre-nb', d(T.nb, proj), 1); add('terre-ci', d(T.civ, proj), 1); if (T.lakes.length) add('terre-eau', d(T.lakes, proj), 1);
    svg.querySelector('g.terre')?.remove(); svg.insertBefore(g, svg.firstChild);
    const P = T.civ.map(r => r.map(([lo, la]) => proj(la, lo))), L = T.lakes.map(r => r.map(([lo, la]) => proj(la, lo)));
    const odd = (x, y, R) => R.reduce((c, r) => inPoly(x, y, r) ? !c : c, false);
    return (x, y) => odd(x, y, P) && !odd(x, y, L);
  }
  window.MDGTerre = { ready, paint };
})();
