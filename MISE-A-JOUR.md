# Mise à jour — Application mobile (10 octobre 2026)

Déposer le contenu de ce paquet à la racine du dépôt `Stan77i/marchedegrosci` (branche `main`). Une seule adresse : **ordinateur → site complet**, **téléphone → application**.

## Fichiers
| Fichier | Rôle | État |
|---|---|---|
| `application.dc.html` | L'application mobile (toutes les pages du site, en écrans d'app) | nouveau |
| `support.js` | Moteur d'affichage de l'application (à garder à côté de `application.dc.html`) | nouveau |
| `app/marche-app.js` | Données de référence, stockage partagé, carte, calendrier, pictogrammes animés | nouveau |
| `index.html` | Aiguillage : téléphone → application, ordinateur → `index-v3.html` | modifié |
| `index-v3.html` | Redirige un téléphone vers l'application (`?ordinateur=1` force le site) | modifié |

## Ce que fait l'application
- **Accueil** : roue plein écran, **une famille à la fois** (les 11 familles du catalogue, tous leurs produits). Glisser au-delà du dernier produit passe à la famille suivante. Produit sans photo : sac de jute dessiné, au nom du produit.
- **Acheter** : recherche du site (`v2/search.js` : noms locaux, fautes légères, « 50 sacs de riz à Bouaké »), « Compris : » produit / quantité / lieu, filtres famille, région, quantité min., prix max., suggestions, demande pré-remplie si rien ne correspond.
- **Vendre** : 3 étapes, photo (appareil photo, réduite à 520 px), « Je vends / Pour un producteur » (agent terrain), aperçu acheteur en direct, demandes qui attendent, repère de prix.
- **Demander** : Quoi / Combien / Où / Quand / Budget / Contact, offres existantes sous « Quoi ».
- **J'ai / Je cherche** : feuille rapide depuis n'importe quel produit, correspondances immédiates.
- **Le réseau** (carte SVG) : offres (cercle vert), demandes (carré jaune), vous (triangle violet), fils bleus animés entre offre et demande compatibles ; « Où êtes-vous ? » trie les offres par distance.
- **Catégories**, **Prix du marché** (prix vendeur ≠ prix observé : 5 observations, 3 vendeurs, 30 jours), **L'année du marché** (calendrier circulaire, un anneau par culture sourcée), **Fiche produit**, **Fiche vendeur**, **Mes publications**, **Comment ça marche**, **Aide producteur**, **Confiance**.
- **Données** : mêmes clés que le site (`mdg-v2:offres`, `mdg-v2:demandes`) : ce qui est publié dans l'app apparaît sur le site du même navigateur, et inversement. Aucune donnée inventée.
- **Adresses** : mêmes routes que le site (`#/produits/tomate`, `#/carte`, `#/vendre`…) ; bouton retour du téléphone géré.
- **Pictogrammes** : SVG animés dans le langage des marqueurs (plus de photos qui ne disent rien dans le menu).

---

# Mise à jour — Marché de Gros de Côte d'Ivoire (8 octobre 2026)

Paquet de mise à jour pour le dépôt `Stan77i/marchedegrosci` (branche `main`).
Il contient **uniquement les fichiers du site modifiés**, la philosophie produit et ce rapport.
Déposer le contenu à la racine du dépôt : les fichiers du même nom sont remplacés, les autres ne bougent pas.

> **Source de vérité : `docs/PHILOSOPHIE.md`.** Elle passe au-dessus de toutes les consignes précédentes et de DIRECTIVE-DESIGN.md.
> Idée centrale : le site n'est pas un catalogue, c'est une infrastructure de rencontre entre l'offre et la demande. Complexité interne, simplicité externe.

---

## 1. Contenu du paquet

Le paquet est **complet** : tous les fichiers nécessaires pour ouvrir `index-v3.html` sont inclus (le site, ses styles, ses scripts, ses images, la philosophie).

| Dossier / fichier | Rôle | État |
|---|---|---|
| `docs/PHILOSOPHIE.md` | Philosophie produit | nouveau |
| `index-v3.html` | Le site (routes, pages, données, styles) | modifié |
| `v3/marche.js` | Données réelles uniquement, prix intelligent, icônes, numéros | nouveau |
| `v3/match.js` | « J'ai / Je cherche » (remplace le panier) | nouveau |
| `v3/pages.js`, `v3/pages.css` | En-tête commun, état neutre, Prix du marché, repères de prix | modifié |
| `v3/hero-ivt.js`, `v3/hero-ivt.css` | Accueil : sélecteur orbital | modifié |
| `v3/acheter.*`, `v3/vendre.*` | Acheter, Vendre | modifié |
| `v2/saisons.js` | Calendrier sourcé des récoltes | modifié |
| `v3/annee.js`, `v3/annee.css` | Page « L'année du marché » (`#/annee`) | nouveau |
| `css/typo.css` | Typographie du site (Cormorant Garamond + Jost) | nouveau |
| `docs/IMAGES.md` | Inventaire des photos, mois avec / sans image | nouveau |
| `v2/img/saison-*.webp`, `v2/img/evenement-*.webp`, `v2/img/femme-marche-07-*.webp` | Photos de l'année du marché (paysage + portrait) | nouveau |
| `css/styles.css`, `v2/data.js`, `v2/oklch.js`, `v2/themes.js`, `v2/search.js`, `v2/map.js`, `v2/terrain.js`, `v2/reseau-carte.js`, `v2/img/*`, `v3/ivt-header.*`, `v3/tweaks*.jsx` | Fichiers nécessaires au fonctionnement | inchangés |

### Ouvrir le site en local
Le site charge certains modules (carte, terrain) avec `import()` : les navigateurs les bloquent si l'on ouvre le fichier par double-clic (`file://`). Lancer un petit serveur dans le dossier :

```
python3 -m http.server 8000
```
puis ouvrir **http://localhost:8000/index-v3.html#/** (ou `npx serve`, ou l'extension « Live Server » de VS Code).
En ligne (GitHub Pages ou tout hébergement), il n'y a rien à faire.

