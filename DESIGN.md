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
- Lettres espacées (`letter-spacing` ≥ .1em) seulement pour de très courtes étiquettes en capitales (« STOCK »), jamais pour une phrase.

## 4. Espaces, rayons, ombres

- Espaces `--e-*` sur une grille de 4 px : 4, 8, 12, 16, 20, 24, 32. Marge des écrans : 16 px.
- Rayons : 10 (petits éléments), 14–16 (cartes), 22–24 (fenêtres, panneaux), 999 (pilules, boutons).
- Ombres : `--ombre-1` (cartes), `--ombre-2` (éléments flottants), `--ombre-d` (panneau du bas). Pas de halo coloré.

## 5. Composants (à réutiliser, pas à réinventer)

- **Bouton principal** : pilule vert du logo, texte crème, 48–54 px de haut, pleine largeur dans les fenêtres. Un seul par écran.
- **Bouton secondaire** : pilule claire ou lien texte vert. **Bouton maïs** : réservé à l'action phare d'un écran sombre (« Placer mon prix »).
- **Bouton fermer** : rond de 40–44 px, croix **dessinée en SVG** (jamais le caractère « × »).
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

## 8. Interdits (anti-« design généré »)

- Texte en dégradé, quadrillage « papier millimétré » en fond, liseré coloré sur un seul côté d'une carte, cartes dans des cartes, halos colorés, icône dans un carré arrondi au-dessus de chaque titre.
- Une deuxième police, le violet ou le bleu comme couleur de marque, des emojis à la place d'icônes dans les boutons d'action.
- Le mot « PAYÉ » (aucun paiement n'est branché).
- La tomate en sac : elle est montrée **en carton**.

## 9. Vérifier

- Navigateur (Playwright, iPhone émulé), en clair **et** en sombre, à 390 et 320 px de large.
- Détecteur : `.claude/skills/impeccable/scripts/impeccable detect --json <fichiers modifiés>` (les `<img>` sans `src` des gabarits `{{ … }}` sont de fausses alertes).
