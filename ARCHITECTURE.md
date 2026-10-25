# Architecture de Marché de Gros CI

État relevé le 24/10/2026, sur la branche `main` (commit `2fdc445`) et en direct dans la base de production (lecture du catalogue seulement).

Ce document décrit ce qui existe. Les fonctions prévues sont dans `ROADMAP.md`. L'état de chaque fonction est dans `FONCTIONNALITES.md`.

Aucune clé, aucun jeton, aucun mot de passe n'est recopié ici.

## 1. Vue d'ensemble

```mermaid
flowchart LR
  T[Téléphone] --> I[index.html : aiguillage]
  O[Ordinateur] --> I
  I -->|téléphone| A[application.dc.html]
  I -->|ordinateur, public| M[maintenance.html : QR code]
  I -->|ordinateur, admin| V3[index-v3.html : ancien site]
  ADM[admin.html] --> S
  A -->|REST + clé publique| S[(Supabase : Postgres, Auth, Storage)]
  V3 --> S
  SITE[site/ : nouveau site caché] -->|rpc fil_public, tableau_produits| S
  S -->|pg_net| P[Edge pousser : Web Push]
  S -->|pg_cron| S
  A -->|appel| IT[Edge itineraire : openrouteservice]
  P --> T
  GH[GitHub Pages + GitHub Actions] --> A
  GH --> SITE
```

En une phrase : des pages statiques hébergées gratuitement sur GitHub Pages, qui parlent directement à Supabase (base Postgres, comptes, fichiers) avec la seule clé publique. Toute la sécurité des données est dans la base (RLS et fonctions `security definer`).

## 2. L'application (priorité)

### 2.1 Fichiers

