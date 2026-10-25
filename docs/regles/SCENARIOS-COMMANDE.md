# Scénarios de commande : toutes les combinaisons

> Écrit le 25/10/2026, à la demande du propriétaire : « Si tu ne comprends pas, mets-le dans un scénario et traite toutes les combinaisons possibles. Pense logique, mets-toi à la place de chacun. »
> Règle : toute règle de commande nouvelle ou changée met à jour ce fichier dans la même PR (voir `CLAUDE.md`).
> Sources lues : `CLAUDE.md`, `docs/audits/decisions-chantiers-2026-10-24.md` (44 décisions), `docs/juridique/DECISIONS-A-PRENDRE.md` (32 questions), `FONCTIONNALITES.md`, schémas SQL 26 à 98b de `main` (en production jusqu'à 98b d'après `docs/PASSATION.md`) et la branche `claude/corrections-99` (schémas 99a à 99d, projet de test seulement, en cours de modification).
> Pour chaque fonction, c'est **la dernière définition** qui compte (ex. `commandes_delais` : 92b, puis 97b, puis 97d, puis 99a sur la branche).
> Ce document ne change ni le code ni les règles. Les « Propositions » de la partie 4 attendent la réponse du propriétaire.

**Légende du code réel**
- ✅ conforme : le serveur fait ce que dit la règle.
- ⚠️ écart : le serveur fait autre chose, ou à moitié.
- ❌ manquant : rien dans le serveur.
- 🕓 en cours : écrit sur la branche `claude/corrections-99`, pas encore fusionné.

**Les règles du 25/10/2026 intégrées ici**
- **Pendant le trajet, rien d'automatique.** Tant que le vendeur n'a pas déclaré « arrivé », il n'y a ni litige automatique ni rappel automatique, même si la marchandise met très longtemps. Le vendeur peut signaler un retard (motif et nouvelle date). L'acheteur peut « demander des nouvelles », au plus une fois toutes les 6 h.
- **Risque et participation (25/10/2026, validé « Ok »).** Le risque de la marchandise reste au vendeur jusqu'à la réception conforme ; « transport à la charge de l'acheteur » veut seulement dire que le transport n'est pas compris dans le prix. Cassé, gâté, manquant ou non conforme : l'acheteur ne paie rien, ni marchandise ni transport. Quand il signale un problème : « Voulez-vous quand même participer ? » (jamais « Oui » par défaut). Non : litige normal. Oui : transport seulement, partie gardée au prix normal, ou montant tapé ; le vendeur accepte (commande terminée avec ce montant) ou refuse (l'équipe tranche). Aucun argent ne bouge. Combinaisons : partie K.
- **Après « arrivé », l'acheteur a 1 h** pour : (a) confirmer avec le mot secret ; (b) signaler un problème (litige) ; (c) demander un délai justifié (motif ; 2 h, 6 h ou 24 h ; une seule fois). S'il ne fait rien, un litige s'ouvre tout seul. 1 h plus tard, la commande est close en faveur du vendeur : commission « calculée » (aucun argent réel), litige perdu pour l'acheteur muet. S'il répond pendant le litige, l'équipe tranche.

---

## 1. La vie d'une commande, en une page

| Étape | Qui agit | Ce qui se passe | Délai |
|---|---|---|---|
| **0. Négociation** | acheteur et vendeur (transporteur Marché de Gros : service fermé) | Prix, quantité et transport dans la même proposition : inclus, à part (prix ajouté), ou à la charge de l'acheteur. | Proposition valable 48 h. |
| **1. Accord conclu** | — | La quantité est retirée de l'annonce. | 72 h pour créer la commande, sinon « sans suite » et la quantité revient. |
| **2. Commande à confirmer** | celui qui ne l'a pas créée | Il confirme ou refuse (motif obligatoire). Le mot secret est tiré à la confirmation. | 48 h, sinon elle expire, sans faute pour personne. |
| **3. Confirmée, avant chargement** | vendeur | 2 à 4 photos du colis, poids, photo du papier du mot secret avec le code au hasard (3 min). Sans elles, pas de chargement. | 72 h pour charger (rappel 12 h avant). Ensuite l'acheteur peut annuler seul ; ça compte contre le vendeur. |
| **4. Chargée, en route** | vendeur ou son livreur | Plus d'annulation : seulement « Signaler un problème ». **Rien d'automatique**, même si c'est très long. Retard signalé par le vendeur, nouvelles demandées par l'acheteur. | Aucun délai automatique. |
| **5. « Arrivé »** | le vendeur (ou le chauffeur) le déclare, une fois | L'acheteur reçoit l'avis : il a 1 h pour confirmer (mot secret), signaler un problème, ou demander un délai (2 h, 6 h ou 24 h, une fois). Rappel à 30 min. | 1 h. |
| **6. Réception confirmée** | acheteur | Commande « terminée ». Il a encore 1 h pour réclamer (refus avec photos et mot secret, ou problème). | 1 h, puis clôture automatique. |
| **7. Litige** | l'équipe | Ouvert par une partie, ou tout seul si l'acheteur se tait 1 h après « arrivé ». Litige automatique sans réponse 1 h de plus : clos en faveur du vendeur. Sinon l'équipe tranche : vendeur, acheteur ou partage. | L'équipe a 72 h (ensuite « en retard »). |
| **8. Clôture** | système ou équipe | Commission 3,5 % « calculée », jamais réclamée, jamais encaissée. Fiabilité mise à jour. Avis possible une fois. | — |

Ce qui change selon le transport :
- **Même ville** (même ville choisie dans la liste ; Abidjan est une seule ville) : le vendeur organise son livreur, payé par l'acheteur directement, hors Marché de Gros. Retrait par l'acheteur seulement si le vendeur l'accepte.
- **Villes différentes** : transport inclus, à part (prix négocié dans la proposition) ou à la charge de l'acheteur.
- **Transporteur Marché de Gros** : **service fermé** tant qu'il n'y a pas 3 transporteurs vérifiés et l'accord du propriétaire. Quand il ouvrira : codes à la place du mot secret, 6,9 % retenus sur le prix du transporteur.

---

## 2. Le tableau des combinaisons

Colonnes : **N°** · **Situation** (qui fait quoi) · **Ce qui doit se passer** · **Qui est prévenu** · **Délai** · **Effet** (stock / commission / fiabilité) · **Code réel**.
« Équipe » = l'administration du Marché de Gros. « Système » = la tâche automatique `commandes_delais`, toutes les 5 min.

### A. Négociation (avant l'accord)

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| A-01 | Acheteur ou vendeur change le prix ou la quantité (contre-proposition) | L'accord porte sur la dernière proposition ; accepter une ancienne est refusé. | l'autre partie | 48 h par proposition | aucun | ✅ `nego_agir` (93b) : « La proposition a changé entre-temps » |
| A-02 | Vendeur modifie son annonce pendant une négociation | Produit, unité, région, ville et « ville seulement » figés ; quantité plus haute renvoyée sans l'avoir vue : gardée et signalée. | l'auteur de l'annonce | — | aucun | ✅ 93a, 97d (`quantite_gardee`) |
| A-03 | Prix de 0 F, quantité à virgule pour des sacs, montant énorme | Refusé avec un message clair. | celui qui saisit | — | aucun | 🕓 99d (prix ≥ 1 F, quantité entière, 1 milliard au plus) |
| A-04 | Transport choisi dans la proposition : inclus, à part (prix), à la charge de l'acheteur | Le prix du transport à part est dans la même proposition et se négocie. | l'autre partie | 48 h | commission 3,5 % sur la marchandise seulement | ✅ 49, 83a, 95 |
| A-05 | Négociation à trois avec le transporteur Marché de Gros | Service fermé : impossible. | — | — | 6,9 % jamais créés | ✅ 62, 82, 95 (service fermé, ouverture refusée sous 3 transporteurs vérifiés) |
| A-06 | L'un des deux est suspendu | Plus de proposition de prix ni d'accord ; écrire, refuser, arrêter restent possibles. | celui qui essaie | durée de la suspension | aucun | ✅ 98b (en production) |
| A-07 | L'autre a arrêté la négociation | 24 h avant de pouvoir reproposer (sauf celui qui a arrêté). | — | 24 h | aucun | ✅ 93b |
| A-08 | Acheteur hors de la ville d'une annonce « ville seulement » | Refusé par le serveur. | l'acheteur | — | aucun | ✅ 87, 87b, 87c, 93b (`commande_creer2`) |

### B. Accord conclu, pas encore de commande

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| B-01 | Personne ne crée la commande | Accord « sans suite » ; la quantité revient sur l'annonce (l'annonce épuisée revient en ligne). | les deux (relance « accord sans commande ») | 72 h | stock rendu ; fiabilité : rien | ✅ `accords_sans_suite` (92a), relance 91 |
| B-02 | Commande créée après les 72 h | Refusée : faire une nouvelle proposition. | celui qui crée | — | aucun | ✅ `_cmd_accord_vivant` (92a) |
| B-03 | Les deux créent la commande en même temps (double appui, coupure) | Une seule commande. | — | — | aucun | ✅ `commande_creer` : « Une commande existe déjà » (CMD-04) |
| B-04 | L'un des deux est suspendu après l'accord | La commande est refusée ; l'accord attend 72 h avant de rendre la quantité. | celui qui crée | 72 h | stock bloqué 72 h | ⚠️ `_fiab_garde_commande` (84b) refuse, mais la quantité reste bloquée 72 h : voir proposition P10 |
| B-05 | L'un des deux est banni après l'accord | Pas de commande avec un banni. | — | — | — | ⚠️ seul le créateur banni est refusé ; une commande vers un vendeur banni se crée, puis expire en 48 h (il ne peut pas répondre) : P7 |
| B-06 | L'un des deux veut supprimer son compte | Refusé tant que l'accord a moins de 72 h. | lui | 72 h | — | ✅ 98a (en production) |

