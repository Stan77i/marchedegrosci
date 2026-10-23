# Audit technique SEO et performance du site public — Marché de Gros CI

Date : 23/10/2026. Lecture seule : aucun fichier du dépôt n'a été modifié. Dépôt à `665f183` (main).
Mesures : Playwright + Chromium 1194, serveur local `python3 -m http.server 8766` (sans compression gzip, sans limite de débit), premier passage sans service worker (`serviceWorkers: 'block'`). Les appels à Supabase échouent depuis le bac à sable (`ERR_TUNNEL_CONNECTION_FAILED`) : les poids ci-dessous **n'incluent pas** les données de la base, et les temps sont des minimums de laboratoire, pas ceux d'un téléphone en 3G/4G à Abidjan.
Scripts et résultats bruts : `scratchpad/seo/mesure.js`, `scratchpad/seo/mesure.json`, captures `scratchpad/seo/shot-*.png`.

---

## 0. En bref

1. **Aujourd'hui, Google ne peut à peu près rien indexer.** L'adresse racine ne contient aucun texte utile, redirige en JavaScript vers `maintenance.html` (`noindex`) ou vers l'application (pas de description, contenu en gabarits `{{ }}`). Toute la navigation est en `#/…` : une seule URL aux yeux de Google.
2. Aucune page n'a de `canonical`, d'Open Graph/Twitter ni de JSON-LD. Conséquence immédiate et concrète : **un lien partagé sur WhatsApp ou Facebook n'affiche ni image ni description.**
3. Pas de `robots.txt` contrôlable (la racine du domaine `stan77i.github.io` renvoie 404), pas de `sitemap.xml`, pas de `404.html`.
4. Le vieux site `index-v3.html` est lourd : 6,3 Mo transférés (non compressés), dont Babel 3,0 Mo, CLS mesuré 0,524, 45 tâches longues.
5. Recommandation : un **nouveau site public en HTML statique pré-généré** par un script Node (`tools/`) lancé par une GitHub Action, comme `rapport-site.yml` et `strategie-pdf.yml`. Gratuit, compatible GitHub Pages, sans toucher à l'application.

---

## 1. Les pages HTML, une par une

Relevé fait par recherche dans les fichiers (lignes indiquées) puis vérifié dans le navigateur.

| Page | `lang` | `<title>` | description | robots | canonical | OG / Twitter | JSON-LD | h1 dans le HTML statique | Contenu |
|---|---|---|---|---|---|---|---|---|---|
| `index.html` (1 ligne, 2 006 octets) | **absent** (pas de balise `<html>`) | « Marché de Gros » (l.1) | **absente** | absent | absent | absent | absent | **non** (seul texte : le lien « Ouvrir le Marché de Gros ») | aiguillage JS (l.1) |
| `maintenance.html` | `fr` (l.2) | « Marché de Gros — site en maintenance » (l.8) | oui (l.9) | **`noindex`** (l.7) | absent | absent | absent | oui (l.67) | statique (476 caractères lus sans JS) |
| `application.dc.html` (339 831 octets) | `fr` (l.2) | « Marché de Gros » (l.5), trop court | **absente** | absent | absent | absent | absent | les h1 (l.457, 512, 563) sont dans des gabarits | **rendu par JS** (gabarits dc-runtime) |
| `index-v3.html` (270 584 octets) | `fr` (l.2) | bon titre (l.17) | bonne description (l.18) | absent | absent | absent | absent | **non** : les 8 `<h1>` (l.1763…2469) sont dans des chaînes JavaScript | **rendu par JS** (+ React/Babel l.1337-1342) |
| `admin.html` | `fr` | « Tableau de bord · Marché de Gros » (l.7) | absente | `noindex, nofollow` (l.6) | — | — | — | oui | JS ; normal pour une page privée |
| `suivi.html` | `fr` | « Suivi de livraison · Marché de Gros » (l.8) | absente | `noindex` (l.7) | — | — | — | oui (l.56) | JS ; normal (lien privé du chauffeur) |

