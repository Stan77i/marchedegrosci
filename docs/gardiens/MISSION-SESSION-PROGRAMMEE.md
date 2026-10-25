# Mission de la session programmée des gardiens

> Ce fichier est lu par une session Claude lancée **seule, tous les 3 jours** (tâche programmée, voir `CALENDRIER.md`). Personne ne la surveille pendant qu'elle travaille. Elle suit ces instructions **à la lettre**.
> Elle **constate et propose**. Elle ne corrige rien. Le propriétaire choisit ensuite les corrections.

## 0. Interdits absolus

- **Ne rien corriger** dans le code, les textes, la base ou les documents (sauf le fichier du rapport).
- **Aucune écriture en production** (`catmsypctymgkjkfzdkt`) : seulement la liste H (conseillers, journaux d'erreurs, tâches planifiées), en lecture.
- **Jamais de `drop`, `delete`, `truncate`**, même sur le projet de test, même en commentaire. Si le MCP refuse une requête, ne pas la contourner.
- Sur le projet de test (`yowdymdnoiubatxlwhfv`) : seulement des blocs qui finissent par `raise exception 'TEST…'` et des lectures.
- **Jamais de dépense**, d'abonnement, de service payant.
- **Jamais de fusion** de PR, jamais de `push --force`, jamais de commit dans `main`.
- **Ne jamais inventer un résultat** : ce qui n'a pas été vu va dans « Non vérifié », avec la raison.
- Aucune donnée personnelle dans le rapport (numéro, nom complet, contenu de message).

## 1. Lire (dans cet ordre)

1. `CLAUDE.md` (toutes les règles du projet).
2. `docs/gardiens/README.md`, `CALENDRIER.md`, `LISTES-DE-CONTROLE.md`, `REGISTRE-DES-TESTS.md`, puis ce fichier.
3. `DESIGN.md`, section 8 (les 32 lois).
4. `docs/REPRISE.md`, partie 1 (l'état) et la liste des « restes techniques connus » : un défaut déjà connu se note « toujours là », pas « nouveau ».
5. `tools/gardiens/README.md` : comment lire le résultat du contrôle automatique.

## 2. Se placer

```bash
git fetch origin
git switch -c claude/gardiens-rapport-AAAA-MM-JJ origin/main
```
(AAAA-MM-JJ = date du jour, heure d'Abidjan.)

Regarder les PR ouvertes : `gh api "repos/Stan77i/marchedegrosci/pulls?state=open" --jq '.[] | [.number, .title] | @tsv'`. Les noter dans le rapport (une ligne), sans y toucher.

## 3. Lire le rapport précédent

- Le plus récent `docs/gardiens/rapports/AAAA-MM-JJ.md` de `origin/main`.
- S'il y a une PR ouverte « Rapport des gardiens du … » plus récente, lire son fichier : `git show origin/<sa branche>:docs/gardiens/rapports/<date>.md`.
- Garder sa liste de points (rouge, orange) et sa date : elle sert à la comparaison (partie 6 du gabarit) et aux recherches « depuis le dernier rapport » (listes J et K).
- S'il n'y a aucun rapport : c'est le premier passage ; toutes les recherches « depuis le dernier rapport » partent de 7 jours avant.

## 4. Lire le résultat du contrôle automatique

Suivre `tools/gardiens/README.md` pour trouver le résultat du dernier passage de `.github/workflows/gardiens.yml` (par exemple `gh run list --workflow gardiens.yml --limit 1`, puis le résultat que le mode d'emploi indique). S'il n'a pas tourné depuis plus de 4 jours, ou s'il a échoué : point **rouge** « contrôle automatique arrêté », avec le lien du passage.

Trier ses alertes : vraie alerte → point du rapport ; fausse alerte → une ligne « écartée » avec la raison.

## 5. Faire les listes A à K

Utiliser des **agents en parallèle** (règle de `CLAUDE.md`), chacun avec une partie des listes, puis une relecture finale :

| Équipe | Listes | Modèle | Pourquoi |
|---|---|---|---|
| 1 | A (doublons de code, CSS, SQL), J (cache), K (documents), I (recherche de clés) | Sonnet | Recherches mécaniques |
| 2 | G (tests rejoués sur le projet de test, RLS, droits, conseillers, tâches) et H (production, lecture seule) | Sonnet pour lancer, **Opus** pour juger un résultat qui change | Exécution répétitive, jugement sur les écarts |
| 3 | C (bugs : console, écrans vides, clignotements, débordements) et F (design), dans le navigateur, iPhone émulé, clair et sombre, 390 et 320 px | Sonnet pour les captures et mesures, **Opus** pour juger F | Captures mécaniques, regard de design |
| 4 | B (sur-explications), D (logique, cohérence avec le serveur), E (à sa place), A1 à A5 (doublons à l'écran) | **Opus** | Jugement, textes, règles métier |
| Relecture | Tout le rapport | **Opus** | Vérifier chaque preuve, enlever tout ce qui n'est pas prouvé |

Si les agents ne sont pas disponibles : faire les listes l'une après l'autre, dans l'ordre G, H, C, D, A, B, E, F, I, J, K (le plus grave d'abord).

Chaque case : vert (vérifié, preuve), orange, rouge, ou « non vérifié » (raison). Le calendrier dit ce qui s'ajoute le passage de la semaine et le premier passage du mois.

**Captures** : les enregistrer dans le dossier temporaire de la session (pas dans le dépôt), et citer dans le rapport l'écran, le thème, la largeur et ce qu'on y voit. Ne pas ajouter d'images au dépôt.

**Temps** : viser 2 à 3 heures en tout. Ce qui n'est pas fini à temps va dans « Non vérifié : pas eu le temps ».

## 6. Écrire le rapport

Fichier : `docs/gardiens/rapports/AAAA-MM-JJ.md`. Français simple et court pour le propriétaire, précis pour l'agent qui corrigera. Gabarit **exact** :

```markdown
# Rapport des gardiens du JJ/MM/AAAA

> Passage n° N · contrôle automatique : <lien du passage ou « non trouvé »> · rapport précédent : <date ou « aucun »>
> Projet de test : <joignable / non joignable> · production (lecture seule) : <joignable / non joignable>

## En bref
1. <une ligne : le plus important>
2. <une ligne>
3. <une ligne : combien de rouges, d'orange, de verts ; nouveaux depuis la dernière fois>

## Rouge : grave
### R1. <titre court>
- **Où** : `fichier:ligne` ou écran (thème, largeur)
- **Preuve** : commande lancée et sortie utile, ou capture décrite, ou résultat SQL
- **Règle touchée** : <CLAUDE.md / DESIGN.md loi n° / liste et case, ex. D5>
- **Conseil** : <ce qu'il faudrait faire, en une ou deux phrases>
- **Depuis** : nouveau / toujours là (depuis le JJ/MM)

## Orange : à corriger
### O1. …
(même forme)

## Vert : vérifié
| Case | Ce qui a été vérifié | Preuve |
|---|---|---|
| G2 | RLS sur toutes les tables | requête G2 : 0 ligne |

## Non vérifié
| Case | Pourquoi |
|---|---|
| H1 | MCP Supabase non joignable |

## Tests du serveur
| Fichier ou parcours | Résultat de ce passage | Comme le registre ? |
|---|---|---|

## Comparaison avec le rapport précédent
- **Nouveau** : R1, O3…
- **Toujours là** : O1 (depuis le JJ/MM)…
- **Réglé** : <points du rapport précédent qui ont disparu, avec la preuve qu'ils sont réglés>

## Corrections proposées
1. <R1 : correction proposée, fichiers touchés, captures à faire avant la PR>
2. <O1 : …>
…
Le propriétaire répond par les numéros (« corrige 1, 3 et 4 »). Rien n'est corrigé sans sa réponse.

## Alertes du contrôle automatique écartées
- <alerte> : <pourquoi c'est une fausse alerte>
```

Règles d'écriture :
- Chaque point rouge ou orange a **une preuve** qu'un autre peut refaire. Pas de preuve = pas de point.
- Un point déjà dans « restes techniques connus » de `docs/REPRISE.md` reste dans le rapport (orange ou rouge), marqué « connu ».
- Pas de paragraphe, pas de tiret cadratin, des nombres en chiffres.
- Une proposition de correction ne dit jamais « fait ».

## 7. Créer la PR (une seule, avec seulement le fichier du rapport)

```bash
git add docs/gardiens/rapports/AAAA-MM-JJ.md
git commit -F <fichier du message>
git push -u origin claude/gardiens-rapport-AAAA-MM-JJ
```

Message de commit, en français :
```
Rapport des gardiens du JJ/MM

<En bref, 3 lignes>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <lien de la session en cours>
```
(Suivre la fin de message que donne `CLAUDE.md` au moment du passage, si elle a changé.)

PR : écrire le JSON avec python dans le dossier temporaire de la session, puis :
```bash
gh api repos/Stan77i/marchedegrosci/pulls --input <fichier.json>
```
- `title` : `Rapport des gardiens du JJ/MM`
- `head` : `claude/gardiens-rapport-AAAA-MM-JJ` ; `base` : `main`
- `body` : l'« En bref », le nombre de rouges / orange / verts / non vérifiés, la liste « Corrections proposées », puis à la fin : `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, une ligne vide, le lien de la session.
- Aucun nom ou identifiant de modèle ailleurs dans le commit ou la PR.

Vérifier que la PR existe (`gh api repos/Stan77i/marchedegrosci/pulls/<n> --jq .state` → `open`). Ne jamais la fusionner.

## 8. Dernier message de la session

Deux à cinq lignes, en français simple : l'« En bref », le nombre de rouges, le lien de la PR, et « Répondez par les numéros à corriger ». C'est ce message qui part en notification sur le téléphone du propriétaire.

## 9. Si quelque chose bloque

| Problème | Que faire |
|---|---|
| MCP Supabase non joignable | Listes G et H en « Non vérifié : MCP non joignable » ; continuer le reste |
| Navigateur ou serveur local qui ne démarre pas | Listes B, C, E, F à l'écran en « Non vérifié » ; faire les recherches dans le code |
| Un test SQL donne un résultat différent | Ne rien changer au test ni à la base ; point orange ou rouge avec la sortie exacte |
| Une branche `claude/gardiens-rapport-<date>` existe déjà | Ajouter `-2` au nom |
| `gh` refuse de créer la PR | Laisser la branche poussée, donner son nom dans le dernier message |
| Une règle de `CLAUDE.md` contredit ce fichier | `CLAUDE.md` gagne ; le noter dans le rapport (liste K6) |
