/* Marché de Gros CI — petites vibrations au toucher. Écrit pour l'app.
   Réglages → Sons et écran → « Vibrations au toucher » (désactivées tant qu'on ne les active pas).
   • un petit « tic » quand on touche un bouton, un lien, un onglet, un interrupteur ;
   • un « cran » plus léger à chaque produit qui passe dans le sélectionneur de l'accueil.
   Android : l'API vibrate du navigateur. iPhone : Safari n'a pas cette API ; depuis iOS 18, toucher un interrupteur
   système (<input type="checkbox" switch>) donne un léger retour haptique : on en clique un, invisible.
   Sur iPhone, ce retour ne marche donc qu'à partir d'iOS 18 et seulement pendant un toucher (pas pendant un glissé).
   Rien n'est envoyé nulle part ; le choix reste sur ce téléphone.
   API : MDGVibre.tic() · cran() · actif() · regler(oui) · possible */
(function () {
  'use strict';
  if (window.MDGVibre) return;
  const K = 'mdg-app:vibrations';
  let on = false; try { on = localStorage.getItem(K) === '1'; } catch (_) {}
  const android = typeof navigator.vibrate === 'function';
  const iphone = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const possible = android || iphone;
  let dernier = 0, lab = null;

  function haptique() {                                   // iPhone : un interrupteur système invisible
    if (!lab) { lab = document.createElement('label'); lab.setAttribute('aria-hidden', 'true'); lab.style.display = 'none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; lab.appendChild(i); }
    if (!lab.isConnected) document.head.appendChild(lab);
    lab.click();
  }
  function jouer(ms) {
    if (!on || !possible) return; const t = Date.now(); if (t - dernier < 45) return; dernier = t;
    try { if (android) navigator.vibrate(ms); else haptique(); } catch (_) {}
  }
  const tic = () => jouer(10), cran = () => jouer(6);

  const TOUCHABLE = 'button, a[href], [role=button], [role=tab], [role=switch], [role=option], label, summary, select, input[type=checkbox], input[type=radio], input[type=range]';
  document.addEventListener('click', e => {
    if (!on || (lab && lab.contains(e.target))) return;
    const el = e.target && e.target.closest && e.target.closest(TOUCHABLE);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') tic();
  }, true);

  function regler(oui) { on = !!oui; try { localStorage.setItem(K, on ? '1' : '0'); } catch (_) {} if (on) { dernier = 0; tic(); } }
  window.MDGVibre = { tic, cran, actif: () => on, regler, possible };
})();