- **hreflang** : absent partout. Normal : un seul public, une seule langue (`fr`). Inutile tant qu'il n'y a pas de version en une autre langue.
- **Ce qu'un robot voit sans exécuter le JavaScript** (mesuré, JS coupé) :
  - `index.html` → suit le `<noscript><meta http-equiv="refresh" … url=maintenance.html>` (l.1) et finit sur la page `noindex`.
  - `index-v3.html` : 616 caractères (menu et pied de page), **0 h1**, 24 liens, tous en `#/…`.
  - `application.dc.html` : 9 581 caractères, mais ce sont les gabarits bruts : « `{{ accLogo }} {{ accIco.chercher }} {{ accIco.cloche }} …` », 0 lien. Si le rendu JS de Google échoue ou arrive en retard, c'est ce texte qui serait indexé.
- **Ce qu'on voit avec JavaScript** (mesuré) : application sur iPhone 13 = h1 « Bienvenue au marché », 4 980 caractères, 45 images, 0 image sans `alt` ; `index-v3.html?admin=1` = h1 « Tomate », 1 697 caractères, mais **caché sous le cache plein écran `#mdgGarde`** tant que le serveur n'a pas confirmé l'admin (l.9-12, l.1193).
- **Routage en `#/`** (index-v3 et application) : Google ignore ce qui suit `#`. Toutes les « pages » produits, catalogue, carte… sont **une seule URL** pour lui (ex. `index-v3.html` l.1845 : `href="#/produits/${x.slug}"`). Aucune page produit n'est donc indexable aujourd'hui, même si le site rouvrait.
- **React + Babel dans le navigateur** (`index-v3.html` l.1339-1342, plus un second Babel depuis unpkg.com l.1340) : Google exécute le JS, mais en différé et avec un budget de rendu ; 3 Mo de Babel à compiler dans la page rendent ce rendu lent et fragile. À noter : Babel ne sert qu'à `v3/tweaks-panel.jsx` et `v3/tweaks.jsx` (outil de développement, déjà proposé au retrait dans `PORTAGE-SITE.md` partie 5).

## 2. robots.txt et sitemap.xml

- Aucun `robots.txt`, `sitemap.xml`, `404.html` ni `CNAME` dans le dépôt (vérifié par `ls`).
- **Le `robots.txt` doit être à la racine du domaine** : `https://stan77i.github.io/robots.txt`. Vérifié en ligne (Firecrawl, 23/10/2026) : **404 « There isn't a GitHub Pages site here »**. Un `robots.txt` posé dans ce dépôt serait servi à `/marchedegrosci/robots.txt`, **que les robots ne lisent jamais**.
- Conséquence : un `robots.txt` absent (404) = tout est permis au robot. Ce n'est pas bloquant. Ce qui manque surtout, c'est la ligne `Sitemap:` et la possibilité d'interdire des chemins (on compensera par `noindex` page par page).
- **Options, de la gratuite à la payante** :
  1. **Gratuit, recommandé tout de suite** : Google Search Console, propriété de type **« Préfixe d'URL »** `https://stan77i.github.io/marchedegrosci/`. Vérification par fichier HTML déposé dans le dépôt ou par balise `<meta name="google-site-verification">`. On y **soumet le sitemap** (`/marchedegrosci/sitemap.xml`) : ça marche sous un sous-chemin. Même chose dans Bing Webmaster Tools (qui sait importer depuis Search Console).
  2. **Gratuit, optionnel** : créer un 2ᵉ dépôt `Stan77i/stan77i.github.io` (site « utilisateur » GitHub Pages). Il sert la racine du domaine : on peut y mettre un vrai `robots.txt` avec `Sitemap: https://stan77i.github.io/marchedegrosci/sitemap.xml`, et une page d'accueil qui renvoie vers le Marché de Gros. Le site actuel reste à `/marchedegrosci/`.
  3. **Payant** : un nom de domaine à soi (ex. un `.ci` ou un `.com`) relié à GitHub Pages par un fichier `CNAME` (GitHub Pages et HTTPS restent gratuits). Avantages : adresse courte et crédible, `robots.txt` à la racine, adresse qui ne dépend pas du nom du compte GitHub. **Coût : un abonnement annuel au registraire, prix non vérifié ici** (à demander au propriétaire quand il y aura un budget). À ce moment-là, garder l'ancienne adresse fonctionnelle (voir partie 6). À noter : `marchedegros.ci` apparaît dans `v3/nuage.js` l.15 uniquement comme suffixe d'adresse fictive pour les comptes (`tel.marchedegros.ci`) ; rien n'indique dans le dépôt que ce domaine soit enregistré par le propriétaire.

## 3. Les redirections

