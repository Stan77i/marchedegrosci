# Signature animée : « marché de Gros » / « marché du pays »

Choisie par le propriétaire le 24/10/2026 comme **signature de la marque**. C'est la même animation que le titre de l'écran de connexion de l'application (`v3/nuage.js`) : « marché » monte, « de Gros » apparaît avec un reflet doré ; 3 s après, « de Gros » monte et s'efface, « du pays » arrive par le bas avec le reflet, reste 2 s, puis revient. La séquence dure 10 s.

## Les fichiers

| Fichier | Format | Pour quoi |
|---|---|---|
| `signature-carre.mp4` | 1080 × 1080, 10 s | Réseaux sociaux (WhatsApp, Facebook, Instagram), fin de vidéo |
| `signature-large.mp4` | 1920 × 1080, 10 s | Présentations, vidéos horizontales, écran |
| `connexion-titre.mp4` | 390 × 844 (iPhone) | L'écran de connexion de l'application, tel que validé |
| `signature.html` | page | Sert à refaire les vidéos (même animation, mêmes couleurs, police Jost) |

Couleurs : fond `#171512`, « marché » crème `#F3EFE4`, « de Gros » / « du pays » maïs `#F2C230` avec reflet `#FFEDB0`. Une seule police : Jost.

## Refaire les vidéos

1. Depuis la racine du dépôt : `python3 -m http.server 8820`.
2. Ouvrir `http://localhost:8820/videos/signature/signature.html?format=carre` (ou `?format=large`) et enregistrer 10,5 s (par exemple avec Playwright `recordVideo`, puis `ffmpeg` en MP4 H.264).

Si l'animation du titre change dans `v3/nuage.js`, changer aussi `signature.html`, puis refaire les vidéos.
