<!-- Copie du dernier rapport écrit par tools/controle/lancer.sh (fichier daté : rapports/2026-11-17-09h03-apres-modif.md). Ne pas modifier à la main. -->
# Rapport du contrôle qualité · 17/11/2026 à 09 h 03 (UTC = heure d’Abidjan)

> Gabarit : `CONTROLE_QUALITE/modeles/RAPPORT.md`. Fait par `tools/controle/lancer.sh apres-modif`. Les tests SQL ne sont jamais exécutés par ce script : ils sont « non exécuté » tant que Claude ne les a pas joués via MCP sur le projet de test.

## 1. Identité du passage

| Champ | Valeur |
|---|---|
| Date | 17/11/2026 à 09 h 03 |
| Commit | `bdb3cd0` (branche `claude/produit-demande`, avec des changements non enregistrés) |
| Mode | `apres-modif` |
| Base de comparaison | `origin/main` |
| Durée | 2 s |
| Lancé par | à la main ou par Claude |

## 2. En bref

- **Aucun échec bloquant** ; réussis 15, échoués 3, bloqués 0, non exécutés 3, en attente 1.
- Unités avec au moins un contrôle exécuté : U01, U03, U09, U10, U12, U13.
- Unités non exécutées dans ce passage : U02, U04, U05, U06, U07, U08, U11, U14.

## 3. Tests

| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Gravité | Preuve |
|---|---|---|---|---|---|---|---|---|
| STA-01 | U10 | normal | Contrôle « syntaxe » | aucun constat | rien à signaler (84 fichiers et scripts lus sans erreur) | réussi | — | tools/controle/controle.js |
| STA-02 | U10 | normal | Contrôle « cache » | aucun constat | rien à signaler (111 appels avec ?v=, liste CORE et images de sw.js ; voir « Pour information ») | réussi | — | tools/controle/controle.js |
| STA-03 | U13, U03 | normal | Contrôle « mots-interdits » | aucun constat | rien à signaler (5896 textes relus) | réussi | — | tools/controle/controle.js |
| STA-04 | U01 | normal | Contrôle « communes » | aucun constat | rien à signaler (textes, champs ville et liste des villes (app/villes.js)) | réussi | — | tools/controle/controle.js |
| STA-05 | U12 | normal | Contrôle « doublon-texte » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 30 orange(s) | échoué | P2 | app/theme.js:130 ; v3/chauffeur.js:24 ; app/theme.js:130 ; … |
| STA-06 | U10 | normal | Contrôle « doublon-fonction » | aucun constat | rien à signaler (76 fichiers JS et les scripts des pages) | réussi | — | tools/controle/controle.js |
| STA-07 | U10 | normal | Contrôle « doublon-id » | aucun constat | rien à signaler (identifiants du HTML de application.dc.html et index-v3.html) | réussi | — | tools/controle/controle.js |
| STA-08 | U12 | normal | Contrôle « long-texte » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 33 orange(s) | échoué | P2 | v3/identite.js:439 ; v3/commandes.js:1028 ; v3/vendre.js:156 ; … |
| STA-09 | U12, U13 | normal | Contrôle « slogan » | aucun constat | rien à signaler (tournures publicitaires toutes faites) | réussi | — | tools/controle/controle.js |
| STA-10 | U12 | normal | Contrôle « police » | aucun constat | rien à signaler (93 fichiers de style et de code) | réussi | — | tools/controle/controle.js |
| STA-11 | U12 | normal | Contrôle « bleu » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 5 orange(s) | échoué | P2 | index-v3.html:2047 ; v3/avatar.js:13 ; v3/avatar.js:14 ; … |
| STA-12 | U09 | normal | Contrôle « sql » | aucun constat | rien à signaler (167 fichiers supabase/schema-*.sql ; voir « Pour information ») | réussi | — | tools/controle/controle.js |
| STA-13 | U13 | normal | Contrôle « liens » | aucun constat | rien à signaler (CLAUDE.md, CONTROLE_QUALITE/CALENDRIER.md, CONTROLE_QUALITE/HISTORIQUE.md, CONTROLE_QUALITE/INVENTAIRE_OUTILS.md, CONTROLE_QUALITE/LISTES_DE_CONTROLE.md, CONTROLE_QUALITE/MATRICE_TESTS.md, CONTROLE_QUALITE/README.md, CONTROLE_QUALITE/REGISTRE_ANOMALIES.md, CONTROLE_QUALITE/REGISTRE_DES_TESTS.md, CONTROLE_QUALITE/modeles/RAPPORT.md, CONTROLE_QUALITE/procedures/APRES_INCIDENT.md, CONTROLE_QUALITE/procedures/APRES_MODIFICATION.md, CONTROLE_QUALITE/procedures/AVANT_PRODUCTION.md, CONTROLE_QUALITE/procedures/CONTROLE_GENERAL.md, CONTROLE_QUALITE/tests/navigateur/README.md, CONTROLE_QUALITE/tests/sql/README.md) | réussi | — | tools/controle/controle.js |
| STA-14 | U10 | normal | Contrôle « navigateur » | contrôle fait | désactivé (--sans-navigateur) | non exécuté | — | tools/controle/controle.js |
| APM-01 | U10 | normal | Lister les fichiers changés depuis origin/main (fd4fff5) | liste | 30 fichier(s) | réussi | — | git diff --name-only fd4fff5 |
| APM-02 | U10 | régression | node --check sur les 5 fichier(s) JS changé(s) | aucune erreur | aucune erreur | réussi | — | app/produits-plus.js, sw.js, v2/search.js, v3/aide.js, v3/equipe.js |
| APM-03 | U10 | normal | JSON changés lisibles | lisibles | lisibles | réussi | — | tools/controle/unites.json |
| APM-05 | U10 | régression | 7 fichier(s) du front changé(s) : CACHE de sw.js monté | CACHE différent de la base | mgci-v327 → mgci-v328 | réussi | — | sw.js ; fichiers : app/produits-plus.js, application.dc.html, css/v2-equipe.css, css/v2.css, v2/search.js, v3/aide.js… |
| APM-06 | U10 | régression | ?v= monté pour chaque JS/CSS changé appelé avec ?v= | nouvelle version | monté partout | réussi | — | application.dc.html, index-v3.html, index.html, admin.html, suivi.html, sw.js |
| APM-SQL-104 | U04, U11, U08, U02 | normal | Schéma changé : supabase/schema-104-produits-demandes.sql | tests SQL liés rejoués sur le projet de TEST | à lancer par Claude via MCP : supabase/tests/produits-104-scenarios.sql | non exécuté | — | procédure : CONTROLE_QUALITE/procedures/APRES_MODIFICATION.md |
| APM-FN-pousser | U10, U08 | normal | Fonction externe changée : pousser | testée | impossible ici (ni Deno ni clés push ni réseau Supabase) | en attente | — | prérequis : clés push du projet de test et accès réseau (CONTROLE_QUALITE/INVENTAIRE_OUTILS.md) |
| APM-08 | U09 | normal | Tests SQL ajoutés ou changés | rejoués sur le projet de TEST | à lancer par Claude via MCP : supabase/tests/produits-104-scenarios.sql | non exécuté | — | aucun accès base depuis ce script |

