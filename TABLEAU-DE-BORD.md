# Tableau de bord du propriétaire

**Dernière mise à jour : 25/10/2026**

C'est **la seule page à lire**. Tout ce qui est important est ici, en français simple. Les détails sont dans les documents cités tout en bas.

**Où on en est, en 3 lignes :**
1. L'application marche sur le vrai serveur, avec toutes les corrections de l'audit (depuis le 25/10/2026). Il y a encore très peu de vrais membres.
2. Aucun argent ne passe par l'application. La commission est seulement calculée, jamais encaissée.
3. Vos décisions sont prises (« ok pour tout », 25/10/2026). Prochaine grande étape : l'essai fermé (20 personnes, 4 semaines). Il attend votre « on lance ».

---

## 1. Ce que vous devez faire maintenant

Une « PR », c'est une proposition de changement : vous la fusionnez sur GitHub pour l'accepter.

1. **Fusionner les PR, dans cet ordre :**
   - [#311 Textes juridiques : décisions « ok pour tout » et liste « À construire »](https://github.com/Stan77i/marchedegrosci/pull/311)
   - [#312 Tableau de bord du propriétaire : une seule page à lire](https://github.com/Stan77i/marchedegrosci/pull/312) (cette page).
2. **Rien à choisir pour la construction** : vous avez dit « ok pour tout » ; Claude construit déjà ce que demandent vos décisions juridiques (liste « À construire » de `docs/juridique/DECISIONS-A-PRENDRE.md`).
3. **Rien à choisir pour les corrections du contrôle** : vous avez dit « Arrange » ; Claude corrige déjà les défauts (écrans, commandes, sécurité). Vous recevrez les captures, puis les PR à fusionner.
4. **Recréer la tâche des gardiens avec l'accès au serveur** (10 minutes, une seule fois) : sur claude.ai, ouvrir les tâches programmées, supprimer l'ancienne tâche « Lance le contrôle général MGCI », en créer une nouvelle avec le même texte, tous les 3 jours, **en cochant le connecteur Supabase**. Sans cela, les tests du serveur ne tournent pas tout seuls.
5. **Demain matin (26/10)** : sur GitHub, onglet « Issues », vérifier qu'une fiche « Contrôle quotidien » est apparue. Si rien n'apparaît, le dire à Claude.
6. **Préparer l'essai fermé** : ouvrir `docs/essai-ferme/LANCER-EN-1-HEURE.md`. Choisir la ville, les 2 produits, votre numéro d'aide et vos horaires. Valider les critères de réussite. Puis dire « on lance » ou « on attend ».
7. **Chercher une aide juridique gratuite** (clinique juridique d'une faculté de droit, chambre de commerce) pour relire les textes et la déclaration à l'ARTCI (l'autorité des données personnelles).

Plus tard, quand vous aurez 10 minutes :
- autoriser le serveur de l'application dans l'environnement Claude (mode d'emploi : `docs/A-FAIRE-PROPRIETAIRE.md`, partie 1) ;
- une séance avec votre téléphone pour essayer les notifications et la carte en réseau lent.

---

## 2. Ce qui marche aujourd'hui dans l'application

Tout ce qui suit est **en service sur le vrai serveur** (vérifié le 25/10/2026). « Non essayé en vrai » veut dire : testé sur le serveur d'essai, mais pas encore servi avec de vrais membres.

Le 25/10/2026, le vrai serveur compte 3 profils, 4 offres, 3 demandes et 2 commandes.

**S'inscrire et se protéger**
- Compte avec numéro et code secret de 6 chiffres. Le numéro n'est pas encore prouvé (il faudrait des SMS payants).
- Vérification d'identité par l'équipe (pièce + photo), badge vert « Identité vérifiée ». Les autres sont marqués « Non identifié ».
- 3 annonces gratuites, puis l'identité vérifiée est demandée.
- Noms réservés refusés (« Marché de Gros », « admin », « support »…, même écrits « M4rché »).
- Signaler une annonce ou une personne, bloquer quelqu'un, bannir (équipe).
- Supprimer son compte : refusé tant qu'il reste une commande, un litige ou une suspension en cours.

**Publier**
- Offres (« J'ai ») et demandes (« Je cherche »), avec photo du produit.
- Quantité obligatoire, quantité minimale possible (par acheteur ou par vendeur).
- Une annonce dure 30 jours, rappel 3 jours avant, bouton « Prolonger 30 jours ». Elle est cachée, jamais effacée.
- Vente et achat **uniquement dans la ville de l'annonce**. Abidjan compte pour une seule ville.
- Boutique du vendeur : une adresse à partager, un QR code, mise en pause possible.

**Voir le marché**
- Liste des annonces, tableau des prix (rapide, mis à jour toutes les 5 minutes), carte du réseau, recherche.
- Alertes produits : on est prévenu quand un produit arrive.

**Négocier et commander**
- Proposition de prix, contre-proposition, accord. Pendant une négociation, le vendeur ne peut plus changer le produit ni la ville.
- Un accord sans commande pendant 72 h devient « sans suite » : la marchandise revient sur l'annonce.
- Commande : le vendeur confirme, puis a 72 h pour charger (rappel 12 h avant). Sinon l'acheteur peut annuler.
- La marchandise revient toujours sur l'annonce si la vente tombe avant le chargement.
- Achats groupés, approvisionnement pro, « Racheter » et rappels d'achat existent (non essayés en vrai).

**Transport**
- Même ville : le vendeur organise son livreur, payé par l'acheteur, hors Marché de Gros.
- Villes différentes : transport inclus, à part (prix négocié), ou à la charge de l'acheteur.
- Le service de transport Marché de Gros est **fermé** tant qu'il n'y a pas 3 transporteurs vérifiés et votre accord.

**Preuves au départ et mot secret**
- Pas de chargement sans 2 à 4 photos du colis emballé et le poids pesé.
- S'il y a un mot secret : photo du papier avec un code au hasard (3 minutes). Seule l'équipe voit cette photo.
- À la réception, l'acheteur donne le mot secret (5 essais au plus).

**Réception et litige**
- Après la réception, l'acheteur a **1 h** pour signaler un problème. Sinon la commande se clôt toute seule.
- Après « livré » déclaré par le vendeur : l'acheteur a **1 h** pour confirmer ou signaler un problème. Sans réponse, un litige s'ouvre. 1 h plus tard, toujours sans réponse, la commande est close pour le vendeur et l'acheteur perd un point de fiabilité.
- Refus de la marchandise avec photos, discussion à trois avec l'équipe. L'équipe a 72 h pour trancher et peut partager.

**Fiabilité et badges**
- Annulation avec motif obligatoire, classée (abusive, légitime, litige, problème technique), comptée sur 90 jours.
- Suspension décidée par l'équipe (7 puis 30 jours), contestation en 7 jours. Un membre suspendu ne peut plus proposer ni conclure.
- Badges (Vendeur fiable, Bon, Excellent, Grand…) calculés chaque nuit sur 12 mois. Personne n'en a encore : pas assez de commandes terminées.

**Notifications**
- Automatiques, envoyées par le serveur : messages, négociations, commandes, litiges.
- Commerciales : 8 par jour au plus, 90 minutes d'écart, rien entre 21 h et 7 h.
- Un seul choix pour le membre : Activer ou Désactiver.

**Argent**
- Commission de 3,5 % sur la marchandise : **calculée seulement**. Rien n'est prélevé.
- 6,9 % sur le transport : seulement avec le service de transport Marché de Gros (fermé).

**Ce qui tourne tout seul sur le serveur**
- Les délais des commandes et les notifications : toutes les 5 minutes.
- L'expiration des annonces et la fiabilité : toutes les 15 minutes.
- Le tableau des prix : toutes les 5 minutes. Les badges : chaque nuit.

**Le site web**
- Sur ordinateur, le public voit une page de maintenance avec un QR code. Le nouveau site est construit mais **caché** : seul vous le voyez (bouton « SEO »).

---

## 3. Les règles de l'application

Ce sont vos décisions. Chaque ligne est une règle en service ou à respecter.

**Argent**
- Aucun paiement n'est branché. On ne simule rien, on n'écrit jamais « payé » ni « encaissé ».
- Aucune commande ni dépense ne part sans la confirmation de l'acheteur.
- Commission : 3,5 % sur la marchandise ; 6,9 % sur le transport seulement avec le service Marché de Gros.
- Les commissions des ventes d'avant le paiement ne seront jamais réclamées.
- Aucune solution payante tant qu'il n'y a pas de budget.

**Commandes et délais**
- Accord sans commande : 72 h. Chargement : 72 h. L'équipe tranche un litige en 72 h.
- Réception : 1 h pour réclamer, puis clôture toute seule.
- Après « livré » : 1 h pour répondre, sinon litige ; 1 h de plus sans réponse, clôture pour le vendeur.
- Marchandise cassée, gâtée, manquante ou non conforme : l'acheteur ne paie rien (ni marchandise ni transport) ; le risque reste au vendeur jusqu'à la réception. S'il le veut, l'acheteur propose de participer (transport seulement, partie gardée, ou un montant) ; le vendeur accepte ou refuse, sinon l'équipe tranche. Aucun argent ne bouge (serveur prêt sur le test, écran à faire).
- Pas de chargement sans photos du colis et poids ; un acheteur qui dit « cassé » face à des photos propres doit le prouver.

**Transport**
- Même ville : le livreur du vendeur, payé par l'acheteur, hors Marché de Gros.
- « Transport à la charge de l'acheteur » : jamais « non inclus » ni « l'acheteur vient chercher ».
- « À part » = livré par le vendeur avec un prix en plus, négocié.
- Le transporteur Marché de Gros : vérifié seulement ; service fermé sans 3 transporteurs et votre accord.

**Juridique et comptes (« ok pour tout », 25/10/2026)**
- Le Marché de Gros met en relation : il n'est ni vendeur, ni acheteur.
- Casse en route : le vendeur en répond jusqu'à la réception quand il livre ; l'acheteur dès le chargement quand le transport est à sa charge. Les photos de départ servent à trancher.
- Transport d'une marchandise refusée : payé par l'acheteur si le refus est rejeté, par le vendeur s'il est accepté.
- Force majeure : une photo ou une information publique (radio, presse, autorités) ; l'équipe juge.
- Achat groupé : le transport suit la règle écrite dans l'offre.
- Numéro contesté : pièce d'identité vue et appel de l'équipe sur ce numéro, tout est noté.
- Compte banni : il voit seulement « Compte banni » et « Contester » (7 jours ; réponse de l'équipe en 7 jours).
- Chaque geste de l'équipe sur un compte est noté (qui, quand, pourquoi).
- Conservation : commandes et négociations 5 ans, signalements et sanctions 2 ans, photos de preuve 1 an, journal des notifications 90 jours. Rien n'est effacé sans votre accord au moment de le construire.
- Demandes sur les données personnelles : réponse en 30 jours.
- Plus aucun trajet envoyé à un service public extérieur.
- Case « J'accepte » à l'inscription, après la relecture du juriste.
- Tout membre peut acheter et vendre (le rôle est un simple affichage). Annonces déjà en ligne : 7 jours de grâce avant l'expiration.
- Ces textes restent des projets tant qu'un juriste ne les a pas relus.

**Ville**
- On vend et on achète uniquement dans la ville de l'annonce.
- Abidjan est une seule ville : ses communes ne sont jamais des villes.
- Une ville d'une autre région n'est jamais gardée en mémoire.

**Fiabilité, badges, boutiques**
- Annulation : motif obligatoire, 90 jours glissants, suspension décidée par l'équipe, contestation en 7 jours.
- Badges : 12 mois, commandes terminées seulement, 30 jours de grâce avant de baisser.
- Boutique : activée par le vendeur ; « retirer » cache sans effacer.

**Messages et vie privée**
- L'équipe peut lire tous les messages : l'application est une mise en relation, pas une messagerie privée (votre décision du 25/10/2026).
- Sur le site : prénom ou initiale, ville, produit, quantité. Jamais de numéro ni de nom complet.

**Notifications**
- Seulement sur un fait réel. Aucune fausse urgence, aucune promesse non vérifiée.
- 8 commerciales par jour au plus, de 7 h à 21 h, 90 minutes d'écart.

**Écrans et textes**
- Une seule police (Jost). « de Gros » en jaune maïs. Pas de bleu, sauf l'eau sur les cartes.
- Pas de long texte d'explication, pas de slogan sous un titre.
- Une entrée à un seul endroit (pas de doublon). Les nombres dans une pastille.
- Aucun écran vide ni clignotement.

**Façon de travailler**
- Claude ne fusionne jamais : c'est vous. Une PR par changement.
- Captures d'écran (et vidéo pour une animation) envoyées avant chaque PR qui change un écran.
- Rien sur le vrai serveur sans votre « OK production ». Rien n'est effacé sans votre accord.
- Aucun chiffre inventé. Rien n'est dit « réussi » sans preuve.
- Ce tableau de bord est mis à jour à chaque changement d'état.

---

## 4. Ce qui reste à faire

Dans l'ordre conseillé.

| # | Quoi | Qui |
|---|---|---|
| 1 | Fusionner #311, puis #312 (ce tableau de bord) | Vous |
| 2 | Construire ce que demandent vos décisions juridiques, une PR par point avec captures : aide (casse en route), textes du transport en cas de refus, écran du compte banni, journal de tous les gestes de l'équipe, trajets de la carte par notre serveur, profil public sans compte limité aux totaux… L'effacement automatique après les durées seulement avec votre accord | Claude |
| 3 | Corrections du contrôle qualité (en cours, accord donné) | Claude |
| 3 bis | Participation de l'acheteur : répondre aux propositions P20 à P23 (24 h pour le vendeur, 3 propositions, « partie » sans transport, commission) ; puis l'écran et la mise en production | Vous, puis Claude |
| 4 | Rejouer les tests des dernières corrections (suppression de compte, membre suspendu) et lire les commissions du vrai serveur (avec votre accord, en lecture seule) | Claude |
| 5 | Faire les corrections choisies, une PR par lot, avec captures | Claude |
| 6 | Petits restes connus : relance envoyée après un accord « sans suite » ; étape « Commande terminée » cochée trop tôt ; carte limitée à 500 annonces | Claude |
| 7 | Recréer la tâche des gardiens avec le connecteur Supabase | Vous |
| 8 | Lancer l'essai fermé, puis noter chaque semaine ce qui se passe | Vous, aidé par Claude |
| 9 | Refaire l'audit de sécurité avant l'ouverture au public | Claude |
| 10 | Relire les conditions d'utilisation et la confidentialité ; déclaration ARTCI ; remplir les mentions légales | Un juriste, puis vous |
| 11 | Ajouter la case « J'accepte » à l'inscription (après le juriste) | Claude |
| 12 | Regarder le site caché et donner vos retours ; décider le jour de son ouverture | Vous |
| 13 | Essayer les notifications sur votre vrai téléphone | Vous |
| 14 | Preuve du numéro par SMS ou WhatsApp | Besoin d'un budget |
| 15 | Partenaire de paiement (Mobile Money agréé) | Besoin d'un budget |
| 16 | Juriste payé, si aucune aide gratuite n'est trouvée ; nom de domaine (facultatif) | Besoin d'un budget |

---

## 5. Les contrôles (les « gardiens »)

Les gardiens vérifient l'application tout seuls, comme un contrôle d'usine.

**Ce qui tourne tout seul, et quand**
- À chaque PR : une coche verte ou rouge sur GitHub.
- Chaque jour à 5 h 29 : un contrôle des écrans et des textes. Le résultat est dans la fiche GitHub « Contrôle quotidien » (vous êtes prévenu seulement si quelque chose change).
- Tous les 3 jours à 6 h 17 : la fiche GitHub « Rapport des gardiens ».
- Tous les 3 jours à 6 h 43 : Claude lance le contrôle général et propose une PR « Rapport du contrôle qualité ». Tant que la tâche n'est pas recréée avec le connecteur Supabase, les tests du serveur sont marqués « bloqué ».

**Où arrivent les rapports**
- Le dernier rapport : `CONTROLE_QUALITE/DERNIER_RAPPORT.md`. Lire « En bref », puis les défauts graves, puis « Corrections proposées ».
- Tous les défauts et leur suivi : `CONTROLE_QUALITE/REGISTRE_ANOMALIES.md`.

**Pour lancer un contrôle complet vous-même**, écrivez dans une discussion :
> Lance le contrôle général MGCI

**Le dernier bilan (contrôle général du 25/10/2026)**
- 238 tests : 148 réussis, 69 échoués, 1 bloqué, 4 non lancés, 16 en attente (paiement, SMS, vrai téléphone…).
- 57 défauts notés : **0 très grave**, 4 graves, 28 gênants, 25 cosmétiques.
- 2 sont réglés et vérifiés ; 4 sont corrigés mais pas encore revérifiés ; 51 restent ouverts.

**Les 4 défauts graves encore ouverts**
1. Supprimer son compte en pleine commande : **corrigé** et en service depuis le 25/10/2026 ; le test reste à rejouer.
2. 51 commissions marquées « due » sans argent passé, sur le serveur d'essai : le vrai serveur n'a pas été lu. À corriger.
3. L'équipe peut lire tous les messages : vous avez décidé le 25/10/2026 que c'est voulu. Ce défaut sera noté « risque accepté » au prochain contrôle.
4. Comptes créés sans preuve du numéro : attend un budget (SMS ou WhatsApp).

---

## 6. Le jour où vous aurez un partenaire de paiement

Aujourd'hui, **aucun argent ne passe par l'application**. Rien n'est encaissé.

**Ouvrez une discussion et écrivez :**
> J'ai mon partenaire de paiement : <nom>

**Ce qu'il faut avoir sous la main :**
- le nom du partenaire (par exemple un service de Mobile Money agréé) et sa documentation technique ;
- ses **clés de TEST**. Vous les mettez vous-même dans les réglages du serveur Supabase. **Jamais dans l'application, jamais dans la discussion** ;
- vos règles d'argent :
  - qui paie quand (à la commande, à la confirmation, à la réception) ;
  - ce que devient l'argent en cas de litige ;
  - l'argent gardé de côté jusqu'à la clôture de la commande (le « séquestre ») ;
  - la commission devient « due » seulement quand l'argent est passé par ce séquestre ;
  - les commissions calculées d'avant ne sont jamais réclamées.

**Ce que Claude fera, dans l'ordre :**
1. Refaire l'audit de sécurité.
2. Écrire vos règles d'argent dans les règles du projet.
3. Brancher le partenaire sur le serveur d'essai seulement, avec les clés de test.
4. Tout tester : paiement, séquestre, clôture, litige, partage, annulation. Sans jamais prendre de vrai argent.
5. Changer les textes, avec captures pour votre accord. Jamais « payé » avant la vraie confirmation du partenaire.
6. Le vrai serveur seulement après votre « OK production », puis un nouvel audit.

Attention : un défaut noté aujourd'hui « gênant » (un 2e paiement ignoré sans trace) deviendra **très grave** ce jour-là. Il sera corrigé avant de brancher l'argent.

---

## 7. Pour aller plus loin

| Document | À lire si… |
|---|---|
| [Rapport des corrections de l'audit](docs/RAPPORT-CORRECTIONS-AUDIT-2026-10.md) | vous voulez le détail de tout ce qui a été corrigé depuis l'audit, et ce qui reste |
| [Audit de logique et de viabilité (24/10/2026)](docs/audits/audit-logique-viabilite-2026-10-24.md) | vous voulez savoir pourquoi l'audit donnait 49 sur 100 |
| [Dernier rapport du contrôle qualité](CONTROLE_QUALITE/DERNIER_RAPPORT.md) | vous voulez choisir les corrections à faire |
| [Registre des défauts](CONTROLE_QUALITE/REGISTRE_ANOMALIES.md) | vous cherchez un défaut précis et son état |
| [Centre de contrôle qualité](CONTROLE_QUALITE/README.md) | vous voulez comprendre comment marchent les gardiens |
| [Décisions juridiques](docs/juridique/DECISIONS-A-PRENDRE.md) | vous voulez relire ce que vous avez décidé, et ce qu'il reste à construire pour chaque décision |
| [Textes juridiques (projets)](docs/juridique/LISEZMOI.md) | vous préparez la rencontre avec un juriste |
| [Lancer l'essai fermé en une heure](docs/essai-ferme/LANCER-EN-1-HEURE.md) | vous préparez l'essai |
| [Plan de l'essai fermé](docs/essai-ferme/PLAN.md) | vous voulez les règles complètes de l'essai |
| [À faire par le propriétaire](docs/A-FAIRE-PROPRIETAIRE.md) | vous voulez la liste à cocher, avec les modes d'emploi |
| [Fonctionnalités](FONCTIONNALITES.md) | vous voulez la liste complète de ce que fait l'application |
| [Historique des changements](CHANGELOG.md) | vous cherchez ce qui a changé un jour précis |

---

## 8. Historique

- **03/10/2026** : premier dépôt du code.
- **11 et 12/10/2026** : l'application branchée sur le serveur : comptes, annonces partagées, négociation, messages, marche sans connexion.
- **17 au 19/10/2026** : carte, vérification d'identité, confiance, notifications, le sac devient le personnage de l'application.
- **21 et 22/10/2026** : commandes, transporteurs, suivi, réputation, achats groupés ; mot secret, refus avec photos, litiges (sans aucun paiement réel).
- **23/10/2026** : nouveau site public construit et caché ; PDF de stratégie mis à jour tout seuls.
- **24/10/2026** : les 4 chantiers (transport, fiabilité, badges, boutiques), « ville seulement », notifications automatiques, preuves au départ. L'audit donne 49 sur 100 : bon pour un essai fermé, pas pour le public.
- **Nuit du 24 au 25/10/2026** : toutes les corrections de l'audit sont faites et testées.
- **25/10/2026** : corrections mises sur le vrai serveur ; litige en 1 h et quantité minimale ; contrôle qualité permanent (premier bilan) ; décisions juridiques toutes prises (« ok pour tout ») ; kit de l'essai fermé ; ce tableau de bord.
