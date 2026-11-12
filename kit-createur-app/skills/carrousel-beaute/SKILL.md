---
name: carrousel-beaute
description: Construire ou modifier un carrousel d'images haut de gamme (premier écran, gammes, univers) pour Glorious Destiny — transition « rideau » derrière un filet d'or, zoom doux, barres de progression, pause, flèches, glissement, clavier, sans bibliothèque. À utiliser dès qu'une image fixe doit devenir défilante ou qu'une présentation de plusieurs gammes doit s'animer.
---

# Carrousel beauté (Glorious Destiny)

Implémentation de référence : retirée de l'accueil à la demande de la cliente (12/11/2026, remplacée
par la soie d'or WebGL `src/components/marque/SoieOr.tsx`). Le composant `CarrouselGammes.tsx` et
ses styles `.diapo-*` / `.carrousel-*` restent consultables dans l'historique git
(`git show 9f97822:src/features/accueil/CarrouselGammes.tsx`). Réutiliser ce composant
ou en copier le principe ; ne pas ajouter de bibliothèque (Swiper, Embla…) pour cet usage.

## Principes (tirés de l'étude des premiers écrans de marques beauté premium)

1. **Une diapositive = un univers ou une gamme**, avec une photo réelle de la marque et une légende
   courte (univers en petites capitales or + nom du produit) qui mène à la page concernée.
   Jamais d'image sans rapport, jamais d'emballage retouché.
2. **Transition « rideau »** (1,15 s, `cubic-bezier(0.16, 1, 0.3, 1)`) : la nouvelle photo se
   dévoile par `clip-path: inset()` de droite à gauche ; un filet d'or lumineux suit le bord
   (`transform: translateX`, jamais `left`). L'ancienne photo reste dessous, assombrie.
3. **Zoom doux** pendant l'affichage : `scale(1.09) → 1` sur 7,5 s. Transformations et découpes
   seulement : rien qui recalcule la mise en page.
4. **Progression** : une barre par diapositive (`scaleX`, origine à gauche), cliquable. La fin de
   l'animation de la barre fait avancer le carrousel : mettre la barre en pause met tout en pause.
5. **Contrôle laissé à la visiteuse** (WCAG 2.2.2) : bouton pause/lecture visible, flèches,
   touches ← →, glissement au doigt (> 45 px, sans ouvrir le lien sous le doigt).
6. **Pauses automatiques** : survol, focus dans le carrousel, hors écran (`useAEcran`), onglet
   caché (`visibilitychange`).
7. **Mouvement réduit** : aucun défilement automatique, pas de zoom ni de filet ; simple fondu
   (0,5 s) au changement manuel ; barres pleines.
8. **Accessibilité** : `aria-roledescription="carrousel"`, diapositives `role="group"` avec
   « n sur N », diapositives inactives `aria-hidden` + `inert`, région `aria-live="polite"`
   seulement quand le défilement est arrêté.
9. **Lisibilité** : voiles dégradés haut et bas pour les barres et la légende sur photo claire.
10. **Poids** : première image `fetchPriority="high"`, les autres `loading="lazy"`.

## Vérifier

- 1440 px et 390 px, clair et sombre, `reducedMotion: 'reduce'` (Playwright).
- Avance après la durée prévue ; la pause tient ; flèches, barres, clavier et glissement changent
  de diapositive ; aucun débordement horizontal ; aucune erreur console.
- Script d'exemple : voir la session (pcarrousel.cjs) — à recréer au besoin avec Playwright.
