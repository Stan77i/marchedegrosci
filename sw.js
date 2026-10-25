/* Marché de Gros CI — service worker (utilisation hors connexion).
   Deux réserves :
   - CACHE (« mgci-vNNN », change à chaque version) : le code. À l'installation d'une version, un fichier déjà gardé sous la même
     adresse (même « ?v= ») est recopié de l'ancienne réserve sans rien télécharger ; seuls les fichiers dont le « ?v= » a changé
     dans application.dc.html sont téléchargés. Un fichier sans « ?v= » est recopié lui aussi : il part du réseau d'abord à
     l'usage, la copie ne sert qu'hors connexion.
   - FICHIERS (« fichiers-mgci », ne change pas) : images, polices, icônes, bibliothèques (vendor/) et carte. Gardés d'une version à
     l'autre, jamais retéléchargés. Pour remplacer un de ces fichiers sous le même nom : ajouter « ?v=2 » (puis 3…) à son entrée
     dans IMAGES, CARTE ou DURABLES ci-dessous ; seul ce fichier sera retéléchargé.
   Le code (pages, JS, CSS, manifeste) sans « ?v= » part du RÉSEAU D'ABORD : une mise à jour publiée arrive aussi dans l'application
   installée sur l'écran d'accueil. Le cache ne sert qu'hors connexion (ou si le réseau traîne).
   Les publications des usagers restent dans le localStorage (mdg-v2:offres / mdg-v2:demandes) : ce fichier n'y touche pas. */
const CACHE = 'mgci-v293';
const FICHIERS = 'fichiers-mgci', INVENTAIRE = 'mgci-inventaire.json';
// tuiles de la carte en relief déjà vues (relief Terrarium, rues OpenFreeMap) : gardées d'une version à l'autre, 1 500 au plus
const TUILES = 'tuiles-mgci', TUILES_MAX = 1500, HOTES_TUILES = ['s3.amazonaws.com', 'tiles.openfreemap.org'];

// Code indispensable : si l'un de ces fichiers manque, l'installation échoue et l'ancienne version reste active.
// Un fichier que application.dc.html appelle avec « ?v= » est gardé sous cette adresse versionnée.
const CORE = [
  "./",
  "application.dc.html",
  "index.html",
  "support.js",
  "manifest.webmanifest",
  "app/marche-app.js",
  "app/ville-seule.js",
  "app/carte-app.js",
  "app/villes.js",
  "app/carte-gl.js",
  "app/icones.js",
  "app/effets.js",
  "app/theme.js",
  "app/nuit.js",
  "app/prixmoment.js",
  "app/demo-orbite.js",
  "app/stable.js",
  "app/vibre.js",
  "app/activite.js",
  "app/marque.js",
  "app/sac.js",
  "app/icone.js",
  "app/toast.js",
  "app/geo/ci.json",
  "v2/data.js",
  "v2/saisons.js",
  "v2/search.js",
  "css/fonts.css", "css/symboles.css",
  "css/mgci-tokens.css",
  "css/mgci-app.css",
  "css/sombre.css",
  "css/annee-app.css",
  "css/categories-app.css",
  "index-v3.html",
  "maintenance.html",
  "app/admin-pc.js",
  "css/styles.css",
  "css/typo.css",
  "v2/map.js",
  "v2/oklch.js",
  "v2/reseau-carte.js",
  "v2/terrain.js",
  "v2/themes.js",
  "v3/acheter.css",
  "v3/acheter.js",
  "v3/annee.css",
  "v3/annee.js",
  "v3/cherche.css",
  "v3/cherche.js",
  "v3/constellation.css",
  "v3/constellation.js",
  "v3/etat.css",
  "v3/etat.js",
  "v3/flou.css",
  "v3/flou.js",
  "v3/hero-ivt.css",
  "v3/hero-ivt.js",
  "v3/ivt-header.css",
  "v3/ivt-header.js",
  "v3/marche.js",
  "v3/marqueurs.css",
  "v3/marqueurs.js",
  "v3/match.js",
  "v3/pages.css",
  "v3/pages.js",
  "v3/scene-ivt.js",
  "v3/tweaks-panel.jsx",
  "v3/tweaks.jsx",
  "v3/vendre.css",
  "v3/vendre.js",
  "v3/terre.js",
  "v3/nuage.js",
  "v3/sons.js",
  "v3/negoce.js",
  "v3/personnages.js",
  "v3/avatar.js",
  "v3/compte.js",
  "v3/ux.css",
  "v3/porte.js",
  "v3/souffle.js",
  "v3/pousse.js",
  "v3/boutique.js",
  "v3/reputation.js",
  "v3/statuts.js",
  "v3/guide.js",
  "v3/messages.js",
  "v3/aide.js",
  "app/scene.js",
  "v3/alertes.js",
  "v3/identite.js"
];
// modules plus récents : gardés au mieux, sans bloquer l'installation si l'un manque
const MODULES = ['v3/releve.js', 'app/garanties.js', 'v3/commandes.js', 'v3/chauffeur.js', 'v3/suivi.js', 'v3/prixzone.js', 'v3/racheter.js', 'v3/appro.js', 'v3/groupes.js', 'v3/astuces.js', 'v3/tableau.js'];

