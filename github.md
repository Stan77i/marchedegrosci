repo: Stan77i/marchedegrosci
branch: main
path: /

## Last sync
date: 2026-10-10T21:58:00Z
### Updated in this project
- Pages qui se bloquaient en changeant de page : corrigé (ordre d'empilement des pages)
- Débordements et page qui glissait de côté au toucher d'un champ : corrigés
- Nouvelle carte (vraies frontières, zoom, distances) et logo « M » animé
- Rapport : RAPPORT.md, journal détaillé : MISE-A-JOUR.md

## Screen map
| Écran | Fichiers |
|---|---|
| Application mobile (toutes les pages) | application.dc.html, support.js |
| Carte du réseau | app/carte-app.js |
| Données, stockage, calendrier | app/marche-app.js, v2/data.js |
| Site web (ordinateur et tablette) | index-v3.html, css/, v3/, v2/ |
| Aiguillage : téléphone → application, ordinateur / tablette → site | index.html (+ début de application.dc.html et index-v3.html) |
| Hors connexion (PWA) | sw.js, manifest.webmanifest, vendor/, fonts/, css/fonts.css, icons/ |
