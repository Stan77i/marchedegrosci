# Équipe C (Confiance) — textes pour la PR de documentation

Branche : `claude/confiance` (commit 13bbae4). Schémas 94a à 94h, appliqués sur le projet de TEST seulement. Production : pas encore (accord du propriétaire).
Ordre d'application en production : 94a, 94b, 94c, 94d (+ correctif « paire_alerte_part » déjà dans le fichier 94d), 94e, 94f, 94g, 94h.
(94e utilise `_equipe_ecrire` et `admin_journal` de 94b ; 94f utilise la colonne `annulations.a_examiner` créée aussi dans 94d.)

## Section PASSATION (à ajouter)

### Schéma 94 : confiance (audit du 24/10/2026, équipe C)
- **94a noms réservés** : déclencheur `profils_confiance` (`_profil_confiance`, `_nom_normalise`, `_nom_reserve`). Refuse « Marché de Gros », « marché du gros », MGCI, admin, modérateur, support, service client, équipe, officiel, staff, après normalisation (sans accents, espaces, ponctuation ; 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s), dans le prénom, le nom, les deux ensemble, le pseudo (= adresse de boutique) et le nom de structure. Le compte officiel et l'équipe sont exemptés. `pseudo_libre` dit non pour un nom réservé. **Identité vérifiée** : prénom et nom ne changent plus (refus clair) ; la suppression du compte reste possible.
- **94b numéro et journal** : table `admin_journal` (lecture équipe seulement). `_equipe_ecrire(membre, texte)` : message du Marché de Gros dans Messages. `admin_numero_rendre(tel, motif)` (« numéro contesté ») : détache le numéro du compte qui le tient (adresse `conteste-225…@detache.marchedegros.ci`), ferme ce compte, cache ses annonces, rien n'est effacé, journalisé. `admin_reinitialiser_journal(compte, code, motif)` : motif obligatoire, journal (jamais le code), message au membre ; l'ancienne `admin_reinitialiser` n'est plus appelable par personne (elle reste la « porte » interne, elle contient un DELETE). **Compte supprimé** : le numéro est libéré (`profils_numero_libere`), sauf pour un banni. `admin_discussions` : numéro tiré de l'adresse de connexion, plus des métadonnées envoyées par le téléphone.
- **94c pièce unique** : `admin_identite_decider` exige le numéro de la pièce (recopié par l'équipe) et refuse une pièce déjà vérifiée sur un autre compte ouvert (`_piece_norm`).
- **94d badges anti-complices** : `_niv_calculer` compte au plus `plafond_partenaire` commandes par partenaire (3, pour Fiable, Bon et Acheteur en gros ; Excellent et Grand gardent 5), exige `partenaires_min` partenaires différents (3) et `delai_min_minutes` (60) entre création et réception. `admin_paires_fermees()` (aussi dans `admin_niveaux().paires`) : paires avec au moins 3 commandes terminées qui font au moins 60 % des commandes de l'un. Tous réglables (`admin_niveaux_regler`). `_niv_texte` et `niveaux_criteres` les affichent.
- **94e signalements** : plus de masquage par des comptes neufs : seuls 3 signaleurs à l'identité vérifiée et inscrits depuis 30 jours cachent une annonce (`reglages.confiance` : `signal_seuil` (0 = jamais), `signal_anciennete_jours`, `signal_verifie`). Le vendeur reçoit un message ; il voit l'annonce dans Mon compte → « Annonce cachée » et peut contester une fois (`mes_annonces_masquees`, `signalement_contester`). L'équipe rétablit (`admin_annonce_retablir`) ou garde cachée (`admin_annonce_maintenir`) : les signalements sont marqués traités (`signalements.traite`), plus effacés ; le vendeur est prévenu ; journal. Table `signalement_masquages`. Limites (`_signalement_garde`) : un signalement par personne et par annonce, 20 par jour pour un membre ; sans compte : un par annonce, 5 par jour par téléphone (case d'IP hachée, jamais l'IP), 200 par heure au total. `signalements_publics` ne compte que les membres connectés et les signalements non traités.
- **94f fiabilité** : un litige clos « livrée » avec un fautif désigné crée un « litige perdu » imputé (`_fiab_litige_perdu`), compté dans la fiabilité, les niveaux et les paliers (`_fiab_n90` compte abusives + litiges perdus). Profil public : `litiges_perdus` (l'ancienne clé `litiges_contre` donne la même valeur). Récidive (`admin_suspendre`) : seulement une suspension allée à son terme dans les 12 derniers mois (`recidive_mois`). Motifs « panne / météo » et « stock épuisé » refusés par l'autre partie : annulation `a_examiner`, aucune sanction tant que l'équipe ne l'a pas classée (`admin_annulation_classer`), liste dans `admin_fiabilite().a_examiner`, « L'équipe examine » dans Ma fiabilité.
- **94g photos de départ** : `commande_depart_preuves` refuse une photo envoyée avant la confirmation, une photo déjà utilisée pour une autre commande, la même photo deux fois.
- **94h date d'annonce** : `created_at` fixé par le serveur à la création, jamais modifiable ensuite (`_annonce_date_serveur`).
- Front : bande et feuille des garanties (« Badge vérifié : pièce contrôlée par l'équipe », plus « Identités vérifiées par l'équipe »), phrase de la carte « Achetez en confiance », Mon compte → « Annonce cachée » + Contester (v3/reputation.js, v3/compte.js), profil : « litiges perdus », tableau de bord : Numéro contesté, code avec motif, Rétablir / Garder cachée avec contestation, litige « Livrée : réclamation de l'acheteur sans fondement », annulations à examiner, paires fermées et nouveaux réglages des niveaux.
- Tests : `supabase/tests/confiance-94-scenarios.sql` (10 blocs, résultats écrits) ; niveaux-85 A à G rejoués (identiques, commandes créées « il y a 400 jours ») ; fiabilite-84 A identique, D/E et H expliqués dans le fichier.
- Limite d'inscriptions : la base ne voit pas l'IP d'une inscription (Supabase Auth) ; le réglage est dans Supabase → Authentication → Rate Limits (déjà 20 / 5 min / IP).

## Lignes FONCTIONNALITES.md
- Noms réservés (« Marché de Gros », MGCI, admin, support, équipe, officiel…) refusés par le serveur, compte officiel excepté — schéma 94a.
- Nom figé après vérification d'identité — schéma 94a.
- Numéro contesté (l'équipe rend un numéro à son propriétaire, journal) ; numéro libéré à la suppression du compte — schéma 94b.
- Journal des gestes de l'équipe (`admin_journal`) ; code changé par l'équipe : motif + message au membre — schéma 94b.
- Une pièce d'identité ne vérifie qu'un compte — schéma 94c.
- Badges : plafond par partenaire, partenaires différents, délai minimum, alerte paires fermées — schéma 94d.
- Signalements : masquage seulement par des membres vérifiés et anciens, vendeur prévenu, contestation, signalements traités, limites — schéma 94e.
- Litiges perdus imputés et seuls montrés au public ; récidive sur 12 mois ; panne/météo/stock épuisé examinés avant sanction — schéma 94f.
- Photos de départ uniques à la commande — schéma 94g. Date des annonces fixée par le serveur — schéma 94h.

## Lignes CHANGELOG.md
- 24/10/2026 — Confiance (schéma 94, test seulement) : noms réservés, nom vérifié figé, numéro contesté et libéré, journal de l'équipe, pièce unique, badges anti-complices, signalements sans sabotage, litiges perdus, récidive, photos de départ uniques, date serveur ; bande « Badge vérifié » au lieu de « Identités vérifiées par l'équipe ».

## Ligne PORTAGE-SITE.md, partie 4 (nouveauté de l'application hors module commun)
- Mon compte → « Annonce cachée » + Contester (v3/reputation.js `MDGRep.masquees`, v3/compte.js) : à porter sur le site si le site montre « Mes publications ».
- Profil public : « litiges perdus » au lieu de « litiges ouverts par l'autre partie » (v3/reputation.js, module commun si le site l'utilise).

## Décisions à demander au propriétaire
- Valeurs par défaut : 3 commandes comptées par partenaire, 3 partenaires différents, 60 min entre commande et réception, alerte à 3 commandes / 60 % ; masquage par 3 membres vérifiés inscrits depuis 30 jours (ou plus jamais de masquage automatique : `signal_seuil` = 0).
- Les litiges perdus comptent maintenant dans les paliers (avertissement à 1) : à confirmer.
- Les comptes supprimés AVANT 94b gardent leur numéro bloqué : les libérer un par un avec « Numéro contesté », ou un script (accord nécessaire).
- Pseudo d'un membre vérifié : toujours modifiable (seuls prénom et nom sont figés).
- Turnstile / limite d'inscriptions : réglage Supabase Auth (Rate Limits) ou Turnstile (décision en attente).
