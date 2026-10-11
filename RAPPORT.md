# Rapport — Application mobile Marché de Gros
10 octobre 2026 · fichier principal : `application.dc.html`

## 1. Problèmes signalés et corrections

| # | Problème signalé | Cause trouvée | Correction | État |
|---|---|---|---|---|
| 1 | Le changement de page se bloque à mi-chemin (L'année du marché, Catégories → fiche, etc.) | Les pages n'avaient pas d'ordre d'empilement : une page placée plus bas dans le code restait peinte par-dessus la page qui venait d'arriver. | Ordre d'empilement donné par l'historique de navigation ; la page qui part passe au-dessus pendant son retour ; glissements en Web Animations, annulés au bout de 650 ms au plus ; pages hors historique masquées. | Corrigé, testé dans l'aperçu (Catégories → Maïs grain → retour ; Année → Igname → retour ; bouton et historique) |
| 2 | L'app « se tire », zoome, glisse | Champs en moins de 16 px (iOS zoome au toucher) ; page non verrouillée ; clavier qui pousse la page | Page verrouillée (sans rebond ni zoom), champs à 16 px, l'app se réduit à la zone visible quand le clavier s'ouvre, plus d'ouverture automatique du clavier | Corrigé, **à confirmer sur iPhone** |
| 3 | Écran vide ou saccadé pendant le glissement | Filtre d'assombrissement coûteux sur iPhone ; page sortante démontée trop tôt | Filtre retiré, glissement sur le GPU, la page sortante garde son contenu jusqu'à la fin | Corrigé |
| 4 | J'ai / Je cherche bougent sur l'accueil | Hauteur du nom de produit variable | Zone de nom de hauteur fixe (2 lignes au plus, taille calculée sur la largeur réelle) ; la roue se réduit selon la hauteur de l'écran | Corrigé |
| 5 | Le nom « Gombo séché » chevauche | Même cause que le n° 4 | Même correction | Corrigé |
| 6 | Les noms de la roue orbitale se chevauchent | Espacement fixe quelle que soit la longueur du nom | Chaque nom occupe un angle calculé d'après sa largeur mesurée, plus un écart fixe ; les noms qui sortiraient de l'écran s'effacent. Le texte garde sa taille. | Corrigé |
| 8 | Débordements (Acheter « Prix max. »…), page qui glisse de côté au toucher d'un champ | Grilles à colonnes `1fr` qui ne rétrécissent pas sous la largeur d'un champ ; iOS fait alors défiler la page de côté | 10 grilles en `minmax(0,1fr)`, champs limités à leur colonne, zones qui défilent verrouillées à l'horizontale, pages en `overflow:clip`, décalage remis à zéro | Corrigé, audit sur toutes les pages sans débordement |
| 7 | Carte trop simple | — | Nouvelle carte, voir section 2 | Livré |

## 2. Nouvelle carte (`app/carte-app.js`)
- Frontières réelles Natural Earth 1:50 000 000, pays voisins, socle en relief ; sans connexion, retour à l'ancien contour simplifié.
- Glisser, pincer, double-toucher, molette, défilement qui continue un peu en lâchant.
- La caméra recule puis zoome vers la ville touchée ou vers votre région.
- Noms des villes sans chevauchement (par ordre de priorité).
- Cercles 50 / 100 / 200 km autour de vous, distance à vol d'oiseau vers la ville touchée, échelle qui suit le zoom.
- Bouton « Me localiser » : choisit la région la plus proche de votre position.

## 3. Logo « M »
Pastille terracotta dans l'en-tête de l'accueil :
- un point orange fait le tour de la pastille en suivant la roue des produits ;
- l'anneau prend la couleur du produit choisi, et une onde part à chaque changement de produit ;
- l'anneau se dessine à l'ouverture de l'app.

## 4. Fichiers modifiés
- `application.dc.html` : navigation, empilement des pages, accueil, roue, logo, carte, clavier.
- `app/carte-app.js` : **nouveau**, la carte.
- `app/marche-app.js` : exporte le contour simplifié (`A.OUT`) pour le mode hors ligne.
- `MISE-A-JOUR.md` : journal détaillé de chaque passe.

## 5. Points ouverts
- **Tout reste à tester sur un vrai iPhone** : le clavier dans Acheter et dans J'ai / Je cherche, le pincement sur la carte, le geste de retour par le bord de l'écran (il peut encore lancer deux glissements à la suite).
- Toucher une ville sur la carte n'a pas pu être vérifié dans l'aperçu : à essayer au doigt.
- Le menu « Où êtes-vous ? » peut afficher « Où êtes-vous ? » alors que la région est enregistrée : non confirmé.
- La fiche « Maïs grain » affiche une photo de riz : erreur dans les données des images, antérieure à ces corrections, non touchée.
- Sauvegarde GitHub : pas d'envoi direct possible depuis ici ; le dossier est à déposer à la main sur le dépôt `Stan77i/marchedegrosci`, branche `main`.

---

# Rapport — Utilisation hors connexion (PWA)
11 octobre 2026

## Ce qui change pour l'usager
- Le site s'ouvre **sans connexion** sur téléphone, tablette et ordinateur, une fois visité au moins une fois avec internet.
- Il peut être **ajouté à l'écran d'accueil** et s'ouvre alors en plein écran, comme une application (icône « M » sur fond terre).
- Les offres et demandes publiées restent dans le téléphone (`localStorage`, clés `mdg-v2:offres` et `mdg-v2:demandes`, inchangées). Rien n'est envoyé à un serveur.
- **Téléphone → application, ordinateur et tablette → site web** (`index-v3.html`, restauré le 11/10/2026 après sa suppression par erreur). Règle : écran tactile dont le petit côté fait moins de 768 px = téléphone (un téléphone tourné à l'horizontale reste dans l'application). L'aiguillage est fait par `index.html`, et aussi au début de `application.dc.html` et de `index-v3.html` : ouvrir directement l'adresse de l'application sur un ordinateur affiche le site. `?ordinateur=1` force le site, `?app=1` force l'application.
- Le site web fonctionne aussi hors connexion (GSAP, Lenis, d3, React, Babel et polices dans `vendor/` et `fonts/`).

## Fichiers
| Fichier | Rôle |
|---|---|
| `vendor/` | React 18.3.1, ReactDOM 18.3.1, Babel 7.29.0, topojson-client 3.1.0, world-atlas 2.0.2 (110m, 50m), hébergés dans le projet |
| `fonts/`, `css/fonts.css` | Polices Cormorant Garamond et Jost hébergées dans le projet |
| `icons/` | Icônes 192, 512 et iPhone (180) |
| `manifest.webmanifest` | Nom, couleurs, icônes, plein écran, portrait |
| `sw.js` | Service worker : met l'application en cache, pages réseau d'abord, fichiers cache d'abord |
| `support.js` | ⚠️ 3 adresses changées (unpkg → `vendor/`). Fichier généré par l'outil de conception : à refaire s'il est régénéré |
| `application.dc.html` | Balises manifest / iPhone / service worker ; polices locales ; `<img sc-camel-src="{{ … }}">` au lieu de `src` (plus de 404 au démarrage) |
| `app/carte-app.js` | Frontières et topojson chargés depuis `vendor/` |

## À chaque mise à jour du code
Changer le numéro dans `sw.js` : `const CACHE = 'mgci-v6';` → `'mgci-v7'`, etc. Sinon les appareils gardent l'ancienne version.

## Vérifications faites (Chromium)
Téléphone, tablette, ordinateur : première visite en ligne, puis réseau coupé → accueil et carte affichés, 28 images sur 28, polices chargées, publications conservées, 0 erreur dans la console, aucune requête vers internet. Changement de version du cache → nouvelle version prise en compte.

## Points ouverts
- À tester sur un vrai iPhone (Safari) et un vrai Android (Chrome) : ajout à l'écran d'accueil, ouverture hors ligne.
- Le site doit être servi en **HTTPS** (par exemple GitHub Pages) : sans HTTPS, pas de mode hors ligne ni d'installation.
- 7 avertissements (pas des erreurs) `never resolved` restent dans la console : ils viennent de l'écran d'ouverture de la page, non modifié.

---

# Carte du site (« Le réseau ») — territoire réel
11 octobre 2026 · `v2/reseau-carte.js`

- **Géographie réelle** : frontières Natural Earth 1:50m (Côte d'Ivoire, Libéria, Guinée, Mali, Burkina Faso, Ghana et pays proches), côte avec liseré d'eau peu profonde, frontière terrestre en tirets, côte en trait plein. Repli sur l'ancien contour simplifié si la géographie ne charge pas.
- **Eau** : fleuves (Bandama, Comoé, Sassandra, Bandama blanc, Baoulé, Bagoé, Cess, Volta…) et lacs (Kossou, Buyo, Volta), Natural Earth 1:10m, domaine public, fichier `vendor/ci-hydro.json` (56 Ko). Le grain s'interrompt sur les lacs.
- **Repères** : les 14 chefs-lieux de district (géographie de référence déjà présente, `v3/marche.js`). Le nom du chef-lieu s'efface quand une offre ou une demande du district est déjà nommée.
- **Zoom qui a un sens** : du pays (avec ses voisins) jusqu'au district, pas au-delà (les positions sont au chef-lieu : plus près ne montrerait rien de vrai). Un repère dit toujours ce que l'on regarde : « Tout le pays », « Nord-ouest du pays », puis « Autour de Bouaké » ou « 40 km au sud-ouest de Bouaké », avec l'échelle en kilomètres. Le grain s'affine en approchant.
- **Gestes** : la carte continue sur son élan quand on la lâche, double-clic pour zoomer à l'endroit pointé ; animations coupées avec « réduire les animations ».
- Non utilisées volontairement : les limites administratives Natural Earth (19 anciennes régions, pas les 14 districts actuels : elles auraient été fausses) ; la bibliothèque mapcn (React + tuiles en ligne : incompatible avec le site statique et le hors connexion).
- `sw.js` : `vendor/ci-hydro.json` en cache, `CACHE = 'mgci-v7'`.

---

# Passe sur tout le produit — 11 octobre 2026 (suite)
- **Lecture au défilement** (`v3/flou.js`) : une section ne se floute plus pendant qu'on la lit ; l'effet de profondeur ne joue que quand elle quitte l'écran. Les listes du catalogue et les offres d'une fiche restent nettes.
- **Petites cartes sur le vrai territoire** (`v3/terre.js`, nouveau) : la mini-carte du catalogue et celle de « Demander » dessinent le contour réel, les voisins et les lacs ; le grain ne tombe que sur la terre. Même géographie que la grande carte.
- **Langage commun** : la légende des encarts (fiche produit, producteur) reprend les marqueurs (cercle vert = offre, carré jaune = demande, trait bleu = compatibles, votre lieu) ; « Le carré jaune marque votre demande ».
- **Mes offres / Mes demandes** : plus de « 800 kg · , » ni de « le Invalid Date » — le produit, le lieu et la date sont retrouvés même pour une offre publiée depuis l'application (même stockage, autres champs).
- **Prix du marché** (`v3/pages.js`) : d'abord « Ce qui a un prix aujourd'hui » (prix observés, puis prix vendeurs), avec pour chacun ce qui manque pour un prix du marché (« Encore 3 prix et 1 vendeur », jauges sur les seuils réels 5 prix / 3 vendeurs / 30 jours) ; puis « Pas encore de prix » en étiquettes par famille, chacune menant au produit, et une invitation à publier son prix. Fini le mur de « Pas assez de données ».
- **Carte de l'application** (`app/carte-app.js`) : fleuves et lacs, côte en trait plein et frontière en tirets, repère « où suis-je » au-dessus de l'échelle, zoom borné au district.
- `sw.js` : `v3/terre.js` en cache, `CACHE = 'mgci-v9'`.
- **Accueil** (`v3/hero-ivt.js`) : sous le prix, une petite carte du vrai territoire montre où le produit choisi est proposé (cercles verts) et cherché (carrés jaunes) ; elle mène à la grande carte filtrée sur ce produit. Elle n'apparaît que s'il existe au moins une offre ou une demande.
- **Roue des produits sur tablette** : les noms étaient coupés (« OMAT » pour « TOMATE ») ; leur largeur est maintenant mesurée avec la police réelle, en capitales espacées, et recalculée quand les polices sont chargées. `sw.js` : `CACHE = 'mgci-v10'`.
- **Fiche produit : offres et carte se répondent** : survoler (ou parcourir au clavier) une offre l'allume sur la carte ; survoler un point de la carte met l'offre en avant dans la liste ; toucher un point sélectionne l'offre et la fait venir à l'écran si elle est cachée. (`v2/reseau-carte.js` : rappel `onHover`, sans changer le reste de l'API.) `sw.js` : `CACHE = 'mgci-v11'`.
