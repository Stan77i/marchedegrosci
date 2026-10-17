# Audit — refonte de l'application mobile (17 octobre 2026)

Périmètre : l'application mobile (`application.dc.html` et ses modules). Le site (`index-v3.html`) sera repris ensuite.
Faits observés dans le code et dans le navigateur (Chromium, format iPhone 390 × 844, données d'essai) ; les hypothèses sont signalées.

## 1. Architecture observée
- **Pas de build, pas de framework installé.** Pages HTML statiques servies telles quelles (GitHub Pages).
- `application.dc.html` = un modèle (balises `{{ }}`, `<sc-for>`, `<sc-if>`) + une classe `Component` (≈ 1 200 lignes) interprétés par `support.js` (moteur « dc-runtime » généré, React 18 dans `vendor/`). Pas de JSX à l'exécution : Babel (3 Mo) n'est pas chargé par l'application.
- Navigation : une pile de pages (`state.stack`), adresses `#/…` (`HASH`), glissements animés, geste de retour par le bord.
- Données : publications du téléphone dans `localStorage` (`mdg-v2:*`), annonces de tous via Supabase (`v3/nuage.js`), catalogue et régions dans `v2/data.js`, calendrier et images dans `app/marche-app.js`, villes dans `app/villes.js`, recherche dans `v2/search.js`.
- Modules partagés app + site (fenêtres posées par-dessus) : connexion (`nuage.js`, `porte.js`), compte (`compte.js`), négociation (`negoce.js`), messages (`messages.js`), réputation et profils (`reputation.js`), alertes (`alertes.js`), notifications (`pousse.js`).
- Carte : `app/carte-app.js`, Canvas 2D (pas de WebGL), Natural Earth 1:50m, positions = chef-lieu du district.
- Hors ligne : `sw.js` (réseau d'abord pour le code, cache d'abord pour les images).
- **Aucun test, aucun lint, aucun script** dans le dépôt. Vérification possible : syntaxe (`node --check`) et navigateur automatisé (Playwright).
- WebGL : aucun dans l'application. Le site a ses propres scènes (`v3/scene-ivt.js`, `v3/terre.js`), hors périmètre ici.

## 2. Fonctionnalités vérifiées
Accueil (roue des produits par famille), fiche produit (offres, demandes, prix observé, saison), Acheter (recherche + filtres + Offres/Demandes/Tout), Vendre (3 étapes), Demander, feuille rapide « J'ai / Je cherche », carte du réseau (plein écran, zones « forte demande »), catégories, prix du marché, année du marché, mes publications (stock), vendeur, pages d'aide, menu ; négociation, messages, profils, alertes, connexion.
Recherche testée : « tomat » → Tomate, « aloko » → Banane plantain, « attiéké 2 tonnes » → Attiéké, 2, tonne, « 50 sacs de riz à Bouaké » → riz, 50 sacs, Bouaké. **Limite** : seuls les lieux des producteurs d'exemple sont reconnus (Bouaké, Korhogo…), pas les autres villes.

## 3. À conserver
L'identité (nuit chaude `#171512`, ivoire `#F2EBDD`, terracotta `#E07A3F`, Cormorant Garamond + Jost), la roue de l'accueil, les sacs de jute, les codes rond vert = offre / carré jaune = demande, la carte Canvas (légère, sans dépendance), le moteur de recherche, les parcours et leurs adresses.

## 4. À améliorer (faits)
1. **Pas de système de design** : 54 couleurs distinctes écrites 510 fois, 24 tailles de texte, 21 rayons, 663 styles en ligne.
2. **Cartes d'annonce trop hautes** : trois actions empilées (Écrire, Proposer un prix, Signaler) → environ 2,5 offres par écran dans Acheter et la fiche. Pour du commerce en gros, la quantité et le prix ne ressortent pas (la quantité est noyée dans une ligne grise).
3. **Textes faux** : « Comment ça marche » et « Aide producteur » parlent encore de WhatsApp et d'appel, alors que les échanges restent dans l'application.
4. **Carte** : les points sont au chef-lieu du district, sans le dire. La liste et la carte ne se répondent pas (toucher une annonce de la liste ne la montre pas sur la carte).
5. **Accueil** : l'écran d'ouverture dure toujours 2,2 s, même quand l'application est prête.
6. **Recherche** : lieux limités aux villes des données d'exemple.

## 5. Performance (mesurée)
Connexion lente simulée (latence 150 ms, 1,6 Mb/s, processeur ralenti ×4) :
- accueil utilisable en **5,7 s**, **1 357 Ko** réellement transférés, 34 requêtes ;
- `application.dc.html` demandé **deux fois** : le moteur relit le modèle brut, que le navigateur abîme (listes dans les menus déroulants). La seconde demande revient « déjà à jour » (quelques octets) : elle coûte un aller-retour réseau, pas 210 Ko (première estimation corrigée) ;
- 6 photos de sacs (70–80 Ko chacune) chargées d'un coup sur l'accueil alors qu'une seule est visible ;
- 11 photos de familles (≈ 300 Ko) chargées pour un panneau fermé.

## 6. Risques techniques
- `support.js` est généré par un outil de conception : toute retouche doit rester petite et documentée (déjà le cas pour les chemins `vendor/`).
- Les couleurs écrites dans des attributs SVG ou dans le Canvas ne peuvent pas utiliser des variables CSS : elles restent en dur.
- Les modules partagés servent aussi le site : un changement de style y touche les deux.

## 7. Système de design proposé
Fichier unique `css/mgci-tokens.css` (variables CSS) chargé par l'application, puis par le site :
- couleurs : encre, ivoire, papier, carte, traits, terracotta, rouille, vert offre, jaune demande, bleu compatible, violet « vous », rouge alerte ;
- texte : 10 tailles (de 10,5 à 44 px), deux familles ;
- espaces, rayons, ombres, durées et courbes d'animation, profondeurs.
Les styles en ligne de l'application utilisent ces variables à la place des valeurs écrites en dur.

## 8. Plan
A. Fondations : variables, remplacement des couleurs et tailles en dur, textes faux, écran d'ouverture.
B. Performance : second téléchargement servi par le cache, photos de l'accueil chargées à la demande.
C. Annonces : carte d'annonce compacte et commune (quantité et prix en avant, actions sur une ligne).
D. Carte : liste ↔ carte reliées, position annoncée comme approximative, toutes les villes dans la recherche.
E. WebGL : **non** pour l'application téléphone (la carte Canvas suffit et reste légère ; règle « sur téléphone, repli HTML/CSS »).
F. Écrans 320, 375, 390, 430 px : débordements, cibles tactiles, mouvement réduit.
G. Contrôle final et rapport.

## 9. Vérifications prévues à chaque étape
Syntaxe de chaque fichier JS ; ouverture de chaque écran dans Chromium (4 largeurs) ; aucune erreur console ; aucun débordement horizontal ; parcours Vendre et Demander jusqu'à la publication ; recherche (jeux de requêtes ci-dessus) ; carte (sélection, liste) ; mesure de chargement avant/après.

## 10. Résultats des étapes A et B
- Variables : 347 couleurs et 252 tailles de texte des écrans passent par `css/mgci-tokens.css` ; textes discrets, verts et rouille rendus lisibles (≥ 4,5:1).
- Textes d'aide corrigés (plus de WhatsApp ni d'appel).
- Écran d'ouverture : s'efface dès que l'application est prête (au moins 650 ms), au lieu de 2,2 s fixes.
- Transfert au démarrage : **1 357 Ko → 1 069 Ko** (−21 %) ; la relecture du modèle est servie par le cache (plus d'aller-retour). Le temps jusqu'à l'accueil reste dominé par le chargement et l'exécution des scripts (≈ 5,7 s en connexion lente simulée) : piste suivante, charger les modules de compte, négociation et messages après l'affichage.
