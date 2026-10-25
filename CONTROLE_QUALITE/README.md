# Centre de commande du contrôle qualité MGCI

> Demande du propriétaire (25/10/2026) : un système permanent de vérification, comme les contrôles militaires, les audits bancaires et les procédures d’usine : des unités indépendantes, des contrôles croisés, des exercices réguliers, des alertes et des preuves. **Une application qui s’ouvre n’est pas une application prête.**
> Ce dossier remplace l’ancien `docs/gardiens/` (24/10/2026) : tout est ici, rien en double.

## La phrase à dire

**« Lance le contrôle général MGCI »** : Claude suit `procedures/CONTROLE_GENERAL.md` (script, tests SQL sur le projet de test en équipes d’agents, navigateur, jugement, rapport daté, PR avec seulement les rapports).

Premier contrôle général complet : **25/10/2026**, `rapports/2026-10-25-controle-general.md` (238 tests : 148 réussis, 69 échoués, 1 bloqué, 4 non exécutés, 16 en attente ; 0 P0, 4 P1). Les anomalies sont dans `REGISTRE_ANOMALIES.md`.

## Les commandes

| Je veux… | Commande | Durée |
|---|---|---|
| tout ce qui est automatique | `bash tools/controle/lancer.sh tout` | ~10 s |
| le contrôle du code et des textes seulement | `bash tools/controle/lancer.sh statique` | ~5 s |
| ouvrir l’application dans le navigateur (iPhone émulé) et les batteries d’écran | `bash tools/controle/lancer.sh navigateur` | ~9 min (U10 ~8 min, U12 ~40 s) |
| une seule unité | `bash tools/controle/lancer.sh unite U04` | ~5 s (+ SQL listé) |
| contrôler ce que je viens de changer | `bash tools/controle/lancer.sh apres-modif` (`procedures/APRES_MODIFICATION.md`) | ~10 s (+ SQL lié) |
| les batteries SQL d’une unité (sur le projet de **test**) | Claude via MCP : coller `CONTROLE_QUALITE/tests/sql/_outils.sql` puis un bloc de `CONTROLE_QUALITE/tests/sql/Uxx-*.sql` dans le même appel (U02, U07, U09, U11 ont leurs outils en tête) | ~2 min par bloc |
| une batterie navigateur seule | `python3 -m http.server 8765` depuis le dépôt, puis `CQ_URL=http://127.0.0.1:8765/ node CONTROLE_QUALITE/tests/navigateur/U10-fiabilite.js` (ou `U12-parcours.js`) | U10 ~8 min, U12 ~40 s |
| lire la dernière définition d’une fonction SQL du dépôt | `python3 tools/controle/fn.py <fonction>` | 1 s |
| l’audit complet avant publication | `procedures/AVANT_PRODUCTION.md` | une demi-journée |
| après un incident | `procedures/APRES_INCIDENT.md` | variable |

Le script **n’exécute jamais le SQL** (il n’a pas accès à la base) : il liste les tests « à exécuter par Claude (MCP) » et ne les déclare jamais réussis. Code de sortie : 0 = pas d’échec bloquant, 1 = échec bloquant, 2 = commande mal écrite.

## Où lire le résultat

- **Dernier rapport** : `DERNIER_RAPPORT.md` (copie du plus récent).
- Tous les rapports : `rapports/` (un fichier daté par passage). Liste des passages : `HISTORIQUE.md`.
- Sur GitHub : issue « Contrôle quotidien » (chaque jour), issue « Rapport des gardiens » (tous les 3 jours), coche de chaque PR (« Contrôle des PR »).
- Les anomalies et leur suivi : `REGISTRE_ANOMALIES.md`.

## Lire un rapport

Gravité :
- **P0** : argent, sécurité ou perte de données ; bloque tout.
- **P1** : grave ; à corriger avant toute ouverture.
- **P2** : gênant.
- **P3** : cosmétique.

Statut d’un test : **réussi** (vu, avec preuve) · **échoué** · **bloqué** (n’a pas pu tourner : ce n’est **pas** réussi) · **non exécuté** (pas lancé, par exemple le SQL par le script) · **en attente : <prérequis>** (paiement, SMS, clé, vrai téléphone).

Statut d’une anomalie : **ouverte** · **correction en cours** (PR ouverte) · **corrigée non vérifiée** · **vérifiée** · **risque accepté par le propriétaire** (seulement avec sa phrase écrite).

