// OKLCH ⇄ sRGB, contraste WCAG, interpolation. Utilisé par le hero (couleur du produit) et par tools/extract-themes.
(function (root) {
  const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const gam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  function rgbToOklch([r, g, b]) {
    r = lin(r / 255); g = lin(g / 255); b = lin(b / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.hypot(A, B); let H = Math.atan2(B, A) * 180 / Math.PI; if (H < 0) H += 360;
    return [L, C, H];
  }
  function oklchToRgbRaw([L, C, H]) {
    const h = H * Math.PI / 180, A = C * Math.cos(h), B = C * Math.sin(h);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  const inGamut = c => oklchToRgbRaw(c).every(v => v >= -0.0005 && v <= 1.0005);
  function clampGamut([L, C, H]) { let lo = 0, hi = C; if (inGamut([L, C, H])) return [L, C, H]; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut([L, mid, H])) lo = mid; else hi = mid; } return [L, lo, H]; }
  function oklchToRgb(c) { return oklchToRgbRaw(clampGamut(c)).map(v => Math.round(Math.max(0, Math.min(1, gam(Math.max(0, v)))) * 255)); }
  const hex = c => '#' + oklchToRgb(c).map(v => v.toString(16).padStart(2, '0')).join('');
  const fromHex = h => rgbToOklch([1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  function lum(rgb) { const [r, g, b] = rgb.map(v => lin(v / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function contrast(a, b) { const x = lum(oklchToRgb(a)), y = lum(oklchToRgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // interpolation sur le chemin de teinte le plus court ; une teinte sans chroma prend celle de l'autre (pas de gris intermédiaire)
  function mix(a, b, t) {
    let ha = a[2], hb = b[2]; if (a[1] < 0.01) ha = hb; if (b[1] < 0.01) hb = ha;
    let d = hb - ha; if (d > 180) d -= 360; if (d < -180) d += 360;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (ha + d * t + 360) % 360];
  }
  const css = (c, alpha) => `oklch(${(c[0] * 100).toFixed(2)}% ${c[1].toFixed(4)} ${c[2].toFixed(2)}${alpha != null ? ' / ' + alpha : ''})`;
  // palette dérivée d'une couleur source, contrastes garantis (le script de build et le navigateur utilisent la même fonction)
  const INK_DARK = [0.2, 0.012, 75];
  function derive(src) {
    const [, Cs, h] = src, k = Math.max(0.035, Math.min(Cs * 0.6, 0.095));
    const bg = clampGamut([0.245, k, h]), bgDeep = clampGamut([0.18, k * 0.85, h]), surface = clampGamut([0.32, k * 0.9, h]);
    let ink = clampGamut([0.96, 0.016, h]), inkMuted = clampGamut([0.82, 0.04, h]);
    let accent = clampGamut([0.74, Math.min(Math.max(Cs, 0.1) * 1.05, 0.18), h]);
    const ring = clampGamut([0.66, Math.min(Math.max(Cs, 0.06), 0.13), h]), glow = clampGamut([0.58, Math.min(Math.max(Cs, 0.08), 0.17), h]);
    // garanties : texte ≥ 4.5:1 sur le fond le plus clair qu'il croise (surface), accent ≥ 4.5:1 sur le fond (surtitre en petites capitales)
    while (contrast(inkMuted, surface) < 4.5 && inkMuted[0] < 0.97) inkMuted = clampGamut([inkMuted[0] + 0.01, inkMuted[1], h]);
    while (contrast(accent, bg) < 4.5 && accent[0] < 0.95) accent = clampGamut([accent[0] + 0.01, accent[1], h]);
    const onAccent = contrast(INK_DARK, accent) >= contrast(ink, accent) ? INK_DARK : ink;
    return { bg, bgDeep, surface, ring, accent, onAccent, ink, inkMuted, glow };
  }
  const api = { rgbToOklch, oklchToRgb, hex, fromHex, contrast, mix, css, derive, clampGamut };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.MDG = root.MDG || {}; root.MDG.color = api; }
})(typeof window !== 'undefined' ? window : globalThis);
