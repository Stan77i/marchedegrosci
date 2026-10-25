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

Scénarios de commande (`SCN-01` à `SCN-43`, unités U01, U05, U06) : partie 5.

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
- Batteries du contrôle qualité : préfixe court de l'unité et numéro, fichier `CONTROLE_QUALITE/tests/sql/Uxx-<sujet>.sql` ou `CONTROLE_QUALITE/tests/navigateur/Uxx-<sujet>.js`. Préfixes pris : `SCN` (scénarios de commande, U01, U05, U06 : partie 5), `LOG` (U01), `SEC` (U02), `ARG` (U03), `STK` (U04), `CMD` (U05), `TRA` (U06), `PRO` (U07), `NOT` (U08), `BDD` (U09), `FIA` (U10), `ADM` (U11), `CMP` (U12), `DOC` (U13), `EXT` (U14). Un nouveau test prend le numéro libre suivant ; un ID n'est jamais réutilisé.

## 5. Scénarios de commande (`SCN-xx`)

Tirés de `docs/regles/SCENARIOS-COMMANDE.md` (25/10/2026) : chaque scénario renvoie aux cases du tableau des combinaisons. Statut : nom du test existant, ou « à écrire ». Un « à écrire » qui attend une proposition (P1 à P19) s'écrit après la réponse du propriétaire.

