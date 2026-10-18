/* Nouveau logo : l'icône de l'écran d'accueil appartient au téléphone, pas à l'application.
   - Android (Chrome) : elle se met à jour seule, quand le téléphone est connecté (Chrome relit le manifeste ; les icônes
     sont dans icons/v2/, une nouvelle adresse qui l'oblige à les reprendre). Cela peut prendre quelques jours.
   - iPhone : l'icône est figée au moment de l'ajout ; seule une réinstallation la change.
   Ce module affiche une fois, et seulement dans l'application installée, une petite carte qui l'explique.
   Version de l'icône : ICONE. À augmenter (avec un nouveau dossier icons/vN/) à chaque changement de logo. */
(function () {
  'use strict';
  var ICONE = '2', CLE = 'mdg-app:icone-vue';
  try {
    var installee = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (!installee || localStorage.getItem(CLE) === ICONE) return;
  } catch (e) { return; }
  var ua = navigator.userAgent || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var adresse = location.host + location.pathname.replace(/[^/]*$/, '');
  var texte = ios
    ? 'Sur iPhone, l’icône de l’écran d’accueil ne change pas toute seule : Apple la garde telle qu’elle était le jour de l’ajout. ' +
      'Pour avoir la nouvelle : appuyez longtemps sur l’icône → <b>Supprimer</b>, puis ouvrez <b>' + adresse + '</b> dans Safari → <b>Partager</b> → <b>Sur l’écran d’accueil</b>. ' +
      'Vos annonces publiées restent en ligne ; reconnectez-vous ensuite avec votre numéro.'
    : 'L’icône de votre écran d’accueil se met à jour toute seule, dans les prochains jours, quand le téléphone est connecté à internet. ' +
      'Si elle ne change pas : appuyez longtemps sur l’icône → <b>Désinstaller</b>, puis ouvrez <b>' + adresse + '</b> dans Chrome → <b>⋮</b> → <b>Installer l’application</b>. ' +
      'Vos annonces publiées restent en ligne.';
  function montrer() {
    if (document.getElementById('mdg-icone')) return;
    var d = document.createElement('div'); d.id = 'mdg-icone'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Nouveau logo');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;max-width:460px;margin:0 auto;' +
      'background:#10392B;color:#F3EFE4;border-radius:20px;padding:16px 16px 14px;box-shadow:0 18px 48px rgba(0,0,0,.45);font:400 14px/1.45 Jost,system-ui,sans-serif;' +
      'transform:translateY(130%);transition:transform .45s cubic-bezier(.22,1,.36,1)';
    var dg = window.MDGMarque ? MDGMarque.dg(44, { fond: 'vert' }) : '';
    d.innerHTML = '<div style="display:flex;gap:12px;align-items:flex-start">' +
      '<span style="flex:none;border-radius:12px;box-shadow:0 0 0 1px rgba(243,239,228,.18)">' + dg + '</span>' +
      '<div><b style="display:block;font-size:16px;margin-bottom:4px;color:#F2C230">Nouveau logo</b><span style="color:rgba(243,239,228,.86)">' + texte + '</span></div></div>' +
      '<button type="button" style="display:block;margin:12px 0 0 auto;min-height:44px;padding:0 20px;border:0;border-radius:999px;background:#F2C230;color:#10392B;font:600 15px Jost,system-ui,sans-serif">Compris</button>';
    document.body.appendChild(d);
    requestAnimationFrame(function () { requestAnimationFrame(function () { d.style.transform = 'none'; }); });
    d.querySelector('button').onclick = function () {
      try { localStorage.setItem(CLE, ICONE); } catch (e) {}
      d.style.transform = 'translateY(130%)'; setTimeout(function () { d.remove(); }, 500);
    };
  }
  // après l'écran d'ouverture, quand l'accueil est posé
  setTimeout(montrer, 5000);
})();