### À supprimer du dépôt
- `v2/reseau.js` : couche WebGL du « réseau », plus chargée.
- `v2/demandes.js` : demandes fictives, plus chargées.
- `v3/accueil.js`, `v3/accueil.css` : ancien héros (s'ils sont encore là).
- `v2/scene3d.js`, tout fichier Three.js, Temple Night, page de test 3D ou licence ThreeUI s'ils existent dans le dépôt (absents de ce projet).
- Facultatif : dans `v2/data.js`, vider `MDG.producers` et `MDG.offers` (ils ne sont plus lus, `v3/marche.js` les remplace au chargement).

---

## 2. Ce qui est fait

1. **WebGL supprimé, sauf la carte.** Three.js n'est plus importé nulle part ; la détection WebGL (`W3.tierOf`) renvoie 0 ; la couche réseau est coupée. La carte (`v2/reseau-carte.js`) est en Canvas 2D et reste.
2. **Aucune donnée inventée.** `v3/marche.js` remplace producteurs, offres et demandes par les seules publications faites depuis l'appareil (`localStorage` : `mdg-v2:offres`, `mdg-v2:demandes`). Familles, produits, noms locaux et régions sont conservés (données de référence). Tous les badges « Exemple » / « EX » sont retirés.
3. **États neutres** (`MDGV3.nst({ title, text, slug })`) : Acheter, Carte, fiche produit, Prix du marché, carte « Depuis l'étal ». Compteurs masqués quand ils valent zéro.
4. **Prix intelligent** (`MDGMarche.prix` / `prixHTML`) :
   - *Prix vendeur* : icône étiquette, toujours rattaché au vendeur, à la ville et à la date.
   - *Prix observé du marché* : icône barres, fourchette (10e–90e centile), seulement si ≥ 5 observations, ≥ 3 vendeurs, sur 30 jours (`MDGMarche.SEUIL`).
   - Sinon : « Pas assez de données pour calculer un prix du marché » / « Données en cours de constitution ».
5. **« J'ai / Je cherche » remplace le panier** (`v3/match.js`). Icône retenue : **point plein (offre) relié à un cercle (demande)**, le vocabulaire de la carte. Tout bouton `data-match="jai|cherche" data-slug="…"` ouvre le panneau, n'importe où dans le site.
   - J'ai → demandes correspondantes + offre déjà remplie avec le produit.
   - Je cherche → offres correspondantes ; sinon « Pas encore d'offre, publiez votre demande » et le formulaire tout de suite.
   - Panneau ancré (ordinateur), feuille qui monte du bas (téléphone), glisser vers le bas pour fermer, Échap, focus piégé.
6. **Téléphone** : champ obligatoire des deux formulaires, `MDGMarche.tel()` accepte 10 chiffres avec ou sans +225. Appeler / WhatsApp seulement sur une publication réelle qui a un numéro. Mention « Enregistré sur cet appareil pour l'instant ».
7. **Accueil** : uniquement le sélecteur orbital. Colonne gauche : famille, produit, disponibilité, prix. « J'ai / Je cherche » au cœur de l'anneau. Sections « Le réseau », « L'année », « Que voulez-vous faire » retirées de l'accueil.
8. **En-tête** : entrées conservées (Accueil · Acheter · Vendre · Demander · Catégories · Carte · Prix du marché), badge « EX » retiré.
9. **Mise à jour en direct** : une publication rafraîchit le marché sans recharger (`refreshMarket()` dans `index-v3.html`, appelé par `store()`).
10. **Ouverture sur l'Accueil** (7 oct., 2e passe) : sans `#` dans l'adresse, le site ouvre `#/` (Accueil) au lieu de `#/catalogue`.
11. **Code mort retiré** (`index-v3.html`, objet `W3`) : détection WebGL `_tierWebGL` et chargement de `v2/scene3d.js` supprimés ; commentaire de `demandsAll()` qui citait `v2/demandes.js` corrigé. L'objet `W3` / `MDGBridge` reste (lu par le site), toujours au niveau 0.
12. **Vendre** (`v3/vendre.js`, `v3/vendre.css`) : `#/vendre?p=slug` (et `&q=`) préremplit le produit, prioritaire sur le brouillon ; les **demandes correspondantes** s'affichent sous l'étiquette pendant la saisie (quantité, lieu, Appeler / WhatsApp si numéro, zones de 44 px) ; libellé « Prix vendeur par … » ; mention unique « Enregistrée sur cet appareil pour l'instant : l'envoi aux autres utilisateurs arrive avec le serveur » (l'ancienne phrase « n'apparaît pas encore dans le catalogue » était fausse) ; commentaire d'en-tête sans « tas ».
13. **J'ai** (`v3/match.js`) : lien « Formulaire complet : photo, date, agent → » vers `#/vendre?p=slug` ; le panneau se ferme au changement de page.
14. **Demander** (`demande()` dans `index-v3.html`, styles `.dx-*` dans `v3/pages.css`) : sous « Quoi ? », les **offres qui existent déjà** (3 au plus, celles de la région d'abord) avec quantité, vendeur, ville, *prix vendeur*, Appeler / WhatsApp, et « Voir les N offres » au-delà de 3 ; sans offre, état neutre court « Pas encore d'offre pour ce produit. Votre demande sera la première ». `#dM` n'affiche plus « X producteurs pourraient répondre » : « N vendeurs proposent ce produit, dont … en [région] », masqué à zéro. Mentions locales alignées sur « J'ai / Je cherche » ; `onMarket()` appelé après publication.
15. **Catégories** (`categories()` dans `index-v3.html`, styles `.cx-*` dans le `<style>` du même fichier) : chaque famille se déplie sur place (`#/categories?f=slug`) → ses **produits** avec, pour chacun, les **territoires** où il y a des offres ou des demandes, « En saison » (calendriers sourcés de `v2/saisons.js`), le nombre d'**offres** (point plein) et de **demandes** (cercle) seulement s'ils sont non nuls, et les boutons **J'ai / Je cherche** (44 px). Produits triés par activité. « Aucune offre » et « Faire une demande » retirés. La liste n'est construite qu'à l'ouverture (léger sur téléphone). Mise en forme alignée sur Acheter / Vendre / Demander : en-tête commun `MDGV3.head('categories')` (parcours Acheter · Vendre · Demander, « Depuis l'étal ») puis section sombre `.ax` ; la recherche intérieure claire est retirée (loupe de l'en-tête). Flèche tournée vers le bas (se déplie) et « N produits » quand la famille n'a encore ni offre ni demande.
16. **Accueil — dessin de la roue** (`v3/hero-ivt.js`, `v3/hero-ivt.css`, d'après IVT boutique) : la roue est la même sur tous les écrans — produit actif en haut, sous le point lumineux, les autres produits de la famille répartis le long de l'arc en grandes capitales espacées (15 px, 0,18 em) ; deux anneaux limités à l'arc supérieur (jamais sur le sac), l'intérieur à la couleur du produit ; halo doux derrière le produit actif (`.hero__glow`) ; graduations retirées. Toucher ou glisser fait tourner la roue jusqu'au cran suivant, **sans inertie** (choix du propriétaire). Rien d'autre n'a changé sur l'accueil.
17. **Roue — disposition** (`v3/hero-ivt.js`, `v3/hero-ivt.css`) : libellés limités à l'arc supérieur (±102°, `VIS_M`), plus espacés (`GAP_M` 9), atténuation plus douce ; anneaux bornés à ±100° (`stroke-dasharray:200 160; stroke-dashoffset:-170`) ; sac réduit (52 % de la roue, centré à 57 %) pour rester **à l'intérieur de l'anneau intérieur** : le cercle ne touche jamais le produit. Fichiers versionnés dans `index-v3.html` (`?v=20261007d`) pour forcer le rechargement après mise à jour.
18. **Roue — retour au fonctionnement IVT sur ordinateur** : sur ordinateur (≥ 760 px), l'**arc est fixe** et c'est le **point lumineux qui va au produit** choisi (comme IVT boutique) ; libellés serrés côte à côte sur l'arc (14 px, 0,2 em, `GAP` 2,6°, `BUDGET` 52 caractères), halo derrière le libellé actif, anneaux ajustés à la longueur de l'arc. Le téléphone garde la roue tactile (produit actif en haut, sans inertie). Le sac reste à l'intérieur de l'anneau. Version `?v=20261007e`.
19. **Bas de l'accueil désencombré + dé réversible** (`v3/hero-ivt.js`, `v3/hero-ivt.css`) : l'étiquette flottante de famille (`.hero__fam`) qui chevauchait « J'ai / Je cherche » est retirée (la famille reste affichée au-dessus du nom du produit) ; contrôles descendus de 28 px. Flèches **‹ ›** autour du compteur (`.hero__step`) : famille précédente / suivante (2/11 → 1/11 et inversement ; le dé avance toujours, ← → au clavier, balayage). Transitions accélérées (sortie 140 ms, entrée 340 ms en cascade de 16 ms, point 300 ms, compteur qui glisse).
20. **Pied de page** (`footer#foot` dans `index-v3.html`) : coins arrondis supprimés (ils laissaient voir le fond clair de la page aux angles), simple filet en haut. Version `?v=20261007g`.

21. **8 octobre — suite de la liste** :
   - `price()` libellé « Prix vendeur » (`.o-pk`) sur toutes les cartes d'offre.
   - `contactButtons()` : vrais liens Appeler (`tel:`) / WhatsApp (`wa.me`) seulement si la publication a un numéro valide ; sinon aucun bouton (plus de bouton désactivé).
   - Fiche producteur : « Vérification : pas encore vérifié » retiré ; téléphone affiché s'il existe, Appeler / WhatsApp, mention « Position approximative : centre du district ».
   - Accueil : phrase fondatrice au-dessus du sélecteur (`.hero__tag`) ; familles en points sous l'anneau sur téléphone (zones de 26 × 44 px) ; roue réduite sur les écrans bas (téléphone ≤ 700 px, ordinateur ≤ 760 px de haut).
   - Ancien catalogue (`catalogue()`) : compteur « Pas encore d'offre » masqué sur les cartes produit ; « Personne ne propose… » et « Aucune offre ici » remplacés par l'état neutre `MDGV3.nst` (J'ai / Je cherche), lien « Chercher dans toutes les régions » conservé. Aucun « dès X FCFA » trouvé.
   - En-tête : la règle qui coupe les transitions pendant le changement de page visait `.top` alors que l'en-tête est `#top.site-header` ; corrigée en `#top.snap` (le soulignement `.sh-nav a::after` ne glisse plus d'un onglet à l'autre).
   - Carte : « Le territoire se dessine… » masqué (`visibility`) une fois la carte prête, et retiré d'office après 6 s ; fiche du vendeur sur la carte : « Position approximative : centre du district » ; « Pas encore d'offre ici » → état neutre `MDGV3.nst`.
   - Disponibilité précise (PHILOSOPHIE § 10) : `avail()` sur les cartes d'offre → « Disponible maintenant » ou « Disponible dès le 12 novembre ».
   - Fiche produit : la ligne « Offres : Aucune pour le moment » est masquée à zéro.
   - Carte : plus de bande de fond derrière l'en-tête (`body.light #view{padding-top}` poussait la carte de 78 px) ; la carte passe sous l'en-tête transparent, panneau décalé sous l'en-tête sur ordinateur.
   - Accueil (ordinateur) : **sélecteur orbital repris tel quel de l'accueil IVT** (`ivt-boutique/assets/css/ivt.css`, règles ≥ 900 px) — roue centrée jusqu'à 700 px, sac à 92 % de la roue qui déborde vers le bas, anneaux 224/136, libellés 0,26 em, scène de 680 px, plus de limite par la hauteur d'écran. Personnalisé : « J'ai / Je cherche » à droite de la roue (≥ 1200 px) à la place du prix + panier IVT ; produit à gauche ; contrôles sous la roue. Remplace la règle « le sac reste dans l'anneau » (§ 17).
   - Libellés de la roue (ordinateur) alignés sur IVT : police **Jost** 400, 10,5 px, espacement 0,26 em, gris à 42 %, actif en blanc 600 ; mesures JS d'IVT (`FONT 10.5`, `LETTRE 0.78`, `PAD 1.6`, `GAP 3`), budget 60 caractères. Grille : colonnes latérales d'au moins 190 px (la roue rétrécit entre 900 et 1200 px, plus de chevauchement).
   - **Fiche produit en sombre** (« Voir la fiche ») : section `.ax.fx` à la couleur du produit (`--p-bg`, halo `--p-accent`), sac sans boîte verte sous deux arcs (comme la roue), noms locaux en contour, repère de prix et boutons J'ai / Je cherche aux couleurs sombres ; fil d'Ariane « Acheter / famille » (la famille ouvre Catégories). Styles dans `v3/pages.css`.
   - **Paquet complet** : tous les fichiers du site sont inclus (css/, docs/, v2/ avec images, v3/), plus un `index.html` qui ouvre `index-v3.html` (adresse racine du site / GitHub Pages).
   - **Lumière du produit actif** (roue, `hero-ivt.js` / `.css`) : halo en dégradé radial blanc → accent qui respire (3,2 s), reflet qui balaie les lettres en boucle (`#ivhShine`), faisceau lumineux sur l'anneau extérieur de la longueur du libellé, qui glisse d'un produit à l'autre (`.hero__beam`, `#ivhBloom`), point plus lumineux. Mouvement coupé si « réduire les animations ».
   - **Accueil : la roue devient une scène** (ORDRE-DE-MISSION § V, VII, IX, X, XI, XIV, XVI) — nouveau `v3/scene-ivt.js` (WebGL léger, un seul shader plein écran, sans bibliothèque) :
     - profondeur : brume lointaine et proche à deux vitesses, brume au sol ; plans DOM qui suivent le curseur à des vitesses différentes (sac lourd, anneau moyen, petits sacs presque immobiles) ;
     - lumière : un faisceau part du nom actif et tombe sur le sac, halo autour du produit ; quand on change de produit, le faisceau glisse, une onde part du nom et le sac sort du flou ;
     - curseur = force : il éclaire la brume, écarte la poussière, éclaire les noms qu'il approche ; sur téléphone, le doigt joue le même rôle pendant le glissé ;
     - couleurs reprises de la couleur du produit (`--hero-accent`, `--hero-glow`), fondu à chaque changement ;
     - aucune donnée inventée : la scène ne montre ni offre ni connexion ; sans WebGL la profondeur DOM reste ; « réduire les animations » : image fixe ; pause hors écran et onglet caché ; résolution interne 0,8 (ordinateur) / 0,6 (téléphone).
   - Version `?v=20261008h`.
22. **Passages d'état entre les pages** (ORDRE-DE-MISSION § XXV ; `route()` dans `index-v3.html`, styles en fin de `v3/pages.css`) :
   - le sens du parcours (Accueil → Acheter → Vendre → Demander → Catégories → Carte → Prix) décide du mouvement : l'ancien état recule dans la brume (flou, léger recul), le nouveau en sort du côté où l'on avance ; une bande de lumière à la couleur du produit traverse dans le même sens (`#vtLight`) ;
   - entrer dans une fiche produit = la caméra avance (zoom + flou) avec une éclosion de lumière depuis le point touché ; en sortir = elle recule ;
   - le sac voyage d'un état à l'autre (`pg-prod`) : accueil → fiche, et désormais carte produit → fiche ;
   - en-tête toujours fixe pendant le passage ; aucun passage si « réduire les animations ».
   - Version `?v=20261008i`.
23. **Acheter, dans le détail** (`v3/acheter.js`, `v3/acheter.css`, ORDRE-DE-MISSION § XVII) :
   - colonne prix : « Prix observé » (fourchette) seulement au-dessus du seuil, sinon « Prix vendeur(s) » — jamais présenté comme prix du marché ;
   - colonne disponible : « maintenant » ou « dès le 12 nov. » (offres futures comptées à part) ;
   - aucune offre : plus d'impasse — « Dites ce que vous cherchez », chaque produit de chaque famille est un bouton « Je cherche » (panneau J'ai / Je cherche), familles filtrables, lien « Publier la première offre » ;
   - la ligne survolée s'éclaire à l'endroit du curseur (projecteur à la couleur du produit), les points de la mini-carte s'allument ;
   - téléphone : chaque produit en bloc lisible (plus de tableau qui déborde), familles en bande défilante, zones de 44 px.
   - Version `?v=20261008j`.
24. **Demander : la demande est un signal** (`demande()` dans `index-v3.html`, styles en fin de `v3/pages.css`, ORDRE-DE-MISSION § XIX) :
   - au-dessus du résumé, la Côte d'Ivoire en points (contour repris de `v2/reseau-carte.js`) ; un cercle qui respire marque la demande et glisse vers la région choisie ;
   - les offres réelles du produit apparaissent en points, reliées au cercle par des fils qui se tracent ; légende : « N offres peuvent répondre, la plus proche à ≈ X km » ou « Personne ne propose encore … » ;
   - à la publication, trois ondes partent de la région (« Signal envoyé ») ; aucun fil ni réponse inventés ;
   - « réduire les animations » : image fixe.
   - Retouche (demande du propriétaire) : la carte du signal reprend exactement le dessin de la mini-carte d'Acheter (grille de points, carte arrondie, légende, « Ouvrir la carte du territoire → ») ; le terrain coupé en fond, l'ancienne vue réseau et le résumé encadré « Votre demande… » sont retirés de Demander.
   - Version `?v=20261008l`.
25. **L'année du marché, avec photos** (`#/annee`, nouveaux `v3/annee.js`, `v3/annee.css`, `docs/IMAGES.md`) :
   - page plein écran : photo du mois (paysage sur ordinateur et tablette, portrait sur téléphone), voile sombre en bas et à gauche, nom du mois en grand, phrase « Mois : produits en récolte » tirée uniquement des entrées sourcées de `v2/saisons.js`, sources sous le bloc ;
   - frise des 12 mois : un point par mois, taille selon les saisons sourcées, point actif agrandi, flèches, clavier ← →, glisser au doigt, compteur « 10 / 12 » ;
   - fondu de 600 ms entre les photos, mois voisins préchargés ; mois sans photo : fond calme aux couleurs du site, sans texte ; crédit photo affiché une seule fois ;
   - J'ai / Je cherche pour le premier produit du mois ; lien « L'année du marché » ajouté au pied de page (colonne « Le marché ») ;
   - photos dans `v2/img/` (WebP) ; détail, photos écartées et noms proposés dans `docs/IMAGES.md`.
   - Version `?v=20261008m` (fichiers `annee.*`).
26. **Frise « L'année du marché » refaite selon la référence** (`v3/annee.js`, `v3/annee.css`) :
   - écran fixe : nom du mois en haut, frise ancrée en bas, plus aucun déplacement d'un mois à l'autre ;
   - bandes de saisons au-dessus de la frise (grande/petite saison sèche, grande/petite saison des pluies, Sud), teintes douces, nom raccourci si la place manque ; dates « à valider » (ANAM, ANADER) ;
   - points colorés par type : Récolte, Soudure, Forte demande, Début des pluies ; légende en une ligne, repliable sur téléphone ;
   - anneau du mois actif qui glisse de point en point, libellé du mois dessous ; passage automatique toutes les 5 s, bouton pause, arrêt au survol et au focus, reprise après 9 s ;
   - sources sous chaque bloc : récolte (v2/saisons.js), soudure (FEWS NET, juin 2026) ; phrase de récolte, forte demande et début des pluies marqués « À valider » ;
   - thèmes sombre et clair (`body.light`).
   - Version `?v=20261008q`.
27. **« L'année du marché » harmonisée avec le site** : fond et texte du mode du site (clair `--color-bg`, sombre `--p-bg`) ; boutons du site (`.btn btn-primary`, `.btn btn-secondary`) ; saisons et événements ramenés à la palette (or, rouille, crème, brun) ; 9 mois avec photo, mars/avril/juin en fond calme ; vignette d'événement à côté de chaque ligne active. Version `?v=20261008s`.
28. **L'année du marché : couleur du produit, comme le reste du site** : fond crème retiré ; la page est toujours en tonalité sombre et prend la palette du produit du mois (`MDGPalette`, mêmes variables `--p-*` que l'en-tête et les autres pages) ; la page passe sous l'en-tête transparent (`body.anmode #view{padding-top:0}`) ; bandes de saisons et points gardés, teintes or / rouille / crème / ambre fondues dans le fond du produit ; la lumière d'avant est rétablie en quittant la page. Bandes séparées en clarté : grande saison sèche or clair, grande saison des pluies rouille sombre, petite saison sèche brun, petite saison des pluies ambre clair. Version `?v=20261008w`.
29. **L'année du marché : éléments fixes** : boutons J'ai / Je cherche et sources dans un bloc de hauteur fixe (`.an-fix`, 104 px) juste au-dessus de la frise ; la phrase reste collée sous le nom du mois ; la frise, la légende, les flèches et les bandes ne bougent plus d'un mois à l'autre (positions mesurées identiques sur les 12 mois). Seul l'anneau du mois actif se déplace. Version `?v=20261008y`.
30. **Nouvelle typographie** : titres en **Cormorant Garamond** 500 (sérif fin, mots mis en avant en italique), texte en **Jost** ; Caprasimo et Figtree retirés. Nouveau fichier `css/typo.css` (chargé en dernier), variables `--font-heading` / `--font-body` mises à jour dans `css/styles.css`, liens Google Fonts mis à jour dans `index-v3.html`. Version `?v=20261008z`.
31. **Alignement et lisibilité** : le logo, la navigation et le contenu partagent la même colonne sur tout le site (1240 px, marges 18 px puis 24 px, aussi quand l'en-tête est replié) — règles dans `css/typo.css`. L'année du marché : mise en page en colonne (mois en haut, boutons + sources + frise ancrés en bas), phrase limitée à 2 produits et 2 lignes, plus aucun texte coupé, vignette « camion » retirée de la ligne Récolte (répétée chaque mois). Version `?v=20261009b`.

32. **Audit et corrections (9 oct.)** :
   - **Colonne commune enfin respectée** : la règle `.wrap` de `index-v3.html` (1280 px, marges 4vw) écrasait celle de `css/typo.css` ; sections sombres (« Le marché, produit par produit », Catégories, Demander) et pied de page commençaient 13 à 24 px plus à droite que le logo et les titres. Corrigé dans `css/typo.css` (`body .wrap`, 1240 px, marges 18/24 px).
   - **Titres des pages au même endroit** : `.pg-main` alignait le titre sur le bas de la carte « Depuis l'étal » ; selon la longueur du texte, le titre sautait de 150 px d'une page à l'autre (Acheter → Vendre → Demander). Alignement en haut (`v3/pages.css`).
   - **Carte** : l'aide « Glisser pour se déplacer… » passait sous les boutons de l'en-tête ; elle descend en bas à droite, à gauche des boutons de zoom. Les noms des pays voisins (Mali, Burkina Faso) passaient sous l'en-tête : nouvelle marge haute dans `v2/reseau-carte.js` (`setInsets({ top })`, 84 px ordinateur, 64 px téléphone).
   - **L'année du marché** : les boutons étaient inversés (« Je cherche » en premier) et menaient à des formulaires séparés ; ils ouvrent maintenant le panneau « J'ai / Je cherche » du site, J'ai en premier, comme partout ailleurs.
   - **Accueil** : la phrase fondatrice passe en Cormorant italique sur deux lignes (ordinateur) au lieu d'une ligne de 14 px perdue au-dessus de la roue ; « Tous les produits (134) » ne se coupe plus sur deux lignes.
   - Version `?v=20261009d`.
33. **Téléphone (390 px), mesures sur chaque route** :
   - **Acheter** : la bande des familles élargissait toute la page à 1 198 px (défilement horizontal de tout le site). Elle défile maintenant seule, dans la largeur de l'écran (`v3/acheter.css`).
   - **Accueil** : la rangée « Tous les produits / dé / ‹ 3/11 › » dépassait de 7 px de chaque côté ; resserrée, le nombre de produits est masqué sous 420 px. Flèches ‹ › passées à 36 px avec zone tactile élargie.
   - « Changer de produit » (carte « Depuis l'étal ») : zone tactile portée à 44 px.
   - Version `?v=20261009g`.
34. **Roue téléphone (d'après captures du propriétaire)** : les noms se chevauchaient à gauche de l'arc (« Pomme de terre » sur « Tomate ») — la largeur était estimée au nombre de lettres alors que les capitales Jost, espacées et en gras pour l'actif, sont plus larges. La largeur est maintenant **mesurée** (police réelle, une fois les polices chargées) dans `v3/hero-ivt.js` (`mesureM`). Les libellés s'arrêtent à ±92° (au lieu de 102°) : plus de nom coupé par le bloc « J'ai / Je cherche ». Version `?v=20261009h`.
35. **Demandes du propriétaire (captures du 8 oct., 23 h 16)** :
   - **Accueil** : la rangée « Tous les produits · dé · ‹ 4/11 › » passe **au-dessus** de la roue, juste sous la phrase (ordinateur : 1re ligne de la grille ; téléphone : `order:-1`, points de familles dessous).
   - **L'année du marché** :
     - **Sources repliées à droite** : bouton « Sources (n) » sur la ligne « L'année du marché », panneau qui s'ouvre par-dessus sans rien pousser (récolte + soudure, note sur les saisons, crédit photo) ; se ferme en touchant ailleurs. La ligne de sources sous les boutons et la mention sous la frise sont retirées : la place est rendue au contenu.
     - **Bouton pause retiré** : la frise défile seule (5 s). Elle ne s'arrête que si l'onglet est caché ou si l'on navigue au clavier dans la frise ; un choix manuel relance le compte à 9 s.
     - **Boutons J'ai / Je cherche fixes** : la page est une grille (`en-tête / texte rogné / boutons 52 px / frise`) ; le texte du mois absorbe les variations, les boutons restent au même pixel sur les 12 mois (mesuré : ordinateur 373 px, téléphone 464 px).
   - Version `?v=20261009i`.
36. **Suite (captures 23 h 21 – 23 h 23)** :
   - **Phrase fondatrice** retirée du haut de l'accueil ; elle apparaît **une fois par visite** dans une bulle discrète en bas à gauche (téléphone : en bas, pleine largeur), les deux phrases l'une après l'autre avec le point plein (J'ai) et le cercle (Je cherche) ; se ferme seule après 9 s, au toucher de ×, ou dès qu'on utilise J'ai / Je cherche (`hero__pitch`, `sessionStorage mdg-v2:phrase-vue`).
   - **L'année du marché** : libellé « L'année du marché » retiré (le bouton Sources reste à droite). Plus aucun élément coupé : le nom du mois se réduit pour tenir sur la largeur (`fitM`), et si la hauteur manque, les lignes d'événements qui ne tiennent pas entièrement sont masquées au lieu d'être rognées à mi-ligne (`fitMid`).
   - Version `?v=20261009l`.
37. **En-tête sans fond (accueil)** : la bande sombre derrière l'en-tête venait du héros, pas de l'en-tête (qui est bien transparent). L'espace réservé sous l'en-tête était une bordure transparente (`border-top: var(--hh)`) ; `overflow:hidden` coupe au bord intérieur de cette bordure, donc la scène WebGL, la lumière du curseur et le grain s'arrêtaient net à 78 px. Cet espace devient du padding (`v3/hero-ivt.css`, fin de fichier) : la scène passe désormais sous l'en-tête, sans démarcation. Mise en page inchangée. Version `?v=20261009m`.
38. **Accueil — navigation des familles** : « ‹ 3 / 11 › » et la rangée de points retirés. Deux petites flèches discrètes au-dessus du dé (famille précédente / suivante) : gris doux au repos, petite poussée à tour de rôle toutes les 3,6 s pour signaler qu'elles servent, couleur du produit au survol, et au clic la flèche « file » dans le sens choisi. Zones tactiles agrandies sans changer leur taille visible ; ← → au clavier et le dé fonctionnent toujours. Animation coupée si « réduire les animations ». Version `?v=20261009n`.
39. **Sélection dans la roue sans éclat** : l'onde lumineuse qui partait du nom choisi dans toutes les directions (`uPulse`, `v3/scene-ivt.js`) n'est plus déclenchée, et le faisceau sur l'anneau n'a plus de flash d'apparition. Restent : le faisceau qui glisse jusqu'au nouveau produit et le sac qui sort du flou. Version `?v=20261009o`.
40. **Contrôle du paquet déplacé dans `site/`** (9 oct.) : tous les chemins sont relatifs, toutes les images et tous les scripts sont présents ; les 9 routes (`#/`, `#/catalogue`, `#/vendre`, `#/demande`, `#/categories`, `#/carte`, `#/prix`, `#/produits/tomate`, `#/annee`) s'affichent, console propre (seul l'avertissement Babel du panneau de réglages). Menu plein écran sous 1100 px vérifié. Apostrophe typographique dans « L’année » (menu).
41. **Loupe de l'en-tête : recherche intelligente** (nouveaux `v3/cherche.js`, `v3/cherche.css`) : la loupe ouvrait l'ancien catalogue ; elle ouvre maintenant une boîte de recherche (aussi « / » et Ctrl/⌘ K). Elle comprend une phrase (`MDG.search.parse`) : intention (J'ai / Je cherche / Prix), produit (nom local, faute légère), quantité, lieu (districts + chefs-lieux, ex. « à Bouaké ») et l'affiche (« Compris »). Résultats : produits avec photo, famille, « En récolte » (sources de `v2/saisons.js`), nombre d'offres / demandes si non nul, boutons J'ai / Je cherche (panneau du site) ; lieu → carte filtrée ; familles, mois (`#/annee?m=`), pages. Entrée suit l'intention (« je cherche… » ouvre Je cherche). Vide : recherches récentes (`localStorage mdg-v2:recherches`), produits en récolte ce mois, produits actifs. Aucun résultat : « Faire une demande ». Plein écran sur téléphone, zones de 44 px.
42. **L'année du marché suit la lumière de l'Accueil** : la page ne prend plus la couleur du produit du mois ; elle garde, comme les autres pages, la palette du produit choisi dans le sélecteur orbital (`v3/annee.js`). Version `?v=20261009p/q`.
43. **En-tête : repli intelligent sur toutes les pages** (`v3/ivt-header.js`, `v3/ivt-header.css`) : le passage barre de liens → bouton Menu ne dépend plus d'une largeur fixe (1100 px). À chaque redimensionnement, au chargement des polices et à chaque changement de page, l'en-tête mesure logo + liens + boutons (+ 40 px d'air, 24 px d'hystérésis) et se replie dès que les liens ne tiennent plus : plus aucun chevauchement, quelle que soit la page (Accueil, Acheter, Vendre, Demander, Catégories, Carte, Prix, L'année). Menu plein écran plus rapide (fondu 160 ms, cascade 18 ms au lieu de 350 ms / 50 ms), en Cormorant, colonne de 640 px, focus sur la page courante, fermé au changement de page. Sans JS : repli sous 1100 px. Version `?v=20261009r`.
44. **Accueil : « Tous les produits » et le dé descendus** (`v3/hero-ivt.css`) : marge au-dessus de la rangée de contrôles portée de 14 à 72 px sur ordinateur, de 4 à 48 px sous 900 px.
45. **L'année du marché passe sur l'Accueil** : retirée de l'en-tête (trop d'entrées) ; la frise complète (`MDGV3.annee`, mode `embed`) s'affiche comme une seconde page sous le sélecteur orbital, avec le titre « L'année du marché » en Cormorant italique. En mode Accueil : pas de changement d'adresse, ← → seulement quand le focus est dans la frise (les flèches de l'Accueil restent aux familles), défilement automatique seulement quand le bloc est visible. `#/annee` et le lien du pied de page restent. Version `?v=20261009u`.
46. **Igname : vraies fenêtres de récolte** (`v2/saisons.js`) : l'igname apparaissait chaque mois, car ses deux entrées couvraient les 12 mois en « plein » d'après le marché de gros de Bouaké (offre disponible toute l'année, pas la récolte). Nouvelles entrées, source IDESSA Bouaké (1997 ; récoltes d'août à mars, précoces d'août à octobre, tardives récoltées en février) : précoces août (début), septembre, octobre ; tardives décembre (début), janvier, février, mars (fin). Avril à juillet et novembre : plus d'igname dans « en récolte ». À valider avec ANADER / CNRA.
47. **9 oct. (suite)** :
   - **En-tête qui perdait son style à l'ouverture de la loupe** : la tonalité de l'en-tête était lue sur la boîte de recherche (sans `data-tone`) → texte sombre sur fond sombre. `tone()` ignore maintenant la recherche et le panneau J'ai / Je cherche.
   - **En-tête repliable automatiquement** (`v3/ivt-header.js`, `.css`) : dès 80 px de défilement, l'en-tête devient une capsule givrée (flou 18 px + voile à la couleur du produit, filet, coins ronds), les liens passent dans le menu (bouton Menu) : plus jamais de texte de l'en-tête par-dessus le texte du site. Il se déplie en revenant en haut ; se cache toujours en descendant.
   - **Recherche plus puissante** (`v3/cherche.js`, `.css`) : complétion fantôme (Tab ou → pour accepter) ; dictée en français (micro, si le navigateur la propose) ; filtres Tout / Produits / Lieux / Pages avec compteurs ; lettres tapées mises en valeur ; **aperçu à droite** (ordinateur) du produit sélectionné : photo, famille, noms locaux, prix (observé ou vendeur, sinon « pas assez de données »), offres / demandes, **frise des 12 mois de récolte** (sources publiques), J'ai / Je cherche / Voir la fiche / Sur la carte ; résultats qui sortent du flou en cascade.
   - **Flou sur tout le site** (nouveaux `v3/flou.js`, `v3/flou.css`) : flou progressif sous l'en-tête au défilement ; blocs qui sortent du flou en entrant dans l'écran ; passage flou → net du texte de la roue à chaque changement de produit et du mois dans L'année du marché ; la page recule dans le flou derrière la recherche, le menu et le panneau J'ai / Je cherche. Tout coupé si « réduire les animations ».
   - Version `?v=20261009w`.
48. **Étiquettes de page dans un cartouche** (`v3/pages.css`, `v3/annee.css`) : « Acheter », « Vendre », « Demander », « Catégories », « Prix du marché » (au-dessus des grands titres) et « L'année du marché » sur l'Accueil sont dans un cadre d'archive : filet à la couleur du produit, second filet intérieur, coins marqués en équerre, voile dégradé et flou léger, point lumineux du produit. Version `?v=20261009x`.
49. **Cadres simplifiés, lien roue ↔ année, flou plus visible** :
   - Étiquettes de page et « L'année du marché » : simple filet fin à la couleur du produit, plus petit, sans point ni coins (remplace le cartouche du § 48).
   - **La roue pilote l'année** (`v3/annee.js`, `home()`) : le produit choisi dans le sélecteur orbital est suivi dans la frise. Ses mois de récolte s'allument (trait lumineux sur la ligne), la frise saute à sa saison puis ne défile que dans ses mois, la phrase et les boutons J'ai / Je cherche le mettent en premier, une ligne dit « Riz local · en récolte : septembre, octobre… ». Sans calendrier sourcé pour ce produit : on suit sa famille, signalé (« calendrier pas encore sourcé. Dans sa famille, igname : … »), trait plus pâle.
   - **Fil lumineux** entre la roue et l'année : une lumière descend le fil vers un bouton « [produit] au fil de l'année » qui fait défiler jusqu'à la frise.
   - **Flou gaussien au défilement** (`v3/flou.js`) : la section qu'on quitte par le haut s'enfonce (flou jusqu'à 14 px, léger recul, fondu) ; apparitions et passage flou → net plus marqués. Rien si « réduire les animations » est activé sur l'appareil (réglage système).
   - Version `?v=20261009z`.
50. **Tests de la section F (9 oct.)** :
   - Les 8 routes s'ouvrent, console sans erreur.
   - Parcours complet vérifié : une offre publiée dans Vendre apparaît dans Acheter, sur la fiche produit (WhatsApp / Appeler) et sur la carte ; 5 prix de 3 numéros → « Prix observé du marché » s'affiche (fourchette, nombre d'observations et de vendeurs).
   - Carte : le message « Le territoire se dessine… » disparaît bien.
   - Fiche producteur : aucune mention « non vérifié », boutons Appeler / WhatsApp présents ; ligne morte retirée.
   - **Corrigé** : pluriels du compteur d'Acheter (« 1 offre · 1 produit · 1 vendeur · 1 région ») dans `v3/acheter.js` ; ville de l'offre illisible sur carte sombre (`.o-m`, `index-v3.html`) passée à la couleur du texte.
   - Version `acheter.js?v=20261009za`.
51. **Autocritique G (9 oct.)**, sections passées à la grille PHILOSOPHIE § 40 :
   - **Retiré** : la phrase « Pas encore d'offre ni de demande pour ce produit. Soyez le premier. » dans l'en-tête commun (`V3.head`, `v3/pages.js`) ; elle répétait l'état vide déjà affiché par le contenu de chaque page (Acheter, Vendre, Demander, Catégories, Prix). Le compteur offres ↔ demandes reste quand il y a des données.
   - **Retiré** : les « Aussi appelé » qui ne font que répéter le nom (pluriel, accents : « Tomate — tomates »). Nouveau filtre `window.mdgAlias(p)` (`index-v3.html`), utilisé par la fiche produit, les cartes produit et l'aperçu de la recherche (`v3/cherche.js`). Les variantes restent utilisées par la recherche.
   - Gardé : chaque autre bloc répond à une question (quoi, où, combien, à qui écrire).
   - **À trancher par le propriétaire** : (1) sur Acheter vide, trois messages se suivent (« Personne n'a encore publié d'offre », l'invitation, « La carte attend ses premières offres ») : n'en garder qu'un ? (2) Prix du marché vide : la légende « Prix observé / Prix vendeur » s'affiche avant toute donnée : la masquer ? (3) Carte vide : deux paragraphes d'aide (légende + gestes) au-dessus de l'invitation : les replier ?
   - Versions `pages.js`, `cherche.js` `?v=20261009zb`.
52. **États du système et connexion visible** (ORDRE-DE-MISSION § XVI, XXXVI ; nouveaux `v3/etat.js`, `v3/etat.css`) :
   - **Un seul état pour tout le site**, posé sur `html[data-etat]` et diffusé par l'événement `mdg:etat` : `idle` (le marché respire), `approach` (défilement, curseur sur un élément actif), `focus` (recherche, menu, panneau J'ai / Je cherche, catalogue ouverts), `interaction` (appui), `transition` (changement de page), `connection` (publication), `rest` (retour au calme, puis `idle`). API : `MDGEtat.set(état, durée)`, `MDGEtat.get()`, `MDGEtat.matches(type, publication)`.
   - Ce que l'état pilote aujourd'hui : une lumière d'ambiance unique (vignette `body::after`) qui respire en `idle`, s'ouvre en `approach`, assombrit les bords en `focus`. Les autres scripts (scène de l'accueil, flou) peuvent écouter `mdg:etat`.
   - **Connexion** : `store()` envoie `mdg:publie` à chaque nouvelle offre ou demande. On cherche les vraies correspondances (même produit, côté opposé). S'il y en a : des grains partent d'une source par correspondance (8 au plus) et convergent vers le bouton de publication, puis une onde. S'il n'y en a pas : une seule onde, le signal part. Rien n'est inventé ; le nombre de sources = le nombre de correspondances.
   - « Réduire les animations » : l'état change, aucun mouvement.
   - Versions `etat.js`, `etat.css` `?v=20261009zc`.
53. **Catégories en constellation** (ORDRE-DE-MISSION § XX, VII ; nouveaux `v3/constellation.js`, `v3/constellation.css`, appelé en fin de `categories()`) :
   - Au-dessus de la liste, les 11 familles sont des nœuds sur une ellipse ; leurs produits (12 au plus par famille) sont des grains autour. Grain plein = au moins une offre, cercle = au moins une demande, grain pâle = rien encore ; la taille suit le nombre de publications. Légende sur une ligne.
   - Curseur = force : les familles à moins de 260 px glissent vers lui (ressort amorti), les autres restent immobiles ; leur nom s'éclaire.
   - Toucher une famille : elle passe au centre, les autres reculent dans le flou, ses produits émergent avec leur nom et un fil vers la famille (liens vers les fiches). Toucher le fond referme.
   - Téléphone : rayons réduits, noms ancrés vers l'intérieur (ceux de droite s'étendent à gauche, et inversement), débordement coupé (`overflow-x:clip`) : plus de défilement horizontal à 360–390 px.
   - **Plus de répétition** (demande du propriétaire) : sur ordinateur (≥ 761 px), la constellation est le seul choix de famille ; la liste des 11 familles est masquée et seule la famille choisie s'affiche dessous, avec ses produits et leurs actions (J'ai / Je cherche, offres, demandes, régions, en saison). Sur téléphone, la constellation est masquée : la liste seule.
   - La liste reste la source : ouvrir une famille dans la constellation l'ouvre dans la liste, et inversement.
54. **Carte : le curseur éclaire le territoire** (ORDRE-DE-MISSION § VII, XXI ; `v2/reseau-carte.js`) : sur ordinateur, une lanterne de 150 px suit la souris : les grains du territoire s'avivent et s'écartent légèrement, les offres et demandes proches grossissent et prennent la couleur du produit. Elle s'éteint pendant un glissé et hors de la carte ; coupée sur téléphone et en « réduire les animations ». Import `reseau-carte.js?v=20261009ze`.
55. **Typographie** : les « → » ajoutés en fin de texte des liens et boutons sont retirés (`index-v3.html`, `v3/hero-ivt.js`, `v3/match.js`) ; la flèche du menu plein écran (repère de navigation) est gardée. Les libellés en capitales au-dessus des titres et les séparateurs « · » sont gardés : ils font partie de l'en-tête et des étiquettes validées ; à revoir avec le propriétaire.

56. **Langage commun des marqueurs** (ORDRE DE MISSION « Système visuel transversal » ; nouveaux `v3/marqueurs.js`, `v3/marqueurs.css`) :
   - **Une seule source** : `MDGMarq` définit pour chaque type sa forme, sa couleur (variables `--mk-offre`, `--mk-demande`, `--mk-recherche`, `--mk-connexion` dans `marqueurs.css`), son nom et son état. `MDGMarq.svg(type, { off })` pour le HTML, `MDGMarq.draw(ctx, type, x, y, r, { off, sel, halo })` pour les canvas.
   - **Vocabulaire** : cercle vert = offre disponible ; carré jaune = demande ; triangle violet = votre recherche en cours ; ligne bleue = offre et demande du même produit (compatibles, pas une transaction). Les formes se distinguent sans la couleur. Inactif (hors filtre) : contour seul, atténué. Sélectionné ou survolé : plein, filet clair, halo.
   - **Où** : `MDGMarche.ICO.offre / .demande / .match` passent par `MDGMarq`, donc tout le site suit (Accueil J'ai / Je cherche, panneau J'ai / Je cherche, états neutres, fiche produit, Demander, Vendre, Catégories, recherche). Constellation : grains verts / carrés jaunes. Acheter : points d'offre et mini-carte en vert. Demander : la demande en carré jaune, les offres en cercles verts, les fils en bleu. Connexion à la publication (`v3/etat.js`) : grains bleus.
   - **Recherche** : seul cas réel aujourd'hui = la recherche que vous faites sur la carte avec un lieu (« Autour de moi » ou une ville tapée) ; le triangle se place à ce lieu. Les recherches passées (`mdg-v2:recherches`, texte seul, sans lieu) ne sont pas placées : aucune position inventée.
57. **Carte** (`v2/reseau-carte.js`, `carte()` dans `index-v3.html`) :
   - **Ce n'est pas une carte géographique exacte** (contour simplifié, positions au centre du district) ; c'est écrit sur la page. Elle est dessinée en Canvas 2D (pas en WebGL). La projection est isolée : `create({ project(lat, lon) → [x, z] })` permet de brancher une vraie cartographie plus tard sans toucher aux marqueurs, aux gestes ni à la légende.
   - **Légende interactive** (en haut à droite, ordinateur et iPad) : Offre, Demande, Recherche, Compatibles, avec le nombre réel (`world.counts()`) ; chaque entrée affiche ou masque son type (les fils dont un bout est masqué disparaissent aussi, les étiquettes suivent).
   - **Liste ↔ carte** : chaque ligne de résultat porte la forme de son type ; survol = le marqueur s'allume (halo), clic = la carte cadre l'élément et la fiche s'ouvre (fonctionnement existant gardé).
   - **Échelle corrigée** : cause du rétrécissement = zoom minimal fixe (28) très en dessous de l'échelle « tout le pays », et déplacement libre jusqu'à ±4 unités. Désormais le zoom ne descend jamais sous 85 % de l'échelle « tout le pays » pour la fenêtre actuelle (`minS()`), le centre reste dans le cadre du territoire (`panX`, `panZ`), et un redimensionnement garde le cadrage « tout le pays » s'il était actif.
   - Frontière plus lisible (opacité 0,34, trait qui suit le zoom) ; marqueurs un peu plus grands, taille liée au zoom et au volume publié.
   - Hors périmètre : téléphone (légende masquée sous 760 px).
   - Versions `?v=20261010a/b`.
58. **Recherche des pages ≠ loupe de l'en-tête** (`v3/cherche.js`) : un clic dans le champ de recherche d'une page (Acheter, Carte…) ouvrait la grande boîte de la loupe, car ce champ porte aussi `data-search`. Seuls les liens et boutons `data-search` de l'en-tête (`#top`) l'ouvrent désormais ; le champ de la page garde ses suggestions sur place.
59. **Légende de la constellation reformulée** (`v3/constellation.js`, `.css`) : « Chaque grain est un produit » ; cercle vert « Quelqu'un le vend » ; carré jaune « Recherché, personne ne le vend encore » (une demande sans offre = une opportunité, PHILOSOPHIE § 9) ; grain pâle « Ni vendu ni recherché » ; « plus il est gros, plus il y a de publications ». Nombre réel de produits à côté de chaque entrée (masqué à zéro).
   - Versions `?v=20261010c`.
60. **Je cherche : chaque offre dit pourquoi elle convient** (PHILOSOPHIE § 7 ; `v3/match.js`, styles `.mt-why`, `.mt-best` dans `v3/hero-ivt.css`) :
   - Les offres sont classées sur plusieurs critères : quantité couverte, distance (centres de district, « ≈ km »), disponibilité (maintenant / dans 2 semaines), prix vendeur.
   - Sous chaque offre, les critères en clair : « couvre vos 500 kg » ou « 320 sur 500 kg », « même région » ou « ≈ 140 km », « disponible maintenant ». Point vert = critère satisfait.
   - Le classement se refait pendant la saisie de la quantité, de l'unité et du lieu. « La plus adaptée » n'apparaît que si la première offre couvre la quantité demandée.
   - Aucune donnée ajoutée : seules les offres publiées sont comparées. `MDGMarche.load()` transmet maintenant `regionSlug` sur chaque offre.
   - Versions `match.js`, `marche.js`, `hero-ivt.css` `?v=20261010d`.
61. **Carte : élargir pas à pas** (PHILOSOPHIE § 6 ; `rings()` dans `carte()`, `index-v3.html`, styles `.tz-ring`, `.tz-wide`) : avec « Autour de moi » ou une ville, les offres sont rangées en trois cercles : « Autour de vous » (moins de 30 km), « Dans votre région » (30 à 100 km), « Ailleurs en Côte d'Ivoire ». Le premier cercle qui contient une offre s'affiche ; un bouton « Élargir : … (n offres) » ouvre le suivant. Les cercles vides le disent (« Rien tout près pour l'instant »). Une nouvelle recherche ou un nouveau lieu repart du premier cercle. Distances approximatives (centres de district).
62. **États vivants sur la Carte** (PHILOSOPHIE § 37 ; `liveTag`, `zoneLoad` dans `carte()`, `index-v3.html`) :
   - « nouveau » sur une offre ou une demande publiée depuis moins de 48 h (date réelle `createdAt`) ; « bientôt » sur une offre déclarée disponible plus tard.
   - « Zones actives » sur l'écran d'accueil de la carte : les districts qui comptent 3 publications ou plus (offres + demandes), avec leur nombre ; seuil écrit à l'écran. Rien n'apparaît sous le seuil.
   - Pas de « faible disponibilité » : la quantité restante n'est pas encore enregistrée ; à ajouter quand le vendeur pourra la mettre à jour.

## 3. Ce qu'il reste à faire (pour la personne qui reprend)

Ordre conseillé. Chaque point indique le fichier et l'endroit.

### A. Harmoniser les pages restantes (priorité haute)
- ~~**Fiche producteur**~~ fait le 8 oct. (`producer()`) : aujourd'hui atteinte seulement par une offre publiée ; vérifier qu'elle n'affiche pas « Vérification : pas encore vérifié » de façon anxiogène, et ajouter Appeler / WhatsApp si numéro.
- ~~**Ancien catalogue**~~ fait le 8 oct. (`catalogue()`, utilisé quand `?q=` est présent) : retirer les « dès X FCFA » éventuels → `MDGMarche.prixHTML`. Vérifier `offerCard()` : le prix doit être libellé « Prix vendeur ».
- ~~**Fonction `price()`**~~ fait le 8 oct. (`index-v3.html`, près de `const store`) : libellé « Prix vendeur » à ajouter.

### B. Accueil (priorité haute)
- **Pas d'inertie** sur la roue (décision du propriétaire) : ne pas en ajouter.
- ~~**Familles en points sous le cercle**~~ fait le 8 oct. : sur téléphone, `.hero__dice-dots` est masqué (`hero-ivt.css`, `@media (max-width:759px)`). Les afficher sous l'anneau, zones tactiles de 44 px.
- **Produit au centre agrandi** : vérifier la taille de `.hero__media` avec le bloc « J'ai / Je cherche » par-dessus (téléphone 360–430 px, iPad, ordinateur).
- ~~**Hauteur**~~ fait le 8 oct. : sur un écran bas (≤ 600 px), le bloc « J'ai / Je cherche » peut passer sous la ligne de flottaison ; réduire `.hero__stage` (`min-height`) ou remonter le bloc.
- ~~**Tagline**~~ fait le 8 oct. (PHILOSOPHIE § 43) : envisager une ligne très courte au-dessus du sélecteur : « Tu as quelque chose ? Trouvons ceux qui le cherchent. »

### C. En-tête
- ~~Traînée au changement d'onglet~~ corrigée le 8 oct. Vérifier qu'il n'y a **aucune traînée** au changement d'onglet (soulignement `.sh-nav a::after` dans `v3/ivt-header.css`, transitions de vue `startViewTransition` dans `route()`).
- ~~Vérifier le menu plein écran sous 1100 px.~~ vérifié le 9 oct.

### D. Carte
- La carte sans publication affiche le territoire et l'invitation ; vérifier que le message « Le territoire se dessine… » disparaît bien (classe `ready` sur `#tz`).
- ~~Position approximative~~ fait le 8 oct. Les publications sont placées au **centre de leur district** (`MDGMarche.REG`, avec un léger décalage) : l'indiquer dans la fiche (« position approximative »).

### E. Données et serveur (plus tard)
- Tout passe par `store()` / `MDGMarche.load()`. Pour brancher un serveur : remplacer `load()` dans `v3/marche.js` par un appel API qui renvoie la même forme (`producers`, `offers`, `demands`), puis appeler `refreshMarket()`.
- Ne **pas** concevoir l'escrow, le paiement sécurisé ni l'arbitrage maintenant (PHILOSOPHIE § 45).

### F. Tests à faire avant mise en ligne
- Téléphone (360, 390, 430 px), iPad (768, 1024 px), ordinateur (1280, 1440 px).
- Deux thèmes : pages sombres (Accueil, Acheter, Vendre, Demander, Prix, Carte) et pages claires (fiche produit) ; Catégories est passée en sombre.
- Console propre sur chaque route : `#/`, `#/catalogue`, `#/vendre`, `#/demande`, `#/categories`, `#/carte`, `#/prix`, `#/produits/tomate`.
- Parcours complet : « J'ai » sur l'accueil → publier → l'offre apparaît dans Acheter, sur la carte, dans « Je cherche » du même produit ; puis 5 prix de 3 numéros différents → le « prix observé » apparaît.
- Zones tactiles ≥ 44 px, texte ≥ 4,5:1 de contraste.

### G. Autocritique (grille PHILOSOPHIE § 40) à faire pour chaque section
Pour chaque section : 1) quelle question utilisateur ? 2) quelle donnée ? 3) quelle action ? 4) quel état (vide, partiel, plein) ? 5) quelle relation avec le reste du marché ? 6) quelle représentation la plus claire ? 7) quelle technologie ? Supprimer ce qui ne répond à aucune question.

---

## 4. Repères pour coder

- Données : `window.MDG` (référence + publications), `window.MDGMarche` (`load`, `prix`, `prixHTML`, `ICO`, `REG`, `SEUIL`, `tel`, `telFmt`).
- Contexte des pages : `window.MDGCTX` (`M`, `OFFERS`, `offersOf`, `demandsOf`, `prodBy`, `catBy`, `regBy`, `img`, `store`, `toast`, `go`…).
- Composants : `MDGV3.head(kind, o)` (en-tête commun), `MDGV3.nst(o)` (état neutre), `MDGV3.match.open({ slug, mode, anchor })`.
- Icônes : `MDGMarche.ICO.match` (J'ai / Je cherche), `.offre` (cercle vert), `.demande` (carré jaune), `.recherche` (triangle violet), `.connexion` (ligne bleue), `.vendeur` (prix vendeur), `.observe` (prix observé), `.vide` (pas de donnée). Toutes les formes viennent de `MDGMarq` (`v3/marqueurs.js`).
- Règle absolue : **DATA → VISUALISATION, jamais l'inverse.** Sans donnée, un état neutre court, beau, avec une action.
