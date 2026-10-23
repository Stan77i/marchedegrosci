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
      if (!el) { el = document.createElement('span'); el.className = 'pt'; el.dataset.k = k; el.style.left = x.p[0] + '%'; el.style.top = x.p[1] + '%'; el.style.animationDelay = (vus[k] ? 0 : i * 60) + 'ms'; calque.appendChild(el); vus[k] = 1; }
      el.className = 'pt' + (sens === 'demande' ? ' d' : ''); el.innerHTML = (photo(x.s, 'pp') || symb(sens)) + (n > 1 ? '<b>' + n + '</b>' : '');
      el.title = (x.o ? x.o + ' offre' + (x.o > 1 ? 's' : '') : '') + (x.o && x.d ? ' · ' : '') + (x.d ? x.d + ' demande' + (x.d > 1 ? 's' : '') : '');
    });
  }
  // page produit : <main data-produit="tomate">
  var PROD = (document.querySelector('[data-produit]') || { getAttribute: function () { return ''; } }).getAttribute('data-produit');
  function fil(L) {
    var court = $('filCourt'), long = $('filLong'), pf = $('filProduit');
    if (pf) {
      var LP = L.filter(function (a) { return a.product_slug === PROD; });
      pf.innerHTML = LP.length ? LP.map(function (a) { return '<li>' + symb(a.sens) + '<div><span>' + phrase(a) + '</span> <small>' + esc(a.ville || '') + (a.ville ? ' · ' : '') + quand(a.publie_le) + '</small></div></li>'; }).join('')
        : '<li class="fil-vide">Aucune annonce active pour ce produit en ce moment. La première peut être la vôtre : elle sera vue par tout le réseau.</li>';
    }
    if (!L.length) {
      if (court) court.innerHTML = '<li class="fil-vide">Aucune annonce pour l’instant : la première peut être la vôtre.</li>';
      if (long) long.innerHTML = '<li class="fil-vide">Aucune annonce active pour l’instant.</li>';
      return;
    }
    var ligne = function (a, nuit) { return '<li>' + (photo(a.product_slug) || symb(a.sens, nuit)) + '<div><span>' + phrase(a) + '</span> <small>' + esc(a.ville || '') + (a.ville ? ' · ' : '') + quand(a.publie_le) + '</small></div></li>'; };
    if (court) court.innerHTML = L.slice(0, 3).map(function (a) { return ligne(a, true); }).join('');
    if (long) long.innerHTML = L.slice(0, 40).map(function (a) { return ligne(a, true); }).join('');
  }
  function lireFil() {
    return rpc('fil_public', { p_limite: 120 }).then(function (L) { L = L || []; fil(L); points(L); document.dispatchEvent(new CustomEvent('site:fil', { detail: L })); })
      .catch(function () { var c = $('filCourt'); if (c && /fil-vide/.test(c.innerHTML)) c.innerHTML = '<li class="fil-vide">Le fil ne répond pas pour l’instant.</li>'; });
  }

  // ——— le tableau ———
  var prix = function (v, u) { return v == null ? '<span class="tb-prix vide">Pas encore</span>' : '<span class="tb-prix">' + nf(v) + ' F<small>par ' + esc(u || 'unité') + '</small></span>'; };
  function tableau() {
    var corps = $('tbCorps'), pp = $('prixProduit'); if (!corps && !pp) return;
    rpc('tableau_produits', { p_region: null }).then(function (L) {
      if (pp) {
        var r = (L || []).filter(function (x) { return x.slug === PROD; })[0];
        pp.innerHTML = !r ? '<p class="tb-attente">Aucun prix publié pour ce produit en ce moment.</p>'
          : '<div class="pp"><span>Vendeur le moins cher</span>' + prix(r.meilleure_offre, r.unite_offre) + (r.n_offres ? '<span class="nbul o">' + symb('offre') + r.n_offres + ' offre' + (r.n_offres > 1 ? 's' : '') + '</span>' : '') + '</div>'
          + '<div class="pp"><span>Meilleur budget d’acheteur</span>' + prix(r.meilleure_demande, r.unite_demande) + (r.n_demandes ? '<span class="nbul d">' + symb('demande') + r.n_demandes + ' demande' + (r.n_demandes > 1 ? 's' : '') + '</span>' : '') + '</div>';
      }
      if (!corps) return;
      L = (L || []).slice(0, 8);
      if (!L.length) { corps.innerHTML = '<p class="tb-attente">Aucun prix publié pour l’instant. Les premiers vendeurs et acheteurs apparaîtront ici.</p>'; return; }
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

  // ——— vers l'application ———
  var APP = new URL(R + 'application.dc.html', document.baseURI).href, RACINE = new URL(R || './', document.baseURI).href;
  var telephone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 768;
  function lien(hash, intention, support) { return APP + '?utm_source=site&utm_medium=' + (support || 'bouton') + (intention ? '&utm_campaign=' + encodeURIComponent(intention) : '') + (hash || '#/'); }
  function qr(hote, texte) { if (!hote || !window.qrcode) return; try { var q = qrcode(0, 'M'); q.addData(texte); q.make(); hote.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (_) {} }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-app]'); if (!a) return;
    var url = lien(a.getAttribute('data-app'), a.getAttribute('data-intention'));
    if (telephone) { e.preventDefault(); location.href = url; return; }
    var d = $('tel'); if (!d || !d.showModal) return;
    e.preventDefault(); qr($('telQr'), url); $('telLien').textContent = url.replace(/^https?:\/\//, '').replace(/\?.*?(#|$)/, '$1');
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
