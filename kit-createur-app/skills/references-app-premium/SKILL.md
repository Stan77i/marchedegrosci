---
name: references-app-premium
description: Mission et carnet de références pour créer un site + application mobile (PWA) premium, comme Glorious Destiny. Liste les sites de référence étudiés (tableaux de bord Kavora, Caelo, Marlo ; boutiques beauté Sephora, Glossier, Charlotte Tilbury, Fenty, Nykaa, Ulta), ce qu'on a pris à chacun, les outils (Awesome-REA, Dembrandt, Firecrawl, Playwright, maquettes Claude Design) et la méthode complète, de l'audit à la mise en ligne. À charger au début de toute nouvelle création de site, d'application, de boutique ou de tableau de bord, et dès qu'on cherche « une référence », « un design premium », « une vraie app ».
---

# Mission : site et application premium

Ce carnet résume ce qui a mené au résultat de Glorious Destiny (boutique beauté, salon,
administration, application mobile installable). Le reprendre tel quel sur un nouveau projet :
mêmes références, même méthode, mêmes exigences. Les exemples complets du système de design et
des règles permanentes sont dans `exemple-DESIGN-glorious.md` et `exemple-CLAUDE-glorious.md`.

## 1. Les références étudiées et ce qu'on leur a pris

Toujours étudier une référence par la méthode du skill `reverse-audit`. On en garde la
philosophie (rythme, hiérarchie, gestes), jamais le contenu, le nom ni l'identité.

