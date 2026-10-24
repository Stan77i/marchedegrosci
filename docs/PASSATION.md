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
- Commission transport 6,9 % : activée le 21/10 à la demande du propriétaire (schéma 42, registre seulement, rien n'est prélevé).

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

**Identité du logo : « de Gros » toujours jaune maïs** (règle du propriétaire)
- Sur fond clair aussi : « marché » est en vert, « de Gros » en maïs `#F2C230`. On ne le passe jamais tout en vert.
- La version « clair » du logo (`tools/logo/marque.py` → `app/marque.js`) n'a plus de trait maïs sous « de Gros », puisque le mot est déjà maïs.
- Site : `.mq-site .mq-g` est forcé en maïs (`index-v3.html`).

**Carte : forte demande et filtres** (demandé le 21/10)
- Forte demande : la grosse pastille 🔥 posée sur le nom de la ville est supprimée.
  - Un halo corail est maintenant dessiné sur le sol, sous les noms de villes (calque `zone-halo`, source `zones` dans `app/carte-gl.js`).
  - Une petite flamme de 22 px est posée au-dessus du point. Elle ne capte pas les touchers. De près, elle affiche le produit (« Igname 🔥 »).
  - Une bulle d'annonce au même endroit passe devant elle.
  - La puce « Forte demande » ouvre la liste des zones.
- « Vous » (triangle) est retirée : elle ne faisait rien. Votre position, c'est le bouton ⌖ et le point violet.
- « Compatibles » devient un vrai filtre (`cK = 'compat'`) :
  - il montre les annonces des autres qui répondent aux vôtres (même produit, sens inverse) ;
  - vos annonces sont reliées à elles par la ligne bleue (`mapData.lier` → arcs) ;
  - le nombre affiché sur la puce compte ces annonces ;
  - à 0, un message explique quoi faire.
- Plus tard : tenir compte aussi des exigences (schémas 38/40) et du minimum du vendeur dans « compatible ».

**Barre jaune tracée et urgences en tampon** (demandé le 21/10)
- `app/effets.js` (2e bloc, `MDGTrace`) surveille la page.
  - Tout mot souligné de maïs (fond en dégradé rgb 242 194 48, partout) se dessine de gauche à droite chaque fois qu'il revient à l'écran : page, feuille, accueil, défilement.
  - Les étiquettes `.qd[data-u]` se posent comme un coup de tampon, à chaque fois aussi.
  - Les animations passent par `element.animate()`. On n'écrit ni classe ni attribut sur l'élément, car le moteur d'affichage de l'app les réécrit à chaque rendu (vérifié).
- Les urgences sont devenues des tampons (`css/mgci-app.css`, `.qd`) : rectangle plein légèrement penché, liseré blanc, texte en capitales.
  - dès que possible : tomate `#E8552F`, point qui clignote et petit frisson toutes les 3 s ;
  - cette semaine : maïs, avec un sablier ;
  - ce mois-ci / à une date : sable, avec un calendrier ;
  - disponible : vert.
- Si le téléphone demande moins d'animations, rien ne bouge.

**Mode nuit partout** (demandé le 21/10 : « ça doit s'appliquer à tout le site »)
- Pages de l'app : `css/sombre.css` retourne les jetons (`--papier`, `--carte`, `--encre`, `--ivoire`…) dans les pages « papier » (`[data-pg=…]` et tout bloc `background:var(--papier)`, comme le choix du produit ou la recherche).
  - Fonds clairs → sombres ; texte encre → crème ; ce qui était sombre sur le papier (boutons) → clair, texte foncé.
  - Les panneaux `--nuit-2` et `.fam-tile` restent sombres.
  - Liens et mots en valeur → maïs.
  - Les classes à couleurs en dur (`.an-*`, `.px-*`, `.ct-*`) ont leurs règles en bas du fichier.
- Couleurs en dur dans le code de la page (puces d'unités, onglets Offres / Demandes, Je vends, flèches retour, choix du lieu…) remplacées par les jetons. Rien ne change en mode clair : mêmes valeurs.
- Fenêtres des modules (compte, messages, négociations, guide, commandes, relevé, alertes, groupes, appro, chauffeur…) : `app/nuit.js` traduit leurs couleurs à l'affichage. Il ne touche qu'à ce qui est hors de `#dc-root`.
  - fond neutre clair → sombre ; pastel → même teinte en sombre ; voile noir léger → voile clair ;
  - texte neutre foncé → clair ; texte coloré foncé → même teinte éclaircie ;
  - mot surligné de maïs → maïs ;
  - les couleurs vives et le texte posé dessus ne bougent pas.
  - En repassant en clair, les couleurs d'origine reviennent. Les fenêtres créées plus tard sont couvertes d'office.
- Contrôle : un robot ouvre 12 pages et 20 fenêtres en mode nuit et liste les surfaces claires et les textes à contraste < 3.
  - Avant : 145 points. Après : 0, hors éléments voulus (tampons, boutons maïs, puce sélectionnée claire).
  - Script : voir la PR.

### Fenêtres stables et vibrations au toucher
- Défaut corrigé : dans « Mes ventes et achats » (et les autres fenêtres du bas), changer de période ou d'onglet faisait monter et descendre tout le haut de la fenêtre. La hauteur suivait le contenu (chargement, liste vide, liste pleine).
  - Mesuré avant : onglets Tout / Ventes / Achats à 566 → 463 → 531 px. Après : 389 px fixe.
  - La rangée « Ce mois, 3 mois… » revenait au début à chaque clic ; elle garde maintenant sa position.
- `app/stable.js` (chargé dans l'app et dans `index-v3.html`) :
  - hauteur fixe pour les fenêtres à onglets : relevé `.rl`, commandes et chauffeur `.cm`, groupes `.gr`, appro `.ap` ;
  - les autres fenêtres du bas ne redescendent plus une fois touchées (hauteur minimale posée au toucher) ;
  - les rangées qui défilent de côté gardent leur position quand la fenêtre se redessine.
  - Compte, messages, négociations et identité avaient déjà une hauteur fixe.
- Accueil : le nom de famille long (« Assaisonnements, épices, condiments ») passait sur deux lignes et poussait les cartes de 2 px. Il reste sur une ligne, raccourci par « … ». Les flèches de la roue ne sont plus coupées.
- `app/vibre.js` (`MDGVibre`) : petites vibrations, réglables dans Réglages → Sons et écran → « Vibrations au toucher ». Désactivées par défaut.
  - Un tic sur chaque bouton, lien, onglet ou interrupteur ; un cran à chaque produit qui passe dans la roue de l'accueil, et un au lâcher.
  - Android : API vibrate du navigateur. iPhone : pas d'API ; à partir d'iOS 18, on clique un interrupteur système invisible (`<input type="checkbox" switch>`), ce qui donne un léger retour haptique. Il ne marche que pendant un toucher : pas pendant le glissé de la roue, seulement au lâcher.
  - Le choix reste sur le téléphone (`mdg-app:vibrations`).
  - Non vérifié sur un vrai iPhone (impossible ici) : à tester par le propriétaire.
  - Les vibrations de confirmation qui existaient déjà (annonce publiée, chauffeur arrivé, code refusé, bannières) ne dépendent pas de ce réglage.
- Profil et avatar → « Votre structure » : toucher À mon compte / Coopérative / Groupement / Entreprise / Marché redessinait tout le bloc et mettait le curseur dans le champ du nom. Sur iPhone, ça ouvrait le clavier et la page sautait.
  - Maintenant, la sélection change sur place. Seul le détail (nom, logo, preuves) apparaît ou disparaît sous les choix, et le clavier ne s'ouvre plus tout seul.
  - Corrigé aussi : « Nom de la marché » → « Nom du marché ».
  - Robot : dans chaque page de Mon compte, il touche tous les choix et vérifie que rien ne bouge et que le clavier ne s'ouvre pas : 0 saut.

### Carte : plusieurs annonces au même endroit
- Avant : quand on touchait une bulle « 2 dès 13 k F », une seule annonce apparaissait, et rien ne disait qu'il y en avait une autre en glissant. Avec le badge « Officiel · Marché de Gros », la carte s'élargissait à 420 px, sortait de l'écran et cachait complètement la suivante.
- Maintenant :
  - la carte d'annonce est plus compacte sur la carte : seul le tampon reste sous les chiffres, 238 px de haut au lieu de 280. « C'est votre annonce » reste affiché sur ses propres annonces (validé par le propriétaire sur capture) ;
  - le bord de l'annonce suivante dépasse à droite ;
  - une pastille « ‹ ● ○ 1 sur 2 · glissez › » s'affiche : la flèche suivante est maïs et pulse tant qu'on n'a pas changé d'annonce ; les points et les flèches font changer d'annonce ;
  - à l'ouverture, la bande avance un peu puis revient, pour montrer qu'elle glisse (rien si le téléphone demande moins d'animations).
- Partout : un nom ou un badge long ne fait plus déborder la carte d'annonce. Pour le compte officiel, le nom en double est caché (le badge dit déjà « Marché de Gros »), et la ville cède la place en premier.
- Code : `cPickMulti`, `cPickDots`, `cPickAller()`, `cPickInvite()` dans `application.dc.html` ; styles `.an-carte` et `.cpk-*` dans `css/mgci-app.css`.

### Accueil : « Tout » dans la roue → tous les produits en grille
- Pastille « ▦ Tout » en haut à droite de la roue (verre, icône maïs), pour ne plus faire tourner la roue produit par produit.
- Fenêtre « Tous les produits » (même panneau sombre que les familles) :
  - grille de 3 colonnes (4 sur les grands écrans), photo du sac ou vignette, nom sur 2 lignes au plus ;
  - sous chaque produit, le nombre d'offres (rond vert) et de demandes (carré jaune) en cours ;
  - filtres : « Avec annonces » (seulement ce qui a des offres ou des demandes), « Tout » (les 162 produits, rangés par famille), ou une famille. Par défaut : la famille affichée dans la roue ;
  - recherche sur le nom et les autres noms (alias), dans toutes les familles ;
  - le produit au centre de la roue est entouré de maïs ;
  - toucher un produit ferme la fenêtre et le met au centre de la roue, dans sa famille.
- Calculé seulement quand la fenêtre est ouverte ; les vignettes se chargent au fil du défilement.
- Code : `toutVoir()` dans `application.dc.html` (état `sheet: 'tout'`, `tq`, `tvF`), styles `.tv-*` dans `css/mgci-app.css`.

### Bande blanche en bas d'Approvisionnement pro (et pieds de page)
- Défaut : en descendant dans Approvisionnement pro, une bande blanche floue coupait l'écran au-dessus de « Publier un besoin ». C'était l'ombre crème du pied de page (`.ap-pied`, pareil pour `.rc-pied` dans Racheter) : le mode nuit traduit les fonds, pas les ombres.
  - `css/sombre.css` : en mode nuit, cette ombre prend la couleur sombre du pied.
- Le pied restait au milieu de la fenêtre quand la liste était courte (192 px de vide dessous), depuis que la fenêtre a une hauteur fixe. `app/stable.js` le pousse maintenant en bas (`coller()`).
- Le petit sac des listes vides était collé à gauche dans Approvisionnement pro, Achats groupés, Prix par zone et Racheter. Il est centré (`app/sac.js`).
- Robot d'audit du mode nuit étendu : il repère aussi les ombres claires, les dégradés clairs des éléments décoratifs (`::before` / `::after`) et les pieds de page qui flottent. Sur les 20 fenêtres et les 12 pages, il ne reste que les contours voulus (tampons, voyants, interrupteurs).

### Offre = 🧺, demande = 🛒, partout
- Demande du propriétaire : plus de points verts ni de carrés jaunes. Les mêmes images que les boutons J'ai (🧺) et Je cherche (🛒), partout.
- Repère commun `.od` (`css/mgci-app.css`) : 🧺 sur une pastille ronde verte, 🛒 sur une pastille carrée maïs. Trois repères à la fois : l'image, la forme, la couleur.
  - Animation : le panier se pose avec un petit rebond puis se balance toutes les 7 s ; le chariot arrive en roulant puis avance d'un cran. Rien ne bouge si le téléphone demande moins d'animations.
- Remplacés :
  - accueil : compteurs du produit, cartes « Offres en ligne » et « Demandes » (avant : un colis et un chariot dessiné) ;
  - cartes d'annonce (`an-forme`), aperçu de publication, fenêtre J'ai / Je cherche, avatar des correspondances ;
  - carte (bulles, liste), familles, « Tout », catégories (`css/categories-app.css`) ;
  - Mon compte (`v3/compte.js`), réputation (`v3/reputation.js`), fenêtre de connexion (`v3/nuage.js`).
  - Les repères bleus (négociations, achats conclus) et le voyant « en ligne » ne changent pas : ce ne sont ni des offres ni des demandes.
- Les fenêtres des modules (`v3/…`) dessinent ces repères en CSS, sur leurs `<i>` existants (`::before { content: "🧺" }`).

### « Tout » : le « + » de chaque produit → J'ai / Je cherche
- Chaque produit de la grille « Tous les produits » a un « + » maïs en haut à droite.
- En le touchant, la case se coupe en deux : « 🧺 J'ai, à vendre » (vert) et « 🛒 Je cherche, à acheter » (maïs). Le « + » tourne en « × » pour annuler.
- Le choix ferme la grille, met le produit au centre de la roue et ouvre la fenêtre J'ai / Je cherche déjà réglée sur ce produit et sur ce sens : quantité, unité, région, prix ou budget, ville, délai. Le lien vers le formulaire complet donne les exigences.
- Code : état `tvPlus` dans `toutVoir()` ; styles `.tv-case`, `.tv-plus`, `.tv-choix`.

### Accueil : J'ai / Je cherche seulement sur l'onglet Marché
- Sur Activité et Alertes, il n'y a rien à publier : les boutons J'ai / Je cherche glissent vers le bas et disparaissent. Ils reviennent sur Marché. Rien ne bouge si le téléphone demande moins d'animations.
- La liste « Dernières annonces » (Activité) affichait encore le colis et le chariot dessinés : elle passe en 🧺 / 🛒.
- Code : `accBasC` / `accBasH` (classe `.acc-bas.cache`).

### Accueil → Activité : « En cours » et « Reprendre »
- L'onglet Activité montre d'abord ce qui est **en cours**, pour ne jamais se perdre dans l'application :
  - négociations : proposition à laquelle répondre, proposition en attente de l'autre, accord conclu depuis moins de 3 jours ;
  - commandes : à confirmer, en préparation, en route, litige ;
  - messages : conversations avec des messages non lus.
- « Reprendre là où vous en étiez » (bord maïs, en tête) : la dernière démarche ouverte (négociation, commande ou conversation), gardée 2 jours sur le téléphone, tant qu'elle est encore en cours. Un toucher la rouvre.
- Ordre : ce qui attend ma réponse, puis ce qui roule, puis ce qui attend l'autre, puis les accords.
- Animations : 🤝 / 💬 / 📦 avec un anneau maïs quand c'est à moi d'agir ; 🚚 qui roule sur une route en pointillés quand la commande est en route ; trois points qui ondulent quand on attend l'autre ; ✅ pour un accord.
- Pastille sur l'onglet Activité : le nombre de démarches en cours. Elle bat (maïs) s'il y a quelque chose à faire, sinon elle reste discrète.
- Rien d'inventé : tout vient des listes déjà gardées par `v3/negoce.js`, `v3/commandes.js` et `v3/messages.js` (chacun exporte `activite()`). Les commandes sont relues au démarrage et au retour sur l'application (une fois par minute au plus).
- Code : `app/activite.js` (`MDGActivite.noter / tout / dernier / aFaire`, événement `mdg:activite`) ; `ecListe`, `ecRep` dans `application.dc.html` ; styles `.ec-*`.

### Notifications réparées (annonces, conseils réguliers, et toutes les autres sur iPhone)
- Cause 1 (serveur) : les annonces du marché, achats groupés, besoins et notifications régulières n'allaient qu'aux comptes ayant une ligne dans `profils`. Le compte « Marché de Gros » (abonné le 22/10 à 2 h 51) n'a pas de profil : il ne recevait rien. `supabase/schema-46-notifs-sans-profil.sql` : jointure à gauche, les comptes supprimés restent exclus. Test annulé : les 2 comptes abonnés sont maintenant visés.
- Cause 2 (iPhone) : Safari ne prend pas en charge `renotify`. Une notification qui remplace une autre de même étiquette (`marche-annonce`, `marche-pub`, `dm-…`, `nego-…`, `cmd-…`) arrivait sans bannière ni son. `sw.js` : chaque notification a maintenant sa propre étiquette (`base~heure`) et l'ancienne du même sujet est retirée. Une seule par sujet dans le centre de notifications, mais toujours une alerte.
- Rythme des notifications régulières : toutes les 25 minutes environ de 7 h à 21 h (avant : toutes les 30). Tâche `mdg-marketing` passée à `*/5`, écart minimal 23 min, toujours 30 par jour au plus.
- À noter : le compte qui publie une annonce ne reçoit pas sa propre notification (normal). Seuls 2 téléphones sont abonnés aujourd'hui.

### Exigences dans les demandes ordinaires (« Je cherche »)
- Avant : les exigences n'existaient que dans Approvisionnement pro. Une demande ordinaire ne pouvait dire que la quantité, le budget et le délai.
- Serveur, `supabase/schema-47-exigences-demandes.sql` (appliqué) : trois colonnes sur `demandes`, vides par défaut.
  - `criteres` : cases cochées, même liste fermée que les besoins (schéma 38) ;
  - `detail` : qualité, calibre, maturité, conditionnement, vérifiés par `_besoin_detail` (schéma 40) dans un déclencheur `demandes_exigences` ;
  - `exigences` : texte libre, 300 caractères au plus, passé au filtre `garde_textes` (pas de numéro ni de lien).
  - Test annulé : doublons retirés, cases vides ignorées, texte rogné ; un numéro caché dans le texte est refusé.
- Application : bloc « Vos exigences » dans la fenêtre Je cherche et dans la page Je cherche.
  - 9 cases rapides (récolte fraîche, calibre régulier, trié, bien sec, emballage propre, échantillon, pesée devant moi, livraison sur place, reçu) ;
  - « Plus de précisions » : qualité, calibre, maturité, emballage ;
  - un texte libre « Autres exigences ».
- Sur l'annonce, chaque exigence s'affiche avec une coche verte (8 au plus, puis « + n »). Elles se voient donc aussi dans « Demandes qui vous cherchent » quand un vendeur publie.
- Code : `EXI_CRIT`, `EXI_DET`, `exiBloc()`, `exiTextes()` dans `application.dc.html` ; lecture et envoi dans `v3/nuage.js` ; styles `.exi*`.
- Pas encore fait : des qualités garanties côté offre (le vendeur coche « frais, trié… ») pour rapprocher offres et demandes.

### Transport inclus ou non, et lien de suivi pour son propre chauffeur
- Règle du marché (demandée par le propriétaire, comme à Abidjan) : entre deux villes, le vendeur livre, le transport est compris dans son prix ; dans la même ville, l'acheteur s'en charge.
- À la publication (fenêtre J'ai / Je cherche, page J'ai, page Je cherche), choix « 🚚 Transport » :
  - offre : « Inclus hors de ma ville » (par défaut, la règle du marché) · « Inclus partout » · « Non inclus » ;
  - demande : « Le vendeur livre » (par défaut) · « Je prends le transport ».
  - Sur l'annonce : « 🚚 Transport inclus », « 🚚 Livré hors d'Abidjan », « 🚚 Transport à la charge de l'acheteur », « 🚚 Livraison par le vendeur », « 🚚 L'acheteur prend le transport ». Les anciennes annonces n'affichent rien.
- À la commande (`v3/commandes.js`, `choixTransport`) :
  - offre « inclus » ou demande « le vendeur livre » : seul « Le vendeur livre » est proposé, pas de transporteur du réseau. Le serveur le refuse aussi (`commande_creer` + `_transport_vendeur`) ;
  - offre « inclus hors de ma ville » : autre ville → le vendeur livre (par défaut) ; même ville → l'acheteur, ou un transporteur du réseau ;
  - non inclus : l'acheteur par défaut.
- Lien de suivi (`supabase/schema-48-transport-inclus.sql`, appliqué) : celui qui s'occupe du transport crée un lien dans le suivi de la commande, puis l'envoie à son chauffeur (bouton « Envoyer au chauffeur » : partage du téléphone ou WhatsApp, ou « Copier »).
  - Le chauffeur ouvre `suivi.html?j=…`, sans compte, et touche « Partager ma position ». Sa position arrive dans `positions` (une toutes les 15 s au plus) et s'affiche dans le suivi, comme pour un chauffeur du réseau.
  - L'autre partie voit « Le chauffeur a ouvert le lien · il y a 2 min ».
  - La page du chauffeur ne montre que le produit, la quantité et les villes (ni nom ni numéro). Le lien expire à la fin de la commande, 10 jours au plus. L'écran reste allumé pendant le partage (Wake Lock) ; une page fermée ne partage plus.
  - Fonctions : `suivi_lien_creer`, `suivi_lien_etat` (comptes), `suivi_lien_infos`, `suivi_lien_position` (sans compte). Test annulé : le vendeur crée le lien, l'acheteur est refusé, la position est enregistrée, le 2ᵉ envoi trop rapproché est ignoré.

### Le transport se négocie, tampon « Transport », lien de suivi conseillé
- Tampon sur l'annonce, de la même famille que « Il le faut cette semaine », penché dans l'autre sens :
  - bleu (camion) : « Transport inclus », « Livré hors d'Abidjan », « Transport inclus demandé » ;
  - crème à bord pointillé : « Transport à discuter » (offre non incluse), « Transport par l'acheteur ».
  - Il remplace l'étiquette bleue de la version précédente ; il reste visible sur la carte compacte.
- Négociation (`supabase/schema-49-transport-negocie.sql`, appliqué ; `v3/negoce.js`) : dans chaque proposition, « 🚚 Transport inclus » ou « Sans transport ».
  - Point de départ : ce que dit l'annonce. L'acheteur peut demander « transport inclus » et le vendeur ajuste son prix.
  - Le choix s'affiche sur la proposition, dans le total, dans l'accord (« 12 000 F, transport inclus »).
  - Serveur : `nego_transport(p_nego, p_oui)` marque la proposition en attente de son auteur. Un déclencheur recopie l'information dans `negociations.transport_final` à l'accord. `commande_creer` suit l'accord avant l'annonce : accord « transport inclus » → le vendeur transporte.
  - Test annulé : proposition marquée, l'autre partie ne peut pas la modifier, accord « transport inclus », commande « réseau » refusée.
- Commande : le lien de suivi est conseillé à celui qui livre : « 🛡️ Donnez un lien de suivi à votre chauffeur · Recommandé », trois raisons (📍 l'autre partie voit le camion, 🔒 sécurité, 📲 sans compte), puis « Facultatif, mais vivement conseillé ». L'autre partie voit « 🟢 Le chauffeur partage sa position · il y a 2 min ».

### Vendre : « Je suis intermédiaire » / « J'ai un stock ici aussi » lisibles
- Défaut : en mode sombre, ces deux boutons utilisaient les jetons `--encre` / `--champ`, qui s'inversent, posés dans un encadré qui reste crème. Le choix retenu paraissait éteint et l'autre semblait choisi : on ne savait pas ce qui se passait au toucher.
- Maintenant (`.lieu-b`, mêmes couleurs dans les deux modes) : choix retenu = bord vert, fond vert pâle, coche qui apparaît avec un petit rebond ; l'autre = rond vide ; enfoncement au toucher. Rôle « radio » pour les lecteurs d'écran.

### Accueil → Activité : retirer des éléments
- Chaque ligne (Reprendre, En cours, Dernières annonces) se retire en la glissant vers la gauche : une zone rouge « 🗑️ Retirer » apparaît ; au-delà de la moitié, la ligne part. La zone se touche aussi (bouton).
  - Défilement natif du téléphone (`.glis`, scroll-snap) plutôt qu'un geste simulé : fluide, sans gêner le défilement vertical, sans toucher au moteur de la page.
- « Tout effacer » en haut de « En cours » et de « Dernières annonces » (s'il y a au moins 2 lignes).
- Après chaque retrait, le message en haut propose « Annuler ».
- Sur ce téléphone seulement (`mdg-activite:masques`, oublié au bout de 60 jours). Rien n'est supprimé sur le serveur.
  - Une démarche retirée revient si elle bouge (nouvelle réponse, nouvelle étape) : on compare son heure à celle du retrait.
  - Une annonce retirée ne revient pas ; les nouvelles annonces s'affichent normalement.
- Pour que le geste se devine : la phrase « Glissez une ligne vers la gauche pour la retirer » et, les 3 premières fois, la première ligne glisse un peu puis revient.
- La pastille de l'onglet Activité ne compte plus ce qui a été retiré.

## 5. En attente d'une décision du propriétaire


1. **Zoom** : autoriser le zoom à deux doigts partout sauf sur la carte ? (seule alerte d'accessibilité critique restante, WCAG 1.4.4)
2. **« Je cherche » coupé sur les très petits écrans (280 px)** : raccourcir en « Cherche » sur ces écrans seulement ?
3. **Photo de kplala** (feuilles de corète) : le fichier reçu était celui du corossol, il a été retiré. Attendre une vraie photo.
4. **Cibles de 36 à 43 px** (filtres, unités) : les passer à 44 px, quitte à rendre les écrans moins denses ?
5. **Vérification anti-robot (Cloudflare Turnstile), décision du 23/10/2026 : le propriétaire la veut sur le site web seulement, pas dans l'application web.** Rien n'est fait pour l'instant.
   - Attention : la protection CAPTCHA de Supabase Auth est **globale au projet**. Si on l'active dans Supabase, l'application devra aussi envoyer un jeton à chaque connexion et inscription, sinon plus personne ne pourra s'y connecter.
   - La mettre seulement sur les formulaires du site, sans l'activer dans Supabase, ne protège presque rien : un robot s'adresse directement au serveur.
   - Conseil donné : l'activer partout en mode invisible. Le propriétaire reste libre de choisir ; lui reposer la question au moment de le faire.
   - Il faudra un compte Cloudflare gratuit. La clé secrète se saisit dans Supabase par le propriétaire, **jamais dans le front** ; seule la clé du site va dans les pages.
6. **Photos de produits manquantes** : 30 produits sur 175 n’ont pas d’image (après l’import des photos du site IVT). Liste dans `docs/IMAGES.md`, section « Produits sans photo ».

## 6. À vérifier par lui sur un vrai téléphone

- L'accueil : J'ai / Je cherche entièrement visibles (#81).
- L'envoi réel d'un logo et de preuves de structure (testé seulement avec un serveur simulé).
- L'écran « annonce publiée » après une vraie publication (rappel de confiance, sac qui saute).
- Les vibrations au toucher sur iPhone (iOS 18 ou plus) et sur Android.

## 7. Suite logique proposée

1. **Les petites décisions du point 5**, rapides à appliquer.
2. **Paiement en séquestre**, le gros chantier : trancher les questions de `docs/SEQUESTRE.md` (opérateur mobile money, agrément BCEAO, délai de libération, frais), puis construire les états (déposé → livré → libéré / litige), l'écran admin des litiges et les vrais reçus.
3. **Vérification des structures par l'équipe** : un badge « Structure vérifiée » décidé par l'admin à partir des preuves (aujourd'hui, elles sont affichées « non vérifiées »).
4. **Le sac dans d'autres moments** : tirer pour actualiser, attentes restantes.
5. **Le site** : appliquer `PORTAGE-SITE.md` dans l'ordre de ses priorités (formulaires, cartes, images, sac, voix du logo, couleurs, lien admin).

## 8. Pour démarrer une nouvelle discussion

Lui proposer de coller ceci :
> « Lis `docs/PASSATION.md` du dépôt Stan77i/marchedegrosci, puis `PORTAGE-SITE.md` si on touche au site. On travaille sur l'application. Charge le skill xias-design pour tout ce qui est design. »

**Images : poissons, volailles, œufs** (lot reçu le 21/10, 31 photos détourées)
- `tools/images/poissons-volailles.py` associe chaque photo à un produit existant, d'après l'image elle-même : les noms de fichiers sont en anglais et parfois vagues (« Gray crate filled with fish »).
- Mise en forme comme `tools/images/produits.py` : carré 800 × 800, image posée en bas, WebP, teinte de vignette dans `A.SACK`.
- 19 produits ont leur image :
  - poissons : tilapia, capitaine, silure, poisson fumé, poisson séché, sardine, maquereau, chinchard, thon, bar, crevette ;
  - volailles : poulet de chair, poulet fermier, pintade, canard, dinde ;
  - œufs : de poule (alvéole), de pintade, de caille.
- Chinchard : la photo est intitulée « maquereau ». C'est le poisson le plus proche.
- 12 photos non utilisées, faute de produit au catalogue ou parce que ce sont des doublons : carpe, crabes, machoiron de mer, 2e capitaine, daurade, sole, langoustes, peau de bœuf (kpanman), tripes, 2 caisses de crevettes, silure fumé.
  - On peut ajouter crabe, langouste, sole, kpanman… si le propriétaire le veut.
- Restent sans photo : poisson / poulet / crevettes surgelés, pigeon, poule pondeuse réformée, œufs de poule fermière.


**Notifications : l'écriture du site** (demandé le 21/10)
- La pastille (`app/toast.js`, partagée par l'app et le site) écrit comme la bande « Parcours *sécurisé* : tout se passe ici ».
  - Le texte est en Jost 500 (avant : tout en gras 600).
  - Un seul mot est en gras italique : maïs de nuit, vert surligné de maïs de jour.
- Choix du mot (fonction `accent`) :
  - le message peut le marquer lui-même : `*mot*` ;
  - sinon, le premier mot qui dit ce qui s'est passé (publiée, envoyé, connecté, impossible, retirée…) ;
  - sinon, le premier mot du métier (annonce, offre, négociation, commande, prix…) ;
  - sinon, rien.

**Tampons : plus de débordement** (signalé le 21/10 sur la liste de la carte)
- `.qd` : le texte passe à la ligne, équilibré (`text-wrap: balance`). Un mot trop long se coupe plutôt que de sortir du tampon.
- Dans la liste de la carte, très étroite, le tampon est un peu plus serré (10,5 px).
- Vérifié à 320, 360 et 414 px, de jour et de nuit, sur la carte, le catalogue et la fiche : aucun débordement.

**Notifications vérifiées et complétées** (schéma 41, 21/10)
- Vérifié en direct :
  - la base joint bien la fonction « pousser » (clé du coffre acceptée, réponse 200) ;
  - la version en ligne est celle du code.
- Approvisionnement : chaque produit d'un besoin devient une demande, qui prévient ceux qui suivent le produit (cas 5). Les réponses des vendeurs passent par la négociation (cas 1).
  - **Ajout (5 bis)** : les vendeurs qui ont une offre active de ce produit sont prévenus aussi (« Un professionnel cherche : … »).
- Achats groupés, **ajouts** :
  - « ouvert » : le créateur est prévenu, ainsi que ceux qui suivent le produit (ils peuvent rejoindre). Envoyé seulement à l'ouverture, pas quand on redescend sous le seuil.
  - « un acheteur a rejoint » : le créateur et le vendeur sont prévenus (une notification qui se remplace).
- Fonction « pousser » déployée en **version 10**. `push_groupe` réécrite ; le déclencheur des participants couvre aussi l'insertion.
- Constat sur les données (pas un défaut) :
  - 1 seul compte a activé les notifications sur son téléphone (2 appareils) ;
  - 0 alerte produit : tant que personne ne suit de produit, les nouvelles annonces ne préviennent personne.

**Commission transport 6,9 %** (schéma 42, demandée et tranchée par le propriétaire le 21/10)
- Choix du propriétaire :
  - **le chauffeur fixe le prix du transport** en acceptant la mission ;
  - la commission est **due par le chauffeur**, qui l'inclut dans son prix ;
  - l'acheteur paie à la livraison **marchandise + transport** (ex. 50 000 + 10 000 = 60 000 F).
- `transport_missions.prix` (nouvelle colonne). `chauffeur_repondre2(mission, oui, prix)` accepte avec le prix. `chauffeur_prix` le corrige jusqu'au chargement. `admin_mission_prix` sert pour un chauffeur sans application (l'équipe saisit le prix donné au téléphone).
- Registre `commissions_transport` + journal figé, calqué sur le schéma 30 :
  - 6,9 % du prix arrondi ;
  - statut prévue → due (commande terminée) · suspendue (litige) · annulée (commande annulée, mission refusée ou retirée) ;
  - encaissement = 'aucun' (seule valeur permise).
- Lecture : `mes_commissions_transport()` (chauffeur), `admin_commissions_transport()`. `commande_transport` renvoie `prix_transport` et `total_livraison`. `chauffeur_missions` renvoie prix, commission et net. `admin_commandes` renvoie la mission (id, prix, avec ou sans application) ; « À traiter » liste les prix manquants des chauffeurs sans application.
- Écrans :
  - Espace chauffeur : « Accepter et fixer mon prix », calcul en direct (commission, ce qu'il garde), « Changer mon prix » ;
  - commande : prix du transport et « À payer à la livraison » ;
  - admin : saisie du prix pour un chauffeur sans application, section « Transport · 6,9 % » dans Commissions.
- Tests SQL (annulés à la fin) :
  - acceptation à 10 000 F → 690 F prévue, le chauffeur garde 9 310 F ;
  - prix 12 000 F → 828 F ; commande terminée → due ; total acheteur 62 000 F ;
  - prix 0 refusé ; changer le prix après le chargement refusé ;
  - litige → suspendue, annulation → annulée, mission retirée → annulée.
- Reste à faire : les **marges de négociation des transporteurs (< 8–10 %)**, évoquées par le propriétaire, ne sont pas construites. Aujourd'hui le chauffeur fixe son prix seul.

**Annonces du marché et la vraie panne des notifications** (schémas 43 et 44, pousser v11, 22/10)
- **Panne trouvée** (schéma 44) : le rôle service de la fonction « pousser » ne pouvait pas lire `offres`, `demandes`, `besoins`, `alertes_produits`, `groupes_achat`, `groupe_participants`, `rappels_achat`, `admins`, `alertes`, `verifications`.
  - Ces notifications ne partaient donc jamais : nouvelles annonces, achats groupés, rappels, alertes admin, dossiers d'identité.
  - Droit de lecture donné. Vérifié avec la vraie demande « Gombo » du propriétaire : envoyée (1 compte, 2 téléphones).
- **Annonces du marché** (schéma 43, demandé par le propriétaire) : tous les comptes qui ont activé les notifications sont prévenus.
  - Nouvelle offre ou demande : étiquette `marche-annonce`, la dernière remplace la précédente sur le téléphone.
  - Achat groupé, à son ouverture.
  - Besoin pro : une seule notification par besoin, envoyée aux comptes à identité vérifiée, en plus des abonnés au produit et des vendeurs qui en ont.
- Garde-fous :
  - `push_diffusion_cible(type, exclure, max)` choisit et compte les destinataires : 10 par personne et par jour, réglage respecté, bannis et supprimés exclus, jamais l'auteur ;
  - envoi par paquets de 40 ;
  - interrupteur « Annonces du marché » dans Mon compte → Notifications (`notif_reglage_diffusions`, réglage gardé sur le serveur).
- Un compte ne reçoit rien tant qu'il n'a pas activé les notifications sur son téléphone. Aujourd'hui, 1 seul compte l'a fait. Sur iPhone, il faut d'abord ajouter l'app à l'écran d'accueil.
- **Pas de SMS** : c'est payant (règle du propriétaire : aucun service payant). Les notifications Web Push sont gratuites.

**Accueil vivant** (22/10, demandé par le propriétaire)
- Orbite (`.acc-orb`) :
  - une lueur maïs parcourt l'arc en continu (`.acc-comete`, 7 s) ;
  - le point du produit actif respire (`.acc-pouls`) ;
  - le sac flotte, avec une ombre qui suit (`.acc-flotte`) ;
  - le halo pulse (`.acc-halo`).
- Cartes de chiffres : un reflet passe à tour de rôle (`.acc-k::after`, 7 s, décalé) et les icônes bougent légèrement, chacune à son tour.
- Cartes et dernières annonces : la cascade d'arrivée se rejoue à chaque retour à l'écran (`app/effets.js`, `MONTE`).
- Si le téléphone demande moins d'animations, rien ne bouge.

**Négociation lisible** (22/10, signalé par le propriétaire)
- La carte de proposition (`.nx-tk`) avait un fond presque noir codé en dur (`#16130f`), un reste de l'ancien design sombre, avec un texte foncé : le montant était illisible.
  - Votre proposition : carte encre et texte crème. Celle de l'autre : carte claire.
  - Les étiquettes (en attente, acceptée…) sont relues sur ces fonds.
- Réglette des prix : l'étiquette « affiché 100 000 » se superposait à « acheteur ». Quand un prix est à moins de 14 % du repère, l'étiquette n'est plus écrite et le prix dit « acheteur · = affiché ».
- Fouille en mode jour (robot sur 12 pages et 22 fenêtres) : aucun autre texte illisible. Les 3 signalements restants sont des faux positifs : indicateur d'onglet, texte de secours caché sous le sac, croix posée sur une photo.

**Notifications régulières « marketing »** (schéma 45, pousser v13, 22/10)
- Choix du propriétaire : **30 par jour**, envoyées à tous les comptes, avec l'interrupteur « Annonces du marché » pour les couper.
- Règle tenue (signalée au propriétaire) : **aucun message faux** (« une personne vous attend » quand ce n'est pas vrai). Les messages viennent des vraies données ou présentent une vraie fonction :
  - une notification sur quatre : offres du jour, acheteurs qui cherchent tel produit, achats groupés ouverts, besoins pros, fourchette de prix ;
  - les autres : 12 conseils sur l'application (négocier, vendre en direct, numéro caché, achat groupé, paiement à la livraison, alertes, approvisionnement pro, transporteurs, calendrier, identité, carte, prix).
- Horloge pg_cron `mdg-marketing` toutes les 10 min. `marketing_tick()` envoie si l'intervalle est écoulé : (21 h − 7 h) / 30 ≈ 28 min. Pas d'envoi la nuit.
- Compteur séparé (`push_marketing_jour`), qui n'entame pas les 10 annonces du marché. Étiquette `marche-pub` : la notification remplace la précédente sur le téléphone.
- **Pour changer la fréquence sans toucher au code** : `update public.marketing_reglage set max_jour = 12;` (0 = arrêt). On peut aussi régler `debut_h` et `fin_h`.
- Vérifié sans envoi réel, de nuit, avec le plafond à 0 : 200, messages bien composés. Remis à 30.

**Tous les réglages dans Réglages** (22/10, demandé par le propriétaire : « Notifications, c'est que des notifications »)
- La page Réglages (menu ☰, `app/theme.js`) réunit tout :
  - Apparence ;
  - Notifications : activer ou désactiver sur ce téléphone, et l'interrupteur « Annonces du marché » ;
  - Sons et écran : Sons (ouvre le panneau des sons), Messages à l'écran ;
  - Confidentialité : montrer mon nom de famille, via `MDGCompte.regler`.
- Retirés ailleurs :
  - la carte d'activation et l'interrupteur, de Notifications (qui ne montre plus que la liste) ;
  - les lignes Sons et Confidentialité, de Mon compte ;
  - la ligne Sons, de l'ancienne fenêtre de compte (`v3/nuage.js`).
  - L'ancienne page « Réglages » de Mon compte n'est plus reliée à rien.
- Les deux lectures (état du téléphone, réglage serveur) sont indépendantes, avec 4 s au plus pour le téléphone. Sinon l'interrupteur restait bloqué (constaté au test).

**Codes de réception et de prise en charge mis en avant** (schéma 50, pousser v14, 22/10, demandé par le propriétaire)
- Notifications (pousser v14), seulement pour une commande « avec codes » :
  - acheteur, au chargement et au transbordement : « 🔐 Gardez bien votre code de réception : vous aurez à le présenter au chauffeur, après avoir vérifié la marchandise » ;
  - acheteur, à l'arrivée : « 🔐 Le chauffeur est arrivé : préparez votre code » ;
  - vendeur, à la confirmation : « 🔐 Gardez bien votre code de prise en charge ».
- Fenêtre de la commande : bandeau maïs « 🔐 Gardez bien ce code : vous aurez à le présenter… » en haut du bloc code (`blocCode`, `.cm-garde`).
- Accueil → Alertes → **« 🔐 Mes codes »**, compté dans la pastille Alertes :
  - acheteur (transport, transbordement, arrivée) et vendeur (confirmée, préparation) : `MDGCommandes.codes()`. Toucher ouvre la commande au bloc code (`ouvrir(id, true)`) ;
  - transporteur inscrit : `MDGChauffeur.codes()`, les codes à demander puis taper. Toucher ouvre l'Espace chauffeur directement sur la saisie (`ouvrir(cmd, quoi)`). Ses missions sont relues au démarrage (`fond()`, une fois par minute au plus) ;
  - « arrivé » passe en tête, avec un halo.
- **Choix de sécurité gardé** : le code n'est jamais enregistré dans le téléphone (mémoire seulement). « Mes codes » montre les chiffres s'ils ont été affichés pendant la visite ; sinon « Afficher », qui crée le code au serveur (l'ancien ne marche plus). Si l'application est fermée, il suffit de toucher à nouveau.
- **Commission** (schéma 50) : quand le transport est compris dans le prix du vendeur (`negociations.transport_final`, sinon l'annonce), aucune commission transport de 6,9 % n'est enregistrée, même si le vendeur prend un transporteur inscrit (`_cmd_transport_inclus`, garde dans `_ctr_sync`). La commission de 3,5 % porte déjà sur le seul prix du vendeur (schéma 30).
  - Testé et annulé (rollback) : inclus → aucune ligne ; non inclus, 12 000 F → 828 F.

**Chacun exige le code de l'autre, la demande passe par l'application** (schéma 51, pousser v15, 22/10, demandé par le propriétaire : « ça se discute dans l'application, pas sur WhatsApp »)
- Chauffeur (transporteur inscrit) :
  - sa carte de mission affiche un bandeau « 🔐 Exigez que le vendeur / l'acheteur vous montre son code… Montrez-lui aussi votre code transporteur T-XXXX » ;
  - le bouton « 🔐 Demander le code au vendeur / à l'acheteur » appelle `commande_code_demander` (une demande toutes les 2 min au plus par commande), et l'autre reçoit une notification.
- Acheteur et vendeur : le bloc code montre « 🚚 Code du chauffeur : T-XXXX. Exigez qu'il vous le montre dans son application : s'il ne l'a pas, ce n'est pas le bon chauffeur » (`commande_transport.mission.code`, seulement une fois la mission acceptée).
- Notifications :
  - au vendeur ou à l'acheteur quand le chauffeur demande le code (table `code_demandes`, déclencheur `push_code_demande`, cas 14 de pousser) ;
  - au chauffeur à la préparation (« exigez le code de prise en charge ») ;
  - l'acheteur, à l'arrivée, lit « exigez d'abord qu'il vous montre son code transporteur ».
- Le code de réception ou de prise en charge n'est **jamais** envoyé par notification ni par message : il se montre sur place.
- Testé (SQL annulé par rollback) : demande acceptée vers l'acheteur, 2e demande refusée (2 min), acheteur refusé, code transporteur vu par l'acheteur. Playwright clair et sombre : bandeaux, bouton, appel envoyé, aucune erreur.
- pousser v15 : les deux `replace(/ | /g…)` sont écrits `/[  ]/g` (caractères invisibles qui risquaient d'être perdus au copier-coller).

**Écran d'ouverture qui ne reste plus bloqué** (22/10, signalé par le propriétaire : « l'app est plantée » à 9 h 45)
- Cause probable : l'application a été ouverte à 9 h 45, pendant la mise en ligne de la PR #141 (GitHub Pages, de 9 h 44 à 9 h 45). Le téléphone a reçu un mélange de fichiers. Sans `v2/data.js` ou `app/marche-app.js`, `ready` ne passe jamais à vrai et l'écran d'ouverture restait affiché pour toujours.
- Aucune erreur dans le code publié : 3 ouvertures avec le service hors-ligne, aucune erreur.
- Filet ajouté (`componentDidMount`) :
  - après 9 s sans données, on demande la nouvelle version au service hors-ligne (`registration.update()`), puis on recharge **une fois** (`sessionStorage mdg-relance`) ;
  - si cela échoue encore, l'écran dit « Le chargement n'aboutit pas. Vérifiez internet, puis réessayez. » avec un bouton **Réessayer** (`.spl-re`).
- Testé (Playwright, `v2/data.js` refusé) : refusé une seule fois → rechargement automatique, l'application s'ouvre ; toujours refusé → message et bouton.

**Vente conclue : l'annonce baisse ou disparaît, partout** (schéma 52, 22/10, signalé par le propriétaire : demande de gombo conclue toujours visible)
- Règle (déjà au serveur depuis le schéma 12) : à l'accord, l'annonce baisse de la quantité convenue (20 t demandées, 10 t convenues → il reste 10 t) ; à zéro, elle est retirée.
- Bug trouvé : le téléphone du propriétaire de l'annonce ne reprenait la quantité du serveur que pour les **offres** (`stockDuServeur`), jamais pour les **demandes**. Il gardait sa copie (20 t) et l'a renvoyée au serveur : la quantité est remontée à 20 t (le statut est resté « retiree »).
- Corrections :
  - `v3/nuage.js` : `stockDuServeur()` reprend offres ET demandes (quantité, offre `epuise`, demande `servie`). Il est appelé **avant** tout envoi dans `sync()` : le téléphone ne renvoie plus jamais une ancienne quantité ;
  - application : `demands()` exclut les demandes servies (`demandsAll()` les garde pour Mes publications, avec le badge « SERVIE · TOUT EST TROUVÉ ») ; « Dernières annonces » n'affiche plus les offres épuisées (`offers()` au lieu de `offersAll()`) ;
  - schéma 52, garde au serveur (`_stock_garde`, offres et demandes) : sur une annonce dont un accord a pris du stock, une annonce retirée à zéro ne remonte pas par un renvoi, et une annonce à zéro ne redevient pas active. Une commande annulée rend toujours le stock (`_cmd_rendre_stock` passe la garde, réglage `mdg.stock_rendu`) ;
  - données : la demande de gombo est remise à 0 t (20 − 20), seule annonce touchée (vérifié sur tous les accords conclus).
- Testé :
  - SQL avec rollback : 20 t, 10 vendues → 10 actif ; 20 vendues → 0 retiré ; renvoi du téléphone (20, actif) → reste 0 retiré ; commande annulée → 10 rendues ;
  - Playwright : gombo → servie et absent de l'accueil (« 1 demande ») ; ail 20 → 10 t ; Mes publications montre les deux.

## Astuces et petits tutoriels pour les nouveaux (22/10/2026) — `v3/astuces.js`
- **Signes sur l'accueil**, un seul par ouverture, le premier pas encore compris :
  1. le panier (logo, en haut à gauche) glisse de gauche à droite, avec la bulle « Touchez le panier : c'est le menu » (s'arrête dès que le menu a été ouvert, sinon après 3 fois) ;
  2. la roue des produits (« Glissez le doigt sur le sac », 2 fois) ;
  3. les onglets Activité / Alertes (2 fois).
- **Tutoriels** (cartes, « Passer » toujours visible, « Ne plus montrer les tutoriels ») : ils s'affichent une fois, la première fois qu'apparaît
  un code (`[data-code-bloc]`), le choix du chauffeur (`[data-trf]`), la création d'une commande (`input[name=val]`), l'Espace chauffeur, ou « Proposer un prix ».
  Détection par MutationObserver : aucun autre module n'a été modifié.
- **Réglages → Aide pour débuter** : interrupteur « Astuces et tutoriels » (le rallumer remet tout à zéro, comme pour un nouveau) et boutons « Revoir un tutoriel ».
- Tout reste sur le téléphone (`mdg-astuces:off`, `mdg-astuces:vu`). Mouvement réduit : pas d'animation, seulement la bulle.
- Les textes décrivent ce que l'app fait vraiment : à mettre à jour si le parcours des codes ou du transport change.

## Site web en maintenance (22/10/2026) — `maintenance.html`
- Le site (`index-v3.html`) n'est pas encore retravaillé : **tout le monde est envoyé vers l'application**.
  - `index.html` : téléphone → application (inchangé) ; ordinateur/tablette → `maintenance.html` (sauf l'administrateur reconnu → site).
  - `maintenance.html` : « Site web en maintenance — disponible uniquement sur l'application », bouton « Ouvrir l'application » (`application.dc.html?app=1`), redirection automatique au bout de 8 s (« Rester sur cette page » l'arrête).
  - `application.dc.html` ne renvoie plus les ordinateurs vers le site : l'application s'ouvre aussi sur PC (cadre de téléphone).
- **Entrée de l'administrateur** : petit point jaune qui pulse doucement (10 px), en bas à droite de `maintenance.html` → interrupteur « Entrer en tant qu'admin » → `index-v3.html?admin=1`.
  Le site reste caché sous un écran « Espace administrateur » (numéro + code secret seulement : pas de création de compte ni de « code oublié ») tant que le serveur n'a pas confirmé `est_admin` pour le compte connecté (vérifié à chaque ouverture). Un compte non admin est renvoyé à la maintenance.
  Le drapeau `mdg-site:admin` (localStorage) ne sert qu'à l'aiguillage ; la décision vient toujours du serveur. `admin.html` garde sa propre protection.
- Pour rouvrir le site à tous : retirer le bloc « SITE EN MAINTENANCE » en tête d'`index-v3.html`, le cache `#mdgGarde` et sa vérification (après `v3/nuage.js`), et remettre `index-v3.html` dans `index.html`.

## Roue de l'accueil : la bulle d'activité (22/10/2026) — schéma 53
- `produits_activite()` (SECURITY DEFINER, ouverte à anon) : par produit, chiffres agrégés seulement (ventes conclues 14 j + dernière, demandes publiées 14 j + dernière, négociations ouvertes actives 7 j, forte demande posée par l'équipe). Aucun nom, numéro, prix ni ville.
- `application.dc.html` (`tendVeille`, `tendMsg`, `tendCharger`) : quand un produit s'arrête devant soi sur la roue (onglet Marché), une bulle sort de derrière le sac pendant 5 s puis repart ; elle revient à chaque retour sur le produit. Données relues au plus toutes les 5 min (cache `mdg-app:tendance`).
- Messages, par ordre : « Très vendu » (≥ 3 ventes en 2 semaines) · « Très demandé » (≥ 3 demandes) · « Forte demande » (équipe) · « Vendu il y a … » · « N négociations en cours » · « Demandé il y a … ». Rien à dire → pas de bulle (jamais de chiffre inventé).

## Bandeau de l'accueil : garanties + fonctions utiles (22/10/2026) — `app/garanties.js`
- La bande fine (« Ni liens, ni arnaques au code ») fait aussi connaître les fonctions utiles, dans le même style (icône maïs, mot clé en accent) :
  L'année du marché · Prix par zone · Le réseau · Suivi de commande · Code secret (ouvre le tutoriel) · Achats groupés · Alertes produits · Espace chauffeur.
- Une garantie touchée ouvre la feuille « Pourquoi le Marché de Gros » ; une fonction touchée ouvre directement la fonction (module pas encore chargé → la feuille).
- Garanties et fonctions alternent ; 14 phrases, une toutes les 4,2 s. N'ajouter que ce que l'application fait déjà.

## Sur ordinateur : application réservée à l'admin, QR code, barre Mobile / Site (22/10/2026)
- `application.dc.html` sur PC/tablette : seul l'administrateur (drapeau `mdg-site:admin`, posé après `est_admin`) l'ouvre ; les autres → `maintenance.html`. Téléphone : inchangé.
- `maintenance.html` sur PC : pas de redirection ; « Ouvrir l'application » montre « Prenez votre téléphone » avec un **QR code** (vendor/qrcode-generator-1.4.4.js, MIT, fabriqué sur place à partir de l'adresse de la page) et le lien à taper/copier. Téléphone ou admin : redirection après 8 s comme avant.
- `app/admin-pc.js` : barre « Admin · 📱 Mobile | 🖥️ Site » en haut à droite, sur PC, pour l'admin seulement ; revérifie `est_admin` au serveur (sinon : barre retirée, drapeau effacé, l'application quitte le PC). Sur le site, elle apparaît après la vérification de l'écran admin.
- Le drapeau n'est qu'un aiguillage : l'application elle-même est publique (la même sur téléphone) ; le site et admin.html restent protégés par le serveur.
- **Correctif (22/10/2026)** : l'interrupteur admin semblait « recharger la page sans rien faire ». Cause : le souvenir d'onglet `mdg-app` (posé par un ancien « Ouvrir l'application ») faisait rebondir index-v3 → application → maintenance. Désormais `?admin=1` (et la vérification en cours) efface ce souvenir et reste sur l'écran de connexion ; l'interrupteur et l'application sur PC l'effacent aussi.

## Relevé et bon PDF : tampon rouge du Marché de Gros (22/10/2026) — `v3/releve.js`, schéma 54
- Tampon rond rouge (SVG, imprimé en couleur) en bas du bon de transaction et du relevé : « MARCHÉ DE GROS · CÔTE D'IVOIRE », au centre VENDU / ACHETÉ (accord conclu), LIVRÉ (commande terminée = réception confirmée) ou ANNULÉ ; la date ; le n° du bon. Relevé : « RELEVÉ », date d'établissement, nombre de ventes et d'achats.
- **Jamais « PAYÉ »** : l'application ne voit pas l'argent (paiement à la livraison, hors application).
- `mes_transactions2()` (schéma 54) = `mes_transactions` + départ, destination, n° et état de la commande, date de livraison. Le bon et le relevé (colonnes Trajet et Livraison) les affichent. Repli automatique sur `mes_transactions` si besoin.
- Impression : page blanche forcée (`color-scheme: light` à l'impression, sinon les marges sortaient foncées).

## Fil public « Dernières annonces » + défilement sans flash (22/10/2026) — schéma 55
- Le fil (Accueil → Activité) est visible par tout le monde, partout, sans compte : offres, demandes, et maintenant **ventes conclues** (`ventes_recentes()`, anonymes : produit, quantité, ville, date ; 30 derniers jours). Toucher une ligne ouvre la fiche du produit ; écrire, négocier ou publier demandent la connexion (puis l'action reprend).
- « En cours » n'apparaît que pour une personne connectée (sans compte : la section n'existe pas).
- Défilement au doigt : les lignes ne « flashent » plus (l'effet d'appui attend 0,12 s sur écran tactile, plus de voile gris d'iOS).
- Tournée de toutes les pages et fenêtres (visiteur et connecté) : aucune erreur.

## Le nom d'une annonce = le nom du compte, impossible d'en mettre un autre (22/10/2026) — schéma 56
- Formulaires Offre, Demande et Recherche : plus de champ « Votre nom » / « Votre contact » / « Nom du producteur » / « Votre nom (agent terrain) ». À la place, en lecture seule : « Nom affiché : Lévis K. — c'est le nom de votre compte (Mon compte → Profil) ».
- Serveur (`annonce_nom_compte`, avant chaque écriture sur offres/demandes) : `seller_name` / `buyer_name` = `nom_public(user_id)` quoi que le téléphone envoie ; `agent` (mode « Pour un producteur ») = ce même nom. Compte admin : « Marché de Gros » (inchangé).
- Changement de nom dans le profil → ses annonces suivent (`profils_nom_annonces`).
- Annonces existantes corrigées : « Coopérative gg », « Levi 02 », « Ttt » → « Lévis ».
- Inclut aussi « En cours seulement connecté », arrivé trop tard pour la PR #152.

## Séquestre, libération et refus de la marchandise (22/10/2026) — schéma 57
Demandé par le propriétaire (notes vocales) : l'argent bloqué chez un partenaire (Wave, Orange Money, MTN MoMo) dès la commande confirmée ; l'acheteur libère après vérification ; à la libération, le vendeur reçoit sa part moins 3,5 %, le transporteur la sienne moins 6,9 % ; le Marché de Gros n'est payé qu'à la libération.
- **Aucun partenaire n'est connecté** : rien n'est bloqué, prélevé ni versé. Une ligne `sequestres` ne naît que par `sequestre_depot_confirme()` (réservée au rôle service : la future fonction Edge vérifiera la notification signée du partenaire et le montant exact). Sans elle, l'application dit « Paiement sécurisé : bientôt » et « paiement à la livraison, hors application ».
- **Ce qui marche dès maintenant** :
  - après la réception, l'acheteur a 48 h : « Tout est conforme » (`commande_liberer`) ou « Refuser la marchandise (photos) » (`commande_refuser` : quantité refusée, motif, 1 à 4 photos dans l'espace privé « preuves ») ; sans réponse, clôture automatique (`sequestre_liberer_echus`, pg_cron toutes les 15 min) ;
  - refus : le chauffeur répond dans son Espace chauffeur (`commande_refus_chauffeur`), le vendeur dans sa commande (`commande_refus_vendeur`). Le refus s'applique **sans l'équipe** si le chauffeur confirme (et qu'il n'a pas été choisi par l'acheteur) ou si le vendeur reconnaît. Sinon l'équipe tranche (`admin_refus_trancher`, quantité retenue, 0 = refus rejeté) ;
  - partie refusée → rendue à l'acheteur (`montant_refuse`) ; le reste → vendeur ; **le transport reste dû** (le chauffeur a fait son travail).
- **Commissions** : désormais « dues » à la libération seulement (avant : à la réception). Base vendeur = montant − partie refusée (refus total → commission annulée). Transport : dû à la libération, même si la marchandise est refusée.
- **Annulation** : inchangée — avant le chargement, seulement d'un commun accord (le vendeur doit accepter) ; après le chargement, impossible. L'acheteur ne peut donc jamais annuler seul une commande confirmée.
- **Code de transaction** = numéro de commande. L'équipe le tape dans admin → Commandes → « Retrouver une commande par son numéro » (`admin_commande_numero`) : accord conclu (prix, quantité, transport, conditions), répartition, historique complet. L'équipe ne lit pas les conversations (textes de l'application corrigés).
- **WhatsApp litiges** : emplacement prêt (`WA_LITIGES` en haut de `v3/commandes.js`, vide = « bientôt »). Mettre le numéro officiel au format international sans « + » (ex. 2250700000000).
- Historique : les événements du séquestre (`sequestre_journal`, intouchable) s'ajoutent à `commande_journal` sous le préfixe `sq_`.
- Notifications (`pousser` v16) : refus → vendeur et chauffeur inscrit prévenus ; clôture → « Commande clôturée ».
- Testé sur la base (transaction annulée) : dépôt refusé à un membre et à un mauvais montant ; libération 8 000 F → vendeur 5 790 F, transporteur 1 862 F, Marché de Gros 348 F ; refus partiel 4/10 confirmé par le chauffeur → 2 400 F à l'acheteur, commission vendeur 126 F ; refus total avec chauffeur choisi par l'acheteur → attend le vendeur ; clôture automatique après 49 h.

### Règles précisées par le propriétaire (22/10/2026) — schéma 58
- « Paiement à la livraison » reste écrit (c'est vrai) ; le séquestre est affiché « en construction ». Il protège le vendeur contre ceux qui font venir un camion puis refusent de payer.
- **Pas de libération automatique** : seul l'acheteur libère, quand il valide. Après 48 h sans réponse, la commande arrive dans la file de l'équipe (« Reçue, l'acheteur n'a ni validé ni refusé ») : bouton « Libérer le paiement » (`admin_liberer`). La tâche `mdg-liberer-echus` est retirée.
- **L'acheteur ne peut plus annuler** une commande confirmée (le serveur refuse) ; seul le vendeur peut demander l'annulation avant le chargement, l'acheteur l'accepte ou non.
- **Refus à l'arrivée** (chauffeur arrivé) ou après la réception, tant que rien n'est libéré (`commande_refuser2`). L'ancienne `commande_refuser` demande de mettre l'application à jour.
- **Mot secret du vendeur** : tiré au hasard à la confirmation (ex. « AVOCAT 70 »), visible seulement par le vendeur (et l'équipe). Il l'écrit sur un papier glissé dans la marchandise. Au refus, l'acheteur le tape (5 essais) et photographie le papier ; ou coche « pas de papier » (l'équipe jugera).
- **Chauffeur** : sa confirmation ne compte seule que s'il est intégré (inscrit ET vérifié par l'équipe) et que le mot a été retrouvé. Sinon l'équipe juge.
- **Discussion à trois** (acheteur, vendeur, Marché de Gros) pendant le litige : `litige_messages`, `litige_messages_lire`, `litige_ecrire` (mêmes interdits que les autres messages : pas de numéro, pas de lien). L'équipe répond depuis admin → Commandes → « Discussion ». Notification à chaque message (`pousser` v17). Une partie de la commande écrit toujours sous son rôle, même si son compte est administrateur.

## Le tableau du marché, façon Binance P2P (22/10/2026) — schéma 59, `v3/tableau.js`
- Nouvel onglet **Prix** sur l'accueil (Marché · Prix · Activité · Alertes). Visible sans compte. J'ai / Je cherche restent sur l'onglet Marché seulement.
- Vue d'ensemble (`tableau_produits`) : un produit par ligne, « dès X F » (meilleure offre) et « jusqu'à Y F » (meilleur budget), dans l'unité la plus courante ; filtre par zone.
- Un produit (`tableau_marche`) : onglets **Acheter** (offres, du moins cher au plus cher) et **Vendre** (demandes, du budget le plus haut au plus bas). À prix égal : transport compris d'abord (pour le vendeur : l'acheteur prend le transport), puis fiable, identité vérifiée, commandes honorées, le plus récent. Prix comparés seulement dans la même unité (puces « Prix par régime / par kg »). Badges : Meilleur prix, +X % plus cher, Officiel, ✓ vérifié, ★ fiable, note, commandes honorées.
- Relu toutes les 30 s (et au retour sur l'onglet) : une annonce qui gagne des places affiche « ↑ monte ».
- « Acheter » / « Vendre » ouvre la proposition de prix habituelle (`MDGNegoce.proposer`, connexion demandée si besoin). Aucun numéro ni contact : le Marché de Gros est le seul intermédiaire.

## Les échanges ne sont pas secrets : l'équipe lit tout pour juger (22/10/2026) — schéma 60
- Règle du propriétaire : « Il n'y a pas de conversation secrète. C'est notre plateforme, c'est nous qui mettons en relation. » L'équipe peut et doit lire les échanges pour juger.
- **Messages directs gardés 1 an** (`dm_duree` = 365 jours ; avant : effacés après 7 jours). Les messages effacés avant ce changement sont perdus. Place : ≈ 0,5 Ko par message, les 500 Mo gratuits tiennent environ un million de messages.
- **Admin → Commandes → numéro de commande** (ou bouton « Tout voir » sur une commande) : l'accord, la négociation complète (chaque prix proposé, chaque message), les messages directs entre l'acheteur et le vendeur, la discussion à trois, le mot secret, la répartition, l'historique.
- Les membres sont prévenus : Messages (« Les échanges ne sont pas secrets… gardés 1 an »), Réglages → Confidentialité, écrans de litige. Les textes « l'équipe ne lit pas vos conversations » sont retirés.
- Le numéro de téléphone reste caché aux autres membres (inchangé).

## Libération automatique sous 24 h, remboursement seulement avec preuves (22/10/2026) — schéma 61
- Remplace « pas de libération automatique » (schéma 58). L'acheteur libère quand il valide ; **sans réclamation, le paiement se libère tout seul 24 h après la réception** (`sequestre_liberer_echus`, pg_cron `mdg-liberer-echus` toutes les 15 min). L'acheteur voit l'heure exacte (« libéré automatiquement : 23 oct. à 15:58 »).
- **Pas de remboursement sans preuves réelles** : pour refuser, le mot secret du vendeur est obligatoire (plus d'option « pas de papier »), avec 1 à 4 photos. Sans papier : « Signaler un problème » (`commande_litige`, jusqu'à la libération) ; rien n'est rendu automatiquement, l'équipe juge avec tous les échanges.
- Un refus ou un problème signalé dans les 24 h arrête la libération automatique (la commande passe en litige).

## Aide mise à jour : tutoriels insistants et « Comment ça marche » (22/10/2026)
- `v3/astuces.js` : nouveaux tutoriels **mot** (vendeur, mot secret), **verifier** (acheteur, libérer / 24 h), **refus** (preuves réelles), **discussion** (à trois, rien n'est secret), **sequestre**, **prix** (onglet Prix). Ils sont « insistants » : ils reviennent (2 ou 3 fois, une fois par ouverture) tant que « J’ai compris » n'est pas touché à la dernière carte ; « Passer » ne compte pas comme compris. Tutoriels existants complétés (annulation impossible pour l'acheteur, 6,9 % du chauffeur, rien n'est secret). Nouveau signe sur l'accueil : « Nouveau : l’onglet Prix ».
- `v3/guide.js` (Comment ça marche) : nouvelles fiches L’onglet Prix, La commande et la livraison, Le paiement sécurisé, Un problème à la livraison, Vous êtes chauffeur ; Proposer un prix et Sécurité mises à jour.
- Pages d'info (`INFO` dans application.dc.html) : Comment ça marche (6 étapes), Aide producteur (mot secret, paiement), Confiance (identité vérifiée, rien n'est secret). Correctif : leurs icônes étaient vides (nom « chercher:vous » inconnu) — elles s'affichent maintenant.

## Procédure admin : traiter un litige (22/10/2026) — `docs/traiter-un-litige-admin.pdf`
- 4 pages, pour les administrateurs : on ne discute pas, on vérifie des preuves. Où tout trouver dans admin → Commandes ; cas A (refus avec mot + photos), B (problème sans papier), C (problème pendant le transport) ; questions dans l'ordre, tableau de décision, messages prêts à copier dans la discussion à trois, suites (avertissement, bannissement en cas de fraude).
- Rappel : « Clore : annulée » rend tout à l'acheteur, transport compris ; pour une marchandise livrée mais abîmée, passer par le refus.

## Design : arrivée du camion et onglet Prix en mode sombre (22/10/2026)
- Commande : à l'arrivée, le camion s'arrête entièrement visible devant un repère jaune (lieu de livraison), avec l'étiquette « ✓ Arrivé · À destination » puis « ✓ Colis livré · Chez l'acheteur » (petite apparition animée, coupée si le téléphone réduit les animations). Pendant le trajet, le repère est grisé.
- Boutons plus courts : « Refuser la marchandise », « Pas de papier ? Signaler un problème ».
- Onglet Prix, mode sombre : titres, message « Aucune offre », onglets Acheter / Vendre, boutons, badges et prix lisibles (vert clair et corail sur fond sombre). Un produit s'ouvre sur l'onglet qui a des annonces quand l'autre est vide.
- Onglet Prix : changer de zone ne vide plus la liste (plus d'éclair blanc en mode sombre) : l'ancienne liste reste affichée, estompée, le temps du chargement ; les cases de chargement sont neutres, lisibles en clair comme en sombre.

## Un tutoriel à l'entrée de chaque écran (22/10/2026) — `v3/astuces.js`
- Demandé : « quand on rentre dedans, un tuto explicatif propre », partout. 2 ou 3 cartes, montrées 2 fois au plus (une fois par ouverture) tant que « J’ai compris » n'est pas touché.
- Pages (reconnues par leur adresse) : Acheter, Vendre, Demander, Le réseau (carte), Catégories, Prix du marché, L’année du marché, fiche produit, Mes publications.
- Fenêtres : Mon compte, Mes négociations, Messages, Message à tous (admin), Mon profil public, Les mieux notés, Alertes produits, Mes commandes, Vérifier son identité.
- Tableau de bord admin (admin.html charge maintenant astuces.js) : aperçu, Commandes et litiges, Identités.
- Menu : « Messages » dit « Gardés 1 an · lisibles par l’équipe » (avant : « Effacés après 365 jours »).

## Nom de l'application : « Marché de Gros » (22/10/2026)
- iPhone : les notifications d'une application web affichent « from <nom de l'application> » ; c'est l'iPhone qui l'ajoute, on ne peut pas l'enlever. Le nom passe de « MGCI » à « Marché de Gros » (manifest.webmanifest : name et short_name ; apple-mobile-web-app-title).
- Pour que le nouveau nom s'applique, il faut retirer l'icône de l'écran d'accueil et la rajouter (Partager → Sur l'écran d'accueil), puis réactiver les notifications.
## Barre du haut libérée, accroches dans la bande (22/10/2026) — `v3/souffle.js`, `app/garanties.js`
- Barre du haut : plus aucune phrase défilante. Seul le nom « marché de Gros » s'écrit, reste 5 s, puis s'efface ; il revient à chaque retour sur l'application (au moins 20 s après la dernière fois) et toutes les 30 minutes.
- Toutes les accroches sont dans la bande sous le titre, même design (icône maïs, mot clé en accent), 25 phrases qui alternent garanties, nouveautés et fonctions : onglet Prix, mot secret, payé sous 24 h, pas de remboursement sans preuves, séquestre bientôt, litiges jugés sur preuves, vendez en direct, achetez en gros, coopératives vérifiées, du champ au marché… Toucher une phrase ouvre la fonction ou son tutoriel.

## Photos et nouveaux produits : surgelés, produits de rente, poissons séchés (22/10/2026)
- 15 photos envoyées par le propriétaire, posées par le script `tools/images/surgeles-rente.py` (même mise en forme que les lots précédents).
- 7 produits qui existaient déjà reçoivent leur photo : cacao en fèves, café en grains, noix de karité, noix de palme, poisson surgelé, viande de bœuf surgelée, poulet surgelé.
- **8 nouveaux produits au catalogue** (`v2/data.js`, demandé par le propriétaire), chacun dans sa famille :
  - Poissons : crevettes séchées, anchois séchés ;
  - Produits surgelés : maquereau surgelé, cuisses de dinde surgelées, dos de poulet surgelé, saucisses surgelées, tripes de bœuf surgelées, foie de bœuf surgelé.
  - Le catalogue passe de 162 à 170 produits. Aucune liste de produits côté base : rien à changer dans Supabase.
- Photos non utilisées : 2e anchois et 2e saucisses (doublons) ; cajou brut et panier de poissons (noix-de-cajou et poisson-seche ont déjà leur photo).
- `data.js?v=20261026d`, `marche-app.js?v=20261026d`, cache `mgci-v178` (les 7 premières photos sont parties avec la PR #164 ; les 8 nouveaux produits avec la suivante).

## L'aide : questions et réponses toutes prêtes, puis une personne (22/10/2026) — `v3/aide.js`
- Demandé par le propriétaire : des « pré-questions » et des « pré-réponses » pour tout ce qui est dans l'application ; pendant qu'on écrit, les questions s'affichent ; un toucher ouvre la réponse ; si rien n'aide, « Je veux parler à une personne » et l'équipe reçoit une notification.
- **76 questions et réponses** en 11 thèmes (débuter, vendre, acheter, négocier, commande et transport, paiement, problème et litige, confiance et sécurité, prix/carte/saisons, chauffeurs, l'application). Les réponses reprennent les règles réelles (mêmes textes que `v3/guide.js` et `v3/astuces.js`). **Une règle change ? Mettre la réponse à jour dans `QR` (v3/aide.js).**
- Recherche sur le téléphone, sans serveur : sans accents, débuts de mots, une faute de frappe tolérée, mots de tous les jours dans le champ « mots » de chaque question (argent, pourri, arnaque, camion, whatsapp…). Les questions les plus posées sont légèrement favorisées.
- Une réponse peut avoir un bouton qui emmène au bon endroit (« Ouvrir mes commandes », « Publier une offre »…), et « Ça vous a aidé ? Oui / Non ».
- « Écrire au Marché de Gros » (menu, Mon compte, Messages, guide) ouvre d'abord l'aide (`MDGMessages.ecrireMarche()` ; `{ direct: true }` pour la conversation tout de suite). L'administrateur garde « Message à tous ».
- « Je veux parler à une personne » : la personne écrit ou garde sa question, puis touche « Envoyer à l'équipe ». `MDGMessages.parlerPersonne(texte)` envoie dans la conversation avec le Marché de Gros : « 🙋 Je veux parler à une personne. » + la question. L'administrateur reçoit la notification habituelle des messages (push_dm → pousser), avec le nom du membre en titre. Rien ne part sans ce toucher. Sans compte : on demande de se connecter.
- Dans la conversation avec le Marché de Gros, pendant qu'on écrit, jusqu'à 3 « Réponses toutes prêtes » s'affichent au-dessus de la case ; un toucher ouvre la réponse.
- Tutoriel « L'aide » (3 cartes, montré 2 fois) ; le guide renvoie à l'aide. Aucun changement Supabase.
- **Correctif (retour du propriétaire, capture du 22/10 à 21 h 27)** : en ouvrant la conversation avec le Marché de Gros depuis la liste des Messages ou une notification, on arrivait directement dans la discussion, sans aide visible. Désormais, une **rangée d'aide toujours visible** au-dessus de la case : « 💡 Aide » (ouvre l'aide avec le texte déjà tapé) + les questions les plus posées ; pendant la frappe, elles laissent la place aux réponses qui correspondent (en jaune). La rangée défile de gauche à droite. `MDGAide.frequentes(n)`. Cache `mgci-v180`.

## La cloche se calme une fois touchée (22/10/2026)
- Retour du propriétaire : après avoir touché la cloche et vu le message, le « 1 » restait et la cloche continuait de se balancer. Cause : la cloche comptait les notifications « non lues », et une notification ne passait en lue que si on la touchait une par une (ou « Tout marquer comme lu »).
- Désormais, un toucher sur la cloche = « vu » : l'heure est retenue sur le téléphone (`mdg-cloche:vu`). La pastille et le balancement ne reviennent que pour une notification ou un message arrivé **après** (`MDGMessages.unreadDepuis(ts)` pour les messages). Les notifications gardent leur état « non lu » dans leur liste. Cache `mgci-v181`.

## « Suivre la commande » ne se ferme plus tout seul + transporteur du réseau en pause (22/10/2026) — schéma 62
- **Défaut corrigé** : la fenêtre des commandes se relit toute seule toutes les 20 s. Elle redessinait « Mes commandes » par-dessus le formulaire ouvert : en choisissant qui transporte, on était renvoyé à la liste. Même risque pour « Refuser la marchandise » (photos) et les écrans de confirmation. Désormais, la relecture met les données à jour mais ne redessine pas un formulaire ouvert (`dernierEcran` = 'creer' ou 'geste'). Vérifié : formulaire toujours là après 22 s, choix gardé.
- **Transporteur du réseau Marché de Gros en pause** (demande du propriétaire : pas encore de transporteurs) :
  - formulaire : l'option reste visible, grisée « Bientôt », impossible à choisir (`RESEAU_OUVERT = false` dans `v3/commandes.js`) ;
  - serveur (schéma 62) : déclencheur `commandes_reseau_pause` qui refuse une nouvelle commande en mode « reseau » (même depuis une ancienne version) ; vérifié dans une transaction annulée ;
  - tutoriel « Créer la commande » et aide : textes mis à jour (« arrive bientôt »).
  - L'Espace chauffeur reste ouvert : c'est là que de vrais transporteurs s'inscriront. Au 22/10 : 0 transporteur, aucune commande « reseau ».
  - **Pour rouvrir** : `RESEAU_OUVERT = true` dans `v3/commandes.js`, `create or replace function public._transport_reseau_ouvert() … select true`, et remettre les textes du tutoriel et de l'aide.
- Cache `mgci-v182`.

## Design : le sac devient l'unique héros, entrée et notifications refaites (22/10/2026)
- Demande du propriétaire : « l'entrée doit être en harmonie, notre logo phare c'est le sac ; le sac plus poussé ; des animations comme une vraie app ; enlever tout ce qui fait IA ; l'app sera présentée aux investisseurs ; toutes les notifications de fond en comble ».
- **Le sac v2** (`app/sac.js`, même API) : volume (lumière à gauche, ombre au fond), revers plié en deux tons, couture et fils, vrais produits (tomate, épi de maïs, mangue, plantain) à la place des ronds de couleur ; regard vivant (clignement partout, regard qui cherche en attente, « non » de la tête quand il est triste), respiration au repos. Option `simple` (ou taille < 44 px) : sans texture, pour l'en-tête et les notifications. `MDGSac.saluer()` : le sac de l'en-tête fait un petit saut à chaque réussite.
- **Écran d'ouverture** : le même sac (humeur plein) arrive, les produits tombent, il encaisse et saute, puis « marché / de Gros » s'écrit. Dessin mis en cache (`this._spl`) : avant, chaque rendu regénérait le SVG et la scène repartait de zéro, le nom n'apparaissait jamais. L'écran reste ≥ 2,4 s.
- **Porte de connexion** (`v3/porte.js`, application) : la scène « deux mondes » (champ, étals, arche) est remplacée par le sac sous une lumière chaude. Son humeur suit le formulaire : repos → vide ; saisie → il se redresse ; envoi → il se remplit ; réussite → plein, saut ; erreur → triste ; hors connexion → ficelé. Feuille de style à part (`psSacCss`) : `psCss` est déjà posée par `<mdg-marche>` (fond de l'accueil, inchangé). Le site garde la scène animée.
- **Entrer / sortir** : à la connexion, le sac se remplit, saute, puis on avance dans son ouverture jusqu'à y entrer (lumière maïs, « Vous êtes dans le marché. ») ; à la déconnexion, il se ficelle (« À bientôt au marché. »). Mouvement réduit : rien.
- **Notifications dans l'app** (`app/toast.js`) : le sac v2 en 36 px (visage lisible) ; une erreur technique (réseau, session, délai, fonction manquante, refus du serveur) devient une phrase et un conseil (`lisible()`), le texte brut ne s'affiche plus ; les titres courts n'ont plus de point final ; une réussite fait saluer le sac de l'en-tête.
- **Notifications poussées** (`pousser` v18, déployée) : plus d'emoji dans les titres, plus de tirets longs dans les corps, le conseil « Transporteurs vérifiés » (option en pause, schéma 62) remplacé par « Suivez la livraison ».
- Vérifié dans le navigateur, clair et sombre : ouverture (mesure image par image), porte dans ses 6 états, 5 humeurs du sac, 6 notifications, entrée et sortie. Cache `mgci-v183`.

## Design mûr : plus d'étiquettes en capitales, icônes dans les tutoriels, Mon compte allégé, sombre corrigé (22/10/2026)
- Le propriétaire a donné carte blanche (« fais ce que tu veux », référence : une app métier au design calme, cartes au contrat identique, hiérarchie par le poids et non par la taille, bordures fines). Audit des 24 écrans en clair et en sombre.
- **Étiquettes de section** : les capitales espacées (« CE QUE L'ACHETEUR VERRA », « CALENDRIER DES RÉCOLTES », « LE CATALOGUE DU MARCHÉ DE GROS », « APPARENCE »…) sont le premier signe de « généré ». Toutes passent en phrase, 13 px, 600, couleur discrète : classe `.lab` (`.lab-d` sur fond sombre) dans `css/mgci-app.css` pour le gabarit ; 20 règles CSS converties dans les modules (guide, aide, compte, négoce, réputation, identité, racheter, appro, astuces, sons, réglages, prix, catégories, année). Gardées en capitales, voulues : les tampons d'urgence (`.qd`), les badges « Officiel », les labels de la roue de l'accueil (le seul endroit « fort »).
- **Tutoriels** (`v3/astuces.js`) : une icône de l'application (`PICTO`, app/icones.js) remplace l'emoji en tête de chaque carte ; les emoji restent dans le code comme clé lisible.
- **Mon compte** : héros allégé (avatar 104 → 92 px, titre 24 px au lieu de 28, hauteur réduite).
- **Mode sombre** : le bouton secondaire « Publier une demande avec un budget » (Prix du marché) était illisible ; règle ajoutée dans `css/sombre.css`.
- Cache `mgci-v184`.

## Cartes, formulaires, sons, carte du réseau : finitions (22/10/2026)
- Audit avec des annonces d'essai locales (localStorage `mdg-v2:offres` / `mdg-v2:demandes`, jamais envoyées) pour voir les cartes remplies.
- **Formulaires Vendre et Demander** : même étiquette de champ partout (`.f-lab`, 14 px, 600), mêmes marges (20 px), rythme de 8 px entre étiquette et champ ; l'aperçu « Ce que l'acheteur verra » perd sa grosse ombre pour le contrat des cartes (liseré fin + ombre légère).
- **Étiquettes** : la dernière en capitales espacées (« 4 OFFRES » dans Acheter) passe en phrase.
- **Sons** (`v3/sons.js`) : deux motifs de balafon accordés au sac : `entree` (trois notes qui montent, au moment où il saute dans la transition de connexion) et `sortie` (deux notes qui descendent, quand il se ficelle). Même réglage que les confirmations (Sons → Confirmations à l'écran).
- **Carte du réseau** : les lignes de la liste du panneau du bas prennent le liseré fin du contrat des cartes.
- Cache `mgci-v186`.

## Bulle sur les onglets de l'accueil + audit des écrans (22/10/2026)
- Retour du propriétaire : le « 2 » à côté d'« Activité » doit être une bulle au coin de l'onglet, comme une notification. Fait (`.acc-ong button .acc-n`, position absolue au coin ; terre cuite quand quelque chose vous attend, maïs quand c'est seulement en cours ; le mot se décale de 14 px pour laisser la place).
- **Audit automatique** (Playwright, 390 et 320 px, clair et sombre, 24 écrans, avec des annonces d'essai locales) : erreurs JS, débordements horizontaux, cibles trop petites, textes coupés. Résultat : aucun débordement réel (les dépassements trouvés sont tous coupés par des points de suspension dans leur conteneur), aucune erreur JS, aucune cible trop petite hors contrôles volontairement fins (barres des mois de l'année, interrupteurs).
- **Corrigé** : `v3/identite.js` plantait (`Cannot read properties of null`) si le serveur renvoyait une réponse vide au lieu du dossier ; on affiche maintenant « La vérification n'est pas encore disponible ». Le bouton final de Vendre disait « Publier l'offre » alors que partout ailleurs c'est « Publier mon offre » : unifié.
- Cache `mgci-v187`.

## La scène du marché, à l'entrée seulement (23/10/2026) — `app/scene.js`
- Première version montrée en vidéo au propriétaire, puis revue à sa demande : **plus de marché derrière la roue de l'accueil** (le fond d'avant revient tel quel) ; **à la connexion, ni sac ni écriture** : le marché s'exprime seul ; **le sac vient après une connexion réussie**, dans la transition « Bienvenue au marché. » (`entrer()`).
- **Le dessin** (SVG 400 × 190, écrit dans le code, aucune image empruntée) : le soir, ciel vert nuit qui chauffe à l'horizon, étoiles qui scintillent, un grand fromager et des hangars aux fenêtres allumées, des passants lointains immobiles ; deux étals éclairés : bâche terre cuite (une vendeuse assise en foulard maïs, tas de tomates, d'oignons, régime de plantain) et bâche verte au liseré maïs (un vendeur debout, sacs de jute ouverts de maïs, de riz, de haricots), ampoules qui brillent.
- **Les passants**, grands et en couleurs, marchent vraiment : jambes et bras qui se balancent depuis la hanche et l'épaule, le corps qui monte à chaque pas, une ombre au sol, chacun à son pas. Une femme porte une bassine émaillée de tomates sur la tête (pagne terre cuite à motifs maïs, foulard rouge) ; un homme pousse une brouette de sacs (bleu de travail, casquette verte, roue qui tourne) ; un jeune homme porte un sac sur l'épaule ; une femme tient son enfant par la main, un panier dans l'autre (pagne vert, foulard maïs) ; derrière eux, un camion de vivriers bâché, cabine verte au liseré maïs, passe lentement, phares allumés.
- Le bandeau de la connexion passe de 132 à 188 px (puis 224 px, voir plus bas) pour laisser le marché respirer (`.ng--porte`, `v3/nuage.js`). L'état du formulaire éclaire ou assombrit la scène.
- Mouvement réduit : tout est immobile, les passants posés dans la rue.
- Piège : ne jamais poser `transform-box` sur tout le dessin (les attributs `transform="…"` partiraient de travers) ; seuls les membres, les roues et les passants ont leur propre `transform-box`.
- **Deuxième retour du propriétaire** : le camion roule vite (14 s pour traverser, les marcheurs 26 à 38 s) et laisse de la poussière et un peu de fumée ; une tomate tombe de la bassine, rebondit et reste au sol ; aux deux étals, on discute les prix et on paie : une bulle à la fois, sur un cycle de 30 s (gauche : « La tomate, c'est combien ? » / « 350 F le kilo. » / « D'accord, je prends 50 kg. » ; droite : « Je paie à la livraison ? » / « Oui. Et le prix ne bouge plus jusqu'à la livraison. » / « Je commande sur Marché de Gros ! »), puis les billets passent de l'acheteur à la vendeuse. La phrase sur le prix décrit la règle d'un accord conclu dans l'application ; elle ne dit pas que le paiement passe par l'application (le séquestre n'est pas en service).
- **La fenêtre de connexion refaite** (`v3/nuage.js`, bloc « la porte ») : téléphone, un panneau qui monte du bas, pleine largeur, coins arrondis en haut ; la scène (224 px) se fond dans le formulaire par un dégradé, sans trait ; croix ronde posée sur la scène ; titre aligné à gauche ; champs sombres au liseré fin et anneau maïs au focus (l'anneau vert global de `css/mgci-app.css` est neutralisé dans ces champs) ; « +225 » séparé par un filet ; bouton plein maïs ; liens sans soulignement. Bureau (administrateur seulement) : deux colonnes, le marché entier calé en bas à gauche (`preserveAspectRatio="xMidYMax meet"`, classe `ps-large`), le ciel étoilé continue au-dessus.
- `app/nuit.js` : `.ng-bg` ajouté à `DEJA` — le mode nuit ne retraduit plus les couleurs de la connexion (c'était la cause du bouton « Se connecter » terne).
- **Le titre de la porte reprend le logo** (demande du propriétaire) : « Entrez dans le » (ou « Rejoignez le ») en petit, puis « marché **de Gros** » en grand — « marché » crème, « de Gros » maïs, gras italique (Jost 800 italique), comme `app/marque.js`. Animation en trois temps : la ligne d'appel monte, « marché » sort de son cache, « de Gros » s'écrit de gauche à droite puis un reflet clair le traverse une fois ; rejouée à chaque bascule connexion/inscription ; immobile en mouvement réduit. Les titres de contexte (publier, négocier, code oublié) restent du texte simple.
- **Le camion à la bonne taille** (retour du propriétaire : une femme était plus grande que le camion) : échelle 1,45 au lieu de 0,78, sur la ligne de sol 170 (un peu en retrait des passants, devant les étals). Il fait environ 1,4 fois la hauteur d'une personne, le chauffeur a une tête à la taille des passants. Il passe une seule fois par cycle de 30 s (6 s pour traverser, animation `mkV`), juste après le paiement à l'étal de gauche, pour ne cacher les gens qui parlent qu'un instant. Mouvement réduit : il n'est pas affiché.
- Cache `mgci-v192`.

## La livraison refaite : un plan, une fiche, l'image du produit (23/10/2026) — `v3/commandes.js`
- Demande du propriétaire, d'après une maquette d'application de livraison : en haut la carte avec une route en lacets, en dessous une fiche foncée ; à la place du carton, **le produit lui-même**.
- **En haut** (`.cm-hero`) : la vraie carte (`v3/suivi.js`, inchangée) quand le camion roule (chargement → arrivée) ; sinon un **plan dessiné** (`plan(c)`) : une petite ville, une route en lacets du départ à la livraison, le repère maïs de la livraison qui pulse, le marqueur rond vert à flèche maïs. Honnêteté : le plan ne montre aucune position — le marqueur est au départ tant que rien n'est chargé, à l'arrivée une fois livré ; une pastille le dit (« Plan · suivi par étapes », « Trajet prévu », « Livraison faite », « Commande annulée »).
- **La fiche** (`fiche(c, Jr)`, fond vert `#10392B`) monte sur le plan : numéro, puce d'état, **quatre temps** (Confirmée · Chargée · En route · Livrée, le temps en cours pulse), d'où vers où avec la date de création et celle de la réception ou de l'arrivée (sinon « Livraison à venir »), puis Produit, Quantité, Prix convenu, Total (maïs), Transport, Paiement ; à droite, **l'image détourée du produit** (`imgProduit(nom)` : nom ou alias du catalogue `MDG.products` → `v2/img/produit-<slug>.webp` si elle existe dans `MDGApp.SACK`, sinon le sac de l'application) ; en bas, la personne en face (initiales, « Vendeur » ou « Acheteur ») et un bouton maïs « Écrire » (`MDGMessages.ecrire`). Pas de bouton d'appel : l'application n'a pas le numéro du partenaire.
- La barre de progression et l'ancienne scène du camion sont retirées ; la liste détaillée des étapes avec leur heure reste en dessous. Le tableau du bas ne répète plus quantité, prix, total, départ et livraison.
- `app/nuit.js` : `.cm-fiche` et `.cm-plan` ajoutés à `DEJA` (ils gardent leurs couleurs en mode sombre).
- Cache `mgci-v193`.

## L'onglet Prix avec les images, et le prix du moment sous l'orbite (23/10/2026)
- **Onglet Prix** (`v3/tableau.js`) : chaque produit a sa vignette — le sac détouré (`v2/img/produit-<slug>.webp`, s'il existe dans `MDGApp.SACK`) qui dépasse de sa tuile teintée à la couleur du produit ; sans image propre, l'initiale du produit en gras italique sur la teinte de sa famille (pas la photo de famille : elle montrait des poivrons pour la carotte). Les lignes s'installent en cascade à la première apparition (ou après un changement de zone), pas à chaque relecture de 30 s ; le sac se soulève au toucher. Compteurs raccourcis (« 2 offres », « 1 demande »). La page d'un produit a aussi sa vignette à côté du titre.
- **Sous l'orbite de l'accueil** (`application.dc.html`, `prixMoment()`, styles `.acc-px` dans `css/mgci-app.css`) : le grand nom en gras (déjà écrit sur l'arc) est remplacé par **le prix du moment** — « MEILLEUR PRIX · LE SAC » puis « 12 500 F » en gras italique, le nombre défile d'un produit à l'autre (`mdg-nb`). Meilleure offre dans l'unité la plus courante ; sinon le meilleur budget des demandes ; sinon « Aucun prix publié » / « Publiez le premier prix ». Calculé sur les annonces affichées sur l'accueil, rien d'inventé.
- Cache `mgci-v194`.

## « Ici, chacun place son prix » : le pop-up du prix du moment (23/10/2026) — `app/prixmoment.js`
- Demande du propriétaire : en touchant le prix sous l'orbite, une information bien faite sur celui qui a publié, et une invitation à placer le sien, avec des flèches/triangles, pour faire comprendre que chacun place son prix.
- Sous l'orbite, le prix devient un bouton (`.acc-px`) ; deux petits triangles à côté (▲ vert, ▼ maïs) bougent doucement : le prix bouge, chacun place le sien.
- Le pop-up (fenêtre du bas, sombre) : l'image du produit, « TOMATE · LE SAC », titre « Ici, chacun *place son prix* » ; **l'échelle des prix** des vendeurs (même unité, du moins cher au plus cher, 4 au plus), le meilleur en tête avec « ▼ Meilleur prix » et **qui l'a publié** (initiales, nom, lieu, quantité disponible, depuis quand), les suivants avec leur écart en % ; une place libre en pointillé **« Votre prix ? »** avec un triangle qui pointe : « Proposez moins de 12 500 F le sac : votre offre passe en tête » ; **côté acheteurs**, le meilleur budget (▲). Boutons : « Placer mon prix » (formulaire Vendre avec le produit et l'unité), « Négocier avec Awa » (seulement pour une annonce d'un autre membre venue du serveur ; connexion demandée si besoin), et le lien inverse (« Vous achetez ? Placez votre budget »). Sans offre : la version budget ; sans rien : « Aucun prix pour l'instant, placez le premier ».
- Données : uniquement les annonces affichées sur l'accueil (`prixListes()` dans `application.dc.html`). « vous » marque les annonces de la personne.
- `app/nuit.js` : `.pm-bg` ajouté à `DEJA`. Cache `mgci-v195` (le fichier est ajouté au service worker).
- **Accord avec la bulle d'activité de l'orbite** (demande du propriétaire : « que tout se marie ») :
  - une seule règle de couleurs partout, celle des boutons « J'ai à vendre » (vert) / « Je cherche » (maïs) : **vendeurs, offres, « Acheter » = vert ▼ ; acheteurs, demandes, « Vendre » = maïs ▲**. Appliquée au pop-up (échelle, « Meilleur prix », « Votre prix ? », bouton « Placer mon prix » vert, « Placer mon budget » maïs), aux triangles sous le prix, et à l'onglet Prix (`v3/tableau.js` : « dès … » en vert, « jusqu'à … » en maïs, le bouton « Vendre » maïs au lieu de terre cuite) ;
  - la bulle (« Très vendu », « Demandé il y a… », `tendMsg()`) se retire quand le pop-up s'ouvre, et son information est reprise en tête du pop-up, dans le même style (icône ronde, titre coloré vert pour une vente, maïs pour une demande).
- Cache `mgci-v196`.

## La démo de la roue et des prix, et son tutoriel (23/10/2026) — `app/demo-orbite.js`
- Demande du propriétaire : un tutoriel sur le sélectionneur orbital, et un « switch démo » qui montre tout seul comment ça se fait.
- **Le switch « Démo »** : en haut à gauche de la roue, en face de « Tout » (petit interrupteur qui passe au maïs pendant la démo).
- **La démo pilote la vraie interface** (~20 s, 5 étapes, carte de commentaire en haut avec « Passer » et une barre d'avancement) : 1. la roue tourne deux fois (cercle de toucher sur la flèche), le prix défile ; 2. le prix est entouré, puis touché ; 3. le pop-up s'ouvre, l'échelle est entourée ; 4. « Votre prix ? » ; 5. « Placer mon prix ». À la fin, le pop-up se ferme, la roue revient au produit de départ, un message « À vous de placer votre prix ».
- Toucher l'écran, « Passer » ou le switch arrête tout. Si le produit n'a pas de prix, la démo avance jusqu'à 3 produits ; sinon le pop-up s'ouvre avec un **exemple marqué** « Exemple de démonstration : ces prix et ces noms ne sont pas réels » (`exemple: true` dans `MDGPrixMoment.ouvrir`).
- **Une fois automatiquement** : la première fois que l'accueil est libre (astuces actives, aucune bulle, fenêtre ou guide ouvert, pas de toucher depuis 4 s). Clé `mdg-demo:orbite` sur le téléphone.
- **Tutoriel en cartes** « La roue et les prix » ajouté aux astuces (`v3/astuces.js`, `TOURS.placer`) ; dans Réglages → Aide pour débuter, un bouton « ▶ Voir la démo : la roue et les prix » (`app/theme.js`) ramène à l'accueil et lance la démo.
- Cache `mgci-v197` (le fichier est ajouté au service worker).

## Les astuces, tutoriels et démos se règlent dans les Réglages (23/10/2026)
- Demande du propriétaire : tout ce qui apparaît à l'écran pour aider (astuces, tutoriels, démo) doit s'activer dans les paramètres, avec une fréquence.
- Réglages → **Aide pour débuter** :
  - « Astuces et tutoriels » (déjà là) : tout couper coupe aussi la démo automatique ; les choix ci-dessous ne s'affichent que si c'est activé.
  - **Fréquence** : « Une fois » (par défaut : chaque astuce, tutoriel et démo une seule fois) · « Chaque semaine » (tout revient une fois par semaine) · « À chaque ouverture ». `MDGAstuces.frequence()`, clés `mdg-aide:freq` et `mdg-aide:depuis` ; appliquée au chargement de `v3/astuces.js` (remet à zéro les astuces vues et la démo `mdg-demo:orbite`).
  - **Démo de la roue au démarrage** (oui par défaut, clé `mdg-demo:auto`).
  - **Bouton « Démo » sur l'accueil** (oui par défaut, clé `mdg-demo:bouton`, classe `html.dm-cache`) : caché, la démo reste lançable depuis les Réglages.
  - « ▶ Voir la démo » et « Revoir un tutoriel » restent en dessous.
- Tout reste sur le téléphone. Cache `mgci-v198`.

## Placer son prix dans les deux sens, et les bulles « qui a placé ce prix » (24/10/2026)
- Demande du propriétaire : tout le monde ne vient pas vendre ; les acheteurs placent aussi un prix (leur budget). Et sur la roue, un pop-up qui dit qui a placé le prix, d'où, combien — « deux pop-up, bien organisés, dans la logique de celui qui existe ».
- **Pop-up « Ici, chacun place son prix »** (`app/prixmoment.js`) : deux onglets, **▼ Vendeurs** (vert) et **▲ Acheteurs** (maïs). Chaque onglet : son échelle (prix du moins cher au plus cher / budgets du plus haut au plus bas, 4 au plus, écart en %), le meilleur en tête avec qui l'a placé (initiales, nom, lieu, quantité disponible ou recherchée, depuis quand), la place libre (« Vous vendez ? Votre prix » / « Vous achetez ? Votre budget »), une ligne qui rappelle l'autre côté avec « Voir › », et deux boutons : « Placer mon prix de vente » (vert) + « J'achète : négocier avec … », ou « Placer mon budget d'achat » (maïs) + « Je vends : proposer à … ». L'onglet ouvert d'abord : Vendeurs s'il y a des offres, sinon Acheteurs (`cote`).
- **Les bulles sur la roue** (`prixBulle()` dans `application.dc.html`, styles `.acc-tend.px-v` / `.px-a`) : dans la même file et le même style que la bulle d'activité, une à la fois : « Awa Koné vend à 12 500 F · Abobo · 40 sacs · il y a 2 h » (vert, initiales), puis « Restaurant Chez Tanti achète jusqu'à 11 000 F · Yopougon · 10 sacs · il y a 3 h » (maïs), puis « Très vendu… ». 4,2 s chacune ; la file repart quand on change de produit ; elle s'arrête si le pop-up est ouvert. « Vous » pour ses propres annonces.
- Données : uniquement les annonces affichées sur l'accueil. Cache `mgci-v199`.

## Le transport de l'acheteur ou du vendeur se passe sans code de chauffeur (24/10/2026) — schéma 63
- **Règle du propriétaire.** Quand l'acheteur ou le vendeur choisit lui-même son transporteur, ce transporteur n'a **rien à faire** sur la plateforme : ni inscription, ni code transporteur, ni codes à taper. La transaction se passe entre le vendeur et l'acheteur : le vendeur glisse son **mot secret** dans la marchandise (schéma 58), l'acheteur le retrouve et le **tape pour confirmer la réception**. Les codes (prise en charge, réception, code transporteur T-4K7P) restent réservés au **transporteur du réseau Marché de Gros**, celui que nous recommandons et avec qui nous traitons (aujourd'hui en pause, schéma 62).
- **Serveur** (`supabase/schema-63-transport-sans-code.sql`, appliqué et vérifié le 24/10) :
  - `commande_creer` : la validation suit le mode, quoi que demande le téléphone (`reseau` → `code`, sinon `declaration`) ;
  - `commande_avancer` : avec son propre transporteur, l'étape `reception` est refusée (`MOT_REQUIS`) — elle passe par la nouvelle fonction ;
  - `commande_reception_mot(p_id, p_mot, p_sans_mot, p_lat, p_lon, p_note)` : compare le mot (sans tenir compte des majuscules, accents, espaces : `_mot_norme`) ; journal « validé par code · Mot secret du vendeur retrouvé dans la marchandise ». Papier perdu : `p_sans_mot` → « Réception confirmée sans le mot secret du vendeur », visible des deux et de l'équipe. Pas de limite d'essais : confirmer la réception n'avantage pas l'acheteur.
  - Aucune commande existante n'utilisait l'ancien système (2 commandes, toutes deux sans code) : rien à convertir. `commande_choisir_transporteur` reste en place côté serveur, mais l'application ne la propose plus.
- **Application** (`v3/commandes.js`) : plus de choix « avec codes / sans code » à la création, plus de « le chauffeur doit créer un compte » ; une ligne explique la règle. Plus de case « code du chauffeur (T-4K7P) » dans la commande. « Réception confirmée » ouvre une case **Mot secret du vendeur** + « Je ne trouve pas le papier du vendeur ». Textes « que faire maintenant » et bloc du mot secret mis à jour (seulement pour son propre transporteur ; le réseau garde ses codes).
- Tutoriels, guide, aide et Espace chauffeur réécrits : les codes et l'inscription concernent le transporteur du réseau ; son propre transporteur n'a rien à faire.
- Pas touché : la fonction Edge `pousser` (v18). Ses rappels de codes ne partent que pour les commandes « avec codes » (donc le réseau). Un rappel du mot secret en notification pourra être ajouté plus tard (v19).
- Cache `mgci-v200`.

## Écrans stables : plus rien ne glisse de côté (23/10/2026) + PDF « l'application et son modèle économique »
- **Signalé par le propriétaire** (capture de « Suivre la commande » décalée vers la gauche) : certaines fenêtres bougeaient à gauche et à droite en défilant ou en tirant.
- **Cause mesurée** : les fenêtres posées par les modules (`.cm`, `.al`, `.ap`, `.gr`, `.pz`, `.rc`, `.rl`, `.rp`, `.snp`, `.pm`, `.gr-f`, `.ng`, `.ng-form`, `.nx-b`, `.nx-edf`, `.cp-main`…) avaient `overflow:auto`, donc elles défilaient aussi de côté dès qu'un élément dépassait. Dans la commande, l'image du produit (`.cm-prod`, `right:-26px`) dépassait de 8 px : la fenêtre glissait de 8 px.
- **Corrections** : `overflow-x:hidden;overflow-y:auto` sur toutes ces fenêtres (et `.dm-b`, `.idv-main`, `.rg`, `.tv-corps`) ; `.cm-prod` ramené dans la fiche (`right:-12px` / `-10px`) ; garde-fou dans `application.dc.html` : une zone qui défile de haut en bas n'est jamais déplacée de côté (`onAnyScroll` la remet à 0, le geste du doigt `tM` ne l'autorise pas). Les rangées faites pour glisser (filtres, photos, puces) restent libres.
- **Vérifié** (Playwright, gestes du doigt simulés) : avant, la fenêtre de commande glissait de 8 px ; après, 0 px de côté, le défilement vertical marche (654 px), la rangée de filtres de Prix glisse toujours. Audit de tous les écrans à 390 et 360 px : plus aucune zone ne défile dans les deux sens.
- Faute corrigée : « votre sécurité et celle de le vendeur » → « du vendeur ».
- **PDF** `docs/Marche-de-Gros-application-et-modele-economique.pdf` (11 pages) : l'application, puis le modèle économique (commission 3,5 % sur la vente, 6,9 % sur le transport du réseau ; payé seulement quand un achat est conclu), exemples chiffrés, grille de calcul (exemples, pas des prévisions), contournement, chiffres réels du 23/10 (4 comptes, 2 commandes, 63 000 F inscrits non encaissés), questions pour les professionnels.
- Cache `mgci-v201`.

## Lien de suivi : démarre dès l'ouverture, « le chauffeur a ouvert le lien », code court avec schéma (23/10/2026) — schéma 64
- Demande du propriétaire : le suivi doit être simple, sans code à retenir ni compte pour le chauffeur ; un code en secours, « avec un schéma d'explication, propre ».
- **Serveur** (`supabase/schema-64-suivi-code.sql`, appliqué et vérifié le 23/10, test dans une transaction annulée) :
  - `suivi_liens.code` (ex. `8DR-3T8`, 6 caractères parmi 31, sans 0/O/1/I/L, index unique) et `suivi_liens.ouvert_le` ; colonnes ajoutées, rien supprimé ; les liens actifs ont reçu un code ;
  - `suivi_lien_creer` donne un code à chaque lien ; `suivi_lien_etat` renvoie `ouvert_le` et `code` (le code seulement à celui qui transporte, comme le jeton) ;
  - `suivi_code_jeton(p_code)` (anon) : code → jeton, majuscules/espaces/tiret ignorés, seulement lien actif et commande en cours ;
  - `suivi_lien_ouvert(p_jeton)` (anon) : note la première ouverture.
- **Page du chauffeur** (`suivi.html`) : sans `?j=`, elle demande le code (saisie formatée K7P-492) ; avec le lien ou le code, elle note l'ouverture et **lance le partage tout de suite** (le téléphone demande seulement l'autorisation). Le bouton reste pour relancer après un refus. `[hidden]` forcé (la ligne d'état restait visible).
- **Application** (`v3/commandes.js`, `blocLien`) : schéma en 3 étapes (1 il ouvre le lien ou tape le code, 2 il accepte la position, 3 vous suivez le camion ici) ; « Envoyer au chauffeur » (le message contient aussi l'adresse et le code de secours), « Copier le lien », puis « ou, au téléphone : il ouvre <adresse>/suivi.html et tape ce code » avec Copier ; état « 👀 Le chauffeur a ouvert le lien · il y a 2 min » avant la première position.
- Testé (Playwright) : code faux refusé, code tapé en minuscules accepté, ouverture notée, position envoyée sans toucher de bouton ; aucun débordement de la fenêtre.
- Cache `mgci-v202`.

## « Le camion est parti » : une étape à part, signalée par le vendeur ou détectée par le lien (23/10/2026) — schéma 65, pousser v19
- Règle du propriétaire : simple. Le chauffeur ouvre le lien (le code ne sert qu'en secours). S'il ne l'utilise pas, c'est le vendeur (ou celui qui s'occupe du transport) qui indique les étapes : « Chargement confirmé », puis « Le camion est parti ».
- **Serveur** (`supabase/schema-65-camion-parti.sql`, appliqué et vérifié le 23/10, tests dans des transactions annulées) :
  - `commande_avancer` : avec son propre transporteur, « chargement » reste à l'étape `chargement` (avant : passage automatique à `transport`) ; nouvelle étape `transport` = « Le camion est parti », par le vendeur ou par celui qui transporte (`r = mode_transport`), seulement depuis `chargement` ; l'arrivée et la réception sont acceptées dès `chargement` (si personne n'a signalé le départ, rien ne bloque). Réseau inchangé.
  - `commande_reception_mot` : acceptée dès `chargement`.
  - `suivi_lien_position` : départ **détecté** quand une position du lien est à 500 m ou plus du premier point reçu après le chargement → `transport`, journal « systeme / gps / Départ détecté par le lien de suivi du chauffeur ». Vérifié : 220 m → rien, 670 m → départ.
  - `push_commande` : le départ (personne ou détection) est notifié ; seul le passage automatique (`preuve = 'auto'`, réseau) reste muet.
- **pousser v19** (redéployée, réponses vérifiées : 401 sans clé, 404 « étape introuvable » avec clé) : « Chargement confirmé » (sans « transport en cours ») ; « X : le camion est parti » / « Le camion est parti · départ détecté par le lien de suivi du chauffeur ».
- **Application** (`v3/commandes.js`) : à « Chargée », bouton principal « 🚚 Le camion est parti » (vendeur ou transporteur) ; l'acheteur garde « Le chauffeur est arrivé » et « Réception confirmée » en secours (pas en principal) ; textes « que faire » ; étape `transport` affichée « Le camion est parti ». Aide, guide et tutoriel : « préparation, chargement, départ du camion, arrivée, réception ».
- Anciennes versions de l'application : elles montrent « Chargée » sans bouton de départ ; l'acheteur peut toujours signaler l'arrivée et confirmer la réception. Aucune commande en cours au moment du changement.
- Cache `mgci-v203`.

## Index par produit sur les offres et les demandes (23/10/2026) — schéma 69
- Trouvé par le test de charge (projet de test, 100 000 offres, 50 000 demandes) : `tableau_marche` et `prix_zones` filtrent par `product_slug`, mais aucun index n'existait sur cette colonne. Sous une rafale de 100 ouvertures, 3 erreurs 500 (délai dépassé dans `tableau_marche`) ; avec l'index, 0 erreur et p95 7,7 s → 3,9 s.
- **Serveur** (`supabase/schema-69-index-produit.sql`, appliqué le 23/10) : `offres_produit` et `demandes_produit` sur `(product_slug)`. Ajout seulement.
- Mesuré sur le test, machine au repos, 100 000 offres : `tableau_marche('mais')` 122 ms → 24 ms ; `prix_zones('mais')` 149 ms → 5 ms. (Sous charge pendant la simulation : 1 187 ms → 36 ms et 253 ms → 8,4 ms.)
- Vérifié sur la base réelle : réponses identiques avant et après pour les 6 produits présents (`tableau_marche` à l'identique ; `prix_zones` identique hors le champ `calcule_le`, l'heure du calcul).

## Signalements d'annonces : l'auteur est fixé par la base (23/10/2026) — schéma 66
- Faille critique trouvée à l'audit de sécurité : la table `signalements` acceptait un `user_id` choisi par le téléphone, même sans compte. Trois signalements avec trois faux `user_id` masquaient n'importe quelle annonce (masquage automatique à 3 comptes différents), et le vendeur ne pouvait plus la remettre en ligne.
- **Serveur** (`supabase/schema-66-signalements-auteur.sql`, appliqué le 23/10) : le téléphone ne peut plus écrire que `cible`, `cible_id`, `motif` ; l'auteur prend toujours `auth.uid()` (vide sans compte : un signalement sans compte ne compte pas pour le masquage, comme avant) ; la règle d'écriture refuse tout auteur différent du compte connecté. Aucun drop (`alter policy`, droits par colonne).
- Vérifié sur le projet de test puis sur la base réelle (transaction annulée) : sans compte → accepté, auteur vide ; faux auteur → refusé ; connecté → auteur = le compte ; connecté avec l'auteur d'un autre → refusé. La base réelle n'avait aucun signalement ni annonce masquée (faille jamais utilisée).
- Application inchangée (elle n'envoyait pas d'auteur). Reste à traiter (audit) : création de comptes sans preuve du numéro, qui permet de multiplier les comptes.

## Zones de forte demande : de nouveau visibles sans compte (23/10/2026) — schéma 67
- Bug trouvé par la simulation à 100 comptes : `GET /rest/v1/zones` sans compte renvoyait 401 (« permission denied for function est_admin ») à chaque fois. La règle de lecture appelait `est_admin()`, que le rôle anon ne peut pas exécuter : aucun visiteur sans compte ne voyait les zones de forte demande.
- **Serveur** (`supabase/schema-67-zones-visibles.sql`, appliqué le 23/10) : la règle « zones visibles par tous » ne garde que `expire_le > now()` ; nouvelle règle « admin voit toutes les zones » (connecté + `est_admin()`) pour les zones expirées. Aucun drop.
- Vérifié sur le projet de test puis sur la base réelle (transaction annulée, une zone valable et une expirée) : sans compte → 1 zone, membre → 1, admin → 2, aucune erreur.

## Messages avec un numéro ou un lien : le filtre ne plante plus (23/10/2026) — schéma 68
- Bug trouvé par la simulation à 100 comptes : le déclencheur `controle_sortie()` (avant chaque message privé `dm` et chaque message de négociation `messages`) plantait avec `record "new" has no field "negociation_id"` / `"discussion_id"` dès qu'un texte contenait un numéro ou un lien. Le membre voyait « problème technique », le masquage du numéro et l'alerte admin ne marchaient jamais. (Le filtre du téléphone limitait l'impact aux anciennes versions et aux appels directs.)
- **Serveur** (`supabase/schema-68-controle-sortie.sql`, appliqué le 23/10) : la référence (discussion ou négociation) est lue selon la table avec `to_jsonb(new)` ; le reste de la fonction est identique. `create or replace`, aucun drop.
- Vérifié : bug reproduit sur le projet de test avant correction ; après correction, sur le test puis sur la base réelle (transaction annulée, rien n'est resté) : message privé et message de négociation acceptés avec « [numéro masqué] », 2 alertes admin créées avec la bonne référence, message normal inchangé.

## Tableau du marché : les 50 meilleures annonces par unité, avec les vrais totaux (23/10/2026) — schéma 70
- Trouvé par le test de charge : `tableau_marche` renvoyait toutes les annonces actives d'un produit ; avec 3 334 offres, une réponse pesait 1,85 Mo, relue toutes les 30 s quand l'onglet Prix est ouvert (bande passante limitée à 5 Go/mois en gratuit).
- **Serveur** (`supabase/schema-70-marche-limite.sql`, appliqué le 23/10) : au plus 50 offres et 50 demandes **par unité**, même classement qu'avant ; la réputation n'est calculée que pour les annonces gardées (première coupe par prix et transport, ex æquo gardés) ; à égalité parfaite, l'ordre est fixé par l'identifiant (plus de faux « ↑ monte ») ; nouveau champ `totaux` (`{offres: {kg: n, …}, demandes: {…}}`). `create or replace`, même signature.
- **Application** (`v3/tableau.js`) : les compteurs « Acheter · N », « Vendre · N » et « Prix par kg · N » utilisent `totaux` (sinon la longueur de la liste, comme avant) ; sous une liste coupée : « Les 50 meilleures sur 3 334. Choisissez une zone pour affiner. » Nombres écrits « 3 334 ».
- Vérifié sur le projet de test (comparaison avec une copie de l'ancienne fonction) : 7 produits réels et générés, plus un cas fabriqué à 3 unités avec ex æquo à la 50e place → mêmes annonces, même classement, totaux exacts ; gros produit 1 852 805 → 37 960 octets, 1 055–3 054 ms → 102 ms. Base réelle : réponses identiques avant/après pour les 6 produits (toute la Côte d'Ivoire et Abidjan), hors le nouveau champ `totaux`. Navigateur (Playwright, iPhone) : 50 lignes, note affichée, totaux justes ; sans `totaux` (ancien serveur), comptage comme avant ; aucune erreur.
- Anciennes versions de l'application : elles comptent la liste reçue, donc au plus 50 par unité (seulement quand un produit dépasse 50 annonces dans une unité).
- Cache `mgci-v204`.

## Code de suivi du chauffeur : essais limités, tirage sûr (23/10/2026) — schéma 71
- Faille trouvée à l'audit : `suivi_code_jeton` (ouverte à tous, sans compte) n'avait aucune limite d'essais ; en essayant des codes à la chaîne on pouvait tomber sur un lien actif (adresse de livraison, envoi de fausses positions). `_suivi_code` utilisait `random()` (non cryptographique).
- **Serveur** (`supabase/schema-71-suivi-code-essais.sql`, appliqué le 23/10) :
  - au plus **10 codes faux par adresse internet et par quart d'heure**, et 500 pour tout le monde (attaque venue de nombreuses adresses) ; un code juste ne compte pas ; au-delà : `TROP_ESSAIS : Trop de codes essayés…` ;
  - l'adresse vient de l'en-tête `x-forwarded-for` transmis par Supabase (vérifié par un vrai appel HTTP sur le projet de test : le compteur va bien dans la case de l'adresse, pas dans « inconnue ») ;
  - compteurs dans `suivi_code_essais` (RLS, aucun accès direct) : **taille fixe**, 4 096 cases au plus (adresse hachée sur 12 bits) + le total, réutilisées à chaque quart d'heure → aucun nettoyage à prévoir ;
  - `_suivi_code` tire avec `gen_random_bytes` (octets ≥ 248 rejetés pour un tirage égal sur 31 caractères). Codes existants inchangés.
- **Page du chauffeur** (`suivi.html`) : l'erreur du serveur est lue ; « Trop de codes essayés. Réessayez dans quelques minutes, ou demandez le lien au vendeur. » au lieu de « Pas de connexion ».
- Vérifié : test (10 faux refusés, 11e bloqué même avec le bon code, autre adresse + bon code en minuscules → jeton ; 3 000 codes tirés : 31 caractères, 541 à 621 fois chacun pour 580 attendus) ; base réelle (transaction annulée, aucun compteur resté) ; navigateur iPhone : les 3 messages (trop d'essais, code faux, pas de réseau).
- Cache `mgci-v205`.

## Code de secours : les essais ratés sont enfin comptés (23/10/2026) — schéma 72
- Faille trouvée à l'audit : `reinitialiser_code` notait l'échec dans `secours_essais` puis levait une erreur, ce qui annulait la note (0 ligne en base) : la limite de 5 essais par heure ne servait à rien, le serveur calculait du bcrypt sans fin, et le temps de réponse révélait quels numéros ont un compte.
- **Serveur** (`supabase/schema-72-secours-essais.sql`, appliqué le 23/10) : `reinitialiser_code` n'est **pas** réécrite (elle contient une suppression des sessions que l'outil Supabase refuse de rejouer sans confirmation). Nouvelle porte `secours_reinitialiser(tel, cle, nouveau)` :
  - limites : 5 échecs par numéro et par heure (comptés pour de vrai), 20 par adresse internet et par heure (`secours_ip_essais`, taille fixe, 4 096 cases + le total), 300 par heure pour tout le monde ;
  - code de secours faux : échec noté, réponse vide (sans erreur, donc la note reste) ; code juste : appel de `reinitialiser_code` comme avant ;
  - même temps de réponse avec ou sans compte (calcul leurre).
- **Application** (`v3/nuage.js`, `recover`) : appelle `secours_reinitialiser` ; réponse vide → « Numéro ou code de secours incorrect. »
- **Étape restante après la fusion** : l'ancienne `reinitialiser_code` est encore ouverte aux téléphones pour que l'application déjà en ligne garde « Code oublié ». Une fois cette version en ligne, lancer `revoke execute on function public.reinitialiser_code(text, text, text) from public, anon, authenticated;` (dernière ligne du schéma 72, vérifiée sur le test et la base réelle).
- Vérifié : test (ancienne fonction refusée, 5 faux → réponse vide, 6e bloqué même avec le bon code, 5 échecs notés, une heure plus tard bon code → nouvelle clé et mot de passe changé, 21 ms sans compte / 20 ms avec ; vrai appel HTTP : échec bien noté, ancienne fonction → 401) ; base réelle (transaction annulée, rien n'est resté) ; navigateur iPhone : « Numéro ou code de secours incorrect. » sous le champ.
- `nuage.js?v=20261031b` (application, index-v3, admin), cache `mgci-v206`.

## La messagerie s'ouvre de nouveau à l'écran (23/10/2026)
- Bug trouvé par le test des boutons (1 079 clics, 74 écrans) : `app/demo-orbite.js` (la démo de l'accueil) créait au démarrage une feuille de style avec l'identifiant `dmCss` ; `v3/messages.js` n'ajoute ses styles que si `dmCss` n'existe pas → les styles de la messagerie n'étaient **jamais** chargés : la fenêtre était créée sous l'écran (haut à 844 px sur iPhone), invisible. Environ 14 boutons semblaient ne rien faire : Menu et Mon compte → Messages, Fiche produit → Écrire, Page vendeur → Écrire au vendeur, Admin → Message à tous, Aide → parler à une personne, la cloche, Alertes → Messages non lus, Négociation → Écrire / Continuer dans les messages, Mes commandes → Écrire, Profil public → Écrire, le toast « Voir ».
- **Correction** (`app/demo-orbite.js` seulement) : la démo a ses propres noms : feuille `demoCss`, classes `dm-hd` et `dm-ti` (au lieu de `dm-h` et `dm-t`, qui existent aussi dans la messagerie). La messagerie n'est pas modifiée.
- Vérifié (Playwright, iPhone) : avant, fenêtre à 844–1 688 px (hors écran) ; après, 0–844 px, en-tête stylé ; la démo de l'accueil s'affiche comme avant (titre, taille 16,5 px, carte visible) ; aucune erreur.
- `demo-orbite.js?v=20261031a`, cache `mgci-v207`.

## Petits boutons réparés après le test des boutons (23/10/2026)
- Trouvés par le test automatique (1 079 clics, 74 écrans, 5 profils) ; vérifiés avant/après dans le navigateur (iPhone simulé).
- **Mon compte** (`v3/compte.js`) : l'écouteur de défilement s'exécutait après la fermeture de la fenêtre → `TypeError … querySelector` à chaque sortie (Relevés, Commandes, Déconnexion…). Garde `if (!bg) return;`. Avant : 1 erreur sur 3 sorties ; après : 0.
- **Mon compte et Sécurité, ligne du numéro** : c'était un bouton sans action ; les lignes `info` sont maintenant un simple bloc de texte (`div`).
- **Carte en relief, « Me localiser »** (`app/carte-gl.js`) : position refusée ou indisponible → plus rien ne se passait ; maintenant le même message que la carte simple (« Position refusée : choisissez votre région », « Localisation indisponible… »).
- **Alertes produits, « Suivre »** (`v3/alertes.js`) : grisé tant qu'aucun produit n'est choisi (avant : le bouton ne faisait rien).
- Restent volontairement « Bientôt » : transport par le réseau, litiges WhatsApp, séquestre, bande d'accueil.
- `compte.js?v=20261031b`, `carte-gl.js?v=20261031a`, `alertes.js?v=20261031b`, cache `mgci-v208`.

## Annonces : la date de publication et l'auteur ne se modifient plus (23/10/2026) — schéma 73
- Faille trouvée à l'audit : un membre pouvait modifier `created_at` de ses offres et demandes (droit de modification sur toute la table) → remonter son annonce en tête des listes, ou la dater dans le futur. Même chose pour `id` et `user_id` (bloqués en partie par les règles, mais sans raison d'être modifiables).
- **Serveur** (`supabase/schema-73-annonce-date.sql`, appliqué le 23/10) : droit de modification redonné colonne par colonne à `authenticated`, sans `created_at`, `id`, `user_id`. L'application ne les envoie jamais (`toRow` dans `v3/nuage.js`), les fonctions du serveur ne sont pas concernées.
- Vérifié sur le test puis la base réelle (transaction annulée) : date → refusée, auteur → refusé ; prix, budget, retrait et envoi complet comme l'application (`on conflict (user_id, client_id)`) → acceptés.

## Photos du profil public : seulement celles du membre, dans le stockage de l'application (23/10/2026) — schéma 74
- Faille trouvée à l'audit : `profils.photos` acceptait n'importe quel lien https, et `v3/reputation.js` l'affichait tel quel → chaque visiteur du profil chargeait une image d'un site extérieur (traçage des visiteurs, images hors modération).
- **Serveur** (`supabase/schema-74-photos-profil.sql`, appliqué le 23/10) : déclencheur `profils_photos_propres` (avant écriture de `photos`) : ne garde que les chemins `<identifiant du compte>/<nom>.jpg` du membre lui-même (lettres, chiffres, `._-`), les 6 premiers valides ; liens extérieurs, chemins d'un autre compte et `../` retirés. Aucun profil réel n'avait de photo (rien retiré à personne).
- **Application** (`v3/reputation.js`) : `photoUrl` ne construit qu'une adresse du stockage `activites` ; un lien (`https:`, `//…`) n'est jamais affiché.
- Vérifié : test et base réelle (transaction annulée) — 11 entrées dont lien pisteur, `//cdn`, photo d'un autre compte, `../../x.jpg` → 6 photos valides gardées dans l'ordre ; navigateur : profil avec 2 photos + 2 liens extérieurs → 2 images du stockage, 0 requête vers un site extérieur.
- `reputation.js?v=20261031b`, cache `mgci-v209`.

## Alertes « nouvelle annonce » : au plus 10 par membre et par jour (23/10/2026) — schéma 75
- Faille trouvée à l'audit : chaque nouvelle offre ou demande prévient tous les abonnés du produit (`push_annonce` → `pousser`), sans plafond ; publier, retirer, republier en boucle inondait les téléphones des autres.
- **Serveur** (`supabase/schema-75-notif-annonces.sql`, appliqué le 23/10) : compteur `push_annonce_jour` (membre, jour UTC ; RLS, aucun accès direct) ; au-delà de 10 annonces dans la journée, l'annonce est publiée normalement mais sans alerte. Le reste de `push_annonce` est identique.
- Vérifié sur le test (transaction annulée, fausse adresse d'envoi dans le coffre, un abonné) : 12 annonces publiées → 10 envois préparés, compteur 12. Base réelle : fonction identique à celle testée (même empreinte), table protégée.
- Reste lié : la création de comptes sans preuve du numéro (plusieurs comptes = plusieurs plafonds) ; 3 annonces gratuites par compte non vérifié limitent déjà l'effet.

## Annonces : le téléphone ne retélécharge plus tout quand rien n'a changé (23/10/2026) — schéma 76
- Mesuré par le test de charge : toutes les 2 minutes, chaque téléphone ouvert retéléchargeait jusqu'à 500 offres et 500 demandes (≈ 506 Ko base pleine) même sans changement — premier poste de bande passante (5 Go/mois en gratuit).
- **Serveur** (`supabase/schema-76-annonces-version.sql`, appliqué le 23/10) : colonne `maj_le` sur `offres` et `demandes` (index), toujours fixée par la base (déclencheurs `offres_maj_le` / `demandes_maj_le`, à l'insertion et à la modification, `clock_timestamp()` ; une date envoyée par le téléphone est ignorée) ; `annonces_version()` (anon) → « nb actives | dernière écriture » pour chaque table (47 caractères, 21 ms avec 100 000 offres).
- **Application** (`v3/nuage.js`, `refresh`) : demande d'abord `annonces_version` ; si le résumé est le même que lors de la dernière lecture et que les listes sont en cache, elle ne retélécharge rien (les zones restent relues). Sinon, lecture complète comme avant, et le résumé est gardé (`mdg-nuage:version`).
- Vérifié : test (sans changement → identique ; prix modifié, annonce retirée, nouvelle annonce → change ; date future envoyée par le téléphone → ignorée) ; base réelle (transaction annulée : anon lit le résumé, il change après une modification) ; navigateur : ouverture → résumé + listes ; rien de neuf → résumé seul ; publication → listes ; cache effacé → listes ; aucune erreur.
- `nuage.js?v=20261031c`, cache `mgci-v210`.

## Notes : chaque auteur ne compte qu'une fois par personne notée (23/10/2026) — schéma 77
- Faille trouvée à l'audit : un même acheteur (ou un faux compte) gonflait la note d'un vendeur en laissant un avis à chaque commande. Choix du propriétaire (sans dépense) : « un avis par personne » (pas « vérifiés seulement » : 0 compte vérifié au 23/10).
- **Serveur** (`supabase/schema-77-avis-une-fois.sql`, appliqué le 23/10) : `_avis_uniques()` (interne) = l'avis le plus récent de chaque (auteur, personne notée) ; `notes_publiques`, `mieux_notes`, `statuts_publics` l'utilisent ; `reputation_publique` : un avis par auteur et par rôle (critère « fiable » : 3 avis **de personnes différentes**) ; `avis_de2` renvoie toujours tous les avis, avec `compte` (entre dans la note) et `verifie` (auteur à identité vérifiée).
- **Application** (`v3/reputation.js`) : la moyenne du profil n'utilise que les avis `compte` (sans ce champ, ancien serveur : tous) ; badge « ✓ vérifié » à côté de l'auteur vérifié.
- Vérifié : test (transaction annulée, vendeur sans avis + 5 avis 5★ d'un même acheteur + 1 avis 2★ d'un autre) → 3,5 sur 2 partout (avant : 4,5 sur 6), 6 avis lisibles dont 2 comptent ; base réelle : chiffres inchangés (5,0 sur 1) ; navigateur : « 3,5 · 2 avis », 6 avis affichés, 1 badge vérifié, aucune erreur.
- `reputation.js?v=20261031c`, cache `mgci-v211`.

## L'heure de dernière activité n'est plus visible sans compte (23/10/2026) — schéma 78
- Fuite trouvée à l'audit : `profil_public` (`vu_le`) et `statuts_publics` (`actif_le`), ouvertes à tous, donnaient à n'importe quel visiteur sans compte l'heure exacte de la dernière connexion ou du dernier message d'un membre.
- **Serveur** (`supabase/schema-78-activite-membres.sql`, appliqué le 23/10) : ces deux heures ne sont renvoyées qu'aux membres connectés ; sans compte, elles sont vides. Le reste des deux fonctions est identique (statuts_publics garde le calcul « un avis par personne » du schéma 77).
- **Application** : inchangée ; sans heure, « actif il y a… » et le badge « Actif aujourd'hui » ne s'affichent simplement pas.
- Laissés volontairement : l'identifiant de l'admin (nécessaire pour écrire au Marché de Gros ; `est_admin_id` sert aussi au filtre des textes, retirer son accès casserait les publications) ; le mode « test » des notifications (n'envoie qu'au téléphone de la personne elle-même).
- Vérifié sur la base réelle (transaction annulée) : sans compte → heures vides, note et ventes inchangées ; membre connecté → heures données.

## Produits et photos du site IVT (23/10/2026)

- Source : dépôt `Stan77i/ivt-boutique` (32 produits, `assets/img/produits/`).
- 13 produits du marché reçoivent leur photo, et 5 produits sont ajoutés au catalogue (`v2/data.js`) : oignon violet, papaye ronde, papaye solo, piment sent bon, patate douce blanche. Le détail est dans `docs/IMAGES.md`.
- Les teintes des nouvelles photos sont dans `A.SACK` (`app/marche-app.js`).
- Tomate : un carton à la place du sac (photo IVT) ; la démo dit « le carton » ; l'unité « carton » est ajoutée.
- Les photos déjà présentes sont gardées. Les fiches IVT (prix, origine, conditionnement) ne sont pas reprises : le catalogue du marché n'a pas ces champs.
- Vérifié dans Chromium (iPhone simulé) : fiches tomate, oignon violet et papaye ronde, roue de l'accueil. Toutes les images se chargent et la console ne montre aucune erreur.
- Cache `mgci-v212`.

## PDF de stratégie (23/10/2026) — `strategie/`, schéma 79

- Quatre PDF : `1-Pitch.pdf` (10 diapositives), `2-Presentation.pdf`, `3-Probleme-et-solution.pdf`, `4-Marketing.pdf`. Mode d'emploi : `strategie/README.md`.
- Modèles HTML dans `strategie/sources/`, fabriqués par `construire.js`. Un PDF n'est refait que si son contenu change (`empreintes.json`).
- Chiffres :
  - **Dépôt** : catalogue, familles, régions, photos.
  - **Base** : `stats_publiques()`, schéma 79. Elle ne renvoie que des totaux, avec la clé publique de l'application ; elle a été testée en tant qu'anon.
  - **Marché** : 31 chiffres sourcés dans `donnees-marche.json` (lien, année, citation, vérifiés le 23/10/2026).
- `CLAUDE.md` : nouvelle règle n° 1, tenir ce fichier à jour. Nouvelle règle : mettre à jour les modèles et refaire les PDF à chaque changement du projet.
- Tâche automatique `.github/workflows/strategie-pdf.yml` (accord du propriétaire) : PDF refaits chaque lundi à 6 h 17 (heure d'Abidjan) et à chaque fusion concernée, enregistrés directement dans `main` par le robot GitHub.

## Corrections de l'application (23/10/2026)

- **« En cours » en double** : un accord conclu qui a déjà sa commande ne s'affiche plus ; seule la commande reste (`app/activite.js`). « Reprendre » d'un accord devenu commande ouvre la commande. `v3/commandes.js` expose `parNego(id)` et ajoute `nego` aux éléments d'activité.
- **Switch « Démo » en mode jour** : la roue reste foncée ; le switch garde ses couleurs claires, comme « Tout » (`app/demo-orbite.js`).
- **Boutons de fermeture** : le caractère « × » (mal centré avec la police Jost) est remplacé par une croix dessinée, dans 12 fichiers. La fenêtre des prix laisse la place au bouton (le titre ne passe plus dessous).
- **Pastille appareil photo du profil** : plus petite, maïs, posée proprement sur l'anneau (`v3/compte.js`).
- **Mode nuit des fenêtres** (`app/nuit.js`) : un dessin posé sur une pastille en dégradé vif garde sa couleur, et les pastilles rondes ne sont plus prises pour un mot surligné (l'icône des tutoriels était délavée).
- Vérifié dans Chromium (iPhone 13), en clair et en sombre, avec une session simulée et le réseau Supabase coupé. Cache `mgci-v213`.

## Design : accord, commande, profil, avatars (23/10/2026)

- **Accord conclu** (`v3/negoce.js`) : un reçu net (quantité, prix, total en grand), coche animée, bouton « Suivre la commande » avec icône, lien « Écrire au vendeur ». Le bleu de l'accord (règle des prix, étiquettes) devient le vert de la marque.
- **Suivi de commande** (`v3/commandes.js`) : la première étape s'allume « À confirmer » tant que l'autre n'a pas confirmé ; la vraie photo du partenaire ; la carte d'état est claire avec un liseré maïs (au lieu d'un deuxième bloc vert).
- **Profil** (`v3/compte.js`) : le gros encadré « Terminez la vérification » devient une seule ligne qu'on touche. Le bouton en double dans « Vos statuts » disparaît quand la ligne est là.
- **Avatars** : nouveau fichier `v3/personnages.js`, chargé avant `v3/avatar.js`. 21 produits (tomate, igname, sac de riz, plantain…), 10 yeux, 9 bouches, 12 couvre-chefs (dont le panier sur la tête), lunettes, moustaches, 10 objets en main (mégaphone, balance, calculatrice…), chaussures, 12 fonds, 6 motifs (étal, wax, kente…) : plus de 55 milliards de combinaisons. Code `mg:b=…` (moins de 70 caractères, limite 200). Avec `anime: true` : respire, cligne, saute ; saut à chaque changement dans le choix. Rien ne bouge si le téléphone demande moins d'animations. Onglet « Personnage » par défaut dans « Mon avatar », bouton dé « Un autre personnage au hasard », aperçu collé en haut sur téléphone.
- Vérifié dans Chromium (iPhone 13) avec des données simulées (réseau Supabase coupé). Cache `mgci-v214`.

## Avatars : bras attachés, vrai dé (23/10/2026)

- **Bras qui se décrochaient** : l'animation tournait autour d'un mauvais point (`transform-box: fill-box` avec une origine en coordonnées du dessin). Maintenant `view-box`, et les bras partent de l'intérieur du corps, dessinés derrière lui. L'objet en main reste devant.
- **Ombre noire** pendant l'animation : l'animation remettait l'opacité à 1 ; elle reste à 0,2.
- **« Au hasard » ne marchait pas** : `data-mgd` est vide, donc `d.mgd` valait `''` (faux). On teste `'mgd' in d` (même correction pour l'ancien `data-dice`).
- **Le dé** : le gros bouton jaune est remplacé par un dé dessiné (face blanche, épaisseur, points verts, le 1 en rouge) posé dans la carte d'aperçu, à droite. Au toucher : il roule, montre une nouvelle face, le téléphone vibre légèrement, le personnage saute, et une étiquette « Tiré au hasard ! » apparaît au-dessus de l'avatar. Cache `mgci-v215`.

## Avatars : calmes au repos, ils sautent quand il y a du nouveau (23/10/2026)

- Au repos : une respiration très légère et un clignement d'yeux. Plus de saut ni de bras qui salue en boucle.
- `MDGPerso.saute()` fait sauter les avatars de la personne (en-tête de l'accueil `.acc-r.av`, profil `.cp-hero-av`, ou tout élément `data-mg-moi`). Il est appelé tout seul quand le total « propositions non lues + messages non lus + notifications non lues + commandes à traiter » augmente (événements `mdg:activite`, `mdg:negoce`, `mdg:dm`, `mdg:notifs`). Le point de départ est pris 6 s après l'ouverture, pour ne pas sauter au démarrage.
- Le personnage remplit mieux le rond : cadrage 90 × 90 (`viewBox="5 8 90 90"`) au lieu de 100 × 100.
- Vérifié : au repos, pas de saut ; une nouvelle proposition simulée → un saut ; même nombre → rien. Cache `mgci-v216`.

## Compétences de design + audit + carte du réseau (23/10/2026)

- **Compétences installées dans `.claude/skills/`** (chargées automatiquement par Claude Code) : `impeccable` (pbakaus, Apache 2.0), `ui-ux-pro-max` (nextlevelbuilder, MIT ; tests retirés), `playwright-cli` (Microsoft, Apache 2.0), et `marche-de-gros-design` (le nôtre). « Reverse-engineer any design system » = l'outil `skillui` (MIT), lancé avec `npx skillui@1.3.4` ; mode d'emploi dans `.claude/skills/marche-de-gros-design/SKILL.md`. Licences gardées dans chaque dossier.
- **`DESIGN.md`** (racine) : la référence du design (jetons mesurés dans le code, composants, mouvement, mise en page des écrans à carte, interdits). Règle ajoutée dans `CLAUDE.md` : toute tâche de design passe par ces compétences.
- **Carte du réseau** : en haut, seulement le titre et une rangée « produit / où êtes-vous » sans défilement ; les filtres (Offres, Demandes, « Pour vous », Forte demande) descendent dans le panneau du bas, visibles même replié, avec la forme des marqueurs (rond, carré) au lieu d'emojis ; les boutons de la carte (me localiser, tout le pays, jour/nuit, chaleur, zoom +/− joints) forment une colonne à droite ; « En ligne · relief » n'apparaît plus (seulement « Hors connexion ») ; titre du panneau sans lettres espacées.
- **Audit (détecteur impeccable, 110 → 100 alertes, le reste surtout de fausses alertes des gabarits)** : texte minimum 11,5 px (`--t-2xs`, étiquettes « quand » de nuit, « En saison ») ; pastilles de nombre blanc sur `#C0442B` (contraste 4,9:1 au lieu de 3,1:1) ; quadrillage retiré du bandeau du profil ; liseré latéral retiré des conditions d'accord. Gardé volontairement : l'éclat du « de Gros » à la connexion (moment de marque, une fois).
- Vérifié dans Chromium (iPhone 13), clair et sombre, sans erreur. Cache `mgci-v217`.

## Lois anti-« design généré par IA » (23/10/2026)

- **32 lois** réunies dans `DESIGN.md`, section 8 : le socle d'`impeccable`, les 21 signes de Paralect, les 16 signes mesurés par Adrian Krebs sur 1 590 sites, les règles UX d'`ui-ux-pro-max`. `CLAUDE.md` impose de les relire avant tout travail de design.
- Appliquées dans l'application :
  - « En cours » : icônes dessinées (négociation, camion, boîte, vérifié, messages) au lieu des emojis 🤝 🚚 📦 ✅ 💬, couleurs jour et nuit ;
  - surfaces du navigateur aux couleurs de la marque : sélection maïs, curseur de saisie, cases et curseurs (`accent-color`), anneau de focus ;
  - cartes de chiffres de l'accueil : reflet qui balayait en boucle et cercles décoratifs retirés ;
  - sur-titres retirés (« Le catalogue du Marché de Gros », « Calendrier des récoltes ») ; « ÉTAPE 1… » retiré de Confiance (ce sont des principes, pas des étapes), « Étape 1 » en minuscules ailleurs ;
  - page Prix : la rangée 8 / 6 / 3 répétait les nombres des filtres : retirée ;
  - tampon « dès que possible » : il frissonne 2 fois et son point clignote quelques secondes, au lieu de bouger sans fin (le tampon lui-même, demandé le 21/10, est gardé) ;
  - « 3 signalements » en chiffres.
- Reste à décider avec le propriétaire : 🧺 et 🛒 (offre, demande) sont encore des emojis, utilisés partout (environ 60 fois) ; 69 tirets cadratins dans les textes.
- Cache `mgci-v218`.

## Panier et caddie dessinés, tirets (23/10/2026)

- **🧺 et 🛒 remplacés par des dessins** : `css/symboles.css` (nouveau, chargé par `application.dc.html`, `index-v3.html`, `admin.html`) définit `--sym-o` (panier de produits : tomate, maïs, feuille, dans un panier tressé) et `--sym-d` (caddie vert et maïs ; trait crème de nuit, sauf sur le bouton « Je cherche », toujours jaune). Utilisés par les pastilles `.od`, les boutons J'ai / Je cherche (`.duo2 .emo`), les cartes de chiffres (`.acc-emo`), les onglets d'Acheter (`.aseg-s`), les amas de la carte (`.cgl-s`), et les modules `v3/compte.js`, `v3/nuage.js`, `v3/reputation.js`, `app/carte-gl.js` (à la place de `content:"🧺"`). Les pastilles ne se balancent plus en boucle (entrée animée seulement).
- Aussi en icônes dessinées : la bande « tendance » (🔥 📈 ✅ 🤝 🛒) et le panneau des sons (🎶 🤝 💬 ⏳ 🧺 ✅ 👂 🔈 🔊).
- Restent volontairement : les emojis de produits servant d'image quand un produit n'a pas de photo, et la carte simple (Canvas, sans relief) qui dessine encore 🧺 🛒 en texte.
- **Tirets** : ceux qui séparaient deux informations (« Ville — Région », titre de partage, carte, relevé, commande) deviennent « · » ou disparaissent. Les « — » qui marquent une valeur vide restent (convention typographique).
- Inclut aussi le lot « 32 lois » (commit arrivé après la fusion de la PR #211). Cache `mgci-v218`.
- Agrandis à la demande du propriétaire : onglets d'Acheter 28 px, pastilles 26 px (36 px dans la liste de la carte), caddie au trait crème sur les surfaces toujours sombres (carte du prix de l'accueil, carte du réseau). Correction : le dessin restait aplati (hauteur en % dans une grille) → `aspect-ratio: 1`.
- Cartes de chiffres de l'accueil : pastille 58 px, panier et caddie 42 px, icône « Mes annonces » 30 px ; plus de balancement en boucle.

## Rapport pour porter l'application sur le site (23/10/2026) — `PORTAGE-SITE.md`
- `PORTAGE-SITE.md` (19/10, dépassé) réécrit : état du site, décision du propriétaire (« le site fait la même chose que l'application, on retire ce qui ne sert à rien »), méthode conseillée « un seul code » (l'application en mise en page large sur ordinateur), tableau de tout ce que l'application a et pas le site, liste de ce qu'on peut retirer (à valider : outil `tweaks` + Babel chargé deux fois ≈ 3 Mo, seul WebGL du site `v3/scene-ivt.js`, héros et en-tête IVT, GSAP/Lenis, petites cartes d3, captures à la racine ; anciens rapports à ranger).
- Inventaire automatique (partie 7) : `tools/inventaire-site.js` (sans dépendance ; suit aussi les `import()`), relancé par `.github/workflows/rapport-site.yml` à chaque fusion qui touche les pages, `app/`, `v2/`, `v3/`, `css/`. Mesuré aujourd'hui : application 86 fichiers / 3,2 Mo, site 108 fichiers / 5,5 Mo, 22 modules communs, 37 propres à l'application, 43 propres au site, 0 orphelin.
- `CLAUDE.md` : nouvelle section « Le site ».

## Pastilles de nombre (23/10/2026), oubliées par la fusion de la PR #213
- **Pastilles de nombre** (`.nbul`) partout où un nombre suit un libellé : onglets d'Acheter, filtres de Prix (vert vendeurs, maïs budgets), titres de section, bouton « Préparer la sélection » de Racheter. Règle ajoutée dans DESIGN.md et CLAUDE.md.
- Ce commit était arrivé sur la branche juste après la fusion de #213 : remis dans une PR à part. Cache `mgci-v219`.

## Compétences « founder-skills » (23/10/2026)
- 15 compétences business (stratégie, marketing, prix, concurrents, procédures, cahier des charges) copiées de `ognjengt/founder-skills` (MIT, commit a45931c) dans `.claude/skills/`, avec leur `LICENSE`. Vérifiées avant : texte seulement, aucune clé, aucun script ; seule `prd-generator` peut lancer `npx md-to-pdf` pour sortir un PDF.
- `FOUNDER_CONTEXT.md` : fiche du projet lue par ces compétences (tirée des textes de `strategie/sources/`). Règles d'usage dans `CLAUDE.md`. Aucun changement du front.

## « Pas de connexion » : le bandeau rouge (choix B, 23/10/2026)
- `app/sac.js` : la petite bulle verte en bas devient un **bandeau rouge en haut de l'écran**, partout : « Pas de connexion » et un bouton « Réessayer » (44 px). « Réessayer » envoie `mdg:reessayer` : les écrans ouverts relisent. Au retour du réseau : « De retour », en vert profond, puis le bandeau remonte (2,4 s). Nouvelle fonction `MDGSac.reseau(true/false)` pour qu'un écran signale lui-même une lecture ratée faute de réseau.
- `v3/tableau.js` (Prix) : hors connexion, carte calme avec le sac qui dort, « Le tableau dort un peu · Il se met à jour tout seul dès que le réseau revient » ; relit tout seul au retour du réseau. Si des prix étaient déjà affichés, ils restent à l'écran. Une autre erreur (serveur) dit « Le tableau ne répond pas ».
- Vérifié dans Chromium (iPhone 13, clair et sombre) : bandeau et carte affichés, retour en vert, aucune erreur JS. Cache `mgci-v220`.

## Onglets d'Acheter et panneau de la carte (23/10/2026)
- Onglets « Offres / Demandes / Tout » : chaque onglet prend la largeur de son contenu (flex au lieu de 3 colonnes égales) ; le nombre reste **dans** le fond de l'onglet choisi. Le caddie de l'onglet choisi passe au trait crème sur le fond noir (mode clair). Sous 360 px, le panier et le caddie se cachent (la couleur de la pastille suffit). Vérifié à 320, 375 et 390 px : rien ne déborde.
- Carte du réseau : l'ombre noire au-dessus du panneau du bas est retirée. Les filtres « Offres » et « Demandes » du panneau montrent le panier et le caddie dessinés (`.lg-s`, caddie crème sur le fond noir) au lieu d'un rond et d'un carré ; « Pour vous » et « Forte demande » gardent leur point. Cache `mgci-v221`.

## Panier et caddie dans les filtres de la carte (23/10/2026), oubliés par la fusion de la PR #218
- Les filtres « Offres » et « Demandes » du panneau de la carte du réseau montrent le panier et le caddie dessinés (`.lg-s`). Ce commit était arrivé sur la branche juste après la fusion de #218 : remis dans une PR à part. Cache `mgci-v222`.

## Audit SEO et plan d'acquisition (23/10/2026) — `docs/seo/`
- Trois audits en lecture seule (site et SEO technique, application et données publiques, mots-clés et concurrents) et le plan priorisé P0 à P3 dans `docs/seo/PLAN.md`. Constat principal : Google ne peut presque rien lire aujourd'hui (tout en JavaScript, adresses en `#/`, maintenance en `noindex`).
- Décision : le nouveau site (ordinateur) se construit caché, visible par l'administrateur seulement. Aucun code changé dans cette PR.
## Nouveau site public, première pierre : l'accueil caché, la barre « SEO » (23/10/2026)
- **`site/`** : nouvel accueil pour ordinateur, fabriqué par `tools/site-public.js` (gabarit `tools/site/index.html`, sans dépendance) et refait par `.github/workflows/site-public.yml`. Texte lisible sans JavaScript (titre, description, Open Graph, JSON-LD `Organization` + `WebSite`, canonical). En `noindex` avec le voile administrateur (`site/garde.js`, est_admin) tant que le propriétaire n'ouvre pas.
- Contenu : la promesse et deux portes « J'ai à vendre / Je cherche » autour du sac du marché ; « En ce moment » ; le tableau des meilleurs prix (`tableau_produits`) ; la carte vivante (contour de la Côte d'Ivoire simplifié en SVG de 1000 × 1050, fleuves, lacs ; annonces placées à leur ville via `site/donnees/lieux.json`, sinon au chef-lieu) et le fil ; les 6 étapes ; la confiance ; les pros et achats groupés ; le QR code vers l'application. Sur ordinateur, chaque bouton ouvre « Continuez sur votre téléphone » avec le QR code de la bonne page de l'application (`utm_source=site`) ; sur téléphone, il ouvre l'application.
- **Schéma 80 `fil_public()`** (test puis production) : annonces actives de 90 jours, anonymes (prénom + initiale, ville, produit, quantité, prix, date ; ni numéro, ni nom complet, ni identifiant de compte). Le compte officiel (administrateur, `est_admin_id`) s'affiche « Marché de Gros ».
- **`app/admin-pc.js`** : la barre devient « Admin · Application · Ancien site · SEO », avec des icônes dessinées (plus d'emoji). En bas de l'écran sur le site.
- `PRODUCT.md` (fiche produit pour la compétence impeccable) et `.impeccable/config.json` (construction directe, choix du propriétaire).
- `sw.js` : `site/` n'est jamais remplacé par l'application. Cache `mgci-v223`.
- Vérifié dans Chromium (1440 × 900 et iPhone 13) avec les vraies annonces de production : 5 points sur la carte, 5 annonces dans le fil, 4 lignes au tableau, rien ne déborde, voile levé seulement après est_admin, barre à trois choix.
- **Avec les vraies photos** (demande du propriétaire : « vraiment très bien fait ») : le haut de page devient un étal de sacs, cartons et cagettes posés en trois rangs (riz, maïs, plantain, oignon, igname, manioc, ananas, aubergine ; tomate en carton, cagette de mangues, attiéké), qui se posent un par un au chargement. « Les rayons du marché » : 4 étagères en photos (céréales, tubercules, légumes et fruits, poissons) et les autres familles en une ligne. Photo du produit dans les points de la carte, le fil et le tableau ; composition de produits à côté des pros.
- Photos légères : `tools/site-images.py` (Pillow) fait `site/img/<id>-480.webp` et `-160.webp` depuis `v2/img/` (ex. tomate : 48 Ko → 18 Ko et 4,5 Ko) ; la tâche `site-public.yml` le relance. Le sac dessiné n'est plus chargé sur le site.

## Liens d'intention : du site au bon écran de l'application (23/10/2026)
- `application.dc.html` comprend les liens venus du site : `#/publier?sens=offre|demande&produit=<id>&qte=<n>&unite=<u>` ouvre la fenêtre « J'ai / Je cherche » déjà remplie ; `#/vendre?produit=<id>` et `#/demande?produit=<id>` aussi ; `#/groupes` ouvre les achats groupés ; `#/appro` ouvre l'approvisionnement (et attend la connexion si besoin, `mdg:connecte`). Publier sans compte marchait déjà (l'annonce part après la connexion).
- L'adresse d'arrivée est gardée dès le chargement (`window.MDGAdresse0`), car l'application remet l'adresse à `#/` en démarrant ; le lien est joué une fois puis l'adresse redevient propre. Marche aussi si l'application est déjà ouverte (`hashchange`).
- Provenance : `utm_source / utm_medium / utm_campaign` gardés sur le téléphone à la première arrivée (`localStorage` `mdg-app:source`) pour la mesure à venir ; rien n'est envoyé au serveur pour l'instant.
- Piège trouvé : l'application avait déjà une méthode `quand()` (les dates) ; la mienne s'appelle `attendre()`.
- Site : les boutons utilisent ces liens (« J'ai à vendre » → `#/publier?sens=offre`, « Je cherche » → `#/publier?sens=demande`, tableau « Vendre » → `#/vendre?produit=…`, pros → `#/appro` et `#/groupes`).
- Vérifié (iPhone 13) : tomate 20 cartons préremplie, igname en « Je cherche », achats groupés ouverts, lien inconnu sans effet, aucune erreur. Cache `mgci-v224`.

## Site public : les pages produits (23/10/2026)
- 12 pages `site/produits/<id>/` (tomate, igname, plantain, manioc, oignon, maïs grain, riz local, attiéké, piment frais, aubergine, gombo, mangue), fabriquées par `tools/site-produits.js` + gabarit `tools/site/produit.html`. Chacune : fil d'Ariane (+ JSON-LD `BreadcrumbList`), grande photo, autres noms (catalogue), « Je vends / Je cherche » qui ouvrent l'application déjà remplie (`#/publier?sens=…&produit=…`), annonces et meilleurs prix du produit en direct, **calendrier des récoltes seulement quand une source publique le dit** (`v2/saisons.js` : igname, maïs, riz local, mangue… avec le lien de la source), étapes, produits voisins (liens internes).
- Gabarits découpés : `_debut.html` (tête commune, noindex de construction, garde), `_entete.html`, `_fin.html` ; chaque page a `<!--@tete-->` (titre, description, canonical, Open Graph) et `<!--@corps-->`. `{{S}}` = chemin vers `site/`, `{{R}}` = racine du dépôt ; `site.js` et `garde.js` lisent `data-s` sur `<html>`.
- Les étagères de l'accueil mènent aux pages produits quand elles existent.
- Vérifié (1440 × 900 et iPhone 13) avec les vraies annonces : igname (2 lignes de calendrier sourcées, aucune annonce → message honnête), tomate (12 500 F par sac, 1 offre), rien ne déborde, aucune erreur.

## Site public : la carte complète du réseau (23/10/2026) — `site/carte/`
- La même carte que l'application (`app/carte-gl.js` : MapLibre, relief, routes, 3 700 localités embarquées), en plein écran, avec un panneau : filtres « Tout / Offres / Demandes » (pastilles), liste des annonces (photo, prénom + initiale, produit, quantité, ville, prix demandé) et bouton « Acheter » / « Lui vendre » vers l'application. Toucher une bulle de prix montre ses annonces dans le panneau. Sans WebGL : la carte légère SVG du site.
- La page a `<base href="../../">` (racine du dépôt) pour que la carte trouve ses fichiers ; `S = site/`, `R = ''`. `app/carte-gl.js` résout désormais ses adresses avec `document.baseURI` (identique à avant dans l'application) ; `site.js` aussi. Nouveau fichier `site/carte.js` ; `site.js` partage les annonces par l'évènement `site:fil` (120 annonces).
- Menu du site : « La carte » ; l'accueil mène à la carte complète. Vérifié (1440 × 900, iPhone 13) : 5 annonces, regroupées par district puis bulles de prix en zoomant, aucune erreur ; la carte de l'application fonctionne toujours. Cache `mgci-v225`.

## Site public : les guides (23/10/2026) — `site/guides/`
- 3 guides écrits à la main, chaque chiffre avec sa source (tirés de `strategie/sources/donnees-marche.json`) : « Vendre sa récolte en gros » (pertes après récolte 30 à 40 % MEPD, plantain 90 F/kg à Bouaflé contre 380 F/kg à Abidjan OCPV 2025, transport de l'igname kponan), « Approvisionner un restaurant, un maquis ou une cantine » (5 600 cantines publiques, PAM), « Acheter du vivrier en gros sans se faire arnaquer ». Seules des fonctions qui existent dans l'application sont citées ; rappel que le paiement n'est pas branché.
- Contenu : `tools/site/guides/<id>.html` (bloc `<!--@meta {…}-->` : titre, h1, description, résumé, photo, public, action, date de publication fixe) ; gabarit `tools/site/guide.html` (encadré « Passez à l'action » qui suit la lecture, autres guides, sources numérotées) ; liste `site/guides/` ; JSON-LD `Article` + `BreadcrumbList`. Typographie française automatique (espace insécable avant « : ; ! ? »).
- Menu : « Guides » ; l'accueil a une section « Les guides du vivrier en gros ». Vérifié (1440 × 900, iPhone 13) : rien ne déborde, aucune erreur.

## Application : onglets Prix, Activité, Alertes (23/10/2026)
- Onglet « Prix » : pastille verte avec le nombre de produits qui ont une annonce (= les lignes du tableau du marché).
- « Activité » : quand rien n'est en cours et qu'aucune annonce n'est à montrer, un seul message « Aucune activité » avec le sac (`MDGSac.vide`), au lieu de deux cartes « Rien en cours… / Rien de nouveau… ». « Alertes » : « Aucune alerte » de la même façon (aussi sans compte, sauf l'alerte « Connectez-vous »).
- Tableau du marché (`v3/tableau.js`) : « 2 offres · 1 demande » devient des pastilles avec le panier (vert) ou le caddie (maïs), qui apparaissent avec un petit saut.
- Vérifié (iPhone 13, mode sombre) : avec les 5 vraies annonces (Prix 4, pastilles), puis sans rien (états vides). Règle ajoutée dans `DESIGN.md`. Cache `mgci-v226`.

## Mesure des visites, gratuite et sans donnée personnelle (23/10/2026) — schéma 81
- **Schéma 81** (test puis production) : table `site_mesures` fermée (RLS, aucun droit direct), `mesurer()` (anon : évènement, page, bouton, utm_source / utm_medium / utm_campaign ou site d'origine, ordinateur / téléphone ; textes nettoyés ; 20 000 par jour au plus) et `mesures_resume(jours)` (administrateur seulement). Ni IP, ni compte, ni numéro, ni identifiant d'appareil.
- Ce qui est compté : une vue par page et par visite (site public `site/`, page de maintenance), un clic par bouton d'action du site, l'ouverture de l'application venue du site ou d'un QR code (`utm_*`), puis une fois la connexion qui suit (`mdg:connecte`). **Les visites de l'administrateur ne sont jamais comptées** (`mdg-site:admin`).
- `index.html` et `maintenance.html` gardent désormais les `utm_*` en redirigeant (un QR code imprimé est reconnu jusque dans l'application). Le site transmet sa provenance à l'application (`utm_source=site-<origine>`).
- Tableau d'administration : nouvel écran « Visites » (`v3/admin-mesures.js`) : totaux, jour par jour, pages vues, boutons touchés, provenances ; 7 / 30 / 90 jours. Exemple de lien de QR code : `…/marchedegrosci/?utm_source=affiche&utm_medium=qr&utm_campaign=adjame`.
- Vérifié : les 4 envois interceptés sont exacts (maintenance par QR, page tomate depuis Facebook, clic « Je vends », ouverture de l'application) ; l'écran « Visites » s'affiche ; test SQL annulé (lecture refusée au public, évènement inconnu ignoré, texte piégé nettoyé, résumé réservé à l'admin).
## Décision : le nouveau site vitrine (23/10/2026)
- Décision du propriétaire notée dans `CLAUDE.md` (section « Le site ») et `PORTAGE-SITE.md` (partie 2) : nouveau site public, vitrine vivante de l'application (carte du réseau avec annonces, demandes, commandes ; marketing et SEO) ; l'ancien site reste, visible par l'administrateur seulement. Aucun code changé.

## Site public : « Qui sommes-nous », 2 guides de plus, typographie (23/10/2026)
- `site/a-propos/` : ce que fait le Marché de Gros CI, **ce qu'il n'est pas** (ni le marché de gros de Bouaké, ni l'OCPV, ni l'État), ses règles (rien d'inventé, numéro caché, peu de données), ce que ça coûte (commissions prévues, rien n'est prélevé), comment écrire à l'équipe. JSON-LD `AboutPage`.
- Guides : « Acheter en gros à plusieurs : comment marche un achat groupé » (paliers, quantité de chacun, prix figé au seuil, confirmation par chacun, une commande par participant — d'après `v3/groupes.js`) et « Trouver un fournisseur ou un grossiste de vivrier fiable ». Bouton « Voir les achats groupés » (`#/groupes`).
- Pied de page : Qui sommes-nous, Guides, La carte, Les prix. Espace insécable avant « : ; ! ? » sur tout le texte visible de toutes les pages (hors scripts).

## Rapport de reprise (23/10/2026) — `docs/REPRISE.md`
- Le propriétaire vide la discussion : `docs/REPRISE.md` résume l'état (tout fusionné jusqu'à #230, schémas 80-81, cache `mgci-v227`), ce qui a été fait, ce qui reste (retours sur le site caché, contenu, ouverture au public et Search Console, liste de retrait de l'ancien site) et les pièges. `CLAUDE.md` y renvoie.

## Site public : 13 pages produits de plus, plan du site (23/10/2026)
- `tools/site-produits.js` (`LISTE`) : noix de cajou (calendrier sourcé), arachide décortiquée, haricot niébé, patate douce, ananas, avocat, banane douce, chou, poivron, gari, huile de palme rouge, poulet de chair, œufs (alvéole de 30). **25 pages produits** en tout ; les voisins renvoient vers ces pages au lieu de l'application.
- `site/sitemap.xml` fabriqué par `tools/site-public.js` (accueil, carte, guides, qui sommes-nous, produits, guides avec leur date). Pas de `robots.txt` possible sur GitHub Pages (il serait à la racine de `stan77i.github.io`) : le plan se soumet à la main dans Search Console et Bing, **seulement le jour de l'ouverture**.
- `404.html` à la racine (page « introuvable » de GitHub Pages, pour toutes les adresses du dépôt) : sobre, `noindex`, `<base href="/marchedegrosci/">`, un seul bouton vers `index.html` (qui envoie le téléphone vers l'application et l'ordinateur vers la maintenance, puis vers le site le jour de l'ouverture). Cache `mgci-v228`.
- Guide « Les grands marchés de gros du vivrier en Côte d’Ivoire » (`tools/site/guides/grands-marches-de-gros.html`) : Gouro d’Adjamé, marché de gros de Bouaké, dépôts d’igname d’Abidjan, marchés annoncés (Ebimpé, Daloa, Abengourou, pas encore ouverts). Chaque fait a sa source (Sika Finance, Fraternité Matin, RFI, AIP, Akiri / Université Alassane Ouattara, European Scientific Journal, Abidjan Économie, Agence Ecofin) ; chiffres RFI revérifiés mot pour mot. Aucun lien vers un concurrent (Divisi retiré). Écartés faute de source : Korhogo, Yamoussoukro, San-Pédro, etc. État actuel du chantier du Gouro : dernière source mars 2025.

## Site public : guide « Transporter du vivrier en gros sans pertes » (23/10/2026)
- `tools/site/guides/transporter-le-vivrier.html` : pertes (DG Économie 30-40 % après récolte ; CIRAD/Université Nangui Abrogoua 2019 : 10 à 43 % de pertes de tomate dues au seul transport, estimations des acteurs, citation revérifiée), emballage par produit (tomate en carton, 35 kg conseillés), chargement, chaleur, choix du transporteur, accord écrit (qui paie, qui perd), réception. Aucun prix de transport (sources trop anciennes ou trop locales). 7 guides en tout.
- Typographie : espace insécable entre un nombre et « % », « kg », « °C », « km », « FCFA », « t », et dans « 3 000 » (`fine()` de `tools/site-public.js`) : plus de « 10 » en fin de ligne et « % » au début de la suivante.

## Site public : page « Calendrier des récoltes » (23/10/2026)
- `site/saisons/` (gabarit `tools/site/saisons.html`) : toutes les périodes sourcées de `v2/saisons.js`, produit par produit (10 produits : igname, maïs frais et grain, riz, mil, sorgho, mangue, cajou, cacao, café), chaque ligne avec sa source, liste des sources, date de mise à jour. Lien dans le pied de page, ajoutée au `sitemap.xml`.
- Le rendu d'une ligne du calendrier est commun aux pages produits et à cette page (`lireSaisons`, `ligneMois`, `calendrier` dans `tools/site-produits.js`) ; pages produits inchangées (vérifié par comparaison).
- Ajouter un produit au calendrier = ajouter une entrée **sourcée** dans `v2/saisons.js` (elle apparaît aussi sur la carte de l'application).
- Liens vers `site/saisons/` : sous le calendrier de chaque page produit (« Le calendrier de tous les produits ») et sur l'accueil, à côté de « Tous les guides ».
- **Calendrier : banane plantain et oignon ajoutés** (`v2/saisons.js`, `A.CAL` de `app/marche-app.js`), citations vérifiées mot pour mot le 23/10/2026 : plantain « pleine période de récolte de fin novembre/début décembre à fin février/mars » (Nitidae, étude des marchés de gros) ; oignon « Odienné, Korhogo, Ferké, Bouaké ou encore Bouna […] sur la période de février à juin » (RONGEAD 2014). Écartés : tomate (local et Burkina mêlés), manioc, aubergine, gombo, piment (tableaux d'**offre** au marché d'Abidjan, pas de récolte), arachide, niébé, patate douce, ananas, avocat, orange (pas de source ouverte avec des mois).
- Cadran « L'année du marché » (`anDial`, `application.dc.html`) : l'écart entre anneaux s'adapte au nombre de cultures, le cadran garde sa taille (vérifié iPhone, 14 anneaux). `marche-app.js?v=20261102a`, cache `mgci-v229`.

## Calendrier des récoltes : 12 produits de plus, source FAO (23/10/2026)
- Source : **calendrier des cultures de la FAO pour la Côte d'Ivoire** (`fao-calendrier`), lu dans l'API `api-cropcalendar.apps.fao.org/api/v1/countries/CI/cropCalendar` (mise à jour FAO du 26/02/2021) ; dates exactes « early_harvest → late_harvest » gardées dans chaque note.
- Ajoutés (`v2/saisons.js`, 25 lignes) : tomate, gombo, piment, aubergine, poivron, chou, concombre, carotte, laitue (cultures irriguées, Sud / Centre et Nord), arachide (Sud 1er et 2e cycle, Centre et Nord), manioc (Sud, Centre ; récolte étalée), niébé (Nord), soja (Centre et Nord). Non repris (déjà sourcés ailleurs) : igname, riz, mil, sorgho, oignon, maïs. Écartés : « banane » FAO (plantain ou douce ?), « Maïs, sucré », « patate douce » FAO (c'est l'igname, erreur de traduction FAO), « Fève, vert ».
- Intensités : la FAO donne une fenêtre ; premier mois « ça commence », dernier « ça se termine », milieu « pleine récolte » (fenêtre de 1-2 mois : pleine). Un mois compte si la fenêtre y dure plus de 5 jours.
- Zones FAO → districts : `zone:sud-fao` (zones guinéenne + soudano-guinéenne 1) et `zone:centre-nord-fao` (soudano-guinéenne 2 + soudanaise) dans `meta.zones`.
- Application : lignes ajoutées à `A.CAL` (6e case = 1). Cadran « L'année du marché » : **un anneau par produit** (`anParProduit()`, niveau le plus fort du mois), 24 anneaux, même taille ; le nombre de récoltes en cours et la barre des mois comptent les produits. `marche-app.js?v=20261102b`, cache `mgci-v230`.
- Site : la page « Calendrier des récoltes » passe de 12 à 24 produits ; les pages produits tomate, gombo, piment, aubergine, chou, poivron, arachide, manioc, niébé affichent leur calendrier.

## Site public : « En ce moment » sur le calendrier, 2 pages produits (23/10/2026)
- `site/saisons/` : bloc « En ce moment, en <mois> » en tête : les produits en récolte ce mois-ci (lus dans la page même, attribut `data-mois` de chaque produit, petit script dans le gabarit), avec lien vers leur page. Correction : les blocs du calendrier s'alignent sur le titre (marges latérales auto gardées).
- Pages produits concombre et soja (calendrier FAO, photo) : **27 pages produits**.

## Site public : accueil, conversion (audit `cro-optimization`, 23/10/2026)
- Chaque annonce du fil (accueil, réseau, page produit) est un **lien** vers la fiche du produit dans l'application (`data-intention="annonce"`).
- Le panneau « téléphone » reprend ce que la personne voulait faire : « Publiez votre offre / votre demande depuis votre téléphone », « Voyez cette annonce… » ; adresse courte affichée ; « Votre numéro n'est jamais montré aux autres membres ».
- Fil ou tableau vides : un lien d'action (« Publiez la première », « Publier mon prix »), en maïs sur fond vert.
- Bouton « Prendre l'application » de l'en-tête mesuré à part (`entete`) ; `href` des deux portes alignés sur leur `data-app` ; sous les rayons : « Votre produit n'est pas affiché ? … Je vends · Je cherche ».
- Non repris : bandeau de confiance sous les portes (déjà dit sous le titre), nouveau titre de la section « appli » (faible impact).

## Site public : une page par district (23/10/2026)
- `site/regions/<district>/` (14 pages, `tools/site-regions.js`, gabarit `tools/site/region.html`) et le sommaire `site/regions/` (`tools/site/regions.html`). Lien « Les districts » dans le pied de page, pages dans le `sitemap.xml`.
- Contenu, rien d'inventé : nom et chef-lieu ; « Ce qui s'y récolte » = entrées de `v2/saisons.js` **qui nomment le district** (les périodes données pour tout le pays, comme le plantain ou le cajou, sont exclues pour ne pas laisser croire qu'ils poussent partout) ; photos de ces produits en tête ; annonces du district (`fil_public`, filtrées par `region_slug` dans `site/site.js`, `data-region`) ; meilleurs prix du district (`tableau_produits(p_region)`) ; lien vers le guide des grands marchés pour Abidjan, la Vallée du Bandama (Bouaké), le Sassandra-Marahoué (Daloa, annoncé) et la Comoé (Abengourou, annoncé).
- Liens internes : dans tous les calendriers (pages produits, calendrier, districts), chaque nom de district mène à sa page ; accueil : « Les districts » à côté du calendrier. Contrôle automatique : 3 819 liens internes, aucun cassé.
- Référencement : titres raccourcis (65 caractères au plus, sauf « Œufs de poule (alvéole de 30) ») et descriptions de 160 caractères au plus sur les 54 pages ; contrôle : un seul h1 par page, adresse canonique juste, `noindex` partout (jusqu'à l'ouverture).

## 23/10/2026 — Application : plus de carte « Dernières annonces » vide

- Demande du propriétaire : quand il n'y a aucune annonce (ou qu'il les a toutes effacées), la carte « Dernières annonces » de l'onglet Activité ne s'affiche plus du tout. Elle revient dès qu'une nouvelle annonce arrive.
- `application.dc.html` : la carte est dans `<sc-if value="{{ accActOn }}">` ; textes « Rien de nouveau depuis votre dernier effacement » et « Aucune annonce pour l'instant » retirés. Si rien n'est en cours non plus, l'écran garde le seul message « Aucune activité ».
- `sw.js` : cache `mgci-v231`.

## 23/10/2026 — Rapport de passation et documents à jour

- Nouvelle règle du propriétaire, écrite dans `CLAUDE.md` : chaque PR fait son rapport de passation et met à jour tous les documents concernés.
- `docs/REPRISE.md` : état après la PR #240 (27 produits, 7 guides, 14 districts, plan du site de 54 adresses, cache `mgci-v231`), ce qui reste.
- `docs/seo/PLAN.md` : nouvelle partie 0 « Avancement » (ce qui est fait, ce qui reste côté propriétaire et côté technique).
- Où en est le site : contenu presque complet, caché. Reste : retours du propriétaire, audit de sécurité, ouverture (sa décision), Search Console et Bing ; en option, prix officiels OCPV cités et résumé des prix de la semaine.

## 23/10/2026 — Dossier pour Claude Design

- Demande du propriétaire : Claude Design avait du mal avec les fichiers de l'application (un seul fichier de 346 Ko, des styles cachés dans 30 modules). Nouveau dossier `claude-design/` :
  - `application/` : `CONSIGNES.md` (règles du propriétaire, ce qu'il ne faut pas casser : `sc-if`, `sc-for`, `{{ }}`, `onClick`, `data-`), `DESIGN.md`, `PRODUCT.md`, `styles/` (les 9 feuilles de style de la page), `styles/fenetres/` (les styles de 33 fenêtres, extraits des constantes `CSS` des modules), `ecrans/` (20 morceaux de `application.dc.html` + `SOMMAIRE.md`), `dessins/` (icônes, logo, sac, personnages), `captures/` (12 écrans, iPhone, clair et sombre) ;
  - `site/` : `CONSIGNES.md`, `DESIGN.md`, `styles/site.css`, `gabarits/` (dont les guides) + `SOMMAIRE.md`, `scripts/` (lecture), `captures/` (9 pages, ordinateur 1440 px) ;
  - `application.zip`, `site.zip` (dates fixes : refaire donne exactement les mêmes fichiers), `LISEZ-MOI.md` (quoi dire à Claude Design), `origines.json`.
- Outils : `tools/claude-design.py` (fabrique), `tools/claude-design-captures.js` (captures, données vides, voile du site levé pour la capture seulement), `tools/claude-design-retour.py` (reporte le travail rendu dans les vrais fichiers ; testé sur un faux retour : styles, écran, style de fenêtre, gabarit du site, tous reportés au bon endroit, puis annulés).
- Tâche `.github/workflows/claude-design.yml` : refait le dossier après chaque fusion qui touche l'application, le site ou le design (sans les captures).
- `CLAUDE.md` : nouvelle partie « Claude Design ». `DESIGN.md` et `docs/REPRISE.md` : renvoi vers le dossier.

## 23/10/2026 — Retrait du dossier Claude Design

- Demande du propriétaire : tout retirer. Supprimés : `claude-design/` (copies, captures, .zip), `tools/claude-design.py`, `tools/claude-design-captures.js`, `tools/claude-design-retour.py`, `tools/claude-design/`, la tâche `.github/workflows/claude-design.yml` ; renvois retirés de `DESIGN.md` et `docs/REPRISE.md` ; `CLAUDE.md` garde la décision (ne pas recréer).
- Sécurité vérifiée : le dossier ne contenait que des copies de fichiers déjà publics (le dépôt est public), aucune clé secrète. L'« aperçu » qui levait la protection « ordinateur → maintenance » n'a jamais été fusionné ni publié ; sa branche de travail `claude/apercu-claude-design` ne contient que le script inachevé (aucune copie de l'application) ; Claude Code n'a pas le droit de supprimer une branche sur GitHub : le propriétaire peut la supprimer dans « Branches » (GitHub Pages ne publie que `main`). La protection de l'application est inchangée.

## 24/10/2026 — Vérification des mises à jour

- État : toutes les PR fusionnées jusqu'à #243 ; aucune PR ouverte ; cache `mgci-v231` ; plus aucun fichier Claude Design dans `main`.
- `FOUNDER_CONTEXT.md` : état du site mis à jour (nouveau site prêt mais caché, ancien site caché).
- `PORTAGE-SITE.md` : la ligne « Dernières annonces » précise que la carte disparaît quand elle est vide.
- `docs/REPRISE.md` : état après la PR #243, branche obsolète signalée.
- PDF de stratégie : rien à refaire. Aucun de leurs textes ne parle de ce qui a changé ; leurs chiffres se mettent à jour seuls (tâche du lundi). Le nouveau site n'y sera ajouté qu'à son ouverture.
- `CLAUDE.md` : marche à suivre quand une nouvelle discussion commence par un seul mot (« On reprend ») ; `docs/REPRISE.md` : liste « ce qui reste » corrigée (guides déjà faits retirés).

## 24/10/2026 — Site : prix officiels de la semaine (OCPV)

- Source vérifiée : OCPV, note de conjoncture n° 42, semaine du 12 au 18 octobre 2026 (PDF public sur ocpv-ci.com). Prix moyens **au détail**, FCFA le kg, Abidjan et intérieur (semaines 41 et 42), prix mini-maxi et marchés les moins chers et les plus chers, niveau d'approvisionnement.
- Les pourcentages de la note sont faux par endroits (banane plantain 650 → 385 annoncé −69 %, en vrai −41 %) : seuls les prix sont repris, les variations sont calculées par le site.
- `tools/site/prix-ocpv.json` (données), `tools/site-prix.js` (bloc produit et page), `tools/site/prix-semaine.html` (gabarit), `tools/site-public.js` (branchement, plan du site), `tools/site/produit.html` (`{{PRIX_OCPV}}`), `tools/site/index.html` et `_fin.html` (liens « Les prix de la semaine »), `site/site.css` (styles `.px-*` ; attention, `.pt` existait déjà : les marqueurs de la carte).
- Bloc « Le prix officiel au détail » sur 11 pages produits (tomate, igname, banane plantain, manioc, oignon, maïs grain, riz local, piment frais, aubergine, gombo, arachide décortiquée). Page `site/prix-de-la-semaine/` : en bref (baisses et hausses à Abidjan), prix moyens, où c'est le moins cher, approvisionnement, tableau en direct de l'application.
- Vérifié dans Chromium : ordinateur 1440 px et téléphone 390 px, aucun débordement, un seul titre principal, titre de 46 caractères. `sw.js` : cache `mgci-v232`.
- À faire chaque semaine : mettre à jour `prix-ocpv.json` avec la nouvelle note (voir `docs/REPRISE.md`).
- Mise à jour chaque semaine (accord du propriétaire) : tâche GitHub `.github/workflows/ocpv-note.yml` (télécharge la note, texte dans `tools/site/ocpv/`) et tâche programmée de Claude « Prix OCPV de la semaine » chaque mardi à 8 h 36 (heure d'Abidjan), qui ouvre la PR. Raison de la tâche GitHub : les sessions programmées n'ont ni l'outil de lecture des PDF ni un accès Internet libre.

## 24/10/2026 — Application : plus stable (ouverture, profil, défilement)

Demande du propriétaire : supprimer les petits défauts visibles (« ça doit être super stable »).
- **Ouverture** : avant le chargement, la page montrait un petit logo « marché de Gros » (96 px) puis l'écran d'ouverture avec le sac et le grand nom. Le fond d'avant chargement est maintenant **uni**, de la même couleur que l'écran d'ouverture (vert, ou noir si le logo noir est choisi : classe `spl-noir` posée par un petit script en tête de `application.dc.html`). Le sac et le nom arrivent ensemble, une seule fois.
- **Fenêtre du compte** (toucher sa photo) : le contenu apparaissait en fondu après la fenêtre, d'où un instant de fenêtre vide ; puis il refaisait un fondu à l'arrivée des données. `v3/compte.js` : `aller(page, calme)` ; pas de fondu à l'ouverture ni au rafraîchissement, le fondu reste pour passer d'une page à l'autre.
- **Défilement** : `app/effets.js` effaçait les cartes de l'accueil, les mots soulignés de maïs et les tampons dès qu'ils sortaient de l'écran, puis rejouait leur arrivée en remontant (clignotements). Ils ne sont remis à zéro que quand leur page s'en va (glissée de côté, fermée). Mesuré dans Chromium : 3 éléments effacés pendant un aller-retour de défilement avant, 0 après.
- **Tableau des prix** (`v3/tableau.js`) : relu toutes les 30 s, il refaisait toute la liste (photos rechargées, éclairs pendant le défilement, liste déroulante refermée). Nouveau `MDGStable.poser(el, html)` dans `app/stable.js` : ne touche que ce qui a changé. Vérifié : mêmes photos et mêmes lignes gardées, seul le prix changé est mis à jour.
- **Messages** (liste relue toutes les 15 s) et **Mes commandes** (toutes les 20 s) : plus de redessin quand rien n'a changé.
- `?v=` augmentés (`application.dc.html`, `index-v3.html`, `admin.html`), `sw.js` : cache `mgci-v233`.
- Non vérifiable ici : le vrai rendu de Safari sur iPhone (Chromium seulement) et les écrans qui demandent le serveur (pas d'accès réseau à Supabase depuis la session). À regarder sur le téléphone après la fusion.

## 24/10/2026 — L'année du marché et « Où êtes-vous ? » du réseau

- **L'année du marché** : les pastilles « 1 offre » / « 1 demande » portent maintenant le panier (offre) et le caddie (demande) du marché, comme partout (`css/symboles.css`, caddie au trait crème sur ce fond sombre).
- Le gros bouton jaune « Voir la fiche, les prix et les annonces » devient une rangée fine : pastille maïs avec une courbe de prix, « Voir la fiche » + « Prix, offres et demandes », flèche dans un rond (`.an2-go`, `css/annee-app.css`).
- **Réseau, « Où êtes-vous ? »** : le grand cadre jaune qui apparaissait au toucher (contour de focus de la liste) est supprimé. La liste native reste, invisible, posée sur toute la pastille ; la pastille montre « Votre zone · Où êtes-vous ? » ou « Vous êtes à · Abidjan ». Le point violet (vous, sur la carte) respire tant qu'aucune zone n'est choisie ; une fois choisie, il s'allume en violet plein. Focus clavier : anneau violet discret (`.cz-moi`, `css/mgci-app.css`).
- Vérifié dans Chromium (iPhone émulé, sombre). `sw.js` : cache `mgci-v234`. Dépend de la PR « Application plus stable » (#246), à fusionner avant.

## 24/10/2026 — État après les PR #246 et #247

- Les deux PR sont fusionnées (stabilité de l'application ; année du marché et « Où êtes-vous ? »). Cache `mgci-v234`. Aucune PR ouverte. `docs/REPRISE.md` mis à jour.

## 24/10/2026 — Compétence antislop (anti « fait par IA ») installée et essayée

- **Installé** : les 6 compétences de `miqdadbadjuber/anti-slop` (MIT, version 3.2.22) dans `.claude/skills/antislop*` ; origine, réglages et choix assumés dans `.claude/skills/ANTISLOP-NOTICE.md`. `CLAUDE.md` (bloc `antislop`, liste des compétences de design, 25 compétences), `docs/REPRISE.md` partie 4 et `DESIGN.md` section 9 sont à jour.
- **Réglage** : pas de question « pendant ou après » en début de discussion (règle « un mot suffit ») ; « pendant » par défaut, « après » pour un audit.
- **Ce qu'elle ajoute** à ce qu'on avait (`DESIGN.md` section 8, `impeccable`, `ui-ux-pro-max`) : un calculateur de contraste exact, une liste de contrôle des **textes** (utile pour le site, les guides, les PDF de `strategie/` et les publications), une liste pour les commentaires de code, et un bilan PASS/FAIL avant de livrer. Le reste recoupe nos 32 lois.
- **Essai sur le projet (mesuré)** :
  - couleurs de `DESIGN.md` : 20 paires mesurées ; tous les textes passent, sauf `--ok #1F8A55` en petit texte (3,98:1 sur carte, 4,35:1 en blanc dessus). Il ne sert qu'à des formes et bordures : règle ajoutée à `DESIGN.md` ;
  - **corrigé** : le ticket « accord conclu » de la négociation (`v3/negoce.js`, `.nx-tk.is-accord`) avait un fond teinté **bleu** (`rgba(106,174,240,.08)`), interdit par `DESIGN.md` : il est maintenant vert (`rgba(31,138,85,.08)`) ;
  - le corail du message « Non envoyé · toucher pour réessayer » semblait trop pâle (2,7:1 sur la page), mais il s'affiche dans la bulle foncée : 5,9:1, il passe. Laissé tel quel ;
  - tirets longs « — » : 0 visible à l'écran (application et site caché, mesuré dans le navigateur) ; ceux du code sont dans des commentaires ou servent de valeur vide ;
  - mots creux (« révolutionnaire », « en quelques clics », « découvrez »…) : aucun dans le site ni dans l'application.
- Front : `v3/negoce.js?v=20261124a`, `CACHE` `mgci-v235`.

## 24/10/2026 — Audit antislop complet de l'application (mode « après »)

- Rapport : `docs/anti-slop/audit-001-2026-10-24.md`. **Aucune correction faite** : le propriétaire choisit les numéros.
- Méthode : navigateur (16 écrans sans compte, iPhone émulé, clair et sombre, 390 et 320 px, mesures automatiques) + relecture des 60 fichiers de l'application par 5 relecteurs, avec antislop et les 32 lois de `DESIGN.md`. Le serveur Supabase était bloqué par le réseau de la session : les écrans avec compte ou données n'ont été vus que dans le code.
- Résultat : 26 constats HAUTS (6 phrases fausses sur le paiement, dont « Payé sous 24 h » dans la bande de l'accueil ; 14 textes illisibles mesurés entre 1,04:1 et 4,3:1 ; 5 entorses à la règle de stabilité ; 1 problème de clavier), 19 MOYENS, 14 BAS, 3 décisions de goût (accueil vivant, bleu « vérifié », « de Gros » en dégradé).
- Bon partout : aucune erreur JS, aucun débordement à 320 px, aucun tiret long visible, mode « moins d'animations » presque partout respecté.

## 24/10/2026 — Phrases justes sur le paiement (audit antislop n° 1 à 6)

- Règle : aucun paiement ne passe par l'application (séquestre en construction). Les textes qui disaient le contraire sont corrigés ; quand le séquestre sera actif (`S.actif`), Mes commandes reprend d'elle-même l'ancien texte.
- Bande de l'accueil (`app/garanties.js`) : « Pas de réclamation ? Payé sous 24 h » → « Marchandise reçue : 24 h pour la vérifier » ; « Pas de remboursement sans preuves » → « Un refus se prouve : mot secret et photos ».
- Mes commandes (`v3/commandes.js`) : « le paiement est libéré automatiquement » seulement si le séquestre est actif, sinon « la commande est clôturée automatiquement » ; dernière étape « Clôture » au lieu de « Libération » sans séquestre ; reconnaître un refus : « L'acheteur ne doit que la partie acceptée » sans séquestre.
- Délai : **24 h** partout (le serveur clôt 24 h après la réception, schéma 61). Les « 48 h » de Mes commandes et de l'écran administrateur des transports (`v3/admin-transport.js`) sont corrigés. Les 48 h de la négociation sont une autre règle (délai pour répondre à une proposition) : inchangés.
- Tutoriels (`v3/astuces.js`) : « Vérifier et libérer » devient « Vérifier la marchandise » (paiement à la livraison, commande clôturée après 24 h) ; « Refuser » : « vous ne devez que la partie acceptée ». Aide (`v3/aide.js`) : « Vais-je être remboursé ? » répond que le paiement se fait à la livraison, entre vous.
- `app/toast.js` : « L'équipe est prévenue » (faux) → « Réessayez plus tard ». Formulaire J'ai / Je cherche : « Votre offre sera la première du réseau » (parfois faux) → « les acheteurs verront votre offre ».
- Vérifié (navigateur, iPhone) : les 24 phrases de la bande, les 4 cartes du tutoriel et la phrase du formulaire s'affichent ; aucune erreur JS. Mes commandes n'a pas pu être ouverte (pas d'accès au serveur dans cette session) : vérifié par la relecture et `node --check`.
- `?v=20261124b` pour garanties, toast, admin-transport, aide, astuces, commandes ; cache `mgci-v236`.

## 24/10/2026 — Textes lisibles (audit antislop n° 7 à 20)

- Contraste mesuré avec `contrast-check.py` sur le vrai fond, avant et après. Tous les textes corrigés passent maintenant 4,5:1.
- Négociation (`v3/negoce.js`) : ligne « … a accepté » vert foncé sur vert pâle (était bleu très clair, 1,04:1) ; libellé du prix rapide choisi en crème à 72 % ; heure des bulles en couleur pleine.
- Messages (`v3/messages.js`) : conversation survolée en voile léger (devenait noire, 1,14:1) ; heure des bulles 11,5 px en couleur pleine (crème à 72 % dans la bulle foncée, 8,7:1).
- Espace chauffeur (`v3/chauffeur.js`) : code de transfert en vert du logo (était maïs, 1,65:1).
- Mon compte (`v3/compte.js`) : « Supprimer définitivement » sur #C0442B (était 2,67:1) ; badge « vérifié » crème sur l'en-tête vert (était bleu, 2,36:1).
- Avis (`v3/reputation.js`) : mot sous les étoiles et rangs 1 à 3 en `#765802` (étaient maïs, 1,37:1) ; croix « Retirer la photo » crème, 44 px (était invisible) ; barres 11,5 px.
- Bandeau « Pas de connexion » (`app/sac.js`) : bouton « Réessayer » blanc, texte #C0442B (était 3,65:1).
- Gris trop pâles `#857A67`, `#7a7064`, `#8a7f72` → `#6F6553` dans aide, alertes, compte, guide, identité, négociation, avis, sons (et le jeton `--faint`).
- Connexion en sombre (`v3/nuage.js`) : exemples de format `#948A77` (5,0:1, était 2,40:1), « 6 chiffres » et la note `#A89D89` (6,4:1).
- Avatar « Initiales » (`v3/avatar.js`) : fond ocre `#B8882A` → `#7E5C00` (5,4:1).
- Nom du produit sur le sac en toile (`application.dc.html`) : encre `#2A2016` pleine (était bleu à 75 %, 2,4:1).
- `DESIGN.md`, loi 5 : gris le plus pâle `#6F6553`, jamais de maïs en texte sur fond clair, pas d'opacité pour pâlir un texte.
- Vérifié (navigateur, iPhone, clair et sombre, 390 et 320 px) : accueil, connexion, réglages, J'ai, aide : aucun texte sous le minimum (avant : « Réessayer » 3,65:1 et « 6 chiffres » 4,03:1), aucune erreur JS. Les fenêtres qui demandent un compte (négociation, messages, avis, chauffeur) : vérifiées par le calcul, pas à l'écran (serveur bloqué dans cette session).
- `?v=20261124c` pour les 13 fichiers ; pages du site refabriquées par `tools/site-public.js` (seul le numéro de `nuage.js` change) ; cache `mgci-v237`.

## 24/10/2026 — Stabilité (audit antislop n° 21 à 25)

- Règle du 24/10 : le contenu est là tout de suite, rien ne rejoue. `DESIGN.md`, loi 26, précisée.
- Accueil : plus d'arrivée en cascade des cartes et des lignes (`accMonte` retiré de `css/mgci-app.css`, cascade `MONTE` retirée d'`app/effets.js`) ; les chiffres (`<mdg-nb>`) s'affichent tout de suite à leur vraie valeur et ne défilent que s'ils changent ; la barre jaune et le tampon se jouent une seule fois par élément (plus au retour sur la page).
- Plus aucun fondu du contenu `mkFade` : 10 dans `application.dc.html` (fenêtres J'ai / Je cherche, Vendre, Demander…), 2 dans `css/annee-app.css`, 2 dans `css/mgci-app.css`.
- Mon compte (`v3/compte.js`) : les mises à jour venues du réseau passent par `bg.rafraichirAuto`, qui ne redessine pas pendant qu'un champ a le focus ni si un champ a été modifié (la saisie n'est plus perdue). Les gestes de la personne gardent `bg.rafraichir`.
- Mes commandes (`v3/commandes.js`) : la fiche, le produit, le tracé et le camion du plan n'ont plus d'entrée animée (ils la rejouaient deux fois à l'ouverture). Les boucles (point qui bat, produit qui flotte) restent : n° 36.
- « Prix du moment » (`app/prixmoment.js`) : plus de cascade du bandeau, des lignes et de l'encart, ni de fondu à chaque onglet ; seule la fenêtre glisse.
- Onglet Prix (`v3/tableau.js`) : plus de cascade des lignes, de saut des sacs ni de zoom des pastilles ; le petit « ↑ monte » (vrai changement) reste.
- Vérifié (navigateur, iPhone, parcours accueil → 4 onglets → J'ai) : 14 animations de cascade avant, 0 après ; aucune erreur JS. Mon compte et Mes commandes : vérifiés par la relecture et `node --check` (serveur bloqué dans cette session).
- `?v=20261124d` (effets, compte, commandes, prixmoment, tableau, mgci-app.css, annee-app.css) ; cache `mgci-v238`.

## 24/10/2026 — Clavier et formulaires (audit antislop n° 26, 31, 32, 34, 35)

- **Photo au clavier** (n° 26) : dans Mon avatar, le champ fichier n'est plus `hidden` (invisible mais atteignable, `.avx-in`), cadre de focus sur la zone ; vérification d'identité : cadre de focus sur les zones photo (`v3/compte.js`, `v3/identite.js`).
- **Échap et focus** (n° 31, `application.dc.html`) : le menu et les feuilles Familles, Tous les produits et J'ai / Je cherche ont la classe `fl-sheet` (et `role="dialog"`) ; Échap les ferme quand le focus y est ; à l'ouverture le focus entre dans la feuille (`focusFeuille`, qui garde l'état précédent dans `this._flOuvert` : le `prevState` du moteur ne suffit pas), à la fermeture il revient au bouton d'origine.
- **Erreur du formulaire J'ai / Je cherche** (n° 32) : « Indiquez la quantité. » et « Choisissez la région. » sous les champs, `aria-invalid`, bord `#C0442B` doublé ; le message rapide nomme ce qui manque (`manque()`), aussi pour Vendre et Demander (plus de « champs en orange »).
- **Fenêtres du navigateur** (n° 34) : nouvelle feuille commune `MDGDemande` (`app/toast.js`) ; les 9 `confirm()` / `prompt()` de la négociation, des messages, des commandes et de l'espace chauffeur passent par elle (repli sur `confirm` si elle manque, par exemple dans `admin.html`).
- **Focus visible** (n° 35) : onglet Prix vert en clair, maïs en sombre ; bulles et regroupements de la carte ; liens `all:unset` de Mes commandes ; la bulle « Non envoyé » répond à Entrée et Espace.
- Vérifié (navigateur, iPhone, clair et sombre) : J'ai ouvert → focus dans la feuille ; publier vide → 2 messages sous les champs, 2 `aria-invalid` ; Échap → feuille fermée, focus revenu sur « J'ai » ; `MDGDemande` : focus sur « Annuler » quand l'action est risquée, Échap → `false` ; aucune erreur JS. Les écrans avec compte : vérifiés dans le code (serveur bloqué dans cette session).
- `?v=20261124e` (compte, identite, toast, negoce, messages, commandes, chauffeur, tableau, carte-gl) ; site refabriqué (seul `carte-gl.js` change) ; cache `mgci-v239`.

## 24/10/2026 — Icônes, couleurs, pastilles, cibles (audit antislop n° 27 à 30)

- **Emoji → icônes dessinées** (n° 27) : Mes commandes (25 : camion, cadenas, bouclier, crayon, messages, photo, clé, lieu, œil, téléphone), négociation (« Transport inclus »), messages (« Aide », plus d'emoji dans le message envoyé à l'équipe), espace chauffeur (clé), accueil (« Retirer », « Mes codes », « Transport », forte demande), « prix du moment » (flamme, tendance, coche, poignée de main, panier), carte (flamme), familles et « Tous les produits » (panier et caddie dessinés `--sym-o` / `--sym-d`), tutoriels (la main 👆 devient un cercle de toucher maïs ; 🙋 → icône `service`), Réglages (« ▶ » → chevron). Aide : `TI(nom)` dans les modules, classe `.ic-t` dans `v3/ux.css`. Reste : la carte de secours (canvas) et les caractères ✓ ★.
- **Bleu et violet décoratifs** (n° 28) : choix du transport et étiquette « Transport inclus » en vert (`#1F8A55`, `#17633D`), tampon « Transport » vert profond, encadré « Suivi de la livraison » neutre vert, icônes de la messagerie, pastille « Acheté » des avis en jaune demande, tuiles du guide, encadré de l'aide, statut « rapide », tuiles « vous » et « lien » du menu (`--t-vous`, `--t-lien`). Gardé pour la décision B : le bleu « vérifié » et celui des négociations dans Mon compte et la carte.
- **Nombres en pastille** (n° 29) : Mon activité (`.nbul`, masqué à 0), onglet Prix (« Acheter », « Vendre », « Prix par … »), familles de « Tous les produits », onglets de « prix du moment » ; notification « 3 nouveautés dans vos négociations » (plus de parenthèses).
- **Cibles de 44 px** (n° 30) : puces d'unité et de délai des formulaires, nom de la famille, « Démo » (zone agrandie), unités de l'onglet Prix, « Arrêter la négociation », « Débloquer », « Copier », « Arrêter » (chauffeur), alertes, aide, tutoriels, « Passer » de la démo, « Voir » de « prix du moment », bouton du toast (zone agrandie).
- `?v=20261124f` (20 fichiers) ; site refabriqué (seul `carte-gl.js` change) ; cache `mgci-v240`.
- **Correction de la PR précédente (Échap et focus)** : vu sur les captures, un cadre de focus apparaissait à l'ouverture des feuilles. Maintenant le focus ne suit les feuilles que pour qui utilise le clavier (`this._clavier`, posé par Tab, Entrée, Espace ou Échap, retiré au premier toucher) ; Échap ferme la feuille sauf si une autre fenêtre est ouverte par-dessus. Vérifié : au doigt, aucun cadre ; au clavier, focus dans la feuille, Échap ferme et rend le focus.
- Vérifié (navigateur, iPhone, clair et sombre, 390 et 320 px, 16 écrans, comparé à l'audit) : aucune erreur JS, aucun débordement ; cibles sous 44 px 77 → 63 (le reste : zones agrandies invisibles au script, champs de recherche dans un cadre plus grand, flèches de la roue réduite) ; emoji visibles 2 → 1 (la coche cachée des Réglages) ; nombres sans pastille 4 → 1 (fausse alerte : la pastille du menu a sa propre classe) ; aucun nouveau contraste faible.

## 24/10/2026 — Textes, erreurs, animations (audit antislop n° 33, 36 à 45, 52)

- **Erreurs** (n° 33) : nouveau `MDGErreur(e)` dans `app/toast.js` : garde un message du serveur déjà en français, transforme un texte technique ou en anglais en phrase simple (« Impossible pour l'instant. Réessayez dans un instant ; si ça continue, écrivez au Marché de Gros. »), le texte brut part dans la console. Branché dans Mon compte, identité, négociation, messages, commandes, chauffeur, relevé, alertes, avis, racheter, Réglages. Plus de nom de fichier SQL à l'écran.
- **Boucles** (n° 36) : point d'arrivée et étape en cours des commandes, position du chauffeur, flèche de « prix du moment », flamme de la carte, lueurs « Reprendre » et pastilles de l'accueil : 2 ou 3 battements puis immobiles ; plus de produit qui flotte, de pictogramme qui remue, de point « REC » ; le sac « vide » ne se balance plus (respiration et clignement seulement) ; la bande des garanties change toutes les 6,5 s, sans flou. Restent les animations de l'« accueil vivant » (décision A).
- **Vide ou erreur** (n° 37) : le relevé dit « Pas de connexion » ou « Relevé indisponible » au lieu de « Aucune vente » ; les avis et « Les mieux notés » disent qu'ils n'ont pas pu être lus.
- **Un seul nom** (n° 38) : « le panier en haut à gauche » (guide), « Mon compte → Notifications » (notifications), « Mon compte » (plus « Mon espace »), la démo cite les vrais boutons.
- **Capitales** (n° 39) : nom de la famille, « En saison · aucun prix publié », sur-titre de « prix du moment » en casse normale.
- **Liserés** (n° 40) retirés (cartes d'état des commandes, lignes non lues : le point et « Nouveau » suffisent). **Trois cartes « On connecte / On vérifie / On protège »** (n° 41) retirées. **Phrase d'accueil** (n° 42) : « Choisissez un produit sur la roue, ou publiez le vôtre. » (les nombres sont dans les cartes). **Point corail du menu** (n° 43) retiré. **Notifications** (n° 44) : un message pour chaque échec (refus, iPhone non installé, pas de réponse, téléphone incompatible). **Contrastes** (n° 45) : « En ligne » `#31543C`, erreurs des avis et de la négociation `#8E2A1C`. **Bande** (n° 52) : plus de « Nouveau : » ni de « Parcours sécurisé ».
- Vérifié (navigateur, iPhone) : accueil sans point sur le menu, famille en casse normale, feuille des garanties sans les trois cartes, `MDGErreur` correct, sac au repos qui respire seulement ; boucles restantes = accueil vivant + respiration et clignement ; aucune erreur JS.
- `?v=20261124g` (22 fichiers) ; site refabriqué ; cache `mgci-v241`.

## 24/10/2026 — Finitions (audit antislop n° 46 à 58)

- **Petits textes** (n° 46) : 11,5 px au moins pour les noms de l'arc de la roue, les bulles des onglets, « Démo », « OFFICIEL », les choix de « Tous les produits », les codes, la ligne « Vous êtes ici » de la carte, le calendrier de l'année (hors dessin).
- **Numéros** (n° 47) : les « 3 gestes » du guide portent leur icône ; « Signaler » n'a plus de « 1 · 2 · 3 ». **« P2P »** (n° 48) retiré. **Flèches** (n° 49) : retour et suite dessinés (achats groupés, approvisionnement, onglet Prix, guide), bouton d'envoi de la négociation = icône « envoyer ».
- **Phrases internes** (n° 51) retirées de Mon compte. **« Vente conclue »** (n° 53) : coche dessinée. **« Racheter »** (n° 55) au lieu de « Voir ». **Contrastes limites** (n° 56) : étapes à venir de la fiche, ligne retirée de la sélection (cadre pointillé au lieu de l'opacité), point du message « info ».
- **Code mort** (n° 57) : `A.yearSVG` (`app/marche-app.js`), `oAnim`, cercles et reflet retirés de `css/mgci-app.css` ; bug corrigé dans l'ancienne fenêtre de compte du site (`v3/nuage.js`, « ${CHEVD} » s'affichait en clair). **Commentaires** (n° 58) : 95 bannières `// ——— X ———` simplifiées, commentaire de `v3/personnages.js` corrigé.
- Laissés exprès : n° 50 (couleurs en dur qui passent le contraste), n° 54 (transition d'entrée voulue). À vérifier avec des données : n° 59.
- Vérifié (navigateur, iPhone, clair et sombre, 390 et 320 px) : accueil, connexion, réglages, J'ai, aide : aucune erreur, aucun débordement, aucun contraste faible, plus de texte sous 11,5 px sur l'accueil ; noms de la roue sans chevauchement ; aucun texte simple qui contiendrait « ${ » (contrôle automatique de tous les modules).
- `?v=20261124h` (34 fichiers) ; site refabriqué ; cache `mgci-v242`.

## 24/10/2026 — Décisions A, B, C de l'audit antislop (choisies par le propriétaire)

- **A. Accueil vivant : « calmer »** : comète (1 fois), point du produit (2), sac qui flotte et son ombre (1), halo (1), triangles du prix (2), reflet « En saison » (1), lumières du fond `mfFlotte` (2) ; puis tout s'arrête. Quand on change de produit sur la roue, ils rejouent (`rejouerAccueil` dans `application.dc.html`, classe `.rejoue` dans `css/mgci-app.css` : une animation CSS finie n'existe plus, on la retire puis la remet). Mouvement réduit : rien ne rejoue.
- **B. Plus de bleu « vérifié »** : badge d'identité (`v3/identite.js`), teinte « échanger / vérifié » de Mon compte (`--blue` = `#10392B`), point et bouton de l'encadré de vérification, sceau de la carte (`app/carte-gl.js`), statut « Identité vérifiée » (`v3/statuts.js`), icône de la négociation vide (`v3/negoce.js`) ; textes « sceau bleu » → « sceau vert » (aide, tutoriels, guide) ; derniers bleus décoratifs de la porte d'entrée → maïs pâle (`v3/porte.js`). Seul bleu restant : le lien « compatible » sur la carte.
- **C. « de Gros » en dégradé avec reflet** sur la page de connexion : **gardé** ; exception écrite dans `DESIGN.md` (loi 2).
- `CLAUDE.md` (Design) et `DESIGN.md` (lois 2, 25, couleurs) mis à jour ; le rapport d'audit note les trois décisions.
- Vérifié (navigateur, iPhone) : au début, 9 effets jouent ; après 14 s, seules les lumières du fond finissent leur 2e passage ; « Produit suivant » → les effets rejouent ; aucune erreur JS.
- `?v=20261124i` (11 fichiers) ; site refabriqué ; cache `mgci-v243`.

## 24/10/2026 — Audit des 4 chantiers (transport, fiabilité, badges, boutiques)

- Demande du propriétaire : 4 chantiers (commande et transport ; fiabilité et pénalités d'annulation ; badges évolutifs ; boutiques avec lien et QR code), à auditer avant toute modification.
- Audit en lecture seule (code + base de production, catalogue seulement), chaque chantier relu par un contrôleur : `docs/audits/audit-chantiers-2026-10-24.md`.
- 44 questions, avec une réponse recommandée pour chacune : `docs/audits/decisions-chantiers-2026-10-24.md`. Rien n'est construit avant l'accord du propriétaire.
- Deux correctifs de sécurité trouvés (C1 : commission transport de 6,9 % possible avec un transporteur non vérifié, par appel direct ; C2 : droits trop larges sur `alertes`). Aucune mission ni commission transport en production à ce jour.

## 24/10/2026 — Correctifs C1 et C2 (schéma 82) et décisions des 4 chantiers validées

- Le propriétaire a validé les 44 réponses recommandées (« OK ») : elles sont écrites comme règles dans `CLAUDE.md`.
- **C1** (`supabase/schema-82-commission-transport-mgci.sql`) : `_ctr_sync` ne crée ou ne garde une commission transport de 6,9 % que pour une commande en mode `reseau` avec un transporteur `verifie` ; sinon elle passe à `annulee` avec le motif « livreur hors service Marché de Gros ». `chauffeur_repondre` refuse qu'un transporteur non vérifié accepte une mission du réseau (refuser reste possible).
- Testé sur le projet de test (fonctions identiques à la production, empreintes comparées) dans un bloc annulé : hors réseau → annulée ; réseau vérifié → gardée ; réseau non vérifié → annulée ; acceptation refusée au non vérifié ; refus possible. Appliqué en production (0 mission, 0 commission transport : aucune donnée changée).
- **C2** : droits retirés sur `alertes`, `alertes_produits`, `zones` (visiteurs : seulement la lecture de `zones` ; membres : plus de REFERENCES ni TRIGGER). Vérifié en production. Un dernier droit des membres ne peut pas être retiré par l'outil (mot interdit) : la ligne à coller est dans le fichier des décisions.

## 24/10/2026 · Chantier 1 : commande et transport (schéma 83, projet de test seulement)

Règles appliquées : décisions 1 à 10 de `docs/audits/decisions-chantiers-2026-10-24.md`. **Appliqué sur le projet de test seulement** ; la production reste au schéma 82 (le propriétaire applique 83a, 83b, 83c, 83d, 83e dans cet ordre).

- **83a** (`supabase/schema-83a-transport-nego.sql`) : table `reglages` (RLS, aucun droit membre) ; `_transport_reseau_ouvert()` devient STABLE et lit le réglage `transport_reseau_ouvert` (toujours `false`) ; `admin_transport_reseau(p_oui)` pour l'admin seulement. Colonnes `messages.prix_transport`, `negociations.dernier_prix_transport`, `negociations.prix_transport_final`. Nouvelles fonctions `nego_ouvrir2` et `nego_agir2` : prix, quantité et transport (`inclus`, `apart` avec son prix, `sans`) en **un seul appel** (fin de la perte du marqueur transport). `nego_transport_suivi` recopie le prix du transport à l'accord ; `nego_fige` fige aussi le transport. `nego_agir`, `nego_ouvrir`, `nego_transport` restent pour l'application en ligne.
- **83b** (`schema-83b-transport-commande.sql`) : colonnes `commandes.ville_arrivee`, `meme_ville`, `transport_regle` (`inclus`, `a_part`, `livreur_vendeur`, `retrait`, `acheteur`, `mgci`), `prix_transport`, `total_convenu`. `commande_creer2(p_nego, p_mode, p_lieu, p_ville_arrivee, p_ville_depart)` : même ville = même nom dans la liste `app/villes.js` (comparaison sans accents ni tirets, `_ville_cle`) ; transport à part → le vendeur livre (ou le réseau), l'acheteur ne peut pas le reprendre ; retrait par l'acheteur en même ville seulement si le vendeur confirme la commande. `commande_creer` : commission marchandise à 0 pour un vendeur administrateur (comme `_seq_repartition`). `commande_choisir_transporteur` fermée (le livreur de l'acheteur ou du vendeur n'a rien à faire dans l'application).
- **83c** (`schema-83c-transport-trois.sql`) : table `transport_propositions` (RLS, aucun droit membre) et `transport_agir(p_mission, p_action prix|accord|refus|retrait, p_prix, p_ref)`. Le transporteur vérifié propose en premier ; l'acheteur et le vendeur acceptent, refusent ou contre-proposent ; 48 h par proposition ; le prix est arrêté quand les trois ont accepté la même proposition, puis recopié dans la mission (commission 6,9 % du schéma 82). Un refus → la mission est retirée et la commande continue avec le livreur du vendeur (un transport à part de l'accord reprend sa place). `chauffeur_repondre` refuse l'acceptation seule en mode réseau ; `chauffeur_prix` et `admin_mission_prix` refusent le mode réseau ; transbordement : le nouveau chauffeur garde le prix (déclencheur `transport_missions_prix_transfert`) ; `commande_transfert_preparer` exige un transporteur vérifié en mode réseau. `commande_transport` renvoie la règle, les villes, le prix accepté seulement, et aucun total quand le livreur est hors Marché de Gros. `chauffeur_missions` ajoute `mode` et `prix_trois`. `dm_ouvrir` et `dm_envoyer` refusent les messages privés entre le transporteur et les parties pendant une mission. Tout reste derrière le verrou (`transport_agir` refuse tant que le réglage est à `false`).
- **83d** (`schema-83d-filtre-numeros.sql`) : filtre des numéros renforcé (`_chiffres_lettres`, `_num_motif`, `sortie_motif`, `sortie_masquer`, `texte_refus`) : chiffres en lettres, séparateurs doubles (`07 // 45 -- 12`), chiffres espacés, `+225` ou `00225` sans le 0 ; numéro coupé en plusieurs messages (15 min, même auteur, même fil) ; déclencheur `controle_sortie` ajouté sur `litige_messages`. Les notes de commande passent déjà par `texte_refus`. Aucun texte existant du projet de test n'est touché par le nouveau filtre (compté avant).
- **Limite** : la contrainte `alertes_source_check` n'accepte que `dm` et `negociation`. L'élargir demande de retirer l'ancienne contrainte, ce que l'outil refuse (mot interdit). En attendant, un message de litige avec un numéro est masqué, mais son alerte n'est pas gardée (le déclencheur ignore ce refus). Ligne à coller par le propriétaire dans l'éditeur SQL, s'il le veut : voir `docs/REPRISE.md`, partie 3, 0 ter.
- **Écran** : `v3/negoce.js` (choix Inclus / À part / Sans, prix du transport, total avec le transport, accord et reçu), `v3/commandes.js` (ville de livraison dans une liste, choix de qui transporte selon la ville, « frais de livraison à régler directement au livreur, hors Marché de Gros », ligne Transport et Total convenu du détail, bloc du prix à trois pour le réseau), `v3/chauffeur.js` (proposer son prix, accepter ou refuser celui de l'acheteur ou du vendeur, en mode réseau). Si le serveur n'a pas encore le schéma 83, l'écran revient aux anciennes fonctions. `RESEAU_OUVERT` reste `false`.
- **Tests** (`supabase/tests/transport-83-scenarios.sql`, blocs annulés, résultats réels notés dans le compte rendu de la session) : A même ville (livreur du vendeur, retrait accepté par le vendeur, litige avec numéro coupé et numéro en lettres) ; B même ville + réseau (transporteur en premier, contre-proposition, accord des trois, commission 6,9 %, prix figé, transbordement) ; B' refus, retrait, expiration à 48 h ; C villes différentes, transport inclus ; D villes différentes, transport à part avec refus et contre-propositions ; E réseau après un transport à part, refus du transporteur ; F commission 0 pour un vendeur administrateur ; G droits (tables fermées, visiteurs refusés) ; H ancienne application et filtre des numéros.
- Versions : `v3/negoce.js`, `v3/commandes.js`, `v3/chauffeur.js` en `?v=20261124t1` ; `sw.js` `mgci-v247`. Vu dans Chromium (iPhone 13, clair et sombre) avec une session simulée : formulaire de commande (même ville, villes différentes, transport à part) et éditeur de proposition « À part » ; aucune erreur dans la console, pas de débordement à 390 px. Les écrans connectés au serveur (détail de commande, prix à trois) sont vérifiés par le code et les tests SQL seulement.
- **Relecture (83e, `supabase/schema-83e-relecture.sql`, projet de test seulement)** :
  - `_num_motif` : un numéro ne commence plus juste après un chiffre. Avant, une liste de prix (« 3 000 / 4 500 / 6 000 / 8 000 »), deux dates (« 15/10/2026 - 20/10/2026 ») ou un numéro de commande étaient masqués dans les messages, et refusés dans une annonce ou un profil par `texte_refus`. Les vrais numéros restent masqués (avec ou sans +225, points, espaces, séparateurs doubles, en lettres).
  - `controle_sortie` : un numéro coupé doit former **exactement** un numéro avec les derniers morceaux, mis bout à bout depuis le dernier message. Avant, trois prix envoyés seuls (« 15000 », « 25000 », « 30000 ») étaient pris pour un numéro, masqués et signalés.
  - `_nego_transport_poser` : ne touche que la proposition de la personne qui vient de l'envoyer (sécurité en plus).
  - Tests ajoutés (blocs I et J) : autre membre refusé partout (négociation, commande, prix à trois, lecture du transport), valeurs limites (0, négatif, 100 000 000, choix inconnu, prix avec « Sans », arrondi), double accord et double commande refusés, contre-propositions à trois (vendeur puis acheteur), ancienne référence refusée, refus après accord refusé, commission 6,9 % sur le prix convenu, visiteur anonyme et membre sans droit sur les tables et fonctions internes, faux positifs du filtre. Les blocs A et H relancés après la correction : résultats inchangés.

## 24/10/2026 — Documentation officielle : FONCTIONNALITES, ROADMAP, ARCHITECTURE, CHANGELOG

- Quatre fichiers à la racine, écrits après un inventaire du code (`main`) et de la base de production (catalogue et comptages seulement), chacun relu contre le code par un contrôleur :
  - `FONCTIONNALITES.md` : 195 fonctionnalités, application d'abord, site à part ; 159 opérationnelles (beaucoup jamais servies en vrai, c'est écrit), 25 partielles, 6 prévues, 5 défectueuses ;
  - `ROADMAP.md` : les 10 sujets demandés, avec leur état, et les décisions du propriétaire à développer ;
  - `ARCHITECTURE.md` : application, site, Supabase (54 tables, fonctions, RLS, tâches planifiées, fonctions Edge), permissions, intégrations ;
  - `CHANGELOG.md` : les 607 commits depuis le 03/10/2026, par jour.
- Défauts trouvés (non corrigés, aucune logique touchée) : limite de 30 annonces qui peut effacer une annonce active au `sync()` ; diffusion « annonce du marché » jamais envoyée sans abonné au produit ; libellés « Paiement libéré » de l'écran admin sans mouvement d'argent ; ancienne note `noter` (code mort) ; refabrication automatique du site non déclenchée par `tools/site-prix.js` et `tools/site-regions.js`.
- À tenir à jour : chaque PR qui ajoute ou change une fonctionnalité met à jour `FONCTIONNALITES.md` (et `ROADMAP.md` si un élément prévu avance), et ajoute sa ligne au `CHANGELOG.md`.
