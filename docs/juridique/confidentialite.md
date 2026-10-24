# Politique de confidentialité du Marché de Gros CI

> **PROJET, à faire relire par un juriste. Rien n'est en ligne.**
> Version de travail du 24/10/2026. Chaque ligne décrit ce que fait vraiment l'application ; les commentaires `<!-- source: … -->` disent où le vérifier. Ils seront retirés de la version publiée.

## 1. Qui est responsable de vos données

Le responsable du traitement est : [À REMPLIR : nom de la personne ou de la société, adresse, contact]. Voir `mentions-legales.md`.

## 2. Les données que nous gardons, et pourquoi

### 2.1 Pour vous connecter
| Donnée | Pourquoi |
|---|---|
| Numéro de téléphone | Vous identifier à la connexion. Il n'est pas vérifié par SMS. |
| Code secret (6 chiffres), gardé chiffré | Vous connecter. |
| Code de secours, gardé chiffré ; essais de code de secours (numéro, heure, réussi ou non) | Retrouver votre compte si vous oubliez votre code ; bloquer qui essaie de deviner. |
<!-- source: v3/nuage.js signUp() (le numéro sert d'identifiant de connexion : email(t) = '225' + numéro + domaine, et user_metadata.tel) ; schema-2.sql (table secours : hash seulement ; secours_essais : numéro et heure de chaque essai) ; schema-72-secours-essais.sql -->

### 2.2 Votre profil
| Donnée | Pourquoi |
|---|---|
| Prénom, nom, pseudonyme (facultatif) | Vous présenter aux autres membres. |
| Avatar (personnage dessiné, initiales ou photo) | Vous reconnaître. |
| Rôle (acheteur, vendeur, les deux), région, ville | Vous montrer les bonnes annonces ; appliquer la règle « ville seulement ». |
| Présentation, activités, jusqu'à 6 photos d'activité (facultatif) | Présenter votre activité. |
| Structure (coopérative, entreprise…), son nom, son logo, ses justificatifs (facultatif) | Faire reconnaître votre structure par l'équipe. |
<!-- source: supabase/schema-4.sql (table profils : prenom, nom, pseudo, avatar, role, region_slug, ville, nom_public) ; schema-12-stock-alertes-profil.sql (bio, activites, photos ≤ 6 ; stockage « activites » public) ; schema-23-structures.sql (structure_type, structure_nom, structure_logo, structure_preuves) ; schema-5.sql (stockage « avatars » public) -->

### 2.3 La vérification d'identité (facultative)
| Donnée | Pourquoi |
|---|---|
| Photo de la pièce (recto, verso sauf passeport), selfie avec un code écrit à la main | Vérifier que vous êtes bien la personne. |
| Nom, numéro de la pièce, date d'expiration, numéro de téléphone du compte | Retrouver le dossier en cas de fraude ou de plainte. |
| Journal des ouvertures du dossier par l'équipe (qui, quand, pourquoi) | Contrôler l'accès aux dossiers. |

- La bande de lecture automatique de la pièce (MRZ) est **lue dans votre téléphone**, sans envoi à un service extérieur. Le résultat n'est qu'une aide pour l'équipe.
- Les photos sont dans un espace **privé** : seule l'équipe peut les ouvrir, et chaque ouverture est notée avec un motif.
- Ce sont des données sensibles. [À VALIDER PAR LE JURISTE : base légale et formalités pour ces données.]
<!-- source: supabase/schema-13-identite.sql (stockage « identite » privé ; recto.jpg, verso.jpg, selfie.jpg ; défi de 4 chiffres) ; schema-16-identite-conservation.sql (numero, expire_le, tel, table identite_acces avec motif) ; v3/identite.js lignes 4 et 166-168 (Tesseract.js chargé depuis vendor/tesseract, dans le téléphone) -->

### 2.4 Vos annonces, négociations et commandes
| Donnée | Pourquoi |
|---|---|
| Annonces : produit, quantité, unité, prix, ville, région, date | Être trouvé par les autres. |
| Négociations : propositions, prix, quantités, transport, messages | Garder la trace de l'accord pour les deux parties. |
| Commandes : étapes, heures, lieu de livraison, preuves de départ (photos du colis, poids, photo du papier du mot secret), photos d'un refus | Suivre la livraison et régler un désaccord. |
| Annulations, contestations, sanctions, niveaux et avis | Calculer la fiabilité et les badges. |
| Commission calculée (non encaissée) | Préparer le futur paiement ; rien n'est prélevé. |
<!-- source: supabase/schema.sql (offres, demandes) ; schema-3.sql (négociations) ; schema-26-commandes.sql (commandes, commande_etapes) ; schema-90-photos-depart.sql, schema-90b-photo-mot.sql (stockage « preuves » privé) ; schema-84a, 84b, 85a ; schema-30-commissions.sql (encaissement = 'aucun') -->

### 2.5 Vos messages
- Les messages privés entre membres sont gardés **1 an**, puis effacés automatiquement.
- **Un numéro de téléphone écrit dans un message est masqué.** Une tentative de donner un numéro, un lien ou une autre messagerie crée une **alerte pour l'équipe**, avec un extrait du message.
- **L'équipe du Marché de Gros peut techniquement lire toutes les conversations.** Règle proposée : elle ne les lit qu'en cas de **litige**, de **signalement** ou d'**alerte** de sortie de l'application. [DÉCISION DU PROPRIÉTAIRE] [À VALIDER PAR LE JURISTE]
- Pendant un litige, l'équipe lit la négociation, les messages, les photos et le mot secret pour juger.
<!-- source: supabase/schema-60-echanges-visibles.sql dm_duree() = 365 jours ; schema-8-effacement.sql dm_purger() + tâche mdg-effacer-messages (toutes les heures) ; schema-10-admin-messages.sql sortie_motif(), table alertes (extrait), admin_discussions() et admin_dm() (lecture de toutes les conversations par un admin, sans condition) ; v3/aide.js « C'est quoi, la discussion à trois ? » -->

### 2.6 Les signalements
Quand vous signalez quelqu'un : le motif, votre précision, d'où vient le signalement. **La personne signalée ne sait pas qui l'a signalée.** Des photos de preuve peuvent être jointes ; seule l'équipe les voit.
<!-- source: supabase/schema-15-signalements-purge.sql (signalements_membres : auteur, cible, motif, detail, source) ; schema-18-signalements-preuves.sql (stockage « preuves » privé, lecture admin seulement) -->

### 2.7 Votre position (GPS)
La position n'est jamais prise sans votre geste :
- **Sur la carte**, le bouton « me localiser » sert à trouver votre région. Si vous tracez un trajet, votre point de départ et d'arrivée sont envoyés à un **service public de calcul d'itinéraire (OSRM)**, hors du Marché de Gros. [À VALIDER : garder ce service ou le remplacer.]
- **Dans une commande**, vous pouvez joindre votre position à une étape (chargement, arrivée, réception). Elle est notée dans le journal de la commande.
- **Le chauffeur** peut partager sa position pendant le transport, seulement quand l'application est ouverte. Une position est gardée toutes les 15 secondes au plus. Ces positions sont **effacées 30 jours après la fin de la commande**.
<!-- source: app/carte-gl.js lignes 326-357 (navigator.geolocation, appel router.project-osrm.org) ; application.dc.html locate() ; v3/commandes.js position() et commande_avancer (p_lat, p_lon) ; v3/chauffeur.js chauffeur_position ; supabase/schema-29-gps.sql (table positions, 15 s, effacement à 30 jours, tâche mdg-purger-positions) -->

### 2.8 Les notifications
- Si vous les activez sur votre téléphone : l'adresse technique d'envoi fournie par votre navigateur, ses clés, le type d'appareil.
- Un **journal des notifications** : type, titre, texte, heure d'envoi, ouverte ou non. Il sert à respecter le plafond (8 par jour au plus pour les messages commerciaux) et à mesurer si elles servent.
- Elles passent par le service de notification de votre téléphone (celui de votre navigateur).
<!-- source: supabase/schema-6.sql (push_abonnements : endpoint, p256dh, auth, appareil) ; schema-88a-notifications-base.sql (notif_journal) ; schema-91-notif-commerciales.sql ; supabase/functions/pousser/index.ts (web-push, clés VAPID dans le coffre Supabase) -->

### 2.9 Les mesures de visite
Nous comptons les visites et les clics : la page, le bouton, la provenance (lien de campagne), ordinateur ou téléphone, la date. **Aucune donnée personnelle** : ni adresse IP, ni compte, ni numéro, ni identifiant d'appareil.
<!-- source: supabase/schema-81-mesures.sql (site_mesures, « AUCUNE donnée personnelle ») -->

### 2.10 Sur votre téléphone
L'application garde sur votre téléphone : vos annonces en attente d'envoi, vos réglages, et une copie des annonces des autres pour fonctionner sans connexion. Vous pouvez l'effacer en vidant les données du navigateur.
<!-- source: v3/compte.js securite(), texte « Ce que nous gardons » ; sw.js (cache hors ligne) -->

## 3. Qui voit quoi

| Qui | Ce qu'il voit |
|---|---|
| **Tout le monde, même sans compte** | Vos annonces actives (produit, quantité, prix, ville, région) avec votre **nom public** ; votre profil public (présentation, photos d'activité, totaux de ventes, fiabilité). Le site public montre seulement le **prénom et l'initiale**, la ville, le produit, la quantité, le prix. |
| **Les membres connectés** | En plus : l'heure de votre dernière activité. |
| **L'autre partie d'une négociation ou d'une commande** | Vos propositions, vos messages, les étapes de la commande, les photos du colis. |
| **L'équipe du Marché de Gros** | Tout ce qui est utile à la modération : profils, numéros, dossiers d'identité (chaque ouverture notée), conversations, alertes, signalements, commandes, photo du papier du mot secret. |
| **Personne d'autre** | Votre numéro n'est **jamais** affiché aux autres membres. |

- **Nom public** : votre pseudonyme s'il existe ; sinon votre prénom et l'initiale du nom (« Awa K. »). Votre nom de famille entier n'est montré que si vous l'activez (Réglages → Montrer mon nom de famille).
- MGCI ne vend pas vos données. [À VALIDER : à confirmer comme engagement.]
<!-- source: supabase/schema.sql politique « offres lisibles par tous » (anon) ; schema-56-nom-du-compte.sql ; schema-4.sql profils_publics() (pseudo, sinon prénom + initiale sauf nom_public) ; schema-80-fil-public.sql (prénom + initiale, ville, produit, quantité, prix ; jamais de numéro) ; schema-78-activite-membres.sql (heure d'activité réservée aux connectés) ; schema-9-lieu-contact.sql (phone effacé des annonces) ; RLS des tables -->
Note pour la relecture : l'audit du 24/10/2026 signale que `profil_public` montre à un visiteur sans compte un historique commercial (produits, volumes, villes, dates). La décision 43 prévoit « les totaux, pas le détail ». Vérifier avant publication que seuls les totaux sont visibles. [À VÉRIFIER AVANT PUBLICATION]

## 4. Combien de temps nous gardons vos données

| Donnée | Durée |
|---|---|
| Messages privés | 1 an, puis effacés automatiquement. |
| Positions du chauffeur pendant le transport | 30 jours après la fin de la commande. |
| Dossier d'identité envoyé (photos, nom, numéro de pièce, téléphone) | Tant que le compte existe, puis **5 ans après la suppression du compte**. Un dossier refusé, remplacé ou retiré : 5 ans après cette date. Ensuite, effacé automatiquement. |
| Brouillon de dossier d'identité jamais envoyé | 30 jours, ou dès que vous le retirez. |
| Profil | Effacé quand vous supprimez votre compte (prénom, nom, pseudo, avatar, rôle, région, ville). |
| Accords, commandes, messages de négociation | Gardés pour la trace des échanges, même après suppression du compte. [DÉCISION DU PROPRIÉTAIRE : durée.] |
| Numéro de téléphone après suppression du compte | Le compte de connexion reste bloqué avec le numéro. [DÉCISION DU PROPRIÉTAIRE : durée.] |
| Journal des notifications | [DÉCISION DU PROPRIÉTAIRE] Proposition : 90 jours (à effacer seulement avec l'accord du propriétaire). |
| Signalements, alertes, sanctions, annulations | [DÉCISION DU PROPRIÉTAIRE] |
| Photos de profil, d'activité, de structure, de preuve (colis, refus, signalement) | [DÉCISION DU PROPRIÉTAIRE] |
| Mesures de visite (sans donnée personnelle) | [DÉCISION DU PROPRIÉTAIRE] |
<!-- source: schema-60 dm_duree() = 365 jours ; schema-29-gps.sql (30 jours) ; schema-16-identite-conservation.sql (5 ans ; brouillon 30 jours) ; schema-4.sql supprimer_compte() ; CLAUDE.md « Effacer le journal après 90 jours : seulement avec l'accord du propriétaire » -->

## 5. Vos droits

Vous pouvez :
- **voir** vos données : la plupart sont dans Mon compte ; pour le reste, écrivez au Marché de Gros ;
- **corriger** votre profil vous-même (Mon compte → Profil et avatar) ;
- **supprimer** votre compte vous-même (Mon compte → Sécurité et compte) ;
- **vous opposer** aux notifications : Réglages → Désactiver, ou dans les réglages du téléphone ;
- **demander** l'effacement d'une donnée, sauf ce que nous devons garder (dossier d'identité pendant 5 ans, trace des commandes).

Pour exercer un droit : Messages → « Écrire au Marché de Gros », ou [À REMPLIR : autre contact].
Délai de réponse : [DÉCISION DU PROPRIÉTAIRE] [À VALIDER PAR LE JURISTE].
Vous pouvez aussi vous adresser à l'**ARTCI** (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire). [À VALIDER PAR LE JURISTE : voie de recours exacte.]
<!-- source: v3/compte.js (réglages, sécurité, suppression) ; CLAUDE.md « le seul choix est Activer/Désactiver sur le téléphone » -->

## 6. Où sont vos données (hébergement)

| Service | Ce qu'il fait | Données |
|---|---|---|
| **Supabase** | Base de données, comptes, fichiers (photos), tâches automatiques, envoi des notifications | Toutes les données du compte. Région du serveur : [À VÉRIFIER dans le tableau de bord Supabase]. |
| **GitHub Pages** | Héberge les pages de l'application et du site (`stan77i.github.io/marchedegrosci`) | Aucune donnée de compte ; le service reçoit l'adresse IP des visiteurs, comme tout hébergeur. |
| **OpenFreeMap** et **Amazon S3** (relief) | Fonds de carte | Le téléphone demande les morceaux de carte affichés. |
| **OSRM** (serveur public de démonstration) | Trajet par la route sur la carte | Les deux points du trajet (voir 2.7). |
| **openrouteservice** | Calcul de l'itinéraire d'une commande, par le serveur | Les lieux de départ et de livraison de la commande. |
| Service de notification du navigateur | Achemine les notifications | Titre et texte de la notification. |

Certains de ces services sont hors de Côte d'Ivoire. [À VALIDER PAR LE JURISTE : règles du transfert de données hors du pays.]
<!-- source: ARCHITECTURE.md lignes 30 et 89 (GitHub Pages + Supabase) ; v3/boutique.js SITE = stan77i.github.io ; app/carte-gl.js (tiles.openfreemap.org, s3.amazonaws.com/elevation-tiles-prod, router.project-osrm.org) ; v3/suivi.js (openfreemap) ; supabase/functions/itineraire/index.ts (api.openrouteservice.org) ; supabase/functions/pousser/index.ts (web-push) ; police Jost hébergée dans le dépôt (ARCHITECTURE.md ligne 263) ; aucun outil de suivi publicitaire trouvé (recherche googletagmanager, google-analytics, facebook.net : aucun résultat) -->

## 7. Sécurité

- Chaque table est protégée : un membre ne peut lire ou changer que ce qui le concerne.
- Les photos d'identité et de preuve sont dans des espaces privés.
- Les codes secrets sont gardés chiffrés.
- Aucune clé secrète n'est dans l'application.
Aucun système n'est parfait. En cas de fuite de données, nous vous préviendrons. [À VALIDER PAR LE JURISTE : obligation et délai de notification.]
<!-- source: audit 24/10/2026 (« 72/72 tables ont la protection par ligne (RLS) ») ; schema-13 et schema-18 (stockages privés) ; CLAUDE.md « Ne révèle jamais de clé secrète » -->

## 8. Loi applicable et formalités

- Loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel. [À VALIDER PAR LE JURISTE : date et intitulé exacts.]
- Autorité de contrôle : l'**ARTCI**.
- **La déclaration ou la demande d'autorisation auprès de l'ARTCI est à vérifier avec le juriste.** Rien n'indique dans le dépôt qu'elle a été faite. Le traitement des pièces d'identité gardées 5 ans est le point le plus sensible.
<!-- source: MISE-A-JOUR.md ligne 188 (« Déclarer ce traitement à l'ARTCI… Un juriste peut confirmer la formalité exacte ») ; audit 24/10/2026 partie 7 -->

## 9. Changements

Nous vous préviendrons dans l'application avant tout changement important de cette politique. [À VALIDER]