### C. Commande à confirmer

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| C-01 | L'autre partie confirme | Commande « en cours », mot secret tiré, date de confirmation notée. | le créateur | — | commission « prévue » | ✅ `commande_repondre` (92b), `_mot_tirer` (58), `_cmd_dates` (92b) |
| C-02 | L'autre partie refuse | Motif obligatoire ; ne compte contre personne. | le créateur | — | stock rendu ; fiabilité : rien (décision 13) | ✅ 92b, 92a, 84a (catégorie « légitime ») |
| C-03 | Le créateur retire sa commande | Motif obligatoire ; ne compte pas. | l'autre | — | stock rendu | ✅ `commande_annuler` (92b) |
| C-04 | Personne ne répond | Expire ; ne compte contre personne. | les deux | 48 h | stock rendu | ✅ `commandes_expirer` (84a) |
| C-05 | Même ville, livreur du vendeur | Règle « livreur du vendeur », payé par l'acheteur hors Marché de Gros. | — | — | rien sur le transport | ✅ `commande_creer2` (`transport_regle = livreur_vendeur`) |
| C-06 | Même ville, l'acheteur veut retirer lui-même | Seulement si le vendeur l'accepte. | le vendeur | 48 h | — | ✅ règle « retrait » ; l'accord du vendeur = sa confirmation (ou il crée lui-même la commande) |
| C-07 | Villes différentes, transport inclus | Le vendeur transporte, obligatoirement. | — | — | commission sur la marchandise | ✅ `commande_creer` refuse un autre mode |
| C-08 | Villes différentes, transport à part | Le vendeur livre ; le prix du transport s'ajoute au total, sans commission. | — | — | total = marchandise + transport | ✅ 93b, 95 (`a_part`, `total_convenu`) |
| C-09 | Transport à la charge de l'acheteur | L'acheteur organise et paie le transport (pas compris dans le prix). **Règle du 25/10/2026 : le risque reste au vendeur jusqu'à la réception conforme** (remplace « la casse est à la charge de l'acheteur dès le chargement », n° 10). | — | — | — | ✅ règle « acheteur » ; la casse se règle par le litige et la participation (partie K) |
| C-10 | Transport Marché de Gros choisi | Refusé : service fermé. | celui qui choisit | — | — | ✅ `_cmd_reseau_pause` (62) |
| C-11 | Confirmer et annuler en même temps | Une seule action passe. | — | — | — | ✅ verrou `for update` (CMD-10, joué dans une seule transaction) |

