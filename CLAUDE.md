# Règles du projet Marché de Gros CI (à lire au début de chaque discussion)

Ce fichier est lu automatiquement par Claude Code. Le détail de tout ce qui a été fait est dans `docs/PASSATION.md` : le lire avant de toucher au code.

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
- Créer les PR avec `gh api repos/Stan77i/marchedegrosci/pulls --input fichier.json`, le JSON étant écrit par python dans le scratchpad.
- Partir de `origin/main` à jour pour chaque nouvelle branche (`claude/<sujet>`).
- **À chaque changement du front** :
  - augmenter le `?v=` des fichiers modifiés dans les pages HTML ;
  - augmenter `CACHE` dans `sw.js` (format `mgci-vNNN`) ;
  - ajouter les nouvelles images à la liste `IMAGES` de `sw.js`.
- Ajouter une courte section dans `docs/PASSATION.md` pour chaque changement.
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

## Design

- Une seule police : **Jost**.
- « de Gros » en couleur maïs `#F2C230`.
- Ne jamais écrire « PAYÉ ».
- Photos de produits : `v2/img/produit-<identifiant>.webp`, carré 800 × 800, fond transparent. L'identifiant doit aussi figurer dans `A.SACK` (`app/marche-app.js`) avec la teinte du produit, sinon la photo ne s'affiche pas. La liste des produits sans photo est dans `docs/IMAGES.md`.
- La tomate est montrée **en carton**, pas en sac.
- Avatars : les **personnages du marché** (`v3/personnages.js`) : des produits avec un visage, dessinés en SVG. Au repos, ils respirent et clignent des yeux seulement ; ils **sautent uniquement quand il y a du nouveau** (proposition de prix, message, notification, commande à traiter) ou quand on change son avatar. Pas de service extérieur. Les anciens portraits restent lisibles.
- Couleurs de l'accord conclu : vert de la marque, plus de bleu.
- Les nombres à côté d'un libellé sont **toujours dans une jolie pastille** (`.nbul`), partout : jamais un chiffre nu (« Offres 6 ») ni entre parenthèses.

## Design et UI/UX : les compétences à utiliser

- **Toute tâche de design, d'interface ou d'expérience** (écran, composant, mise en page, couleur, texte d'interface, animation) commence par :
  1. `marche-de-gros-design` : lire `DESIGN.md` (la référence du design du projet) ;
  2. `impeccable` : vocabulaire de design, commandes `audit`, `critique`, `layout`, `polish`, `distill`… et son détecteur anti-« design généré » (`.claude/skills/impeccable/scripts/impeccable detect --json <fichiers>`) ;
  3. `ui-ux-pro-max` : règles UX, accessibilité, typographie, couleurs (recherche : `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<sujet>" --domain ux`) ;
  4. `playwright-cli` : vérifier dans un navigateur (sinon Playwright de `/opt/node-tools`), iPhone émulé, clair et sombre.
- « Reverse-engineer any design system » = l'outil `skillui` (`npx skillui@1.3.4`), mode d'emploi dans `.claude/skills/marche-de-gros-design/SKILL.md`.
- Les compétences sont dans `.claude/skills/` (licences Apache 2.0 et MIT, fichiers `LICENSE` gardés). Les mettre à jour depuis leurs dépôts : `pbakaus/impeccable`, `nextlevelbuilder/ui-ux-pro-max-skill`, `microsoft/playwright-cli`, `amaancoderx/npxskillui`.
- **Avant de toucher au design, relire les 32 lois anti-« design généré par IA » et anti-amateur** (`DESIGN.md`, section 8), puis vérifier l'écran rendu contre chacune.
- Mode « Opérer » : la précision et la retenue d'abord. Quand une règle de `DESIGN.md` change, mettre `DESIGN.md` à jour dans la même PR.

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
- **Vérification du numéro par SMS/WhatsApp** : quand il y aura un budget.
- Limite de connexion Supabase Auth : 20 par 5 minutes et par IP (réglée par le propriétaire).
- En attente : réglage « Voix » (fichiers audio fr_P1.zip) ; rappel du mot secret en notification (fonction `pousser`).
- **Remotion** (outil pour fabriquer des vidéos) : laissé de côté le 23/10/2026. Pas dans l'application ni sur le site (inutile et trop lourd). Possible plus tard pour des vidéos de présentation ; gratuit jusqu'à 3 personnes, licence payante à partir de 4.
- Les autres décisions sont dans `docs/PASSATION.md`, section 5.
