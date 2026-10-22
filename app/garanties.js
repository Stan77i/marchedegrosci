/* ═════════ Marché de Gros CI — pourquoi acheter et vendre ici : nos garanties, dites au bon moment ═════════
   Seulement des promesses que l'application tient déjà (PHILOSOPHIE.md : rien d'inventé) :
   identités vérifiées par l'équipe, numéros cachés, tout se passe dans l'application, pas de liens ni de demandes de code,
   annonces réelles, statuts qui se gagnent, signalement avec preuves, compte officiel. Le paiement par tiers de confiance : « bientôt ».
   <mdg-garanties></mdg-garanties>                 : la bande fine de l'accueil, une garantie à la fois ; toucher → la feuille
   <mdg-garanties data-mode="ligne" data-t="…">    : une ligne de réassurance (fiche produit, annonce publiée) ; toucher → la feuille
   MDGGaranties.ouvrir()                           : la feuille « Pourquoi le Marché de Gros »
   MDGGaranties.avantContact(uid, nom)             : avant d'écrire ou de proposer un prix à quelqu'un qui n'est pas vérifié,
                                                     un rappel court (une fois par personne et par jour), sans bloquer.
   Mouvement réduit : la bande change de phrase sans glisser. Onglet caché : elle s'arrête. */
(function () {
  'use strict';
  if (window.MDGGaranties) return;
  // icônes (lucide, 24 × 24, trait) : le dessin seul, la couleur suit le texte
  const P = {
    tableau: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-4"/>',
    papier: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
    panier: '<path d="M5 10h14l-1.5 9h-11z"/><path d="M9 10l3-6 3 6"/>',
    pousse: '<path d="M12 21v-9"/><path d="M12 12C12 8 9 6 5 6c0 4 3 6 7 6z"/><path d="M12 14c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
    bouclier: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    sceau: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    cache: '<path d="M10.7 5.1A10.7 10.7 0 0 1 12 5c4.6 0 8.4 2.9 9.9 7a10.8 10.8 0 0 1-1.6 2.9"/><path d="M6.6 6.6A10.8 10.8 0 0 0 2.1 12a10.8 10.8 0 0 0 13.3 6.4"/><path d="M9.9 9.9a3 3 0 1 0 4.2 4.2"/><path d="m2 2 20 20"/>',
    main: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    lien: '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>',
    reel: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
    drapeau: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    etoile: '<path d="M11.5 2.3a.5.5 0 0 1 .9 0l2.3 4.7a2 2 0 0 0 1.5 1.1l5.2.8a.5.5 0 0 1 .3.9l-3.8 3.7a2 2 0 0 0-.6 1.8l.9 5.1a.5.5 0 0 1-.8.6l-4.6-2.4a2 2 0 0 0-1.9 0L6 21.1a.5.5 0 0 1-.7-.6l.9-5.1a2 2 0 0 0-.6-1.8L1.8 9.9a.5.5 0 0 1 .3-.9l5.2-.8A2 2 0 0 0 8.8 7z"/>',
    horloge: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendrier: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
    prix: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    carte: '<path d="M14.1 5.6a2 2 0 0 0 1.8 0l3.7-1.9A1 1 0 0 1 21 4.6v12.8a1 1 0 0 1-.6.9l-4.5 2.2a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.7 1.9A1 1 0 0 1 3 19.4V6.6a1 1 0 0 1 .6-.9l4.5-2.2a2 2 0 0 1 1.8 0z"/><path d="M15 5.8v15"/><path d="M9 3.2v15"/>',
    camion: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.3A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    cadenas: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    groupe: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    cloche: '<path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/>',
    volant: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/><path d="M14 12h8"/><path d="M2 12h8"/><path d="m13 14 4 7.5"/><path d="m11 14-4 7.5"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    fermer: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  const ico = (n, t, w) => `<svg width="${t || 16}" height="${t || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n]}</svg>`;

  // la bande : une phrase courte, le mot qui compte en accent (voix du logo).
  // Les garanties ouvrent la feuille « Pourquoi le Marché de Gros » ; les fonctions utiles (22/10/2026, pour faire connaître l'application)
  // ouvrent directement la fonction. Seulement ce que l'application fait déjà.
  const PAGE = p => () => dispatchEvent(new CustomEvent('mdg:aller', { detail: { page: p } }));
  const FEN = (m, f, a) => () => { const o = window[m]; if (!o || typeof o[f] !== 'function') return false; o[f].apply(o, a || []); };
  // un onglet de l'accueil (Marché, Prix, Activité, Alertes)
  const ONGLET = nom => () => { const x = [...document.querySelectorAll('.acc-ong button')].find(y => y.textContent.trim().startsWith(nom)); if (!x) return false; x.click(); };
  // Toutes les phrases d'accroche vivent ici (22/10/2026 : la barre du haut est libérée, elle ne montre plus que le nom 5 s).
  // Garanties, nouveautés et fonctions utiles alternent ; seulement ce que l'application fait vraiment.
  const BANDE = [
    ['tableau', 'Nouveau : l’onglet ', 'Prix', ', le moins cher en haut', ONGLET('Prix')],
    ['bouclier', 'Parcours ', 'sécurisé', ' : tout se passe ici'],
    ['panier', 'Vendez en ', 'direct', ', sans intermédiaire', PAGE('vendre')],
    ['papier', 'Un ', 'mot secret', ' du vendeur dans chaque colis', FEN('MDGAstuces', 'tour', ['mot', true])],
    ['sceau', 'Identités ', 'vérifiées', ' par l’équipe'],
    ['main', 'Négociez ici, payez ', 'à la livraison', ''],
    ['horloge', 'Pas de réclamation ? Payé sous ', '24 h', '', FEN('MDGAstuces', 'tour', ['verifier', true])],
    ['calendrier', 'L’année du ', 'marché', ' : quoi récolter, et quand', PAGE('annee')],
    ['cadenas', 'Pas de remboursement ', 'sans preuves', '', FEN('MDGAstuces', 'tour', ['refus', true])],
    ['cache', 'Votre numéro reste ', 'caché', ''],
    ['tableau', 'Baissez votre prix : vous ', 'montez', ' dans le tableau', ONGLET('Prix')],
    ['carte', 'Le ', 'réseau', ' : tout le pays sur la carte', PAGE('carte')],
    ['bouclier', 'Bientôt : l’argent ', 'bloqué', ' jusqu’à la livraison', FEN('MDGAstuces', 'tour', ['sequestre', true])],
    ['camion', 'Suivez votre ', 'commande', ', étape par étape', FEN('MDGCommandes', 'ouvrir')],
    ['sceau', 'Coopératives ', 'vérifiées', ''],
    ['lien', 'Ni liens, ni ', 'arnaques', ' au code'],
    ['prix', 'Les prix du marché, ', 'par zone', '', PAGE('prix')],
    ['cadenas', 'Réception validée par ', 'code secret', '', FEN('MDGAstuces', 'tour', ['codes', true])],
    ['panier', 'Achetez en ', 'gros', ', partout en Côte d’Ivoire', PAGE('acheter')],
    ['reel', 'Que des annonces ', 'réelles', ''],
    ['groupe', 'Achats ', 'groupés', ' : à plusieurs, moins cher', FEN('MDGGroupes', 'ouvrir')],
    ['main', 'Un litige ? On juge sur ', 'preuves', ', à trois'],
    ['cloche', 'Alertes produits : ', 'prévenu', ' dès qu’il arrive', FEN('MDGAlertes', 'gerer')],
    ['pousse', 'Du champ au ', 'marché', ''],
    ['volant', 'Chauffeur ? Inscrivez-vous, c’est ', 'gratuit', '', FEN('MDGChauffeur', 'ouvrir')]
  ];
  // la feuille : chaque garantie, ce que l'application fait vraiment
  const DETAIL = [
    ['sceau', 'Des identités vérifiées', 'Une personne de l’équipe compare la pièce d’identité, encore valide, et un selfie. Le badge bleu n’apparaît qu’après sa décision.'],
    ['cache', 'Votre numéro reste caché', 'Personne ne voit votre numéro. On vous écrit et on négocie avec vous dans l’application.'],
    ['lien', 'Ni liens, ni arnaques au code', 'Les liens, les adresses e-mail, les numéros et les demandes de code secret sont refusés dans les messages. Le Marché de Gros ne vous demandera jamais votre code.'],
    ['reel', 'Que des annonces réelles', 'Chaque offre et chaque demande a été publiée par un membre. Aucun chiffre n’est inventé : les prix viennent des annonces.'],
    ['etoile', 'Des statuts qui se gagnent', 'Vendeur de confiance, acheteur sérieux, répond vite : ils se gagnent par des ventes conclues et des avis, jamais en payant.'],
    ['drapeau', 'Un problème ? Signalez', 'Signalez une personne avec une preuve. L’équipe examine chaque signalement et peut bannir un compte à vie.'],
    ['main', 'Négociez ici, payez à la livraison', 'Mettez-vous d’accord sur le prix et la quantité dans l’application. Voyez la marchandise, puis payez : jamais d’avance.']
  ];
  const CSS = `mdg-garanties,:host{display:block}
.gr-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:32px;margin:0;padding:0 14px;border:0;background:transparent;color:rgba(243,239,228,.82);font:500 13px/1 Jost,system-ui,sans-serif;cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent}
.gr-b:focus-visible{outline:2px solid #F2C230;outline-offset:-2px;border-radius:16px}
.gr-l{display:inline-flex;align-items:center;gap:8px;min-width:0;white-space:nowrap}
.gr-l svg{flex:none;color:#F2C230}
.gr-l em{font:900 italic 13.5px/1 Jost,sans-serif;letter-spacing:-.01em;color:#F2C230;font-style:italic}
.gr-l .gr-tx{overflow:hidden;text-overflow:ellipsis}
.gr-b .gr-c{flex:none;color:rgba(243,239,228,.45)}
.gr-l.entre{animation:grIn .5s cubic-bezier(.22,1,.36,1) both}.gr-l.sort{animation:grOut .32s cubic-bezier(.55,0,.75,.2) both}
@keyframes grIn{from{opacity:0;transform:translateY(9px);filter:blur(3px)}to{opacity:1;transform:none;filter:none}}
@keyframes grOut{to{opacity:0;transform:translateY(-9px);filter:blur(3px)}}
.gr-ligne{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;margin:0;padding:10px 14px;border:1px solid var(--gr-l-bd,rgba(23,21,18,.1));border-radius:14px;background:var(--gr-l-bg,rgba(16,57,43,.05));color:var(--gr-l-fg,#10392B);font:500 14px/1.35 Jost,system-ui,sans-serif;text-align:left;cursor:pointer}
.gr-ligne svg{flex:none}.gr-ligne span{flex:1;min-width:0}.gr-ligne b{font-weight:600}
.gr-ligne:focus-visible{outline:2px solid #10392B;outline-offset:2px}
.gr-fond{position:fixed;inset:0;z-index:9300;background:rgba(8,7,5,.55);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:grFond .25s ease both}
@keyframes grFond{from{opacity:0}}
.gr-f{width:100%;max-width:480px;max-height:calc(100dvh - 24px);overflow:auto;background:#F3EFE4;color:#171512;border-radius:28px 28px 0 0;padding:10px 20px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -20px 60px rgba(0,0,0,.35);animation:grMonte .42s cubic-bezier(.22,1,.36,1) both}
@keyframes grMonte{from{transform:translateY(100%)}}
.gr-poig{width:40px;height:4px;border-radius:2px;background:rgba(23,21,18,.18);margin:0 auto 10px}
.gr-hd{display:flex;align-items:flex-start;gap:12px}
.gr-hd h2{flex:1;margin:8px 0 0;font:600 26px/1.08 Jost,sans-serif;letter-spacing:-.015em}
.gr-hd h2 em{font:900 italic 1em Jost,sans-serif;color:#10392B;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,rgba(242,194,48,.62) 60%,rgba(242,194,48,.62) 94%,transparent 94%);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gr-x{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.07);color:#171512;display:grid;place-items:center;cursor:pointer}
.gr-x:focus-visible{outline:2px solid #10392B;outline-offset:2px}
.gr-ch{margin:8px 0 18px;font:400 15px/1.5 Jost,system-ui,sans-serif;color:#4D473D}
.gr-role{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 20px}
.gr-role div{padding:12px 10px;border-radius:16px;background:#10392B;color:#F3EFE4}
.gr-role b{display:block;font:900 italic 17px/1 Jost,sans-serif;color:#F2C230;letter-spacing:-.01em}
.gr-role small{display:block;margin-top:6px;font:400 12.5px/1.35 Jost,system-ui,sans-serif;color:rgba(243,239,228,.82)}
.gr-li{display:flex;gap:14px;padding:12px 0;border-top:1px solid rgba(23,21,18,.08)}
.gr-li .gr-i{flex:none;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:rgba(16,57,43,.08);color:#10392B}
.gr-li b{display:block;font:600 16px/1.25 Jost,system-ui,sans-serif}.gr-li p{margin:3px 0 0;font:400 14px/1.45 Jost,system-ui,sans-serif;color:#4D473D}
.gr-bt{display:flex;gap:12px;align-items:center;margin:14px 0 4px;padding:12px 14px;border-radius:16px;background:rgba(242,194,48,.22);color:#4A3A06;font:500 14px/1.4 Jost,system-ui,sans-serif}
.gr-bt svg{flex:none;color:#765802}
.gr-ok{display:block;width:100%;height:52px;margin-top:16px;border:0;border-radius:26px;background:#10392B;color:#F3EFE4;font:600 16px/1 Jost,system-ui,sans-serif;cursor:pointer}
.gr-ok:focus-visible{outline:2px solid #10392B;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.gr-l.entre,.gr-l.sort,.gr-fond,.gr-f{animation:none}}`;
  const css = () => { if (document.getElementById('grCss')) return; const s = document.createElement('style'); s.id = 'grCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); };
  css();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moinsDeMouvement = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ——— la feuille « Pourquoi le Marché de Gros » ———
  let fond = null;
  function ouvrir() {
    if (fond) return;
    fond = document.createElement('div'); fond.className = 'gr-fond';
    fond.innerHTML = `<div class="gr-f" role="dialog" aria-modal="true" aria-labelledby="grT"><div class="gr-poig" aria-hidden="true"></div>
      <div class="gr-hd"><h2 id="grT">Pourquoi le <em>Marché de Gros</em></h2><button type="button" class="gr-x" aria-label="Fermer">${ico('fermer', 20)}</button></div>
      <p class="gr-ch">Nous ne vendons rien : nous mettons en relation les producteurs, les grossistes et les acheteurs, et nous veillons à ce que chacun échange en confiance.</p>
      <div class="gr-role" aria-label="Notre rôle"><div><b>On connecte</b><small>Ceux qui ont et ceux qui cherchent, partout dans le pays.</small></div><div><b>On vérifie</b><small>Les pièces d’identité, à la main, une par une.</small></div><div><b>On protège</b><small>Les numéros, les échanges, contre les arnaques.</small></div></div>
      ${DETAIL.map(([i, t, d]) => `<div class="gr-li"><span class="gr-i">${ico(i, 20)}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}
      <div class="gr-bt">${ico('horloge', 20)}<span><b>Bientôt</b> : le paiement sécurisé par un tiers de confiance, qui garde l’argent jusqu’à la livraison.</span></div>
      <button type="button" class="gr-ok">J’ai compris</button></div>`;
    document.body.appendChild(fond);
    const avant = document.activeElement;
    const fin = () => { if (!fond) return; fond.remove(); fond = null; removeEventListener('keydown', clav); if (avant && avant.focus) try { avant.focus(); } catch (_) {} };
    const clav = e => { if (e.key === 'Escape') fin(); };
    addEventListener('keydown', clav);
    fond.addEventListener('click', e => { if (e.target === fond) fin(); });
    fond.querySelector('.gr-x').onclick = fin; fond.querySelector('.gr-ok').onclick = fin;
    setTimeout(() => { const x = fond && fond.querySelector('.gr-x'); if (x) x.focus(); }, 60);
  }

  // ——— la bande et la ligne ———
  class Garanties extends HTMLElement {
    connectedCallback() {
      if (this._pret) return; this._pret = true;
      // tout le contenu vit dans une ombre (shadow DOM) : le moteur de gabarits de l'application (dc-runtime) et React
      // ne voient que la balise vide — écrire dedans directement faisait planter le rendu (removeChild)
      this.r = this.shadowRoot || this.attachShadow({ mode: 'open' });
      if (this.dataset.mode === 'ligne') return this.ligne();
      this.r.innerHTML = `<style>${CSS}</style><button type="button" class="gr-b" aria-label="Pourquoi le Marché de Gros : nos garanties"><span class="gr-l" aria-live="off"></span><span class="gr-c">${ico('chev', 14)}</span></button>`;
      // toucher : la fonction annoncée, ou la feuille des garanties (module pas encore chargé : la feuille)
      this.r.querySelector('.gr-b').onclick = () => { const go = BANDE[this.i][4]; if (!go || go() === false) ouvrir(); };
      this.i = Math.floor(Math.random() * BANDE.length); this.montrer(false);
      this.t = setInterval(() => { if (document.hidden || !this.isConnected) return; this.i = (this.i + 1) % BANDE.length; this.montrer(true); }, 4200);
    }
    disconnectedCallback() { clearInterval(this.t); this._pret = false; }
    static get observedAttributes() { return []; }
    montrer(anime) {
      const l = this.r && this.r.querySelector('.gr-l'); if (!l) return;
      const [i, a, k, b] = BANDE[this.i];
      const bt = this.r.querySelector('.gr-b'); if (bt) bt.setAttribute('aria-label', a + k + b + (BANDE[this.i][4] ? ' : ouvrir' : ' : nos garanties'));
      const poser = () => { l.innerHTML = `${ico(i, 16)}<span class="gr-tx">${esc(a)}<em>${esc(k)}</em>${esc(b)}</span>`; l.className = 'gr-l' + (anime && !moinsDeMouvement() ? ' entre' : ''); };
      if (!anime || moinsDeMouvement()) return poser();
      l.className = 'gr-l sort'; setTimeout(poser, 300);
    }
    ligne() {
      const t = this.dataset.t || 'Identités vérifiées, numéros cachés, tout se passe ici.';
      this.r.innerHTML = `<style>${CSS}</style><button type="button" class="gr-ligne">${ico('bouclier', 20)}<span><b>Achetez en confiance.</b> ${esc(t)}</span>${ico('chev', 16)}</button>`;
      this.r.querySelector('button').onclick = ouvrir;
    }
  }
  if (window.customElements && !customElements.get('mdg-garanties')) customElements.define('mdg-garanties', Garanties);

  // ——— avant d'écrire à quelqu'un qui n'est pas vérifié : un rappel court, une fois par personne et par jour ———
  function avantContact(uid, nom) {
    try {
      if (!uid || !window.MDGToast) return;
      const S = window.MDGStatut;
      if (S && S.estOfficiel && S.estOfficiel(uid)) return;
      if (S && S.estVerifie ? S.estVerifie(uid) : (window.MDGIdentite && MDGIdentite.estVerifie(uid))) return;
      const k = 'mdg-garanties:vu', j = new Date().toISOString().slice(0, 10);
      let vu = {}; try { vu = JSON.parse(localStorage.getItem(k) || '{}'); } catch (_) {}
      if (vu[uid] === j) return; vu[uid] = j;
      try { localStorage.setItem(k, JSON.stringify(vu)); } catch (_) {}
      MDGToast.dire(nom || 'Ce membre', { type: 'alerte', sous: 'Pas encore vérifié : ne payez jamais d’avance.', duree: 6500, muet: true, action: { t: 'Pourquoi', fn: ouvrir } });
    } catch (_) {}
  }

  window.MDGGaranties = { ouvrir, avantContact, BANDE, DETAIL };
})();
