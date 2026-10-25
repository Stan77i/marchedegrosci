# Matrice des tests : unité × type

> Chaque case donne les identifiants des tests qui couvrent cette unité pour ce type de situation. Case vide = **trou de couverture**, pas « tout va bien ».
> Rempli le 25/10/2026 avec ce qui existe : contrôles statiques (`STA-xx`, `tools/controle/unites.json`), contrôles après modification (`APM-xx`, `tools/controle/lancer.js`), tests SQL de `supabase/tests/` (nom court + bloc), cases des listes A à K (`LISTES_DE_CONTROLE.md`).
> Le classement des tests SQL par type est une lecture de leur description (`REGISTRE_DES_TESTS.md`), à confirmer à leur prochain rejeu.
> « **à remplir par l'intégration** » : les batteries des unités (U02 à U14) écrites par les équipes du contrôle qualité arrivent dans `CONTROLE_QUALITE/tests/` ; l'équipe d'intégration met leurs ID ici.

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

Abréviations des fichiers SQL : `regles-93` = `supabase/tests/regles-93-scenarios.sql`, etc. ; `e2e` = `e2e-parcours-scenarios.sql` (parcours a à j).

## 2. Matrice

| Unité | normal | limite | erreur | malveillant | concurrent | panne | régression |
|---|---|---|---|---|---|---|---|
| **U01** Logique métier | `e2e` (a) ; `regles-93` A1, A5 ; liste D8 | `regles-93` C (30 jours, prolongation) | `regles-93` A3, A4 (ville inconnue), A6 (prix requis) | `regles-93` D (achat groupé hors ville, membre suspendu) | à remplir par l'intégration | à remplir par l'intégration | STA-04 (communes) ; listes D9, D10 |
| **U02** Sécurité | listes I1, I2 | à remplir par l'intégration | à remplir par l'intégration | `confiance-94` bloc 1 (noms réservés) ; `transport-83` G (droits des rôles) ; `fiabilite-84` E (droits) ; `boutiques-86` A (anon refusé) ; listes G2 à G5, I3, I4 | à remplir par l'intégration | à remplir par l'intégration | liste A9 (anciennes fonctions encore appelables) |
| **U03** Transactions et argent | `commission-95b` ; `transport-95` (6,9 % réseau, 0 % livreur du vendeur) ; `e2e` (e) | `transport-95` (arrondis FCFA, 270 000 + 30 000) | à remplir par l'intégration | à remplir par l'intégration (aucun paiement branché : tests d'argent réel « en attente : partenaire agréé ») | à remplir par l'intégration | à remplir par l'intégration | STA-03 (« PAYÉ », « encaissé ») ; listes D1, D2, D4 |
| **U04** Stocks et produits | `boutiques-86` A, C ; `tableau-prix` 3, 4 | `tableau-prix` 1 (prix aberrant), 2 (offre de plus de 30 jours) | `regles-93` A7 (quantité vide) | à remplir par l'intégration | `e2e` (j) (2 acceptations, même stock) | à remplir par l'intégration | `stock-commandes` A (le stock revient) ; `boutiques-86` B (ancienne quantité, règle 93) ; liste F10 |
| **U05** Commandes et négociations | `e2e` (a) | `e2e` (c) (72 h sans suite), (d) (72 h sans chargement) | `e2e` (b) (refus, motif obligatoire) ; `fiabilite-84` A (motifs) | `stock-commandes` C (mot secret limité) | `e2e` (j) | `dm-anti-doublon` T1, T2 (message envoyé 2 fois) | `stock-commandes` B à D ; `fiabilite-84` H (motif, test mis à jour après 92) |
| **U06** Transport et livraison | `transport-83` B à F ; `e2e` (a) | `transport-95` cas 1 (service fermé, seuil de 3 transporteurs) | `transport-83` A (`DEPART_PREUVES`) ; `e2e` (a) (chargement refusé sans preuves, mauvais mot) | `transport-83` G | à remplir par l'intégration | à remplir par l'intégration | listes D3, D5, D7 |
| **U07** Profils et confiance | `niveaux-85` A à G | `niveaux-85` (12 mois glissants, seuils) ; `fiabilite-84` (paliers) | à remplir par l'intégration | `confiance-94` (plafonds contre les complices, photo unique, numéro de pièce, date non modifiable) | à remplir par l'intégration | à remplir par l'intégration | liste D14 |
| **U08** Notifications | `notifications-88` blocs 1 à 3 | `notifications-88` blocs 5, 6 (plafond, heures calmes) ; `alertes-ciblage` (250 abonnés) | à remplir par l'intégration | à remplir par l'intégration | à remplir par l'intégration | `notif-objet-vivant` T3 (envoi raté, 3 échecs) | `notif-objet-vivant` T1, T2 (offre retirée) ; listes A10, B6, D11 |
| **U09** Base de données | STA-12 (SQL qui efface) ; `stockage-volume` | à remplir par l'intégration | à remplir par l'intégration | listes G2 à G5 | à remplir par l'intégration | à remplir par l'intégration | liste G8 (fonctions du dépôt = celles du test) |
| **U10** Fiabilité technique | STA-01, STA-02, STA-06, STA-07, STA-14 | liste C6 (320 px) | APM-02 (`node --check`), APM-03, APM-04 | à remplir par l'intégration | à remplir par l'intégration | `dm-anti-doublon` T3, T3b ; liste C5 (hors connexion) | APM-05 (CACHE), APM-06 (`?v=`), APM-07 (IMAGES) ; listes J1 à J3 |
| **U11** Administration | `commission-95b` (lecture admin) ; `e2e` (e) (l'équipe partage) | à remplir par l'intégration | à remplir par l'intégration | `stockage-volume` (membre refusé) ; `confiance-94` (journal admin) | à remplir par l'intégration | à remplir par l'intégration | à remplir par l'intégration |
| **U12** Compréhension | STA-05, STA-08, STA-09, STA-10, STA-11 ; listes B, E, F | liste C6 | liste B7 (messages d'erreur) | — | — | liste C5 | listes A1 à A5 |
| **U13** Cohérence documentaire et commerciale | STA-13 (liens) ; listes K1 à K6 | à remplir par l'intégration | à remplir par l'intégration | — | — | — | STA-03 ; listes D12, D13, D15 |
| **U14** Situations extrêmes | à remplir par l'intégration | `alertes-ciblage` (250 abonnés) | à remplir par l'intégration | à remplir par l'intégration | à remplir par l'intégration (charge simultanée : jamais testée, voir `REGISTRE_DES_TESTS.md` partie 3) | à remplir par l'intégration | à remplir par l'intégration |

« — » : type sans objet pour cette unité.

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
- Batteries du contrôle qualité : préfixe court de l'unité et numéro (ex. `STK-04` pour U04), fichier `CONTROLE_QUALITE/tests/sql/Uxx-<sujet>.sql` ou `CONTROLE_QUALITE/tests/navigateur/Uxx-<sujet>.js`.
