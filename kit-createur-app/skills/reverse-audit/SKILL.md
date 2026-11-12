---
name: reverse-audit
description: Auditer ou s'inspirer d'un site, d'une application ou d'un composant tiers (design, structure, comportement, flux de données) avec la méthode et les outils recensés par Awesome Reverse Engineering Anything (github.com/reacher-z/Awesome-REA). À utiliser dès que l'utilisateur donne une URL ou une capture de référence (« fais comme ce site », « analyse cette app », « reprends cette carte ») et pour tout audit d'un autre site ou application.
---

# Audit par rétro-ingénierie (Awesome-REA)

Source de référence : le catalogue **Awesome-REA** (https://github.com/reacher-z/Awesome-REA,
site https://awesomerea.org). Section utile ici : **Website** (inspection, reconstruction) et
**App**. Avant un audit inhabituel, chercher l'outil adapté dans le catalogue :
`git clone --depth 1 https://github.com/reacher-z/awesome-rea` puis
`python3 scripts/catalog.py <mot-clé>` (ou lire la section « Website » du README).

## Règles

- **S'inspirer du principe, pas copier** : ni logo, ni nom, ni textes, ni images, ni données de la
  référence. On transpose la structure, le rythme, les comportements, dans le système de design
  Glorious Destiny (DESIGN.md : noir, ivoire, or, Urbanist).
- **Aucune donnée inventée** : un chiffre affiché vient de Supabase ou porte la mention
  « données d'exemple ».
- Toujours vérifier le résultat **en clair et en sombre, à 390 px et 1440 px**.

## Méthode (dans cet ordre)

1. **Observer** — capture navigateur réelle (Playwright, préinstallé) : pleine page clair et
   sombre, mobile 390 px, gros plans des composants (`deviceScaleFactor: 2`).
   Script prêt : `node .claude/skills/reverse-audit/capturer.cjs <url> <dossier>`.
2. **Mesurer le système de design** — variables CSS (`:root`, `[data-theme]`), polices chargées
   (`document.fonts`), styles calculés des titres, cartes, boutons (rayons, ombres, tailles).
   Le script ci-dessus les écrit dans `<dossier>/jetons.json`. Pour une extraction complète des
   rôles de couleurs, typographie, espacements et composants : **Dembrandt**
   (`npx dembrandt <url>`), recensé dans le catalogue.
3. **Lire la structure** — classes et hiérarchie du DOM (BEM, composants), routes (`href`),
   états (survol, actif, vide). Accessibilité : **Playwright MCP** / instantanés d'accessibilité.
4. **Comprendre le comportement et les données** (si nécessaire) — trafic réseau (HAR,
   `page.on('response')`), source maps (`sourcemapper`, `shuji`), bundles (`webcrack`,
   `wakaru`) : uniquement pour comprendre un mécanisme public, jamais pour récupérer du code
   propriétaire ou contourner une protection.
5. **Écrire la fiche d'audit** — ce qui fait la qualité de la référence (3 à 6 principes), la
   correspondance avec nos jetons (ex. accent orange → lingot d'or), ce qu'on ne reprend pas.
6. **Construire** dans le code du projet, branché sur les vraies données, puis **comparer**
   capture contre capture et corriger.

## Fiches déjà faites

- Kavora (catalogue « le comptoir ») : Urbanist, cartes 28 px, couleurs à rôle.
- Marlo (tableau de bord) : menu latéral groupé, barres pilules, colonnes « pouls », lingot.
- Caelo (« The sky now ») : carte du monde en points, arcs, sélecteur de zone, légende.