### D. Confirmée, avant le chargement

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| D-01 | Vendeur charge sans photos, sans poids ou sans photo du papier | Chargement refusé. | le vendeur | — | — | ✅ `_cmd_chargement_preuves` (90b) |
| D-02 | Photo du papier envoyée plus de 3 min après le code | Refusée : nouveau code. | le vendeur | 3 min | — | ✅ `commande_depart_mot` (90b) |
| D-03 | Photos d'une autre commande réutilisées | Refusées. | le vendeur | — | — | ✅ 94g (TRA-13) |
| D-04 | Vendeur ne charge pas | Rappel au vendeur 12 h avant ; à 72 h l'acheteur peut annuler seul. | vendeur (rappel), les deux (retard) | 72 h | stock rendu ; annulation « abusive » contre le vendeur | ✅ 92b, 97b (`commande_annuler_retard`) |
| D-05 | Acheteur veut annuler avant les 72 h | Impossible seul ; « Signaler un problème » possible. | — | — | — | ✅ « TROP_TOT » ; ❌ l'acheteur ne peut même pas **demander** une annulation d'un commun accord : P9 |
| D-06 | Vendeur demande l'annulation (motif), l'acheteur accepte | Annulée. D'accord avec le motif : légitime ; pas d'accord : abusive pour le vendeur (panne, météo, stock épuisé : l'équipe examine). | l'acheteur, puis le vendeur | — | stock rendu ; fiabilité selon l'accord | ✅ `commande_annuler_motif` (84a, 99a), `_fiab_annulation` (94f) |
| D-07 | Vendeur demande, l'acheteur refuse | Le vendeur peut redemander une fois ; après 2 refus, l'équipe tranche. | les deux | — | — | ✅ 92b (`ANNULATION_LIMITE`) |
| D-08 | Vendeur demande, l'acheteur ne répond jamais | ? | — | — | à 72 h l'acheteur peut annuler, et ça compte **contre le vendeur** | ⚠️ trou : P8 |
| D-09 | Vendeur demande l'annulation puis charge quand même | La demande est retirée (charger, c'est livrer). | les deux (journal) | — | — | ⚠️ sur `main`, la demande reste ouverte et l'acheteur ne peut plus répondre (CMD-09 échoué) ; 🕓 99a la retire |
| D-10 | Vendeur banni avant le chargement | L'acheteur annule tout de suite ; compte contre le vendeur. | l'acheteur | — | stock rendu | ⚠️ sur `main` l'acheteur attend 72 h ; 🕓 99a (annulation immédiate) |
| D-11 | Acheteur banni avant le chargement | ? | — | — | — | ❌ rien de prévu : il ne peut plus agir ; le vendeur charge ou attend : P6 |
| D-12 | Vendeur ou acheteur suspendu | Il finit ses commandes en cours. | — | — | — | ✅ (décision 16) : les fonctions de commande ne lisent pas la suspension |
| D-13 | Une partie signale un problème | Litige, traité par l'équipe. | l'autre partie, l'équipe | l'équipe a 72 h | commission « suspendue » | ✅ `commande_litige` (92b) dès la confirmation |
| D-14 | L'équipe sort une commande bloquée | Annulée (avec ou sans faute) ou livrée, avec une note. | les deux | — | fiabilité si faute | ✅ `admin_commande_issue` (92c) |
| D-15 | Supprimer son compte | Refusé. | lui | — | — | ✅ 98a |

### E. Chargée, en route (règle du 25/10 : rien d'automatique)

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| E-01 | Le vendeur confirme le chargement | Étape « chargement » ; l'acheteur voit les photos et le poids. | l'acheteur | — | stock : plus jamais rendu | ✅ `commande_avancer` (92b), photos (90) |
| E-02 | Une partie veut annuler après le chargement | Impossible : seulement « Signaler un problème ». | — | — | — | ✅ 92b |
| E-03 | Le trajet dure très longtemps, le vendeur ne déclare rien | **Rien d'automatique** : ni rappel, ni litige. | personne | aucun | aucun | ✅ sur `main` (97d : rien pour le trajet) ; ⚠️ **🕓 99a ajoute un rappel à 48 h et un litige à 96 h pendant le trajet : contraire à la règle du 25/10**, à retirer de la branche (P1) |
| E-04 | Le vendeur signale un retard (motif + nouvelle date) | Noté dans le journal, l'acheteur voit la nouvelle date. | l'acheteur | — | aucun | ❌ manquant (aucune fonction) |
| E-05 | L'acheteur demande des nouvelles | Un avis part au vendeur ; au plus une fois toutes les 6 h. | le vendeur | 6 h entre deux | aucun | ❌ manquant (seuls les messages privés existent) |
| E-06 | Le vendeur ne répond pas aux demandes de nouvelles | Rien d'automatique ; l'acheteur peut signaler un problème. | — | — | — | ✅ `commande_litige` possible pendant le trajet ; ❌ la demande de nouvelles n'existe pas (P14) |
| E-07 | Transbordement, changement de chauffeur | Lieu noté ; le prix convenu ne change pas (n° 8). | l'acheteur | — | — | ✅ étape « transbordement » (92b) |
| E-08 | Marchandise cassée en route | Vendeur responsable jusqu'à la réception conforme, quel que soit le transport (règle du 25/10/2026) ; l'acheteur ne paie rien, ou participe s'il le veut (partie K) ; sinon l'équipe juge avec les photos de départ. | l'équipe | — | — | ✅ 102a (participation) ; ⚠️ l'aide et l'écran restent à faire |
| E-09 | Vendeur banni pendant le trajet | ? | — | — | — | ⚠️ trou : il ne peut plus déclarer « arrivé » (refus `COMPTE_BANNI`) ; avec la règle du 25/10 la commande reste sans fin, sauf si l'acheteur confirme ou signale lui-même (P5) |
| E-10 | Acheteur banni pendant le trajet | ? | — | — | — | ❌ trou : voir F-17 et P6 |
| E-11 | Vendeur ou acheteur suspendu pendant le trajet | La commande continue. | — | — | — | ✅ |
| E-12 | Transport à la charge de l'acheteur ou retrait : qui dit « arrivé » ? | ? | — | — | — | ⚠️ le serveur laisse le vendeur déclarer « livré » dès le chargement ; rien ne dit que la remise au chauffeur de l'acheteur vaut « arrivé » (P11) |
| E-13 | Transporteur Marché de Gros | Codes de prise en charge et de réception tapés par le chauffeur. | — | — | 6,9 % | ✅ (service fermé, rien en production) |

