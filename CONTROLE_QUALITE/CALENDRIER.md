# Calendrier des contrôles

> Qui lance : **GitHub** = tâche GitHub Actions (toute seule, gratuite) · **Claude programmé** = tâche Claude programmée (`trig_01KLjPRL3kuCrSEjgNVCPkxg`, tous les 3 jours à 6 h 43) · **Claude sur demande** = une discussion où le propriétaire le demande · **propriétaire** = Stan.
> Heures en UTC = heure d’Abidjan. Durées mesurées le 25/10/2026 pour le script (`tout` : 9 s sur la machine de Claude) ; les durées des parties manuelles sont des ordres de grandeur à corriger après les premiers passages.
> Toutes les commandes citées existent dans le dépôt (`tools/controle/lancer.sh`, `tools/controle/controle.js`, `.github/workflows/`). Les trois tâches GitHub du contrôle sont **écrites mais pas encore exécutées sur GitHub** (25/10/2026) : la branche n’est pas fusionnée.

## Vérité sur le SQL

**Aucun test SQL ne tourne tout seul.** GitHub n’a aucun accès à la base (aucun secret Supabase, et il ne faut pas en mettre). La tâche Claude programmée a été créée **sans** l’outil Supabase : tant que le propriétaire ne la recrée pas depuis claude.ai avec cet accès, elle écrit les tests SQL en « bloqué ». Le SQL est donc joué **par Claude sur demande** (MCP, projet de test), au moins à chaque contrôle général.

## Tableau

| Moment | Fréquence | Unités | Commande exacte | Prérequis | Durée | Résultat attendu | Rapport | Échec si | Qui |
|---|---|---|---|---|---|---|---|---|---|
| **À chaque modification** | avant chaque push | celles touchées | `bash tools/controle/lancer.sh apres-modif` | `git fetch origin` | 5 à 15 s (+ SQL lié) | aucun échec bloquant ; tests SQL liés listés | `CONTROLE_QUALITE/rapports/AAAA-MM-JJ-HHhMM-apres-modif.md` | nouveau rouge, erreur de syntaxe, CACHE ou `?v=` non montés (code 1) | Claude sur demande (hook facultatif `tools/controle/pre-commit`) |
| **SQL après un schéma changé** | à chaque schéma | lignes `APM-SQL-…` | fichiers listés par la commande ci-dessus, joués via MCP (`procedures/APRES_MODIFICATION.md`, partie 2) | outil Supabase, projet de test | 5 à 30 min | résultat identique à celui écrit dans le fichier | sous le bloc du fichier de test + rapport de la PR | résultat différent | Claude sur demande |
| **À chaque PR** et chaque fusion dans `main` | automatique | U10, U12, U13 (statique) | `.github/workflows/controle-pr.yml` → `bash tools/controle/lancer.sh pr --base <base>` | aucun | 1 à 2 min | coche verte sur la PR | résumé de la tâche (onglet Actions) ; rien dans le dépôt | nouveau rouge, syntaxe, CACHE ou `?v=` non montés | GitHub |
| **Chaque jour** | 5 h 29 | U10, U12, U13 + batteries navigateur | `.github/workflows/controle-quotidien.yml` → `bash tools/controle/lancer.sh tout --sortie rapport-controle-quotidien.md --resume resume-controle.json` | Playwright installé par la tâche | 3 à 6 min | issue « Contrôle quotidien » à jour, sans commentaire si rien ne change | issue « Contrôle quotidien » | nouvel échec bloquant → un commentaire (notification) | GitHub |
| **Chaque jour, SQL** | — | U01 à U09, U11, U14 | — | outil Supabase dans une tâche programmée | — | — | — | — | **Pas automatique** (voir plus haut) |
| **Tous les 3 jours** | 1, 4, 7… du mois, 6 h 17 | statique complet + navigateur | `.github/workflows/gardiens.yml` → `node tools/controle/controle.js` | aucun | 2 à 4 min | issue « Rapport des gardiens » | issue « Rapport des gardiens » | — (ne fait jamais échouer : constats seulement) | GitHub |
| **Tous les 3 jours** | 6 h 43, après la tâche GitHub | toutes, autant que possible | « Lance le contrôle général MGCI » : `procedures/CONTROLE_GENERAL.md` | sans outil Supabase : SQL « bloqué » | 2 à 3 h | PR « Rapport du contrôle qualité du JJ/MM » | `rapports/AAAA-MM-JJ-controle-general.md`, `DERNIER_RAPPORT.md`, `HISTORIQUE.md` | P0 ou P1 nouveau | Claude programmé |
| **Chaque semaine** (passage du lundi au mercredi) | 1 fois | U12 (design), U09 | contrôle général + liste F complète (32 lois, 390 et 320 px), `python3 .claude/skills/antislop-human/contrast-check.py`, `bash tools/controle/lancer.sh unite U09` | navigateur | + 1 h | une ligne par loi ; tests en retard de plus de 7 jours listés | rapport du contrôle général | loi non respectée sur un écran principal | Claude programmé ou sur demande |
| **Chaque mois** (premier passage) | 1 fois | U09, U05, U06, U14 | contrôle général + liste G8 (fonctions du dépôt = test) + parcours `e2e-parcours-scenarios.sql` (a) à (j) rejoués | outil Supabase | + 1 h 30 | tous les parcours comme écrits | rapport du contrôle général | parcours différent | Claude sur demande (le SQL n’est pas faisable par la tâche programmée sans accès) |
| **Chaque mois**, téléphone | 1 fois | U10, U08 | ouvrir l’application sur son vrai téléphone (ouverture, notifications, réseau lent) | téléphone | 20 min | ce qu’il a vu, dit à Claude | rapport suivant | écran vide, notification absente | propriétaire |
| **Avant production** | à chaque passage en production, ouverture, essai fermé, paiement | toutes | `procedures/AVANT_PRODUCTION.md` (contrôle général + `bash tools/controle/lancer.sh tout` + audit de sécurité) | outil Supabase, accord écrit du propriétaire | une demi-journée | aucune P0 ouverte, P1 corrigées ou acceptées par écrit | `rapports/` + `docs/audits/` | P0 ouverte, test SQL lié non rejoué | Claude sur demande, accord du propriétaire |
| **Après incident** | à chaque incident | celle de l’incident | `procedures/APRES_INCIDENT.md`, puis `bash tools/controle/lancer.sh unite Uxx` | selon l’incident | variable | anomalie enregistrée, reproduite, test de non-régression écrit | `REGISTRE_ANOMALIES.md` + rapport daté | incident non reproduit ou sans test de non-régression | Claude sur demande |
| **Une unité seule** | quand on veut | Uxx | `bash tools/controle/lancer.sh unite U04` | — | 5 à 15 s (+ SQL listé) | lignes de l’unité | `rapports/AAAA-MM-JJ-HHhMM-unite-U04.md` | échec bloquant | Claude sur demande |

## Remarques

- `*/3` compte les jours du mois (1, 4, 7… 31) : en fin de mois, deux passages peuvent tomber à 1 ou 2 jours d’écart (voulu).
- Le jour où le contrôle quotidien et les gardiens tombent ensemble, ils font en partie la même chose : c’est voulu (deux issues distinctes, aucune ne notifie sans changement).
- Pour donner l’accès Supabase à la tâche programmée : la recréer depuis claude.ai avec l’outil Supabase (le propriétaire), puis noter le nouvel identifiant ici.
