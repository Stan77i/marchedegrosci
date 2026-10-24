/* ═════════ Marché de Gros CI — la carte du réseau sur le site (site/carte/) ═════════
   La même carte que l'application (app/carte-gl.js : MapLibre, relief, routes, 3 700 localités embarquées), « en plus grand » :
   un panneau à côté pour filtrer (tout / offres / demandes) et lire les annonces touchées sur la carte.
   Les annonces viennent de fil_public() (anonymes : prénom + initiale, ville, produit, quantité) via site/site.js (évènement site:fil).
   Sans WebGL ou sur un appareil faible : la carte légère du site (SVG) à la place. La page a <base href="../../"> (racine du dépôt). */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var nf = function (n) { return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' '); };
  // les districts (chef-lieu) : ce que la carte de l'application lit dans MDGApp.REG
  window.MDGApp = window.MDGApp || { REG: { abidjan: [5.36, -4.01, 'Abidjan'], yamoussoukro: [6.82, -5.28, 'Yamoussoukro'], 'bas-sassandra': [4.95, -6.64, 'San-Pédro'], comoe: [6.73, -3.49, 'Abengourou'],
    denguele: [9.51, -7.56, 'Odienné'], 'goh-djiboua': [6.13, -5.95, 'Gagnoa'], lacs: [6.65, -4.71, 'Dimbokro'], lagunes: [5.42, -4.38, 'Dabou'], montagnes: [7.41, -7.55, 'Man'],
    'sassandra-marahoue': [6.88, -6.45, 'Daloa'], savanes: [9.46, -5.63, 'Korhogo'], 'vallee-du-bandama': [7.69, -5.03, 'Bouaké'], woroba: [7.96, -6.67, 'Séguéla'], zanzan: [8.04, -2.8, 'Bondoukou'] } };
  var D = {}; try { D = JSON.parse($('donnees').textContent); } catch (_) {}
  var NOMS = {}; (D.produits || []).forEach(function (p) { NOMS[p[0]] = p[1]; });
  var tout = [], filtre = 'tout', api = null, choisis = [], avant = null;

  function items() {
    return tout.filter(function (a) { return filtre === 'tout' || a.sens === filtre; }).map(function (a) {
      return { id: a.cle, kind: a.sens, slug: a.product_slug, product: NOMS[a.product_slug] || a.produit, qty: a.quantite, unit: a.unite || '', price: a.sens === 'offre' ? a.prix : null, budget: a.sens === 'demande' ? a.prix : null, region: a.region_slug, city: a.ville || '', vs: !!a.ville_seulement };
    });
  }
  function ligne(a, sel) {
    var nom = NOMS[a.product_slug] || a.produit, q = a.quantite != null ? nf(a.quantite) + ' ' + esc(a.unite || '') + ' · ' : '';
    var img = NOMS[a.product_slug] ? '<img class="ph" src="site/img/' + esc(a.product_slug) + '-160.webp" alt="" width="40" height="40" loading="lazy">' : '<i class="sym ' + (a.sens === 'offre' ? 'sym-o' : 'sym-d nuit') + '"></i>';
    var px = a.prix != null ? '<b class="px">' + nf(a.prix) + ' F' + (a.unite ? '/' + esc(a.unite) : '') + '</b>' : '';
    return '<li class="' + (sel ? 'sel' : '') + '">' + img + '<div><span><b>' + esc(a.nom || 'Un membre') + '</b> ' + (a.sens === 'offre' ? 'vend' : 'cherche') + ' ' + esc(nom.toLowerCase()) + '</span>'
      + '<small>' + q + (a.ville_seulement && a.ville && window.MDGSiteLieu ? MDGSiteLieu(a) : esc(a.ville || (MDGApp.REG[a.region_slug] || [])[2] || '')) + '</small>' + px
      + '<a class="lien" href="application.dc.html#/produits/' + esc(a.product_slug) + '" data-app="' + (a.sens === 'offre' ? '#/produits/' + esc(a.product_slug) : '#/vendre?produit=' + esc(a.product_slug)) + '" data-intention="carte-' + (a.sens === 'offre' ? 'acheter' : 'vendre') + '">' + (a.sens === 'offre' ? 'Acheter' : 'Lui vendre') + '<span class="vh"> : ' + esc(nom) + '</span></a></div></li>';
  }
  function liste() {
    var L = tout.filter(function (a) { return filtre === 'tout' || a.sens === filtre; });
    var h = L.length ? L.map(function (a) { return ligne(a, choisis.indexOf(a.cle) >= 0); }).join('') : '<li class="fil-vide">Aucune annonce ici pour l’instant : la première peut être la vôtre.</li>'; var cl = $('crListe'); if (cl._h !== h) { cl._h = h; cl.innerHTML = h; }   // seulement si la liste a changé (audit du site n° 3)
    var no = tout.filter(function (a) { return a.sens === 'offre'; }).length;
    $('nTout').textContent = tout.length; $('nOffre').textContent = no; $('nDemande').textContent = tout.length - no;
  }
  function montrer(ids) {
    choisis = ids || []; var c = $('crChoix'), L = tout.filter(function (a) { return choisis.indexOf(a.cle) >= 0; });
    if (!L.length) { c.hidden = true; c.innerHTML = ''; liste(); return; }
    if (c.hidden) avant = document.activeElement;   // pour rendre le focus après « Fermer » (audit du site n° 29)
    c.hidden = false;
    c.innerHTML = '<div class="cr-choix-t"><b>' + (L.length > 1 ? L.length + ' annonces ici' : 'L’annonce choisie') + '</b><button type="button" class="fermer" aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><ul class="fil-l cr-liste">' + L.map(function (a) { return ligne(a, false); }).join('') + '</ul>';
    c.querySelector('.fermer').onclick = function () {
      montrer([]);
      var cible = avant && avant !== document.body && document.contains(avant) ? avant : document.querySelector('.cr-filtres [aria-pressed="true"]');
      avant = null; if (cible && cible.focus) cible.focus();
    };
    liste();
  }
  function poser() { if (api) api.set({ items: items(), me: '', sel: '', zones: [], pts: {}, pairs: [], lier: [] }); }

  document.addEventListener('site:fil', function (e) { tout = e.detail || []; liste(); poser(); });
  document.addEventListener('site:fil-erreur', function () { var cl = $('crListe'); if (cl && !tout.length) { cl._h = ''; cl.innerHTML = '<li class="fil-vide">Les annonces ne s’affichent pas pour l’instant (réseau ?). Réessayez dans un moment.</li>'; } });
  document.querySelectorAll('.cr-filtres [data-f]').forEach(function (b) {
    b.onclick = function () { filtre = b.getAttribute('data-f'); document.querySelectorAll('.cr-filtres [data-f]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); montrer([]); poser(); };
  });

  function demarrer() {
    var hote = $('carteGL'), att = $('crAttente');
    var repli = function () { if (att) att.remove(); $('crRepli').hidden = false; hote.classList.add('repli'); dispatchEvent(new Event('resize')); };
    if (!window.MDGCarteGL || !MDGCarteGL.capable()) return repli();
    MDGCarteGL.mount(hote, { onPick: montrer, onSelect: function () {} }).then(function (a) {
      if (!a) return repli();
      api = a; if (att) att.remove(); poser();
    }).catch(repli);
  }
  if (document.documentElement.classList.contains('garde')) document.addEventListener('site:ouvert', demarrer, { once: true }); else demarrer();
})();