### F. « Arrivé » déclaré : la fenêtre d'1 h

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| F-01 | Le vendeur (ou le chauffeur) déclare « arrivé » | Une seule fois ; l'heure de l'acheteur commence. | l'acheteur (« Confirmez la réception ou signalez un problème dans l'heure ») ; rappel à 30 min | 1 h | — | ✅ 97b (`livre_le`, rappel à mi-délai), `pousser` v25 |
| F-02 | Le vendeur déclare « arrivé » une 2e fois | Refusé. | — | — | — | ✅ « La livraison est déjà déclarée » |
| F-03 | L'acheteur déclare lui-même « arrivé » | ? | le vendeur (« La marchandise est arrivée ») | ? | — | ⚠️ sur `main` aucun délai ne démarre (`livre_le` vide) : la commande peut rester ouverte toujours ; 🕓 99a : rappel à 1 h, litige pour l'équipe à 24 h ; le vendeur peut encore déclarer « livré » pour lancer l'heure (P2) |
| F-04 | « Arrivé » déclaré la nuit (après 21 h) | ? | — | — | — | ❌ les délais courent la nuit, les week-ends et les jours fériés (LOG-13 échoué, ANO-035) : P3 |
| F-05 | L'acheteur confirme avec le bon mot secret | Commande terminée ; encore 1 h pour réclamer ; puis clôture. | le vendeur | 1 h | commission « calculée » à la clôture | ✅ `commande_reception_mot` (97b), `sequestre_liberer_echus` (89), 95b |
| F-06 | Mot secret faux | « Mot incorrect », essais restants affichés. | — | — | — | ✅ 92b, 97b |
| F-07 | 5 essais faux : mot bloqué | Alerte aux deux et à l'équipe (« À traiter »). | les deux, l'équipe | — | — | ✅ `_cmd_alerte` ; 🕓 99a : litige pour l'équipe 24 h après si rien n'est fait |
| F-08 | Mot bloqué pendant l'heure, puis litige automatique | ? | — | — | — | ⚠️ trou : les essais ne comptent pas comme une réaction (`_cmd_acheteur_a_reagi`) ; un acheteur présent qui s'est trompé 5 fois peut perdre automatiquement (P4) |
| F-09 | Mot oublié, papier perdu | Confirmer « sans le mot secret » (noté comme déclaration) ; un refus sans mot n'est pas accepté : « Signaler un problème ». | le vendeur | — | — | ✅ `p_sans_mot` (97b), `commande_refuser2` (92b) |
| F-10 | L'acheteur demande un délai justifié (motif ; 2 h, 6 h ou 24 h) | Le litige automatique attend la fin du délai. | le vendeur | 2 h, 6 h ou 24 h | — | ❌ manquant |
| F-11 | L'acheteur redemande un délai | Refusé : une seule fois. | l'acheteur | — | — | ❌ manquant |
| F-12 | Acheteur absent, téléphone éteint, sans réseau | Sans rien dans l'heure : litige automatique. | l'acheteur | 1 h | — | ✅ 97b ; il peut contester le litige perdu pendant 7 jours (84b) |
| F-13 | L'acheteur signale un problème : cassé, manquant, mauvaise qualité, pas la bonne quantité | Litige ouvert par lui ; l'équipe tranche. | le vendeur, l'équipe | l'équipe a 72 h | commission « suspendue » | ✅ `commande_litige` ; ⚠️ motif en texte libre, pas de catégories ni de photos obligatoires (P16) |
| F-14 | L'acheteur refuse la marchandise (tout ou partie) | 1 à 4 photos et le mot secret ; litige ; l'équipe compare avec les photos de départ ; le chauffeur constate, le vendeur répond. | le vendeur, le chauffeur, l'équipe | — | commission « suspendue » | ✅ `commande_refuser2` (92b, 97b), `commande_refus_vendeur`, `commande_refus_chauffeur` (57, 58) |
| F-15 | Qui paie le transport quand la marchandise est refusée | Marchandise non conforme : l'acheteur ne paie ni la marchandise ni le transport (règle du 25/10/2026) ; il peut proposer de payer le transport seulement (K-03). Refus rejeté par l'équipe : l'acheteur paie (n° 11). | — | — | hors application | ✅ 102a (« transport ») ; ⚠️ l'aide dit encore « le transport reste dû » |
| F-16 | Le vendeur déclare « arrivé » alors que rien n'est arrivé | L'acheteur signale un problème ; l'équipe tranche. | l'équipe | 1 h pour réagir | — | ✅ possible ; ⚠️ aucune conséquence prévue pour une fausse déclaration (P12) |
| F-17 | Acheteur banni avant d'avoir confirmé | ? | — | — | — | ⚠️ trou : il ne peut ni confirmer, ni signaler, ni écrire dans le litige ; le litige automatique le fait perdre et lui compte un « litige perdu » (P6) |
| F-18 | « Arrivé » et confirmation au même instant | Une seule action passe, l'autre reçoit un message. | — | — | — | ✅ verrou `for update` |
| F-19 | Coupure réseau : l'acheteur renvoie sa confirmation | La 2e réponse dit « déjà confirmée ». | — | — | — | ⚠️ la 2e reçoit l'erreur « Cette commande n'est pas en cours » : l'état est juste, le message inquiète (P18) |

