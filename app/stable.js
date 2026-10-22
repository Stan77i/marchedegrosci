/* Marché de Gros CI — fenêtres stables. Écrit pour l'app.
   Les fenêtres posées en bas de l'écran (relevé, commandes, groupes, appro…) prenaient la hauteur de leur contenu :
   en changeant d'onglet ou de période, le contenu change (chargement, liste vide, liste pleine), la fenêtre grandit
   ou rétrécit, et tout son haut (titre, onglets) monte et descend. Ce script :
     • donne une hauteur FIXE aux fenêtres à onglets : le haut ne bouge plus jamais ;
     • pour les autres fenêtres, dès qu'on touche un élément, la fenêtre garde au moins sa hauteur : elle ne redescend plus ;
     • le pied collant d'une fenêtre à hauteur fixe reste en bas même quand la liste est courte ;
     • quand une fenêtre redessine sa rangée de puces (Ce mois, 3 mois, Cette année…), la rangée garde sa position
       de défilement au lieu de revenir au début. */
(function () {
  'use strict';
  if (window.MDGStable) return;
  const FIXES = '.rl, .cm, .gr, .ap';                                   // à onglets ou filtres
  const AUTRES = '.rc, .pz, .rp, .al, .snp, .idv, .rg, .gr-f';
  const TOUTES = FIXES + ', ' + AUTRES;

  const st = document.createElement('style');
  st.textContent = '.rl{height:min(92dvh,860px)}.cm,.gr,.ap{height:94dvh}';
  (document.head || document.documentElement).appendChild(st);

  // la fenêtre ne redescend plus une fois touchée
  document.addEventListener('pointerdown', e => {
    const f = e.target && e.target.closest && e.target.closest(AUTRES); if (!f) return;
    const h = f.offsetHeight; if (h > (parseFloat(f.style.minHeight) || 0)) f.style.minHeight = h + 'px';
  }, true);

  // rangées qui défilent de côté : on retient leur position, et on la rend quand la fenêtre les redessine
  const pos = new WeakMap();                                            // fenêtre → { classe de la rangée: scrollLeft }
  const cle = el => el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
  document.addEventListener('scroll', e => {
    const el = e.target; if (!el || el.nodeType !== 1 || el.scrollWidth <= el.clientWidth) return;
    const f = el.closest(TOUTES); if (!f || f === el || !cle(el)) return;
    const m = pos.get(f) || {}; m[cle(el)] = el.scrollLeft; pos.set(f, m);
  }, true);
  // pied collant (« Publier un besoin ») d'une fenêtre à hauteur fixe : si la liste est courte, il restait au milieu, avec du vide dessous.
  // On le pousse en bas de la fenêtre.
  const PIEDS = '.ap-pied, .rc-pied';
  function coller(f) {
    const p = f.querySelector(PIEDS); if (!p) return;
    p.style.marginTop = ''; if (f.scrollHeight > f.clientHeight + 1) return;
    const vide = Math.round(f.getBoundingClientRect().bottom - p.getBoundingClientRect().bottom);
    if (vide > 0) p.style.marginTop = (parseFloat(getComputedStyle(p).marginTop) || 0) + vide + 'px';
  }
  addEventListener('resize', () => document.querySelectorAll(FIXES).forEach(coller));
  const obs = new MutationObserver(ms => {
    const vues = new Set(); ms.forEach(m => { const f = m.target.nodeType === 1 && m.target.closest(TOUTES); if (f) vues.add(f); });
    vues.forEach(f => { if (f.matches(FIXES)) coller(f); });
    vues.forEach(f => { const m = pos.get(f); if (!m) return;
      for (const k in m) { const el = f.querySelector('.' + CSS.escape(k)); if (el && el.scrollLeft !== m[k] && el.scrollWidth > el.clientWidth) el.scrollLeft = m[k]; } });
  });
  const go = () => obs.observe(document.body, { childList: true, subtree: true });
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);

  window.MDGStable = { FIXES, TOUTES };
})();
