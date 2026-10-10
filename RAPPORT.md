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
