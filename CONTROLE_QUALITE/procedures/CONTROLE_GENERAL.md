# Procédure : « Lance le contrôle général MGCI »

> Ce que Claude fait, **à la lettre**, quand le propriétaire écrit « Lance le contrôle général MGCI », et ce que fait la session programmée tous les 3 jours (`trig_01KLjPRL3kuCrSEjgNVCPkxg`).
> Claude **constate et propose**. Il ne corrige rien pendant le contrôle. Le propriétaire choisit ensuite les corrections.
> Durée visée : 2 à 3 heures. Ce qui n’est pas fini à temps va dans « non exécuté : pas eu le temps ».

## 0. Interdits absolus

- **Ne rien corriger** dans le code, les textes, la base ou les documents, sauf les fichiers du rapport (partie 8).
- **Production** `catmsypctymgkjkfzdkt` : seulement `get_advisors` (lecture). Rien d’autre, jamais d’écriture.
- **Projet de test** `yowdymdnoiubatxlwhfv` : seulement des lectures et des blocs `do $$ … raise exception 'TEST: …' $$` (rien ne reste). Impersonation : `perform set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'role','authenticated')::text, true); set local role authenticated;` (modèle exact : `supabase/tests/`).
- **Jamais** de `drop`, `delete`, `truncate`, même en commentaire ; si le MCP refuse, ne pas contourner.
- Jamais de dépense, de fusion de PR, de `push --force`, de commit dans `main`.
- **Ne jamais inventer un résultat.** Un test bloqué n’est pas réussi. Un prérequis absent (paiement, SMS, GPS réel, clé) → « en attente : <prérequis> ».
- Aucune donnée personnelle ni secret dans le rapport.

## 1. Lire (dans cet ordre)

1. `CLAUDE.md`.
2. `CONTROLE_QUALITE/README.md`, `CALENDRIER.md`, `MATRICE_TESTS.md`, `REGISTRE_ANOMALIES.md`, `REGISTRE_DES_TESTS.md`, `LISTES_DE_CONTROLE.md`, `INVENTAIRE_OUTILS.md`.
3. Le dernier rapport : `CONTROLE_QUALITE/DERNIER_RAPPORT.md` et le dernier `rapports/*-controle-general.md` (sur `origin/main`, ou sur une PR « Rapport du contrôle qualité » encore ouverte : `git show origin/<branche>:CONTROLE_QUALITE/rapports/<fichier>`).
4. `DESIGN.md`, section 8 (les 32 lois) ; `docs/REPRISE.md`, partie 1 (un défaut déjà connu se note « toujours là »).
5. `tools/controle/unites.json`, partie `enCours` : chantiers en cours de changement (ex. schéma 97b) à ne pas déclarer « échoué ».

## 2. Se placer

```bash
git fetch origin
git switch -c claude/controle-rapport-AAAA-MM-JJ origin/main
gh api "repos/Stan77i/marchedegrosci/pulls?state=open" --jq '.[] | [.number, .title] | @tsv'
```
(AAAA-MM-JJ : date du jour, heure d’Abidjan. Si la branche existe : ajouter `-2`.) Noter les PR ouvertes dans le rapport, sans y toucher.

Vérifier les outils : `ToolSearch` « select:mcp__Supabase__execute_sql,mcp__Supabase__list_tables,mcp__Supabase__get_advisors ». Absent → toutes les lignes SQL en « bloqué : outil Supabase absent », et continuer le reste.

## 3. Lancer le script (automatique)

```bash
bash tools/controle/lancer.sh tout
```
Il écrit `CONTROLE_QUALITE/rapports/AAAA-MM-JJ-HHhMM-tout.md`, remplace `DERNIER_RAPPORT.md`, ajoute une ligne à `HISTORIQUE.md`. Lire son « En bref » et ses lignes « non exécuté » : c’est la liste de ce que Claude doit jouer à la main.

Lire aussi le dernier passage des tâches GitHub (`gh run list --workflow controle-quotidien.yml --limit 1`, `gh run list --workflow gardiens.yml --limit 1`, issues « Contrôle quotidien » et « Rapport des gardiens »). Arrêtées depuis plus de 4 jours ou en échec → anomalie P1 « contrôle automatique arrêté ». (Le proxy de la machine peut refuser certains chemins Actions : alors « bloqué : proxy ».)

## 4. Tests SQL sur le projet de test, en équipes d’agents parallèles

Fichiers : chaque `supabase/tests/*.sql` et chaque `CONTROLE_QUALITE/tests/sql/Uxx-*.sql`. Répartition (règle de `CLAUDE.md` : Sonnet pour lancer, Opus pour juger un écart) :

| Équipe | Fichiers | Modèle |
|---|---|---|
| 1 | U03 argent, U05 commandes, U06 transport : `commission-95b`, `transport-83`, `transport-95`, `stock-commandes`, `e2e-parcours`, `tests/sql/U03-*`, `U05-*`, `U06-*` | Sonnet, Opus pour les écarts |
| 2 | U04 stocks, U01 logique : `regles-93`, `boutiques-86`, `tableau-prix`, `tests/sql/U01-*`, `U04-*` | Sonnet |
| 3 | U07 confiance, U08 notifications : `confiance-94`, `niveaux-85`, `fiabilite-84`, `notifications-88`, `notif-objet-vivant`, `alertes-ciblage`, `dm-anti-doublon`, `tests/sql/U07-*`, `U08-*` | Sonnet |
| 4 | U02 sécurité, U09 base, U11 admin, U14 extrêmes : `stockage-volume`, listes G2 à G8 (RLS, droits `anon`, `security definer`, conseillers du test, tâches planifiées, fonctions du dépôt = test), `tests/sql/U02-*`, `U09-*`, `U11-*`, `U14-*` ; production : `get_advisors` seulement | **Opus** |

