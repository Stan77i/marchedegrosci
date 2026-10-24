# Mettre le site au niveau de l'application

> **Pour qui** : pour Claude Code (ou un développeur) qui doit modifier le **site** (`index-v3.html`). À lire avant d'y toucher.
> **Ce qu'il contient** :
> 1. l'état du site ;
> 2. la décision du propriétaire ;
> 3. la méthode conseillée ;
> 4. tout ce que l'application a et que le site n'a pas ;
> 5. ce qu'on peut retirer du site ;
> 6. un inventaire qui se met à jour tout seul.
>
> Réécrit le 23/10/2026 (la version du 19/10 était dépassée : Archivo remplacé par Jost, des dizaines de nouveautés).

## Comment ce document reste à jour

- **La partie 7 (inventaire)** se refait toute seule. Le script `tools/inventaire-site.js` est lancé par la tâche GitHub `.github/workflows/rapport-site.yml` à chaque fusion qui touche une page, `app/`, `v2/`, `v3/` ou `css/`. Il recense :
  - les pages et leur poids ;
  - les modules communs, ceux propres à l'application, ceux propres au site ;
  - ce qui utilise WebGL ;
  - les fichiers lourds ;
  - les fichiers que plus rien ne charge.

  Commande locale : `node tools/inventaire-site.js`.
- **La partie 4 (à porter)** est tenue par Claude : chaque nouveauté de l'application qui n'est pas dans un module commun y ajoute une ligne, dans la même PR (règle de `CLAUDE.md`). Quand une ligne est portée sur le site, on la retire.

---

## 1. Où en est le site

- **Le site est en maintenance depuis le 22/10/2026.** `index.html` envoie les téléphones vers l'application et les ordinateurs vers `maintenance.html` (QR code vers l'application). Seul l'administrateur ouvre `index-v3.html` (`?admin=1`, vérifié par le serveur avec `est_admin`). Le détail est dans `docs/PASSATION.md`, section « Site web en maintenance ».
- Pour rouvrir le site à tous :
  1. retirer le bloc « SITE EN MAINTENANCE » en tête d'`index-v3.html` ;
  2. retirer le cache `#mdgGarde` et sa vérification (après `v3/nuage.js`) ;
  3. remettre `index-v3.html` dans `index.html`.
- Le site est construit autrement que l'application :

  | | Application | Site |
  |---|---|---|
  | Code | gabarit dc-runtime (`{{ }}`, `<sc-if>`, `<sc-for>`, React 18 via `support.js`) | React et **Babel dans la page**, GSAP, Lenis |
  | Styles | jetons `css/mgci-tokens.css`, `css/mgci-app.css`, `css/sombre.css` | `css/styles.css`, `css/typo.css`, `v3/*.css` |

- Le serveur (Supabase) est commun et à jour : toutes les règles s'appliquent déjà au site. Ne relancer aucun fichier `supabase/schema-*.sql`.

## 2. La décision du propriétaire (23/10/2026)

- **Le site doit faire la même chose que l'application**, avec le même design (`DESIGN.md`, les 32 lois anti-« design généré »), et se mettre à jour en même temps qu'elle.
- **Tout ce qui ne sert à rien sur le site est retiré** : pages inutiles, WebGL décoratif, outils de développement. La liste est en partie 5. **Rien n'est supprimé avant la validation du propriétaire** : il coche la liste.

### Nouvelle décision (23/10/2026) : le site vitrine

- Un **nouveau site public** : il montre en direct, sur une carte du réseau plus complète que celle de l'application, les annonces, les demandes et les commandes (« Aya cherche du maïs à Gagnoa »). Il sert au marketing, au SEO et à la communication.
- Un clic sur une annonce : création du compte, puis invitation à prendre l'application (magasins d'applications plus tard ; code QR ou ouverture sur téléphone en attendant).
- **L'ancien site (`index-v3.html`) reste, invisible pour le public** : l'administrateur y entre toujours par le point caché et voit l'ancien et le nouveau. Rien n'est supprimé.
- Prénom ou initiale, ville, produit, quantité seulement : jamais de numéro ni de nom complet.
- Le détail (pages, carte, textes) suivra le prompt du propriétaire.

## 3. La méthode conseillée : un seul code

Recopier chaque écran de l'application dans le site, c'est faire tout le travail deux fois, et les deux finiront par diverger. Le conseil est de **faire du site l'application elle-même, en grand** :

