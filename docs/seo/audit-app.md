# Audit technique de l'application mobile — Marché de Gros CI
Lecture seule, dépôt `/home/user/marchedegrosci`, `main` à `665f183` (23/10/2026). Aucun fichier modifié, aucune requête à la base (le serveur MCP Supabase n'était pas joignable ; tout vient du code et de `supabase/schema-*.sql`).

---

## 1. Architecture

**Page unique** : `application.dc.html` (340 Ko). C'est un gabarit dc-runtime : `<x-dc>` (l.47), un script `type="text/x-dc" data-dc-script` (l.805) qui contient une grande classe React (pages, état, navigation). `support.js` (69 Ko) fait tourner React 18 (`vendor/react*.production.min.js`).
- Babel (`vendor/babel.min.js`, 3,1 Mo) n'est chargé que pour les imports JSX (`support.js:1201`), et l'application n'en a pas. **Mais il fait partie de `CORE` dans `sw.js:52`** : il est téléchargé à l'installation du service worker.
- Ordre de chargement : modules au démarrage (l.24-33, puis 51-70 : `v3/nuage.js`, `app/admin-pc.js`, `v3/personnages.js`, `v3/avatar.js`, `app/icones.js`, `effets`, `marque`, `sac`, `garanties`, `toast`, `theme`, `nuit`, `stable`, `vibre`, `prixmoment`, `demo-orbite`, `activite`, `v2/data.js`, `app/marche-app.js`, `app/villes.js`).
- **Modules différés** : liste `window.MDGPlus`, l.37, chargée 400 ms après `load` (porte, compte, negoce, messages, reputation, statuts, alertes, releve, commandes, tableau, chauffeur, suivi, prixzone, racheter, appro, groupes, carte-app, carte-gl, identite…). Une fois tous chargés, l'événement `mdg:change` est émis.
- **Données** : `v2/data.js` (catalogue `window.MDG`), `app/marche-app.js` (`MDGApp` : `REG` = coordonnées des chefs-lieux, l.30 ; `SACK` ; `read`/`write` du localStorage).
- **Module serveur commun** : `v3/nuage.js`. URL Supabase et clé publique `sb_publishable_…` (l.14), `api()`, `rpc()`, session, synchronisation. Il est partagé app + site (`docs/PASSATION.md:36-40`).
- **Garde « ordinateur »** (`application.dc.html:16-22`) : hors téléphone (`pointer: coarse` et écran < 768 px), un non-admin est renvoyé vers `maintenance.html` + hash. L'admin passe par `?app=1`, sinon il va vers `index-v3.html`.
- `index.html` est un simple aiguillage (téléphone → app, ordinateur → maintenance, admin → site). Il garde le **hash**, pas la query (sauf `app=1` et `ordinateur=1`).

**PWA**
- `manifest.webmanifest` : `start_url: "application.dc.html"`, `scope: "./"`, `id: "./application.dc.html"`, `display: standalone`, `orientation: portrait`, icônes 192/512/maskable. Pas de `related_applications`, pas de `shortcuts`, pas de `share_target`.
- `sw.js` : `CACHE = 'mgci-v222'` (l.6). Le code passe par le réseau d'abord (repli sur le cache au-delà de 4 s), les images par le cache. Les tuiles de carte sont gardées à part (`tuiles-mgci`, 1 500 au plus, l.8). `CORE` est installé avec `addAll` : un seul fichier manquant fait échouer l'installation (`PASSATION.md:25`).
- Mises à jour : `register('sw.js',{updateViaCache:'none'})`, `r.update()` au retour sur l'app, rechargement au `controllerchange` (`application.dc.html:23`).
- Push : `sw.js` `push` / `notificationclick` (l.~250-275). Ouvre `data.url` ou envoie `postMessage` (`mdg-nego`, `mdg-dm`, `mdg-commande`, `mdg-lien`) si l'app est déjà ouverte.
- **Aucune invitation à installer** (pas de `beforeinstallprompt`) : non trouvé. Il y a seulement un texte d'aide (`v3/aide.js:133` : Partager → Sur l'écran d'accueil) et la détection `display-mode: standalone` (`v3/pousse.js:17`, `app/icone.js:11`), car sur iPhone les notifications exigent l'app installée.
- **Application native / TWA / fiche de store** : non trouvé (pas d'`assetlinks.json`, ni de Bubblewrap, ni de Capacitor).

## 2. Routage et liens profonds

Routeur maison sur le **hash** : `fromHash()` (`application.dc.html:972-981`), appelé une seule fois au démarrage (`boot`, l.898). Aucun écouteur `hashchange` dans la classe : la navigation interne passe par `push()` → `history.pushState` (l.1185-1188).

**Routes reconnues** (`HASH`, l.812 ; `INFO`, l.807) :

| Hash | Écran |
|---|---|
| `#/` | accueil |
| `#/catalogue` | acheter |
| `#/vendre` | formulaire offre |
| `#/demande` | formulaire demande |
| `#/carte` | carte du réseau |
| `#/categories` | catégories |
| `#/prix` | prix |
| `#/annee` | année du marché |
| `#/mes-publications` | mes publications |
| `#/produits/<slug>` | fiche produit |
| `#/producteurs/<uid>` | page vendeur |
| `#/comment-ca-marche`, `#/aide-producteur`, `#/confiance` | pages d'info |

**Tout ce qui suit `?` dans le hash est ignoré par le routeur** (`.split('?')[0]`, l.973). Aucun préremplissage de formulaire par l'adresse.

**Paramètres lus par les modules** (dans le hash, puis retirés par `replaceState`) :

| Paramètre | Lu par | Ouvre |
|---|---|---|
| `?commande=<uuid>` | `v3/commandes.js:1048` | une commande |
| `?nego=<uuid>` | `v3/pousse.js:57` | une négociation |
| `?dm=<uuid>` | `v3/messages.js:356` | une conversation |
| `?groupe=<uuid>` | `v3/groupes.js:222` | un achat groupé |
| `?besoin=<uuid>` | `v3/appro.js:324` | un besoin pro |
| `?racheter=<uuid>` | `v3/racheter.js:254` | racheter une commande |
| `?chauffeur=1` | `v3/chauffeur.js:411` | Espace chauffeur |

**Attention** : `groupe`, `besoin`, `racheter` et `commande` exigent une session. Sans compte, le module réessaie 20 × 300 ms puis **abandonne en silence** (ex. `v3/groupes.js:224-225`) : l'intention est perdue.

Autres entrées :
- `?app=1` / `?ordinateur=1` dans la query : seulement des aiguillages.
- `suivi.html?j=<jeton>` : page du chauffeur, sans compte (`suivi.html:76`).
- `v3/annee.js:185` écrit `#/annee?m=` (lecture seulement à l'intérieur du module).
- Partager une fiche : `navigator.share({url: location.href})` (`application.dc.html:1778`), donc `#/produits/<slug>`.
- Événement interne `mdg:aller {page}` (l.892) : ouvre une page de `HASH` (utilisé par le guide et les garanties).

**Ce qu'il faudrait pour un lien d'intention** comme `application.dc.html#/publier?kind=offre&produit=tomate` :
1. Dans `fromHash()`, lire la query du hash. Ajouter une route `publier` (ou réutiliser `vendre`/`demande`), puis remplir l'état avec les fonctions existantes : `this.setVf({slug, unit, qty…})` pour une offre, `df` pour une demande, `openSheet('jai'|'cherche', slug)` (l.1217) pour la feuille rapide. Valider `slug` contre `MDG.products`.
2. Ajouter des routes `#/groupes` → `MDGGroupes.ouvrir()`, `#/appro` → `MDGAppro.ouvrir()`, `#/recherche?q=` (le catalogue ne lit pas `q`), après `MDGPlus.quand(...)`, car ces modules sont différés.
3. Écouter `hashchange` (ou `mdg:aller` avec des paramètres) si l'app est déjà ouverte.
4. **Garder l'intention pendant l'inscription** : la mettre en `sessionStorage`, puis la rejouer sur `mdg:connecte` (le modèle existe déjà : `v3/negoce.js:409`, `v3/messages.js:192`). Pour les modules qui abandonnent après 6 s, attendre `mdg:connecte` au lieu de 20 essais.
5. Garder le hash à travers `index.html` et `maintenance.html` : c'est déjà le cas. Sur ordinateur, un visiteur non admin finit sur `maintenance.html` (QR code), jamais dans l'app.

## 3. Authentification

- Supabase Auth en **e-mail + mot de passe déguisés** : e-mail `225<10 chiffres>@tel.marchedegros.ci`, mot de passe = code à 6 chiffres (`v3/nuage.js:15, 47, 58-74`). Aucun SMS ; le numéro **n'est pas prouvé** (`v3/compte.js` en-tête).
- Inscription : `/auth/v1/signup`, puis `creer_secours` (code de secours de 12 caractères montré une fois). Ensuite le profil (`profils` : prénom, nom, pseudo facultatif ; `pseudo_libre` est public) (`v3/nuage.js:497-499`).
- Code oublié : `secours_reinitialiser` (anon, essais comptés, schéma 72).
- Interface : `MDGNuage.open(raison)` (`v3/nuage.js:410`). C'est une fenêtre dans la page : onglets « J'ai déjà un compte » / « Créer mon compte », habillée par `v3/porte.js`. Raisons prévues : `publie`, `negocie`, ou un texte libre.
- **Session** dans le `localStorage`, clé `mdg-nuage:session` (access + refresh token), rafraîchie par `token()` (l.52-57). Ce n'est pas `supabase-js` : il n'y a pas de cookie.
  - **Même origine = session partagée** : une page du site servie sur le même domaine (même hôte GitHub Pages) qui charge `v3/nuage.js` voit et crée la même session. `index-v3.html` le fait déjà. Un autre domaine ou sous-domaine ne la partage pas.
- **Après connexion** : l'événement `mdg:connecte {raison}` (l.520), un toast de bienvenue, puis `MDGCompte.bienvenue()` à l'inscription. **Aucune redirection par adresse** (`?next=` : non trouvé).
- Publier sans compte est possible : l'annonce est écrite en local (`A.write('offres')`, `application.dc.html:1163`). La fenêtre de connexion s'ouvre alors (`v3/nuage.js:568-571`), puis `sync()` envoie l'annonce après la connexion. **C'est déjà une intention conservée** pour « publier ».
- Turnstile / CAPTCHA : non installé (décision en attente, `CLAUDE.md`).

## 4. Données publiques sans compte (anon)

Accès en clé publique dans les fichiers SQL (non vérifié en production).

| Source | Droit anon | Champs exposés | Utilisée par |
|---|---|---|---|
| table `offres` | `grant select` (`schema.sql:99`), RLS `status='active'` (l.79) | **toutes les colonnes**, dont `user_id` (uuid), `seller_name` (= `nom_public` : pseudo, ou prénom + initiale, ou **nom complet si `nom_public`**), `city`, `region_slug`, produit, quantité, unité, `price`, `created_at`, `lieu`, `agent`, `transport`, `qte_min`, `photo`… `phone` est forcé à null par le déclencheur (`schema-9:9-15`) | `v3/nuage.js:174-175` (`select=*&status=eq.active&limit=500`) |
| table `demandes` | idem (`schema.sql:88,99`) | idem, avec `buyer_name`, `budget`, `buyer_type`, `criteres`, `detail`, `exigences`, `besoin_id` | idem |
| table `zones` | select (`schema-11:23`, `schema-67`) | zones de forte demande : produit, région, ville, note, `created_by` | `nuage.js:167` |
| `annonces_version()` | schéma 76 | empreinte des listes | `nuage.js:172` |
| `stats_publiques()` | schéma 79 | totaux uniquement : membres, offres et demandes actives, produits, régions, commandes terminées | `strategie/sources/construire.js:33` |
| `ventes_recentes(n≤30)` | schéma 55 | ventes conclues sur 30 jours : clé md5, produit, quantité, unité, ville, date — **sans nom ni prix** | `application.dc.html:1351` |
| `produits_activite()` | schéma 53 | par produit : ventes, négociations, demandes sur 14 jours, forte demande | `application.dc.html:1345` |
| `tableau_produits(region)`, `tableau_marche(slug, region)` | schémas 59 et 70 | top 50 par unité : id, prix, quantité, ville, région, transport, date, **nom public**, vérifié, fiable, note, commandes honorées, officiel | `v3/tableau.js:144` |
| `prix_zones(produit)` | schéma 31 | agrégats par district : médiane, min/max, tendance, mois | `v3/prixzone.js:117` |
| `groupes_liste`, `groupe_detail` | schéma 35 | achats groupés ouverts : produit, zone, objectif, paliers, date limite | `v3/groupes.js:87` |
| `besoins_liste`, `besoin_public` | schéma 34 | besoins pro : titre, type d'acheteur, région, ville, produits | `v3/appro.js:144` |
| `profil_public`, `profils_publics/2/3`, `reputation_publique`, `notes_publiques`, `avis_de`, `avis_de2`, `mieux_notes`, `statuts_publics`, `identite_verifiee`, `structure_publique`, `officiels`, `signalements_publics` | schémas 7, 12, 13, 17, 23, 32, 39, 78 | noms publics, avatars, notes, statuts. Depuis le schéma 78, **plus d'heure de dernière activité sans compte** | profils |
| `suivi_lien_infos`, `suivi_lien_position`, `suivi_code_jeton`, `suivi_lien_ouvert` | schémas 48, 64, 71 | par jeton secret seulement | `suivi.html` |

Les **commandes** (`commandes`, `commande_etapes`) sont fermées à anon (`schema-26:74`). Côté public, il n'y a que le total `commandes_terminees` et les ventes conclues (`ventes_recentes`).

**Point de vigilance (vie privée)** : un fil public peut afficher « prénom + initiale, ville, produit, quantité » sans rien ajouter côté serveur. Mais la lecture directe des tables expose `user_id`, ce qui permet de relier toutes les annonces d'une même personne. Elle expose aussi le **nom complet** quand le membre l'a choisi, et le prix.
- Pour un site marketing, le plus sûr serait une **nouvelle fonction de lecture dédiée** (par ex. `fil_public(limite)`), en `security definer`, qui renvoie seulement : prénom + initiale **forcés**, ville, produit, quantité, type, date, et un identifiant haché.
- C'est le modèle de `ventes_recentes`. Ce serait une simple création (`create or replace`), sans suppression.

**Aucune coordonnée GPS** sur les annonces. Les positions sont celles des villes ou chefs-lieux (`MDGApp.REG`, `app/marche-app.js:30` ; 3 700 localités dans `app/geo/ci.json`).

Temps réel : non. Lecture toutes les 2 min (`v3/nuage.js:579`), pas de Supabase Realtime.

## 5. Confiance (réellement codée)

- **Identité vérifiée** : pièce recto/verso + selfie avec un code. Lecture MRZ dans le téléphone (Tesseract), **décision par un administrateur seulement** (`v3/identite.js`, schémas 13, 16, 19, 21, 25).
- **Structures** (coopérative, marché) avec preuves ; badge vérifié par l'admin (schémas 23, 39).
- **Statuts gagnés** (`v3/statuts.js`) : identité vérifiée, vendeur de confiance, acheteur sérieux, répond vite ; badge Officiel (schéma 20).
- **Réputation** : étoiles et avis possibles seulement après une vraie négociation ou commande, un seul avis par auteur et par personne (`v3/reputation.js`, schémas 7, 32, 77). Classement des mieux notés.
- **Signalements** d'annonces avec motif ; 3 comptes différents masquent l'annonce (schémas 15, 18, 66). Bannissement par l'admin (schéma 14).
- **Historique et relevés** : `v3/releve.js` (bons PDF, tampon, jamais « payé »).
- **Numéros cachés**. Les messages qui contiennent un numéro ou un lien sont refusés ou masqués (schémas 9, 10, 22, 68). Messages gardés 1 an et lisibles par l'équipe (schéma 60).
- **Accord figé** : `nego_fige` fige prix, quantité et conditions (schéma 3).
- **Mot secret du vendeur** dans le colis, refus avec preuves, litige, discussion à trois, l'admin tranche (schémas 57, 58, 61).
- **Séquestre** : structure en place, mais **aucun partenaire de paiement branché**. Affiché « en construction » ; « paiement à la livraison, hors application ».
- Codes de prise en charge et de réception (schéma 28), essais limités (schémas 71, 72).

## 6. Fonctions commerciales et leur état

| Fonction | État |
|---|---|
| Offres et demandes | OK (local → `sync()` → tables), exigences et critères (schéma 47), minimum de vente (schéma 37), transport inclus ou non (schémas 48-49) |
| Négociation | OK (`v3/negoce.js`, `nego_ouvrir` / `nego_agir`, expiration 48 h, accord figé) |
| Tableau des prix façon Binance P2P | OK, public (`v3/tableau.js`) |
| Prix par zone | OK, public (`v3/prixzone.js`) |
| Commandes en 8 étapes | OK (`v3/commandes.js`, schéma 26). Commission de 3,5 % **calculée, non prélevée** (schéma 30) |
| Transport | Espace chauffeur (`v3/chauffeur.js`), transporteur du réseau **en pause** (schéma 62), transport par l'acheteur ou le vendeur sans code (schéma 63), lien de suivi `suivi.html` + carte (`v3/suivi.js`). Pas de suivi en arrière-plan (limite du web) |
| Approvisionnement pro | OK (`v3/appro.js`, schéma 34) |
| Achats groupés | OK (`v3/groupes.js`, schéma 35, paliers, confirmation par chacun, une commande par participant) |
| Racheter et rappels | OK (`v3/racheter.js`, schéma 33), rien d'automatique |
| Alertes par produit | OK (`v3/alertes.js`), au plus 10 par jour (schéma 75) |
| Notifications Web Push | OK (`v3/pousse.js`, fonction Edge `pousser`). Sur iPhone, seulement si l'app est installée |
| Messagerie directe | OK (`v3/messages.js`) |
| Paiement / séquestre | **Non opérationnel** (aucun partenaire) |

## 7. Carte du réseau

- `app/carte-gl.js` (52 Ko). MapLibre GL **hébergé dans le dépôt** : `vendor/maplibre/maplibre-gl.js` (939 Ko) + `.css` (69 Ko), chargé à la demande (l.22-31).
- Fond **embarqué hors connexion** : `app/geo/ci.json` (556 Ko : routes, rail, fleuves, lacs, 3 700 localités).
- En ligne, il ajoute :
  - le relief Terrarium (AWS Open Data, `s3.amazonaws.com/elevation-tiles-prod`, l.184) ;
  - les rues OpenFreeMap (`tiles.openfreemap.org/planet`, l.194).
  - Les deux sont gratuits et sans clé.
- Itinéraires : OSRM public (`router.project-osrm.org`, l.342).
- Repli Canvas : `app/carte-app.js` (29 Ko) + `vendor/countries-50m.json` (756 Ko). Le site a son propre `v2/reseau-carte.js` (43 Ko).
- API : `MDGCarteGL.mount(host, {onSelect,onPick,onLocate,insets})` → `api.set({items, me, sel, zones, pts, pairs, lier})` (l.9, 408).
- Dépendances globales : `window.MDGApp` (`REG`), `MDGIco`, `MDGStatut`, `MDGToast` (facultatifs). La forme des `items` est celle de `offersAll()` / `demandsAll()` (`application.dc.html:986-987`).
- **Réutilisable sur une page publique** :
  - poids ≈ 1,6 Mo (MapLibre + CSS + `ci.json`) + `marche-app.js`, ou une petite copie de `REG` ;
  - `capable()` refuse les appareils avec moins de 2 Go de mémoire et le mode « économie de données » (l.33-40) ;
  - la carte est verrouillée (vue du dessus, pas de rotation) ;
  - attention aux bulles de prix (« 350 F/kg ») : le fil public visé n'en a pas forcément besoin.

## 8. Mesure d'audience

- Analytics (GA, Plausible, Umami, GoatCounter, Matomo, PostHog, Clarity, pixel) : **non trouvé**.
- Gestion des `utm_*` ou du `referrer` : **non trouvé**.
- Table d'événements ou de visites en base : **non trouvé** (seulement des journaux métier : commissions, séquestre).
- Seule mesure existante : `stats_publiques()` (totaux).

## 9. Contraintes

- Site statique (GitHub Pages présumé ; pas de `CNAME` dans le dépôt, pas de serveur). Donc pas de rendu serveur pour le SEO : il faut des pages HTML **pré-générées** (par ex. par une GitHub Action, comme `strategie-pdf.yml` / `rapport-site.yml`) ou du contenu statique.
- Supabase gratuit :
  - pas de Realtime utilisé, lecture toutes les 2 min ;
  - un fil public très visité appellerait l'API à chaque visite. Préférer une fonction agrégée légère, un instantané JSON généré périodiquement par une Action, ou un cache court.
- Aucun budget : pas de SMS / WhatsApp, pas de service payant. Tuiles OpenFreeMap et Terrarium gratuites.
- Règles du dépôt : une PR par changement, pas de `drop` / `delete`, à tester d'abord sur `mgci-test`, monter `?v=` et `CACHE` à chaque changement du front.
- Ordinateurs : l'app ne s'ouvre pas pour les non-admins (maintenance + QR code). Un site marketing vu sur ordinateur doit donc proposer « continuer sur le téléphone » (QR code de l'URL d'intention), comme `maintenance.html`.
- Le `start_url` et le `scope` (`./`) couvrent tout le dossier. Une page du site au même niveau serait **dans le scope** de la PWA ; c'est à prévoir pour les liens ouverts depuis l'app installée.
