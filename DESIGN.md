# DESIGN.md — Marché de Gros CI

La référence du design de l'application mobile (`application.dc.html`) et du site. À lire avant toute modification visible.
Les valeurs viennent du code (`css/mgci-tokens.css`, `css/sombre.css`, `css/mgci-app.css`), mesurées le 23/10/2026. En cas de doute, le code fait foi, puis ce fichier est corrigé.

## 1. L'esprit

- **Un marché vivrier ivoirien, calme et sûr.** Fond crème chaud, encre presque noire, vert du logo et maïs. Pas de néon, pas de violet « tech », pas de dégradés décoratifs.
- **Mode « Opérer »** (on vient faire quelque chose : publier, comparer, négocier, suivre). La précision et la retenue passent avant l'effet. La marque vit dans les détails : le maïs, la voix du logo, les personnages du marché.
- **Français simple.** Des phrases courtes, des verbes d'action, jamais de jargon.

## 2. Couleurs (jetons)

| Rôle | Jeton | Valeur |
|---|---|---|
| Encre (texte, fond sombre) | `--encre` | `#171512` |
| Fond de page clair | `--papier` / `--ivoire` | `#F2EBDD` / `#F5F0E6` |
| Carte claire | `--carte` | `#FAF4E9` (blanc chaud `#FFFDF8` pour les reçus) |
| Texte secondaire | `--texte-2` / `--texte-3` / `--mute` | `#484236` / `#655C4D` / `#6F6553` |
| Vert du logo (action principale) | `--logo-vert` | `#10392B` |
| Maïs (accent, « de Gros ») | `--logo-mais` | `#F2C230` |
| Offre (vendre) | `--offre` | `#6CC58C` (texte `#31543C`) |
| Demande (acheter) | `--demande` | `#F2C94C` (texte `#765802`) |
| Accord conclu | `--ok` (négociations) | `#1F8A55` — **jamais de bleu** |
| Alerte / erreur | `--alerte` | `#E2735B` ; sous du texte blanc : `#C0442B` |
| « Vous » (votre position) | `--vous` | `#B095F0` (seulement pour vous situer) |
| Compatible (lien offre ↔ demande) | `--compat` | `#6AAEF0` (carte seulement) |

Règles :
- **Une couleur = un sens.** Vert clair = offre, jaune = demande, vert profond = accord, corail = alerte. Ne pas réutiliser ces couleurs pour décorer.
- Texte sur couleur : contraste 4,5:1 minimum (3:1 pour 18 px gras et plus). Blanc sur corail clair est interdit (3,1:1).
- Mode nuit : `css/sombre.css` pour les pages, `app/nuit.js` traduit les fenêtres. Une fenêtre qui a ses propres couleurs sombres s'ajoute à la liste `DEJA` de `app/nuit.js`.

## 3. Typographie

- **Une seule police : Jost** (fichiers dans `fonts/`).
- La « voix » de la marque : le mot clé d'un titre en Jost 900 italique, en maïs sur fond sombre, souligné de maïs sur fond clair (`.voix em`, `<em>`). Une fois par écran, pas plus.
- Échelle (`--t-*`) : 11,5 · 12,5 · 13,5 · 14 · 15 · 16 · 17 px pour l'interface ; titres de 18 à 32 px. **Rien en dessous de 11,5 px.**
- Les chiffres (prix, quantités) en `font-variant-numeric: tabular-nums lining-nums`.
- Les unités prennent le pluriel à partir de 2 : « 40 cartons », « 2 tonnes », « 60 kg ». Le prix reste au singulier : « 9 000 F / carton ». Utiliser `MDGApp.unites(q, u)`.
- Lettres espacées (`letter-spacing` ≥ .1em) seulement pour de très courtes étiquettes en capitales (« STOCK »), jamais pour une phrase.

## 4. Espaces, rayons, ombres

- Espaces `--e-*` sur une grille de 4 px : 4, 8, 12, 16, 20, 24, 32. Marge des écrans : 16 px.
- Rayons : 10 (petits éléments), 14–16 (cartes), 22–24 (fenêtres, panneaux), 999 (pilules, boutons).
- Ombres : `--ombre-1` (cartes), `--ombre-2` (éléments flottants), `--ombre-d` (panneau du bas). Pas de halo coloré.

