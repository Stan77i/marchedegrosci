/* Marché de Gros CI — petits effets de l'accueil (écrits pour l'app, aucun code repris d'ailleurs).
   <mdg-nb data-v="42"> : le nombre défile de l'ancienne valeur à la nouvelle (0 au premier affichage), format français.
   Si data-v n'est pas un nombre, le texte s'affiche tel quel. Aucun mouvement si le téléphone demande moins d'animations. */
(function () {
  if (!window.customElements || customElements.get('mdg-nb')) return;
  const calme = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fr = n => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  customElements.define('mdg-nb', class extends HTMLElement {
    static get observedAttributes() { return ['data-v']; }
    // le défilement attend que le nombre soit à l'écran (sinon il serait fini avant qu'on le voie)
    connectedCallback() {
      if (this._vu || !window.IntersectionObserver) { this._vu = true; this.jouer(); return; }
      const b = this.getAttribute('data-v'); this.textContent = isFinite(Number(b)) && b !== '' ? '0' : (b || '');
      this._io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { this._io.disconnect(); this._vu = true; this.jouer(); } }, { threshold: .6 });
      this._io.observe(this);
    }
    disconnectedCallback() { if (this._io) this._io.disconnect(); }
    attributeChangedCallback() { if (this.isConnected && this._vu) this.jouer(); }
    jouer() {
      const brut = this.getAttribute('data-v') || '', v = Number(String(brut).replace(/\s/g, ''));
      if (brut === '' || !isFinite(v)) { this.textContent = brut; this._v = null; return; }
      const de = this._v == null ? 0 : this._v; this._v = v; cancelAnimationFrame(this._r);
      if (calme() || de === v) { this.textContent = fr(v); return; }
      const t0 = performance.now(), d = Math.min(1100, 500 + Math.abs(v - de) * 20);
      const pas = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); this.textContent = fr(de + (v - de) * e); if (k < 1) this._r = requestAnimationFrame(pas); };
      this._r = requestAnimationFrame(pas);
    }
  });
})();

/* Le TRACÉ de la barre jaune et le COUP DE TAMPON des urgences — rejoués à chaque retour à l'écran.
   • Barre jaune : tout mot en valeur souligné de maïs (fond en dégradé, rgb 242 194 48) se dessine de gauche à droite, en une fois.
   • Tampon : .qd[data-u] (Il le faut dès que possible, Disponible maintenant…) se pose d'un coup.
   Quand sa page s'en va (page quittée, menu fermé), il est remis à zéro ; quand elle revient, ça rejoue. Le simple défilement ne rejoue rien.
   Animations du navigateur (element.animate) : rien n'est écrit sur l'élément, car l'affichage de l'app réécrit
   classes et attributs à chaque rendu. Rien ne bouge si le téléphone demande moins d'animations. */
(function () {
  if (!window.IntersectionObserver || !window.MutationObserver || !Element.prototype.animate || window.MDGTrace) return;
  const calme = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const etat = new WeakMap();   // élément → { barre, attente (animation « caché » tant qu'il est hors écran) }
  const CACHE_BARRE = { backgroundSize: '0% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' };
  const cacher = (el, st) => { if (!st.attente) st.attente = el.animate([st.barre ? CACHE_BARRE : { opacity: 0 }], { duration: 1, fill: 'forwards' }); };
  // cartes de l'accueil (chiffres, dernières annonces) : la cascade d'arrivée se rejoue quand elles reviennent à l'écran
  const MONTE = '.acc-k, .acc-ligne, .acc-al';
  function jouer(el, st) {
    if (st.attente) { st.attente.cancel(); st.attente = null; }
    if (st.monte) { const i = [...el.parentElement.children].filter(x => x.classList.contains(el.classList[0])).indexOf(el);
      el.animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60 + Math.max(0, i) * 70, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }); return; }
    if (st.barre) el.animate([CACHE_BARRE, { backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: '0 0' }],
      { duration: 750, delay: 120, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
    else { const r = getComputedStyle(el).getPropertyValue('--qd-r').trim() || '-2deg';
      el.animate([{ opacity: 0, transform: 'rotate(-12deg) scale(1.7)' }, { opacity: 1, transform: 'rotate(' + r + ') scale(.93)', offset: .55 }, { opacity: 1, transform: 'rotate(' + r + ') scale(1)' }],
        { duration: 460, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' }); }
  }
  // remis à zéro seulement quand sa page s'en va (glissée de côté, fermée) : jamais pendant qu'on fait défiler la page,
  // sinon les cartes et les mots s'effacent puis rejouent leur arrivée en remontant (petits clignotements, 24/10/2026)
  const partie = r => (r.width === 0 && r.height === 0) || r.right <= 0 || r.left >= innerWidth;
  const io = new IntersectionObserver(es => es.forEach(e => { const st = etat.get(e.target); if (!st) return;
    if (e.isIntersecting) { if (!st.vu) { st.vu = true; jouer(e.target, st); } }
    else if (st.vu && partie(e.boundingClientRect)) { st.vu = false; cacher(e.target, st); } }), { threshold: .5 });
  const estBarre = el => { const b = getComputedStyle(el).backgroundImage; return !!b && b.indexOf('gradient') >= 0 && /242,\s*194,\s*48/.test(b); };
  let file = false;
  function scanner() {
    file = false; if (calme()) return;
    document.querySelectorAll('em, .voix-mot, .qd[data-u], ' + MONTE).forEach(el => {
      if (etat.has(el)) return;
      const monte = el.matches(MONTE), tampon = !monte && el.matches('.qd[data-u]'); if (!monte && !tampon && !estBarre(el)) return;
      const st = { barre: !tampon && !monte, monte, vu: false, attente: null }; etat.set(el, st); if (!monte) cacher(el, st); io.observe(el);
    });
  }
  const demander = () => { if (!file) { file = true; Promise.resolve().then(scanner); } };   // avant l'affichage : pas de clignotement
  new MutationObserver(demander).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanner); else scanner();
  window.MDGTrace = { scanner };
})();
