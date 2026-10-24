# Plan SEO et acquisition : Marché de Gros CI

> Mission du propriétaire du 23/10/2026 : faire du site la vitrine et l'arme d'acquisition (SEO, marketing, communication) ; l'application reste l'outil pour acheter et vendre.
> Audits du 23/10/2026, en lecture seule : `audit-site.md` (site, SEO technique, vitesse), `audit-app.md` (application, comptes, liens, données publiques), `concurrents.md` (mots-clés, concurrents, opportunités). Aucun volume de recherche ni aucune position n'est inventé.

## Décisions du propriétaire

- Le site est fait **pour l'ordinateur** : il fait connaître le Marché de Gros CI et amène à installer l'application. Sur téléphone, c'est l'application.
- **Le nouveau site se construit caché** : le public garde la page de maintenance. L'administrateur entre par le point caché et choisit en haut : **Application · Ancien site · SEO**.
- Le site montre l'activité réelle (annonces, demandes) sur une carte du réseau plus complète que celle de l'application, anonymisée : prénom + initiale, ville, produit, quantité. Jamais de numéro ni de nom complet.
- Un clic sur une annonce : création du compte, puis l'application (Play Store / App Store plus tard ; QR code ou ouverture sur téléphone en attendant).
- L'ancien site reste, invisible au public.

## 0. Avancement (mis à jour le 23/10/2026, après la PR #240)

- **Fait (caché, `noindex`)** : P0 en entier ; P1 n° 6 (7 guides), n° 7 (27 pages produits avec prix en direct, calendrier des récoltes sourcé et, pour 11 d'entre elles, prix officiels au détail de l'OCPV), n° 8 (mesure, schéma 81) ; P2 n° 10 (guide des grands marchés de gros, 14 pages de districts) ; P3 en partie (calendrier des récoltes, guide du transport, page « Les prix de la semaine » d'après la note de l'OCPV). `sitemap.xml` (55 adresses) et `404.html` prêts.
- **Reste, côté propriétaire** : regarder le site caché et donner ses retours ; décider l'ouverture (P1 n° 9) ; Search Console et Bing ; partenariats (P2 n° 11) ; affiches et QR codes (P2 n° 12, la mesure est prête).
- **Reste, côté technique** : audit de sécurité avant l'ouverture ; mise à jour chaque semaine des prix OCPV ; tests de conversion après l'ouverture.
- La partie 1 ci-dessous décrit l'état **avant** les travaux : la garder pour l'historique.

## 1. État réel (résumé, avant les travaux)

- Hébergement : GitHub Pages gratuit, `stan77i.github.io/marchedegrosci/`, sans nom de domaine. Pas de `robots.txt` lisible (racine du domaine non contrôlée), pas de `sitemap.xml`, pas de `404.html`.
- **Google ne peut presque rien lire** : l'ancien site n'existe qu'en JavaScript (React + Babel dans la page, 6,4 Mo, 45 tâches longues, CLS 0,52) ; l'application, sans JavaScript, n'est que du gabarit ; toutes les « pages » sont des `#/…` (une seule adresse pour Google) ; la page de maintenance est en `noindex`.
- Aucun aperçu de partage (Open Graph), aucune donnée structurée, aucune mesure d'audience.
- La marque n'existe pas encore en ligne ; « marché de gros » désigne pour Google les marchés physiques de l'État (Bouaké, Ebimpé, Daloa, OCPV).
- L'application est riche et fonctionne : offres/demandes, tableau des prix, négociation sans numéro, commandes en 8 étapes, mot secret, litige, identité vérifiée, approvisionnement pro, achats groupés, Racheter. Le paiement n'est pas branché.
- Liens vers une action : l'application ne lit pas les paramètres (`#/vendre?produit=tomate` ignoré) et perd l'intention si la personne n'a pas de compte.
- Données publiques : les tables `offres`/`demandes` sont lisibles sans compte avec `user_id` et le nom public choisi (parfois complet) : une fonction dédiée `fil_public()` est nécessaire avant tout affichage public.

## 2. Positionnement