## 5. Composants (à réutiliser, pas à réinventer)

- **Bouton principal** : pilule vert du logo, texte crème, 48–54 px de haut, pleine largeur dans les fenêtres. Un seul par écran.
- **Bouton secondaire** : pilule claire ou lien texte vert. **Bouton maïs** : réservé à l'action phare d'un écran sombre (« Placer mon prix »).
- **Bouton fermer** : rond de 40–44 px, croix **dessinée en SVG** (jamais le caractère « × »).
- **Bouton retour** : chevron de 22 px dans une zone de 44 px, couleur du texte de la page (`color: inherit`), jamais blanc sur fond clair.
- **Étiquette « quand »** (`.qd`) : un tampon penché, en capitales, couleur selon l'urgence. C'est un choix du propriétaire (21/10/2026) : le garder.
- **Pastille de filtre** : 40 px de haut, forme du marqueur de la carte (rond = offre, carré = demande), nombre dans une petite bulle.
- **Ligne d'activité** : icône carrée arrondie à gauche, titre gras, sous-titre, chevron. Une démarche = une ligne (un accord et sa commande ne s'affichent pas deux fois).
- **Reçu** (accord, commande) : fond blanc chaud, lignes libellé / valeur, total en grand en vert du logo.
- **Ligne d'alerte discrète** (ex. vérification d'identité) : une seule ligne qu'on touche, pas un gros encadré.
- **Avatars** : les personnages du marché (`v3/personnages.js`). Calmes au repos, ils sautent seulement quand il y a du nouveau.

## 6. Mouvement

- Durées : 160 / 280 / 420 ms, courbe `--courbe` (`cubic-bezier(.22,1,.36,1)`).
- Le mouvement **dit quelque chose** (arrivée, nouveauté, confirmation). Rien ne bouge en boucle sans raison.
- `prefers-reduced-motion` : on garde le changement d'état, on enlève le déplacement.

## 7. Mise en page des écrans à carte

- En haut : retour, titre, **une seule rangée** de choix (quoi, où), sans défilement de côté.
- Les filtres et la liste vivent dans le **panneau du bas**, visible même replié.
- Les boutons de la carte forment **une colonne à droite** ; le zoom est en bas de la colonne.
- Pas d'information technique permanente (« en ligne ») : seulement quand quelque chose ne va pas (« hors connexion »).
- **Hors connexion** (choix du propriétaire, 23/10/2026) : un bandeau rouge `#C0442B` en haut de l'écran, partout, « Pas de connexion · Réessayer » (`app/sac.js`) ; au retour, « De retour » en vert profond, puis il remonte. Dans l'écran, une carte calme avec le sac qui dort (« … dort un peu, il se met à jour tout seul dès que le réseau revient »), jamais une deuxième alerte rouge.

## 8. Les lois anti-« design généré par IA » et anti-amateur

Sources : le socle d'`impeccable` (`.claude/skills/impeccable/reference/craft-floor.md` et son détecteur), les 21 signes recensés par Paralect (paralect.com/blog/signs-of-ai-slop-in-design), les 16 signes mesurés par Adrian Krebs sur 1 590 sites (adriankrebs.ch/blog/design-slop), les règles UX d'`ui-ux-pro-max`. À relire avant chaque travail de design ; une case cochée doit l'être sur l'écran rendu, pas dans l'intention.