| Rôle | Fichiers |
|---|---|
| Page unique | `application.dc.html` (environ 2 000 lignes) |
| Moteur de gabarits | `support.js` (« dc-runtime », fichier généré, ne pas modifier à la main). Il charge React depuis `vendor/react.production.min.js` et `vendor/react-dom.production.min.js` |
| Gabarits | balises `sc-if`, `sc-for` et `{{ … }}` dans `application.dc.html`, plus le script `type="text/x-dc"` (l. 811) qui contient la classe du composant et le calcul des écrans (`renderVals()`) |
| Socle chargé au démarrage | `v3/nuage.js`, `app/admin-pc.js`, `v3/personnages.js`, `v3/avatar.js`, `app/icones.js`, `app/effets.js`, `app/marque.js`, `app/sac.js`, `app/garanties.js`, `app/toast.js`, `app/theme.js`, `v2/data.js` (catalogue), `app/marche-app.js`, `app/villes.js` |
| Chargés après coup (`defer`) | `app/nuit.js`, `app/stable.js`, `app/vibre.js`, `app/prixmoment.js`, `app/demo-orbite.js`, `app/activite.js` |
| Chargés à la demande (`window.MDGPlus`, l. 39) | guide, astuces, scène, porte, sons, négociation, compte, souffle, notifications, réputation, statuts, messages, aide, alertes, relevé, commandes, tableau, chauffeur, suivi, prix par zone, racheter, approvisionnement, groupes, carte (`app/carte-app.js`, `app/carte-gl.js`), identité, boutique (`v3/boutique.js`, schéma 86) |
| Bibliothèques embarquées (`vendor/`) | React, MapLibre GL, Tesseract (lecture de la pièce d'identité dans le téléphone), qrcode-generator, d3, topojson, GSAP, Lenis, Lucide |
| Police | Jost, fichiers `fonts/*.woff2` dans le dépôt (aucun appel à Google Fonts) |
| Page chauffeur sans compte | `suivi.html` (appels `/rest/v1/rpc/suivi_lien_*` avec la clé publique) |
| Administration | `admin.html` (noindex) avec `v3/nuage.js`, `v3/messages.js`, `v3/admin-transport.js`, `v3/admin-mesures.js`, `v3/admin.js` |

Chaque module expose un objet global : `MDGNuage`, `MDGCompte`, `MDGNegoce`, `MDGMessages`, `MDGCommandes`, `MDGIdentite`, `MDGRep`, `MDGPousse`, etc.

### 2.2 Client Supabase

`v3/nuage.js` est un client maison (appels `fetch` au REST de Supabase, pas de SDK).

- Compte : une adresse construite à partir du numéro (domaine fictif, aucun e-mail envoyé) et un code de 6 chiffres comme mot de passe Supabase Auth.
- Session gardée dans `localStorage` (`mdg-nuage:session`).
- Annonces : `refresh()` lit `annonces_version()`, puis `offres` et `demandes` actives (500 au plus) et `zones`. Relu toutes les 120 s. `sync()` envoie les annonces du téléphone (`on_conflict=user_id,client_id`).
- Le reste passe par des fonctions `rpc`.

### 2.3 Données gardées dans le téléphone

`localStorage` : mes annonces (`mdg-v2:offres`, `mdg-v2:demandes` ; aucune limite dans le téléphone, la limite de 30 annonces actives est posée par la base), cache du serveur (`mdg-nuage:*`), réglages (`mdg-app:theme`, `mdg-sons:reglages`, `mdg-app:vibrations`, `mdg-compte:prefs`), journal des notifications (`mdg-notifs`), drapeau administrateur (`mdg-site:admin`).

### 2.4 Service worker et hors ligne

`sw.js` (trois réserves ; le numéro du cache de code est `CACHE` dans le fichier) :

- `mgci-vNNN` (le code) change à chaque version, mais à l'installation un fichier déjà gardé sous la même adresse (même `?v=`) est recopié sans téléchargement : seuls les fichiers dont le `?v=` a changé sont téléchargés ;
- `fichiers-mgci` (durable : images, polices, icônes, `vendor/`, carte ; inventaire `mgci-inventaire.json`) ne change jamais de nom : rien n'y est retéléchargé ; pour remplacer un fichier sous le même nom, ajouter `?v=2` à son entrée dans `sw.js` ;
- `tuiles-mgci` (tuiles de carte).

Règles de la version précédente, toujours valables :

- pages, code et manifeste : réseau d'abord, cache si le réseau ne répond pas ;
- fichiers avec `?v=` et images : cache d'abord ;
- tuiles de carte (`s3.amazonaws.com`, `tiles.openfreemap.org`) : cache à part `tuiles-mgci`, 1 500 au plus ;
- le dossier `site/` n'est jamais servi par le service worker (`sw.js`, l. 179) ;
- notifications : écouteurs `push`, `notificationclick` (ouvre l'écran de l'adresse, signale l'ouverture par `notif_ouverte` avec la clé publique, sans rien de secret) et `pushsubscriptionchange` (se réabonne ; l'application l'enregistre). Une page déjà ouverte reçoit l'adresse par message (`mdg-lien`, `mdg-nego`, `mdg-dm`, `mdg-commande`, `mdg-chauffeur`) ; `application.dc.html` (`allerLien`) ouvre la page, chaque module sa fenêtre.

L'application se recharge seule quand une nouvelle version prend la main, jamais pendant une saisie (`application.dc.html`, l. 24). Hors connexion, l'écran reste affiché avec les dernières données et un bandeau (`app/sac.js`). Une annonce créée hors ligne attend dans le téléphone et part au retour du réseau.

`manifest.webmanifest` : démarre sur `application.dc.html`, affichage plein écran (`standalone`).

### 2.5 Protection « ordinateur → maintenance »

- `index.html` : un téléphone va vers l'application ; un ordinateur va vers `maintenance.html` ; l'administrateur reconnu (`mdg-site:admin`) va vers `index-v3.html`. `?app=1` et `?ordinateur=1` forcent un choix.
- `application.dc.html` (l. 17 à 22) : sur ordinateur, sans le drapeau administrateur, renvoi vers `maintenance.html` ; l'administrateur sur ordinateur va vers `index-v3.html`, sauf avec `?app=1`.
- `maintenance.html` : code QR, lien à copier, petit point caché pour l'administrateur.
- `app/admin-pc.js` : barre « Application · Ancien site · SEO », revérifiée par `est_admin` au serveur.

Cet aiguillage est un affichage. Il ne protège pas les données : la protection vient de la base.

## 3. Le site web

Hébergé sur GitHub Pages, sans nom de domaine. Tout le site est caché au public pour l'instant.

### 3.1 Ancien site (`index-v3.html`)

- React 18 et Babel dans la page (`vendor/babel.min.js`, secours sur unpkg.com), fichiers `v3/tweaks*.jsx`, GSAP, Lenis.
- Partage avec l'application : `v3/nuage.js`, `compte.js`, `messages.js`, `negoce.js`, `identite.js`, `reputation.js`, `statuts.js`, `personnages.js`.
- Garde : voile `#mdgGarde` tant que `est_admin` n'a pas répondu oui.

### 3.2 Nouveau site caché (`site/`)

- 55 pages HTML fabriquées par `tools/site-public.js` (Node, sans dépendance). Ne jamais modifier les pages fabriquées.
- Sources : gabarits `tools/site/*.html`, guides `tools/site/guides/*.html`, `tools/site-produits.js` (pages produits), `tools/site-regions.js` (districts), `tools/site-prix.js` et `tools/site/prix-ocpv.json` (prix OCPV), `v2/data.js`, `v2/saisons.js`, `app/geo/ci.json`, `app/marque.js`.
- Photos : `site/img/`, faites par `tools/site-images.py`.
- Fichiers écrits à la main : `site/site.css`, `site/site.js` (fil en direct, tableau, QR), `site/garde.js` (voile admin), `site/carte.js` (réutilise `app/carte-gl.js`).
- Données en direct : `fil_public(120)` et `tableau_produits(region)`.
- Toutes les pages sont en `noindex, nofollow`. `site/sitemap.xml` liste 55 adresses.

Mode d'emploi détaillé : `PORTAGE-SITE.md`, partie 6. Plan SEO : `docs/seo/PLAN.md`.

## 4. Supabase

### 4.1 Projets

| Projet | Rôle |
|---|---|
| `catmsypctymgkjkfzdkt` (organisation « mgci », plan gratuit) | production |
| `yowdymdnoiubatxlwhfv` (« mgci-test ») | essais avant la production ; contient encore des données de simulation |

Le front ne contient que la clé publique. Les clés privées (VAPID, clé partagée de `pousser`, clé openrouteservice) sont dans le coffre (Vault) ou les secrets des fonctions Edge.

**Schémas 92 à 96** (corrections de l'audit du 24/10/2026) : appliqués sur le projet de **test** seulement ; la production attend l'accord du propriétaire. Les changements de base sont gardés dans `supabase/schema-*.sql` (81 fichiers, du schéma 2 au schéma 81) et `supabase/a-lancer-*.sql`.

### 4.2 Extensions installées

`pg_cron` (tâches planifiées), `pg_net` (appels HTTP depuis la base), `supabase_vault` (coffre), `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `plpgsql`.

### 4.3 Les tables

54 tables dans le schéma `public`. **La RLS est activée sur toutes.** La colonne « Politiques » donne le nombre de politiques ; 0 veut dire que les clients n'y touchent pas directement et passent par des fonctions `security definer`.

| Table | Rôle | Politiques |
|---|---|---|
| `profils` | profil de chaque membre | 3 (voir, créer, modifier le sien) |
| `admins` | liste des administrateurs | 1 (lecture) |
| `secours`, `secours_essais`, `secours_ip_essais` | code de secours et limite d'essais | 0 |
| `verifications`, `identite_acces` | dossiers de vérification d'identité, journal des accès | 0 |
| `structure_verifs` | vérification des entreprises et coopératives | 0 |
| `bannis` | comptes bannis | 0 |
| `annonces_publiees` | compteur des 3 annonces gratuites | 0 |
| `offres` | annonces de vente | 7 |
| `demandes` | annonces d'achat | 7 |
| `zones` | zones signalées sur la carte par l'admin | 5 |
| `alertes_produits` | produits suivis par un membre | 4 (les siennes) |
| `alertes` | alertes de modération | 3 (admin) |
| `signalements` | signalements d'annonces | 3 |
| `signalements_membres` | signalements de personnes | 0 |
| `blocages` | membres bloqués | 0 |
| `negociations` | négociations sur une annonce | 1 (les siennes ou admin) |
| `messages` | messages d'une négociation | 1 (les siens ou admin) |
| `proposition_details` | détail d'une proposition de prix | 0 |
| `discussions`, `dm` | messages directs entre membres | 0 |
| `commandes` | commandes | 0 |
| `commande_etapes` | journal des étapes d'une commande | 0 |
| `commande_codes` | codes de remise | 0 |
| `commande_itineraires` | trajet calculé une fois par commande | 0 |
| `positions` | positions GPS du transport | 0 |
| `transporteurs`, `transport_missions` | transporteurs et missions | 0 |
| `suivi_liens`, `suivi_code_essais` | liens de suivi pour un chauffeur sans compte | 0 |
| `commissions`, `commission_journal` | commission due sur une vente (suivi, rien d'encaissé) | 0 |
| `commissions_transport`, `commission_transport_journal` | commission due sur le transport (suivi) | 0 |
| `sequestres`, `sequestre_journal`, `sequestre_versements` | séquestre (structure prête, aucun argent réel) | 0 |
| `litige_messages` | échanges d'un litige | 0 |
| `avis`, `avis_commandes` | avis et notes | 0 |
| `rappels_achat` | achats récurrents | 0 |
| `besoins` | approvisionnement professionnel | 0 |
| `groupes_achat`, `groupe_participants` | achats groupés | 0 |
| `conservation_journal` | une ligne par passage de la tâche `mdg-conservation` (état, lignes effacées par catégorie ; lecture équipe seulement, schéma 101d, test seulement) | 0 |
| `push_abonnements` | téléphones abonnés aux notifications | 1 (voir les siens) |
| `notif_reglages` | réglages de notification (ancien interrupteur unique, gardé) | 0 |
| `notif_categories`, `notif_regles`, `notif_prefs`, `notif_journal`, `notif_desactivations`, `notif_file` | catégories, plafonds, écart et heures calmes, préférences (sans effet depuis le schéma 91), journal des envois (clé anti-doublon, ouverture, action), désactivations, file d'attente (schémas 88a, 88b : en production depuis le 24/10/2026 ; schéma 91, colonne `notif_regles.ecart_min` : **projet de test seulement**) | non recompté ici |
| `push_annonce_jour`, `push_diffusions_jour`, `push_marketing_jour` | plafonds par jour | 0 |
| `marketing_reglage` | réglage des messages du marché | 0 |
| `code_demandes` | demandes de remise à zéro du code | 0 |
| `site_mesures` | mesure d'audience anonyme du site | 0 |
| `boutiques`, `boutique_passages`, `boutique_sels` | boutiques des vendeurs, visites comptées une fois par visiteur et par jour, sel du jour (schéma 86, projet de test seulement) | 0 |

| `stock_mouvements` | stock pris par chaque accord, stock rendu, « sans suite » (schéma 92a, **test seulement**) | 0 (lecture par fonctions) |
| `villes_ref` | copie de la liste des villes de `app/villes.js` (124 villes), pour vérifier la ville d'une annonce (schéma 93a, **test seulement**) | 0 |
| `admin_journal` | journal des gestes de l'équipe (schéma 94b, **test seulement**) | lecture équipe seulement |
| `signalement_masquages` | annonces cachées par des signalements, contestation et décision de l'équipe (schéma 94e, **test seulement**) | 0 |
| `tableau_prix_cache` | tableau des prix par région, recalculé toutes les 5 min (schéma 96a, **test seulement**) | 0 |
| `niveaux_regles`, `niveaux_membres`, `niveaux_journal`, `niveaux_contestations` | niveaux de confiance (schéma 85) : paliers, état de chaque membre, historique (ajout seulement), contestations | 0 (lecture par fonctions seulement) |

### 4.4 Politiques RLS principales

- `offres` et `demandes` : lecture par tous (anonyme compris) des annonces actives ou des siennes ; publication, modification et retrait de ses propres annonces ; l'admin lit, modère et supprime.
- `zones` : lecture publique des zones non expirées ; l'admin voit tout, crée, modifie, retire.
- `signalements` : tout le monde peut signaler ; seul l'admin lit et supprime.
- `negociations`, `messages` : seulement les parties et l'admin.
- `profils`, `alertes_produits`, `push_abonnements` : seulement les siens.
- `alertes`, `admins` : admin.

Stockage (buckets) :

| Bucket | Public | Taille max | Usage |
|---|---|---|---|
| `avatars` | oui | 300 Ko | photo de profil |
| `activites` | oui | 400 Ko | photos du profil public, logo et preuves de structure |
| `identite` | non | 1,5 Mo | pièces d'identité : lecture par l'admin, et par le membre tant que son dossier peut encore être effacé |
| `preuves` | non | 450 Ko | preuves de signalement et de refus de commande : chacun dépose dans son dossier ; lecture par l'admin, et par les parties pour un refus de commande |

### 4.5 Fonctions SQL

279 fonctions dans `public`, dont 240 en `security definer`. Les principales, par sujet :

- **Compte** : `est_admin`, `est_admin_id`, `creer_secours`, `secours_reinitialiser`, `pseudo_libre`, `supprimer_compte`, `admin_reinitialiser`, `admin_comptes`.
- **Profil public et réputation** : `profils_publics3`, `profil_public`, `reputation_publique`, `delais_publics` (schéma 89 : livraison du vendeur, validation de l'acheteur), `notes_publiques`, `avis_de2`, `mieux_notes`, `statuts_publics`, `avis_commande_donner`.
- **Identité** : `identite_commencer`, `identite_soumettre`, `identite_statut`, `identite_ok`, `admin_identite_*`.
- **Confiance** : `garde_publication`, `limite_annonces`, `annonces_gratuites` (3), `garde_textes` et `texte_refus` (pas de liens ni de numéros), `admin_bannir`, `signaler_membre`.
- **Annonces et marché** : `annonces_version`, `tableau_produits`, `tableau_marche`, `prix_zones`, `produits_activite`, `ventes_recentes`, `fil_public`, `stats_publiques`.
- **Négociation et messages** : `nego_ouvrir`, `nego_agir`, `nego_transport`, `marquer_lu`, `dm_*`, `contact_marche`, `admin_diffuser`.
- **Commandes et transport** : `commande_creer`, `commande_repondre`, `commande_avancer`, `commande_annuler`, `mes_commandes2`, `transporteur_*`, `chauffeur_*`, `commande_valider_code`, `suivi_lien_*`.
- **Colis au départ** (schémas 90, 90b) : `commande_depart_preuves`, `commande_depart_defi`, `commande_depart_mot` ; déclencheur `commande_etapes_chargement_preuves` (pas de chargement sans photos, poids et photo du papier du mot secret).
- **Commissions** : `_commission_sync`, `mes_commissions`, `admin_commissions`, `mes_commissions_transport`. Elles calculent un montant dû. Rien n'est encaissé.
- **Séquestre et litiges** : `sequestre_depot_confirme` (réservée au rôle service, aucun appelant réel), `commande_liberer`, `admin_liberer`, `sequestre_liberer_echus`, `commande_litige`, `litige_ecrire`, `admin_litige_trancher`. Aucun argent ne circule.
- **Décisions juridiques (schémas 101a à 101e, test seulement)** : `profil_public` (totaux seulement sans compte, champ `detail`), `_groupe_evaluer` (transport de l'offre), `admin_numero_rendre(tel, motif, piece_vue, appel_fait)` et porte `_admin_numero_rendre_base` (fermée aux membres), conservation `_cons_notif`, `_cons_preuves`, `_cons_photos_restantes`, `_cons_signalements`, `_cons_signalements_membres`, `_cons_masquages`, `_cons_sanctions`, `_cons_commandes`, `_cons_annulations`, `_cons_negociations`, `_conservation_compte`, `conservation_compter` (équipe), `conservation_passage`, `preuve_purgeable`, `admin_preuves_a_effacer` (équipe), `_conservation_effacer` (101e, à coller).
- **Achats récurrents, pros, groupés** : `recommande_preparer`, `mes_rappels`, `rappels_envoyer`, `besoin_creer3`, `besoins_liste`, `besoin_repondre`, `groupe_*`, `groupes_echeances`.
- **Notifications** : `push_abonner`, `push_desabonner`, `notif_reglage_moi`, `push_config` (rôle service), `push_*` des déclencheurs, `marketing_tick`. Schémas 88a, 88b, 88d (en production depuis le 24/10/2026) : `notif_preparer`, `notif_resultat`, `notif_desactivation_noter` (rôle service), `notif_ouverte` (anon et membres), `push_quitter`, `notif_permission_retiree`, `notif_prefs_moi`, `notif_pref_regler`, `notif_reglage_diffusions` (gardée), `notif_stats`, `notif_stats_jours`, `notif_regles_regler` (admin), `notif_cible_annonce`, `notif_cible_marche`, `notif_cible_conseils`, `notif_fourchette`, `notif_groupes_veille`, `notif_renouveler_calculer`, `notif_lots_prendre`, `notif_actions_calculer`, `notif_tick`. Schéma 91 (**projet de test seulement**, production après l'accord du propriétaire) : `notif_relances` (N1 à N9), `_notif_mettre`, `_notif_dernier_com`, `_notif_ecart_ok`, `_notif_rang`, `notif_annonces_recentes`, `notif_deja_vus` ; `_notif_pref` répond toujours « oui » (les anciennes préférences ne comptent plus).
- **Corrections de l'audit (schémas 92 à 96, test seulement)** : stock et délais `commandes_delais`, `commande_delais`, `commande_annuler_retard`, `accords_sans_suite`, `admin_commandes_regler`, `commandes_regles`, `admin_commande_issue`, `admin_litige_partager`, `_cmd_rendre_stock`, `_cmd_alerte` ; annonces `annonces_expirer`, `annonce_prolonger`, `admin_annonces_regler`, `annonces_duree_jours`, `_annonce_regles`, `_nego_arret_refus`, `_groupe_refus` ; confiance `_nom_reserve`, `admin_numero_rendre`, `admin_reinitialiser_journal`, `_equipe_ecrire`, `admin_paires_fermees`, `mes_annonces_masquees`, `signalement_contester`, `admin_annonce_retablir`, `admin_annonce_maintenir`, `admin_annulation_classer`, `_fiab_litige_perdu` ; transport et argent `_transport_reseau_min`, `_cmd_argent_passe`, colonne `statut_registre` (commissions « calculée » ou « due » ; la valeur qui fait foi est `coalesce(statut_registre, statut)`) ; technique `tableau_prix_calculer`, `_notif_objet_vivant`, `notif_besoins_ouverts`, `stockage_volume`, `dm_envoyer(…, p_client)`.
- **Mesure du site** : `mesurer`, `mesures_resume` (admin).
- **Boutiques** (schéma 86, projet de test seulement) : `boutique_publique`, `boutiques_de`, `boutiques_publiques`, `ma_boutique`, `boutique_activer`, `boutique_mesurer` ; outils internes `_boutique_*` (nom, adresse, état d'une offre, catalogue, boutique cachée).

### 4.6 Déclencheurs

63 déclencheurs sur les tables de `public`. Les grandes familles :

- **Garde des annonces** (`offres`, `demandes`) : bannissement, 3 annonces gratuites puis identité vérifiée, 30 annonces actives au plus (`garde_publication`, `limite_annonces`), textes sans contacts, numéro jamais public, nom du compte, compte officiel, date de mise à jour, stock, négociations closes si l'annonce est retirée ; exigences d'une demande (`demande_exigences`).
- **Garde des messages** (`messages`, `dm`) : textes, contrôle des sorties, bannis.
- **Négociations** : figée une fois conclue, stock, transport, bannis ; schéma 86 : verrou contre la survente (`negociations_verrou_stock`) et refus sur une offre en pause (`negociations_boutique_pause`, aussi sur `groupes_achat`).
- **Annonces, schéma 86** : `offres_boutique` / `demandes_boutique` (quantité obligatoire, quantité de départ, retrait avec trace), `offres_boutique_retrait` / `demandes_boutique_retrait` (négociations fermées au retrait) ; profils : `profils_boutique_pseudo`, `profils_boutique_supprime`.
- **Commandes** : synchronisation des commissions (vente et transport), séquestre, mot de réception, pause du réseau de transport. Les journaux (`commission_journal`, `commission_transport_journal`, `sequestre_journal`, `litige_messages`) ne peuvent plus être modifiés une fois écrits.
- **Profils** : textes, photos et structure propres, nom repris sur les annonces, dossier d'identité à la suppression du compte.
- **Signalements** : modération après un signalement (`apres_signalement`) ; schéma 94e (test seulement) : seuls des membres vérifiés et anciens font cacher une annonce.
- **Schémas 92 à 96 (test seulement)** : `commandes_stock_retour` (stock rendu), `offres_aa_regles` / `demandes_aa_regles` (règles d'annonce), `offres_groupes_sortie` (groupes fermés quand l'offre sort), `profils_confiance` (noms réservés).
- **Notifications** (`push_*`) : sur `messages`, `dm`, `alertes`, `offres`, `demandes`, `verifications`, `commande_etapes`, `transporteurs`, `transport_missions`, `besoins`, `groupes_achat`, `groupe_participants`, `code_demandes`, `litige_messages`. Ils appellent la fonction Edge `pousser` par `pg_net`.

### 4.7 Tâches planifiées (pg_cron)

Toutes actives en production :

| Tâche | Quand | Rôle |
|---|---|---|
| `mdg-marketing` | toutes les 5 min | `marketing_tick` : messages du marché (30 par jour au plus, de 7 h à 21 h UTC, soit l'heure d'Abidjan ; réglage dans `marketing_reglage`) |
| `mdg-liberer-echus` | toutes les 5 min | `sequestre_liberer_echus` : marque « libérée » une commande terminée depuis 1 h (schéma 89) sans réclamation (écriture dans le journal seulement, aucun argent) |
| `mdg-commandes-delais` | toutes les 5 min (schéma 97b, en production depuis le 25/10/2026) | `commandes_delais` : rappels et retard de chargement, rappel de réception à mi-délai, litige ouvert tout seul 1 h après « livré » sans réaction de l'acheteur (`litige_auto_le`), puis clôture en faveur du vendeur 1 h plus tard sans réaction (schéma 97b ; rien n'est versé), litiges en retard, accords sans suite |
| `mdg-groupes-echeances` | toutes les 15 min | `groupes_echeances` : fin des achats groupés |
| `mdg-rappels-achat` | toutes les 15 min | `rappels_envoyer` : rappels des achats récurrents (rien n'est acheté) |
| `mdg-effacer-messages` | chaque heure, à la minute 23 | `dm_purger` : efface les messages directs et discussions de plus de 365 jours (`dm_duree`) |
| `mdg-purger-positions` | chaque nuit, 3 h 23 UTC | `positions_purger` : effacement des positions GPS |
| `mdg-niveaux` | chaque nuit, 4 h 37 UTC | `niveaux_recalculer` : niveaux de confiance (fenêtre de 12 mois, fin des sursis) |
| `mdg-identites-matin` | chaque matin, 7 h 45 UTC | `push_resume_identites` : résumé des identités à examiner pour l'admin |
| `mdg-annonces-expirer` | toutes les 15 min (schéma 93c, **test seulement**) | `annonces_expirer` : annonces de plus de 30 jours cachées (par lots de 500, jamais effacées), rappel 3 jours avant |
| `mdg-prix` | toutes les 5 min (schéma 96a, **test seulement**) | `tableau_prix_calculer` : recalcule `tableau_prix_cache` |
| `mdg-conservation` | chaque nuit, 2 h 41 UTC (schéma 101d, **test seulement**) | `conservation_passage` : durées de conservation (notifications 90 jours, photos de preuve 1 an, signalements et sanctions 2 ans, commandes et négociations 5 ans) ; appelle `_conservation_effacer` (schéma 101e, à coller) si elle existe, sinon note « en_attente » ; une ligne par passage dans `conservation_journal` |
| `mdg-notif` | envoi toutes les 5 min (schéma 97d, en production depuis le 25/10/2026), calculs toujours un passage sur trois | `notif_tick` : alertes regroupées, groupes bientôt complets, produits à racheter, actions après ouverture. Avec le schéma 91 (**projet de test seulement**, production après l'accord du propriétaire), il appelle aussi `notif_relances` (9 déclencheurs commerciaux, de 7 h à 21 h) |

### 4.8 Fonctions Edge

Le fichier `supabase/functions/pousser/index.ts` du dépôt est en **v25** (textes du litige en 1 h, schéma 97b ; v24 : rappels de commande, rappel `offre_fin`, `notif_besoins_ouverts`) : **déployé en production le 25/10/2026** (version 25, code relu identique au dépôt). La ligne ci-dessous peut décrire une version plus ancienne.

| Fonction | Version | Rôle |
|---|---|---|
| `pousser` (`supabase/functions/pousser/index.ts`) | 23 en production depuis le 24/10/2026 au soir (textes N1 à N9, contenu du marché, schéma 91 ; même code que le fichier du dépôt, vérifié caractère par caractère), déployée après le schéma 91 | envoie les notifications Web Push (bibliothèque `web-push`). `verify_jwt` désactivé : protégée par une clé partagée lue dans le coffre, ou par le jeton de session pour l'essai |
| `itineraire` (`supabase/functions/itineraire/index.ts`) | 1 | `verify_jwt` désactivé, mais la fonction exige le jeton de session d'un membre (sinon 401). Calcule une fois le trajet d'une commande avec openrouteservice (offre gratuite), clé dans les secrets Supabase. Appelée par `v3/suivi.js`. Un seul résultat en production, de source « introuvable » : non vérifiée en conditions réelles |

## 5. Permissions

| Qui | Ce qu'il peut faire |
|---|---|
| **Anonyme** (clé publique, sans compte) | lire les annonces actives et les zones ; signaler une annonce ; appeler les fonctions publiques (`fil_public`, `tableau_produits`, `prix_zones`, `stats_publiques`, `identite_verifiee`, `secours_reinitialiser`, `mesurer`, `suivi_lien_infos`, `suivi_lien_ouvert`, `suivi_lien_position` pour le chauffeur ; `suivi_lien_creer` et `suivi_lien_etat` sont réservées aux membres connectés) |
| **Membre connecté** | tout ce qui précède ; gérer son profil, ses annonces, ses alertes, ses téléphones ; voir ses négociations et messages ; tout le reste par les fonctions `security definer`, qui vérifient `auth.uid()` |
| **Administrateur** | reconnu par `est_admin()` (table `admins`) ; lire et modérer annonces, signalements, alertes, négociations, messages ; toutes les fonctions `admin_*`, qui revérifient `est_admin()` dans leur corps (seule exception : l'ancienne `admin_identite_decider`, qui ne fait plus que renvoyer une erreur et n'est pas ouverte aux membres) |
| **Rôle service** | réservé à la base et aux fonctions Edge (`push_config`, `sequestre_depot_confirme`) ; jamais dans le front |

## 6. Intégrations externes

Toutes gratuites :

- **Cartes** : MapLibre GL (embarqué), fond OpenFreeMap (`tiles.openfreemap.org`), relief Terrarium (`s3.amazonaws.com`), trajets de la carte par notre fonction `itineraire` (mode `points`, plus d'OSRM public depuis le 25/10/2026), openrouteservice dans la fonction `itineraire`.
- **Polices** : Jost, hébergée dans le dépôt.
- **Notifications** : Web Push des navigateurs, par la fonction `pousser`. Clés VAPID dans le coffre Supabase.
- **Lecture de pièce d'identité** : Tesseract, dans le téléphone (`vendor/tesseract`), rien n'est envoyé à un service extérieur.
- **Données publiques** : prix de l'OCPV, lus et cités avec leur source.
- **GitHub Pages** : hébergement.
- **GitHub Actions** (`.github/workflows/`) :
  - `site-public.yml` : refait photos et pages du site quand ses sources changent, puis enregistre dans `main` ;
  - `strategie-pdf.yml` : refait les PDF de `strategie/` chaque lundi et quand leurs sources changent ;
  - `ocpv-note.yml` : lundi soir et mardi matin, télécharge la note publique de l'OCPV ;
  - `rapport-site.yml` : refait l'inventaire de `PORTAGE-SITE.md`, partie 7.
- **unpkg.com** : secours pour Babel sur l'ancien site seulement.

## 7. Ce qui n'existe pas

- **Aucun prestataire de paiement.** Pas de Mobile Money, pas de carte. Le séquestre, les reversements et les commissions sont des tables et des calculs : aucun argent n'est reçu ni versé.
- **Aucun SMS ni WhatsApp.** Le numéro de téléphone n'est jamais prouvé.
- **Aucun anti-robot** (Cloudflare Turnstile non installé).
- **Aucune vérification d'identité automatique** par un service extérieur : l'admin examine les dossiers à la main.
- **Aucun outil d'audience extérieur** : seulement `site_mesures` (0 ligne au 24/10/2026).
- **Aucune application dans les magasins** (Play Store, App Store) : c'est une application web installable.
- **Aucun nom de domaine** : adresse GitHub Pages.
