# Journal des mises à jour

À chaque mise à jour : remplacer les fichiers du dépôt par ceux de ce dossier, supprimer ceux listés « Supprimés », puis `git add -A && git commit && git push`.

## 2026-10-04 (11) — Refonte, lot 5 : le terrain

- En tête d'Acheter, Vendre et Demander : la Côte d'Ivoire en points, très calme (SVG, même contour que la carte). Acheter : un point par producteur des offres affichées, le cadrage suit les filtres, avec l'équivalent texte (« 4 offres, surtout autour de Bouaké et Daloa »). Vendre : l'étal se place sur la ville ou la région saisie. Demander : l'anneau du lieu de livraison et les producteurs compatibles.
- Aucun mouvement permanent : le cadrage ne glisse que quand les données changent (instantané si mouvement réduit).

Ajouté : v2/terrain.js
Modifié : index.html

## 2026-10-04 (10) — Refonte, lot 4 : Vendre

- Vendre en trois étapes visibles (Le produit → Le prix et le lieu → Le contact), une à la fois ; l'aperçu en direct de la carte d'offre (repliable sur mobile) montre ce que l'acheteur verra.
- Mode « Je publie pour un producteur » séparé, en tête du formulaire.
- Brouillon enregistré automatiquement sur le téléphone et repris au retour ; confirmation honnête (offre gardée sur ce téléphone).

Modifié : index.html

## 2026-10-04 (9) — Refonte, lot 3 : Acheter et Catégories

- Acheter : une ligne d'intention, la recherche en tête, nouveaux filtres quantité minimale et prix maximum (dans l'URL : qmin, pmax). Sur mobile, un bouton « Filtrer (n) » ouvre une feuille qui affiche « Voir N offres » avant de valider. Sans résultat : « Faire une demande » pré-remplie avec le produit, la quantité et la région.
- Catégories : une rangée par famille (image, nom, produits, nombre réel d'offres, repère « En saison » d'après les calendriers sourcés), cible pleine largeur sur mobile ; famille sans offre : calme, avec « Faire une demande ».

Modifié : index.html

## 2026-10-04 (8) — Refonte, lot 2 : Demander

- Demander refait : d'abord ce qui existe (« 3 offres correspondent déjà », lien vers les offres), puis 5 questions (Quoi, Combien, Où — Abidjan par défaut, Quand, Contact ; budget facultatif). Une question à la fois sur mobile, regroupées sur desktop.
- Résumé vivant rédigé comme le producteur le lira ; chaque morceau ramène à sa question. Nombre de producteurs qui pourraient répondre, carte qui s'allume sur eux.
- Confirmation honnête (enregistrée sur ce téléphone) et partage WhatsApp avec le texte déjà rédigé.

Modifié : index.html

## 2026-10-04 (7) — Refonte, lot 1 : moins, mais juste

- Le fil est retiré partout (trait continu de l'accueil, tracés de transition, fil offre → carte, trait avant contact, onde) : il passait sur le contenu sans relier rien de nommable. Restent les fils de la carte (offre ↔ demande).
- Nouveau bouton haut / bas : il suit la direction du scroll, son anneau montre la position dans la page ; survol (desktop) ou appui long (mobile) pour l'autre direction ; caché pendant la saisie et sous une feuille ouverte.
- Couleurs : une seule couleur d'action (ambre) sur les pages claires ; la couleur du produit est ramenée dans une même plage (L 0,68–0,72, C 0,10–0,13) et ne sert plus qu'aux petits repères.
- Mobile : le footer est réduit à une ligne discrète au-dessus de la barre basse.

Supprimé : v2/fil.js
Modifié : index.html

## 2026-10-04 (6) — « L'année » : des informations utiles

- Le slogan « Chaque mois, le marché change de couleur » passe dans une pop-up « ? » avec le mode d'emploi.
- Titre informatif (« Octobre : 6 produits en récolte. » / « Igname : pleine récolte en octobre. »), douze mois sur une ligne avec l'intensité de la saison, phrase des récoltes par intensité et régions (texte passant si trop long), bassin le plus actif avec ses offres, ce que la carte allume, actions directes.

Modifié : index.html, v2/saisons.js

## 2026-10-04 (5) — L'année garde la carte massive

- En mode « L'année », la caméra reste au plus près comme en mode réseau : elle plonge sur le bassin le plus actif du mois (ou sur les producteurs du produit choisi). On ne voit plus le pays entier ni ses bords.

Modifié : index.html, v2/saisons.js

## 2026-10-04 (4) — Une seule carte, un interrupteur

- « Le marché, en réseau » et « L'année du marché » sont réunis dans la même section et sur la même carte. Un interrupteur (Le réseau / L'année) bascule la lecture : offres ↔ demandes du produit, ou ce qui se récolte au mois choisi (cadran, vignettes, sources repliées).
- La section « L'année du marché » séparée (plein écran, voyage au scroll) est retirée : le bas de l'accueil est libéré. Le footer retrouve sa jointure d'origine.

Modifié : index.html, v2/saisons.js, v2/fil.js

## 2026-10-04 (3) — Correctif en-tête

- L'indicateur de page active de l'en-tête restait sur « Accueil » après un clic sur Acheter pendant la transition de page : l'en-tête est sorti de la transition et l'indicateur est replacé avant et après.

Modifié : index.html

## 2026-10-04 (2) — Carte immersive et langage du fil

