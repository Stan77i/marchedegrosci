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