| Référence | Type | Ce qu'on a pris |
| --- | --- | --- |
| [Kavora](https://demo.codeandchill.store/kavora/) | tableau de bord (enchères) | **La philosophie du système** : fond « pierre chaude », cartes blanches à 28 px, pilules, **encre pour agir**, une seule couleur vive par écran, teintes douces par univers (menthe, rose, lilas, sauge, sable), police **Urbanist**. Jetons extraits avec Dembrandt (couleurs, rayons, ombres). |
| [Caelo](https://demo.codeandchill.store/caelo/#/overview) | tableau de bord (vols) | **La carte du monde en points** : fond de points, pays desservis en or, trajectoires courbes, étiquettes de codes, sélecteur Monde / région, pastille d'état. A donné la carte « Dans le monde » et la carte des ventes de l'administration. |
| [Marlo](https://demo.codeandchill.store/marlo/) | tableau de bord | Composition des tuiles d'indicateurs, graphiques sobres, or appliqué « intelligemment » sur un fond neutre. |
| [Sephora](https://www.sephora.com/) (site et app) | boutique beauté | **Barre d'onglets du bas** (Accueil, Boutique, Offres/Prestations, Panier, Plus), badges produits, cartes compactes « image, nom, prix, + ». |
| [Glossier](https://www.glossier.com/) | boutique beauté | Cartes minimalistes, couleurs douces, compteur discret, ton conversationnel. |
| [Charlotte Tilbury](https://www.charlottetilbury.com/us) | luxe beauté | **Le premier écran éditorial** : grande photo, titre énorme, défilement en rideau, noir et or. A inspiré l'accueil « Écrin ». |
| [Fenty](https://fentybeauty.com/), [Nykaa](https://www.nykaa.com/), [Ulta](https://www.ulta.com/) | boutiques beauté | Navigation mobile, catégories en pilules, mise en avant des offres réelles. |
| [Awesome-REA](https://github.com/reacher-z/Awesome-REA) | catalogue d'outils | La **méthode de rétro-ingénierie** (section Website / App) : skill `reverse-audit`. |
| [Supabase changelog](https://supabase.com/changelog.md) | documentation | Vérifier l'API à jour (clés publiables, RPC, RLS) avant de coder. |
| Maquettes **Claude Design** (handoff zip) | maquettes HTML haute fidélité | Écrans de l'application : 1a « Comptoir », 1b « Écrin » (photo plein cadre), 1c « Rituel » (intentions en cartes empilées), 1d « Équipe ». Recréées dans le code, pas copiées. |

**Recherches de fond qui ont servi :**
- Diaporama accessible (rideau en `clip-path`, lecture automatique, pause, `prefers-reduced-motion`) : skill `carrousel-beaute`.
- Fiche produit qui convertit : bienfaits, « comment l'utiliser », questions qui bloquent l'achat.
- Le savoir-faire du métier, pour des étapes justes et non inventées : pose de frontale, montage, ventilation de perruque, cils en grappes.
- Détourage des photos produits (BiRefNet, rembg, BRIA RMBG) : vérifier la licence avant usage commercial.

## 2. La méthode, du premier jour à la mise en ligne

1. **Comprendre** : produit, clientes, pays, mode de paiement, ce qui est réel. Écrire `PRODUCT.md`.
2. **Auditer 2 ou 3 références** avec `reverse-audit` :
   - captures 390 px et 1440 px ;
   - jetons avec Dembrandt (`npx dembrandt <url> --design-md --tailwind`) ;
   - lecture des variables CSS.
3. **Écrire le contrat de design** `DESIGN.md` (modèle : `exemple-DESIGN-glorious.md`) : couleurs en jetons, typographie, rayons, ombres, gestes, interdits.
4. **Charger les skills de design** avant toute interface : `impeccable`, `ui-ux-pro-max`, `antislop` (+ `antislop-ui`, `antislop-layoutmobile`, `antislop-copywriting`, `antislop-human`).
5. **Construire** par petites étapes. Chaque étape suit la même boucle :
   - code ;
   - vérifications (types, lint, tests, build) ;
   - captures Playwright en **390 px (téléphone)** et **1440 px (ordinateur)** ;
   - commit ;
   - mise en ligne ;
   - **vérification sur le lien public**.
6. **Faire valider par captures** tout changement visuel qui touche l'identité, avant de le fusionner.

## 3. Règles permanentes (à recopier dans le `CLAUDE.md` du nouveau projet)

- **Règle de l'antagoniste** : chaque geste a son inverse au même endroit, sans bouton de plus. « + » devient « × n » qui retire ; « Ajouter » devient « ✓ Ajouté » qui retire ; ouvrir ↔ fermer ; le cœur ajoute et retire.
- **Rien d'inventé** : ni prix, ni stock, ni avis, ni chiffre, ni promotion, ni preuve sociale. Une promotion n'existe que si elle est réelle (en base, avec sa date de fin). Les badges se calculent sur les vraies données.
- Une seule pilule d'encre et un seul lingot d'or par écran ; les teintes d'univers en fond uniquement ; jamais de fond vert ni violet derrière un produit.
- `prefers-reduced-motion` respecté partout ; animations seulement à l'écran (IntersectionObserver).
- Aucune clé secrète dans le front ; écritures par RPC sécurisées ; historique commercial archivé, jamais supprimé.
- Aucune fausse commande ni fausse demande en production : les tests interceptent les écritures.

## 4. Recette « vraie application » (PWA) sans magasin d'applications

- **Détection automatique** : téléphone → l'application ; ordinateur → le site.
  - Requête : `(max-width: 767.98px), (pointer: coarse) and (max-width: 1024px)`.
  - Lecture avec `useSyncExternalStore`.
  - Choix manuel mémorisé ; lien « Version application » en pied de site.
- **Coquille de l'app** :
  - barre d'onglets flottante (rayon 24) et feuille « Plus » qui monte du bas ;
  - barre d'action fixe sur les écrans d'achat ;
  - fondu entre les écrans (sans transformation, sinon les barres fixes bougent).
- **Installable** :
  - `manifest.webmanifest` : `display: standalone`, icônes 192, 512 et masquable, raccourcis ;
  - `apple-touch-icon` et balises `apple-mobile-web-app-*` ;
  - service worker : pages en réseau d'abord avec repli hors ligne, fichiers versionnés en cache d'abord, données jamais en cache ;
  - bouton « Installer » (événement `beforeinstallprompt`) et aide pour iPhone (Partager → Sur l'écran d'accueil).
- **Mises à jour automatiques de l'app installée** :
  - numéro de build injecté par Vite (`define: { __VERSION__ }`) ;
  - enregistrement par `register('sw.js?v=' + __VERSION__, { updateViaCache: 'none' })` ;
  - `reg.update()` au retour dans l'app et toutes les 15 min ;
  - rechargement sur `controllerchange` ;
  - les anciens caches sont supprimés à l'activation.
- **Sensation native** :
  - pas d'élastique ni de zoom : `overscroll-behavior: none`, `overflow-x: clip`, viewport `maximum-scale=1` en mode app seulement ;
  - fond sous la barre d'état ;
  - champs à 16 px (pas de zoom iOS) ;
  - cibles de toucher d'au moins 44 px.
- **Piège Safari** : `filter: drop-shadow` est coupé en rectangle sur iPhone. Faire les ombres de produits avec une ellipse floue posée dessous.

## 5. Signatures visuelles qui ont plu

- Accueil « Écrin » : photo plein cadre qui change toutes les 2 s (fondu et zoom lent), titre énorme, veine d'or animée.
- Accueil « Rituel » : « Que faisons-nous aujourd'hui ? », intentions en cartes teintées empilées. Les dessins au fil d'or s'animent sur un rythme de 2 s décalé : l'œil cligne, le miroir brille, le flacon pompe, les mèches ondulent.
- Logo en lingot d'or (dégradé or clair → or → or profond, lettres noires qui remplissent le cercle).
- Dessins au trait d'or qui se tracent (`pathLength=1`, `stroke-dashoffset` 1 → 0).
- Sons discrets synthétisés (Web Audio) et vibrations, réglables par la visiteuse.
- Bulles de conversation qui vendent avec des informations vraies uniquement.

## 6. Les autres skills de ce kit

| Skill | Quand |
| --- | --- |
| `reverse-audit` (+ `capturer.cjs`) | Étudier un site, une app ou une capture de référence. |
| `carrousel-beaute` | Diaporama premium, accessible, sans bibliothèque. |
| `impeccable` | Concevoir, critiquer, peaufiner toute interface. |
| `ui-ux-pro-max` | Palettes, typographies, règles d'ergonomie (base de données incluse). |
| `antislop` et ses déclinaisons | Éviter le rendu « générique IA » (interface, mobile, textes, accessibilité, commentaires de code). |
| `playwright-cli` | Piloter le navigateur, capturer, tester. |

Skills d'Anthropic également utilisés (à activer dans Claude, ils ne sont pas copiés ici) :
`threejs-animation`, `shader-glsl`, `gsap-core`, `supabase`, `supabase-postgres-best-practices`,
`frontend-design`, `logo-generator`.
