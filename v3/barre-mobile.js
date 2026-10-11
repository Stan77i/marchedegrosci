/* ═════════ Marché de Gros CI — site sur petit écran : la barre du haut à la manière de Gmail ═════════
   ≤ 760 px : une capsule — menu à gauche, au milieu « Marché de Gros » qui s'écrit puis des phrases qui passent (<mdg-souffle>,
   un bouton « Chercher »), le compte à droite. Le menu s'ouvre en tiroir à gauche : le nom en haut, le compte d'abord, le nom en bas.
   Au-delà de 760 px, rien ne change (les éléments ajoutés ici restent cachés). Mise en forme : v3/ux.css. */
(function () {
  'use strict';
  const h = document.querySelector('.site-header'); if (!h) return;
  const inner = h.querySelector('.sh-inner') || h;
  const a = document.createElement('a');
  a.className = 'sh-souffle'; a.href = '#/catalogue'; a.setAttribute('data-search', ''); a.setAttribute('aria-haspopup', 'dialog'); a.setAttribute('aria-label', 'Chercher un produit');
  a.innerHTML = '<mdg-souffle></mdg-souffle>';
  inner.appendChild(a);
  const nav = document.getElementById('mainNav') || h.querySelector('.sh-nav'); if (!nav) return;
  const tete = document.createElement('div'); tete.className = 'dr-tete'; tete.setAttribute('aria-hidden', 'true');
  tete.innerHTML = '<span class="mark">M</span><b>Marché de Gros</b>';
  const pied = document.createElement('div'); pied.className = 'dr-pied'; pied.setAttribute('aria-hidden', 'true'); pied.textContent = 'Marché de Gros, Côte d’Ivoire';
  nav.prepend(tete); nav.append(pied);
})();
