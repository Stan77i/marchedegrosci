# Passation : où en est le Marché de Gros CI (21 octobre 2026)

> À lire en premier dans une nouvelle discussion. Ce document dit **comment travailler sur ce projet**, **ce qui est fait**, **ce qui attend une décision** et **la suite logique**.
> État du dépôt : `main` à jour après la PR #81. Aucune PR ouverte.

---

## 1. Règles de travail du propriétaire (à respecter sans qu'il le redise)

- **Langue** : il parle et lit en français, souvent par dictée vocale (fautes, majuscules). Lui répondre en français simple, court, sans jargon. Son vocabulaire : il dit souvent « le site » pour **l'application** ; demander si c'est ambigu.
- **Une PR après chaque mise à jour.** **Ne jamais fusionner** : il fusionne lui-même. Créer les PR avec `gh api repos/Stan77i/marchedegrosci/pulls` (GraphQL est bloqué). Corps de PR en français simple, terminé par les lignes d'attribution.
- **Supabase : faire soi-même** les changements de base, avec l'outil `mcp__Supabase__execute_sql`, projet `catmsypctymgkjkfzdkt`.
- **Priorité : l'application mobile** (`application.dc.html`). Le site (`index-v3.html`) est en pause ; ce qu'il lui manque est décrit dans `PORTAGE-SITE.md`.
- **« Si une chose peut déranger tout l'ordre au point de créer un désordre, tu me le dis. »** Signaler les risques avant d'agir.
- **Design** : charger le kit **XIAS** (`xias-design.zip`, reconditionné pendant cette session en un seul skill de 165 fichiers, à installer dans son espace Claude) et les skills de design disponibles. Mesurer au lieu de supposer (contraste, cibles tactiles, débordement).
- **Il aime** : l'innovation, ce qui fait « pro », pas de clichés, les couleurs du logo, le sac comme personnage, la voix du logo.

## 2. Pièges techniques (ils ont déjà coûté du temps)

| Piège | Règle |
|---|---|
| Supabase : `drop` | **Jamais de `drop`** : l'outil attend une confirmation et bloque. Utiliser `create or replace`, `alter … add column if not exists`, `alter policy`. Changement du type de retour d'une fonction : créer une nouvelle fonction. |
| Tester une fonction SQL | Bloc `do $$ … raise exception 'RES %', … $$` : tout est annulé à la fin. **Un `create or replace` placé dans le même appel qu'un `raise` est annulé aussi** : faire deux appels séparés. |
| Déclencheurs PL/pgSQL multi-tables | **Une branche `if tg_table_name = …` par table.** Une expression qui cite `new.user_id` plante sur les tables qui n'ont pas ce champ (bug du 20 octobre : plus aucun message ne partait). |
| Versions des fichiers | Chaque fichier versionné modifié (`x.js?v=…`) reçoit un **nouveau `?v=`** dans **chaque page** qui le charge (`application.dc.html`, `index-v3.html`, `admin.html`). Fichier non versionné ou ajouté au cache : monter `CACHE` dans `sw.js` (actuellement **`mgci-v94`**). |
| Cache hors connexion | `sw.js` → `CORE` est installé avec `addAll` : **un fichier manquant bloque toute l'installation**. Un nouveau module peut aller dans la liste « au mieux » (comme `v3/releve.js`, `app/garanties.js`). |
| Conflits de PR | Ils viennent presque toujours de la ligne des versions (liste `MDGPlus` dans `application.dc.html`) et de `CACHE`. Résoudre en gardant le `?v=` le plus récent de chaque fichier. |
| Tester l'app dans un navigateur | Ajouter **`?app=1`** à l'adresse, sinon un navigateur d'ordinateur est renvoyé vers le site. Chromium : `/opt/pw-browsers/chromium` ; Playwright global : `NODE_PATH=$(npm root -g)`. Servir avec `python3 -m http.server 8765` depuis la racine. |
| dc-runtime | Le gabarit (`{{ }}`, `<sc-if>`, `<sc-for>`) prend le contenu des éléments pour du gabarit : un composant qui écrit dans son propre élément doit utiliser un shadow DOM (voir `app/garanties.js`). |
| Authentification | Le numéro sert d'e-mail (`2250701020304@…`) ; le mot de passe est le code à 6 chiffres. |