### G. Litige automatique (l'acheteur s'est tu 1 h)

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| G-01 | Litige ouvert tout seul | « Sans réponse dans l'heure, close en faveur du vendeur. » | l'acheteur | 1 h | commission « suspendue » | ✅ `commandes_delais` (97b) |
| G-02 | L'acheteur écrit dans le litige ou refuse avec photos | Plus de clôture automatique : l'équipe tranche. | le vendeur, l'équipe | l'équipe a 72 h | — | ✅ `_cmd_acheteur_a_reagi` (97b) |
| G-03 | L'acheteur confirme avec le mot pendant le litige | Commande terminée. | le vendeur | — | commission calculée à la clôture | ✅ 97b |
| G-04 | L'acheteur reste muet 1 h de plus | Close en faveur du vendeur ; « litige perdu » pour l'acheteur. | les deux | 1 h | commission « calculée » (aucun argent) ; fiabilité : litige perdu de l'acheteur | ✅ 97b, 97d (en production) ; ⚠️ **avis de clôture probablement jamais envoyé** : `push_commande` (schéma 65) ignore toute étape « terminee », donc le texte « En faveur du vendeur » de `pousser` n'est pas appelé (P17) |
| G-05 | L'acheteur écrit à la seconde où la tâche clôt | Son message doit compter. | — | — | — | ⚠️ `litige_ecrire` ne verrouille pas la commande (ANO-042, en partie corrigé) : rare, mais possible (P18) |
| G-06 | L'acheteur conteste son litige perdu | Possible 7 jours ; l'équipe répond en 7 jours. | l'équipe | 7 j | fiabilité corrigée si accepté | ✅ `contester_annulation` (84b) |
| G-07 | Le litige automatique tombe la nuit | ? | — | — | — | ❌ voir F-04 et P3 |

### H. Litige ouvert par une partie, et ses issues

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| H-01 | L'équipe donne raison au vendeur (livrée) | Commande close. | les deux | l'équipe a 72 h | commission « calculée » ; litige perdu pour l'acheteur si l'équipe le désigne | ✅ `admin_litige_clore` (84e) → `admin_litige_trancher2` (84a) |
| H-02 | L'équipe donne raison à l'acheteur (annulée) | Commande annulée ; la marchandise partie ne revient pas sur l'annonce. | les deux | 72 h | commission « annulée » ; litige perdu pour le vendeur si désigné | ✅ (stock rendu seulement si rien n'était chargé, 92a) |
| H-03 | Partage | Une quantité « n'est pas due ». | les deux | 72 h | commission sur la part due ; ne compte contre personne (n° 28) | ✅ `admin_litige_partager` (92c) |
| H-04 | Refus de marchandise tranché | Quantité refusée retenue (0 = refus rejeté). | les deux | 72 h | commission sur le reste | ✅ `admin_refus_trancher` (92c) |
| H-05 | L'équipe ne répond pas en 72 h | Marqué « en retard » pour l'équipe ; rien ne change pour les parties. | l'équipe | — | — | ✅ `litige_retard_le` (92b) |
| H-06 | Une partie veut annuler pendant le litige | Seule l'équipe décide. | — | — | — | ✅ `commande_annuler` refuse hors « en cours » |
| H-07 | L'administrateur est lui-même partie de la commande | Il ne doit pas juger son propre litige. | — | — | — | ⚠️ ADM-02 échoué (contrôle qualité du 25/10) |

### I. Clôture

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| I-01 | Rien dans l'heure après la réception | Clôture automatique. | — | 1 h | commission « calculée » | ✅ `sequestre_liberer_echus` (89), 95b |
| I-02 | Réclamation dans l'heure après la réception | Refus avec photos ou problème : litige. | le vendeur, l'équipe | 1 h | « suspendue » | ✅ 92b |
| I-03 | Anciennes commissions « due » sans argent passé | Requalifiées « calculées, d'avant la règle : non réclamées ». | — | — | aucun argent | 🕓 99b |
| I-04 | Avis sur la commande | Une fois par commande. | — | — | réputation | ✅ 77 |

### J. Situations transversales

| N° | Situation | Ce qui doit se passer | Code réel |
|---|---|---|---|
| J-01 | Achat groupé | Commandes créées déjà confirmées ; « ville seulement », suspension et stock respectés ; transport repris de l'offre (n° 14) ; une annulation compte une seule fois (n° 21). | ✅ 93d, `_fiab_n90` (une fois par groupe) ; ⚠️ transport toujours noté « livré par le vendeur » (`mode_transport = 'vendeur'`), décidé, pas construit |
| J-02 | Deux personnes agissent en même temps | Une seule action passe. | ✅ verrous `for update` dans les fonctions de commande ; la tâche saute les lignes verrouillées (`skip locked`) ; ⚠️ vraie simultanée à deux connexions jamais testée (CMD-13, attente) |
| J-03 | Compte supprimé avec une commande, un litige, un accord récent ou une suspension | Refusé. | ✅ 98a (en production) |
| J-04 | Nuit et jours fériés | ? | ❌ aucun calendrier : tous les délais courent 24 h sur 24 (LOG-13) ; les avis de commande partent la nuit (voulu : ce sont des avis de transaction) |
| J-05 | Texte renvoyé après une coupure | Écrit une seule fois. | 🕓 99d (même texte en 2 min) |
| J-06 | Commission | 3,5 % de la marchandise ; jamais sur le transport à part ; 6,9 % seulement avec le service Marché de Gros ; toujours « calculée », jamais encaissée. | ✅ 95, 95b |

### K. Problème à l'arrivée : « Voulez-vous quand même participer ? » (schémas 102a, 102b, projet de test)

Fonctions : `commande_participation_proposer(commande, mode, quantite_gardee, montant, motif)`, `commande_participation_repondre(commande, accepte, note)`, `commande_participation_retirer(commande)`, `commande_participation_lire(commande)`, tâche `participations_delais` (5 min). Table `commande_participations`. Aucun argent ne bouge : le montant est seulement noté.

