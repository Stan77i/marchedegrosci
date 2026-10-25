# Rapport : les corrections de l'audit (octobre 2026)

Pour : le propriétaire. Écrit dans la nuit du 24 au 25/10/2026, **mis à jour le 25/10/2026 dans la journée** (partie 9 : ce qui s'est passé depuis).
La page courte à lire d'abord est `TABLEAU-DE-BORD.md`, à la racine. Ce rapport-ci donne le détail.
Sources : l'audit (`docs/audits/audit-logique-viabilite-2026-10-24.md`), `docs/PASSATION.md` (sections « Équipe A » à « Équipe F »), la PR #300 (tests de bout en bout), `docs/essai-ferme/`, `docs/juridique/`.
Règle de ce rapport : rien n'est inventé. Ce qui n'a pas été vérifié est écrit « non vérifié ».

---

## 1. En bref

1. L'audit du 24/10 donnait **49 sur 100** : bon pour un essai fermé, pas pour le grand public.
2. Les corrections sont **faites, testées sur le projet de TEST, puis appliquées sur le vrai serveur le 25/10/2026** (schémas 92 à 97a, puis 97b à 98b ; fonction des notifications `pousser` v25), avec votre « OK production ».
3. Depuis : litige en 1 h après « livré », quantité minimale, contrôle qualité permanent (premier bilan : 0 défaut très grave, 4 graves), décisions juridiques triées, kit de l'essai fermé (partie 9).
4. À faire maintenant : fusionner les PR #309 (juridique) puis #310 (essai fermé) ; répondre aux décisions de `docs/juridique/DECISIONS-A-PRENDRE.md` ; choisir les corrections du contrôle qualité.
5. Ensuite : lancer l'essai fermé.

---

## 2. Ce qui a été corrigé

Mot utile : un **schéma**, c'est un fichier de changements pour le serveur (`supabase/schema-NN-….sql`).

### 1) Le stock et les commandes bloquées (schémas 92a à 92d, PR #293)

- **Pour un membre** : quand une vente tombe, la marchandise revient sur l'annonce ; une commande ne reste plus jamais bloquée.
- Le stock revient dans tous les cas avant le chargement : refus, retrait, expiration, annulation, litige. Une seule fois par commande.
- Un accord sans commande pendant **72 h** devient « sans suite » ; le stock revient.
- Le vendeur a **72 h** pour charger après la confirmation (rappel 12 h avant). Après, l'acheteur peut annuler seul ; l'annulation compte contre le vendeur.
- Un problème peut être signalé **dès la confirmation**. L'équipe a 72 h pour trancher un litige, et peut **partager** (une partie due, une partie non due).
- Le mot secret de réception : **5 essais** au plus.
- L'**acheteur** dit « La marchandise est arrivée ». Le vendeur peut dire « Marchandise livrée » une fois. Si l'acheteur se tait 24 h après : litige automatique, l'équipe regarde, personne n'est puni. *(Changé le 25/10/2026 : 1 h au lieu de 24 h, puis clôture pour le vendeur et litige perdu pour l'acheteur muet ; voir partie 9.)*
- L'équipe peut sortir toute commande en cours (avec une note obligatoire).
- Tâche automatique `mdg-commandes-delais`, toutes les 15 min.

### 2) Les contournements fermés (schémas 93a à 93e, PR #294)

- **Pour un membre** : ce qu'on négocie ne peut plus changer en cours de route, et personne ne passe à côté des règles.
- Pendant une négociation, le vendeur ne peut plus changer le produit, l'unité ou la ville.
- Fin du « 160 sacs vendus pour 100 » : un téléphone qui renvoie une vieille quantité est refusé.
- Les annonces durent **30 jours**, avec un rappel 3 jours avant et un bouton « Prolonger 30 jours ». Une annonce expirée est cachée, jamais effacée.
- Une offre en pause ne reçoit plus de proposition. Une négociation arrêtée ne se rouvre pas avant 24 h.
- Les achats groupés suivent maintenant « ville seulement » et la suspension.
- Les anciennes fonctions de commande ne sont plus appelables par les membres.
- Tâche automatique `mdg-annonces-expirer`, toutes les 15 min.

### 3) La confiance : identité, badges, signalements, codes de réception (schémas 94a à 94h, PR #296)

- **Pour un membre** : on ne peut plus se faire passer pour le Marché de Gros, ni fabriquer un badge à deux, ni cacher l'annonce d'un concurrent avec de faux comptes.
- **Noms réservés** refusés : « Marché de Gros », MGCI, admin, support, équipe, officiel… même écrits avec des chiffres (« M4rché de Gr0s »).
- **Identité vérifiée** : le prénom et le nom ne changent plus.
- **Numéro contesté** : l'équipe peut rendre un numéro à son vrai propriétaire. Tout est noté dans un journal. Le numéro d'un compte supprimé est libéré (sauf pour un banni).
- Une **pièce d'identité** ne peut servir qu'à un seul compte.
- **Badges** : 3 commandes au plus comptées par partenaire, 3 partenaires différents au moins, 60 min au moins entre création et réception. L'équipe voit les « paires » qui ne commercent qu'entre elles.
- **Signalements** : il faut 3 membres vérifiés, inscrits depuis 30 jours, pour cacher une annonce. Le vendeur est prévenu et peut contester.
- Un **litige perdu** compte contre celui qui l'a ouvert.
- **Photos de départ** : prises après la confirmation, jamais réutilisées.
- La date d'une annonce est posée par le serveur.

### 4) Transport et messages harmonisés (schémas 95 et 95b, PR #292)

- **Pour un membre** : les textes disent la vérité sur l'argent et le transport.
- **6,9 %** seulement avec le service de transport Marché de Gros (toujours fermé). Plus jamais affiché à un livreur privé.
- Le **transport « à part »** est compté dans le total.
- Le service de transport ne peut pas s'ouvrir avec moins de 3 transporteurs vérifiés.
- La commission est seulement « **calculée** », jamais réclamée, tant que l'argent ne passe pas par l'application.
- Textes : plus de « Paiement sécurisé », « Paiement libéré », « remboursement tout seul ». Une seule phrase : « Le Marché de Gros met en relation. Il n'est ni vendeur, ni acheteur. »

### 5) Conditions d'utilisation et règles de responsabilité (PR #291)

- **Ce sont des brouillons.** Rien n'est en ligne. Aucune case « J'accepte » n'est branchée.
- Fichiers : `docs/juridique/conditions-utilisation.md`, `confidentialite.md`, `mentions-legales.md`, `regles-manquantes.md` (32 questions pour vous).
- **À faire relire par un juriste** avant toute publication.
- Découvertes : l'équipe peut lire toutes les conversations privées ; sur la carte, un trajet part vers un serveur public extérieur (OSRM).

### 6) Les problèmes techniques (schémas 96a à 96f, PR #295)

- **Pour un membre** : l'application coûte beaucoup moins de forfait et va plus vite.
- Mise à jour de l'application : **17,6 Mo → 0,44 Mo** téléchargés (mesuré dans Chromium, iPhone émulé).
- Tableau des prix : **4,3 s → 1,5 ms** (calculé d'avance toutes les 5 min). Seules les annonces de moins de 30 jours comptent, sans prix fous.
- Notifications : plus d'annonce d'une offre déjà retirée ; un envoi raté repart (3 essais).
- Messages privés : plus de doublon après une coupure ; le message part au retour du réseau.
- Une annonce ne quitte plus le marché parce qu'elle manque sur le téléphone.
- Photos 28 % plus légères (WebP).
- Alertes produits : tous les abonnés sont prévenus (jusqu'à 2 000).

### 7) Les tests de bout en bout (PR #300, schéma 97a)

Mot utile : un **test de bout en bout**, c'est jouer un parcours entier, de l'annonce à la fin, avec plusieurs faux membres.

- Le projet de test a bien la dernière version : 121 fonctions sur 121 identiques aux fichiers.
- 15 fichiers de tests rejoués : tout passe. 4 tests étaient périmés (écrits avant les nouvelles règles) : mis à jour et rejoués, ils passent.
- Contrôles : les tâches automatiques tournent sans échec ; toutes les tables sont protégées ; les fonctions internes sont fermées au public.
- Petite correction trouvée et faite (**97a**, test seulement) : un message privé en double se cherche dans la même conversation seulement.

| Parcours | Ce qu'on a joué | Résultat |
|---|---|---|
| a | Vente complète : pas de chargement sans photos, poids et papier du mot secret ; pas de réception sans le mot ; clôture seule après 1 h ; commission « calculée » | Passe |
| b | Commande refusée : motif obligatoire ; stock rendu, annonce de nouveau en ligne | Passe |
| c | Accord sans commande : rien à 71 h ; à 73 h stock rendu ; commande ensuite refusée | Passe |
| d | Rien chargé en 72 h : annulation trop tôt refusée ; à 73 h l'acheteur annule ; « abusive » pour le vendeur + avertissement | Passe |
| e | Acheteur muet : rappel à 13 h, litige automatique à 25 h, partage par l'équipe | Passe |
| f | Achat groupé hors de la ville, et membre suspendu : refusés | Passe (test existant, pas rejoué en parcours) |
| g | Annonce expirée puis prolongée : de nouveau en ligne 30 jours | Passe (test existant) |
| h | Service de transport fermé : refus | Passe (test existant) |
| i | Nom « Marché de Gros » : refusé | Passe (test existant) |
| j | Deux accords sur le même stock (offre et demande) : le 2e refusé (« il reste 2 ») | Passe |
| k | Notification d'une offre déjà retirée : pas envoyée | Passe (test existant) |
| l | Message envoyé deux fois : une seule ligne | Passe (test existant) |

Un seul point reste à décider par vous : la vieille quantité gardée sans message (voir partie 5, décision 1).

### 8) L'essai fermé avec 20 à 50 utilisateurs (PR #290)

- **Le plan est prêt** : `docs/essai-ferme/PLAN.md`. **L'essai n'est pas commencé.**
- Proposition : 2 ou 3 produits, 1 ou 2 villes, 4 semaines, des personnes que vous connaissez, autant de vendeurs que d'acheteurs.
- Invitation gratuite : vous-même, avec un lien qui ouvre le bon écran, ou un QR code par lieu.
- Beaucoup de choix restent à vous (nombre, produits, villes, durée, critères de réussite, numéro d'aide). Voir partie 5.
- Ce qui n'a pas pu être testé est listé dans `docs/essai-ferme/A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`.

---

## 3. Où c'est appliqué

> **Mise à jour du 25/10/2026 : tout est en production.** Après votre « ok production », les schémas 92a à 97a ont été appliqués sur le vrai serveur entre 00 h 34 et 00 h 55 (UTC), et `pousser` v24 déployée (PR #304). Puis, après « C'EST FAIT, MET EN PRODUCTION », 97b, 97c, 97d, 98a et 98b vers 01 h 36, et `pousser` v25 à 03 h 54 (PR #308). Contrôles faits : nombres de lignes identiques avant et après, aucune ligne effacée, fonctions identiques à celles du test, tâches automatiques qui tournent. Détail : `docs/PASSATION.md`, sections « Production : schémas 92 à 97a » et « Production : schémas 97b à 98b ». Le texte ci-dessous est l'état de la nuit, gardé tel quel.

- **Projet de TEST** (`yowdymdnoiubatxlwhfv`) : schémas 92a à 92d, 93a à 93e, 94a à 94h, 95, 95b, 96a à 96f, et 97a. **Tout y est.**
- **Production** (`catmsypctymgkjkfzdkt`) : cette nuit-là, rien de tout cela. Elle était restée au schéma 91.
- La fonction d'envoi des notifications `pousser` v24 était dans le dépôt, déployée nulle part.
- Les écrans (déjà fusionnés dans `main`) attendaient ces nouveautés du serveur.

**Ordre prévu (et suivi le 25/10/2026) :**
1. 92a, 92b, 92c, 92d ;
2. 93a, 93b, 93c, 93d, 93e ;
3. 94a, 94b, 94c, 94d, 94e, 94f, 94g, 94h ;
4. 95, puis 95b ;
5. 96a, 96b, 96c, 96d, 96e, 96f ;
6. 97a ;
7. puis il redéploie la fonction `pousser` (v24).

Chaque lot est d'abord revérifié sur le test. Jamais de test destructif ni de changement de données en production sans votre accord.

---

## 4. Les petites retouches d'écran du jour

| PR | Ce que c'est | État (25/10/2026) |
|---|---|---|
| #297 | Documents : état après les corrections | Fusionnée |
| #298 | Mon compte : la phrase sous « Vos statuts » est retirée | Fusionnée |
| #299 | Publier : plus de blocs « Nom affiché » et « Numéro de votre compte » | Fusionnée |
| #300 | Tests de bout en bout + schéma 97a | Fusionnée |
| #303 | Textes en trop retirés des écrans (slogans, phrases qui répètent le titre) | Fusionnée |
| Ce rapport | n'avait jamais été proposé en PR ; il arrive avec la PR « Tableau de bord du propriétaire : une seule page à lire » | Ouverte |

---

## 5. Vos décisions en attente

> **Mise à jour du 25/10/2026** : la liste à jour, avec un conseil pour chaque point, est `docs/juridique/DECISIONS-A-PRENDRE.md` (PR #309). Depuis cette nuit :
> - n° 1 : la vieille quantité n'est plus gardée sans rien dire ; l'application affiche « La quantité a changé, vérifiez votre annonce. » (schéma 97d, en production) ;
> - n° 5 : tranché autrement : après « livré », **1 h** (et non 24 h) pour répondre, sinon litige, puis 1 h plus tard clôture pour le vendeur ; l'acheteur muet perd un litige (schémas 97b et 97d, en production) ;
> - n° 11 : tranché : **l'équipe peut lire tous les messages** (« l'app n'est pas un WhatsApp, c'est une mise en relation ») ; écrit dans les projets de textes (PR #309) ;
> - n° 17 : la commission des ventes d'avant le paiement n'est jamais réclamée (règle déjà en service, schéma 95b). Le n° 16 (les 51 lignes « due » du test) reste à corriger : défaut ANO-013 du contrôle qualité.
> Les autres lignes restent ouvertes et sont reprises dans `DECISIONS-A-PRENDRE.md`. Le texte ci-dessous est celui de la nuit.

Chaque ligne : la question, puis mon conseil.

1. **Vieille quantité renvoyée par un téléphone** : aujourd'hui le serveur la garde sans rien dire. Conseil : afficher « La quantité a changé, vérifiez votre annonce ».
2. **7 jours de grâce** pour les annonces déjà en ligne avant leur expiration. Conseil : oui (il y a peu d'annonces en production).
3. **Durée des annonces** : 30 jours, rappel 3 jours avant. Conseil : oui, pour les offres et les demandes.
4. **Rôle acheteur / vendeur** : simple affichage, ou blocage. Conseil : simple affichage ; un membre peut acheter et vendre.
5. **Litige automatique 24 h** après le « livré » du vendeur si l'acheteur se tait. Conseil : garder ; personne n'est puni, l'équipe regarde.
6. **Délais par défaut** : accord sans commande 72 h, chargement 72 h, litige traité en 72 h. Conseil : garder pour l'essai fermé ; ils sont réglables.
7. **Valeurs des badges** (3 commandes par partenaire, 3 partenaires, 60 min ; alerte à 3 commandes / 60 %). Conseil : garder pour l'essai, revoir après.
8. **Masquage d'une annonce** par 3 membres vérifiés inscrits depuis 30 jours, ou plus de masquage automatique. Conseil : garder 3 membres vérifiés.
9. **Un litige perdu** donne un avertissement dès le premier. Conseil : garder.
10. **Négociation arrêtée** : pas de nouveau prix pendant 24 h. Conseil : garder.
11. **L'équipe peut lire les messages privés**, sans condition. Conseil : limiter aux litiges, signalements et alertes, et noter chaque lecture.
12. **Itinéraires de la carte** envoyés au serveur public OSRM. Conseil : passer par notre serveur (gratuit), ou arrêter cet envoi.
13. **Comptes supprimés avant le schéma 94b** : leur numéro reste bloqué. Conseil : les libérer un par un, sur demande, avec « Numéro contesté ».
14. **Pseudo d'un membre vérifié** : encore modifiable. Conseil : le laisser modifiable (le nom vérifié, lui, est figé).
15. **Anti-robot (Turnstile)** ou limite d'inscriptions. Conseil : Turnstile partout, en mode invisible (compte Cloudflare gratuit).
16. **Anciennes commissions « dues »** sur le test (51 ventes, 20 transports). Conseil : les afficher « d'avant la règle : non réclamée ».
17. **Commission des ventes d'avant le paiement intégré** : jamais réclamée ? Conseil : oui, y renoncer par écrit.
18. **Notifications** : effacer le journal après 90 jours ; clés push pour le projet de test. Conseil : oui aux deux, avec de nouvelles clés gratuites pour le test (pas celles de la production).
19. **Alerte d'un numéro dans un litige** : une ligne à coller dans Supabase (`docs/REPRISE.md`, partie 3, « 0 ter »). Conseil : oui.
20. **Essai fermé** : nombre de personnes, produits, villes, durée, critères de réussite, numéro et horaires de l'équipe. Conseil : 20 personnes, 2 produits, 1 ville, 4 semaines pour commencer.
21. **Lire la production** (volumes, journaux) pour clore l'audit. Conseil : regarder vous-même le tableau de bord Supabase, ou autoriser une lecture seule précise.
22. **Les 32 questions** de `docs/juridique/regles-manquantes.md` (délais, casse en route, force majeure, numéro, données…). Conseil : une séance ; accepter les propositions écrites, sauf avis contraire du juriste.
23. **Juriste et ARTCI** (déclaration des données personnelles) ; remplir `docs/juridique/mentions-legales.md`. Conseil : chercher une aide gratuite (clinique juridique, chambre de commerce) avant de payer.

---

## 6. Ce qui reste à faire

> **Mise à jour du 25/10/2026** : la liste à jour, avec qui fait quoi, est dans `TABLEAU-DE-BORD.md`, partie 4.

### À faire par moi (Claude)

- ~~Après votre « OK production » : appliquer 92a à 97a, puis redéployer `pousser` v24, et vérifier.~~ **Fait le 25/10/2026** (puis 97b à 98b et `pousser` v25).
- Corriger les restes connus :
  - la relance « accord sans commande » part encore après un accord « sans suite » ;
  - deux messages du serveur : « 24 h » au lieu de « 1 h » (litige) et « pas de remboursement » au lieu de « pas de refus » ;
  - l'étape « Commande terminée » est cochée pendant l'heure de vérification (dire « Marchandise reçue ») ;
  - règle d'accès plus rapide (`(select auth.uid())`) sur les annonces, négociations et profils ;
  - carte et recherche : pagination (fin de la limite de 500 annonces) ;
  - itinéraires de la carte par notre serveur (selon votre décision 12) ;
  - afficher le volume des photos dans le tableau de bord ;
  - liste « Notifications » de Mon compte lue sur le serveur.
- Vérifier la première nuit de la tâche des badges `mdg-niveaux` (aucune exécution vue au moment des tests).
- Les tests faisables sans vous (`A-CONFIRMER…`, points 2, 5, 11, 12, 13, 15, 16, 17) : plusieurs acheteurs en même temps, itinéraires, liste de 30 annonces, inscriptions en rafale, vraies tâches automatiques, mesures sur peu d'annonces, transport à trois, lecture du code de la carte.
- Refaire l'**audit de sécurité** avant l'ouverture au public.
- À savoir : sur le test, environ 61 600 offres de simulation vont expirer à partir du 31/10 (500 par quart d'heure). C'est normal.

### À faire par vous

- [x] Fusionner #300 (fait le 25/10/2026).
- [x] Regarder les captures des « textes en trop » et dire oui ou non (fait : PR #303 fusionnée).
- [x] Écrire « OK production » (fait le 25/10/2026, deux fois : 92 à 97a, puis 97b à 98b).
- [ ] Répondre aux décisions de la partie 5.
- [ ] Autoriser le serveur `catmsypctymgkjkfzdkt.supabase.co` dans l'environnement Claude, puis un compte de test (`docs/A-FAIRE-PROPRIETAIRE.md`, parties 1 et 2).
- [ ] Une séance avec votre téléphone : notifications, carte en 3G, réseau lent (points 3, 4, 8, 10 de `A-CONFIRMER…`).
- [ ] Autoriser, si vous voulez, le retrait des index en double `sim_tmp_*` du projet de test (cela demande un « drop index » : votre accord est obligatoire). Le nettoyage des données de simulation reste facultatif.

### À faire avec un budget

- Preuve du numéro par **SMS ou WhatsApp** (code envoyé).
- **Juriste**, si aucune aide gratuite n'est trouvée.
- **Partenaire de paiement** agréé (partie 7).
- Un plan Supabase payant **seulement** si les quotas gratuits sont dépassés (pas le cas aujourd'hui, non mesuré en production).

### Points non vérifiés qui empêchent de clore l'audit

- **Vrais paiements** : il n'y en a aucun. Rien n'a été simulé.
- **Charge simultanée** : plusieurs acheteurs au même instant. Validé par lecture du code seulement.
- **Fonctions externes** : `pousser` (envoi réel des notifications) et `itineraire` jamais testées en réel ; serveur public OSRM sans garantie.
- **Tâche des badges `mdg-niveaux`** : première exécution pas encore vue.
- **Vrai téléphone en 2G/3G**, et notifications sur vrai téléphone.
- **Production** : volumes et journaux jamais lus en entier (le 25/10/2026, seuls les nombres de lignes, les fonctions, les tâches et les conseillers de sécurité ont été lus, au moment de la mise en production).
- ~~Écrans actuels avec l'ancien serveur de production~~ : sans objet depuis la mise en production du 25/10/2026.
- Inscriptions (limite de 20 par 5 min) : non testées.
- Quotas gratuits (Supabase, GitHub Pages) : chiffres non revérifiés.

---

## 7. Le jour où vous aurez votre partenaire de paiement

Aujourd'hui, **aucun argent ne passe par l'application**. La commission est seulement « calculée ». Rien n'est encaissé.

**Pour commencer, ouvrez une discussion et écrivez :**
> J'ai mon partenaire de paiement : <nom>

**Ce qu'il faut préparer** (déjà listé dans `docs/A-FAIRE-PROPRIETAIRE.md`, partie 5) :
- le choix du prestataire (par exemple un service de Mobile Money agréé), son nom et sa documentation technique ;
- ses **clés de TEST**. Elles se mettent dans les réglages du serveur Supabase, **jamais dans l'application ni dans la discussion** ;
- vos règles d'argent :
  - qui paie quand (à la commande, à la confirmation, à la réception) ;
  - ce que devient l'argent en cas de litige ;
  - le **séquestre** : l'argent est gardé de côté jusqu'à la clôture de la commande ;
  - la commission devient « **due** » seulement quand l'argent est passé par ce séquestre (c'est déjà la règle du serveur, schéma 95b) ;
  - ce qu'on fait des commissions « calculées » d'avant (conseil : rien n'est réclamé).

**Ce que Claude fera alors, dans l'ordre :**
1. Refaire l'**audit de sécurité** (règle du projet).
2. Écrire vos règles d'argent dans `CLAUDE.md`.
3. Brancher le partenaire sur le **projet de test** seulement, avec les clés de test.
4. Tester : paiement, séquestre, clôture, litige, partage, annulation. Sans jamais prendre de vrai argent.
5. Changer les textes, avec captures pour votre accord. Jamais « payé » avant la vraie confirmation du partenaire.
6. Production seulement après votre « OK », puis un nouvel audit.

Rien n'est présenté comme encaissé tant que le partenaire n'est pas branché et testé.

---

## 8. Note honnête

Vers 23 h 50, deux appels de test vers le **projet de test** ont été refusés par erreur. Le travail s'est arrêté, puis a repris avec l'accord du coordinateur, entre 23 h 58 et 00 h 30. Les parcours b, c, d, e et j ont alors été joués : tous passent. Rien n'a été perdu. La production n'a jamais été touchée.

---

## 9. Ce qui s'est passé depuis (25/10/2026, journée)

Rien n'est inventé ici : chaque point renvoie au document qui le prouve.

### 1) Le vrai serveur est à jour

- **92a à 97a** appliqués entre 00 h 34 et 00 h 55 (UTC), `pousser` v24 déployée (PR #304, fusionnée).
- **97b, 97c, 97d, 98a, 98b** appliqués vers 01 h 36, `pousser` v25 déployée à 03 h 54 (PR #308, fusionnée).
- Contrôles : nombres de lignes identiques avant et après (offres 4, demandes 3, négociations 3, commandes 2, profils 3…), aucune ligne effacée, fonctions comparées une à une avec le test, tâches automatiques vues en train de tourner (toutes les 5 min pour les commandes et les notifications).
- Détail : `docs/PASSATION.md`, sections « Production : schémas 92 à 97a » et « Production : schémas 97b à 98b ».

### 2) Litige en 1 h et quantité minimale (PR #306, fusionnée, en production)

- Après « livré » déclaré par le vendeur, l'acheteur a **1 h** pour confirmer la réception ou signaler un problème. Sans réaction, un litige s'ouvre tout seul. 1 h plus tard, toujours sans réaction, la commande est close pour le vendeur (rien n'est versé : aucun paiement n'existe) et l'acheteur perd un litige dans sa fiabilité.
- Une demande peut avoir une **quantité minimale** (par vendeur), comme une offre (par acheteur). La quantité est obligatoire à la publication.
- La « vieille quantité » renvoyée par un téléphone en retard est signalée au membre.

### 3) Suppression du compte et membre suspendu (PR #305, fusionnée, en production)

- On ne peut plus supprimer son compte avec une commande en cours, un litige, un accord sans commande ou une suspension (schéma 98a).
- Un membre suspendu ne peut plus faire de proposition ni conclure d'accord (schéma 98b).
- Le pitch et les PDF disent « commission prévue », plus jamais « retenue ».

### 4) Contrôle qualité permanent (PR #307, fusionnée)

- Dossier `CONTROLE_QUALITE/` : 14 unités de contrôle, tests du serveur (sur le projet de test seulement) et des écrans (iPhone émulé).
- Premier contrôle général : **238 tests** (148 réussis, 69 échoués, 1 bloqué, 4 non lancés, 16 en attente), **57 défauts** (0 très grave, 4 graves, 28 gênants, 25 cosmétiques).
- Les 4 graves : suppression du compte en commande (corrigée par 98a, test à rejouer) ; 51 commissions « due » sans argent sur le test (vrai serveur pas lu) ; lecture des messages par l'équipe (vous avez décidé que c'est voulu) ; numéro non prouvé (attend un budget).
- Ce qui tourne tout seul : contrôle à chaque PR (déjà vu tourner sur GitHub), chaque jour et tous les 3 jours. La tâche Claude tous les 3 jours n'a pas l'accès au serveur : à recréer par vous avec le connecteur Supabase.
- Vous choisissez les corrections par numéros : `CONTROLE_QUALITE/DERNIER_RAPPORT.md`, partie 8.

### 5) Juridique (PR #309, ouverte)

- Votre décision : **l'équipe peut lire tous les messages** ; les projets de textes le disent clairement.
- Les 32 questions sont triées : **17 tranchées, 15 restent**, chacune avec un conseil, plus 4 points de l'audit (A à D). Fichier : `docs/juridique/DECISIONS-A-PRENDRE.md`. Répondre « ok pour tout » ou « ok sauf n° X ».
- Les textes restent des **projets** : rien n'est en ligne, aucun juriste ne les a encore relus.

### 6) Essai fermé (PR #310, ouverte)

- Kit pour le lancer vous-même en une heure : `docs/essai-ferme/LANCER-EN-1-HEURE.md`, avec les messages à copier, le guide des participants, le suivi, le questionnaire et des critères de réussite proposés (à valider avant le premier jour).
- Conseil gardé : 20 personnes (10 vendeurs, 10 acheteurs), 2 produits, 1 ville, 4 semaines.
- **L'essai n'est pas commencé.** Deux conditions du plan ne sont pas remplies : conditions d'utilisation acceptées à l'inscription, audit de sécurité refait. Lancer sans elles est votre décision, à écrire dans le suivi.

### 7) Ordre de fusion

#309, puis #310, puis la PR « Tableau de bord du propriétaire : une seule page à lire » (qui porte ce rapport).
