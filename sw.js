/* Marché de Gros CI — service worker (utilisation hors connexion).
   Le code (pages, JS, CSS, manifeste) part du RÉSEAU D'ABORD : une mise à jour publiée sur le site arrive aussi dans l'application
   installée sur l'écran d'accueil, sans recréer l'icône. Le cache ne sert qu'hors connexion (ou si le réseau met plus de 4 s).
   Les images restent servies depuis le cache (elles changent rarement). Incrémenter CACHE reste utile pour remplacer les images.
   Les publications des usagers restent dans le localStorage (mdg-v2:offres / mdg-v2:demandes) : ce fichier n'y touche pas. */
const CACHE = 'mgci-v44';

// Indispensable : si l'un de ces fichiers manque, l'installation échoue et l'ancienne version reste active.
const CORE = [
  "./",
  "application.dc.html",
  "index.html",
  "support.js",
  "manifest.webmanifest",
  "app/marche-app.js",
  "app/carte-app.js",
  "v2/data.js",
  "v2/saisons.js",
  "v2/search.js",
  "css/fonts.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/apple-touch-icon-noir.png",
  "icons/icon-maskable-512.png",
  "icons/favicon.svg",
  "icons/favicon-32.png",
  "icons/favicon-noir.svg",
  "icons/favicon-noir-32.png",
  "vendor/babel.min.js",
  "vendor/countries-110m.json",
  "vendor/countries-50m.json",
  "vendor/react-dom.production.min.js",
  "vendor/react.production.min.js",
  "vendor/topojson-client.min.js",
  "fonts/cormorant-garamond-latin-500-italic.woff2",
  "fonts/cormorant-garamond-latin-500-normal.woff2",
  "fonts/cormorant-garamond-latin-600-italic.woff2",
  "fonts/cormorant-garamond-latin-600-normal.woff2",
  "fonts/jost-latin-400-normal.woff2",
  "fonts/jost-latin-500-normal.woff2",
  "fonts/jost-latin-600-normal.woff2",
  "fonts/jost-latin-700-normal.woff2",
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
  "v3/souffle.js"
];

// Images v2/img/ : mises en cache au mieux (une image manquante n'empêche pas l'installation).
const IMAGES = ["evenement-camion-depart-paysage.webp", "evenement-camion-depart-portrait.webp", "evenement-piment-seche-paysage.webp", "evenement-piment-seche-portrait.webp", "evenement-soudure-etal-paysage.webp", "evenement-soudure-etal-portrait.webp", "evenement-vendeuse-monnaie-paysage.webp", "evenement-vendeuse-monnaie-portrait.webp", "famille-arachide-noix-et-oleagineux.webp", "famille-assaisonnements-epices-condiments.webp", "famille-autres-produits-vivriers.webp", "famille-cereales-et-riz-local.webp", "famille-legumes-et-fruits.webp", "famille-oeufs.webp", "famille-poissons.webp", "famille-produits-surgeles.webp", "famille-tubercules-et-feculents.webp", "famille-viande-de-brousse.webp", "famille-volaille.webp", "femme-marche-07-paysage.webp", "femme-marche-07-portrait.webp", "produit-ail.webp", "produit-ananas.webp", "produit-aubergine.webp", "produit-avocat.webp", "produit-banane-douce.webp", "produit-banane-plantain.webp", "produit-chou.webp", "produit-citron.webp", "produit-concombre.webp", "produit-gombo.webp", "produit-oignon.webp", "produit-orange.webp", "produit-papaye.webp", "produit-pasteque.webp", "produit-patate-douce.webp", "produit-piment-frais.webp", "produit-piment-garba.webp", "produit-poivron.webp", "produit-pomme-de-terre.webp", "produit-tomate.webp", "saison-01-janvier-paysage.webp", "saison-01-janvier-portrait.webp", "saison-02-fevrier-paysage.webp", "saison-02-fevrier-portrait.webp", "saison-05-mai-paysage.webp", "saison-05-mai-portrait.webp", "saison-07-juillet-paysage.webp", "saison-07-juillet-portrait.webp", "saison-08-aout-paysage.webp", "saison-08-aout-portrait.webp", "saison-09-septembre-paysage.webp", "saison-09-septembre-portrait.webp", "saison-10-octobre-paysage.webp", "saison-10-octobre-portrait.webp", "saison-11-novembre-paysage.webp", "saison-11-novembre-portrait.webp", "saison-12-decembre-paysage.webp", "saison-12-decembre-portrait.webp"].map(f => 'v2/img/' + f);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    await Promise.all(IMAGES.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
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
  if (url.origin !== self.location.origin) return; // liens externes (WhatsApp, etc.) : réseau normal

  // Pages : le réseau d'abord, le cache si le réseau échoue.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch (_) {
        const hit = await caches.match(req, { ignoreSearch: true });
        return hit || (await caches.match('application.dc.html')) || Response.error();
      }
    })());
    return;
  }

  // Code (JS, CSS, JSON, manifeste) : le réseau d'abord — revalidé auprès du serveur, jamais une vieille copie du navigateur —,
  // le cache si le réseau échoue ou traîne plus de 4 s.
  if (/\.(js|css|json|webmanifest|html)$/.test(url.pathname) || ['script', 'style', 'manifest'].includes(req.destination)) {
    e.respondWith((async () => {
      const reseau = fetch(req, { cache: 'no-cache' }).then(async res => {
        if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); await c.put(req, res.clone()); }
        return res;
      });
      const copie = () => caches.match(req).then(h => h || caches.match(req, { ignoreSearch: true }));
      try {
        const res = await Promise.race([reseau, new Promise((_, ko) => setTimeout(() => ko(new Error('lent')), 4000))]);
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