// Fichiers durables indispensables (réserve FICHIERS) : bibliothèques, polices, icônes.
const DURABLES = [
  "icons/v2/icon-192.png",
  "icons/v2/icon-512.png",
  "icons/v2/apple-touch-icon.png",
  "icons/v2/apple-touch-icon-noir.png",
  "icons/v2/icon-maskable-512.png",
  "icons/v2/favicon.svg",
  "icons/v2/favicon-32.png",
  "icons/v2/favicon-noir.svg",
  "icons/v2/favicon-noir-32.png",
  "vendor/babel.min.js",
  "vendor/countries-110m.json",
  "vendor/countries-50m.json",
  "vendor/react-dom.production.min.js",
  "vendor/react.production.min.js",
  "vendor/topojson-client.min.js",
  "vendor/qrcode-generator-1.4.4.js",
  "vendor/ScrollTrigger.min.js",
  "vendor/d3.min.js",
  "vendor/gsap.min.js",
  "vendor/lenis.min.js",
  "vendor/ci-hydro.json",
  ...['400', '500', '600', '700', '800', '900'].flatMap(g => ['normal', 'italic'].map(s => 'fonts/jost-latin-' + g + '-' + s + '.woff2'))
];
// Images v2/img/ : gardées au mieux (une image manquante n'empêche pas l'installation). « nom.webp?v=2 » = image remplacée.
const IMAGES = ["evenement-camion-depart-paysage.webp", "evenement-camion-depart-portrait.webp", "evenement-piment-seche-paysage.webp", "evenement-piment-seche-portrait.webp", "evenement-soudure-etal-paysage.webp", "evenement-soudure-etal-portrait.webp", "evenement-vendeuse-monnaie-paysage.webp", "evenement-vendeuse-monnaie-portrait.webp", "famille-arachide-noix-et-oleagineux.webp", "famille-assaisonnements-epices-condiments.webp", "famille-autres-produits-vivriers.webp", "famille-cereales-et-riz-local.webp", "famille-legumes-et-fruits.webp", "famille-oeufs.webp", "famille-poissons.webp", "famille-produits-surgeles.webp", "famille-tubercules-et-feculents.webp", "famille-viande-de-brousse.webp", "famille-viandes-et-abats.webp", "famille-volaille.webp", "femme-marche-07-paysage.webp", "femme-marche-07-portrait.webp", "produit-ail.webp", "produit-ananas.webp", "produit-aubergine.webp", "produit-avocat.webp", "produit-banane-douce.webp", "produit-banane-plantain.webp", "produit-chou.webp", "produit-citron.webp", "produit-concombre.webp", "produit-gombo.webp", "produit-oignon.webp", "produit-orange.webp", "produit-papaye.webp", "produit-pasteque.webp", "produit-patate-douce.webp", "produit-piment-frais.webp", "produit-piment-garba.webp", "produit-poivron.webp", "produit-pomme-de-terre.webp", "produit-tomate.webp", "produit-aubergine-blanche.webp", "produit-aubergine-violette.webp", "produit-courgette-obra.webp", "produit-courgette-verte.webp", "produit-feuille-d-oignon.webp", "produit-haricot-vert-du-burkina.webp", "produit-haricot-vert-local.webp", "produit-oignon-blanc.webp", "produit-oignon-violet.webp", "produit-orange-locale.webp", "produit-papaye-ronde.webp", "produit-papaye-solo.webp", "produit-patate-douce-jaune.webp", "produit-patate-douce-blanche.webp", "produit-persil.webp", "produit-piment-big-sun.webp", "produit-piment-sent-bon.webp", "produit-piment-vert.webp", "saison-01-janvier-paysage.webp", "saison-01-janvier-portrait.webp", "saison-02-fevrier-paysage.webp", "saison-02-fevrier-portrait.webp", "saison-05-mai-paysage.webp", "saison-05-mai-portrait.webp", "saison-07-juillet-paysage.webp", "saison-07-juillet-portrait.webp", "saison-08-aout-paysage.webp", "saison-08-aout-portrait.webp", "saison-09-septembre-paysage.webp", "saison-09-septembre-portrait.webp", "saison-10-octobre-paysage.webp", "saison-10-octobre-portrait.webp", "saison-11-novembre-paysage.webp", "saison-11-novembre-portrait.webp", "saison-12-decembre-paysage.webp", "saison-12-decembre-portrait.webp"].map(f => 'v2/img/' + f);