**Couleur et matière**
1. Pas de dégradé violet ou bleu, pas de violet « tech » comme couleur de marque (notre violet `--vous` ne sert qu'à « votre position »).
2. Pas de texte en dégradé. On souligne par la graisse ou la taille.
3. Pas de halo coloré (ombre sans décalage), pas de néon, pas de quadrillage en fond (un quadrillage n'a sa place que sur une carte).
4. Pas de verre dépoli décoratif. Le flou seulement pour un élément posé sur du contenu (boutons de la carte, menus).
5. Pas de gris clair sur fond clair : texte ≥ 4,5:1, gros texte ≥ 3:1. Sur fond coloré, le texte secondaire prend une teinte de ce fond, pas du gris.
6. Pas de bordure colorée sur un seul côté d'une carte (« liseré latéral »). Réservé à un vrai statut, et jamais à plus de 1 px.

**Mise en page**
7. Pas de cartes dans des cartes, pas de bordure autour de chaque bloc : on groupe d'abord par l'espace et les titres.
8. Pas de sur-titre en petites capitales au-dessus d'un titre (« eyebrow »). Le titre parle seul.
9. Pas de numéros d'étape (« ÉTAPE 1 », « 01 ») quand ce n'est pas une vraie suite à faire dans l'ordre.
10. Pas de rangée de gros chiffres décorative (« hero-metric ») ni de chiffres qui répètent ce qui est déjà écrit à côté.
11. Pas de grille de cartes identiques « icône + titre + texte » comme structure d'écran.
12. Pas d'écran surchargé : pour chaque élément, se demander ce que la personne en fait. Rien → on retire.
13. Pas le même rayon et la même ombre sur tout : un bouton, une carte et un champ ne se ressemblent pas.
14. Pas de modale pour une tâche qui n'a besoin ni d'interrompre ni de protéger.

**Typographie et texte**
15. Une seule police (Jost). Pas de police « système » ni de monospace en costume « technique ».
16. Pas de capitales espacées pour des titres ou des phrases ; seulement de très courtes étiquettes.
17. Le mot mis en valeur (la voix du logo) : une fois par écran au plus, et sur le mot qui compte.
18. Les nombres en chiffres (« 3 signalements », pas « trois »). Unités au pluriel à partir de 2.
19. Des titres courts qui commencent par ce que la personne fait ; les boutons nomment leur action ; les erreurs disent le problème et la solution.
20. Pas de tiret cadratin (—) pour couper une phrase ou séparer deux informations : « · » entre deux informations, « : » pour expliquer. Le « — » seul reste permis pour une valeur vide (case d'un tableau) : c'est la signature d'un texte généré. Préférer « : », « , » ou deux phrases.

**Icônes, images, preuves**
21. Pas d'emoji à la place d'une icône dans l'interface (boutons, listes, onglets). Les icônes sont dessinées (`app/icones.js`), d'un seul trait. Offre et demande ont leurs symboles dessinés (`css/symboles.css`) : un **panier de produits** (offre) et un **caddie** (demande), via `var(--sym-o)` et `var(--sym-d)` ; le caddie a un trait crème de nuit.
22. Pas de pastilles « NOUVEAU », de points colorés ou de « EN DIRECT » qui ne changent rien à ce que la personne fait.
23. Pas d'image de remplacement laissée en place, pas de dessin « métaphore » expliqué par une étiquette : montrer le vrai produit.
24. Aucune preuve invérifiable : pas de faux avis, de faux chiffres, de faux logos (règle du projet : rien d'inventé).

**Mouvement**
25. Rien ne bouge en boucle sans raison : pas de point qui clignote, de reflet qui balaie, de bouton qui rebondit en permanence. On anime ce qui change, une fois, en moins de 300 ms à peu près.
26. Pas d'apparition animée sur chaque bloc au défilement. Le contenu est là tout de suite.
27. `prefers-reduced-motion` respecté : l'état change, le déplacement disparaît.

**Finitions qui trahissent l'amateur**
28. Les surfaces du navigateur sont à nos couleurs : sélection de texte (maïs), curseur de saisie, cases et curseurs (`accent-color`), anneau de focus.
29. Chiffres alignés (`tabular-nums`) dans les prix et les quantités.
29 bis. Un nombre à côté d'un libellé (« Offres 6 », « Tout 8 », « Préparer la sélection 3 ») est **toujours dans une pastille** (`.nbul`) : neutre, vert pour les offres (`.o`), maïs pour les demandes (`.d`), maïs quand le bouton est choisi. Jamais un chiffre nu ni entre parenthèses.
30. Tous les états existent : vide, chargement, erreur, hors connexion, désactivé.
31. Cibles tactiles de 44 px au moins ; rien ne déborde sur le côté à 320 px de large.
32. Le mot « PAYÉ » est interdit (aucun paiement n'est branché) ; la tomate est montrée en carton.

## 9. Vérifier

- Navigateur (Playwright, iPhone émulé), en clair **et** en sombre, à 390 et 320 px de large.
- Détecteur : `.claude/skills/impeccable/scripts/impeccable detect --json <fichiers modifiés>` (les `<img>` sans `src` des gabarits `{{ … }}` sont de fausses alertes).
