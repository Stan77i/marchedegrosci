# Notifications commerciales et de rétention : audit et proposition (24/10/2026)

Mission du propriétaire du 24/10/2026 : un moteur de notifications commerciales qui crée des visites, des échanges et des ventes, avec un objectif de **15 à 30 notifications commerciales par jour pour toute la plateforme**, selon l'activité réelle. Ce volume n'est jamais imposé à une personne.

Ce document fait suite à l'audit du matin (`docs/audits/audit-notifications-2026-10-24.md`, PR 282). Méthode : lecture du code (`supabase/schema-88a/88b`, `supabase/functions/pousser/index.ts`, `sw.js`, `v3/pousse.js`, `app/theme.js`, modules `v3/`) et de la base de **production en lecture seule**.

**Rien n'est encore changé dans le code.** Les parties 3 et 4 sont des propositions à valider.

---

## 0. Le chiffre qui change tout

Mesuré en production le 24/10/2026 :

| Donnée | Valeur |
|---|---|
| Comptes | 4 (3 profils) |
| Comptes avec notifications activées | **1** (2 téléphones) |
| Offres actives / créées en 14 jours | 4 / 4 |
| Demandes actives / créées en 14 jours | 1 / 3 |
| Négociations en 14 jours | 3 (10 messages) |
| Commandes au total | 2 |
| Boutiques | 1 |
| Achats groupés, besoins pro, produits suivis, rappels | 0 |

**Conséquence** : aujourd'hui, 15 à 30 notifications commerciales par jour ne peuvent venir que d'une seule personne. Ce serait du harcèlement. Le moteur proposé envoie **seulement quand un événement réel concerne la personne**. Le volume suivra donc l'activité : quelques messages par semaine maintenant, 15 à 30 par jour quand il y aura quelques centaines de membres actifs. Un **plafond pour toute la plateforme** (30 par jour, réglable) empêche de dépasser l'objectif.

---

## 1. Inventaire : ce qui peut déclencher une notification

