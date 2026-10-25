# Centre de commande du contrôle qualité MGCI

> Demande du propriétaire (25/10/2026) : un système permanent de vérification, comme les contrôles militaires, les audits bancaires et les procédures d’usine : des unités indépendantes, des contrôles croisés, des exercices réguliers, des alertes et des preuves. **Une application qui s’ouvre n’est pas une application prête.**
> Ce dossier remplace l’ancien `docs/gardiens/` (24/10/2026) : tout est ici, rien en double.

## La phrase à dire

**« Lance le contrôle général MGCI »** : Claude suit `procedures/CONTROLE_GENERAL.md` (script, tests SQL sur le projet de test en équipes d’agents, navigateur, jugement, rapport daté, PR avec seulement les rapports).

## Les commandes

| Je veux… | Commande | Durée |
|---|---|---|
| tout ce qui est automatique | `bash tools/controle/lancer.sh tout` | ~10 s |
| le contrôle du code et des textes seulement | `bash tools/controle/lancer.sh statique` | ~5 s |
| ouvrir l’application dans le navigateur (iPhone émulé) et les batteries d’écran | `bash tools/controle/lancer.sh navigateur` | ~15 s + batteries |
| une seule unité | `bash tools/controle/lancer.sh unite U04` | ~5 s (+ SQL listé) |
| contrôler ce que je viens de changer | `bash tools/controle/lancer.sh apres-modif` (`procedures/APRES_MODIFICATION.md`) | ~10 s (+ SQL lié) |
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

Statut d’une anomalie : **ouverte** · **corrigée non vérifiée** · **vérifiée** · **risque accepté par le propriétaire** (seulement avec sa phrase écrite).

Le propriétaire lit « En bref », puis les P0 et P1, puis « Corrections proposées », et répond par les numéros (« corrige 1, 3 et 4 »).

## Reprendre après une correction

1. La correction se fait dans une PR à part (captures validées avant, si un écran change).
2. `bash tools/controle/lancer.sh apres-modif` sans échec bloquant ; tests SQL liés rejoués sur le projet de test.
3. Dans `REGISTRE_ANOMALIES.md` : « corrigée non vérifiée ».
4. Après fusion : rejouer le test de non-régression (`bash tools/controle/lancer.sh unite Uxx`, ou le fichier SQL via MCP) ; statut « vérifiée » avec date et preuve.
5. Un rouge corrigé : retirer sa clé de `tools/controle/reference-rouges.json`.

## Les 14 unités (état au 25/10/2026)

| Unité | Automatique (script) | Tests SQL existants (Claude, MCP) | Batteries du contrôle qualité | État |
|---|---|---|---|---|
| U01 Logique métier | STA-04 | `regles-93`, `e2e-parcours` | à intégrer | partiel |
| U02 Sécurité | — | `confiance-94`, `transport-83` G, `fiabilite-84` E, `regles-93` | à intégrer (SQL) | manuel seulement |
| U03 Transactions et argent | STA-03 | `commission-95b`, `transport-95`, `e2e-parcours` | à intégrer (SQL) | partiel ; vrais paiements **impossibles** (aucun branché) |
| U04 Stocks et produits | — | `boutiques-86`, `tableau-prix`, `stock-commandes`, `regles-93`, `e2e-parcours` | à intégrer (SQL) | manuel seulement |
| U05 Commandes et négociations | — | `e2e-parcours`, `stock-commandes`, `fiabilite-84`, `dm-anti-doublon` | à intégrer (SQL) | manuel seulement |
| U06 Transport et livraison | — | `transport-83`, `transport-95`, `stock-commandes`, `e2e-parcours` | à intégrer (SQL) | manuel seulement |
| U07 Profils et confiance | — | `confiance-94`, `niveaux-85`, `fiabilite-84`, `boutiques-86` | à intégrer (SQL) | manuel seulement |
| U08 Notifications | — | `notifications-88`, `notif-objet-vivant`, `alertes-ciblage` | à intégrer (SQL) | manuel ; envoi réel (`pousser`) **en attente : clés push** |
| U09 Base de données | STA-12 | `stockage-volume` ; listes G | à intégrer (SQL) | partiel |
| U10 Fiabilité technique | STA-01, 02, 06, 07, 14 ; APM-02 à 07 | `dm-anti-doublon` | à intégrer (navigateur) | automatique en grande partie |
| U11 Administration | — | `stockage-volume`, `commission-95b`, `confiance-94` | à intégrer (SQL) | manuel seulement |
| U12 Compréhension | STA-05, 08 à 11 | — | à intégrer (navigateur) | partiel (repérage automatique, jugement par Claude) |
| U13 Cohérence documentaire et commerciale | STA-03, 09, 13 | — | — (jugement) | partiel |
| U14 Situations extrêmes | — | `alertes-ciblage` (250 abonnés) | à intégrer (SQL) | manuel ; charge simultanée **jamais testée** |

Détail par type de situation : `MATRICE_TESTS.md`.

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
| `tests/sql/`, `tests/navigateur/` | batteries des unités (ajoutées par l’intégration ; noms `Uxx-<sujet>`) |
| `tools/controle/` (hors de ce dossier) | les scripts : `lancer.sh`, `controle.js`, `unites.json`, `reference-rouges.json`, `exceptions.json`, `pre-commit` |

## Règles qui ne changent jamais

1. Mesurer, ne pas supposer : « réussi » seulement avec une preuve qu’un autre peut refaire.
2. Ne jamais masquer une anomalie ; ne jamais inventer un résultat ; un test bloqué n’est pas réussi.
3. Ne rien corriger pendant un contrôle : constater, proposer ; le propriétaire choisit.
4. Production : lecture seule (`get_advisors`). Projet de test : blocs annulés seulement. Jamais `drop`, `delete`, `truncate`.
5. Aucun paiement n’est branché : ne jamais simuler, ne jamais écrire « encaissé ».
6. Chaque nouvelle règle, fonction, test ou écran ajoute ce qu’il faut vérifier (`LISTES_DE_CONTROLE.md`, `MATRICE_TESTS.md`, `tools/controle/unites.json`) dans la même PR.
