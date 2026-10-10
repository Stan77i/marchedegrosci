/* ═════════ Marché de Gros — Flou (profondeur) ═════════
   1. Flou progressif sous l'en-tête quand la page défile (le contenu s'efface en passant dessous).
   2. Apparition au défilement : les blocs sortent du flou en entrant dans l'écran (une fois).
   3. MDGFlou.pulse(cibles) : petit passage flou → net (changement de produit dans la roue, de mois dans l'année).
   4. Recherche / menu / panneau ouverts : la page recule dans le flou (styles dans v3/flou.css).
   « Réduire les animations » : tout est coupé. */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (reduced) root.classList.add('fl-off');

  // 1. voile flou sous l'en-tête
  const veil = document.createElement('div'); veil.className = 'fl-top'; veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  let tk = false;
  const onScroll = () => { tk = false; root.classList.toggle('fl-scrolled', scrollY > 24); };
  addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // 2. apparition au défilement
  const SEL = ['#view section > .wrap > *', '#view section > .page > *', '#view .page.wrap > *', '#view .pcard', '#view .offer', '#view .ct-row', '#view .cx-p', '#view .an--emb', '#foot .wrap > *'].join(',');
  const io = !reduced && 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    es.forEach(e => { if (!e.isIntersecting) return; const el = e.target; io.unobserve(el); el.classList.add('fl-in'); setTimeout(() => el.classList.remove('fl-r', 'fl-in'), 900); });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  function scan() {
    if (!io) return;
    const H = innerHeight;
    document.querySelectorAll(SEL).forEach(el => {
      if (el.dataset.fl) return; el.dataset.fl = '1';
      if (el.closest('#etal,.an:not(.an--emb),.sx,.odv,[data-fl-skip]')) return;
      const r = el.getBoundingClientRect();
      if (r.top < H * 0.92 || r.height === 0) return; // déjà visible au chargement : rien
      el.classList.add('fl-r'); io.observe(el);
    });
  }
  let sq = 0; const req = () => { if (!sq) sq = requestAnimationFrame(() => { sq = 0; scan(); }); };
  const view = document.getElementById('view');
  if (view) new MutationObserver(req).observe(view, { childList: true, subtree: true });
  addEventListener('load', req); req();

  // 2 bis. profondeur au défilement : la section qu'on quitte par le haut s'enfonce dans un flou gaussien (flou, recul, fondu)
  const SECS = '#view > section, #view > div > section, #view > .v3a > section, #view > .v3p > section';
  let dk = false;
  function depth() {
    dk = false; if (reduced || root.classList.contains('sx-open')) return;
    const H = innerHeight;
    document.querySelectorAll(SECS).forEach(el => {
      if (el.closest('.an:not(.an--emb)') || el.matches('.an:not(.an--emb), .tz, [data-fl-skip]')) return;
      const r = el.getBoundingClientRect();
      if (r.height < H * 0.55 || r.bottom < 0) return;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.85)));
      if (p < 0.01) { if (el.style.filter) { el.style.filter = ''; el.style.transform = ''; el.style.opacity = ''; } return; }
      el.style.filter = 'blur(' + (p * 14).toFixed(1) + 'px)';
      el.style.transform = 'scale(' + (1 - p * 0.05).toFixed(4) + ')';
      el.style.opacity = (1 - p * 0.55).toFixed(3);
      el.style.transformOrigin = '50% 100%';
    });
  }
  addEventListener('scroll', () => { if (!dk) { dk = true; requestAnimationFrame(depth); } }, { passive: true });
  addEventListener('hashchange', () => requestAnimationFrame(depth));

  // 3. passage flou → net
  function pulse(t) {
    if (reduced) return;
    const els = typeof t === 'string' ? document.querySelectorAll(t) : (t && t.length != null ? t : [t]);
    [...els].forEach(el => { if (!el || !el.classList) return; el.classList.remove('fl-p'); void el.offsetWidth; el.classList.add('fl-p'); clearTimeout(el._flT); el._flT = setTimeout(() => el.classList.remove('fl-p'), 700); });
  }
  window.MDGFlou = { pulse, scan };
})();
