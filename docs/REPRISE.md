# Rapport de reprise : où en est le projet, et la suite

> **À lire au début de chaque nouvelle discussion, après `CLAUDE.md`** (le propriétaire écrit seulement « On reprend » : voir la marche à suivre en tête de `CLAUDE.md`). Mis à jour le 24/10/2026 (après la PR #296). À tenir à jour dans chaque PR.
> Le détail de chaque changement est dans `docs/PASSATION.md` (sections datées du 23/10/2026). Le plan SEO complet est dans `docs/seo/PLAN.md`.

## 1. L'état au moment de la reprise

- **25/10/2026 : corrections du contrôle qualité LOG-10, LOG-12, DOC-02** (branche `claude/corrections-controle-serveur`, pas encore de PR) : schémas **98a** (pas de suppression du compte avec des commandes en cours, un litige, un accord sans commande ou une suspension) et **98b** (un membre suspendu ne propose ni ne conclut plus) **appliqués sur le projet de TEST seulement** ; production : 98a puis 98b, sans commentaires d'en-tête. Écran Supprimer mon compte (`v3/compte.js`, `mgci-v294`). Pitch et modèles : commission « prévue », PDF refaits.
- **REPRISE PRIORITAIRE (24/10/2026, nuit) : corrections de l'audit.** PR #289 à #296 **fusionnées** (#296, confiance, comprise). Schémas **92a-92d, 93a-93e, 94a-94h, 95, 95b, 96a-96f appliqués sur le projet de TEST seulement** : la production attend le « OK production » du propriétaire (puis redéployer `pousser` v24, qui n'est déployée nulle part). Le détail par équipe est dans `docs/PASSATION.md` (sections « Équipe A » à « Équipe F » du 24/10/2026) ; les règles durables sont dans `CLAUDE.md`. Il reste, dans l'ordre :
  1. **Étape 7 en cours : tests de bout en bout** de tous les parcours ensemble sur le projet de test (branche `claude/e2e-corrections`), puis corriger ce qui casse (déjà connu : la garde `_annonce_regles` (93) garde l'ancienne quantité avant le message STOCK_EPUISE de `_stock_garde` (92) ; tests `fiabilite-84` bloc H T1 et `niveaux-85` à mettre à jour) ;
  2. **Production, seulement après « OK production »** du propriétaire : schémas dans l'ordre 92a-92d, 93a-93e, 94a-94h, 95, 95b, 96a-96f (sans les commentaires d'en-tête), tester sur le test avant chaque lot, puis déployer `pousser` v24 ; jamais de test destructif ni de changement de données de production sans accord ;
  3. **Rapport complet** au propriétaire dans `docs/` ;
  4. décisions en attente du propriétaire (liste cochable dans `docs/A-FAIRE-PROPRIETAIRE.md`) : 7 jours de grâce pour les annonces déjà en ligne ; rôle acheteur/vendeur (simple affichage ?) ; litige automatique 24 h après le « livré » du vendeur ; valeurs des badges et du masquage ; itinéraires encore par le serveur public OSRM ; lecture des messages par l'équipe ; les 32 questions de `docs/juridique/regles-manquantes.md` ; juriste et formalité ARTCI ; partie « Le jour où vous aurez votre partenaire de paiement ».
  - Restes techniques connus : relance `accord_sans_commande` encore vivante après un accord « sans suite » ; textes serveur `commande_litige` et `commande_refuser2` à corriger (1 h au lieu de 24 h, « pas de refus ») ; étape « Commande terminée » cochée pendant l'heure de vérification (`LIB.terminee`) ; `(select auth.uid())` sur `offres`, `demandes`, `negociations`, `profils` ; index `sim_tmp_*` du test ; itinéraires de la carte ; pagination carte et recherche ; affichage de `stockage_volume()` dans le tableau de bord ; durée de conservation des photos.

