# Rapport — refonte de l'application mobile (17 octobre 2026)

Audit détaillé : `docs/AUDIT-REFONTE.md`. Trois pull requests, à fusionner dans l'ordre : Refonte 1 → Refonte 2 → Refonte 3.

## A. Audit
Site statique sans build ni tests ; application = modèle `{{ }}` + classe `Component` interprétés par `support.js` (React 18 local). Identité forte et déjà cohérente (nuit, ivoire, terracotta, Cormorant + Jost, sacs de jute, rond vert / carré jaune). Défauts constatés : aucun système de design (54 couleurs écrites 510 fois, 24 tailles de texte), textes discrets trop pâles (3,6:1), cartes d'annonce trop hautes (trois boutons empilés, quantité noyée), textes d'aide faux (WhatsApp, appel), écran d'ouverture fixe de 2,2 s, carte sans lien avec la liste et sans mention de l'approximation des positions, recherche limitée à quelques villes, ≈ 290 Ko d'images chargées pour rien au démarrage.

## B. Modifications
| Fichier | Rôle |
|---|---|
| `css/mgci-tokens.css` (nouveau) | Variables : couleurs, texte, espaces, rayons, ombres, mouvement, profondeurs, cible tactile |
| `css/mgci-app.css` (nouveau) | Composant carte d'annonce `.an` |
| `application.dc.html` | Styles sur variables ; carte d'annonce commune ; textes d'aide ; ouverture ; images à la demande ; carte reliée à la liste ; mention des positions ; cibles tactiles ; bouton d'aide non écrasé |
| `app/carte-app.js` | Mention « Points au chef-lieu du district », marge latérale |
| `v2/search.js` | Toutes les villes des districts reconnues |
| `support.js` | Relecture du modèle servie par le cache (retouche d'une ligne, commentée) |
| `sw.js` | Réponse depuis le cache pour cette relecture ; nouveaux fichiers ; `mgci-v54` |
| `docs/AUDIT-REFONTE.md`, `docs/RAPPORT-REFONTE.md` | Audit et rapport |

## C. Résultats visibles
- Annonces : quantité et prix (prix demandé, budget ou « À discuter », jamais confondus) en gros chiffres ; disponibilité, prix négociable ou ferme, intermédiaire, agent en étiquettes ; une rangée d'actions. Une demande ouvre le profil de l'acheteur.
- Lisibilité : textes discrets 3,6 → 4,8:1, vert 3,5 → 5,1:1, rouille 3,8 → 5,1:1.
- Aide : « Vous échangez ici » au lieu de « WhatsApp ou appel ».
- Ouverture : dès que l'application est prête (au moins 650 ms).
- Carte : bouton 📍 sur chaque ligne de la liste (centre le district, filtre la liste) ; « chef-lieu du district » écrit dans le panneau et sur la carte ; « Près de vous d'abord » trie par tranches de distance puis par quantité (la distance n'est pas le seul critère).
- Recherche : « igname à Bondoukou », « tomate San Pedro », « oignon Grand-Bassam » trouvent le lieu.
- Petits écrans : rien ne déborde à 320 px ; bouton de la page d'aide qui était écrasé à 31 px (au lieu de 56) sur un écran de 667 px de haut, corrigé ; légende de la carte et points de familles agrandis.

## D. Architecture
- Les styles en ligne restent (c'est le format du moteur), mais lisent des variables : un seul endroit pour changer une couleur. Les couleurs du Canvas et des attributs SVG restent dans le code (les variables CSS n'y entrent pas).
- Un seul composant de carte d'annonce, en classes CSS, au lieu de deux copies de styles en ligne.
- **WebGL : non ajouté.** L'application ne sert que les téléphones (les ordinateurs et tablettes vont au site) ; la carte Canvas 2D est légère et suffit. Règle suivie : repli HTML/CSS sur téléphone.

## E. Performance (connexion lente simulée : latence 150 ms, 1,6 Mb/s, processeur ×4)
- Données transférées au démarrage : **1 357 → 1 078 Ko** (−21 %).
- Une requête réseau en moins par ouverture (relecture du modèle par le cache).
- Temps jusqu'à l'accueil : ≈ 5,7 s avant comme après : il dépend du chargement et de l'exécution des scripts. Piste : charger compte, négociation et messages après l'affichage (non fait : touche à l'ordre de chargement du moteur).

## F. Tests exécutés
- `node --check` sur chaque fichier JS modifié : OK.
- Playwright / Chromium, 320 × 568, 375 × 667, 390 × 844, 430 × 932 : 11 écrans, aucune erreur console, aucun débordement horizontal.
- Comparaison avant/après en images des 11 écrans à 390 px.
- Recherche : 13 requêtes (alias, fautes, unités, lieux).
- Carte : sélection depuis la liste, filtre, panneau.
- Mouvement réduit (`prefers-reduced-motion`) : accueil, carte, Acheter sans erreur.
- **Non faits** : vrais téléphones (iPhone, Android) ; données réelles (Supabase injoignable depuis le navigateur de test, données d'essai utilisées) ; lecteur d'écran ; il n'existe ni lint, ni tests, ni build dans le dépôt.

## G. Points restants
- Temps de démarrage (scripts).
- Les autres listes (vendeur, feuille rapide, « Demander ») gardent leur présentation propre ; à aligner sur `.an` si besoin.
- Le site (`index-v3.html`) : reprendre les variables et les changements de l'application.

## H. Déploiement
Fusionner les pull requests dans l'ordre sur `main` : GitHub Pages publie, et les téléphones prennent la nouvelle version au prochain chargement (service worker `mgci-v54`).
