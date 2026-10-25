# Conditions d'utilisation du Marché de Gros CI

> **PROJET, à faire relire par un juriste. Rien n'est en ligne.**
> Version de travail du 24/10/2026, mise à jour le 25/10/2026 (lecture des messages par l'équipe). Les commentaires `<!-- source: … -->` disent où chaque règle se trouve dans le code ; ils seront retirés de la version publiée.

## 1. Qui nous sommes et ce que nous faisons

Le Marché de Gros CI (« MGCI », « le Marché de Gros ») est une application qui **met en relation** des acheteurs et des vendeurs de produits vivriers en gros en Côte d'Ivoire.

MGCI :
- permet de publier des annonces (offres de vente et demandes d'achat) ;
- permet de discuter et de négocier un prix ;
- garde la trace de l'accord et suit la commande étape par étape ;
- aide à régler un désaccord (médiation).

MGCI **n'est ni le vendeur, ni l'acheteur, ni le transporteur** de la marchandise. Le contrat de vente se fait entre l'acheteur et le vendeur.

Exception à venir : un **service de transport Marché de Gros**, avec des transporteurs vérifiés par l'équipe. **Ce service est fermé aujourd'hui.** Quand il ouvrira, ses règles seront ajoutées ici. [DÉCISION DU PROPRIÉTAIRE : rôle exact de MGCI dans ce service (simple mise en relation ou transporteur responsable).]
<!-- source: supabase/schema-62-transport-reseau-pause.sql (_transport_reseau_ouvert = false) ; schema-83a-transport-nego.sql (réglage transport_reseau_ouvert = false) ; CLAUDE.md « le service reste fermé tant qu'il n'y a pas 3 transporteurs vérifiés et l'accord du propriétaire » -->

[À VALIDER PAR LE JURISTE : qualification juridique de MGCI (intermédiaire, place de marché) et effets en droit ivoirien.]

**Les messages ne sont pas une messagerie privée.** Le Marché de Gros n'est pas WhatsApp : c'est une mise en relation d'un vendeur et d'un acheteur. **L'équipe du Marché de Gros peut lire tous les messages** échangés dans l'application (messages privés et négociations), pour la sécurité des membres, les litiges, la lutte contre la fraude et le bon fonctionnement de la mise en relation. N'y écrivez que ce qui concerne votre achat ou votre vente. Voir la politique de confidentialité, partie 2.5.
[À VALIDER PAR LE JURISTE : formulation, au regard de la loi n° 2013-450 sur les données personnelles et des règles de l'ARTCI.]
<!-- source: supabase/schema-10-admin-messages.sql admin_discussions(), admin_dm() ; décision du propriétaire du 25/10/2026 (« L'équipe peut lire tout, l'app n'est pas un WhatsApp, c'est une mise en relation d'un vendeur et d'un acheteur. ») -->

## 2. Accepter ces conditions

En créant un compte, vous acceptez ces conditions. Si vous n'êtes pas d'accord, n'utilisez pas l'application.
[À VALIDER : la case « J'accepte les conditions » à l'inscription n'existe pas encore. Elle sera ajoutée après validation.]

## 3. Votre compte

### 3.1 Créer un compte
- Un compte se crée avec un **numéro de téléphone ivoirien (10 chiffres)** et un **code secret de 6 chiffres**.
- **Le numéro n'est pas vérifié par SMS** aujourd'hui. MGCI ne garantit donc pas que le numéro appartient à la personne.
- À la création, un **code de secours** est donné une seule fois. Il sert à retrouver le compte en cas d'oubli du code secret.
<!-- source: v3/nuage.js signUp() (lignes 64-73 : compte ouvert sans SMS, code de 6 chiffres, creer_secours) -->

### 3.2 Une personne, un compte
- Chaque personne (ou entreprise) n'a **qu'un seul compte**. [À VALIDER]
- Vous donnez votre vrai prénom et votre vrai nom. Le pseudonyme est permis s'il ne trompe personne.
- Un même numéro ne peut avoir qu'un compte.
<!-- source: v3/nuage.js signUp() (« Ce numéro a déjà un compte ») ; la règle « une personne, un compte » n'est pas contrôlée techniquement (audit 24/10/2026 : doublon de pièce d'identité non bloquant) -->

### 3.3 Identité vérifiée ou non
- Vous pouvez faire vérifier votre identité, gratuitement : photo de la pièce (CNI, passeport, carte consulaire ou permis de conduire, en cours de validité) et un selfie avec un code écrit à la main. **Une personne de l'équipe décide.**
- Un profil vérifié porte le badge « **Identité vérifiée** ». Un profil non vérifié porte la mention « **Non identifié** ».
- Le badge disparaît le jour où la pièce expire.
- « Identité vérifiée » veut dire que l'équipe a comparé une pièce et un selfie. **Cela ne garantit pas que la personne est fiable ni qu'elle livrera.** Regardez aussi sa fiabilité et ses avis.
- Sans vérification, vous pouvez publier **3 annonces**.
<!-- source: supabase/schema-13-identite.sql (pièces cni/passeport/carte_consulaire/permis, selfie avec défi) ; schema-16-identite-conservation.sql (pièce expirée refusée, badge retiré à l'expiration) ; schema-14-confiance.sql annonces_gratuites() = 3 ; v3/aide.js ligne « Que veut dire le sceau vert ? » ; CLAUDE.md « Non identifié » -->

### 3.4 Protéger votre compte
- Votre code secret est personnel. Ne le donnez à personne.
- **Le Marché de Gros ne vous demandera jamais d'argent ni de code** par message ou par téléphone.
- Ce qui est fait depuis votre compte est réputé fait par vous. [À VALIDER PAR LE JURISTE]
<!-- source: v3/aide.js « On me demande de payer d'avance » -->

### 3.5 Changer de numéro
Pour changer de numéro, écrivez au Marché de Gros dans l'application.
<!-- source: v3/compte.js securite() « Pour en changer, écrivez au Marché de Gros. » -->
[DÉCISION DU PROPRIÉTAIRE : procédure quand un numéro est contesté (quelqu'un a pris votre numéro avant vous).]

### 3.6 Supprimer votre compte
- Vous pouvez supprimer votre compte vous-même (Mon compte → Sécurité et compte).
- Vos annonces sont retirées, les négociations en cours fermées, votre profil effacé, la connexion bloquée.
- Les accords et les messages déjà échangés restent visibles de l'autre partie (avec « Compte supprimé »), pour garder la trace des échanges.
- Le numéro reste bloqué : il ne peut pas servir à créer un nouveau compte. [DÉCISION DU PROPRIÉTAIRE : faut-il libérer le numéro après un délai ?]
- Le dossier d'identité, s'il a été envoyé, est gardé 5 ans (voir la politique de confidentialité).
<!-- source: supabase/schema-4.sql supprimer_compte() (annonces retirées, profil vidé, secours effacé, banned_until = infinity) ; schema-16-identite-conservation.sql (dossier gardé 5 ans après la suppression) -->

## 4. Les annonces

### 4.1 Ce que vous publiez
- Une offre (je vends) ou une demande (j'achète) décrit une **vraie marchandise ou un vrai besoin** : produit, quantité, unité, prix, ville.
- **La quantité est obligatoire.**
- Votre annonce porte le **nom public de votre compte**. Vous ne pouvez pas publier sous un autre nom.
- **Votre numéro n'est jamais affiché** sur vos annonces : on vous écrit et on vous propose un prix dans l'application.
- Vous êtes responsable de ce que vous publiez (produit, qualité annoncée, prix, photos).
<!-- source: schema-86-boutiques.sql (quantité obligatoire, décision 39) ; schema-56-nom-du-compte.sql annonce_nom_compte() ; schema-9-lieu-contact.sql (phone effacé) ; v3/compte.js reglages() « Votre numéro n'est jamais affiché » -->

### 4.2 Vente ou achat « dans ma ville seulement »
- Un vendeur peut choisir « **Je vends uniquement à [ma ville]** ». Un acheteur peut choisir « **J'achète uniquement à [ma ville]** ».
- Dans ce cas, le serveur **refuse** une commande hors de cette ville.
- Abidjan compte comme une seule ville (ses communes ne sont pas des villes à part).
<!-- source: supabase/schema-87-ville-seulement.sql (colonne ville_seulement, commande_creer2) ; schema-87b-ville-reference.sql (_ville_ref) ; schema-87c-abidjan-une-ville.sql -->
Note pour la relecture : l'audit du 24/10/2026 a trouvé deux chemins qui contournent cette règle (ancienne fonction de commande, achats groupés). Ne publier cette phrase que quand ils sont fermés. [À VÉRIFIER AVANT PUBLICATION]

### 4.3 Durée d'une annonce
- Une annonce **expire au bout de 30 jours**. Vous pouvez la prolonger d'un geste. [À VÉRIFIER AVANT PUBLICATION : l'expiration est en construction ; aujourd'hui, aucune annonce n'expire.]
<!-- source: audit 24/10/2026 (« Expiration des annonces : Absent ») ; délai par défaut fixé par le chef d'équipe : 30 jours, prolongeable -->

### 4.4 Retirer ou mettre en pause
- « Retirer » cache l'annonce. Une trace est gardée pour l'historique des commandes.
- Une boutique « en pause » n'est plus proposée, mais **les négociations déjà ouvertes continuent**.
<!-- source: docs/audits/decisions-chantiers-2026-10-24.md décisions 37 et 38 ; schema-86c-boutiques-retrait.sql -->

### 4.5 Annonces refusées ou cachées
L'équipe peut cacher une annonce fausse, trompeuse, illégale ou signalée. [À VALIDER]
<!-- source: schema-84b (annonces masquées pendant une suspension) ; masquage par signalements (audit : 3 signalements suffisent ; seul l'admin rétablit) -->

## 5. Négocier et conclure un accord

- Vous proposez un prix et une quantité. L'autre partie accepte, refuse ou fait une contre-proposition.
- **Une proposition reste valable 48 heures.** Ensuite, elle n'est plus valable.
- Le vendeur peut fixer une **quantité minimale**.
- Le transport fait partie de la proposition (voir partie 7).
- **Quand une proposition est acceptée, l'accord est conclu.** Le prix, la quantité et le transport **ne bougent plus**.
- **L'accord engage les deux parties** : le vendeur à fournir la marchandise décrite, l'acheteur à la prendre et à la payer au prix convenu. [À VALIDER PAR LE JURISTE : valeur de l'accord comme contrat de vente.]
- Un accord n'est pas un paiement.
- Si aucune commande n'est créée dans les **72 heures** après l'accord, l'accord est classé « **sans suite** » et la quantité revient sur l'annonce. [À VÉRIFIER AVANT PUBLICATION : règle en construction.]
<!-- source: supabase/schema-3.sql (proposition expire_le = now() + 48 h) ; schema-37-minimum-vendeur.sql ; schema-83a-transport-nego.sql (l'accord fige transport_final, prix_transport_final) ; v3/aide.js « L'accord est conclu, et après ? » ; audit 24/10/2026 (« Annulation d'un accord sans commande : Absent ») -->

## 6. La commande

### 6.1 Créer et confirmer
- Après l'accord, l'une des parties crée la commande (qui transporte, où livrer). **L'autre partie la confirme.**
- Sans réponse dans les **48 heures**, la commande expire. Elle ne compte contre personne.
- Aucune commande ne part sans la confirmation de l'acheteur et du vendeur.
<!-- source: supabase/schema-26-commandes.sql (a_confirmer → en_cours par commande_repondre) ; schema-84a-fiabilite-annulations.sql commandes_expirer() (expiration_heures = 48) -->

### 6.2 Préparer et charger
- Le vendeur charge la marchandise dans les **72 heures** après la confirmation. [À VÉRIFIER AVANT PUBLICATION : délai en construction ; aujourd'hui, aucune échéance.]
- **Avant le chargement, le vendeur doit fournir les preuves de départ** :
  - 2 à 4 photos du colis emballé ;
  - le poids pesé ;
  - s'il y a un mot secret : la photo du papier, avec le code au hasard donné par l'application écrit à côté (dans les 3 minutes).
- Sans ces preuves, le chargement ne peut pas être confirmé.
- L'acheteur, le transporteur et l'équipe voient les photos du colis. **Seule l'équipe voit la photo du papier du mot secret.**
<!-- source: supabase/schema-90-photos-depart.sql commande_depart_preuves() (2 à 4 photos, poids) ; schema-90b-photo-mot.sql commande_depart_defi() (code de 4 signes, 3 minutes) ; audit 24/10/2026 problème 2 (aucune échéance de chargement) -->

### 6.3 Transport et arrivée
Chaque étape (chargement, transport, arrivée) est notée dans un journal avec l'heure, la personne et, si elle l'accepte, sa position.
<!-- source: supabase/schema-26-commandes.sql _cmd_journal(), commande_avancer() (p_lat, p_lon facultatifs) -->

### 6.4 Réception
- L'acheteur confirme la réception, en tapant le **mot secret** écrit sur le papier glissé dans le colis par le vendeur (s'il y en a un).
- **L'acheteur a 1 heure après la réception pour réclamer.** Il est prévenu au moment où il confirme la réception.
- Sans réclamation dans l'heure, la commande est **clôturée** toute seule : la marchandise est considérée comme conforme.
<!-- source: supabase/schema-89a-verification-1h.sql sequestre_liberer_echus() (termine_le + 1 h, tâche toutes les 5 min) ; v3/aide.js « Combien de temps pour réclamer ? » -->
Note pour la relecture : le message d'erreur du serveur `commande_litige` dit encore « 24 h ». À corriger avant publication. [À VÉRIFIER AVANT PUBLICATION]
<!-- source: supabase/schema-61-liberation-24h.sql commande_litige() -->

### 6.5 Refuser tout ou partie de la marchandise
- Dans l'heure qui suit la réception (ou à l'arrivée du chauffeur), l'acheteur peut **refuser** tout ou partie de la marchandise, avec le mot secret et 1 à 4 photos.
- Si le vendeur reconnaît le problème, l'acheteur ne doit que la partie acceptée.
- Sinon, une **discussion à trois** s'ouvre (acheteur, vendeur, Marché de Gros) et **l'équipe juge**.
- **Sans preuve, pas de refus.** Un acheteur qui dit « cassé » face à des photos de départ propres doit le prouver.
<!-- source: supabase/schema-58-sequestre-regles.sql commande_refuser2(), commande_refus_vendeur(), admin_refus_trancher() (schema-57) ; v3/aide.js « La marchandise est gâtée », « Vais-je être remboursé ? » ; CLAUDE.md « preuves au départ » -->

## 7. Le transport

Le mode de transport est choisi dans la proposition, puis figé dans l'accord.

### 7.1 Les mots utilisés
- **Transport inclus** : le vendeur livre, le prix du transport est dans le prix de la marchandise.
- **À part** : le vendeur livre, avec un prix de transport ajouté. Ce prix est donné et négocié dans la proposition.
- **Transport à la charge de l'acheteur** : l'acheteur organise et paie le transport lui-même. Selon l'écran, l'acheteur lit « Transport à votre charge » ou « À ma charge » ; le vendeur choisit « À la charge de l'acheteur ».
<!-- source: supabase/schema-83a-transport-nego.sql (transport inclus / à part avec prix / sans transport) ; CLAUDE.md règle « Transport à la charge de l'acheteur » -->

### 7.2 Même ville
- Le vendeur organise son livreur. **Ce livreur est payé par l'acheteur directement, hors du Marché de Gros.**
- L'acheteur peut venir chercher la marchandise seulement si le vendeur l'accepte.
- « Même ville » veut dire la même ville choisie dans la liste.
<!-- source: docs/audits/decisions-chantiers-2026-10-24.md décisions 1 et 2 -->

### 7.3 Le livreur du vendeur ou de l'acheteur
Un livreur choisi par le vendeur ou par l'acheteur **n'est pas un transporteur du Marché de Gros**. MGCI n'a aucun contrat avec lui. Aucune commission n'est due sur son prix. Le prix et les conditions se règlent entre lui et la partie qui l'emploie.
<!-- source: supabase/schema-82-commission-transport-mgci.sql _ctr_sync() (commission transport seulement en mode « reseau » avec transporteur vérifié) -->

### 7.4 Le service de transport Marché de Gros (fermé)
Aujourd'hui fermé. Règles prévues à son ouverture (décidées par le propriétaire, non en service) :
- seuls des transporteurs vérifiés par l'équipe ;
- le transporteur propose son prix ; l'acheteur et le vendeur acceptent, refusent ou contre-proposent (48 h) ;
- si son prix est refusé, la commande continue avec le livreur du vendeur ;
- pas de messages privés avec le transporteur pendant la mission.
<!-- source: docs/audits/decisions-chantiers-2026-10-24.md décisions 3 à 9 ; schema-83c-transport-trois.sql ; schema-62 (fermé) -->

## 8. Le paiement

**Aucun paiement ne passe aujourd'hui par l'application.**

- L'acheteur paie le vendeur **directement**, en dehors de l'application, en général à la livraison, après avoir vu la marchandise.
- **MGCI ne reçoit, ne garde et ne reverse aucun argent.** MGCI ne rembourse pas.
- Le moyen de paiement (espèces, Mobile Money…) est choisi par les parties, **à leurs risques**.
- **Ne payez jamais d'avance** à quelqu'un que vous ne connaissez pas.
- Si une partie de la marchandise est refusée et que le refus est reconnu ou accepté par l'équipe, l'acheteur ne doit pas cette partie. MGCI ne peut pas forcer un remboursement d'argent déjà versé. [À VALIDER PAR LE JURISTE]
- Le transport reste dû en cas de refus de la marchandise. [À VALIDER : règle écrite dans l'aide de l'application, à confirmer.]
<!-- source: supabase/schema-30-commissions.sql (encaissement = 'aucun', seule valeur permise) ; schema-57-sequestre.sql (séquestre : 0 ligne, jamais déclenché, audit 24/10/2026) ; v3/aide.js « Comment se passe le paiement ? », « Qui paie le transport si je refuse ? » -->

Un **paiement sécurisé** (l'argent est bloqué jusqu'à la réception) est **en préparation**. Il demande un partenaire agréé. Tant qu'il n'est pas ouvert, rien de ce qui précède ne change. [DÉCISION DU PROPRIÉTAIRE : partenaire, date, règles. Le texte sera revu à ce moment-là.]
<!-- source: docs/SEQUESTRE.md ; audit 24/10/2026 partie 7 (« exige un partenaire agréé BCEAO ») -->

## 9. La commission

### 9.1 Les taux
- **3,5 %** du montant de la marchandise, sur une vente terminée, **à la charge du vendeur**.
- **6,9 %** du prix du transport, **seulement** quand le transport est fait par le service de transport Marché de Gros (aujourd'hui fermé). Elle est retenue sur le prix du transporteur. **Aucune commission sur un livreur choisi par le vendeur ou l'acheteur.**
- Créer un compte, publier, négocier, écrire et acheter sont **gratuits**.
<!-- source: supabase/schema-30-commissions.sql (taux 0,035, ligne au nom du vendeur) ; schema-82-commission-transport-mgci.sql (6,9 % seulement mode « reseau » + transporteur vérifié) ; docs/audits/decisions-chantiers-2026-10-24.md décision 7 ; v3/aide.js « C'est payant ? » -->

### 9.2 Ce qui se passe aujourd'hui
- Le serveur **calcule** la commission de chaque commande et la note dans un registre.
- **Elle n'est pas encaissée.** Aucun prélèvement n'est fait. Le registre indique « encaissement : aucun ».
- Dans le registre, une commission « due » veut dire « **sera à payer quand le paiement intégré existera** », jamais « payée ».
<!-- source: supabase/schema-30-commissions.sql (statuts prevue/due/suspendue/annulee ; encaissement in ('aucun')) ; schema-42-commission-transport.sql -->

### 9.3 Quand le paiement intégré arrivera
- Comment la commission sera prélevée : [DÉCISION DU PROPRIÉTAIRE].
- Les ventes faites **avant** l'arrivée du paiement : la commission sera-t-elle demandée ? [DÉCISION DU PROPRIÉTAIRE] Proposition : **non**, rien n'est demandé pour les ventes antérieures. [À VALIDER]
- Les membres seront prévenus avant tout changement (voir partie 15).

## 10. Annulations

- Toute annulation demande un **motif** : stock épuisé, prix changé, l'autre partie ne répond pas, erreur de saisie, panne ou météo, autre (avec une explication).
- Chaque annulation est classée : **abusive**, **légitime**, **litige** ou **problème technique**. Une règle automatique classe les cas clairs ; l'équipe peut changer la catégorie.
- Une commande confirmée ne s'annule pas seule : il faut l'accord de l'autre partie, ou passer par l'équipe.
- Refuser ou retirer une commande **avant** sa confirmation ne compte pas contre vous.
- Une annulation est **légitime** si elle est faite d'un commun accord, avant confirmation, ou pour force majeure acceptée par l'équipe.
- Quand la vente tombe sans que la marchandise soit partie, la quantité revient sur l'annonce. [À VÉRIFIER AVANT PUBLICATION : aujourd'hui, le stock n'est rendu que dans un seul cas sur cinq (audit 24/10/2026, problème 1).]
<!-- source: supabase/schema-84a-fiabilite-annulations.sql (motifs stock_epuise, prix_change, sans_reponse, erreur_saisie, panne_meteo, autre ; catégories abusive, legitime, litige, technique) ; docs/audits/decisions-chantiers-2026-10-24.md décisions 11 à 14, 27 -->

## 11. Fiabilité, badges et sanctions

### 11.1 Fiabilité
- Votre fiabilité est calculée sur vos commandes. Elle est **publique en une ligne** (exemple : « Fiabilité : 96 % sur 25 commandes »). Le détail n'est visible que par vous.
- Les annulations sont comptées sur **90 jours glissants**. Les avertissements ne sont pas visibles des autres.
- Rien n'est compté avant la mise en service de ce système.
<!-- source: supabase/schema-84a (réglage fenetre_jours = 90, debut) ; schema-84b-fiabilite-score-sanctions.sql ; décisions 17, 18, 20 -->

### 11.2 Badges
- Les badges (Vendeur fiable, Bon, Excellent, Grand vendeur ; mêmes niveaux pour les acheteurs ; « Acheteur en gros ») se calculent sur **12 mois glissants**, avec les commandes terminées seulement. Les seuils sont réglés par l'équipe.
- Avant de perdre un niveau, vous avez **30 jours de grâce**.
- Un badge n'est pas une garantie donnée par MGCI. [À VALIDER]
<!-- source: supabase/schema-85a-niveaux-calcul.sql ; décisions 22 à 33 -->

### 11.3 Suspension
- La suspension est **toujours décidée par l'équipe**, avec un motif écrit : **7 jours** la première fois, **30 jours** en cas de récidive.
- Pendant la suspension, vos annonces sont cachées. Vous ne pouvez pas publier, ni ouvrir de négociation ou de commande. Vous pouvez **terminer vos commandes en cours**.
- Vos annonces reviennent à la fin de la suspension.
<!-- source: supabase/schema-84b-fiabilite-score-sanctions.sql admin_suspendre() (suspension_jours 7, recidive_jours 30, offres/demandes « masquee ») et garde « COMPTE_SUSPENDU » ; décisions 15 et 16 -->

### 11.4 Contester
- Vous pouvez **contester** une annulation comptée contre vous ou un badge, **dans les 7 jours**.
- L'équipe répond **dans les 7 jours**.
<!-- source: supabase/schema-84b (contestation_jours = 7, reponse_jours = 7) ; décisions 19 et 32 -->

## 12. Litiges

- Un problème se signale **après le chargement**, et **jusqu'à la clôture de la commande** (1 heure après la réception).
- Pendant un litige, une **discussion à trois** réunit l'acheteur, le vendeur et le Marché de Gros.
- L'équipe lit les échanges (négociation, messages, photos, preuves de départ, mot secret) pour comprendre. Elle peut aussi lire les messages en dehors d'un litige (voir partie 1).
- **Le rôle de l'équipe est la médiation.** Elle propose une issue et note sa décision dans l'application (commande terminée ou annulée, partie refusée acceptée ou non). **MGCI n'est pas un tribunal** : sa décision ne remplace pas une décision de justice, et chacun garde le droit d'aller devant le juge. [À VALIDER PAR LE JURISTE]
- Délai de réponse de l'équipe à un litige : [DÉCISION DU PROPRIÉTAIRE]. Proposition : 7 jours, comme pour les contestations.
<!-- source: supabase/schema-61-liberation-24h.sql commande_litige() (après chargement, jusqu'à libere_le) ; schema-57/84a admin_litige_trancher(), admin_litige_trancher2() ; schema-57 admin_refus_trancher() ; v3/commandes.js « Discussion à trois » ; v3/aide.js « C'est quoi, la discussion à trois ? » ; audit 24/10/2026 problème 10 (aucune échéance des litiges) -->

## 13. Responsabilité

**Toute cette partie est une proposition. [À VALIDER PAR LE JURISTE]**

### 13.1 Ce dont MGCI répond
- Faire fonctionner l'application avec soin.
- Protéger les données comme le dit la politique de confidentialité.
- Traiter les signalements et les litiges qu'on lui envoie.

### 13.2 Ce dont MGCI ne répond pas
MGCI n'étant ni vendeur, ni acheteur, ni transporteur :
- **Qualité et conformité** : le vendeur répond de la marchandise qu'il a décrite ; l'acheteur doit vérifier à la réception et réclamer dans l'heure. [À VALIDER]
- **Casse ou perte en route** : proposition : avec le livreur du vendeur (ou un transport « inclus » ou « à part »), le risque reste au **vendeur** jusqu'à la réception ; avec un transport à la charge de l'acheteur, le risque passe à l'**acheteur** au chargement. Les preuves de départ servent à trancher. [À VALIDER]
- **Retard** : proposition : un retard ne donne pas droit à une indemnité de MGCI ; l'acheteur peut demander l'annulation à l'équipe si le chargement n'a pas eu lieu dans le délai. [À VALIDER]
- **Paiement** : MGCI ne garantit aucun paiement entre les parties (voir partie 8).
- **Informations des membres** : MGCI ne garantit pas l'exactitude des annonces, des profils ni des numéros (non vérifiés par SMS).
- **Interruption** : l'application peut être indisponible (panne, mise à jour, hébergeur). Aucune indemnité. [À VALIDER]

### 13.3 Force majeure
Proposition : un événement qu'on ne peut ni prévoir ni éviter (route coupée, pluies exceptionnelles, panne grave, décision des autorités) permet d'annuler sans que cela compte contre soi, **si l'équipe l'accepte** sur preuves. Le motif « panne ou météo » sert à le déclarer. [À VALIDER] [À VALIDER PAR LE JURISTE : définition de la force majeure en droit ivoirien.]
<!-- source: schema-84a motif « panne_meteo » ; décision 27 (« force majeure validée par l'administrateur ») -->

## 14. Ce qui est interdit

Il est interdit de :
- créer de **faux comptes** ou plusieurs comptes pour une même personne ;
- **se faire passer pour quelqu'un d'autre** (personne, coopérative, entreprise) ;
- **se faire passer pour le Marché de Gros** ou son équipe (nom, pseudo, logo, messages) ;
- publier une annonce fausse, une marchandise qu'on n'a pas, un prix trompeur ;
- passer de **fausses commandes** pour gagner des badges ou de faux avis ;
- **donner ou demander des numéros de téléphone, liens ou autres messageries pour contourner** l'application et la commission ;
- demander de l'argent d'avance par message, ou demander un code ;
- insulter, menacer, harceler ;
- vendre des produits interdits ou dangereux [À VALIDER PAR LE JURISTE : liste] ;
- signaler quelqu'un sans raison, pour lui nuire ;
- essayer de casser ou de forcer l'application.

Les numéros écrits dans les messages sont masqués, et une tentative de sortie de l'application prévient l'équipe.
<!-- source: supabase/schema-10-admin-messages.sql sortie_motif() et table alertes ; schema-83d-filtre-numeros.sql ; audit 24/10/2026 problème 4 (le nom « Marché de Gros » n'est pas encore réservé techniquement) et problème 7 (badges fabriqués) -->

## 15. Suspension, bannissement et fermeture du compte

- En cas de manquement à ces conditions, l'équipe peut : avertir, cacher une annonce, **suspendre** (partie 11.3) ou **bannir** le compte. Un bannissement est noté avec un motif.
- Les cas graves (fraude, usurpation, menace) peuvent mener à un bannissement sans suspension préalable. [À VALIDER]
- Vous pouvez contester par message au Marché de Gros. [DÉCISION DU PROPRIÉTAIRE : délai et procédure pour contester un bannissement.]
<!-- source: supabase/schema-14-confiance.sql admin_bannir(p_user, p_motif, p_detail), admin_lever_bannissement() -->

## 16. Modification des conditions

- MGCI peut changer ces conditions, par exemple à l'arrivée du paiement intégré ou du service de transport.
- Vous serez prévenu dans l'application **avant** l'entrée en vigueur. Proposition : 15 jours avant. [À VALIDER]
- Si vous continuez à utiliser l'application après cette date, vous acceptez la nouvelle version. Sinon, vous pouvez supprimer votre compte.
- Les commandes déjà confirmées restent sous les conditions du jour de leur confirmation. [À VALIDER]

## 17. Droit applicable

Ces conditions sont soumises au **droit ivoirien**. En cas de désaccord, on cherche d'abord une solution à l'amiable ; ensuite, les tribunaux compétents sont ceux de [À REMPLIR]. [À VALIDER PAR LE JURISTE]

## 18. Nous contacter

Dans l'application : Messages → « Écrire au Marché de Gros ».
Autre contact : [À REMPLIR].
<!-- source: supabase/schema-10-admin-messages.sql contact_marche() -->