- `index.html` l.1 : redirection **JavaScript** (`location.replace`) selon `pointer: coarse` + taille d'écran + `localStorage`. Téléphone → `application.dc.html#/` ; ordinateur → `maintenance.html#/` ; admin → `index-v3.html`. Vérifié dans le navigateur (iPhone 13 → application ; bureau 1366×768 → maintenance).
- Sans JS : `<noscript><meta http-equiv="refresh" content="0; url=maintenance.html">` (l.1).
- `application.dc.html` l.16-21 et `index-v3.html` l.9-12 redirigent eux aussi vers `maintenance.html` (ordinateur non admin). `maintenance.html` l.102-105 renvoie le téléphone vers l'application au bout de 8 s.
- **Effet SEO** :
  - Google suit les redirections JS, mais seulement après rendu ; elles comptent comme des signaux faibles. La page racine n'a ni contenu ni description propres.
  - L'écran que voit Googlebot dépend de la façon dont son navigateur répond à `matchMedia('(pointer: coarse)')` : soit la page `noindex`, soit l'application sans description. **Non vérifiable ici** (pas d'accès à Search Console). Dans les deux cas : rien d'utile à indexer.
  - Une redirection selon l'appareil vers des URL différentes est déconseillée par Google (mêmes URL pour mobile et ordinateur, ou annotations explicites). Le futur site public doit avoir **la même URL et le même contenu pour tous** ; seule l'application reste réservée au téléphone.
- **404** : pas de `404.html`. Vérifié en ligne : `https://stan77i.github.io/marchedegrosci/produits/tomate/` → **404 « Page not found · GitHub Pages »** (page générique de GitHub, sans lien vers le marché). GitHub Pages sert automatiquement un `404.html` placé à la racine du dépôt, avec le vrai code 404 : à ajouter (gratuit).
- **Service worker** (`sw.js` l.180-193) : pour une navigation, si la réponse n'est pas `ok` (ex. 404) ou si le réseau tarde plus de 3 s, il sert la copie en cache, et à défaut `application.dc.html`. Sans effet sur Google (les robots n'utilisent pas de service worker), mais pour un visiteur qui a déjà l'application, une page inexistante du futur site afficherait l'application. Son périmètre (`scope: "./"`, `manifest.webmanifest`) couvre tout `/marchedegrosci/`, donc aussi les futures pages du site : il faudra que le service worker laisse passer les pages du site (ou qu'il ne les mette pas en cache une par une).

## 4. Performance (mesurée)

Conditions : voir l'en-tête. « LCP » = `largest-contentful-paint` lu par `PerformanceObserver` ; « tâches longues » = entrées `longtask` ; « somme > 50 ms » = somme de (durée − 50 ms), proche du TBT. Poids = corps des réponses **non compressés** (le serveur local ne compresse pas ; GitHub Pages compresse, voir le tableau gzip plus bas).

| Cas | Pages traversées | Requêtes | Poids transféré | FCP | LCP (élément) | CLS | Tâches longues (somme > 50 ms) |
|---|---|---|---|---|---|---|---|
| `index.html`, iPhone 13 | index → `application.dc.html#/` | 74 | 3 723 Ko | 140 ms | 760 ms (DIV) | 0,017 | 3 (210 ms) |
| `index.html`, bureau | index → `maintenance.html#/` | 12 | 152 Ko | non capté* | non capté* | 0 | 1 (3 ms) |
| `maintenance.html`, iPhone 13 | — | 11 | 150 Ko | 136 ms | 136 ms (H1) | 0 | 0 |
| `maintenance.html`, bureau | — | 11 | 150 Ko | non capté* | non capté* | 0 | 0 |
| `index-v3.html?admin=1`, bureau | reste (cache `#mdgGarde` posé) | 79 | **6 437 Ko** | 324 ms | 1 396 ms (`IMG.hero__deco-img`) | **0,524** | **45 (2 388 ms)** |
| `application.dc.html`, iPhone 13 | — | 73 | 3 721 Ko | 116 ms | 552 ms (DIV) | 0,018 | 3 (126 ms) |
| `admin.html`, bureau | — | 16 | 413 Ko | 68 ms | 68 ms | 0 | 0 |
| `suivi.html`, iPhone 13 | — | 5 | 44 Ko | 72 ms | 72 ms | 0 | 0 |

\* En mode bureau sans tête, Chromium n'a pas émis d'entrée `paint`/LCP pour la maintenance (la page s'affiche, capture faite). Valeur non inventée : non mesurée.

**Fichiers lourds mesurés** (non compressé / gzip -9 calculé localement) :

| Fichier | Chargé par | Brut | gzip |
|---|---|---|---|
| `vendor/babel.min.js` | index-v3 | 3 137 752 o | 660 278 o |
| `vendor/maplibre/maplibre-gl.js` | application (dès l'accueil) | 939 269 o | 247 797 o |
| `vendor/countries-50m.json` | index-v3 (`v3/terre.js` l.27), `app/carte-app.js` l.22 | 756 420 o | 229 996 o |
| `app/geo/ci.json` | application (`app/carte-gl.js` l.31), dès l'accueil | 556 452 o | 75 852 o |
| `application.dc.html` | application | 339 831 o | 90 941 o |
| `index-v3.html` | site | 270 584 o | 72 255 o |
| `v3/compte.js` | les deux | 132 412 o | 38 985 o |
| images de saison `v2/img/saison-1x-*-paysage.webp` | index-v3 | 268 Ko, 196 Ko, 155 Ko (mesurés en réponse) | — |

Lecture :
- `index-v3` : Babel seul pèse 3 064 Ko sur 6 437 Ko ; la page est surtout faite de scripts (4 181 Ko). Le CLS de 0,524 est mauvais (seuil « bon » de Google : 0,1). 45 tâches longues sur une machine de bureau sans ralentissement : sur un téléphone d'entrée de gamme ce serait bien pire (non mesuré).
- Application : 1 535 Ko de type « other » = le JSON de géographie et des tuiles/glyphes de carte ; MapLibre (917 Ko) et `app/geo/ci.json` (543 Ko) sont chargés **dès l'accueil**, avant que la carte soit ouverte. Hors sujet SEO, mais à garder en tête (données mobiles payantes des utilisateurs).
- `maintenance.html` est légère (150 Ko, dont 62 Ko de police Jost et 66 Ko de scripts : `app/marque.js` + `vendor/qrcode-generator-1.4.4.js`).

## 5. Accessibilité de base

**`maintenance.html`** :
- `lang="fr"` présent (l.2). Un seul h1 (l.67). Aucune `<img>`. Le QR code a `role="img"` + `aria-label` (l.75). L'émoji 📱 est `aria-hidden` (l.72).
- Contrastes calculés (WCAG) : texte sable `#B9AD98` sur fond `#171512` = 8,24:1 ; sur carte `#211E19` = 7,51:1 ; bouton maïs `#F2C230` / texte `#171512` = 10,88:1 ; crème `#F3EFE4` sur fond = 15,86:1. Tout passe AA et AAA.
- `prefers-reduced-motion` respecté (bloc `@media` à la fin du `<style>`).
- Point à revoir : le bouton d'entrée admin (l.86, `aria-label="Administration"`) est annoncé aux lecteurs d'écran à tous les visiteurs. Ce n'est pas une faille (le serveur vérifie `est_admin`), mais c'est un élément sans utilité pour le public.
- Le lien « Ouvrir l'application » sur ordinateur est intercepté (`preventDefault`) pour montrer le QR code : acceptable, le texte reste clair.

**`index-v3.html`** :
- `lang="fr"` (l.2). `<meta name="color-scheme" content="dark">` (l.7) alors que `<body class="light">` (l.1192) : signal contradictoire au navigateur (barres de défilement et contrôles sombres sur fond clair possible).
- Images : 5 rendues, toutes avec `alt` ; mais les vignettes produits ont `alt=""` (l.1845, l.1559) : correct pour l'accessibilité (le nom est écrit à côté), mais Google Images ne peut rien en tirer.
- Le chargeur `#mdgCharge` est `aria-hidden` (l.1194) ; le cache admin `#mdgGarde` est un `role="dialog" aria-modal` étiqueté (l.1193) : correct.
- Plusieurs `<h1>` possibles par vue (sections, l.2467/2469) : sans gravité, mais un seul h1 par page est plus clair.

**`application.dc.html`** (hors périmètre site, signalé) : `maximum-scale=1, user-scalable=no` (l.6) empêche de zoomer (critère WCAG 1.4.4). Choix d'application mobile délibéré, mais à ne **pas** reprendre dans le futur site public.

## 6. Les URL à garder

Recherche faite dans tout le dépôt (`strategie/`, `docs/`, `*.md`, scripts) : **aucune URL `stan77i.github.io` écrite en dur**, aucun QR code dans les PDF de stratégie (`strategie/sources/*.html` n'en contiennent pas). Mais plusieurs adresses sont fabriquées ou distribuées par le code, et doivent continuer à marcher :

| URL | Qui l'utilise | Pourquoi la garder |
|---|---|---|
| `https://stan77i.github.io/marchedegrosci/` (racine) | QR code et lien affichés par `maintenance.html` (l.108 : `location.href` sans `maintenance.html`) ; déjà scannés / recopiés par des visiteurs | **la plus importante** : point d'entrée public |
| `application.dc.html` | `manifest.webmanifest` (`start_url` et `id: "./application.dc.html"`) ; notifications (`sw.js` l.260, 269) | changer l'`id` casserait les applications déjà installées sur l'écran d'accueil |
| `application.dc.html#/…` | partage d'une fiche produit (`application.dc.html` l.1778 partage `location.href`) | liens déjà envoyés sur WhatsApp |
| `suivi.html?j=<jeton>` | lien de suivi envoyé au chauffeur (`v3/commandes.js` l.933) | liens en circulation ; doit rester `noindex` |
| `maintenance.html`, `index-v3.html?admin=1`, `admin.html` | entrée admin | à garder, en `noindex` |
| `sw.js` à la racine du dossier | portée du service worker | ne pas le déplacer |

Règle pour la suite : **ne rien renommer** ; si une page doit disparaître, la remplacer par une petite page qui renvoie vers la nouvelle (GitHub Pages ne sait pas faire de redirection 301 côté serveur ; une page avec `<link rel="canonical">` + `<meta http-equiv="refresh">` est le moyen gratuit).

## 7. Architecture conseillée pour le nouveau site public (gratuite, GitHub Pages)

### Principe
**Des pages HTML statiques déjà écrites (pré-générées)**, lisibles sans JavaScript, produites par un script Node sans dépendance dans `tools/` et régénérées par une GitHub Action. Exactement le modèle déjà en place :
- `.github/workflows/rapport-site.yml` → `node tools/inventaire-site.js`, commit seulement si ça change ;
- `.github/workflows/strategie-pdf.yml` → déclenché par `v2/data.js`, `v2/img/**`, `app/marche-app.js`, et chaque lundi (`cron: '17 6 * * 1'`), lit la base avec la clé publique.

Proposition : `tools/site-public.js` + `.github/workflows/site-public.yml` (mêmes déclencheurs que `strategie-pdf.yml`, plus `tools/site-public/**`), qui écrit les pages dans le dépôt et les enregistre dans `main`. Pas de framework, pas de Babel, pas de React pour ces pages.

### Structure d'URL (toutes avec `/` final, un dossier + `index.html` chacune)
```
/marchedegrosci/                       accueil public (remplace l'aiguillage JS actuel)
/marchedegrosci/produits/              catalogue (12 familles)
/marchedegrosci/produits/<famille>/    ex. /produits/cereales-et-riz-local/
/marchedegrosci/produits/<produit>/    ex. /produits/tomate/  (175 produits dans v2/data.js, 145 photos produit-*.webp)
/marchedegrosci/regions/<region>/      14 régions (v2/data.js)
/marchedegrosci/guides/<sujet>/        ex. /guides/vendre-en-gros/, /guides/comment-negocier/
/marchedegrosci/carte/                 carte en direct (voir plus bas)
/marchedegrosci/a-propos/  /contact/  /confidentialite/
/marchedegrosci/404.html
/marchedegrosci/sitemap.xml
```
- Slugs repris de `v2/data.js` (`categories`, `products`, `regions`) : les mêmes que dans l'application, donc chaque page produit peut avoir un bouton « Voir dans l'application » vers `application.dc.html#/produits/<slug>`.
- Attention : les `producers` et `offers` de `v2/data.js` sont des **exemples** (`isExample: true`, `coordsIsExample: true`). Ne jamais les publier comme de vraies offres (règle « aucune donnée inventée »).

### Ce que chaque page contient dans son HTML
- `<html lang="fr">`, `<title>` unique, `<meta name="description">` unique, `<link rel="canonical" href="https://stan77i.github.io/marchedegrosci/…/">` (URL absolue).
- Open Graph + Twitter : `og:title`, `og:description`, `og:image` (photo produit 800×800 existante, ou une image 1200×630 générée par la même Action avec le Chromium déjà utilisé pour les PDF), `og:url`, `og:locale=fr_CI`. C'est ce qui donnera un aperçu dans WhatsApp.
- JSON-LD : `Organization` + `WebSite` sur l'accueil ; `BreadcrumbList` sur produits, familles, régions ; `FAQPage` seulement si une vraie FAQ est affichée. **Pas** de `Product`/`Offer` avec un prix tant qu'il n'y a pas de vraies offres et de vrais prix à jour (pas de prix inventés).
- Un seul `h1`, du vrai texte, des `<img>` avec `alt` descriptif, `width`/`height` donnés (pour éviter le CLS), `loading="lazy"` sous la ligne de flottaison.
- Poids visé : de l'ordre de `maintenance.html` (150 Ko mesurés, dont la police Jost) ; une seule police (Jost), CSS commun aux jetons `css/mgci-tokens.css`.

### Sitemap et robots
- `sitemap.xml` écrit par le même script, avec `<lastmod>` = date du dernier changement réel (comme `inventaire-site.js`, qui ne change la date que si le contenu change).
- Soumis dans Search Console (propriété « Préfixe d'URL »). Option gratuite : dépôt `stan77i.github.io` avec un `robots.txt` qui pointe vers ce sitemap.
- `noindex` sur : `maintenance.html`, `index-v3.html`, `admin.html`, `suivi.html` (déjà pour 3 sur 4), `application.dc.html` (à décider : l'application n'a rien à gagner à être indexée sous forme de gabarits ; les pages statiques font ce travail).

### Données en direct (Supabase) sans nuire au SEO
- Le **HTML** porte le contenu stable (nom, famille, saison, photo, texte, guide).
- Les chiffres vivants (`stats_publiques()`, schéma 79, déjà `grant execute … to anon`) et la carte en direct sont chargés **après** l'affichage, dans le navigateur, avec la clé publique (`sb_publishable_…`, déjà dans `v3/nuage.js` l.14 : pas de clé secrète).
- Place réservée dans le HTML (hauteur fixe) pour éviter tout décalage ; texte de repli lisible si la base ne répond pas (« Chiffres indisponibles pour le moment »), jamais un faux chiffre.
- Option : la GitHub Action peut aussi lire `stats_publiques()` une fois par semaine et écrire les chiffres « au … » dans le HTML (comme les PDF de stratégie) ; les robots voient alors des chiffres datés et vrais.
- La carte MapLibre (917 Ko + `ci.json` 543 Ko) ne se charge que sur `/carte/`, et seulement quand la carte est visible ou quand on touche « Ouvrir la carte ».

### Aiguillage et ancien site
- `index.html` devient la vraie page d'accueil statique, **la même pour tout le monde**. Le passage vers l'application se fait par un **bouton** (« Ouvrir l'application ») et éventuellement par une bannière sur téléphone, pas par une redirection automatique. Les liens et QR déjà distribués vers la racine continuent de marcher.
- `index-v3.html` reste accessible à l'admin, inchangé : ajouter `<meta name="robots" content="noindex, nofollow">` et le garder hors du sitemap ; la garde actuelle (`?admin=1` + vérification serveur `est_admin`) reste en place.
- `sw.js` : prévoir que les pages du site (dossiers `produits/`, `guides/`…) passent par le réseau d'abord et ne retombent jamais sur `application.dc.html` en cas de 404.
- Règles du projet à appliquer lors de la réalisation : `?v=` et `CACHE` de `sw.js` à augmenter, section dans `docs/PASSATION.md`, ligne dans `PORTAGE-SITE.md` si besoin, vérification dans un vrai navigateur (iPhone émulé), Lighthouse ou mesure Playwright avant/après.

### Ce qui est gratuit / ce qui coûte
- Gratuit : GitHub Pages, GitHub Actions (dépôt public), Search Console, Bing Webmaster Tools, dépôt `stan77i.github.io`, `404.html`, sitemap, JSON-LD, Open Graph.
- Payant : seulement un nom de domaine propre (abonnement annuel, prix à vérifier). Rien d'autre n'est nécessaire.
