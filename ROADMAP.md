# Feuille de route : Marché de Gros CI

État au 24/10/2026. Ce document liste ce qui est **prévu** ou **en cours**. Ce qui marche déjà est décrit dans `FONCTIONNALITES.md`. L'architecture est dans `ARCHITECTURE.md`.

L'application mobile (`application.dc.html`) passe d'abord. Le site web est traité à part, à la fin de chaque chantier quand il est concerné.

## Comment lire les états

| État | Ce que ça veut dire |
|---|---|
| **existant** | Le code est là et a déjà servi en vrai. |
| **partiel** | Une partie est faite. Ce qui manque est écrit. |
| **absent** | Rien dans le code ni dans la base. |
| **à tester** | Le code est là, mais n'a jamais servi en conditions réelles (0 ligne en base, ou jamais essayé sur un vrai téléphone). |
| **bloqué par une dépendance externe** | Ne peut pas avancer sans un prestataire, un compte, un budget ou une décision du propriétaire. |

Les comptages en base (« 0 ligne », « 1 ligne ») viennent de la base de production, lus le 24/10/2026 par des `count(*)` seulement.

**Paiement : aucun prestataire de paiement n'est intégré.** Aucun argent ne passe par l'application. Le séquestre, les reversements et les commissions sont des registres : rien n'est encaissé ni prélevé.

**Un audit détaillé de 4 de ces chantiers est en cours.** Ses conclusions mettront ce document à jour.

---

## 1. Boutiques individuelles, catalogue et gestion des stocks

**État : partiel.**

Ce qui existe :
- **Catalogue des produits** : `v2/data.js`, écran Catégories et « Tous les produits » dans `application.dc.html`. Photos `v2/img/produit-<id>.webp`, liste `A.SACK` dans `app/marche-app.js`.
- **Stock d'une offre** : la quantité se change dans « Mes publications ». Une offre à 0 sort du marché. La base baisse le stock après un accord (`stock_apres_accord`, `_stock_garde`, schémas 12 et 52 ; `v3/nuage.js` `stockDuServeur`).
- **Profil public du vendeur** : présentation, activités, 6 photos, structure, lieux, volumes, historique (`v3/reputation.js`, fonction SQL `profil_public`, schémas 23, 74).
- **Fiche vendeur** : nom, lieu et ses offres (écran vendeur de `application.dc.html`).
- Limite : 30 annonces actives par compte (`limite_annonces`, schéma 70).

Ce qui manque :
- Une **vraie boutique** par vendeur : une page à lui, avec tout son catalogue, ses prix et ses stocks, rangés.
- Un **lien propre** et un **QR code** pour cette boutique (voir chantier 2).
- Une gestion des stocks au-delà d'un nombre par annonce (pas d'entrées ni de sorties, pas d'historique de stock).
- À vérifier : au-delà de 30 annonces par sens gardées sur le téléphone, le code peut retirer la plus ancienne sur le serveur (lu dans le code, non testé).

Mise à jour du 24/10/2026 (chantier 4, branche `claude/chantier-boutiques-p`, schéma 86 **sur le projet de test seulement**) : **boutique par vendeur construite** (`v3/boutique.js`, `boutique_publique`), états disponible, stock faible (20 % ou moins), en pause, épuisé ; pause d'une offre ; retrait sans effacement ; quantité obligatoire ; verrou contre la survente. Reste : appliquer en production, pas d'historique d'entrées et de sorties de stock.

Dépendance : aucune. C'est du développement.

## 2. Liens de partage et QR codes

**État : partiel.**