| N° | Situation | Ce qui doit se passer | Prévenu | Délai | Effet | Code réel |
|---|---|---|---|---|---|---|
| K-01 | L'acheteur signale un problème et répond « Non » | Litige normal ; il ne paie rien ; l'équipe tranche. | le vendeur, l'équipe | l'équipe a 72 h | commission « suspendue » | ✅ `commande_litige` (rien de nouveau) |
| K-02 | « Oui » sans choix, ou « Oui » proposé par défaut | Interdit : il choisit lui-même une des trois formes. | — | — | — | ✅ mode obligatoire ; écran : jamais pré-coché |
| K-03 | « Transport seulement » | Montant = prix du transport à part de la commande. Sans prix à part : refusé, « proposez plutôt un montant ». | le vendeur | 24 h pour répondre | accepté : commission 0 (jamais sur le transport) | ✅ 102a |
| K-04 | « Garder la partie en bon état » | Quantité gardée (0 < q ≤ quantité commandée) × prix unitaire ; transport non compté. | le vendeur | 24 h | accepté : commission 3,5 % de la part gardée, « calculée » | ✅ 102a |
| K-05 | « Proposer un montant » | Nombre entier, 0 < montant ≤ total initial (marchandise + transport à part). | le vendeur | 24 h | accepté : commission 3,5 % du montant, plafonné à la valeur de la marchandise | ✅ 102a |
| K-06 | Proposition faite à l'arrivée, sans litige ouvert | Motif obligatoire ; le litige s'ouvre (auteur : l'acheteur) en même temps. | le vendeur | — | « suspendue » | ✅ 102a (appelle `commande_litige`) |
| K-07 | Proposition faite pendant un litige (ouvert par lui, par le vendeur, ou tout seul) | Possible, sans motif. | le vendeur | 24 h | — | ✅ 102a |
| K-08 | Proposition avant « arrivé » (en route, avant chargement) | Refusée (`PARTICIPATION_ETAT`). | l'acheteur | — | — | ✅ 102a |
| K-09 | Double appui, coupure réseau | Même proposition : réponse « deja_proposee », rien en double. Autre proposition pendant qu'une attend : refusée (`PARTICIPATION_OUVERTE`). | — | — | — | ✅ index unique + verrou `for update` |
| K-10 | Le vendeur accepte | Commande terminée avec ce montant (nouveau total convenu ; total initial gardé) ; journal « Participation de l'acheteur acceptée… Aucun argent n'a été versé par l'application. » | l'acheteur | — | commission « calculée » ; **aucun litige perdu** ; stock : rien rendu | ✅ 102a |
| K-11 | Le vendeur refuse | Le litige continue ; l'équipe tranche. L'acheteur peut refaire une proposition. | l'acheteur | l'équipe a 72 h | — | ✅ 102a |
| K-12 | Le vendeur ne répond pas | La proposition expire ; le litige reste à l'équipe. | les deux | 24 h (réglable) | — | ✅ 102b ; **proposition P20** |
| K-13 | L'acheteur retire sa proposition avant la réponse | Retirée ; le litige continue. Retirer deux fois : même réponse. Après la réponse : refusé. | le vendeur | — | — | ✅ 102a |
| K-14 | Litige automatique (acheteur muet 1 h), puis proposition | La proposition compte comme une réaction : plus de clôture en faveur du vendeur. | le vendeur | — | pas de litige perdu automatique | ✅ 102b (`_cmd_acheteur_a_reagi`) |
| K-15 | Propositions répétées | 3 au plus par commande (réglable de 1 à 10) ; ensuite l'équipe tranche. | l'acheteur | — | — | ✅ 102a ; **proposition P21** |
| K-16 | L'équipe tranche, ou l'acheteur confirme avec le mot, pendant une proposition ouverte | La proposition devient caduque ; le vendeur ne peut plus y répondre. | — | — | selon la décision de l'équipe | ✅ 102a (déclencheur `commandes_participation_caduque`) |
| K-17 | Le vendeur ou l'acheteur se trompe de rôle | Seul l'acheteur propose et retire ; seul le vendeur répond (« Commande introuvable » sinon). Compte banni : refusé. | — | — | — | ✅ 102a |
| K-18 | Commande avec un dépôt d'argent (séquestre) | Pas de participation : l'équipe tranche. | — | — | aucun argent ne bouge | ✅ 102a (aucun paiement n'est branché) |
| K-19 | Partie non gardée (cassée, gâtée, restée chez l'acheteur) | Rien n'est rendu à l'annonce : la marchandise est partie. Si le vendeur la reprend en bon état, il remet lui-même la quantité. | — | — | stock inchangé | ✅ 92a (rien après le chargement) |

**Total : 115 combinaisons** (A 8, B 6, C 11, D 15, E 13, F 19, G 7, H 7, I 4, J 6, K 19). La partie C sépare les 4 modes de transport là où la règle change.

**Bilan du code réel** (compté par script sur la dernière colonne) : 59 cases entièrement conformes ✅ ; 37 cases avec au moins une réserve : 22 avec un écart ⚠️, 11 avec un manque ❌, 8 en cours 🕓 sur la branche `claude/corrections-99`, dont 1 contraire à la règle du 25/10 (E-03). Une case peut porter plusieurs marques.

---

## 3. Ce qui manque pour la règle du 25/10/2026 (à construire)

| Règle | Où ça en est |
|---|---|
| Rien d'automatique pendant le trajet | ✅ sur `main` ; ⚠️ 99a ajoute rappel 48 h et litige 96 h pendant le trajet : à retirer avant la fusion de la branche |
| Le vendeur signale un retard (motif + nouvelle date) | ❌ |
| L'acheteur demande des nouvelles (une fois toutes les 6 h) | ❌ |
| 1 h après « arrivé » : confirmer avec le mot | ✅ |
| 1 h après « arrivé » : signaler un problème | ✅ |
| 1 h après « arrivé » : délai justifié (2 h, 6 h, 24 h, une fois) | ❌ |
| Sans rien : litige automatique, puis 1 h plus tard clôture vendeur, commission calculée, litige perdu | ✅ (97b, 97d) ; ⚠️ l'avis de clôture ne semble pas partir (G-04) |
| Réponse pendant le litige : l'équipe tranche | ✅ |

---

## 4. Trous logiques trouvés

Chaque solution ci-dessous est une **proposition**, pas une décision. Rien n'est construit à partir d'elles tant que le propriétaire n'a pas répondu.

**P1. Une commande en route peut durer toujours (E-03).**
La règle du 25/10 dit « rien d'automatique pendant le trajet ». Mais une marchandise perdue ou un vendeur disparu laisse la commande ouverte sans fin, et la branche 99a ajoute un litige à 96 h qui contredit la règle.
Proposition : retirer de 99a le rappel à 48 h et le litige à 96 h pendant le trajet ; rien pour les parties ; l'équipe voit seulement, dans « À traiter », une commande en route depuis 7 jours sans « arrivé » (ou 3 jours après la nouvelle date annoncée), pour appeler. (L'acheteur et le vendeur ne subissent rien ; l'équipe ne laisse rien se perdre.) — à valider par le propriétaire.

**P2. L'acheteur dit lui-même « arrivé » (F-03).**
Aujourd'hui, aucun délai ne démarre ; 99a propose un litige pour l'équipe 24 h plus tard.
Proposition : « arrivé » dit par l'acheteur ouvre la même heure que s'il venait du vendeur, avec la même suite. (Une seule règle à retenir ; c'est lui qui dit avoir la marchandise.) — à valider par le propriétaire.

**P3. « Arrivé » déclaré la nuit (F-04, G-07).**
Un vendeur qui déclare « arrivé » à 23 h fait ouvrir un litige à minuit et clore la commande à 1 h, pendant que l'acheteur dort.
Proposition : un « arrivé » déclaré entre 21 h et 7 h fait partir l'heure à 7 h ; pas de règle spéciale pour les jours fériés (le délai justifié de 24 h les couvre). (Même heure calme que les notifications commerciales ; personne ne perd en dormant.) — à valider par le propriétaire.

**P4. Mot secret bloqué pendant l'heure (F-08).**
Un acheteur présent, qui s'est trompé 5 fois, n'est pas compté comme « ayant réagi » : il peut perdre automatiquement.
Proposition : un essai de mot secret compte comme une réaction ; un mot bloqué ouvre tout de suite un litige confié à l'équipe, sans clôture automatique. (Il était là et a essayé : ce n'est pas un acheteur muet.) — à valider par le propriétaire.

**P5. Vendeur banni pendant le trajet (E-09).**
Il ne peut plus déclarer « arrivé » ; avec la règle du 25/10, rien ne se passe jamais.
Proposition : au bannissement, ses commandes chargées passent en litige confié à l'équipe ; l'acheteur peut toujours confirmer avec le mot s'il a reçu. (L'acheteur n'attend pas un vendeur qui ne peut plus agir.) — à valider par le propriétaire.

**P6. Acheteur banni pendant une commande (D-11, E-10, F-17).**
Il ne peut plus confirmer, signaler ni écrire ; le litige automatique le fait perdre et lui compte un « litige perdu ».
Proposition : avant le chargement, le vendeur peut annuler tout de suite, l'annulation compte contre l'acheteur (le miroir de 99a) ; après le chargement, litige confié à l'équipe, sans clôture automatique ni « litige perdu » automatique. (Le vendeur n'attend pas ; l'équipe juge celui qui ne peut plus parler.) — à valider par le propriétaire.

**P7. Commande vers un membre banni (B-05).**
Une commande se crée vers un vendeur banni, puis expire en 48 h.
Proposition : refuser la commande avec un membre banni, comme avec un membre suspendu, et rendre la quantité de l'accord tout de suite. (Personne n'attend 48 h pour rien.) — à valider par le propriétaire.

**P8. Demande d'annulation du vendeur restée sans réponse (D-08).**
Le vendeur demande l'annulation avec un motif ; l'acheteur se tait ; à 72 h l'acheteur peut annuler seul, et ça compte contre le vendeur.
Proposition : sans réponse de l'acheteur en 24 h, l'annulation est acceptée, « légitime », personne en faute, quantité rendue. (Le vendeur a prévenu ; le silence de l'acheteur ne doit pas le punir.) — à valider par le propriétaire (touche la fiabilité).

**P9. L'acheteur ne peut pas demander une annulation d'un commun accord (D-05).**
Seul le vendeur peut demander ; l'acheteur doit attendre 72 h ou ouvrir un litige.
Proposition : l'acheteur peut demander l'annulation avant le chargement, avec un motif, comme le vendeur ; le vendeur accepte ou refuse ; s'il refuse, la commande continue. (Même droit des deux côtés ; moins de litiges inutiles.) — à valider par le propriétaire.

**P10. Accord conclu, puis suspension de l'un des deux (B-04).**
La commande est refusée, mais la quantité reste bloquée 72 h.
Proposition : à la suspension, les accords sans commande de ce membre passent « sans suite » tout de suite et la quantité revient. (L'autre partie peut revendre ou racheter aussitôt.) — à valider par le propriétaire.

**P11. Transport à la charge de l'acheteur ou retrait : qui dit « arrivé » ? (C-09, E-12)**
Le vendeur remet la marchandise au départ ; pourtant l'heure de vérification se compte à « arrivé ».
Proposition : dans ces deux cas, la remise au chauffeur de l'acheteur (ou à l'acheteur) vaut « arrivé » : le vendeur la déclare après le chargement, l'acheteur ou son chauffeur vérifie sur place et confirme avec le mot. — à valider par le propriétaire. ⚠️ Depuis la règle du 25/10/2026 (le risque reste au vendeur jusqu'à la réception conforme), l'ancienne raison « la casse est à la charge de l'acheteur dès le chargement » ne tient plus : à revoir avec le propriétaire.

**P12. Fausse déclaration « arrivé » (F-16).**
Rien n'est prévu contre un vendeur qui déclare « arrivé » trop tôt.
Proposition : quand l'équipe constate une fausse déclaration, elle tranche en faveur de l'acheteur et compte un « litige perdu » au vendeur. (Sinon déclarer trop tôt ne coûte rien.) — à valider par le propriétaire.

**P13. Retard annoncé puis dépassé (E-04).**
Proposition : le vendeur peut annoncer autant de retards qu'il faut, chacun avec motif et nouvelle date, tous visibles par l'acheteur ; quand la date est passée, l'application met en avant « Signaler un problème », sans rien déclencher. (On respecte « rien d'automatique » tout en aidant l'acheteur.) — à valider par le propriétaire.

**P14. Demandes de nouvelles sans réponse (E-06).**
Proposition : après 2 demandes restées sans réponse du vendeur, l'application propose « Signaler un problème » à l'acheteur ; rien d'automatique. (L'acheteur sait quoi faire, le vendeur n'est pas puni par une machine.) — à valider par le propriétaire.

**P15. Délai justifié (F-10, F-11).**
Proposition : le délai se demande seulement pendant l'heure qui suit « arrivé », pas pendant le litige automatique (y répondre suffit déjà à faire trancher l'équipe) ; à la fin du délai, même suite qu'après l'heure (litige automatique, puis 1 h). Le vendeur voit le motif et la nouvelle heure. (Une seule chance, une seule suite : simple à expliquer.) — à valider par le propriétaire.

**P16. Problème signalé en texte libre (F-13).**
Proposition : 5 choix (cassé, manquant, mauvaise qualité, pas la bonne quantité, autre) plus quelques mots, et une photo demandée pour « cassé » et « mauvaise qualité ». (L'équipe juge plus vite, avec les photos de départ en face.) — à valider par le propriétaire.

**P17. Avis de clôture en faveur du vendeur (G-04).**
D'après la lecture du code, l'avis « En faveur du vendeur » n'est jamais envoyé (`push_commande` ignore l'étape « terminee »).
Proposition : envoyer cet avis aux deux, après vérification sur le projet de test. (Celui qui perd doit le savoir pour pouvoir contester dans les 7 jours.) — à valider par le propriétaire.

**P18. Petites protections techniques (F-19, G-05).**
Proposition : une confirmation renvoyée après une coupure répond « déjà confirmée » au lieu d'une erreur ; un message écrit dans le litige verrouille la commande pour que la clôture automatique ne passe pas en même temps. (Aucune règle ne change ; on évite une peur ou une injustice rare.) — à valider par le propriétaire.

**P19. Le délai de chargement de 72 h est-il touché par la règle du 25/10 ?**
La règle dit « pendant le trajet ». Le délai de 72 h vient avant le chargement (règle n° 2 du 24/10).
Proposition : garder le délai de chargement de 72 h tel quel ; la règle « rien d'automatique » commence au chargement. (Avant le chargement, la marchandise n'est pas partie : l'acheteur doit pouvoir sortir d'une commande qui ne démarre pas.) — à valider par le propriétaire.

