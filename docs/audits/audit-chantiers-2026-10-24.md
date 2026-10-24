# Audit des 4 chantiers (24/10/2026)

Audit en lecture seule : code du dépôt et base Supabase de production (catalogue seulement, aucune donnée personnelle lue). Chaque chantier a été audité, puis contrôlé par un second relecteur qui a relu les preuves. **Rien n'a été modifié.**

Les réponses recommandées aux questions sont dans `docs/audits/decisions-chantiers-2026-10-24.md`.

## 1. Commande et transport

La négociation (proposer, contre-proposer, accepter, refuser, 48 h), la commande confirmée par l'autre partie, les étapes, le mot secret, la commission marchandise de 3,5 % et le masquage des numéros dans les messages existent et sont actifs en base. Le transport ne suit pas la mission : rien ne distingue « même ville » et « villes différentes », le prix du transport ne se négocie pas (seulement « inclus » ou « sans »), et le transporteur MGCI est en pause (_transport_reseau_ouvert = false). Défaut grave : par un simple appel au serveur, un acheteur ou un vendeur peut faire accepter une mission par n'importe quel membre inscrit comme transporteur (même non vérifié), et une commission de 6,9 % se crée alors hors service MGCI. Le séquestre reste inactif (0 ligne, fonctions fermées aux membres).

| Exigence | État | Écart |
|---|---|---|
| Réutiliser la négociation existante (propositions, contre-propositions, acceptation, refus) | fait | Aucun fichier ne contient la version actuelle complète de nego_agir : schema-37-minimum-vendeur.sql:23-37 la réécrit à partir de pg_get_functiondef, et schema-26-commandes.sql:18 parle d'une correction faite sur place. La négociation n'a que deux parties (auteur_id, proprio_id). |
| Validation de la commande par les deux parties avant confirmation | fait | Le transporteur MGCI n'entre pas dans cette validation : il accepte après coup (chauffeur_repondre), et son prix n'est jamais validé par l'acheteur ni par le vendeur. |
| Même ville : le vendeur organise lui-même le livreur, l'acheteur ne le choisit pas | manque | En même ville, c'est l'acheteur qui organise par défaut : c'est l'inverse de la règle. La ville de livraison n'est pas enregistrée de façon exploitable. |
| Même ville : l'acheteur paie les frais de livraison directement au livreur, hors MGCI | partiel | Aucun texte ne dit que les frais de livraison se paient au livreur, hors Marché de Gros. Le serveur laisse encore créer une mission avec un prix en modes acheteur et vendeur (commande_choisir_transporteur), et commande_transport affiche alors un total_livraison. |
| Alternative même ville : MGCI propose un transporteur, prix convenu à trois par propositions et contre-propositions | manque | Pas de négociation à trois, aucun lien entre une mission et des propositions. |
| Villes différentes : le vendeur indique si le transport est inclus dans son prix ou facturé à part | partiel | « Sans transport » ne veut pas dire « facturé à part avec un prix » : aucun prix de transport dans la proposition. nego_transport est un deuxième appel, dont l'erreur est ignorée (v3/negoce.js:424 et 535). nego_transport_suivi efface dernier_transport à chaque nouvelle proposition, et nego_transport n'accepte que l'auteur d'une proposition encore en attente : l'information peut se perdre si l'autre partie accepte entre les deux appels. |
| Villes différentes, transport à part : le vendeur propose son prix, l'acheteur accepte, refuse ou contre-propose | partiel | Le prix du transport ne se négocie pas. Le total (marchandise + transport) n'est figé ni dans l'accord ni dans la commande : commandes n'a pas de colonne pour le prix du transport hors mission (colonnes lues dans information_schema). |
| Alternative villes différentes : transporteur MGCI, négociation à trois sans messagerie dédiée au transporteur | manque | Pas de propositions à trois. Un chauffeur en mission peut écrire en privé à l'acheteur ou au vendeur. |
| Conditions finales acceptées par toutes les parties concernées avant confirmation | partiel | Avec un transporteur MGCI, le prix du transport n'est jamais accepté par l'acheteur ni par le vendeur, et le chauffeur peut le changer seul jusqu'au chargement. Rien n'est prévu pour le prix après un transbordement. |
| Discussion libre réservée à l'acheteur et au vendeur, partage de numéros empêché | partiel | Le filtre manque : les numéros en lettres, coupés en plusieurs messages, avec des séparateurs doubles, ou +225 sans le 0. Pas de filtre sur litige_messages (déclencheurs : seulement litige_messages_fige et litige_messages_push), ni sur les notes de commande_etapes et transport_missions, ni sur lieu_livraison. La messagerie dm est ouverte à tous les membres. |
| Commission marchandise de 3,5 % | fait | Petit écart : commande_creer remplit commandes.commission_montant = round(mt*0.035) même quand le vendeur est administrateur, alors que _seq_repartition met 0. |
| Commission transport de 6,9 % seulement si le transporteur vient du service MGCI ; aucune pour un livreur organisé par le vendeur | partiel | Règle violée côté serveur, et le chemin est ouvert à tout membre par appel direct : une commission de 6,9 % peut être enregistrée pour un transporteur choisi par l'acheteur ou le vendeur, même non vérifié. Aujourd'hui : 0 mission, 0 commission transport. |
| Séquestre et reversements automatiques jamais présentés comme actifs sans prestataire de paiement | fait | Les libellés sq_depot (« Fonds bloqués chez le partenaire ») et sq_solde (« chacun reçoit sa part ») existent (v3/commandes.js:47-50). Ils ne s'affichent que si un événement existe, ce qui n'arrive pas aujourd'hui. |
| Tests : quatre scénarios, refus, contre-propositions, validations, litiges | manque | Aucun test rejouable. |

### Détail et preuves

**Réutiliser la négociation existante (propositions, contre-propositions, acceptation, refus)** (fait)

- Preuves : En base : nego_agir(nego, action, prix, quantite, texte, ref), nego_ouvrir, déclencheurs sur negociations : negociation_figee→nego_fige, negociation_stock, negociations_transport→nego_transport_suivi. Contraintes : messages.genre ∈ texte/prix/accord/refus/fin/retrait ; messages.issue ∈ en_attente/acceptee/refusee/retiree/remplacee/expiree. Politiques SELECT seules : « voir mes négociations », « voir mes messages » ; authenticated a seulement SELECT. Interface : v3/negoce.js:424 et 535.
- À faire : Avant tout changement, sauvegarder pg_get_functiondef(nego_agir) dans supabase/schema-NN-nego-agir-reference.sql. Ajouter de nouvelles fonctions au lieu de changer la signature.

**Validation de la commande par les deux parties avant confirmation** (fait)

