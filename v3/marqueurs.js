/* ═════════ Marché de Gros — langage des marqueurs (une seule source pour tout le site) ═════════
   La forme identifie, la couleur distingue, le mouvement explique, la donnée confirme.
   Cercle vert : offre disponible · Carré jaune : demande · Triangle violet : recherche active · Ligne bleue : offre et demande compatibles.
   Les formes restent lisibles sans la couleur. Inactif : contour seul, atténué. Sélectionné : plein + halo.
   API : MDGMarq.T (types), MDGMarq.svg(type, { size, off, cls }), MDGMarq.col(type), MDGMarq.draw(ctx, type, x, y, r, { a, off, sel, halo }). */
(function () {
  'use strict';
  const T = {
    offre: { forme: 'cercle', nom: 'Offre', long: 'Offre disponible', v: '--mk-offre', fb: '#6CC58C' },
    demande: { forme: 'carre', nom: 'Demande', long: 'Demande publiée', v: '--mk-demande', fb: '#F2C94C' },
    recherche: { forme: 'triangle', nom: 'Recherche', long: 'Votre recherche en cours', v: '--mk-recherche', fb: '#B095F0' },
    connexion: { forme: 'ligne', nom: 'Compatibles', long: 'Offre et demande du même produit', v: '--mk-connexion', fb: '#6AAEF0' }
  };
  const cache = {};
  function col(t) {
    if (cache[t]) return cache[t];
    const v = getComputedStyle(document.documentElement).getPropertyValue(T[t].v).trim();
    return (cache[t] = /^#[0-9a-f]{6}$/i.test(v) ? v : T[t].fb);
  }
  const shape = (t, off) => {
    const f = off ? 'none' : 'var(' + T[t].v + ')', s = 'var(' + T[t].v + ')', w = off ? 2 : 0;
    if (t === 'offre') return '<circle cx="12" cy="12" r="' + (off ? 5.5 : 6.5) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + w + '"/>';
    if (t === 'demande') return '<rect x="' + (off ? 6.5 : 5.5) + '" y="' + (off ? 6.5 : 5.5) + '" width="' + (off ? 11 : 13) + '" height="' + (off ? 11 : 13) + '" rx="1.5" fill="' + f + '" stroke="' + s + '" stroke-width="' + w + '"/>';
    if (t === 'recherche') return '<path d="M12 4.5 19.5 18h-15Z" fill="' + f + '" stroke="' + s + '" stroke-width="' + (off ? 2 : 1) + '" stroke-linejoin="round"/>';
    return '<path d="M3 12h18" stroke="' + s + '" stroke-width="2.6" stroke-linecap="round"' + (off ? ' stroke-dasharray="2 3.5"' : '') + '/>';
  };
  function svg(t, o = {}) {
    const sz = o.size ? ' width="' + o.size + '" height="' + o.size + '"' : '';
    return '<svg class="mk mk--' + t + (o.off ? ' is-off' : '') + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 24 24"' + sz + ' aria-hidden="true" focusable="false">' + shape(t, o.off) + '</svg>';
  }
  // J'ai / Je cherche : une offre et une demande reliées
  const match = '<svg class="mk mk--match" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 12h7" stroke="var(--mk-connexion)" stroke-width="2" stroke-linecap="round"/><circle cx="5" cy="12" r="3.6" fill="var(--mk-offre)"/><rect x="15.6" y="8.6" width="6.8" height="6.8" rx="1" fill="var(--mk-demande)"/></svg>';

  function draw(ctx, t, x, y, r, o = {}) {
    const c = col(t), a = o.a == null ? 1 : o.a;
    ctx.save(); ctx.globalAlpha = a;
    if (o.halo) { ctx.globalAlpha = a * o.halo * .22; ctx.fillStyle = c; path(ctx, t, x, y, r * 2.4); ctx.fill(); ctx.globalAlpha = a; }
    path(ctx, t, x, y, r);
    if (o.off) { ctx.strokeStyle = c; ctx.lineWidth = 1.3; ctx.stroke(); }
    else { ctx.fillStyle = c; ctx.fill(); if (o.sel) { ctx.strokeStyle = '#F5F0E6'; ctx.lineWidth = 1.5; ctx.stroke(); } }
    ctx.restore();
  }
  function path(ctx, t, x, y, r) {
    ctx.beginPath();
    if (t === 'demande') { const s = r * .9; ctx.rect(x - s, y - s, s * 2, s * 2); }
    else if (t === 'recherche') { const s = r * 1.25; ctx.moveTo(x, y - s); ctx.lineTo(x + s * .95, y + s * .7); ctx.lineTo(x - s * .95, y + s * .7); ctx.closePath(); }
    else ctx.arc(x, y, Math.max(.5, r), 0, 6.2832);
  }
  window.MDGMarq = { T, svg, match, col, draw, path };
})();
