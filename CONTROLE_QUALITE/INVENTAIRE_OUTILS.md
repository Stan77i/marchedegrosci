# Inventaire des outils de contrôle

> Relevé le 25/10/2026 sur la branche `claude/controle-qualite` (mesuré, pas supposé : chaque ligne dit comment elle a été vue).
> En bref : tout ce qui se lit dans le dépôt (code, textes, cache, YAML) est automatique et gratuit. Tout ce qui touche la base, les fonctions externes, l'argent ou un vrai téléphone ne l'est pas : Claude le fait à la main sur le projet de test, ou c'est impossible pour l'instant.

## 1. Ce qui existe dans le dépôt

| Élément | Où | Ce qu'il fait | Comment vu |
|---|---|---|---|
| Contrôle statique (« gardiens ») | `tools/controle/controle.js` | 14 contrôles : syntaxe, cache, mots interdits, communes, doublons, textes longs, slogans, police, bleu, SQL, liens, navigateur | lu et lancé (`bash tools/controle/lancer.sh statique`) |
| Point d'entrée unique | `tools/controle/lancer.sh` → `lancer.js` | modes `tout`, `statique`, `navigateur`, `unite Uxx`, `apres-modif`, `pr` | lancé, voir partie 4 |
| Carte des unités | `tools/controle/unites.json` | unités, contrôles par unité, tests SQL par unité et par schéma, chantiers en cours | lu par `lancer.js` |
| Rouges connus | `tools/controle/reference-rouges.json` | référence : la PR échoue seulement sur un rouge nouveau | lu par `lancer.js` |
| Hook facultatif | `tools/controle/pre-commit` | `node --check`, JSON, CACHE si front changé | lancé à la main (partie 4), **non installé** |
| Tests SQL | `supabase/tests/*.sql` (18 fichiers) | scénarios en blocs annulés (`raise exception 'TEST…'`) | listés ; ils ne tournent qu'avec un accès à la base |
| Listes A à K | `LISTES_DE_CONTROLE.md` | cases à vérifier à la main ou au navigateur | lu |
| Registre des tests | `REGISTRE_DES_TESTS.md` | dernier résultat connu de chaque fichier SQL | lu |
| Autres scripts | `tools/site-public.js`, `tools/site-produits.js`, `tools/site-boutiques.js`, `tools/site-prix.js`, `tools/site-regions.js`, `tools/site-images.py`, `tools/inventaire-site.js`, `tools/glyphes-carte.js`, `strategie/sources/construire.js` | fabrication du site caché, inventaire, PDF | `ls tools` ; ce ne sont pas des contrôles |
| `package.json` | aucun | pas de dépendances npm : les scripts n'utilisent que Node | `ls package.json` : absent |
| Hooks git installés | aucun | dossier hooks : seulement les exemples `*.sample` ; `core.hooksPath` vide | `ls .git/hooks`, `git config core.hooksPath` |

## 2. Tâches GitHub (`.github/workflows/`)

Toutes gratuites (dépôt public, vu par `gh api repos/Stan77i/marchedegrosci --jq .visibility` → `public`). Le YAML des 7 fichiers se lit (`python3` + `yaml.safe_load`, 25/10/2026).

| Fichier | Quand | Rôle contrôle ? | État |
|---|---|---|---|
| `controle-pr.yml` | chaque PR, chaque fusion dans `main` | **oui** : `lancer.sh pr` (syntaxe, statique, CACHE et `?v=`) ; échoue sur un nouveau rouge, une erreur de syntaxe, un front changé sans CACHE ni `?v=` montés | **nouveau, non encore exécuté sur GitHub** |
| `controle-quotidien.yml` | chaque jour 5 h 29 (Abidjan) + à la main | **oui** : `lancer.sh tout` ; une seule issue « Contrôle quotidien », commentaire seulement si les échecs bloquants changent | **nouveau, non encore exécuté sur GitHub** |
| `gardiens.yml` | tous les 3 jours 6 h 17 + à la main | **oui** : `controle.js` complet, issue « Rapport des gardiens » | venu de la PR #302 ; chemin mis à jour (`tools/controle/`) ; **non encore exécuté sur GitHub** |
| `rapport-site.yml` | fusion qui touche le front | inventaire du site (`PORTAGE-SITE.md`, partie 7) | existant, a tourné (« success » le 24/10/2026, `gh api …/actions/runs`) |
| `site-public.yml` | fusion qui touche les gabarits du site | fabrique `site/` | existant |
| `strategie-pdf.yml` | lundi + fusions concernées | refait les PDF | existant |
| `ocpv-note.yml` | lundi et mardi | télécharge la note OCPV | existant |