- **PR fusionnées jusqu’à la #286, puis #282 (notifications).** Aucune autre PR ouverte. La branche `claude/apercu-claude-design` est vidée et marquée obsolète (à supprimer par le propriétaire dans GitHub → Branches, facultatif).
- `main` : cache du service worker `mgci-v277` après les notifications (#282). Les PR suivantes prennent un numéro au-dessus de celui de `main` au moment de leur fusion.
- Supabase production `catmsypctymgkjkfzdkt` : schémas jusqu’au **90** appliqués (88a, 88b, 88d notifications, 89 vérification 1 h, 90 et 90b colis au départ, le 24/10/2026 ; plus anciens : 85a à 85d badges, appliqués le 24/10/2026, tâche `mdg-niveaux` chaque nuit à 4 h 37 ; 82 commission transport réservée au service Marché de Gros ; 83a à 83e transport ; 84a à 84f fiabilité, appliqués le 24/10/2026, tâche `mdg-fiabilite` toutes les 15 min). Le projet de test peut avoir en plus les schémas des chantiers en cours (86 boutiques, 87 ville seulement).
- **Notifications** (branche `claude/notifications`, 24/10/2026, PR « Notifications ») : schémas 88a, 88b et 88d **appliqués en production** (30 fonctions identiques au test, droits vérifiés, tâche `mdg-notif` toutes les 15 min) ; fonction `pousser` **déployée** (version 22 en production = fichier du dépôt ; testée : réponses 200) ; écran (réglages par catégorie, retirés depuis par le schéma 91 ; essai vérifié, toucher qui ouvre le bon écran, statistiques administrateur) ; cache `mgci-v274`. Détail : `docs/PASSATION.md`, section « Notifications : écran, statistiques ».
- **Notifications commerciales automatiques** (branche `claude/notif-commerciales`, 24/10/2026) : schéma 91 et fonction `pousser` v23 **en production depuis le 24/10/2026 au soir** (après l'accord du propriétaire). Comme Orange Max it : envoi automatique de 7 h à 21 h, 8 commerciales par jour et par personne dont 4 « contenus du marché », 90 min d'écart (180 si les 5 derniers n'ont pas été ouverts) ; 9 déclencheurs réels (N1 à N9, `notif_relances`). Plus aucun réglage par catégorie : le serveur ignore les anciennes préférences (`_notif_pref` répond toujours « oui ») ; Réglages garde seulement Activer/Désactiver et l'essai. Tutoriels et démo déplacés dans L'aide ; « Montrer mon nom de famille » dans Mon compte → Profil et avatar ; Mon compte sans doublons (Identité gardée ; Mon profil public, Mes publications et Alertes produits y passent) ; le menu ne répète plus le compte ; dans Messages, « Écrire au Marché de Gros » disparaît quand la conversation officielle existe. Pas de plafond de plateforme ni de pause de 3 jours. Détail : `docs/PASSATION.md`, section « Notifications commerciales automatiques (schéma 91) ».
- **Litige en 1 h, quantité minimale, garde 93 qui prévient** (branche `claude/litige-1h-quantites`, 25/10/2026, à fusionner après #305) : schémas 97b, 97c et 97d **sur le projet de test seulement** ; captures validées, réponses du propriétaire « ok pour tout ». Reste : production (97b, 97c, 97d, accord déjà donné) et redéploiement de `pousser` ; écran administrateur des délais plus tard. Détail : `docs/PASSATION.md`, section du 25/10/2026.
- **Ville seulement** (branche `claude/ville-seulement`, 24/10/2026) : schéma 87 appliqué sur le test puis **en production** le 24/10/2026 (fonctions identiques au test, à une ligne de commentaire près). PR #272 fusionnée.
- **Boutiques** (chantier 4, 24/10/2026) : schéma 86 (86, 86b, 86c) testé puis appliqué en production (fonctions identiques au test, hors commentaires) ; vidéo des animations validée par le propriétaire ; écran dans la PR « Chantier 4 : boutiques ». Cache `mgci-v267`.
- **Profil, vérification 1 h, colis au départ** (24/10/2026, PR 283, 284, 285 fusionnées) : fiche profil courte (plus de long texte, trois chiffres par rôle, « Déjà publié à », bouton boutique avec icône, délais « Livre en général en… » / « Valide en général en… ») ; clôture automatique **1 h** après la réception sans réclamation (schéma 89) ; avant le chargement, **2 à 4 photos du colis, poids pesé, photo du papier du mot secret avec code au hasard (3 min, équipe seulement)** (schémas 90, 90b). Tous appliqués en production et vérifiés. Nouvelle règle : **captures de validation avant chaque PR**.

## 2. Ce qui a été fait (session du 23/10/2026)

### L'application (`application.dc.html`)
- Bandeau rouge « Pas de connexion · Réessayer » en haut de l'écran, sac qui dort sur la page Prix (choix B).
- Pastilles de nombre partout (`.nbul`) ; onglets d'Acheter : le nombre reste dans l'onglet ; filtres de la carte du réseau avec panier et caddie dessinés ; plus d'ombre noire sur le panneau de la carte.
- Onglet Prix avec pastille (nombre de produits au tableau) ; « Aucune activité » et « Aucune alerte » avec le sac quand il n'y a rien ; « 2 offres · 1 demande » en pastilles panier / caddie au tableau.
- **Liens d'intention** venus du site : `#/publier?sens=offre|demande&produit=…&qte=…&unite=…`, `#/vendre?produit=…`, `#/demande?produit=…`, `#/groupes`, `#/appro` ; l'adresse d'arrivée est gardée dans `window.MDGAdresse0`. Attention : la méthode `quand()` existe déjà dans l'application (les dates) ; l'attente s'appelle `attendre()`.
- Mesure : ouverture de l'application venue du site ou d'un QR code, puis connexion qui suit (jamais l'admin).

### Le nouveau site public (`site/`), **construit caché**
- Décision du propriétaire : site **pour ordinateur**, vitrine qui amène à installer l'application ; **le public garde la page de maintenance** ; l'administrateur entre par le point caché puis choisit « Application · Ancien site · **SEO** » (`app/admin-pc.js`). Toutes les pages sont en `noindex` avec un voile `est_admin` (`site/garde.js`).
- Pages fabriquées par `tools/site-public.js` (gabarits `tools/site/`, `_debut / _entete / _fin`), photos légères `tools/site-images.py` (`site/img/<id>-480|160.webp`), tâche `.github/workflows/site-public.yml`.
- Contenu en ligne (caché) :
  - accueil : étal de vraies photos, « Je vends / Je cherche », fil « En ce moment », tableau des prix en direct, rayons du marché, carte légère, étapes, confiance, pros, guides, QR code ;
  - `site/carte/` : la carte MapLibre de l'application en plein écran + panneau (filtres, annonces) ;
  - 27 pages produits `site/produits/<id>/` (direct + calendrier des récoltes **seulement sourcé**, `v2/saisons.js`) ;
  - 7 guides `site/guides/<id>/` (contenu dans `tools/site/guides/*.html`, chiffres sourcés depuis `strategie/sources/donnees-marche.json`), dont « Les grands marchés de gros » et « Transporter le vivrier » ;
  - `site/regions/` : une page par district (14 districts + sommaire) (récoltes sourcées du district, annonces et prix du district en direct) ;
  - `site/saisons/` : calendrier des récoltes (seulement les périodes sourcées de `v2/saisons.js`) ;
  - `site/a-propos/` (« ni le marché de gros de Bouaké, ni l'OCPV, ni l'État ») ;
  - typographie française automatique (espace insécable avant « : ; ! ? » et entre un nombre et son unité) ;
  - `site/sitemap.xml` (54 adresses) et `404.html` ; liens internes vérifiés (3 819, aucun cassé) ; titres ≤ 65 caractères et descriptions ≤ 160 pour Google.

### Prix officiels de la semaine (OCPV) — site caché
- Source : la **note de conjoncture hebdomadaire de l'OCPV** (PDF public, `https://ocpv-ci.com/doc/note_de_conjoncture/2026/NOTE_DE_CONJONCTURE_N_<n>_2026.pdf`), prix moyens **au détail** en FCFA le kg, Abidjan et intérieur, plus prix mini-maxi par marché.
- Données : `tools/site/prix-ocpv.json` (copiées à la main de la note ; seules les variations sont calculées par `tools/site-prix.js`, car les pourcentages de la note contiennent des erreurs). Affichage : un bloc « Le prix officiel au détail » sur 11 pages produits et la page `site/prix-de-la-semaine/` (en bref, prix moyens, où c'est le moins cher, approvisionnement, tableau en direct de l'application).
- **Chaque semaine, automatiquement** (accord du propriétaire, 24/10/2026) :
  - le lundi soir et le mardi à 5 h (heure d'Abidjan), la tâche GitHub `.github/workflows/ocpv-note.yml` télécharge la nouvelle note et en garde le texte dans `tools/site/ocpv/note-<année>-<semaine>.txt` (commit dans `main`) ;
  - le mardi à 8 h 36, la tâche programmée de Claude « Prix OCPV de la semaine » (`trig_01WGBe78AStmSdvS4k9SCfYp`, nouvelle session à chaque fois, notification sur le téléphone) lit ce texte, met à jour `prix-ocpv.json`, refait le site, vérifie et ouvre une PR. Le propriétaire la fusionne.
  - À la main si besoin : lire la note, mettre à jour `prix-ocpv.json`, `node tools/site-public.js`, vérifier, PR.
- Toujours écrire « prix de détail », jamais les présenter comme des prix de gros.

### Dernières corrections de l'application
- **Stabilité (24/10/2026)** : écran d'ouverture sans petit logo avant le sac, fenêtre du compte sans instant vide, plus de clignotement au défilement (`app/effets.js`), tableau des prix mis à jour sans tout redessiner (`MDGStable.poser`, `app/stable.js`), messages et commandes non redessinés quand rien ne change.
- Calendrier des récoltes : sources FAO, Nitidae (plantain), RONGEAD (oignon) ajoutées (`v2/saisons.js`, `A.CAL`) ; cadran de « L'année du marché » : un anneau par produit.
- Onglet Activité : la carte « Dernières annonces » n'existe que s'il y a au moins une annonce (PR #240).
- Claude Design : un dossier de copies a été ajouté (PR #242) puis **retiré** à la demande du propriétaire (PR #243). Ne pas le recréer (`CLAUDE.md`).
- Données en direct : `fil_public()` (prénom + initiale, ville, produit, quantité ; le compte admin s'affiche « Marché de Gros ») et `tableau_produits()`.

### La mesure (schéma 81)
- Table fermée `site_mesures`, sans donnée personnelle ; `mesurer()` (public) ; `mesures_resume()` (admin). Compté : vues (site, maintenance), clics des boutons d'action, ouvertures de l'application avec `utm_*`, connexion qui suit. **Jamais l'administrateur.**
- Écran « Visites » dans `admin.html` (`v3/admin-mesures.js`).
- `index.html` et `maintenance.html` gardent les `utm_*` en redirigeant. Lien de QR code conseillé : `…/marchedegrosci/?utm_source=affiche&utm_medium=qr&utm_campaign=<lieu>`.

### Autres
- 15 compétences business `founder-skills` installées (`.claude/skills/`), fiche `FOUNDER_CONTEXT.md`.
- `PRODUCT.md` (fiche produit pour la compétence impeccable), `.impeccable/config.json` (construction directe).
- Audits SEO, concurrents et plan : `docs/seo/` (audit-site, audit-app, concurrents, PLAN).

## 3. Ce qui reste à faire (dans l'ordre conseillé)

- **D'abord : l'audit du 24/10/2026** (`docs/audits/audit-logique-viabilite-2026-10-24.md`, partie 10) : décisions du propriétaire sur les délais, puis stock rendu, commandes bloquées, noms réservés, service worker, CGU.

**0. À faire par le propriétaire** (liste et mode d'emploi : `docs/A-FAIRE-PROPRIETAIRE.md`) : autoriser le serveur `catmsypctymgkjkfzdkt.supabase.co` dans l'environnement Claude, puis un compte de test. Le rappeler au début d'une discussion ; ensuite, vérifier à l'écran les fenêtres avec compte et le point n° 59 de l'audit antislop (`docs/anti-slop/audit-001-2026-10-24.md`, terminé pour le reste).

**0 bis. Audit antislop du site caché (24/10/2026) : le propriétaire choisit les numéros** dans `docs/anti-slop/audit-002-2026-10-24-site.md` (32 constats + décision D : l'eau en bleu sur la carte). Ne rien corriger sans son choix. Faits : n° 1 à 32. Décision D tranchée : l'eau reste bleue. L'audit du site est terminé.

**0 ter. Les 4 chantiers (24/10/2026) : décisions validées** (`docs/audits/decisions-chantiers-2026-10-24.md`). C1 et C2 faits (schéma 82). **Chantier 1 (transport) construit** sur la branche `claude/chantier-transport` : schéma 83 (83a à 83e) testé sur le projet de test puis **appliqué en production** le 24/10/2026 (PR #267, fusionnée). Le transporteur du réseau reste fermé (réglage `transport_reseau_ouvert` à `false`, `RESEAU_OUVERT = false`). Pour garder aussi l'alerte d'un numéro dans un litige, le propriétaire peut coller dans l'éditeur SQL : `alter table public.alertes drop constraint alertes_source_check; alter table public.alertes add constraint alertes_source_check check (source in ('dm', 'negociation', 'litige'));` **Chantier 2 (fiabilité)** : schéma 84 (84a à 84f) testé puis appliqué en production le 24/10/2026 ; écran fusionné (PR #269). **Chantier 3 (niveaux de confiance, badges)** : schéma 85 (85a à 85d) testé puis appliqué en production le 24/10/2026 (code des 24 fonctions identique au test, premier calcul fait : aucun niveau pour l'instant, faute de commandes terminées) ; écran dans la PR « Chantier 3 : badges ». Le 85d donne à la fonction `pousser` le droit de lire les tables des chantiers 2 et 3 (oublié jusque-là, aussi pour `code_demandes` et `litige_messages`). Fonction `pousser` redéployée (version 20, cas 16 et 17). Reste : boutiques (schéma 86) et « ville seulement » (schéma 87), chacun dans sa PR.

**0 quinquies. Notifications** (branche `claude/notifications`) : 1) le propriétaire valide les 2 choix qui restent (effacer journal et file après 90 jours ; copier les secrets push dans le test) ; le plafond est tranché : 8 commerciales par jour, dont 4 contenus du marché, 90 min d'écart (schéma 91, voir 0 sexies) ; 2) fait le 24/10/2026 : 88a, 88b, 88d en production, puis `pousser` déployée ; 3) fait le 24/10/2026 : 88c collé par le propriétaire en production, vérifié ; 4) vérifier sur un vrai téléphone : essai, toucher d'une notification d'offre, de commande et de négociation, compteur « ouvertes » du tableau de bord ; 5) reste à faire : la liste « Notifications » de Mon espace lue dans `notif_journal`.

**0 sexies. Notifications commerciales automatiques** (branche `claude/notif-commerciales`, schéma 91) : 1) fait le 24/10/2026 : schéma 91 et `pousser` v23 en production (PR Stan77i/marchedegrosci#287) ; 2) reste : essai sur un vrai téléphone (Android, et iPhone avec l'application sur l'écran d'accueil) : réception, toucher qui ouvre le bon écran. Non construits, par choix du propriétaire : plafond pour toute la plateforme, pause de 3 jours.

**0 quater. Ville seulement** : schéma 87 en production ; reste à fusionner la PR, puis à vérifier avec un compte la négociation, les messages et la commande (le navigateur de l'environnement de travail ne joint pas Supabase).

**0 quater. Ville seulement** : schéma 87 et 87b en production, PR fusionnées ; puis à vérifier avec un compte la négociation, les messages et la commande (le navigateur de l'environnement de travail ne joint pas Supabase).

**0. Audit antislop de l'application (24/10/2026) : le propriétaire choisit les numéros à corriger** dans `docs/anti-slop/audit-001-2026-10-24.md` (59 constats + 3 décisions A, B, C). Ne rien corriger sans son choix ; ensuite une PR par lot, et noter dans le fichier ce qui est fait. **Audit terminé** : tout est fait sauf 3 points laissés exprès (50, 54) ou à vérifier avec des données (59). Décisions A, B, C tranchées le 24/10/2026 et appliquées (accueil calmé, « vérifié » en vert, dégradé de « de Gros » gardé). Seul reste le n° 59, à vérifier quand le serveur sera joignable depuis la session.

**Le site caché est presque complet côté contenu.** Ce qui bloque maintenant, ce sont les étapes 1 et 3, qui dépendent du propriétaire.

1. **Retours du propriétaire sur le site caché** (il doit le regarder par « SEO ») : appliquer ses corrections.
2. **Contenu** (toujours caché) : **mettre à jour les prix OCPV chaque semaine** (voir plus haut) ; d'autres pages produits utiles (photo obligatoire, `LISTE` dans `tools/site-produits.js`) et guides **avec sources** (les guides « grands marchés de gros » et « transporter le vivrier » et le calendrier des récoltes sont déjà faits). Jamais de pages en série sans valeur propre.
3. **Ouverture du site au public — décision du propriétaire seulement.** Le jour venu :
   - refaire l'**audit de sécurité** (règle de `CLAUDE.md` : avant l'ouverture au public) ;
   - retirer le `noindex` et le voile (`_debut.html`, `site/garde.js`, le script `nuage.js` de `_fin.html`) ;
   - faire mener `index.html` (ordinateur) vers `site/` au lieu de `maintenance.html`, garder le téléphone vers l'application ;
   - placer le point caché de l'administrateur sur le nouveau site ;
   - `site/sitemap.xml` et `404.html` existent déjà ;
   - inscrire le site sur **Google Search Console** et **Bing Webmaster Tools** avec le compte du propriétaire (propriété « préfixe d'URL » `https://stan77i.github.io/marchedegrosci/`), soumettre le plan du site.
4. **Liste de retrait de l'ancien site** (`PORTAGE-SITE.md`, partie 5) : le propriétaire a dit « je te reviens » ; rien n'est supprimé sans son accord.
5. Plus tard : nom de domaine (seule dépense possible, facultative), liens Play Store / App Store quand l'application y sera, partenariats (OCPV / e-Grenier, Chambre d'agriculture, coopératives, médias tech).

## 4. Les compétences : s'en servir sans cesse, dès qu'elles sont utiles

**Règle du propriétaire (23/10/2026) : toutes ces compétences doivent être utilisées chaque fois qu'une tâche en a besoin, sans attendre qu'il le demande.** Elles sont enregistrées dans le dépôt (`.claude/skills/`) : chaque nouvelle session qui ouvre le dépôt les a automatiquement. Les appeler avec l'outil Skill (ou `/nom`).

**Design et interface** (toute tâche d'écran, de page, de texte d'interface ou d'animation, voir aussi `CLAUDE.md`) :
- `marche-de-gros-design` : la référence du design du projet (`DESIGN.md`, les 32 lois de la section 8) ;
- `impeccable` : direction de design, `audit`, `critique`, `polish`, `layout`… et son détecteur anti-« design généré » (`.claude/skills/impeccable/scripts/impeccable detect --json <fichiers>`) ; il lit `PRODUCT.md` ;
- `ui-ux-pro-max` : règles UX, accessibilité, couleurs, typographie (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<sujet>" --domain ux`) ;
- `antislop` et ses 5 parties (installées le 24/10/2026, voir `.claude/skills/ANTISLOP-NOTICE.md`) : filtre anti « fait par IA » pour les écrans (`antislop-ui`), les **textes** du site, des guides, des PDF et des publications (`antislop-copywriting`), l'accessibilité avec un **calculateur de contraste** (`antislop-human`), l'adaptation aux tailles d'écran (`antislop-layoutmobile`) et les commentaires de code (`antislop-code`). Mode « pendant » sans poser la question ; « après » pour un audit ;
- `playwright-cli` : vérifier dans un vrai navigateur (iPhone émulé, clair et sombre).

**Business, marketing et SEO** (`founder-skills`, lisent `FOUNDER_CONTEXT.md`) :
- stratégie : `strategic-planning`, `go-to-market-plan`, `pricing-strategist`, `competitor-intel` ;
- marketing et textes : `marketing-ideas`, `brand-copywriter`, `viral-hook-creator`, `lead-magnet-generator`, `cro-optimization` (transformer les visiteurs du site en inscrits) ;
- réseaux et prospection : `linkedin-writer`, `x-writer`, `outreach-specialist`, `product-hunt-launch-plan` ;
- organisation : `sop-creator` (procédures), `prd-generator` (cahier des charges).
- Toujours : en français, actions gratuites seulement, aucun chiffre sans source, jamais dire qu'un paiement a été encaissé.

**Fournies par l'environnement Claude Code** (pas dans le dépôt, disponibles selon la session) : `supabase` et `supabase-postgres-best-practices` (avant tout changement de base), `dataviz` (graphiques, tableaux de chiffres), `artifact-design` (pages publiées), les compétences de sécurité (`security-review`, `code-review`). Si l'une manque, le dire au propriétaire plutôt que de s'en passer en silence.

## 5. Pièges connus

- **Le propriétaire fusionne vite** : vérifier qu'une PR est ouverte avant d'y ajouter un commit ; sinon nouvelle branche et nouvelle PR. Toujours `git fetch` + rebase sur `origin/main` avant de pousser (conflits fréquents dans `docs/PASSATION.md` : garder les deux textes).
- La tâche « Site public » refait les pages après chaque fusion : relancer `node tools/site-public.js` avant de committer pour éviter les écarts.
- La page `site/carte/` a `<base href="../../">` : `S = site/`, `R = ''`. `app/carte-gl.js` résout ses adresses avec `document.baseURI`.
- Le bac à sable ne joint pas Supabase ni le site en ligne : tester avec Playwright en simulant les réponses (`page.route`), avec de **vraies** données lues via le MCP Supabase.
- Le MCP Supabase refuse tout texte contenant DELETE / DROP / TRUNCATE, même en commentaire.