**P20. Le vendeur ne répond pas à une participation (K-12).**
Proposition appliquée sur le projet de test : 24 h pour répondre (réglage `participation_reponse_heures`), puis la proposition expire et le litige reste à l'équipe ; les deux sont prévenus. (Le vendeur a le temps de réfléchir ; l'acheteur n'attend pas sans fin.) — à valider par le propriétaire.

**P21. Combien de propositions de participation ? (K-15)**
Proposition appliquée sur le projet de test : 3 au plus par commande (réglage `participation_max`, de 1 à 10). (Assez pour négocier, pas assez pour harceler le vendeur.) — à valider par le propriétaire.

**P22. « Garder une partie » et le transport à part (K-04).**
Proposition appliquée : la partie gardée se paie au prix unitaire, sans le transport ; l'acheteur qui veut aussi payer le transport tape un montant. (Le calcul reste simple et suit la règle « non conforme : pas de transport ».) — à valider par le propriétaire.

**P23. Commission d'une participation (K-03 à K-05).**
Proposition appliquée : 3,5 % de la part marchandise du montant convenu (0 pour « transport seulement », jamais de commission sur le transport à part), statut « calculée ». — à valider par le propriétaire.

---

## 5. Les scénarios à faire vérifier par les gardiens

Ajoutés à `CONTROLE_QUALITE/MATRICE_TESTS.md` (partie 5), identifiants `SCN-01` à `SCN-43` (`SCN-38` à `SCN-43` : participation, partie K), avec le test existant ou « à écrire ».

