---
name: marche-de-gros-design
description: Le système de design du Marché de Gros CI (couleurs, Jost, voix du logo, composants, mouvement, interdits). À charger avant toute modification visible de l'application mobile ou du site, avec impeccable, ui-ux-pro-max et playwright-cli.
---

# Design du Marché de Gros CI

1. Lire `DESIGN.md` à la racine du dépôt : c'est la référence (jetons, composants, interdits). Le code fait foi s'il y a un écart ; corriger alors `DESIGN.md`.
2. Réutiliser un composant existant avant d'en créer un (bouton, pastille, ligne d'activité, reçu, fenêtre).
3. Vérifier dans le navigateur (skill `playwright-cli`, ou Playwright de `/opt/node-tools`), iPhone émulé, en clair et en sombre.
4. Passer le détecteur d'`impeccable` sur les fichiers modifiés.

## Extraire à nouveau le système depuis le code (skillui)

`npx skillui@1.3.4 --dir <copie de app/ v3/ css/ application.dc.html> --name "Marche de Gros" --out <dossier temporaire>`

skillui (« Reverse-engineer any design system », MIT) lit le CSS sans IA. Son résultat brut mélange d'anciens fichiers (accents orange inutilisés) et ne voit pas le mode nuit : s'en servir pour repérer des écarts, puis mettre à jour `DESIGN.md` à la main. Ne pas copier sa sortie telle quelle.