Le propriétaire lit « En bref », puis les P0 et P1, puis « Corrections proposées », et répond par les numéros (« corrige 1, 3 et 4 »).

## Reprendre après une correction

1. La correction se fait dans une PR à part (captures validées avant, si un écran change).
2. `bash tools/controle/lancer.sh apres-modif` sans échec bloquant ; tests SQL liés rejoués sur le projet de test.
3. Dans `REGISTRE_ANOMALIES.md` : « corrigée non vérifiée ».
4. Après fusion : rejouer le test de non-régression (`bash tools/controle/lancer.sh unite Uxx`, ou le fichier SQL via MCP) ; statut « vérifiée » avec date et preuve.
5. Un rouge corrigé : retirer sa clé de `tools/controle/reference-rouges.json`.

## Les 14 unités (état au 25/10/2026, après le premier contrôle général)

| Unité | Automatique (script) | Tests SQL anciens (`supabase/tests/`) | Batteries du contrôle qualité (`tests/`) | Résultat du 25/10/2026 (réussis / échoués / bloqués / non exécutés / en attente) |
|---|---|---|---|---|
| U01 Logique métier | STA-04 | `regles-93`, `e2e-parcours` | LOG-01 à 16 (jugement, `tools/controle/fn.py`) | 10 / 6 / 0 / 0 / 1 |
| U02 Sécurité | — | `confiance-94`, `transport-83` G, `fiabilite-84` E, `regles-93` | `sql/U02-securite.sql` (SEC) | 8 / 2 / 0 / 0 / 1 |
| U03 Transactions et argent | STA-03 | `commission-95b`, `transport-95`, `e2e-parcours` | `sql/U03-argent.sql` (ARG) | 10 / 3 / 0 / 0 / 4 ; vrais paiements **impossibles** (aucun branché) |
| U04 Stocks et produits | — | `boutiques-86`, `tableau-prix`, `stock-commandes`, `regles-93`, `e2e-parcours` | `sql/U04-stocks.sql` (STK) | 8 / 2 / 0 / 1 / 1 |
| U05 Commandes et négociations | — | `e2e-parcours`, `stock-commandes`, `fiabilite-84`, `dm-anti-doublon` | `sql/U05-commandes.sql` (CMD) | 11 / 4 / 0 / 0 / 1 |
| U06 Transport et livraison | — | `transport-83`, `transport-95`, `stock-commandes`, `e2e-parcours` | `sql/U06-transport.sql` (TRA) | 12 / 0 / 0 / 0 / 1 |
| U07 Profils et confiance | — | `confiance-94`, `niveaux-85`, `fiabilite-84`, `boutiques-86` | `sql/U07-profils.sql` (PRO) | 3 / 1 / 0 / 1 / 0 |
| U08 Notifications | — | `notifications-88`, `notif-objet-vivant`, `alertes-ciblage` | `sql/U08-notifications.sql` (NOT) | 5 / 4 / 0 / 1 / 1 ; envoi réel **en attente : clés push** |
| U09 Base de données | STA-12 | `stockage-volume` ; listes G | `sql/U09-base.sql` (BDD) | 3 / 3 / 0 / 0 / 1 |
| U10 Fiabilité technique | STA-01, 02, 06, 07, 14 ; APM-02 à 07 | `dm-anti-doublon` | `navigateur/U10-fiabilite.js` (FIA, automatique) | 57 / 18 / 0 / 0 / 3 |
| U11 Administration | — | `stockage-volume`, `commission-95b`, `confiance-94` | `sql/U11-admin.sql` (ADM) | 3 / 2 / 0 / 0 / 0 |
| U12 Compréhension | STA-05, 08 à 11 | — | `navigateur/U12-parcours.js` (CMP-21+, automatique) ; CMP-01 à 11 (jugement sur captures) | 10 / 11 / 1 / 0 / 0 |
| U13 Cohérence documentaire et commerciale | STA-03, 09, 13 | — | DOC-01 à 12 (jugement) | 2 / 11 / 0 / 0 / 1 |
| U14 Situations extrêmes | — | `alertes-ciblage` (250 abonnés) | `sql/U14-extremes.sql` (EXT) | 6 / 2 / 0 / 1 / 1 ; charge simultanée **jamais testée** |

Détail par type de situation : `MATRICE_TESTS.md`.

## Ce que le propriétaire doit faire (une fois)