// la carte en relief, pour qu'elle s'ouvre vite et sans connexion : son moteur et ses polices (Latin et ponctuation)
const CARTE = ['vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css',
  ...['Jost Regular', 'Jost Medium', 'Jost Italic'].flatMap(f => ['0-255', '8192-8447'].map(r => 'vendor/glyphs/' + f + '/' + r + '.pbf'))];

// Ce qui va dans la réserve durable quand on le croise en route : images, polices, icônes, bibliothèques
const EST_DURABLE = p => /\/(v2\/img|vendor|fonts|icons)\//.test(p) || /\.(webp|png|jpe?g|gif|svg|woff2?|pbf|mp3|ogg|wav)$/.test(p);

// Remplit la réserve durable : un fichier déjà gardé (même « ?v= » d'entrée) n'est pas retéléchargé ; un fichier encore dans une
// ancienne réserve de code (versions d'avant) y est recopié ; sinon il est téléchargé. strict : un échec fait échouer l'installation.
async function remplirDurables(entrees, strict) {
  const d = await caches.open(FICHIERS);
  let inv = {};
  try { const r = await d.match(INVENTAIRE); if (r) inv = await r.json(); } catch (_) {}
  const un = async e => {
    const i = e.indexOf('?v='), chemin = i < 0 ? e : e.slice(0, i), tag = i < 0 ? '' : e.slice(i + 3), u = encodeURI(chemin);
    if ((inv[chemin] || '') === tag && await d.match(u)) return;
    if (!tag) { const ancien = await caches.match(u); if (ancien) { await d.put(u, ancien); inv[chemin] = ''; return; } }
    const res = await fetch(u, { cache: tag ? 'no-cache' : 'default' });
    if (!res.ok) throw new Error(chemin);
    await d.put(u, res); inv[chemin] = tag;
  };
  await Promise.all(entrees.map(e => strict ? un(e) : un(e).catch(() => {})));
  await d.put(INVENTAIRE, new Response(JSON.stringify(inv), { headers: { 'content-type': 'application/json' } }));
}

