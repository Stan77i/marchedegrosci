/* Marché de Gros CI — service worker (utilisation hors connexion).
   Le code (pages, JS, CSS, manifeste) part du RÉSEAU D'ABORD : une mise à jour publiée sur le site arrive aussi dans l'application
   installée sur l'écran d'accueil, sans recréer l'icône. Le cache ne sert qu'hors connexion (ou si le réseau met plus de 4 s).
   Les images restent servies depuis le cache (elles changent rarement). Incrémenter CACHE reste utile pour remplacer les images.
   Les publications des usagers restent dans le localStorage (mdg-v2:offres / mdg-v2:demandes) : ce fichier n'y touche pas. */
const CACHE = 'mgci-v150';
// tuiles de la carte en relief déjà vues (relief Terrarium, rues OpenFreeMap) : gardées d'une version à l'autre, 1 500 au plus
const TUILES = 'tuiles-mgci', TUILES_MAX = 1500, HOTES_TUILES = ['s3.amazonaws.com', 'tiles.openfreemap.org'];

// Indispensable : si l'un de ces fichiers manque, l'installation échoue et l'ancienne version reste active.
const CORE = [
  "./",
  "application.dc.html",
  "index.html",
  "support.js",
  "manifest.webmanifest",
  "app/marche-app.js",
  "app/carte-app.js",
  "app/villes.js",
  "app/carte-gl.js",
  "app/icones.js",
  "app/effets.js",
  "app/theme.js",
  "app/nuit.js",
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
  "css/fonts.css",
  "css/mgci-tokens.css",
  "css/mgci-app.css",
  "css/sombre.css",
  "css/annee-app.css",
  "css/categories-app.css",
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
  "fonts/jost-latin-400-normal.woff2",
  "fonts/jost-latin-500-normal.woff2",
  "fonts/jost-latin-600-normal.woff2",
  "fonts/jost-latin-700-normal.woff2",
  "fonts/jost-latin-800-normal.woff2",
  "fonts/jost-latin-900-normal.woff2",
  "fonts/jost-latin-400-italic.woff2",
  "fonts/jost-latin-500-italic.woff2",
  "fonts/jost-latin-600-italic.woff2",
  "fonts/jost-latin-700-italic.woff2",
  "fonts/jost-latin-800-italic.woff2",
  "fonts/jost-latin-900-italic.woff2",
  "index-v3.html",
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
  "vendor/ScrollTrigger.min.js",
  "vendor/d3.min.js",
  "vendor/gsap.min.js",
  "vendor/lenis.min.js",
  "vendor/ci-hydro.json",
  "v3/terre.js",
  "v3/nuage.js",
  "v3/sons.js",
  "v3/negoce.js",
  "v3/avatar.js",
  "v3/compte.js",
  "v3/ux.css",
  "v3/porte.js",
  "v3/souffle.js",
  "v3/pousse.js",
  "v3/reputation.js",
  "v3/statuts.js",
  "v3/guide.js",
  "v3/messages.js",
  "v3/alertes.js",
  "v3/identite.js"
];

// Images v2/img/ : mises en cache au mieux (une image manquante n'empêche pas l'installation).
const IMAGES = ["evenement-camion-depart-paysage.webp", "evenement-camion-depart-portrait.webp", "evenement-piment-seche-paysage.webp", "evenement-piment-seche-portrait.webp", "evenement-soudure-etal-paysage.webp", "evenement-soudure-etal-portrait.webp", "evenement-vendeuse-monnaie-paysage.webp", "evenement-vendeuse-monnaie-portrait.webp", "famille-arachide-noix-et-oleagineux.webp", "famille-assaisonnements-epices-condiments.webp", "famille-autres-produits-vivriers.webp", "famille-cereales-et-riz-local.webp", "famille-legumes-et-fruits.webp", "famille-oeufs.webp", "famille-poissons.webp", "famille-produits-surgeles.webp", "famille-tubercules-et-feculents.webp", "famille-viande-de-brousse.webp", "famille-viandes-et-abats.webp", "famille-volaille.webp", "femme-marche-07-paysage.webp", "femme-marche-07-portrait.webp", "produit-ail.webp", "produit-ananas.webp", "produit-aubergine.webp", "produit-avocat.webp", "produit-banane-douce.webp", "produit-banane-plantain.webp", "produit-chou.webp", "produit-citron.webp", "produit-concombre.webp", "produit-gombo.webp", "produit-oignon.webp", "produit-orange.webp", "produit-papaye.webp", "produit-pasteque.webp", "produit-patate-douce.webp", "produit-piment-frais.webp", "produit-piment-garba.webp", "produit-poivron.webp", "produit-pomme-de-terre.webp", "produit-tomate.webp", "saison-01-janvier-paysage.webp", "saison-01-janvier-portrait.webp", "saison-02-fevrier-paysage.webp", "saison-02-fevrier-portrait.webp", "saison-05-mai-paysage.webp", "saison-05-mai-portrait.webp", "saison-07-juillet-paysage.webp", "saison-07-juillet-portrait.webp", "saison-08-aout-paysage.webp", "saison-08-aout-portrait.webp", "saison-09-septembre-paysage.webp", "saison-09-septembre-portrait.webp", "saison-10-octobre-paysage.webp", "saison-10-octobre-portrait.webp", "saison-11-novembre-paysage.webp", "saison-11-novembre-portrait.webp", "saison-12-decembre-paysage.webp", "saison-12-decembre-portrait.webp"].map(f => 'v2/img/' + f);

