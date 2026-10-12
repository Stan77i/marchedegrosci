# Rapport — Application mobile Marché de Gros
10 octobre 2026 · fichier principal : `application.dc.html`

## 1. Problèmes signalés et corrections

| # | Problème signalé | Cause trouvée | Correction | État |
|---|---|---|---|---|
| 1 | Le changement de page se bloque à mi-chemin (L'année du marché, Catégories → fiche, etc.) | Les pages n'avaient pas d'ordre d'empilement : une page placée plus bas dans le code restait peinte par-dessus la page qui venait d'arriver. | Ordre d'empilement donné par l'historique de navigation ; la page qui part passe au-dessus pendant son retour ; glissements en Web Animations, annulés au bout de 650 ms au plus ; pages hors historique masquées. | Corrigé, testé dans l'aperçu (Catégories → Maïs grain → retour ; Année → Igname → retour ; bouton et historique) |
| 2 | L'app « se tire », zoome, glisse | Champs en moins de 16 px (iOS zoome au toucher) ; page non verrouillée ; clavier qui pousse la page | Page verrouillée (sans rebond ni zoom), champs à 16 px, l'app se réduit à la zone visible quand le clavier s'ouvre, plus d'ouverture automatique du clavier | Corrigé, **à confirmer sur iPhone** |
| 3 | Écran vide ou saccadé pendant le glissement | Filtre d'assombrissement coûteux sur iPhone ; page sortante démontée trop tôt | Filtre retiré, glissement sur le GPU, la page sortante garde son contenu jusqu'à la fin | Corrigé |
| 4 | J'ai / Je cherche bougent sur l'accueil | Hauteur du nom de produit variable | Zone de nom de hauteur fixe (2 lignes au plus, taille calculée sur la largeur réelle) ; la roue se réduit selon la hauteur de l'écran | Corrigé |
| 5 | Le nom « Gombo séché » chevauche | Même cause que le n° 4 | Même correction | Corrigé |
| 6 | Les noms de la roue orbitale se chevauchent | Espacement fixe quelle que soit la longueur du nom | Chaque nom occupe un angle calculé d'après sa largeur mesurée, plus un écart fixe ; les noms qui sortiraient de l'écran s'effacent. Le texte garde sa taille. | Corrigé |
| 8 | Débordements (Acheter « Prix max. »…), page qui glisse de côté au toucher d'un champ | Grilles à colonnes `1fr` qui ne rétrécissent pas sous la largeur d'un champ ; iOS fait alors défiler la page de côté | 10 grilles en `minmax(0,1fr)`, champs limités à leur colonne, zones qui défilent verrouillées à l'horizontale, pages en `overflow:clip`, décalage remis à zéro | Corrigé, audit sur toutes les pages sans débordement |
| 7 | Carte trop simple | — | Nouvelle carte, voir section 2 | Livré |

## 2. Nouvelle carte (`app/carte-app.js`)
- Frontières réelles Natural Earth 1:50 000 000, pays voisins, socle en relief ; sans connexion, retour à l'ancien contour simplifié.
- Glisser, pincer, double-toucher, molette, défilement qui continue un peu en lâchant.
- La caméra recule puis zoome vers la ville touchée ou vers votre région.
- Noms des villes sans chevauchement (par ordre de priorité).
- Cercles 50 / 100 / 200 km autour de vous, distance à vol d'oiseau vers la ville touchée, échelle qui suit le zoom.
- Bouton « Me localiser » : choisit la région la plus proche de votre position.

## 3. Logo « M »
Pastille terracotta dans l'en-tête de l'accueil :
- un point orange fait le tour de la pastille en suivant la roue des produits ;
- l'anneau prend la couleur du produit choisi, et une onde part à chaque changement de produit ;
- l'anneau se dessine à l'ouverture de l'app.

## 4. Fichiers modifiés
- `application.dc.html` : navigation, empilement des pages, accueil, roue, logo, carte, clavier.
- `app/carte-app.js` : **nouveau**, la carte.
- `app/marche-app.js` : exporte le contour simplifié (`A.OUT`) pour le mode hors ligne.
- `MISE-A-JOUR.md` : journal détaillé de chaque passe.

## 5. Points ouverts
- **Tout reste à tester sur un vrai iPhone** : le clavier dans Acheter et dans J'ai / Je cherche, le pincement sur la carte, le geste de retour par le bord de l'écran (il peut encore lancer deux glissements à la suite).
- Toucher une ville sur la carte n'a pas pu être vérifié dans l'aperçu : à essayer au doigt.
- Le menu « Où êtes-vous ? » peut afficher « Où êtes-vous ? » alors que la région est enregistrée : non confirmé.
- La fiche « Maïs grain » affiche une photo de riz : erreur dans les données des images, antérieure à ces corrections, non touchée.
- Sauvegarde GitHub : pas d'envoi direct possible depuis ici ; le dossier est à déposer à la main sur le dépôt `Stan77i/marchedegrosci`, branche `main`.

---

# Rapport — Utilisation hors connexion (PWA)
11 octobre 2026

## Ce qui change pour l'usager
- Le site s'ouvre **sans connexion** sur téléphone, tablette et ordinateur, une fois visité au moins une fois avec internet.
- Il peut être **ajouté à l'écran d'accueil** et s'ouvre alors en plein écran, comme une application (icône « M » sur fond terre).
- Les offres et demandes publiées restent dans le téléphone (`localStorage`, clés `mdg-v2:offres` et `mdg-v2:demandes`, inchangées). Rien n'est envoyé à un serveur.
- **Téléphone → application, ordinateur et tablette → site web** (`index-v3.html`, restauré le 11/10/2026 après sa suppression par erreur). Règle : écran tactile dont le petit côté fait moins de 768 px = téléphone (un téléphone tourné à l'horizontale reste dans l'application). L'aiguillage est fait par `index.html`, et aussi au début de `application.dc.html` et de `index-v3.html` : ouvrir directement l'adresse de l'application sur un ordinateur affiche le site. `?ordinateur=1` force le site, `?app=1` force l'application.
- Le site web fonctionne aussi hors connexion (GSAP, Lenis, d3, React, Babel et polices dans `vendor/` et `fonts/`).

## Fichiers
| Fichier | Rôle |
|---|---|
| `vendor/` | React 18.3.1, ReactDOM 18.3.1, Babel 7.29.0, topojson-client 3.1.0, world-atlas 2.0.2 (110m, 50m), hébergés dans le projet |
| `fonts/`, `css/fonts.css` | Polices Cormorant Garamond et Jost hébergées dans le projet |
| `icons/` | Icônes 192, 512 et iPhone (180) |
| `manifest.webmanifest` | Nom, couleurs, icônes, plein écran, portrait |
| `sw.js` | Service worker : met l'application en cache, pages réseau d'abord, fichiers cache d'abord |
| `support.js` | ⚠️ 3 adresses changées (unpkg → `vendor/`). Fichier généré par l'outil de conception : à refaire s'il est régénéré |
| `application.dc.html` | Balises manifest / iPhone / service worker ; polices locales ; `<img sc-camel-src="{{ … }}">` au lieu de `src` (plus de 404 au démarrage) |
| `app/carte-app.js` | Frontières et topojson chargés depuis `vendor/` |

## À chaque mise à jour du code
Changer le numéro dans `sw.js` : `const CACHE = 'mgci-v6';` → `'mgci-v7'`, etc. Sinon les appareils gardent l'ancienne version.

## Vérifications faites (Chromium)
Téléphone, tablette, ordinateur : première visite en ligne, puis réseau coupé → accueil et carte affichés, 28 images sur 28, polices chargées, publications conservées, 0 erreur dans la console, aucune requête vers internet. Changement de version du cache → nouvelle version prise en compte.

## Points ouverts
- À tester sur un vrai iPhone (Safari) et un vrai Android (Chrome) : ajout à l'écran d'accueil, ouverture hors ligne.
- Le site doit être servi en **HTTPS** (par exemple GitHub Pages) : sans HTTPS, pas de mode hors ligne ni d'installation.
- 7 avertissements (pas des erreurs) `never resolved` restent dans la console : ils viennent de l'écran d'ouverture de la page, non modifié.

---

# Carte du site (« Le réseau ») — territoire réel
11 octobre 2026 · `v2/reseau-carte.js`

- **Géographie réelle** : frontières Natural Earth 1:50m (Côte d'Ivoire, Libéria, Guinée, Mali, Burkina Faso, Ghana et pays proches), côte avec liseré d'eau peu profonde, frontière terrestre en tirets, côte en trait plein. Repli sur l'ancien contour simplifié si la géographie ne charge pas.
- **Eau** : fleuves (Bandama, Comoé, Sassandra, Bandama blanc, Baoulé, Bagoé, Cess, Volta…) et lacs (Kossou, Buyo, Volta), Natural Earth 1:10m, domaine public, fichier `vendor/ci-hydro.json` (56 Ko). Le grain s'interrompt sur les lacs.
- **Repères** : les 14 chefs-lieux de district (géographie de référence déjà présente, `v3/marche.js`). Le nom du chef-lieu s'efface quand une offre ou une demande du district est déjà nommée.
- **Zoom qui a un sens** : du pays (avec ses voisins) jusqu'au district, pas au-delà (les positions sont au chef-lieu : plus près ne montrerait rien de vrai). Un repère dit toujours ce que l'on regarde : « Tout le pays », « Nord-ouest du pays », puis « Autour de Bouaké » ou « 40 km au sud-ouest de Bouaké », avec l'échelle en kilomètres. Le grain s'affine en approchant.
- **Gestes** : la carte continue sur son élan quand on la lâche, double-clic pour zoomer à l'endroit pointé ; animations coupées avec « réduire les animations ».
- Non utilisées volontairement : les limites administratives Natural Earth (19 anciennes régions, pas les 14 districts actuels : elles auraient été fausses) ; la bibliothèque mapcn (React + tuiles en ligne : incompatible avec le site statique et le hors connexion).
- `sw.js` : `vendor/ci-hydro.json` en cache, `CACHE = 'mgci-v7'`.

---

# Passe sur tout le produit — 11 octobre 2026 (suite)
- **Lecture au défilement** (`v3/flou.js`) : une section ne se floute plus pendant qu'on la lit ; l'effet de profondeur ne joue que quand elle quitte l'écran. Les listes du catalogue et les offres d'une fiche restent nettes.
- **Petites cartes sur le vrai territoire** (`v3/terre.js`, nouveau) : la mini-carte du catalogue et celle de « Demander » dessinent le contour réel, les voisins et les lacs ; le grain ne tombe que sur la terre. Même géographie que la grande carte.
- **Langage commun** : la légende des encarts (fiche produit, producteur) reprend les marqueurs (cercle vert = offre, carré jaune = demande, trait bleu = compatibles, votre lieu) ; « Le carré jaune marque votre demande ».
- **Mes offres / Mes demandes** : plus de « 800 kg · , » ni de « le Invalid Date » — le produit, le lieu et la date sont retrouvés même pour une offre publiée depuis l'application (même stockage, autres champs).
- **Prix du marché** (`v3/pages.js`) : d'abord « Ce qui a un prix aujourd'hui » (prix observés, puis prix vendeurs), avec pour chacun ce qui manque pour un prix du marché (« Encore 3 prix et 1 vendeur », jauges sur les seuils réels 5 prix / 3 vendeurs / 30 jours) ; puis « Pas encore de prix » en étiquettes par famille, chacune menant au produit, et une invitation à publier son prix. Fini le mur de « Pas assez de données ».
- **Carte de l'application** (`app/carte-app.js`) : fleuves et lacs, côte en trait plein et frontière en tirets, repère « où suis-je » au-dessus de l'échelle, zoom borné au district.
- `sw.js` : `v3/terre.js` en cache, `CACHE = 'mgci-v9'`.
- **Accueil** (`v3/hero-ivt.js`) : sous le prix, une petite carte du vrai territoire montre où le produit choisi est proposé (cercles verts) et cherché (carrés jaunes) ; elle mène à la grande carte filtrée sur ce produit. Elle n'apparaît que s'il existe au moins une offre ou une demande.
- **Roue des produits sur tablette** : les noms étaient coupés (« OMAT » pour « TOMATE ») ; leur largeur est maintenant mesurée avec la police réelle, en capitales espacées, et recalculée quand les polices sont chargées. `sw.js` : `CACHE = 'mgci-v10'`.
- **Fiche produit : offres et carte se répondent** : survoler (ou parcourir au clavier) une offre l'allume sur la carte ; survoler un point de la carte met l'offre en avant dans la liste ; toucher un point sélectionne l'offre et la fait venir à l'écran si elle est cachée. (`v2/reseau-carte.js` : rappel `onHover`, sans changer le reste de l'API.) `sw.js` : `CACHE = 'mgci-v11'`.

---

# Annonces partagées entre tous les téléphones (Supabase, formule gratuite) — 11 octobre 2026
- **Base** : projet Supabase `mgci` (Paris). Schéma dans `supabase/schema.sql` (à coller une fois dans « SQL Editor ») : tables `offres`, `demandes`, `signalements` ; lecture publique ; publication réservée aux comptes ; chacun ne modifie que ses annonces ; 30 annonces actives par compte ; 3 signalements de comptes différents masquent une annonce.
- **Compte** : numéro de téléphone + code secret à 6 chiffres (pas de SMS, donc aucun frais). Bouton « Mon compte » dans l'en-tête du site, section « Compte » dans le menu de l'application. Pas encore de récupération du code par SMS.
- **Module commun** `v3/nuage.js` (site et application) : lit les annonces de tous et les garde en cache (visibles hors connexion) ; envoie mes annonces (file d'attente hors ligne, envoi au retour du réseau) ; retire du serveur une annonce supprimée sur le téléphone ; propose de se connecter après une publication faite sans compte.
- « Mes annonces » restent dans `mdg-v2:offres` / `mdg-v2:demandes` (inchangé) ; le cache des autres est séparé (`mdg-nuage:*`). « Mes publications » n'affiche que les siennes.
- **Signaler** sur chaque annonce venant d'un autre téléphone (site et application).
- Textes mis à jour (Vendre, Demander, J'ai / Je cherche, pied de page, Confiance) ; la page Confiance du site ne parle plus d'« exemples ».
- Les photos ne sont pas encore envoyées (elles restent sur le téléphone). `sw.js` : `v3/nuage.js` en cache, `CACHE = 'mgci-v12'`.
- **Base installée le 11/10/2026** (connecteur Supabase) et vérifiée : audit de sécurité sans avertissement ; un visiteur lit mais ne peut pas publier ; un compte publie, republie sans doublon, mais ne peut pas publier au nom d'un autre. Droits par défaut trop larges retirés, fonctions automatiques non appelables depuis le site (section « Durcissement » de `supabase/schema.sql`).
- Testé depuis un vrai téléphone le 11/10/2026 : compte créé, offre publiée et visible dans la base.

---

# Négocier un prix, code de secours, tableau de bord — 11 octobre 2026
- **Proposer un prix** (`v3/negoce.js`, site et application) : sur une annonce venant d'un autre compte, « Proposer un prix » ouvre une négociation. Raccourcis −5 / −10 / −15 % (ou + pour répondre à une demande), écart affiché par unité et sur toute la quantité, message facultatif. L'autre partie accepte, refuse ou fait une contre-proposition ; on peut aussi s'écrire. À l'accord : prix convenu, total, boutons Appeler / WhatsApp. Rappel affiché : un accord n'est pas un paiement.
- **La règle des prix** : en haut de chaque négociation, le prix affiché et le dernier prix de chaque partie (cercle vert = vendeur, carré jaune = acheteur, comme sur la carte) ; à l'accord, ils se rejoignent sur la ligne bleue « compatibles ».
- **Mes négociations** : dans « Mon compte » (site) et le menu « Compte » (application), classées « À vous de répondre », « En attente de réponse », « Accords conclus », « Arrêtées ». Nombre de réponses non lues sur le bouton du compte du site ; message quand une réponse arrive. Les réponses sont relues chaque minute (toutes les 7 s quand une négociation est ouverte).
- **Code de secours** (12 caractères, remis une seule fois à la création du compte, ou depuis « Mon compte » pour les comptes déjà créés) : « Code oublié ? » permet de choisir un nouveau code secret sans SMS. Gardé chiffré : personne ne peut le relire. 5 essais ratés par heure au maximum ; après usage, un nouveau code de secours est remis et les autres connexions sont fermées.
- **Nouveau téléphone** : à la connexion, mes annonces publiées ailleurs reviennent dans « Mes publications » (pour les modifier ou les retirer d'ici). Une annonce modifiée sur le téléphone repart toute seule vers la base.
- **Tableau de bord** `admin.html` (lien dans « Mon compte » pour l'administrateur) : pouls du marché sur 14 jours (une marque = une annonce réelle), chiffres clés, annonces à traiter (signalées ou masquées : rétablir, masquer, supprimer), toutes les annonces (filtres, recherche), comptes (numéro, inscription, dernière connexion, annonces, signalements ; nouveau code secret pour un vendeur qui appelle), négociations (lecture des échanges). La base refuse tout aux comptes qui ne sont pas dans `public.admins`.
- **Base** : `supabase/schema-2.sql` (tables `admins`, `secours`, `negociations`, `messages` ; écritures seulement par des fonctions qui vérifient les règles). Installé et vérifié par le connecteur, sauf les 2 fonctions qui changent un code secret, que Supabase réserve au propriétaire : **`supabase/a-lancer-dans-sql-editor.sql`** (à coller dans SQL Editor, avec votre numéro pour devenir administrateur).
- Vérifié (transactions annulées) : un acheteur propose, le vendeur contre-propose, l'acheteur accepte → accord au bon prix ; personne ne peut proposer sur sa propre annonce, accepter son propre prix, accepter une proposition refusée, écrire dans la négociation des autres ni la lire ; un visiteur sans compte ne peut rien appeler ; un compte ordinaire n'a pas accès aux fonctions d'administration.
- Bug corrigé : le nom de l'agent partait vers la base sous la forme « [object Object] ».
- `sw.js` : `v3/negoce.js` en cache, `CACHE = 'mgci-v13'`.

---

# Négociation complète, langage sonore, pages claires réparées — 12 octobre 2026
**Pages restées claires** (elles n'avaient pas le fond sombre des autres) : Acheter avec une recherche (« 1 vendeur », « Tomate »…), fiche producteur, Comment ça marche, Aide producteur, Confiance, page introuvable. Elles passent au sombre avec une seule couche de réglages (`.dk` dans `v3/pages.css`) qui inverse l'échelle des neutres : cartes d'offre, puces, filtres, carte et notes suivent sans être réécrits. Vérifié sur ordinateur (1440) et tablette (820).

**Négociation** (mission « Négociation commerciale intelligente ») — base : `supabase/schema-3.sql` (installé et vérifié) ; écran : `v3/negoce.js`.
- Une proposition = **prix + quantité + conditions**. Elle attend 48 h puis **expire** (la base refuse d'accepter une proposition expirée).
- Sort de chaque proposition, gardé dans l'historique : en attente, acceptée, refusée, **retirée** (par son auteur tant qu'il n'y a pas de réponse), remplacée (contre-proposition), expirée.
- L'acceptation passe par un **résumé** (quantité × prix = total, conditions) puis « Confirmer l'accord ». L'accord est un **instantané figé** (prix, quantité, conditions, date) : la base refuse toute modification, même directe.
- **Prix ferme** : à la publication, « J'accepte les propositions de prix » (coché par défaut, site et application). Sinon seul le prix affiché peut être proposé.
- **Plusieurs acheteurs sur une même offre** : la base refuse un accord qui dépasserait la quantité annoncée (« il reste 5 sacs ») ; le vendeur voit « 15 / 20 sacs déjà convenus · 1 autre négociation en cours ».
- Annonce retirée ou masquée : les négociations ouvertes se ferment (« Annonce retirée »), les accords restent.
- Concurrence : accepter une proposition qui a changé entre-temps est refusé (« Relisez la dernière proposition »). Double retrait, réponse à sa propre proposition, action après l'accord : refusés.
- Saisie : total et écart en direct, alerte non bloquante si le prix est très loin du prix affiché (zéro en trop ?) ou si l'écart dépasse 40 %, quantité limitée à celle de l'annonce.
- Prix affiché, prix proposé et prix convenu ne sont jamais confondus. Un accord n'est ni un paiement ni une livraison (rappelé à l'écran).
- Vérifié dans une transaction annulée : proposition 900 × 15 → contre-proposition → retrait → expiration → accord à 960 × 15 ; prix ferme, quantité trop grande, référence périmée, double retrait, sur-vente et modification après accord refusés ; annonce retirée → négociation fermée, accord conservé.

**Langage sonore** (`v3/sons.js`) : courtes notes de **balafon** synthétisées dans le navigateur (aucun fichier). Désactivé par défaut, activable dans « Mon compte → Sons » ou depuis l'icône haut-parleur des négociations, avec réglage par catégorie, volume et bouton « Écouter ». Hiérarchie : accord (3 notes montantes) > proposition reçue (2 notes montantes) > refus / retrait / expiration (2 notes descendantes) > nouvelle annonce sur un de vos produits (1 note, désactivée par défaut). Les messages écrits ne font pas de son. Les événements rapprochés donnent un seul son ; onglet en arrière-plan : le titre affiche le nombre d'événements et un seul son joue au retour. Chaque son a son message à l'écran. Aucun son pour une activité fictive.

Limites : pas de notification quand le site est fermé (cela demanderait un service d'envoi de notifications) ; les réponses arrivent à la prochaine lecture (toutes les minutes, toutes les 7 s dans une négociation ouverte). `sw.js` : `v3/sons.js` en cache, `CACHE = 'mgci-v14'`.

---

# Compte, profil et avatars · micro-UX — 12 octobre 2026
**Décisions** : on garde l'authentification existante (Supabase, numéro + code secret à 6 chiffres). Pas de SMS (service payant) : le numéro est affiché « non vérifié par SMS », jamais présenté comme vérifié, et le changer n'est pas encore possible. Le profil est séparé du compte (`public.profils`, `supabase/schema-4.sql`, installé).

**Compte** (`v3/compte.js`, site et application) :
- Après la création du compte et le code de secours : 3 étapes courtes — prénom (nom facultatif), avatar, rôle et lieu (« Plus tard » possible).
- « Mon espace » (bouton du compte sur le site, qui montre l'avatar ; menu « Compte » de l'application) :
  - **Mon profil** : prénom, nom, pseudonyme unique facultatif, avatar, rôle (j'achète / je vends ou je produis / les deux), région (liste du projet), ville. Erreurs affichées sous le champ.
  - **Mon activité** : mes offres et demandes (en ligne ou en attente d'envoi), propositions envoyées et reçues, accords conclus. Aucune statistique inventée, états vides explicites.
  - **Notifications** : journal des vrais événements de négociation (proposition, contre-proposition, accord, refus, retrait, expiration).
  - **Préférences** : messages à l'écran, sons, confidentialité (montrer ou non son nom de famille). Les notifications quand le site est fermé et les SMS sont marqués « pas disponibles ».
  - **Sécurité** : changer son code secret (l'ancien est vérifié), nouveau code de secours, se déconnecter, déconnecter tous ses appareils, supprimer son compte, données conservées.
- Changer sa région ne déplace pas ses annonces. Le nom d'exploitation saisi sur chaque annonce reste celui de l'annonce.
- Ce que voient les autres passe par `profils_publics()` : pseudonyme, ou prénom + initiale du nom (sauf accord), avatar et rôle. Le nom complet n'est jamais montré sans accord.
- **Suppression du compte** : annonces retirées, négociations en cours fermées, profil et code de secours effacés, connexion bloquée. Les accords conclus et les messages restent pour la trace des échanges (l'autre partie voit « Compte supprimé »). La fonction est à lancer par le propriétaire : `supabase/a-lancer-etape-4.sql`.
- Vérifié dans une transaction annulée : un compte ne peut ni créer, ni lire, ni modifier le profil d'un autre ; prénom invalide refusé ; `supprime_le` non modifiable ; affichage public « Awa K. ».

**Avatars** (`v3/avatar.js`) : portraits dessinés en SVG, sans image ni service.
- 9 styles nommés par ce qu'ils montrent, jamais par un genre : foulard, tresses, chignon, afro, nattes, coupe courte, ras, barbe, bonnet.
- 6 teints, couleurs de cheveux ou de tissu, 6 fonds, boucles d'oreilles ou lunettes.
- Par défaut : les initiales. Rien n'est déduit du nom ou du numéro.
- Le même avatar apparaît sur le profil, le bouton du compte, les cartes d'offre (site et application) et les négociations.
- Pas d'import de photo pour l'instant.

**Micro-UX** (`v3/ux.css` sur le site, mêmes valeurs dans l'application) :
- Réglages communs : durées 120 / 200 / 320 / 520 ms, courbes, tailles d'icônes, rayons, focus clavier visible, enfoncement léger à la pression sur écran tactile, moins de mouvement si l'appareil le demande.
- Audit à 1440, 1024, 820, 390 et 360 px : aucun débordement horizontal. Sur écran tactile, surfaces portées à 44 px :
  - site : puces de prix, zones d'Acheter, filtres, « Signaler », fil d'Ariane, liens du pied de page, croix de retrait ;
  - application : pastilles des familles, flèches précédent / suivant.
- Dépliants unifiés : « autres produits sans offre », familles sans prix, options du formulaire rapide. Le chevron pivote et l'ouverture est fluide là où le navigateur sait animer une hauteur.
- Fenêtres (connexion, Mon espace, négociations, sons) : le focus y entre, boucle avec Tab, et revient au bouton d'origine à la fermeture.
- Chiffres alignés partout : Cormorant dessinait « 1 » comme un « I » et « 0 » comme un « O » (« Offres I · Demandes O » dans l'application).

**Limites** : pas de vérification par SMS, pas de changement de numéro, pas de photo de profil, pas de notification quand le site est fermé. `sw.js` : `v3/avatar.js`, `v3/compte.js` et `v3/ux.css` en cache, `CACHE = 'mgci-v15'`.

---

# Mise à jour du 12 octobre 2026 appliquée (paquet « Application mobile multiplateforme »)
- 17 fichiers du paquet (voir `MISE-A-JOUR.md`) : connexion repensée avec la scène « Deux mondes. Un même marché. » (`v3/porte.js`), en-tête (menu dépliant, repère de page), éditeur d'avatar (portrait, photo, initiales), « Proposer un prix » refait, carte sans bord coupé, recherche épurée, pied de page allégé. `sw.js` : `mgci-v19`.
- Vérifié avant de copier : le paquet part de la version en ligne (toutes les fonctions précédentes y sont : négociation, compte, avatars, sons, pages sombres).
- `supabase/schema-5.sql` (photos de profil, dossier public « avatars », 300 Ko, chacun n'écrit que sa propre photo) : **installé par le connecteur**, rien à faire.
- Corrigés après essai : dans l'application, le montant de « Proposer un prix » s'affichait en petit (la règle de l'application qui force 16 px sur les champs l'écrasait) ; les prix rapides passent sur deux colonnes sur téléphone (plus de bouton seul sur la 2e ligne).
- Essais (Chromium, serveur simulé) : accueil, Acheter, fiche, carte, Vendre, Prix, Confiance ; connexion (ordinateur et téléphone), inscription puis avatar, « Proposer un prix » (ordinateur et téléphone) : aucune erreur.

---

# Corrections du 12 octobre (essais sur téléphone)
- **Avatar et photo non enregistrés** (« permission denied for table profils ») : l'enregistrement « crée ou remplace » réécrit aussi `user_id`, sans droit de modification sur cette colonne. Droit ajouté côté base (`grant update (user_id)`), la règle de sécurité interdit toujours de prendre l'identifiant d'un autre (vérifié). Photo : déposer la sienne fonctionne, celle d'un autre est refusée (vérifié). Rien à lancer dans Supabase.
- **Impossible de défiler dans l'application** : le blocage de l'effet élastique de l'iPhone n'autorisait que les zones de l'application elle-même, pas les fenêtres ajoutées par-dessus (connexion, Mon espace, négociation, sons). Il reconnaît maintenant toute zone qui défile. Vérifié par un glissement de doigt simulé : bloqué avant, défile après.
- Quand le clavier cache le champ touché, celui-ci remonte au milieu de la fenêtre.
- `sw.js` : `mgci-v20`.
- Mon espace : plus aucune mention de SMS (préférences, profil, sécurité ; « Changer de numéro » renvoie vers le Marché de Gros). Activité : une proposition n'est « envoyée » ou « reçue » que tant qu'elle attend une réponse ; retirée, refusée ou expirée, elle passe dans « Sans suite », sans prix affiché. Même logique dans « Mes négociations » (groupe « Sans proposition en cours »). `sw.js` : `mgci-v21`.
- **Création de compte** : prénom, nom et pseudonyme obligatoires dès le formulaire (erreurs sous chaque champ). Le pseudonyme est vérifié pendant la saisie (coche verte, ou « déjà pris ») puis juste avant de créer le compte (`pseudo_libre()`, installée). Le profil est enregistré aussitôt ; la bienvenue commence directement par l'avatar. `sw.js` : `mgci-v22`.
- **Connexion plus courte** : titre « Entrez dans le marché. » (une ligne sur téléphone) et plus de phrase d'introduction.
- **Illustration de la porte sur téléphone** (`v3/porte.js`, SVG dessiné à la main, animé en CSS) : sillons et pousses à gauche, étals à droite, une porte ouverte au centre ; le cercle vert et le carré jaune avancent sur la ligne bleue. La porte s'ouvre pendant la saisie, la lumière monte à l'envoi, les deux se rejoignent sur le seuil à la réussite. Dans l'application seulement (`<html data-app>`) : le site garde sa scène de points, sur téléphone comme sur ordinateur. Mouvement réduit : image fixe. `sw.js` : `mgci-v25`.
- **Connexion sur téléphone, version simple** : image → titre centré → champs → gros bouton → une seule ligne « Pas encore de compte ? Créer un compte » (ou « Déjà un compte ? Se connecter », « Retour à la connexion »). Plus d'onglets, plus de paragraphe d'avertissement, plus d'aide sous le pseudonyme ; « Code oublié ? » à droite sous le code. L'ordinateur garde ses onglets. `sw.js` : `mgci-v26`.
- **Pseudonyme facultatif à l'inscription** : prénom et nom restent obligatoires ; le pseudonyme est marqué « facultatif ». S'il est rempli, il est vérifié (format, déjà pris) comme avant ; sinon les autres voient le prénom et l'initiale du nom. `sw.js` : `mgci-v27`.
- **Porte (application, téléphone) plus vivante au repos** : des lueurs filent sur la ligne bleue des deux côtés vers la porte (animation SVG, compatible iPhone), des poussières de lumière montent dans l'embrasure, les pousses se balancent, la lumière respire. Vérifié : 11 animations actives ; en mouvement réduit, tout est figé (CSS et SVG). `sw.js` : `mgci-v28`.
- **Tableau de bord dans Mon espace** (admin seulement, vérifié par `est_admin()`) : dernier élément du menu sur ordinateur, premier de la rangée sur téléphone, couleur ambre. Les autres comptes ne le voient pas ; `admin.html` revérifie de toute façon. `sw.js` : `mgci-v29`.
- **Mises à jour dans l'application installée (icône sur l'écran d'accueil)** : le service worker servait le code en « cache d'abord » sans tenir compte des `?v=` ; l'icône gardait l'ancienne version et il fallait recréer un raccourci. Désormais : pages, JS, CSS et manifeste en **réseau d'abord** (revalidés auprès du serveur), cache seulement hors connexion ou si le réseau dépasse 4 s ; images toujours en cache. L'application vérifie la présence d'une nouvelle version à chaque retour au premier plan (`updateViaCache: 'none'`) et se recharge seule quand elle prend la main (tout de suite à l'ouverture, sinon au retour suivant, jamais pendant une saisie). Testé avec un vrai service worker : ancien SW → mise à jour non reçue (le problème) ; nouveau SW → reçue dès la 1re ouverture (1 rechargement automatique), puis une 2e mise à jour reçue **sans toucher à `sw.js`** ; hors connexion, l'application s'ouvre. `sw.js` : `mgci-v30`.
- **Clavier de l'iPhone qui cachait le code secret** : sur iPhone, la page ne rétrécit pas quand le clavier s'ouvre (seule la zone visible rétrécit) ; la fenêtre de connexion restait calée en bas de la page, sous le clavier. Les fenêtres posées par-dessus (connexion, Mon espace, négociation) suivent maintenant la zone visible (`visualViewport` → `--vvh`, `--vvt`) et défilent à l'intérieur ; clavier ouvert, l'image de la porte se replie. Vérifié en simulant un clavier (zone visible 508 px sur 844) : numéro, code secret, bouton et lien tiennent au-dessus ; l'image revient à la fermeture du clavier. `sw.js` : `mgci-v31`.
- **Onglets de Mon compte bloqués sur téléphone** : l'application ramenait à zéro tout défilement horizontal non déclaré dans l'attribut `style` ; la rangée d'onglets revenait au début dès qu'on la glissait. Le garde-fou regarde maintenant le style calculé. Et sur téléphone, plus rien à glisser : tous les onglets tiennent à l'écran (icône + nom court : Profil, Activité, Alertes, Réglages, Sécurité, Admin). Vérifié en 360 px avec les 6 onglets de l'admin.
- **Croix de fermeture décalée** : `inset:auto` annulait le centrage des deux traits (≈ 3,5 px à gauche dans Chromium, davantage sur iPhone). Centrage par `translate(-50%,-50%)`, trait de 2 px : centre mesuré à moins d'un demi-pixel du centre du bouton. `sw.js` : `mgci-v32`.
- **« permission denied for table profils » en enregistrant l'avatar (encore)** : le droit de modification sur `profils.user_id` avait disparu de la base, et l'enregistrement « créer ou remplacer » en dépendait. Droit remis, et surtout l'enregistrement n'en dépend plus : on **modifie** la ligne (`PATCH`, sans `user_id`) et on ne la **crée** (`POST`) que si elle n'existe pas ; idem à l'inscription. Vérifié sur la vraie base dans une transaction annulée, droit retiré : l'ancienne méthode reproduit le refus, la nouvelle enregistre l'avatar. Le message brut du serveur est remplacé par une phrase claire. `sw.js` : `mgci-v33`.
- **Barre du haut façon Gmail (application mobile seulement)** : une capsule — menu (trois traits) à gauche, compte à droite (votre avatar, ou une silhouette pour se connecter ; pastille si une négociation attend), et au milieu `<mdg-souffle>` (`v3/souffle.js`) : « Marché de Gros » s'écrit lettre par lettre à l'ouverture (après l'écran d'accueil de l'application), puis s'efface et laisse passer des phrases — « Chercher un produit, une ville… », « Tomate, oignon, plantain… », « Qui vend près de chez vous ? », « Le bon produit, au bon endroit. », « Du champ au marché, sans détour. », « Dites ce qu'il vous faut. » — qui montent mot par mot en sortant d'un léger flou, et repartent vers le haut. Toute la capsule ouvre la recherche. Mouvement réduit : une seule phrase, en fondu. Onglet caché : pause.
- **Menu en tiroir à gauche** : « Marché de Gros » en haut et en bas ; le compte d'abord (Mon compte avec avatar et numéro, Mes négociations avec le nombre de réponses à lire, Mes publications), puis Acheter / Vendre / Demander, Réseau / Catégories / Prix / Année, Comprendre et l'affichage, séparés par des traits (plus d'étiquettes en capitales). La page ouverte est surlignée. Application : on ferme en glissant vers la gauche ou en touchant à côté.  Le site n'est pas modifié.
- **Phrases de la barre** : ajout de « Vous êtes connecté à tous les marchés de gros de Côte d'Ivoire. », « … à tous les grossistes du pays. », « … aux meilleurs acheteurs du pays. », « … aux coopératives de tout le pays. », intercalées avec les autres. Une phrase trop longue pour la barre passe sur deux lignes (un cran plus petit si besoin) et reste un peu plus longtemps ; jamais coupée (vérifié en 360 et 390 px).
- **« J'ai » / « Je cherche » à la couleur du produit** (accueil, sélecteur orbital, et fiche produit) : J'ai prend la teinte du produit (éclaircie pour rester lisible, plus douce pour les bleus, plus claire pour les jaunes) ; Je cherche prend la teinte opposée sur le cercle des couleurs, très désaturée — aubergine violet + sauge, orange + bleu marine, citron jaune-vert + violet profond, poisson bleu + brun, tomate + bleu canard. Calcul en OKLCH converti en sRGB (tous téléphones), couleur du texte choisie par contraste (≥ 4,5 : 1), transition de 0,6 s en tournant la roue. `sw.js` : `mgci-v36`.
- **Point « offre » qui scintille comme une luciole** (application, roue des produits) : quand le produit affiché a au moins une offre, le point vert s'allume et s'éteint doucement à un rythme irrégulier (deux éclats rapprochés puis un repos, 3,2 s) ; sinon il reste éteint. Les essais de halo autour de l'écran puis d'ondes « goutte d'eau » sont retirés entièrement. La rangée du compteur garde exactement sa place (marges négatives compensées, vérifié en 360 et 390 px). Mouvement réduit : lueur fixe. `sw.js` : `mgci-v39`.
- **On est dans le marché** (application) : `<mdg-marche>` (`v3/porte.js`) pose la scène de la porte derrière la roue des produits — champ, étals, porte éclairée — floutée comme un arrière-plan de photo (couche calculée une seule fois, immobile : rien ne se re-floute à chaque image) ; devant, nets, des points de lumière qui flottent lentement et des lueurs qui filent sur les fils (transform/opacity, SMIL). L'horizon se cale sous le sac (mesuré, suit la taille de l'écran) ; l'arche lumineuse dépasse autour du sac. Mouvement réduit : immobile.
- **Entrer dans le marché** : après une connexion réussie, `MDGPorte.entrer()` recouvre la fenêtre (qui se ferme dessous), avance vers la porte jusqu'à la traverser, la lumière chaude remplit l'écran avec « Vous êtes dans le marché. », puis se retire sur l'accueil (≈ 2,7 s, Web Animations, sans bibliothèque). Le code de secours et la bienvenue viennent ensuite. Mouvement réduit : arrivée directe. Ni Three.js ni GSAP : SVG et animations natives suffisent, rien de plus à télécharger. Testé et filmé (vraie connexion simulée). `sw.js` : `mgci-v40`.
- **Pied du tiroir : « Se déconnecter »** (application) à la place de « Marché de Gros, Côte d'Ivoire » ; sans connexion : « Se connecter ». Son icône est une petite porte qui, à chaque ouverture du tiroir, s'entrouvre, laisse sortir la flèche (ou entrer, pour la connexion) puis se referme — une fois, 1,5 s. La liste du tiroir revient en haut à chaque ouverture (le compte était caché si on l'avait fait défiler).
- **Sortir du marché** : `MDGPorte.sortir()` (l'inverse de l'entrée) — dans la lumière du marché, « À bientôt au marché. », la lumière se retire, on recule hors de la porte, le marché réapparaît, puis la porte se referme et ses lumières baissent (≈ 2,9 s). La déconnexion se fait dès que l'écran est couvert ; même transition depuis Mon espace → Sécurité. Mouvement réduit : déconnexion directe. Testé et filmé. `sw.js` : `mgci-v41`.
- **Tiroir ouvert : rien ne semble dépasser** : le bouton « Je cherche » de l'accueil, vu à travers le voile juste à côté de « Se déconnecter », donnait l'impression d'un débordement. Voile plus sombre (74 %) et léger flou de l'accueil quand le tiroir est ouvert. Mesuré : aucun élément ne sort du tiroir (390 et 360 px). `sw.js` : `mgci-v42`.
- **Barre** : loupe devant les phrases ; phrases raccourcies et plus accrocheuses (« Tous les marchés de gros, ici. », « Les grossistes du pays, en direct. », « Les vrais acheteurs sont là. », « Les coopératives, à un geste. »…).
- **Site : plus d'écran blanc au chargement** : `color-scheme: dark` et fond sombre déclarés avant toute feuille de style ; chargeur (cercle vert et carré jaune reliés par la ligne bleue, point de rencontre qui s'allume) pendant que les scripts construisent la page, retiré en fondu dès qu'elle est prête ; n'apparaît pas si le site arrive en moins de 0,18 s.
- **Les offres scintillent partout** (luciole, en filtre) : compteurs des catégories, recherche, accueil du site (« x offres disponibles »), jamais sur les boutons « J'ai » ; **« En saison »** : un reflet de lumière passe toutes les 5 s (site et application).
- **J'ai / Je cherche** (application, accueil et fiche) : une capsule à deux parties — « J'ai · à vendre » plein à la couleur du produit, « Je cherche · à acheter » dans la couleur complémentaire, chacun avec sa pastille (point / carré), et le point bleu de la rencontre sur la jointure.
- **Notifications sur le téléphone, même application fermée, et chiffre sur l'icône** (Web Push, gratuit) :
  - base (`supabase/schema-6.sql`, installé) : table `push_abonnements`, `push_abonner()` / `push_desabonner()`, `push_badge()` (négociations où l'autre a écrit en dernier, pas encore ouvertes), déclencheur `push_message` sur chaque nouveau message → `pg_net` appelle la fonction ; clés VAPID et clé partagée dans le coffre Supabase (vault), jamais dans le code ;
  - fonction Edge `pousser` (`supabase/functions/pousser`, déployée) : rédige la notification (« Awa propose 11 500 F / kg », « Accord conclu avec… », refus, retrait, message), l'envoie à tous les téléphones du destinataire avec le chiffre de l'icône, retire les abonnements périmés ; mode « essai » pour l'application connectée ;
  - téléphone (`v3/pousse.js`, `sw.js`) : activation après un toucher, notification d'essai, abonnement qui suit le compte connecté, retiré à la déconnexion ; le service worker affiche la notification, met le chiffre sur l'icône, et toucher ouvre la négociation ; invitation unique après la connexion ; carte « Notifications sur ce téléphone » dans Mon compte (Alertes et Réglages) selon l'état réel (à activer, activées, bloquées, iPhone : ajouter d'abord à l'écran d'accueil).
  - Testé : de bout en bout sur le serveur (abonnement factice → chiffrement et envoi → « expiré » → abonnement retiré tout seul) ; dans le navigateur, activation, enregistrement, essai, et affichage d'une notification par le service worker. `sw.js` : `mgci-v45`.
