> Annexe du rapport `../2026-10-25-controle-general.md` : résultats bruts d'une équipe, gardés tels quels (chemins mis à jour). Les captures et les gros fichiers JSON n'ont pas été mis dans le dépôt : on les refait en relançant la batterie.

# Contrôle U10 · U12 · U01 · U13 — résultats (25/10/2026)

Version contrôlée : `origin/main` au commit **1657f0e** (copie exportée par `git archive`, le dépôt n'a pas été touché).
Rien n'a été corrigé. Aucune écriture en production. Projet de TEST : seulement des blocs `do $$ … raise exception 'TEST: …' $$` (rien ne reste).

Fichiers :
- script réutilisable : `CONTROLE_QUALITE/tests/navigateur/U10-fiabilite.js` (+ `CONTROLE_QUALITE/tests/navigateur/_faux-serveur.js` : session et données factices) — usage : `node controle-navigateur.js <dossier-du-depot> [sortie] [port]`
- résultats bruts : résumé dans `2026-10-25-navigateur-U10.md` (les 66 captures et les JSON ne sont pas dans le dépôt : relancer `bash tools/controle/lancer.sh unite U10`)
- parcours U12 : `CONTROLE_QUALITE/tests/navigateur/U12-parcours.js`, captures et textes dans le dossier de sortie de la batterie (hors dépôt)

Limite : le vrai serveur Supabase n'est pas joignable depuis le navigateur. Tout ce qui est « écran » est vérifié avec des données factices ; un écran qui s'affiche n'est pas une preuve que la fonction marche avec le vrai serveur.

## Bilan

| Unité | réussi | échoué | bloqué | en attente : prérequis |
|---|---|---|---|---|
| U10 Fiabilité technique (FIA, navigateur) | 52 | 18 | 0 | 3 |
| U12 Compréhension (CMP) | 3 | 7 | 1 | 0 |
| U01 Logique métier (LOG) | 10 | 5 | 0 | 1 |
| U13 Cohérence documentaire (DOC) | 1 | 10 | 0 | 1 |
| **Total** | **66** | **40** | **1** | **5** |

Remarque : 14 des 18 échecs FIA sont une seule anomalie (le texte « [object Object] » lu par le lecteur d'écran sur chaque écran, voir FIA-04).

---

## U10 — Fiabilité technique (navigateur, lancé réellement)

Profils : iPhone 13 clair, iPhone 13 sombre, écran 320 px clair, écran 320 px sombre. 14 écrans : accueil, carte, annonces, publier une offre, publier une demande, prix, liste des négociations, une négociation, mes commandes, une commande, messages, Mon compte, réglages, aide.

| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Preuve | Date |
|---|---|---|---|---|---|---|---|---|
| FIA-01…56 (×14 écrans) | U10 | normal | Erreurs JavaScript (exceptions + console) sur les 14 écrans × 4 profils | aucune | aucune erreur sur les 56 ouvertures | réussi (14) | `resultats/ecrans.json` | 25/10 |
| idem | U10 | normal | Écran vide | du contenu | contenu présent partout (la carte : carte + 12 commandes) | réussi (14) | captures `*-<écran>.png` | 25/10 |
| idem | U10 | limite | Débordement horizontal à 390 px et 320 px | rien ne dépasse | aucun débordement mesuré | réussi (14) | `MESURE.elementsQuiDebordent` | 25/10 |
| FIA-04, 08, 12 … 56 | U10 | erreur | Texte technique (« [object Object] », « undefined », « NaN », « Invalid Date ») | jamais, ni à l'écran ni pour le lecteur d'écran | « [object Object] » présent dans un bloc invisible (opacité 0) mais **lu par le lecteur d'écran** sur les 14 écrans | échoué (14) | `application.dc.html` l. 803 `{{ toast }}` reçoit un objet `{t,x,ico,go}` (l. 2052) ; `ariaSnapshot` | 25/10 |
| FIA-57 | U10 | normal | Chargement de l'accueil, cache vide, réseau local | DCL < 2 s, load < 4 s | DCL 182 ms, load 184 ms, accueil lisible à 0,7 s | réussi | performance navigation | 25/10 |
| FIA-58 | U10 | limite | Poids de la première ouverture (sans polices Google ni tuiles) | < 3 Mo | **4,4 Mo** en 175 fichiers (scripts 1,8 Mo, « other » 1,5 Mo, données 356 Ko, page 348 Ko, CSS 304 Ko) | échoué | CDP `Network.loadingFinished` | 25/10 |
| FIA-59 | U10 | panne | « Slow 3G » (400 ms, 400 kbit/s) + serveur lent 2 s | écran d'attente puis accueil < 30 s | écran d'attente « On remplit les étals… » à 3, 8, 15 s (pas d'écran blanc) ; DCL 22,4 s ; **accueil lisible à 56,7 s** | échoué | `captures/3g-*.png` | 25/10 |
| FIA-60 | U10 | panne | Coupure du réseau sur l'accueil | message clair « hors connexion » | **aucun message global** ; l'app reste utilisable, les messages n'apparaissent qu'au moment d'une action | échoué | `captures/coupure-accueil.png` ; aucun écouteur `offline` dans `application.dc.html` | 25/10 |
| FIA-61 | U10 | panne | Négociation : envoyer un message sans réseau | message clair, texte gardé | « Pas de connexion… », texte gardé dans le champ, 0 requête, rien affiché comme envoyé | réussi | `captures/coupure-negociation.png` ; `v3/negoce.js` l. 419/571 | 25/10 |
| FIA-62 | U10 | panne | Publier une offre : saisie gardée après fermeture/rechargement | quantité retrouvée | quantité 37 et produit « igname » retrouvés | réussi | `mdg-app:brouillon-offre` (`setVf`) | 25/10 |
| FIA-63 | U10 | panne | Serveur en panne (503) à l'ouverture de « Mes commandes » | message clair | « Commandes indisponibles pour l'instant » (mais la liste affiche aussi « Aucune commande en cours » en dessous) | réussi | `captures/panne-commandes.png` | 25/10 |
| FIA-64 | U10 | panne | Serveur en panne au rechargement de l'accueil | accueil avec annonces gardées | accueil affiché | réussi | `v3/nuage.js` `refresh` | 25/10 |
| FIA-65 | U10 | concurrent | Négociation : 3 clics rapides sur « Envoyer », serveur lent 1,5 s | 1 envoi | 1 seul `nego_agir` | réussi | requêtes interceptées | 25/10 |
| FIA-66 | U10 | concurrent | Commande à confirmer : double clic « Confirmer la commande », serveur lent | 1 envoi | 1 seul `commande_repondre` | réussi | `captures/double-commande.png` | 25/10 |
| FIA-67 | U10 | normal | Premier lancement, négociation ouverte directement (comme depuis une notification) | tutoriel adapté à l'écran | tutoriel de la **liste** (« Chaque ligne est une négociation… ») affiché par-dessus une négociation ouverte | échoué | `captures/tutoriel-sur-negociation.png` | 25/10 |
| FIA-68 | U10 | normal | Service worker : installation | actif, réserve remplie | actif, `mgci-v290` (102 fichiers) + `fichiers-mgci` (120) | réussi | `sw.js` | 25/10 |
| FIA-69 | U10 | panne | Ouvrir l'app sans réseau après une première visite | accueil depuis le cache | accueil affiché hors connexion | réussi | `captures/sw-hors-connexion.png` | 25/10 |
| FIA-70 | U10 | régression | Mise à jour `CACHE` v290 → v291 (sur une copie) | la nouvelle réserve remplace l'ancienne | `mgci-v291` seule après mise à jour ; v290 supprimée | réussi | test sur copie temporaire | 25/10 |
| FIA-71 | U10 | normal | Notifications poussées réelles (réception, bon écran) | ouvre l'écran précis | — | en attente : prérequis (vrai téléphone + serveur joignable + clés VAPID) | — | 25/10 |
| FIA-72 | U10 | normal | Parcours complet contre le vrai serveur | mêmes écrans, vraies réponses | — | en attente : prérequis (autoriser `catmsypctymgkjkfzdkt.supabase.co`) | — | 25/10 |
| FIA-73 | U10 | panne | Vrai réseau 2G/3G ivoirien, téléphone d'entrée de gamme | temps et mémoire acceptables | émulation seulement | en attente : prérequis (vrai téléphone Android d'entrée de gamme) | — | 25/10 |

Observation (non comptée) : 9 à 11 cibles tactiles de moins de 32 px visibles à 320 px sur chaque écran (pastilles de familles de produits, petites croix). À juger par l'équipe accessibilité.

## U12 — Compréhension (parcours avec les écrans capturés)

| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Preuve | Date |
|---|---|---|---|---|---|---|---|---|
| CMP-01 | U12 | normal | Publier une offre : « Suivant » sans quantité à l'étape 1 | l'utilisateur voit le champ à remplir | bulle « Indiquez la quantité » en haut, mais le champ Quantité reste **sous la photo, hors de l'écran** : pas de défilement vers lui | échoué | `navigateur/explore/f4.png` | 25/10 |
| CMP-02 | U12 | normal | Publier une offre : bandeau « demandes qui attendent » | français correct | « 1 demande **de igname** attend déjà un vendeur » (au lieu de « d'igname ») | échoué | `explore/f4.png` | 25/10 |
| CMP-03 | U12 | normal | Négocier : écran d'une négociation ouverte | sait quoi faire | proposition lisible (« 1 000 kg × 230 F = 230 000 F · expire dans 40 h »), bouton principal « Accepter 230 F / kg », puis Contre-proposer / Refuser | réussi | `captures/iphone13-clair-negociation.png` | 25/10 |
| CMP-04 | U12 | normal | Négocier : « Refuser » et « Arrêter la négociation » côte à côte | différence claire | deux sorties sans explication courte de la différence (refuser cette proposition / arrêter toute la négociation) | échoué (P3) | même capture | 25/10 |
| CMP-05 | U12 | normal | Accord conclu : quoi faire ensuite | une suite claire | « Prix et quantité sont figés. Rien n'est encore payé ni livré » + « Suivre la commande » ; mais **« Écrire au vendeur » et « Écrire en privé » sur le même écran** (doublon, contraire à la règle « pas de doublons ») | échoué (P3) | `navigateur/parcours/accord.png` | 25/10 |
| CMP-06 | U12 | normal | Commander (vendeur, commande à confirmer) | sait quoi faire | « Mariam vous propose cette commande. Vérifiez le transport et le lieu de livraison, puis confirmez » + « Confirmer la commande / Refuser » ; commission « prévue · rien n'est prélevé » | réussi | `explore/cmd2.png` | 25/10 |
| CMP-07 | U12 | normal | Commander : bloc « lien de suivi » | au bon moment | grand bloc « Donnez un lien de suivi à votre chauffeur · Recommandé » affiché **avant même la confirmation** de la commande : long, sur-explication (4 paragraphes + 3 étapes) | échoué (P3) | `explore/cmd2.png` | 25/10 |
| CMP-08 | U12 | normal | Charger (vendeur, commande confirmée) | sait quoi faire | consigne courte (mot secret, « En préparation », « Photographier le colis ») ; règle des 2 à 4 photos et du poids rappelée | réussi | `parcours/charger.png` | 25/10 |
| CMP-09 | U12 | normal | Recevoir (acheteur, marchandise arrivée) | le bouton annoncé existe | le texte dit « Un problème : **refusez avec des photos** » mais les boutons sont « Réception confirmée » et « Signaler un problème » (pas de « Refuser la marchandise » à cette étape avec les données factices : le bouton dépend de `commande_sequestre.peut_refuser`, non simulé) | bloqué (à refaire avec le vrai serveur) | `parcours/recevoir.png` ; `v3/commandes.js` l. 536 | 25/10 |
| CMP-10 | U12 | normal | Litige (acheteur) : ce qui se passe ensuite | délai et action possibles | « Litige ouvert · L'équipe examine… » + « Service litiges WhatsApp : bientôt » ; **aucun délai affiché** (72 h côté serveur), aucun bouton pour ajouter une preuve visible avec les données factices | échoué | `parcours/litige.png` | 25/10 |
| CMP-11 | U12 | normal | Suivi (acheteur) | français correct | « Nous avons conseillé **à le vendeur** » | échoué (P3) | `v3/commandes.js` l. 1169 | 25/10 |

« Invalid Date » vu pendant l'exploration venait de champs factices mal nommés (corrigé dans `CONTROLE_QUALITE/tests/navigateur/_faux-serveur.js`) : ce n'est pas une anomalie de l'application.

## U01 — Logique métier (règle écrite → code réel, dernière définition)

Index de la dernière définition de chaque fonction : un index des dernières définitions (non gardé dans le dépôt) ; extraction : `python3 tools/controle/fn.py <fonction>`.

| ID | Unité | Type | Scénario | Attendu (règle) | Obtenu (code) | Statut | Preuve | Date |
|---|---|---|---|---|---|---|---|---|
| LOG-01 | U01 | normal | Clôture automatique 1 h après la réception | 1 h | `termine_le < now() - interval '1 hour'`, tâche toutes les 5 min ; définition identique sur le projet de test | réussi | `schema-89a` `sequestre_liberer_echus` + requête `pg_get_functiondef` (test) | 25/10 |
| LOG-02 | U01 | normal | Preuves au départ : 2 à 4 photos, poids, photo du papier si mot secret | pas de chargement sans elles | déclencheur sur l'événement « chargement » (aussi par le code du chauffeur) | réussi | `schema-90b` `_cmd_chargement_preuves` ; `schema-28` `commande_valider_code` | 25/10 |
| LOG-03 | U01 | normal | Commission 3,5 % sur la marchandise seulement, jamais « encaissée » | 3,5 % du montant moins la part refusée | `round(m * 0.035)` ; statut « calculée » sans séquestre (95b, test seulement) | réussi | `schema-95b` `_commission_sync` | 25/10 |
| LOG-04 | U01 | normal | 6,9 % seulement service transport MGCI + transporteur vérifié | — | conforme (82, 95) ; service fermé ; ouverture refusée sous 3 transporteurs vérifiés | réussi | `schema-95` `admin_transport_reseau` | 25/10 |
| LOG-05 | U01 | normal | Ville seulement / Abidjan une ville | refus serveur hors ville | `commande_creer2` refuse ; `_ville_ref` | réussi | `schema-93b`, `87c` | 25/10 |
| LOG-06 | U01 | normal | Quantité obligatoire pour publier une offre | refus | refus réel sur le projet de test : « QUANTITE_REQUISE » | réussi | bloc `do $$` sur yowdymdnoiubatxlwhfv | 25/10 |
| LOG-07 | U01 | normal | Notifications commerciales : 8/jour, 4 contenus, 90/180 min, 21 h–7 h, anti-doublon | — | conforme (`notif_preparer`, `_notif_calme`, `_notif_ecart_ok`, schéma 91) | réussi | `schema-96b`, `91`, `88a` | 25/10 |
| LOG-08 | U01 | normal | On ne négocie pas sa propre annonce | refus | « C'est votre propre annonce » | réussi | `schema-93b` `nego_ouvrir` | 25/10 |
| LOG-09 | U01 | normal | Suspension 7 puis 30 jours, décidée par l'admin, annonces cachées | — | conforme | réussi | `schema-84b` `admin_suspendre` | 25/10 |
| LOG-10 | U01 | erreur | **Suppression du compte avec une commande en cours** | bloquée, ou commandes protégées (décision 44 : « garder la trace des commandes ») | **suppression acceptée** avec 4 commandes ouvertes ; la commande reste « en_cours » avec un vendeur qui ne peut plus se connecter | échoué | test réel (annulé) sur le projet de test ; `schema-4` `supprimer_compte` | 25/10 |
| LOG-11 | U01 | normal | Badges Excellent et Grand atteignables | décisions 22 et 29 | ils exigent des commandes `validation = 'code'`, qui n'existent **que** en mode « reseau » (service fermé) : **personne ne peut les obtenir** aujourd'hui | échoué | `schema-94d` `_niv_calculer` ; `schema-87b` `commande_creer` (`val := case when p_mode = 'reseau'…`) | 25/10 |
| LOG-12 | U01 | concurrent | Membre suspendu avec des négociations ouvertes | décision 16 : il finit ses commandes en cours | l'autre partie peut encore **conclure** (pas de garde dans `nego_agir`), puis la commande est **refusée** (« Ce membre est suspendu ») : accord sans suite | échoué | `schema-93b` `nego_agir` ; `schema-84b` `_fiab_garde_commande` | 25/10 |
| LOG-13 | U01 | limite | Délais 72 h de chargement, 24 h de réception, 72 h de litige | — | comptés en heures pleines, nuits, week-ends et jours fériés compris (aucun calendrier) | échoué (scénario oublié) | `schema-92b` `commandes_delais`, `commande_annuler_retard` | 25/10 |
| LOG-14 | U01 | malveillant | Même personne vendeur et acheteur avec deux numéros | empêché | aucun contrôle (pas de vérification du numéro) ; seuls les badges ont des gardes (partenaires différents) | échoué | `schema-93b` `nego_ouvrir` (contrôle `user_id` seulement) | 25/10 |
| LOG-15 | U01 | limite | Annonce modifiée (prix) pendant une négociation | l'accord se fait sur la dernière proposition | l'accord vérifie stock, pause, statut, pas le prix ni la ville actuels de l'annonce ; la ville de la commande est celle de la négociation (choix voulu, 93b) | réussi (comportement voulu, à documenter) | `schema-93b` `nego_agir`, `commande_creer2` | 25/10 |
| LOG-16 | U01 | normal | Écart entre le code du dépôt et la production | — | les schémas 92 à 96 sont « test seulement » ; impossible de comparer la production (lecture interdite) | en attente : prérequis (lecture des définitions en production, accord du propriétaire) | `FONCTIONNALITES.md` l. 27 | 25/10 |

## U13 — Cohérence documentaire et commerciale

| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Preuve | Date |
|---|---|---|---|---|---|---|---|---|
| DOC-01 | U13 | normal | Transport « même ville » | décision 1 et CGU 7.2 : le vendeur organise son livreur, payé par l'acheteur | le formulaire « Publier une offre » dit : « Inclus hors de ma ville — Règle du marché : je livre dans les autres villes ; **dans ma ville, l'acheteur s'en charge** » | échoué | `application.dc.html` l. 830-831 (`TR_OFF`) ; `v3/commandes.js` l. 1139 (même ville → le vendeur organise) | 25/10 |
| DOC-02 | U13 | normal | Pitch : commission | rien n'est prélevé | « 3,5 % … **retenus sur la part du vendeur** quand la vente est définitive » + « registre que personne ne peut modifier » (affirmation non vérifiée : l'admin a des fonctions sur les commissions) | échoué | `strategie/sources/pitch.html` l. 66-70 | 25/10 |
| DOC-03 | U13 | normal | Guide « Transporter le vivrier » : mot secret | aide : on tape le mot aussi pour refuser | « l'acheteur le saisit **seulement si tout est conforme** » | échoué | `tools/site/guides/transporter-le-vivrier.html` l. 69 ; `v3/aide.js` l. 89 ; `commande_refuser2` | 25/10 |
| DOC-04 | U13 | normal | Aide « Je peux annuler une commande ? » | dire que l'acheteur peut annuler si rien n'est chargé après 72 h (92b) | « Une fois la commande confirmée, l'acheteur ne peut plus l'annuler » | échoué (dès que 92b est en production) | `v3/aide.js` l. 90 ; `schema-92b` `commande_annuler_retard` | 25/10 |
| DOC-05 | U13 | normal | CGU 5.x : délai de chargement | 72 h, rappel 12 h avant (92b) | « aujourd'hui, aucune échéance » | échoué (selon production) | `docs/juridique/conditions-utilisation.md` l. 120 | 25/10 |
| DOC-06 | U13 | normal | CGU : note « commande_litige dit encore 24 h » | à jour | la dernière définition (92b) dit « 1 h » : note périmée (sauf si la production a encore 61) ; **en cours de changement** (litige 1 h, 97b) | échoué | CGU l. 138 ; `schema-92b` `commande_litige` | 25/10 |
| DOC-07 | U13 | normal | FONCTIONNALITES : notifications marketing | 8 par jour et par personne | « 30 par jour au plus » (c'est la cadence de la tâche, pas le plafond par personne) | échoué (P3) | `FONCTIONNALITES.md` l. 373 | 25/10 |
| DOC-08 | U13 | normal | CLAUDE.md « Ville seulement » | décrire une **option** | écrit comme une règle pour tous (« un vendeur peut vendre … uniquement dans la ville de son annonce ») ; le code et les CGU en font un choix du vendeur | échoué (P3) | `CLAUDE.md` ; CGU 4.2 ; `vsRow` dans `v3/nuage.js` | 25/10 |
| DOC-09 | U13 | normal | Badges : règles écrites | décision 22 | le code (94d) exige en plus 3 partenaires différents, 3 commandes au plus par partenaire, 60 min entre création et réception ; ni CLAUDE.md ni l'aide ne le disent | échoué (P3) | `schema-94d` | 25/10 |
| DOC-10 | U13 | normal | Aide « Comment monter de niveau » | possible | promet Excellent/Grand « validées par code » sans dire que ce n'est pas possible aujourd'hui (LOG-11) | échoué | `v3/aide.js` l. 113 | 25/10 |
| DOC-11 | U13 | normal | Modèles de stratégie : paiement et séquestre | jamais « encaissé » | « Construit, pas branché », « rien n'est encaissé » : conforme | réussi | `strategie/sources/probleme-solution.html` l. 104, 130 | 25/10 |
| DOC-12 | U13 | normal | Production vs « en production » écrit dans les docs | vérifié | non vérifiable ici | en attente : prérequis (lecture seule des définitions en production) | — | 25/10 |

---

## Anomalies

### P0
Aucune trouvée dans ce périmètre.

### P1

**LOG-10 — Un membre peut supprimer son compte avec des commandes en cours.**
- Preuve : test sur le projet de TEST (annulé) : vendeur `9e4efebe…`, 4 commandes ouvertes → `supprimer_compte()` accepté, la commande `4bcea401…` reste « en_cours », profil `supprime_le` rempli, compte bloqué (`banned_until = infinity`). Définition identique dans `schema-4.sql` et sur le projet de test.
- Risque métier : l'acheteur attend une marchandise d'un vendeur qui ne peut plus se connecter (pas de chargement, pas de mot secret) ; moyen d'échapper à un litige ou à une suspension, puis de revenir avec un autre numéro (pas de SMS).
- Correctif recommandé : refuser la suppression tant qu'il reste une commande « a_confirmer / en_cours / litige » ou un accord conclu sans commande (message : « Terminez ou annulez d'abord vos commandes ») ; prévenir dans Mon compte avant de demander le code.
- Non-régression : bloc SQL « suppression avec commande en cours → refus » ; « sans commande → accepté ».

### P2

- **LOG-11 — Excellent et Grand impossibles à obtenir.** Preuve : `_niv_calculer` exige `validation = 'code'`, créée seulement en mode « reseau » (fermé). Risque : promesse de l'aide (DOC-10) intenable. Correctif : soit permettre la validation par code hors réseau (acheteur ↔ vendeur), soit retirer temporairement l'exigence et le dire. Non-régression : un membre qui remplit tout le reste atteint Excellent sur le projet de test.
- **LOG-12 — Suspension : accord conclu puis commande refusée.** Preuve : pas de garde de suspension dans `nego_agir` ; `_fiab_garde_commande` refuse ensuite. Risque : l'autre partie croit avoir un accord, puis bloqué ; stock immobilisé 72 h. Correctif : fermer les négociations ouvertes du membre suspendu (ou bloquer l'accord) avec un message clair. Non-régression : test « suspendu → accord refusé ».
- **DOC-01 — Texte « dans ma ville, l'acheteur s'en charge ».** Contredit la décision 1 et les CGU 7.2. Risque : le vendeur ne s'occupe pas du livreur, dispute à la livraison. Correctif : réécrire le choix (« je livre partout ; dans ma ville, mon livreur est payé par l'acheteur »). Non-régression : contrôle de texte (gardiens).
- **DOC-02 — Pitch « retenus sur la part du vendeur ».** Laisse croire qu'un prélèvement existe. Correctif : « calculés, pas encore prélevés » ; retirer « registre que personne ne peut modifier » ou le prouver. Non-régression : recherche de « retenu » dans `strategie/sources/`.
- **FIA-58 / FIA-59 — 4,4 Mo à la première ouverture, accueil lisible à 57 s en 3G lente.** Risque : abandon à la première ouverture sur réseau mobile ivoirien, forfait consommé. Correctif : charger les modules des écrans secondaires à la demande, alléger la page (348 Ko) et les données (356 Ko). Non-régression : FIA-58/59 dans le script (seuils 3 Mo / 30 s).
- **FIA-60 — Pas d'indication de coupure.** Correctif : petite pastille « Hors connexion » quand `navigator.onLine` passe à faux. Non-régression : FIA-60.
- **CMP-01 — « Indiquez la quantité » sans montrer le champ.** Correctif : faire défiler jusqu'au champ et le mettre en évidence. Non-régression : capture du formulaire après « Suivant » vide.
- **CMP-10 — Litige sans délai ni action visible.** Correctif : afficher l'échéance (« réponse de l'équipe avant le … ») et le bouton d'ajout de preuves ; à revérifier avec le vrai serveur. Non-régression : capture d'un litige.
- **LOG-13 — Délais en heures pleines, nuits et jours fériés compris** (72 h chargement → annulation par l'acheteur comptée contre le vendeur ; 24 h réception → litige automatique). Correctif : décision du propriétaire (jours fériés, heures ouvrées) ; au minimum le dire dans l'aide.
- **LOG-14 — Deux comptes pour une même personne** : rien ne l'empêche (attend le SMS, donc un budget). À garder dans les risques connus.

### P3

- **FIA-04 (×14)** — « [object Object] » lu par le lecteur d'écran sur tous les écrans : ancien bloc toast (`application.dc.html` l. 803) qui affiche un objet. Correctif : afficher `toast.t` ou retirer le bloc / `aria-hidden`. Non-régression : test « texte technique » du script.
- **FIA-67** — tutoriel de la liste des négociations montré sur une négociation ouverte.
- **CMP-02, CMP-11** — « de igname », « à le vendeur ».
- **CMP-04, CMP-05, CMP-07** — Refuser / Arrêter sans différence claire ; doublon « Écrire au vendeur » / « Écrire en privé » ; long bloc « lien de suivi » avant la confirmation.
- **DOC-03 à DOC-10** — textes d'aide, CGU, guide et FONCTIONNALITES en retard sur le code (voir tableau).
- **FIA-63** — en panne, « Commandes indisponibles » s'affiche avec « Aucune commande en cours » en dessous (message contradictoire).

## Scénarios auxquels personne n'a pensé (à trancher)

1. Membre supprimé avec commande en cours (LOG-10, prouvé).
2. Membre suspendu au milieu d'une négociation (LOG-12).
3. Délais la nuit, le week-end, les jours fériés (LOG-13). La clôture en 1 h, elle, part de la confirmation de réception par l'acheteur lui-même : pas de piège la nuit.
4. Vendeur = acheteur avec deux numéros (LOG-14).
5. Changement de ville du profil avec des annonces actives : les annonces gardent leur ville et la modification de ville d'une annonce est refusée (93a) : il faut retirer et republier ; non expliqué dans l'aide.
6. Prix de l'annonce changé pendant une négociation : l'accord se fait au prix de la dernière proposition (voulu) ; non expliqué.
7. Accord conclu juste avant une suspension : la commande ne peut plus être créée (contraire à l'esprit de la décision 16).
8. Badges Excellent/Grand inatteignables tant que le réseau de transport est fermé (LOG-11).