## 3. Carte du code (application)

- `application.dc.html` : l'application (pages, accueil, roue des produits, carte, feuilles J'ai / Je cherche, publication).
- **Modules partagés app + site** :
  - `v3/nuage.js` : serveur, session, envoi des annonces, `texteRefus` (règle anti-liens côté app) ;
  - `v3/compte.js` : Mon compte ;
  - `v3/messages.js`, `v3/negoce.js`, `v3/identite.js` ;
  - `v3/reputation.js` : profil public ;
  - `v3/statuts.js` : statuts des comptes, badge Officiel ;
  - `v3/sons.js`, `app/marque.js` (logo), `app/toast.js` (notifications).
- **Propres à l'app** : `app/sac.js` (le sac personnage), `app/garanties.js` (arguments de confiance), `v3/releve.js` (ventes et relevés), `v3/guide.js`, `v3/alertes.js`, `app/carte-gl.js`, `css/mgci-tokens.css` (couleurs et voix du logo), `css/mgci-app.css`.
- `admin.html` + `v3/admin.js` : tableau de bord administrateur.
- `v3/commandes.js` : **Mes commandes** (schéma 26) : une commande par accord, 8 étapes enregistrées par le serveur, validation « sans code » pour l'instant, commission de 3,5 % calculée mais **non prélevée**. Ouverte depuis Mon compte, le bouton « Suivre la commande » d'un accord, ou une notification (`#/?commande=…`).
- `v3/chauffeur.js` : **Espace chauffeur** (schéma 27) : inscription gratuite, code transporteur `T-XXXX` à donner à l'acheteur ou au vendeur, disponibilité (profil vérifié seulement), missions à accepter, arrivée et transbordement. `v3/admin-transport.js` : vues **Transporteurs** et **Commandes** du tableau de bord (vérifier, inscrire un chauffeur sans application, affecter, trancher un litige), branchées sur `admin.js` par `window.MDGAdminExt`.
- **Codes à usage unique** (schéma 28) : prise en charge (vu par le vendeur), transfert (vu par le chauffeur qui transmet), réception (vu par l'acheteur) ; tapés par le chauffeur. 6 chiffres, gardés chiffrés (bcrypt), expiration 6 h (transfert 2 h), 5 essais puis blocage. `commande_valider_code` ne lève pas d'erreur pour un code faux (sinon le compteur d'essais serait annulé) : il renvoie `{ ok:false, message, reste }`.
- **GPS** (schéma 29) : `v3/suivi.js` (carte MapLibre + fond OpenFreeMap, itinéraire, camion à la dernière position, « non actualisée » après 5 min) ; partage de position dans l'Espace chauffeur (application ouverte seulement, Wake Lock, 30 s ou 150 m, jamais moins de 15 s). Fonction Edge `itineraire` : géocodage + trajet camion openrouteservice, calculé une fois par commande, clé dans le secret `ORS_API_KEY`. **Pas de suivi en arrière-plan** : impossible pour une application web ; il faudrait une application native.
- **Finitions** (21 octobre) : contrastes mesurés (étapes à venir `#675F50`, étiquette admin « vérifié » `#8BDCA6`), focus sur le titre de chaque écran et retour du focus à la fermeture, message clair hors connexion (« rien n’a été enregistré »), arrivée du chauffeur sur la carte (cercle sur la livraison, sac qui saute, vibration). Test de non-régression en base de tous les parcours (sans code, avec codes, annulation, position, relevés) : vert.
- `supabase/schema-*.sql` : chaque changement de base, commenté. Tout jusqu'au **schéma 29** est **déjà appliqué**, purge des positions comprise (collée par le propriétaire le 21 octobre, tâche `mdg-purger-positions` chaque nuit à 3 h 23). Piège : l'outil Supabase demande une confirmation pour tout `delete` et abandonne au bout de 60 s ; ce genre de bloc se colle dans l'éditeur SQL.
- Documents :
  - `PORTAGE-SITE.md` : porter l'app vers le site ;
  - `docs/SEQUESTRE.md` : futur paiement ;
  - `docs/PHILOSOPHIE.md` : jamais de donnée inventée ;
  - `MISE-A-JOUR.md`.

## 4. Ce qui est fait (PR #44 à #81, toutes fusionnées)

**Identité et confiance**
- Vérification d'identité gratuite :
  - pièces acceptées : CNI, passeport, carte consulaire, permis ;
  - lecture de la bande MRZ, pièces expirées refusées ;
  - permis sans date de fin accepté, badge valable 5 ans ;
  - dossiers conservés 5 ans.
- Côté admin : notification à chaque dossier, résumé du matin, compteur dans le menu, mode rapide.
- Statuts gagnés : vérifié, vendeur de confiance, acheteur sérieux, répond vite, actif, nouveau.
- Signalement avec preuves.
- 3 annonces gratuites, puis vérification obligatoire. Bannissement à vie, décidé par l'admin.
- **Compte admin = « Marché de Gros » officiel** : badge Officiel, ni nom, ni numéro, ni étoiles, ni vérification demandée. Le serveur impose « Marché de Gros » sur ses annonces.
- **Structures** (schéma 23) :
  - à l'inscription : à mon compte, coopérative, groupement ou entreprise ;
  - nom, logo et jusqu'à 4 preuves ;
  - carte en tête du profil public, puce sur les annonces et les messages.

**Protection contre le contournement** (schéma 22, `texte_refus` + déclencheur `garde_textes`)
- Refusés dans tous les textes des membres (messages, propositions, avis, profils, annonces, nom de structure) :
  - liens, e-mails ;
  - réseaux sociaux, même abrégés (fb, insta, tiktok, wtsp, « sur wa », @pseudo) ;
  - numéros de téléphone ;
  - codes de transfert (`*144*…#`), demandes de code secret.
- **L'admin est libre.** Ses liens sont cliquables dans ses messages, en prévision des liens de paiement.
- Personne n'est banni automatiquement : le message est seulement refusé, avec une phrase claire.

**Ventes et transparence** (schéma 24)
- « Mes ventes et achats » dans Mon compte : historique par période, totaux, volumes, bons de transaction en PDF, relevé en PDF ou CSV.
- Profil public : **volumes seulement, jamais de montants**.
- `docs/SEQUESTRE.md` : l'argent passera par le Marché de Gros, qui fera le pont entre acheteur et vendeur. **Rien n'est construit.**

**Design**
- Logo unique ; couleurs : vert `#10392B`, maïs `#F2C230`, crème `#F3EFE4`.
- **Voix du logo** : titres en **Archivo 600**, le **mot qui compte en Archivo 900 italique** (maïs sur fond sombre, vert surligné de maïs sur fond clair). Classes `.voix` / `.voix-plein` / `.chiffre`. Texte courant en Jost.
- **Le sac**, personnage (`MDGSac.svg(humeur)`) : plein (réussi), vide (rien encore), triste (échec), se remplit (attente : carte, messages…), endormi (hors connexion). Écran d'ouverture « le sac qui se remplit ».
- **Notifications « îlot »** (`app/toast.js`) :
  - une seule pastille vivante qui se transforme et regroupe ;
  - elle suit une action du début à la fin (`MDGToast.suivre`) ;
  - bon bouton (Répondre, Voir) ; photo du produit ou avatar ;
  - phrases longues découpées en titre + explication ;
  - accent possible avec `*mot*` ;
  - accueil « Bon retour, *Prénom* » après la connexion.
- **Arguments de confiance** : bande sous la barre du haut (« Parcours *sécurisé* »…), feuille « Pourquoi le Marché de Gros », rappels avant de contacter un membre non vérifié.
- **Audit d'accessibilité** (kit XIAS) : alertes 96 → 30, cibles trop petites 31 → 1. 74 images de produits, famille Viandes et abats.

**Commission 3,5 % — registre** (schéma 30)
- Tables fermées `commissions` (une ligne par commande, `commande_id` unique) et `commission_journal` (ne se modifie pas).
- Calcul par le déclencheur `commission_sync` sur `commandes` : base = montant final, 3,5 %, arrondi au franc.
- Statuts : prevue → due (terminée) · suspendue (litige) · annulee. `encaissement` = 'aucun' seulement : **rien n'est encaissé**.
- Compte officiel exclu. Lecture : `mes_commissions()` (vendeur), `admin_commissions()` (vue admin « Commissions »).
- Commission transport 6,9 % : pas encore traitée.

**Prix par zone** (schéma 31, `v3/prixzone.js`)
- Fonction de lecture `prix_zones(produit)` (lisible sans connexion) : par district et par unité, prix demandés (90 j, hors annonces masquées), quantité en vente, budgets acheteurs, ventes terminées (prix montré seulement à partir de 3 ventes de 2 vendeurs), tendance 30 j contre 30 j (3 prix de 2 vendeurs par période, ±5 %), médiane par mois.
- Bouton « Par zone et tendance » sur chaque produit de « Prix du marché ». Sans données : on le dit.

**Réputation sur les commandes** (schéma 32)
- Table fermée `avis_commandes` : un avis par personne et par commande **terminée**, dans les 30 jours, corrigeable 24 h puis figé ; rangé selon le rôle de la personne notée (vendeur / acheteur).
- `noter()` (avis après simple négociation) refuse désormais ; la table `avis` (vide au 21/10/2026) reste lue pour l'historique.
- `reputation_publique(uid)` : par rôle, note, commandes honorées, annulations demandées, litiges ouverts par l'autre partie, délai médian confirmation → réception, badge « Fiable » (critères publics). « Vérifié » ≠ « fiable ».
- Fidélité : « 2e commande terminée ensemble » dans la commande et le profil.
- Pas de « retard » compté : aucune date de livraison promise n'existe encore dans une commande.

**Racheter et rappels** (schéma 33, `v3/racheter.js`)
- `recommande_preparer(commande)` : même annonce, autres annonces du même vendeur, 5 autres vendeurs ; prix du jour, stock, écart avec le dernier prix. `mes_achats_habituels()`.
- L'acheteur coche plusieurs produits, ajuste, **confirme une fois** : une proposition par produit (`nego_ouvrir`, qui revérifie tout). Le vendeur doit accepter. Rien n'est acheté tout seul.
- Rappels quotidiens / hebdomadaires (table `rappels_achat`, 10 max, heure d'Abidjan = UTC), tâche pg_cron `mdg-rappels-achat` (*/15), notification « Racheter … ? » (pousser, cas 10) qui ouvre l'écran de préparation.
- Entrées : « Racheter » dans Mon compte, bouton dans une commande terminée (acheteur).

**Approvisionnement pro** (schéma 34, `v3/appro.js`)
- Table fermée `besoins` (établissement, type, fréquence, période, zone, exigences, statut ouvert/pourvu/clos) ; chaque produit devient une vraie `demande` (`demandes.besoin_id`, colonne ajoutée) → alertes, carte, négociation existantes.
- Vendeur : `besoin_repondre` (prix, quantité, stock ≥ quantité, délai) → `nego_ouvrir` + `proposition_details`.
- Acheteur : `besoin_comparer` (tri par prix, « le moins cher », « le plus rapide », réputation vendeur, écart au prix cible) ; il choisit en ouvrant la négociation. Pourvu/clos retire les produits en ligne.
- Une demande ou une proposition n'est pas une vente : aucune commission (vérifié).
- Entrée : « Approvisionnement pro » dans Mon compte ; lien `#/?besoin=…`.

**Achats groupés** (schéma 35, `v3/groupes.js`)
- Tables fermées `groupes_achat`, `groupe_participants` (unique par personne) ; colonne `commandes.groupe_id`.
- Sur une offre active : le vendeur ouvre (prix, paliers décroissants, frais de transport estimés) ; un acheteur peut proposer (statut `propose`, le vendeur valide).
- Statuts : propose → ouvert → seuil_atteint → en_attente_confirmation (prix final figé, 48 h) → confirme → termine ; annule / expire.
- Chacun confirme lui-même ; si le prix monte (départs), les confirmés repassent « à confirmer » + notification. Inscriptions verrouillées (pas de dépassement du stock).
- Tous confirmés → une commande par participant (validation par déclaration, transport par le vendeur), stock baissé, commission inscrite seule. `_cmd_rendre_stock` rend aussi le stock d'une commande de groupe annulée.
- pg_cron `mdg-groupes-echeances` (*/15) : expiration, lancement auto si seuil atteint à la date limite, retrait des non-confirmés à 48 h, passage à « terminé ».
- Expiré : achat individuel possible, seulement sur demande (proposition normale).
- `pousser` v9 : cas 10 (rappels) et 11 (groupes) déployés et vérifiés (401 sans clé, 200 avec).
- Bouton « Acheter à plusieurs » sur les cartes d'offres ; « Achats groupés » dans Mon compte ; lien `#/?groupe=…`.
- Piège : l'identifiant de style `grCss` est déjà pris par `app/garanties.js` (d'où `grpCss`).

**Racheter sur la même annonce** (schéma 36, accord du propriétaire le 21/10/2026)
- La contrainte `negociations_cible_cible_id_auteur_id_key` (une négociation par acheteur et par annonce, pour toujours) est remplacée par l'index unique partiel `negociations_une_ouverte` : **une seule négociation ouverte à la fois**. Après un accord, on peut racheter ; l'historique reste entier.
- `nego_ouvrir` (avec `#variable_conflict use_column` : ses paramètres portent le nom des colonnes), `recommande_preparer`, `besoin_public` adaptés ; `negoce.js` ne rouvre que la négociation ouverte.
- Le bouton « Noter » de la conversation est retiré (l'avis se donne depuis la commande terminée).
- Retour arrière possible tant qu'aucun acheteur n'a deux négociations sur la même annonce (commande dans `supabase/schema-36-rachat-meme-annonce.sql`).

## 5. En attente d'une décision du propriétaire


1. **Zoom** : autoriser le zoom à deux doigts partout sauf sur la carte ? (seule alerte d'accessibilité critique restante, WCAG 1.4.4)
2. **« Je cherche » coupé sur les très petits écrans (280 px)** : raccourcir en « Cherche » sur ces écrans seulement ?
3. **Photo de kplala** (feuilles de corète) : le fichier reçu était celui du corossol, il a été retiré. Attendre une vraie photo.
4. **Cibles de 36 à 43 px** (filtres, unités) : les passer à 44 px, quitte à rendre les écrans moins denses ?

## 6. À vérifier par lui sur un vrai téléphone

- L'accueil : J'ai / Je cherche entièrement visibles (#81).
- L'envoi réel d'un logo et de preuves de structure (testé seulement avec un serveur simulé).
- L'écran « annonce publiée » après une vraie publication (rappel de confiance, sac qui saute).

## 7. Suite logique proposée

1. **Les petites décisions du point 5**, rapides à appliquer.
2. **Paiement en séquestre**, le gros chantier : trancher les questions de `docs/SEQUESTRE.md` (opérateur mobile money, agrément BCEAO, délai de libération, frais), puis construire les états (déposé → livré → libéré / litige), l'écran admin des litiges et les vrais reçus.
3. **Vérification des structures par l'équipe** : un badge « Structure vérifiée » décidé par l'admin à partir des preuves (aujourd'hui, elles sont affichées « non vérifiées »).
4. **Le sac dans d'autres moments** : tirer pour actualiser, attentes restantes.
5. **Le site** : appliquer `PORTAGE-SITE.md` dans l'ordre de ses priorités (formulaires, cartes, images, sac, voix du logo, couleurs, lien admin).

## 8. Pour démarrer une nouvelle discussion

Lui proposer de coller ceci :
> « Lis `docs/PASSATION.md` du dépôt Stan77i/marchedegrosci, puis `PORTAGE-SITE.md` si on touche au site. On travaille sur l'application. Charge le skill xias-design pour tout ce qui est design. »
