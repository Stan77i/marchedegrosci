# Registre des tests

> Tous les tests du serveur, ce qu'ils vérifient, leur dernier résultat connu. **Un test qui n'a pas tourné est « non rejoué », jamais « passe ».**
> Source des résultats au 25/10/2026 : rapport de bout en bout de l'étape 7 (session du 24/10/2026 au soir, rejeux de 22 h 50 au 25/10/2026 à 0 h 30, projet de test), notes écrites dans chaque fichier et `docs/PASSATION.md`.
> Centre de commande : `README.md` de ce dossier. Classement par unité et par type : `MATRICE_TESTS.md`.
> Contrôle général du 25/10/2026 : les 18 fichiers de la partie 1 **n'ont pas été rejoués** (le temps est allé aux nouvelles batteries, partie 1 bis) : leurs résultats restent ceux des dates écrites.
> Mise à jour : la session de contrôle propose les nouveaux résultats dans son rapport ; ce fichier est corrigé dans une PR à part (ou dans la PR qui ajoute le test).

## 1. Fichiers `supabase/tests/*.sql`

Tous se jouent sur le **projet de test** `yowdymdnoiubatxlwhfv`, jamais sur la production. Chaque bloc finit par `raise exception 'TEST…'` : tout est annulé. Comptes utilisés : comptes de simulation du projet de test.