1. **Recréer la tâche programmée avec l’accès Supabase** : la tâche Claude tous les 3 jours (`trig_01KLjPRL3kuCrSEjgNVCPkxg`) a été créée sans l’outil Supabase, donc elle ne peut pas jouer les tests SQL. Sur claude.ai : ouvrir les tâches programmées, supprimer l’ancienne, en créer une nouvelle (tous les 3 jours, même texte : « Lance le contrôle général MGCI ») **en cochant le connecteur Supabase**. Sans cela, les lignes SQL restent « bloqué : outil Supabase absent ».
2. **Vérifier que GitHub Actions est actif** : sur github.com, dépôt `Stan77i/marchedegrosci`, onglet « Actions » : les tâches « Contrôle des PR », « Contrôle quotidien » et « Gardiens » doivent être activées (si GitHub affiche « I understand my workflows, go ahead and enable them », cliquer). Au lendemain de la fusion, une issue « Contrôle quotidien » doit apparaître.
3. **Facultatif : le contrôle avant chaque commit** sur votre ordinateur (ou celui de Claude) : `cp tools/controle/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`. Il refuse un commit avec une erreur de syntaxe ou un front changé sans `CACHE` monté.

## Automatique, manuel, impossible

| | Quoi | Qui |
|---|---|---|
| **Automatique** | syntaxe, textes interdits, doublons, textes longs, police, bleu, liens, cache (`?v=`, `CACHE`, `IMAGES`), ouverture de l’application, batteries navigateur | GitHub (chaque PR, chaque jour, tous les 3 jours), `lancer.sh` |
| **Manuel (Claude)** | tous les tests SQL sur le projet de test, droits et RLS, conseillers Supabase, écrans avec compte, jugement des textes et du design, cohérence avec les règles de `CLAUDE.md` | Claude sur demande ; tâche programmée (sans SQL tant qu’elle n’a pas l’outil Supabase) |
| **Manuel (propriétaire)** | vrai téléphone, choix des corrections, risques acceptés | le propriétaire |
| **Impossible sans accès externe** | vrais paiements, SMS, fonctions `pousser` et `itineraire` en réel, charge simultanée à grande échelle, production en écriture (interdite) | — (prérequis dans `INVENTAIRE_OUTILS.md`) |

## Les fichiers

| Fichier | Rôle |
|---|---|
| `README.md` | ce centre de commande |
| `CALENDRIER.md` | quoi, quand, avec quelle commande, par qui |
| `MATRICE_TESTS.md` | unité × type de situation, avec les ID des tests |
| `REGISTRE_ANOMALIES.md` | toutes les anomalies et leur statut |
| `REGISTRE_DES_TESTS.md` | chaque fichier SQL, son dernier résultat connu, ce qui n’a jamais été vérifié |
| `LISTES_DE_CONTROLE.md` | les cases A à K, avec la façon exacte de vérifier |
| `INVENTAIRE_OUTILS.md` | ce qui existe, ce qui est automatisable, ce qui ne l’est pas et pourquoi |
| `DERNIER_RAPPORT.md`, `HISTORIQUE.md`, `rapports/` | les résultats |
| `modeles/RAPPORT.md` | gabarit de rapport |
| `procedures/` | contrôle général, après modification, avant production, après incident |
| `tests/sql/`, `tests/navigateur/` | batteries des unités (noms `Uxx-<sujet>` ; outils communs commençant par `_` : `_outils.sql`, `_faux-serveur.js`) |
| `rapports/annexes/` | résultats bruts des équipes d’un contrôle général (sans captures) |
| `tools/controle/` (hors de ce dossier) | les scripts : `lancer.sh`, `controle.js`, `unites.json`, `reference-rouges.json`, `exceptions.json`, `pre-commit`, `fn.py` |

## Règles qui ne changent jamais

1. Mesurer, ne pas supposer : « réussi » seulement avec une preuve qu’un autre peut refaire.
2. Ne jamais masquer une anomalie ; ne jamais inventer un résultat ; un test bloqué n’est pas réussi.
3. Ne rien corriger pendant un contrôle : constater, proposer ; le propriétaire choisit.
4. Production : lecture seule (`get_advisors`). Projet de test : blocs annulés seulement. Jamais `drop`, `delete`, `truncate`.
5. Aucun paiement n’est branché : ne jamais simuler, ne jamais écrire « encaissé ».
6. Chaque nouvelle règle, fonction, test ou écran ajoute ce qu’il faut vérifier (`LISTES_DE_CONTROLE.md`, `MATRICE_TESTS.md`, `tools/controle/unites.json`) dans la même PR.