- « L'année du marché » : la carte du réseau (même module) en plein écran, voyage guidé par le scroll (vue d'ensemble → bassin du mois → rencontre offre ↔ demande → second bassin → retour), calculé depuis les données du mois. Rail d'étapes, « Passer », « Explorer la carte » (plein écran interactif, Échap pour sortir).
- Moins de texte : légende, phrase de comptage, liste et paragraphe de sources retirés ; vignettes produits sur une ligne, panneau « Sources » replié (régions incluses), cadran posé en instrument de bord, frise du pouce sur mobile.
- Jour → nuit sans bande : le panneau clair glisse vers la nuit avec le scroll ; la carte et le footer partagent la même couleur (plus de bord arrondi ni de marge sur l'accueil).
- Nouveau module v2/fil.js (possible / circule / fait / onde) : fil de l'accueil (étal → Trois chemins → carte → footer), point coloré sur chaque offre, fil vers la carte au survol, trait tracé avant le contact, tracé à l'enregistrement d'une offre, onde à l'envoi d'une demande, étapes du formulaire en fil, Retour qui se rembobine, transitions de page (View Transitions, repli en fondu).

Ajouté : v2/fil.js
Modifié : index.html, v2/saisons.js
Supprimé : —

## 2026-10-04 — « L'année du marché » remplace « Comment ça marche » (accueil)

- La section « Comment ça marche / De la terre à votre téléphone » (redite de « Trois chemins ») est supprimée de l'accueil, avec son code (scène 3 de v2/reseau.js, styles .how*).
- Nouvelle section « L'année du marché » : cadran des mois (frise sur mobile), liste « En ce moment » par intensité, fiche région, résumé lu par les lecteurs d'écran.
- Même carte que « Le réseau » (v2/reseau-carte.js, seconde instance, aucun nouveau rendu) : s'allument les producteurs du site qui proposent un produit de saison.
- Calendrier sourcé (FAO GIEWS, FEWS NET, marché de gros de Bouaké, Inter-Mangue/AIP, Conseil café-cacao, Conseil coton-anacarde) ; entrée sans source = jamais affichée.

Ajouté : v2/saisons.js
Modifié : index.html, v2/reseau.js
Supprimé : —

## 2026-10-03 — La lumière du produit sur tout le site (lot 1/5)

- Le produit choisi (hero, recherche, fiche, Demander, lien `?p=`) éclaire tout le site, gardé pendant la session. Lumière par défaut : la terracotta du logo.
- Quatre niveaux : immersion (sections sombres), accent (boutons d'action, liens, focus), reflet (crème et ombres teintées à 4–6 %), neutre (texte, logo, mentions : inchangés). Encre d'accent recalculée pour garder 4.8:1 sur le crème.
- Choisir une famille donne une lumière de famille, plus discrète.
- En-tête : pastille « Sous la lumière de… » avec « éteindre ».
- Retour : cercle de 36 px, s'étire au survol et nomme sa destination (« Acheter », « Aubergine »…) ; lien direct → parent logique ; Alt+← et Échap.
- Voir plus : lien compact qui annonce le nombre réel (« 24 produits de plus, sur 134 »), puis « C'est tout pour l'instant » + lien vers Demander.

Fichiers
- Modifié : `index.html`

## 2026-10-03 — Familles : photos à la place des scènes WebGL

- Les 11 cartes de familles (accueil et page Familles) affichent une photo carrée plein cadre, avec le nom et le nombre de produits sur un voile en bas.
- Scènes animées WebGL des familles supprimées : page plus légère, rien ne se charge en plus.

Fichiers
- Ajoutés : `v2/img/famille-*.webp` (11 images, 720 × 720)
- Modifié : `index.html`
- Supprimés : `v2/familles.js`, `v2/familles-scenes.js`, `v2/familles-scenes2.js`

## 2026-10-03 — Carte « Le réseau » : offre ↔ demande, sans destination imposée

Alignement sur la philosophie du site : un réseau qui met en relation l'offre et la demande partout en Côte d'Ivoire, pas un flux dirigé vers Abidjan.

- Carte : plus de point central. Point plein = offre (taille = volume), cercle = demande, fil = mise en relation possible entre une offre et une demande du même produit, d'une ville à l'autre.
- Accueil : la section « Le trajet » devient « Le marché, en réseau » (offres, demandes, volumes, rencontre la plus proche, bouton « Publier une demande »).
- Carte plein écran : liste « Qui en cherche » sous les offres ; fiche vendeur = demandes pour ses produits (plus de « km jusqu'à Abidjan, marché principal ») ; toucher une demande affiche les offres du produit.
- Page Demande : la demande publiée se relie aux offres du produit.
- Demandes d'exemple (restaurants, hôtels, commerçants, transformateurs…) dans 10 villes ; les demandes publiées sur le téléphone apparaissent aussi sur la carte.

Fichiers
- Ajoutés : `v2/reseau-carte.js`, `v2/demandes.js`
- Modifié : `index.html`
- Supprimé : `v2/trajet.js` (remplacé par `v2/reseau-carte.js`)

## 2026-10-03 — Carte « Le trajet » (remplace la carte 3D)

Inspirée de la scène « Le trajet » du dépôt ivt-boutique, adaptée aux couleurs du marché (fond cacao, routes à la couleur du produit).

- Accueil : nouvelle section « Le trajet » sous l'étal. Le produit choisi allume ses routes producteurs → Abidjan, avec le prix de départ, le nombre d'offres et la distance.
- Carte plein écran (#/carte), encarts des fiches et page Demande : la carte en points remplace le territoire 3D. Recherche, zones, « Autour de moi » et sélection inchangées.
- Plus de Three.js ni de fond de carte téléchargé pour la carte : plus léger, fonctionne sans WebGL.

Fichiers
- Ajouté : `v2/trajet.js`
- Modifié : `index.html`
- Supprimé : `v2/territoire.js`