| Fichier | Ce qu'il vérifie (une ligne) | Projet | Dernier résultat connu |
|---|---|---|---|
| `alertes-ciblage-scenarios.sql` | Schéma 96f : 250 abonnés à un produit sont tous prévenus d'une nouvelle annonce. | Test | **Passe** (24/10/2026, soir, étape 7) |
| `boutiques-86-scenarios.sql` | Schéma 86 : activer sa boutique, adresse (pseudo ou code court), lecture sans compte, mesure des visites, « retirer » cache sans effacer, stock. | Test | A et C **passent** ; B changé par la règle 93 (ancienne quantité), test mis à jour sur la branche `claude/e2e-corrections` puis **passe** (25/10/2026, 0 h 20-0 h 30) |
| `commission-95b-scenarios.sql` | Schéma 95b : clôture sans argent passé → commission « calculée » ; avec séquestre → « due » ; ancienne ligne « due » inchangée ; lecture admin et vendeur. | Test | **Passe** (24/10/2026, soir) |
| `confiance-94-scenarios.sql` | Schéma 94 : noms réservés à l'équipe, badge vérifié lié au nom, numéro de pièce, journal admin, plafonds des badges contre les complices, signalements sans masquage automatique, litiges perdus imputés, force majeure, photo unique, date non modifiable. | Test | **Passe**, 10 blocs identiques aux résultats écrits (24/10/2026, 23 h 28) |
| `dm-anti-doublon-scenarios.sql` | Schéma 96c (puis 97a) : un message envoyé 2 fois ne fait qu'une ligne ; ancien téléphone sans identifiant ; même identifiant dans une autre conversation ; identifiant invalide refusé. | Test | **Passe** après 97a (25/10/2026, 0 h 15) ; T3 mis à jour et T3b ajouté sur `claude/e2e-corrections` ; 97a appliqué sur le test seulement |
| `fiabilite-84-scenarios.sql` | Schéma 84 : classement des annulations et motifs, paliers, suspension, contestation, droits des rôles, confidentialité de « Ma fiabilité ». | Test | A et D/E **passent** ; H échouait (« Choisissez un motif. », test périmé depuis 92), mis à jour sur `claude/e2e-corrections` puis **passe** (25/10/2026) |
| `niveaux-85-scenarios.sql` | Schéma 85 (+ 94d) : badges vendeur et acheteur, seuils, 12 mois glissants, plafond par partenaire, délai minimum, recalcul de tous. | Test | **Passe**, blocs A à G (24/10/2026, 23 h 28-23 h 31 ; seul écart : nombre de membres recalculés, donnée vivante) |
| `notif-objet-vivant-scenarios.sql` | Schéma 96b : aucune notification pour une offre retirée (message « périmé », `objet_perime`). | Test | **Passe** (24/10/2026, soir) |
| `notifications-88-scenarios.sql` | Schéma 88 (+ 91, 96b) : plafond commercial, ouverture comptée, ciblage (région, suivi, déjà acheté, ville seulement), groupes, heures calmes, permission du téléphone. | Test | Blocs 1, 2, 3, 5, 6 **passent** ; bloc 4 changé (un seul lot commercial par passage depuis 96b, voulu), note ajoutée sur `claude/e2e-corrections` |
| `regles-93-scenarios.sql` | Schéma 93 : annonce valable 30 jours, doublon, ville inconnue ou commune hors région refusée, annonce figée pendant une négociation, quantité vide, ancienne quantité, achat groupé hors ville, membre suspendu. | Test | **Passe**, blocs A à E (24/10/2026, soir) |
| `stock-commandes-scenarios.sql` | Schéma 92 : le stock revient quand la vente tombe ; commande confirmée jamais chargée ; mot secret limité ; réception sans réponse ; litiges avec échéance et partage ; journal. | Test | **Passe**, blocs A à D (24/10/2026, soir) |
| `stockage-volume-scenarios.sql` | Schéma 96e : `stockage_volume()` réservé à l'équipe, volumes par espace de stockage. | Test | **Passe** (24/10/2026) |
| `tableau-prix-scenarios.sql` | Schéma 96a : prix aberrant écarté, offres de plus de 30 jours hors prix, recalcul, lecture du tableau gardé. | Test | **Passe** (24/10/2026, soir) |
| `transport-83-scenarios.sql` | Schéma 83 : même ville (livreur du vendeur, retrait), villes différentes, transport inclus ou à part, transporteur réseau, droits des rôles. | Test | A échouait (`DEPART_PREUVES`, test périmé depuis 90/90b), mis à jour sur `claude/e2e-corrections` puis **passe** (25/10/2026) ; B à J **passent** |
| `transport-95-scenarios.sql` | Schéma 95 : service transport fermé, seuil de transporteurs vérifiés, 6,9 % seulement avec le réseau, 0 % pour le livreur du vendeur, transport à part (270 000 + 30 000), arrondis FCFA, textes de clôture. | Test | **Passe** (24/10/2026, soir) |
| `controle-corrections-98-scenarios.sql` (PR #305) | Schémas 98a et 98b : pas de suppression du compte avec une commande en cours, un litige, un accord sans commande ou une suspension ; un membre suspendu (ou son partenaire) ne propose plus de prix ni ne conclut d'accord. | Test | Résultats écrits sous chaque bloc par l'équipe de correction (25/10/2026) ; **non rejoué** par le contrôle |
| `litige-quantites-97-scenarios.sql` (PR #306) | Schémas 97b, 97c, 97d : litige en 1 h après « livré », quantité minimale et achat par parties, litige perdu pour l'acheteur muet, garde 93 qui prévient. | Test | Résultats écrits sous chaque bloc par l'équipe (25/10/2026) ; **non rejoué** par le contrôle |
| `e2e-parcours-scenarios.sql` (dans `main` depuis la PR #300) | Les parcours complets de bout en bout (partie 2). | Test | Voir partie 2 |

`claude/e2e-corrections` est fusionnée (PR #300) : les mises à jour notées ci-dessus « sur `claude/e2e-corrections` » sont dans `main`. Les résultats « passe » restent ceux des dates écrites : **non rejoué** depuis.

## 1 bis. Batteries du contrôle qualité (`CONTROLE_QUALITE/tests/`, ajoutées le 25/10/2026)

Jouées pour la première fois le 25/10/2026 (projet de **test** pour le SQL ; navigateur avec données factices). Détail ligne par ligne : `rapports/2026-10-25-controle-general.md` et ses annexes (`rapports/annexes/`). Les fichiers SQL de U03 à U06, U08 et U14 se lancent après `tests/sql/_outils.sql`, dans le même appel ; ceux de U02, U07, U09 et U11 ont leurs outils en tête.

| Fichier | Ce qu'il vérifie (une ligne) | Projet | Dernier résultat connu (25/10/2026) |
|---|---|---|---|
| `tests/sql/U02-securite.sql` | SEC-01 à 11 : un tiers, un visiteur, un faux admin, un suspendu, injection, abus, failles d'octobre, coupure au milieu, droits des tables | Test | 8 réussis, 2 échoués (SEC-05 c, SEC-11), 1 en attente (SEC-10 : deux connexions) |
| `tests/sql/U03-argent.sql` | ARG-01 à 16 : commission prévue puis calculée, double clôture, fraude sur le registre, dépôt (fonction de service), arrondis, plafonds, litige | Test | 10 réussis, 3 échoués (ARG-06b, ARG-10b, ARG-15), 4 en attente (paiement réel ×3, deux connexions) |
| `tests/sql/U04-stocks.sql` | STK-01 à 11 : deux acheteurs sur le même reste, stock rendu une fois, bornes de prix et quantités, unités, pause, demandes | Test | 8 réussis, 2 échoués (STK-03, STK-07f), 1 en attente (STK-10), 1 non exécuté (STK-11 : règle 97c en cours de changement) |
| `tests/sql/U05-commandes.sql` | CMD-01 à 13 : expiration, arrêt 24 h, tiers, contre-propositions croisées, étapes sautées, annulation croisée, coupure, sorties automatiques | Test | 11 réussis, 4 échoués (CMD-09, CMD-12b, 12c, 12d), 1 en attente (CMD-13) |
| `tests/sql/U06-transport.sql` | TRA-01 à 16 : service fermé, prix à trois, changement de prix, codes, mot secret, preuves au départ, refus du transporteur | Test | 12 réussis (TRA-11 : règle en cours de changement), 1 en attente (TRA-14 : deux connexions, GPS réel) |
| `tests/sql/U07-profils.sql` | PRO-01 à 05 : limites du profil, pièce expirée, suppression du compte en commande, badge et fausses commandes, deux dossiers | Test | 3 réussis, 1 échoué (PRO-02), 1 non exécuté (PRO-05 : préparer un changement de niveau récent) |
| `tests/sql/U08-notifications.sql` | NOT-01 à 15 : file d'attente, données périmées, objet vivant, doublon, droits, compte supprimé, heures calmes, plafond | Test | 5 réussis, 4 échoués (NOT-02, NOT-03, NOT-11d, NOT-12), 1 non exécuté (NOT-01 : aucune cible), 1 en attente (NOT-15 : clés push) |
| `tests/sql/U09-base.sql` | BDD-01 à 06 : clés étrangères, valeurs impossibles, déclencheurs, 31 contrôles de cohérence, coupure, double prise de stock | Test (lecture + blocs annulés) | 2 réussis, 3 échoués (BDD-01, BDD-02, BDD-04), 1 en attente (BDD-06) |
| `tests/sql/U11-admin.sql` | ADM-01 à 05 : traces des 12 actions sensibles, 23 valeurs absurdes, admin juge et partie, doubles actions, fonctions fermées | Test | 3 réussis, 2 échoués (ADM-01, ADM-02) |
| `tests/sql/U14-extremes.sql` | EXT-01 à 11 : renvoi après coupure, textes extrêmes, cadence, double dépôt, vendeur banni, compte supprimé, photo perdue | Test | 6 réussis, 2 échoués (EXT-02, EXT-06), 1 non exécuté (EXT-07 : lecture du code), 1 en attente (EXT-10/11) |
| `tests/navigateur/U10-fiabilite.js` | FIA-01 à 73 : 14 écrans × 4 profils (iPhone 13 clair/sombre, 320 px), temps, poids, 3G lente, coupure, panne, double clic, tutoriel, service worker | Navigateur (données factices) | 52 réussis, 18 échoués (14 × « [object Object] », FIA-58, 59, 60, 67), 3 en attente ; **relancé** par `lancer.sh navigateur` sur le commit d'intégration : mêmes chiffres |
| `tests/navigateur/U12-parcours.js` | CMP-21 à 26 : écrans d'une commande à chaque étape (charger, recevoir, vérifier, litige, annulée, en route) | Navigateur (données factices) | 6 réussis (nouveau, lancé le 25/10/2026 par `lancer.sh navigateur` et seul avec `python3 -m http.server`) |

Non automatisés (jugement de Claude, à refaire à chaque contrôle général) : LOG-01 à 16 (règle écrite → dernière définition, `python3 tools/controle/fn.py <fonction>`), DOC-01 à 12 (documents → code), CMP-01 à 11 (captures). Résultats du 25/10/2026 : LOG 10 réussis, 5 échoués, 1 en attente ; DOC 1 réussi, 10 échoués, 1 en attente ; CMP-01 à 11 : 3 réussis, 7 échoués, 1 bloqué.

## 2. Parcours de bout en bout (étape 7)

Fichier : `supabase/tests/e2e-parcours-scenarios.sql`. Comptes : S vendeur (Yamoussoukro), B acheteur (Daloa), ADM administrateur. Les fonctions sont appelées comme dans l'application, avec le rôle `authenticated`. Les fonctions `pg_temp.*` d'en-tête se lancent dans le **même appel** que chaque bloc.

Avant les parcours (étape 1) : 121 fonctions des schémas 92a à 96f comparées au test (md5 du corps, commentaires `--` retirés, blancs ramenés à un espace) : 121/121 identiques le 24/10/2026.

| Parcours | Ce qu'il joue | Dernier résultat |
|---|---|---|
| (a) | Offre → négociation → accord → commande → confirmation → chargement refusé sans preuves → photos, poids, papier du mot secret → chargement → arrivée → mauvais mot refusé → bon mot → réception → 1 h → clôture → commission « calculée » → fiabilité 100 % → aucun badge (1 commande, seuil 3) | **Passe** (24/10/2026, 23 h 40) |
| (b) | Commande refusée par le vendeur : motif obligatoire, le stock revient, commission annulée | **Passe** (24/10/2026, 23 h 58-0 h 05) |
| (c) | Accord sans commande pendant 72 h → « sans suite », stock rendu ; commande ensuite refusée (`ACCORD_SANS_SUITE`) | **Passe** (même séance) |
| (d) | Commande confirmée, rien chargé en 72 h → alerte, l'acheteur annule → annulation imputée au vendeur, avertissement | **Passe** (même séance) |
| (e) | « Livré » déclaré par le vendeur, acheteur muet → rappel à 13 h → litige automatique à 25 h → l'équipe partage (30 %) → commission 3,5 % de 1 400 000 = 49 000 F calculée | **Passe** (même séance) |
| (j) | Deux acceptations sur le même stock (offre, puis demande) : la 2e est refusée (« il reste 2 ») | **Passe** (25/10/2026) |
| (f), (g), (h), (i), (k), (l) | **Non rejoués en parcours.** Les notes ne disent pas quelle lettre va avec quel sujet ; d'après le rapport, ils sont couverts par des tests de la partie 1 qui passent : achat groupé hors ville refusé et membre suspendu (`regles-93` D) ; annonce expirée prolongée de 30 jours (`regles-93` C8) ; service transport fermé (`transport-95` cas 1) ; noms réservés (`confiance-94` bloc 1) ; notification d'une offre retirée (`notif-objet-vivant` T2) ; message envoyé 2 fois (`dm-anti-doublon` T1) | **Non rejoué** en parcours (couvert en partie 1) |

Piège connu : dans une même expression plpgsql, une sous-requête lit l'état d'**avant** l'appel d'une fonction de la même expression : appeler la fonction dans une instruction à part, puis lire. Pour reculer une date d'un accord conclu, `nego_fige` refuse : passer en `session_replication_role = replica` dans le bloc annulé.

## 3. Ce qui n'a jamais été vérifié

Détail, méthode gratuite et qui le fait : `docs/essai-ferme/A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`. Un point sort de cette liste seulement quand son test est fait et écrit (date, résultat exact), ou quand le propriétaire accepte la limite par écrit.

| Point | Pourquoi non vérifié | Budget ? |
|---|---|---|
| **Vrais paiements** (Mobile Money, séquestre) | Aucun paiement n'existe ; rien n'est simulé (règle de la mission) | Oui : partenaire agréé, puis nouvel audit |
| **Charge simultanée** (deux acheteurs en même temps sur le même stock, demandes sans verrou) | Un seul bloc SQL à la fois ; verrous validés par lecture du code | Non : script à plusieurs connexions sur le test |
| **Fonction `pousser`** (envoi réel des notifications, 15 cas) | Pas de clés push sur le projet de test | Non : clés push gratuites pour le test, téléphone du propriétaire |
| **Notifications sur un vrai téléphone** (Android, iPhone) | Simulation du navigateur seulement | Non |
| **Fonction `itineraire`** et serveur public OSRM | Ni en charge ni en réel ; serveur de démonstration sans garantie | Non pour la mesure |
| **Vrai téléphone en 2G/3G**, hors ligne | Validé par lecture du code | Non |
| **API Auth** (inscriptions, limite 20 par 5 min, métadonnées) | Pas appelable en SQL | Non : script sur le test |
| **Exécution réelle des tâches planifiées** à échéance | Durées simulées en reculant les dates | Non : attendre sur le test |
| **Production** (volume réel, journaux Auth, contenu des tâches) | Production interdite aux tests ; lecture seule limitée (liste H) | Non |
| **Négociation à trois du transport** | Service fermé, jamais joué | Non : l'ouvrir sur le test seulement |
| **Preuve du numéro de téléphone** (code par SMS ou WhatsApp) | N'existe pas | Oui |
| **Juridique** (CGU, confidentialité, ARTCI) | Hors code | À voir |
| **Quotas gratuits** (Supabase, GitHub Pages) | Hypothèses, pas relevées | Non pour la mesure |
| **Liste locale de 30 annonces** hors ligne | Jamais vue dans un navigateur | Non |
| **Écrans avec compte dans le navigateur de l'environnement Claude** | Le bac à sable ne joint pas Supabase : réponses simulées seulement | Non : accès au serveur à autoriser par le propriétaire (`docs/A-FAIRE-PROPRIETAIRE.md`) |

## 4. Ajouter un test

1. Écrire le fichier `supabase/tests/<sujet>-scenarios.sql` : en-tête (schéma, projet de **test** seulement, comptes), chaque bloc fini par `raise exception 'TEST…'`, résultat obtenu écrit sous le bloc avec la date.
2. Ajouter sa ligne au tableau de la partie 1, à `MATRICE_TESTS.md` et à `tools/controle/unites.json` (« testsSql » : unités et schémas), dans la **même PR** (règle de `CLAUDE.md`).
3. Ajouter, si besoin, la case à vérifier dans `LISTES_DE_CONTROLE.md`.
4. Jamais de `drop`, `delete`, `truncate` dans un test, même en commentaire (le MCP le refuse).