| ID | Unité | Type | Scénario | Cases | Test existant ou statut |
|---|---|---|---|---|---|
| SCN-01 | U05 | normal | Parcours complet : accord, commande, confirmation, preuves, chargement, « arrivé », mot secret, clôture 1 h après | A-01, C-01, D-01, E-01, F-05, I-01 | `e2e` (a) |
| SCN-02 | U05 | limite | Accord sans commande pendant 72 h : « sans suite », quantité rendue ; commande créée après refusée | B-01, B-02 | `e2e` (c) |
| SCN-03 | U05 | erreur | Commande refusée par l'autre partie (motif obligatoire) : quantité rendue, ne compte contre personne | C-02 | `e2e` (b) ; `stock-commandes` A |
| SCN-04 | U05 | limite | Commande sans réponse 48 h : expirée, ne compte contre personne | C-04 | `stock-commandes` A |
| SCN-05 | U05 | limite | Vendeur ne charge pas : rappel 12 h avant, annulation de l'acheteur à 72 h, « abusive » contre le vendeur ; avant 72 h « TROP_TOT » | D-04, D-05 | `e2e` (d) ; `stock-commandes` B |
| SCN-06 | U06 | erreur | Chargement sans photos, sans poids, sans photo du papier ; papier après 3 min ; photos d'une autre commande | D-01, D-02, D-03 | LOG-02 ; TRA-13 |
| SCN-07 | U01 | régression | Marchandise en route 10 jours sans « arrivé » : aucun rappel, aucun litige, aucune clôture (règle du 25/10) | E-03 | à écrire (échouera avec la version actuelle de 99a) |
| SCN-08 | U06 | normal | Vendeur signale un retard avec motif et nouvelle date : journal et avis à l'acheteur | E-04 | à écrire (fonction absente) |
| SCN-09 | U06 | limite | Acheteur demande des nouvelles deux fois en moins de 6 h : la 2e est refusée ; à 6 h acceptée | E-05 | à écrire (fonction absente) |
| SCN-10 | U06 | normal | « Arrivé » du vendeur, confirmation avec le bon mot dans l'heure | F-01, F-05 | `litige-quantites-97` L2 ; `e2e` (a) |
| SCN-11 | U06 | limite | « Arrivé », acheteur muet : rappel à 30 min, litige à 60 min, clôture vendeur à 120 min, commission « calculée », litige perdu de l'acheteur | F-12, G-01, G-04 | `litige-quantites-97` L1, L4 ; TRA-11 |
| SCN-12 | U06 | normal | Pendant le litige automatique : message, refus avec photos ou mot secret ; plus de clôture automatique | G-02, G-03 | `litige-quantites-97` L2 |
| SCN-13 | U06 | normal | Délai justifié 2 h, 6 h, 24 h : pas de litige pendant le délai, même suite après | F-10 | à écrire (fonction absente) |
| SCN-14 | U06 | erreur | 2e demande de délai refusée | F-11 | à écrire (fonction absente) |
| SCN-15 | U06 | erreur | Mot faux, 5 essais, mot bloqué, alerte aux deux et à l'équipe | F-06, F-07 | TRA-12 ; `stock-commandes` C |
| SCN-16 | U01 | limite | Mot bloqué pendant l'heure puis litige automatique : l'acheteur ne doit pas perdre automatiquement | F-08 | à écrire (attend la réponse à la proposition P4) |
| SCN-17 | U06 | normal | Mot oublié : réception « sans le mot » ; refus sans mot non accepté | F-09 | TRA-12 |
| SCN-18 | U06 | normal | Refus partiel avec photos et mot, chauffeur et vendeur répondent, refus tranché par l'équipe | F-14, H-04 | à écrire (refus partiel jusqu'à `admin_refus_trancher`) |
| SCN-19 | U05 | normal | Issues du litige : vendeur, acheteur, partage ; fiabilité (partage ne compte contre personne) ; commission | H-01, H-02, H-03 | `stock-commandes` C (partage) ; `e2e` (e) ; vendeur et acheteur : à écrire |
| SCN-20 | U05 | normal | Demande d'annulation du vendeur : acceptée (d'accord / pas d'accord), refusée, redemandée, 2 refus puis équipe | D-06, D-07 | `stock-commandes` B ; `fiabilite-84` A |
| SCN-21 | U05 | concurrent | Vendeur demande l'annulation puis charge : demande retirée | D-09 | CMD-09 [É] ; `corrections-99` 99-B (branche) |
| SCN-22 | U05 | limite | Demande d'annulation du vendeur sans réponse jusqu'à 72 h : qui est compté en faute ? | D-08 | à écrire (attend la réponse à P8) |
| SCN-23 | U01 | malveillant | Vendeur banni avant le chargement : l'acheteur annule tout de suite, compte contre le vendeur | D-10 | `corrections-99` 99-C (branche) ; EXT-06 [É] |
| SCN-24 | U01 | limite | Vendeur banni pendant le trajet : la commande ne doit pas rester sans fin | E-09 | à écrire (attend P5) |
| SCN-25 | U01 | limite | Acheteur banni avant et après le chargement, et pendant l'heure après « arrivé » | D-11, E-10, F-17 | à écrire (attend P6) |
| SCN-26 | U01 | erreur | Membre suspendu : plus de proposition ni d'accord ; ses commandes en cours continuent | A-06, D-12, E-11 | `controle-corrections-98` blocs 3, 4 ; `fiabilite-84` D/E |
| SCN-27 | U01 | erreur | Suppression du compte avec commande, litige, accord récent ou suspension : refusée | B-06, D-15, J-03 | `controle-corrections-98` blocs 1, 2 |
| SCN-28 | U05 | concurrent | Commande créée deux fois (double appui, coupure) | B-03 | CMD-04 |
| SCN-29 | U05 | concurrent | Message de l'acheteur dans le litige à l'instant de la clôture automatique | G-05 | à écrire [A : deux connexions] |
| SCN-30 | U01 | limite | « Arrivé » déclaré à 23 h : quand part l'heure ? | F-04, G-07, J-04 | LOG-13 [É] ; à écrire après la réponse à P3 |
| SCN-31 | U05 | panne | Confirmation de réception renvoyée après une coupure | F-19 | à écrire |
| SCN-32 | U05 | normal | Achat groupé : commandes confirmées, transport de l'offre, annulation comptée une fois | J-01 | à écrire |
| SCN-33 | U05 | erreur | Prix ou quantité changés pendant la négociation ; ancienne proposition acceptée ; annonce figée ; prix 0 F, montant énorme | A-01, A-02, A-03 | CMD-03 ; `regles-93` ; `litige-quantites-97` L4 ; `corrections-99` 99-D (branche) |
| SCN-34 | U06 | normal | Les 4 transports : livreur du vendeur (même ville), retrait accepté, inclus, à part, à la charge de l'acheteur ; total et commission | C-05 à C-09, A-04 | `transport-95` ; LOG-03, LOG-05 ; CMD-11b |
| SCN-35 | U06 | erreur | Transporteur Marché de Gros choisi : refusé, service fermé | A-05, C-10 | LOG-04 ; `transport-95` |
| SCN-36 | U06 | normal | L'acheteur dit « arrivé » lui-même : quel délai démarre ? | F-03 | `stock-commandes` D (règle d'avant) ; `corrections-99` 99-A (branche) ; à écrire après P2 |
| SCN-37 | U05 | normal | Clôture « en faveur du vendeur » : l'avis part bien aux deux | G-04 | à écrire (écart lu dans le code : `push_commande` ignore « terminee ») |
| SCN-38 | U05 | normal | Participation « partie » proposée à l'arrivée (ouvre le litige), acceptée : commande terminée, total = part gardée, commission calculée sur elle, aucun litige perdu | K-04, K-06, K-10 | `participation-102` 102-A (c1) |
| SCN-39 | U05 | erreur | Participation : sans motif, quantité trop grande, 0 F, plus que le total, transport sans prix à part, mauvais rôle, avant « arrivé » | K-03, K-05, K-08, K-17 | `participation-102` 102-A (c1, c2, c4) |
| SCN-40 | U05 | limite | Double appui, autre proposition pendant qu'une attend, retrait deux fois, plafond de 3 | K-09, K-13, K-15 | `participation-102` 102-A (c1, c2) |
| SCN-41 | U05 | normal | Litige automatique puis proposition : pas de clôture pour le vendeur ; 24 h sans réponse : expirée, litige à l'équipe | K-12, K-14 | `participation-102` 102-A (c3) |
| SCN-42 | U05 | normal | L'équipe tranche pendant une proposition ouverte : caduque, le vendeur ne peut plus répondre | K-16 | `participation-102` 102-A (c5) |
| SCN-43 | U03 | normal | « Transport seulement » accepté : total = prix du transport, commission 0 | K-03, K-10 | `participation-102` 102-A (c6) |
