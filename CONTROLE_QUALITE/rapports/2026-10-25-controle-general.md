# Rapport du contrôle qualité · contrôle général du 25/10/2026 (UTC = heure d’Abidjan)

> Premier contrôle général complet du système permanent de contrôle MGCI. Gabarit : `CONTROLE_QUALITE/modeles/RAPPORT.md`.
> Rien n’a été corrigé pendant le contrôle. Aucune écriture en production. Projet de test : seulement des blocs `do $$ … raise exception 'TEST…' $$` (rien ne reste) et des lectures.
> Résultats bruts des équipes (gardés tels quels, sans captures) : `annexes/2026-10-25-securite.md`, `annexes/2026-10-25-metier.md`, `annexes/2026-10-25-front-logique.md`, `annexes/2026-10-25-navigateur-U10.md`.

## 1. Identité du passage

| Champ | Valeur |
|---|---|
| Date | 25/10/2026, de 00 h 20 à 02 h 00 environ (UTC) |
| Commit | tests SQL et jugement : `origin/main` **1657f0e** (export) et la base du projet de test telle qu’elle était entre 00 h 20 et 01 h 10 ; statique et navigateur : rejoués sur le commit d’intégration **8e88fbe** (branche `claude/controle-qualite`, qui contient `main` jusqu’à la PR #306) |
| Mode | contrôle général (équipes d’agents : sécurité U02 U07 U09 U11 ; métier U03 U04 U05 U06 U08 U14 ; écrans et logique U10 U12 U01 U13) + `lancer.sh statique` + `lancer.sh navigateur` |
| Base de comparaison | — |
| Projet de test joignable ? | oui (`yowdymdnoiubatxlwhfv`, outil Supabase de la session ; tous les appels acceptés) |
| Production (lecture seule, conseillers) joignable ? | oui, seulement `get_advisors` (lecture) |
| Rapport précédent | `2026-10-25-00h39-tout.md` (script seul, sans SQL) |
| Lancé par | Claude sur demande du propriétaire |

Ce qui a changé pendant le contrôle (à lire avant les résultats) :
- **Production** : les schémas 92a à 96f et 97a ont été appliqués sur la base de production le 25/10/2026 entre 00 h 34 et 00 h 55 UTC (PR #304, accord du propriétaire), avec `pousser` v24. Les tests SQL de ce rapport ont été joués sur le **projet de test**, pas sur la production.
- **PR #305 et #306 fusionnées le 25/10/2026 à 01 h 29 UTC**, après les tests : schémas 98a et 98b (suppression du compte bloquée pendant une commande ; membre suspendu sans nouvel accord) et textes de la commission (corrigent LOG-10/PRO-02, LOG-12, DOC-02) ; schémas 97b, 97c et 97d (litige en 1 h, quantité minimale, garde 93 qui prévient). Sur le projet de test seulement d’après leurs notes ; production à confirmer. Les échecs LOG-10, PRO-02, LOG-12 et DOC-02 ci-dessous sont **mesurés avant** ces corrections : leurs tests de non-régression n’ont pas encore été rejoués par le contrôle.
- Pendant les exercices U03 à U14, l’autre équipe appliquait 97b et 97c sur le projet de test : les tests touchés sont notés « règle en cours de changement » (TRA-11, STK-11), pas « échoué ».

## 2. En bref (pour le propriétaire)

1. **Aucune faille d’argent ni de sécurité bloquante (0 P0)**, mais **4 problèmes graves (P1)** : suppression du compte en pleine commande (corrigée par la PR #305, à revérifier), 51 commissions marquées « due » sans aucun argent passé (projet de test ; production à lire), les messages privés lisibles par l’équipe, et les comptes créés sans preuve du numéro.
2. Comptes : **238 tests** · réussis **148** · échoués **69** · bloqués **1** · non exécutés **4** · en attente d’un prérequis **16**. (En plus : les 18 fichiers anciens de `supabase/tests/` n’ont pas été rejoués.)
3. Nouveau depuis le dernier rapport : P0 0 · P1 2 · P2 22 · P3 22 (46 anomalies nouvelles ; 57 au registre). Déjà réglées et vérifiées : ANO-001 et ANO-002.

## 3. Unités

Comptes : chaque ligne des tableaux des équipes compte pour un test (même quand elle regroupe plusieurs vérifications, comme « FIA-01…56 ») ; un contrôle statique qui couvre deux unités est compté une fois, dans la première.

| Unité | Exécutée ? | Réussis | Échoués | Bloqués | Non exécutés | En attente |
|---|---|---|---|---|---|---|
| U01 Logique métier | oui (lecture du code + 1 bloc SQL) | 11 | 5 | 0 | 0 | 1 |
| U02 Sécurité | oui (SQL, test) | 8 | 2 | 0 | 0 | 1 |
| U03 Transactions et argent | oui (SQL, test) | 10 | 3 | 0 | 0 | 4 |
| U04 Stocks et produits | oui (SQL, test) | 8 | 2 | 0 | 1 | 1 |
| U05 Commandes et négociations | oui (SQL, test) | 11 | 4 | 0 | 0 | 1 |
| U06 Transport et livraison | oui (SQL, test) | 12 | 0 | 0 | 0 | 1 |
| U07 Profils et confiance | oui (SQL, test) | 3 | 1 | 0 | 1 | 0 |
| U08 Notifications | oui (SQL, test ; pas d’envoi réel) | 5 | 4 | 0 | 1 | 1 |
| U09 Base de données | oui (SQL, test + `get_advisors`) | 3 | 3 | 0 | 0 | 1 |
| U10 Fiabilité technique | oui (navigateur, relancé) | 56 | 19 | 0 | 0 | 3 |
| U11 Administration | oui (SQL, test) | 3 | 2 | 0 | 0 | 0 |
| U12 Compréhension | oui (navigateur + captures) | 10 | 11 | 1 | 0 | 0 |
| U13 Cohérence documentaire et commerciale | oui (lecture des documents) | 2 | 11 | 0 | 0 | 1 |
| U14 Situations extrêmes | oui (SQL, test) | 6 | 2 | 0 | 1 | 1 |
| **Total** | 14 sur 14 | **148** | **69** | **1** | **4** | **16** |

D’où viennent les nombres : équipe sécurité 27 tests (16 / 8 / 0 / 1 / 2) ; équipe métier 79 (52 / 15 / 0 / 3 / 9) ; équipe écrans et logique 112 (66 / 40 / 1 / 0 / 5) ; batterie `U12-parcours.js` (nouvelle, CMP-21 à 26) 6 tests (6 / 0 / 0 / 0 / 0) ; contrôle statique `lancer.sh statique` + `navigateur` (STA-01 à 14) 14 tests (8 / 6 / 0 / 0 / 0).
La batterie `U10-fiabilite.js` a été relancée par `bash tools/controle/lancer.sh navigateur` sur le commit d’intégration : U10 : 73 tests · réussi 52 · échoué 18 · en attente : prérequis 3.
Non exécutés dans ce passage : les 18 fichiers anciens `supabase/tests/*.sql` (derniers résultats : `REGISTRE_DES_TESTS.md`, partie 1), dont les 2 nouveaux venus avec les PR #305 et #306 (`controle-corrections-98`, `litige-quantites-97`).

## 4. Tests

Colonne « Gravité » : gravité et numéro de l’anomalie au registre (`REGISTRE_ANOMALIES.md`) ; « (note) » : test réussi qui a quand même révélé un défaut mineur. Preuves : fichiers de `CONTROLE_QUALITE/tests/` (SEC, ARG, STK, CMD, TRA, PRO, NOT, BDD, ADM, EXT, FIA, CMP-21+), lecture du code (LOG, DOC), captures (CMP-01 à 11).

| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Gravité | Preuve | Date |
|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | U02 | malveillant | Un tiers X agit sur la commande S→B : lit la table, `mes_commandes2`, journal, chargement, arrivée, réception, annulation, litige, clôture, preuves de départ, refus, écrire et lire le litige, position, lien de suivi, code, séquestre, délais, avis, réponse vendeur | Tout refusé ou vide, commande inchangée | Table refusée ; `mes_commandes2` = 0 ; journal = 0 ; 16 actions refusées ; 3 réponses vides (`litige_messages_lire`, `commande_position`, `commande_sequestre` renvoient NULL) ; état identique | réussi | — | securite-u02 : SEC-01 | 25/10 |
| SEC-02 | U02 | malveillant | Sans compte (anon) : fonctions sensibles fermées ? chaque fonction SECURITY DEFINER ouverte appelée à vide ; lecture de chaque table ; numéro mis dans une annonce | Rien de sensible, aucun numéro lisible | Aucune fonction sensible ouverte ; 46 fonctions appelées : 2 erreurs, 25 vides, 0 ligne créée ; tables lisibles : `offres` et `demandes` (actives), `notif_categories`, `zones`, `villes_ref` (0 ligne) ; `phone` vidé, nom remplacé par celui du compte ; numéro dans le nom → refus | réussi | — | SEC-02 | 25/10 |
| SEC-03 | U02 | malveillant | X lit les données privées de S et B (profil, négociation, messages, dm, identité, transporteurs, photos de preuve, abonnements, journaux, admins, alertes, signalements) ; l'acheteur et la photo du papier du mot secret | Rien de lisible ; papier visible de l'équipe seulement | Tout refusé ou 0 ; `admin_discussions`/`admin_dm` « Réservé aux administrateurs » ; profil public sans numéro ni pièce ; B voit la photo de départ (1) mais pas la photo du papier (0) | réussi | — | SEC-03 | 25/10 |
| SEC-04 | U02 | malveillant | Falsifier est_admin, identité vérifiée, badge, transporteur vérifié, sanctions, réglages par écriture directe ; appeler les fonctions internes ; faux rôle `service_role` dans le jeton ; appeler les 61 fonctions `admin_*` ouvertes aux membres | Tout refusé | 12/12 écritures refusées ; `est_admin` = false avec le faux jeton ; 59 fonctions admin refusées, 2 renvoient 0 (compteurs `admin_identite_compte`, `admin_structures_compte`, voulu) ; dossier d'identité reste « brouillon » | réussi | — | SEC-04 | 25/10 |
| SEC-05 | U02 | malveillant / limite | Contourner une restriction : suspendu qui publie et négocie ; banni qui publie et négocie ; non vérifié au-delà de 3 annonces ; non-transporteur sur la mission d'un autre ; transporteur non vérifié qui se rend disponible ou propose un prix réseau | Tout refusé | Tout refusé **sauf** : une ancienne annonce retirée, changée de produit (riz → igname) puis remise en ligne par un non-vérifié dont le quota est épuisé → acceptée, compteur inchangé (3) | **échoué** | — | SEC-05, partie c | 25/10 |
| SEC-06 | U02 | malveillant | Injection SQL et HTML/script dans négociation, dm, bio, pseudo, signalement, demande | Aucun SQL exécuté ; texte gardé comme texte | Aucun SQL exécuté (admins 2/2) ; `<script>` et `<img onerror>` stockés tels quels (dm, négociation, bio, signalement) ; pseudo refusé ; l'application les échappe (`esc`, v3/reputation.js:264, v3/messages.js:318) ; seules fonctions à SQL dynamique : `format(%I, tg_table_name)` + `using` (sûr) | réussi (note P3) | P3 · ANO-039 (note) | SEC-06 | 25/10 |
| SEC-07 | U02 | malveillant | Abus : négocier sa propre offre ; auto-avis ; avis sur commande en cours ; 2 avis sur la même commande ; ancienne fonction `noter` ; signalements en masse, faux auteur | Tout refusé ; 1 avis par commande ; pas de masquage par des comptes neufs | Tout refusé ; 1 avis (mis à jour) ; 19 signalements acceptés sur 22 (limite 20/jour) ; 4 comptes neufs ne masquent pas l'annonce. La table `commandes` accepte vendeur = acheteur (voir BDD-02) | réussi | — | SEC-07 | 25/10 |
| SEC-08 | U02 | régression | Failles d'octobre (schémas 66, 68, 71, 72, 73, 74, 78) : date d'annonce, photos de profil extérieures, faux auteur de signalement, heure d'activité sans compte, codes de suivi, code de secours, numéro dans un dm | Les 7 restent corrigées | Toutes corrigées : date refusée ; seule la photo du membre gardée ; faux auteur refusé ; heures vides sans compte ; 11e code de suivi → TROP_ESSAIS ; 6e code de secours → « Trop d'essais », 5 échecs notés, `reinitialiser_code` fermée ; numéro → « [numéro masqué] » | réussi | — | SEC-08 | 25/10 |
| SEC-09 | U02 | panne / concurrent (1 transaction) | Exception au milieu de `commande_avancer` (preuves manquantes) et de `commande_depart_preuves` (photo absente) ; litige ×2 ; clôture ×2 ; commande ×2 sur le même accord | Rien à moitié ; une seule action prise | Rien à moitié ; 1 litige, 1 clôture, 1 commande (« existe déjà ») | réussi | — | SEC-09 | 25/10 |
| SEC-10 | U02 | concurrent | Deux connexions au même instant (double « Confirmer la réception », deux admins sur un litige) | Une seule prise en compte | — | en attente : deux connexions simultanées (le MCP joue une transaction à la fois) | — | SEC-10 | 25/10 |
| SEC-11 | U02 | malveillant (statique) | Droits trop larges sur les tables ; fonctions SECURITY DEFINER sans `search_path` ; `get_advisors` TEST et PROD | Droits minimum | `villes_ref` : anon et membres ont **tous** les droits (dont « vider la table », qui ignore la RLS) ; aucune fonction SECURITY DEFINER sans `search_path` ; `search_path` modifiable : 3 fonctions publiques en test (`_notif_rang`, `negocier`, `proposer_prix`, corps constants) et 1 en prod (`_notif_rang`) ; protection « mots de passe compromis » désactivée (test et prod) ; TEST ≠ PROD sur quelques fonctions | **échoué** (P3) | — | SEC-11 + advisors | 25/10 |
| PRO-01 | U07 | normal / limite | 13 changements du profil (bio 600/601, pseudo 2/24/25 caractères, prénom avec chiffre, nom composé avec apostrophe, rôle inventé, avatar trop long, profil d'un autre, `supprime_le`) ; pseudo déjà pris dans une autre casse | Limites tenues | 13/13 conformes ; pseudo pris refusé ; les refus remontent le texte technique « violates check constraint » | réussi (note P3) | P3 · ANO-041 (note) | profils-u07 : PRO-01 | 25/10 |
| PRO-02 | U07 | limite / erreur | Pièce d'identité expirée hier / aujourd'hui ; suppression du compte d'un vendeur dont la commande est au chargement ; ce qui reste après suppression | Expiration juste ; suppression refusée tant qu'une commande est en cours ; données personnelles effacées | Expiration juste (hier → non vérifié, aujourd'hui → vérifié) ; **suppression acceptée**, commande reste `en_cours/chargement`, compte bloqué à vie ; bio, activités, nom de structure **gardés** en base (plus publics) | **échoué** | — | PRO-02 | 25/10 |
| PRO-03 | U07 | malveillant / régression | 5 fausses commandes en 2 min entre deux comptes (badge) ; se signaler soi-même, signalement trop court, doublon ; ce que voit un visiteur de la fiabilité | Pas de badge ; refus ; rien de privé | Aucun badge, `gros` = false ; 3 refus, 1 seul signalement ; rien de privé ; mais la fiabilité publique affiche « 100 % sur 5 » grâce aux fausses commandes | réussi (note P3) | P3 · ANO-040 (note) | PRO-03 | 25/10 |
| PRO-04 | U07 | concurrent (1 transaction) | Deux dossiers d'identité ouverts ; deux décisions de l'équipe sur le même dossier | 1 dossier ; décisions tracées | 1 dossier (index unique) ; « vérifié » puis « refusé » accepté, 1re décision écrasée sans trace (voir ADM-01) | réussi (anomalie comptée en ADM-01) | P2 · ANO-017 | PRO-04 | 25/10 |
| PRO-05 | U07 | concurrent | Deux contestations de niveau ouvertes en même temps | 1 seule | Non atteint : `niveaux_contester` répond « Rien à contester » sans changement de niveau dans les 7 jours ; l'index unique `niveaux_contestations_ouverte` existe | non exécuté (préparer une ligne `niveaux_journal` récente) | — | PRO-03 partie b | 25/10 |
| BDD-01 | U09 | erreur (statique) | Colonnes d'identifiant sans clé étrangère | Clés sur les tables critiques | Manquent notamment : `annulations.commande_id` (et vendeur, acheteur, imputable), `stock_mouvements.negociation_id`, `commande_alertes.commande_id`, `groupe_participants.commande_id`, `sanctions.user_id`, `niveaux_membres.user_id`, `commissions` vendeur/acheteur, `avis_commandes` auteur/cible, `commandes` cree_par/annulation_par/litige_par/livre_par (41 tables au total, dont les journaux) | **échoué** (P3) | — | base-u09 : BDD-01 | 25/10 |
| BDD-02 | U09 | limite / erreur | 22 valeurs impossibles écrites directement (quantité négative, prix 0, statut inconnu, note 6, commission 5 % ou « encaissée », stock rendu > pris…) | Toutes refusées par la base | 13 refusées ; **acceptées** par `commandes` : quantité -5 et 0, prix 0, montant négatif, montant ≠ quantité × prix, vendeur = acheteur, terminée sans `termine_le`, unité vide ; offre « prix ferme 0 » acceptée hors application | **échoué** | — | BDD-02 | 25/10 |
| BDD-03 | U09 | normal | Ordre des déclencheurs ; annonce envoyée avec date 2020, téléphone, faux nom, expiration 2099 ; commission à la création puis à l'annulation | Tout normalisé ; commission 3,5 % puis annulée | Ordre relevé (offres : `aa_regles` en premier … `stock_garde` en dernier) ; tout normalisé ; commission 7 000 F prévue puis annulée ; nouveau déclencheur `offres_quantites` (schéma 97b, en cours de changement) | réussi | — | BDD-03 | 25/10 |
| BDD-04 | U09 | erreur (intégrité, lecture) | 31 contrôles de cohérence sur les données de simulation (commandes, commissions, stock, annonces expirées ou épuisées, orphelins, avis, missions, pièces) | 0 incohérence | 0 partout **sauf** : 2 avis sur une commande terminée puis annulée après litige (toujours comptés dans `reputation_publique`) ; 17 missions acceptées hors réseau (ancien parcours, transporteurs vérifiés : à confirmer) ; 75 compteurs `annonces_publiees` sous le nombre réel (annonces de simulation insérées en masse) | **échoué** (P2 pour les avis) | — | BDD-04 | 25/10 |
| BDD-05 | U09 | concurrent / panne (1 transaction) | Négociation ouverte 2 fois ; insertion de 3 commandes dont 1 invalide ; contre-offre de 500 sur un stock de 100 | 1 négociation ; 0 ligne ; stock inchangé | Même négociation rendue, index unique ; 0 ligne, 0 commission ; contre-offre refusée, stock 100 → 100 | réussi | — | BDD-05 | 25/10 |
| BDD-06 | U09 | concurrent | Deux connexions prennent le même stock au même instant | Une seule réussit | — | en attente : deux connexions simultanées | — | BDD-06 | 25/10 |
| ADM-01 | U11 | normal | 12 actions sensibles de l'équipe : suspendre, lever, bannir, lever le bannissement, décider une identité (puis changer d'avis), vérifier un transporteur, régler fiabilité et commandes, clôturer, trancher un litige, maintenir une annonce, message à tous : y a-t-il une trace ? | Chaque action tracée (qui, quand, pourquoi) | `admin_journal` +0 pour les 12 ; la plupart signées dans leur table (`sanctions.par`, `bannis.par`, `verifications.decide_par`, `transporteurs.decide_par`, `reglages.maj_par`, `commande_etapes`) ; **aucune trace** pour la levée du bannissement (ligne effacée) ni pour la 1re décision d'identité (écrasée) ; « maintenir une annonce » non testé (aucun masquage en attente) | **échoué** | — | admin-u11 : ADM-01 | 25/10 |
| ADM-02 | U11 | limite / erreur / malveillant | 23 valeurs absurdes (0, négatif, 100 000, texte, clé inconnue, heure 25, suspension 0/-3/100 000 jours, sans motif, se suspendre ou se bannir soi-même, message vide ou trop long) ; l'admin tranche un litige où il est le vendeur | Tout refusé | 23/23 refusées, réglages inchangés ; **l'admin juge son propre litige** (accepté, commande « terminee ») | **échoué** | — | ADM-02 | 25/10 |
| ADM-03 | U11 | concurrent / panne (1 transaction) | Double suspension ; double clôture ; décision de litige avec issue inconnue, fautif inconnu, sans note | 1 action ; rien à moitié | « déjà suspendu » ; « Rien à clôturer » ; 3 refus ; rien à moitié | réussi | — | ADM-03 | 25/10 |
| ADM-04 | U11 | malveillant | Un membre ou un visiteur appelle les fonctions de l'équipe | Refus | Voir SEC-04 (59 refus + 2 compteurs à 0) et SEC-02 (aucune fonction admin ouverte à anon) | réussi | — | SEC-02, SEC-04 | 25/10 |
| ADM-05 | U11 | régression | Anciennes fonctions fermées (`admin_reinitialiser`, `reinitialiser_code`, `admin_identite_decider` à 4 arguments, `commande_creer`) | Fermées | Toutes fermées aux membres et à anon (droits relus) | réussi | — | SEC-04, SEC-08 | 25/10 |
| ARG-01 | U03 | N | Commande 100 × 19 000 F, confirmée puis reçue | Commission 3,5 % « prévue » puis « calculée » | prevue 66 500 F sur 1 900 000 → calculee | réussi | — | argent-u03 bloc A ; `_commission_sync` | 25/10 |
| ARG-03 | U03 | R | Double réception, double clôture, tâche 1 h rejouée, déclencheur rejoué | Une seule clôture, registre inchangé | 2e réception « n'est pas en cours », 2e clôture « déjà clôturée », registre prevue>calculee, 2 lignes avant/après | réussi | — | bloc A ; `commande_liberer`, `sequestre_liberer_echus` | 25/10 |
| ARG-04 | U03 | M | Vendeur/acheteur modifient commission, registre, séquestre, montant, appellent la tâche | Tout refusé | permission denied ×6, montant inchangé | réussi | — | bloc A | 25/10 |
| ARG-05 | U03 | N/E | Fonction de dépôt (service seulement) : faux montant, bon montant, même appel, même référence ailleurs | Faux refusé, idempotent, référence unique | refusé / bloque / bloque (1 ligne) / clé unique ; clôture → due | réussi | — | bloc B ; `sequestre_depot_confirme` | 25/10 |
| ARG-06a | U03 | N | Clôture sans séquestre | Jamais « due » | prevue/calculee | réussi | — | bloc B | 25/10 |
| ARG-06b | U03 | R | Registre entier : « due » sans séquestre ? | 0 ligne | **51 lignes « due »** sans séquestre (d'avant le schéma 95b) | échoué | P1 · ANO-013 | bloc B + requête de lecture | 25/10 |
| ARG-07 | U03 | P | Coupure juste après la confirmation de réception | Rien à moitié | en_cours/arrivee, commission prevue | réussi | — | bloc A | 25/10 |
| ARG-08 | U03 | R | Refus du vendeur, 2e refus | Commission annulée une fois | annulee, 2e refus refusé, 1 ligne | réussi | — | bloc B | 25/10 |
| ARG-09 | U03 | L | 333,33 F × 3 ; 1 F × 1 | Arrondis au franc | 1 000 → 35 F ; 1 → 0 F | réussi | — | bloc B | 25/10 |
| ARG-10a | U03 | L | Prix 1 000 000 000 F | Refusé | « Indiquez un prix » | réussi | — | bloc B | 25/10 |
| ARG-10b | U03 | L | 999 999 998 F × 999 999 sacs | Plafond de vraisemblance | accepté : 999 998 998 000 002 F | échoué | P3 · ANO-045 | bloc B | 25/10 |
| ARG-11 | U03 | N/M/R | Litige → suspendue ; acheteur tranche ; équipe annule ; 2e décision ; litige avant chargement | suspendue, réservé admin, annulée, 1 décision, stock rendu | conforme (stock 90 si parti, 100 sinon, mouvement 10/10) | réussi | — | bloc C | 25/10 |
| ARG-12 | U03 | N | Dépôt réel chez un opérateur | — | — | en attente : prestataire de paiement | — | — | 25/10 |
| ARG-13 | U03 | N | Versement réel au vendeur à la clôture | — | — | en attente : prestataire de paiement | — | — | 25/10 |
| ARG-14 | U03 | N | Remboursement réel (annulation, litige, refus) | — | — | en attente : prestataire de paiement | — | — | 25/10 |
| ARG-15 | U03 | E | 2e dépôt pour la même commande avec une autre référence | Refus ou trace | « bloque » sans trace, réf. B perdue | échoué | P2 · ANO-022 | extremes-u14 EXT-05b (rejoué seul) | 25/10 |
| ARG-16 | U03 | C | Clôture acheteur + tâche 1 h au même instant | — | — | en attente : deux connexions simultanées | — | `for update skip locked` lu | 25/10 |
| STK-01 | U04 | C | Deux acheteurs (8 + 8) sur 10 sacs | 2e accord refusé | « il reste 2 », 2 acceptés → 0/retiree, 3e refusé | réussi | — | stock-u04 bloc A | 25/10 |
| STK-02 | U04 | N/R | Vendeur annule après réservation ; 2e annulation ; déclencheur et tâches rejoués | Stock rendu une fois | 8/8 rendu, stock 8 (+2 vendus = 10) | réussi | — | bloc A ; `_cmd_rendre_stock` | 25/10 |
| STK-03 | U04 | L | Prix 0, -5, NaN, ∞, 0,001 ; quantité 0, -1, NaN, 1e9, 0,5, 101 | Bornes | refus sauf **prix 0,001 F** et 0,5 sac acceptés | échoué | P3 · ANO-044 | bloc B ; `nego_agir` | 25/10 |
| STK-04 | U04 | L | Accord sur 0,5 sac | Stock 99,5 | 99,5 | réussi | — | bloc B | 25/10 |
| STK-05 | U04 | L | Offre en tonnes, l'acheteur propose 5 000 | Refus, unité de l'annonce gardée | refus ; commande « 2 tonne » | réussi | — | bloc B | 25/10 |
| STK-06 | U04 | N | Pause, accord pendant la pause, retrait | Refus ; négociation close | ANNONCE_EN_PAUSE ×2 ; close/annonce_retiree | réussi | — | bloc B | 25/10 |
| STK-07 | U04 | M | Acheteur change le stock ; écrit un mouvement ; quantités -5, 0, vide ; prix négatif | Refus | 0 ligne touchée / refus | réussi | — | bloc B | 25/10 |
| STK-07f | U04 | L | Unité « camion » | Liste d'unités | acceptée | échoué | P3 · ANO-044 | bloc B | 25/10 |
| STK-08 | U04 | C | Demande : deux vendeurs (8 + 8) sur 10 | 2e refusé | « il reste 2 » | réussi | — | bloc C | 25/10 |
| STK-09 | U04 | R | Accord sans commande 73 h, tâche passée 2 fois | Rendu une fois | 1 puis 0, reste 10, 8/8 | réussi | — | bloc C | 25/10 |
| STK-10 | U04 | C | Deux « accord » au même instant sur le dernier sac | — | — | en attente : deux connexions simultanées | — | `for update` lu | 25/10 |
| STK-11 | U04 | L | Quantité minimale, achat partiel (97c) | — | — | non exécuté (règle en cours de changement) | — | — | 25/10 |
| CMD-01 | U05 | E | Accord après 48 h ; nouvelle proposition | Refus ; ok | « a expiré » ; ok | réussi | — | commandes-u05 bloc A | 25/10 |
| CMD-02 | U05 | M | Tiers propose/accepte/écrit ; propre proposition | Refus | introuvable ×3 ; refus | réussi | — | bloc A | 25/10 |
| CMD-03 | U05 | C | Contre-propositions croisées, vieille référence, 2e accord, reproposer après accord | Une seule issue | « a changé », conclue 19 000, 2e accord refusé | réussi | — | bloc A | 25/10 |
| CMD-04 | U05 | R | Commande créée deux fois, par un tiers ; 2e confirmation ; refus après confirmation | Refus | « existe déjà », « introuvable », « déjà reçu une réponse » ×2 | réussi | — | bloc A | 25/10 |
| CMD-05 | U05 | E | Proposer après « arrêt » < 24 h, puis 25 h | Refus puis ok | NEGO_ARRETEE ×2 ; ok à 25 h | réussi | — | bloc A ; `_nego_arret_refus` | 25/10 |
| CMD-06 | U05 | R | Double appui sur « proposer » | 1 négociation, 1 proposition | 1 / 1 | réussi | — | bloc A | 25/10 |
| CMD-07 | U05 | E | Étapes avant confirmation, acheteur confirme sa commande | Refus | refus ×3 | réussi | — | bloc B | 25/10 |
| CMD-08 | U05 | E | Étapes sautées (départ, livraison, chargement sans preuves, réception par le vendeur, « terminee », clôture) | Refus clair | 9 refus ; 08d message MOT_REQUIS adressé à l'acheteur ; 08f « Étape déjà passée » | réussi (messages P3) | P3 · ANO-041 (note) | bloc B | 25/10 |
| CMD-09 | U05 | C | Vendeur demande l'annulation puis charge quand même | Demande close ou chargement bloqué | chargement ok, **annulation_par reste**, l'acheteur ne peut ni accepter ni refuser | échoué | P2 · ANO-024 | bloc B | 25/10 |
| CMD-10 | U05 | C | Acheteur annule, vendeur confirme juste après | 2e refusée | refusée | réussi | — | bloc B | 25/10 |
| CMD-11 | U05 | P | Coupure au milieu de la création ; ville imposée | 0 commande | 0 → recréation ok ; refus avant écriture | réussi | — | bloc B | 25/10 |
| CMD-12a | U05 | R | États avec sortie (a_confirmer, confirmee, livraison vendeur, annulation pendante, litige, terminee) | Une tâche ou une action | expirée / alerte + annulation / litige auto / alerte / litige_en_retard / libérée | réussi | — | bloc C | 25/10 |
| CMD-12b | U05 | R | En route, livraison jamais déclarée, 30 jours | Alerte ou échéance | en_cours/transport, **aucune alerte** | échoué | P2 · ANO-023 | bloc C ; `commandes_delais` | 25/10 |
| CMD-12c | U05 | R | Arrivée déclarée par l'acheteur, réception jamais confirmée, 30 jours | Échéance | en_cours/arrivee, **aucune alerte** | échoué | P2 · ANO-023 | bloc C | 25/10 |
| CMD-12d | U05 | R | Mot bloqué (5 essais), 30 jours | Échéance | alerte mot_bloque seulement, pas d'échéance | échoué | P2 · ANO-023 | bloc C | 25/10 |
| CMD-13 | U05 | C | Vendeur annule et acheteur confirme au même instant | — | — | en attente : deux connexions simultanées | — | — | 25/10 |
| TRA-01 | U06 | N | Commande « réseau » service fermé | Refus | refus | réussi | — | transport-u06 bloc A | 25/10 |
| TRA-02/03 | U06 | N/E | Affectation ; acheteur propose en premier | proposee ; refus | conforme | réussi | — | bloc A | 25/10 |
| TRA-04 | U06 | L | Prix transport 0, -1, 0,4, 1e8, NaN | Refus | refus ; 0,4 → contrainte en anglais | réussi (message P3) | — | bloc A ; `_ctr_prix` | 25/10 |
| TRA-05 | U06 | C | Le transporteur change son prix avant l'accord du vendeur | Ancien prix refusé, accord des trois sur le nouveau | « a changé » ; acceptee 65 000, total 265 000, commission transport 4 485 (6,9 %) prevue | réussi | — | bloc A | 25/10 |
| TRA-06 | U06 | M | Transporteur change son prix après l'accord des trois ; vendeur refuse après | Refus | « déjà convenu » ×2 | réussi | — | bloc A | 25/10 |
| TRA-07/08 | U06 | M | Tiers ; message privé chauffeur → acheteur | Refus | refus ×2 | réussi | — | bloc A | 25/10 |
| TRA-09 | U06 | M | Ancien code, code en lettres, 5 essais, bon code après blocage, nouveau code | Bloqué à 5 | conforme, nouveau code → transport | réussi | — | bloc A ; `commande_valider_code` | 25/10 |
| TRA-10 | U06 | E | Prix après chargement | Refus | refus | réussi | — | bloc A | 25/10 |
| TRA-11 | U06 | N | Livraison déclarée, acheteur muet | Litige auto (règle en cours de changement) | litige à 61 min (97b), commission suspendue | réussi (règle en cours de changement) | — | bloc B | 25/10 |
| TRA-12 | U06 | M | Mot d'une autre commande, mot vide, 5 essais, bon mot après blocage, « sans mot », majuscules | Bloqué à 5 | conforme ; « sans mot » reste possible après blocage | réussi | — | bloc B | 25/10 |
| TRA-13 | U06 | M | Photos d'une autre commande, d'un autre membre | Refus | refus ×2 (13c non concluant) | réussi | — | bloc B | 25/10 |
| TRA-14 | U06 | C | Deux accords simultanés du prix à trois ; GPS réel | — | — | en attente : deux connexions simultanées, GPS réel | — | — | 25/10 |
| TRA-15/16 | U06 | E/N | Prix expiré ; refus → livreur du vendeur ; réaffectation | Refus ; continuité | conforme | réussi | — | bloc C | 25/10 |
| NOT-01 | U08 | N | Publication → file de notifications | Lignes ciblées | 0 cible pour l'offre de test | non exécuté (aucune cible) | — | notifications-u08 bloc A | 25/10 |
| NOT-02 | U08 | R | 990 sacs vendus sur 1 000 avant l'envoi | Quantité réelle | file en attente « quantite=1000 », offre vivante (10 sacs) | échoué | P2 · ANO-025 | bloc A ; `pousser/index.ts` l. 501-530 | 25/10 |
| NOT-03 | U08 | R | Prix changé avant l'envoi | Prix réel | file « prix=20000 » (réel 30 000) | échoué | P2 · ANO-025 | bloc A | 25/10 |
| NOT-04 à 08 | U08 | R | Offre épuisée, en pause, demande retirée, rappel d'accord après commande, relance après accord | Pas d'envoi | perime / objet_perime ×6 | réussi | — | bloc A ; `_notif_objet_vivant` | 25/10 |
| NOT-09 | U08 | R | Même clé deux fois | Doublon | doublon | réussi | — | bloc A | 25/10 |
| NOT-10 | U08 | L | Type non prévu | — | toujours « vivant » (else true) | réussi (observation) | — | bloc A | 25/10 |
| NOT-11 | U08 | M | Membre appelle notif_preparer, écrit la file, notif_resultat, lit le journal des autres | Refus | refus ×3, 0 ligne visible | réussi | — | bloc B | 25/10 |
| NOT-11d | U08 | M | Marquer « ouverte » la notification d'un autre (nid connu) | Refus | accepté (anon aussi) | échoué | P3 · ANO-046 | bloc B ; `notif_ouverte` | 25/10 |
| NOT-12 | U08 | L | Compte supprimé | Rien | commercial ignoré ; transactionnel « envoyer » | échoué | P3 · ANO-047 | bloc B | 25/10 |
| NOT-13/14 | U08 | R | Heures calmes ; plafond 8 | Retenu ; 8 puis plafond | conforme | réussi | — | bloc B | 25/10 |
| NOT-15 | U08 | N | Envoi réel, affichage | — | — | en attente : clés push du projet de test | — | — | 25/10 |
| EXT-01 | U14 | R | Message privé renvoyé avec le même identifiant ; sans identifiant ; identifiant invalide | 1 message | 1 ligne (deja) ; 2 lignes sans identifiant ; refus | réussi | — | extremes-u14 bloc A | 25/10 |
| EXT-02 | U14 | R | Texte de négociation renvoyé (coupure) | 1 message | 2 lignes | échoué | P3 · ANO-048 | bloc A | 25/10 |
| EXT-03 | U14 | L/M | 501 / 2 001 caractères, texte « SQL », émojis, caractère de contrôle, vide | Refus ou stocké tel quel | conforme ; chr(1) accepté | réussi | — | bloc A | 25/10 |
| EXT-04 | U14 | L | 25 messages en une minute | Limite | refus au 14e (20/min tous messages) | réussi | — | bloc A | 25/10 |
| EXT-05a | U14 | L | Lieu 121 caractères | Refus | refus | réussi | — | bloc A | 25/10 |
| EXT-06 | U14 | E | Vendeur banni après confirmation | Sortie rapide pour l'acheteur | vendeur bloqué ; acheteur TROP_TOT (72 h) ; seul « Signaler un problème » | échoué | P2 · ANO-026 | bloc B | 25/10 |
| EXT-07 | U14 | E | Compte supprimé pendant une commande | Garde-fou | aucune des 5 fonctions ne vérifie (lecture du code) | non exécuté (lecture seule) | P1 · ANO-012 | bloc B | 25/10 |
| EXT-08 | U14 | P | Photo du papier perdue en route, puis reprise | Chargement bloqué, reprise ok | conforme | réussi | — | bloc C | 25/10 |
| EXT-09 | U14 | R | Réseau refusé → livreur du vendeur : mot secret ? | Mot créé | mot=true | réussi | — | bloc C | 25/10 |
| EXT-10/11 | U14 | C/P | Deux appareils du même membre ; coupure réseau réelle pendant un envoi | — | — | en attente : deux connexions simultanées | — | — | 25/10 |
| FIA-01…56 (×14 écrans) | U10 | normal | Erreurs JavaScript (exceptions + console) sur les 14 écrans × 4 profils | aucune | aucune erreur sur les 56 ouvertures | réussi (14) | — | `resultats/ecrans.json` | 25/10 |
| idem | U10 | normal | Écran vide | du contenu | contenu présent partout (la carte : carte + 12 commandes) | réussi (14) | — | captures `*-<écran>.png` | 25/10 |
| idem | U10 | limite | Débordement horizontal à 390 px et 320 px | rien ne dépasse | aucun débordement mesuré | réussi (14) | — | `MESURE.elementsQuiDebordent` | 25/10 |
| FIA-04, 08, 12 … 56 | U10 | erreur | Texte technique (« [object Object] », « undefined », « NaN », « Invalid Date ») | jamais, ni à l'écran ni pour le lecteur d'écran | « [object Object] » présent dans un bloc invisible (opacité 0) mais **lu par le lecteur d'écran** sur les 14 écrans | échoué (14) | P3 · ANO-050 | `application.dc.html` l. 803 `{{ toast }}` reçoit un objet `{t,x,ico,go}` (l. 2052) ; `ariaSnapshot` | 25/10 |
| FIA-57 | U10 | normal | Chargement de l'accueil, cache vide, réseau local | DCL < 2 s, load < 4 s | DCL 182 ms, load 184 ms, accueil lisible à 0,7 s | réussi | — | performance navigation | 25/10 |
| FIA-58 | U10 | limite | Poids de la première ouverture (sans polices Google ni tuiles) | < 3 Mo | **4,4 Mo** en 175 fichiers (scripts 1,8 Mo, « other » 1,5 Mo, données 356 Ko, page 348 Ko, CSS 304 Ko) | échoué | P2 · ANO-031 | CDP `Network.loadingFinished` | 25/10 |
| FIA-59 | U10 | panne | « Slow 3G » (400 ms, 400 kbit/s) + serveur lent 2 s | écran d'attente puis accueil < 30 s | écran d'attente « On remplit les étals… » à 3, 8, 15 s (pas d'écran blanc) ; DCL 22,4 s ; **accueil lisible à 56,7 s** | échoué | P2 · ANO-031 | `captures/3g-*.png` | 25/10 |
| FIA-60 | U10 | panne | Coupure du réseau sur l'accueil | message clair « hors connexion » | **aucun message global** ; l'app reste utilisable, les messages n'apparaissent qu'au moment d'une action | échoué | P2 · ANO-032 | `captures/coupure-accueil.png` ; aucun écouteur `offline` dans `application.dc.html` | 25/10 |
| FIA-61 | U10 | panne | Négociation : envoyer un message sans réseau | message clair, texte gardé | « Pas de connexion… », texte gardé dans le champ, 0 requête, rien affiché comme envoyé | réussi | — | `captures/coupure-negociation.png` ; `v3/negoce.js` l. 419/571 | 25/10 |
| FIA-62 | U10 | panne | Publier une offre : saisie gardée après fermeture/rechargement | quantité retrouvée | quantité 37 et produit « igname » retrouvés | réussi | — | `mdg-app:brouillon-offre` (`setVf`) | 25/10 |
| FIA-63 | U10 | panne | Serveur en panne (503) à l'ouverture de « Mes commandes » | message clair | « Commandes indisponibles pour l'instant » (mais la liste affiche aussi « Aucune commande en cours » en dessous) | réussi | — | `captures/panne-commandes.png` | 25/10 |
| FIA-64 | U10 | panne | Serveur en panne au rechargement de l'accueil | accueil avec annonces gardées | accueil affiché | réussi | — | `v3/nuage.js` `refresh` | 25/10 |
| FIA-65 | U10 | concurrent | Négociation : 3 clics rapides sur « Envoyer », serveur lent 1,5 s | 1 envoi | 1 seul `nego_agir` | réussi | — | requêtes interceptées | 25/10 |
| FIA-66 | U10 | concurrent | Commande à confirmer : double clic « Confirmer la commande », serveur lent | 1 envoi | 1 seul `commande_repondre` | réussi | — | `captures/double-commande.png` | 25/10 |
| FIA-67 | U10 | normal | Premier lancement, négociation ouverte directement (comme depuis une notification) | tutoriel adapté à l'écran | tutoriel de la **liste** (« Chaque ligne est une négociation… ») affiché par-dessus une négociation ouverte | échoué | P3 · ANO-051 | `captures/tutoriel-sur-negociation.png` | 25/10 |
| FIA-68 | U10 | normal | Service worker : installation | actif, réserve remplie | actif, `mgci-v290` (102 fichiers) + `fichiers-mgci` (120) | réussi | — | `sw.js` | 25/10 |
| FIA-69 | U10 | panne | Ouvrir l'app sans réseau après une première visite | accueil depuis le cache | accueil affiché hors connexion | réussi | — | `captures/sw-hors-connexion.png` | 25/10 |
| FIA-70 | U10 | régression | Mise à jour `CACHE` v290 → v291 (sur une copie) | la nouvelle réserve remplace l'ancienne | `mgci-v291` seule après mise à jour ; v290 supprimée | réussi | — | test sur copie temporaire | 25/10 |
| FIA-71 | U10 | normal | Notifications poussées réelles (réception, bon écran) | ouvre l'écran précis | — | en attente : prérequis (vrai téléphone + serveur joignable + clés VAPID) | — | — | 25/10 |
| FIA-72 | U10 | normal | Parcours complet contre le vrai serveur | mêmes écrans, vraies réponses | — | en attente : prérequis (autoriser `catmsypctymgkjkfzdkt.supabase.co`) | — | — | 25/10 |
| FIA-73 | U10 | panne | Vrai réseau 2G/3G ivoirien, téléphone d'entrée de gamme | temps et mémoire acceptables | émulation seulement | en attente : prérequis (vrai téléphone Android d'entrée de gamme) | — | — | 25/10 |
| CMP-01 | U12 | normal | Publier une offre : « Suivant » sans quantité à l'étape 1 | l'utilisateur voit le champ à remplir | bulle « Indiquez la quantité » en haut, mais le champ Quantité reste **sous la photo, hors de l'écran** : pas de défilement vers lui | échoué | P2 · ANO-033 | `navigateur/explore/f4.png` | 25/10 |
| CMP-02 | U12 | normal | Publier une offre : bandeau « demandes qui attendent » | français correct | « 1 demande **de igname** attend déjà un vendeur » (au lieu de « d'igname ») | échoué | P3 · ANO-052 | `explore/f4.png` | 25/10 |
| CMP-03 | U12 | normal | Négocier : écran d'une négociation ouverte | sait quoi faire | proposition lisible (« 1 000 kg × 230 F = 230 000 F · expire dans 40 h »), bouton principal « Accepter 230 F / kg », puis Contre-proposer / Refuser | réussi | — | `captures/iphone13-clair-negociation.png` | 25/10 |
| CMP-04 | U12 | normal | Négocier : « Refuser » et « Arrêter la négociation » côte à côte | différence claire | deux sorties sans explication courte de la différence (refuser cette proposition / arrêter toute la négociation) | échoué (P3) | P3 · ANO-053 | même capture | 25/10 |
| CMP-05 | U12 | normal | Accord conclu : quoi faire ensuite | une suite claire | « Prix et quantité sont figés. Rien n'est encore payé ni livré » + « Suivre la commande » ; mais **« Écrire au vendeur » et « Écrire en privé » sur le même écran** (doublon, contraire à la règle « pas de doublons ») | échoué (P3) | P3 · ANO-053 | `navigateur/parcours/accord.png` | 25/10 |
| CMP-06 | U12 | normal | Commander (vendeur, commande à confirmer) | sait quoi faire | « Mariam vous propose cette commande. Vérifiez le transport et le lieu de livraison, puis confirmez » + « Confirmer la commande / Refuser » ; commission « prévue · rien n'est prélevé » | réussi | — | `explore/cmd2.png` | 25/10 |
| CMP-07 | U12 | normal | Commander : bloc « lien de suivi » | au bon moment | grand bloc « Donnez un lien de suivi à votre chauffeur · Recommandé » affiché **avant même la confirmation** de la commande : long, sur-explication (4 paragraphes + 3 étapes) | échoué (P3) | P3 · ANO-053 | `explore/cmd2.png` | 25/10 |
| CMP-08 | U12 | normal | Charger (vendeur, commande confirmée) | sait quoi faire | consigne courte (mot secret, « En préparation », « Photographier le colis ») ; règle des 2 à 4 photos et du poids rappelée | réussi | — | `parcours/charger.png` | 25/10 |
| CMP-09 | U12 | normal | Recevoir (acheteur, marchandise arrivée) | le bouton annoncé existe | le texte dit « Un problème : **refusez avec des photos** » mais les boutons sont « Réception confirmée » et « Signaler un problème » (pas de « Refuser la marchandise » à cette étape avec les données factices : le bouton dépend de `commande_sequestre.peut_refuser`, non simulé) | bloqué (à refaire avec le vrai serveur) | — | `parcours/recevoir.png` ; `v3/commandes.js` l. 536 | 25/10 |
| CMP-10 | U12 | normal | Litige (acheteur) : ce qui se passe ensuite | délai et action possibles | « Litige ouvert · L'équipe examine… » + « Service litiges WhatsApp : bientôt » ; **aucun délai affiché** (72 h côté serveur), aucun bouton pour ajouter une preuve visible avec les données factices | échoué | P2 · ANO-034 | `parcours/litige.png` | 25/10 |
| CMP-11 | U12 | normal | Suivi (acheteur) | français correct | « Nous avons conseillé **à le vendeur** » | échoué (P3) | P3 · ANO-052 | `v3/commandes.js` l. 1169 | 25/10 |
| LOG-01 | U01 | normal | Clôture automatique 1 h après la réception | 1 h | `termine_le < now() - interval '1 hour'`, tâche toutes les 5 min ; définition identique sur le projet de test | réussi | — | `schema-89a` `sequestre_liberer_echus` + requête `pg_get_functiondef` (test) | 25/10 |
| LOG-02 | U01 | normal | Preuves au départ : 2 à 4 photos, poids, photo du papier si mot secret | pas de chargement sans elles | déclencheur sur l'événement « chargement » (aussi par le code du chauffeur) | réussi | — | `schema-90b` `_cmd_chargement_preuves` ; `schema-28` `commande_valider_code` | 25/10 |
| LOG-03 | U01 | normal | Commission 3,5 % sur la marchandise seulement, jamais « encaissée » | 3,5 % du montant moins la part refusée | `round(m * 0.035)` ; statut « calculée » sans séquestre (95b, test seulement) | réussi | — | `schema-95b` `_commission_sync` | 25/10 |
| LOG-04 | U01 | normal | 6,9 % seulement service transport MGCI + transporteur vérifié | — | conforme (82, 95) ; service fermé ; ouverture refusée sous 3 transporteurs vérifiés | réussi | — | `schema-95` `admin_transport_reseau` | 25/10 |
| LOG-05 | U01 | normal | Ville seulement / Abidjan une ville | refus serveur hors ville | `commande_creer2` refuse ; `_ville_ref` | réussi | — | `schema-93b`, `87c` | 25/10 |
| LOG-06 | U01 | normal | Quantité obligatoire pour publier une offre | refus | refus réel sur le projet de test : « QUANTITE_REQUISE » | réussi | — | bloc `do $$` sur yowdymdnoiubatxlwhfv | 25/10 |
| LOG-07 | U01 | normal | Notifications commerciales : 8/jour, 4 contenus, 90/180 min, 21 h–7 h, anti-doublon | — | conforme (`notif_preparer`, `_notif_calme`, `_notif_ecart_ok`, schéma 91) | réussi | — | `schema-96b`, `91`, `88a` | 25/10 |
| LOG-08 | U01 | normal | On ne négocie pas sa propre annonce | refus | « C'est votre propre annonce » | réussi | — | `schema-93b` `nego_ouvrir` | 25/10 |
| LOG-09 | U01 | normal | Suspension 7 puis 30 jours, décidée par l'admin, annonces cachées | — | conforme | réussi | — | `schema-84b` `admin_suspendre` | 25/10 |
| LOG-10 | U01 | erreur | **Suppression du compte avec une commande en cours** | bloquée, ou commandes protégées (décision 44 : « garder la trace des commandes ») | **suppression acceptée** avec 4 commandes ouvertes ; la commande reste « en_cours » avec un vendeur qui ne peut plus se connecter | échoué | P1 · ANO-012 | test réel (annulé) sur le projet de test ; `schema-4` `supprimer_compte` | 25/10 |
| LOG-11 | U01 | normal | Badges Excellent et Grand atteignables | décisions 22 et 29 | ils exigent des commandes `validation = 'code'`, qui n'existent **que** en mode « reseau » (service fermé) : **personne ne peut les obtenir** aujourd'hui | échoué | P2 · ANO-027 | `schema-94d` `_niv_calculer` ; `schema-87b` `commande_creer` (`val := case when p_mode = 'reseau'…`) | 25/10 |
| LOG-12 | U01 | concurrent | Membre suspendu avec des négociations ouvertes | décision 16 : il finit ses commandes en cours | l'autre partie peut encore **conclure** (pas de garde dans `nego_agir`), puis la commande est **refusée** (« Ce membre est suspendu ») : accord sans suite | échoué | P2 · ANO-028 | `schema-93b` `nego_agir` ; `schema-84b` `_fiab_garde_commande` | 25/10 |
| LOG-13 | U01 | limite | Délais 72 h de chargement, 24 h de réception, 72 h de litige | — | comptés en heures pleines, nuits, week-ends et jours fériés compris (aucun calendrier) | échoué (scénario oublié) | P2 · ANO-035 | `schema-92b` `commandes_delais`, `commande_annuler_retard` | 25/10 |
| LOG-14 | U01 | malveillant | Même personne vendeur et acheteur avec deux numéros | empêché | aucun contrôle (pas de vérification du numéro) ; seuls les badges ont des gardes (partenaires différents) | échoué | P1 · ANO-010 | `schema-93b` `nego_ouvrir` (contrôle `user_id` seulement) | 25/10 |
| LOG-15 | U01 | limite | Annonce modifiée (prix) pendant une négociation | l'accord se fait sur la dernière proposition | l'accord vérifie stock, pause, statut, pas le prix ni la ville actuels de l'annonce ; la ville de la commande est celle de la négociation (choix voulu, 93b) | réussi (comportement voulu, à documenter) | — | `schema-93b` `nego_agir`, `commande_creer2` | 25/10 |
| LOG-16 | U01 | normal | Écart entre le code du dépôt et la production | — | les schémas 92 à 96 sont « test seulement » ; impossible de comparer la production (lecture interdite) | en attente : prérequis (lecture des définitions en production, accord du propriétaire) | P3 · ANO-043 | `FONCTIONNALITES.md` l. 27 | 25/10 |
| DOC-01 | U13 | normal | Transport « même ville » | décision 1 et CGU 7.2 : le vendeur organise son livreur, payé par l'acheteur | le formulaire « Publier une offre » dit : « Inclus hors de ma ville — Règle du marché : je livre dans les autres villes ; **dans ma ville, l'acheteur s'en charge** » | échoué | P2 · ANO-029 | `application.dc.html` l. 830-831 (`TR_OFF`) ; `v3/commandes.js` l. 1139 (même ville → le vendeur organise) | 25/10 |
| DOC-02 | U13 | normal | Pitch : commission | rien n'est prélevé | « 3,5 % … **retenus sur la part du vendeur** quand la vente est définitive » + « registre que personne ne peut modifier » (affirmation non vérifiée : l'admin a des fonctions sur les commissions) | échoué | P2 · ANO-030 | `strategie/sources/pitch.html` l. 66-70 | 25/10 |
| DOC-03 | U13 | normal | Guide « Transporter le vivrier » : mot secret | aide : on tape le mot aussi pour refuser | « l'acheteur le saisit **seulement si tout est conforme** » | échoué | P3 · ANO-054 | `tools/site/guides/transporter-le-vivrier.html` l. 69 ; `v3/aide.js` l. 89 ; `commande_refuser2` | 25/10 |
| DOC-04 | U13 | normal | Aide « Je peux annuler une commande ? » | dire que l'acheteur peut annuler si rien n'est chargé après 72 h (92b) | « Une fois la commande confirmée, l'acheteur ne peut plus l'annuler » | échoué (dès que 92b est en production) | P3 · ANO-054 | `v3/aide.js` l. 90 ; `schema-92b` `commande_annuler_retard` | 25/10 |
| DOC-05 | U13 | normal | CGU 5.x : délai de chargement | 72 h, rappel 12 h avant (92b) | « aujourd'hui, aucune échéance » | échoué (selon production) | P3 · ANO-054 | `docs/juridique/conditions-utilisation.md` l. 120 | 25/10 |
| DOC-06 | U13 | normal | CGU : note « commande_litige dit encore 24 h » | à jour | la dernière définition (92b) dit « 1 h » : note périmée (sauf si la production a encore 61) ; **en cours de changement** (litige 1 h, 97b) | échoué | P3 · ANO-054 | CGU l. 138 ; `schema-92b` `commande_litige` | 25/10 |
| DOC-07 | U13 | normal | FONCTIONNALITES : notifications marketing | 8 par jour et par personne | « 30 par jour au plus » (c'est la cadence de la tâche, pas le plafond par personne) | échoué (P3) | P3 · ANO-054 | `FONCTIONNALITES.md` l. 373 | 25/10 |
| DOC-08 | U13 | normal | CLAUDE.md « Ville seulement » | décrire une **option** | écrit comme une règle pour tous (« un vendeur peut vendre … uniquement dans la ville de son annonce ») ; le code et les CGU en font un choix du vendeur | échoué (P3) | P3 · ANO-054 | `CLAUDE.md` ; CGU 4.2 ; `vsRow` dans `v3/nuage.js` | 25/10 |
| DOC-09 | U13 | normal | Badges : règles écrites | décision 22 | le code (94d) exige en plus 3 partenaires différents, 3 commandes au plus par partenaire, 60 min entre création et réception ; ni CLAUDE.md ni l'aide ne le disent | échoué (P3) | P3 · ANO-054 | `schema-94d` | 25/10 |
| DOC-10 | U13 | normal | Aide « Comment monter de niveau » | possible | promet Excellent/Grand « validées par code » sans dire que ce n'est pas possible aujourd'hui (LOG-11) | échoué | P2 · ANO-027 | `v3/aide.js` l. 113 | 25/10 |
| DOC-11 | U13 | normal | Modèles de stratégie : paiement et séquestre | jamais « encaissé » | « Construit, pas branché », « rien n'est encaissé » : conforme | réussi | — | `strategie/sources/probleme-solution.html` l. 104, 130 | 25/10 |
| DOC-12 | U13 | normal | Production vs « en production » écrit dans les docs | vérifié | non vérifiable ici | en attente : prérequis (lecture seule des définitions en production) | P3 · ANO-043 | — | 25/10 |
| STA-01 | U10 | normal | Contrôle « syntaxe » | aucun constat | rien à signaler (85 fichiers et scripts lus sans erreur) | réussi | — | tools/controle/controle.js | 25/10 |
| STA-02 | U10 | normal | Contrôle « cache » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 5 orange(s) | échoué | — | application.dc.html:39 ; application.dc.html:39 ; application.dc.html:39 ; … | 25/10 |
| STA-03 | U13, U03 | normal | Contrôle « mots-interdits » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 1 orange(s) | échoué | P2 · ANO-001 | v3/commandes.js:915 | 25/10 |
| STA-04 | U01 | normal | Contrôle « communes » | aucun constat | rien à signaler (textes, champs ville et liste des villes (app/villes.js)) | réussi | — | tools/controle/controle.js | 25/10 |
| STA-05 | U12 | normal | Contrôle « doublon-texte » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 26 orange(s) | échoué | P3 · ANO-004 | v3/chauffeur.js:24 ; index-v3.html:2347 ; app/theme.js:90 ; … | 25/10 |
| STA-06 | U10 | normal | Contrôle « doublon-fonction » | aucun constat | rien à signaler (77 fichiers JS et les scripts des pages) | réussi | — | tools/controle/controle.js | 25/10 |
| STA-07 | U10 | normal | Contrôle « doublon-id » | aucun constat | rien à signaler (identifiants du HTML de application.dc.html et index-v3.html) | réussi | — | tools/controle/controle.js | 25/10 |
| STA-08 | U12 | normal | Contrôle « long-texte » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 51 orange(s) | échoué | P2 · ANO-003 | v3/identite.js:493 ; v3/commandes.js:777 ; v3/compte.js:863 ; … | 25/10 |
| STA-09 | U12, U13 | normal | Contrôle « slogan » | aucun constat | rien à signaler (tournures publicitaires toutes faites) | réussi | — | tools/controle/controle.js | 25/10 |
| STA-10 | U12 | normal | Contrôle « police » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 1 orange(s) | échoué | P3 · ANO-006 | index-v3.html:774 | 25/10 |
| STA-11 | U12 | normal | Contrôle « bleu » | aucun constat | 0 rouge(s) dont 0 nouveau(x), 7 orange(s) | échoué | P3 · ANO-005 | application.dc.html:302 ; index-v3.html:2047 ; v3/avatar.js:13 ; … | 25/10 |
| STA-12 | U09 | normal | Contrôle « sql » | aucun constat | rien à signaler (143 fichiers supabase/schema-*.sql ; voir « Pour information ») | réussi | — | tools/controle/controle.js | 25/10 |
| STA-13 | U13 | normal | Contrôle « liens » | aucun constat | rien à signaler (CLAUDE.md, CONTROLE_QUALITE/CALENDRIER.md, CONTROLE_QUALITE/HISTORIQUE.md, CONTROLE_QUALITE/INVENTAIRE_OUTILS.md, CONTROLE_QUALITE/LISTES_DE_CO | réussi | — | tools/controle/controle.js | 25/10 |
| STA-14 | U10 | normal | Contrôle « navigateur » | contrôle fait | application ouverte en iPhone émulé, sans erreur JavaScript (passage `lancer.sh navigateur`) | réussi | — | tools/controle/controle.js | 25/10 |
| CMP-21 | U12 | normal | Commande « charger » : écran lisible (données factices) | ouvert sans erreur, texte et boutons, pas de texte technique ni de faute de liaison | ok | réussi | — | `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | 25/10 |
| CMP-22 | U12 | normal | Commande « recevoir » : écran lisible (données factices) | ouvert sans erreur, texte et boutons, pas de texte technique ni de faute de liaison | ok | réussi | — | `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | 25/10 |
| CMP-23 | U12 | normal | Commande « verifier » : écran lisible (données factices) | ouvert sans erreur, texte et boutons, pas de texte technique ni de faute de liaison | ok | réussi | — | `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | 25/10 |
| CMP-24 | U12 | normal | Commande « litige » : écran lisible (données factices) | ouvert sans erreur, texte et boutons, pas de texte technique ni de faute de liaison | ok | réussi | — | `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | 25/10 |
| CMP-25 | U12 | normal | Commande « annulee » : écran lisible (données factices) | ouvert sans erreur, texte et boutons, pas de texte technique ni de faute de liaison | ok | réussi | — | `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | 25/10 |
| CMP-26 | U12 | normal | Commande « route » : écran lisible (données factices) | ouvert sans erreur, texte et boutons, pas de texte technique ni de faute de liaison | ok | réussi | — | `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | 25/10 |

## 5. Anomalies P0 à P3

Aucune P0. Détail complet, preuves et statuts : `REGISTRE_ANOMALIES.md` (une fiche par anomalie). Ci-dessous : preuve reproductible, risque métier, correctif proposé, test de non-régression.

### P1

#### ANO-012 · Suppression du compte pendant une commande en cours (P1, U01 U07 U14) · nouvelle · corrigée non vérifiée
- **Preuve reproductible** : `tests/sql/U07-profils.sql` bloc PRO-02 b (avec `_outils` en tête), projet de test : vendeur avec une commande à l’étape « chargement », `select public.supprimer_compte();` → « ok », commande toujours `en_cours/chargement`, compte bloqué (`banned_until = infinity`). Même résultat LOG-10 avec 4 commandes ouvertes. `supabase/schema-4.sql` `supprimer_compte` (`python3 tools/controle/fn.py supprimer_compte`).
- **Risque métier** : l’acheteur attend une marchandise d’un vendeur qui ne peut plus se connecter ; un fraudeur échappe au litige puis revient avec un autre numéro.
- **Correctif** : fait dans la PR #305 (schéma 98a + écran Mon compte), fusionnée à 01 h 29 UTC ; projet de test seulement d’après sa note ; production à confirmer.
- **Test de non-régression** : PRO-02 b et LOG-10 à rejouer (attendu : refus « Terminez d’abord vos commandes en cours », commande inchangée, compte actif).

#### ANO-013 · 51 commissions « due » sans aucun argent passé (P1, U03 U11) · nouvelle · ouverte
- **Preuve reproductible** : ARG-06b (`tests/sql/U03-argent.sql` bloc B) puis, en lecture : `select k.statut, k.statut_registre, count(*) from commissions k where (k.statut = 'due' or k.statut_registre = 'due') and not exists (select 1 from sequestres q where q.commande_id = k.commande_id) group by 1, 2;` → `due | NULL | 51` (commandes de simulation des 23 et 24/10/2026). L’écran admin (`v3/admin-transport.js`) dit « Due (argent passé par l’application) ».
- **Risque métier** : l’équipe croit qu’une commission est due parce que « l’argent est passé », alors qu’aucun paiement n’existe : contraire à la règle « jamais présentée comme encaissée ». La production (schéma 95b depuis 00 h 34) **n’a pas été lue**.
- **Correctif proposé** : requalifier ces lignes en « calculée » avec une ligne de journal, ou faire lire l’écran sur `_cmd_argent_passe`.
- **Test de non-régression** : ARG-06b → 0 ligne sur le test, puis la même requête en lecture sur la production (avec l’accord du propriétaire).

#### ANO-008 · L’équipe peut lire tous les messages privés (P1, U02 U07) · toujours là depuis le 24/10
- **Preuve** : `v3/messages.js:292` le dit au membre ; SEC-03 : un membre ne lit rien, mais `admin_discussions` et `admin_dm` restent ouverts à l’équipe sans condition.
- **Risque métier** : confiance, confidentialité (ARTCI non vérifiée). **Correctif** : décision du propriétaire (lecture seulement en cas de litige ?). **Non-régression** : test U02 à écrire.

#### ANO-010 · Comptes créés sans preuve du numéro (P1, U02 U07 U01) · toujours là
- **Preuve** : aucun envoi de code ; LOG-14 : `nego_ouvrir` ne compare que `user_id`, une même personne avec deux numéros peut s’acheter à elle-même ; PRO-03 : la fiabilité publique monte ainsi à « 100 % sur 5 ».
- **Risque métier** : faux comptes, fausse réputation. **Correctif** : attend un budget (SMS/WhatsApp). **Non-régression** : LOG-14, en attente du service d’envoi.

### P2 (28 ; 2 vérifiées)

| N° | Preuve reproductible | Risque métier | Correctif proposé | Non-régression |
|---|---|---|---|---|
| ANO-001 « L’acheteur vient chercher » | STA-03 | contredit la règle du transport | fait (PR #306) | **vérifiée** : STA-03 sans rouge |
| ANO-002 « Cocody » comme ville | STA-04 | commune prise pour une ville | fait (PR #306) | **vérifiée** : STA-04 réussi |
| ANO-003 51 textes trop longs | STA-08 | le membre ne lit pas | écran par écran, captures | STA-08 |
| ANO-007 ancienne quantité gardée sans le dire | SQL-boutiques-86 B | le vendeur se trompe de stock | fait (97d, PR #306), non rejoué | `litige-quantites-97` L4 |
| ANO-009 itinéraires OSRM public | serveur de démonstration | carte sans trajet | décision du propriétaire | à écrire |
| ANO-011 pas d’anti-robot | aucune vérification | inscriptions en masse | décision (Turnstile gratuit) | à écrire |
| ANO-014 quota de 3 annonces contourné | SEC-05 c : remise en ligne d’une annonce retirée avec un autre produit acceptée, compteur à 3 | publications illimitées sans vérification | compter la remise en ligne ; « 3 au total » ou « 3 en même temps » ? | SEC-05 c |
| ANO-015 profil gardé après suppression | PRO-02 b : `bio`, `activites`, `structure_nom` restent | vie privée | vider ces colonnes ou l’écrire | PRO-02 b |
| ANO-016 levée de bannissement sans trace | ADM-01 n° 4 : ligne `bannis` effacée, `admin_journal` +0 | équipe incontrôlable | journaliser avant d’effacer | ADM-01 |
| ANO-017 décision d’identité écrasée | ADM-01 n° 5, PRO-04 b | badge donné/retiré sans preuve | refuser la 2e décision ou journaliser | PRO-04 b |
| ANO-018 admin juge son propre litige | ADM-02 : `admin_litige_clore` accepté quand l’admin est vendeur | conflit d’intérêts | refuser si l’admin est partie | ADM-02 |
| ANO-019 `commandes` accepte l’impossible | BDD-02 : quantité -5, prix 0, vendeur = acheteur… acceptés | commande ou commission fausse | contraintes `check` (`not valid` puis `validate`) | BDD-02 |
| ANO-020 avis d’une commande annulée comptés | BDD-04 + `reputation_publique` | note publique fausse | ne compter que les commandes terminées | BDD-04 |
| ANO-021 pas de journal central de l’équipe | ADM-01 : 12 actions, `admin_journal` +0 | contrôle de l’équipe impossible | une ligne par action `admin_*` | ADM-01 |
| ANO-022 2e dépôt ignoré sans trace | ARG-15 / EXT-05b : réf. B perdue | **P0 le jour du paiement** : double débit sans remboursement | journal « dépôt en double » + alerte | EXT-05b |
| ANO-023 commandes sans sortie | CMD-12b/c/d : 30 jours sans alerte | stock et commission bloqués | alerte puis litige dans `commandes_delais` | CMD-12b/c/d |
| ANO-024 annulation pendante après chargement | CMD-09 | écran incohérent | refuser le chargement ou clore la demande | CMD-09 |
| ANO-025 notifications périmées | NOT-02/03 : 1 000 sacs à 20 000 annoncés, 10 à 30 000 en réalité | fausse promesse | relire l’offre à l’envoi | NOT-02/03 |
| ANO-026 vendeur banni : 72 h d’attente | EXT-06 : `TROP_TOT` | acheteur bloqué 3 jours | traiter les commandes du banni | EXT-06 |
| ANO-027 Excellent et Grand inatteignables | LOG-11 (`_niv_calculer` exige `validation = 'code'`, réseau fermé), DOC-10 | promesse de l’aide intenable | validation par code hors réseau, ou le dire | LOG-11 |
| ANO-028 suspendu : accord puis refus | LOG-12 | accord sans suite, stock immobilisé | fait (98b, PR #305), non rejoué | LOG-12 |
| ANO-029 « dans ma ville, l’acheteur s’en charge » | DOC-01 : `application.dc.html:828` `TR_OFF` | dispute à la livraison | réécrire le choix (captures) | DOC-01 |
| ANO-030 pitch « retenus » | DOC-02 : `strategie/sources/pitch.html` | prélèvement laissé croire | fait (PR #305), non rejoué | DOC-02 |
| ANO-031 4,4 Mo, 57 s en 3G lente | FIA-58, FIA-59 | abandon, forfait consommé | modules à la demande | FIA-58/59 |
| ANO-032 pas d’indication hors connexion | FIA-60 | annonces crues à jour | pastille « Hors connexion » | FIA-60 |
| ANO-033 « Indiquez la quantité » sans le champ | CMP-01 | publication abandonnée | défiler jusqu’au champ | CMP-01 |
| ANO-034 litige sans délai ni action | CMP-10, CMP-24 | acheteur perdu | échéance + bouton preuve | CMP-10 |
| ANO-035 délais en heures pleines | LOG-13 | vendeur pénalisé par un jour férié | décision du propriétaire | LOG-13 |

### P3 (25)

| N° | Preuve | Correctif proposé | Non-régression |
|---|---|---|---|
| ANO-004 textes copiés (26) | STA-05 | module commun | STA-05 |
| ANO-005 bleus (7) | STA-11 | exception motivée ou couleur | STA-11 |
| ANO-006 police `ui-monospace` | STA-10 | à juger | STA-10 |
| ANO-036 clés étrangères manquantes | BDD-01 | clés ou explication | BDD-01 |
| ANO-037 `villes_ref` tous droits | SEC-11 | lecture seule | SEC-11 |
| ANO-038 `search_path` modifiable (3) | SEC-11, `get_advisors` | `set search_path = public` | `get_advisors` |
| ANO-039 HTML stocké tel quel | SEC-06 | contrôle des `innerHTML` sans `esc` | SEC-06 |
| ANO-040 fiabilité gonflée | PRO-03 | règle anti-complices | PRO-03 d |
| ANO-041 messages techniques ou mal adressés | PRO-01, CMD-08d/f, TRA-04 | messages en français | idem |
| ANO-042 lecture sans verrou | lecture du code | `for update` | en attente : deux connexions |
| ANO-043 test ≠ production | `get_advisors` | aligner | LOG-16 |
| ANO-044 0,001 F, 0,5 sac, « camion » | STK-03, STK-07f | bornes et liste d’unités | STK-03 |
| ANO-045 aucun plafond de montant | ARG-10b | plafond | ARG-10b |
| ANO-046 `notif_ouverte` ouverte à tous | NOT-11d | contrôle du destinataire | NOT-11d |
| ANO-047 compte supprimé encore notifié | NOT-12 | refus dans `notif_preparer` | NOT-12 |
| ANO-048 texte renvoyé = 2 messages | EXT-02 | identifiant client | EXT-02 |
| ANO-049 caractère de contrôle accepté | EXT-03 | filtre dans `garde_textes` | EXT-03 |
| ANO-050 « [object Object] » au lecteur d’écran | FIA-04 ×14, `application.dc.html:800` | `toast.t` ou `aria-hidden` | FIA-04 |
| ANO-051 tutoriel de la liste sur une négociation | FIA-67 | tutoriel selon l’écran | FIA-67 |
| ANO-052 « de igname », « à le vendeur » | CMP-02, `v3/commandes.js:1168` | liaisons | CMP-02, CMP-11 |
| ANO-053 choix peu clairs, doublon, bloc trop tôt | CMP-04, 05, 07 | captures, choix du propriétaire | idem |
| ANO-054 aide, CGU, guide, FONCTIONNALITES en retard | DOC-03 à 09 | une PR de textes | idem |
| ANO-055 deux messages contradictoires en panne | FIA-63 | pas de « Aucune commande » si la lecture échoue | FIA-63 |
| ANO-056 mots de passe compromis non vérifiés | `get_advisors` | option peut-être payante | `get_advisors` |
| ANO-057 site caché : 5 modules en ancienne version | STA-02 | même `?v=` dans `index-v3.html` | STA-02 |

## 6. Risques résiduels et limites

- **Pas de vraie concurrence** : le MCP joue une transaction à la fois. Les tests « concurrent » sont joués l’un après l’autre dans un même bloc ; la vraie simultanée à deux connexions est **en attente** (SEC-10, BDD-06, STK-10, CMD-13, ARG-16, TRA-14, EXT-10/11). Prérequis : un script à plusieurs connexions sur le projet de test.
- **Test ≠ production** : tous les tests SQL ont été joués sur le projet de test (données de simulation : 100 comptes, environ 100 000 offres). La production a reçu 92 à 97a pendant le contrôle ; 97b à 98b y sont « à confirmer » ; les écarts relevés par `get_advisors` (ANO-043) montrent que les deux bases ne sont pas identiques. La production n’a été lue que par `get_advisors`.
- **Paiement non intégré** : dépôt, versement et remboursement réels **en attente** (ARG-12, 13, 14) ; rien n’a été simulé ni encaissé. ANO-022 deviendra P0 le jour du branchement.
- **SMS absent** : aucune preuve du numéro (ANO-010) ; les tests multi-comptes restent théoriques.
- **GPS réel** : jamais testé (TRA-14) ; le suivi du camion n’est vu qu’avec des positions factices.
- **Clés push** : l’envoi réel (`pousser`) n’est pas testé (NOT-15, FIA-71) ; seule la préparation côté base l’est.
- **Navigateur sans serveur** : les écrans sont vus avec des données factices (`_faux-serveur.js`) ; un écran qui s’affiche ne prouve pas que la fonction marche avec le vrai serveur (FIA-72 en attente : autoriser `catmsypctymgkjkfzdkt.supabase.co`). CMP-09 est bloqué pour cette raison.
- **Vrai téléphone** : réseau ivoirien et téléphone d’entrée de gamme non testés (FIA-73).
- **Anciens tests non rejoués** : les 18 fichiers `supabase/tests/` (dont `controle-corrections-98` et `litige-quantites-97`, arrivés pendant le contrôle).
- **Durée** : la batterie U10 prend 8 à 9 minutes, près de la limite de 10 minutes du lanceur : à surveiller sur GitHub.
- Absence d’erreur ≠ absence de faille ; un écran qui existe ≠ une fonction qui marche.

## 7. Comparaison avec le rapport précédent (`2026-10-25-00h39-tout.md`, script seul)

- **Nouveau** : les 10 batteries SQL, les 2 batteries navigateur et le jugement LOG/DOC/CMP ; 46 anomalies (ANO-012 à 057).
- **Toujours là** : ANO-003 à 006 (oranges du statique), ANO-008 à 011.
- **Réglé** : ANO-001 (rouge « L’acheteur vient chercher la marchandise » disparu, STA-03) et ANO-002 (STA-04 réussi), par la PR #306, vérifiés par `bash tools/controle/lancer.sh statique` sur le commit d’intégration. Corrigées mais non vérifiées : ANO-007, 012, 028, 030.

## 8. Corrections proposées (le propriétaire répond par les numéros)

1. ANO-012 et ANO-028 : rejouer PRO-02 b, LOG-10 et LOG-12 sur le projet de test, et vérifier que 98a et 98b sont en production.
2. ANO-013 : lire la requête ARG-06b sur la production (lecture seule, avec votre accord), puis requalifier les lignes « due » sans séquestre.
3. ANO-008 : décider quand l’équipe peut lire les messages privés.
4. ANO-022 et ANO-019 : trace du 2e dépôt et contraintes sur `commandes` (avant tout branchement du paiement).
5. ANO-016, 017, 018, 021 : journal de l’équipe et interdiction de juger son propre litige.
6. ANO-023, 024, 026 : sorties automatiques des commandes bloquées.
7. ANO-025 : notifications relues avant l’envoi.
8. ANO-014, 015, 020, 027 : quota d’annonces, effacement du profil, avis, badges.
9. ANO-029, 054 et ANO-030 (relecture) : une PR de textes (formulaire d’offre, aide, CGU, guide, FONCTIONNALITES).
10. ANO-031, 032, 033, 034, 050 à 053, 055, 057 : une PR d’écrans (captures avant).
11. Le reste des P3 (ANO-036 à 049, 056) : une PR technique à part.
