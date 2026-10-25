# Matrice des tests : unité × type

> Chaque case donne les identifiants des tests qui couvrent cette unité pour ce type de situation. Case marquée **« trou »** = aucun test : ce n'est **pas** « tout va bien ».
> Remplie le 25/10/2026 par l'intégration des batteries du premier contrôle général : contrôles statiques (`STA-xx`, `tools/controle/unites.json`), contrôles après modification (`APM-xx`), tests SQL anciens de `supabase/tests/` (nom court + bloc), batteries du contrôle qualité (`SEC`, `ARG`, `STK`, `CMD`, `TRA`, `PRO`, `NOT`, `BDD`, `ADM`, `EXT` en SQL ; `FIA`, `CMP-21+` au navigateur), contrôles de lecture du code et des écrans (`LOG`, `DOC`, `CMP-01` à `CMP-11`), cases des listes A à K (`LISTES_DE_CONTROLE.md`).
> Entre crochets : statut au 25/10/2026 quand il n'est pas « réussi » : [É] échoué, [B] bloqué, [NE] non exécuté, [A] en attente d'un prérequis. Détail : `rapports/2026-10-25-controle-general.md`.

## 1. Types

| Type | Question posée |
|---|---|
| normal | le parcours prévu marche-t-il ? |
| limite | au bord d'un seuil (0, 1 h, 30 jours, plafond, 320 px) ? |
| erreur | une saisie fausse est-elle refusée avec un message clair ? |
| malveillant | un membre peut-il tricher, voir ou faire ce qu'il ne doit pas ? |
| concurrent | deux actions en même temps sur la même chose ? |
| panne | réseau coupé, envoi raté, renvoi, service absent ? |
| régression | une règle déjà corrigée ou décidée est-elle toujours respectée ? |

Fichiers : `regles-93` = `supabase/tests/regles-93-scenarios.sql`, etc. ; `e2e` = `e2e-parcours-scenarios.sql` (parcours a à l). Batteries : `CONTROLE_QUALITE/tests/sql/Uxx-*.sql` et `CONTROLE_QUALITE/tests/navigateur/Uxx-*.js` (liste dans `tools/controle/unites.json`, partie « batteries »).
« concurrent (1 transaction) » : deux actions jouées l'une après l'autre dans le même bloc ; la vraie simultanée (deux connexions) est toujours [A].

## 2. Matrice

