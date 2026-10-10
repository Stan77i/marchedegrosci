/* ═════════ V3 — En-tête : comportements repris d'IVT (fx.js) ═════════ */
(function () {
  'use strict';
  const h = document.querySelector('.site-header'); if (!h) return;
  const nav = h.querySelector('.sh-nav'), burger = h.querySelector('.sh-burger');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Capsule au défilement, se cache en descendant, revient en remontant ou au survol du haut */
  const peek = document.createElement('button');
  peek.className = 'header-peek'; peek.type = 'button'; peek.setAttribute('aria-label', 'Afficher le menu');
  peek.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 6.5 5 3l4 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Menu';
  h.after(peek);
  let last = scrollY, acc = 0, ticking = false, hoverTop = false, scrolledFold = scrollY > 80, onFold = null;
  const Y0 = 140, HIDE = 60;
  const menuOpen = () => document.body.classList.contains('nav-open') || burger.getAttribute('aria-expanded') === 'true';
  const show = () => h.classList.remove('is-hidden');
  const update = () => {
    ticking = false;
    const y = Math.max(0, scrollY), d = y - last; last = y;
    h.classList.toggle('is-condensed', y > 40);
    // dès qu'on quitte le haut de page, l'en-tête se replie en capsule givrée (jamais par-dessus le texte du site)
    const sf = y > 80; h.classList.toggle('is-folded', sf); if (sf !== scrolledFold) { scrolledFold = sf; onFold && onFold(); }
    if (y < Y0 || menuOpen() || hoverTop || h.matches(':focus-within')) { show(); acc = 0; return; }
    acc = (Math.sign(d) === Math.sign(acc)) ? acc + d : d;
    if (acc > HIDE) h.classList.add('is-hidden');
    else if (acc < -24) show();
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  if (fine) document.addEventListener('pointermove', e => { const near = e.clientY < 72; if (near !== hoverTop) { hoverTop = near; if (near) show(); } }, { passive: true });
  h.addEventListener('focusin', show);
  peek.addEventListener('click', show);
  update();

  /* Repli intelligent : la barre de liens reste tant qu'elle tient (logo + liens + boutons + 40 px d'air) ; sinon menu plein écran.
     Mesuré à chaque redimensionnement, après le chargement des polices et sur toutes les pages — jamais de liens qui chevauchent. */
  const home = nav.parentNode, anchor = nav.nextSibling, root = document.documentElement, inner = h.querySelector('.sh-inner') || h;
  const brand = h.querySelector('.brand'), actions = h.querySelector('.sh-actions');
  root.classList.add('nav-js');
  nav.id = nav.id || 'mainNav'; burger.setAttribute('aria-controls', nav.id);
  const set = open => {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { show(); const a = nav.querySelector('a.on') || nav.querySelector('a'); a && a.focus({ preventScroll: true }); }
  };
  const close = () => { if (nav.classList.contains('is-open')) set(false); };
  let folded = null;
  const measure = () => {
    // mesure à plat (barre en place, non repliée), dans la même frame : rien n'est peint entre-temps
    const was = root.classList.contains('nav-fold');
    if (nav.parentNode !== home) home.insertBefore(nav, anchor);
    root.classList.remove('nav-fold');
    const cs = getComputedStyle(inner), avail = inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const need = brand.getBoundingClientRect().width + nav.scrollWidth + actions.getBoundingClientRect().width + 40 + (was ? 24 : 0); // 24 px d'hystérésis : pas de clignotement à la limite
    return need > avail || scrolledFold;
  };
  const place = () => {
    const f = measure();
    root.classList.toggle('nav-fold', f);
    if (f) { if (nav.parentNode !== document.body) document.body.appendChild(nav); }
    else { close(); if (nav.parentNode !== home) home.insertBefore(nav, anchor); }
    folded = f;
  };
  onFold = () => place();
  let rq = 0; const req = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; place(); }); };
  addEventListener('resize', req, { passive: true });
  addEventListener('hashchange', () => { close(); req(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(req);
  place();
  // le routeur réécrit body.className à chaque page : on garde la classe d'ouverture alignée sur l'état du menu
  new MutationObserver(() => { const o = nav.classList.contains('is-open'); if (document.body.classList.contains('nav-open') !== o) document.body.classList.toggle('nav-open', o); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  nav.addEventListener('click', e => { if (e.target === nav || e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { close(); burger.focus(); } });
  document.addEventListener('click', e => { if (nav.classList.contains('is-open') && !nav.contains(e.target) && !e.target.closest('.sh-burger')) close(); });
  let lastTouch = 0;
  const toggle = e => { e.preventDefault(); e.stopPropagation(); set(!nav.classList.contains('is-open')); };
  burger.addEventListener('touchend', e => { lastTouch = Date.now(); toggle(e); }, { passive: false });
  burger.addEventListener('click', e => { if (Date.now() - lastTouch < 600) { e.preventDefault(); return; } toggle(e); });
})();
