# Porter sur le site ce qui a été fait dans l'application

> **À qui s'adresse ce document** : au développeur ou à l'IA qui doit mettre le **site** (`index-v3.html`) au niveau de l'**application mobile** (`application.dc.html`).
> Il dit, point par point, ce qui est **déjà sur le site** (rien à faire), ce qui **reste à faire**, **où se trouve le modèle dans l'application**, et **comment vérifier**.
> Établi le 19 octobre 2026, après la fusion des PR #30 à #69. Si une PR plus récente touche l'application, ajoutez-la ici.

---

## 0. À lire avant de commencer (5 minutes)

**Les deux faces du projet**
| | Application mobile | Site (ordinateur) |
|---|---|---|
| Page | `application.dc.html` (gabarit dc-runtime `{{ }}`, `<sc-if>`, `<sc-for>`, classe `Component`, React 18 via `support.js`) | `index-v3.html` + modules `v3/*.js` (React + Babel dans la page, GSAP, Lenis) |
| Ouverture | Un téléphone qui ouvre l'adresse arrive ici | Un ordinateur arrive ici ; `?app=1` force l'application, `?ordinateur=1` force le site |
| Styles | `css/mgci-tokens.css`, `css/mgci-app.css`, `css/categories-app.css`, `css/annee-app.css` | `css/styles.css`, `css/typo.css`, `v3/*.css` |

**Modules partagés (déjà chargés par les deux) : tout ce qu'ils font est déjà sur le site**
`v2/data.js`, `v2/search.js`, `v3/nuage.js`, `v3/compte.js`, `v3/messages.js`, `v3/negoce.js`, `v3/identite.js`, `v3/reputation.js`, `v3/statuts.js`, `v3/sons.js`, `v3/porte.js`, `v3/pousse.js`, `v3/avatar.js`, `app/marque.js`, `app/toast.js`, `app/icones.js`, `css/fonts.css`, `v3/ux.css`.

**Le serveur (Supabase) est commun et à jour** : toutes les règles (schémas 13 à 22) sont **déjà appliquées** sur le projet `catmsypctymgkjkfzdkt`. Le site en profite automatiquement : identité, statuts, compte officiel, liens interdits… **Ne relancez aucun fichier `supabase/schema-*.sql`.**

**Règles du dépôt (à respecter à chaque changement)**
1. Tout fichier versionné modifié (`x.js?v=…`) reçoit un **nouveau `?v=`**, dans **chaque page** qui le charge (`application.dc.html`, `index-v3.html`, `admin.html`). Sinon les téléphones gardent l'ancienne version (le service worker sert les fichiers versionnés depuis le cache).
2. Si un fichier non versionné change, ou si un fichier est ajouté à la liste hors connexion, augmentez `CACHE` dans `sw.js` (actuellement `mgci-v89`).
3. Couleurs du logo uniquement : vert `#10392B`, maïs `#F2C230`, crème `#F3EFE4`. Plus de terracotta (`#E2735B`, `#A0492A`, `#C2410C`…) sauf pour les vraies erreurs.
4. Une PR par lot de changements ; le propriétaire fusionne lui-même.
5. Testez avec Playwright (Chromium : `/opt/pw-browsers/chromium`) à **1280 px** pour le site et à **390 px** pour l'app (ajoutez `?app=1`, sinon un navigateur d'ordinateur est renvoyé vers le site).

---

## 1. Déjà sur le site : rien à faire

Ces fonctions vivent dans des modules partagés ou sur le serveur. Elles marchent déjà sur le site ; **vérifiez seulement**, sans rien recoder.