// Remplit la réserve de code de la nouvelle version. La page est relue au réseau ; ses « ?v= » disent quels fichiers ont changé.
async function remplirCode() {
  const c = await caches.open(CACHE);
  const page = await fetch('application.dc.html', { cache: 'no-cache' });
  if (!page.ok) throw new Error('page');
  const html = await page.clone().text();
  await c.put('application.dc.html', page);
  const vers = {};
  for (const m of html.matchAll(/["'`]((?:app|v2|v3|css)\/[\w\/.-]+\.(?:js|css|json|jsx))\?v=([\w.-]+)["'`]/g)) vers[m[1]] = m[1] + '?v=' + m[2];
  const garder = async u => {
    const ancien = await caches.match(u);   // même adresse, « ?v= » compris : contenu identique, rien à télécharger
    if (ancien) return c.put(u, ancien);
    const res = await fetch(u, { cache: 'no-cache' });
    if (!res.ok) throw new Error(u);
    return c.put(u, res);
  };
  const coeur = [...new Set(CORE.filter(u => u !== 'application.dc.html').map(u => vers[u] || u))];
  const autres = [...new Set([...MODULES.map(u => vers[u] || u), ...Object.values(vers)])].filter(u => !coeur.includes(u));
  await Promise.all(coeur.map(garder));
  await Promise.all(autres.map(u => garder(u).catch(() => {})));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await Promise.all([remplirCode(), remplirDurables(DURABLES, true)]);
    await remplirDurables([...IMAGES, ...CARTE], false);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('mgci-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // carte en relief : une tuile déjà vue reste lisible sans connexion (le cache d'abord, puis le réseau)
  if (HOTES_TUILES.includes(url.hostname) && (/\/terrarium\//.test(url.pathname) || url.hostname === 'tiles.openfreemap.org')) {
    e.respondWith((async () => {
      const c = await caches.open(TUILES);
      if (url.pathname === '/planet') { try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; } catch (_) { return (await c.match(req)) || Response.error(); } }  // la description des tuiles change : le réseau d'abord
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) { c.put(req, res.clone()); e.waitUntil(c.keys().then(k => k.length > TUILES_MAX ? Promise.all(k.slice(0, k.length - TUILES_MAX).map(r => c.delete(r))) : 0)); }
      return res;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return; // liens externes : réseau normal
  // le site public (dossier site/) : le navigateur fait tout seul, jamais l'application à la place d'une de ses pages
  if (/\/site\//.test(url.pathname)) return;

  // Pages : le réseau d'abord, le cache si le réseau échoue.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      // au réveil du téléphone, le réseau « se connecte » sans répondre : on n'attend pas plus de 3 s une page déjà gardée
      const copie = async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match('application.dc.html'));
      const reseau = fetch(req).then(async res => { if (res && res.ok) { const c = await caches.open(CACHE); await c.put(req, res.clone()); } return res; });
      try {
        const res = await Promise.race([reseau, new Promise((_, ko) => setTimeout(() => ko(new Error('lent')), 3000))]);
        if (res && res.ok) return res;
        return (await copie()) || res;
      } catch (_) {
        const hit = await copie();
        if (hit) { e.waitUntil(reseau.catch(() => {})); return hit; }
        return reseau.catch(() => Response.error());
      }
    })());
    return;
  }

  // Relecture du modèle par support.js (en-tête x-dc-source) : la page vient d'être téléchargée et mise en cache juste au-dessus ;
  // on la sert depuis le cache au lieu de la retélécharger (210 Ko de moins à chaque ouverture).
  if (req.headers.get('x-dc-source')) {
    e.respondWith((async () => { const hit = await caches.match(req) || await caches.match(req, { ignoreSearch: true }); return hit || fetch(req); })());
    return;
  }

  // Images, polices, icônes, bibliothèques et moteur de la carte : la réserve durable d'abord, puis le réseau.
  if (EST_DURABLE(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') { const c = await caches.open(FICHIERS); c.put(req, res.clone()); }
      return res;
    })());
    return;
  }

  // Fichier versionné (« ?v=… ») : son contenu ne change jamais pour cette adresse → le cache d'abord, ouverture instantanée hors ligne
  if (/[?&]v=/.test(url.search) && /\.(js|css|json|jsx)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch (err) {
        const vieux = await caches.match(req, { ignoreSearch: true });   // hors ligne : la dernière copie gardée de ce fichier
        if (vieux) return vieux;
        throw err;
      }
    })());
    return;
  }
  // Code sans « ?v= » (JS, CSS, JSON, manifeste) : le réseau d'abord — revalidé auprès du serveur, jamais une vieille copie du
  // navigateur —, le cache si le réseau échoue ou traîne plus de 2,5 s.
  if (/\.(js|css|json|webmanifest|html|jsx)$/.test(url.pathname) || ['script', 'style', 'manifest'].includes(req.destination)) {
    e.respondWith((async () => {
      const reseau = fetch(req, { cache: 'no-cache' }).then(async res => {
        if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); await c.put(req, res.clone()); }
        return res;
      });
      const copie = () => caches.match(req).then(h => h || caches.match(req, { ignoreSearch: true }));
      try {
        const res = await Promise.race([reseau, new Promise((_, ko) => setTimeout(() => ko(new Error('lent')), 2500))]);
        if (res && res.ok) return res;
        return (await copie()) || res;
      } catch (_) {
        const hit = await copie();
        if (hit) { e.waitUntil(reseau.catch(() => {})); return hit; }  // la réponse réseau, si elle finit par arriver, remplit le cache pour la prochaine fois
        return reseau;
      }
    })());
    return;
  }

  // Le reste (sons…) : le cache d'abord, puis le réseau.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') { const c = await caches.open(FICHIERS); c.put(req, res.clone()); }
    return res;
  })());
});

