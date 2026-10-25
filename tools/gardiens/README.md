# Les gardiens : mode d'emploi technique

Tous les 3 jours, un script relit le dépôt et cherche les doublons, les textes trop longs, les bugs et les incohérences avec les règles de `CLAUDE.md` et `DESIGN.md`. Le rapport arrive dans une issue GitHub « Rapport des gardiens » (une seule, mise à jour à chaque passage, avec un commentaire pour que la notification parte).

- Script : `tools/gardiens/controle.js` (Node seul, rien à installer).
- Exceptions connues et seuils : `tools/gardiens/exceptions.json`.
- Tâche GitHub : `.github/workflows/gardiens.yml` (le 1er, 4, 7… du mois à 6 h 17, heure d'Abidjan, et à la main depuis l'onglet Actions → « Gardiens » → « Run workflow »).
- Le script ne modifie aucun fichier du dépôt et sort toujours avec le code 0 : un constat ne fait jamais échouer la tâche.

## Lancer à la main

```
node tools/gardiens/controle.js                    # écrit rapport-gardiens.md à la racine
node tools/gardiens/controle.js --sans-navigateur  # sans la partie navigateur
GARDIENS_SORTIE=/tmp/rapport.md node tools/gardiens/controle.js
```

`rapport-gardiens.md` n'est pas à enregistrer dans le dépôt (il est dans `.gitignore`).

## Les niveaux

- **Rouge** : à corriger vite (bug, mot interdit, fichier manquant).
- **Orange** : à regarder ; peut être voulu. Si c'est voulu, l'ajouter aux exceptions.
- **Pour information** : rien à faire, à savoir.
- **Vérifié** : contrôle fait, rien trouvé. **Non vérifié** : contrôle impossible (par exemple pas de navigateur).

## Les contrôles

| Nom (dans exceptions.json) | Ce qu'il vérifie | Niveau |
|---|---|---|
| `syntaxe` | Chaque `.js` de `app/`, `v3/` et `sw.js` passe `node --check` ; chaque `<script>` en ligne de `application.dc.html` et `index-v3.html` se lit. | rouge |
| `cache` | Chaque `fichier?v=…` appelé existe ; un même fichier n'a pas deux `?v=` différents entre les pages ; chaque fichier de `CORE` (sw.js) existe (sinon la mise à jour hors connexion échoue) ; `CACHE` a la forme `mgci-vNNN` ; chaque image de `IMAGES` existe ; chaque photo `v2/img/produit-<id>.webp` a son `<id>` dans `A.SACK`. | rouge / orange / info |
| `mots-interdits` | Dans les textes visibles : « PAYÉ », « Non inclus », « Sans transport », « l'acheteur vient chercher » (rouge s'il désigne le choix « à la charge de l'acheteur », orange sinon), une commission dite « encaissée » sans négation. | rouge / orange |
| `communes` | Une commune d'Abidjan présentée comme ville (« uniquement à Cocody », exemple « Cocody » dans un champ ville, commune dans la liste des villes de `app/villes.js`). | orange / rouge |
| `doublon-texte` | Même texte visible de plus de 40 caractères dans plusieurs fichiers (candidat à un module commun). Les 30 plus répétés. | orange |
| `doublon-fonction` | `function nom()` définie deux fois dans le même bloc d'un même fichier (la seconde remplace la première). | orange |
| `doublon-id` | `id="…"` en double dans le HTML de `application.dc.html` et `index-v3.html`. | rouge |
| `long-texte` | Texte d'écran de l'application de plus de 25 mots (hors aide, guides, astuces, écrans admin, `aria-label`, `alt`), du plus long au plus court. | orange |
| `slogan` | Tournures publicitaires toutes faites (« en quelques clics », « révolutionnaire », « ne manquez pas »…). | orange |
| `police` | `font-family` ou `font:` dont la première police n'est pas Jost. | orange |
| `bleu` | Couleur `#hex` de teinte 190 à 250°, assez saturée (hors exceptions : lien « compatible », eau des cartes). | orange |
| `sql` | `supabase/schema-*.sql` avec `drop`, `delete` ou `truncate` (un résumé), et une ligne par fichier qui efface vraiment des données (`delete from`, `truncate`, `drop table`). | info |
| `liens` | Fichiers cités dans `CLAUDE.md` et `docs/gardiens/*.md` qui n'existent plus. | orange |
| `navigateur` | Ouvre `application.dc.html` en iPhone émulé (réseau extérieur coupé) et relève les erreurs JavaScript et un écran vide. Seulement si Playwright est trouvé ; sinon « non vérifié ». | rouge / orange |

Ce qu'on appelle « texte visible » : les chaînes du code (`'…'`, `"…"`, `` `…` ``) et le texte du HTML, débarrassés des balises, en écartant ce qui ressemble à du code, du CSS, des classes ou des chemins. Les commentaires ne sont jamais lus.

## Ajouter une exception

Dans `tools/gardiens/exceptions.json`, liste `ignorer` :

```json
{ "controle": "bleu", "fichier": "app/carte-gl.js", "contient": "#86BDD0", "raison": "Fleuves de la carte (l'eau reste bleue)." }
```

- `controle` : le nom du tableau ci-dessus (obligatoire).
- `fichier` : le fichier, `*` permis (`v3/admin*.js`). Facultatif.
- `contient` : un morceau du texte trouvé (la couleur, la phrase, le chemin). Facultatif.
- `raison` : toujours l'écrire. Une exception sans raison ne sera pas comprise plus tard.

Le rapport dit combien de constats ont été mis de côté. Les seuils (`motsMax`, `doublonMin`, `doublonMax`, `parGroupe`) sont dans `seuils`. La liste des documents dont on vérifie les liens est dans `documentsLiens` (plus `docs/gardiens/*.md`, toujours lus).

## Ajouter un contrôle

Dans `controle.js` :

1. donner un nom et un titre dans `NOMS` (l'ordre de `NOMS` est l'ordre du rapport) ;
2. écrire `controle('mon-nom', () => { … signaler('orange', 'mon-nom', 'fichier:ligne', 'message en français simple', 'clé pour les exceptions'); … return { texte: 'ce qui a été relu' }; });`
3. pour les textes d'écran, se servir de `textesDe(fichier)` (renvoie `{ fichier, ligne, texte }`) ; pour le JavaScript, `lireJS(code)` (chaînes et fonctions) ;
4. relancer sur le dépôt et régler seuils et exceptions pour éviter les faux positifs ;
5. mettre à jour le tableau de ce fichier.

Un contrôle qui plante ne fait pas tomber les autres : il apparaît dans « Non vérifié » avec l'erreur.
