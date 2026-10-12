/* ═════════ Marché de Gros CI — <mdg-souffle> : le milieu de la barre du haut, à la manière de Gmail ═════════
   À l'ouverture, le nom « Marché de Gros » s'écrit (≈ 3,5 s), puis il s'efface et laisse passer, l'une après l'autre,
   des phrases qui disent ce qu'on vient faire ici. Chaque phrase monte mot par mot, en escalier, en sortant d'un léger flou ;
   elle repart vers le haut de la même façon avant la suivante. Toute la barre reste un bouton « Chercher ».
   Mouvement réduit : le nom, puis une seule phrase, en fondu, sans déplacement. Onglet caché : pause.
   Utilisation : <mdg-souffle></mdg-souffle> (data-go="0" pour attendre, puis "1" pour lancer) (le composant se dessine seul ; le cadre de l'application ne touche pas à son contenu). */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('mdg-souffle')) return;
  const PHRASES = [
    'Chercher un produit, une ville…',
    'Vous êtes connecté à tous les marchés de gros de Côte d’Ivoire.',
    'Tomate, oignon, plantain…',
    'Vous êtes connecté à tous les grossistes du pays.',
    'Qui vend près de chez vous ?',
    'Vous êtes connecté aux meilleurs acheteurs du pays.',
    'Le bon produit, au bon endroit.',
    'Vous êtes connecté aux coopératives de tout le pays.',
    'Du champ au marché, sans détour.',
    'Dites ce qu’il vous faut.'
  ];
  const CSS = `mdg-souffle{position:relative;display:block;flex:1;min-width:0;height:100%;overflow:hidden;pointer-events:none}
.sf-l{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;white-space:nowrap}
.sf-nom{font:500 23px/1 'Cormorant Garamond',Georgia,serif;color:#F5F0E6;letter-spacing:.005em}
.sf-ph{font:400 15.5px/1 Jost,system-ui,sans-serif;color:#B9AD98;justify-content:flex-start;padding-left:2px}
.sf-ph.sf-2{flex-wrap:wrap;align-content:center;white-space:normal;font-size:13.5px;line-height:1.22}
.sf-ph.sf-3{font-size:12.5px}
.sf-l span{display:inline-block;white-space:pre;opacity:0;will-change:transform,opacity,filter}
.sf-in span{animation:sfIn .62s cubic-bezier(.22,1,.36,1) forwards;animation-delay:calc(var(--i) * 55ms)}
.sf-out span{opacity:1;animation:sfOut .42s cubic-bezier(.4,0,1,1) forwards;animation-delay:calc(var(--i) * 30ms)}
@keyframes sfIn{0%{opacity:0;transform:translateY(.55em);filter:blur(6px)}100%{opacity:1;transform:none;filter:blur(0)}}
@keyframes sfOut{0%{opacity:1;transform:none;filter:blur(0)}100%{opacity:0;transform:translateY(-.45em);filter:blur(5px)}}
@media (prefers-reduced-motion:reduce){.sf-in span{animation:sfFade .4s ease forwards;animation-delay:0s}.sf-out span{animation:sfFadeOut .3s ease forwards;animation-delay:0s}}
@keyframes sfFade{to{opacity:1}}@keyframes sfFadeOut{from{opacity:1}to{opacity:0}}`;
  const REDUIT = matchMedia('(prefers-reduced-motion: reduce)');

  class Souffle extends HTMLElement {
    static get observedAttributes() { return ['data-go']; }
    // data-go="0" : attendre (l'application tient l'écran d'accueil) ; "1" ou absent : commencer
    attributeChangedCallback() { if (this.isConnected) this.connectedCallback(); }
    connectedCallback() {
      if (this._pret || this.closest('x-dc') || this.getAttribute('data-go') === '0') return; this._pret = true;
      if (!document.getElementById('sfCss')) { const st = document.createElement('style'); st.id = 'sfCss'; st.textContent = CSS; document.head.appendChild(st); }
      this.setAttribute('aria-hidden', 'true');
      this._i = -1; this._t = 0;
      this._ligne('Marché de Gros', 'sf-nom', true);  // le nom s'écrit lettre par lettre
      this._suite(3600);
      this._vis = () => { if (document.hidden) clearTimeout(this._t); else this._suite(2400); };
      document.addEventListener('visibilitychange', this._vis);
    }
    disconnectedCallback() { clearTimeout(this._t); document.removeEventListener('visibilitychange', this._vis); this._pret = false; this.textContent = ''; }
    _ligne(txt, cls, lettres) {
      const l = document.createElement('span'); l.className = 'sf-l ' + cls + ' sf-in';
      const morceaux = lettres ? [...txt] : txt.split(/(?<=\s)/).filter(Boolean);  // chaque mot garde son espace : un retour à la ligne ne laisse pas d'espace en tête
      let n = 0; morceaux.forEach(m => { const s = document.createElement('span'); s.textContent = m; if (!/^\s+$/.test(m)) s.style.setProperty('--i', lettres ? n * .45 : n); n++; l.appendChild(s); });
      this.appendChild(l);
      // trop long pour la barre ? deux lignes, puis un cran plus petit si besoin — la phrase n'est jamais coupée
      if (!lettres) { const tient = () => l.scrollWidth <= l.clientWidth + 1 && l.scrollHeight <= l.clientHeight + 1;
        if (!tient()) { l.classList.add('sf-2'); if (!tient()) l.classList.add('sf-3'); } }
      return l;
    }
    _suite(d) {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        if (document.hidden || !this.isConnected) return;
        if (REDUIT.matches && this._i >= 0) return;  // mouvement réduit : une seule phrase, qui reste
        const vieille = this.querySelector('.sf-l:last-child');
        if (vieille) { vieille.classList.remove('sf-in'); vieille.classList.add('sf-out'); setTimeout(() => vieille.remove(), 700); }
        this._i = (this._i + 1) % PHRASES.length;
        setTimeout(() => { if (this.isConnected) this._ligne(PHRASES[this._i], 'sf-ph', false); }, REDUIT.matches ? 120 : 260);
        this._suite(PHRASES[this._i].length > 34 ? 4300 : 3400);
      }, d);
    }
  }
  customElements.define('mdg-souffle', Souffle);
})();