Pour chaque bloc : lancer **le bloc entier dans un seul appel** (avec les fonctions `pg_temp.*` d’en-tête), comparer au résultat écrit dans le fichier, noter ID, unité, type, attendu, obtenu, statut, preuve (fichier + bloc), date. Résultat différent : **ne rien changer** au test ni à la base ; anomalie avec la sortie exacte. Touché par un chantier `enCours` : « en cours de changement ».

## 5. Navigateur (U10, U12, listes B, C, E, F)

- `bash tools/controle/lancer.sh navigateur` (déjà fait par `tout`) : ouverture et batteries de `CONTROLE_QUALITE/tests/navigateur/`.
- Puis à la main, en agents parallèles (Sonnet pour les captures, Opus pour juger) : écrans de la liste du haut de `LISTES_DE_CONTROLE.md`, iPhone émulé, clair et sombre, 390 et 320 px, réponses Supabase injectées (`page.route`). Captures dans le dossier temporaire de la session, jamais dans le dépôt.

## 6. Jugement (Opus)

- Listes D (logique, cohérence avec le serveur), K (documents), A1 à A5, B, E ; U13 : chaque règle commerciale de `CLAUDE.md` comparée au **code réel** (texte affiché et fonction du serveur).
- Trier les alertes du script : vraie anomalie → registre ; fausse alerte → une ligne « écartée » avec la raison (et, si elle revient, une exception motivée proposée pour `tools/controle/exceptions.json`).

## 7. Comparer et tenir le registre

- Comparer au rapport précédent : nouveau / toujours là (depuis le JJ/MM) / réglé (avec preuve).
- `REGISTRE_ANOMALIES.md` : ajouter chaque nouvelle anomalie (`ANO-NNN`, gabarit du haut) ; changer le statut des anciennes (« vérifiée » seulement avec test rejoué, date et preuve ; jamais « risque accepté » sans la phrase écrite du propriétaire).
- `REGISTRE_DES_TESTS.md` et `MATRICE_TESTS.md` : proposer les nouveaux résultats (date, statut).

## 8. Écrire le rapport

Fichier : `CONTROLE_QUALITE/rapports/AAAA-MM-JJ-controle-general.md`, au gabarit **exact** `CONTROLE_QUALITE/modeles/RAPPORT.md` (parties 1 à 8), en reprenant les lignes du rapport du script (partie 3) et en y ajoutant les tests SQL, navigateur et jugement. Puis :
- copier ce rapport dans `DERNIER_RAPPORT.md` (en gardant la ligne de commentaire du haut, nom du fichier daté changé) ;
- ajouter sa ligne à `HISTORIQUE.md`.

Français simple pour le propriétaire (« En bref »), précis pour l’agent qui corrigera (preuves). Pas de paragraphe, pas de tiret cadratin, chiffres en chiffres.

## 9. PR avec seulement les rapports

```bash
git add CONTROLE_QUALITE/rapports CONTROLE_QUALITE/DERNIER_RAPPORT.md CONTROLE_QUALITE/HISTORIQUE.md CONTROLE_QUALITE/REGISTRE_ANOMALIES.md
git commit -F <message>
git push -u origin claude/controle-rapport-AAAA-MM-JJ
```
- Message : « Rapport du contrôle qualité du JJ/MM », l’« En bref », puis la fin de message de `CLAUDE.md`.
- PR : JSON écrit par python dans le dossier temporaire, `gh api repos/Stan77i/marchedegrosci/pulls --input <fichier.json>` ; titre « Rapport du contrôle qualité du JJ/MM » ; corps : En bref, comptes, P0 et P1, corrections proposées, puis `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, une ligne vide, le lien de la session. Aucun nom de modèle ailleurs.
- Vérifier : `gh api repos/Stan77i/marchedegrosci/pulls/<n> --jq .state` → `open`. Ne jamais fusionner.

## 10. Dernier message

2 à 5 lignes en français simple : l’« En bref », le nombre de P0 et P1, le lien de la PR, « Répondez par les numéros à corriger ». C’est ce message qui part en notification sur le téléphone du propriétaire (session programmée).

## 11. Si quelque chose bloque

| Problème | Que faire |
|---|---|
| Outil Supabase absent ou refusé | Lignes SQL et listes G, H en « bloqué : outil Supabase absent » ; continuer |
| Navigateur qui ne démarre pas | Lignes navigateur « bloqué » ; faire les recherches dans le code |
| Un test SQL donne un autre résultat | Ne rien changer ; anomalie avec la sortie exacte |
| Le MCP refuse une requête (mot interdit) | Ne pas contourner ; « bloqué : requête refusée par le MCP » |
| `gh` refuse la PR | Laisser la branche poussée, donner son nom dans le dernier message |
| `CLAUDE.md` contredit ce fichier | `CLAUDE.md` gagne ; le noter (liste K6) |
