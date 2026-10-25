# Listes de contrôle (A à K)

> Centre de commande : `README.md` de ce dossier. Ces listes sont le détail « case par case » des unités U01 à U14 : la correspondance liste → unité est dans `MATRICE_TESTS.md`, partie 2.

> Chaque case a un numéro (A1, B3…) pour être citée dans les rapports. Sous chaque case : **comment vérifier** (commande, fichier, requête SQL en lecture seule, capture).
> Le contrôle automatique (`bash tools/controle/lancer.sh statique`, moteur `tools/controle/controle.js`, mode d'emploi `tools/controle/README.md`) fait déjà une partie des recherches : la session Claude **lit son résultat d'abord**, puis fait le reste et juge.
> Une case n'est cochée que si la preuve a été vue (règle « mesurer, ne pas supposer »). Sinon : « non vérifié », avec la raison.

**Périmètre « front de l'application »** (pour les recherches) : `application.dc.html`, `app/*.js`, `v3/*.js`, `v3/*.css`, `css/*.css`, `v2/*.js`. **Site** : gabarits `tools/site/`, `tools/site-*.js` (jamais les pages fabriquées de `site/`). Hors des recherches de textes d'écran : `docs/`, `strategie/`, `.claude/`, `supabase/tests/`.

**Projets Supabase** : test `yowdymdnoiubatxlwhfv` (tests autorisés, dans des blocs annulés) ; production `catmsypctymgkjkfzdkt` (lecture seule, liste H).

**Le navigateur** (listes B, C, E, F) :
- serveur : `python3 -m http.server 8765` lancé depuis le dépôt ;
- Playwright : `/opt/node-tools/node_modules/playwright` ; Chromium : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` ;
- **iPhone émulé** (`devices['iPhone 13']`), sinon la page de maintenance s'affiche ; chaque écran en `colorScheme: 'light'` **et** `'dark'`, à 390 px et 320 px de large ;
- le bac à sable ne joint pas Supabase : les écrans avec compte se testent en simulant les réponses (`page.route`) avec de **vraies** données lues sur le projet de test. Les requêtes vers `*.supabase.co` qui échouent dans le bac à sable ne sont pas des bugs de l'application : les noter à part.
- Écrans de l'application (adresses `application.dc.html#/…`) : `#/` (accueil), `#/produits`, `#/catalogue`, `#/categories`, `#/prix`, `#/carte`, `#/annee`, `#/vendre`, `#/demande`, `#/publier`, `#/mes-publications`, `#/groupes`, `#/boutique`, `#/appro`, `#/producteurs`. Fenêtres : Mon compte (toucher la photo), menu (panier), Réglages, L'aide, Messages, Négociations, Commandes, cloche des notifications, fiche profil, porte de connexion. Plus `admin.html` (administration).

---

## A. Doublons

Règle de `CLAUDE.md` : « Pas de doublons sans raison » : une entrée n'apparaît qu'à un endroit logique.

- [ ] **A1. Aucune entrée du compte en double.** Messages, Négociations, Profil et avatar, Mon profil public, Mes publications, Alertes produits : seulement dans Mon compte, pas dans le menu (panier).
  - Vérifier : ouvrir Mon compte et le menu (iPhone émulé), relever les libellés de chaque liste (`page.locator('…').allInnerTexts()`), comparer les deux listes. Toute entrée commune = orange (rouge si c'est un bouton d'action).
- [ ] **A2. « Se connecter » seulement en bas du menu**, et « Non identifié · S'identifier » seulement sous la photo dans Mon compte.
  - Vérifier : capture du menu et de Mon compte ; recherche `rg -n "Se connecter|S'identifier" application.dc.html app v3`.
- [ ] **A3. « Écrire au Marché de Gros »** n'apparaît dans Messages que s'il n'y a pas déjà la conversation avec le Marché de Gros.
  - Vérifier : lire la condition dans `v3/messages.js` (`rg -n "Écrire au Marché de Gros" v3`) ; capture avec et sans la conversation (réponses simulées).
- [ ] **A4. Notifications : un seul endroit pour les régler** (Réglages : Activer/Désactiver et l'essai) ; la cloche montre la liste. Aucun autre interrupteur de notifications.
  - Vérifier : `rg -n -i "notification" v3/compte.js v3/aide.js application.dc.html` puis capture de Réglages.
- [ ] **A5. Pas la même phrase à deux endroits du même écran** (titre redit par le sous-titre, bouton redit par le texte au-dessus).
  - Vérifier : sur chaque écran, `innerText` découpé en phrases ; deux phrases identiques ou presque (mêmes 6 premiers mots) = candidat. Juger : raison valable ou doublon.
- [ ] **A6. Textes répétés dans plusieurs fichiers** (la même longue phrase copiée dans 2 fichiers ou plus).
  - Vérifier : résultat du script (chaînes de 25 caractères ou plus présentes dans au moins 2 fichiers du front). Juger chaque cas : texte commun voulu (module partagé) ou copie à rassembler.
- [ ] **A7. Fonctions JavaScript en double** : même nom de fonction ou même `window.MDG…` défini dans deux fichiers chargés par la même page.
  - Vérifier : résultat du script ; sinon `rg -n "^\s*(function\s+\w+|window\.MDG\w+\s*=)" app v3` puis compter les noms en double parmi les fichiers chargés par `application.dc.html` (`rg -o 'src="[^"]+"' application.dc.html`).
- [ ] **A8. CSS en double** : même sélecteur défini dans deux fichiers avec des valeurs qui se contredisent.
  - Vérifier : résultat du script ; juger seulement les sélecteurs dont une propriété change de valeur (couleur, taille).
- [ ] **A9. Anciennes fonctions du serveur encore appelables** à côté de la nouvelle (ex. `commande_creer` à côté de `commande_creer2`, anciennes annulations) : porte de côté.
  - Vérifier (projet de test, lecture seule) :
    ```sql
    select p.proname, count(*) as versions,
           bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) as membre_peut
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    group by p.proname
    having count(*) > 1 or p.proname ~ '^(commande_creer|commande_annuler|nego_transport)$'
    order by 1;
    ```
    Toute ancienne version encore exécutable par `authenticated` = rouge si elle contourne une règle (ville, motif, transport).
- [ ] **A10. Notifications en double** : un même événement ne produit qu'une notification (clé anti-doublon de `notif_preparer`).
  - Vérifier (projet de test, lecture seule) : relire `supabase/tests/notifications-88-scenarios.sql` (résultat rejoué, liste G) ; pas de requête sur les données de production.
- [ ] **A11. Documents sans doublon** : une même partie n'est pas écrite deux fois (ex. deux paragraphes « 0 quater » dans `docs/REPRISE.md`).
  - Vérifier : `rg -n "^\*\*[0-9]" docs/REPRISE.md` et titres de `FONCTIONNALITES.md` ; signaler, ne pas corriger.

## B. Sur-explications

Règle de `CLAUDE.md` : « Pas de long texte d'explication sur les écrans » : l'essentiel en quelques mots ou en chiffres rangés ; les explications vont dans les guides et L'aide.

Exclus de cette liste : L'aide (`v3/aide.js`), les guides (`v3/guide.js`, `tools/site/guides/`), les textes juridiques, l'administration (sauf texte manifestement trop long).

- [ ] **B1. Aucun paragraphe sur un écran qu'on ouvre en touchant quelqu'un ou quelque chose** (fiche profil, annonce, commande, boutique).
  - Vérifier : dans le navigateur, relever chaque bloc de texte visible de plus de 120 caractères ou de plus de 2 lignes à 390 px (`el.getClientRects()`, hauteur / `line-height`). Chaque cas = orange, avec la phrase raccourcie proposée.
- [ ] **B2. Pas de slogan** (« Du champ au marché », « Le juste prix, en direct », « Les producteurs viennent à vous »).
  - Vérifier : lecture des titres et chapeaux de chaque écran ; juger : la phrase dit-elle un fait ou une action ? Sinon, la proposer au retrait.
- [ ] **B3. Pas de sous-titre qui redit le titre** (ni la barre du haut, ni le bouton juste en dessous).
  - Vérifier : pour chaque écran, couple (titre, première ligne sous le titre) ; mêmes mots-clés = orange.
- [ ] **B4. Pas de phrase morale** (« se mérite », « en toute confiance », « jamais en payant », « rien d'inventé », « nous veillons à… »).
  - Vérifier : `rg -n -i "se m[ée]rite|en (toute )?confiance|jamais en payant|rien d'invent|nous veillons|ensemble" application.dc.html app v3` puis juger chaque ligne à l'écran.
- [ ] **B5. Pas de texte d'aide permanent sous un champ** quand le libellé suffit ; pas d'explication répétée à chaque ouverture.
  - Vérifier : formulaires Vendre, Demande, Publier, Négocier, Commande : capture, relever les lignes sous les champs.
- [ ] **B6. Notifications courtes** : titre de 45 caractères au plus, texte de 80 au plus, une action claire.
  - Vérifier : textes dans `supabase/functions/pousser/` et dans les fonctions `notif_*` (dernier schéma qui les définit, `rg -ln "notif_relances|notif_preparer" supabase/schema-*.sql`) ; mesurer la longueur de chaque titre et texte écrit en dur.
- [ ] **B7. Messages d'erreur** : disent le problème et la solution, en une phrase ; jamais de texte technique ni d'anglais (`MDGErreur(e)`, `app/toast.js`).
  - Vérifier : `rg -n "alert\(|\.message\b" app v3` pour trouver les erreurs affichées sans `MDGErreur` ; dans le navigateur, couper le réseau (`page.route('**/*supabase*', r => r.abort())`) et relever les textes d'erreur.

## C. Bugs

Règle de `CLAUDE.md` : « Stabilité avant tout » : aucun écran vide ni clignotement ; une fenêtre s'ouvre avec son contenu déjà là ; rien ne s'efface ni ne rejoue au défilement ; une liste relue ne se redessine pas en entier (`MDGStable.poser`, `app/stable.js`).

- [ ] **C1. Aucune erreur JavaScript dans la console**, sur chaque écran et chaque fenêtre de la liste du haut, en clair et en sombre.
  - Vérifier : Playwright, écouter `page.on('console')` (type `error`) et `page.on('pageerror')` ; ouvrir chaque adresse, attendre 3 s, ouvrir chaque fenêtre. Rapport : écran · thème · message exact. Les échecs réseau vers Supabase dus au bac à sable sont notés à part, pas en bug.
- [ ] **C2. Aucun écran vide** : chaque écran montre du contenu ou l'état vide prévu (« Aucune activité », « Aucune alerte » avec le sac qui attend), jamais une zone blanche.
  - Vérifier : capture après 3 s ; compter les nœuds de texte visibles dans la zone principale ; 0 = rouge.
- [ ] **C3. Aucun clignotement à l'ouverture** : pas d'instant vide, pas de fondu du contenu.
  - Vérifier : captures à 50 ms, 200 ms et 1 s après l'ouverture d'une fenêtre ; le contenu doit être là dès la première. Ou vidéo Playwright (`recordVideo`) regardée image par image.
- [ ] **C4. Rien ne se redessine pendant le défilement** ni quand rien ne change.
  - Vérifier : poser un `MutationObserver` sur les listes (tableau des prix, messages, commandes) pendant 30 s sans rien faire, puis pendant un défilement ; plus de quelques mutations sans changement de données = orange.
- [ ] **C5. Hors connexion** : bandeau rouge « Pas de connexion · Réessayer », puis « De retour » ; jamais une deuxième alerte rouge dans l'écran.
  - Vérifier : `context.setOffline(true)` puis `false`, captures.
- [ ] **C6. Rien ne déborde à 320 px.**
  - Vérifier : `document.documentElement.scrollWidth > window.innerWidth` sur chaque écran à 320 px ; tout `true` = orange avec l'élément fautif.
- [ ] **C7. Liens internes et images** : aucune image cassée (`naturalWidth === 0`), aucune adresse `#/…` qui mène à un écran vide.
  - Vérifier : Playwright, liste des `img` après chargement ; `requestfailed` vers le dépôt (pas Supabase).
- [ ] **C8. Tests du serveur** : aucun test de `supabase/tests/` en échec (voir liste G et `REGISTRE_DES_TESTS.md`).
- [ ] **C9. Le site caché** : pages fabriquées à jour (`node tools/site-public.js` ne change rien de plus que la date) et sans erreur console sur l'accueil, la carte, une page produit, un guide, à 1366 px.
  - Vérifier : lancer le générateur dans une copie de travail, `git status` ; Playwright sur `site/`.

## D. Logique et cohérence

Les règles métier sont celles de `CLAUDE.md` (parties « Commandes, transport… », « Notifications », « Design »). Un texte qui contredit une règle, un autre écran ou le serveur = orange ; s'il promet de l'argent ou trompe sur un délai = rouge.

- [ ] **D1. Jamais « PAYÉ ».**
  - Vérifier : `rg -n "PAY[ÉE]" application.dc.html app v3 tools/site` (casse respectée).
- [ ] **D2. Aucune commission ni aucun paiement présenté comme encaissé**, aucun paiement simulé.
  - Vérifier : `rg -n -i "encaiss|pr[ée]lev|rembours|pay[ée]" application.dc.html app v3 tools/site supabase/functions` ; lire chaque ligne. Rappel : la commission est « calculée », jamais « encaissée » ; « rien n'est prélevé » doit rester vrai.
- [ ] **D3. Transport à la charge de l'acheteur** : l'acheteur lit « Transport à votre charge » ; le vendeur choisit « À la charge de l'acheteur » ; l'acheteur qui publie une demande choisit « À ma charge » ; ailleurs « Transport à la charge de l'acheteur ». « À part » seulement pour un transport livré par le vendeur avec un prix ajouté.
  - Vérifier : `rg -n -i "non inclus|sans transport|vient chercher|à part" application.dc.html app v3 tools/site` ; toute occurrence de « Non inclus », « Sans transport » ou « l'acheteur vient chercher » = orange.
- [ ] **D4. Commission** : 3,5 % sur la marchandise ; 6,9 % sur le transport **seulement** avec le service Marché de Gros. Aucun texte ne présente 6,9 % comme général (aide, astuces, Espace chauffeur).
  - Vérifier : `rg -n "6,9|6\.9|3,5|3\.5" application.dc.html app v3 tools/site strategie/sources` ; lire le contexte.
- [ ] **D5. Vérification en 1 h** : partout « 1 h » après la réception, jamais « 24 h » pour la réclamation, côté écran **et** côté serveur.
  - Vérifier : `rg -n "24 ?h" v3/commandes.js v3/aide.js app` ; côté serveur, dernière définition de `commande_litige` et `commande_refuser2` (`rg -ln "function public.commande_litige" supabase/schema-*.sql`, prendre le plus haut numéro) : leurs messages ne doivent pas dire 24 h. Reste connu au 24/10/2026 (`docs/REPRISE.md`).
- [ ] **D6. « Commande terminée »** n'est pas cochée pendant l'heure de vérification (`LIB.terminee`). Reste connu au 24/10/2026.
  - Vérifier : `rg -n "terminee" v3/commandes.js` ; capture d'une commande reçue depuis moins d'1 h (réponses simulées).
- [ ] **D7. Preuves au départ** : pas de chargement sans 2 à 4 photos, le poids, et la photo du papier du mot secret avec le code (3 minutes) ; seule l'équipe voit la photo du papier.
  - Vérifier : textes de `v3/commandes.js` (`rg -n "papier|poids|photo" v3/commandes.js`) ; test `transport-83` bloc A et parcours (a) (liste G).
- [ ] **D8. Ville seulement** : « Vente uniquement à … » / « Achat uniquement à … » ; pastille compacte « [épingle] Guiglo uniquement » dans les endroits serrés (une ligne, « uniquement » jamais coupé) ; le serveur refuse une commande hors de la ville (`commande_creer2`).
  - Vérifier : captures des cartes d'annonce à 320 px (pas de retour à la ligne) ; `rg -n "uniquement" app/ville-seule.js v3`.
- [ ] **D9. Abidjan est une seule ville** : aucune commune proposée comme ville ; choix « Ville ou village » grisé dans la région Abidjan ; jamais « à Cocody ».
  - Vérifier : `rg -n -i "uniquement à (Abobo|Adjamé|Anyama|Attécoubé|Bingerville|Brofodoumé|Cocody|Koumassi|Marcory|Plateau|Port-Bouët|Songon|Treichville|Yopougon)" app v3` ; capture du formulaire Vendre avec la région Abidjan.
- [ ] **D10. Une ville d'une autre région n'est jamais gardée** (jamais « Abidjan » + « Guiglo » à l'ouverture d'un formulaire).
  - Vérifier : Playwright, changer la région du profil puis ouvrir Vendre et Demande ; capture.
- [ ] **D11. Notifications** : aucune fausse urgence, aucune promesse non vérifiée ; jamais « elle arrive » sans `envoyees > 0` ; chaque notification ouvre un écran précis.
  - Vérifier : textes de `supabase/functions/pousser/` et de `v3/compte.js` (essai) : `rg -n -i "vite|dernière chance|urgent|arrive" supabase/functions/pousser v3`.
- [ ] **D12. Textes qui se contredisent entre écrans** (connus à l'audit : « sans intermédiaire » contre « seul intermédiaire » ; « remboursement automatique » ; « jamais d'avance » ; « identités vérifiées par l'équipe » alors que 3 annonces se publient sans vérification).
  - Vérifier : `rg -n -i "intermédiaire|rembours|avance|identités vérifiées" app v3 application.dc.html` ; comparer les phrases entre elles ; voir `docs/audits/audit-logique-viabilite-2026-10-24.md`, partie 5.
- [ ] **D13. Textes qui contredisent le serveur** : chaque délai, chaque seuil, chaque pourcentage affiché est celui du serveur (réglages `notif_regles`, `reglages`, seuils des badges, 72 h d'un accord sans suite, 48 h de confirmation).
  - Vérifier (projet de test, lecture seule) : `select * from public.reglages;` et `select * from public.notif_regles;` comparés aux nombres écrits dans `v3/aide.js`, `v3/commandes.js`, `app/garanties.js`.
- [ ] **D14. « Non identifié » / « Identité vérifiée »** : rien n'est affiché tant que le serveur n'a pas répondu (`MDGIdentite.connu`) ; le compte officiel n'a ni l'un ni l'autre.
  - Vérifier : capture de la fiche profil avant et après la réponse simulée.
- [ ] **D15. Rien de faux ou d'inventé** : pas de faux avis, de faux chiffres, de prix présentés comme « de gros » alors qu'ils sont « de détail » (OCPV).
  - Vérifier : `rg -n -i "prix de gros" tools/site` ; chiffres du marché seulement avec source (`strategie/sources/donnees-marche.json`).

## E. À sa place

- [ ] **E1. Mon compte** (toucher sa photo) contient, dans l'ordre : sous la photo et le nom, le bouton maïs « Non identifié · S'identifier » (si non vérifié) ; en haut, Messages et Négociations ; puis « Votre compte » : Profil et avatar, Mon profil public, Mes publications, Alertes produits…
  - Vérifier : capture de Mon compte, comparer à cet ordre.
- [ ] **E2. Le menu (panier)** ne répète pas le compte ; « Se connecter » seulement en bas.
  - Vérifier : capture du menu.
- [ ] **E3. Réglages** : seulement Activer/Désactiver les notifications et l'essai ; plus aucun interrupteur par catégorie.
  - Vérifier : capture de Réglages.
- [ ] **E4. L'aide** : « Revoir un tutoriel » (replié) et la démo y sont, nulle part ailleurs.
  - Vérifier : `rg -n "Revoir un tutoriel" app v3` ; capture.
- [ ] **E5. « Montrer mon nom de famille »** est dans Mon compte → Profil et avatar, nulle part ailleurs.
  - Vérifier : `rg -n "nom de famille" app v3`.
- [ ] **E6. Chaque notification ouvre l'écran précis** de son objet (offre, commande, négociation), jamais l'accueil par défaut.
  - Vérifier : lire la table des destinations dans `supabase/functions/pousser/` et dans le code qui reçoit le toucher (`rg -n "notificationclick" sw.js`).
- [ ] **E7. Le site est pour l'ordinateur, l'application pour le téléphone** : `application.dc.html` sur ordinateur mène à la maintenance (sauf administrateur) ; le site reste en `noindex` tant que le propriétaire n'a pas ouvert.
  - Vérifier : `rg -n "noindex" tools/site/_debut.html` ; Playwright en taille ordinateur sur `application.dc.html` → `maintenance.html`.
- [ ] **E8. Rien de technique en permanence** (« en ligne », numéros de version) ; seulement quand quelque chose ne va pas.
  - Vérifier : captures ; `rg -n -i "en ligne" application.dc.html app v3` puis juger.

## F. Design

Référence : `DESIGN.md`, section 8 (les 32 lois). Chaque semaine, les 32 lois une par une ; tous les 3 jours, les cases ci-dessous.

- [ ] **F1. Une seule police : Jost.**
  - Vérifier : `rg -n "font-family" application.dc.html app v3 css` : seulement `Jost` ou les variables `var(--font-…)` qui valent Jost (`css/mgci-tokens.css`, `css/fonts.css`) ; dans le navigateur, `getComputedStyle(el).fontFamily` sur un échantillon d'éléments.
- [ ] **F2. Pas de bleu**, sauf le lien « compatible » de la carte et l'eau (fleuves, lacs) sur les cartes. Badge « vérifié » et négociations en vert profond `#10392B`.
  - Vérifier : résultat du script (couleurs dont la teinte est bleue) ; juger chaque cas contre les deux exceptions. Le violet `--vous` (« votre position ») est permis.
- [ ] **F3. Nombres à côté d'un libellé toujours dans une pastille `.nbul`**, jamais nus ni entre parenthèses.
  - Vérifier : captures ; `rg -n "\(\$\{|\(' ?\+" app v3` pour les nombres entre parenthèses construits en JavaScript ; juger.
- [ ] **F4. Contraste mesuré sur le vrai fond** : texte ≥ 4,5:1, gros texte ≥ 3:1 ; maïs jamais en texte sur fond clair (`#765802` à la place).
  - Vérifier : `python3 .claude/skills/antislop-human/contrast-check.py "#texte" "#fond"` pour chaque couleur de texte nouvelle ou changée depuis le dernier rapport (`git diff` des CSS).
- [ ] **F5. Pas de tiret cadratin (—) dans les textes d'écran** (sauf une case vide de tableau).
  - Vérifier : `rg -n "—" application.dc.html app v3 tools/site` hors commentaires ; juger.
- [ ] **F6. Pas d'emoji à la place d'une icône** dans les boutons, listes, onglets.
  - Vérifier : résultat du script (caractères emoji dans le front) ; juger.
- [ ] **F7. « de Gros » en couleur maïs `#F2C230`** ; dégradé avec reflet seulement sur la page de connexion (`v3/nuage.js`, `.ng-tt-g`).
  - Vérifier : `rg -n "gradient" app v3 css | rg -i "text|clip"` : seul `.ng-tt-g` doit sortir.
- [ ] **F8. Animations** : rien ne bouge en boucle sans raison ; les personnages respirent et clignent seulement, sautent seulement quand il y a du nouveau ; `prefers-reduced-motion` respecté.
  - Vérifier : `rg -n "infinite" app v3 css` ; juger chaque animation ; Playwright avec `reducedMotion: 'reduce'`.
- [ ] **F9. Cibles tactiles de 44 px au moins.**
  - Vérifier : Playwright, `boundingBox()` de chaque `button` et `a` visible ; tout côté < 44 px = orange (sauf lien dans une phrase).
- [ ] **F10. Photos de produits** : chaque `v2/img/produit-<id>.webp` a son identifiant dans `A.SACK` (`app/marche-app.js`) ; la tomate en carton.
  - Vérifier : comparer `ls v2/img/produit-*.webp` à `rg -o "'[a-z-]+'" ` dans le bloc `SACK` de `app/marche-app.js` ; liste des produits sans photo : `docs/IMAGES.md`.
- [ ] **F11. Détecteur anti-« design généré »** sur les fichiers changés depuis le dernier rapport.
  - Vérifier : `.claude/skills/impeccable/scripts/impeccable detect --json <fichiers>` (les `<img>` sans `src` des gabarits `{{ … }}` sont de fausses alertes).

## G. Serveur, sur le PROJET DE TEST seulement (`yowdymdnoiubatxlwhfv`)

Jamais sur la production. Jamais de `drop`, `delete`, `truncate`. Le MCP Supabase refuse toute requête qui contient ces mots, même en commentaire : ne pas contourner.

- [ ] **G1. Rejouer chaque fichier de `supabase/tests/*.sql`**, bloc par bloc, et comparer au résultat écrit dans le fichier.
  - Avant de lancer : vérifier que **chaque** bloc `do $$ … end $$` se termine par `raise exception 'TEST…'` (sinon : ne pas lancer, rouge). Les fonctions `pg_temp.*` d'en-tête se lancent dans le **même appel** que le bloc.
  - Lancer avec `execute_sql` sur le projet de test ; le message d'erreur « TEST: … » **est** le résultat. Même résultat = vert ; résultat différent = orange (ou rouge si une règle de sécurité ou d'argent ne tient plus) ; donnée vivante qui bouge (un compte, une durée) = vert avec note.
  - Tenir à jour le tableau de `REGISTRE_DES_TESTS.md` (dans la PR du rapport, seulement la date et le résultat proposés dans le rapport ; le registre est modifié par une PR de correction).
- [ ] **G2. RLS sur toutes les tables.**
  ```sql
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  ```
  Résultat attendu : aucune ligne.
- [ ] **G3. Droits de `anon` sur les tables.**
  ```sql
  select table_name, string_agg(privilege_type, ', ' order by privilege_type) as droits
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
  group by table_name order by 1;
  ```
  Comparer à la liste du rapport précédent. Toute table nouvelle ou tout droit d'écriture nouveau = rouge à expliquer.
- [ ] **G4. Fonctions exécutables par `anon`.**
  ```sql
  select p.proname, p.prosecdef as security_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
  order by 1;
  ```
  Lecture publique voulue (au 25/10/2026) : `annonces_duree_jours`, `annonces_version`, `niveaux_criteres`, `pseudo_libre`, `reputation_publique`, `signalements_publics`, `tableau_produits`, et les fonctions du site (`fil_public`, `stats_publiques`, `mesurer`…). Les fonctions internes (`accords_sans_suite`, `commandes_delais`, `annonces_expirer`, `notif_*`, `sequestre_liberer_echus`, `tableau_prix_calculer`) : ni `anon` ni `authenticated`. Tout nom nouveau = à juger.
- [ ] **G5. Fonctions `security definer` sans `search_path` fixé.**
  ```sql
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%');
  ```
- [ ] **G6. Conseillers Supabase** : `get_advisors` type `security` puis type `performance` sur le projet de test. Comparer au rapport précédent : nouveau / toujours là / réglé.
- [ ] **G7. Tâches planifiées qui tournent.**
  ```sql
  select jobname, schedule, active from cron.job order by 1;
  select j.jobname, d.status, count(*) as fois, max(d.end_time) as derniere
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
  where d.start_time > now() - interval '3 days'
  group by j.jobname, d.status order by 1, 2;
  ```
  Attendu sur le test (relevé du 24/10/2026, 13 tâches) : `mdg-annonces-expirer`, `mdg-commandes-delais`, `mdg-fiabilite`, `mdg-groupes-echeances`, `mdg-notif`, `mdg-rappels-achat` (toutes les 15 min) ; `mdg-liberer-echus`, `mdg-prix`, `mdg-marketing` (toutes les 5 min) ; `mdg-effacer-messages`, `mdg-identites-matin` (7 h 45), `mdg-purger-positions` (3 h 23), `mdg-niveaux` (4 h 37). Une tâche inactive, en échec, ou sans exécution sur 3 jours = rouge. `mdg-niveaux` n'avait encore aucune exécution enregistrée le 24/10/2026 : à confirmer.
- [ ] **G8. Les fonctions du dépôt sont celles du test** : pour les schémas récents, comparer l'empreinte du corps (md5 de `prosrc`, commentaires `--` retirés, blancs ramenés à un espace) entre la dernière définition dans `supabase/schema-*.sql` et le test. Méthode : `REGISTRE_DES_TESTS.md`, partie 2 (étape 1 du rapport de bout en bout).

## H. Production en LECTURE SEULE (`catmsypctymgkjkfzdkt`)

**Rien n'est écrit. Aucun test. Aucune donnée de membre lue.** Seulement :

- [ ] **H1. Conseillers Supabase** : `get_advisors` type `security`, puis type `performance`. Comparer au rapport précédent.
- [ ] **H2. Journaux d'erreurs** des dernières 24 h (le MCP ne remonte pas plus loin) : `get_logs` / `query_logs` pour les services `postgres`, `api`, `auth`, `edge-function` (`pousser`, `itineraire`). Relever seulement le type d'erreur et le nombre, **jamais** de numéro, de nom ni de contenu de message.
- [ ] **H3. Tâches planifiées** : mêmes deux requêtes que G7 (lecture de `cron.job` et `cron.job_run_details`). Rouge si une tâche est inactive ou en échec.
- [ ] **H4. Écart test / production** : seulement noter, d'après `docs/REPRISE.md`, quels schémas attendent le « OK production » du propriétaire. Ne jamais appliquer.
- Si le MCP Supabase n'est pas joignable : écrire « H non vérifié : MCP Supabase non joignable » ; ne pas chercher un autre chemin.

## I. Sécurité

À refaire **en entier** (audit de sécurité) avant l'ouverture au public, avant le paiement, après chaque grosse fonction nouvelle (règle de `CLAUDE.md`). Tous les 3 jours, seulement :

- [ ] **I1. Aucune clé secrète dans le front** ni dans le dépôt.
  - Vérifier : résultat du script ; sinon `rg -n -i "service_role|sb_secret_|BEGIN (RSA |EC )?PRIVATE KEY|sk_live|VAPID_PRIVATE|SUPABASE_SERVICE" --glob '!docs/**' --glob '!.claude/**' .` ; pour chaque jeton `eyJ…` trouvé, décoder la partie du milieu (base64) : `"role":"anon"` est permis, `"role":"service_role"` = rouge.
- [ ] **I2. Les tâches GitHub lisent les secrets par `${{ secrets.… }}`**, jamais en clair.
  - Vérifier : `rg -n -i "key|token|secret" .github/workflows`.
- [ ] **I3. Fonctions d'argent et d'administration non appelables par un membre** (`admin_*`, séquestre, commission).
  - Vérifier (test) : requête G4 avec `'authenticated'` à la place de `'anon'`, filtrée sur `admin_%|sequestre%|commission%` ; chaque `admin_*` doit vérifier `est_admin` (tests `transport-83` bloc G, `fiabilite-84` bloc E).
- [ ] **I4. Entrée cachée de l'administrateur** : le petit point, puis la vérification `est_admin` par le serveur ; aucune page d'administration ne s'affiche sans elle.
  - Vérifier : `rg -n "est_admin" admin.html index-v3.html app v3 site/garde.js` ; Playwright sans compte sur `admin.html`.
- [ ] **I5. Points ouverts connus** (à rappeler, pas à corriger) : comptes créés sans preuve du numéro ; anti-robot Turnstile non installé.

## J. Cache

Règle de `CLAUDE.md` : à chaque changement du front, monter le `?v=` du fichier modifié dans les pages HTML, monter `CACHE` dans `sw.js` (`mgci-vNNN`), ajouter les nouvelles images à `IMAGES` de `sw.js`.

- [ ] **J1. Chaque fichier front changé depuis le dernier rapport a son `?v=` monté** dans toutes les pages qui le chargent.
  - Vérifier : `git log --since="<date du rapport précédent>" --name-only --format= origin/main -- app v3 css v2 | sort -u`, puis pour chaque fichier, `git log -1 --format=%H -- <fichier>` et `git log -1 --format=%H -S"<fichier>?v=" -- application.dc.html admin.html index-v3.html` : la page doit avoir changé son `?v=` dans le même commit ou après.
- [ ] **J2. `CACHE` de `sw.js` monté** à chaque commit qui change le front.
  - Vérifier : `git log -p --since="<date>" -- sw.js | rg "^[-+]const CACHE"`.
- [ ] **J3. Chaque image `v2/img/*.webp` utilisée par l'application est dans `IMAGES`** de `sw.js`.
  - Vérifier : résultat du script ; sinon comparer `ls v2/img/` à la liste `IMAGES` (ligne `const IMAGES = [` de `sw.js`).

## K. Documents à jour

- [ ] **K1. `FONCTIONNALITES.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `CHANGELOG.md`** citent chaque fonction, table et écran ajoutés depuis le dernier rapport ; aucune idée n'est présentée comme faite.
  - Vérifier : nouveaux fichiers `supabase/schema-*.sql` depuis le dernier rapport (`git log --since=… --diff-filter=A --name-only -- supabase`) ; chaque nom de fonction créé (`create or replace function public.<nom>`) cherché dans les 4 documents.
- [ ] **K2. `docs/PASSATION.md`** a une section pour chaque PR fusionnée depuis le dernier rapport.
  - Vérifier : `gh api "repos/Stan77i/marchedegrosci/pulls?state=closed&per_page=30" --jq '.[] | select(.merged_at) | [.number, .title, .merged_at] | @tsv'` ; chercher chaque titre dans `docs/PASSATION.md`.
- [ ] **K3. `docs/REPRISE.md`** : date de mise à jour récente ; « ce qui reste » ne liste pas une chose déjà faite.
- [ ] **K4. `PORTAGE-SITE.md`, partie 4** : chaque nouveauté de l'application qui n'est pas dans un module commun y a sa ligne.
- [ ] **K5. Ce dossier** : chaque fichier de `supabase/tests/` est dans `REGISTRE_DES_TESTS.md`, dans `MATRICE_TESTS.md` et dans `tools/controle/unites.json` ; chaque nouvelle règle de `CLAUDE.md` a sa case ici.
  - Vérifier : `ls supabase/tests/*.sql` comparé au tableau du registre ; règles de `CLAUDE.md` datées depuis le dernier rapport (`git log -p --since=… -- CLAUDE.md`).
- [ ] **K6. `CLAUDE.md`** : pas deux règles qui se contredisent ; « Décisions en attente » ne contient pas une décision déjà tranchée.
