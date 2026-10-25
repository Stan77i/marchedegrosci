# Plan de l'essai fermé (20 à 50 vendeurs et acheteurs réels)

Statut : **proposition**. Les points marqués **[À VALIDER]** sont à décider par le propriétaire. Rien ici n'est encore lancé.
Kit pour lancer l'essai soi-même en une heure : `LANCER-EN-1-HEURE.md` (avec `MESSAGES.md`, `GUIDE-PARTICIPANT.md`, `SUIVI.md`, `QUESTIONNAIRE.md`, `CRITERES-DE-REUSSITE.md`).
Sources : `AUDIT.md` (parties 4, 9, 10, 13), `FOUNDER_CONTEXT.md`, `FONCTIONNALITES.md`, `docs/REPRISE.md`.

## 1. Objectif

Vérifier, avec de vrais vendeurs et de vrais acheteurs, que le parcours **publier → négocier → commander → livrer → réceptionner** tient du début à la fin, **avant** l'ouverture au public.

On veut savoir :
- où les gens abandonnent ;
- combien de temps l'équipe passe réellement (identités, litiges, aide) ;
- si les règles tiennent (stock, commandes bloquées, annulations, litiges).

L'audit conclut : MGCI est prêt pour un essai fermé et accompagné, pas pour un lancement public. Il n'y a que 4 comptes en production : l'essai sert aussi à ne pas ouvrir un marché vide.

## 2. Conditions pour démarrer