// ——— Notifications (Web Push) : affichées même application fermée ; chiffre sur l'icône ; toucher = ouvrir l'écran précis ———
// Signaler l'ouverture (schéma 88a, notif_ouverte) : seulement l'identifiant d'envoi « nid » (uuid aléatoire, sans donnée personnelle),
// avec la clé PUBLIQUE de l'application (la même que dans v3/nuage.js). Rien de secret ici. Si la fonction manque, l'appel échoue sans gêne.
// Pas de « keepalive » : l'appel est déjà gardé en vie par e.waitUntil, et keepalive avec un en-tête JSON n'est pas pris partout.
const API = 'https://catmsypctymgkjkfzdkt.supabase.co', CLE_PUBLIQUE = 'sb_publishable_KC2au-t8dqasp5ez9Lq6XQ_JvbTtVQ5';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function signalerOuverture(nid) {
  if (!nid || !UUID.test(String(nid))) return Promise.resolve();
  return fetch(API + '/rest/v1/rpc/notif_ouverte', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CLE_PUBLIQUE },
    body: JSON.stringify({ p_nid: nid, p_par: 'push' }) }).catch(() => {});
}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    // Sur iPhone (Safari), une notification qui en remplace une autre de même étiquette arrive EN SILENCE : pas de bannière, pas de son
    // (« renotify » n'y est pas pris en charge). Chaque notification reçoit donc sa propre étiquette, et l'ancienne du même genre
    // (même conversation, même négociation, annonces du marché, conseils…) est retirée : une seule par sujet, mais toujours une alerte.
    const base = d.tag || 'mdg';
    try { (await self.registration.getNotifications()).forEach(n => { if (String(n.tag || '').split('~')[0] === base) n.close(); }); } catch (_) {}
    await self.registration.showNotification(d.title || 'Marché de Gros', {
      body: d.body || '', tag: base + '~' + Date.now(), renotify: true, icon: 'icons/v2/icon-192.png', badge: 'icons/v2/badge-96.png',
      vibrate: [70, 40, 70], timestamp: Date.now(), data: { url: d.url || 'application.dc.html#/', nid: d.nid || null, cat: d.cat || null, nego: d.nego || null, dm: d.dm || null, commande: d.commande || ((/[?&]commande=([0-9a-f-]{36})/.exec(d.url || '') || [])[1]) || null },
      actions: d.dm ? [{ action: 'repondre', title: 'Répondre' }] : d.nego ? [{ action: 'voir', title: 'Voir la proposition' }] : [],
      image: d.image || undefined
    });
    try { if (self.navigator.setAppBadge) { if (d.badge) await self.navigator.setAppBadge(d.badge); else if (d.badge === 0) await self.navigator.clearAppBadge(); } } catch (_) {}
  })());
});
// Toucher la notification (ou l'un de ses boutons, qui mènent au même écran) : l'écran précis de son adresse, jamais l'accueil par défaut.
// Une page de l'application déjà ouverte reçoit l'adresse par message (pas de rechargement) ; le tableau de bord (admin.html) s'ouvre dans sa
// propre fenêtre ; sinon une nouvelle fenêtre s'ouvre sur l'adresse complète.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {}, lien = data.url || 'application.dc.html#/', url = new URL(lien, self.registration.scope);
  e.waitUntil((async () => {
    const ouv = signalerOuverture(data.nid);
    const fen = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const page = url.pathname.split('/').pop() || 'application.dc.html';
    if (page !== 'application.dc.html') {   // admin.html#identites…
      const meme = fen.find(c => new URL(c.url).pathname.split('/').pop() === page);
      if (meme) { try { await meme.focus(); await meme.navigate(url.href); } catch (_) { await self.clients.openWindow(url.href); } }
      else await self.clients.openWindow(url.href);
      return ouv;
    }
    const app = fen.find(c => /application\.dc\.html/.test(c.url));
    if (app) {
      await app.focus();
      if (data.nego) app.postMessage({ type: 'mdg-nego', nego: data.nego });
      else if (data.dm) app.postMessage({ type: 'mdg-dm', dm: data.dm });
      else if (data.commande) app.postMessage({ type: 'mdg-commande', commande: data.commande });
      else if (/[?&]chauffeur=1/.test(lien)) app.postMessage({ type: 'mdg-chauffeur' });
      app.postMessage({ type: 'mdg-lien', url: lien, deja: !!(data.nego || data.dm || data.commande || /[?&]chauffeur=1/.test(lien)) });
      return ouv;
    }
    await self.clients.openWindow(url.href);
    return ouv;
  })());
});
// Le navigateur renouvelle parfois l'abonnement : on se réabonne avec la même clé ; l'application ouverte l'enregistre au serveur
// (v3/pousse.js, suivre), sinon ce sera fait à la prochaine ouverture.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      const cle = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
      if (!e.newSubscription && cle) await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle });
    } catch (_) {}
    (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).forEach(c => c.postMessage({ type: 'mdg-pousse-suivre' }));
  })());
});
