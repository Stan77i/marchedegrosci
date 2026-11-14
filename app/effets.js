/* Marché de Gros CI — petits effets de l'application (écrits pour l'app, aucun code repris d'ailleurs). */
/* Le TRACÉ de la barre jaune et le COUP DE TAMPON des urgences : une seule fois par élément.
   • Barre jaune : tout mot en valeur souligné de maïs (fond en dégradé, rgb 242 194 48) se dessine de gauche à droite, en une fois.
   • Tampon : .qd[data-u] (Il le faut dès que possible, Disponible maintenant…) se pose d'un coup.
   Joué la première fois que l'élément est à l'écran, jamais rejoué ensuite (ni au retour sur la page, ni au défilement).
   Animations du navigateur (element.animate) : rien n'est écrit sur l'élément, car l'affichage de l'app réécrit
   classes et attributs à chaque rendu. Rien ne bouge si le téléphone demande moins d'animations. */
(function () {
  if (!window.IntersectionObserver || !window.MutationObserver || !Element.prototype.animate || window.MDGTrace) return;
  const calme = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const etat = new WeakMap();   // élément → { barre, attente (animation « caché » tant qu'il est hors écran) }
  const CACHE_BARRE = { backgroundSize: '0% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' };
  const cacher = (el, st) => { if (!st.attente) st.attente = el.animate([st.barre ? CACHE_BARRE : { opacity: 0 }], { duration: 1, fill: 'forwards' }); };
  function jouer(el, st) {
    if (st.attente) { st.attente.cancel(); st.attente = null; }
    if (st.barre) el.animate([CACHE_BARRE, { backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' }],
      { duration: 750, delay: 120, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
    else { const r = getComputedStyle(el).getPropertyValue('--qd-r').trim() || '-2deg';
      el.animate([{ opacity: 0, transform: 'rotate(-12deg) scale(1.7)' }, { opacity: 1, transform: 'rotate(' + r + ') scale(.93)', offset: .55 }, { opacity: 1, transform: 'rotate(' + r + ') scale(1)' }],
        { duration: 460, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' }); }
  }
  // une seule fois par élément, la première fois qu'il est à l'écran : rien ne rejoue au retour sur la page (règle de stabilité, 24/10/2026)
  const io = new IntersectionObserver(es => es.forEach(e => { const st = etat.get(e.target); if (!st || !e.isIntersecting || st.vu) return;
    st.vu = true; io.unobserve(e.target); jouer(e.target, st); }), { threshold: .5 });
  const estBarre = el => { const b = getComputedStyle(el).backgroundImage; return !!b && b.indexOf('gradient') >= 0 && /242,\s*194,\s*48/.test(b); };
  let file = false;
  function scanner() {
    file = false; if (calme()) return;
    document.querySelectorAll('em, .voix-mot, .qd[data-u]').forEach(el => {
      if (etat.has(el)) return;
      const tampon = el.matches('.qd[data-u]'); if (!tampon && !estBarre(el)) return;
      const st = { barre: !tampon, vu: false, attente: null }; etat.set(el, st); cacher(el, st); io.observe(el);
    });
  }
  const demander = () => { if (!file) { file = true; Promise.resolve().then(scanner); } };   // avant l'affichage : pas de clignotement
  new MutationObserver(demander).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanner); else scanner();
  window.MDGTrace = { scanner };
})();
