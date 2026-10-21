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

**Minimum de vente du vendeur** (schéma 37, demandé le 21/10/2026)
- Colonne `offres.qte_min` (vide = pas de minimum). Champ « Vendu à partir de » à l'étape 1 de Vendre ; puce maïs « À partir de 50 kg » sur la carte d'offre.
- `nego_agir` refuse une proposition d'acheteur sous le minimum. Si le stock restant est plus petit, le minimum devient le stock restant (le dernier lot se vend). Le vendeur peut proposer moins dans une contre-proposition.
- `nuage.js` n'envoie `qte_min` que pour les annonces qui le connaissent : les anciennes annonces ne sont pas renvoyées.
- Achats groupés inchangés (le vendeur fixe ou valide l'objectif).

**Exigences à cocher dans un besoin pro** (schéma 38, demandé le 21/10/2026)
- Colonne `besoins.criteres` (liste fermée de 12 codes, contrôlée par le serveur). `besoin_creer2` = `besoin_creer` + critères en un seul appel ; l'ancienne fonction reste pour les anciennes versions de l'app. `besoin_public` renvoie `criteres`.
- `appro.js` : critères en pastilles à cocher (coche verte), texte libre « Autres exigences » conservé ; affichés avec coche verte chez l'acheteur et chez le vendeur qui répond.
- Pour ajouter un critère : l'ajouter dans la contrainte `besoins_criteres_check`, dans `besoin_creer2` et dans `CRIT` (appro.js).

**Badges Coopérative / Marché vérifiés** (schéma 39, demandé le 21/10/2026)
- Nouveau type de structure « Marché » (code `marche`, choisi par le propriétaire à la place de « Marché de gros »). La règle `profils_structure_type_check` a été remplacée par `profils_structure_type_check2` (drop autorisé par le propriétaire, aucune donnée touchée).
- Table fermée `structure_verifs`. Le membre (coopérative ou marché, identité déjà vérifiée) envoie la fonction du responsable et 1 à 3 photos d'un document officiel dans le stockage privé `preuves`. Le nom du responsable est repris de l'identité vérifiée.
- Admin : vue « Structures » (`admin-transport.js`). Les documents s'ouvrent par lien signé de 5 min. Le bouton Valider est grisé si l'identité n'est plus valide ou si le profil a changé, et le refus exige un motif.
- Badge (`_structure_verifiee`) : dossier validé, même type et même nom qu'aujourd'hui, identité toujours valide. S'il change de nom, le badge tombe tout seul.
- Affichage :
  - puce verte avec coche (`profils_publics3` → `compte.js` puceStructure) ;
  - « vérifiée par l'équipe » sur le profil public (`structure_publique.verifiee/fonction`) ;
  - suivi du dossier dans Profil → Votre structure.
- Pas de notification push à la décision (le membre voit la réponse dans son profil). À ajouter plus tard si utile (cas `pousser`).

**Exigences détaillées d'un besoin pro** (schéma 40, demandé le 21/10/2026 : « plus profond », tonnes ou litres)
- Colonne `besoins.detail` (jsonb), nettoyée par `_besoin_detail` : clé inconnue ou valeur hors liste → refus. `besoin_creer3` = `besoin_creer2` + détail ; `besoin_public` renvoie `detail`.
- Contenu (tout facultatif) :
  - volume : capacité minimale du vendeur (kg, tonnes, litres ou sacs, par semaine ou par mois), écart de quantité ± % ;
  - qualité : choix, calibre, maturité, humidité maximale, récolte en jours, région d'origine ;
  - conditionnement : sacs de 25, 50 ou 100 kg, bidons de 5 ou 20 L, fût de 200 L… ;
  - livraison : jours et heure ;
  - délai de paiement souhaité (information seulement, aucun paiement dans l'app) ;
  - 8 garanties à cocher (sans moisissure, contenant scellé, reprise du non-conforme…).
- `appro.js` : 5 groupes repliables + 8 cases rapides (les 4 cases du schéma 38 qui font doublon ne sont plus proposées, mais restent affichées sur les anciens besoins). Affichage en phrases avec coche verte.
- « litre » ajouté aux unités de l'app (Vendre, Je cherche, J'ai) : `A.UNITS` dans `app/marche-app.js`.
- Pour ajouter une valeur : la mettre dans `_besoin_detail` (serveur) et dans `DET`/`PLUS` (appro.js).

**Une seule police : Jost** (demande du propriétaire, 21/10/2026 : « pas trois polices, ni deux »)
- Archivo (titres, logo) et Cormorant Garamond (titres du site, initiales d'avatar) sont remplacés partout par Jost. Les fichiers de ces polices sont retirés.
- `css/fonts.css` : Jost de 400 à 900, en droit et en italique (12 fichiers, 132 Ko, licence `fonts/OFL-Jost.txt`). Les mots mis en avant (« de Gros », « Lévis », « caché ») restent en gras italique, mais en Jost.
- Logo : tracés régénérés en Jost (`tools/logo/build.py` + `marque.py`, dimensions calculées sur la largeur des mots) ; icônes SVG et PNG refaites (`tools/logo/png.js`).
- Carte : noms des villes et des rues en Jost (`vendor/glyphs/Jost Regular|Medium|Italic`, générés par `tools/glyphes-carte.js` avec TinySDF). Les glyphes Noto Sans sont retirés.
- Seule exception : les emojis des marqueurs de carte (police emoji du téléphone).

**Connexion et notifications** (demande du propriétaire, 21/10/2026)
- Le bouton « Se connecter » ne devient plus bleu et n'affiche plus « Connexion réussie. Préparation de votre espace… » : il reste en attente, et la notification de bienvenue suffit (`nuage.js`).
- Les notifications (`app/toast.js`) ne sont plus vertes : fond sombre translucide `rgba(23,21,18,.62)` avec flou du fond, lisible sur fond sombre comme sur fond crème.

**Accueil clair** (demande du propriétaire, 21/10/2026, à partir d'une page de référence)
- La page de référence est un modèle payant : on n'en reprend que la **disposition** des écrans. Aucun code, aucune image ni aucun fichier n'en est copié. Tout est écrit ici, aux couleurs du Marché de Gros, en Jost.
- Icônes : Lucide (licence ISC), comme le reste de l'app. Ajoutées dans `tools/icones/build.py` : `boite` (package), `panier` (shopping-cart), `camion`, `sablier`, `tendance`.
- Disposition :
  - en-tête (logo rond = menu, recherche, « + » Publier, compte), qui n'est **pas flottant**, à la demande du propriétaire ;
  - onglets **Marché / Activité / Alertes** ;
  - salutation (« Bonjour, Prénom » ou « Bienvenue au marché ») avec les vrais nombres d'offres et de demandes ;
  - **le sélecteur orbital, inchangé, dans une carte sombre** ;
  - cartes de chiffres (offres, demandes, mes annonces ou prix du marché) ;
  - liste des dernières annonces ;
  - alertes réelles : propositions et messages non lus, stocks épuisés.
- Retirés à la demande du propriétaire : le nom écrit à côté du logo, et la date et l'heure.
- Cloche des notifications dans l'en-tête :
  - la pastille compte les notifications non lues de Mon compte et les messages non lus ;
  - un toucher ouvre Mon compte → Notifications, ou les messages s'il n'y a que des messages ;
  - quand il y a du nouveau, elle se balance toutes les 4,2 s avec une onde maïs, et la pastille apparaît avec un rebond ;
  - rien ne bouge si le téléphone demande moins d'animations.
- J'ai / Je cherche restent en bas, comme avant. Le propriétaire a demandé une proposition à valider avant d'y toucher.
- Code : `accueil()` dans `application.dc.html` (état `accTab`), styles `.acc-*` dans `css/mgci-app.css`. La roue ne dépend plus que de la largeur (la page défile).

**Effets de l'accueil** (demande du propriétaire : « tout ce qui est beau, utile et attractif »)
- Ces effets sont écrits pour l'app : aucun code n'est repris de la page de référence.
- Onglets : la pastille verte glisse d'un onglet à l'autre (`.acc-ong-ind`, `--i`).
- Arrivée en cascade (montée en fondu) de la salutation, de la carte orbitale, des cartes et des lignes, à l'ouverture et à chaque changement d'onglet.
- Chiffres qui défilent jusqu'à leur valeur : `<mdg-nb data-v>` dans `app/effets.js`. Le défilement démarre seulement quand le chiffre est à l'écran.
- Appui : les cartes et les boutons s'enfoncent légèrement. Décor de fins cercles concentriques dans le coin des cartes, et icônes avec un léger dégradé.
- Rien ne bouge si le téléphone demande moins d'animations.

**En-tête, bas de l'accueil et notifications** (demandes du propriétaire)
- J'ai / Je cherche restent en bas (réponse A). La brume blanche derrière eux est retirée.
- Le rond de gauche montre le sac (`MDGSac.svg('plein')`) et ouvre toujours le menu.
- Entre le rond et la loupe, `<mdg-souffle>` en version claire :
  - « marché de Gros » s'écrit sur deux lignes ;
  - puis passent 9 phrases très courtes et concrètes : Vendez en direct, Achetez en gros, Négociez le prix, Payez à la livraison, Votre numéro reste caché, Identités vérifiées, Coopératives vérifiées, Partout en Côte d'Ivoire, Du champ au marché.
- Notifications (connexion, déconnexion et toutes les autres) : style clair. Fond crème, texte foncé, mot mis en avant en vert souligné de maïs, ombre douce.
- ⚠️ La cloche des notifications avait été poussée après la fusion de la PR #106 et manquait sur `main`. Elle est rapatriée dans cette PR.

**Menu clair** (demande du propriétaire : « les icônes doivent être revues »)
- Le menu latéral passe en clair, comme l'accueil : fond `#FFFDF8`, texte foncé, logo vert, « Se déconnecter » en terre cuite.
- Icônes : toujours Lucide (licence ISC), la même famille que sur la page de référence. Aucun fichier n'en est repris.
- Elles sont posées dans des tuiles de 42 px en léger dégradé, avec un reflet et une ombre teintée. Chaque rubrique a sa teinte, lisible sur le blanc (`.dr-clair`, variables `--t-*` dans `css/mgci-app.css`).

**Mon compte allégé + Réglages (thème jour / nuit)** (demandes du propriétaire)
- Mon compte : retirés la rangée « offre en ligne / demandes / en négociation » et le bloc « Votre activité ».
- Notifications : retiré le bouton « Envoyer un essai ».
- Réglages : nouvelle entrée du menu ☰, hors de Mon compte et du profil. `app/theme.js` (`MDGTheme.ouvrir()`) propose 3 choix : Clair, Sombre, Comme le téléphone (par défaut).
  - Le choix est mémorisé sur le téléphone (`mdg-app:theme`).
  - `<html data-theme>` est posé avant l'affichage, et le mode automatique suit le changement jour / nuit du téléphone.
- Le mode sombre couvre l'accueil, le menu, les notifications et la page Réglages (`html[data-theme=sombre]` dans `css/mgci-app.css` et `app/toast.js`).
- **À faire** : les autres pages (fiche produit, Acheter, Vendre, Mon compte…) restent claires pour l'instant. Il faudra les passer une par une.

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
