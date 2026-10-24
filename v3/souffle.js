/* ═════════ Marché de Gros CI — <mdg-souffle> : le milieu de la barre du haut ═════════
   Demande du propriétaire (22/10/2026) : la barre du haut est LIBÉRÉE. Plus de phrases défilantes.
   Seul le nom « Marché de Gros » s'écrit, reste 5 secondes, puis s'efface : à l'ouverture, à chaque retour sur l'application,
   et toutes les 30 minutes si elle reste ouverte. Les phrases d'accroche sont dans la bande sous le titre (app/garanties.js).
   Mouvement réduit : le nom apparaît et disparaît en fondu. (L'ancien défilement de phrases reste plus bas, éteint.)
   Utilisation : <mdg-souffle></mdg-souffle> (data-go="0" pour attendre, puis "1" pour lancer) (le composant se dessine seul ; le cadre de l'application ne touche pas à son contenu). */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('mdg-souffle')) return;
  // courtes, au présent, qui donnent envie : ce qu'on trouve ici, et qui on y rencontre
  // très courtes et concrètes (demande du propriétaire) : ce que l'app fait vraiment, rien d'autre
  const PHRASES = [
    'Vendez en direct.',
    'Achetez en gros.',
    'Négociez le prix.',
    'Payez à la livraison.',
    'Votre numéro reste caché.',
    'Sceau vert : identité vérifiée.',
    'Coopératives vérifiées.',
    'Partout en Côte d’Ivoire.',
    'Du champ au marché.'
  ];
  const CSS = `mdg-souffle{position:relative;display:block;flex:1;min-width:0;height:100%;overflow:hidden;pointer-events:none}
.sf-l{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;white-space:nowrap}
.sf-nom{font:600 20px/1 Jost,system-ui,sans-serif;color:#10392B;justify-content:flex-start}
.sf-nom>span{display:block;max-width:100%;padding:0 4px;box-sizing:border-box}
.sf-nom svg{display:block;height:36px;width:auto;max-width:100%;margin:0}
.sf-mq.sf-in span{animation:none;opacity:1;filter:none}
.sf-mq.sf-in .mq-m{animation:sfIn .62s cubic-bezier(.22,1,.36,1) both}
.sf-mq.sf-in .mq-g{animation:sfEcrit .7s .25s cubic-bezier(.65,0,.35,1) both}
@keyframes sfEcrit{from{clip-path:inset(-20% 100% -20% 0)}to{clip-path:inset(-20% -5% -20% 0)}}
.sf-ph{font:500 15px/1 Jost,system-ui,sans-serif;color:#3E382C;justify-content:flex-start;padding-left:2px}
.sf-ph.sf-2{flex-wrap:wrap;align-content:center;white-space:normal;font-size:13.5px;line-height:1.22}
.sf-ph.sf-3{font-size:12.5px}
.sf-l span{display:inline-block;white-space:pre;opacity:0;will-change:transform,opacity,filter}
.sf-in span{animation:sfIn .62s cubic-bezier(.22,1,.36,1) forwards;animation-delay:calc(var(--i) * 55ms)}
.sf-out span{opacity:1;animation:sfOut .42s cubic-bezier(.4,0,1,1) forwards;animation-delay:calc(var(--i) * 30ms)}
@keyframes sfIn{0%{opacity:0;transform:translateY(.55em);filter:blur(6px)}100%{opacity:1;transform:none;filter:blur(0)}}
@keyframes sfOut{0%{opacity:1;transform:none;filter:blur(0)}100%{opacity:0;transform:translateY(-.45em);filter:blur(5px)}}
@media (prefers-reduced-motion:reduce){.sf-mq.sf-in .mq-m,.sf-mq.sf-in .mq-g{animation:none}.sf-in span{animation:sfFade .4s ease forwards;animation-delay:0s}.sf-out span{animation:sfFadeOut .3s ease forwards;animation-delay:0s}}
.sf-fin{animation:sfFin .6s cubic-bezier(.4,0,1,1) forwards}@keyframes sfFin{to{opacity:0;transform:translateY(-6px);filter:blur(4px)}}
@media (prefers-reduced-motion:reduce){.sf-fin{animation:sfFadeOut .4s ease forwards}}
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
      // le nom (logo Étal vert, app/marque.js) : « marché » monte, « de Gros » s'écrit ; sans la marque, le nom s'écrit lettre par lettre
      this._nom();
      // retour sur l'application (au moins 20 s après la dernière fois) : le nom revient 5 s ; et toutes les 30 minutes
      this._vis = () => { if (!document.hidden && Date.now() - (this._vu || 0) > 20000) this._nom(); };
      document.addEventListener('visibilitychange', this._vis);
      this._ti = setInterval(() => { if (!document.hidden) this._nom(); }, 30 * 60000);
    }
    disconnectedCallback() { clearTimeout(this._t); clearInterval(this._ti); document.removeEventListener('visibilitychange', this._vis); this._pret = false; this.textContent = ''; }
    // le nom (logo Étal, app/marque.js) s'écrit, reste 5 s, puis s'efface ; ensuite la barre reste vide
    _nom() {
      clearTimeout(this._t); this._vu = Date.now(); this.textContent = '';
      if (window.MDGMarque) { const l = document.createElement('span'); l.className = 'sf-l sf-nom sf-mq sf-in';
        const s = document.createElement('span'); s.style.setProperty('--i', 0); s.innerHTML = MDGMarque.empile({ fond: 'clair', trait: false }); /* sur deux lignes : la place est comptée entre le rond et la loupe */ l.appendChild(s); this.appendChild(l); }
      else this._ligne('Marché de Gros', 'sf-nom', true);
      this._t = setTimeout(() => { const l = this.querySelector('.sf-l'); if (!l) return;
        l.classList.add('sf-fin'); setTimeout(() => { if (l.isConnected) l.remove(); }, 650); }, 5000);
    }
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