### Opérationnel (code en place, utilisé en production)
- **Offres** (« J'ai ») : création, quantité, prix, ville, « ville seulement », pause, retrait, mise à jour (`offres.maj_le`).
- **Demandes** (« Je cherche ») : produit, quantité, budget, date limite (`deadline`), ville.
- **Négociations** : proposition de prix (expire au bout de **48 h**, `negociations.expire_le`), contre-proposition, accord, refus. Après l'accord, la commande se crée par un bouton (« Créer la commande »), pas toute seule.
- **Commandes** : étapes, mot secret, photos du départ (schéma 90), vérification en 1 h (schéma 89), refus, litige.
- **Boutiques** : adresse, ouverture par le vendeur, **visites mesurées** (`boutique_passages` : vue, produit, partage, lien, QR ; 1 passage en production).
- **Fiabilité, niveaux et badges** : sanctions, contestations, changements de niveau.
- **Messages directs**, avis.
- **Notifications** (PR 282) : catégories, préférences, plafond de 6 par personne et par jour, heures calmes (21 h à 7 h), anti-doublon, regroupement, journal, ouverture mesurée, statistiques.

### Présent mais partiel ou jamais utilisé en production
- **Achats groupés** : code complet, 0 groupe en production.
- **Approvisionnement pro** (`besoins`, avec `type_acheteur` et `frequence`) : code complet, 0 besoin.
- **Produits suivis** (`alertes_produits`) : 0 ligne.
- **Rappels d'achat** et **produits à racheter** : 0 rappel, et seulement 2 commandes au total.
- **Transport Marché de Gros** : fermé tant qu'il n'y a pas 3 transporteurs vérifiés (décision du propriétaire).

### Absent ou non vérifiable
- **Recherches des acheteurs** : rien n'est enregistré. « Un acheteur recherche de la tomate » n'est donc possible **que s'il a publié une demande**. Enregistrer les recherches serait un nouveau chantier (vie privée à décider).
- **Vues d'une offre** : non mesurées, sauf dans les boutiques.
- **Paiement** : non opérationnel. Aucune notification ne parle d'argent encaissé.
- **Réception sur un vrai téléphone** : jamais vérifiée (voir partie 6).

---

## 2. Déclencheurs : existants et nouveaux

« E » = déjà construit (PR 282). « **N** » = nouveau, proposé ici. Objectif mesuré : O = ouverture, R = réponse ou proposition, C = commande.

| # | Événement réel | Destinataire | Condition | Écran ouvert | Catégorie | But |
|---|---|---|---|---|---|---|
| E1 | Nouvelle offre | Ceux qui suivent le produit, puis ceux qui l'ont déjà acheté, puis les acheteurs de la région | Pas l'auteur ; « ville seulement » respectée | Produit | offres | O, R |
| **N1** | **Nouvelle offre qui répond à une demande active** | **L'auteur de la demande** | Même produit ; prix ≤ budget (ou pas de budget) ; même ville si l'un des deux est « ville seulement » | L'offre | offres | R |
| E2 | Nouvelle demande | Vendeurs qui ont une offre de ce produit ou en ont vendu (12 mois), même région d'abord | Pas l'auteur | La demande | pour_vendeur | R |
| **N2** | **Proposition de prix sans réponse** | **Celui qui doit répondre** | 24 h sans réponse, une seule relance, 24 h avant l'expiration | La négociation | negociation | R |
| **N3** | **Proposition qui expire bientôt** | Celui qui doit répondre | 6 h avant `expire_le`, si N2 n'a pas suffi | La négociation | negociation | R |
| **N9** | **Accord conclu, commande pas créée** | Les deux personnes | 2 h après l'accord, aucune commande ; une seule fois | La négociation (bouton « Créer la commande ») | negociation | C |
| **N4** | **Offre qui n'a pas bougé** | Le vendeur | Offre active, aucune mise à jour depuis 7 jours ; une fois par offre et par semaine | Son offre | stock | Mise à jour |
| **N5** | **Demande sans offre, mais des offres ailleurs** | L'acheteur | Demande de plus de 48 h, aucune négociation ; au moins 1 offre active du produit ailleurs | Le produit | offres | O, R |
| **N6** | **Demande qui arrive à sa date limite** | L'acheteur | 1 jour avant `deadline`, aucune commande | La demande | rappel | Prolonger ou fermer |
| **N7** | **Visites de la boutique cette semaine** | Le vendeur | Au moins 3 visites en 7 jours ; le lundi matin seulement | Sa boutique | boutique | Partage |
| **N8** | **Boutique pas encore ouverte** | Le vendeur | Au moins 1 offre active, pas de boutique ; **une seule fois dans la vie du compte** | Ouvrir la boutique | boutique | Ouverture |
| E3 | Achat groupé à 80 % | Inscrits, et suiveurs du produit dans la zone | Une fois par groupe | Le groupe | groupes | Rejoindre |
| E4 | Achat groupé : date limite demain | Inscrits | Une fois | Le groupe | groupe_suivi | Confirmer |
| E5 | Besoin pro publié | Vendeurs du produit | Pas l'auteur | Le besoin | pour_vendeur | R |
| E6 | Produit à racheter (rythme des commandes) | L'acheteur | Au moins 2 commandes terminées du même produit | Racheter | renouveler | C |
| E7 | Rappel d'achat choisi | L'acheteur | Date choisie | Racheter | rappel | C |
| E8 | Conseil du jour (chiffres réels) | Tous, selon le rôle | Seulement si aucun autre message commercial ce jour | Écran précis | conseils | O |
| E9 | Commande, négociation, litige, messages | Les personnes concernées | Toujours (transactionnel) | L'écran précis | trans. | Action |

**Écartés volontairement** : « un acheteur a regardé votre offre » (non mesuré), « X personnes cherchent » sans demande publiée, toute urgence sans date réelle.

**Décision du propriétaire (24/10/2026)** : comme l'application Orange Max it, ces notifications partent **toutes seules**, envoyées par le serveur. Elles sont actives par défaut et **aucun nouveau réglage** n'est ajouté. N4, N7 et N8 entrent dans les catégories qui existent déjà. Seule limite qu'on ne peut pas contourner : la personne doit avoir autorisé les notifications sur son téléphone, une fois, comme pour Max it.

---

## 3. Bibliothèque de messages (à valider)

Règles : titre de 45 caractères au plus, texte de 80 au plus. Chaque champ entre crochets vient de la base ; s'il manque, la phrase s'adapte (jamais de « null » ni de chiffre inventé). Plusieurs versions par déclencheur : la version est choisie selon la personne et l'objet, pour ne pas répéter la même phrase. Pas de « Touchez pour… » répété, pas de point d'exclamation, pas de fausse urgence. Les noms : prénom ou initiale seulement, jamais de numéro.

### N1 · Une offre répond à votre demande (acheteur)
1. **[Produit] à [ville] : [prix] F le [unité]** · « Ça répond à votre demande de [quantité]. Faites votre prix au vendeur. »
2. **Une offre pour votre demande de [produit]** · « [quantité] à [ville], [prix] F le [unité]. Le vendeur attend votre proposition. »
3. **[Produit] : un vendeur à [ville]** · « Dans votre budget : [prix] F le [unité]. Ouvrez l'offre et négociez. »

### E1 · Nouvelle offre d'un produit suivi ou déjà acheté (acheteur)
1. **[Produit] frais à [ville]** · « [quantité] disponibles, [prix] F le [unité]. Comparez avec vos prix habituels. »
2. **Nouvelle offre : [produit]** · « Vous en avez déjà acheté. [quantité] à [ville], [prix] F le [unité]. »
3. Regroupé : **[n] nouvelles offres de [produit]** · « Entre [prix min] et [prix max] F le [unité]. Voyez la moins chère. »

### E2 · Un acheteur cherche ce que vous vendez (vendeur)
1. **On cherche [quantité] de [produit] à [ville]** · « Vous en vendez. Proposez votre prix, votre numéro reste caché. »
2. **[Produit] demandé à [ville]** · « Budget [budget] F le [unité]. Votre offre peut répondre. »
3. Acheteur pro (`besoins.type_acheteur`) : **Un [restaurant] de [ville] cherche du [produit]** · « [quantité] [chaque semaine]. Voyez son besoin et proposez. »
4. Regroupé : **[n] acheteurs cherchent du [produit]** · « Voyez leurs quantités et faites vos prix. »

### N2 · Proposition sans réponse (celui qui doit répondre)
1. **[Prénom] attend votre réponse** · « [prix] F le [unité] pour le [produit]. Acceptez, refusez ou faites votre prix. »
2. **Votre avis sur le prix de [Prénom] ?** · « [produit] à [prix] F le [unité]. Sa proposition tient jusqu'à [heure]. »

### N3 · Proposition qui expire bientôt
1. **La proposition de [Prénom] expire à [heure]** · « [produit], [prix] F le [unité]. Après, il faudra repartir de zéro. »

### N9 · Accord conclu, commande pas créée (les deux)
1. **Accord sur le [produit] avec [Prénom]** · « La commande n'est pas encore créée. Fixez la livraison en un geste. »

### N4 · Offre qui n'a pas bougé (vendeur)
1. **Votre [produit] est toujours disponible ?** · « Offre du [date] : [quantité] à [prix] F. Confirmez ou mettez à jour. »
2. **[Produit] : votre stock a changé ?** · « Ajustez la quantité ou le prix, ou mettez l'offre en pause. »
3. **Encore [quantité] de [produit] ?** · « Une offre à jour évite les appels pour rien. Vérifiez-la. »

### N5 · Demande sans offre, mais des offres ailleurs (acheteur)
1. **[Produit] : [n] offres hors de [ville]** · « Rien encore près de vous. Voyez [ville 1] et [ville 2]. »
2. **Votre demande de [produit] attend** · « [n] vendeurs en ont ailleurs. Comparez leurs prix. »

### N6 · Demande qui arrive à sa date limite (acheteur)
1. **Votre demande de [produit] se termine demain** · « Prolongez-la si vous cherchez encore, sinon fermez-la. »

### N7 · Visites de la boutique (vendeur, le lundi)
1. **[n] visites sur votre boutique cette semaine** · « Partagez son lien avec vos clients sur WhatsApp. »
2. **Votre boutique a été ouverte [n] fois** · « Gardez vos offres à jour : c'est ce que voient vos visiteurs. »

### N8 · Boutique pas encore ouverte (vendeur, une seule fois)
1. **Une adresse pour toutes vos offres** · « Ouvrez votre boutique et partagez-la à vos clients. »

### E3 et E4 · Achat groupé
1. **[Produit] : il manque [reste] au groupe** · « Prix de groupe : [prix] F le [unité]. Rejoignez si ça vous va. »
2. **Dernier jour pour le groupe de [produit]** · « Confirmez votre part, ou retirez-vous. Rien n'est commandé sans vous. »

### E6 · Produit à racheter (acheteur)
1. **Bientôt plus de [produit] ?** · « Vous en prenez tous les [n] jours environ. Voyez les offres du jour. »
2. **Il y a [n] jours, vous preniez [quantité] de [produit]** · « Les offres du moment sont là. Rien n'est commandé sans vous. »

### E8 · Conseil du jour (une fois par jour au plus, sans autre message ce jour)
- Acheteur : **[Produit] : de [min] à [max] F le [unité]** · « Prix demandés dans [n] offres de votre région. »
- Vendeur : **[n] professionnels cherchent un fournisseur** · « Restaurants, hôtels, cantines. Voyez leurs besoins. »
- On retire les conseils sans chiffre ni événement (« Vendez en direct », « Négociez le prix »…) : ils ne donnent pas de vraie raison d'ouvrir l'application.

---

## 4. Système technique proposé

Tout reste gratuit (Postgres, `pg_cron`, `pg_net`, Web Push) et passe par ce qui existe (`notif_preparer`, `notif_file`, `notif_journal`).

1. **Nouveaux déclencheurs** :
   - une tâche `notif_relances()` toutes les 15 minutes cherche N2 à N9 ;
   - N1 s'ajoute à `notif_cible_annonce` (les auteurs des demandes compatibles passent en premier) ;
   - chacun a une **clé anti-doublon** (exemple : `relance:<message_id>`, `stock:<offre_id>:<semaine>`, `boutique_ouvrir:<user>`).
2. **Plafond de la plateforme** : nouvelle règle `max_com_plateforme_jour` (30, réglable par l'administrateur). Quand il est atteint, les messages commerciaux attendent le lendemain ou sont abandonnés, jamais forcés.
3. **Priorité** quand le plafond est proche :
   1. N1 (offre pour ma demande) ;
   2. E2 et E5 (acheteur pour mes produits) ;
   3. N5 ;
   4. E3 ;
   5. E1 ;
   6. N4, N7 ;
   7. E6 ;
   8. N8 ;
   9. E8.

   Le conseil du jour passe toujours en dernier.
4. **Plafond par personne** :
   - Proposition : passer de 6 à **3 messages commerciaux par jour** (à valider). L'objectif de 15 à 30 est un total pour toute la plateforme.
   - Heures calmes 21 h à 7 h, inchangées.
   - **Repos** : après 3 notifications commerciales ignorées d'affilée, pause de 3 jours pour cette personne.
5. **Relances de négociation (N2, N3, N9)** : elles concernent un échange en cours, donc catégorie « Négociations ». Une seule de chaque par proposition.
6. **Textes** : la bibliothèque de la partie 3 est écrite dans `pousser`. La version est choisie selon la personne et l'objet ; elle est la même en cas de nouvel essai.
7. **Mesure** (le journal existe déjà) :
   - envoyées, échecs, ouvertes, et action dans les 24 h (proposition, commande, offre mise à jour, boutique partagée) ;
   - ajout des **« ignorées »** : envoyée, non ouverte au bout de 48 h ;
   - ajout du **taux par déclencheur** dans le tableau de bord ;
   - « délivrée » n'est pas mesurable avec Web Push, et ne sera pas prétendu.
8. **Liens** : chaque message ouvre l'écran exact (`?nego=`, `?offre=`, `?demande=`, `#/produits/<slug>`, `?boutique=1`). Les écrans manquants seront vérifiés un par un.

---

## 5. Tests prévus

Sur le **projet de test**, sans rien laisser (blocs annulés) : pour chaque déclencheur,
- la bonne personne reçoit ;
- l'auteur ne reçoit pas ;
- « ville seulement » est respectée ;
- les préférences coupées, les heures calmes, le plafond par personne et le plafond de la plateforme fonctionnent ;
- il n'y a pas de doublon ;
- le lien est le bon.

Les écrans ouverts par chaque lien sont vérifiés dans Chromium (iPhone émulé, clair et sombre), avec captures envoyées avant la PR.

---

## 6. Ce qui reste bloqué

- **Réception sur un vrai téléphone** : jamais vérifiée. Le serveur répond « envoyé » (HTTP 200), mais seul un essai sur Android et sur iPhone (application installée sur l'écran d'accueil) le prouvera. À faire par le propriétaire : Réglages → Notifications → Essai.
- **Projet de test sans clés push** : les envois se testent en SQL (cibles, plafonds, journal), pas jusqu'au téléphone. Copier les clés dans le projet de test est un choix du propriétaire.
- **Recherches non enregistrées** : impossible de dire « un acheteur recherche… » sans demande publiée.
- **Volume** : avec 1 compte joignable, le moteur enverra peu. C'est voulu.

---

## 7. À valider par le propriétaire

1. Les nouveaux déclencheurs N1 à N9.
2. Le ton et les phrases de la bibliothèque (partie 3) : à corriger, garder ou retirer.
3. Plafond de la plateforme : 30 par jour.
4. Plafond par personne : 3 par jour (au lieu de 6).
5. Pause de 3 jours après 3 messages ignorés d'affilée.
6. ~~Deux nouveaux réglages~~ : refusé par le propriétaire (envoi automatique, sans réglage).
7. Retrait des conseils sans chiffre ni événement.