Ne pas inviter personne tant que ces cases ne sont pas cochées (corrections P1 de l'audit, partie 9).

- [ ] **Stock rendu** quand une commande est refusée, retirée ou expire ; accord sans commande « sans suite » après un délai (P1 n° 1).
- [ ] **Commande confirmée jamais bloquée** : délai de chargement, annulation, litige dès la confirmation, issue pour l'équipe (P1 n° 2).
- [ ] **Noms réservés** refusés par le serveur : « Marché de Gros », mgci, admin, support (P1 n° 3).
- [ ] **Numéro jamais présenté comme vérifié** ; procédure « numéro contesté » ; limite d'inscriptions par IP (P1 n° 4). Pas d'OTP SMS : il faut un budget.
- [ ] **Conditions d'utilisation, mentions légales, confidentialité** acceptées à l'inscription (P1 n° 5). Formalité ARTCI à faire par le propriétaire.
- [ ] **Service worker** : plus de retéléchargement d'environ 10 Mo à chaque version (P1 n° 6). Indispensable sur 2G/3G.
- [ ] **Textes d'argent corrigés** : « Commande clôturée » et non « Paiement libéré » ; aucune promesse de remboursement ni de paiement (P2 n° 19).
- [ ] **Audit de sécurité refait** (règle du projet) et scénarios de l'audit rejoués sur le projet de test (plan, étape 10).
- [ ] **Décisions du propriétaire prises** : délais (accord sans commande, chargement, réception, litige), durée de vie des annonces (plan, étape 1).
- [ ] **Une personne de l'équipe disponible** chaque jour de l'essai (voir partie 5).
- [ ] **Les tests non faits de l'audit** sont passés ou assumés : voir `A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`.

## 3. Qui inviter

Cible : **20 à 50 personnes** **[À VALIDER]**, dans un périmètre petit pour que les offres et les demandes se rencontrent.

Périmètre proposé **[À VALIDER]** : **2 ou 3 produits** et **1 ou 2 villes**, choisis par le propriétaire dans le catalogue. Plus c'est étroit, plus un acheteur trouve vite un vendeur.

Profils (vendeurs : producteurs, grossistes, coopératives ; acheteurs : grossistes, détaillants, pros) :

| Profil | Part proposée | Ce qu'on attend de lui |
|---|---|---|
| Producteurs ou coopératives | un tiers | publier une offre réelle, négocier, charger |
| Grossistes (vendent et achètent) | un tiers | les deux côtés, plusieurs commandes |
| Acheteurs : détaillants, restaurants, cantines | un tiers | publier une demande, commander, réceptionner |

Règles :
- des **personnes que le propriétaire connaît** ou peut joindre directement ;
- **autant de vendeurs que d'acheteurs** dans la même ville et sur les mêmes produits, sinon l'acheteur ne trouve rien ;
- au moins quelques offres réelles **avant** d'inviter les acheteurs ;
- **aucun chiffre de marché** dans les messages d'invitation : n'en citer que s'il vient de `strategie/sources/donnees-marche.json` avec sa source.

## 4. Comment les inviter (gratuit)

- **Invitation directe** : le propriétaire écrit ou parle lui-même à chaque personne. Pas de publicité payante, pas de SMS ni de WhatsApp payants.
- **Lien d'intention** (déjà en place, `docs/REPRISE.md`) : un lien qui ouvre directement l'écran utile, par exemple `#/publier?sens=offre&produit=<produit>` pour un vendeur ou `#/publier?sens=demande&produit=<produit>` pour un acheteur.
- **QR code avec utm** (déjà en place) : `…/marchedegrosci/?utm_source=affiche&utm_medium=qr&utm_campaign=<lieu>`. Un QR par lieu (marché, coopérative), pour savoir d'où viennent les inscrits.
- **Mesure** : l'ouverture de l'application venue d'un lien ou d'un QR, puis la connexion qui suit, sont déjà comptées (schéma 81). Prendre un `utm_campaign` distinct par groupe invité (par exemple `essai-producteurs`, `essai-acheteurs`).
- Le site public reste caché pendant l'essai : l'invitation passe par l'application.

## 5. Accompagnement

- **Première vente guidée pas à pas** : pour chaque nouveau vendeur, un membre de l'équipe suit sa première annonce, sa première négociation et sa première commande jusqu'à la réception. Idem pour le premier achat d'un acheteur.
- **Numéro de l'équipe** : [À COMPLÉTER : numéro ou canal d'aide, à fournir par le propriétaire]. Un seul canal, gratuit.
- **Horaires de réponse annoncés** : [À VALIDER]. Ne rien promettre qu'on ne peut pas tenir.
- Un message de bienvenue simple : ce qu'est l'essai, qu'il est limité, qu'**aucun paiement ne passe par l'application** (le règlement se fait entre les personnes, hors application).
- Chaque difficulté vue est notée dans le journal de bord (partie 10), avec l'écran concerné.

## 6. Ce qu'on mesure

### Mesures qui existent déjà

| Question | Source existante | Remarque |
|---|---|---|
| D'où viennent les inscrits ? | `site_mesures` (schéma 81) : `ouverture_app`, `connexion_app`, avec `source` et `campagne` ; lu par `mesures_resume()` (administrateur) | jamais l'administrateur ; aucune donnée personnelle |
| Combien de membres, annonces actives, commandes terminées ? | `stats_publiques()` (schéma 79) | totaux seulement |
| Les notifications partent-elles et sont-elles ouvertes ? | `notif_stats`, `notif_stats_jours` (tableau de bord, Notifications) | envoyées, ouvertes, action sous 24 h ; pas l'affichage réel |
| Où en sont les commandes ? | tables de commandes et `commande_journal` : heure et auteur de chaque étape | permet de mesurer les délais entre étapes |
| Annulations, litiges, suspensions | fiabilité (schéma 84) : motifs et catégories ; litiges et leurs messages | à compter chaque semaine par une requête de l'administrateur |
| Temps de l'équipe | rien d'automatique | à noter à la main dans le journal de bord |

### Ce qui manque (dit honnêtement)

