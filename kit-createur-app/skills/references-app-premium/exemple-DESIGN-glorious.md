---
name: Glorious Destiny
description: Le comptoir — pierre chaude, cartes blanches, encre pour agir, or pour ce qui compte, une teinte par univers.
colors:
  fond: "#ecebe7"
  carte: "#ffffff"
  carte-2: "#f4f3f0"
  carte-3: "#e6e4df"
  filet: "#1918161a"
  filet-fort: "#1918162e"
  filet-champ: "#8c867b"
  encre: "#1a1816"
  encre-2: "#3b3833"
  encre-3: "#66625b"
  or: "#d6a756"
  or-texte: "#8a5d10"
  or-fonce: "#b8862c"
  sur-or: "#1a1206"
  menthe: "#57d9a6"
  sur-menthe: "#0d2a1e"
  rose: "#f8dad0"
  lilas: "#e4ddf3"
  sauge: "#d4eee1"
  sable: "#f4e6c3"
  succes: "#11744a"
  alerte: "#8f4706"
  danger: "#b42318"
  info: "#1f5bbd"
  serie-1: "#b07a1f"
  serie-2: "#2f6fc0"
  serie-3: "#cf5a33"
  serie-4: "#168f80"
  voile: "rgb(26 24 22 / 0.42)"
typography:
  display-xxl:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "96px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  display-xl:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "84px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "92px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  display-l:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  display-m:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline-l:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline-m:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline-s:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline-xs:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"5
  figure:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    letterSpacing: "-0.035em"
  price-l:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
  title-l:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
  title-m:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.6
  label:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.02em"
  micro:
    fontFamily: "Urbanist Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  badge: "9999px"
  control: "9999px"
  field: "9999px"
  textarea: "18px"
  alert: "18px"
  panel: "28px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  panel-padding: "24px"
  section-gap: "56px"
components:
  button-primary:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.fond}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.encre-2}"
  button-accent:
    backgroundColor: "{colors.or}"
    textColor: "{colors.sur-or}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.carte}"
    textColor: "{colors.encre}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-ghost:
    textColor: "{colors.encre-2}"
    rounded: "{rounded.control}"
    height: "44px"
  input:
    backgroundColor: "{colors.carte}"
    textColor: "{colors.encre}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "0 16px"
  panel:
    backgroundColor: "{colors.carte}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-padding}"
  tile-done:
    backgroundColor: "{colors.menthe}"
    textColor: "{colors.sur-menthe}"
    rounded: "{rounded.panel}"
  tile-todo:
    backgroundColor: "{colors.or}"
    textColor: "{colors.sur-or}"
    rounded: "{rounded.panel}"
  nav-pill-active:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.fond}"
    rounded: "{rounded.control}"
    height: "40px"
  badge:
    backgroundColor: "{colors.carte-3}"
    textColor: "{colors.encre-2}"
    rounded: "{rounded.badge}"
    height: "24px"
---

# Design System: Glorious Destiny

## Overview

**Étoile polaire : « le comptoir ».** Version 2, adoptée après l'étude du tableau de bord de référence Kavora (extraction Dembrandt de ses jetons, captures clair et sombre). On en garde la philosophie : un fond de pierre chaude, des cartes blanches très arrondies posées dessus, tout le reste en pilules ; l'encre (presque noire) pour agir ; un seul accent vif pour ce qui compte ; des tuiles pleines de couleur pour ce qui demande ou mérite l'attention ; une seule famille de caractères, semi-grasse et serrée en grand.

Glorious Destiny y met sa marque : l'**or** de ses étiquettes tient le rôle de l'accent, la **veine d'or** reste la signature, et chaque **univers** reçoit une teinte douce (perruques rose poudré, cils lilas, produits de pose sauge, salon sable). La **menthe** dit « fait, livré, disponible ».