Ce qui existe :
- **Partager une fiche produit** : `navigator.share`, ou copie du lien (`application.dc.html`, fonction `share`).
- **Liens d'intention** qui ouvrent un écran précis : `#/publier?sens=…&produit=…`, `#/vendre?produit=…`, `#/demande?produit=…`, `#/groupes`, `#/appro` (méthode `intention()` dans `application.dc.html`).
- **QR codes fabriqués dans la page**, sans service extérieur (`vendor/qrcode-generator-1.4.4.js`) : sur `maintenance.html` (vers l'application) et dans le panneau « Continuez sur votre téléphone » du site (`tools/site/_fin.html`).
- **Provenance** `utm_*` gardée du site jusqu'à l'application et mesurée (`mesurer()`, table `site_mesures`, schéma 81, écran Visites de `admin.html`, `v3/admin-mesures.js`).

Ce qui manque :
- Un bouton **Partager** sur chaque annonce, et un **QR code par annonce**.
- Un lien et un QR code **par boutique** (décidé, voir plus bas).
- L'adresse `#/producteurs/<id>` ne marche que si l'offre est déjà en mémoire sur le téléphone.
- Mesure : **0 ligne** dans `site_mesures` au 24/10/2026. Rien n'a encore été mesuré en vrai : **à tester**.
- Liens Play Store et App Store : absents (l'application est une PWA installable, `manifest.webmanifest`, `sw.js`, pas publiée dans les boutiques).

Mise à jour du 24/10/2026 (chantier 4, projet de test seulement) : lien et QR code **par boutique** et **par offre** (`?o=<code>`), aperçu de partage par pages fabriquées `site/boutiques/<adresse>/` (noindex), page de maintenance qui montre la boutique et son QR sur ordinateur, visites limitées par visiteur (`boutique_mesurer`). L'adresse `#/producteurs/<id>` reste valable.

Dépendance : aucune pour les liens et les QR. Une publication dans les boutiques d'applications demanderait des comptes développeur (payants).

## 3. Négociation par propositions et contre-propositions de prix

**État : existant.**

Ce qui existe :
- Proposer, accepter, refuser, contre-proposer, retirer. La proposition expire après 48 h. Le transport fait partie de la proposition.
- Fichiers : `v3/negoce.js` ; fonctions SQL `nego_ouvrir`, `nego_agir` (schémas 3, 36, 37, 49).
- Sur chaque carte d'annonce : « Proposer un prix » ou « Acheter au prix » (`MDGNegoce.proposer`). « Négocier avec le moins cher » dans `app/prixmoment.js`.
- Les annonces portent `negociable` et `qte_min` (minimum du vendeur, schéma 37).
- Utilisée en vrai : 3 négociations, 2 accords en production.

Ce qui manque :
- La **négociation à trois** avec le transporteur MGCI (décidée, voir plus bas) : le transporteur du réseau est en pause.
- Site : le nouveau site n'a pas de négociation, il renvoie vers l'application. L'ancien site (`index-v3.html`) charge `v3/negoce.js` mais il est caché au public.

Dépendance : aucune.

## 4. Transport local et interurbain

**État : partiel.**

Ce qui existe :
- Chaque annonce dit qui transporte (offre : `hors_ville`, `inclus`, `non` ; demande : `vendeur`, `acheteur`). Colonne `transport`, schéma 48.
- Règle « hors de ma ville, le vendeur livre » et choix du transport dans la négociation (schémas 48, 49, 63).
- **Lien de suivi sans compte** : `suivi.html`, schémas 64, 65, 71.
- Carte : distance à vol d'oiseau et trajet par la route (OSRM public, approximatif ; fonction Edge `itineraire`).
- Écrans transporteur et administration du transport : `v3/chauffeur.js`, `v3/admin-transport.js`, schémas 27, 28, 29.

Ce qui manque :
- **Le transporteur du réseau MGCI est en pause** : `_transport_reseau_ouvert()` renvoie faux (schéma 62) et `RESEAU_OUVERT = false` dans `v3/commandes.js`. L'option reste grisée « Bientôt ».
- 0 transporteur, 0 mission, 0 position en production. Le seul itinéraire calculé en production a donné « introuvable ».
- Pas de prix ni de devis de transport hors réseau.
- La règle décidée « même ville / villes différentes » n'est pas encore codée telle quelle (voir plus bas).

Dépendance : trouver de vrais transporteurs, puis rouvrir le réseau (décision du propriétaire).

## 5. Séquestre et paiements

**État : bloqué par une dépendance externe.**

Ce qui existe (mécanique seulement) :
- Tables `sequestres`, `sequestre_journal`, `sequestre_versements` (schémas 57, 58). La fonction `sequestre_depot_confirme` est réservée au rôle service : aucun écran ne peut l'appeler.
- `commande_liberer` et la clôture automatique après 1 h (schémas 61 et 89) ne changent qu'un **statut**. Aucun argent ne bouge.
- 0 séquestre en production.
- Le guide et les astuces de l'application disent bien « paiement à la livraison, séquestre en construction ».

Défaut constaté : dans l'écran d'administration (`v3/admin-transport.js`, chargé par `admin.html`), le bouton qui appelle `admin_liberer` affiche « Paiement libéré. ». Or `admin_liberer` ne fait que noter une date (`libere_le`) et une ligne de journal. Ce message est trompeur et doit être reformulé. Dans l'application, `v3/commandes.js` prévoit aussi le texte « Paiement libéré : chacun reçoit sa part », mais seulement si un séquestre est actif, ce qui n'arrive jamais aujourd'hui (0 séquestre).

Ce qui manque :
- Un **prestataire de paiement** (Mobile Money, carte…). Aucun n'est intégré.
- Le **statut légal** (règles BCEAO pour garder l'argent d'autrui) n'est pas tranché. Voir `docs/SEQUESTRE.md`.
- Les reversements réels au vendeur et au transporteur.

Dépendance : prestataire de paiement et cadre légal. Le propriétaire n'a pas de budget pour l'instant.

## 6. Commissions : 3,5 % sur les ventes, 6,9 % sur le transport éligible

**État : partiel (registre seulement).**

Ce qui existe :
- **3,5 % sur la marchandise** : tables `commissions` et `commission_journal`, déclencheur `commission_sync` (taux fixé à 0,035 dans `supabase/schema-30-commissions.sql`). 1 ligne « due » en production ; le champ d'encaissement vaut « aucun », seule valeur permise.
- **6,9 % sur le transport** : tables `commissions_transport` et `commission_transport_journal` (taux fixé à 0,069, `supabase/schema-42-commission-transport.sql`, puis schéma 50). Seulement pour un transporteur du réseau quand le transport n'est pas inclus. 0 ligne : le réseau est en pause.
- Écran Commissions dans `admin.html` : « Encaissé : 0 F ».

Ce qui manque :
- **Rien n'est encaissé ni prélevé.** Il faut un système de paiement (chantier 5).
- `mes_commissions()` existe mais aucun écran de l'application ne l'appelle : le vendeur ne voit pas sa commission.
- Aucune commission n'est affichée sur les annonces, le tableau du marché ou les prix.

Dépendance : prestataire de paiement.

## 7. Pénalités d'annulation et score de fiabilité

**Pénalités d'annulation : absent. Score de fiabilité : partiel.**

Ce qui existe :
- Règles d'annulation : l'acheteur ne peut pas annuler une commande confirmée ; le vendeur peut demander l'annulation avant le chargement (`commande_annuler`, `v3/commandes.js`).
- `reputation_publique` (schéma 32) compte, par rôle (vendeur, acheteur), les commandes terminées, les annulations demandées, les litiges ouverts par l'autre partie, les avis, et le délai médian entre la confirmation et la réception (côté vendeur). Elle donne un badge **« Fiable »** si, dans ce rôle : 5 commandes terminées ou plus, annulations demandées à 10 % ou moins, litiges à 5 % ou moins, 3 avis de personnes différentes ou plus, note moyenne de 4 sur 5 ou plus.
- Le tableau du marché classe, à prix égal, selon « membre fiable », identité vérifiée et commandes honorées (`tableau_marche`, schémas 59 et 70).

Ce qui manque :
- **Aucune pénalité** dans le code ni dans la base.
- Pas de **score chiffré**, seulement un badge oui ou non.
- Pas de **fenêtre de 90 jours** (décidée, voir plus bas).
- Les **retards** ne sont pas comptés : il n'y a pas de date de livraison promise.
- En production, personne ne remplit encore les critères (1 seul avis).

Dépendance : aucune. Sans paiement, une pénalité ne peut être qu'une baisse de réputation ou de visibilité, pas une amende.

## 8. Badges évolutifs pour vendeurs et acheteurs

**État : fait (24/10/2026, schéma 85), à tester en vrai.**

Ce qui existe :
- Niveaux de confiance calculés par le serveur : Vendeur fiable → Bon → Excellent → Grand vendeur ; Acheteur fiable → Bon → Excellent → Grand acheteur ; badge « Acheteur en gros » (schéma 85, `v3/statuts.js`, `v3/reputation.js`, `v3/admin-niveaux.js`). Seuils réglables, sursis de 30 jours, historique, contestation.
- Statuts gardés : Répond vite, Actif, Nouveau membre, Officiel (schéma 17, `statuts_publics`).
- Badges Coopérative et Marché vérifiés (schéma 39, `v3/compte.js`).
- Affichage sur les cartes d'annonce et filtre « vérifiés » de l'écran Acheter.

Ce qui manque :
- Peu de données réelles pour les déclencher (1 avis, 0 identité vérifiée en production) : **à tester**.

Dépendance : aucune.

## 9. Achats récurrents, approvisionnement professionnel et achats groupés

**État : à tester.** Le code est là, il n'a jamais servi en vrai.

| Sujet | Ce qui existe | En production |
|---|---|---|
| Achats récurrents | « Racheter » et rappels d'achat : `v3/racheter.js`, schémas 33, 36, tâche planifiée `mdg-rappels-achat`. Rien n'est acheté tout seul : chaque ligne envoie une proposition que le vendeur doit accepter. | 0 rappel |
| Approvisionnement pro | Besoin à plusieurs produits, réponses des vendeurs, comparaison : `v3/appro.js`, schémas 34, 38, 40, 47. | 0 besoin |
| Achats groupés | Paliers de prix, seuil, confirmation de chacun, une commande par participant : `v3/groupes.js`, schémas 35, 41, tâche `mdg-groupes-echeances`. Depuis une offre : « Acheter à plusieurs » ou « Ouvrir un achat groupé ». | 0 groupe |

Ce qui manque :
- Un essai complet en conditions réelles pour chacun.
- Aucun paiement commun pour les achats groupés (chantier 5).
- Site : seulement des guides et des liens d'intention vers `#/appro` et `#/groupes`. Ces fonctions ne sont pas portées sur l'ancien site (`PORTAGE-SITE.md`, partie 4).

Dépendance : aucune pour tester.

## 10. Notifications intelligentes et suivi des commandes

**Notifications : partiel. Suivi des commandes : existant.**

Ce qui existe :
- **Notifications Web Push** par événement, via la fonction Edge `pousser` (`supabase/functions/pousser`) : propositions, messages, étapes de commande, missions, litiges, groupes, rappels, demandes de code. Fichier client `v3/pousse.js`.
- **Annonces du marché** envoyées à ceux qui suivent un produit, 10 au plus par membre et par jour (`push_annonce`, schémas 43, 75). Alertes par produit : `v3/alertes.js`, table `alertes_produits`.
- **Notifications marketing** : 30 au plus par jour, de 7 h à 21 h, tirées des vraies données (schéma 45).
- **Suivi des commandes** : étapes enregistrées par le serveur (`commande_etapes`, `commande_avancer`, `commande_reception_mot`), fiche, plan, carte de suivi (`v3/suivi.js`) quand une vraie position existe. Utilisé en vrai sur 2 commandes.

Ce qui manque ou ne va pas :
- Rien de **« intelligent »** : pas de tri, pas de résumé, pas de choix du bon moment selon la personne.
- **Journal des notifications** partagé entre appareils : aujourd'hui gardé sur le téléphone, et seulement pour les négociations. La table `notif_journal` existe (schéma 88a, test seulement) ; la liste « Notifications » de Mon espace ne la lit pas encore.
- **Chantier notifications (24/10/2026), serveur en production, écran dans la PR « Notifications »** : catégories transactionnelles et commerciales, préférences par catégorie, plafond commercial (6 par jour, 1 conseil), heures calmes, regroupement, anti-doublon, ciblage par produit suivi, achats passés, région et rôle, groupe à 80 %, produit à racheter, clic qui ouvre le bon écran, statistiques pour l'administrateur (schémas 88a, 88b, 88d ; `pousser` v21 ; `sw.js`, `app/theme.js`, `v3/pousse.js`, `v3/admin-notifs.js`). Mis en production le 24/10/2026 : 88a, 88b, 88d, puis `pousser` (version 22 en production).
- **Défaut lu dans le code** : la diffusion « annonce du marché à tous » ne part jamais tant que personne d'autre ne suit le produit, car `push_annonce` s'arrête avant.
- Peu d'essais réels : 1 seul téléphone abonné en production ; un seul cas (nouvelle demande) a un essai noté (schéma 44). `alertes_produits` et `code_demandes` : 0 ligne.
- Rappel du mot secret en notification et réglage Voix : en attente (voir plus bas).
- Site : ne montre ni commandes ni suivi (`fil_public()` n'expose que les annonces).

Dépendance : aucune pour le Web Push (gratuit). Les SMS et WhatsApp demandent un budget.

---

## Décidé avec le propriétaire, à développer

Règles données le 24/10/2026. **La plupart ne sont pas encore codées telles quelles.** Les parties déjà présentes dans le code sont signalées (la discussion libre, par exemple, existe déjà).

### Transport
- **Même ville** : deux choix.
  1. Le vendeur organise son livreur. L'acheteur le paie **hors MGCI**.
  2. Un transporteur MGCI, avec un prix **négocié à trois** (acheteur, vendeur, transporteur).
- **Villes différentes** : transport **inclus** dans le prix, ou **séparé**. Dans les deux cas, il se négocie.
- Les conditions sont **acceptées par toutes les parties** avant la commande.
- Déjà dans le code : le choix « inclus / hors ville / non » et le transport dans la proposition (schémas 48, 49). Manque : la négociation à trois et le transporteur du réseau (en pause).

### Discussion
- **Discussion libre** entre acheteur et vendeur, **sans échange de numéros**.
- Déjà dans le code : la **messagerie directe** permet d'écrire à n'importe quel membre, sans annonce et hors négociation (`v3/messages.js` ; tables `discussions` et `dm` ; fonctions `dm_ouvrir`, `dm_envoyer`, `dm_liste`, schéma 8 ; messages gardés 1 an, schéma 60). Un numéro écrit dans un message direct est masqué par le serveur et signalé aux administrateurs. Les messages de négociation (table `messages`, schéma 2) et les annonces refusent numéros, liens, réseaux sociaux et e-mails (`texte_refus`, schéma 22 ; même contrôle avant envoi dans `v3/nuage.js`). Utilisée en production : 2 discussions.
- Reste : vérifier sur un vrai téléphone que tout le parcours correspond à la règle décidée.

### Commissions
- **3,5 %** sur la marchandise.
- **6,9 %** sur le transport, **seulement quand il passe par le service MGCI**.
- Déjà dans le code : les deux registres (chantier 6). Manque : l'encaissement, qui attend le paiement.

### Pénalités d'annulation
- Calculées sur les **90 derniers jours**.
- Manque : tout (chantier 7). Les seuils et l'effet exact de la pénalité restent à préciser avec le propriétaire.

### Badges
- **Vendeurs** : Vendeur fiable, Bon vendeur, Excellent vendeur, Grand vendeur.
- **Acheteurs** : Acheteur fiable, Bon acheteur, Excellent acheteur, Grand acheteur, Acheteur en gros.
- Manque : les niveaux et leurs seuils (chantier 8). Les statuts actuels peuvent servir de base.

### Boutiques
- Une **boutique par vendeur**, avec son **lien** et son **QR code**.
- Construit le 24/10/2026 (schéma 86, projet de test) : page boutique, lien, QR, pause, retrait avec trace, quantité obligatoire, verrou de stock. Reste : production, et la clé `offres.user_id … ON DELETE CASCADE` (proposition, décision du propriétaire).

---

## Décisions en attente (reprises de `CLAUDE.md`)

| Sujet | État | Ce qui bloque |
|---|---|---|
| Anti-robot Cloudflare Turnstile | absent | Le propriétaire le veut sur le site seulement. Mais dans Supabase, le CAPTCHA vaut pour tout le projet, donc l'application serait bloquée. Conseil donné : partout, en mode invisible. À lui redemander au moment de le faire. Il faut un compte Cloudflare gratuit. |
| Vérification du numéro par SMS ou WhatsApp | bloqué par une dépendance externe | Service payant, pas de budget. Aujourd'hui, les comptes sont créés sans preuve du numéro (`v3/nuage.js`, `signUp`). |
| Réglage « Voix » | en attente | Fichiers audio `fr_P1.zip`. |
| Rappel du mot secret en notification | en attente | À faire dans la fonction `pousser`. Aucun code pour le mot secret. Les rappels qui existent (`supabase/functions/pousser/index.ts`) ne concernent que les codes des commandes « avec codes », donc le réseau en pause. |
| Limite de connexion Supabase Auth | réglée | 20 connexions par 5 minutes et par adresse IP (réglé par le propriétaire). |
| Remotion (vidéos) | laissé de côté | Pas dans l'application ni sur le site. Peut-être plus tard pour des vidéos de présentation. |
| Ouverture du nouveau site au public | bloqué par une décision | 55 pages prêtes, toutes en `noindex` et sous garde administrateur. Le propriétaire seul décide de l'ouverture. Search Console et Bing attendent ses comptes. |
| Publication sur Play Store et App Store | absent | L'application est une PWA. Les liens seront ajoutés le moment venu. |

## Autres points ouverts relevés pendant l'audit

| Sujet | État | Détail |
|---|---|---|
| Suppression complète du compte | partiel | `supprimer_compte` vide nom, prénom, pseudo, avatar, rôle, lieu et code de secours, bloque la connexion et retire les annonces. Mais elle ne vide pas la présentation, les activités, les photos, les champs de structure, ni les fichiers des espaces `avatars` et `activites`, alors que l'écran le promet. |
| Changer de numéro de téléphone | absent | Aucun écran ni fonction. L'application renvoie vers l'équipe. |
| Vérification d'identité | à tester | Parcours complet (`v3/identite.js`, schémas 13 à 21, onglet Identités de `admin.html`). 3 annonces gratuites, puis identité exigée. 1 seul dossier en production, resté en brouillon. L'effacement des dossiers échus ne se fait qu'à l'ouverture du tableau de bord admin, pas par une tâche planifiée. |
| Litiges | à tester | Refus avec mot secret et photos, réponse du vendeur ou du chauffeur, discussion à trois, arbitrage admin (schémas 57, 58, 61). 0 message de litige en production. Le numéro WhatsApp du service litiges est vide (`WA_LITIGES = ''` dans `v3/commandes.js`). |