| Fonction (PR) | Pourquoi c'est déjà là |
|---|---|
| Mon compte refait, statuts « Vos statuts », annonces gratuites (#33, #34, #45, #50) | `v3/compte.js` partagé |
| Messages privés, « Écrire au Marché de Gros », liens cliquables dans les messages de l'admin (#2, #35, #67) | `v3/messages.js` partagé |
| Négociations, accord, refus (#35) | `v3/negoce.js` partagé |
| Vérification d'identité : parcours, MRZ, pièces expirées refusées, **permis sans date de fin** (#42, #43, #47, #66) | `v3/identite.js` partagé + serveur |
| Signaler une personne avec preuves (#46, #57) | `v3/identite.js` + serveur |
| Statuts des comptes, **badge « Officiel · Marché de Gros »** de l'admin (#50, #65) | `v3/statuts.js` partagé (`MDGStatut.puces`, `estOfficiel`) |
| Profil public sans étoiles pour le compte officiel (#65) | `v3/reputation.js` partagé |
| Bannière de message après une action, avec son (#55) | `app/toast.js` chargé ; `MDGNuage.toast` l'utilise |
| Logo unique « marché de Gros » (#44, #49, #61) | `app/marque.js` remplit `[data-mq]` (en-tête du site déjà branché) |
| **Liens, e-mails, numéros de téléphone et codes refusés** dans tous les textes des membres, sauf l'admin (#67, #68) | Règle **serveur** (`texte_refus`, déclencheurs) + vérification avant envoi dans les modules partagés. Il reste à faire : formulaires de publication du site, voir §2.1 |
| L'admin s'affiche « Marché de Gros » partout, sans nom ni numéro (#65) | Règle **serveur** (`nom_public`, `annonce_officielle`) |
| 28 nouveaux produits et la famille « Viandes et abats » dans les listes (#60) | `v2/data.js` partagé. Il reste à faire : images et couleurs, voir §2.3 |

---

## 2. À faire sur le site, par ordre de priorité

### 2.1 Formulaires de publication : liens interdits et compte officiel (priorité haute)
**Pourquoi** : le serveur refuse déjà un lien, un e-mail ou un numéro, mais le site n'explique rien avant l'envoi. Et l'admin voit encore le champ « Votre nom » alors que tout est publié au nom de « Marché de Gros ».
**Modèle dans l'app**
- `application.dc.html` → méthode `refusTexte(f)` (au-dessus de `pubOffer`), appelée avant chaque `this.pubOffer(` / `this.pubDemand(`.
- Champ nom remplacé par l'encart « Publié au nom de « Marché de Gros » » : variables `estOff`, `pasOff`, `pasOffV`, `offLogo` (cherchez `estOff`).
- Nom forcé : `identAdm() ? 'Marché de Gros' : …` dans `pubOffer` et `pubDemand`.

**Où sur le site** : `v3/vendre.js` (champs `#vN` « Votre nom » et `#vAgNi` « agent terrain », fonction d'envoi) et le formulaire de demande s'il est séparé.
**Étapes**
1. Avant l'envoi : `const r = MDGNuage.texteRefus([nom, agent, ville].join(' · ')); if (r) { MDGNuage.toast(r); return; }`. La fonction renvoie `''` pour l'admin.
2. Si `localStorage['mdg-nuage:admin'] === 'true'` : masquer `#vN`, afficher l'encart (logo `MDGMarque.dg(40, { fond: 'vert', rond: true })` + texte), et envoyer `seller_name` / `buyer_name` = `'Marché de Gros'`. Le serveur l'impose de toute façon.

**Vérifier** : tapez « www.test.com » dans « Votre nom » : message clair, rien n'est envoyé. Connecté en admin : le champ nom a disparu.

### 2.2 Cartes d'annonce du site : compte officiel, sceau, signalement (priorité haute)
**Pourquoi** : sur l'app, une annonce de l'admin montre le logo, la puce « Officiel · Marché de Gros », pas d'étoiles et pas de bouton « Signaler ».
**Modèle dans l'app** : `application.dc.html` → méthode `card(x)` : `idOk` (sceau via `MDGStatut.estVerifie`), `st` (puce via `MDGStatut.puces`), `canRep` et `hasNote` (désactivés si `MDGStatut.estOfficiel(x.uid)`), avatar via `MDGCompte.avatar(uid)`, qui renvoie déjà le logo pour l'officiel.
**Où sur le site** : `index-v3.html` (liste « tz-item », fonction `stTag`, vers la ligne 1870), `v3/acheter.js`, `v3/match.js`, `v3/marche.js` : partout où une annonce affiche un nom, une note ou un bouton signaler.
**Étapes** : la puce est déjà là via `stTag` → `MDGStatut.puces` ; elle montrera « Officiel ». Ajoutez :
1. masquer étoiles et note si `MDGStatut.estOfficiel(uid)` ;
2. masquer « Signaler » pour l'officiel ;
3. utiliser `MDGCompte.avatar(uid).uri` pour l'image de la personne.

**Vérifier** : l'annonce publiée par l'admin montre « Marché de Gros », le logo et la puce Officiel, sans étoile ni signalement.

### 2.3 Images des produits et famille « Viandes et abats » (priorité haute, facile)
**Pourquoi** : le site n'affiche que **21** images de produits (liste écrite en dur), alors que **93** existent dans `v2/img/produit-*.webp`. La nouvelle famille n'a pas de couleur sur le site.
**Où sur le site** : `index-v3.html`
- ligne ~1400 : `const IMG = new Set('tomate oignon … ail'.split(' '))` ;
- ligne ~2021 : `const FAMC = { … }` (couleurs des familles).

**Étapes**
1. Remplacer la liste `IMG` par la liste réelle des images : les clés de `A.SACK` dans `app/marche-app.js` (même source que l'app), ou une liste générée depuis `v2/img/produit-*.webp`. **Kplala n'a volontairement pas d'image** : la photo reçue était celle du corossol.
2. Ajouter `'viandes-et-abats': ['#F1DCD3', '#C98B74']` (ou une teinte proche) dans `FAMC`. L'image `v2/img/famille-viandes-et-abats.webp` existe.

**Vérifier** : catalogue du site → « Viandes et abats » a sa tuile et ses images ; plantain, igname, corossol… ont leur photo.

### 2.4 Le sac, personnage, partout (priorité haute : demandé par le propriétaire)
**Pourquoi** : dans l'app, le sac de jute est la mascotte de **tous** les moments d'attente et de toutes les notifications. Son humeur suit la situation :
| Situation | Humeur (`MDGSac.svg(…)`) | Dans l'app |
|---|---|---|
| Attente | `'charge'` : se remplit en boucle | carte du réseau, messages, négociations, profil, identité |
| Réussi | `'plein'` : content, petit saut | bannières de réussite, écran « annonce publiée » |
| Échec | `'triste'` : se tasse | bannières d'erreur, « Impossible de charger » |
| Rien encore, ou info | `'vide'` : patient, cligne des yeux | listes vides, bannières d'info |
| Pas de réseau | `'ferme'` : ficelé, dort | bulle en bas de l'écran (automatique) |

**Modèle** : `app/sac.js` (autonome, sans dépendance) :
- `MDGSac.svg(humeur, { t })` : le dessin ;
- `MDGSac.vide(titre, texte)` : un état vide ;
- `MDGSac.charge(texte)` : une attente ;
- `MDGSac.attente(conteneur, texte)` : un voile posé sur un conteneur, qui renvoie la fonction pour l'enlever (utilisé pour la carte dans `monterCarte`).

Les bannières (`app/toast.js`, partagé) et les modules partagés (messages, négociations, profil, identité) **utilisent déjà le sac dès que `app/sac.js` est chargé**. Sur le site, il suffit donc presque de le charger.

**Étapes**
1. Charger `<script src="app/sac.js?v=…">` dans `index-v3.html`, après `app/marque.js`. Rien qu'avec ça, les bannières, les attentes et les listes vides des fenêtres partagées et la bulle hors connexion passent au sac.
2. Carte du site (`v2/map.js`) : `const fin = MDGSac.attente(conteneurDeLaCarte, 'La carte du réseau se prépare…')`, puis `fin()` quand la carte est dessinée.
3. États vides propres au site (catalogue sans résultat, recherche vide, « rien de publié ») : `MDGSac.vide('…', '…')`.
4. Confirmation de publication (`v3/vendre.js`) : `MDGSac.svg('plein', { t: 118 })`.
5. Attention aux règles CSS génériques du type `.x svg { fill: none; stroke: … }` : elles abîment le dessin. Ajoutez `.x svg.ms { fill: initial; stroke: none; width: auto; height: auto }` (voir `.dm-vide svg.ms` dans `v3/messages.js`).

**Vérifier** : couper le réseau (DevTools → Offline) pour voir la bulle du sac qui dort ; publier une annonce pour voir la bannière avec le sac content ; ouvrir la carte pour voir le sac qui se remplit pendant la préparation.

### 2.5 Écran de chargement « le sac qui se remplit » (priorité moyenne, demandé par le propriétaire)
**Modèle** : `application.dc.html` → `splashMark()` (dessin SVG) + `css/mgci-app.css` (`.spl-*`, `.sac-*`, animations `sacMonte`, `sacTombe`).
**Où** : `index-v3.html`. Aujourd'hui, seule la couleur de fond est posée dans `<head>` (ligne 8).
**Étapes**
1. Styles critiques dans le `<head>` (fond `#10392B`), le SVG du sac au premier rendu.
2. Le retirer dès que la page est prête, et **au plus tard après 2,5 s** : il ne doit jamais bloquer.
3. Ne pas le rejouer à chaque navigation interne (`#/…`).
4. Respecter `prefers-reduced-motion`.

**Vérifier** : à 1280 px, le sac se remplit puis laisse place à l'accueil ; aucun écran blanc.

### 2.5 bis La voix du logo : typographie Archivo (priorité haute)
**Pourquoi** : l'app écrit maintenant comme le logo. Les titres sont en **Archivo 600** droit, et le **mot qui compte** en **Archivo 900 italique** : maïs sur fond sombre, vert surligné de maïs sur fond clair, comme « marché **de Gros** ». Le site utilise encore Cormorant Garamond (`--font-heading` dans `css/styles.css` et `css/typo.css`). Certaines fenêtres partagées (Mon compte, Négociations) passent déjà en Archivo, d'autres non : le site est donc mélangé tant que ce point n'est pas fait.
**Modèle** :
- `css/mgci-tokens.css` : `--f-titre`, `--voix-accent`, `--voix-surligne`, et les classes `.voix` (+ `em`), `.voix-plein` et `.chiffre` ;
- polices : `fonts/archivo-latin-{600-normal,800-normal,900-italic}.woff2`, déclarées dans `css/fonts.css`.

**Étapes**
1. Remplacer `--font-heading` par `'Archivo','Helvetica Neue',Arial,sans-serif`, avec une graisse de titre à 600. Réduire les tailles d'environ 18 % : Archivo est plus large que Cormorant.
2. Dans chaque titre, mettre le mot qui compte dans un `<em>`, stylé en 900 italique (accent maïs ou vert surligné de maïs selon le fond). Un seul accent par titre.
3. Noms de produits en vedette : 900 italique entier, comme « Tomate » dans l'app. Prix et compteurs : Archivo 800, chiffres alignés.

**Vérifier** : aucun titre en police à empattements ; les contrastes passent (maïs sur vert 8:1, vert sur maïs 7:1).

### 2.6 Couleurs du logo partout (priorité moyenne)
**Pourquoi** : l'app est passée aux couleurs du logo (boutons verts, crème, maïs ; plus de terracotta). Le site garde des restes de l'ancienne palette.
**Modèle** : `css/mgci-tokens.css` : `--logo-vert #10392B`, `--logo-mais #F2C230`, `--logo-creme #F3EFE4`, `--action` / `--action-t`. Bouton sur fond sombre : crème + texte vert ; bouton sur fond clair : vert + texte crème.
**Où** : `css/styles.css`, `v3/*.css`, `<meta name="theme-color" content="#171512">` dans `index-v3.html` (passer à `#10392B`).
**Vérifier** : chercher `#E2735B|#A0492A|#C2410C|terracotta` dans les fichiers du site ; contraste des boutons ≥ 4,5:1.

### 2.7 Accès administrateur depuis le site (priorité moyenne)
**Pourquoi** : dans l'app, l'admin a une entrée « Tableau de bord » dans le menu, avec un compteur de dossiers d'identité à examiner. Le site **n'a aucun lien** vers `admin.html`.
**Modèle** : `application.dc.html` → `identAdm()`, `identN()`, entrée de menu « Tableau de bord » (cherchez `admin.html#identites`) ; `v3/compte.js` montre déjà l'entrée dans Mon compte (partagé, donc déjà visible sur le site via Mon compte).
**Étapes** : dans l'en-tête du site (`v3/ivt-header.js`), si admin, un lien « Tableau de bord » vers `admin.html`, avec le nombre de dossiers d'identité à examiner : RPC `admin_identite_compte`, mis en cache 60 s dans `localStorage['mdg-admin:identites']`.

### 2.8 Pages refaites dans l'app (priorité basse, gros chantier)
Le site a ses propres versions. L'app a des designs plus récents, à reprendre si l'on veut l'harmonie :
| Page | Modèle dans l'app | Version du site |
|---|---|---|
| Prix du marché (#52) | `application.dc.html`, page `px`, logique de verdict | version plus ancienne dans `v3/marche.js` / `v3/pages.js` |
| L'année du marché (#53) | `css/annee-app.css` + page « année » de l'app | `v3/annee.js`, `v3/annee.css` |
| Catégories, catalogue (#51, #52) | `css/categories-app.css` + page « catégories » de l'app | catalogue dans `index-v3.html` |
| Guide « Comment ça marche » pas à pas (#56, #58) | `v3/guide.js` (accroches `mdg:aller`) | simple section « Comment ça marche » dans `index-v3.html` |
| Alertes par produit (#4) | `v3/alertes.js` | — |
| Région ↔ ville reliées, « Autre localité » (#37) | `app/villes.js` | listes simples dans `v3/vendre.js` |
| Carte vectorielle MapLibre (#9 à #13, #38, #40) | `app/carte-gl.js`, `app/carte-app.js`, `app/geo/ci.json`, `vendor/maplibre/` | `v2/map.js` |
| Étiquettes « quand » colorées selon l'urgence (#41) | méthode `quand(x)` + `.qd` dans `css/mgci-app.css` | — |

---

## 3. Ce qu'il ne faut pas faire
- Ne pas recoder ce que font les modules partagés (§1) : un seul code pour les deux faces.
- Ne pas affaiblir les règles du serveur (liens, compte officiel, identité) pour faire passer un test.
- Ne pas changer l'icône de l'application (iPhone : il faudrait réinstaller). Le sac est la **mascotte**, pas l'icône.
- Ne pas utiliser `drop` dans Supabase depuis l'outil MCP : il attend une confirmation et bloque. Utiliser `create or replace`.

## 4. Où trouver le détail
- Notes de chaque version : `MISE-A-JOUR.md`.
- Règles serveur : `supabase/schema-13` à `schema-22` (commentaires en tête de chaque fichier).
- Philosophie produit (pas de donnée inventée, confiance) : `PHILOSOPHIE.md`.
- Historique des PR : https://github.com/Stan77i/marchedegrosci/pulls?q=is%3Apr+is%3Amerged