- **Abandons par étape** : il n'y a pas d'entonnoir mesuré (inscription → première annonce → première négociation → première commande → réception). Les événements de `site_mesures` s'arrêtent à la connexion. Option gratuite : compter par requêtes SQL à partir des tables existantes (membres, offres, négociations, commandes). Ce qui n'a pas laissé de ligne (écran quitté en cours de saisie) restera invisible. Ajouter de nouvelles mesures serait du code : hors de ce document.
- **Temps de l'équipe** : à noter à la main (journal).
- **Litiges et annulations** : à confirmer ce que le tableau de bord montre déjà ; sinon, requêtes SQL.
- **Satisfaction** : pas de mesure ; trois questions posées de vive voix en fin d'essai.
- **Notification réellement reçue sur un téléphone** : non mesurable.

## 7. Durée

Proposition **[À VALIDER]** : **4 semaines**.
- Semaine 0 : conditions cochées, invitation des vendeurs, premières annonces réelles.
- Semaine 1 : arrivée des acheteurs, premières négociations et commandes guidées.
- Semaines 2 et 3 : commandes en autonomie, l'équipe observe.
- Semaine 4 : bilan, décision.

## 8. Critères de réussite proposés **[À VALIDER]**

Aucun seuil chiffré n'est inventé ici : le propriétaire fixe les nombres avant le début.

- [ ] Au moins [N] commandes menées jusqu'à la clôture.
- [ ] Au moins [N] vendeurs différents ont reçu une commande, [N] acheteurs différents en ont passé.
- [ ] Aucune commande restée bloquée sans issue au-delà du délai prévu.
- [ ] Aucun stock « disparu » sans raison constaté.
- [ ] Litiges et annulations traités par l'équipe dans le délai prévu : [délai].
- [ ] Temps d'équipe par commande jugé tenable : [limite].
- [ ] Aucun incident de sécurité (accès aux données d'autrui, usurpation).
- [ ] Les participants disent qu'ils reviendraient (trois questions de vive voix).

## 9. Quand arrêter

Arrêt immédiat de l'essai, avec un message honnête aux participants, si :
- une faille de sécurité ou une fuite de données est constatée ;
- quelqu'un est trompé (usurpation, faux « Marché de Gros », demande d'argent déguisée) ;
- un texte laisse croire qu'un paiement ou un remboursement est garanti par MGCI ;
- des commandes se bloquent sans que l'équipe puisse les débloquer ;
- l'équipe n'arrive plus à répondre dans le délai annoncé ;
- le propriétaire le décide.

Pause d'un compte : décision de l'administrateur, selon les règles déjà validées (suspension 7 puis 30 jours).

## 10. Journal de bord hebdomadaire

Un court fichier par semaine (`docs/essai-ferme/journal-semaine-N.md`, à créer au fur et à mesure). Modèle :

```
Semaine N (du … au …)
- Participants actifs : vendeurs … / acheteurs …
- Annonces publiées : … ; négociations : … ; commandes : … ; clôturées : …
- Abandons vus (et à quelle étape) :
- Litiges : … ; annulations (motifs) : … ; suspensions : …
- Temps de l'équipe (heures) : identités … / litiges … / aide … / autre …
- Problèmes techniques (écran, téléphone, réseau) :
- Demandes des participants :
- Décision de la semaine :
```

Les chiffres viennent des mesures de la partie 6. Ce qui n'est pas mesuré s'écrit « non mesuré », jamais estimé.

## 11. Règles de l'essai

- **Aucune promesse de paiement.** Aucun paiement ne passe par l'application ; le règlement se fait entre les personnes, hors application.
- **Aucune commission encaissée**, aucune commission présentée comme encaissée. La commission n'est pas réclamée pendant l'essai.
- Jamais « payé » ni « paiement libéré ».
- Le transporteur du réseau MGCI reste fermé ; le transport est organisé par les participants.
- Aucune commande ni dépense déclenchée sans confirmation de l'acheteur.
- Vie privée : prénom ou initiale, ville, produit, quantité ; jamais de numéro ni de nom complet.
- Aucune action payante (publicité, SMS, WhatsApp, abonnement).
