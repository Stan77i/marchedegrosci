# Fonctionnalités du Marché de Gros de Côte d'Ivoire

Date de l'inventaire : **24/10/2026**.

Ce document dit ce qui existe **vraiment** aujourd'hui dans le code et dans la base. Chaque ligne renvoie à ses fichiers, à ses tables et à ses fonctions SQL.

Comment il a été fait :

- lecture du code de la branche `main` (application, ancien site, nouveau site, fichiers `supabase/schema-*.sql`, fonctions Edge) ;
- lecture **seule** de la base de production : catalogue (fonctions, politiques RLS, déclencheurs, tâches planifiées) et nombres de lignes. Aucune donnée personnelle n'a été lue ;
- aucun test n'a été relancé dans un navigateur pendant cet inventaire.

Ce qui est prévu mais pas encore fait est dans `ROADMAP.md`. L'organisation technique est dans `ARCHITECTURE.md`.

## Légende des états

| État | Sens |
|---|---|
| **opérationnelle** | Le code est complet et branché. Quand rien ne prouve un usage réel, c'est écrit : « non testée en vrai ». |
| **partielle** | Une partie existe. Ce qui manque est écrit dans la ligne. |
| **prévue, non implémentée** | L'idée est notée (docs, écran « bientôt »), mais le code n'existe pas. |
| **défectueuse** | Un défaut a été constaté à la lecture du code. Il est décrit dans la ligne. |

Rappels importants :

