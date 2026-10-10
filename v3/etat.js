/* ═════════ Marché de Gros — États du système (ORDRE-DE-MISSION § XVI, XXXVI) ═════════
   Un seul état pour tout le site, lu par le CSS (html[data-etat]) et par les scripts (événement « mdg:etat ») :
   IDLE (le marché respire) · APPROACH (défilement, curseur sur un élément actif) · FOCUS (recherche, menu, panneau ouverts)
   · INTERACTION (appui) · TRANSITION (changement de page) · CONNECTION (une publication rencontre sa contrepartie) · REST (retour au calme).
   Connexion : à chaque publication (événement « mdg:publie » envoyé par store()), on cherche les vraies correspondances
   (même produit, côté opposé). S'il y en a : des grains partent de chacune et convergent vers le point de publication.
   S'il n'y en a pas : une seule onde (le signal part, rien n'est inventé). « Réduire les animations » : états seulement. */
(function () {
  'use strict';
  const de = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 'idle', restT = 0, idleT = 0;

  function set(s, hold) {
    clearTimeout(restT); clearTimeout(idleT);
    if (cur !== s) { cur = s; de.dataset.etat = s; dispatchEvent(new CustomEvent('mdg:etat', { detail: s })); }
    if (hold) restT = setTimeout(rest, hold);
  }
  function rest() {
    if (isOpen()) return set('focus');
    set('rest'); idleT = setTimeout(() => set('idle'), 900);
  }
  de.dataset.etat = cur;
  const isOpen = () => de.classList.contains('sx-open') || (document.body && document.body.classList.contains('nav-open')) || !!document.querySelector('.odv.is-on,#sheet.on,dialog[open]');

  // ——— sources d'état ———
  addEventListener('hashchange', () => set('transition', 700));
  let sT = 0;
  addEventListener('scroll', () => { if (cur === 'focus' || cur === 'connection' || cur === 'transition') return; if (cur !== 'approach') set('approach'); clearTimeout(sT); sT = setTimeout(rest, 260); }, { passive: true });
  const ACT = 'a,button,[role="button"],input,select,textarea,.offer,.ax-row,.pcard';
  let hovEl = null;
  addEventListener('pointerover', e => {
    if (cur === 'focus' || cur === 'connection' || cur === 'transition') return;
    const a = e.target.closest && e.target.closest(ACT);
    if (a === hovEl) return; hovEl = a;
    if (a) set('approach'); else rest();
  }, { passive: true });
  let lastX = innerWidth / 2, lastY = innerHeight / 2;
  addEventListener('pointerdown', e => { lastX = e.clientX; lastY = e.clientY; if (cur !== 'focus') set('interaction', 420); }, { passive: true, capture: true });
  addEventListener('submit', e => { const b = e.submitter || e.target.querySelector('[type="submit"]'); if (b) { const r = b.getBoundingClientRect(); if (r.width) { lastX = r.left + r.width / 2; lastY = r.top + r.height / 2; } } }, true);
  let mq = 0;
  new MutationObserver(() => { if (mq) return; mq = requestAnimationFrame(() => {
    mq = 0; const open = isOpen();
    if (open && cur !== 'focus' && cur !== 'connection') set('focus');
    else if (!open && cur === 'focus') rest();
  }); }).observe(de, { attributes: true, subtree: true, attributeFilter: ['class', 'open'] });

  // ——— connexion ———
  const read = k => { try { return JSON.parse(localStorage.getItem('mdg-v2:' + k) || '[]'); } catch (_) { return []; } };
  function matches(kind, item) {
    if (!item || !item.productSlug) return [];
    const other = read(kind === 'offres' ? 'demandes' : 'offres');
    return other.filter(x => x.productSlug === item.productSlug && x.id !== item.id);
  }

  let cv = null, ctx = null, raf = 0, parts = [], rings = [], t0 = 0;
  function canvas() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.className = 'et-cv'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv); ctx = cv.getContext('2d');
  }
  function size() { const d = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  const accent = () => (window.MDGMarq ? window.MDGMarq.col('connexion') : '#6AAEF0');

  // graine fixe : mêmes trajectoires pour une même publication
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function play(n, seed) {
    canvas(); size(); parts = []; rings = [];
    const R = rng(seed), W = innerWidth, H = innerHeight, tx = lastX, ty = lastY;
    if (n > 0) {
      // une source par correspondance réelle (au plus 8), placée en couronne hors du point de publication
      const k = Math.min(n, 8), rad = Math.hypot(W, H) * 0.42;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + R() * 0.6, sx = tx + Math.cos(a) * rad, sy = ty + Math.sin(a) * rad * 0.7;
        for (let j = 0; j < 16; j++) {
          parts.push({ sx: sx + (R() - 0.5) * 60, sy: sy + (R() - 0.5) * 60, cx: (sx + tx) / 2 + (R() - 0.5) * rad * 0.5, cy: (sy + ty) / 2 + (R() - 0.5) * rad * 0.5, d: R() * 0.35, s: 1 + R() * 1.8 });
        }
      }
      rings.push({ at: 1.05, x: tx, y: ty });
    } else {
      rings.push({ at: 0, x: tx, y: ty });
    }
    t0 = performance.now(); const col = accent();
    cancelAnimationFrame(raf);
    const dur = n > 0 ? 1.9 : 1.4;
    const ease = x => 1 - Math.pow(1 - x, 3);
    (function frame(now) {
      const t = (now - t0) / 1000; ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = col;
      for (const p of parts) {
        const u = Math.min(1, Math.max(0, (t - p.d) / 1.0)); if (u <= 0) continue;
        const e = ease(u), a = 1 - e, x = a * a * p.sx + 2 * a * e * p.cx + e * e * tx, y = a * a * p.sy + 2 * a * e * p.cy + e * e * ty;
        ctx.globalAlpha = u < 1 ? Math.min(1, u * 3) * (0.55 + 0.45 * e) : Math.max(0, 1 - (t - p.d - 1) * 4);
        ctx.beginPath(); ctx.arc(x, y, p.s * (1 - e * 0.4), 0, 6.283); ctx.fill();
      }
      ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      for (const r of rings) {
        const u = (t - r.at) / 0.9; if (u < 0 || u > 1) continue;
        ctx.globalAlpha = (1 - u) * 0.8; ctx.beginPath(); ctx.arc(r.x, r.y, 8 + ease(u) * 110, 0, 6.283); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (t < dur) raf = requestAnimationFrame(frame); else { ctx.clearRect(0, 0, W, H); parts = []; rings = []; }
    })(t0);
  }

  addEventListener('mdg:publie', e => {
    const { kind, item } = e.detail || {}; if (!item) return;
    const m = matches(kind, item);
    set('connection', m.length ? 2000 : 1400);
    de.dataset.etatN = m.length;
    if (!reduced) play(m.length, String(item.id).split('').reduce((s, c) => s * 31 + c.charCodeAt(0) | 0, 7));
  });

  window.MDGEtat = { set, get: () => cur, matches, play };
})();
