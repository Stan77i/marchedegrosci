# Procédure : après une modification

> Pour Claude (ou toute personne qui change le dépôt), **avant de pousser une branche ou de créer une PR**. Durée : 1 à 5 minutes pour le script, plus le SQL s’il y en a.

## 1. Le script

```bash
git fetch origin
bash tools/controle/lancer.sh apres-modif
```
Il compare la branche à `origin/main` (autre base : `--base <réf>`) et :
- relit chaque JS changé (`node --check`), chaque JSON et chaque YAML de `.github/workflows/` ;
- refait tout le contrôle statique et le compare à `tools/controle/reference-rouges.json` ;
- si le front change (`application.dc.html`, `index*.html`, `app/`, `v3/`, `v2/`, `css/`…) : vérifie que `CACHE` de `sw.js` a changé, que chaque JS/CSS changé appelé avec `?v=` a une nouvelle version, et que les nouvelles images sont dans `IMAGES` ;
- si un `supabase/schema-*.sql` change : liste les tests SQL liés (`tools/controle/unites.json`) **à lancer par Claude via MCP** ;
- si `supabase/functions/` change : « en attente » (pas testable ici).

Code de sortie 1 = échec bloquant : corriger avant la PR. Le rapport est dans `CONTROLE_QUALITE/rapports/` (pour ne rien écrire dans le dépôt : `--sortie /tmp/rapport.md`).

## 2. Le SQL (si un schéma a changé)

Pour chaque ligne `APM-SQL-…` du rapport : jouer les fichiers listés sur le **projet de test**, bloc par bloc, dans des blocs annulés (`procedures/CONTROLE_GENERAL.md`, partie 4). Écrire le résultat obtenu sous le bloc, avec la date. Pas de test lié : en écrire un (`supabase/tests/<sujet>-scenarios.sql`) et l’ajouter à `tools/controle/unites.json`, `REGISTRE_DES_TESTS.md` et `MATRICE_TESTS.md` dans la même PR.

## 3. Le navigateur (si un écran a changé)

`bash tools/controle/lancer.sh navigateur`, puis captures iPhone émulé, clair et sombre, envoyées au propriétaire **avant** la PR (règle de `CLAUDE.md`).

## 4. Hook facultatif

Pour être arrêté avant même le commit : installer `tools/controle/pre-commit` (mode d’emploi en tête du fichier). Il n’est pas installé d’office.

## 5. Ensuite

La PR déclenche `.github/workflows/controle-pr.yml` (mêmes contrôles, sans SQL). Un rouge corrigé : retirer sa clé de `tools/controle/reference-rouges.json` dans la même PR. Une anomalie corrigée : statut « corrigée non vérifiée » dans `REGISTRE_ANOMALIES.md`, puis « vérifiée » quand son test a été rejoué.
