/* ═════════ Marché de Gros CI — le site public : les données en direct et les boutons vers l'application ═════════
   Rien n'est inventé : tout vient de l'application (Supabase, clé publique, fonctions en lecture seule).
   - fil_public()       : les dernières annonces, anonymes (prénom + initiale, ville, produit, quantité) — schéma 80 ;
   - tableau_produits() : les meilleurs prix publiés par produit — schéma 59.
   Le texte de la page est déjà dans le HTML (lisible par Google) ; ce script ajoute seulement ce qui vit.
   Les boutons d'action (data-app="#/vendre"…) : sur téléphone, ils ouvrent l'application à la bonne page ;
   sur ordinateur, ils montrent un code QR vers cette page de l'application. */
(function () {
  'use strict';
  var URL0 = 'https://catmsypctymgkjkfzdkt.supabase.co', KEY = 'sb_publishable_KC2au-t8dqasp5ez9Lq6XQ_JvbTtVQ5';
  var $ = function (i) { return document.getElementById(i); };
  // S : chemin vers la racine du site (« » pour l'accueil, « ../../ » pour une page produit) ; R : la racine du dépôt
  var S = document.documentElement.getAttribute('data-s') || '', R = S + '../';
  var D = {}; try { D = JSON.parse($('donnees').textContent); } catch (_) {}
  var NOMS = {}; (D.produits || []).forEach(function (p) { NOMS[p[0]] = p[1]; });
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function rpc(f, args) {
    return fetch(URL0 + '/rest/v1/rpc/' + f, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  // ——— écriture ———
  var nf = function (n) { return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' '); };
  var INVAR = { kg: 1, t: 1, tonne: 0, l: 1, litre: 0 };
  function unite(q, u) {
    u = String(u || '').trim(); if (!u) return '';
    if (q >= 2 && !INVAR[u] && !/[sx]$/.test(u)) { u = u.split(' ').map(function (m, i) { return i === 0 ? m + 's' : m; }).join(' '); }
    return u;
  }
  function quand(t) {
    var s = (Date.now() - new Date(t).getTime()) / 1000;
    if (s < 3600) return 'il y a ' + Math.max(1, Math.round(s / 60)) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
    var j = Math.round(s / 86400); return j === 1 ? 'hier' : 'il y a ' + j + ' jours';
  }
  function phrase(a) {
    var qui = a.nom || 'Un membre', verbe = a.sens === 'offre' ? 'vend' : 'cherche';
    var q = a.quantite != null ? nf(a.quantite) + (a.unite ? ' ' + unite(a.quantite, a.unite) : '') + ' de ' : '';
    var prod = (NOMS[a.product_slug] || a.produit || 'produit').toLowerCase();
    return '<b>' + esc(qui) + '</b> ' + verbe + ' ' + esc(q) + esc(prod);
  }
  var photo = function (slug, cls) { return NOMS[slug] ? '<img class="' + (cls || 'ph') + '" src="' + S + 'img/' + esc(slug) + '-160.webp" alt="" width="40" height="40" loading="lazy">' : ''; };
  var symb = function (sens, nuit) { return '<i class="sym ' + (sens === 'offre' ? 'sym-o' : 'sym-d' + (nuit ? ' nuit' : '')) + '" aria-hidden="true"></i>'; };

  // ——— le fil et la carte ———
  var carte = document.querySelector('.reseau-carte'), svg = carte && carte.querySelector('svg.ci'), PROJ = null, VB = null, LIEUX = null, REG = {
    abidjan: [5.36, -4.01], yamoussoukro: [6.82, -5.28], 'bas-sassandra': [4.95, -6.64], comoe: [6.73, -3.49], denguele: [9.51, -7.56], 'goh-djiboua': [6.13, -5.95], lacs: [6.65, -4.71],
    lagunes: [5.42, -4.38], montagnes: [7.41, -7.55], 'sassandra-marahoue': [6.88, -6.45], savanes: [9.46, -5.63], 'vallee-du-bandama': [7.69, -5.03], woroba: [7.96, -6.67], zanzan: [8.04, -2.8] };
  if (svg) { try { PROJ = JSON.parse(svg.getAttribute('data-proj')); VB = svg.viewBox.baseVal; } catch (_) {} }
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  function ou(a) {
    var c = (LIEUX && a.ville && LIEUX[norm(a.ville)]) || REG[a.region_slug];
    if (!c || !PROJ || !VB) return null;
    return [((c[1] - PROJ.x0) * PROJ.c * PROJ.k) / VB.width * 100, ((PROJ.y1 - c[0]) * PROJ.k) / VB.height * 100];
  }
  var calque = null, vus = {};
  function villes() {
    if (!carte || !VB || carte.querySelector('.pts')) return;
    calque = document.createElement('div'); calque.className = 'pts'; carte.insertBefore(calque, carte.querySelector('.reseau-legende'));
    calque.style.height = carte.querySelector('svg').getBoundingClientRect().height + 'px';
    (D.villes || []).forEach(function (v) { var s = document.createElement('span'); s.className = 'ville'; s.textContent = v.n; s.style.left = (v.x / VB.width * 100) + '%'; s.style.top = (v.y / VB.height * 100) + '%'; calque.appendChild(s); });
  }
  function points(L) {
    if (!calque) return;
    var g = {};
    L.forEach(function (a) { var p = ou(a); if (!p) return; var k = p[0].toFixed(1) + ':' + p[1].toFixed(1); var x = (g[k] = g[k] || { p: p, o: 0, d: 0, s: a.product_slug }); x[a.sens === 'offre' ? 'o' : 'd']++; if (!NOMS[x.s] && NOMS[a.product_slug]) x.s = a.product_slug; });
    calque.querySelectorAll('.pt').forEach(function (n) { if (!g[n.dataset.k]) n.remove(); });
    Object.keys(g).forEach(function (k, i) {
      var x = g[k], n = x.o + x.d, sens = x.o >= x.d ? 'offre' : 'demande';
      var el = calque.querySelector('.pt[data-k="' + k + '"]');
      if (!el) { el = document.createElement('span'); el.className = 'pt'; el.dataset.k = k; el.style.left = x.p[0] + '%'; el.style.top = x.p[1] + '%'; el.style.animationDelay = '0ms'; /* tous les points d'un coup, sans cascade (audit du site n° 13) */ calque.appendChild(el); vus[k] = 1; }
      el.className = 'pt' + (sens === 'demande' ? ' d' : ''); el.innerHTML = (photo(x.s, 'pp') || symb(sens)) + (n > 1 ? '<b>' + n + '</b>' : '');
      el.title = (x.o ? x.o + ' offre' + (x.o > 1 ? 's' : '') : '') + (x.o && x.d ? ' · ' : '') + (x.d ? x.d + ' demande' + (x.d > 1 ? 's' : '') : '');
    });
  }
  // page produit : <main data-produit="tomate">
  var PROD = (document.querySelector('[data-produit]') || { getAttribute: function () { return ''; } }).getAttribute('data-produit');
  // page d'un district : <main data-region="savanes"> (annonces et prix du district seulement)
  var REGION = (document.querySelector('[data-region]') || { getAttribute: function () { return ''; } }).getAttribute('data-region');
  function publier(h, intention, texte) { return '<a class="lien" href="' + R + 'application.dc.html' + h.replace(/&/g, '&amp;') + '" data-app="' + h.replace(/&/g, '&amp;') + '" data-intention="' + intention + '">' + texte + '</a>'; }
  // n'écrire une liste que si elle a changé : relue toutes les 2 minutes, elle ne doit ni clignoter, ni faire perdre sa place au clavier,
  // ni être relue par les lecteurs d'écran quand rien n'est nouveau (audit antislop du site n° 3, 24/10/2026)
  function poser(el, html) { if (!el || el._h === html) return; el._h = html; el.innerHTML = html; }
  function fil(L) {
    var court = $('filCourt'), long = $('filLong'), pf = $('filProduit');
    if (pf) {
      var LP = L.filter(function (a) { return REGION ? a.region_slug === REGION : a.product_slug === PROD; });
      poser(pf, LP.length ? LP.map(function (a) { var h = '#/produits/' + esc(a.product_slug); return '<li><a class="fil-a" href="' + R + 'application.dc.html' + h + '" data-app="' + h + '" data-intention="annonce">' + ((REGION && photo(a.product_slug)) || symb(a.sens)) + '<div><span>' + phrase(a) + '</span> <small>' + esc(a.ville || '') + (a.ville ? ' · ' : '') + quand(a.publie_le) + '</small></div></a></li>'; }).join('')
        : '<li class="fil-vide">Aucune annonce active ' + (REGION ? 'dans ce district' : 'pour ce produit') + ' en ce moment. ' + publier('#/publier?sens=offre' + (PROD ? '&produit=' + encodeURIComponent(PROD) : ''), 'premiere-annonce', 'Publiez la première') + ' : tout le réseau la verra.</li>');
    }
    if (!L.length) {
      poser(court, '<li class="fil-vide">Aucune annonce pour l’instant. ' + publier('#/publier?sens=offre', 'premiere-annonce', 'Publiez la première') + ' : tout le réseau la verra.</li>');
      poser(long, '<li class="fil-vide">Aucune annonce active pour l’instant. ' + publier('#/publier?sens=offre', 'premiere-annonce', 'Publiez la première') + '.</li>');
      return;
    }
    // chaque annonce s'ouvre dans l'application (fiche du produit) : le parcours voulu, « il clique sur une annonce »
    var ligne = function (a, nuit) { var h = '#/produits/' + esc(a.product_slug); return '<li><a class="fil-a" href="' + R + 'application.dc.html' + h + '" data-app="' + h + '" data-intention="annonce">' + (photo(a.product_slug) || symb(a.sens, nuit)) + '<div><span>' + phrase(a) + '</span> <small>' + esc(a.ville || '') + (a.ville ? ' · ' : '') + quand(a.publie_le) + '</small></div></a></li>'; };
    poser(court, L.slice(0, 3).map(function (a) { return ligne(a, true); }).join(''));
    poser(long, L.slice(0, 40).map(function (a) { return ligne(a, true); }).join(''));
  }
  function lireFil() {
    return rpc('fil_public', { p_limite: 120 }).then(function (L) { L = L || []; fil(L); points(L); document.dispatchEvent(new CustomEvent('site:fil', { detail: L })); })
      .catch(function () {
        // le serveur ne répond pas : chaque liste encore vide le dit, au lieu de « Les annonces arrivent… » pour toujours (audit du site n° 10)
        ['filCourt', 'filLong', 'filProduit'].forEach(function (id) { var c = $(id); if (c && /fil-vide/.test(c.innerHTML)) poser(c, '<li class="fil-vide">Les annonces ne s’affichent pas pour l’instant (réseau ?). Réessayez dans un moment.</li>'); });
        document.dispatchEvent(new Event('site:fil-erreur')); });
  }

  // ——— le tableau ———
  var prix = function (v, u) { return v == null ? '<span class="tb-prix vide">Pas encore</span>' : '<span class="tb-prix">' + nf(v) + ' F<small>par ' + esc(u || 'unité') + '</small></span>'; };
  function tableau() {
    var corps = $('tbCorps'), pp = $('prixProduit'); if (!corps && !pp) return;
    rpc('tableau_produits', { p_region: REGION || null }).then(function (L) {
      if (pp) {
        var r = (L || []).filter(function (x) { return x.slug === PROD; })[0];
        pp.innerHTML = !r ? '<p class="tb-attente">Aucun prix publié pour ce produit en ce moment. ' + publier('#/publier?sens=offre&produit=' + encodeURIComponent(PROD), 'premier-prix', 'Publier mon prix') + '</p>'
          : '<div class="pp"><span>Vendeur le moins cher</span>' + prix(r.meilleure_offre, r.unite_offre) + (r.n_offres ? '<span class="nbul o">' + symb('offre') + r.n_offres + ' offre' + (r.n_offres > 1 ? 's' : '') + '</span>' : '') + '</div>'
          + '<div class="pp"><span>Meilleur budget d’acheteur</span>' + prix(r.meilleure_demande, r.unite_demande) + (r.n_demandes ? '<span class="nbul d">' + symb('demande') + r.n_demandes + ' demande' + (r.n_demandes > 1 ? 's' : '') + '</span>' : '') + '</div>';
      }
      if (!corps) return;
      L = (L || []).slice(0, 8);
      if (!L.length) { corps.innerHTML = '<p class="tb-attente">Aucun prix publié pour l’instant. ' + publier('#/publier?sens=offre', 'premier-prix', 'Publier mon prix') + '</p>'; return; }
      corps.innerHTML = L.map(function (r) {
        var nom = NOMS[r.slug] || r.lab, img = NOMS[r.slug] ? '<img src="' + S + 'img/' + esc(r.slug) + '-160.webp" alt="' + esc(nom) + '" width="56" height="56" loading="lazy">' : '<span style="width:56px"></span>';
        var achat = r.n_offres > 0;
        return '<div class="tb-ligne" role="row"><span class="tb-p" role="cell">' + img + esc(nom) + '</span>'
          + '<span role="cell">' + prix(r.meilleure_offre, r.unite_offre) + '</span><span role="cell">' + prix(r.meilleure_demande, r.unite_demande) + '</span>'
          + '<span class="tb-n" role="cell">' + (r.n_offres ? '<span class="nbul o">' + symb('offre') + r.n_offres + '</span>' : '') + (r.n_demandes ? '<span class="nbul d">' + symb('demande') + r.n_demandes + '</span>' : '') + '</span>'
          + '<span role="cell"><a class="tb-go" href="' + R + 'application.dc.html#/produits/' + esc(r.slug) + '" data-app="' + (achat ? '#/produits/' + esc(r.slug) : '#/vendre?produit=' + esc(r.slug)) + '" data-intention="' + (achat ? 'acheter' : 'vendre') + '">' + (achat ? 'Acheter' : 'Vendre') + '</a></span></div>';
      }).join('');
    }).catch(function () { [corps, pp].forEach(function (c) { if (c) c.innerHTML = '<p class="tb-attente">Les prix ne répondent pas pour l’instant. Réessayez dans un moment.</p>'; }); });
  }

  // ——— la mesure (schéma 81) : une vue par page et par visite, un clic par bouton d'action ; sans donnée personnelle ; jamais l'administrateur ———
  var ADMIN = false; try { ADMIN = localStorage.getItem('mdg-site:admin') === '1'; } catch (_) {}
  var UTM = {}; (location.search.match(/utm_[a-z]+=[^&]*/g) || []).forEach(function (x) { var k = x.split('='); UTM[k[0]] = decodeURIComponent(k[1] || ''); });
  var PAGE = location.pathname.replace(/^.*?\/site\//, 'site/').replace(/index\.html$/, '') || 'site/';
  function mesurer(ev, cible) {
    if (ADMIN) return;
    var ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (_) {}
    try { fetch(URL0 + '/rest/v1/rpc/mesurer', { method: 'POST', keepalive: true, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_evenement: ev, p_page: PAGE, p_cible: cible || null, p_source: UTM.utm_source || (ref && ref !== location.hostname ? ref : null), p_support: UTM.utm_medium || null, p_campagne: UTM.utm_campaign || null,
        p_appareil: matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 768 ? 'tel' : 'ordi' }) }).catch(function () {}); } catch (_) {}
  }
  try { if (!sessionStorage.getItem('mdg-vu:' + PAGE)) { sessionStorage.setItem('mdg-vu:' + PAGE, '1'); mesurer('vue'); } } catch (_) { mesurer('vue'); }

  // ——— vers l'application ———
  var APP = new URL(R + 'application.dc.html', document.baseURI).href, RACINE = new URL(R || './', document.baseURI).href;
  var telephone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 768;
  function lien(hash, intention, support) { return APP + '?utm_source=' + encodeURIComponent(UTM.utm_source ? 'site-' + UTM.utm_source : 'site') + '&utm_medium=' + (support || 'bouton') + (intention ? '&utm_campaign=' + encodeURIComponent(intention) : '') + (hash || '#/'); }
  function qr(hote, texte) { if (!hote || !window.qrcode) return; try { var q = qrcode(0, 'M'); q.addData(texte); q.make(); hote.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (_) {} }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-app]'); if (!a) return;
    var url = lien(a.getAttribute('data-app'), a.getAttribute('data-intention'));
    mesurer('clic', a.getAttribute('data-intention') || a.getAttribute('data-app'));
    if (telephone) { e.preventDefault(); location.href = url; return; }
    var d = $('tel'); if (!d || !d.showModal) return;
    var it = a.getAttribute('data-intention') || '', sens = /sens=demande/.test(a.getAttribute('data-app')) ? 'demande' : /sens=offre|#\/vendre/.test(a.getAttribute('data-app')) ? 'offre' : '';
    $('t-tel').textContent = sens === 'offre' ? 'Publiez votre offre depuis votre téléphone' : sens === 'demande' ? 'Publiez votre demande depuis votre téléphone' : it === 'annonce' ? 'Voyez cette annonce sur votre téléphone' : 'Continuez sur votre téléphone';
    $('telTexte').textContent = 'Scannez ce code avec l’appareil photo de votre téléphone : l’application s’ouvre ' + (sens === 'offre' ? 'sur votre offre' : sens === 'demande' ? 'sur votre demande' : 'au bon endroit') + '. Elle vous demande votre numéro pour créer votre compte, gratuitement.';
    e.preventDefault(); qr($('telQr'), url); $('telLien').textContent = RACINE.replace(/^https?:\/\//, '').replace(/\/$/, '');
    d.showModal();
  });
  qr($('qr'), RACINE + '?utm_source=site&utm_medium=qr');
  var lc = $('lienCourt'); if (lc) lc.textContent = RACINE.replace(/^https?:\/\//, '').replace(/\/$/, '');

  function demarrer() {
    villes(); tableau();
    fetch(S + 'donnees/lieux.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (l) { LIEUX = l; return lireFil(); });
    setInterval(function () { if (!document.hidden) lireFil(); }, 120000);
    addEventListener('resize', function () { if (calque && svg) calque.style.height = svg.getBoundingClientRect().height + 'px'; });
  }
  if (document.documentElement.classList.contains('garde')) document.addEventListener('site:ouvert', demarrer, { once: true }); else demarrer();
})();