| Unité | normal | limite | erreur | malveillant | concurrent | panne | régression |
|---|---|---|---|---|---|---|---|
| **U01** Logique métier | LOG-01 à LOG-09 ; `e2e` (a) ; `regles-93` A1, A5 ; liste D8 | LOG-13 [É] ; LOG-15 ; `regles-93` C | LOG-10 [É] ; `regles-93` A3, A4, A6 | LOG-14 [É] ; `regles-93` D | LOG-12 [É] | **trou** | STA-04 [É] ; LOG-11 [É] ; LOG-16 [A] ; listes D9, D10 |
| **U02** Sécurité | listes I1, I2 | SEC-05 [É] | **trou** (refus avec message clair : voir ANO-041) | SEC-01, SEC-02, SEC-03, SEC-04, SEC-06, SEC-07, SEC-11 [É] ; `confiance-94` bloc 1 ; `transport-83` G ; `fiabilite-84` E ; `boutiques-86` A ; listes G2 à G5, I3, I4 | SEC-09 (1 transaction) ; SEC-10 [A] | SEC-09 | SEC-08 ; liste A9 |
| **U03** Transactions et argent | ARG-01, ARG-05, ARG-06a, ARG-11 ; ARG-12, 13, 14 [A] ; `commission-95b` ; `transport-95` ; `e2e` (e) | ARG-09, ARG-10a, ARG-10b [É] ; `transport-95` (arrondis) | ARG-05, ARG-15 [É] | ARG-04, ARG-11 | ARG-16 [A] | ARG-07 | ARG-03, ARG-06b [É], ARG-08 ; STA-03 [É] ; listes D1, D2, D4 |
| **U04** Stocks et produits | STK-06 ; `boutiques-86` A, C ; `tableau-prix` 3, 4 | STK-03 [É], STK-04, STK-05, STK-07f [É], STK-11 [NE, règle en cours de changement] ; `tableau-prix` 1, 2 | `regles-93` A7 | STK-07 ; SEC-05 c [É] | STK-01, STK-08 (1 transaction) ; STK-10 [A] ; `e2e` (j) | **trou** | STK-02, STK-09 ; `stock-commandes` A ; `boutiques-86` B ; liste F10 |
| **U05** Commandes et négociations | `e2e` (a) | `e2e` (c), (d) | CMD-01, CMD-05, CMD-07, CMD-08 ; `e2e` (b) ; `fiabilite-84` A | CMD-02 ; `stock-commandes` C | CMD-03, CMD-09 [É], CMD-10 (1 transaction) ; CMD-13 [A] ; `e2e` (j) | CMD-11 ; `dm-anti-doublon` T1, T2 | CMD-04, CMD-06, CMD-12a, CMD-12b [É], CMD-12c [É], CMD-12d [É] ; `stock-commandes` B à D ; `fiabilite-84` H |
| **U06** Transport et livraison | TRA-01, TRA-02/03, TRA-05, TRA-11 (règle en cours de changement), TRA-15/16 ; `transport-83` B à F ; `e2e` (a) | TRA-04 ; `transport-95` cas 1 | TRA-02/03, TRA-10, TRA-15 ; `transport-83` A ; `e2e` (a) | TRA-06, TRA-07/08, TRA-09, TRA-12, TRA-13 ; `transport-83` G | TRA-05 (1 transaction) ; TRA-14 [A, + GPS réel] | EXT-08, EXT-09 (rangés en U14) | listes D3, D5, D7 |
| **U07** Profils et confiance | PRO-01 ; `niveaux-85` A à G | PRO-01, PRO-02 [É] ; `niveaux-85` ; `fiabilite-84` (paliers) | PRO-02 [É] | PRO-03 ; `confiance-94` | PRO-04 (1 transaction) ; PRO-05 [NE] | **trou** | PRO-03 ; liste D14 |
| **U08** Notifications | NOT-01 [NE] ; NOT-15 [A] ; `notifications-88` blocs 1 à 3 | NOT-10, NOT-12 [É], NOT-13/14 ; `notifications-88` blocs 5, 6 ; `alertes-ciblage` | **trou** | NOT-11, NOT-11d [É] | **trou** | `notif-objet-vivant` T3 | NOT-02 [É], NOT-03 [É], NOT-04 à 08, NOT-09 ; `notif-objet-vivant` T1, T2 ; listes A10, B6, D11 |
| **U09** Base de données | BDD-03 ; STA-12 ; `stockage-volume` | BDD-02 [É] | BDD-01 [É], BDD-02 [É], BDD-04 [É] | SEC-11 [É] ; listes G2 à G5 | BDD-05 (1 transaction) ; BDD-06 [A] | BDD-05 | liste G8 |
| **U10** Fiabilité technique | FIA-01, 05, 09 … 53 (erreurs JS, 14 écrans) ; FIA-02, 06 … 54 (écran vide) ; FIA-57, FIA-67 [É], FIA-68 ; FIA-71, 72 [A] ; STA-01, 02, 06, 07, 14 | FIA-03, 07 … 55 (débordement 390 et 320 px) ; FIA-58 [É] ; liste C6 | FIA-04, 08 … 56 [É ×14] (texte technique) ; APM-02, APM-03, APM-04 | **trou** | FIA-65, FIA-66 | FIA-59 [É], FIA-60 [É], FIA-61 à 64, FIA-69 ; FIA-73 [A] ; `dm-anti-doublon` T3, T3b ; liste C5 | FIA-70 ; APM-05, APM-06, APM-07 ; listes J1 à J3 |
| **U11** Administration | ADM-01 [É] ; `commission-95b` (lecture) ; `e2e` (e) | ADM-02 [É] | ADM-02 [É], ADM-03 | ADM-02 (l'admin juge son litige) [É], ADM-04 ; `stockage-volume` ; `confiance-94` | ADM-03 (1 transaction) | ADM-03 | ADM-05 |
| **U12** Compréhension | CMP-01 [É], 02 [É], 03, 04 [É], 05 [É], 06, 07 [É], 08, 09 [B], 10 [É], 11 [É] ; CMP-21 à CMP-26 ; STA-05 [É], 08 [É], 09, 10 [É], 11 [É] ; listes B, E, F | liste C6 (320 px, vu par FIA) | CMP-01 [É] ; liste B7 | — | — | liste C5 | listes A1 à A5 |
| **U13** Cohérence documentaire et commerciale | DOC-01 à DOC-03 [É], DOC-07 à 10 [É], DOC-11 ; DOC-12 [A] ; STA-13 ; listes K1 à K6 | **trou** | **trou** | — | — | — | DOC-04, 05, 06 [É] (code changé, texte non suivi) ; STA-03 [É] ; listes D12, D13, D15 |
| **U14** Situations extrêmes | **trou** | EXT-03, EXT-04, EXT-05a ; `alertes-ciblage` (250 abonnés) | EXT-06 [É] ; EXT-07 [NE, lecture du code] | EXT-03 (texte « SQL », émojis) | EXT-10/11 [A] (charge simultanée jamais testée) | EXT-08, EXT-09 ; EXT-10/11 [A] | EXT-01, EXT-02 [É], EXT-05b [É] |

« — » : type sans objet pour cette unité.

Trous à combler en priorité : U01 panne, U02 erreur, U04 panne, U07 panne, U08 erreur et concurrent, U10 malveillant, U13 limite et erreur, U14 normal ; et partout la vraie concurrence à deux connexions.

## 3. Listes A à K et unités

| Liste (`LISTES_DE_CONTROLE.md`) | Unités |
|---|---|
| A. Doublons | U12, U10 (A7, A8), U02 (A9), U08 (A10), U13 (A11) |
| B. Sur-explications | U12 |
| C. Bugs | U10 (C8 : U09) |
| D. Logique et cohérence | U01, U03, U06, U13 |
| E. À sa place | U12 |
| F. Design | U12 |
| G. Serveur (projet de test) | U09, U02 |
| H. Production (lecture seule) | U09, U02 |
| I. Sécurité | U02 |
| J. Cache | U10 |
| K. Documents | U13 |

## 4. Nommer un test

- Contrôle statique : `STA-01` à `STA-14` (fixés dans `tools/controle/unites.json`).
- Après modification : `APM-01` à `APM-08`, `APM-SQL-<schéma>`, `APM-FN-<fonction>`.
- Tests SQL du dépôt : `SQL-<nom du fichier>` (bloc entre parenthèses).
- Batteries du contrôle qualité : préfixe court de l'unité et numéro, fichier `CONTROLE_QUALITE/tests/sql/Uxx-<sujet>.sql` ou `CONTROLE_QUALITE/tests/navigateur/Uxx-<sujet>.js`. Préfixes pris : `LOG` (U01), `SEC` (U02), `ARG` (U03), `STK` (U04), `CMD` (U05), `TRA` (U06), `PRO` (U07), `NOT` (U08), `BDD` (U09), `FIA` (U10), `ADM` (U11), `CMP` (U12), `DOC` (U13), `EXT` (U14). Un nouveau test prend le numéro libre suivant ; un ID n'est jamais réutilisé.