- **Aucun paiement ne passe par l'application.** Aucun prestataire (Wave, Orange Money, MTN MoMo) n'est intégré. Les commissions sont un **registre** : rien n'est encaissé. Le séquestre est une mécanique prête côté base, sans partenaire financier.
- **Le numéro de téléphone n'est pas vérifié** à l'inscription (pas de SMS ni de WhatsApp : c'est payant).
- La base de production contient très peu d'activité réelle (comptages du 24/10/2026, voir chaque module). Beaucoup de fonctions n'ont donc **jamais servi en conditions réelles**.

## Sommaire

- [Partie 1. L'application](#partie-1-lapplication)
  - [Module A. Compte, identité, profil, sécurité](#module-a-compte-identité-profil-sécurité)
  - [Module B. Marché : annonces, recherche, carte, prix, alertes](#module-b-marché--annonces-recherche-carte-prix-alertes)
  - [Module C. Commande : négociation, messages, commandes, transport, argent, litiges, avis](#module-c-commande--négociation-messages-commandes-transport-argent-litiges-avis)
  - [Module D. Notifications, accueil, aide, réglages, hors ligne, administration](#module-d-notifications-accueil-aide-réglages-hors-ligne-administration)
- [Partie 2. Le site web](#partie-2-le-site-web)
- [Récapitulatif par état](#récapitulatif-par-état)
- [Écarts trouvés entre les docs et le code](#écarts-trouvés-entre-les-docs-et-le-code)

---

# Partie 1. L'application

L'application est la priorité. C'est `application.dc.html` (écrans en gabarits « sc »), avec les modules `app/*.js` et `v3/*.js`. Le tableau de bord de l'équipe est `admin.html`.

Plusieurs modules `v3/` sont **communs** à l'application et à l'ancien site `index-v3.html` : `v3/nuage.js`, `v3/compte.js`, `v3/identite.js`, `v3/avatar.js`, `v3/personnages.js`, `v3/reputation.js`, `v3/statuts.js`, `v3/porte.js`, `v3/negoce.js`, `v3/messages.js`. Les commandes, le chauffeur, le suivi, Racheter, l'approvisionnement pro et les achats groupés n'existent **que dans l'application**.

## Module A. Compte, identité, profil, sécurité

Activité en production (24/10/2026) : 4 comptes, 3 profils, 3 codes de secours, 1 administrateur, 1 dossier d'identité resté en brouillon, 0 identité vérifiée, 0 compte supprimé, 0 banni, 0 signalement de membre, 0 blocage, 0 dossier de structure.

### A1. Connexion et création de compte

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Créer un compte (numéro + code secret de 6 chiffres) | opérationnelle | Prénom, nom (facultatif), pseudonyme (facultatif, unicité vérifiée en direct), numéro à 10 chiffres, code à 6 chiffres. Les codes trop simples (123456, 654321, 6 fois le même chiffre) sont refusés. Le compte Supabase Auth utilise une adresse construite à partir du numéro : aucun e-mail n'est envoyé. | `v3/nuage.js` `signUp` (l. 64), formulaire l. 417-536 | Supabase Auth ; `pseudo_libre` (schéma 4) | **Le numéro n'est pas vérifié.** N'importe qui peut ouvrir un compte avec le numéro d'un autre. Bloqué par le budget (SMS ou WhatsApp payants). |
| Se connecter | opérationnelle | Numéro + code. Session gardée sur l'appareil et renouvelée seule. | `v3/nuage.js` `signIn` (l. 58), `token` | Supabase Auth | La limite de 20 connexions par 5 min et par adresse est un réglage Supabase (non lisible en SQL, non revérifié ici). Anti-robot Turnstile : non installé (décision en attente). |
| Porte d'entrée animée | opérationnelle | Scène dessinée derrière la connexion. Aucune donnée affichée. Titre : « marché de Gros » passe à « marché du pays » 3 s après l'apparition, 2 s, puis revient ; toutes les 10 s. | `v3/porte.js`, `v3/nuage.js` (`.ng-tt-pile`) | aucune | |
| Bienvenue après l'inscription (avatar, rôle et lieu, structure) | opérationnelle | Étapes courtes ; les deux dernières peuvent attendre (« Plus tard »). | `v3/compte.js` `bienvenue` (l. 1009) | `profils` | |
| Se déconnecter (cet appareil) | opérationnelle | | `v3/compte.js` `deconnecter` (l. 863) | Supabase Auth | |
| Déconnecter tous mes appareils | opérationnelle | Appel `/auth/v1/logout?scope=global`. | `v3/compte.js` page Sécurité (l. 858) | Supabase Auth | Non testée en vrai. Une erreur éventuelle est ignorée sans message. |
| Changer de numéro | prévue, non implémentée | L'écran dit « écrivez au Marché de Gros ». | `v3/compte.js` l. 834 | aucune | Aucune fonction ni écran pour le faire. |

### A2. Code secret et code de secours

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Code de secours (12 caractères) remis à l'inscription | opérationnelle | Créé juste après l'inscription, montré une seule fois, avec « J'ai noté ». Gardé chiffré (bcrypt). | `v3/nuage.js` `signUp` l. 72, `showSecours` (l. 400) | table `secours` (RLS sans politique : illisible) ; `creer_secours`, `a_secours` (schéma 2) | Si l'appel échoue à l'inscription, le compte n'a pas de code : le menu le signale ensuite (`a_secours`, l. 557). |
| Code secret oublié : en choisir un nouveau avec le code de secours | opérationnelle | Donne un nouveau code de secours puis connecte. Limites : 5 échecs par numéro et par heure, 20 par adresse internet, 300 au total. Même temps de réponse que le numéro existe ou non. | `v3/nuage.js` `recover` (l. 75-84) | `secours_reinitialiser` (schéma 72, seule porte ouverte), `reinitialiser_code` (schéma 2, fermée aux téléphones), tables `secours_essais`, `secours_ip_essais` | Non testée en vrai (0 essai enregistré en production). |
| Recréer un code de secours | opérationnelle | Page Sécurité ; l'ancien ne marche plus. | `v3/compte.js` l. 856 | `creer_secours` | |
| Changer mon code secret | opérationnelle | Demande le code actuel, refuse les codes faciles. | `v3/compte.js` page Sécurité (l. 842-854) | Supabase Auth `PUT /auth/v1/user` | |
| L'administrateur remet un nouveau code à un membre | opérationnelle | Remplace le code et ferme les connexions ouvertes. | `v3/admin.js` l. 627 | `admin_reinitialiser` (`supabase/a-lancer-dans-sql-editor.sql`, présente en production) | Non testée en vrai. Aucune preuve de l'identité de la personne qui demande : l'équipe doit vérifier elle-même. |
| Rappel du code de secours en notification | prévue, non implémentée | Notée « en attente » dans `CLAUDE.md`. | aucun | aucune | |

### A3. Profil

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Mon compte (accueil, profil, activité, notifications, réglages, sécurité) | opérationnelle | Fenêtre à pages. En-tête : avatar, nom, rôle, lieu, état de l'identité. | `v3/compte.js` `ouvrir` (l. 403) | `profils` | |
| Modifier prénom, nom, pseudonyme, rôle, région et ville | opérationnelle | Contrôles de format dans la base (lettres, pseudonyme de 3 à 24 caractères, unique). | `v3/compte.js` `enregistrer` (l. 31), page Profil (l. 743-776) | `profils` (RLS : voir, créer, modifier le sien) ; déclencheurs `profil_maj`, `profils_garde_textes`, `profils_nom_annonces` (schéma 56 : le nom des annonces suit le profil) | |
| Nom affiché (prénom + initiale, nom entier ou pseudonyme) | opérationnelle | Réglage « Montrer mon nom de famille ». | `v3/compte.js` `nomAffiche` (l. 24), l. 817-827 | colonne `nom_public` ; `profils_publics2` | |
| Pas de lien, numéro, réseau social, e-mail ni code dans les textes du profil | opérationnelle | Refus sur le téléphone et dans la base. L'administrateur n'est pas filtré sur le téléphone. | `v3/nuage.js` `texteRefus` (l. 637) | `texte_refus`, `garde_textes` (schéma 22) | |
| Profil public (présentation, activités, jusqu'à 6 photos, lieux, volumes, historique) | opérationnelle | Ouvert depuis une annonce ou « Mon profil public ». Seules les photos du membre, dans le stockage de l'application, sont acceptées. | `v3/reputation.js` `profil` (l. 211), édition l. 268-290 | `profil_public` (schémas 12, 78), bucket `activites` (public), déclencheur `profils_photos_propres` (schéma 74) | Les volumes viennent des négociations conclues, pas des commandes. |
| Profils des autres en petit (nom + avatar) | opérationnelle | Lecture groupée, gardée 10 min sur l'appareil. | `v3/compte.js` `avatar` / `lot` (l. 50-69) | `profils_publics3` (repli `profils_publics2`, `profils_publics`) | |
| Compte officiel « Marché de Gros » | opérationnelle | Le compte administrateur parle au nom du Marché de Gros : logo à la place de l'avatar, pas d'étoiles. | `v3/compte.js` l. 52, `v3/statuts.js` `estOfficiel` (l. 47) | `officiels`, `annonce_officielle` (schéma 20) | |

### A4. Structure représentée (coopérative, groupement, entreprise, marché)

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Déclarer sa structure (nom, logo, jusqu'à 4 preuves) | opérationnelle | Puce « Coopérative · Nom » sur les annonces et les messages. | `v3/compte.js` `formStructure` (l. 515), `puceStructure` | colonnes `structure_*` de `profils` ; déclencheur `structure_propre` ; `structure_publique` (schéma 23) ; bucket `activites` | Déclaratif tant que l'équipe n'a pas vérifié. Non testée en vrai. |
| Badge « Coopérative vérifiée » / « Marché vérifié » | opérationnelle | Le membre envoie un dossier (fonction + 1 à 3 photos de document) ; l'équipe décide. | `v3/compte.js` `badgeStructure` (l. 563) ; admin : `v3/admin-transport.js` | table `structure_verifs` (RLS sans politique) ; `structure_dossier_envoyer`, `structure_dossier_moi`, `structure_dossier_retirer`, `admin_structures`, `admin_structure_decider`, `_structure_verifiee` (schéma 39) | Seulement pour les types coopérative et marché. 0 dossier : non testée en vrai. |

### A5. Avatars

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Personnages du marché (produits avec un visage) | opérationnelle | 21 produits, nombreux réglages, dé pour tirer au hasard. Au repos ils respirent et clignent ; ils sautent seulement quand il y a du nouveau. Mouvement réduit respecté. | `v3/personnages.js`, `v3/avatar.js`, `v3/compte.js` `choisirAvatar` (l. 879) | colonne `profils.avatar` (code « mg:… ») | |
| Portrait dessiné (ancien modèle) et initiales | opérationnelle | Les anciens portraits restent lisibles ; les initiales servent par défaut. | `v3/avatar.js` | `profils.avatar` (« v1:… », « ini:… ») | Le portrait n'est plus proposé aux nouveaux membres. |
| Photo de profil | opérationnelle | Recadrée dans le téléphone, envoyée en `avatars/<id>.jpg` (384 px, JPEG). | `v3/compte.js` `finir` (l. 991) | bucket `avatars` (public, 300 Ko, politiques « la mienne ») (schéma 5) | Non testée en vrai (aucun profil n'a de photo). Pas de contrôle de ce que montre la photo. |

### A6. Vérification d'identité

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Envoyer un dossier (pièce recto et verso, selfie avec un code écrit à la main, nom) | opérationnelle | Pièces : CNI, passeport, carte consulaire, permis. Photos dans un stockage privé. | `v3/identite.js` `parcours` (l. 455), `ouvrir` (l. 297) | table `verifications` (RLS sans politique) ; `identite_commencer`, `identite_soumettre`, `identite_retirer`, `identite_statut` (schémas 13, 16, 21) ; bucket `identite` (privé, lecture admin seulement) | 1 seul dossier en production, resté en brouillon : **aucune vérification menée jusqu'au bout en vrai**. |
| Lecture automatique de la bande MRZ | partielle | Tesseract.js, dans le téléphone (`vendor/tesseract/`). Pré-remplit le nom ; simple indice pour l'équipe. | `v3/identite.js` `lireMRZ` (l. 176), `analyserMRZ` (l. 153) | paramètres `p_nom_lu`, `p_mrz_ok` de `identite_soumettre` | Seulement la langue « eng ». Fiabilité non mesurée sur de vraies pièces ivoiriennes. |
| Décision de l'équipe (vérifié, refusé avec motif et date du prochain essai, photos à refaire) | opérationnelle | Onglet Identités de l'administration, comparaison du nom, journal des accès aux dossiers. | `v3/admin.js` (l. 262 et suivantes) | `admin_identite_dossiers`, `admin_identite_ouvrir`, `admin_identite_examen`, `admin_identite_decider`, `admin_identite_registre`, `admin_identite_acces`, `admin_identite_sans_fin`, `identite_nom_concorde` ; table `identite_acces` | Non testée en vrai. Rien n'est déclaré « vérifié » automatiquement (voulu). |
| Badge « Identité vérifiée » | opérationnelle | Sceau vert, lisible sans compte. Retiré quand la pièce expire. | `v3/identite.js` `badge`, `estVerifie` (l. 26) | `identite_verifiee`, `identite_ok` | Aucun membre vérifié à ce jour. |
| 3 annonces gratuites, puis identité exigée | opérationnelle | La base refuse la 4e annonce sans identité vérifiée (`VERIFICATION_REQUISE`) ; l'annonce reste sur le téléphone. Un compte banni est refusé (`COMPTE_BANNI`). | `v3/identite.js` `inviter` (l. 403), `gratuitesRestantes` ; `v3/nuage.js` `refuse()` | `annonces_gratuites` (renvoie 3), `garde_publication`, table `annonces_publiees` (schéma 14), `identite_ok`, `est_banni` | |
| Conservation 5 ans et effacement des photos | partielle | Brouillons abandonnés (30 jours) et dossiers en fin de conservation effacés. | `v3/admin.js` `purger` (l. 79) | `admin_identite_a_purger`, `admin_identite_purger`, `identite_compte_supprime` | L'effacement ne se fait **que quand un administrateur ouvre le tableau de bord**. Aucune tâche planifiée ne le fait. |
| Notifications à l'équipe (dossier reçu, résumé du matin) | opérationnelle | Chaque dossier prévient l'équipe ; chaque jour à 7 h 45, un résumé des dossiers en attente. | `supabase/functions/pousser/index.ts` (cas 6) | `push_identite` (déclencheur `verifications_push`), `push_resume_identites`, tâche pg_cron `mdg-identites-matin` (active) | |
| Rappel « ne payez jamais d'avance » | opérationnelle | Texte affiché dans les discussions quand l'autre n'est pas vérifié. | `v3/identite.js` `gardePaiement` | aucune | |

### A7. Modération et protection

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Signaler une annonce (avec raison) | opérationnelle | 6 raisons ; les autres voient le nombre et les raisons. L'auteur du signalement est fixé par la base. | `v3/reputation.js` `signaler` (l. 128) ; bouton sur la carte d'annonce (`application.dc.html` `card()`) | table `signalements` (RLS : insérer ; admin lit et supprime) ; déclencheur `signalement_moderation` ; `signalements_publics` (schémas 1, 7, 66) | |
| Signaler une personne (avec ou sans preuve) | opérationnelle | Motif de 15 caractères au moins, jusqu'à 3 photos, ou la discussion jointe. Sans preuve, il faut plusieurs signalements. | `v3/identite.js` `signaler` (l. 329) | table `signalements_membres` ; `signaler_membre` ; bucket `preuves` (privé) (schémas 15, 18) ; côté admin : `admin_signalements_comptes`, `admin_signalements_membres`, `admin_signalement_membre_traite`, `admin_signalements_cible_traites` | 0 signalement : non testée en vrai. |
| Bloquer / débloquer une personne | opérationnelle | Depuis une discussion directe ; plus de messages entre les deux. | `v3/messages.js` `bloquer` (l. 335) | table `blocages` ; `dm_bloquer`, `dm_bloque` (schéma 8) | Pas de liste « mes personnes bloquées » dans Mon compte. 0 blocage : non testée en vrai. |
| Bannir à vie / lever le bannissement | opérationnelle | Annonces masquées, dossiers d'identité en cours retirés ; la base refuse annonces, négociations, messages et vérifications. Un administrateur ne peut pas être banni. | `v3/admin.js` ; `v3/identite.js` `etat` (statut « banni ») | table `bannis` ; `admin_bannir`, `admin_lever_bannissement`, `est_banni`, `garde_banni` (déclencheurs sur `negociations`, `messages`, `dm`, `verifications`) (schéma 14) | 0 banni : non testée en vrai. Un banni peut ouvrir un autre compte avec un autre numéro (le numéro n'est pas vérifié). |
| Accès administrateur | opérationnelle | Lien « Tableau de bord » visible seulement si le serveur répond `est_admin`. | `v3/nuage.js` `isAdmin` (l. 85) ; `admin.html`, `v3/admin.js` l. 47 | table `admins` ; `est_admin`, `est_admin_id` | |

### A8. Données personnelles et suppression du compte

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| « Ce que nous gardons et pourquoi » | opérationnelle | Texte d'information dans Sécurité. | `v3/compte.js` l. 840 | aucune | |
| Supprimer mon compte | partielle | Confirmation par le code secret. Annonces retirées (ce qui ferme les négociations, déclencheur `offres_nego` / `demandes_nego`, fonction `nego_annonce_retiree`), prénom, nom, pseudonyme, avatar, rôle et lieu vidés, code de secours effacé, connexion bloquée à vie. Les autres voient « Compte supprimé ». Le dossier d'identité est gardé 5 ans. | `v3/compte.js` `supprimer` (l. 864) | `supprimer_compte` (schéma 4), déclencheur `identite_compte_supprime` | L'écran promet « votre profil est effacé », mais `supprimer_compte` **ne vide pas** `bio`, `activites`, `photos` ni les colonnes `structure_*`. Il n'efface ni la photo `avatars/<id>.jpg` ni les images du bucket `activites`. Ces données ne sont plus montrées au public (fonctions publiques filtrées sur `supprime_le`) mais restent stockées. Le compte Auth est bloqué, pas supprimé. Jamais utilisée en vrai. |

### A9. Préférences liées au compte

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Messages à l'écran, sons, notifications du téléphone | opérationnelle | Réglages gardés sur l'appareil ; carte des notifications avec l'état réel. | `v3/compte.js` page Réglages (l. 815-830), `cartePousse` (l. 608) ; `v3/sons.js`, `v3/pousse.js` | `push_abonnements` | Réglages locaux : ils ne suivent pas le compte sur un autre téléphone. |

## Module B. Marché : annonces, recherche, carte, prix, alertes

Activité en production (24/10/2026) : 4 offres (4 actives), 3 demandes (1 active), 0 alerte produit, 0 zone de forte demande.

### B1. Publier et gérer ses annonces

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Publier une offre « J'ai » (3 étapes) | partielle | Étape 1 : produit, photo, quantité, unité, « vendu à partir de ». Étape 2 : prix (facultatif), « négociable » ou « ferme », région, ville, date, transport. Étape 3 : nom affiché, puis publication. Aperçu « Ce que l'acheteur verra ». Brouillon gardé sur le téléphone. | `application.dc.html` (écran `data-pg="vendre"` l. 334 ; `vNext` ; `pubOffer()` l. 1210) ; `v3/nuage.js` (`sync()`, `toRow.offres`) | `offres` ; déclencheurs `offres_garde` (`garde_publication`), `offres_limite` (`limite_annonces`), `offres_garde_textes` (`garde_textes`), `offres_nom_compte` (`annonce_nom_compte`), `offres_sans_numero` (`sans_numero_public`), `offres_officielle`, `offres_maj_le` (`annonce_maj_le`), `offres_nego` (`nego_annonce_retiree`), `offres_stock_garde` (`_stock_garde`), `offres_push_annonce` | La publication marche (4 offres en base). **La photo de l'offre reste sur le téléphone** : `toRow.offres` ne l'envoie pas et la table `offres` n'a pas de colonne photo. Les autres voient l'image du produit à la place. |
| Publier une demande « Je cherche » | opérationnelle | Quoi, combien, où, quand, transport, budget (facultatif), exigences (cases, détails, texte libre de 300 caractères). Les offres existantes du produit s'affichent pendant la saisie. | `application.dc.html` (écran `demande` l. 391 ; `dPublish` ; `pubDemand()` l. 1220) ; `v3/nuage.js` | `demandes` ; mêmes déclencheurs `demandes_*` + `demandes_exigences` (`demande_exigences`) | Non testée en vrai pour le formulaire complet. |
| « Ville seulement » (vendre ou acheter uniquement dans sa ville) | opérationnelle (projet de test) | Sous la ville, un interrupteur « Je vends uniquement à Guiglo » / « J'achète uniquement à Abidjan » (désactivé sans ville, libellé qui suit la ville). Partout où l'annonce apparaît : une pastille courte « [épingle] Guiglo uniquement » (une ligne, 168 px au plus, le nom de la ville coupé par « … », « uniquement » toujours entier) ; la phrase complète pour les lecteurs d'écran, dans la carte de la carte du réseau, avant de négocier ou d'écrire, à la commande (ville imposée). Changeable dans Mes publications. | `app/ville-seule.js` ; `application.dc.html` (`vsEl`, `vsSw`, `pubOffer`, `pubDemand`, `trBloc`) ; `v3/nuage.js` (`vsRow`) ; `v3/negoce.js`, `v3/messages.js`, `v3/commandes.js` ; `app/carte-gl.js` ; `site/site.js`, `site/carte.js` ; `v3/match.js` | `offres.ville_seulement`, `demandes.ville_seulement` ; `_ville_seulement_refus`, `_ville_nom`, `commande_creer2`, `commande_creer`, `fil_public2` (schéma 87) | Pas encore en production : appliquer le schéma 87 **avant** de fusionner le front. Une offre « ville seulement » n'a plus « inclus hors de ma ville » (le transport devient « non inclus »). |
| Feuille rapide J'ai / Je cherche | opérationnelle | Petit formulaire (quantité, région, prix ou budget, délai) sans quitter l'écran. | `application.dc.html` (`mPublish`, `openSheet()`) | `offres`, `demandes` | |
| Publication d'abord sur le téléphone, puis envoi | opérationnelle | L'annonce est écrite sur le téléphone (`mdg-v2:offres` / `mdg-v2:demandes`). Sans compte, la connexion s'ouvre. Avec un compte, `sync()` l'envoie (insertion ou mise à jour sur `user_id, client_id`). | `app/marche-app.js` (`A.write`) ; `v3/nuage.js` (`onLocalChange`, `sync`, `waiting`) | `offres`, `demandes` (RLS « publier » : `user_id = auth.uid()` et `status = 'active'`) | Le message « Votre offre est en ligne » s'affiche dès l'écriture locale, avant l'envoi. Sans compte ou sans réseau, personne d'autre ne la voit encore. |
| 30 annonces actives au plus | défectueuse | La base refuse une 31e offre ou demande active (« Limite atteinte »). | `application.dc.html` (`pubOffer` l. 1216, `pubDemand` l. 1228) ; `v3/nuage.js` `sync()` (l. 206-238) | `limite_annonces()` ; `garde_publication()` | **Défaut constaté à la lecture, non reproduit** : le téléphone ne garde que 30 annonces par sens (`.slice(0, 30)`). La 31e efface la plus ancienne du téléphone. Au `sync()` suivant, la boucle « retirer celles supprimées sur le téléphone » envoie un `DELETE` au serveur pour cette annonce (la politique RLS « retirer ses offres » / « retirer ses demandes » l'autorise), même si elle était encore active ou liée à une négociation. Seule une offre liée à un achat groupé est protégée (clé étrangère `groupes_achat` → `offres` en mode « restrict »). |
| Pas de lien, d'e-mail ni de numéro dans une annonce | opérationnelle | Vérifié sur le téléphone avant l'envoi, puis par la base. Le numéro est toujours effacé côté serveur. | `application.dc.html` (`refusTexte()`) ; `v3/nuage.js` (`texteRefus`) | `garde_textes()`, `texte_refus()`, `sans_numero_public()` | L'administrateur n'est pas concerné (voulu). |
| Nom affiché = nom du compte | opérationnelle | L'annonce porte le nom du compte. Pour l'administrateur : « Marché de Gros ». | `application.dc.html` (`nomCompte()`) | `annonce_nom_compte()`, `annonce_officielle()` | |
| Mes publications : stock, épuisé, retirer | opérationnelle | Liste des annonces de ce téléphone, avec le nombre d'annonces compatibles. Changer le stock (0 fait sortir l'offre du marché). Retirer une publication. | `application.dc.html` (écran `pubs` l. 614 ; `myPubs`) ; `v3/nuage.js` (`sync` met `status` à `retiree` ou `active`) | `offres.status`, `offres.quantity` ; RLS « modifier ses offres » (jamais une annonce masquée) | Le stock se change avec la fenêtre `prompt()` du navigateur. |
| Stock qui baisse après un accord | opérationnelle | Après un accord, la base baisse la quantité. Le téléphone reprend la quantité du serveur avant tout envoi. Tout vendu : offre « épuisée », demande « servie ». | `v3/nuage.js` (`stockDuServeur`) | `stock_apres_accord`, `_stock_garde()` (déclencheurs `*_stock_garde`) | Non testée en vrai. |
| Retrouver ses annonces après connexion | opérationnelle | `pullMine()` remet les annonces du compte sur le téléphone. `basculer()` sépare les annonces de deux comptes sur un même téléphone. | `v3/nuage.js` (`apresConnexion`, `pullMine`, `basculer`, `verifier`) | `offres`, `demandes` | |

### B2. Voir le marché

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Lecture des annonces des autres | opérationnelle | Lit les 500 dernières offres et demandes actives, sans compte. Toutes les 2 min (écran visible), un résumé dit d'abord si quelque chose a changé. Copie gardée sur le téléphone. | `v3/nuage.js` (`refresh`, `list`, `fromRow`) | `offres`, `demandes` (RLS « lisibles par tous » : `status = 'active'` ou les siennes) ; `annonces_version()` | Pas de temps réel. Au-delà de 500 annonces actives par sens, les plus anciennes ne sont pas lues. |
| Bandeau « Nouvelle offre / demande » dans l'application | opérationnelle | Quand la relecture trouve une annonce nouvelle d'un autre membre : produit, quantité, lieu, « Voir ». Plusieurs annonces se regroupent. | `v3/nuage.js` (évènement `mdg:nouvelles`) ; `application.dc.html` (`onNeuves()`) ; `app/toast.js` | aucune | Seulement quand l'application est ouverte. |
| Accueil « Marché » : la roue des produits | opérationnelle | Roue par famille, photo du produit. Sous la roue, le « prix du moment » : meilleur prix vendeur, sinon meilleur budget, sinon « Aucun prix publié ». Bulles : moins cher, plus offrant, puis activité (« Très vendu », « Très demandé », « Forte demande », « Négocié en ce moment »). | `application.dc.html` (`renderVals` partie roue, `prixMoment()`, `prixBulle()`, `tendMsg()`, `tendVeille()`) | `produits_activite()` | Peu de données réelles : la plupart des produits affichent « Aucun prix publié ». |
| « Ici, chacun place son prix » | opérationnelle | Échelle des prix publiés dans la même unité, onglets « Vendeurs » et « Acheteurs », conseil pour passer en tête, puis placer son prix ou négocier. Une démo marquée « pas réels » existe. | `app/prixmoment.js` ; `application.dc.html` (`prixPop()`, `prixListes()`) ; `app/demo-orbite.js` | aucune | |
| Accueil « Dernières annonces » (ventes conclues) | opérationnelle | Produit, quantité, ville, date, sans nom ni montant, visible sans compte. | `application.dc.html` (`ventesCharger()`, `accActOn`) | `ventes_recentes()` (30 jours, 30 au plus) | |
| Écran Acheter : liste, onglets, filtres | opérationnelle | Onglets Offres / Demandes / Tout avec pastilles. Filtres : famille, région, quantité minimale, prix maximal, « vérifiés ». Liste vide : proposition de publier une demande. | `application.dc.html` (écran `acheter` l. 289 ; `aL`, `aSeg`, `famChips`, `aDem`) | `offres`, `demandes` | |
| Carte d'annonce commune | opérationnelle | Produit, quantité, prix ou budget, « négociable » ou « ferme », minimum, exigences, transport, lieu, avatar, statut, structure, étoiles, signalements. Actions : Proposer un prix, Écrire, Acheter à plusieurs, Signaler. | `application.dc.html` (`card()` l. 1158) | `signalements` ; actions vers `v3/negoce.js`, `v3/messages.js`, `v3/groupes.js`, `v3/reputation.js` | |
| Fiche produit | opérationnelle | Offres et demandes du produit, prix vendeur le plus bas, prix observé avec jauge, calendrier de récolte sourcé, bouton d'alerte, partage du lien (`navigator.share`, sinon copie). | `application.dc.html` (`fp`, `market()` l. 1197, `share`, `fAlerte`) ; `A.CAL` dans `app/marche-app.js` | aucune | Le calendrier existe seulement pour les produits de `A.CAL`. |
| Fiche vendeur | partielle | Nom, lieu, mention « agent terrain », bouton « Écrire », liste de ses offres. | `application.dc.html` (écran `vendeur` l. 634 ; `vd` l. 1766) | aucune | Pas de boutique (pas de présentation ni de catalogue propre). L'adresse `#/producteurs/<id>` vient d'une offre : si cette offre n'est plus en mémoire, la page affiche « Vendeur introuvable ». |
| Catégories et « Tous les produits » | opérationnelle | Familles en tuiles, recherche, grille de tous les produits avec le nombre d'offres et de demandes en direct. | `application.dc.html` (écran `categories` l. 456 ; `toutVoir()` l. 1397) ; `v2/data.js` | aucune | |
| L'année du marché | opérationnelle | Cadran des récoltes par mois, un anneau par produit, avec la source de chaque période. | `application.dc.html` (écran `annee` l. 563 ; `anDial()`, `anParProduit()`) ; `A.CAL` | aucune | Seulement les produits sourcés. |

### B3. Prix

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Accueil « Prix » : le tableau du marché | opérationnelle | Onglet « Acheter » : offres du moins cher au plus cher. Onglet « Vendre » : demandes du budget le plus haut au plus bas. À prix égal : transport compris, fiabilité, identité, commandes honorées, date. Même unité seulement, filtre par région, 50 annonces au plus par unité. Relu toutes les 30 s. Aucun numéro affiché. | `v3/tableau.js` (`<mdg-tableau>`, `application.dc.html` l. 188) ; `app/stable.js` | `tableau_produits(p_region)`, `tableau_marche(p_slug, p_region)` (schémas 59 et 70) | Non testée en vrai (peu d'annonces). |
| Page « Prix du marché » | opérationnelle | Pour chaque produit : échelle des prix, verdict « Accord possible » ou « Écart de n % », prix observé ou jauge, encart « Comment lire ces prix ». | `application.dc.html` (écran `prix` l. 512 ; `px`) | aucune | |
| Prix observé du marché | opérationnelle | Fourchette du 10e au 90e centile, seulement avec au moins 5 prix de 3 vendeurs sur 30 jours, dans l'unité la plus fréquente. Avant ce seuil, rien n'est affiché. | `application.dc.html` (`market()`) ; ancien site : `v3/marche.js` (`prix()`) | aucune | Petit écart : l'application arrondit le rang du centile vers le bas (`Math.floor`), l'ancien site au plus proche (`Math.round`). Avec peu de prix, la fourchette peut différer. |
| Prix par zone | opérationnelle | Par district et par unité : prix demandés (médiane, min, max), quantité en vente, budgets, prix des ventes terminées (à partir de 3 ventes de 2 vendeurs), tendance 30 jours, médiane par mois. Rien n'est estimé. | `v3/prixzone.js` ; bouton `r.zones` de la page Prix | `prix_zones(p_produit)` (schéma 31) | Non testée en vrai : presque tout affiche « insuffisant ». |

### B4. Recherche

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Recherche en phrase (écran Acheter) | opérationnelle | Comprend produit (nom local, alias, faute légère), quantité et unité, lieu, intention. Affiche « Compris : … » et des suggestions. | `application.dc.html` (`parsed`, `chipsU`, `sug`) ; `v2/search.js` (`parse`, `suggest`) ; `v2/data.js` | aucune | Un mot non reconnu n'est pas deviné (voulu). Pas de dictée vocale dans l'application. |
| Choisir un produit (liste avec recherche) | opérationnelle | Pour Vendre, Demander ou la carte : liste groupée par famille. | `application.dc.html` (`openPick()` l. 1506, `doPick()` l. 1542) | aucune | |
| Villes et villages | opérationnelle | Choisir une région montre ses villes ; une ville remplit la région. Une ville absente peut être écrite à la main. | `app/villes.js` (`MDGVilles`) ; `application.dc.html` (`cityUI()`, `lieuEl()`) | aucune | Liste partielle (villes principales). |

### B5. Carte du réseau

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Carte en relief (MapLibre) | opérationnelle | Routes, rails, fleuves, lacs et 3 700 localités embarquées. En ligne : relief (Terrarium, AWS Open Data) et rues OpenStreetMap (OpenFreeMap). Annonces en bulles de prix dans la ville déclarée (jamais une adresse), regroupées par district de loin. Calque « chaleur », jour ou nuit, « Me localiser ». | `app/carte-gl.js` (`MDGCarteGL`) ; `vendor/maplibre/` ; `app/geo/ci.json` ; `application.dc.html` (`monterCarte()`, `mapData`) | aucune | Une ville inconnue de `ci.json` est placée de façon approximative (signalé à l'écran). |
| Carte simple de secours | opérationnelle | Sans WebGL ou sur un appareil faible : carte Canvas, chef-lieu du district, cercles de 50, 100 et 200 km. | `app/carte-app.js` (`MDGCarte`) | aucune | |
| Filtres et panneau de la carte | opérationnelle | Tout / Offres / Demandes / « Compatibles », filtre par produit, « Près de vous d'abord », liste, liens entre une offre et une demande du même produit. | `application.dc.html` (`cO`, `cD`, `cCompat`, `cLeg`, `cSheet`, `cPick*`) | aucune | |
| Distance et trajet | opérationnelle | Distance à vol d'oiseau. En ligne, trajet par la route (OSRM public), km et durée approximatifs. | `app/carte-gl.js` (`tracer()`) | aucune | Dépend du serveur public `router.project-osrm.org` (gratuit, sans garantie). |
| Zones de forte demande | opérationnelle | L'administrateur pose une zone (district, ville, produit, note, fin dans 14 jours par défaut). Tout le monde la voit tant qu'elle n'est pas expirée. | `application.dc.html` (`zoneForm()`, `cZones`, `cAdmin`) ; `v3/nuage.js` (`zoneAjouter`, `zoneRetirer`, `lireZones`) | `zones` (RLS : lecture publique si `expire_le > now()`, écriture admin) ; `produits_activite()` | 0 zone : non testée en vrai. |

### B6. Alertes par produit

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Choisir ses alertes | opérationnelle | Connecté : depuis la fiche produit ou « Alertes produits », choisir « Nouvelles offres », « Nouvelles demandes » ou les deux. Invitation à activer les notifications. | `v3/alertes.js` (`panneau`, `gerer`, `enregistrer`) ; `application.dc.html` (`fAlerte`, `ficheAlerte`, menu l. 1974) ; `v3/pousse.js` | `alertes_produits` (RLS : chacun ne voit et ne change que les siennes) | 0 alerte : non testée en vrai. |
| Notification aux abonnés d'un produit à chaque nouvelle annonce | opérationnelle | La base appelle la fonction Edge `pousser` (`{ annonce, id }`), qui prévient ceux qui suivent le produit. Au plus 10 annonces par membre et par jour déclenchent l'envoi. | `supabase/functions/pousser/index.ts` (cas 5, l. 334-347) | déclencheurs `offres_push_annonce` / `demandes_push_annonce` → `push_annonce()` ; `push_annonce_jour` (schéma 75) ; secrets `mdg_push_url` et `mdg_push_cle` dans Vault (valeurs non lues) | Non testée en vrai (0 abonné). |
| Diffusion « annonce du marché » d'une nouvelle annonce à tous les comptes | défectueuse | Prévue dans `pousser` : après les abonnés, tous les autres comptes sont prévenus (`diffuser("annonce", …)`). | `supabase/functions/pousser/index.ts` l. 346-347 | `push_annonce()` (schéma 75, définition vérifiée en production) | **Défaut constaté** : `push_annonce()` s'arrête tout de suite si **personne d'autre** ne suit ce produit dans `alertes_produits`. La fonction Edge n'est donc pas appelée et la diffusion à tous n'a jamais lieu tant qu'il n'y a pas d'abonné (0 aujourd'hui). |
| Onglet « Alertes » de l'accueil | opérationnelle | Ce qui demande attention : se connecter, propositions en attente, messages non lus, stocks épuisés, codes de commande. | `application.dc.html` (`al` l. 1285, `nAl` l. 1299) | aucune | Ce ne sont pas les alertes par produit (même mot, autre chose). |

### B7. Boutiques des vendeurs (schéma 86, projet de test seulement)

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Ouvrir ou fermer sa boutique | partielle | D'un geste, dans Mon compte → Ma boutique. Adresse : le pseudo, sinon un code court de 8 caractères (toujours valable). | `v3/boutique.js` (`gerer`) | `boutiques`, `boutique_activer`, `ma_boutique` | Pas encore en production. |
| Page boutique | partielle | Nom (pseudo ou prénom + initiale), ville, membre depuis, identité vérifiée, niveau, fiabilité, ventes, note ; toutes les offres avec photo, prix, quantité, ville et état (disponible, stock faible, en pause, épuisé). « Négocier » sur chaque offre. Boutique cachée si le compte est banni, supprimé ou suspendu. | `v3/boutique.js` (`ouvrir`), `application.dc.html` (`#/boutique/…`) | `boutique_publique`, `_boutique_catalogue`, `_boutique_etat` | Pas encore en production. |
| Partager, copier le lien, QR code | partielle | Partage du téléphone (sinon copie), copie, image PNG avec le QR de la boutique ; lien direct vers une offre. | `v3/boutique.js`, `vendor/qrcode-generator-1.4.4.js` | `boutique_mesurer` | |
| Aperçu WhatsApp et Facebook | partielle | Une page `site/boutiques/<adresse>/` par boutique ouverte (noindex, Open Graph), refaite chaque jour ; elle renvoie à la boutique dans l'application. | `tools/site-boutiques.js`, `tools/site/boutique.html`, `404.html` | `boutiques_publiques` | L'image d'aperçu est l'image générale du Marché de Gros. |
| Sur ordinateur | partielle | La page de maintenance montre le nom de la boutique et un QR pour l'ouvrir sur le téléphone. | `maintenance.html` | `boutique_publique` | |
| Visites de la boutique | partielle | Totaux seulement (7 et 30 jours, produits ouverts, partages) ; un visiteur compte une fois par jour, 40 mesures au plus par visiteur ; le vendeur ne compte pas ses visites. | `v3/boutique.js` | `boutique_passages`, `boutique_sels`, `boutique_mesurer`, `mesurer` | |
| Pause d'une offre | partielle | « Indisponible pour l'instant » : l'offre sort du marché, les négociations ouvertes continuent ; aucune nouvelle négociation ni achat groupé. | `application.dc.html` (Mes publications), `v3/nuage.js` | `offres.pause_le`, `_boutique_garde_pause` | Une pause faite sur un autre téléphone ne s'affiche pas dans Mes publications de ce téléphone. Le tableau du marché, le fil du site et la carte montrent encore l'offre (la base refuse la négociation). |
| Retrait sans effacement | partielle | « Retirer » (avec confirmation) cache l'annonce et garde la ligne sur le serveur. | `v3/nuage.js` (`sync`) | `offres.retiree_le`, `demandes.retiree_le`, `_boutique_annonce`, `_boutique_retrait_negos` | Clé `ON DELETE CASCADE` vers `auth.users` : proposition en attente. |
| Quantité obligatoire et verrou contre la survente | partielle | La base refuse une offre sans quantité ; deux accords en même temps ne peuvent pas vendre plus que le stock. | | `_boutique_annonce`, `_boutique_verrou_stock` | Verrou testé par sa logique, pas avec deux connexions réelles. |

## Module C. Commande : négociation, messages, commandes, transport, argent, litiges, avis

Activité en production (24/10/2026) : 3 négociations (2 conclues, 1 ouverte), 10 messages de négociation, 2 discussions directes (12 messages), **2 commandes** (1 terminée, 1 annulée, transport par l'acheteur), 1 commission inscrite (statut « due », encaissement « aucun »), 1 avis de commande. **0** transporteur, 0 mission, 0 code, 0 position GPS, 0 lien de suivi, 0 séquestre, 0 message de litige, 0 besoin pro, 0 achat groupé, 0 rappel d'achat.

Beaucoup de ces fonctions ont été essayées dans des transactions annulées ou avec Playwright (selon `docs/PASSATION.md`), mais **jamais en conditions réelles** par de vrais membres. C'est écrit ligne par ligne.

### C1. Négociation (propositions et contre-propositions)

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Proposer un prix sur une offre ou une demande | opérationnelle | Prix, quantité, conditions. Une seule négociation ouverte par acheteur et par annonce. 40 négociations ouvertes par jour au plus. Refus si l'annonce n'est pas négociable et que le prix diffère. | `v3/negoce.js` (`proposer`, `editeur`, l. 356-427) | `negociations`, `messages` (genre `prix`) ; `nego_ouvrir`, `nego_agir` (schémas 3, 36) | Utilisée en vrai (3 négociations). |
| Accepter, refuser, contre-proposer, retirer | opérationnelle | Chaque proposition attend 48 h puis expire. L'accord fige prix, quantité, conditions et date. Le stock de l'annonce baisse. | `v3/negoce.js` (`thread`, `act`, l. 452-560) | `nego_agir` ; déclencheurs `negociation_figee` (`nego_fige`), `negociation_stock` (`stock_apres_accord`) | Un accord n'est ni un paiement ni une livraison (dit à l'écran). |
| Minimum de vente du vendeur | opérationnelle | `nego_agir` refuse une proposition d'acheteur sous `offres.qte_min`. | `v3/negoce.js` | `nego_agir` (schéma 37) | Non testée en vrai. |
| Transport dans la proposition (« inclus » ou « sans ») | opérationnelle | L'information passe dans `negociations.transport_final` à l'accord. | `v3/negoce.js` (l. 353, 424) | `nego_transport`, déclencheur `negociations_transport` (`nego_transport_suivi`) (schéma 49) | Non testée en vrai. |
| Boîte des négociations (non lus, masquer, glisser pour supprimer) | opérationnelle | Liste, pastille de non-lus, évènement `mdg:negoce`. | `v3/negoce.js` (`inbox`, `masquer`, `glisser`, `refresh`) | `nego_dispo`, `nego_masquer`, `marquer_lu` ; RLS « voir mes négociations » / « voir mes messages » | |
| Renégocier après un accord sur la même annonce | opérationnelle | Index unique partiel `negociations_une_ouverte`. | `v3/negoce.js` | schéma 36 | |

Les anciennes fonctions `negocier` et `proposer_prix` (schéma 2) ont été retirées (`supabase/a-lancer-dans-sql-editor.sql`, `supabase/a-lancer-etape-4.sql`) : elles n'existent plus en production et l'application ne les appelle plus.

### C2. Messagerie directe

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Écrire à un membre sans annonce | opérationnelle | Conversations, non-lus, masquer. 20 messages par minute et 500 par jour au plus. | `v3/messages.js` (`ecrire`, `conversation`, `boite`) | `discussions`, `dm` (RLS sans politique : accès par fonctions) ; `dm_ouvrir`, `dm_envoyer`, `dm_liste2`, `dm_messages`, `dm_lu`, `dm_masquer` (schéma 8) | Utilisée en vrai (12 messages). |
| Numéros, liens, réseaux sociaux refusés | opérationnelle | Le serveur refuse le texte ou masque le numéro et prévient les admins. L'admin peut écrire des liens. | `v3/messages.js` | déclencheurs `dm_garde_textes` (`garde_textes`), `dm_controle_sortie` (`controle_sortie`), `dm_banni` (schémas 10, 22, 68) | |
| Messages gardés 1 an, lisibles par l'équipe | opérationnelle | `dm_duree()` = 365 jours ; effacement des plus vieux par la tâche `mdg-effacer-messages` (chaque heure, `dm_purger`). Les membres en sont prévenus. | `v3/messages.js` (`JOURS = 365`) | schéma 60 | |
| Écrire au Marché de Gros, diffusion de l'admin à tous | opérationnelle | Messages officiels avec logo et mention « Officiel ». | `v3/messages.js` (`ecrireMarche`, `diffuser`) | `contact_marche`, `admin_diffuser`, `admin_discussions`, `admin_dm` (schéma 10) | |

Le blocage d'une personne est décrit en A7.

### C3. Commandes (du « oui » à la livraison)

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Créer une commande depuis un accord | opérationnelle | L'une des parties la crée (qui transporte, où livrer), l'autre confirme ou refuse. Une commande par accord. | `v3/commandes.js` (`creer`, l. 1016 ; `choixTransport`) | `commandes`, `commande_etapes` ; `commande_creer`, `commande_repondre` (schémas 26, 63) | Utilisée en vrai (2 commandes). |
| Étapes enregistrées par le serveur | opérationnelle | Confirmée, préparation, chargement, « le camion est parti », transbordement, arrivée, réception, terminée. Heure et auteur de chaque étape. | `v3/commandes.js` (`avance`, `actions`, `prochaine`) | `commande_avancer`, `commande_journal`, `_cmd_journal` (schémas 26, 63, 65) | Le transbordement ne sert qu'au réseau de transport (en pause). |
| Réception confirmée par le mot secret du vendeur | opérationnelle | Le vendeur reçoit un mot tiré au hasard qu'il glisse dans la marchandise. L'acheteur le tape, ou coche « je ne trouve pas le papier » (noté au journal). | `v3/commandes.js` (`blocMot`, l. 584 ; appel l. 890) | déclencheur `commandes_mot` ; `commande_reception_mot`, `_cmd_mot`, `_mot_norme` (schémas 58, 63) | Non testée en vrai (la commande terminée date d'avant ce système). |
| Annulation | opérationnelle | Avant confirmation : celui qui a créé. Après : seul le vendeur demande, avant le chargement, et l'acheteur accepte ou non. Après le chargement : impossible. Le stock revient sur l'annonce. | `v3/commandes.js` (l. 894) | `commande_annuler`, `_cmd_rendre_stock` | Aucune pénalité d'annulation. |
| Fiche de la commande et plan de livraison | opérationnelle | Image du produit, plan, résumé de l'accord. Relu toutes les 20 s sans redessiner un formulaire ouvert. | `v3/commandes.js` (`fiche`, `plan`, `peindreDetail`) | `mes_commandes2` | |
| Service litiges WhatsApp | prévue, non implémentée | Emplacement prêt ; l'écran dit « bientôt ». | `v3/commandes.js` (`WA_LITIGES = ''`, l. 53) | aucune | Numéro officiel non fourni. |

### C4. Transport et suivi

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Transport par l'acheteur ou par le vendeur | opérationnelle | Le transporteur n'a rien à faire dans l'application. Le serveur impose « le vendeur livre » quand le transport est inclus. | `v3/commandes.js` (`choixTransport`) | `commande_creer`, `_transport_vendeur`, `_cmd_transport_inclus` (schémas 48, 49, 63) | Utilisé en vrai (mode acheteur). |
| Transport local et interurbain | partielle | Règle : entre deux villes le vendeur livre, dans la même ville l'acheteur s'en charge (réglable). | `v3/commandes.js`, formulaires de publication | schéma 48 | Pas de calcul du prix du transport, pas de devis, pas de réseau de transporteurs actif. |
| Transporteur du réseau Marché de Gros | partielle | Option visible, grisée « Bientôt ». Le serveur refuse toute commande en mode « reseau ». | `v3/commandes.js` (`RESEAU_OUVERT = false`, l. 57) | `_transport_reseau_ouvert()` renvoie `false` ; déclencheur `commandes_reseau_pause` (schéma 62) | En pause par décision du propriétaire. 0 transporteur inscrit. |
| Espace chauffeur | partielle | Inscription gratuite, vérification par l'équipe, disponibilité, missions à accepter ou refuser avec son prix, arrivée, transbordement, code `T-XXXX`. | `v3/chauffeur.js` | `transporteurs`, `transport_missions` ; `transporteur_inscrire`, `transporteur_moi`, `transporteur_disponible`, `chauffeur_missions`, `chauffeur_repondre2`, `chauffeur_prix`, `chauffeur_transferts` (schémas 27, 42) | Jamais utilisé (0 transporteur, 0 mission). Sans usage tant que le réseau est en pause. |
| Codes à usage unique (prise en charge, transfert, réception) | partielle | 6 chiffres chiffrés (bcrypt), expiration 6 h (transfert 2 h), 5 essais. | `v3/commandes.js` (`blocCode`), `v3/chauffeur.js` (`taper`, `passer`) | `commande_codes` ; `commande_code_obtenir`, `commande_code_demander`, `commande_valider_code`, `commande_transfert_preparer` (schémas 28, 51) | Réservés au réseau, donc inutilisables tant qu'il est en pause. 0 code. |
| Lien de suivi pour son propre chauffeur | opérationnelle | Celui qui transporte crée un lien (ou un code court du type `K7P-492`). Le chauffeur ouvre `suivi.html` sans compte ; le partage de position démarre ; « le chauffeur a ouvert le lien ». Départ détecté à 500 m. 10 codes faux par adresse et par quart d'heure au plus. | `suivi.html`, `v3/commandes.js` (`blocLien`) | `suivi_liens`, `suivi_code_essais`, `positions` ; `suivi_lien_creer`, `suivi_lien_etat`, `suivi_code_jeton`, `suivi_lien_ouvert`, `suivi_lien_infos`, `suivi_lien_position` (schémas 48, 64, 65, 71) | Non testée en vrai (0 lien). Une page fermée ne partage plus sa position (limite d'une page web). |
| Carte de suivi (camion sur la route) | partielle | Carte MapLibre + OpenFreeMap. Dernière position réelle, qui pâlit après 5 min. Tracé pointillé « approximatif » si le trajet n'a pas pu être calculé. | `v3/suivi.js` (`monter`, `texte`), `v3/commandes.js` (`placerCarte`, l. 695) | `positions`, `commande_itineraires` ; `commande_position`, `chauffeur_position` (schéma 29) ; fonction Edge `itineraire` (openrouteservice, clé dans les secrets Supabase) ; tâche `mdg-purger-positions` (chaque nuit) | 0 position en base. Le seul itinéraire calculé en production est marqué `introuvable` (lieu non trouvé par le géocodage). |

### C5. Commissions (registre seulement)

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Commission vendeur 3,5 % | partielle | Calculée par le serveur à chaque changement de commande : prévue, due à la libération, suspendue en litige, annulée. Compte officiel exclu. Montrée au vendeur dans sa commande. | `v3/commandes.js` (l. 530-560), `v3/admin-transport.js` (vue Commissions, l. 216) | `commissions`, `commission_journal` ; déclencheur `commission_sync` (`_commission_sync`, taux 0,035) ; `mes_commissions`, `admin_commissions` (schémas 30, 57) | **Rien n'est encaissé** : `encaissement` = « aucun », seule valeur permise. Aucun prestataire de paiement. `mes_commissions()` n'est appelée par aucun écran. |
| Commission transport 6,9 % | partielle | Due par le chauffeur du réseau, sur son prix, seulement si le transport n'est pas inclus par le vendeur. | `v3/chauffeur.js` (l. 132-151), `v3/admin-transport.js` | `commissions_transport`, `commission_transport_journal` ; déclencheurs `commandes_commission_transport` (`_ctr_commande`), `transport_missions_commission` (`_ctr_mission`) ; `_ctr_sync` (0,069), `mes_commissions_transport`, `admin_commissions_transport`, `admin_mission_prix` (schémas 42, 50) | 0 ligne : le réseau est en pause. Rien n'est prélevé. |

### C6. Séquestre et paiements

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Paiement dans l'application | prévue, non implémentée | L'écran dit « Paiement à la livraison, hors application » et « séquestre en construction ». | `v3/commandes.js` (l. 423, 534, 554, 567) | aucune | Aucun prestataire (Wave, Orange Money, MTN MoMo). Statut légal (BCEAO) non tranché (`docs/SEQUESTRE.md`, partie 5). |
| Mécanique du séquestre | partielle | Une ligne `sequestres` ne peut naître que par `sequestre_depot_confirme()` (réservée au rôle service, pour la future fonction Edge du partenaire). Répartition calculée : vendeur moins 3,5 %, transporteur moins 6,9 %, part du Marché de Gros, part rendue à l'acheteur. | `v3/commandes.js` (`blocSequestre`, l. 548) | `sequestres`, `sequestre_journal`, `sequestre_versements` ; `sequestre_depot_confirme`, `_seq_repartition`, `commande_sequestre`, déclencheur `commandes_sequestre` (`_seq_commande`) (schéma 57) | Bloquée par une dépendance externe : il manque le partenaire financier et sa fonction Edge. 0 séquestre, 0 versement. |
| « Tout est conforme » et clôture automatique après 1 h | opérationnelle | L'acheteur clôt la commande. Sans réclamation, la tâche `mdg-liberer-echus` (toutes les 5 min) la clôt 1 h après la réception (schéma 89 ; avant : 24 h). L'acheteur est prévenu au moment de confirmer la réception. | `v3/commandes.js` (l. 900-902) | `commande_liberer`, `sequestre_liberer_echus`, `admin_liberer` (schémas 57, 58, 61) | Cette « libération » change seulement un statut (`libere_le`) et rend la commission « due » : **aucun argent ne bouge**. |

### C7. Refus de la marchandise et litiges

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Refuser la marchandise avec preuves | opérationnelle | À l'arrivée ou après la réception, avant la libération. Mot secret du vendeur obligatoire, 1 à 4 photos dans l'espace privé « preuves ». | `v3/commandes.js` (`refuser`, l. 637-694 ; `blocRefus`) | `commande_refuser2` (`commande_refuser` renvoie « mettez l'application à jour ») (schémas 58, 61) | Non testée en vrai. |
| Colis au départ (photos, poids, papier du mot secret) | opérationnelle | Avant le chargement, le vendeur envoie 2 à 4 photos du colis emballé et le poids pesé ; s'il y a un mot secret, il touche « Afficher le code » (code au hasard) et a 3 minutes pour photographier le papier avec le code écrit à côté. Sans ces preuves, le chargement est refusé par le serveur. Acheteur et transporteur voient les photos du colis ; seule l'équipe voit la photo du papier. | `v3/commandes.js` (`depart`, `blocDepart`) | `commande_depart_preuves`, `commande_depart_defi`, `commande_depart_mot`, déclencheur `commande_etapes_chargement_preuves`, `commande_sequestre` (`depart`) (schémas 90, 90b) | Testée sur le projet de test. |
| Réponse du vendeur et du chauffeur au refus | opérationnelle | Le vendeur reconnaît ou conteste ; le chauffeur du réseau confirme ou conteste. Le refus s'applique seul dans certains cas, sinon l'équipe tranche. | `v3/commandes.js` (l. 906), `v3/chauffeur.js` (l. 213) | `commande_refus_vendeur`, `commande_refus_chauffeur`, `_cmd_refus_appliquer`, `_cmd_chauffeur_independant`, `admin_refus_trancher` | Non testée en vrai. |
| Signaler un problème (litige) | opérationnelle | Jusqu'à la libération. Arrête la clôture automatique. Commission suspendue. | `v3/commandes.js` (l. 912) | `commande_litige`, `admin_litige_trancher` | Non testée en vrai. |
| Discussion à trois (acheteur, vendeur, équipe) | opérationnelle | Mêmes interdits que les autres messages. Notification à chaque message. | `v3/commandes.js` (`blocDisc`, `lierDisc`), `v3/admin-transport.js` | `litige_messages` ; `litige_ecrire`, `litige_messages_lire` ; déclencheurs `litige_messages_push`, `litige_messages_fige` | 0 message : non testée en vrai. |

### C8. Avis, réputation et statuts

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Délais publics (livraison, validation) | opérationnelle | Fiche profil : carte vendeur « Livre en général en … » (confirmation → réception), carte acheteur « Valide en général en … » (réception → clôture). Médiane, affichée à partir de 3 commandes. | `v3/reputation.js` (`blocReputation`) | `delais_publics` (schéma 89) | Testée sur le projet de test. |
| Avis après une commande terminée | opérationnelle | Un avis par personne et par commande, sous 30 jours, modifiable 24 h. Réputations vendeur et acheteur séparées. | `v3/commandes.js` (`blocAvis` l. 713, `lierAvis` l. 730) ; `v3/reputation.js` | `avis_commandes` ; `avis_commande_donner`, `avis_commande_moi` (schéma 32) | Utilisée en vrai (1 avis). |
| Notes et avis publics | opérationnelle | Moyenne, nombre d'avis, derniers commentaires, classement des mieux notés. Un auteur ne compte qu'une fois par personne notée. | `v3/reputation.js` | `avis` (ancienne, 0 ligne), `avis_commandes` ; `notes_publiques`, `avis_de2`, `mieux_notes`, `_avis_uniques` (schémas 7, 32, 77) | |
| Ancienne note après une simple négociation | défectueuse | `MDGRep.noter` appelle `noter`, que la base refuse depuis le schéma 32. | `v3/reputation.js` `noter` (l. 146) | `noter`, `peut_noter` | Code mort : plus aucun écran ne l'appelle. Pas de défaut visible pour les membres. |
| Niveaux de confiance (badges) | opérationnelle | Par rôle, calculés par le serveur sur les commandes terminées des 12 derniers mois : Vendeur fiable, Bon, Excellent, Grand vendeur ; mêmes paliers pour les acheteurs ; badge à part « Acheteur en gros » (5 commandes de 500 000 F CFA ou plus). Seuils réglables par l'administrateur. Montée tout de suite, baisse après un sursis de 30 jours, historique, contestation sous 7 jours. Excellent et Grand : commandes validées par code (5 au plus par partenaire) et identité vérifiée. | `v3/statuts.js`, `v3/reputation.js` (écran « Mes niveaux »), `v3/compte.js`, `v3/tableau.js`, `v3/admin-niveaux.js` | tables `niveaux_regles`, `niveaux_membres`, `niveaux_journal`, `niveaux_contestations` (RLS, aucun droit direct) ; `_niv_calculer`, `_niv_appliquer`, `niveaux_recalculer`, `niveaux_publics`, `niveaux_criteres`, `niveaux_moi`, `niveaux_contester`, `admin_niveaux*` ; `reputation_publique` (champs `niveau`, `niveau_libelle`, `gros`) (schéma 85) | En production depuis le 24/10/2026 : aucun membre n'a encore de niveau (pas assez de commandes terminées). Notifications de niveau : fonction `pousser` version 20 (cas 17). |
| Statuts publics | opérationnelle | « Identité vérifiée », niveau de confiance (remplace « Vendeur de confiance » et « Acheteur sérieux » depuis le schéma 85), « Répond vite », « Actif », « Nouveau membre », « Officiel ». Mon compte montre la progression. | `v3/statuts.js` | `statuts_publics`, `officiels` (schémas 17, 20, 32, 77, 78) | Calculés sur très peu de données réelles. Pas de niveaux qui évoluent. |

### C9. Achats récurrents, approvisionnement pro, achats groupés

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Racheter | opérationnelle | Après une commande terminée : même annonce, autres annonces du vendeur, 5 autres vendeurs, prix du jour, stock. L'acheteur coche et confirme : une proposition par produit (`nego_ouvrir`). Rien n'est acheté tout seul. | `v3/racheter.js` (`ouvrir`, `habituels`, `preparer`) | `recommande_preparer`, `mes_achats_habituels` (schémas 33, 36) | Non testée en vrai. |
| Rappels d'achat | opérationnelle | Quotidiens ou hebdomadaires, 10 au plus. Notification « Racheter … ? » qui ouvre l'écran de préparation. Aucune commande n'est envoyée. | `v3/racheter.js` (`blocRappel`, l. 149-170) | `rappels_achat` ; `mes_rappels`, `rappel_regler`, `rappel_arreter`, `rappels_envoyer` (tâche `mdg-rappels-achat`, toutes les 15 min) | 0 rappel : non testée en vrai. |
| Approvisionnement pro (besoins) | opérationnelle | Restaurant, hôtel, cantine, revendeur : un besoin regroupe plusieurs produits (chacun devient une vraie demande), fréquence, période, zone, prix cible, exigences. Les vendeurs répondent (stock, délai) ; l'acheteur compare. | `v3/appro.js` (`formulaire`, `besoin`, `comparer`, `repondre`) | `besoins`, `proposition_details`, `demandes.besoin_id` ; `besoin_creer3`, `besoins_liste`, `besoin_public`, `besoin_repondre`, `besoin_comparer`, `besoin_statut`, `_besoin_detail` ; déclencheur `besoins_push` (schémas 34, 38, 40, 43) | 0 besoin : non testée en vrai. |
| Achats groupés | opérationnelle | Sur une offre : prix et paliers selon le volume. Chacun s'inscrit avec sa quantité. Seuil atteint : prix final figé, chacun confirme (48 h). Prix qui monte : on reconfirme. Tous confirmés : une commande par participant. | `v3/groupes.js` (`ouvrir`, `groupe`, `creer`) | `groupes_achat`, `groupe_participants`, `commandes.groupe_id` ; `groupe_creer`, `groupe_rejoindre`, `groupe_quitter`, `groupe_confirmer`, `groupe_lancer`, `groupe_annuler`, `groupe_valider`, `groupe_detail`, `groupes_liste`, `_groupe_evaluer` ; tâche `mdg-groupes-echeances` (toutes les 15 min) ; déclencheurs `push_groupe` (schémas 35, 41) | 0 groupe : non testée en vrai. Aucun paiement commun. |

## Module D. Notifications, accueil, aide, réglages, hors ligne, administration

### D1. Notifications sur le téléphone (Web Push)

En production : 1 téléphone abonné, 1 compte.

**Chantier « notifications » (24/10/2026, branche `claude/notifications`)** : plan et audit dans `docs/audits/audit-notifications-2026-10-24.md`. Serveur en production le 24/10/2026 : schémas 88a, 88b, 88d appliqués (30 fonctions identiques au test), puis fonction `pousser` déployée (version 22 en production = fichier du dépôt ; la 21 a été redéployée pour un caractère). Tâche `mdg-notif` toutes les 15 min. L'écran (réglages par catégorie, statistiques) arrive avec la PR « Notifications ». Testé sur le projet de test et dans le navigateur avec des réponses simulées ; aucun push reçu sur un vrai téléphone pendant les essais.

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Activer / désactiver les notifications | opérationnelle | Demande l'accord après un toucher, abonne le téléphone, demande un essai au serveur et affiche sa vraie réponse (« Essai parti vers 1 téléphone » seulement si le serveur a accepté l'envoi ; sinon la raison). Bouton « Envoyer un essai » quand c'est activé. Désactiver retire l'abonnement. L'écran dit l'état réel : activées, pas activées, bloquées dans les réglages du téléphone, iPhone à installer d'abord, navigateur sans notifications. | `v3/pousse.js` (`activer`, `desactiver`, `etat`, `essai`), `app/theme.js` (`texteEssai`) | `push_abonnements` (RLS : chacun voit ses téléphones), `push_abonner`, `push_desabonner` (schéma 6) ; `push_quitter` (schéma 88a, trace la désactivation ; l'application revient à `push_desabonner` tant que 88a manque) | iPhone : seulement dans l'application ajoutée à l'écran d'accueil (iOS 16.4 et plus), dit à l'écran. |
| Préférences par catégorie | retirée de l'écran (décision du propriétaire, 24/10/2026) | Plus d'interrupteur par catégorie dans Réglages : les notifications partent toutes seules (comme Orange Max it). Le serveur garde `notif_prefs` (personne ne peut plus les changer depuis l'application). | `app/theme.js` | `notif_prefs`, `notif_prefs_moi`, `notif_pref_regler` (inutilisées par l'écran) | — |
| Permission retirée, désabonnement, déconnexion : comptés | opérationnelle (serveur en production, écran à fusionner) | Si la permission passe à « refusée » dans les réglages du téléphone alors qu'il était abonné, l'application le signale une fois. Désactiver et se déconnecter laissent une trace (sans nom) pour les statistiques. | `v3/pousse.js` (`permissionRetiree`, `quitter`) | `notif_permission_retiree`, `push_quitter`, `notif_desactivations` (schéma 88a) | Une permission retirée n'est vue qu'à la prochaine ouverture de l'application. |
| Proposition d'activer après la connexion | opérationnelle | Une seule fois, une bulle propose d'activer (fermée seule après 20 s). | `v3/pousse.js` (`inviter`) | aucune | Mémorisé sur le téléphone. |
| Le téléphone suit le compte connecté | opérationnelle | À la connexion, l'abonnement est rattaché au compte ; à la déconnexion il est retiré. | `v3/pousse.js` (`suivre`, `oublier`) | `push_abonner`, `push_desabonner` | |
| Affichage, regroupement, toucher | opérationnelle | Le service worker affiche la notification, retire l'ancienne du même sujet, ajoute « Répondre » ou « Voir la proposition ». Toucher ouvre l'écran de son adresse : application déjà ouverte, elle reçoit l'adresse et ouvre la fiche produit, le catalogue, les prix, Vendre, l'année, la carte, les groupes, l'approvisionnement, une commande, une négociation, un message… ; tableau de bord (`admin.html#…`) dans sa propre fenêtre ; sinon une nouvelle fenêtre. Ouverte sans être connecté : l'écran demandé est gardé (30 min, cet onglet) et rouvert après la connexion. Le service worker suit aussi le renouvellement de l'abonnement par le navigateur. | `sw.js` (`push`, `notificationclick`, `pushsubscriptionchange`), `application.dc.html` (`allerLien`), `v3/pousse.js` (`depuisAdresse`, `ouvrirLien`, `garderSiDeconnecte`) | aucune | Vérifié par simulation (navigateur et service worker imités), pas sur un vrai téléphone. |
| Ouverture comptée | opérationnelle (serveur en production, écran à fusionner) | Au toucher, le service worker signale l'identifiant d'envoi (`nid`, aléatoire, sans donnée personnelle) avec la clé publique. Seule la première ouverture compte. | `sw.js` (`signalerOuverture`) | `notif_ouverte` (schéma 88a, ouverte à anon) ; `nid` mis dans chaque notification par `pousser` v21 | Rien n'est compté tant que 88a et `pousser` v21 ne sont pas en production. |
| Statistiques des notifications (administrateur) | opérationnelle (serveur en production, écran à fusionner) | Tableau de bord → Notifications : envoyées, ouvertes (taux), actions dans les 24 h, commandes ou groupes, retenues (préférence, plafond, heures calmes), non parties ; par catégorie et jour par jour ; désactivations par origine ; 7, 30 ou 90 jours. Totaux seulement, aucun nom. Dit ce qui n'est pas mesurable. | `v3/admin-notifs.js`, `admin.html` | `notif_stats`, `notif_stats_jours` (schémas 88a, 88d ; `est_admin` vérifié) | Sans 88a et 88d en production, l'écran dit « Pas encore installé sur ce serveur ». |
| Chiffre sur l'icône | partielle | Nombre de négociations et messages non lus sur l'icône. | `v3/pousse.js` (`badge`, `majBadge`), `sw.js` | `push_badge` (rôle service) | Dépend du navigateur (API Badging). Le serveur ne compte que les négociations ; l'application ajoute les messages directs. Non testée sur tous les téléphones. |
| Envoi côté serveur (fonction Edge `pousser`) | opérationnelle | 15 cas numérotés dans l'en-tête du code : message de négociation, notification d'essai, message direct, tentative de sortie (admins), nouvelle annonce, dossier d'identité et résumé du matin, étape de commande, mission, décision transporteur, rappel d'achat, achat groupé, besoin pro, notification marketing, demande de code, message de litige. Plus un cas « 7 bis » : refus de marchandise. Retire les abonnements périmés (404/410). | `supabase/functions/pousser/index.ts` (version 22 déployée, 24/10/2026) | déclencheurs `push_message`, `push_dm`, `push_alerte`, `push_annonce`, `push_identite`, `push_commande` (`commande_etapes_push`), `push_mission`, `push_transporteur`, `push_besoin`, `push_groupe` (2 tables), `push_code_demande`, `push_litige_msg` ; `push_config` (clés lues dans le coffre Supabase, rôle service) | Protégée par une clé partagée (en-tête) ou par le jeton de session. Le schéma 44 note un essai réel réussi (demande de gombo). Les autres cas ne sont pas testés un par un en vrai. Pas de notification « intelligente » (priorité, résumé). |
| Diffusion « annonces du marché » (achat groupé ouvert, besoin pro) | opérationnelle | Tous les comptes abonnés, au plus 10 par personne et par jour, jamais à soi ni aux bannis ou supprimés. | `pousser` (`diffuser`) | `push_diffusion_cible`, `push_diffusions_jour`, `notif_reglages` (schémas 43, 46) | Pour une **nouvelle annonce**, la diffusion ne part pas sans abonné au produit (défaut décrit en B6). |
| Interrupteur « Annonces du marché » | opérationnelle | Couper ces annonces sans couper les notifications personnelles. | `app/theme.js` | `notif_reglage_moi`, `notif_reglage_diffusions`, `notif_reglages` | Personne ne l'a encore coupé (0 ligne). |
| Notifications marketing régulières | opérationnelle | Toutes les 5 min, `marketing_tick` envoie si l'intervalle est passé (30 par jour au plus, de 7 h à 21 h). Texte tiré des vraies données. | `pousser` (cas 13) | `marketing_reglage`, `push_marketing_jour`, `push_marketing_cible`, tâche pg_cron `mdg-marketing` (active) (schémas 45, 46) | |
| Demande de code par le chauffeur | opérationnelle | Notification au vendeur ou à l'acheteur (une toutes les 2 min). Le code n'est jamais envoyé. | `pousser` (cas 14) | `code_demandes`, `commande_code_demander`, `push_code_demande` (schéma 51) | 0 ligne : non testée en vrai. Sans usage tant que le réseau est en pause. |
| Journal des notifications dans l'application | partielle | Liste « Notifications » dans Mon compte, cloche de l'accueil avec pastille. | `v3/compte.js` (`notifs`, `nonLues`), `v3/negoce.js`, `application.dc.html` (`accCl`) | aucune | Gardé sur le téléphone seulement (`mdg-notifs`), alimenté seulement par les négociations, pas partagé entre appareils. |
| Notifications commerciales automatiques (schéma 91) | opérationnelle (testée sur le projet de test ; production après l'accord du propriétaire) | Comme Orange Max it : envoyées toutes seules, sans réglage à activer, de 7 h à 21 h, 8 messages commerciaux au plus par personne et par jour, 90 min au moins entre deux (180 si les 5 derniers n'ont pas été ouverts). Neuf déclencheurs réels : offre pour ma demande, proposition sans réponse, proposition qui expire, accord sans commande, offre à mettre à jour, demande sans offre mais des offres ailleurs, demande à sa date limite, visites de la boutique (lundi), boutique pas encore ouverte. « Contenu du marché » (4 par jour au plus) : une vraie offre, une vraie demande, une vraie fourchette de prix, jamais la même annonce en 3 jours, rien s'il n'y a rien de réel. Plusieurs versions de chaque texte. | `supabase/functions/pousser/index.ts` (cas 13 et 18), `v3/boutique.js` (`?maboutique=1`), `application.dc.html` (`allerLien` : `#/boutique/…`) | `notif_relances`, `_notif_mettre`, `_notif_ecart_ok`, `_notif_rang`, `notif_annonces_recentes`, `notif_deja_vus`, `notif_regles.ecart_min` (schéma 91) | Réception sur un vrai téléphone pas vérifiée ; volume réel limité par le nombre de comptes abonnés (1 en production le 24/10/2026). |
| Rappel du mot secret en notification | prévue, non implémentée | | aucun | aucune | En attente (`CLAUDE.md`). |

### D2. Accueil de l'application

| Fonctionnalité | État | Ce que ça fait | Fichiers | Ce qui manque ou défaut |
|---|---|---|---|---|
| Accueil à 4 onglets | opérationnelle | Marché, Prix, Activité, Alertes, avec pastilles de nombre. | `application.dc.html` (`accOngs`, vers l. 1317) | |
| En-tête | opérationnelle | Menu, nom animé, recherche, cloche, publier, compte. | `application.dc.html`, `v3/souffle.js` | |
| Salutation et chiffres | opérationnelle | « Bonjour, prénom », offres en ligne, demandes, mes annonces ou prix du marché. | `application.dc.html` | |
| Bande « nos garanties » | opérationnelle | Une garantie à la fois ; toucher ouvre « Pourquoi le Marché de Gros ». Le paiement par tiers est dit « bientôt ». | `app/garanties.js` | |
| Onglet Activité | opérationnelle | Négociations, commandes, messages en cours, bouton « Reprendre ». | `app/activite.js` | Les éléments retirés sont mémorisés sur ce téléphone seulement. |
| Démo de la roue | opérationnelle | Pilote la vraie interface (environ 18 s). Sans prix réel, l'exemple est marqué « ces prix ne sont pas réels ». | `app/demo-orbite.js` | |

### D3. Aide, guide, astuces

| Fonctionnalité | État | Ce que ça fait | Fichiers | Ce qui manque ou défaut |
|---|---|---|---|---|
| Aide par questions-réponses | opérationnelle | 80 questions-réponses, recherche sur le téléphone (sans accent, débuts de mots). | `v3/aide.js` (`MDGAide`) | Réponses écrites à la main : à tenir à jour quand une règle change. |
| « Je veux parler à une personne » | opérationnelle | Envoie la question dans la conversation avec le Marché de Gros ; l'admin reçoit une notification. Rien ne part sans toucher. | `v3/aide.js`, `v3/messages.js` (`dm_envoyer`, `push_dm`) | |
| Guide « Comment ça marche » | opérationnelle | 20 fiches, bouton « Montrer dans l'app ». La fiche séquestre dit : « Aujourd'hui : paiement à la livraison. Le séquestre est en construction. » | `v3/guide.js` (`MDGGuide`) | |
| Astuces et tutoriels | opérationnelle | Signes animés sur l'accueil ; 13 tutoriels courts. Fréquence : une fois, chaque semaine ou à chaque ouverture. | `v3/astuces.js` (`MDGAstuces`) | Réglage sur le téléphone seulement. |

### D4. Réglages

| Fonctionnalité | État | Ce que ça fait | Fichiers | Ce qui manque ou défaut |
|---|---|---|---|---|
| Page Réglages unique | opérationnelle | Apparence, notifications, annonces du marché, sons, vibrations, messages à l'écran, aide pour débuter, démo, confidentialité. | `app/theme.js` (`MDGTheme.ouvrir`) | |
| Thème clair / sombre / comme le téléphone | opérationnelle | Posé avant l'affichage (pas d'éclair blanc). | `app/theme.js`, `app/nuit.js`, `css/sombre.css` | `app/nuit.js` traduit les couleurs écrites en dur : rendu à vérifier écran par écran. |
| Sons (balafon synthétisé) | opérationnelle | 4 sons + confirmation, réglables un par un ; rien ne joue en arrière-plan. | `v3/sons.js` (`MDGSons`) | Commentaire d'en-tête périmé (« Mon compte → Sons » ; le panneau s'ouvre depuis Réglages). |
| Vibrations au toucher | partielle | Android : API vibrate. iPhone : astuce de l'interrupteur système. | `app/vibre.js` | iPhone : iOS 18 et plus, seulement pendant un toucher. Désactivées par défaut. |
| Messages à l'écran | opérationnelle | Coupe les lignes « proposition arrivée / acceptée / refusée ». | `app/theme.js`, `v3/negoce.js` | Ne vaut que pour les négociations (le libellé le dit). |
| Voix | prévue, non implémentée | | aucun | En attente (fichiers audio). |

### D5. Effets et stabilité

| Fonctionnalité | État | Fichiers | Remarque |
|---|---|---|---|
| L'îlot de messages (toast) | opérationnelle | `app/toast.js` (`MDGToast.dire`, `suivre`) | Regroupe, suit une action, propose le geste. |
| Feuille de confirmation | opérationnelle | `app/toast.js` (`MDGDemande.oui`, `saisie`) | Remplace les fenêtres du navigateur (sauf le stock de « Mes publications », voir B1). |
| Nombres qui défilent | opérationnelle | `app/effets.js` (`<mdg-nb>`) | Aucun mouvement si le téléphone demande moins d'animations. |
| Fenêtres stables, listes sans clignotement | opérationnelle | `app/stable.js` (`MDGStable.poser`) | |
| Le sac, personnage des états | opérationnelle | `app/sac.js` | Humeurs : plein, vide, charge, triste, fermé. |

### D6. Hors ligne et application installable

| Fonctionnalité | État | Ce que ça fait | Fichiers | Ce qui manque ou défaut |
|---|---|---|---|---|
| Application installable | opérationnelle | Manifeste, icônes, ouverture en plein écran. | `manifest.webmanifest`, `application.dc.html` | Pas sur Play Store ni App Store. |
| Fonctionnement hors ligne | partielle | Service worker (cache `mgci-v243`) : code par le réseau d'abord, copie sinon ; images en cache ; 1 500 tuiles de carte au plus. | `sw.js` | Les données (annonces, négociations) demandent le réseau. Commentaire d'en-tête de `sw.js` périmé. |
| Bandeau « Pas de connexion » | opérationnelle | Bandeau rouge, « Réessayer », puis « De retour ». | `app/sac.js` (`horsLigne`, `enLigne`), `app/toast.js` | |
| Annonces publiées sans réseau | partielle | L'annonce reste sur le téléphone et part au retour du réseau. | `v3/nuage.js` (`sync`, `waiting`) | Non testée en vrai. |
| Mise à jour automatique | opérationnelle | La page se recharge quand une nouvelle version prend la main, jamais pendant une saisie. | `application.dc.html` (bloc service worker) | |

### D7. Protection ordinateur → maintenance

| Fonctionnalité | État | Ce que ça fait | Fichiers | Ce qui manque ou défaut |
|---|---|---|---|---|
| Ordinateur → maintenance dans l'application | opérationnelle | `application.dc.html` renvoie l'ordinateur vers `maintenance.html`, sauf administrateur. | `application.dc.html` (l. 17-23), `maintenance.html` | C'est un aiguillage d'affichage, pas une sécurité : il lit un drapeau du navigateur (`mdg-site:admin`). Les données restent protégées par la RLS. |
| Barre « Admin · Application · Ancien site · SEO » | opérationnelle | Sur ordinateur, pour l'administrateur ; revérifie `est_admin` au serveur, sinon retire la barre et l'accès. | `app/admin-pc.js` | |

L'aiguillage de l'adresse racine et l'entrée cachée de l'administrateur sont décrits en partie 2.

### D8. Administration (`admin.html`)

Accès : connexion, puis `est_admin` (1 administrateur en base). Page en `noindex`. Accès aussi depuis le menu et Mon compte (avec le nombre de dossiers d'identité à examiner).

| Écran | État | Ce que ça fait | Fichiers | Fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Aperçu | opérationnelle | Annonces des 14 derniers jours, accords conclus, remise moyenne. | `v3/admin.js` (`pouls`, `remise`) | lecture REST `offres`, `demandes`, `negociations` | |
| À traiter | opérationnelle | Annonces signalées, regroupées ; tentatives de sortie de l'application (« vu »). | `v3/admin.js` | `alertes` (RLS admin), `admin_signalements_comptes`, `admin_signalements_membres`, `admin_signalement_membre_traite`, `admin_signalements_cible_traites` | |
| Annonces | opérationnelle | Masquer, réactiver, supprimer une annonce. | `v3/admin.js` (`bind`) | REST `offres`, `demandes`, `signalements` | |
| Comptes | opérationnelle | Liste, bannir, lever le bannissement, nouveau code secret. | `v3/admin.js` | `admin_comptes`, `admin_bannir`, `admin_lever_bannissement`, `admin_reinitialiser` | |
| Négociations | opérationnelle | Lire les négociations et leurs messages. | `v3/admin.js` | REST `negociations`, `messages` | |
| Messages | opérationnelle | Conversations, réponse au nom du « Marché de Gros », message à tous (2 000 caractères au plus). | `v3/admin.js`, `v3/messages.js` | `admin_discussions`, `admin_dm`, `admin_diffuser` | |
| Identités | opérationnelle | Dossiers, examen, décision, registre, effacement des dossiers échus (voir A6). | `v3/admin.js` | `admin_identite_*` | |
| Commandes : retrouver et tout lire | opérationnelle | Par numéro : accord, négociation, messages directs, discussion à trois, mot secret, répartition, historique. Procédure : `docs/traiter-un-litige-admin.pdf`. | `v3/admin-transport.js` (l. 96-188) | `admin_commandes`, `admin_commande_numero`, `admin_affecter` (schémas 27, 57, 60) | |
| Transporteurs, missions, refus, litiges, libération | défectueuse | Créer, valider un transporteur ; affecter une mission, fixer le prix ; trancher un refus ou un litige ; libérer. | `v3/admin-transport.js` (l. 167), `v3/commandes.js` (l. 900) | `admin_transporteurs`, `admin_transporteur_creer`, `admin_transporteur_decider`, `admin_affecter`, `admin_mission_prix`, `admin_refus_trancher`, `admin_litige_trancher`, `admin_liberer`, `litige_ecrire`, `commande_journal` | **Libellé trompeur constaté** : `admin_liberer` ne déplace aucun argent (il note `libere_le` et le journal), mais l'écran dit « Paiement libéré. » (`v3/admin-transport.js` l. 167) et « Libérer le paiement », « Paiement libéré : chacun reçoit sa part » (`v3/commandes.js` l. 900, côté admin). Cela peut faire croire à un vrai paiement. Le reste fonctionne, non testé en vrai (0 transporteur). |
| Commissions | partielle | Registre des 3,5 % et du transport. La case « Encaissé » affiche 0 F, « pas de paiement dans l'application ». | `v3/admin-transport.js` | `admin_commissions`, `admin_commissions_transport` | Aucune commission encaissée : pas de prestataire de paiement. |
| Structures | opérationnelle | Badge « Coopérative / Marché vérifié » (voir A4). | `v3/admin-transport.js` | `admin_structures`, `admin_structure_decider` | |
| Visites | partielle | Tableau des mesures d'audience (7, 30 ou 90 jours). | `v3/admin-mesures.js` | `mesures_resume` (admin seulement) | Vide : 0 mesure en production (voir partie 2, mesure des visites). |

---

# Partie 2. Le site web

Le site est fait pour l'ordinateur ; sur téléphone, c'est l'application. **Aujourd'hui, le public ne voit que la page de maintenance.** L'ancien site et le nouveau site existent, mais seul l'administrateur peut les ouvrir. Toutes les pages du nouveau site sont en `noindex`. L'ouverture au public est une décision du propriétaire, pas encore prise.

Vérifié le 24/10/2026 sur `main` (commit `2fdc445`). Le générateur `node tools/site-public.js`, relancé sur une copie du dépôt, refait exactement les 55 pages présentes, sans différence (contrôle refait lors de la relecture).

### S1. Porte d'entrée et redirection

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Aiguillage de l'adresse racine | opérationnelle | `index.html` envoie le téléphone (écran tactile de moins de 768 px) vers `application.dc.html`, l'ordinateur et la tablette vers `maintenance.html`, sauf l'administrateur reconnu (vers `index-v3.html`). `?app=1` force l'application (sur ordinateur, `application.dc.html` renvoie quand même un non-administrateur vers la maintenance), `?ordinateur=1` le site. `utm_*` et `#/…` sont gardés. Sans JavaScript : maintenance. | `index.html` (script en ligne) | aucune | Le drapeau `mdg-site:admin` est lu dans le navigateur ; la vraie vérification se fait ensuite au serveur (`est_admin`). |
| Page de maintenance | opérationnelle | « Site web en maintenance », bouton « Ouvrir l'application ». Sur ordinateur : code QR fabriqué dans la page, lien à copier, 4 atouts. Sur téléphone ou pour l'admin : départ vers l'application après 8 s, avec « Rester sur cette page ». `noindex`. | `maintenance.html`, `vendor/qrcode-generator-1.4.4.js`, `app/marque.js` | `mesurer()` (une vue par visite) | |
| Entrée cachée de l'administrateur | opérationnelle | Un petit point en bas à droite de la maintenance ouvre « Entrer en tant qu'admin », vers `index-v3.html?admin=1`. | `maintenance.html` | `est_admin()` (vérifié par la page de destination) | |
| Page 404 | opérationnelle | « Cette page n'existe pas », bouton vers l'accueil. `noindex`. | `404.html` | aucune | Le chemin `/marchedegrosci/` est écrit en dur (à changer avec un nom de domaine). |

### S2. Ancien site (`index-v3.html`), caché au public

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Garde de l'ancien site | opérationnelle | Sans drapeau administrateur ni `?admin=1`, renvoi vers la maintenance. Sinon, voile plein écran (`#mdgGarde`) jusqu'à la réponse `est_admin`. Connexion seulement (pas de création de compte, pas de « code oublié »). | `index-v3.html` (l. 9-16, 1193, 1296-1306), `v3/nuage.js` | `est_admin()` | Le voile cache, il ne protège pas : le contenu reste dans le HTML. Les données passent toutes par le serveur et ses règles. |
| Site React historique (accueil, catalogue, carte, fiches produit, compte, messages, négociations, recherche globale avec dictée vocale) | partielle | Pages `#/`, `#/catalogue`, `#/carte`, `#/produits/<id>`. Réutilise les modules communs. Explorer l'offre (`v3/acheter.js`), J'ai / Je cherche (`v3/match.js`), recherche (`v3/cherche.js` : phrase, lieux, familles, mois, aperçu, dictée vocale, Ctrl/⌘ K et « / »), prix (`v3/marche.js`). | `index-v3.html`, `v3/*.js`, `v2/*.js`, `css/styles.css`, `v3/*.css` | celles des modules communs | Gelé. Il manque tout ce qui n'existe que dans l'application (commandes, tableau du marché, prix du moment, appro pro, achats groupés, Racheter, alertes, carte MapLibre…) : liste dans `PORTAGE-SITE.md`, partie 4. Lourd : React + Babel dans la page, chargé deux fois (`vendor/babel.min.js` et une copie de secours depuis unpkg.com), réglages de développement (`v3/tweaks*.jsx`), WebGL décoratif (`v3/scene-ivt.js`). Presque illisible pour Google (tout en JavaScript, adresses en `#/`). Le retrait de parties attend la validation du propriétaire (`PORTAGE-SITE.md`, partie 5). |

### S3. Nouveau site public (`site/`), caché, en construction

Les pages `site/**/index.html` sont **fabriquées** par `tools/site-public.js` à partir des gabarits `tools/site/*.html` (`_debut`, `_entete`, `_fin`), des guides `tools/site/guides/*.html`, des pages produits (`tools/site-produits.js`), des districts (`tools/site-regions.js`), des prix OCPV (`tools/site-prix.js` + `tools/site/prix-ocpv.json`), du catalogue `v2/data.js`, des saisons `v2/saisons.js` et de `app/geo/ci.json`. Les photos légères (`site/img/`, 290 fichiers) viennent de `tools/site-images.py`.

| Fonctionnalité | État | Ce que ça fait | Fichiers | Tables / fonctions SQL | Ce qui manque ou défaut |
|---|---|---|---|---|---|
| Garde « en construction » | opérationnelle | Renvoi vers la maintenance sans drapeau, puis voile `#garde` jusqu'à `est_admin`. Données et carte démarrent après l'évènement `site:ouvert`. | `tools/site/_debut.html`, `tools/site/_fin.html`, `site/garde.js` | `est_admin()` | Pour ouvrir au public : retirer ce bloc, le voile, `garde.js` et le `noindex` (décision du propriétaire). Pas de création de compte sur le site : `site/garde.js` ne sert qu'à la connexion de l'administrateur. |
| 55 pages statiques lisibles sans JavaScript | opérationnelle | Accueil, carte, guides (liste + 7), 27 pages produits, districts (liste + 14), calendrier des récoltes, « Les prix de la semaine », « Qui sommes-nous ». | `site/**/index.html` (fabriquées), `tools/site/` | aucune pour le texte | Toutes en `noindex, nofollow` (voulu pendant la construction). |
| SEO technique sur chaque page | opérationnelle | Titre et description propres, `canonical`, Open Graph, JSON-LD (`Organization`, `WebSite`, `Country` ; selon la page `BreadcrumbList`, `Article`, `AboutPage`). Aucun `Product` ni `Offer` avec des prix inventés. Typographie française automatique. | `tools/site/_debut.html`, `tools/site-public.js` (`page()`, `fine()`) | aucune | Sans effet tant que le `noindex` reste. |
| Plan du site `site/sitemap.xml` | opérationnelle | 55 adresses, `lastmod` pour les guides et la page des prix. | `site/sitemap.xml` (fabriqué) | aucune | Non soumis. Pas de `robots.txt` possible (il devrait être à la racine du domaine `stan77i.github.io`). Search Console et Bing non branchés (comptes du propriétaire). |
| Fil « En ce moment sur le marché » | opérationnelle | Annonces actives anonymes : prénom + initiale, ville, produit, quantité, prix. 3 lignes en haut, 40 plus bas ; filtré sur les pages produit et district ; relu toutes les 2 min. Fil vide : « Publiez la première ». Un clic ouvre l'application sur la fiche du produit. Le compte admin s'affiche « Marché de Gros ». | `site/site.js` (`lireFil`, `fil`, `phrase`) | `fil_public(p_limite)` (schéma 80, `security definer`, droit `anon`) : annonces de moins de 90 jours, sans `user_id`, sans numéro, sans nom complet | Volume réel faible (4 offres et 1 demande actives). La ville est donnée telle que saisie. |
| Tableau du marché sur le site | opérationnelle | 8 premiers produits : prix vendeur le plus bas, meilleur budget, nombres en pastilles. Bloc sur les pages produit, tableau filtré sur les districts. | `site/site.js` (`tableau`) | `tableau_produits(p_region)` (schéma 59, droit `anon`) | |
| Petite carte SVG de l'accueil | opérationnelle | Contour du pays, fleuves, lacs, grandes villes. Annonces placées sur leur ville (sinon chef-lieu du district), regroupées. | `tools/site-public.js`, `site/donnees/lieux.json` (3 700 lieux), `site/site.js` (`villes`, `points`, `ou`) | `fil_public()` | |
| Carte complète du réseau (`site/carte/`) | partielle | Même carte MapLibre que l'application, en grand. Panneau avec filtres « Tout / Offres / Demandes », liste, boutons « Acheter » / « Lui vendre » vers l'application. Repli SVG sans WebGL. | `site/carte.js`, `app/carte-gl.js`, `vendor/maplibre/`, `tools/site/carte.html` | `fil_public(120)` via l'évènement `site:fil` | Elle montre les annonces, **pas les commandes** ni les demandes de négociation, alors que la décision du 23/10/2026 les prévoit. Aucune fonction publique ne donne les commandes. |
| Pages produits (27) | opérationnelle | « <Produit> en gros en Côte d'Ivoire » : prix en direct, annonces, étapes pour vendre ou acheter, produits du même rayon. Pour 11 produits : prix officiels **au détail** de l'OCPV (semaine 42, du 12 au 18/10/2026, source citée). | `tools/site-produits.js`, `tools/site/produit.html`, `tools/site-prix.js`, `tools/site/prix-ocpv.json` | `tableau_produits()`, `fil_public()` | 27 pages pour 175 produits du catalogue (145 avec photo). Les autres mènent vers l'application. |
| « Les prix de la semaine » | partielle | Page tirée de la note de conjoncture de l'OCPV (prix moyens à Abidjan et à l'intérieur, marchés les moins chers), puis le tableau en direct. | `tools/site/prix-semaine.html`, `tools/site-prix.js`, `tools/site/prix-ocpv.json` (lu le 24/10/2026) | `tableau_produits()` | Mise à jour chaque semaine non testée en vrai : la tâche GitHub `ocpv-note.yml` (lundi et mardi) télécharge le PDF, mais aucune note n'est encore enregistrée (`tools/site/ocpv/` ne contient que `LISEZ-MOI.md`). La tâche programmée qui doit ensuite mettre à jour le JSON (selon `docs/REPRISE.md`) n'a pas été vérifiée. |
| Guides (7) | opérationnelle | Vendre sa récolte, acheter en gros sans arnaque, approvisionner un restaurant ou une cantine, achats groupés, trouver un fournisseur, les grands marchés de gros, transporter le vivrier. Chiffres sourcés, encadré « Passez à l'action ». | `tools/site/guides/*.html`, `tools/site/guide.html`, `tools/site/guides.html` | aucune | |
| Districts (14 + sommaire) | opérationnelle | Prix publiés, annonces du moment, récoltes sourcées, liens vers les autres districts. | `tools/site-regions.js`, `tools/site/region.html`, `tools/site/regions.html` | `tableau_produits(p_region)`, `fil_public()` filtré par `region_slug` | |
| Calendrier des récoltes | opérationnelle | Seules les périodes sourcées de `v2/saisons.js`, avec « En ce moment » et les sources. | `tools/site/saisons.html`, `tools/site-produits.js` (`calendrier`) | aucune | |
| « Qui sommes-nous » | opérationnelle | Ce que nous faisons, ce que nous ne sommes pas (ni le marché de Bouaké, ni l'OCPV, ni l'État), nos règles, ce que ça coûte. Pied de page : « Aucun paiement ne passe encore par l'application ». | `tools/site/a-propos.html`, `tools/site/_fin.html` | aucune | |
| Boutons d'action vers l'application (`data-app`) | partielle | Sur téléphone, ouvre l'application au bon écran. Sur ordinateur, panneau « Continuez sur votre téléphone » avec un code QR vers ce même écran. Provenance `utm_source=site…` ajoutée. | `site/site.js` (`lien`, `qr`), `tools/site/_fin.html` (`<dialog id="tel">`) ; `application.dc.html` `intention()` (`#/publier?sens=…&produit=…`, `#/vendre`, `#/demande`, `#/groupes`, `#/appro`) | aucune | Non testé avec de vrais visiteurs (site fermé). La création de compte se fait dans l'application. Liens Play Store et App Store : absents (l'application n'est pas dans les magasins). |
| Mesure des visites (sans donnée personnelle) | partielle | Une vue par page et par visite, un clic par bouton d'action ; la maintenance compte une vue ; l'application compte une ouverture venue du site ou d'un QR code (`utm_*`), puis la connexion qui suit. Jamais l'administrateur. 20 000 par jour au plus. | `site/site.js` (`mesurer`), `maintenance.html`, `application.dc.html` (`intention()`), `v3/admin-mesures.js`, `admin.html` | table `site_mesures` (RLS active, aucune politique, aucun droit `anon` ni `authenticated`) ; `mesurer(...)` (`anon`) ; `mesures_resume(p_jours)` (admin) (schéma 81) | **0 ligne** en production : aucune mesure réelle encore enregistrée (site fermé, visites de l'admin exclues). Search Console non branché. |
| Exclusion du service worker | opérationnelle | Le service worker ne remplace jamais une page de `site/` par l'application. | `sw.js` (règle sur `/site/`) | aucune | |
| Refabrication automatique | défectueuse | La tâche GitHub `site-public.yml` refait photos et pages à chaque fusion qui touche gabarits, catalogue, photos, carte, `site/*.js` ou `site/*.css`, et n'enregistre un commit que si une page a changé. | `.github/workflows/site-public.yml` | aucune | **Petit défaut** : `tools/site-prix.js` et `tools/site-regions.js`, pourtant lus par `tools/site-public.js` (l. 123 et 146), ne sont pas dans les chemins qui la déclenchent. Un changement de ces seuls fichiers ne refait pas le site. (`tools/site/prix-ocpv.json` est bien couvert par `tools/site/**`.) |
| Inventaire automatique du site | opérationnelle | `tools/inventaire-site.js` réécrit la partie 7 de `PORTAGE-SITE.md`, lancé par la tâche `rapport-site.yml`. | `tools/inventaire-site.js`, `.github/workflows/rapport-site.yml` | aucune | |

### S4. Données publiques lues par le site et par les PDF

| Fonction | Droit | Rôle | État |
|---|---|---|---|
| `fil_public(p_limite int)` (schéma 80) | `anon`, `authenticated` | annonces actives anonymisées (120 au plus), 90 jours | opérationnelle (définition vérifiée en production) |
| `tableau_produits(p_region text)` (schéma 59) | `anon`, `authenticated` | meilleurs prix par produit | opérationnelle |
| `stats_publiques()` (schéma 79) | `anon`, `authenticated` | totaux seulement : membres, annonces actives, produits, régions, commandes terminées | opérationnelle, utilisée par les PDF de stratégie (`strategie/sources/construire.js`), pas par le site |
| `mesurer(...)`, `mesures_resume(...)` (schéma 81) | `anon` / `authenticated` (contrôle admin dans la fonction) | mesure d'audience | opérationnelles, 0 mesure enregistrée |

### S5. Prévu pour le site, non implémenté

Ces points sont détaillés dans `ROADMAP.md` :

- ouverture au public (retirer `noindex` et garde, mener l'ordinateur vers `site/`) : décision du propriétaire ;
- Search Console et Bing Webmaster Tools (comptes du propriétaire) ;
- commandes en direct sur la carte du site (aucune fonction publique) ;
- liens Play Store et App Store ;
- retrait de l'ancien site ou de ses parties inutiles (`PORTAGE-SITE.md`, partie 5), en attente de validation ;
- méthode « un seul code » (`PORTAGE-SITE.md`, partie 3), conseillée, non faite ;
- anti-robot Turnstile sur le site, en attente ;
- supports suivis (affiches, partenaires, QR codes) : la mesure est prête, les supports n'existent pas ;
- audit de sécurité à refaire avant l'ouverture.

---

# Récapitulatif par état

Comptage des lignes des tableaux de ce document (une ligne = une fonctionnalité). Les tableaux S4 (fonctions publiques) et S5 (liste) ne sont pas comptés.

| Partie | Opérationnelle | Partielle | Prévue, non implémentée | Défectueuse | Total |
|---|---|---|---|---|---|
| A. Compte, identité, profil, sécurité | 36 | 3 | 2 | 0 | 41 |
| B. Marché | 32 | 2 | 0 | 2 | 36 |
| C. Commande | 30 | 8 | 2 | 1 | 41 |
| D. Notifications, accueil, réglages, hors ligne, admin | 42 | 7 | 2 | 1 | 52 |
| **Application (partie 1)** | **140** | **20** | **6** | **4** | **170** |
| **Site web (partie 2)** | **19** | **5** | **0** | **1** | **25** |
| **Total** | **159** | **25** | **6** | **5** | **195** |

Une grande partie des fonctionnalités « opérationnelles » n'a **pas encore servi en conditions réelles** (voir la colonne « Ce qui manque ou défaut »). Les fonctions qui ont vraiment servi en production : inscription et connexion, publication d'annonces, négociation, messages directs, commande avec transport par l'acheteur, avis de commande, notifications (essai réel noté au schéma 44).

# Écarts trouvés entre les docs et le code

- `docs/SEQUESTRE.md` (partie 1 et suivantes) décrit une table `paiements` qui n'existe pas. La mécanique réelle est `sequestres`, `sequestre_journal`, `sequestre_versements` (schéma 57). Seul l'avertissement en tête est à jour.
- `docs/PASSATION.md`, schéma 58 : « pas de libération automatique » a été remplacé par le schéma 61 (clôture automatique après 24 h, tâche active en production).
- `v3/chauffeur.js`, en-tête : « codes à venir », alors que les codes existent (schéma 28).
- `v3/sons.js` et `sw.js` : commentaires d'en-tête périmés (voir D4 et D6).
- Les libellés « Paiement libéré » de l'écran administrateur ne correspondent à aucun mouvement d'argent (voir D8).