Secrets : les tâches n'utilisent que `secrets.GITHUB_TOKEN` (recherche `secrets.` dans `.github/workflows/`). **Aucun secret Supabase n'est utilisé par GitHub.** La liste des secrets du dépôt n'est pas lisible depuis la machine de Claude (le proxy répond 403 sur `actions/secrets`).

## 3. Outils de la machine de Claude (session du 25/10/2026)

| Outil | Version / chemin | Sert à | Remarque |
|---|---|---|---|
| Node | v22.22.0 (`/opt/node22/bin/node`) | tous les scripts, `node --check` | aussi sur GitHub (`setup-node` 22) |
| Python | `python3` + PyYAML 6.0.3 | lire le YAML des tâches | sur GitHub : utilisé s'il est là, sinon « bloqué » dans le rapport |
| Playwright | `/opt/node-tools/node_modules/playwright` | navigateur, iPhone émulé | sur GitHub : installé à chaque passage (`npm install playwright@1.56.1`) |
| Chromium | `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` | navigateur | |
| semgrep | 1.182.1 (`/usr/local/bin/semgrep`) | recherche de motifs dangereux | marche hors ligne avec une règle locale (essai : 0 résultat, 0 erreur) ; les règles du registre demandent le réseau ; **pas branché** dans les tâches (à ajouter seulement avec des règles écrites dans le dépôt) |
| gh | 2.89.0 | PR, issues, lecture des passages | lecture des secrets et de certains chemins Actions refusée par le proxy |
| jq | `/usr/bin/jq` | lecture JSON | |
| psql | 16.15 | aucun usage | pas d'accès réseau à la base ni de mot de passe : inutile |
| Deno, CLI Supabase | absents | auraient servi à tester `pousser` et `itineraire` | non installés |
| MCP Supabase | outil de Claude | **seul moyen** de jouer les tests SQL (projet de test) et de lire les conseillers (production, lecture seule) | disponible seulement dans les sessions où l'outil est branché ; la tâche programmée tous les 3 jours a été créée **sans** cet accès (`mcp_connections` vide) |

Le navigateur de la machine ne joint pas Supabase (proxy) : l'application s'ouvre sans données ; les écrans avec compte se testent avec des réponses injectées.

## 4. Commandes lancées pour de vrai (25/10/2026, branche `claude/controle-qualite`)