1. `application.dc.html` s'ouvre déjà sur ordinateur, dans un cadre de téléphone, pour l'administrateur. On lui ajoute une mise en page large (au-delà de 900 px) : menu à gauche, contenu au centre, fiche ou carte à droite. On garde le même code, les mêmes données et les mêmes règles.
2. `index.html` envoie alors **tout le monde** vers l'application. La page de maintenance et `index-v3.html` deviennent inutiles.
3. Chaque nouveauté de l'application arrive automatiquement « sur le site », puisque c'est la même page.

Si le propriétaire préfère garder un site séparé, la partie 4 dit quoi recopier, écran par écran.

## 4. Ce que l'application a et que le site n'a pas

Les modules communs (partie 7) sont déjà sur les deux : compte, messages, négociations, identité, réputation, statuts, sons, porte de connexion, avatars (personnages du marché), symboles panier et caddie. Ce qui suit vit **seulement** dans l'application. Le modèle se trouve dans le fichier indiqué.

### Commerce

| Fonction | Modèle dans l'application | Priorité |
|---|---|---|
| Commandes : fiche, plan de livraison, étapes (« À confirmer », « Le camion est parti »…), code de prise en charge et de réception, refus avec preuves, litige à trois, libération sous 1 h | `v3/commandes.js` (schémas 57 à 65) | haute |
| Accord conclu en reçu (quantité, prix, total), « Suivre la commande » | `v3/negoce.js` (commun : déjà là) mais le bouton s'appuie sur `v3/commandes.js` | haute |
| Tableau du marché façon P2P (50 meilleures annonces par unité) | `v3/tableau.js` (schémas 59, 70) | haute |
| « Ici, chacun place son prix » : pop-up du prix du moment, placer son prix dans les deux sens | `app/prixmoment.js` | haute |
| Prix par zone et tendance | `v3/prixzone.js` | moyenne |
| Approvisionnement pro (restaurants, cantines) | `v3/appro.js` | moyenne |
| Achats groupés | `v3/groupes.js` | moyenne |
| Racheter en un geste | `v3/racheter.js` | moyenne |
| Relevés et bons en PDF, tampon du Marché de Gros | `v3/releve.js` (schéma 54) | moyenne |
| Espace chauffeur et lien de suivi | `v3/chauffeur.js`, `v3/suivi.js`, `suivi.html` | basse (réseau de transporteurs en pause) |
| Commande : ville de livraison, règle « même ville » (livreur du vendeur, retrait si le vendeur l'accepte), transport à part figé avec le total convenu (schéma 83) | `v3/commandes.js` (`creer`, `ddTransport`) | haute |
| Prix du transporteur du réseau convenu à trois (proposer, accepter, refuser, contre-proposer), côté commande et côté chauffeur (schéma 83, service fermé) | `v3/commandes.js` (`blocTrois`), `v3/chauffeur.js` | basse (réseau en pause) |
| Alertes par produit | `v3/alertes.js` (schéma 75) | moyenne |
| Boutique d'un vendeur (`#/boutique/<adresse>`), Ma boutique (lien, QR code PNG, visites), pause d'une offre, retrait avec trace (schéma 86). Le site a déjà les pages d'aperçu `site/boutiques/<adresse>/` (noindex), qui renvoient vers l'application | `v3/boutique.js`, `application.dc.html` (Mes publications) | haute |

| « Ville seulement » (schéma 87) : l'interrupteur « Je vends uniquement à Guiglo » à la publication et dans Mes publications, l'avertissement avant de négocier ou d'écrire, la ville imposée à la commande. Le site montre déjà la pastille « Guiglo uniquement » (fil, carte) | `app/ville-seule.js`, `application.dc.html` (`vsEl`, `vsSw`), `v3/negoce.js`, `v3/messages.js`, `v3/commandes.js` | moyenne |

| Annulation avec motif obligatoire (liste fermée), accord ou non de l'autre partie sur le motif, expiration à 48 h (schéma 84) | `v3/commandes.js` (`confirmer`, `annulerMotif`, `repondreMotif`) | haute |
| « Ma fiabilité » : score, annulations qui comptent ou non, avertissements, contestation ; ligne « Fiabilité : 96 % sur 25 commandes » du profil (schéma 84) | `v3/reputation.js` (`fiabilite`, commun) et la ligne de `v3/compte.js` (commun) : à vérifier sur le site | moyenne |
| « Mes niveaux » : niveau vendeur et acheteur, ce qui manque pour le suivant, sursis de 30 jours, historique, contestation ; ligne « Mes niveaux » de Mon compte avec pastille (schéma 85) | `v3/reputation.js` (`niveaux`, commun) et la ligne de `v3/compte.js` (commun) : à vérifier sur le site | moyenne |
| Puces de niveau (Vendeur fiable … Grand vendeur, Acheteur fiable … Grand acheteur, Acheteur en gros) sur les cartes, fiches et messages ; niveau dans le tableau du marché (schéma 85) | `v3/statuts.js` (commun : suit tout seul), `v3/tableau.js` ; pages fabriquées de `site/` : lire `niveaux_publics(ids)` | moyenne |

### Accueil et navigation

| Fonction | Modèle dans l'application | Priorité |
|---|---|---|
| Accueil à onglets Marché / Prix / Activité / Alertes, salutation, chiffres réels | `application.dc.html`, méthode `accueil()` | haute |
| « En cours » : négociations, commandes, messages ; « Reprendre là où vous en étiez » ; un accord et sa commande sur une seule ligne | `app/activite.js` | haute |
| Fil « Dernières annonces » avec les ventes conclues (la carte n'existe que s'il y a au moins une annonce, 23/10/2026) | `application.dc.html`, `ventesCharger()` (schéma 55) | moyenne |
| Bande d'accroches (garanties, nouveautés) | `app/garanties.js`, `v3/souffle.js` | basse |
| Roue des produits et sac, scène d'entrée | `app/scene.js`, `app/sac.js`, `app/effets.js` | moyenne |
| Démo de la roue et des prix | `app/demo-orbite.js` | basse |
| Tutoriels à l'entrée de chaque écran, astuces, réglages de l'aide | `v3/astuces.js`, `v3/guide.js`, `app/theme.js` (Réglages) | moyenne |
| Aide : questions et réponses, puis une personne | `v3/aide.js` | moyenne |
| Thème jour / nuit, et nuit des fenêtres | `app/theme.js`, `app/nuit.js`, `css/sombre.css` | haute |
| Carte du réseau MapLibre : filtres dans le panneau du bas, boutons en colonne | `app/carte-gl.js`, `app/carte-app.js`, `vendor/maplibre/` | moyenne |
| Catalogue (12 familles, produits en saison) et L'année du marché | `css/categories-app.css`, `css/annee-app.css`, pages de l'application | moyenne |
| Régions et villes reliées | `app/villes.js` | moyenne |
| Retour au toucher (vibrations), écrans stables | `app/vibre.js`, `app/stable.js` (commun) | basse |

### Design (à reprendre tel quel, voir `DESIGN.md`)

- Une seule police, **Jost** (plus d'Archivo ni de Cormorant). La voix du logo : un mot en Jost 900 italique, souligné de maïs.
- Couleurs du logo. L'accord conclu est en **vert**, jamais en bleu.
- Jetons communs : `css/mgci-tokens.css` (espaces, rayons, ombres, tailles de texte, minimum 11,5 px).
- Unités au pluriel à partir de 2 (`MDGApp.unites` dans `app/marche-app.js`).
- **Nombres dans des pastilles** (`.nbul`), jamais nus.
- **Panier et caddie dessinés** (`css/symboles.css`, déjà chargé par le site). Pas d'emoji comme icône : icônes dessinées de `app/icones.js`.
- Croix de fermeture dessinées en SVG, flèche de retour lisible, surfaces du navigateur aux couleurs de la marque (sélection, curseur, cases).
- Rien ne bouge en boucle sans raison ; les avatars sautent seulement quand il y a du nouveau.
- La tomate est montrée **en carton**. Ne jamais écrire « PAYÉ ».
- **Onglets** : pastille du nombre de produits sur « Prix », états vides « Aucune activité / Aucune alerte » avec le sac, pastilles panier / caddie « 2 offres · 1 demande » au tableau (`application.dc.html`, `v3/tableau.js`).
- **Hors connexion** : bandeau rouge en haut « Pas de connexion · Réessayer » et carte du sac qui dort (`app/sac.js`, `v3/tableau.js`, application seulement). Le site doit charger `app/sac.js` pour l'avoir.

## 5. Ce qu'on peut retirer du site : à valider par le propriétaire

Rien n'est supprimé tant que le propriétaire n'a pas dit oui. Les fichiers restent récupérables dans l'historique Git.

| À retirer | Pourquoi | Gain |
|---|---|---|
| `v3/tweaks-panel.jsx`, `v3/tweaks.jsx` | Panneau de réglages de design hérité d'un modèle de départ (« omelette starter ») : un outil de développement, pas une fonction | — |
| `vendor/babel.min.js` et Babel chargé depuis unpkg.com | Ne servent qu'à faire tourner les deux fichiers ci-dessus ; Babel est chargé **deux fois** | environ 3 Mo par visite, et plus de dépendance à un site extérieur |
| `v3/scene-ivt.js` | **Seul WebGL du site** : une scène décorative derrière la roue | moins de calcul, moins de batterie |
| `v3/hero-ivt.js` (+ `.css`), `v3/ivt-header.js` (+ `.css`), `v3/flou.js` (+ `.css`), `v3/constellation.js` (+ `.css`) | Héros orbital, en-tête et effets repris de l'ancien site IVT ; remplacés par l'accueil, le menu et le catalogue de l'application | — |
| `vendor/gsap.min.js`, `vendor/ScrollTrigger.min.js`, `vendor/lenis.min.js` | Animations de défilement du héros et de l'en-tête ci-dessus | environ 130 ko |
| `v2/map.js`, `v3/terre.js`, `v3/marqueurs.js` (+ `.css`), `vendor/d3.min.js`, `vendor/countries-110m.json` | Anciennes petites cartes en SVG du site ; la carte du réseau MapLibre de l'application les remplace. **Garder** `vendor/topojson-client.min.js`, `vendor/countries-50m.json` et `vendor/ci-hydro.json` : la carte de secours de l'application (`app/carte-app.js`) s'en sert | environ 400 ko |
| `index-v3.html` et `maintenance.html` | Si la méthode « un seul code » (partie 3) est choisie | — |
| À la racine : `p1-liste.png`, `p2-produit.png`, `p3-monte.png`, `p4-vendre.png` | Captures d'écran que plus rien n'affiche | — |
| À la racine : `RAPPORT.md` (10/10) et `MISE-A-JOUR.md` (journal jusqu'au 19/10) | Anciens rapports, remplacés par `docs/PASSATION.md` : **à ranger** dans `docs/archives/` plutôt qu'à supprimer | — |

**À garder** même s'ils paraissent lourds : `vendor/tesseract/` (15 Mo, lecture de la bande des pièces d'identité, chargé seulement pendant la vérification), `vendor/maplibre/` (carte de l'application), `v2/img/` (photos des produits).

## 6. Règles à respecter en modifiant le site

- Lire `CLAUDE.md` et `DESIGN.md` (avec les 32 lois de la section 8), puis utiliser les compétences `marche-de-gros-design`, `impeccable`, `ui-ux-pro-max` et `playwright-cli`.
- Ne pas recoder ce que fait un module commun : le corriger une seule fois, pour les deux.
- À chaque fichier modifié :
  - un nouveau `?v=` dans **chaque** page qui le charge ;
  - `CACHE` de `sw.js` augmenté.
- Vérifier dans un vrai navigateur à 1280 px (site) et en iPhone émulé (application), en mode jour et en mode nuit.
- Une PR par mise à jour ; le propriétaire fusionne.

### Le nouveau site public (`site/`, en construction, caché)

- Les pages `site/*.html` sont **fabriquées** par `tools/site-public.js` à partir des gabarits `tools/site/*.html` : modifier le gabarit, jamais la page fabriquée. La tâche `.github/workflows/site-public.yml` les refait après chaque fusion qui touche le gabarit, le catalogue, les photos ou la carte.
- `site/site.css`, `site/site.js` et `site/garde.js` s'écrivent à la main ; leur `?v=` est une empreinte calculée par le générateur (relancer `node tools/site-public.js`).
- Données en direct : `fil_public()` (schéma 80, anonyme) et `tableau_produits()` (schéma 59), avec la clé publique. Jamais de faux chiffre en attendant.
- Caché : `noindex` + voile `#garde` (est_admin vérifié par le serveur). L'administrateur y passe par la barre « Application · Ancien site · SEO » (`app/admin-pc.js`).
- Le service worker laisse passer `site/` (jamais l'application à la place d'une page du site).

## 7. Inventaire automatique

<!-- INVENTAIRE:DEBUT -->
_Inventaire du 24 octobre 2026_
_Partie mise à jour automatiquement par `tools/inventaire-site.js` (tâche GitHub `rapport-site.yml`). Ne pas modifier à la main._

### Les pages

| Page | Rôle | Fichiers chargés | Poids chargé |
|---|---|---|---|
| `application.dc.html` | Application mobile (la priorité). S’ouvre sur téléphone ; sur ordinateur, seulement pour l’administrateur. | 61 | 2,9 Mo |
| `index-v3.html` | Site pour ordinateur. Aujourd’hui caché derrière la maintenance, ouvert seulement à l’administrateur. | 65 | 4,7 Mo |
| `index.html` | Aiguillage : téléphone → application, ordinateur → maintenance (ou site pour l’administrateur). | 0 | 2 ko |
| `maintenance.html` | Page « site en maintenance » avec QR code vers l’application. | 3 | 85 ko |
| `suivi.html` | Lien de suivi envoyé au chauffeur (sans compte). | 0 | 12 ko |
| `admin.html` | Tableau de bord de l’administrateur. | 15 | 422 ko |

### Modules communs à l’application et au site (23)

Ce qu’ils font est déjà sur les deux : une correction dans l’un de ces fichiers profite aux deux.

`app/admin-pc.js` · `app/icones.js` · `app/marque.js` · `app/stable.js` · `app/toast.js` · `app/ville-seule.js` · `css/fonts.css` · `css/symboles.css` · `v2/data.js` · `v2/search.js` · `v3/avatar.js` · `v3/compte.js` · `v3/identite.js` · `v3/messages.js` · `v3/negoce.js` · `v3/nuage.js` · `v3/personnages.js` · `v3/porte.js` · `v3/pousse.js` · `v3/reputation.js` · `v3/sons.js` · `v3/statuts.js` · `v3/ux.css`

### Propres à l’application (38) : ce que le site n’a pas

`app/activite.js` · `app/carte-app.js` · `app/carte-gl.js` · `app/demo-orbite.js` · `app/effets.js` · `app/garanties.js` · `app/icone.js` · `app/marche-app.js` · `app/nuit.js` · `app/prixmoment.js` · `app/sac.js` · `app/scene.js` · `app/theme.js` · `app/vibre.js` · `app/villes.js` · `css/annee-app.css` · `css/categories-app.css` · `css/mgci-app.css` · `css/mgci-tokens.css` · `css/sombre.css` · `support.js` · `v3/aide.js` · `v3/alertes.js` · `v3/appro.js` · `v3/astuces.js` · `v3/boutique.js` · `v3/chauffeur.js` · `v3/commandes.js` · `v3/groupes.js` · `v3/guide.js` · `v3/prixzone.js` · `v3/racheter.js` · `v3/releve.js` · `v3/souffle.js` · `v3/suivi.js` · `v3/tableau.js` · `vendor/maplibre/maplibre-gl.css` · `vendor/maplibre/maplibre-gl.js`

### Propres au site (43)

`css/styles.css` · `css/typo.css` · `https://unpkg.com/@babel/standalone@7.29.0/babel.min.js` · `v2/map.js` · `v2/oklch.js` · `v2/reseau-carte.js` · `v2/saisons.js` · `v2/terrain.js` · `v2/themes.js` · `v3/acheter.css` · `v3/acheter.js` · `v3/annee.css` · `v3/annee.js` · `v3/cherche.css` · `v3/cherche.js` · `v3/constellation.css` · `v3/constellation.js` · `v3/etat.css` · `v3/etat.js` · `v3/flou.css` · `v3/flou.js` · `v3/hero-ivt.css` · `v3/hero-ivt.js` · `v3/ivt-header.css` · `v3/ivt-header.js` · `v3/marche.js` · `v3/marqueurs.css` · `v3/marqueurs.js` · `v3/match.js` · `v3/pages.css` · `v3/pages.js` · `v3/scene-ivt.js` · `v3/terre.js` · `v3/tweaks-panel.jsx` · `v3/tweaks.jsx` · `v3/vendre.css` · `v3/vendre.js` · `vendor/ScrollTrigger.min.js` · `vendor/babel.min.js` · `vendor/gsap.min.js` · `vendor/lenis.min.js` · `vendor/react-dom.production.min.js` · `vendor/react.production.min.js`

### WebGL

- Site : `v3/scene-ivt.js`
- Application : `app/carte-gl.js`, `vendor/maplibre/maplibre-gl.js`

### Fichiers lourds chargés par le site (plus de 150 ko)

- `vendor/babel.min.js` : 3,0 Mo

Chargés depuis Internet : `https://unpkg.com/@babel/standalone@7.29.0/babel.min.js`

### Fichiers que plus aucune page ne charge (0)

- aucun
<!-- INVENTAIRE:FIN -->