## 4. Anomalies (P0 à P3)

Gravité donnée par le script, à confirmer par Claude dans `CONTROLE_QUALITE/REGISTRE_ANOMALIES.md` (rouge du contrôle statique = P1, erreur de syntaxe ou du navigateur = P0, orange = P2).

- **STA-05** (P2, U12) : 0 rouge(s) dont 0 nouveau(x), 30 orange(s). Preuve reproductible : `bash tools/controle/lancer.sh apres-modif` ; app/theme.js:130 ; v3/chauffeur.js:24 ; app/theme.js:130 ; ….
- **STA-08** (P2, U12) : 0 rouge(s) dont 0 nouveau(x), 33 orange(s). Preuve reproductible : `bash tools/controle/lancer.sh apres-modif` ; v3/identite.js:439 ; v3/commandes.js:1028 ; v3/vendre.js:156 ; ….
- **STA-11** (P2, U12) : 0 rouge(s) dont 0 nouveau(x), 5 orange(s). Preuve reproductible : `bash tools/controle/lancer.sh apres-modif` ; index-v3.html:2047 ; v3/avatar.js:13 ; v3/avatar.js:14 ; ….

## 5. Risque métier, correctif, non-régression

À remplir par Claude pour chaque anomalie retenue, dans `CONTROLE_QUALITE/REGISTRE_ANOMALIES.md` (le script ne juge pas le risque métier). Détail des constats statiques : `node tools/controle/controle.js` puis `rapport-controle.md`.

## 6. Risques résiduels et limites de ce passage

- Aucun test SQL exécuté par ce script (aucun accès à la base) : 2 ligne(s) SQL restent « non exécuté », à jouer par Claude via MCP sur le projet de test.
- Le navigateur ne joint pas Supabase : l’application est ouverte sans données réelles.
- Non vérifiables ici : vrais paiements (aucun branché), charge simultanée, fonctions externes `pousser` et `itineraire`, vrai téléphone, SMS (voir `CONTROLE_QUALITE/INVENTAIRE_OUTILS.md`).
- En cours de changement : litige en 1 h, quantité minimale, garde 93 qui prévient (97b-97d, PR #306) ; suppression de compte et suspension (98a-98b, PR #305) : fusionnés le 25/10/2026, appliqués sur le projet de test, production à confirmer (schémas 97b, 97c, 97d, 98a, 98b, branche `main (PR #305 et #306)`) : un test écrit avant ces schémas (délais de 24 h, ancienne quantité gardée, suppression de compte acceptée) est rejoué et mis à jour, pas déclaré « échoué » sans relecture.

