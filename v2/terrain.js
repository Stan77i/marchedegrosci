// Marché de Gros CI — le terrain : la Côte d'Ivoire en points, très calme, en tête des pages Acheter, Vendre, Demander.
// Il montre où se passe ce que la page raconte (offres affichées, lieu du producteur, lieu de livraison) et ne bouge que si les données changent.
// Contour : le même que la carte du réseau (v2/reseau-carte.js). SVG seul, sans WebGL.
const OUT = [[-7.53,4.37],[-6.85,4.66],[-6.64,4.73],[-6.08,4.95],[-5.3,5.15],[-5.02,5.12],[-4.6,5.17],[-4.02,5.25],[-3.74,5.18],[-3.3,5.11],[-3.1,5.1],[-2.95,5.5],[-3.1,6.0],[-3.24,6.5],[-3.1,7.0],[-2.95,7.4],[-2.75,8.0],[-2.55,8.25],[-2.65,8.9],[-2.7,9.45],[-3.0,9.85],[-3.6,9.92],[-4.3,9.62],[-4.7,9.72],[-5.1,10.25],[-5.5,10.42],[-6.0,10.2],[-6.25,10.5],[-6.9,10.3],[-7.6,10.45],[-8.0,10.2],[-8.2,9.8],[-8.1,9.3],[-7.85,8.8],[-8.2,8.45],[-8.47,7.6],[-8.3,7.2],[-7.9,6.75],[-7.55,6.2],[-7.4,5.7],[-7.6,5.1]];
const LON0 = -5.45, LAT0 = 7.4, KX = Math.cos(7.5 * Math.PI / 180), S = 100;
const XY = (lat, lon) => [(lon - LON0) * KX * S, -(lat - LAT0) * S];
const NS = 'http://www.w3.org/2000/svg';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const poly = OUT.map(([lo, la]) => XY(la, lo));
const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9; poly.forEach(([x, y]) => { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Y0 = Math.min(Y0, y); Y1 = Math.max(Y1, y); });
let DOTS = ''; for (let x = X0; x <= X1; x += 9) for (let y = Y0; y <= Y1; y += 9) if (inside(x, y)) DOTS += 'M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'h0';
export function terrain(host) {
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'tr-svg'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = '<path class="tr-dots" d="' + DOTS + '"></path><path class="tr-out" d="M' + poly.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z"></path><g class="tr-pts"></g>';
  host.appendChild(svg);
  const G = svg.querySelector('.tr-pts'), home = [X0 - 20, Y0 - 20, X1 - X0 + 40, Y1 - Y0 + 40];
  let vb = home.slice(), raf = 0;
  const put = v => svg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' '));
  put(vb);
  function frame(to) {
    cancelAnimationFrame(raf); if (still()) { vb = to; put(vb); return; }
    const from = vb.slice(), t0 = performance.now(), D = 480;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); vb = from.map((f, i) => f + (to[i] - f) * e); put(vb); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  return {
    // points : [[lat, lon], …] (offres) · rings : [[lat, lon], …] (demande / livraison) · me : [lat, lon] (le lieu saisi)
    set({ points = [], rings = [], me = null } = {}) {
      const P = points.map(([a, b]) => XY(a, b)), R = rings.map(([a, b]) => XY(a, b)), Mxy = me ? XY(me[0], me[1]) : null;
      G.innerHTML = R.map(([x, y]) => '<circle class="tr-ring" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="9"></circle>').join('')
        + P.map(([x, y]) => '<circle class="tr-pt" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5"></circle>').join('')
        + (Mxy ? '<circle class="tr-me" cx="' + Mxy[0].toFixed(1) + '" cy="' + Mxy[1].toFixed(1) + '" r="7"></circle>' : '');
      const all = P.concat(R, Mxy ? [Mxy] : []);
      if (!all.length) return frame(home);
      let a = 1e9, b = -1e9, c = 1e9, d = -1e9; all.forEach(([x, y]) => { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); });
      const w = Math.max(b - a, 160), h = Math.max(d - c, 120), cx = (a + b) / 2, cy = (c + d) / 2;
      frame([cx - w / 2 - 60, cy - h / 2 - 50, w + 120, h + 100]);
    },
  };
}
