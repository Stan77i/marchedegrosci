# Registre des anomalies

> Toutes les anomalies trouvées par le contrôle qualité, **jamais effacées** : une anomalie change de statut, elle ne disparaît pas.
> Statuts : **ouverte** · **correction en cours** (PR ouverte, pas encore fusionnée ni rejouée) · **corrigée non vérifiée** (correctif fusionné, test de non-régression pas encore rejoué) · **vérifiée** (test rejoué et réussi, avec date et preuve) · **risque accepté par le propriétaire** (seulement avec sa phrase écrite, sa date et le lieu où il l'a dite).
> Gravité : **P0** argent, sécurité ou perte de données, bloquant · **P1** grave · **P2** gênant · **P3** cosmétique.
> Règles : aucune anomalie masquée ; un test bloqué n'est pas réussi ; aucune donnée personnelle ni secret dans ce fichier.
> Mis à jour le 25/10/2026 par le premier contrôle général (`rapports/2026-10-25-controle-general.md`) : ANO-012 à ANO-057 ajoutées ; statuts revus après la fusion des PR #305 et #306 (25/10/2026, 01 h 29 UTC), doublons fusionnés (une anomalie vue par deux équipes = une seule fiche, avec les deux preuves).

## 1. Tableau (P0 et P1 en haut)

| N° | Titre | Gravité | Unité | Statut | Test de non-régression |
|---|---|---|---|---|---|
| — | **Aucune P0** trouvée le 25/10/2026 | P0 | — | — | — |
| ANO-012 | Suppression du compte pendant une commande en cours | **P1** | U01, U07, U14 | corrigée non vérifiée (PR #305 fusionnée le 25/10/2026 à 01 h 29 UTC ; projet de test seulement, production à confirmer) | PRO-02 b, LOG-10 ; `controle-corrections-98` |
| ANO-013 | 51 commissions « due » sans aucun argent passé (registre) | **P1** | U03, U11 | ouverte | ARG-06b |
| ANO-008 | L'équipe peut lire tous les messages privés | **P1** | U02, U07 | ouverte (décision en attente) | à écrire (U02) |
| ANO-010 | Comptes créés sans preuve du numéro (une personne = deux comptes) | **P1** | U02, U07, U01 | ouverte (attend un budget) | LOG-14 ; en attente : service d'envoi |
| ANO-001 | « L'acheteur vient chercher la marchandise » | P2 | U13, U06 | **vérifiée** (25/10/2026, STA-03 : plus de rouge après la PR #306) | STA-03 |
| ANO-002 | Exemple « Cocody » dans un champ ville | P2 | U01 | **vérifiée** (25/10/2026, STA-04 réussi après la PR #306) | STA-04 |
| ANO-003 | Textes d'écran trop longs (51) | P2 | U12 | ouverte | STA-08 |
| ANO-007 | La règle 93 garde l'ancienne quantité sans le dire | P2 | U04 | corrigée non vérifiée (schéma 97d, PR #306 fusionnée le 25/10/2026 ; projet de test seulement) | SQL-boutiques-86 B ; `litige-quantites-97` L4 |
| ANO-009 | Itinéraires par le serveur public OSRM | P2 | U10, U06 | ouverte (décision en attente) | à écrire |
| ANO-011 | Pas d'anti-robot (Turnstile) | P2 | U02 | ouverte (décision en attente) | à écrire |
| ANO-014 | Le quota de 3 annonces gratuites se contourne | P2 | U02, U04 | ouverte | SEC-05 c |
| ANO-015 | Données du profil gardées après la suppression du compte | P2 | U07 | ouverte | PRO-02 b |
| ANO-016 | Levée d'un bannissement sans trace | P2 | U11 | ouverte | ADM-01 n° 4 |
| ANO-017 | Décision d'identité changée sans historique | P2 | U11, U07 | ouverte | ADM-01 n° 5, PRO-04 b |
| ANO-018 | L'administrateur peut juger un litige où il est partie | P2 | U11 | ouverte | ADM-02 (fin) |
| ANO-019 | La table `commandes` accepte des valeurs impossibles | P2 | U09, U03 | ouverte | BDD-02 |
| ANO-020 | Avis comptés sur une commande annulée après litige | P2 | U07, U09 | ouverte | BDD-04 |
| ANO-021 | Aucun journal central des actions de l'équipe | P2 | U11 | ouverte | ADM-01 |
| ANO-022 | 2e dépôt d'argent ignoré sans trace (devient P0 le jour du paiement) | P2 | U03, U14 | ouverte | ARG-15, EXT-05b |
| ANO-023 | Commandes sans sortie automatique (en route, « arrivée », mot bloqué) | P2 | U05 | ouverte | CMD-12b, 12c, 12d |
| ANO-024 | Demande d'annulation laissée « pendante » après le chargement | P2 | U05 | ouverte | CMD-09 |
| ANO-025 | Notifications commerciales avec quantité et prix périmés | P2 | U08 | ouverte | NOT-02, NOT-03 |
| ANO-026 | Vendeur banni : l'acheteur attend 72 h pour annuler | P2 | U14, U05 | ouverte | EXT-06 |
| ANO-027 | Badges Excellent et Grand impossibles à obtenir (l'aide les promet) | P2 | U01, U07, U13 | ouverte | LOG-11, DOC-10 |
| ANO-028 | Membre suspendu : accord conclu puis commande refusée | P2 | U01, U05 | corrigée non vérifiée (PR #305 fusionnée le 25/10/2026 à 01 h 29 UTC ; projet de test seulement, production à confirmer) | LOG-12 ; `controle-corrections-98` |
| ANO-029 | « Dans ma ville, l'acheteur s'en charge » (formulaire d'offre) | P2 | U13, U06 | ouverte | DOC-01 |
| ANO-030 | Pitch : commission « retenue sur la part du vendeur » | P2 | U13, U03 | corrigée non vérifiée (PR #305 fusionnée le 25/10/2026) | DOC-02 |
| ANO-031 | 4,4 Mo à la première ouverture ; accueil lisible à 57 s en 3G lente | P2 | U10 | ouverte | FIA-58, FIA-59 |
| ANO-032 | Aucune indication de coupure du réseau | P2 | U10 | ouverte | FIA-60 |
| ANO-033 | « Indiquez la quantité » sans montrer le champ | P2 | U12 | ouverte | CMP-01 |
| ANO-034 | Litige : ni délai ni action visible pour l'acheteur | P2 | U12 | ouverte (à revoir avec le vrai serveur) | CMP-10 |
| ANO-035 | Délais comptés en heures pleines (nuits, week-ends, jours fériés) | P2 | U01 | ouverte (décision du propriétaire) | LOG-13 |
| ANO-004 | Textes copiés dans plusieurs fichiers (26) | P3 | U12, U10 | ouverte | STA-05 |
| ANO-005 | Couleurs bleues hors exceptions (7) | P3 | U12 | ouverte | STA-11 |
| ANO-006 | Police autre que Jost | P3 | U12 | ouverte | STA-10 |
| ANO-036 | Clés étrangères manquantes | P3 | U09 | ouverte | BDD-01 |
| ANO-037 | `villes_ref` : tous les droits donnés à anon et aux membres | P3 | U02 | ouverte | SEC-11 |
| ANO-038 | `search_path` modifiable sur 3 fonctions | P3 | U02 | ouverte | SEC-11 (`get_advisors`) |
| ANO-039 | Texte HTML stocké tel quel (protection seulement à l'affichage) | P3 | U02 | ouverte | SEC-06 |
| ANO-040 | Fiabilité publique gonflée par de fausses commandes | P3 | U07 | ouverte | PRO-03 d |
| ANO-041 | Messages d'erreur techniques ou adressés à la mauvaise personne | P3 | U12, U05, U06 | ouverte | PRO-01, CMD-08d/f, TRA-04 |
| ANO-042 | Lecture sans verrou dans `commande_annuler_motif` et `litige_ecrire` | P3 | U09, U14 | ouverte | en attente : deux connexions simultanées |
| ANO-043 | Le projet de test n'est pas une copie exacte de la production | P3 | U09, U13 | ouverte | SEC-11, LOG-16 |
| ANO-044 | Prix 0,001 F, 0,5 sac et unité « camion » acceptés | P3 | U04 | ouverte | STK-03, STK-07f |
| ANO-045 | Aucun plafond de vraisemblance du montant | P3 | U03 | ouverte | ARG-10b |
| ANO-046 | `notif_ouverte` sans contrôle du destinataire | P3 | U08 | ouverte | NOT-11d |
| ANO-047 | Compte supprimé : notifications transactionnelles encore « à envoyer » | P3 | U08 | ouverte | NOT-12 |
| ANO-048 | Texte de négociation renvoyé après coupure = 2 messages | P3 | U14 | ouverte | EXT-02, EXT-01b |
| ANO-049 | Caractère de contrôle accepté dans un message | P3 | U14 | ouverte | EXT-03 |
| ANO-050 | « [object Object] » lu par le lecteur d'écran sur tous les écrans | P3 | U10, U12 | ouverte | FIA-04 (×14) |
| ANO-051 | Tutoriel de la liste affiché sur une négociation ouverte | P3 | U12 | ouverte | FIA-67 |
| ANO-052 | Fautes « de igname », « à le vendeur » | P3 | U12 | ouverte | CMP-02, CMP-11 |
| ANO-053 | Écrans de négociation et de commande : choix peu clairs, doublon, bloc trop tôt | P3 | U12 | ouverte | CMP-04, CMP-05, CMP-07 |
| ANO-054 | Aide, CGU, guide et FONCTIONNALITES en retard sur le code | P3 | U13 | ouverte | DOC-03 à DOC-09 |
| ANO-055 | En panne : « Commandes indisponibles » et « Aucune commande en cours » ensemble | P3 | U10 | ouverte | FIA-63 |
| ANO-056 | Protection « mots de passe compromis » désactivée | P3 | U02 | ouverte (en attente : option peut-être payante) | SEC-11 (`get_advisors`) |
| ANO-057 | Le site caché appelle 5 modules avec une ancienne version (`?v=`) | P3 | U10 | ouverte | STA-02 |

Comptes : **0 P0 · 4 P1 · 28 P2 · 25 P3** (57 fiches, dont 46 nouvelles le 25/10/2026). Statuts : 2 vérifiées (ANO-001, 002), 4 corrigées non vérifiées (ANO-007, 012, 028, 030), 51 ouvertes.

## 2. Gabarit (copier pour chaque nouvelle anomalie)

```markdown
### ANO-NNN · <titre court>
| Champ | Valeur |
|---|---|
| Date | JJ/MM/AAAA (rapport : `rapports/<fichier>.md`) |
| Unité | Uxx |
| Gravité | P0 / P1 / P2 / P3 |
| Preuve | commande ou requête qui la reproduit, `fichier:ligne`, sortie obtenue |
| Risque métier | ce qui peut arriver à un membre ou au Marché de Gros, en une phrase |
| Correctif | proposé / en cours (PR n°…) / fait (PR n°…) |
| Test de non-régression | ID du test qui la surveille (ex. STA-03, SQL-regles-93 bloc A) |
| Statut | ouverte / correction en cours / corrigée non vérifiée / vérifiée (date, preuve) / risque accepté par le propriétaire (date, phrase) |
```

Batteries citées : `tests/sql/U02-securite.sql` (SEC), `U03-argent.sql` (ARG), `U04-stocks.sql` (STK), `U05-commandes.sql` (CMD), `U06-transport.sql` (TRA), `U07-profils.sql` (PRO), `U08-notifications.sql` (NOT), `U09-base.sql` (BDD), `U11-admin.sql` (ADM), `U14-extremes.sql` (EXT) ; `tests/navigateur/U10-fiabilite.js` (FIA), `U12-parcours.js` (CMP-21 et suivants) ; LOG, DOC, CMP-01 à 11 : lecture du code et des captures (`rapports/annexes/2026-10-25-front-logique.md`).

## 3. Fiches P1

### ANO-012 · Suppression du compte pendant une commande en cours
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (`rapports/2026-10-25-controle-general.md`) ; vue par deux équipes (LOG-10 et PRO-02) |
| Unité | U01, U07, U14 |
| Gravité | P1 |
| Preuve | Projet de test, bloc annulé : vendeur avec une commande à l'étape « chargement » (PRO-02 b) puis avec 4 commandes ouvertes (LOG-10) ; `supprimer_compte()` → « ok » ; la commande reste `en_cours/chargement`, le compte est bloqué pour toujours (`banned_until = infinity`). `supabase/schema-4.sql` `supprimer_compte` (seule définition : `python3 tools/controle/fn.py supprimer_compte`). EXT-07 : aucune des 5 fonctions de commande ne vérifie un compte supprimé (lecture du code). |
| Risque métier | L'acheteur attend une marchandise d'un vendeur qui ne peut plus se connecter (pas de chargement, pas de mot secret, pas de litige à deux) ; moyen d'échapper à un litige ou à une suspension, puis de revenir avec un autre numéro. |
| Correctif | fait : PR #305, schéma 98a (`supprimer_compte` refuse tant qu'il reste une commande à confirmer ou en cours, un litige, un accord sans commande de moins de 72 h ou une suspension) et écran `v3/compte.js` ; testé par l'équipe de correction (`supabase/tests/controle-corrections-98-scenarios.sql`), sur le projet de test seulement |
| Test de non-régression | PRO-02 b (`tests/sql/U07-profils.sql`) : refus, commande inchangée, compte actif ; « sans commande » : accepté |
| Statut | **corrigée non vérifiée** : PRO-02 b et LOG-10 pas encore rejoués par le contrôle ; schéma 98a en production : à confirmer |

### ANO-013 · 51 commissions « due » sans aucun argent passé
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U03, U11 |
| Gravité | P1 |
| Preuve | ARG-06b (`tests/sql/U03-argent.sql`, bloc B + lecture) : `select k.statut, k.statut_registre, count(*) from commissions k where (k.statut = 'due' or k.statut_registre = 'due') and not exists (select 1 from sequestres q where q.commande_id = k.commande_id) group by 1, 2;` → `due \| NULL \| 51` sur le projet de test (commandes de simulation des 23 et 24/10/2026). `_commission_sync` (schéma 95b) garde volontairement ces lignes ; l'écran admin (`v3/admin-transport.js` vers la ligne 233) affiche « Due (argent passé par l'application) ». |
| Risque métier | L'administration lit qu'une commission est due parce que « l'argent est passé », alors qu'aucun paiement n'existe : contraire à la règle « jamais présentée comme encaissée ». La production a reçu le schéma 95b le 25/10/2026 (PR #304) mais n'a pas été lue (lecture interdite pendant ce contrôle) : on ne sait pas si elle a des lignes de ce type. |
| Correctif | proposé : requalifier ces lignes en « calculée » avec une ligne de journal « requalifiée : aucun séquestre », ou faire lire l'écran sur `_cmd_argent_passe` au lieu de l'ancien statut. Le titre de la PR #305 parle de commission « prévue » : à vérifier si elle couvre ce point. |
| Test de non-régression | ARG-06b : la requête doit rendre 0 ligne, sur le test puis en production (lecture par le propriétaire ou avec son accord) |
| Statut | ouverte |

### ANO-008 · L'équipe peut lire tous les messages privés
| Champ | Valeur |
|---|---|
| Date | 24/10/2026 (`docs/REPRISE.md`, décisions en attente) |
| Unité | U02, U07 |
| Gravité | P1 (vie privée) |
| Preuve | texte affiché `v3/messages.js:292` (« l'équipe du Marché de Gros peut les lire… ») ; SEC-03 (25/10/2026) : un membre ne lit rien, `admin_discussions` et `admin_dm` sont « Réservé aux administrateurs » ; la lecture par l'équipe reste ouverte sans condition de litige |
| Risque métier | Confiance des membres, obligations de confidentialité (ARTCI non vérifié). |
| Correctif | décision du propriétaire en attente (lecture seulement en cas de litige ?) |
| Test de non-régression | à écrire (U02) |
| Statut | ouverte (décision en attente) |

### ANO-010 · Comptes créés sans preuve du numéro
| Champ | Valeur |
|---|---|
| Date | octobre 2026 (audit de sécurité, `CLAUDE.md`) ; complétée le 25/10/2026 (LOG-14) |
| Unité | U02, U07, U01 |
| Gravité | P1 |
| Preuve | aucun envoi de code (SMS ou WhatsApp) n'existe ; LOG-14 : `nego_ouvrir` (schéma 93b) ne contrôle que `user_id`, donc une même personne avec deux numéros peut vendre et acheter à elle-même ; seuls les badges ont une garde (partenaires différents, schéma 94d) ; PRO-03 : la fiabilité publique, elle, se gonfle (ANO-040) |
| Risque métier | Faux comptes, numéro d'un autre utilisé, fausses ventes entre ses propres comptes. |
| Correctif | attend un budget (SMS/WhatsApp) |
| Test de non-régression | LOG-14 ; en attente : service d'envoi |
| Statut | ouverte |

## 4. Fiches P2

### ANO-001 · « L'acheteur vient chercher la marchandise » (rouge du contrôle statique)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (premier rapport des gardiens ; toujours là au contrôle général du 25/10/2026) |
| Unité | U13, U06 |
| Gravité | P2 provisoire (rouge du script, gravité à juger) |
| Preuve | `bash tools/controle/lancer.sh statique` → STA-03 ; `v3/commandes.js:1140` (avant la PR #306) (libellé du choix « acheteur » quand vendeur et acheteur sont dans la même ville) ; même tournure en orange `v3/commandes.js:897`, aujourd'hui 915 (`REGLE.retrait`) |
| Risque métier | Si la phrase désigne le choix « transport à la charge de l'acheteur », elle contredit la règle du 24/10/2026. Lecture du code : elle désigne le **retrait** accepté par le vendeur (même ville), un autre choix, que la règle n'interdit pas. |
| Correctif | à décider : si c'est bien le retrait, ajouter une exception motivée dans `tools/controle/exceptions.json` et retirer la clé de `tools/controle/reference-rouges.json` ; sinon écrire « Transport à la charge de l'acheteur » |
| Test de non-régression | STA-03 |
| Statut | **vérifiée** le 25/10/2026 : la PR #306 écrit « Transport à la charge de l'acheteur » ; `bash tools/controle/lancer.sh statique` sur le commit d'intégration : STA-03 sans rouge (reste un orange `v3/commandes.js:915`, `REGLE.retrait`, qui désigne le retrait accepté par le vendeur) ; clé retirée de `tools/controle/reference-rouges.json` |

### ANO-002 · Exemple « Cocody » dans un champ ville
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (premier rapport des gardiens ; toujours là) |
| Unité | U01 |
| Gravité | P2 |
| Preuve | STA-04 ; `v3/appro.js:182` (texte d'exemple d'un champ `data-k="ville"`) |
| Risque métier | Laisse croire qu'une commune d'Abidjan est une ville, contre la règle « Abidjan est une seule ville » (schéma 87c). |
| Correctif | fait : PR #306 (champ « Commune ou quartier » de l'approvisionnement pro) |
| Test de non-régression | STA-04 |
| Statut | **vérifiée** le 25/10/2026 : STA-04 « rien à signaler » sur le commit d'intégration |

### ANO-003 · Textes d'écran trop longs
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (53 au premier passage, 52 après la PR #303 « moins de texte », 51 après les PR #305 et #306) |
| Unité | U12 |
| Gravité | P2 (les plus longs : `v3/identite.js:493`, `v3/commandes.js:777`, `v3/compte.js:863`) |
| Preuve | STA-08 ; liste complète : `node tools/controle/controle.js` puis `rapport-controle.md` |
| Risque métier | Règle « pas de long texte d'explication sur les écrans » : le membre ne lit pas, se trompe d'action. |
| Correctif | à choisir par le propriétaire, écran par écran (captures avant PR) |
| Test de non-régression | STA-08 |
| Statut | ouverte |

### ANO-007 · La règle 93 garde l'ancienne quantité sans le dire
| Champ | Valeur |
|---|---|
| Date | 24/10/2026 (rapport de bout en bout, `docs/REPRISE.md` partie 1) |
| Unité | U04 |
| Gravité | P2 |
| Preuve | `_annonce_regles` (schéma 93) garde l'ancienne quantité avant le message `STOCK_EPUISE` de `_stock_garde` (schéma 92) ; `supabase/tests/boutiques-86-scenarios.sql` bloc B mis à jour pour ce comportement |
| Risque métier | Un vendeur qui vide la quantité croit l'avoir changée alors que l'ancienne reste (rien ne le lui dit). |
| Correctif | fait : PR #306, schéma 97d (colonnes `quantite_gardee` ; message « La quantité a changé, vérifiez votre annonce. ») ; projet de test seulement |
| Test de non-régression | SQL-boutiques-86 bloc B, SQL-regles-93, `litige-quantites-97` L4 |
| Statut | corrigée non vérifiée (pas rejouée par le contrôle ; 97d en production : à confirmer) |

### ANO-009 · Itinéraires par le serveur public OSRM
| Champ | Valeur |
|---|---|
| Date | 24/10/2026 (`docs/essai-ferme/A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`, point 6) |
| Unité | U10, U06 |
| Gravité | P2 |
| Preuve | `router.project-osrm.org` : serveur de démonstration sans garantie ; disponibilité jamais mesurée |
| Risque métier | Carte de livraison sans trajet si le serveur tombe ou limite. |
| Correctif | décision en attente : passer par la fonction `itineraire` ; mesurer d'abord |
| Test de non-régression | à écrire (U14, panne) |
| Statut | ouverte (décision en attente) |

### ANO-011 · Pas d'anti-robot (Turnstile)
| Champ | Valeur |
|---|---|
| Date | octobre 2026 (`CLAUDE.md`, décisions en attente) |
| Unité | U02 |
| Gravité | P2 |
| Preuve | aucune vérification anti-robot à l'inscription ; limite Supabase Auth de 20 par 5 minutes et par IP seulement |
| Risque métier | Inscriptions en masse par un robot. |
| Correctif | question à reposer au propriétaire (site seulement ou partout en mode invisible) ; compte Cloudflare gratuit |
| Test de non-régression | à écrire (U02, malveillant) |
| Statut | ouverte (décision en attente) |

### ANO-014 · Le quota de 3 annonces gratuites se contourne
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U02, U04 |
| Gravité | P2 |
| Preuve | SEC-05 c : un non-vérifié dont `annonces_publiees.n = 3` reçoit `VERIFICATION_REQUISE` pour une 4e annonce, mais `update offres set product_slug = 'igname', …, status = 'active'` sur une ancienne annonce retirée est accepté (compteur reste 3) |
| Risque métier | Publications illimitées sans vérification (multi-comptes, arnaques). |
| Correctif | proposé : dans `garde_publication` (UPDATE) ou `_annonce_regles`, compter une remise en ligne qui change le produit comme une nouvelle publication, ou interdire de changer le produit d'une annonce retirée. Question au propriétaire : « 3 annonces au total » ou « 3 en même temps » ? |
| Test de non-régression | SEC-05 c : refus, ou compteur à 4 puis refus |
| Statut | ouverte |

### ANO-015 · Données du profil gardées après la suppression du compte
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U07 |
| Gravité | P2 |
| Preuve | PRO-02 b : après `supprimer_compte`, `bio`, `activites`, `structure_nom` restent en base (prénom, nom, pseudo, avatar, ville sont vidés) ; `profil_public` renvoie NULL (plus visibles, mais gardées) |
| Risque métier | Vie privée : données qu'un membre croit effacées. |
| Correctif | proposé : vider aussi `bio`, `activites`, `photos`, `structure_type`, `structure_nom`, `structure_logo`, `structure_preuves` (et les fichiers liés), ou écrire pourquoi on les garde. À vérifier en même temps que la PR #305 (ANO-012). |
| Test de non-régression | PRO-02 b : colonnes vides |
| Statut | ouverte |

### ANO-016 · Levée d'un bannissement sans trace
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U11 |
| Gravité | P2 |
| Preuve | ADM-01 n° 4 : `admin_lever_bannissement` efface la ligne `bannis` ; `admin_journal` +0 ; qui, quand, pourquoi et le motif d'origine sont perdus |
| Risque métier | Impossible de contrôler l'équipe, impossible de savoir qu'un compte a déjà été banni. |
| Correctif | proposé : ligne `admin_journal` (admin, cible, motif obligatoire, motif d'origine) avant d'effacer, ou garder la ligne avec `leve_le` / `leve_par` |
| Test de non-régression | ADM-01 : `journal+1` à l'étape 4 |
| Statut | ouverte |

### ANO-017 · Décision d'identité changée sans historique
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (ADM-01 n° 5 et PRO-04 : même anomalie) |
| Unité | U11, U07 |
| Gravité | P2 |
| Preuve | `admin_identite_decider` « verifie » puis « refuse » sur le même dossier : accepté, la 1re décision est écrasée, rien dans `admin_journal` |
| Risque métier | Badge « Identité vérifiée » donné puis retiré (ou l'inverse) sans preuve. |
| Correctif | proposé : refuser une 2e décision sur un dossier déjà décidé, ou journaliser chaque décision |
| Test de non-régression | PRO-04 b : refus de la 2e décision ou `journal = 2` |
| Statut | ouverte |

### ANO-018 · L'administrateur peut juger un litige où il est partie
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U11 |
| Gravité | P2 |
| Preuve | ADM-02 (fin) : commande dont le vendeur est l'administrateur ; `admin_litige_clore(…, 'terminee', 'Je me donne raison', 'acheteur')` → accepté |
| Risque métier | Conflit d'intérêts (le compte officiel peut vendre ; un autre admin pourrait acheter ou vendre). |
| Correctif | proposé : dans `admin_litige_clore`, `admin_litige_trancher2`, `admin_commande_issue`, `admin_refus_trancher`, `admin_litige_partager`, `admin_liberer`, refuser si `auth.uid()` est vendeur, acheteur ou transporteur de la commande |
| Test de non-régression | ADM-02 (fin) : refus |
| Statut | ouverte |

### ANO-019 · La table `commandes` accepte des valeurs impossibles
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U09, U03 |
| Gravité | P2 |
| Preuve | BDD-02 : écritures directes acceptées : quantité -5 et 0, prix 0, montant négatif, montant ≠ quantité × prix, vendeur = acheteur, « terminee » sans `termine_le`, unité vide ; offre « prix ferme 0 » acceptée hors application (13 valeurs sur 22 refusées) |
| Risque métier | La seule défense est dans les fonctions ; une fonction future boguée ou un script d'administration peut créer une commande fausse (commission calculée sur un montant faux). |
| Correctif | proposé : contraintes `check` (quantité > 0, prix > 0, montant ≥ 0, vendeur ≠ acheteur, `terminee` ⇒ `termine_le`), d'abord `not valid` puis `validate` après contrôle des lignes existantes (0 ligne fautive sur le test ; la production n'a pas été lue) |
| Test de non-régression | BDD-02 : « ACCEPTÉS par la base : aucun » |
| Statut | ouverte |

### ANO-020 · Avis comptés sur une commande annulée après litige
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U07, U09 |
| Gravité | P2 |
| Preuve | BDD-04 : commande de simulation terminée, avis donnés, litige, annulée par l'équipe ; les 2 avis restent ; `reputation_publique` lit `avis_commandes` sans regarder l'état de la commande |
| Risque métier | La note publique ne correspond plus à une vente réelle (1 étoile puis annulation obtenue, ou l'inverse). |
| Correctif | proposé : ne compter que les avis des commandes `terminee` (`reputation_publique`, `notes_publiques`, `mieux_notes`, `statuts_publics`), ou retirer l'avis quand la commande est annulée |
| Test de non-régression | BDD-04 ligne « avis sur commande non terminée » + `reputation_publique` avant/après |
| Statut | ouverte |

### ANO-021 · Aucun journal central des actions de l'équipe
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U11 |
| Gravité | P2 |
| Preuve | ADM-01 : sur 12 actions sensibles, `admin_journal` ne bouge jamais ; il n'est écrit que par 4 fonctions ; les autres traces sont dans 7 tables, sans motif pour certaines (réglages) |
| Risque métier | Un contrôle de l'équipe demande de croiser 7 tables ; un réglage changé (ex. délai de litige) n'a pas de motif. |
| Correctif | proposé : une ligne `admin_journal` (admin, action, cible, motif, ancienne et nouvelle valeur) dans chaque fonction `admin_*` qui écrit |
| Test de non-régression | ADM-01 : `journal+1` à chaque action |
| Statut | ouverte |

### ANO-022 · 2e dépôt d'argent ignoré sans trace
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (ARG-15 et EXT-05b : même anomalie) |
| Unité | U03, U14 |
| Gravité | P2 aujourd'hui (aucun paiement branché) ; **devient P0 le jour où le paiement est branché** |
| Preuve | `sequestre_depot_confirme(c, 'orange', 'cq-ext-A', total)` puis `… 'cq-ext-B' …` → « bloque » deux fois, 1 séquestre (réf. A), 0 ligne de journal pour la réf. B |
| Risque métier | Un acheteur qui paie deux fois n'aurait aucune trace du 2e paiement à rembourser. |
| Correctif | proposé : si un séquestre existe avec une autre référence, écrire au journal « dépôt en double à rembourser » et alerter l'équipe, ou refuser avec un code distinct |
| Test de non-régression | EXT-05b : une trace de la réf. B |
| Statut | ouverte |

### ANO-023 · Commandes sans sortie automatique
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U05 |
| Gravité | P2 |
| Preuve | CMD-12b et CMD-12c : après 30 jours simulés et toutes les tâches, `en_cours/transport` et `en_cours/arrivee` (`livre_le` vide) sans alerte ; CMD-12d : mot bloqué, alerte seulement, pas d'échéance (`commandes_delais`) |
| Risque métier | Commande, stock et commission « prévue » bloqués sans fin si personne n'agit ; l'équipe n'est pas prévenue. |
| Correctif | proposé : dans `commandes_delais`, alerte puis litige après X h en chargement, transport ou transbordement sans livraison et après X min en `arrivee` sans `livre_le` ; échéance pour le mot bloqué |
| Test de non-régression | CMD-12b, 12c, 12d : une alerte ou un litige |
| Statut | ouverte (les délais de litige changent dans la PR #306 : à rejouer après) |

### ANO-024 · Demande d'annulation laissée « pendante » après le chargement
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U05 |
| Gravité | P2 |
| Preuve | CMD-09 : le vendeur demande l'annulation, puis charge (accepté) ; `annulation_par` reste rempli ; l'acheteur ne peut plus ni accepter ni refuser (« La marchandise est chargée ») |
| Risque métier | Annulation affichée en attente sur une commande en route ; décisions contradictoires. |
| Correctif | proposé : refuser le chargement tant qu'une demande d'annulation est ouverte, ou la clore (journal « retirée par le chargement ») |
| Test de non-régression | CMD-09 : refus du chargement ou `annulation_par` vide |
| Statut | ouverte |

### ANO-025 · Notifications commerciales avec quantité et prix périmés
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U08 |
| Gravité | P2 |
| Preuve | NOT-02 et NOT-03 : après 990 sacs vendus sur 1 000 et un prix passé de 20 000 à 30 000, la ligne en attente garde `quantite=1000`, `prix=20000` ; `supabase/functions/pousser/index.ts` (cas « offre », vers les lignes 520-530) écrit le texte depuis `donnees` ; une commerciale peut attendre jusqu'à 18 h |
| Risque métier | « 1 000 sacs à 20 000 F » annoncés alors qu'il en reste 10 à 30 000 F : promesse non vérifiée, contraire à la règle des notifications. |
| Correctif | proposé : relire quantité et prix de l'annonce au moment de prendre le lot (`notif_lots_prendre`) ou dans `pousser` |
| Test de non-régression | NOT-02, NOT-03 : valeurs du lot = valeurs actuelles de l'offre |
| Statut | ouverte |

### ANO-026 · Vendeur banni : l'acheteur attend 72 h pour annuler
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U14, U05 |
| Gravité | P2 |
| Preuve | EXT-06 : vendeur `COMPTE_BANNI` après confirmation ; `commande_annuler_retard` → `TROP_TOT` (72 h) ; seule sortie : « Signaler un problème » |
| Risque métier | Acheteur bloqué 3 jours, stock réservé. |
| Correctif | proposé : au bannissement, annuler (ou passer en litige) les commandes non chargées du banni, stock rendu, annulation imputée au banni ; ou lever le délai si la partie est bannie |
| Test de non-régression | EXT-06 : annulation possible ou commande traitée |
| Statut | ouverte |

### ANO-027 · Badges Excellent et Grand impossibles à obtenir
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (LOG-11 et DOC-10 : même cause) |
| Unité | U01, U07, U13 |
| Gravité | P2 |
| Preuve | `_niv_calculer` (schéma 94d) exige des commandes `validation = 'code'`, créées seulement en mode « reseau » (`commande_creer`, schéma 87b), et le service réseau est fermé ; l'aide (`v3/aide.js` vers la ligne 113) promet Excellent et Grand « validées par code » |
| Risque métier | Promesse de l'aide intenable ; les meilleurs membres ne peuvent pas être reconnus. |
| Correctif | à décider : permettre la validation par code hors réseau (acheteur ↔ vendeur), ou retirer temporairement l'exigence et le dire dans l'aide |
| Test de non-régression | LOG-11 : un membre qui remplit tout le reste atteint Excellent sur le projet de test ; DOC-10 |
| Statut | ouverte |

### ANO-028 · Membre suspendu : accord conclu puis commande refusée
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U01, U05 |
| Gravité | P2 |
| Preuve | LOG-12 : pas de garde de suspension dans `nego_agir` (schéma 93b) ; l'autre partie peut conclure, puis `_fiab_garde_commande` (schéma 84b) refuse la commande (« Ce membre est suspendu ») |
| Risque métier | L'autre partie croit avoir un accord, puis tout est bloqué ; stock immobilisé 72 h ; contraire à l'esprit de la décision 16. |
| Correctif | fait : PR #305, schéma 98b (déclencheurs `messages_fiab_garde_prix` et `negociations_fiab_garde_accord` : ni proposition ni accord avec un membre suspendu) ; projet de test seulement |
| Test de non-régression | LOG-12 : « suspendu → accord refusé » |
| Statut | **corrigée non vérifiée** : LOG-12 pas encore rejoué par le contrôle ; schéma 98b en production : à confirmer |

### ANO-029 · « Dans ma ville, l'acheteur s'en charge »
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U13, U06 |
| Gravité | P2 |
| Preuve | DOC-01 : formulaire « Publier une offre » : « Inclus hors de ma ville — Règle du marché : je livre dans les autres villes ; dans ma ville, l'acheteur s'en charge » (`application.dc.html:828`, `TR_OFF`) ; or la décision 1 et les CGU 7.2 disent : même ville, le vendeur organise son livreur, payé par l'acheteur (`v3/commandes.js` vers la ligne 1139 fait bien ainsi) |
| Risque métier | Le vendeur ne s'occupe pas du livreur, dispute à la livraison. |
| Correctif | proposé : « je livre partout ; dans ma ville, mon livreur est payé par l'acheteur » (captures avant PR) |
| Test de non-régression | DOC-01 ; motif à ajouter au contrôle des mots interdits (STA-03) |
| Statut | ouverte |

### ANO-030 · Pitch : commission « retenue sur la part du vendeur »
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U13, U03 |
| Gravité | P2 |
| Preuve | DOC-02 : `strategie/sources/pitch.html` vers les lignes 66-70 : « 3,5 % … retenus sur la part du vendeur quand la vente est définitive » et « registre que personne ne peut modifier » (l'équipe a des fonctions sur les commissions) |
| Risque métier | Laisse croire qu'un prélèvement existe ; affirmation non vérifiée dans un document montré à l'extérieur. |
| Correctif | fait : PR #305 : pitch, présentation, problème et solution, marketing et `FOUNDER_CONTEXT.md` disent « commission prévue, calculée sur la marchandise ; prélevée seulement une fois le paiement intégré » |
| Test de non-régression | DOC-02 : recherche de « retenu » dans `strategie/sources/` |
| Statut | **corrigée non vérifiée** : DOC-02 à rejouer (recherche de « retenu » dans `strategie/sources/` et relecture des PDF refaits) |

### ANO-031 · Poids et lenteur à la première ouverture
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U10 |
| Gravité | P2 |
| Preuve | FIA-58 : 4,4 Mo en 175 fichiers (scripts 1,8 Mo, page 348 Ko, données 356 Ko, CSS 304 Ko), sans polices ni tuiles ; FIA-59 : « Slow 3G » + serveur lent 2 s : écran d'attente à 3, 8 et 15 s (pas d'écran blanc), accueil lisible à 56,7 s (seuil 30 s) ; `bash tools/controle/lancer.sh unite U10` |
| Risque métier | Abandon à la première ouverture sur réseau mobile ivoirien ; forfait consommé. |
| Correctif | proposé : charger les modules des écrans secondaires à la demande, alléger la page et les données |
| Test de non-régression | FIA-58 (< 3 Mo), FIA-59 (< 30 s) |
| Statut | ouverte |

### ANO-032 · Aucune indication de coupure du réseau
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U10 |
| Gravité | P2 |
| Preuve | FIA-60 : réseau coupé sur l'accueil : aucun message global ; aucun écouteur `offline` dans `application.dc.html` ; les messages n'apparaissent qu'au moment d'une action (FIA-61 : la négociation, elle, garde le texte et prévient) |
| Risque métier | Le membre croit voir des annonces à jour alors qu'il est hors connexion. |
| Correctif | proposé : petite pastille « Hors connexion » quand `navigator.onLine` passe à faux (captures avant PR) |
| Test de non-régression | FIA-60 |
| Statut | ouverte |

### ANO-033 · « Indiquez la quantité » sans montrer le champ
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P2 |
| Preuve | CMP-01 : « Publier une offre », « Suivant » sans quantité : bulle « Indiquez la quantité » en haut, mais le champ reste sous la photo, hors de l'écran (capture de l'équipe, non gardée dans le dépôt) |
| Risque métier | Le vendeur ne trouve pas quoi corriger et abandonne la publication. |
| Correctif | proposé : faire défiler jusqu'au champ et le mettre en évidence |
| Test de non-régression | CMP-01 (capture du formulaire après « Suivant » vide ; à ajouter à `U12-parcours.js`) |
| Statut | ouverte |

### ANO-034 · Litige : ni délai ni action visible pour l'acheteur
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P2 |
| Preuve | CMP-10 (et CMP-24 du 25/10/2026 : boutons « Fermer · Écrire à … · Toutes mes commandes » seulement) : « Litige ouvert · L'équipe examine… » + « Service litiges WhatsApp : bientôt » ; aucun délai affiché (72 h côté serveur), aucun bouton pour ajouter une preuve avec les données factices |
| Risque métier | L'acheteur ne sait pas quand il aura une réponse ni comment prouver ; il insiste ailleurs ou abandonne. |
| Correctif | proposé : afficher l'échéance et le bouton d'ajout de preuves ; à revérifier avec le vrai serveur |
| Test de non-régression | CMP-10, CMP-24 |
| Statut | ouverte (à revoir avec le vrai serveur ; délais changés par la PR #306) |

### ANO-035 · Délais comptés en heures pleines
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U01 |
| Gravité | P2 |
| Preuve | LOG-13 : 72 h de chargement, 24 h de réception, 72 h de litige comptés nuits, week-ends et jours fériés compris (`commandes_delais`, `commande_annuler_retard`, schéma 92b) ; aucun calendrier |
| Risque métier | Un vendeur peut perdre une commande (annulation imputée) à cause d'un week-end ou d'un jour férié. |
| Correctif | décision du propriétaire (jours fériés, heures ouvrées) ; au minimum le dire dans l'aide |
| Test de non-régression | LOG-13 |
| Statut | ouverte (décision du propriétaire) |

## 5. Fiches P3

### ANO-004 · Textes copiés dans plusieurs fichiers (26)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12, U10 |
| Gravité | P3 |
| Preuve | STA-05 (ex. « Pas de connexion : rien n'a été enregistré… » dans `v3/chauffeur.js`, `v3/commandes.js`, `v3/groupes.js`) |
| Risque métier | Un texte corrigé à un endroit reste faux ailleurs. |
| Correctif | proposé : un module commun pour les messages répétés |
| Test de non-régression | STA-05 |
| Statut | ouverte |

### ANO-005 · Couleurs bleues hors exceptions (7)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | STA-11 : `application.dc.html:302` #4A8FD6, `index-v3.html:2047` #B5CEDD, `v3/avatar.js:13-14`, `v3/identite.js:256` #234F80, `v3/personnages.js:52,151` |
| Risque métier | Règle « plus aucun bleu » (audit antislop du 24/10/2026). Certaines teintes peuvent être voulues (vêtements des personnages) : à juger. |
| Correctif | à juger : exception motivée ou couleur de la marque |
| Test de non-régression | STA-11 |
| Statut | ouverte |

### ANO-006 · Police autre que Jost
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | STA-10 : `index-v3.html:774` (`ui-monospace`) |
| Risque métier | Règle « une seule police ». Peut-être voulu pour un code ou un chiffre : à juger. |
| Correctif | à juger |
| Test de non-régression | STA-10 |
| Statut | ouverte |

### ANO-036 · Clés étrangères manquantes
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U09 |
| Gravité | P3 |
| Preuve | BDD-01 : notamment `annulations.commande_id` (et vendeur, acheteur, imputable), `stock_mouvements.negociation_id`, `commande_alertes.commande_id`, `groupe_participants.commande_id`, `sanctions.user_id`, `niveaux_membres.user_id`, `commissions` vendeur/acheteur, `avis_commandes` auteur/cible, `commandes` cree_par/annulation_par/litige_par/livre_par (41 tables, journaux compris) ; 0 orphelin aujourd'hui sur le test (BDD-04) |
| Risque métier | Lignes orphelines si un compte ou une commande disparaît. |
| Correctif | proposé : clés étrangères là où l'historique n'a pas à survivre ; sinon l'écrire |
| Test de non-régression | BDD-01, lignes « orphelins » de BDD-04 |
| Statut | ouverte |

### ANO-037 · `villes_ref` : tous les droits donnés à anon et aux membres
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U02 |
| Gravité | P3 |
| Preuve | SEC-11 : anon et `authenticated` ont tous les droits sur `villes_ref`, dont « vider la table » (qui ignore la RLS) ; pas atteignable par l'API REST à ce qu'on sait (à confirmer) |
| Risque métier | Droit inutile ; si un chemin s'ouvre un jour, la liste des villes peut être vidée. |
| Correctif | proposé : ne laisser que la lecture (ou rien, si seules les fonctions la lisent) ; vérifier la production (seulement `get_advisors` permis) |
| Test de non-régression | SEC-11 |
| Statut | ouverte |

### ANO-038 · `search_path` modifiable sur 3 fonctions
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U02 |
| Gravité | P3 |
| Preuve | SEC-11 + `get_advisors` : `_notif_rang` (test et production), `negocier`, `proposer_prix` (test) ; corps constants, sans risque réel |
| Risque métier | Alerte de sécurité permanente qui cache les vraies. |
| Correctif | proposé : `set search_path = public` |
| Test de non-régression | `get_advisors` |
| Statut | ouverte |

### ANO-039 · Texte HTML stocké tel quel
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U02 |
| Gravité | P3 |
| Preuve | SEC-06 : `<script>` et `<img onerror>` stockés tels quels (message privé, négociation, bio, signalement) ; l'application les échappe (`esc`, `v3/reputation.js` vers la ligne 264, `v3/messages.js` vers la ligne 318) ; vérifié dans 2 écrans seulement |
| Risque métier | Un seul écran qui oublie `esc` suffit à exécuter un script chez un autre membre. |
| Correctif | proposé : contrôle automatique des `innerHTML` sans `esc` ; éventuellement refuser `<` `>` dans `garde_textes` |
| Test de non-régression | SEC-06 + recherche des `innerHTML` sans `esc` |
| Statut | ouverte |

### ANO-040 · Fiabilité publique gonflée par de fausses commandes
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U07 |
| Gravité | P3 |
| Preuve | PRO-03 : 5 fausses commandes en 2 min entre deux comptes → aucun badge (protégé), mais la fiabilité publique affiche « 100 % sur 5 » |
| Risque métier | Un fraudeur se fabrique une bonne réputation avec un 2e compte (lié à ANO-010). |
| Correctif | proposé : appliquer la règle anti-complices du badge (délai, partenaires différents) à `fiabilite_publique` |
| Test de non-régression | PRO-03 d |
| Statut | ouverte |

### ANO-041 · Messages d'erreur techniques ou adressés à la mauvaise personne
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (PRO-01, CMD-08, TRA-04 : regroupés) |
| Unité | U12, U05, U06 |
| Gravité | P3 |
| Preuve | PRO-01 : « new row for relation "profils" violates check constraint » remonte tel quel ; CMD-08d : le vendeur qui tente la réception reçoit `MOT_REQUIS` destiné à l'acheteur ; CMD-08f : l'acheteur avant chargement lit « Étape déjà passée » ; TRA-04 : prix transport 0,4 F → contrainte en anglais |
| Risque métier | Le membre ne comprend pas pourquoi c'est refusé. |
| Correctif | proposé : messages en français dans les fonctions ou contrôle avant envoi dans l'application |
| Test de non-régression | PRO-01, CMD-08, TRA-04 |
| Statut | ouverte |

### ANO-042 · Lecture sans verrou dans deux fonctions
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U09, U14 |
| Gravité | P3 |
| Preuve | lecture du code : `commande_annuler_motif` et `litige_ecrire` lisent la commande sans `for update` ; la vraie concurrence n'a pas pu être jouée (SEC-10, BDD-06 en attente) |
| Risque métier | Deux actions au même instant peuvent se croiser (rare aujourd'hui). |
| Correctif | proposé : `for update` dès la lecture |
| Test de non-régression | en attente : deux connexions simultanées |
| Statut | ouverte |

### ANO-043 · Le projet de test n'est pas une copie exacte de la production
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U09, U13 |
| Gravité | P3 |
| Preuve | `get_advisors` test et production : `stats_publiques` seulement en production ; `mesures_resume` et `_confiance_regle` (ouverte aux membres) seulement en test ; 7 fonctions `_sim` en test. LOG-16 et DOC-12 : définitions de production non lues (interdit). La production a reçu les schémas 92 à 97a le 25/10/2026 entre 00 h 34 et 00 h 55 UTC (PR #304) ; 97b et 97c restent sur le test. |
| Risque métier | Un test réussi sur le test peut ne pas valoir pour la production. |
| Correctif | proposé : relever et aligner les écarts de schéma (lecture des définitions en production avec l'accord du propriétaire) |
| Test de non-régression | comparer les deux `get_advisors` ; LOG-16 |
| Statut | ouverte |

### ANO-044 · Prix 0,001 F, 0,5 sac et unité « camion » acceptés
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U04 |
| Gravité | P3 |
| Preuve | STK-03 (`nego_agir`) : prix 0,001 F et 0,5 sac acceptés ; STK-07f : unité libre « camion » acceptée |
| Risque métier | Annonces et accords absurdes ; tableau des prix faussé. |
| Correctif | proposé : prix minimal 1 F, liste d'unités, quantité entière pour les unités qui se comptent |
| Test de non-régression | STK-03, STK-07f |
| Statut | ouverte |

### ANO-045 · Aucun plafond de vraisemblance du montant
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U03 |
| Gravité | P3 |
| Preuve | ARG-10b : 999 999 998 F × 999 999 sacs → commande de 999 998 998 000 002 F acceptée (ARG-10a : un prix de 1 milliard est refusé) |
| Risque métier | Commission et statistiques faussées par une saisie absurde. |
| Correctif | proposé : plafond de montant par commande |
| Test de non-régression | ARG-10b |
| Statut | ouverte |

### ANO-046 · `notif_ouverte` sans contrôle du destinataire
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U08 |
| Gravité | P3 |
| Preuve | NOT-11d : un membre (et anon) peut marquer « ouverte » la notification d'un autre s'il connaît son identifiant |
| Risque métier | Mesures « ouverte » faussées ; le rythme des commerciales (90/180 min) en dépend. |
| Correctif | proposé : vérifier `auth.uid()` = destinataire quand il est connu |
| Test de non-régression | NOT-11d |
| Statut | ouverte |

### ANO-047 · Compte supprimé : notifications transactionnelles encore « à envoyer »
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U08 |
| Gravité | P3 |
| Preuve | NOT-12 : commercial ignoré, mais transactionnel « envoyer » pour un compte supprimé |
| Risque métier | Envoi inutile vers un appareil d'un compte supprimé. |
| Correctif | proposé : `notif_preparer` refuse tout envoi à un compte supprimé |
| Test de non-régression | NOT-12 |
| Statut | ouverte |

### ANO-048 · Texte renvoyé après coupure = 2 messages
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U14 |
| Gravité | P3 |
| Preuve | EXT-02 : texte de négociation renvoyé (même contenu) → 2 lignes ; EXT-01b : message privé sans identifiant (ancienne application) → 2 lignes (avec identifiant : 1, schémas 96c/97a) |
| Risque métier | Doublons dans la conversation sur réseau instable. |
| Correctif | proposé : identifiant client sur `nego_agir` « texte » |
| Test de non-régression | EXT-02 |
| Statut | ouverte |

### ANO-049 · Caractère de contrôle accepté dans un message
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U14 |
| Gravité | P3 |
| Preuve | EXT-03c/e : `chr(1)` accepté |
| Risque métier | Affichage cassé chez le destinataire. |
| Correctif | proposé : retirer les caractères de contrôle dans `garde_textes` |
| Test de non-régression | EXT-03 |
| Statut | ouverte |

### ANO-050 · « [object Object] » lu par le lecteur d'écran sur tous les écrans
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 ; revu le même jour après la PR #303 (`bash tools/controle/lancer.sh unite U10`) |
| Unité | U10, U12 |
| Gravité | P3 |
| Preuve | FIA-04, 08, 12 … 56 (14 écrans × 4 profils) : `span.sc-interp` invisible (opacité 0) mais lu par le lecteur d'écran ; `application.dc.html:800` `{{ toast }}` reçoit un objet `{t,x,ico,go}` |
| Risque métier | Un membre malvoyant entend « object Object » à chaque écran. |
| Correctif | proposé : afficher `toast.t`, ou retirer le bloc, ou `aria-hidden` |
| Test de non-régression | FIA-04 (×14) |
| Statut | ouverte |

### ANO-051 · Tutoriel de la liste affiché sur une négociation ouverte
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | FIA-67 : premier lancement, négociation ouverte directement (comme depuis une notification) : tutoriel « Chaque ligne est une négociation… » par-dessus |
| Risque métier | Le membre qui arrive par une notification lit une explication qui ne correspond pas à l'écran. |
| Correctif | proposé : choisir le tutoriel selon l'écran ouvert |
| Test de non-régression | FIA-67 |
| Statut | ouverte |

### ANO-052 · Fautes « de igname », « à le vendeur »
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | CMP-02 : « 1 demande de igname attend déjà un vendeur » ; CMP-11 : « Nous avons conseillé à le vendeur » (`v3/commandes.js:1168`, `${qui}` vaut « le vendeur ») |
| Risque métier | Image peu soignée. |
| Correctif | proposé : fonctions de liaison (« d'igname », « au vendeur ») |
| Test de non-régression | CMP-02, CMP-11 ; `U12-parcours.js` cherche ces fautes dans les écrans de commande |
| Statut | ouverte |

### ANO-053 · Écrans de négociation et de commande : choix peu clairs, doublon, bloc trop tôt
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | CMP-04 : « Refuser » et « Arrêter la négociation » côte à côte sans différence dite ; CMP-05 : « Écrire au vendeur » et « Écrire en privé » sur le même écran (règle « pas de doublons ») ; CMP-07 : grand bloc « lien de suivi » (4 paragraphes + 3 étapes) avant même la confirmation |
| Risque métier | Le membre hésite ou se trompe d'action. |
| Correctif | à choisir par le propriétaire (captures avant PR) |
| Test de non-régression | CMP-04, CMP-05, CMP-07 |
| Statut | ouverte |

### ANO-054 · Aide, CGU, guide et FONCTIONNALITES en retard sur le code
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U13 |
| Gravité | P3 |
| Preuve | DOC-03 : guide « Transporter le vivrier » (`tools/site/guides/transporter-le-vivrier.html` l. 69) et aide (`v3/aide.js` l. 89) : mot secret « seulement si tout est conforme », alors qu'on le tape aussi pour refuser (`commande_refuser2`) ; DOC-04 : aide « l'acheteur ne peut plus annuler » alors que 92b le permet après 72 h sans chargement (92b en production depuis le 25/10/2026) ; DOC-05 : CGU « aucune échéance » de chargement (92b : 72 h) ; DOC-06 : CGU « commande_litige dit encore 24 h » (92b : 1 h ; délais encore en changement, PR #306) ; DOC-07 : `FONCTIONNALITES.md` « 30 par jour » (plafond réel : 8 par personne) ; DOC-08 : `CLAUDE.md` écrit « Ville seulement » comme une règle pour tous (code et CGU : un choix du vendeur) ; DOC-09 : règles des badges (3 partenaires, 60 min) écrites nulle part |
| Risque métier | Un membre suit l'aide ou les CGU et se trompe ; engagement écrit qui ne correspond pas au service. |
| Correctif | proposé : une PR de textes (aide, guide, CGU, FONCTIONNALITES, `CLAUDE.md` avec l'accord du propriétaire) |
| Test de non-régression | DOC-03 à DOC-09 |
| Statut | ouverte |

### ANO-055 · En panne : deux messages contradictoires
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U10 |
| Gravité | P3 |
| Preuve | FIA-63 (compté réussi : le message d'erreur existe) : serveur en panne → « Commandes indisponibles pour l'instant » et, dessous, « Aucune commande en cours » |
| Risque métier | Le membre croit ses commandes perdues. |
| Correctif | proposé : ne pas afficher « Aucune commande » quand la lecture a échoué |
| Test de non-régression | FIA-63 |
| Statut | ouverte |

### ANO-057 · Le site caché appelle 5 modules avec une ancienne version
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (apparue avec la fusion des PR #305 et #306 dans `main`) |
| Unité | U10 |
| Gravité | P3 |
| Preuve | STA-02 : `v3/sons.js`, `v3/negoce.js`, `v3/reputation.js`, `v3/messages.js`, `v3/identite.js` sont appelés en `?v=20261131lq2` dans `application.dc.html:39` mais avec une version plus ancienne dans `index-v3.html` (lignes 1307 à 1320) |
| Risque métier | Le site caché (vu seulement par l'administrateur) peut garder l'ancienne version de ces modules en cache. |
| Correctif | proposé : mettre la même version dans `index-v3.html` |
| Test de non-régression | STA-02 |
| Statut | ouverte |

### ANO-056 · Protection « mots de passe compromis » désactivée
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U02 |
| Gravité | P3 |
| Preuve | `get_advisors` (test et production) : protection HaveIBeenPwned désactivée |
| Risque métier | Un membre peut choisir un mot de passe déjà volé ailleurs. |
| Correctif | en attente : l'option semble réservée aux plans payants de Supabase (à confirmer) ; hors budget |
| Test de non-régression | `get_advisors` |
| Statut | ouverte (en attente : option peut-être payante) |

## 6. Points à confirmer (ni anomalie prouvée, ni réussite)

| Point | Unité | Ce qu'il faut pour trancher | Source |
|---|---|---|---|
| 17 missions de transport acceptées hors réseau (ancien parcours) | U06, U09 | vérifier que les transporteurs étaient vérifiés | BDD-04 |
| 75 compteurs `annonces_publiees` sous le nombre réel | U09 | annonces de simulation insérées en masse : vérifier en production (lecture) | BDD-04 |
| 9 à 11 cibles tactiles de moins de 32 px à 320 px par écran | U12 | jugement accessibilité | U10-fiabilite (observation) |
| Bouton « Refuser la marchandise » à l'étape « arrivée » | U12 | vrai serveur (`commande_sequestre.peut_refuser`) | CMP-09 (bloqué) |
| Batterie U10 : 8 à 9 minutes, proche de la limite de 10 minutes du lanceur | U10 | surveiller la durée sur GitHub | lancement du 25/10/2026 |

## 7. Points jamais vérifiés

| Point | Unité | Prérequis exact | Statut |
|---|---|---|---|
| Vrais paiements (Mobile Money, séquestre, versement, remboursement) | U03 | partenaire de paiement agréé et accord du propriétaire ; rien n'est simulé | en attente : paiement (ARG-12, 13, 14) |
| Deux connexions au même instant (stock, réception, litige, accord à trois) | U02, U04, U05, U09, U14 | script à plusieurs connexions sur le projet de test | en attente (SEC-10, BDD-06, STK-10, CMD-13, ARG-16, TRA-14, EXT-10/11) |
| Fonction `pousser` (envoi réel des notifications) | U08 | clés push gratuites sur le projet de test, téléphone du propriétaire | en attente : clés (NOT-15, FIA-71) |
| GPS réel pendant la livraison | U06 | vrai téléphone dans un vrai camion | en attente (TRA-14) |
| Fonction `itineraire` | U06, U10 | appel réel sur le projet de test | non exécuté |
| Exécution réelle des tâches planifiées à échéance | U09 | attendre l'échéance sur le projet de test | non exécuté |
| Vrai téléphone (2G/3G, hors ligne, notifications) | U10, U08 | téléphone Android d'entrée de gamme | en attente : matériel (FIA-73) |
| Parcours complet contre le vrai serveur dans le navigateur | U10, U12 | autoriser `catmsypctymgkjkfzdkt.supabase.co` (`docs/A-FAIRE-PROPRIETAIRE.md`) | en attente (FIA-72) |
| Preuve du numéro (SMS ou WhatsApp) | U02, U07 | budget | en attente (ANO-010) |

Détail complet : `REGISTRE_DES_TESTS.md`, partie 3.
