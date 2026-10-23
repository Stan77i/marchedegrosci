# Règles du projet Marché de Gros CI (à lire au début de chaque discussion)

Ce fichier est lu automatiquement par Claude Code. Le détail de tout ce qui a été fait est dans `docs/PASSATION.md` : le lire avant de toucher au code.

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

## Design

- Une seule police : **Jost**.
- « de Gros » en couleur maïs `#F2C230`.
- Ne jamais écrire « PAYÉ ».
- Photos de produits : `v2/img/produit-<identifiant>.webp`, carré 800 × 800, fond transparent. L'identifiant doit aussi figurer dans `A.SACK` (`app/marche-app.js`) avec la teinte du produit, sinon la photo ne s'affiche pas. La liste des produits sans photo est dans `docs/IMAGES.md`.
- La tomate est montrée **en carton**, pas en sac.

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
- Les autres décisions sont dans `docs/PASSATION.md`, section 5.
