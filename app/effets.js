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
   Quand l'élément sort de l'écran (page quittée, menu fermé, défilement), il est remis à zéro ; quand il revient, ça rejoue.
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
  const io = new IntersectionObserver(es => es.forEach(e => { const st = etat.get(e.target); if (!st) return;
    if (e.isIntersecting) { if (!st.vu) { st.vu = true; jouer(e.target, st); } }
    else { st.vu = false; cacher(e.target, st); } }), { threshold: .5 });
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