- Preuves : commande_creer (en base, lue) : exige negociations.statut = 'conclue', une seule commande par accord, refuse un mode autre que vendeur si le transport est inclus. commande_repondre existe et est exécutable par les membres (la règle « l'autre partie confirme » est rapportée par l'audit ; je n'ai pas relu sa définition). Appel de création : v3/commandes.js:1016.
- À faire : Voir l'exigence « conditions finales acceptées par toutes les parties ».

**Même ville : le vendeur organise lui-même le livreur, l'acheteur ne le choisit pas** (manque)

- Preuves : commandes n'a que ville_depart (≤ 80) et lieu_livraison (texte libre ≤ 120) : pas de ville d'arrivée. mode_transport ∈ reseau/acheteur/vendeur. v3/commandes.js:929, 936 et 937 : défaut « acheteur » (accord sans transport, offre « non », cas restant). Pour hors_ville (l.933-934), le défaut est vendeur, mais l'option « même ville : l'acheteur s'en charge » est proposée.
- À faire : Fichier supabase/schema-NN-transport-ville.sql : alter table commandes add column if not exists ville_arrivee text (liste de app/villes.js) ; le serveur calcule « même ville ». Nouvelle fonction commande_creer2 (garder commande_creer pour les anciennes applications) qui impose mode_transport = 'vendeur' en même ville hors MGCI. Interface : choixTransport0 (v3/commandes.js:924-938) et formulaire de création (vers l.985-1020). Option : commande_itineraires.distance_m pour un seuil en km.

**Même ville : l'acheteur paie les frais de livraison directement au livreur, hors MGCI** (partiel)

- Preuves : Les modes acheteur et vendeur se valident par déclaration et mot secret (commande_creer : val = 'declaration' si le mode n'est pas reseau ; v3/commandes.js:525). Textes : v3/commandes.js:1005 « Aucun paiement ne passe par l'application » et l.450.
- À faire : Phrase dans le formulaire et dans le détail : « Frais de livraison : à régler directement au livreur, hors Marché de Gros ». Côté serveur : fermer commande_choisir_transporteur et commande_retirer_transporteur pour les modes non reseau, et ne pas renvoyer prix_transport ni total_livraison quand mode_transport <> 'reseau'.

**Alternative même ville : MGCI propose un transporteur, prix convenu à trois par propositions et contre-propositions** (manque)

- Preuves : _transport_reseau_ouvert() = select false (IMMUTABLE) ; déclencheur commandes_reseau_pause → _cmd_reseau_pause refuse mode reseau ; RESEAU_OUVERT = false (v3/commandes.js:57). Le prix est posé par le chauffeur seul (chauffeur_repondre2, chauffeur_prix ; v3/chauffeur.js:160-161) ou par l'administrateur (admin_mission_prix, réservé à est_admin). transport_missions n'a qu'une colonne prix, sans historique. transport_missions.propose_role ∈ admin/acheteur/vendeur. Production : 0 transporteur, 0 mission.
- À faire : Nouvelle table transport_propositions (mission_id, auteur_id, role vendeur/acheteur/transporteur, prix, issue en_attente/acceptee/refusee/remplacee/expiree, expire_le, ok_acheteur, ok_vendeur, ok_transporteur). RLS active sans politique ni droit direct, comme les autres tables de commande. Fonction transport_agir(mission, action prix|accord|refus|retrait, prix, ref) en security definer. Le prix n'est arrêté que quand les trois ont accepté la même proposition, puis il est recopié dans transport_missions.prix. Ensuite, chauffeur_prix et admin_mission_prix refusent si une proposition existe, et chauffeur_repondre2 n'accepte plus de prix. Interface : blocTransport (v3/commandes.js:778) et v3/chauffeur.js:150-165. Tout reste caché derrière _transport_reseau_ouvert().

**Villes différentes : le vendeur indique si le transport est inclus dans son prix ou facturé à part** (partiel)

- Preuves : Contraintes : offres.transport ∈ inclus/hors_ville/non ; demandes.transport ∈ vendeur/acheteur. Proposition : messages.transport_inclus, negociations.dernier_transport et transport_final ; fonctions nego_transport et nego_transport_suivi (en base, lues). Boutons « Transport inclus » / « Sans transport » : v3/negoce.js:365. commande_creer impose le mode vendeur si le transport est inclus ; _cmd_transport_inclus lit transport_final, sinon _transport_vendeur.
- À faire : Ajouter messages.prix_transport numeric et negociations.prix_transport_final (add column if not exists). Nouvelle fonction nego_agir2 qui enregistre en un seul appel : prix, quantité, transport inclus ou à part, prix du transport (garder nego_agir et nego_transport). Étendre nego_transport_suivi pour recopier le prix du transport accepté.

**Villes différentes, transport à part : le vendeur propose son prix, l'acheteur accepte, refuse ou contre-propose** (partiel)

- Preuves : Le circuit accepter, refuser, contre-proposer existe pour la marchandise (nego_agir), avec le marqueur inclus/sans attaché (nego_transport).
- À faire : Avec nego_agir2 : une proposition = prix unitaire + quantité + transport (inclus ou à part) + prix du transport ; une contre-proposition remplace l'ensemble (issue 'remplacee'). Ajouter commandes.prix_transport et commandes.transport_par (vendeur/mgci), recopiés par la nouvelle fonction de création. Afficher le total dans deal() (v3/negoce.js:473) et dans le détail (v3/commandes.js:532). Ce prix reste un montant convenu, payé hors application.

**Alternative villes différentes : transporteur MGCI, négociation à trois sans messagerie dédiée au transporteur** (manque)

- Preuves : Même blocage que pour la même ville. litige_messages.role ∈ acheteur/vendeur/admin : pas de transporteur. dm_ouvrir(p_autre) (en base, lue) laisse tout membre ouvrir une discussion avec n'importe quel autre compte : seuls lui-même et un compte supprimé sont refusés.
- À faire : La même table transport_propositions sert ici. Si le propriétaire le veut : create or replace de dm_ouvrir pour refuser une discussion entre le transporteur et une partie d'une commande où il a une mission proposée ou acceptée.

**Conditions finales acceptées par toutes les parties concernées avant confirmation** (partiel)

- Preuves : Acheteur et vendeur : accord (nego_agir), puis confirmation par l'autre partie (commande_repondre). Transporteur : chauffeur_repondre accepte une mission dès que la commande est a_confirmer ou en_cours. chauffeur_prix et admin_mission_prix peuvent changer le prix jusqu'à l'étape preparation (lu en base). commande_transfert_preparer passe la mission à un autre transporteur pendant le trajet.
- À faire : Dans commande_avancer (create or replace à partir de pg_get_functiondef) : en mode reseau, refuser l'étape chargement sans accord des trois dans transport_propositions. Fermer chauffeur_prix, admin_mission_prix et la partie prix de chauffeur_repondre2 une fois ce circuit en place. Décider du prix en cas de transbordement.

**Discussion libre réservée à l'acheteur et au vendeur, partage de numéros empêché** (partiel)

- Preuves : Messages de négociation réservés aux deux parties (politique « voir mes messages »). Déclencheurs messages_controle_sortie et dm_controle_sortie → controle_sortie. sortie_masquer : regexp (+225)?0[1-9]([ .-]?[0-9]){8} → « [numéro masqué] » ; sortie_motif repère aussi WhatsApp, Telegram, Messenger, Signal, imo, Viber et les liens (lus en base). transporteurs : aucun droit pour authenticated ; commande_transport ne renvoie pas de numéro.
- À faire : Créer un déclencheur controle_sortie sur litige_messages, en adaptant v_ref et la contrainte alertes_source_check (aujourd'hui dm et negociation seulement : en ajouter une nouvelle avec 'litige'). Masquer les numéros dans les notes (_cmd_texte ou déclencheur). Élargir l'expression de sortie_motif et sortie_masquer (séparateurs multiples, +225 sans 0). Gratuit.

**Commission marchandise de 3,5 %** (fait)

- Preuves : Contraintes : commissions.taux = 0.035, commissions.encaissement = 'aucun', commandes.commission_statut = 'non_activee'. Déclencheur commission_sync → _commission_sync (fermée aux membres). _seq_repartition : 0 si le vendeur est administrateur. Production : 2 commandes, 1 commission.
- À faire : Aligner commission_montant dans la future fonction de création (0 si est_admin_id du vendeur). Ne rien changer d'autre.

**Commission transport de 6,9 % seulement si le transporteur vient du service MGCI ; aucune pour un livreur organisé par le vendeur** (partiel)

- Preuves : Contraintes : commissions_transport.taux = 0.069 et encaissement = 'aucun'. _ctr_sync (en base, lue) crée une commission dès que la mission est acceptée avec un prix, et ne l'annule que si le transport est inclus (_cmd_transport_inclus) : aucune vérification de mode_transport = 'reseau'. commande_choisir_transporteur refuse le mode reseau et accepte les modes acheteur et vendeur. transporteur_inscrire rend n'importe quel membre transporteur en_attente ; commande_choisir_transporteur et chauffeur_repondre n'exigent pas le statut verifie. _seq_repartition compte aussi tr*0.069. Déclencheurs : transport_missions_commission → _ctr_mission, commandes_commission_transport → _ctr_commande.
- À faire : supabase/schema-NN-commission-transport-mgci.sql : create or replace de _ctr_sync et _seq_repartition pour exiger mode_transport = 'reseau' (et une mission proposée par admin). Fermer commande_choisir_transporteur et commande_retirer_transporteur pour les modes acheteur et vendeur. En mode reseau, exiger statut = 'verifie' dans chauffeur_repondre et commande_transfert_preparer. Aucune ligne à corriger (0 commission transport).

**Séquestre et reversements automatiques jamais présentés comme actifs sans prestataire de paiement** (fait)

- Preuves : Production : 0 ligne dans sequestres et sequestre_versements. sequestre_depot_confirme et sequestre_liberer_echus : execute refusé à authenticated (has_function_privilege = false ; revoke dans schema-57-sequestre.sql:277 et 306). Aucun droit des membres sur les tables. Écran : textes du séquestre seulement si seq[c.id].actif (v3/commandes.js:905, 450).
- À faire : Rien à activer. Garder tout futur prix de transport hors de _seq_repartition, ou derrière seq actif, tant qu'aucun prestataire n'est branché.

**Tests : quatre scénarios, refus, contre-propositions, validations, litiges** (manque)

- Preuves : Pas de dossier tests/ ; aucun fichier de test dans supabase/ (ls vérifié).
- À faire : supabase/tests/transport-scenarios.sql, à lancer sur yowdymdnoiubatxlwhfv seulement, en blocs do $$ … raise exception 'TEST' $$ avec set_config('request.jwt.claims', …) et set local role authenticated. Scénarios : A même ville + livreur du vendeur ; B même ville + MGCI ; C villes différentes, transport inclus ; D villes différentes, transport à part + contre-proposition. Pour chacun : refus, contre-proposition, expiration à 48 h, confirmation, litige (commande_litige → admin_litige_trancher), et contrôle qu'aucune commission de 6,9 % n'existe hors MGCI, même par appel direct de commande_choisir_transporteur.

### Risques

- nego_agir n'existe en entier qu'en base. La réécrire à partir de schema-3.sql ferait perdre le minimum de vente (schema-37) et la correction de quantité (schema-26). Toujours repartir de pg_get_functiondef.
- Les anciennes versions de l'application appellent nego_agir, nego_transport, commande_creer, chauffeur_repondre2 et commande_choisir_transporteur avec leurs paramètres actuels. Ajouter nego_agir2, commande_creer2 et transport_agir au lieu de changer les signatures.
- Les 5 déclencheurs de commandes (commandes_commission_transport, commandes_mot, commandes_reseau_pause, commandes_sequestre, commission_sync) et celui de transport_missions appellent _ctr_sync, _seq_repartition et _commission_sync. Une erreur dans l'une bloque toute mise à jour de commande. Tester d'abord sur le projet de test.
- Étendre controle_sortie à litige_messages sans élargir alertes_source_check (dm et negociation seulement) ferait échouer les messages de litige qui contiennent un numéro.
- Imposer « le vendeur organise » en même ville change le défaut actuel (acheteur). Les 2 commandes de production (mode acheteur, terminée et annulée) ne doivent pas être recalculées.
- _transport_reseau_ouvert est IMMUTABLE : la rouvrir par create or replace peut ne pas se voir tout de suite dans les plans en cache. La passer en STABLE.
- Exiger le statut verifie pour les missions MGCI bloquera tout tant qu'aucun transporteur n'est vérifié (0 aujourd'hui).
- Aucun fichier de schéma ne doit contenir DELETE, DROP ou TRUNCATE, même en commentaire, sinon le MCP le refuse.

### Dépendances

- Chantier 2 (fiabilité, annulations) : il s'appuie sur commande_annuler, commande_repondre, chauffeur_repondre (refus de mission), commande_refus_chauffeur, commande_retirer_transporteur et sur la future transport_propositions. Un refus, une expiration ou un retrait pendant la négociation à trois doit être compté. Il faut aussi trancher qui « annule » quand le transporteur refuse.
- Chantiers 3 (badges) et 4 (boutiques, QR) : ils passent par le 2. Un badge ou une boutique de transporteur suppose la réouverture du réseau (_transport_reseau_ouvert) et des transporteurs vérifiés ; les codes transporteurs T-XXXX (transporteur_inscrire, _tr_code) sont la base naturelle d'un QR.
- Réouverture du transporteur MGCI : il faut d'abord des transporteurs vérifiés (0 aujourd'hui) et la décision du propriétaire de lever le schéma 62 (déclencheur et RESEAU_OUVERT).
- Le correctif de la commission de 6,9 % (schema-NN-commission-transport-mgci) passe avant tout le reste, car il ferme un chemin ouvert dès aujourd'hui.
- ville_arrivee doit utiliser la même liste que app/villes.js (carte du site public). PORTAGE-SITE.md partie 4 : une ligne par nouvel écran de transport. FOUNDER_CONTEXT.md et strategie/sources/ : à mettre à jour si les règles de commission ou de transport changent.

### Écarts entre les fichiers SQL et la base

- nego_agir : aucun fichier ne contient la version complète actuelle (modifiée sur place par schema-37:23-37 et par la correction citée dans schema-26:18) ; schema-3.sql est périmé.
- commande_creer en base : même logique que celle décrite pour schema-63 (mode reseau → validation code, transport inclus → vendeur obligatoire, commission_montant à 3,5 %). Je n'ai pas fait de comparaison mot à mot avec le fichier.
- _ctr_sync, _seq_repartition et _commission_sync : leurs dernières définitions sont dans supabase/schema-57-sequestre.sql (lignes 172, 116, 140, avec revoke aux lignes 206, 137, 167), et la logique lue en base correspond.
- Comparaison production / test (md5 identiques pour 14 fonctions) : affirmée par l'audit, non refaite ici ; seule la production a été relue.
- Écart entre l'écran et le serveur : v3/commandes.js:783 n'affiche le choix par code qu'en mode reseau, alors que commande_choisir_transporteur refuse ce mode et n'accepte que acheteur ou vendeur. Le chemin de l'écran ne mène nulle part, mais le chemin serveur reste ouvert par appel direct.
- alertes : droits TRUNCATE, TRIGGER et REFERENCES donnés à authenticated et à anon, hors de tout fichier de schéma (droits par défaut de Supabase).

### Corrections et ajouts du contrôleur

- Corrigé : « Dans choixTransport0, le choix par défaut est souvent acheteur, y compris pour une offre hors_ville » : FAUX pour hors_ville. v3/commandes.js:933 met defaut: 'vendeur' pour hors_ville ; l'option acheteur y est seulement proposée sous le nom « Livraison à <ville> : l'acheteur s'en charge » (l.934). Le défaut acheteur vaut pour : accord sans transport (l.929), offre « non » ou demande « acheteur » (l.936), et le cas restant (l.937).
- Corrigé : Phrase « Aucun paiement ne passe par l'application » citée à v3/commandes.js:1003 : mauvaise ligne. La ligne 1003 est <p class=cm-err>. La phrase est à la ligne 1005 ; une autre phrase proche est à la ligne 450 (« réglez-le entre vous » quand le séquestre est inactif).
- Corrigé : Libellés sq_depot / sq_solde cités à v3/commandes.js:47-51 : ils sont aux lignes 47-50 ; la ligne 51 est un commentaire sur le numéro WhatsApp du service litiges.
- Corrigé : Preuve « Interface : v3/commandes.js:1016 » donnée pour commande_repondre : la ligne 1016 appelle commande_creer, pas commande_repondre. La règle « l'autre partie confirme » est bien dans le serveur, mais cette ligne ne prouve pas l'écran de confirmation.
- Corrigé : Commission de 6,9 % hors MGCI : le défaut est réel, mais l'audit en sous-estime la gravité. transporteur_inscrire (en base) permet à n'importe quel membre de devenir transporteur tout de suite (statut en_attente). commande_choisir_transporteur et chauffeur_repondre refusent seulement les statuts refuse et suspendu. Un transporteur NON vérifié peut donc recevoir et accepter une mission, et faire naître une commission de 6,9 %, par un simple appel au serveur. L'écran ne le propose pas (v3/commandes.js:783), mais l'appel existe (l.802).
- Corrigé : « Le prix d'une mission est fixé seul par le chauffeur (schema-42-commission-transport.sql:122-150) » : le comportement est confirmé en base (chauffeur_prix, chauffeur_repondre2 ; appels dans v3/chauffeur.js:160-161). Les numéros de ligne du fichier n'ont pas été vérifiés : c'est la définition en base qui fait foi.
- Corrigé : « Accès en lecture seule grâce aux politiques » : il faut préciser. Seules messages et negociations ont une politique et un droit SELECT pour les membres. commandes, transport_missions, commande_etapes, commissions, commissions_transport, dm, discussions, litige_messages, transporteurs, sequestres et commande_itineraires ont la RLS active, aucune politique et aucun droit pour authenticated ou anon : tout passe par des fonctions security definer. C'est sûr, mais toute nouvelle table (transport_propositions) doit suivre le même modèle.
- Corrigé : « Si on étend controle_sortie à litige_messages, les valeurs permises de alertes.source sont à vérifier » : vérifié. La contrainte alertes_source_check n'autorise que 'dm' et 'negociation'. Il faudra l'élargir (nouvelle contrainte check, sans rien supprimer de données), sinon chaque message de litige qui contient un numéro échouera.
- Ajouté : commande_creer (en base) calcule commandes.commission_montant = round(mt*0.035) même quand le vendeur est administrateur. _seq_repartition et la table commissions mettent 0 dans ce cas. Les deux chiffres peuvent donc différer pour un vendeur administrateur (petit écart d'affichage, à aligner).
- Ajouté : Fonctions de transport oubliées par l'audit, toutes exécutables par authenticated : commande_retirer_transporteur (elle aussi limitée aux modes acheteur et vendeur), commande_transfert_preparer (transbordement vers un autre transporteur par code, avec la même règle « non refusé et non suspendu », donc un transporteur non vérifié est accepté), commande_refus_chauffeur, chauffeur_position, commande_position, chauffeur_transferts, transporteur_disponible. Elles doivent entrer dans la négociation à trois (par exemple : que devient le prix convenu après un transbordement ?).
- Ajouté : Déclencheurs qui relient mission et commission : transport_missions_commission → _ctr_mission → _ctr_sync, et sur commandes : commandes_commission_transport → _ctr_commande. Il y a 5 déclencheurs sur commandes : commandes_commission_transport, commandes_mot, commandes_reseau_pause, commandes_sequestre, commission_sync.
- Ajouté : commande_transport (en base) renvoie prix_transport et total_livraison (marchandise + prix du chauffeur), affichés dans le détail (v3/commandes.js:532, « prix du chauffeur »). Il faudra la changer pour afficher le prix accepté par les trois, et ne plus montrer un total quand le livreur est hors MGCI.
- Ajouté : Table commande_itineraires (1 ligne en production) : départ, arrivée, distance_m, duree_s. Elle n'est pas citée, mais elle peut servir à décider « même ville » par la distance.
- Ajouté : proposition_details (stock, delai_jours) existe à côté de la négociation. On peut y ranger des détails, mais rien n'y concerne le transport.
- Ajouté : nego_transport_suivi efface dernier_transport à chaque nouvelle proposition (new.dernier_msg différent). Avec le double appel non atomique (v3/negoce.js:424 et 535, nego_transport en .catch), une contre-proposition arrive donc toujours SANS transport tant que le second appel n'a pas réussi. Et nego_transport n'accepte que l'auteur de la dernière proposition : si l'autre partie l'accepte entre les deux appels, le marqueur transport est perdu.
- Ajouté : Le mode reseau est bloqué deux fois : le déclencheur commandes_reseau_pause (sur insert et update de commandes) et RESEAU_OUVERT=false (v3/commandes.js:57). _transport_reseau_ouvert est IMMUTABLE : en le rouvrant, les plans en cache peuvent garder l'ancienne valeur. Mieux vaut la rendre STABLE ou lire un réglage.
- Ajouté : Hors chantier, mais vu en lisant les droits : alertes donne TRUNCATE, TRIGGER et REFERENCES à authenticated et à anon (droits par défaut). PostgREST ne permet pas de lancer TRUNCATE, mais ce droit passe outre la RLS. À retirer lors du prochain audit de sécurité (revoke, avec l'accord du propriétaire).
- Ajouté : Production : 2 commandes, toutes deux en mode acheteur (une terminée, une annulée) ; 0 mission ; 0 transporteur ; 1 commission ; 0 commission transport ; 0 séquestre ; 3 négociations ; 0 message de litige. Aucune donnée existante ne sera touchée par les changements proposés.

## 2. Fiabilité et pénalités d’annulation

Aujourd'hui, chaque annulation laisse une trace dans le journal de la commande (commande_etapes : qui, quand, rôle, mot facultatif). La réputation publique (reputation_publique) compte les « annulations demandées » pour le badge oui/non « Fiable », et ce badge sert aussi au tableau du marché et à la comparaison des offres. Il manque : un motif obligatoire, des catégories (abusive, légitime, litige, problème technique), la fenêtre de 90 jours, les paliers, un vrai score, la suspension temporaire, l'historique des pénalités et la contestation. La seule sanction qui existe est le bannissement à vie, posé à la main par l'administrateur. Les tables sont bien fermées (RLS active, tout passe par des fonctions serveur) : on peut tout construire côté serveur sur cette base.

| Exigence | État | Écart |
|---|---|---|
| 1. Enregistrer chaque annulation : auteur, date, commande, étape, motif | partiel | Le motif est un texte libre et facultatif. L'étape au moment de l'annulation n'est pas enregistrée. Sur les chemins retrait, refus et litige, la personne imputable n'est pas désignée (annulation_par reste vide). Rien ne note qu'une commande 'a_confirmer' est restée sans réponse (aucune tâche d'expiration). |
| 2. Distinguer annulations abusives, légitimes, litiges, problèmes techniques | manque | Aucune distinction. Les refus et les retraits entrent dans le total sans être imputés à leur auteur. Une demande du vendeur pour une panne compte autant qu'un abus. |
| 3. Fenêtre glissante 90 jours : 1-2 abusives = avertissement ; 3-4 = baisse du score ; 5 = pénalité renforcée + examen ; suspension temporaire en cas de récidive | manque | Pas de comptage sur 90 jours, pas de paliers, pas d'avertissement, pas de suspension temporaire, pas de file « compte à examiner ». |
| 4. Score de fiabilité compréhensible, fondé sur commandes réalisées et annulations imputables | partiel | C'est un badge oui/non, pas un score. Le critère compte toutes les demandes d'annulation, depuis toujours. Les refus et les retraits ne sont pas imputés mais gonflent le total. |
| 5. Historique consultable et contestation d'une pénalité | manque | Le membre ne voit pas ce qui compte contre lui et ne peut pas contester. |
| 6. Pas de double pénalité pour une même annulation | manque | Pas de clé unique. Le risque est de compter à la fois les lignes du journal, l'annulation et le litige d'une même commande. |
| 7. RLS appropriées | partiel | Les tables à créer (annulations, sanctions, contestations) n'existent pas encore. |

### Détail et preuves

**1. Enregistrer chaque annulation : auteur, date, commande, étape, motif** (partiel)

- Preuves : En direct, commande_annuler a le md5 cdfaba91…, identique en prod et en test : c'est la version de supabase/schema-58-sequestre-regles.sql:59-95. Chaque geste passe par _cmd_journal (schema-26-commandes.sql:94-99) et écrit une ligne dans commande_etapes (schema-26:56-67 : commande_id, evenement, par, role, preuve, note ≤ 300, at). commandes.annulation_par garde le demandeur, même après l'acceptation. Quatre chemins mènent à etat='annulee' (recherche dans pg_proc) : retrait avant confirmation (commande_annuler), refus (commande_repondre, évènement 'refusee'), accord des deux parties (commande_annuler), litige tranché (admin_litige_trancher, rôle admin). Écran : v3/commandes.js:881 et 889-895. Prod : 2 commandes, dont 1 annulée (par refus : 1 évènement 'refusee', aucun 'annulee').
- À faire : Nouveau fichier supabase/schema-82-fiabilite.sql. Table public.annulations : commande_id unique, imputable_id, role, etape_au_moment, chemin ('retrait'|'refus'|'accord'|'litige_admin'), motif_code, motif_texte, categorie, decide_par, cree_le. La remplir par un déclencheur AFTER UPDATE OF etat ON commandes quand etat passe à 'annulee' : on ne touche pas aux quatre fonctions, et la personne imputable se déduit de annulation_par, cree_par ou de la décision de l'admin. Le motif obligatoire passe par un nouveau paramètre p_motif avec une valeur par défaut (create or replace, même signature que les appels de v3/commandes.js). Ajouter une liste de motifs dans geste() (cas 'non', 'annuler', 'annul-oui').

**2. Distinguer annulations abusives, légitimes, litiges, problèmes techniques** (manque)

- Preuves : Contraintes lues en direct : commandes_etat_check ('a_confirmer','en_cours','terminee','annulee','litige'), commande_etapes.evenement ; aucune catégorie. reputation_publique (schema-77-avis-une-fois.sql:74) compte seulement etat='annulee' and annulation_par = p_uid. admin_litige_trancher (en direct) n'impute l'issue 'annulee' à personne.
- À faire : Colonne categorie dans annulations, avec check ('a_examiner','abusive','legitime','litige','technique'). Règle par défaut calculée sur le serveur (proposition : refus et retrait = 'legitime' ; demande après confirmation = 'a_examiner'). Nouvelle fonction admin_annulation_classer(p_id, p_categorie, p_imputable, p_note), réservée à est_admin(). Pour les litiges, nouvelle fonction porte admin_litige_trancher2(p_cmd, p_issue, p_note, p_fautif uuid default null) ; l'ancienne reste pour v3/admin-transport.js:162.

**3. Fenêtre glissante 90 jours : 1-2 abusives = avertissement ; 3-4 = baisse du score ; 5 = pénalité renforcée + examen ; suspension temporaire en cas de récidive** (manque)

- Preuves : Aucune fonction de fiabilité ni de sanction dans pg_proc. Table bannis : clé user_id, motif check 'arnaque','mauvais_produits','insultes','autre', aucune date de fin, 0 ligne en prod. admin_lever_bannissement fait un delete. est_banni = exists dans bannis ; elle est appelée par commande_annuler, commande_repondre, commande_litige et garde_banni. 'suspendu' n'existe que pour les transporteurs (schema-27-transporteurs.sql:29).
- À faire : Fonction fiabilite_niveau(uid) (security definer, stable, non exposée à anon) : elle compte les annulations categorie='abusive' imputées et non annulées après contestation, sur 90 jours, et renvoie le palier. Table sanctions (user_id, type 'avertissement'|'suspension', annulation_id, debut, fin, motif, par, levee_le) : la suspension est toujours décidée par l'admin, jamais automatique (schema-18:11). Nouvelle fonction est_suspendu(uid), utilisée seulement pour les NOUVELLES commandes et annonces. Ne pas mettre la suspension dans est_banni : cela bloquerait la fin des commandes en cours. Liste « à examiner » dans v3/admin.js.

**4. Score de fiabilité compréhensible, fondé sur commandes réalisées et annulations imputables** (partiel)

- Preuves : reputation_publique (prod md5 9cb7ef95…, test 5f00d1c3… : seul un commentaire diffère ; schema-77:66-115) donne, par rôle : terminees, annulations_demandees, annulees, litiges_contre, total, note, avis, et 'fiable' en oui/non. Elle est utilisée par v3/reputation.js:198-209, et sur le serveur par tableau_marche (anon, badge v3/tableau.js:202) et besoin_comparer (v3/appro.js:278).
- À faire : Ajouter un champ 'fiabilite' à reputation_publique (create or replace, sans retirer les champs existants) : pourcentage = terminées / (terminées + abusives imputées sur 90 jours), plus le palier en mots. Recalculer 'fiable' à partir des abusives imputées et mettre à jour criteres_fiable. Prévoir le coût pour tableau_marche (jusqu'à 50 appels) : un index sur annulations(imputable_id, cree_le). Mettre à jour v3/reputation.js:203-207 et PORTAGE-SITE.md partie 4.

**5. Historique consultable et contestation d'une pénalité** (manque)

- Preuves : commande_journal existe, réservé aux parties et à l'admin (appelé par v3/commandes.js:375 et v3/admin-transport.js:194). Aucune fonction mes_annulations, mes_sanctions ni contester. Les signalements (signaler_membre, admin_signalements_membres via v3/admin.js:63) visent un membre, pas une pénalité.
- À faire : Fonctions mes_annulations() et mes_sanctions(), filtrées sur auth.uid(). Table contestations (annulation_id unique, auteur_id, texte ≤ 600, statut 'ouverte'|'acceptee'|'refusee', reponse, decide_par, decide_le) avec contester(), admin_contestations() et admin_contestation_decider(). Une contestation acceptée fait repasser la catégorie à 'legitime' (un update, jamais un delete). Écran « Ma fiabilité » dans le profil (v3/reputation.js) ; file dans v3/admin.js ; avertissement envoyé par notification interne.

**6. Pas de double pénalité pour une même annulation** (manque)

- Preuves : Rien ne lie une pénalité à une annulation. Dans commande_etapes, une même commande peut avoir plusieurs lignes 'annulation_demandee' et 'annulation_refusee', puis 'annulee'. Les sorties refus de marchandise (commande_refuser2) et litige (commande_litige) existent à côté.
- À faire : Contrainte unique (commande_id) sur annulations, et unique (annulation_id) sur sanctions et contestations ; insertions en on conflict do nothing. Le palier compte des annulations, pas des sanctions. Une commande tranchée en litige ne compte qu'une fois, en catégorie 'litige'. Pour les achats groupés (groupe_id), compter une seule fois par groupe.

**7. RLS appropriées** (partiel)

- Preuves : En direct (prod) : RLS active et 0 politique sur commandes, commande_etapes, bannis, avis, avis_commandes, litige_messages, signalements_membres, sequestres, transport_missions ; admins a 1 politique, signalements 3. _cmd_journal, est_banni et garde_banni ne sont exécutables que par postgres. commande_annuler, commande_repondre, commande_litige et les fonctions admin_* sont exécutables par authenticated, avec un contrôle à l'intérieur. reputation_publique et tableau_marche sont exécutables par anon.
- À faire : Pour chaque nouvelle table : RLS active, aucune politique, accès seulement par des fonctions security definer avec set search_path = public. Retirer l'exécution des fonctions internes à public, anon et authenticated. Le public ne voit que le palier ou le score agrégé, jamais le motif, le nom complet ni le numéro. Tester sur yowdymdnoiubatxlwhfv dans un bloc do $$ … raise exception 'TEST' $$.

### Risques

- commande_annuler, commande_repondre et admin_litige_trancher sont le cœur des commandes. Garder les signatures appelées par v3/commandes.js:879-895 et v3/admin-transport.js:162. Préférer un déclencheur sur commandes ou des paramètres optionnels.
- Changer 'fiable' dans reputation_publique change d'un coup le tableau public (tableau_marche, anon), la comparaison des offres (besoin_comparer) et les profils : des badges disparaissent ou apparaissent.
- Le calcul sur 90 jours, appelé jusqu'à 50 fois par tableau_marche, peut ralentir le tableau (plan gratuit).
- Mettre la suspension dans est_banni bloquerait la fin des commandes en cours (réception, litige) : utiliser une fonction séparée.
- admin_lever_bannissement fait un delete, et admin_bannir masque les annonces sans les remettre en ligne : ne pas copier ce modèle pour la suspension temporaire.
- Pour l'imputation, utiliser annulation_par ou la décision de l'admin, jamais le 'par' de la ligne 'annulee' du journal.
- Aucune sanction automatique (schema-18-signalements-preuves.sql:11) : la suspension reste une décision humaine.
- Les tables sequestres existent : aucune pénalité ne doit ressembler à une retenue d'argent.
- Historique : la seule annulation en prod est un refus. Pas de rétroactivité conseillée.

### Dépendances

- Chantier 3 (badges) : il dépend du nouveau champ 'fiabilite' de reputation_publique et du nouveau sens de 'fiable'. Se mettre d'accord avant sur le nom et la forme.
- Chantier 4 (boutiques/QR) : il affichera le score, et il faut décider si une boutique suspendue est masquée (même mécanisme que est_suspendu).
- Chantier 1 (transport/commande) : il touche peut-être commande_annuler, les étapes ou l'expiration des commandes 'a_confirmer'. Fusionner le chantier 1 d'abord, ou passer par un déclencheur pour éviter les conflits.
- Les annulations côté transporteur (transport_missions, statut 'suspendu' des transporteurs) relèvent du chantier 1 : décider si elles entrent dans la fiabilité.

### Écarts entre les fichiers SQL et la base

- reputation_publique : prod (md5 9cb7ef95…) et test (5f00d1c3…) ne diffèrent que par un commentaire. Logique identique.
- commande_annuler, commande_repondre, commande_litige, admin_litige_trancher, admin_bannir, admin_lever_bannissement et est_banni ont le même md5 en prod et en test. commande_annuler correspond à schema-58:59-95 ; la version de schema-26 est dépassée.
- signaler_membre existe en deux versions en base ; seule la nouvelle est exécutable par authenticated.
- Aucune table ni fonction de fiabilité, de pénalité ou de suspension de membre, ni dans les fichiers ni en base.

### Corrections et ajouts du contrôleur

- Corrigé : Exigence 4, « il oublie les refus/retraits » : c'est inexact. reputation_publique (prod, md5 9cb7ef95…) ne retire que les commandes encore 'a_confirmer'. Une commande refusée (commande_repondre, p_oui=false) ou retirée par son créateur (commande_annuler, branche a_confirmer) passe à etat='annulee' : elle entre donc dans 'annulees' et dans 'total', le dénominateur du critère 'fiable'. Elle n'entre pas dans 'annulations_demandees', car annulation_par reste vide sur ces deux chemins. Résultat : ces annulations ne pèsent pas contre leur auteur et, comme elles grossissent le total, elles aident même à garder le badge.
- Corrigé : Exigence 1, citation de l'écran : le champ « Pourquoi ? (facultatif) » est aux lignes v3/commandes.js:881 (refus, case 'non') et 889-891 (retrait ou demande, case 'annuler'), pas 893-898. Les lignes 892-895 sont l'acceptation et le refus de l'annulation, avec la mention « Un mot (facultatif) ».
- Corrigé : Risque « imputer à tort » : il faut le préciser. reputation_publique impute déjà à la bonne personne, parce que commande_annuler ne vide pas annulation_par quand l'acheteur accepte (schema-58:89-92 : seul etat change). Le risque ne concerne qu'un futur comptage fait à partir des lignes 'annulee' de commande_etapes, où par = celui qui accepte.
- Corrigé : Exigence 7 : l'audit ne parle pas de la table signalements. Elle a 3 politiques, alors que toutes les autres tables du domaine en ont 0 (pg_policies, prod). Cela ne change pas le statut, mais l'affirmation « aucune politique » ne vaut pas pour tout le domaine.
- Ajouté : reputation_publique sert aussi à tableau_marche (exécutable par anon : elle l'appelle pour chaque annonceur, jusqu'à 50 lignes par produit) et à besoin_comparer (vérifié par une recherche dans pg_get_functiondef). Changer le critère 'fiable' ou ajouter un calcul sur 90 jours change le tableau public et la comparaison des offres. Cela ajoute aussi du temps de calcul à chaque affichage du tableau.
- Ajouté : mes_commandes et mes_commandes2 (exécutables par authenticated) lisent annulation_par. L'écran des commandes en dépend : la nouvelle table annulations ne doit pas changer ce champ.
- Ajouté : Aucune tâche planifiée ne fait expirer une commande 'a_confirmer' laissée sans réponse (cron.job en prod : dm_purger, push_resume_identites, positions_purger, rappels_envoyer, groupes_echeances, marketing_tick, sequestre_liberer_echus). Le cas « l'autre partie ne répond pas » n'a donc pas de chemin. Il faut décider s'il compte comme une annulation.
- Ajouté : commande_refuser2 (refus de la marchandise à l'arrivée, avec photos et mot secret) et commande_litige sont d'autres sorties de commande qui touchent la fiabilité. Il faut les distinguer clairement des annulations pour ne pas pénaliser deux fois (exigence 6).
- Ajouté : Achats groupés : groupes_echeances met les participants au statut 'retire' et fait expirer les groupes. Ce ne sont pas des annulations de commande, mais il faut décider s'ils comptent.
- Ajouté : Espace administrateur : le bannissement se fait déjà depuis v3/admin.js (boutons data-bannir lignes 181, 206, 213 et 232 ; fonctions vers 294-308 : admin_bannir et admin_lever_bannissement). C'est l'endroit naturel pour ajouter « Suspendre (N jours) », « Classer l'annulation » et la file des contestations. admin_bannir masque aussi les annonces (offres et demandes passent en 'masquee') et la levée ne les remet pas en ligne : il faut décider ce que fait une suspension temporaire.
- Ajouté : Le libellé public « N annulations demandées » (v3/reputation.js:203) et le texte criteres_fiable affiché (ligne 207) devront changer si la règle change. Les guides du site public (tools/site/saisons.html, tools/site/guides/trouver-un-fournisseur.html) parlent de fiabilité ou de réputation : relire leur texte.
- Ajouté : Prévenir le membre : un avertissement ou une suspension doit lui être notifié dans l'application (notification interne ou fonction pousser existante, gratuite), sinon l'avertissement ne sert à rien.
- Ajouté : Règles du projet : chaque PR doit aussi mettre à jour docs/PASSATION.md, docs/REPRISE.md, PORTAGE-SITE.md partie 4, FOUNDER_CONTEXT.md et les modèles de strategie/sources/ quand une règle de confiance change.
- Ajouté : signaler_membre existe en deux versions en prod : l'ancienne n'est exécutable que par postgres, la nouvelle par authenticated. À garder en tête si on relie les signalements aux sanctions.

## 3. Badges et niveaux de confiance

Aujourd'hui, deux systèmes de « badges » existent sans lien entre eux. Les statuts de l'application (« Vendeur de confiance », « Acheteur sérieux », « Répond vite », « Actif », « Nouveau ») sont calculés dans le téléphone (v3/statuts.js:52-67) à partir de statuts_publics, qui compte les négociations conclues et non les commandes terminées. Le badge « Fiable » est calculé par le serveur (reputation_publique) à partir des commandes et des avis, sur toute l'histoire, avec des seuils écrits en dur. Il manque : les 4 niveaux vendeur et les 5 niveaux acheteur, les réglages modifiables par l'administrateur, la période glissante, le volume, la régularité, la différence entre annulation légitime et abusive, l'exclusion des litiges en cours ou gagnés, la grâce, l'historique et la contestation. En production il y a très peu de données (2 commandes, dont 1 terminée et 0 validée par code ; 1 avis ; 3 profils) : on peut changer les règles sans faire de tort à personne.

| Exigence | État | Écart |
|---|---|---|
| Badges vendeurs à 4 niveaux (Vendeur fiable, Bon, Excellent, Grand vendeur) | partiel | Un seul niveau, sans échelle. Deux libellés concurrents, avec des règles différentes (serveur et téléphone). |
| Badges acheteurs à 5 niveaux (dont Acheteur en gros) | partiel | Pas de niveaux. « Acheteur en gros » dépend d'un volume que rien ne calcule. Aucune table de poids par unité (seul transporteurs.capacite_kg existe, schema-27:27). |
| Quota : volume cumulé réellement vendu ou acheté | manque | Pas de cumul. Unités différentes. Montant seulement déclaré (commission_statut est forcé à 'non_activee'). |
| Quota : nombre de commandes terminées | partiel | Les puces visibles partout reposent sur des négociations conclues, qu'on ne peut pas vérifier. admin_refus_trancher (schema-57:399) met etat = 'terminee' même pour un refus total, donc une vente refusée compte comme réussie. |
| Quota : régularité | manque | Pas de notion de mois actifs. |
| Quota : taux d'annulation abusive (les annulations légitimes ne comptent pas) | partiel | Toute annulation demandée pèse, même une annulation d'un commun accord. Aucune catégorie. Côté acheteur, ce taux n'a presque pas de sens (il ne peut pas demander). |
| Calcul seulement sur des transactions vérifiables et terminées | partiel | Les statuts côté téléphone utilisent les négociations. Une commande « terminée » sur simple déclaration entre deux comptes complices compte autant qu'une commande validée par code. |
| Les litiges non résolus (ou gagnés) ne dégradent pas | manque | L'issue se déduit à peine (terminee ≈ en faveur du vendeur, annulee ≈ en faveur de l'acheteur), et rien ne dit « partagé ». |
| Période glissante | manque | Pas de fenêtre de temps. |
| Attribution, progression, dégradation et retrait automatiques | partiel | Sans stockage : impossible de voir un changement, de donner une grâce, de garder un historique ou de prévenir le membre. |
| Transparence (critères publics) | partiel | Texte en dur : il sera faux dès que les seuils seront réglables. |
| Période de grâce | manque | Pas de grâce. |
| Historique des changements | manque | Pas d'historique. |
| Contestation | manque | Pas de contestation. |
| Pas d'auto-attribution | partiel | Les statuts sont calculés dans le téléphone, donc sans valeur de preuve. Deux comptes complices peuvent enchaîner des commandes « terminées » sur simple déclaration. |
| Réglage des seuils par l'administrateur, sans changer le code | manque | Ni table de seuils, ni écran. |
| Calculs côté serveur | partiel | Les badges les plus visibles sont calculés dans le téléphone. |

### Détail et preuves

**Badges vendeurs à 4 niveaux (Vendeur fiable, Bon, Excellent, Grand vendeur)** (partiel)

- Preuves : reputation_publique (schema-77:66-117 ; base en direct, production et test) rend un seul booléen 'fiable' par rôle (lignes 97-101). Affiché en « Fiable » dans v3/reputation.js:202 (.rp-fiable, ligne 88). En parallèle, la règle 'confiance' de v3/statuts.js:55-57 (≥ 3 ventes conclues, note ≥ 4,2).
- À faire : Nouveau fichier supabase/schema-NN-niveaux.sql : table public.niveaux_regles (rôle, ordre, clé, libellé, seuils) et fonction public._niveau_calculer(uid, role), security definer, sans droit pour anon/authenticated. Lecture publique par public.niveaux_publics(ids uuid[]). Garder 'fiable' dans le JSON de reputation_publique (create or replace, même signature).

**Badges acheteurs à 5 niveaux (dont Acheteur en gros)** (partiel)

- Preuves : Même booléen 'fiable' pour le rôle acheteur (schema-77:97-101). Règle 'serieux' côté téléphone (v3/statuts.js:58-60).
- À faire : Mêmes objets avec rôle 'acheteur'. Pour « en gros » : seuil de volume en FCFA déclarés, ou table de conversion unité → kg à créer (décision du propriétaire).

**Quota : volume cumulé réellement vendu ou acheté** (manque)

- Preuves : commandes contient quantite, unite, montant, montant_refuse, refus_quantite (colonnes lues en production). Aucune fonction ne les additionne par membre.
- À faire : Volume = somme(montant − coalesce(montant_refuse,0)) des commandes terminées et comptées. Le présenter comme « valeur des commandes terminées déclarées », jamais comme de l'argent payé ou encaissé.

**Quota : nombre de commandes terminées** (partiel)

- Preuves : reputation_publique : count(*) filter (where etat = 'terminee') (schema-77:73). statuts_publics compte negociations.statut = 'conclue' (schema-77:43-45, 55-56 ; même empreinte md5 en test et en production). Ces statuts sont affichés sur les cartes (application.dc.html:1170), dans les négociations (v3/negoce.js:438, 488), sur la fiche et le classement (v3/reputation.js:177, 232, 239, 306), dans Mon compte (v3/compte.js:682) et sur l'ancien site (index-v3.html charge statuts.js).
- À faire : Compter seulement etat = 'terminee', libere_le non nul et montant_refuse < montant. Faire lire ces chiffres par niveaux_publics, puis brancher statuts.js dessus.

**Quota : régularité** (manque)

- Preuves : Aucun calcul. Le seul indicateur de temps est delai_median_h (schema-77:81-87, 108).
- À faire : Nombre de mois distincts avec au moins une commande comptée (date termine_le) dans la fenêtre glissante, comparé au seuil.

**Quota : taux d'annulation abusive (les annulations légitimes ne comptent pas)** (partiel)

- Preuves : annul_demandees = etat 'annulee' et annulation_par = uid (schema-77:74). commande_annuler (schema-58:59, même md5 en test et en production) : seul le vendeur peut demander l'annulation d'une commande confirmée, aucun motif n'est enregistré (seulement une note libre au journal). Un retrait avant confirmation passe à 'annulee' sans annulation_par : il est compté dans 'total', pas dans les annulations demandées. La contrainte commande_etapes.evenement contient 'annulation_demandee', 'annulation_refusee', 'annulee'.
- À faire : Dépend du chantier 2 : commandes.annulation_motif (liste fermée) et annulation_legitime (add column if not exists), remplis par commande_annuler (create or replace). Le taux ne compte que les annulations non légitimes.

**Calcul seulement sur des transactions vérifiables et terminées** (partiel)

- Preuves : Les avis ne se donnent qu'après une commande terminée (avis_commande_donner, schema-32:45, même md5 en test et en production). commandes.validation est 'declaration' ou 'code' (contrainte en direct) ; liberation est 'conforme', 'auto', 'refus' ou 'admin'. En production : 0 commande validée par code.
- À faire : Définir « comptée » : terminée, libérée, pas entièrement refusée. Pour les niveaux élevés, éventuellement validation 'code' ou étape attestée par le chauffeur (commande_etapes.role = 'chauffeur'), avec un plafond par couple acheteur/vendeur (comme schema-77 l'a fait pour les avis).

**Les litiges non résolus (ou gagnés) ne dégradent pas** (manque)

- Preuves : litiges_contre = litige_par is not null and litige_par <> uid (schema-77:76) : il compte les litiges en cours (etat = 'litige') et ceux tranchés en faveur du membre. admin_litige_trancher (schema-57:415, en production) écrit l'issue dans etat ('terminee' ou 'annulee'), liberation = 'admin' et dans le journal, mais garde litige_par.
- À faire : Correction immédiate possible sans le chantier 2 : ignorer etat = 'litige' (en cours). Puis, avec le chantier 2 : commandes.litige_issue et litige_tranche_le remplis par admin_litige_trancher et admin_refus_trancher (create or replace), et v3/admin-transport.js:162 pour le choix. Ne compter que les litiges perdus.

**Période glissante** (manque)

- Preuves : reputation_publique et statuts_publics n'ont aucun filtre de date (lus en direct).
- À faire : Réglage fenetre_jours. Filtre termine_le >= now() − fenetre.

**Attribution, progression, dégradation et retrait automatiques** (partiel)

- Preuves : Recalcul à chaque lecture (fonctions 'stable', rien n'est stocké). Progression côté téléphone : MDGStatut.progres (v3/statuts.js:92), affichée dans v3/compte.js:682. Tâches pg_cron en production : 7, dont aucune pour les niveaux.
- À faire : Table public.niveaux_membres (user_id, role, niveau, depuis, grace_jusqua, force_jusqua, calcule_le), RLS sans politique. Fonction public.niveaux_recalculer() réservée au service (upsert seulement, rien n'est effacé), tâche cron quotidienne 'mdg-niveaux' à une minute décalée. Fonction niveaux_moi() pour la progression calculée par le serveur.

**Transparence (critères publics)** (partiel)

- Preuves : 'criteres_fiable' est un texte figé (schema-77:110), affiché par v3/reputation.js:209. Les textes des statuts sont dans v3/statuts.js.
- À faire : niveaux_criteres() fabrique le texte à partir de niveaux_regles. Seulement des chiffres agrégés, jamais de nom ni de numéro.

**Période de grâce** (manque)

- Preuves : Rien dans le dépôt ni en base (aucune table ni colonne badge/niveau/grace, information_schema en production).
- À faire : niveaux_membres.grace_jusqua et réglage grace_jours. Notification par un cas nouveau de la fonction Edge supabase/functions/pousser.

**Historique des changements** (manque)

- Preuves : Aucune table en base. Modèle d'une table figée : litige_messages et son déclencheur litige_messages_fige (schema-58:196, 207).
- À faire : Table public.niveaux_journal (user_id, role, ancien, nouveau, raison, chiffres jsonb, at), en ajout seulement, avec un déclencheur qui refuse toute modification. Lecture par niveaux_mon_historique() et admin_niveaux_journal(uid).

**Contestation** (manque)

- Preuves : Rien pour les niveaux. Modèles : signalements (table en production), litige_messages (schema-58).
- À faire : Table public.niveaux_contestations (texte ≤ 300 caractères, statut ouverte/acceptee/refusee, decide_par, decide_le, reponse). Fonctions niveaux_contester(...) (une seule ouverte à la fois, filtre de texte), admin_niveaux_contestations(), admin_niveaux_decider(...) (forçage pendant N jours, avec une ligne au journal).

**Pas d'auto-attribution** (partiel)

- Preuves : avis_commandes : 'revoke all' et check (auteur_id <> cible_id) (schema-32:29, 33). Un seul avis par auteur compté (schema-77). reputation_publique exclut les bannis et est_admin_id. statuts_publics exclut les bannis et les profils supprimés.
- À faire : Calcul et stockage seulement côté serveur, sans aucun droit d'écriture pour le client. Plafond par couple acheteur/vendeur. Code ou chauffeur exigé pour les hauts niveaux. Mêmes exclusions (bannis, supprimés, compte officiel).

**Réglage des seuils par l'administrateur, sans changer le code** (manque)

- Preuves : Seuils en dur : schema-77:97-101 (5 commandes, 10 %, 5 %, 3 avis, 4,0) et v3/statuts.js:55-60 (3, 4,2, 4). Modèle de réglage : public.marketing_reglage (schema-45:13-24, une seule ligne id = 1, contraintes check, 'revoke all'), modifiable seulement en SQL. L'admin est découpé en modules (v3/admin-transport.js, v3/admin-mesures.js) mais n'a aucun écran de réglages.
- À faire : public.niveaux_reglage (une seule ligne : fenetre_jours, grace_jours, actif) et public.niveaux_regles (contraintes de bornes). admin_niveaux_regles() et admin_niveaux_regle_modifier(...) (vérifient est_admin(), écrivent au journal). Nouveau module v3/admin-niveaux.js sur le modèle d'admin-transport.js. Une ligne dans PORTAGE-SITE.md, partie 4.

**Calculs côté serveur** (partiel)

- Preuves : 'fiable' : serveur (reputation_publique). Statuts : téléphone (v3/statuts.js REGLES, lignes 52-67), à partir de statuts_publics.
- À faire : statuts.js n'affiche que ce que rend le serveur. Garder les clés k, le format de MDGStatut.liste/puces/detail/progres, le cache et MDGStable pour éviter les clignotements.

### Risques

- Changer les règles de statuts.js modifie les puces partout : cartes (application.dc.html:1170), négociations (v3/negoce.js:438, 488), fiche, structure et classement (v3/reputation.js:177, 232, 239, 306), Mon compte (v3/compte.js:682), et l'ancien site (index-v3.html charge statuts.js). Garder la même interface.
- statuts_publics et reputation_publique ont des signatures utilisées par le client : n'ajouter que des champs (create or replace), ne pas retirer 'fiable' ni 'criteres_fiable'.
- Passer des négociations conclues aux commandes terminées fait tomber les statuts à 0 (production : 2 négociations conclues, 1 commande terminée, 0 validée par code).
- Le MCP refuse le mot « delete » : le recalcul ne doit rien effacer (upsert seulement, journal en ajout seulement).
- Le nom « badge » existe déjà (push_badge = compteur de non-lus de l'icône) : choisir un autre nom (« niveaux ») pour éviter la confusion.
- Le volume est un montant déclaré : ne jamais le présenter comme payé ni écrire « PAYÉ ».
- Un refus total tranché par admin_refus_trancher compterait comme une vente terminée : à exclure, sinon on récompense un mauvais vendeur.
- Si « Fiable » et les nouveaux niveaux coexistent pendant la transition, une même fiche affichera deux badges contradictoires.
- Tester d'abord sur le projet de test (le texte de reputation_publique n'y diffère que d'un commentaire), puis appliquer le même fichier en production.

### Dépendances

- Chantier 2 : motif et catégorie d'annulation (annulation_motif, annulation_legitime) ; issue claire des litiges (litige_issue, litige_tranche_le) remplie par admin_litige_trancher et admin_refus_trancher, avec le choix dans v3/admin-transport.js:162. Sans cela, « annulations légitimes » et « litiges gagnés » restent impossibles. Seul « ignorer les litiges en cours » peut se faire tout de suite.
- Chantier 1 : définir la commande « vérifiable » (code, attestation du chauffeur, libération) et la conversion des unités en kg si le volume se mesure en tonnes.
- Chantier 4 : la boutique et la page QR lisent niveaux_publics(ids) sans refaire le calcul, et sans numéro ni nom complet.
- Site : index-v3.html et les modules communs (statuts.js, reputation.js) suivent automatiquement. Les pages fabriquées dans tools/site/ devront lire la même fonction publique.

### Écarts entre les fichiers SQL et la base

- reputation_publique : 3 346 caractères en production, 3 293 en test. La seule différence est la ligne de commentaire « -- un avis par auteur et par rôle ». Même logique, conforme à schema-77.
- Même empreinte md5 en test et en production, et conformes aux derniers fichiers : statuts_publics, _avis_uniques, admin_litige_trancher (schema-57:415, qui remplace schema-27:376), admin_refus_trancher (schema-57:399), commande_annuler (schema-58:59), commande_litige, avis_commande_donner, mieux_notes, identite_ok.
- Aucune table ni fonction de niveaux, de seuils ou de contestation, ni en base ni dans supabase/schema-*.sql : tout est à créer.
- _structure_verifiee(p_uid) existe dans le fichier (schema-39:44) et en production : pas d'écart.
- Production : 7 tâches cron, aucune pour les niveaux.

### Corrections et ajouts du contrôleur

- Corrigé : Numéros de ligne faux pour schema-77 (le fichier n'a que 130 lignes). reputation_publique est en lignes 66-117 (pas 83-140) ; les compteurs sont en 73-76 (pas 89-92) ; 'fiable' en 97-101 ; 'criteres_fiable' en 110 (pas 137) ; statuts_publics en 35-63, ses négociations conclues en 43-45 et 55-56 (pas 46-50, 57-60, 72-73).
- Corrigé : Longueur de reputation_publique fausse : 3 346 caractères en production et 3 293 en test (pas 3 174 et 3 121). La conclusion est juste : la seule différence est la ligne de commentaire « -- un avis par auteur et par rôle ». Même logique des deux côtés.
- Corrigé : « Aucun champ ne dit qui a eu raison » dans un litige : c'est inexact. admin_litige_trancher (base en direct, p_issue dans 'terminee'/'annulee') écrit l'issue dans commandes.etat, dans liberation = 'admin' et au journal commande_etapes (preuve 'admin'). admin_refus_trancher écrit montant_refuse. On peut donc déjà déduire l'issue. Ce qui manque, c'est un champ clair : pour qui le litige est tranché, et quand. Un litige en cours se voit déjà avec etat = 'litige', mais reputation_publique le compte quand même (filtre litige_par seul).
- Corrigé : admin_litige_trancher est créée dans schema-27-transporteurs.sql:376, puis remplacée dans schema-57-sequestre.sql:415. Ce n'est donc pas seulement le schéma 57.
- Corrigé : « La fonction structures_verifiees n'existe pas » : il existe bien public._structure_verifiee(p_uid) (schema-39-structures-verifiees.sql:44, présente en production, réservée au serveur). Elle peut servir de critère.
- Corrigé : « Calcul sur transactions vérifiables : partiel ». En production, aucune commande n'a validation = 'code' (count = 0), et il n'y a qu'une commande terminée. Si l'on exige le code, tout le monde tombe à 0 aujourd'hui. Il faut le dire au propriétaire.
- Corrigé : Un détail manque sur commande_annuler (base en direct). L'acheteur ne peut pas demander l'annulation d'une commande confirmée : seul le vendeur la demande, et l'acheteur l'accepte. 'annul_demandees' pèse donc presque toujours sur le vendeur. Ce n'est pas une erreur de l'audit, mais cela fausse l'idée d'un taux d'annulation pour l'acheteur.
- Ajouté : admin_refus_trancher (schema-57:399, en production) met etat = 'terminee' et liberation = 'admin', même quand tout est refusé (montant_refuse = montant). Une vente entièrement refusée compte donc comme vente terminée pour le vendeur, dans reputation_publique et dans le futur calcul. Il faut exclure les commandes où montant_refuse >= montant, ou les compter à part.
- Ajouté : L'espace admin se découpe déjà en modules branchables (v3/admin-transport.js, v3/admin-mesures.js, outils H.rpc/H.relire de v3/admin.js:35). Un écran « Badges » doit suivre ce modèle : nouveau v3/admin-badges.js, et non un ajout dans admin.js.
- Ajouté : Les litiges se tranchent déjà dans v3/admin-transport.js:162 (admin_litige_trancher). C'est l'endroit à modifier si le chantier 2 ajoute un champ « en faveur de ».
- Ajouté : Le site public charge les mêmes modules : index-v3.html inclut statuts.js et reputation.js. Changer statuts.js change aussi l'ancien site.
- Ajouté : v3/reputation.js:306 (classement « mieux notés ») et :177 (fiche d'une structure) affichent aussi MDGStatut.puces. La liste des endroits touchés doit les inclure.
- Ajouté : Aucune table de poids par unité n'existe : seul transporteurs.capacite_kg (schema-27:27) existe. « Grand vendeur » et « Acheteur en gros » au volume physique demandent une conversion à créer, ou un volume en FCFA déclarés.
- Ajouté : Les notifications passent par la fonction Edge supabase/functions/pousser (cas numérotés, schema-45:7). Prévenir d'un changement de niveau demande un cas nouveau dans cette fonction. Attention : push_badge (en base) compte les messages non lus pour la pastille de l'icône, il n'a rien à voir avec les badges de confiance (risque de confusion de noms : préférer « niveaux »).
- Ajouté : La tâche planifiée proposée devrait éviter l'heure pleine, comme les tâches existantes (minutes 23 et 45 : mdg-purger-positions, mdg-identites-matin).
- Ajouté : statuts_publics masque déjà les comptes bannis et supprimés (profils.supprime_le). badges_publics doit faire de même, et reputation_publique exclut aussi est_admin_id.
- Ajouté : La table de réglages modèle (marketing_reglage, schema-45:13-24) est fermée par 'revoke all' et RLS active, sans politique. L'écran admin devra passer par des fonctions security definer qui vérifient est_admin().
- Ajouté : Profils : la table s'appelle public.profils (pas profiles), avec la colonne role (le rôle déclaré). On pourrait s'en servir pour ne montrer que les niveaux du bon rôle.

## 4. Boutiques, liens de partage et QR codes

Il n'y a pas encore de « boutique » au sens de la mission. Deux briques s'en approchent. La page « Vendeur » de l'application (#/producteurs/<id>) prend l'id d'une ANNONCE et ne montre que les annonces déjà chargées sur ce téléphone. La fiche « profil public » (v3/reputation.js:211) montre l'identité, le badge, la réputation, les villes et les ventes, mais elle n'a ni adresse, ni partage, ni QR. Côté serveur, il y a déjà des RPC publiques (profil_public, reputation_publique, fil_public qui tronque les noms), un pseudo unique sans tenir compte des majuscules (personne ne l'utilise encore), un stock décompté à l'accord et rendu à l'annulation. Il manque l'adresse stable par vendeur, une RPC « boutique » qui lise le catalogue sur le serveur, les boutons Partager / Copier / QR (la librairie QR est déjà dans le dépôt), un aperçu Open Graph (impossible avec une adresse à # sur GitHub Pages), un verrou de stock contre la survente et un retrait d'annonce qui garde une trace.

| Exigence | État | Écart |
|---|---|---|
| Boutique publique par vendeur | partiel | La page vendeur dépend d'une annonce et des données locales. La fiche profil est une feuille sans adresse. Aucun objet « boutique » en base ni dans les fichiers schema-*.sql. |
| Accessible depuis profil, annonces, recherche | partiel | Pas de lien « Voir la boutique » dans le profil, la page vendeur ni la recherche. La liste ne vient pas du serveur. |
| URL unique partageable adaptée au domaine réel | manque | Aucune adresse de boutique. Le pseudo est déjà unique mais facultatif, et personne ne l'a rempli : il ne peut pas être la seule clé. |
| Identité, badge, réputation, localisation, catalogue | partiel | Les morceaux existent mais ne sont pas réunis en un appel ni sur une page partageable. Le catalogue n'est pas lu côté serveur. Le nom peut être complet si le membre l'a choisi. |
| Chaque produit : photo, prix, unité, quantité, ville, statut du stock | partiel | Pas d'état « stock faible » ni « indisponible ». Une offre épuisée passe en retiree et sort du marché (offers() filtre epuise, :1038). |
| Gestion du stock par le vendeur (ajouter, modifier, retirer, indisponible) | partiel | « Retirer » supprime vraiment la ligne (aucune trace). Il n'y a pas de pause. La liste ne lit que le téléphone. prompt() est une fenêtre native. Une pause par status ≠ active fermerait toutes les négociations en cours (nego_annonce_retiree). |
| Commandes refusées au-delà du stock | partiel | (1) Deux accords en même temps sur la même offre lisent tous les deux l'ancien stock et passent ; greatest(0, …) cache la survente. (2) Une quantité null n'est pas contrôlée à l'accord, puis devient 0 et retiree : elle n'est pas « illimitée ». |
| Partager ma boutique / Copier le lien / Télécharger mon QR code | manque | Pas de bouton boutique, pas de QR dans l'application, pas de téléchargement d'image. |
| QR ouvrant la boutique sur mobile et ordinateur | manque | Sur ordinateur, le visiteur voit la maintenance, et le QR mène à l'accueil. |
| Aperçu de partage (Open Graph) | manque | Les robots d'aperçu ignorent le # : un lien de boutique n'aura que l'aperçu générique, ou aucun. |
| Liens directs par produit | partiel | Le lien vise un produit en général, pas l'offre d'un vendeur. |
| Mesure des visites et clics avec vie privée | partiel | Pas d'événement de boutique ni de totaux pour le vendeur. Aucune mesure enregistrée pour l'instant (cause non établie). Pas de limite par visiteur : n'importe qui peut saturer le plafond. |
| Design premium, animations, responsive, états | partiel | Pas d'écran boutique ni d'état « stock faible » ou « pause ». |
| Jamais de donnée privée | partiel | seller_name peut contenir un nom complet (nom_public = true) et il est lisible par anon via /rest/v1/offres. |
| Commande confirmée jamais effacée sans trace, historique des statuts | partiel | Les commandes semblent protégées. Les offres, elles, disparaissent si le vendeur la retire ou si le compte est supprimé (cascade), et les négociations y renvoient par cible_id. |
| Stock réservé pendant la commande, annulation selon règles MGCI | partiel | La « réservation » est une vente immédiate à l'accord ; les propositions en attente ne réservent rien (acceptable). Il reste la course sans verrou décrite plus haut. |

### Détail et preuves

**Boutique publique par vendeur** (partiel)

- Preuves : application.dc.html:993 (route producteurs → page 'vendeur', extra.vid) ; :1765-1769 (vo = O.find(o => o.id === S.vid), sinon « Vendeur introuvable · Cette offre a été retirée. »). v3/reputation.js:211-246 (profil(uid) appelle reputation_publique, avis_de2 et profil_public). En base : profil_public(p_uid) et reputation_publique(p_uid), security definer, exécutables par anon (has_function_privilege).
- À faire : Route #/boutique/<cle> dans fromHash (application.dc.html:990) et hashOf (:1035). Garder #/producteurs/<id_offre> et l'envoyer vers la boutique du propriétaire de l'offre. Nouvelle RPC boutique_publique(p_cle text), security definer, dans un fichier supabase/schema-NN-boutiques.sql : identité (même règle de nom que fil_public), badge, réputation, ville, offres actives et épuisées récentes, avec des colonnes choisies une à une.

**Accessible depuis profil, annonces, recherche** (partiel)

- Preuves : application.dc.html:1195 (carte : offre → openVendeur(x.id), demande → MDGRep.profil) ; page vendeur : bouton « voir » vers MDGRep.profil (:1768). v3/reputation.js:245 (« En ce moment » = N().list('offres') filtré par _uid : annonces connues en local seulement).
- À faire : Bouton « Voir sa boutique » dans profil() (v3/reputation.js), sur la page vendeur et dans les cartes. La liste vient de boutique_publique.

**URL unique partageable adaptée au domaine réel** (manque)

- Preuves : Pas de fichier CNAME (vérifié). Domaine : https://stan77i.github.io/marchedegrosci/ (canonical des gabarits du site, tools/site-public.js). Le site a site/sitemap.xml mais pas de robots.txt à la racine du domaine (site de projet GitHub Pages). En base : index unique profils_pseudo_unique sur lower(pseudo) et contrôle pseudo ^[A-Za-z0-9_.-]{3,24}$ ; 0 profil avec un pseudo sur 3.
- À faire : Adresse : https://stan77i.github.io/marchedegrosci/application.dc.html#/boutique/<cle>. cle = pseudo s'il existe, sinon un code court stable calculé côté serveur (par ex. left(md5(user_id),10), comme fil_public), jamais un numéro. Pas besoin de nouvelle contrainte d'unicité. Changer le pseudo changerait l'adresse : le code court doit toujours rester valable.

**Identité, badge, réputation, localisation, catalogue** (partiel)

- Preuves : profil_public (affichage = nom_public, avatar, bio, ville, region_slug, membre_depuis, ventes, volumes, lieux, historique des 12 dernières, vu_le pour les connectés seulement) ; nom_public renvoie le pseudo, sinon prénom + nom complet si profils.nom_public = true, sinon initiale ; reputation_publique ; rendu v3/reputation.js:221-246.
- À faire : boutique_publique assemble le tout et applique la règle prénom + initiale (fil_public) pour anon, quel que soit nom_public. Choisir ce que l'historique montre sans compte.

**Chaque produit : photo, prix, unité, quantité, ville, statut du stock** (partiel)

- Preuves : Colonnes d'offres (information_schema) : product_slug, product_label, price, unit, quantity, city, region_slug, status (active|retiree|masquee), qte_min, transport (inclus|hors_ville|non), negociable, maj_le. Photo via A.SACK / v2/img/produit-<slug>.webp. Épuisé : application.dc.html:1757 (epTxt).
- À faire : boutique_publique renvoie un état calculé : disponible, stock_faible (seuil à décider), epuise (retiree avec quantité 0 après une vente conclue). Affichage avec la carte existante et des pastilles .nbul.

**Gestion du stock par le vendeur (ajouter, modifier, retirer, indisponible)** (partiel)

- Preuves : application.dc.html:1758-1760 : stock par prompt(), del filtre le stockage local. v3/nuage.js:222 (PATCH status retiree/active selon le stock) ; :228-229 (DELETE /rest/v1/offres des annonces retirées du téléphone). Politiques offres : « modifier ses offres » (UPDATE) et « retirer ses offres » (DELETE), user_id = auth.uid(). Déclencheurs : offres_stock_garde (_stock_garde), offres_nego (nego_annonce_retiree : ferme les négociations ouvertes dès que le statut n'est plus 'active' ou à la suppression).
- À faire : Retrait doux (status = 'retiree') au lieu du DELETE de nuage.js:229, avec l'accord du propriétaire. Pause : ajouter un statut 'pause' à offres_status_check, et adapter nego_annonce_retiree pour ne pas fermer les négociations en pause (create or replace). Feuille de stock à la place de prompt(). Liste des annonces lue depuis le serveur.

**Commandes refusées au-delà du stock** (partiel)

- Preuves : nego_agir (en base) : « Quantité trop grande » à la proposition et « Quantité plus disponible » à l'accord, seulement si a.quantity > 0 ; lecture select quantity, status from offres SANS for update (le seul for update vise la négociation). stock_apres_accord : quantity = greatest(0, coalesce(quantity,0) - quantite_finale), puis retiree si ≤ 0.
- À faire : Dans nego_agir : select … from offres where id = n.cible_id for update avant le contrôle (via une fonction porte si le texte contient un mot bloqué par le MCP). Dans stock_apres_accord : lever une exception si quantity < quantite_finale. Rendre quantity obligatoire à la publication (0 ligne null aujourd'hui). Tester sur yowdymdnoiubatxlwhfv avec raise exception 'TEST'.

**Partager ma boutique / Copier le lien / Télécharger mon QR code** (manque)

- Preuves : Partages existants : fiche produit application.dc.html:1861 (navigator.share, sinon clipboard) ; suivi de livraison v3/commandes.js:980 (share, sinon wa.me). Librairie : vendor/qrcode-generator-1.4.4.js, en cache sw.js:73, utilisée par maintenance.html:116 et site/site.js:153-166.
- À faire : Dans Mon compte : Partager (navigator.share), Copier (clipboard), Télécharger le QR (SVG puis canvas → PNG, avec le logo, « de Gros » en #F2C230). Charger la librairie à la demande. Lien avec ?utm_source=boutique&utm_medium=qr|lien.

**QR ouvrant la boutique sur mobile et ordinateur** (manque)

- Preuves : application.dc.html:21-22 : sur ordinateur sans admin, location.replace('maintenance.html' + hash). maintenance.html:97 : go.href garde utm et hash ; :109-111 : le QR et le lien sont faits sur location.href sans ?/#, donc l'adresse de la boutique ET l'utm sont perdus.
- À faire : Dans maintenance.html, mettre le hash et l'utm dans le lien du QR (« Scannez pour ouvrir la boutique »), sans lever la protection ordinateur → maintenance. Sur téléphone, le hash arrive déjà à fromHash.

**Aperçu de partage (Open Graph)** (manque)

- Preuves : Aucune balise og: dans application.dc.html ni index.html (grep). og: présentes dans les gabarits du site (tools/site/produit.html:11 og:image).
- À faire : Solution gratuite : pages statiques site/boutiques/<cle>/ fabriquées par tools/site-public.js (nouveau gabarit tools/site/boutique.html) depuis la RPC publique, en noindex et hors sitemap tant que le site est caché, seulement pour les vendeurs qui ont accepté. Au minimum : og:title, og:description et og:image génériques sur application.dc.html.

**Liens directs par produit** (partiel)

- Preuves : #/produits/<slug> (application.dc.html:992, 1035) ; dossiers site/produits/.
- À faire : #/boutique/<cle>/<code court d'offre> (left(md5(id),12) comme fil_public) et un bouton « Partager cette offre ».

**Mesure des visites et clics avec vie privée** (partiel)

- Preuves : mesurer() en base : événements vue|clic|ouverture_app|connexion_app, page/cible/source nettoyées [a-z0-9/._-], plafond global de 20 000 par jour, pas d'identifiant de personne, exécutable par anon. Appels : application.dc.html:1007-1012, maintenance.html (vue au chargement). site_mesures : 0 ligne en production. suivi_liens = suivi de livraison, sans rapport.
- À faire : mesurer('vue', 'app/boutique', cible = cle, source = utm) et mesurer('clic', …) pour Partager/Copier/QR. Plus tard, une RPC mes_visites_boutique() qui renvoie des totaux pour auth.uid(). Vérifier dans les journaux pourquoi site_mesures est vide.

**Design premium, animations, responsive, états** (partiel)

- Preuves : Fiche profil : chargement, erreur ou hors ligne, vide (« Pas encore noté »), badge vérifié (v3/reputation.js) ; Épuisé (application.dc.html:1757).
- À faire : Concevoir l'écran avec DESIGN.md, impeccable et antislop : pas de fondu à l'ouverture, MDGStable.poser pour les relectures, nombres en .nbul, aucun bleu, vérification sur iPhone émulé, en clair et en sombre.

**Jamais de donnée privée** (partiel)

- Preuves : offres_sans_numero (phone := null) ; offres_nom_compte force seller_name = nom_public ; fil_public tronque en prénom + initiale. Politique « offres lisibles par tous » (status = 'active') et droits SELECT anon sur toutes les colonnes d'offres (user_id, client_id, agent, lieu, phone, seller_name). profil_public donne à anon l'historique de ventes et d'achats.
- À faire : La boutique passe seulement par une RPC qui choisit ses colonnes (règle de fil_public). Plus tard, retirer à anon le droit de lire les colonnes seller_name et agent (avec l'accord du propriétaire, car le site s'en sert peut-être).

**Commande confirmée jamais effacée sans trace, historique des statuts** (partiel)

- Preuves : commande_etapes et commandes : RLS active, aucun droit anon ; les écritures passent par des RPC (détail : chantier 2). offres.user_id → auth.users ON DELETE CASCADE ; DELETE permis au vendeur sur ses offres.
- À faire : Retrait doux des offres. Remplacer la cascade de suppression de compte par un anonymat : décision du propriétaire, en lien avec le chantier 2.

**Stock réservé pendant la commande, annulation selon règles MGCI** (partiel)

- Preuves : stock_apres_accord (déclencheur negociation_stock) décompte à la conclusion ; _cmd_rendre_stock rend le stock (mdg.stock_rendu) pour la négociation ou l'achat groupé (groupes_achat.offre_id).
- À faire : Verrou de ligne sur offres dans nego_agir. Règles d'annulation : chantier 2.

### Risques

- Changer #/producteurs/<id> casserait les liens déjà partagés : garder l'ancienne route en redirection.
- Le pseudo comme clé : s'il change, l'adresse change. Garder aussi un code court toujours valable.
- Retrait doux à la place du DELETE (nuage.js:229) : cela change limite_annonces, annonces_total de profil_public, la synchro locale et le déclencheur offres_nego. À tester sur la base de test.
- Statut 'pause' : nego_annonce_retiree fermerait toutes les négociations ouvertes, sauf si la fonction est adaptée.
- Verrou for update dans nego_agir (7 339 caractères, appelée partout) : attentes possibles, et peut-être un texte bloqué par le MCP. Passer par une fonction porte et tester sur yowdymdnoiubatxlwhfv.
- Exception dans stock_apres_accord : un déclencheur qui échoue annule toute la conclusion. Le message doit être clair pour l'utilisateur.
- Pages boutiques statiques : des données de membres publiées sur GitHub Pages. Il faut le noindex, les garder hors sitemap, l'accord du vendeur, et le prénom + initiale seulement.
- Le QR de maintenance modifié ne doit pas lever la protection « ordinateur → maintenance ».
- mesurer() sans limite par visiteur : la mesure des boutiques peut être faussée.
- À chaque changement du front : ?v=, CACHE de sw.js (mgci-v246 aujourd'hui), ligne dans PORTAGE-SITE.md partie 4.

### Dépendances

- Chantier 2 (fiabilité/annulations) : règles d'annulation, journal commande_etapes, cascade de suppression de compte, retrait doux des offres ; reputation_publique (fiable, annulations) nourrit l'en-tête de la boutique.
- Chantier 3 (badges) : le badge d'en-tête (identite_ok, structure_verifiee, « Fiable ») doit venir de la même source. Attendre leur définition.
- Chantier 1 (transport/commande) : offres.transport (inclus|hors_ville|non) s'affiche sur chaque produit. Le verrou de stock dans nego_agir et _cmd_rendre_stock sont partagés : un seul chantier doit modifier nego_agir, pour éviter les conflits.
- Outils existants : vendor/qrcode-generator-1.4.4.js, mesurer() (schéma 81), fil_public (règle de nom, code court md5), tools/site-public.js et son action GitHub.

### Écarts entre les fichiers SQL et la base

- Aucun objet « boutique » (table, RPC, colonne) ni dans supabase/schema-*.sql ni en production.
- nego_agir en base : contrôles « Quantité trop grande » et « Quantité plus disponible » présents, aucun for update sur offres. Plusieurs fichiers redéfinissent la fonction : on ne sait pas lequel correspond exactement à la base (non comparé ligne à ligne).
- stock_apres_accord en base : greatest(0, coalesce(quantity,0) - quantite_finale), puis retiree.
- Index profils_pseudo_unique présent en base (lower(pseudo), partiel) ; fichier source non identifié dans cet audit.
- annonces_publiees en base = compteur (user_id, n), sans politique ni droit anon.
- site_mesures : la table existe, 0 ligne en production, alors que maintenance.html appelle mesurer().
- Projet de test yowdymdnoiubatxlwhfv : non vérifié.

### Corrections et ajouts du contrôleur

- Corrigé : « pseudo … sans unicité constatée » est FAUX : l'index unique profils_pseudo_unique existe en production (CREATE UNIQUE INDEX … ON profils (lower(pseudo)) WHERE pseudo IS NOT NULL), et v3/compte.js:44 traduit déjà l'erreur (« Ce pseudonyme est déjà pris »). Il n'y a rien à ajouter pour l'unicité. Mais aucun profil n'a de pseudo aujourd'hui (count = 0 sur 3 profils), donc le pseudo ne peut pas servir seul de clé de boutique.
- Corrigé : « seller_name tel que saisi (parfois un nom complet) » est inexact : le déclencheur offres_nom_compte (fonction annonce_nom_compte) force seller_name = nom_public(user_id) à chaque INSERT/UPDATE, sauf pour l'admin. Le vrai risque vient de nom_public : il renvoie le pseudo, sinon le prénom + le NOM COMPLET quand profils.nom_public = true. seller_name, lisible par anon, peut donc contenir un nom complet si le membre l'a choisi.
- Corrigé : Le risque « garder le cas null = illimité » repose sur une idée fausse. Dans stock_apres_accord (en base), une quantité null devient greatest(0, coalesce(null,0) - q) = 0, puis l'offre passe en 'retiree'. Une offre sans quantité n'est donc PAS illimitée : elle disparaît après le premier accord. Seul le contrôle de nego_agir (« if a.quantity > 0 … ») la laisse passer. En production, 0 offre a une quantité null.
- Corrigé : Références décalées : la fonction profil(uid) commence à v3/reputation.js:211 (et non 214), « En ce moment » est à :245-246 (et non 248).
- Corrigé : « annonces_publiees » n'est pas une liste d'annonces, contrairement à ce que laisse croire la mission. C'est une table compteur (colonnes user_id, n ; 2 lignes ; RLS active, aucune politique, aucun droit anon). Elle ne peut pas servir de catalogue de boutique.
- Corrigé : La « garde _stock_garde » n'empêche pas tout « regonflement » : elle n'agit que si l'offre a déjà une vente conclue ET (statut retiree avec quantité ≤ 0) ; elle n'empêche pas de remonter la quantité d'une offre encore active. La formulation de l'audit est trop large.
- Corrigé : « Course possible entre deux accords » : c'est juste, mais il faut préciser. L'UPDATE de stock_apres_accord pose bien un verrou de ligne, et le second accord recalcule sur la valeur à jour. Mais le contrôle de nego_agir (select quantity, status … sans for update) a lu l'ancienne valeur, et greatest(0, …) masque la survente. Vérifié en base : nego_agir ne contient pas de verrou 'for update' sur offres (le seul 'for update' vise la négociation).
- Ajouté : Droits de colonnes : anon a SELECT sur TOUTES les colonnes d'offres (has_column_privilege), y compris user_id, client_id, agent, lieu et phone. phone est toujours null grâce au déclencheur offres_sans_numero, mais rien ne le garantit au niveau des droits. Une boutique publique doit passer par une RPC.
- Ajouté : Clé ON DELETE CASCADE de offres.user_id vers auth.users : supprimer un compte efface ses offres sans trace. Les négociations qui renvoient par cible_id deviennent orphelines. Cela touche la règle « jamais effacé sans trace » (lien avec le chantier 2).
- Ajouté : Déclencheur offres_nego (nego_annonce_retiree) : retirer ou supprimer une offre ferme les négociations ouvertes (statut 'close', motif annonce_retiree). Un état « pause/indisponible » qui passerait par status ≠ 'active' fermerait aussi toutes les négociations en cours. C'est un effet de bord majeur à trancher.
- Ajouté : La suppression est double. « Retirer » (application.dc.html:1760, del) efface l'annonce sur le téléphone, puis la synchro v3/nuage.js:228-229 envoie un DELETE au serveur. « Stock à zéro » passe en revanche par un PATCH status=retiree (nuage.js:222). Deux chemins différents pour « ne plus vendre ».
- Ajouté : Mes publications ne lit que le stockage local (A.read('offres')) : un vendeur qui change de téléphone ne voit pas ses annonces serveur dans la gestion du stock.
- Ajouté : mesurer() est appelable par anon, sans limite par visiteur. Seul le plafond global de 20 000 par jour existe : n'importe qui peut le saturer et fausser ou bloquer la mesure des boutiques. maintenance.html l'appelle déjà au chargement (une fois par session), et pourtant site_mesures compte 0 ligne : soit personne n'est passé depuis le schéma 81, soit l'appel échoue (à vérifier dans les journaux, sans le supposer).
- Ajouté : Le QR de maintenance perd aussi les paramètres utm, pas seulement le hash. La variable lien = location.href.replace(/[?#].*$/,'') pointe vers la racine du dépôt (maintenance.html:109-111), alors que le bouton « Ouvrir » (go.href, l.97) garde utm + hash.
- Ajouté : Site public : site/sitemap.xml existe déjà. Une future page boutique ne doit pas y être ajoutée tant que le site est en noindex.
- Ajouté : Le profil public (profil_public) expose déjà, à anon, l'historique des 12 dernières ventes et achats (produit, quantité, ville, date) et les volumes : une boutique publique reprendrait ces données. Il faut choisir ce qui reste visible sans compte.
- Ajouté : Projet de test yowdymdnoiubatxlwhfv : toujours pas comparé (index pseudo, nego_agir, stock_apres_accord).
