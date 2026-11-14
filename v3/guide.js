/* ═════════ Marché de Gros CI — « Comment ça marche » : le guide de l'application ═════════
   Refait comme la maquette de Claude Design (14/11/2026) : six étapes, de la publication à la réception ; chacune a son
   « Montrer dans l'app » qui mène au vrai écran d'aujourd'hui (onglets du bas, commandes, négociations).
   Le texte suit les règles de l'application (le mot secret est écrit par le vendeur sur un papier dans le colis, l'acheteur le tape).
   La pastille flottante « Comment ça marche ? » est retirée (décision du propriétaire, 14/11/2026 : l'Aide refaite la remplace).
   API : MDGGuide.ouvrir({ de }?) · fermer() · ETAPES */
(function () {
  'use strict';
  if (window.MDGGuide) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // un onglet de la barre du bas (Marché, Prix, Publier, Activité, Compte) ; les fenêtres posées par-dessus (aide, compte) se ferment d'abord
  const ONGLET = nom => () => { if (location.hash && location.hash !== '#/') location.hash = '#/';
    setTimeout(() => { const b = [...document.querySelectorAll('.v2-tabs .v2-tab')].find(x => (x.querySelector('.lb') || x).textContent.trim() === nom); if (b) b.click(); }, 300); };
  const FEN = (mod, fn) => () => { const m = window[mod]; if (m && typeof m[fn] === 'function') m[fn](); };

  // les six étapes de la maquette ; « aller » : où mène « Montrer dans l'app » (même destination que le prototype)
  const ETAPES = [
    ['Publier', 'Dites ce que vous avez (J’ai) ou ce que vous cherchez (Je cherche). C’est gratuit.', ONGLET('Publier')],
    ['Comparer', 'L’onglet Prix montre les prix publiés et les meilleures offres près de vous.', ONGLET('Prix')],
    ['Négocier', 'Proposez un prix. L’autre accepte, refuse ou contre-propose. Les numéros restent cachés.', FEN('MDGNegoce', 'inbox')],
    ['Commander', 'L’accord fige le prix et la quantité. Vous avez 72 h pour passer la commande.', FEN('MDGCommandes', 'ouvrir')],
    ['Livrer', 'Le vendeur charge avec des photos et le poids, et glisse le mot secret dans le colis.', FEN('MDGCommandes', 'ouvrir')],
    ['Réceptionner', 'Vérifiez, puis tapez le mot secret du vendeur. Vous avez encore 1 h pour signaler un problème.', FEN('MDGCommandes', 'ouvrir')]
  ];

  const CSS = `.gd{position:fixed;top:0;left:0;right:0;bottom:var(--barre-h, 0px);z-index:9000;background:var(--papier);color:var(--encre);font:400 15px/1.45 Jost,system-ui,sans-serif;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
.gd-in{max-width:560px;margin:0 auto;box-sizing:border-box;padding:calc(8px + env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:18px}
.gd-ret{display:flex;align-items:center;margin-left:-11px;align-self:flex-start;min-height:44px;border:0;background:none;padding:0 10px 0 0;color:var(--texte-3);font:400 14px Jost,sans-serif;cursor:pointer}
.gd-ret svg{width:44px;height:44px;padding:11px;box-sizing:border-box;color:var(--encre)}
.gd h1{margin:0;font:600 32px/1.05 Jost,sans-serif;letter-spacing:-.015em;outline:none}
.gd-et{display:flex;gap:14px;background:var(--carte);border-radius:18px;padding:16px}
.gd-n{width:34px;height:34px;flex:none;border-radius:999px;background:var(--vert);color:var(--action-t);font:800 15px/34px Jost,sans-serif;text-align:center}
.gd-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.gd-tx h2{margin:0;font:700 16px/1.3 Jost,sans-serif}
.gd-tx p{margin:0;font-size:14px;line-height:1.45;color:var(--texte-2)}
.gd-go{align-self:flex-start;border:0;background:none;padding:0;min-height:44px;margin:-6px 0 -10px;color:var(--vert);font:700 14px Jost,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gd button:focus-visible{outline:2px solid var(--vert);outline-offset:2px;border-radius:6px}`;
  const RET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  let el = null, cle = null;
  function style() { if (document.getElementById('gdCss')) return; const s = document.createElement('style'); s.id = 'gdCss'; s.textContent = CSS; document.head.appendChild(s); }

  function ouvrir(o) {
    style();
    const de = o && typeof o === 'object' && o.de ? String(o.de) : 'Aide';
    if (!el) {
      el = document.createElement('div'); el.className = 'gd'; el.setAttribute('data-v2', ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Comment ça marche');
      document.body.appendChild(el);
      cle = e => { if (e.key === 'Escape' && el) { e.preventDefault(); fermer(); } };
      document.addEventListener('keydown', cle);
    }
    el.innerHTML = `<div class="gd-in"><button type="button" class="gd-ret" data-r aria-label="Retour à ${esc(de)}">${RET}<span>${esc(de)}</span></button>
      <h1 tabindex="-1">Comment ça marche</h1>
      ${ETAPES.map(([t, x], i) => `<section class="gd-et"><span class="gd-n" aria-hidden="true">${i + 1}</span><div class="gd-tx"><h2>${esc(t)}</h2><p>${esc(x)}</p>
        <button type="button" class="gd-go" data-i="${i}" aria-label="Montrer dans l’app : ${esc(t)}">Montrer dans l’app</button></div></section>`).join('')}</div>`;
    el.querySelector('[data-r]').onclick = () => fermer();
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const a = ETAPES[+b.dataset.i][2];
      // on quitte le guide, l'aide et le compte posés par-dessus, puis on montre l'écran
      fermer(true); if (window.MDGAide && MDGAide.fermer) MDGAide.fermer();
      setTimeout(a, 120);
    });
    el.scrollTop = 0;
    // la barre d'onglets reste visible, « Compte » allumé ; un onglet touché ferme le guide
    if (window.MDGOnglets && MDGOnglets.montrer) try { MDGOnglets.montrer('compte', () => fermer(true)); } catch (_) {}
    el.querySelector('h1').focus({ preventScroll: true });
  }
  function fermer(parOnglet) {
    if (!el) return; el.remove(); el = null; document.removeEventListener('keydown', cle);
    if (!parOnglet && !(window.MDGAide && MDGAide.ouvert && MDGAide.ouvert()) && !document.querySelector('.cp-bg') && window.MDGOnglets && MDGOnglets.cacher) try { MDGOnglets.cacher(); } catch (_) {}
  }

  window.MDGGuide = { ouvrir, fermer, ETAPES };
})();