| Commande | Résultat |
|---|---|
| `bash tools/controle/lancer.sh statique` | code 0 ; 6 réussis, 7 échoués (oranges connus et 1 rouge connu), 1 non exécuté (navigateur désactivé) ; aucun échec bloquant |
| `bash tools/controle/lancer.sh navigateur` | code 0 ; application ouverte en iPhone 13 émulé, aucune erreur JavaScript ; batteries navigateur : aucune encore (à ajouter) |
| `bash tools/controle/lancer.sh navigateur` (25/10/2026, après l'intégration des batteries) | code 0 (pas d'échec bloquant) ; STA-14 réussi ; `U10-fiabilite.js` code 1 (52 réussis, 18 échoués, 3 en attente : anomalies réelles, voir `REGISTRE_ANOMALIES.md`) ; `U12-parcours.js` code 0 (6 réussis) ; environ 9 minutes au total |
| `python3 -m http.server 8765` puis `CQ_URL=http://127.0.0.1:8765/ node CONTROLE_QUALITE/tests/navigateur/U12-parcours.js` | code 0, 6 réussis (la batterie marche aussi seule) |
| `bash tools/controle/lancer.sh unite U04` | code 0 ; 5 tests SQL listés « non exécuté » |
| `bash tools/controle/lancer.sh unite U10` avec une batterie d'essai temporaire | code 0 ; la batterie a tourné (code 0) ; batterie d'essai retirée ensuite |
| `bash tools/controle/lancer.sh apres-modif` | code 0 ; JS, JSON et YAML changés relus |
| `node tools/controle/lancer.js pr --base HEAD` avec un JS cassé, un front changé sans CACHE ni `?v=`, deux schémas et `pousser` changés (essai, tout remis en place) | code **1** : erreur de syntaxe, nouveau rouge, CACHE non monté, `?v=` non monté ; tests SQL liés listés (`regles-93`, `e2e-parcours`, `dm-anti-doublon`) ; `pousser` « en attente » |
| même essai avec CACHE et `?v=` montés, sans le JS cassé | code 0 |
| `bash tools/controle/pre-commit` (front dans le commit sans `sw.js`, puis avec) | code 1, puis code 0 |
| `bash tools/controle/lancer.sh unite U99`, `lancer.sh n_importe` | code 2, message clair |

## 5. Ce qui est automatisable, et ce qui ne l'est pas

| Contrôle | Automatique ? | Par qui | Pourquoi |
|---|---|---|---|
| Syntaxe JS, JSON, YAML | oui | GitHub (`controle-pr.yml`), hook, `lancer.sh` | lecture du dépôt |
| Mots interdits, doublons, textes longs, police, bleu, liens | oui (repérage) | GitHub, `lancer.sh` | le jugement (vraie faute ou voulu) reste à Claude |
| CACHE de `sw.js` et `?v=` montés | oui | GitHub (`controle-pr.yml`), hook | comparaison avec la base |
| Ouverture de l'application, erreurs JavaScript | oui | GitHub (`controle-quotidien.yml`, `gardiens.yml`), `lancer.sh navigateur` | sans données réelles (réseau coupé) |
| Batteries navigateur U10 et U12 | oui, dès qu'elles sont dans `CONTROLE_QUALITE/tests/navigateur/` | GitHub quotidien, `lancer.sh` | données injectées |
| Tests SQL (`supabase/tests/`, `CONTROLE_QUALITE/tests/sql/`) | **non** | Claude, via MCP, sur le projet de test | il faut un accès à la base ; aucun secret Supabase dans GitHub (et il ne faut pas en mettre : ce serait une clé privilégiée hors de la base) |
| Conseillers Supabase, journaux, tâches planifiées | **non** | Claude via MCP (production : lecture seule) | même raison |
| Écrans avec compte, jugement des textes, design | **non** | Claude (agents, iPhone émulé) | demande un œil |
| Tâche programmée tous les 3 jours (`trig_01KLjPRL3kuCrSEjgNVCPkxg`) | en partie | Claude, seul | sans accès Supabase : listes G et H « non vérifié » tant que le propriétaire ne la recrée pas depuis claude.ai avec l'outil Supabase |
| Fonctions externes `pousser`, `itineraire` | **non** | personne pour l'instant | ni Deno, ni clés push sur le test, ni réseau ; prérequis : clés push gratuites du projet de test et le téléphone du propriétaire |
| Vrais paiements | **impossible** | — | aucun paiement n'est branché ; rien n'est simulé (règle de la mission) |
| Charge simultanée (plusieurs acheteurs en même temps) | **non** | Claude, plus tard | il faut plusieurs connexions en parallèle à la base de test (script à écrire) |
| SMS / preuve du numéro | **impossible** | — | n'existe pas (attend un budget) |
| Vrai téléphone (2G/3G, notifications) | **non** | le propriétaire | matériel |
