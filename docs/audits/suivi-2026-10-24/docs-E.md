# Équipe E — branche `claude/technique` — textes à reporter dans les documents partagés

## docs/PASSATION.md — nouvelle section

### Technique : mises à jour légères, tableau des prix, notifications fiables, messages sans doublon (schéma 96, 24/10/2026)

Audit P1 n° 6, P2 n° 22-25, P3 n° 35, 37, 39. Branche `claude/technique`. Schémas 96a à 96f **appliqués sur le projet de TEST seulement** (production : à faire avec l'accord du propriétaire, dans l'ordre a → f). La fonction `pousser` a été modifiée dans le dépôt (v24) mais **n'est déployée nulle part**.

1. **Service worker (`sw.js`, P1 n° 6)** : deux réserves. `mgci-vNNN` (le code) change à chaque version, mais à l'installation un fichier déjà gardé sous la même adresse (même `?v=`) est recopié sans téléchargement ; seuls les fichiers dont le `?v=` a changé dans `application.dc.html` sont téléchargés. `fichiers-mgci` (images, polices, icônes, `vendor/`, carte) ne change jamais de nom : rien n'y est retéléchargé. Pour remplacer une image sous le même nom : ajouter `?v=2` à son entrée dans `IMAGES` (ou `CARTE`, `DURABLES`). Plus de `cache:'reload'`.
   Mesure Chromium (iPhone 13 émulé, serveur local qui compte les octets, version 2 = `CACHE`+1 et `v3/negoce.js` modifié) :
   - avant : **222 requêtes, 17 603 Ko** (≈ 10 854 Ko compressés) à la nouvelle version, puis 2 192 Ko à la réouverture (les modules `?v=` retéléchargés une 2e fois) ;
   - après : **3 requêtes, 444 Ko** (≈ 122 Ko compressés : la page, `negoce.js`, `sw.js`), puis 997 Ko à la réouverture (fichiers sans `?v=` lus au réseau d'abord : page, `support.js`, `app/geo/ci.json`… comme avant) ;
   - passage de l'ancien service worker au nouveau (une seule fois) : 58 requêtes, 1 951 Ko ;
   - hors ligne après la mise à jour : l'application s'ouvre (vérifié dans les 3 cas).
2. **Tableau des prix (schéma 96a, P2 n° 23)** : `tableau_prix_cache` (une ligne par région, « » = pays), recalculée toutes les 5 min par la tâche `mdg-prix` (`tableau_prix_calculer`, 4,3 s pour 37 régions sur le test). `tableau_produits(p_region)` lit ce JSON (même forme qu'avant). Meilleure offre, médiane et meilleure demande : seulement les annonces de moins de 30 jours (création ou dernière modification) et sans prix aberrant (hors [médiane/5 ; médiane×5] par produit et unité). **4 306 ms → 1,5 ms** (`explain analyze`, test, 90 144 offres). `annonces_version()` ne compte plus les annonces actives : il lit le plus récent `maj_le` par l'index (152 ms → 15 ms). Limite : une ligne effacée pour de bon ne change plus ce résumé (les annonces ne sont plus effacées depuis le schéma 86).
3. **Notifications (schéma 96b, P2 n° 22)** : `_notif_objet_vivant` revérifie l'objet (offre active et pas en pause, demande active, négociation ouverte avec proposition en attente, accord sans commande, achat groupé ouvert) dans `notif_lots_prendre` (le message passe « perime ») et dans `notif_preparer` (refus « ignore », détail `objet_perime` dans le journal). Lot raté (téléphones connus, 0 envoi) : remis en attente par `notif_resultat`, 3 essais au plus ; lot pris mais jamais préparé : remis en attente après 30 min. Nouvelles colonnes `notif_file.essais`, `notif_file.lot_id`, `notif_journal.detail`. `notif_besoins_ouverts()` : besoins encore actuels (date de fin non passée ; sans date, moins de 30 jours) pour « N professionnels cherchent ». `pousser` v24 l'utilise et ajoute le texte du rappel « offre_fin » du schéma 93c (équipe B) : « Votre offre de X se termine demain » / « Encore du stock ? Prolongez-la de 30 jours dans Mes publications. » (fichier seulement, **non déployé** ; le rappel ne part que si l'offre est encore active).
4. **Messages privés (schéma 96c, P2 n° 25)** : colonne `dm.client_id` + index unique (auteur, client_id) ; `dm_envoyer(p_discussion, p_texte, p_client)` rend le message déjà arrivé au lieu d'en créer un 2e ; l'ancienne `dm_envoyer(p_discussion, p_texte)` passe par la nouvelle. `v3/messages.js` : chaque message a un identifiant unique et attend dans `mdg-dm:file` (téléphone) tant que le serveur ne l'a pas reçu ; il repart tout seul (retour du réseau, retour sur l'application, toutes les 30 s) ; bulle « Partira dès le retour du réseau ». Le dernier texte de la conversation est maintenant le texte masqué par le serveur (avant : le texte brut).
5. **Annonces (P3 n° 37, vérifié dans Chromium)** : le risque était réel. Avec 30 annonces sur le téléphone, la 31e publiée faisait sortir la plus ancienne de la liste locale, et la synchronisation la **retirait du serveur** (test : PATCH `status=retiree` sur l'annonce absente). Corrigé dans `v3/nuage.js` : seule une annonce que le membre a retirée lui-même (« Retirer », noté dans `mdg-nuage:a-retirer`) est retirée du serveur ; une annonce simplement absente du téléphone est oubliée ici et revient par « rapatrier ». Retrait marqué dans `application.dc.html`, `index-v3.html` et `v3/vendre.js`.
6. **Politiques d'accès (schéma 96d, P3 n° 39)** : `(select auth.uid())` dans `messages`, `notif_journal`, `push_abonnements` (`alter policy`, même règle). Test `supabase/tests/notifications-88-scenarios.sql` bloc 1 refait pour le schéma 91.
7. **Photos (P2 n° 24)** : photos publiques (profil public, logo de structure) en WebP quand le téléphone sait l'écrire, JPEG sinon (Safari) : **28 % plus légères** (5 photos du dépôt, 1 000 px : 482 Ko → 349 Ko). `stockage_volume()` (schéma 96e, administrateur seulement) : fichiers, poids total, poids des 30 derniers jours, plus ancien fichier, par espace de stockage. **Rien n'est effacé.**
8. **Alertes produits (schéma 96f, P3 n° 35)** : `notif_cible_annonce` prévenait 200 personnes au plus, toujours les mêmes (tri par identifiant). Maintenant : tous les abonnés du produit (jusqu'à 2 000) ; les autres (déjà acheté, région, vendeurs) dans un ordre qui change à chaque annonce. Textes du rythme réel dans le panneau des alertes, le tutoriel et l'aide.

Tests (projet de test, tout annulé) : `supabase/tests/tableau-prix-scenarios.sql`, `notif-objet-vivant-scenarios.sql`, `dm-anti-doublon-scenarios.sql`, `stockage-volume-scenarios.sql`, `alertes-ciblage-scenarios.sql`, `notifications-88-scenarios.sql` (bloc 1).

Pas fait : itinéraires de la carte par la fonction `itineraire` (n° 40 : il faudrait changer la fonction pour accepter deux points, la déployer et partager le quota gratuit openrouteservice de 2 000 trajets/jour avec les commandes : pas simple) ; pagination de la carte et de la recherche (n° 23, pas simple) ; retrait des index en double `sim_tmp_*` (projet de test seulement, demande un `drop index` refusé par l'outil) ; `(select auth.uid())` sur `offres`, `demandes`, `negociations`, `profils` (autres équipes).

## docs/REPRISE.md

- État : schéma 96 (a-f) prêt sur la branche `claude/technique`, appliqué sur le test seulement ; production à appliquer avec l'accord du propriétaire (a → f), puis redéployer `pousser` v24 avec son accord.
- Reste : `(select auth.uid())` sur offres/demandes/negociations/profils ; index `sim_tmp_*` (test) ; itinéraires de la carte ; pagination carte/recherche ; affichage de `stockage_volume()` dans le tableau de bord admin ; durée de conservation des photos (décision du propriétaire).

## FONCTIONNALITES.md

- Mises à jour légères : une nouvelle version ne retélécharge que les fichiers changés (images, polices, carte gardées) — `sw.js`.
- Tableau des prix calculé toutes les 5 min, prix récents (30 jours) et sans valeur aberrante — `tableau_prix_cache`, `tableau_prix_calculer`, `tableau_produits`, tâche `mdg-prix` (schéma 96a).
- Notifications : objet revérifié avant l'envoi, lot raté réessayé (3 fois) — `_notif_objet_vivant`, `notif_lots_prendre`, `notif_preparer`, `notif_resultat` (schéma 96b).
- Messages privés sans doublon et gardés sur le téléphone en cas de coupure — `dm.client_id`, `dm_envoyer(…, p_client)`, `v3/messages.js` (schéma 96c).
- Suivi du volume des photos (administrateur) — `stockage_volume()` (schéma 96e).
- Alertes produits : tous les abonnés prévenus — `notif_cible_annonce` (schéma 96f).

## CHANGELOG.md

- 24/10/2026 — Mises à jour : 17,6 Mo → 0,44 Mo téléchargés à chaque nouvelle version (mesuré dans Chromium).
- 24/10/2026 — Tableau des prix : 4,3 s → 1,5 ms ; meilleure offre sur les annonces de moins de 30 jours, sans prix aberrant.
- 24/10/2026 — Notifications : plus d'annonce d'une offre retirée ; un envoi raté repart (3 essais).
- 24/10/2026 — Messages privés : un message renvoyé après une coupure n'arrive qu'une fois ; il attend le réseau sur le téléphone.
- 24/10/2026 — Correction : une annonce ne quitte plus le marché parce qu'elle manque sur le téléphone (liste locale de 30).
- 24/10/2026 — Photos de profil 28 % plus légères (WebP) ; suivi du volume des photos pour l'administrateur.
- 24/10/2026 — Alertes produits : au-delà de 200 abonnés, tous sont prévenus.

## ARCHITECTURE.md

- `sw.js` : réserves `mgci-vNNN` (code, versionnée, recopie par `?v=`), `fichiers-mgci` (durable : images, polices, icônes, `vendor/`, carte ; inventaire `mgci-inventaire.json`), `tuiles-mgci` (tuiles).
- Tables : `tableau_prix_cache` ; colonnes `notif_file.essais`, `notif_file.lot_id`, `notif_journal.detail`, `dm.client_id`.
- Tâche planifiée : `mdg-prix` (toutes les 5 min).

## PORTAGE-SITE.md, partie 4

- Messages privés : file d'attente sur l'appareil et identifiant unique par message (`v3/messages.js`, module commun : déjà sur le site si `messages.js` y est chargé — `index-v3.html` le charge).
- (Rien d'autre : `v3/nuage.js`, `v3/vendre.js`, `index-v3.html` sont déjà corrigés pour le retrait des annonces.)

## Proposition de changement de règle (CLAUDE.md, « À chaque changement du front »)

Remplacer :
> augmenter `CACHE` dans `sw.js` (format `mgci-vNNN`) ; ajouter les nouvelles images à la liste `IMAGES` de `sw.js`.

par :
> augmenter `CACHE` dans `sw.js` (format `mgci-vNNN`) : cela ne retélécharge plus que les fichiers dont le `?v=` a changé, donc c'est peu coûteux ; **le `?v=` des fichiers modifiés reste obligatoire** (sans lui, le téléphone garde l'ancienne copie hors ligne). Ajouter les nouvelles images à `IMAGES` ; pour **remplacer** une image, une police ou un fichier `vendor/` sous le même nom, ajouter `?v=2` (puis 3…) à son entrée dans `sw.js` (augmenter `CACHE` ne suffit plus). Une fois le public ouvert : une mise en ligne par jour au plus.