- Toujours « **Marché de Gros CI** », avec un descripteur : « l'application du vivrier en gros en Côte d'Ivoire ». Marque en fin de titre sur les pages de contenu.
- Phrase de clarification sur la page « Qui sommes-nous » : application privée et indépendante, ni le marché de Bouaké, ni l'OCPV, ni l'État.
- Viser « produit + intention + lieu » (« acheter de l'igname en gros à Abidjan », « vendre sa tomate »), pas « marché de gros » seul.
- Avantages que personne ne montre : numéro caché, prix figé, mot secret à la réception, suivi du camion, identité vérifiée, achats groupés.
- Concurrents principaux : e-Grenier (OCPV, public), AgriChoco (B2B), Djoli (restaurants), groupes Facebook (le vrai concurrent du quotidien). Ne pas faire d'actualité agricole générale (déjà tenue par Agence Ecofin, AIP).

## 3. Architecture technique du nouveau site (gratuite)

- Pages **HTML statiques, lisibles sans JavaScript**, dans `site/`, fabriquées par `tools/site-public.js` (Node, sans dépendance) et refaites par une tâche GitHub.
- Adresses : `site/` (accueil), `site/carte/`, `site/produits/<produit>/`, `site/guides/<sujet>/`, `site/a-propos/`.
- Chaque page : titre et description uniques, `canonical`, Open Graph (aperçu WhatsApp), JSON-LD (`Organization`, `WebSite`, `BreadcrumbList`, `Article`, `FAQPage` seulement si la FAQ est visible). Pas de `Product`/`Offer` avec prix inventés.
- Données en direct chargées après l'affichage (jamais de faux chiffre en attendant) ; MapLibre seulement sur la page de la carte.
- **Pendant la construction** : toutes les pages en `noindex`, voile de garde vérifié par le serveur (`est_admin`), comme l'ancien site. Le contenu n'a rien de secret : le voile évite seulement qu'un visiteur tombe dessus.
- Le service worker ne doit pas remplacer les pages du site par l'application.
- À l'ouverture : retirer `noindex` et le voile, `index.html` mène l'ordinateur vers `site/`, `sitemap.xml`, Search Console.

## 4. Plan priorisé

**P0 (fondations)**
1. Barre administrateur « Application · Ancien site · SEO ».
2. Générateur `tools/site-public.js`, gabarit commun, accueil, `a-propos`, 404, garde admin, `noindex` ; exclusion dans `sw.js`.
3. Fonction `fil_public()` (prénom + initiale, ville, produit, quantité, type, date) : schéma, test sur le projet de test, puis production.
4. Carte du réseau du site (`site/carte/`) branchée sur `fil_public()`.
5. Liens d'intention dans l'application : `#/vendre?produit=…`, `#/demande?produit=…`, achats groupés, approvisionnement ; intention gardée pendant l'inscription (`mdg:connecte`).
   **Fait (23/10/2026)** : `#/publier?sens=offre|demande&produit=<id>&qte=<n>&unite=<u>`, `#/vendre?produit=<id>`, `#/demande?produit=<id>`, `#/groupes`, `#/appro` ; provenance `utm_*` gardée sur le téléphone (`mdg-app:source`).

**P1 (acquisition)**
6. Pages stratégiques : « Vendre sa récolte », « Acheter du vivrier en gros », « Approvisionner un restaurant ou une cantine », « Achats groupés », « Acheter en gros sans se faire arnaquer ».
7. Pages produits utiles (tomate, igname, plantain, manioc, oignon, maïs, riz local…) avec le tableau des prix en direct et les prix officiels cités (OCPV, date et lien).
8. Mesure gratuite et respectueuse : clics sur les boutons, ouvertures de l'application attribuées au site, paramètres de campagne (`utm_*`) et QR codes par support.
9. Passage du site au public (décision du propriétaire), `sitemap.xml`, Search Console et Bing Webmaster Tools (comptes du propriétaire).

**P2 (expansion)**
10. Fiches des grands marchés (Gouro d'Adjamé, Bouaké…) avec sources ; régions seulement quand il y a des annonces réelles.
11. Partenariats : OCPV/e-Grenier (complément), Chambre d'agriculture, ANADER, coopératives, médias tech, Google Business Profile.
12. QR codes suivis pour affiches, flyers, cartes de visite.

**P3 (optimisation)**
13. Résumé hebdomadaire des prix, saisons, transport ; tests de conversion ; veille concurrentielle chaque trimestre.

## 5. Ce qui demande le propriétaire

- Ouvrir le site au public (lever la maintenance) : sa décision.
- Search Console et Bing Webmaster Tools : son compte Google / Microsoft (gratuit).
- Nom de domaine (seule dépense possible, annuelle) : facultatif ; l'adresse gratuite actuelle fonctionne.
- Comptes des réseaux sociaux officiels, pour les relier au site.

## 6. Indicateurs à suivre (quand la mesure existera)

Pages vues depuis la recherche, clics sur « Je vends / Je cherche / Achat groupé », ouvertures de l'application depuis le site, inscriptions attribuées au site, annonces publiées par ces nouveaux comptes, pages indexées (Search Console). La mesure existe depuis le schéma 81 (écran « Visites » de `admin.html`) ; Search Console viendra à l'ouverture.
