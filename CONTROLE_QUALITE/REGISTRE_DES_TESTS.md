# Registre des tests

> Tous les tests du serveur, ce qu'ils vérifient, leur dernier résultat connu. **Un test qui n'a pas tourné est « non rejoué », jamais « passe ».**
> Source des résultats au 25/10/2026 : rapport de bout en bout de l'étape 7 (session du 24/10/2026 au soir, rejeux de 22 h 50 au 25/10/2026 à 0 h 30, projet de test), notes écrites dans chaque fichier et `docs/PASSATION.md`.
> Mise à jour : la session des gardiens propose les nouveaux résultats dans son rapport ; ce fichier est corrigé dans une PR à part (ou dans la PR qui ajoute le test).

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
| `e2e-parcours-scenarios.sql` *(sur la branche `claude/e2e-corrections`, pas encore dans `main` le 25/10/2026)* | Les parcours complets de bout en bout (partie 2). | Test | Voir partie 2 |

À la fusion de `claude/e2e-corrections` : vérifier que les fichiers de `main` portent bien les mises à jour notées ci-dessus, sinon les marquer « périmé ».

## 2. Parcours de bout en bout (étape 7)

Fichier : `supabase/tests/e2e-parcours-scenarios.sql` (branche `claude/e2e-corrections`). Comptes : S vendeur (Yamoussoukro), B acheteur (Daloa), ADM administrateur. Les fonctions sont appelées comme dans l'application, avec le rôle `authenticated`. Les fonctions `pg_temp.*` d'en-tête se lancent dans le **même appel** que chaque bloc.

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
2. Ajouter sa ligne au tableau de la partie 1, dans la **même PR** (règle de `CLAUDE.md`).
3. Ajouter, si besoin, la case à vérifier dans `LISTES-DE-CONTROLE.md`.
4. Jamais de `drop`, `delete`, `truncate` dans un test, même en commentaire (le MCP le refuse).