---

## 6. Les propositions, en une liste

Le propriétaire peut répondre « ok pour tout » ou « ok sauf n° X ».

1. Pendant le trajet : retirer de 99a le rappel à 48 h et le litige à 96 h ; l'équipe seule voit les commandes en route depuis 7 jours.
2. « Arrivé » dit par l'acheteur : même heure et même suite que s'il venait du vendeur.
3. « Arrivé » entre 21 h et 7 h : l'heure part à 7 h.
4. Un essai de mot secret compte comme une réaction ; mot bloqué : litige pour l'équipe, sans clôture automatique.
5. Vendeur banni pendant le trajet : litige pour l'équipe.
6. Acheteur banni : avant chargement, le vendeur annule (contre l'acheteur) ; après, litige pour l'équipe, sans « litige perdu » automatique.
7. Pas de commande avec un membre banni ; la quantité revient tout de suite.
8. Demande d'annulation du vendeur sans réponse en 24 h : acceptée, personne en faute.
9. L'acheteur peut demander une annulation d'un commun accord avant le chargement.
10. Membre suspendu : ses accords sans commande passent « sans suite » tout de suite.
11. Transport à la charge de l'acheteur ou retrait : la remise au départ vaut « arrivé ».
12. Fausse déclaration « arrivé » constatée : litige perdu pour le vendeur.
13. Retards annoncés sans limite, tous visibles ; date passée : « Signaler un problème » mis en avant.
14. Après 2 demandes de nouvelles sans réponse : « Signaler un problème » proposé.
15. Délai justifié seulement dans l'heure après « arrivé » ; ensuite même suite.
16. Problème signalé : 5 choix et une photo pour « cassé » et « mauvaise qualité ».
17. Envoyer l'avis de clôture « en faveur du vendeur » aux deux.
18. Confirmation renvoyée : « déjà confirmée » ; message du litige protégé contre la clôture simultanée.
19. Garder le délai de chargement de 72 h ; « rien d'automatique » commence au chargement.
20. Participation sans réponse du vendeur en 24 h : elle expire, l'équipe tranche (appliqué sur le test).
21. 3 propositions de participation au plus par commande (appliqué sur le test).
22. « Garder une partie » : prix unitaire × quantité gardée, sans le transport (appliqué sur le test).
23. Commission d'une participation : 3,5 % de la part marchandise, « calculée » (appliqué sur le test).
