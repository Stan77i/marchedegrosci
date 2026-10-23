/* ═════════ Marché de Gros CI — site en construction : seul l'administrateur entre ═════════
   Même règle que l'ancien site (index-v3.html) : le voile #garde reste posé tant que le serveur n'a pas confirmé est_admin
   pour le compte connecté. Connexion réservée : numéro + code secret, sans création de compte.
   Le contenu de ces pages n'a rien de secret (c'est la vitrine publique à venir) : le voile évite seulement qu'un visiteur
   tombe sur un site pas fini. Pour ouvrir au public : retirer le bloc « EN CONSTRUCTION » de la page, ce fichier et le noindex. */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('garde')) return;
  var N = window.MDGNuage, $ = function (i) { return document.getElementById(i); };
  var P = $('gardeP'), F = $('gardeF'), E = $('gardeE'), B = $('gardeB');
  function etat(t, form) { P.textContent = t; F.hidden = !form; if (form) setTimeout(function () { try { $('gardeTel').focus(); } catch (_) {} }, 50); }
  function refuse() {
    try { localStorage.removeItem('mdg-site:admin'); sessionStorage.removeItem('mdg-site:essai'); } catch (_) {}
    etat('Ce compte n’est pas administrateur. Le site est en maintenance : retour…');
    setTimeout(function () { location.replace('../maintenance.html'); }, 2500);
  }
  function verifier() {
    if (!N || !N.session()) { etat('Réservé à l’administrateur. Entrez votre numéro et votre code secret.', true); return; }
    etat('Vérification…');
    N.rpc('est_admin').then(function (a) {
      if (a !== true) return refuse();
      try { localStorage.setItem('mdg-site:admin', '1'); sessionStorage.removeItem('mdg-site:essai'); } catch (_) {}
      document.documentElement.classList.remove('garde');
      document.dispatchEvent(new Event('site:ouvert'));
    }).catch(function () { etat('Vérification impossible pour l’instant (réseau ?). Réessayez.', true); });
  }
  F.onsubmit = function (e) {
    e.preventDefault(); E.textContent = ''; if (!N) return;
    B.disabled = true; B.textContent = 'Vérification…';
    N.signIn($('gardeTel').value, $('gardeCode').value.trim()).then(verifier)
      .catch(function (x) { E.textContent = (x && x.message) || 'Connexion impossible. Réessayez.'; })
      .then(function () { B.disabled = false; B.textContent = 'Entrer'; });
  };
  verifier();
})();
