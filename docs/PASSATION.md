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
- **Entrée de l'administrateur** : petit point presque invisible en bas à droite de `maintenance.html` → interrupteur « Entrer en tant qu'admin » → `index-v3.html?admin=1`.
  Le site reste caché sous un écran « Espace administrateur » tant que le serveur n'a pas confirmé `est_admin` pour le compte connecté (vérifié à chaque ouverture). Un compte non admin est renvoyé à la maintenance.
  Le drapeau `mdg-site:admin` (localStorage) ne sert qu'à l'aiguillage ; la décision vient toujours du serveur. `admin.html` garde sa propre protection.
- Pour rouvrir le site à tous : retirer le bloc « SITE EN MAINTENANCE » en tête d'`index-v3.html`, le cache `#mdgGarde` et sa vérification (après `v3/nuage.js`), et remettre `index-v3.html` dans `index.html`.
