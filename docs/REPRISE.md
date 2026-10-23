# Rapport de reprise : où en est le projet, et la suite

> **À lire au début de la prochaine session, après `CLAUDE.md`.** Écrit le 23/10/2026, avant que le propriétaire ne vide la discussion.
> Le détail de chaque changement est dans `docs/PASSATION.md` (sections datées du 23/10/2026). Le plan SEO complet est dans `docs/seo/PLAN.md`.

## 1. L'état au moment de la reprise

- **Toutes les PR sont fusionnées** (jusqu'à la PR #230). Aucune PR ouverte, aucun travail en cours sur une branche.
- `main` : cache du service worker `mgci-v227`.
- Supabase production `catmsypctymgkjkfzdkt` : schémas jusqu'au **81** appliqués (80 `fil_public`, 81 `site_mesures` / `mesurer` / `mesures_resume`). Mêmes schémas sur le projet de test.

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
  - 12 pages produits `site/produits/<id>/` (direct + calendrier des récoltes **seulement sourcé**, `v2/saisons.js`) ;
  - 5 guides `site/guides/<id>/` (contenu dans `tools/site/guides/*.html`, chiffres sourcés depuis `strategie/sources/donnees-marche.json`) ;
  - `site/a-propos/` (« ni le marché de gros de Bouaké, ni l'OCPV, ni l'État ») ;
  - typographie française automatique (espace insécable avant « : ; ! ? »).
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

1. **Retours du propriétaire sur le site caché** (il doit le regarder par « SEO ») : appliquer ses corrections.
2. **Contenu** (toujours caché) : d'autres pages produits utiles (photo obligatoire, `LISTE` dans `tools/site-produits.js`) et guides (P2 de `docs/seo/concurrents.md` : fiches des grands marchés comme Gouro d'Adjamé ou Bouaké, **avec sources** ; saisons ; transport). Jamais de pages en série sans valeur propre.
3. **Ouverture du site au public — décision du propriétaire seulement.** Le jour venu :
   - refaire l'**audit de sécurité** (règle de `CLAUDE.md` : avant l'ouverture au public) ;
   - retirer le `noindex` et le voile (`_debut.html`, `site/garde.js`, le script `nuage.js` de `_fin.html`) ;
   - faire mener `index.html` (ordinateur) vers `site/` au lieu de `maintenance.html`, garder le téléphone vers l'application ;
   - placer le point caché de l'administrateur sur le nouveau site ;
   - créer `site/sitemap.xml` et une page 404 ;
   - inscrire le site sur **Google Search Console** et **Bing Webmaster Tools** avec le compte du propriétaire (propriété « préfixe d'URL » `https://stan77i.github.io/marchedegrosci/`), soumettre le plan du site.
4. **Liste de retrait de l'ancien site** (`PORTAGE-SITE.md`, partie 5) : le propriétaire a dit « je te reviens » ; rien n'est supprimé sans son accord.
5. Plus tard : nom de domaine (seule dépense possible, facultative), liens Play Store / App Store quand l'application y sera, partenariats (OCPV / e-Grenier, Chambre d'agriculture, coopératives, médias tech).

## 4. Pièges connus

- **Le propriétaire fusionne vite** : vérifier qu'une PR est ouverte avant d'y ajouter un commit ; sinon nouvelle branche et nouvelle PR. Toujours `git fetch` + rebase sur `origin/main` avant de pousser (conflits fréquents dans `docs/PASSATION.md` : garder les deux textes).
- La tâche « Site public » refait les pages après chaque fusion : relancer `node tools/site-public.js` avant de committer pour éviter les écarts.
- La page `site/carte/` a `<base href="../../">` : `S = site/`, `R = ''`. `app/carte-gl.js` résout ses adresses avec `document.baseURI`.
- Le bac à sable ne joint pas Supabase ni le site en ligne : tester avec Playwright en simulant les réponses (`page.route`), avec de **vraies** données lues via le MCP Supabase.
- Le MCP Supabase refuse tout texte contenant DELETE / DROP / TRUNCATE, même en commentaire.
