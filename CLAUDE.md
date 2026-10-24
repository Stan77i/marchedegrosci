# Règles du projet Marché de Gros CI (à lire au début de chaque discussion)

Ce fichier est lu automatiquement par Claude Code. Le détail de tout ce qui a été fait est dans `docs/PASSATION.md` : le lire avant de toucher au code.

**Reprise après une discussion vidée : lire d'abord `docs/REPRISE.md`** (état exact, ce qui est fait, ce qui reste, pièges connus).

**Nouvelle discussion : un mot suffit** (règle du propriétaire, 24/10/2026). Le propriétaire vide souvent la discussion et écrit seulement « On reprend », « Continue » ou une courte phrase. Alors, sans lui poser de question :
1. lire `docs/REPRISE.md` (partie 1 : l'état ; partie 3 : ce qui reste, dans l'ordre) ;
   puis rappeler en une ligne ce qui attend le propriétaire dans `docs/A-FAIRE-PROPRIETAIRE.md` (s'il reste des cases non cochées) ;
2. regarder les PR ouvertes (`gh api "repos/Stan77i/marchedegrosci/pulls?state=open" --jq '.[].number'`) et les signaler s'il y en a ;
3. partir de `origin/main` à jour ;
4. continuer la prochaine tâche de la partie 3, ou celle que sa phrase désigne, puis lui dire en deux lignes où on en est.

**Compétences : s'en servir sans cesse, dès qu'une tâche en a besoin** (règle du propriétaire, 23/10/2026). Les 25 compétences du dépôt (`.claude/skills/` : design, UX, anti-« IA », navigateur, business, marketing, SEO) et leur usage sont listés dans `docs/REPRISE.md`, partie 4.

## Règle n° 1 : tenir ce fichier à jour

- **Dès que le propriétaire donne une nouvelle règle, une préférence ou une décision durable, l'ajouter ici tout de suite**, dans la même PR que le travail en cours, ou dans une petite PR à part. Ne pas attendre qu'il le demande.
- Une règle qui change : remplacer l'ancienne, ne pas garder les deux.
- Une décision en attente qui est tranchée : la retirer de « Décisions en attente » et l'écrire comme règle.

## Les PDF de stratégie (`strategie/`)

- Pitch, présentation, problème et solution, marketing : les **modèles** sont dans `strategie/sources/*.html`, les **PDF** dans `strategie/`. Le mode d'emploi est dans `strategie/README.md`.
- Les chiffres se mettent à jour tout seuls : catalogue et photos lus dans le dépôt, activité lue dans la base (`stats_publiques()`, schéma 79), chiffres du marché dans `strategie/sources/donnees-marche.json`.
- Mise à jour automatique (accord du propriétaire, 23/10/2026) : `.github/workflows/strategie-pdf.yml` refait les PDF chaque lundi et à chaque fusion qui touche `strategie/sources/`, le catalogue ou les photos, puis les enregistre dans `main`.
- **Quand une fonction, un prix, une commission, une règle ou l'état du projet change, mettre aussi à jour le texte des modèles concernés**, puis refaire les PDF : `CHROMIUM=/opt/pw-browsers/chromium node strategie/sources/construire.js`.
- Chiffres du marché : seulement avec une source ouverte et vérifiée (lien, année, citation). Jamais de chiffre inventé, jamais de prévision présentée comme un fait.

## Le propriétaire

- Répondre **en français simple et court**. Le propriétaire n'est pas développeur.
- Il n'a **pas d'argent pour l'instant** : aucune solution payante (SMS, WhatsApp, plan Supabase Pro, service ou abonnement payant, dépendance inutile).
- Envoyer les captures d'écran avec SendUserFile.
- Simplicité avant tout.

## Le projet

- Dépôt : `Stan77i/marchedegrosci`.
- **Priorité : l'application mobile `application.dc.html`.** Le site web, c'est `index.html` / `index-v3.html`.
- Supabase de **production** : `catmsypctymgkjkfzdkt` (organisation « mgci », plan gratuit).
- Supabase de **test** : `yowdymdnoiubatxlwhfv` (« mgci-test »). Il contient encore des données de simulation ; le nettoyage est facultatif et c'est au propriétaire de le faire.
- Site IVT (source de produits et de photos) : `Stan77i/ivt-boutique`.

## Façon de travailler

- **Une PR par mise à jour. Ne jamais fusionner** : c'est le propriétaire qui fusionne. Quand une PR dépend d'une autre, indiquer l'ordre de fusion.
- **Avant d'ajouter un commit à une PR existante, vérifier qu'elle est encore ouverte** (`gh api repos/Stan77i/marchedegrosci/pulls/<n> --jq .state,.merged`). Fusionnée ou fermée : nouvelle branche depuis `origin/main` et nouvelle PR. Le propriétaire fusionne vite : dans le doute, toujours une nouvelle PR.
- **Choix du modèle pour les agents** (règle du propriétaire, 24/10/2026) : le travail simple et répétitif (recherches, vérifications mécaniques, remplacements en série) va à un modèle plus léger ; le travail qui demande une précision chirurgicale (textes sans rien inventer, accessibilité, design, relecture) reste sur le modèle le plus fort. Pour aller vite sur beaucoup de tâches, une opération coordonnée (équipes sur des fichiers séparés, chacune relue).
- Créer les PR avec `gh api repos/Stan77i/marchedegrosci/pulls --input fichier.json`, le JSON étant écrit par python dans le scratchpad.
- Partir de `origin/main` à jour pour chaque nouvelle branche (`claude/<sujet>`).
- **À chaque changement du front** :
  - augmenter le `?v=` des fichiers modifiés dans les pages HTML ;
  - augmenter `CACHE` dans `sw.js` (format `mgci-vNNN`) ;
  - ajouter les nouvelles images à la liste `IMAGES` de `sw.js`.
- **Documentation officielle** (demande du propriétaire, 24/10/2026) : `FONCTIONNALITES.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `CHANGELOG.md` à la racine. Chaque PR qui ajoute ou change une fonctionnalité les met à jour (état réel, fichiers, tables, fonctions) ; ne jamais présenter une idée comme faite.
- **Rapport de passation à chaque fois** (règle du propriétaire, 23/10/2026) : chaque PR ajoute sa section dans `docs/PASSATION.md` et met à jour tout ce qui doit l'être (`docs/REPRISE.md` : état, ce qui est fait, ce qui reste ; `docs/seo/PLAN.md` pour le site ; `PORTAGE-SITE.md`, `FOUNDER_CONTEXT.md`, modèles de `strategie/sources/`, `DESIGN.md` quand ils sont concernés). Sans attendre qu'il le demande.
- **Mesurer, ne pas supposer.** Aucune donnée inventée. Ne jamais dire qu'un test, un déploiement ou une migration a réussi sans l'avoir vérifié.
- Vérifier dans un vrai navigateur :
  - Playwright : `/opt/node-tools/node_modules/playwright` ;
  - Chromium : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` ;
  - serveur : `python3 -m http.server 8765` lancé depuis le dépôt ;
  - émuler un iPhone, sinon la page de maintenance s'affiche.

## Le site (`index-v3.html`)

- **Décision du propriétaire (23/10/2026) : un nouveau site public, vitrine vivante de l'application.**
  - Il montre en direct ce qui se passe dans l'application (annonces, demandes, commandes) sur une carte du réseau, la même que dans l'application mais plus complète. Elle remplace la carte actuelle du site.
  - Il sert au marketing, au référencement (SEO) et à toute la communication sur Internet.
  - Parcours du visiteur : il clique sur une annonce → il crée son compte (le même que dans l'application) → on l'invite à prendre l'application : Play Store ou App Store quand elle y sera (liens à ajouter le moment venu), en attendant un code QR à scanner sur ordinateur, ou l'application qui s'ouvre sur téléphone.
  - Vie privée : prénom ou initiale, ville, produit, quantité. Jamais de numéro ni de nom complet.
  - **L'ancien site n'est pas supprimé : il devient invisible** pour le public. Seul l'administrateur le voit, et voit aussi le nouveau. Garder l'entrée cachée de l'administrateur (le petit point, puis la vérification `est_admin` par le serveur).
  - **Le site est fait pour l'ordinateur** : vitrine qui amène à installer l'application ; sur téléphone, c'est l'application.
  - **Le nouveau site se construit caché** : le public garde la page de maintenance ; l'administrateur choisit en haut « Application · Ancien site · SEO ». Pages en `noindex` jusqu'à l'ouverture, que seul le propriétaire décide.
  - Plan, audits et concurrents : `docs/seo/PLAN.md` (à lire avant de travailler sur le site).
  - Les pages `site/` sont **fabriquées** par `tools/site-public.js` (gabarits `tools/site/`, guides `tools/site/guides/`, pages produits `tools/site-produits.js`, photos `tools/site-images.py`) : modifier les gabarits, jamais les pages fabriquées. Mode d'emploi : `PORTAGE-SITE.md`, partie 6.
- **Avant de toucher au site, lire `PORTAGE-SITE.md`.** On y trouve l'état du site (en maintenance, ouvert seulement à l'admin), la décision du propriétaire (le site doit faire la même chose que l'application, et ce qui ne sert à rien est retiré), la méthode conseillée (un seul code) et la liste de ce qu'il faut porter et retirer.
- **Chaque nouveauté de l'application qui n'est pas dans un module commun ajoute une ligne à `PORTAGE-SITE.md`, partie 4, dans la même PR.** Une ligne portée sur le site est retirée.
- L'inventaire (partie 7) se refait tout seul (`tools/inventaire-site.js`, tâche `.github/workflows/rapport-site.yml`). Ne pas l'écrire à la main.
- Rien n'est retiré du site sans que le propriétaire ait validé la liste de la partie 5.

## Supabase

- Appliquer moi-même les changements avec le MCP (`execute_sql` / `apply_migration`), et garder un fichier `supabase/schema-NN-<sujet>.sql` dans le dépôt.
- **Jamais de `drop`, `delete` ou `truncate` sans l'autorisation du propriétaire.** Utiliser `create or replace` et `add column if not exists`. Si une opération risque de supprimer des données : s'arrêter et expliquer avant.
- Le MCP bloque toute requête qui contient DELETE, DROP ou TRUNCATE, même dans un commentaire ou dans le corps d'une fonction. Ne pas contourner ce garde-fou.
  - Enlever les commentaires d'en-tête avant d'appliquer.
  - Pour changer une fonction qui contient « delete », passer par une fonction « porte » qui l'enveloppe.
- Tester d'abord sur le projet de test. Tester sans rien laisser : un bloc `do $$ … raise exception 'TEST' $$`, avec `set_config('request.jwt.claims', …)` et `set local role authenticated` pour se faire passer pour un utilisateur.
- **Aucun test destructif et aucune modification des données de production.**

## Sécurité et argent (règles de la mission)

- « Aucune commande ni dépense ne doit être déclenchée automatiquement sans confirmation explicite de l'acheteur. »
- « Aucun système de paiement n'est encore à considérer comme opérationnel. Ne simule pas de paiement, ne prélève aucun argent et ne prétends pas qu'une commission a été encaissée. »
- « Ne révèle jamais de clé secrète ou de clé privilégiée dans le frontend. »
- **Audit de sécurité** : fait (octobre 2026), toutes les failles trouvées sont corrigées (détail dans `docs/PASSATION.md`). **À refaire** avant l'ouverture au public, avant de brancher le paiement, et après chaque grosse fonction nouvelle.
- Points restés ouverts : comptes créés sans preuve du numéro (attend le SMS/WhatsApp, donc un budget) ; anti-robot Turnstile pas installé (voir « Décisions en attente »).

## Commandes, transport, fiabilité, badges, boutiques (décisions du 24/10/2026)

- Les 44 réponses de `docs/audits/decisions-chantiers-2026-10-24.md` sont **validées par le propriétaire** : ce sont les règles des 4 chantiers. Les points clés :
  - même ville : le vendeur organise son livreur, payé par l'acheteur directement, hors Marché de Gros ; retrait par l'acheteur seulement si le vendeur l'accepte ; « même ville » = même ville choisie dans la liste ;
  - villes différentes : transport inclus ou à part ; le prix à part se donne dans la proposition et se négocie ;
  - **Transport à la charge de l'acheteur** (règle du propriétaire, 24/10/2026) : chacun le lit de son côté. L'acheteur lit « Transport à votre charge » (annonces, tableau du marché) ; le vendeur choisit « À la charge de l'acheteur » ; l'acheteur qui publie une demande choisit « À ma charge » ; ailleurs (négociation, commande) : « Transport à la charge de l'acheteur ». « À part » est réservé au transport livré par le vendeur avec un prix ajouté, négocié dans la proposition. Jamais « Non inclus », « Sans transport », ni « l'acheteur vient chercher » pour ce choix ;
  - transporteur Marché de Gros : seulement vérifié ; il propose son prix, acheteur et vendeur acceptent, refusent ou contre-proposent (48 h) ; si refus, la commande continue avec le livreur du vendeur ; pas de messages privés avec lui pendant la mission ; le service reste fermé tant qu'il n'y a pas 3 transporteurs vérifiés et l'accord du propriétaire ;
  - **vérification en 1 h** (règle du propriétaire, 24/10/2026, schéma 89) : sans réclamation de l'acheteur dans l'heure qui suit la réception, la commande se clôt toute seule (avant : 24 h) ; l'acheteur est prévenu en confirmant la réception ;
  - **preuves au départ** (règle du propriétaire, 24/10/2026, schémas 90 et 90b) : pas de chargement sans 2 à 4 photos du colis emballé, le poids pesé et, s'il y a un mot secret, la photo du papier avec un code au hasard écrit à côté (3 minutes après « Afficher le code ») ; seule l'équipe voit la photo du papier ; un acheteur qui dit « cassé » face à des photos de départ propres doit le prouver, l'équipe juge ;
  - commission 3,5 % sur la marchandise ; 6,9 % sur le transport seulement avec le service Marché de Gros, retenue sur le prix du transporteur ; jamais présentée comme encaissée ;
  - annulations : motif obligatoire, catégories (abusive, légitime, litige, problème technique), 90 jours glissants, suspension décidée par l'administrateur (7 puis 30 jours), contestation 7 jours, pas de rétroactivité ;
  - badges : 12 mois glissants, commandes terminées seulement, seuils réglables par l'administrateur, grâce de 30 jours, historique et contestation ;
  - boutiques : adresse = pseudo ou code court, activée par le vendeur, « retirer » cache sans effacer, quantité obligatoire, aperçu de partage par pages fabriquées en `noindex`.
- Ordre de construction : transport, fiabilité, badges, boutiques ; une PR par chantier, testée sur le projet de test avant la production.

## Notifications (chantier du 24/10/2026)

- Deux natures : **transactionnelles** (messages, négociations, commandes et livraisons, litiges, sécurité) et **commerciales** (nouvelles offres, acheteurs pour mes produits, groupes ouverts, produits à racheter, contenus du marché : plafonnées). **Plus aucun réglage par catégorie** (schéma 91) : le serveur ignore les anciennes préférences (`_notif_pref` répond toujours « oui ») ; le seul choix est Activer/Désactiver sur le téléphone.
- Rythme réglable par l'administrateur (`notif_regles`, schéma 91) : 8 commerciales au plus par jour et par personne, dont 4 « contenus du marché » ; 90 min d'écart entre deux (180 si les 5 derniers n'ont pas été ouverts : on espace, on n'arrête pas) ; rien de commercial entre 21 h et 7 h (UTC = heure d'Abidjan). Pas de plafond pour toute la plateforme ni de pause de 3 jours (le propriétaire ne veut pas d'arrêt). Chaque envoi passe par `notif_preparer` (plafond, écart, heures calmes, clé anti-doublon, journal).
- Textes : titre de 45 caractères au plus, texte de 80 ; une action claire ; **aucune fausse urgence, aucune promesse non vérifiée** ; jamais dire qu'une notification « arrive » sans la réponse du serveur (`envoyees > 0`).
- Chaque notification ouvre un écran précis, jamais l'accueil par défaut. Mesures honnêtes : envoyée, ouverte, action ; jamais l'affichage réel ni la notification balayée.
- En production depuis le 24/10/2026 : 88a, 88b, 88d, puis `pousser`. **Le schéma 91 et la nouvelle `pousser` sont testés sur le projet de test seulement** : la production attend l'accord du propriétaire. Pour tout changement : schéma d'abord, fonction ensuite. Effacer le journal après 90 jours : seulement avec l'accord du propriétaire.

## Design

- Une seule police : **Jost**.
- « de Gros » en couleur maïs `#F2C230`.
- Ne jamais écrire « PAYÉ ».
- Photos de produits : `v2/img/produit-<identifiant>.webp`, carré 800 × 800, fond transparent. L'identifiant doit aussi figurer dans `A.SACK` (`app/marche-app.js`) avec la teinte du produit, sinon la photo ne s'affiche pas. La liste des produits sans photo est dans `docs/IMAGES.md`.
- La tomate est montrée **en carton**, pas en sac.
- Avatars : les **personnages du marché** (`v3/personnages.js`) : des produits avec un visage, dessinés en SVG. Au repos, ils respirent et clignent des yeux seulement ; ils **sautent uniquement quand il y a du nouveau** (proposition de prix, message, notification, commande à traiter) ou quand on change son avatar. Pas de service extérieur. Les anciens portraits restent lisibles.
- Couleurs de l'accord conclu : vert de la marque, plus de bleu.
- **L'eau (fleuves, lacs) reste en bleu sur les cartes** (décision du propriétaire, 24/10/2026) : le bleu y a un sens ; c'est la seule exception avec le lien « compatible ».
- **Décisions de l'audit antislop (24/10/2026)** : le badge « vérifié » et les négociations sont en vert profond `#10392B` (plus aucun bleu, sauf le lien « compatible » de la carte et l'eau des cartes) ; l'accueil vivant est « calmé » (chaque effet se joue 1 ou 2 fois, puis rejoue seulement quand on change de produit) ; « de Gros » en dégradé avec reflet est gardé, sur la page de connexion seulement.
- **Titre de la connexion (choix du propriétaire, 24/10/2026)** : « marché **de Gros** » passe à « marché **du pays** » 3 s après l'apparition (reflet doré), « du pays » reste 2 s, puis retour ; la séquence recommence toutes les 10 s (`v3/nuage.js`, CSS seulement). La scène de la porte ne change pas : le « court film » de connexion a été essayé puis **refusé** par le propriétaire (branche `claude/scene-connexion`, non fusionnée).
- **Captures de validation avant chaque PR** (règle du propriétaire, 24/10/2026) : pour tout changement visible (écran, texte, bouton), envoyer d'abord les captures (iPhone émulé, sombre et clair) avec SendUserFile et attendre son accord avant de créer la PR.
- **Animations : vidéo d'aperçu d'abord** (règle du propriétaire, 24/10/2026) : pour toute animation nouvelle ou changée, envoyer une vidéo d'aperçu (MP4) et attendre son « OK » avant de créer la PR.
- **Signature de la marque** (choix du propriétaire, 24/10/2026) : l'animation « marché de Gros » / « marché du pays » est gardée dans `videos/signature/` (MP4 carré et large, page qui sert à les refaire, mode d'emploi). La garder identique au titre de la connexion.
- **Stabilité avant tout** (règle du propriétaire, 24/10/2026) : aucun écran vide ni clignotement. Une fenêtre s'ouvre avec son contenu déjà là (pas de fondu du contenu à l'ouverture) ; rien ne s'efface ni ne rejoue pendant qu'on fait défiler ; une liste relue régulièrement ne se redessine pas en entier (`MDGStable.poser`, `app/stable.js`) ni quand rien n'a changé.
- **Ville seulement** (règle du propriétaire, 24/10/2026, schéma 87) : un vendeur peut vendre, un acheteur acheter, uniquement dans la ville de son annonce. Pour une localité tapée (village, campement), c'est la **ville de rattachement de la région choisie** qui compte (« Guiglo » tapé dans la région Abidjan → « Je vends uniquement à Abidjan »), dans l'application et sur le serveur (`_ville_ref`, schéma 87b) ; la région choisie ne change jamais toute seule. **Une ville d'une autre région n'est jamais gardée en mémoire** (règle du propriétaire, 24/10/2026) : quand la région du profil change (carte « Vous êtes à », position), la ville d'une autre région est vidée, et un formulaire ne s'ouvre jamais avec « Abidjan » + « Guiglo » ; seule une localité que le membre tape lui-même reste, rattachée à une ville de sa région. **Abidjan est une seule ville** (règle du propriétaire, 24/10/2026, schéma 87c) : ses 13 communes (Abobo, Adjamé, Anyama, Attécoubé, Bingerville, Brofodoumé, Cocody, Koumassi, Marcory, Plateau, Port-Bouët, Songon, Treichville, Yopougon) **ne sont jamais proposées comme villes** : dans la région Abidjan, la ville « Abidjan » est mise toute seule et **le choix « Ville ou village » est grisé** (désactivé) ; une commune enregistrée avant devient « Abidjan » ; « Je vends uniquement à Abidjan », jamais « à Cocody » ; Cocody → Yopougon est une livraison dans la même ville (`MDGVilles.ref`, `_ville_ref`). L'écriture n'est **jamais longue** : dans les endroits serrés (cartes d'annonce, listes, résultats, bulles de la carte), une pastille compacte « [épingle] Guiglo uniquement » (une ligne, largeur fixe, le nom de la ville coupé par « … » et « uniquement » toujours entier, jamais de retour à la ligne ni de débordement) ; la phrase complète « Vente uniquement à Guiglo » / « Achat uniquement à Abidjan » seulement là où il y a la place (carte d'annonce de la carte du réseau, avertissement avant de négocier ou d'écrire, commande) et toujours pour les lecteurs d'écran. Le serveur refuse une commande hors de cette ville (`commande_creer2`). Module commun : `app/ville-seule.js`.
- **Notifications commerciales automatiques** (règle du propriétaire, 24/10/2026) : comme Orange Max it, elles partent toutes seules, envoyées par le serveur, actives par défaut, sans nouveau réglage à activer ; seule l'autorisation du téléphone est nécessaire. **Réglages ne montre plus d'interrupteur de notifications** (seulement Activer/Désactiver et l'essai) ; les tutoriels et la démo sont dans L'aide (« Revoir un tutoriel », replié) ; « Montrer mon nom de famille » est dans Mon compte → Profil et avatar. Toujours fondées sur un événement ou une donnée réelle. Rythme (schéma 91) : de 7 h à 21 h, 8 au plus par personne et par jour, 90 min d'écart (180 si les 5 derniers n'ont pas été ouverts : on espace, on n'arrête pas) ; jamais de message vide de sens pour faire du volume.
- **Pas de doublons sans raison** (règle du propriétaire, 24/10/2026) : une entrée n'apparaît qu'à un endroit logique. Tout ce qui concerne le compte est dans Mon compte (toucher sa photo) : Messages et Négociations en haut, puis **Identité en premier** dans « Votre compte », Profil et avatar, Mon profil public, Mes publications, Alertes produits… Le menu (panier) ne les répète pas ; « Se connecter » est seulement en bas du menu. Notifications : Réglages et cloche. « Écrire au Marché de Gros » : dans Messages, seulement s'il n'y a pas déjà la conversation avec le Marché de Gros.
- **Non identifié** (règle du propriétaire, 24/10/2026) : tout profil dont l'identité n'est pas vérifiée porte la mention « Non identifié » à côté du nom (fiche profil, `v3/reputation.js` ; haut de Mon compte) ; un profil vérifié porte le badge « Identité vérifiée ». Rien n'est affiché tant que le serveur n'a pas répondu (`MDGIdentite.connu`). Le compte officiel n'a ni l'un ni l'autre.
- Les nombres à côté d'un libellé sont **toujours dans une jolie pastille** (`.nbul`), partout : jamais un chiffre nu (« Offres 6 ») ni entre parenthèses.
- **Pas de long texte d'explication sur les écrans** (règle du propriétaire, 24/10/2026) : la fiche profil, et tout écran qu'on ouvre en touchant quelqu'un ou quelque chose, montre l'essentiel en quelques mots ou en chiffres rangés ; les explications sont dans les guides et le profil de chacun, jamais en paragraphe « comme un cahier ». Dire « Déjà publié à », pas « Où il a publié ».

## Design et UI/UX : les compétences à utiliser

- **Toute tâche de design, d'interface ou d'expérience** (écran, composant, mise en page, couleur, texte d'interface, animation) commence par :
  1. `marche-de-gros-design` : lire `DESIGN.md` (la référence du design du projet) ;
  2. `impeccable` : vocabulaire de design, commandes `audit`, `critique`, `layout`, `polish`, `distill`… et son détecteur anti-« design généré » (`.claude/skills/impeccable/scripts/impeccable detect --json <fichiers>`) ;
  3. `ui-ux-pro-max` : règles UX, accessibilité, typographie, couleurs (recherche : `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<sujet>" --domain ux`) ;
  4. `antislop` (le cœur) puis la partie utile : `antislop-ui` (écran), `antislop-copywriting` (textes du site, des guides, des PDF, des publications), `antislop-human` (contraste, clavier, focus), `antislop-layoutmobile` (adaptation des tailles d'écran), `antislop-code` (commentaires de code). Le bilan « Delivery Gate » se fait avant de livrer ;
  5. `playwright-cli` : vérifier dans un navigateur (sinon Playwright de `/opt/node-tools`), iPhone émulé, clair et sombre.
- **antislop (installé le 24/10/2026)** : ne jamais demander « pendant ou après » en début de discussion. Mode **« pendant »** pour tout travail, mode **« après »** seulement quand on demande un audit (liste dans `docs/anti-slop/`, rien n'est corrigé sans accord). La direction reste `DESIGN.md`. Contraste mesuré avec `python3 .claude/skills/antislop-human/contrast-check.py "#texte" "#fond"`, **sur le vrai fond**. Détails et choix du projet assumés : `.claude/skills/ANTISLOP-NOTICE.md`.
- « Reverse-engineer any design system » = l'outil `skillui` (`npx skillui@1.3.4`), mode d'emploi dans `.claude/skills/marche-de-gros-design/SKILL.md`.
- Les compétences sont dans `.claude/skills/` (licences Apache 2.0 et MIT, fichiers `LICENSE` gardés). Les mettre à jour depuis leurs dépôts : `pbakaus/impeccable`, `nextlevelbuilder/ui-ux-pro-max-skill`, `microsoft/playwright-cli`, `amaancoderx/npxskillui`, `miqdadbadjuber/anti-slop`.
- **Avant de toucher au design, relire les 32 lois anti-« design généré par IA » et anti-amateur** (`DESIGN.md`, section 8), puis vérifier l'écran rendu contre chacune.
- Mode « Opérer » : la précision et la retenue d'abord. Quand une règle de `DESIGN.md` change, mettre `DESIGN.md` à jour dans la même PR.

## Claude Design

- **Décision du propriétaire (23/10/2026) : pas de dossier ni d'outil pour Claude Design dans le dépôt.** Le dossier `claude-design/` a été retiré (PR « Retrait du dossier Claude Design »). Ne pas le recréer, et ne jamais publier de copie de l'application qui lève la protection « ordinateur → maintenance ».

## Compétences business (founder-skills)

- Installées le 23/10/2026 à la demande du propriétaire : 15 compétences de `ognjengt/founder-skills` (licence MIT) dans `.claude/skills/` : stratégie (`strategic-planning`, `go-to-market-plan`, `pricing-strategist`, `competitor-intel`), marketing (`marketing-ideas`, `brand-copywriter`, `viral-hook-creator`, `lead-magnet-generator`, `linkedin-writer`, `x-writer`, `outreach-specialist`, `cro-optimization`, `product-hunt-launch-plan`), organisation (`sop-creator`, `prd-generator`). Origine et mise à jour : `.claude/skills/FOUNDER-SKILLS-NOTICE.md`.
- Elles lisent `FOUNDER_CONTEXT.md` (fiche du projet) : **le tenir à jour** quand le produit, les prix ou les commissions changent.
- En s'en servant : répondre en français, ne proposer que des actions gratuites, aucun chiffre sans source vérifiée, jamais dire qu'un paiement ou une commission a été encaissé. Leurs résultats utiles nourrissent les modèles de `strategie/sources/`.

## Commits et PR

- Fin des messages de commit :
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <lien de la session en cours>
  ```
- Fin des descriptions de PR : `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, une ligne vide, puis le lien de la session.
- Aucun nom ou identifiant de modèle ailleurs dans les commits ou les PR.

## Décisions en attente ou pour plus tard

- **Vérification anti-robot (Cloudflare Turnstile)** : le propriétaire la veut **sur le site web seulement**, pas dans l'application. Attention : dans Supabase, la protection CAPTCHA vaut pour tout le projet, donc l'application serait bloquée. Le conseil donné est de l'activer partout en mode invisible. Rien n'est fait : lui reposer la question au moment de le faire. Il faudra un compte Cloudflare gratuit.
- **Serveur bloqué dans l'environnement Claude** : le propriétaire doit autoriser `catmsypctymgkjkfzdkt.supabase.co` (mode d'emploi : `docs/A-FAIRE-PROPRIETAIRE.md`). Remis à plus tard le 24/10/2026.
- **Vérification du numéro par SMS/WhatsApp** : quand il y aura un budget.
- Limite de connexion Supabase Auth : 20 par 5 minutes et par IP (réglée par le propriétaire).
- En attente : réglage « Voix » (fichiers audio fr_P1.zip) ; rappel du mot secret en notification (fonction `pousser`).
- **Remotion** (outil pour fabriquer des vidéos) : laissé de côté le 23/10/2026. Pas dans l'application ni sur le site (inutile et trop lourd). Possible plus tard pour des vidéos de présentation ; gratuit jusqu'à 3 personnes, licence payante à partir de 4.
- Les autres décisions sont dans `docs/PASSATION.md`, section 5.

<!-- antislop:start -->
## antislop
Installé dans `.claude/skills/antislop*` (version 3.2.22). Pour l'écran, les textes, l'accessibilité, l'adaptation mobile ou les commentaires de code : lire `.claude/skills/antislop/SKILL.md`, puis la partie utile (`antislop-ui`, `antislop-copywriting`, `antislop-human`, `antislop-layoutmobile`, `antislop-code`).
Mode réglé par le projet, sans poser la question : « pendant » (during) par défaut ; « après » (after) quand le propriétaire demande un audit. La direction de design est `DESIGN.md`.
<!-- antislop:end -->
