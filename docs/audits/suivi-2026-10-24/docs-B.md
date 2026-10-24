# Équipe B — textes à ajouter aux documents partagés (branche claude/regles-sans-contournement, schéma 93)

## docs/PASSATION.md — nouvelle section

### Schéma 93 : règles sans contournement (annonces, négociations, achats groupés) — 24/10/2026
Suite de l'audit du 24/10/2026 (P2 n° 7, 8, 9, 10, 11 ; P3 n° 30, 31, 34 ; contradictions 2, 6, 15, 16).
Appliqué sur le **projet de test** seulement (`yowdymdnoiubatxlwhfv`). Production : à appliquer avec l'accord du propriétaire, dans l'ordre 93a, 93b, 93c, 93d, 93e (sans les commentaires d'en-tête).

- **93a — annonces** (`supabase/schema-93a-annonces-regles.sql`)
  - Colonnes `expire_le`, `expiree_le`, `quantite_vue` sur `offres` et `demandes` ; droit de colonne `update (quantite_vue)` pour les membres (les dates restent au serveur).
  - Réglages `reglages.annonces` : `duree_jours` 30, `rappel_jours` 3, `grace_jours` 7, `nego_arret_heures` 24, `lot` 500, `debut` (date de mise en place). Modifiables par l'admin : `admin_annonces_regler(jsonb)`. Lecture publique de la durée : `annonces_duree_jours()`.
  - Table `villes_ref` (copie de `app/villes.js`, 124 villes) et `_ann_ville_ok(region, ville)`.
  - Déclencheur `_annonce_regles` (`offres_aa_regles`, `demandes_aa_regles`, passe avant les autres) :
    - publication : produit obligatoire ; ville de la liste de la région (ou « Village (près de Ville) ») ; prix > 0 pour une offre à prix ferme ; pas deux annonces identiques en ligne (même produit, unité, ville, quantité, prix) ; date de fin posée (30 jours) ;
    - modification par le membre : produit, unité, région, ville et « ville seulement » **figés** pendant une négociation ouverte ou un accord sans commande (`ANNONCE_FIGEE`) ; quantité vide refusée sur une offre (`QUANTITE_REQUISE`) ; **une quantité plus haute que celle du serveur n'est acceptée que si le téléphone envoie `quantite_vue` = quantité actuelle du serveur** (sinon le serveur garde sa quantité) : fin du « 160 sacs vendus pour 100 » ; quantité 0 : l'offre sort du marché ;
    - remise en ligne : nouvelle date de fin.
  - `annonce_maj_le` : ne bouge pas quand `mdg.systeme = 1` (écritures techniques).
  - « Retirer cache sans effacer » (décision 37) : politiques « retirer ses offres / demandes » passées à `using (false)` (ALTER POLICY, rien de supprimé). L'administration garde sa politique d'effacement.
  - `_boutique_verrou_stock` : verrou FOR UPDATE aussi pour les demandes.
- **93b — négociations et commandes** (`schema-93b-negociations-regles.sql`)
  - `nego_agir` : offre en pause → ni proposition ni accord (`ANNONCE_EN_PAUSE`) ; offre sans quantité → refus ; annonce verrouillée (FOR UPDATE) à l'accord, offre et demande ; négociation arrêtée par l'autre partie → pas de nouveau prix pendant 24 h (`NEGO_ARRETEE`, `_nego_arret_refus`).
  - `nego_ouvrir` : même délai de 24 h pour ouvrir une nouvelle négociation sur la même annonce.
  - `commande_creer2` : la ville de l'annonce est celle de la négociation (`negociations.ville`), plus celle d'aujourd'hui ; « ville seulement » contrôlé avec elle.
  - `revoke execute` de `commande_creer` et `nego_transport` pour anon et authenticated (commande_creer2 l'appelle encore en interne). Front : plus de repli vers ces fonctions (`v3/commandes.js`, `v3/negoce.js`).
- **93c — expiration** (`schema-93c-annonces-expiration.sql`)
  - `annonces_expirer()` toutes les 15 min (tâche `mdg-annonces-expirer`), par lots de 500 : annonce au bout de 30 jours → `status = 'retiree'` + `expiree_le` (jamais effacée). Pas d'expiration pendant une négociation ouverte, un accord sans commande ou un achat groupé en cours. Annonces d'avant le schéma : 30 jours après publication, jamais avant `debut + 7 jours`.
  - Rappel 3 jours avant (7 h–21 h seulement, une fois par date de fin) par `_notif_mettre` : type `demande_fin` (texte déjà dans `pousser`) pour une demande, type **`offre_fin`** pour une offre (**texte à ajouter dans la fonction `pousser`** : sans lui, la notification d'offre n'est pas envoyée).
  - `annonce_prolonger(cible, client_id)` : bouton « Prolonger 30 jours » de Mes publications ; remet aussi en ligne une annonce expirée.
- **93d — achats groupés, Racheter, besoins** (`schema-93d-groupes-regles.sql`)
  - `_groupe_refus` utilisé par `groupe_creer`, `groupe_rejoindre`, `groupe_confirmer`, `groupe_valider` : compte suspendu (le membre ou le vendeur), offre en pause, « ville seulement » (la zone doit contenir la ville de l'offre).
  - `_groupe_evaluer` : stock insuffisant à la confirmation → groupe « expiré » (prévenus par `push_groupe`) au lieu de rester bloqué ; `ville_arrivee` posée pour une offre « ville seulement » ; compte officiel : commission 0.
  - Déclencheur `offres_groupes_sortie` : offre retirée → groupes en cours « annulés » ; offre épuisée ou expirée → « expirés ».
  - `recommande_preparer` (Racheter) : plus d'offres en pause ni d'offres « ville seulement » d'une autre ville.
  - `besoin_repondre` : refusé après la fin de la période de livraison du besoin.
- **93e** : fonctions internes non appelables par les membres.
- **Front** : `v3/nuage.js` (quantité vue envoyée, envoi bloqué si la lecture du stock échoue, message quand le serveur garde son stock, messages clairs des refus, plus de repli d'effacement, `MDGNuage.prolonger`), `application.dc.html` (Mes publications : ligne « En ligne jusqu'au … / Expirée le … · Prolonger 30 jours » quand il reste 7 jours ou moins ; annonces expirées hors du marché), `v3/commandes.js`, `v3/negoce.js`. Cache `mgci-v284`. Pages `site/` refaites par `tools/site-public.js` (seul le `?v=` de nuage.js change).
- Tests : `supabase/tests/regles-93-scenarios.sql` (blocs A à E, tous annulés, résultats copiés en tête).
- Pièges : sur le test, ≈ 61 600 offres de simulation de plus de 30 jours expireront à partir du 31/10/2026 (fin du délai de grâce), 500 par quart d'heure (≈ 31 h). La tâche a pris 2,8 s à son premier passage (0,35 s dans l'essai).

## FONCTIONNALITES.md — lignes

- Annonces : une annonce reste en ligne 30 jours (réglable par l'administration), puis elle expire (cachée, jamais effacée) ; rappel 3 jours avant ; « Prolonger 30 jours » dans Mes publications. Schéma 93c.
- Annonces : produit, unité et ville ne changent plus pendant une négociation ou un accord sans commande ; ville vérifiée contre la liste de la région ; prix ferme > 0 ; pas deux fois la même annonce en ligne. Schéma 93a.
- Stock : le téléphone ne peut plus renvoyer une ancienne quantité (quantité vue sur le serveur). Verrou anti-survente aussi pour les demandes. Schéma 93a.
- Négociation : offre en pause → ni proposition ni accord ; négociation arrêtée → l'autre partie attend 24 h. Schéma 93b.
- Commande : la ville de départ est celle de la négociation. L'ancienne fonction de commande et le changement de transport hors proposition sont fermés aux membres. Schéma 93b.
- Achat groupé : « ville seulement », suspension et pause contrôlées ; groupe expiré si le stock manque ; groupe annulé si l'offre est retirée. Schéma 93d.
- Supprimer une annonce : impossible pour un membre (elle est retirée, la ligne reste). Schéma 93a.

## CHANGELOG.md — ligne

- 24/10/2026 — Schéma 93 (test) : règles sans contournement — annonce figée pendant une négociation, ville vérifiée, ancienne quantité refusée, expiration à 30 jours et « Prolonger 30 jours », offre en pause et négociation arrêtée respectées, achats groupés soumis à « ville seulement » et à la suspension, anciennes fonctions fermées aux membres, plus d'effacement d'annonce par un membre.

## PORTAGE-SITE.md — partie 4

- « Prolonger 30 jours » et l'état « Expirée » dans Mes publications (application.dc.html, `MDGNuage.prolonger`, schéma 93c) : à porter sur le site quand il aura ses publications.

## Décisions à demander au propriétaire

1. **Durée de vie d'une annonce** : 30 jours par défaut, rappel 3 jours avant, 7 jours de grâce pour les annonces déjà en ligne (réglable). À confirmer.
2. **Rôle acheteur / vendeur** (contradiction 16) : rien n'a été codé. Proposition : le rôle reste un affichage ; un membre peut acheter et vendre (beaucoup de grossistes font les deux). Bloquer selon le rôle casserait les comptes mixtes. À écrire comme règle si le propriétaire est d'accord.
3. **Délai après un arrêt de négociation** : 24 h (réglable `nego_arret_heures`). À confirmer.
4. **Texte de la notification « offre_fin »** à ajouter dans `pousser` (équipe notifications) — proposition : titre « Votre offre de {produit} finit le {date} », texte « Prolongez-la si vous avez encore du stock. ».