Deux thèmes : **clair par défaut** (la marque se présente ainsi), **sombre** au choix de la visiteuse (bouton lune/soleil, mémorisé sur l'appareil, appliqué avant le premier rendu). Le site public (Persuade) et l'administration (Operate) partagent exactement les mêmes composants.

Anti-références : le salon rose pailleté, les écritures manuscrites, le néon, le texte en dégradé, le gris froid bleuté.

Source de vérité : `src/index.css` (variables `--gd-*` par thème, jetons `@theme`), `src/domain/univers.ts` (teintes par univers), composants dans `src/components/`, vitrine vivante sur `/systeme-design` (développement) et `/admin/systeme-design` (personnel).

## Colors

Stratégie **neutres chauds + un accent + teintes de rôle**. Chaque jeton a deux valeurs (clair · sombre) ; les noms disent le rôle, pas la couleur.

- **Fonds** : `fond` (page, ivoire #f3efe6 · noir profond #0f0f0e), `carte` (blanc cassé #fffdf8 · #1a1918), `carte-2` (survol, pastilles), `carte-3` (pistes de jauges, badges neutres).
- **Filets** : `filet` (séparateurs), `filet-fort` (contour des pilules secondaires, en ombre interne 1 px), `filet-champ` (bord des champs, ≥ 3:1).
- **Encre** : `encre` (texte et fond de l'action principale ; s'inverse en sombre), `encre-2` (secondaire), `encre-3` (discret, ≥ 4,7:1 sur toutes les cartes).
- **Or** : `or` (fond : point actif, compteur du panier, tuile « à traiter », bouton d'accent `or`), `or-texte` (or lisible en texte : prix, mot d'accent du titre ; 4,5:1 minimum), `or-fonce` (appui), `sur-or` (texte sur l'or, 8,4:1).
- **Lingot d'or** (v2.1, inspiré du tableau de bord Marlo) : `or-clair` → `or` → `or-profond` en dégradé à 135° (`.degrade-or`), avec le halo `shadow-or`. Réservé à **l'élément vedette** d'un écran : le bouton qui rapporte (Ajouter au panier, Commander, Valider ma commande, Réserver ce créneau, Commandes en admin) et la carte du chiffre d'affaires du tableau de bord. `or-doux` → `or` (`.degrade-or-doux`) : segment « en cours » des barres. `.hachures` : la piste ou l'échelle qui n'est pas remplie.
- **Menthe** : `menthe` + `sur-menthe` : tuile pleine « fait / disponible / livré » et bloc livraison.
- **Teintes d'univers** : `rose` (perruques), `lilas` (cils), `sauge` (produits de pose), `sable` (salon, services). Fonds uniquement, texte toujours en encre dessus (≥ 4,6:1 même pour `encre-3`). Correspondance en code : `TEINTE_TYPE_PRODUIT`, `TEINTE_SALON`. Jamais derrière un article : les produits se posent sur le socle ivoire (`.socle-produit`).
- **États** (réservés, toujours avec un mot ou une icône) : `succes`, `alerte`, `danger`, `info`, utilisés en texte et en fond à 12 %.
- **Séries de graphiques** : `serie-1` à `serie-4` en ordre fixe (Douala, Yaoundé, Garoua, Abidjan), une valeur par thème.

### Thème jour / nuit (v2.2)

- Trois choix : **appareil** (par défaut, suit `prefers-color-scheme` en direct), **clair**, **sombre**. Composant unique `SelecteurTheme` (admin : barre du haut ; site : en-tête dès 1280 px, menu mobile et pied de page).
- Le choix est mémorisé sur l'appareil (`gd-theme`, absent = appareil) et appliqué par `index.html` avant le premier rendu.
- Changement en fondu de 0,32 s sur tous les composants (`html.theme-en-transition`), supprimé si le mouvement est réduit.
- Contrastes vérifiés : `encre-3` ≥ 4,9:1 sur tous les fonds clairs et ≥ 5,4:1 en sombre ; `or-texte` ≥ 4,5:1 sur fond, cartes et sable ; bord des champs ≥ 3,2:1. À corriger plus tard : `or-texte` sur `rose` et `lilas` (4,4:1).

## Typography

**Une seule voix : Urbanist** (auto-hébergée, variable). C'est la police de la marque de référence ; Bodoni Moda est retirée.

- **Affiche** (`.titre-affiche`) : graisse 600, approche −0,035 em, interligne 1. Un mot peut passer en `or-texte` pour l'accent (jamais d'italique : Urbanist n'en a pas de vrai).
- **Interface** : graisse 500 pour le texte courant, 600 pour titres, libellés et chiffres.
- **Chiffre clé** (tuiles) : 44 px, 600, −0,035 em. Colonnes et axes en `.chiffres` (tabulaires).
- **Échelle** : affiche 96 / 92 / 84 / 64 / 56 px, titres 52 / 44 / 40 / 34 / 28 px, interface 26 / 21 / 19 / 17 / 15 / 13 / 11 px. Aucune autre taille.
- En-têtes de tableaux en casse normale, 13 px, `encre-3` (plus de petites capitales espacées).
- Pas de sur-titre au-dessus d'un titre.

## Layout

- Mobile d'abord : gouttières 16 / 24 / 40 px ; conteneur `max-w-7xl` public, 1440 px admin.
- Les sections ne sont plus séparées par des filets : ce sont les cartes et les tuiles colorées qui découpent la page.
- Grilles fluides ; tableaux en fiches empilées sous 640 px ; la colonne d'actions passe en pleine largeur (`pleineLargeur`).
- Cibles tactiles ≥ 44 px (champs 48 px).

## Elevation & Depth

Profondeur par **contraste carte/fond** : la carte blanche sur la pierre suffit. Deux ombres, une valeur par thème :

- `panneau` : 1 px très doux en clair ; ombre basse diffuse en sombre.
- `flottant` : modales, tiroirs, survol des cartes produit, légende flottante du premier écran.

Le voile des modales est l'encre à 42 % (clair) ou le noir à 62 % (sombre), flou 3 px.

## Shapes

- Contrôles, champs d'une ligne, sélecteurs, badges, navigation : **pilule** complète.
- Zones de texte, alertes, vignettes internes : 18 à 22 px.
- Cartes, panneaux, tuiles, modales : **28 px**. Une carte produit a 8 px de marge intérieure : la vignette sur socle ivoire s'y loge en 22 px.
- Signature : la **veine d'or** (`VeineOr`), une seule par écran. Logo provisoire : pastille d'encre frappée d'un « G » d'or + nom en Urbanist 600 (`Signature`).

## Motion

Une courbe : `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-sortie`), 300 ms pour les couleurs et les survols, soulèvement de 4 px des cartes au survol. Le thème bascule avec une transition de fond de 320 ms.

Langage du mouvement, une idée par écran, toujours au fil d'or :

- **Carrousel des gammes** (`CarrouselGammes`) : la nouvelle photo se dévoile derrière un filet d'or (transition « rideau »), puis s'approche lentement (zoom doux). Barres de progression par diapositive, pause au survol, au focus et hors écran.
- **Mèches** (`Meches`) : une chevelure dessinée au fil d'or ; les mèches se tracent une à une, puis ondulent lentement.
- **Regard** (`Regard`) : un œil au fil d'or ; les cils poussent, puis l'œil cligne naturellement, à intervalles irréguliers.
- **Veine d'or** (`VeineOr`) : tracé progressif, une seule fois par écran.
- **Révélation au défilement** (`useRevele`) : un seul observateur pour la page ; chaque élément apparaît à son entrée, une fois.
- **Bulles** (`Bulles`) : réservées à Hair Curl Mousse et Braid Gel. Au survol sur ordinateur ; une ou deux fois à l'apparition sur téléphone.

Mouvement réduit (`prefers-reduced-motion`) : tout est statique, rien ne se cache, le carrousel passe en simple fondu sans défilement automatique.

## Components

- **Bouton** : `principal` (pilule d'encre, **une par écran**), `or` (lingot : l'action qui rapporte, une par écran), `secondaire` (carte blanche + contour interne 1 px), `fantome`, `danger`, `sur-menthe` (sur une tuile menthe). Tailles 36 / 44 / 52 px.
- **Champs** : pilules de 48 px (zone de texte 18 px) ; focus = bord encre + halo doré 4 px ; case cochée en encre, interrupteur actif en menthe.
- **Navigation** : barre de pilules blanche, actif en encre plein (inversé en sombre), au public comme en admin. `Onglets` : filet d'encre sous l'actif.
- **TuileChiffre** : fond `carte`, `or` (à traiter : commandes à confirmer), `menthe` (disponible, fait) ou une teinte (stock bas = sable, épuisé = rose, à expédier = sauge). La couleur ne s'allume que si la valeur l'exige.
- **CarteProduit** : article détouré posé sur le socle ivoire (`.socle-produit`), prix en `or-texte`, bouton « Ajouter » secondaire. Au survol, l'article se soulève et s'agrandit légèrement. Les visuels pleins (photos d'univers) gardent le fond `carte-2`.
- **EnTetePage** : avec `teinte`, l'en-tête devient une grande carte à la couleur de l'univers (Perruques, Cils, Catalogue, Services, Rendez-vous).
- **Premier écran** : titre en affiche, un mot en or ; carrousel des gammes en carte 28 px (rideau d'or, barres de progression, pause) avec légende en pilule flottante et flèche d'encre.
- **Rituel de pose** : quatre cartes teintées, numéro en pastille blanche.
- **Bloc livraison** : grande tuile menthe, pays desservis en pastilles.
- **Administration** (v2.1) : menu latéral (carte 26 px, groupes Boutique / Pilotage, actif en encre, compteurs à confirmer en or), barre du haut (date avec point d'or, thème en deux segments soleil / lune, profil avec initiales sur le lingot), barre d'onglets en bas sur téléphone (4 modules + « Plus »).
- **Tableau de bord** : barres d'état en pilules (encre = réglé, or = en cours, gris = à traiter, nombre écrit dans la pilule, légende en mots), pouls des ventes en colonnes pilules dans une piste hachurée avec étiquettes reliées d'un fil (période en cours en or, encre au-dessus de la moyenne, gris en dessous), anneau à bouts arrondis, frise des rendez-vous du jour.
- **Badge**, **Alerte**, **Modale**, **Tableau**, **États**, **Notifications** : inchangés dans leur rôle, redessinés aux nouveaux jetons.

## Do's and Don'ts

**À faire**
- Une seule pilule d'encre pleine par écran ; un seul lingot d'or (l'action ou le chiffre qui rapporte).
- Colorer une tuile seulement quand sa valeur appelle une action ou dit une réussite.
- Garder la correspondance univers → teinte partout (en-tête, rituel, pastilles) ; la carte produit reste sur le socle ivoire.
- Vérifier chaque écran dans les deux thèmes, à 390 px et 1440 px.
- Utiliser les vrais visuels ; marquer « Données d'exemple » toute démonstration.
- **Règle de l'antagoniste** : toute action conçue avec son geste inverse, dans le même geste
  et au même endroit, sans bouton de plus. Ajouter ↔ retirer (toucher la pastille du compteur),
  ouvrir ↔ fermer (toucher à côté, glisser), activer ↔ désactiver (même interrupteur), suivre ↔
  ne plus suivre. Le geste inverse a son propre retour : son descendant, vibration, message.

**À ne pas faire**
- Mettre du texte en or plein (`or`) : utiliser `or-texte`.
- Employer une teinte d'univers comme couleur d'état, ou une couleur d'état comme série.
- Faux italique, deuxième police, texte en dégradé, néon, verre décoratif.
- Remettre des filets entre les sections du site public.
- Inventer un prix, un avis, un chiffre ou un produit.
