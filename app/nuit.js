/* Marché de Gros CI — mode nuit des FENÊTRES (compte, messages, négociations, guide, commandes, relevé…). Écrit pour l'app.
   Les pages de l'application suivent le mode nuit par leurs jetons (css/sombre.css). Les fenêtres posées par-dessus
   (ajoutées au <body> par les modules v3/…) ont leurs propres couleurs écrites en dur : ce script les traduit, une fois
   affichées, quand <html data-theme="sombre"> :
     • fond neutre clair (crème, blanc)      → sombre (plus il était clair, plus il devient foncé) ;
     • fond pastel (vert pâle, jaune pâle…)   → la même teinte, en sombre ;
     • voile foncé léger (rgba noir .06)      → voile clair léger ;
     • texte neutre foncé                     → texte clair ; texte coloré foncé (vert du logo…) → la même teinte, éclaircie ;
     • les couleurs vives (maïs, vert, rouge, boutons) ne bougent pas, ni le texte posé dessus.
   Repasser en clair rend les couleurs d'origine. Les fenêtres qui ont déjà leur propre mode nuit sont laissées telles quelles. */
(function () {
  'use strict';
  if (window.MDGNuit || !window.MutationObserver) return;
  const DEJA = '.rg-bg, .il, mdg-souffle, mdg-marche, .ng-bg, .cm-fiche, .cm-plan, .pm-bg, .bq-bg, .bqg-bg';            // ont déjà leur mode nuit
  const sombre = () => document.documentElement.getAttribute('data-theme') === 'sombre';
  // l'application elle-même vit dans #dc-root (elle suit le mode nuit par css/sombre.css) ; les fenêtres des modules sont posées à côté, dans <body>
  const app = () => document.getElementById('dc-root') || document.querySelector('[data-screen-label="Application"]');
  const fait = new Map();                                         // élément → { propriété: [valeur d'origine, priorité] }
  let ecrit = false;

  // couleurs
  const lire = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  function hsl(c) { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return { h, s, l }; }
  function rgb(h, s, l, a) { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    let r, g, b; if (!s) r = g = b = l; else { const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
    const k = x => Math.round(x * 255); return 'rgba(' + k(r) + ',' + k(g) + ',' + k(b) + ',' + (+a.toFixed(3)) + ')'; }
  // neutre = peu de couleur (crème, gris, noir chaud), mesuré par l'écart entre composantes
  const neutre = c => (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255 < .1;
  const CHAUD = .11;   // teinte du fond de nuit (brun chaud, comme #171512)
  function fond(c) {     // → nouvelle couleur, ou null (on ne touche pas)
    if (!c || c.a < .02) return null; const x = hsl(c);
    if (x.l < .35 && neutre(c) && c.a <= .35) return rgb(CHAUD, .2, .93, c.a);                          // voile foncé → voile clair
    if (neutre(c) && x.l > .6) return rgb(CHAUD, .14, .07 + (1 - x.l) * .55, c.a);                         // neutre clair → sombre
    if (x.l > .82) return rgb(x.h, Math.min(x.s, .45), .17, c.a);                                       // pastel → même teinte, sombre
    return null;
  }
  function texte(c) {
    if (!c || c.a < .05) return null; const x = hsl(c);
    if (neutre(c) && x.l < .62) return rgb(CHAUD, .18, .94 - x.l * .55, c.a);                              // neutre foncé → clair
    if (x.l < .5) return rgb(x.h, Math.max(x.s, .5), .74, c.a);                                         // coloré foncé → éclairci
    return null;
  }
  const bord = c => { if (!c || c.a < .02) return null; const x = hsl(c); if (neutre(c) && x.l < .4) return rgb(CHAUD, .2, .93, Math.min(c.a, .3)); if (neutre(c) && x.l > .7 && c.a > .5) return rgb(CHAUD, .14, .22, c.a); return null; };

  // appliquer / défaire
  function poser(el, p, v) { const o = fait.get(el) || {}; if (!(p in o)) o[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]; el.style.setProperty(p, v, 'important'); o[p][2] = el.style.getPropertyValue(p); fait.set(el, o); }
  // on ne rend la valeur d'origine que si personne n'a réécrit la propriété entre-temps (le module a pu changer la couleur)
  function defaire(el) { const o = fait.get(el); if (!o) return; for (const p in o) { if (el.style.getPropertyValue(p) !== o[p][2]) continue; if (o[p][0]) el.style.setProperty(p, o[p][0], o[p][1]); else el.style.removeProperty(p); } fait.delete(el); }
  const horsCadre = el => { const a = app(); return !!a && !a.contains(el) && !el.closest(DEJA); };   // tant que l'application n'est pas montée, on ne touche à rien
  function traiter(racine) {
    if (!sombre() || !racine || racine.nodeType !== 1 || !horsCadre(racine) || /^(SCRIPT|STYLE|LINK|META|svg|path)$/i.test(racine.tagName)) return;
    ecrit = true;
    const pile = [[racine, null]];   // [élément, fond effectif du parent : 'garde' si on a laissé un fond vif]
    // fond effectif au-dessus de la racine
    let a = racine.parentElement, haut = 'neutre';
    while (a && a !== document.body) { const f = fait.get(a); if (f && f['background-color']) break; const c = lire(getComputedStyle(a).backgroundColor); if (c && c.a > .5) { haut = fond(c) ? 'neutre' : (hsl(c).l < .3 ? 'neutre' : 'garde'); break; } a = a.parentElement; }
    pile[0][1] = haut;
    while (pile.length) {
      const [el, parent] = pile.pop(); if (el.nodeType !== 1 || el.closest(DEJA)) continue;
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
      defaire(el); const cs = getComputedStyle(el); let eff = parent;
      const bg = lire(cs.backgroundColor), nb = fond(bg);
      if (nb) { poser(el, 'background-color', nb); eff = 'neutre'; }
      else if (bg && bg.a > .5) eff = hsl(bg).l < .3 ? 'neutre' : 'garde';            // fond vif (maïs, vert…) ou déjà sombre : on n'y touche pas
      // fond en dégradé fait seulement de couleurs claires (carte crème, reflet blanc) → aplat sombre
      if (/gradient/.test(cs.backgroundImage) && !/url\(/.test(cs.backgroundImage)) {
        const cols = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(lire).filter(c => c && c.a > .3);
        if (cols.length && cols.every(c => hsl(c).l > .62)) { poser(el, 'background-image', 'none'); if (!nb) poser(el, 'background-color', fond(cols[0]) || 'rgba(40,36,30,1)'); eff = 'neutre'; }
        else if (cols.some(c => !neutre(c) && hsl(c).l < .62)) eff = 'garde';   // dégradé vif (pastille maïs…) : le dessin posé dessus garde sa couleur
      }

      // mot en valeur souligné de maïs : en mode nuit, le mot passe en maïs et le surlignage s'adoucit (comme l'accueil)
      const surligne = /242,\s*194,\s*48/.test(cs.backgroundImage) && !/radial-gradient/.test(cs.backgroundImage);   // pas les pastilles rondes en dégradé
      if (surligne) { poser(el, 'color', '#F2C230'); poser(el, 'background-image', cs.backgroundImage.replace(/rgba?\(242,\s*194,\s*48(,\s*[\d.]+)?\)/g, 'rgba(242, 194, 48, 0.22)')); }
      else if (eff !== 'garde') { const nt = texte(lire(cs.color)); if (nt) poser(el, 'color', nt); }
      ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'].forEach(p => { if (parseFloat(cs[p.replace('-color', '-width')]) > 0) { const nbd = bord(lire(cs.getPropertyValue(p))); if (nbd) poser(el, p, nbd); } });
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) poser(el, 'color-scheme', 'dark');
      for (let i = el.children.length - 1; i >= 0; i--) pile.push([el.children[i], eff]);
    }
    obs.takeRecords(); ecrit = false;
  }

  // suivre les fenêtres qui s'ouvrent et changent
  let file = new Set(), prevu = false;
  const vider = () => { prevu = false; const L = [...file]; file = new Set(); L.filter(e => e.isConnected && !L.some(p => p !== e && p.contains(e))).forEach(traiter); };
  const obs = new MutationObserver(ms => { if (ecrit || !sombre()) return;
    ms.forEach(m => { const t = m.target; if (t.nodeType === 1 && t !== document.body && horsCadre(t)) file.add(t); else if (t === document.body) m.addedNodes.forEach(n => { if (n.nodeType === 1) file.add(n); }); });
    if (file.size && !prevu) { prevu = true; Promise.resolve().then(vider); } });
  function demarrer() { obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded', 'disabled', 'hidden'] });
    [...document.body.children].forEach(traiter); }
  addEventListener('mdg:theme', () => { if (sombre()) [...document.body.children].forEach(traiter); else { [...fait.keys()].forEach(defaire); } });
  if (document.body) demarrer(); else document.addEventListener('DOMContentLoaded', demarrer);
  setInterval(() => fait.forEach((v, el) => { if (!el.isConnected) fait.delete(el); }), 30000);
  window.MDGNuit = { traiter };
})();