// la carte en relief, pour qu'elle s'ouvre vite et sans connexion : son moteur et ses polices (Latin et ponctuation)
const CARTE = ['vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css',
  ...['Jost Regular', 'Jost Medium', 'Jost Italic'].flatMap(f => ['0-255', '8192-8447'].map(r => 'vendor/glyphs/' + f + '/' + r + '.pbf'))];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    await Promise.all(IMAGES.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await Promise.all(CARTE.map(u => c.add(new Request(encodeURI(u), { cache: 'reload' })).catch(() => {})));
    await Promise.all(['v3/releve.js', 'app/garanties.js', 'v3/commandes.js', 'v3/chauffeur.js', 'v3/suivi.js', 'v3/prixzone.js', 'v3/racheter.js', 'v3/appro.js', 'v3/groupes.js'].map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));   // nouveaux modules : au mieux   // sans bloquer l'installation si l'un manque
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

  // Code (JS, CSS, JSON, manifeste) : le réseau d'abord — revalidé auprès du serveur, jamais une vieille copie du navigateur —,
  // le cache si le réseau échoue ou traîne plus de 4 s.
  // Fichier versionné (« ?v=… ») : son contenu ne change jamais pour cette adresse → le cache d'abord, ouverture instantanée hors ligne
  if (/[?&]v=/.test(url.search) && /\.(js|css)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    })());
    return;
  }
  if (/\.(js|css|json|webmanifest|html)$/.test(url.pathname) || ['script', 'style', 'manifest'].includes(req.destination)) {
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

  // Images, polices, sons : le cache d'abord, puis le réseau.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  })());
});

// ——— Notifications (Web Push) : affichées même application fermée ; chiffre sur l'icône ; toucher = ouvrir la négociation ———
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
      vibrate: [70, 40, 70], timestamp: Date.now(), data: { url: d.url || 'application.dc.html#/', nego: d.nego || null, dm: d.dm || null, commande: d.commande || ((/[?&]commande=([0-9a-f-]{36})/.exec(d.url || '') || [])[1]) || null },
      actions: d.dm ? [{ action: 'repondre', title: 'Répondre' }] : d.nego ? [{ action: 'voir', title: 'Voir la proposition' }] : [],
      image: d.image || undefined
    });
    try { if (self.navigator.setAppBadge) { if (d.badge) await self.navigator.setAppBadge(d.badge); else if (d.badge === 0) await self.navigator.clearAppBadge(); } } catch (_) {}
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {}, url = new URL(data.url || 'application.dc.html#/', self.registration.scope).href;
  e.waitUntil((async () => {
    const fen = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = fen.find(c => /application\.dc\.html/.test(c.url)) || fen[0];
    if (app) { await app.focus(); if (data.nego) app.postMessage({ type: 'mdg-nego', nego: data.nego }); if (data.dm) app.postMessage({ type: 'mdg-dm', dm: data.dm }); if (data.commande) app.postMessage({ type: 'mdg-commande', commande: data.commande }); if (/[?&]chauffeur=1/.test(data.url || '')) app.postMessage({ type: 'mdg-chauffeur' }); app.postMessage({ type: 'mdg-lien', url: data.url || '' }); return; }
    await self.clients.openWindow(url);
  })());
});
