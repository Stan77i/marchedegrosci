<!-- Source de vérité du produit. Passe au-dessus de toutes les consignes précédentes et de DIRECTIVE-DESIGN.md. -->
# MARCHÉ DE GROS DE CÔTE D’IVOIRE
## Philosophie produit, architecture fonctionnelle et langage d’expérience

---

# 0. NATURE DE CE DOCUMENT

Ce document constitue la **philosophie fondatrice du site**.

Il ne s'agit pas d'un simple brief graphique.

Il ne s'agit pas non plus d'une liste de composants à coder.

Il définit :

- ce qu'est réellement le Marché de Gros ;
- le problème qu'il résout ;
- comment fonctionne son marché ;
- comment l'offre rencontre la demande ;
- comment la géographie intervient ;
- comment la disponibilité et la saisonnalité interviennent ;
- comment les prix deviennent progressivement une intelligence du marché ;
- comment les différentes sections du site doivent fonctionner ;
- comment le design doit rendre cette philosophie visible ;
- comment l'expérience utilisateur doit évoluer ;
- comment le WebGL, Three.js, GSAP, shaders, physique, Canvas, SVG et micro-interactions peuvent devenir des traductions de cette logique.

**Ce document doit être considéré comme une source de vérité conceptuelle pour la refonte et l'évolution du site.**

Ne pas appliquer mécaniquement chaque idée.

Comprendre d'abord le système.

Puis le rendre vivant.

---

# 1. L'IDÉE FONDAMENTALE

Le Marché de Gros de Côte d'Ivoire n'est pas simplement un catalogue de produits.

Ce n'est pas simplement un site où l'on affiche des produits avec :

> photo → prix → bouton.

Ce n'est pas un simple e-commerce.

Ce n'est pas non plus uniquement un annuaire de producteurs.

Le cœur du projet est beaucoup plus simple :

# CONNECTER L'OFFRE ET LA DEMANDE.

Quelqu'un possède quelque chose.

Quelqu'un cherche quelque chose.

Le Marché de Gros crée la possibilité pour les deux de se rencontrer.

---

# 2. LA PHILOSOPHIE P2P

Le fonctionnement doit être inspiré philosophiquement des grands systèmes de marché P2P.

Un système comme Binance P2P ne pense pas uniquement :

> « Voici nos produits. »

Il pense :

> « Qui veut acheter ? »
>
> « Qui veut vendre ? »
>
> « Quelles offres correspondent à cette demande ? »
>
> « Quelles demandes correspondent à cette offre ? »

Le Marché de Gros transpose cette logique au marché agricole et professionnel ivoirien.

La plateforme devient une **infrastructure de rencontre**.

---

# 3. LES DEUX FORCES DU MARCHÉ

Tout le système repose sur deux éléments :

## OFFRE

Quelqu'un possède :

- un produit ;
- une quantité ;
- une disponibilité ;
- une localisation ;
- un prix ou une fourchette ;
- une période ;
- des conditions.

## DEMANDE

Quelqu'un recherche :

- un produit ;
- une quantité ;
- une localisation ;
- une date ;
- un prix ou une fourchette ;
- des conditions.

Le système doit constamment chercher :

# OFFRE ↔ DEMANDE

---

# 4. LE MARCHÉ EST UNE CONNEXION

Principe central :

> **Le marché n'est pas un lieu. C'est une connexion.**

Il peut y avoir :

- un producteur à Daloa ;
- un acheteur à Yamoussoukro ;
- un grossiste à Bouaké ;
- une coopérative dans la Nawa ;
- un transformateur à Abidjan ;
- un restaurant à San Pedro.

Ils ne sont pas physiquement dans le même marché.

Mais ils peuvent appartenir au même **réseau économique**.

Le site doit donc éviter de représenter le marché uniquement comme un bâtiment, des étals ou une place physique.

Le véritable objet du site est :

**la relation entre les acteurs.**

---

# 5. LA CÔTE D'IVOIRE COMME RÉSEAU

Le territoire n'est pas un simple filtre géographique.

Il fait partie du fonctionnement du marché.

Une offre possède une position.

Une demande possède une position.

Le système peut donc comprendre :

> Où est l'offre ?
>
> Où est la demande ?
>
> Quelle distance les sépare ?
>
> Existe-t-il une offre plus proche ?
>
> Existe-t-il une offre plus éloignée mais beaucoup plus pertinente ?

Le marché devient ainsi une **cartographie vivante de l'offre et de la demande en Côte d'Ivoire.**

---

# 6. « AUTOUR DE MOI »

La notion de proximité doit devenir une fonction importante.

Un utilisateur peut rechercher :

> **Autour de moi**

et obtenir les offres pertinentes dans son environnement.

Puis élargir :

**Autour de moi**
→ **Ma ville**
→ **Ma région**
→ **Ailleurs en Côte d'Ivoire**

La proximité est un critère.

Mais elle ne doit jamais être le seul.

---

# 7. LE MATCHING

Le système ne doit pas simplement chercher :

> produit identique.

Il doit chercher :

# COMPATIBILITÉ.

Une offre peut être évaluée selon :

- produit ;
- quantité ;
- disponibilité ;
- localisation ;
- distance ;
- prix ;
- date ;
- conditions ;
- fiabilité ;
- historique lorsque celui-ci existe.

Ainsi :

> **une bonne correspondance = plusieurs critères compatibles.**

Exemple :

Un acheteur recherche :

**10 tonnes de manioc**

Le système peut trouver :

### Offre A
10 t — 4 km — disponible aujourd'hui

### Offre B
20 t — 40 km — disponible aujourd'hui

### Offre C
8 t — 15 km — disponible demain

L'utilisateur doit pouvoir comprendre rapidement pourquoi une offre est plus pertinente qu'une autre.

---

# 8. LE SYSTÈME DOIT FONCTIONNER DANS LES DEUX SENS

C'est essentiel.

## Cas 1 — L'ACHETEUR COMMENCE

> Je cherche du manioc.

Le système cherche :

**DEMANDE → OFFRES**

---

## Cas 2 — LE VENDEUR COMMENCE

> J'ai 20 tonnes de manioc disponibles.

Le système cherche :

**OFFRE → DEMANDES**

---

## Cas 3 — PERSONNE NE CORRESPOND

Un acheteur cherche :

> 50 tonnes de maïs à Korhogo.

Aucune offre pertinente.

Le système ne doit pas simplement dire :

> Aucun résultat.

Il doit permettre :

# CRÉER UNE DEMANDE

Cette demande devient alors une information active dans le marché.

---

# 9. LA DEMANDE EST UNE DONNÉE

Une demande non satisfaite n'est pas un échec.

C'est une information.

Exemple :

> 50 tonnes de maïs recherchées à Korhogo.

Cette information peut révéler :

- une opportunité commerciale ;
- un manque d'offre ;
- une tension locale ;
- un besoin futur ;
- une zone à approvisionner.

La plateforme ne doit donc pas seulement montrer ce qui existe.

Elle doit également révéler :

# CE QUI EST RECHERCHÉ.

---

# 10. LA DISPONIBILITÉ

Le mot « disponible » doit être beaucoup plus précis qu'un simple badge.

Un producteur peut avoir :

**30 tonnes au total**

mais :

**10 tonnes disponibles maintenant**

et :

**20 tonnes disponibles dans deux semaines.**

Le système doit donc distinguer lorsque les données existent :

- disponible maintenant ;
- disponibilité future ;
- quantité restante ;
- quantité attendue ;
- indisponible ;
- disponibilité saisonnière.

La disponibilité doit être une donnée vivante.

---

# 11. LA SAISONNALITÉ

Le marché agricole possède une particularité fondamentale :

# LE TEMPS.

L'offre agricole varie.

Les récoltes arrivent.

Les disponibilités augmentent.

Elles diminuent.

Certaines périodes sont favorables.

D'autres sont tendues.

Le système doit progressivement pouvoir comprendre :

**produit × territoire × période**

et révéler les tendances correspondantes.

---

# 12. LE PRIX

Il faut absolument distinguer :

## Prix déclaré

> « Je vends mon produit à 250 FCFA/kg. »

et :

## Prix observé du marché

Une information construite à partir de plusieurs observations suffisamment pertinentes.

Ne jamais présenter le prix d'un seul vendeur comme :

> « le prix du marché ».

Le site doit pouvoir évoluer vers :

- historique ;
- évolution ;
- fourchette ;
- comparaison régionale ;
- tendance ;
- saisonnalité ;
- tension ;
- abondance.

Mais :

# PAS DE DONNÉE INVENTÉE.

Lorsqu'il n'y a pas assez de données :

> Données en cours de constitution.

ou :

> Pas assez de données pour calculer une tendance.

Le système doit préférer l'absence d'information à une information fausse.

---

# 13. LE MARCHÉ DEVIENT PROGRESSIVEMENT INTELLIGENT

Au départ, la plateforme possède :

**OFFRES**

et

**DEMANDES**

Puis les interactions créent :

**MATCHS**

Puis :

**TRANSACTIONS**

Puis :

**HISTORIQUE**

Puis :

**TENDANCES**

Puis :

**INTELLIGENCE DU MARCHÉ**

Le site devient progressivement plus intelligent à mesure que le réseau grandit.

---

# 14. LE SITE N'EST DONC PAS UN CATALOGUE

Un catalogue répond :

> « Qu'est-ce qui existe ? »

Le Marché de Gros doit répondre à davantage de questions :

> Qu'est-ce qui existe ?
>
> Où ?
>
> En quelle quantité ?
>
> Quand ?
>
> À quel prix ?
>
> Qui cherche ?
>
> Où existe-t-il une demande ?
>
> Quelle offre est proche ?
>
> Quelle offre correspond le mieux ?
>
> Quelle est la tendance ?
>
> Qu'est-ce qui devient rare ?
>
> Qu'est-ce qui devient abondant ?

C'est cette profondeur qui doit guider l'expérience.

---

# 15. ARCHITECTURE DU HEADER

Pour le moment, conserver :

# Accueil · Acheter · Vendre · Demander · Catégories · Carte · Prix du marché

Ne pas supprimer **Accueil** à ce stade.

Cependant, le header doit être extrêmement propre.

Il ne doit pas devenir une barre de navigation remplie d'informations.

Chaque entrée représente une intention claire.

---

# 16. ACCUEIL

Accueil = compréhension.

Il doit répondre très rapidement :

> **Qu'est-ce que le Marché de Gros ?**

Puis :

> **Que puis-je faire ici ?**

L'utilisateur doit comprendre immédiatement les deux grandes forces :

### J'AI UNE OFFRE

**Vendre**

### JE CHERCHE UNE OFFRE

**Acheter / Demander**

L'accueil ne doit pas être une accumulation de sections.

Il doit être une porte d'entrée vers le marché.

---

# 17. ACHETER

Acheter représente le côté :

# DEMANDE → OFFRE

L'utilisateur arrive avec une intention :

> Je cherche quelque chose.

Le système doit permettre de rechercher par :

- produit ;
- quantité ;
- localisation ;
- proximité ;
- disponibilité ;
- prix ;
- période ;
- critères pertinents.

L'expérience doit progressivement passer de :

**je cherche**

à :

**voici les offres les plus pertinentes.**

Le résultat doit être compréhensible avant d'être spectaculaire.

---

# 18. VENDRE

Vendre représente :

# OFFRE → MARCHÉ

Le vendeur possède une ressource.

Le site doit l'aider à la transformer en offre exploitable :

**produit**
→ **quantité**
→ **localisation**
→ **disponibilité**
→ **prix**
→ **conditions**
→ **publication**

L'expérience doit donner une impression de construction.

Une offre incomplète devient progressivement une offre claire.

---

# 19. DEMANDER

Demander représente le côté actif de la demande.

Il ne s'agit pas seulement d'une recherche sans résultat.

C'est :

# « Je cherche quelque chose qui n'est peut-être pas encore disponible dans le réseau. »

La demande devient une information exploitable.

Elle peut permettre au réseau de révéler :

- qui peut répondre ;
- où se trouve l'offre ;
- quand elle sera disponible ;
- où existe une tension.

---

# 20. CATÉGORIES

Catégories ne doit pas être une simple grille :

> tomate / manioc / maïs / igname / etc.

Elle doit permettre de comprendre la structure du marché.

Les catégories peuvent devenir une manière d'explorer :

**famille**
→ **produits**
→ **territoires**
→ **disponibilité**
→ **offres**
→ **demandes**

L'utilisateur doit pouvoir partir d'un produit et progressivement découvrir son environnement économique.

---

# 21. CARTE

La carte ne doit pas être une décoration.

Elle répond à une question simple :

> **Où est l'offre ?**

et progressivement :

> **Où est la demande ?**

Elle peut montrer :

- producteurs ;
- vendeurs ;
- acheteurs ;
- demandes ;
- disponibilités ;
- concentrations ;
- connexions ;
- zones d'activité.

La carte devient une représentation géographique du réseau.

---

# 22. PRIX DU MARCHÉ

Cette section doit devenir progressivement une fenêtre sur l'état du marché.

Pas simplement :

> Produit | Prix

Mais :

**Produit**
→ **prix observés**
→ **évolution**
→ **période**
→ **territoire**
→ **tendance**
→ **disponibilité**
→ **volume d'observations**

Le système doit toujours distinguer :

**donnée réelle**

de

**interprétation.**

---

# 23. LE DESIGN DOIT TRADUIRE CETTE PHILOSOPHIE

Le design ne doit pas illustrer le marché avec des clichés.

Éviter de réduire l'identité à :

- étals ;
- paniers ;
- personnages ;
- bâtiments de marché ;
- décorations agricoles génériques.

Le véritable sujet est :

# LA CONNEXION.

Le design doit donc pouvoir traduire :

**offre**

**demande**

**distance**

**proximité**

**disponibilité**

**circulation**

**connexion**

**propagation**

**densité**

**apparition**

**disparition**

**tension**

**abondance**

**temps**

**territoire**

---

# 24. WEBGL / THREE.JS

Le WebGL doit être utilisé comme un langage d'expérience.

Pas comme une décoration.

Three.js peut représenter :

- réseau ;
- profondeur ;
- territoire ;
- matière ;
- particules ;
- flux ;
- connexions ;
- densité ;
- propagation ;
- objets ;
- lumière.

Un objet WebGL doit avoir une fonction narrative ou interactive.

Si une particule existe :

> pourquoi ?

Si une ligne existe :

> qu'est-ce qu'elle représente ?

Si un objet se déplace :

> quelle action ou donnée provoque ce mouvement ?

---

# 25. LA SOURIS

La souris doit pouvoir devenir un instrument de découverte.

Elle peut :

- révéler ;
- attirer ;
- repousser ;
- déplacer ;
- déformer ;
- éclairer ;
- connecter ;
- modifier la profondeur ;
- révéler des informations.

Mais jamais simplement :

> « la souris bouge donc tout bouge ».

La réaction doit avoir une logique.

---

# 26. PHYSIQUE

Les interactions peuvent utiliser :

- inertie ;
- friction ;
- attraction ;
- répulsion ;
- ressort ;
- propagation ;
- momentum ;
- forces.

L'objectif est de donner une sensation de système vivant.

L'utilisateur doit sentir :

> **j'ai provoqué quelque chose.**

---

# 27. SHADERS

Les shaders GLSL peuvent traduire :

- matière ;
- profondeur ;
- distorsion ;
- flux ;
- chaleur ;
- densité ;
- mouvement ;
- révélation.

Ils doivent rester au service de l'expérience.

Pas d'effet shader gratuit.

---

# 28. GSAP / SCROLLTRIGGER

Le mouvement doit raconter une progression.

Le scroll peut :

- révéler ;
- transformer ;
- rapprocher ;
- éloigner ;
- connecter ;
- changer la perspective ;
- faire évoluer la scène.

Le scroll n'est pas uniquement un déplacement vertical.

Il devient une **progression narrative**.

---

# 29. LENIS

Le défilement doit être fluide et naturel.

Lenis peut fournir la sensation de continuité nécessaire entre :

**interface → contenu → WebGL → transitions.**

Le système doit rester stable et performant.

---

# 30. SVG / CANVAS

Utiliser SVG ou Canvas lorsque cela est plus pertinent que WebGL.

Exemples :

- connexions ;
- lignes ;
- indicateurs ;
- visualisations ;
- graphiques ;
- formes ;
- transitions ;
- données.

Ne pas utiliser Three.js uniquement parce qu'il est disponible.

Utiliser la technologie appropriée à chaque problème.

---

# 31. MICRO-INTERACTIONS

La qualité du site se joue aussi dans les petits gestes :

- boutons ;
- filtres ;
- recherche ;
- cartes ;
- résultats ;
- inputs ;
- menus ;
- états actifs ;
- chargements ;
- confirmations.

Chaque action doit produire une réponse claire.

Le système doit sembler attentif.

---

# 32. UNE RÈGLE ESSENTIELLE : L'INTERACTION AVANT LE SPECTACLE

Ordre de priorité :

**1. Comprendre**

**2. Trouver**

**3. Agir**

**4. Être guidé**

**5. Ressentir**

**6. Être impressionné**

Jamais l'inverse.

Le design peut être extrêmement sophistiqué.

L'utilisation doit rester extrêmement simple.

---

# 33. LA SIMPLICITÉ

Le site doit être :

**simple à comprendre**

mais pas :

**simple visuellement.**

C'est une distinction fondamentale.

L'interface peut contenir :

- WebGL ;
- profondeur ;
- shaders ;
- physique ;
- données ;
- transitions ;
- cartes ;
- visualisations.

Mais l'utilisateur doit percevoir une expérience simple :

> **Je cherche.**
>
> **Je trouve.**
>
> **Je vends.**
>
> **Je demande.**
>
> **J'explore.**

---

# 34. LE DESIGN DOIT ÊTRE QUALITATIF, PAS QUANTITATIF

Ne pas ajouter des informations simplement parce qu'elles sont disponibles.

Chaque information doit répondre à une question.

Chaque élément visuel doit avoir une fonction.

Chaque animation doit avoir une raison.

Chaque interaction doit améliorer quelque chose.

Chaque donnée doit être fiable.

# Moins d'informations.
# Plus de pertinence.

---

# 35. UNE ARCHITECTURE VISUELLE COMMUNE

Les pages :

**Accueil**
**Acheter**
**Vendre**
**Demander**
**Catégories**
**Carte**
**Prix du marché**

doivent appartenir au même organisme.

Elles peuvent avoir des atmosphères différentes.

Mais elles doivent partager :

- typographie ;
- rythme ;
- espace ;
- langage lumineux ;
- profondeur ;
- comportement du curseur ;
- principes d'animation ;
- logique des transitions ;
- philosophie des interactions.

Le site doit être immédiatement reconnaissable.

---

# 36. CHAQUE PAGE PEUT ÊTRE UN ÉTAT DU MÊME SYSTÈME

Ne pas penser :

> page 1
>
> page 2
>
> page 3

Penser :

> **un même marché qui change d'état.**

Accueil :

**comprendre le marché**

Acheter :

**explorer l'offre**

Vendre :

**ajouter une offre**

Demander :

**exprimer un besoin**

Catégories :

**explorer la structure**

Carte :

**explorer le territoire**

Prix :

**observer le marché**

Cette continuité doit être ressentie.

---

# 37. L'INTERFACE COMME SYSTÈME VIVANT

L'état de l'interface peut évoluer selon les données.

Exemple :

Une offre devient indisponible.

Le système doit pouvoir visuellement passer :

**Disponible**

→

**Faible disponibilité**

→

**Indisponible**

Une demande apparaît.

Le réseau peut révéler :

**Nouvelle demande**

Une zone possède beaucoup d'offres.

Elle peut apparaître comme :

**zone active**

Mais aucune donnée fictive ne doit être générée.

---

# 38. DONNÉES → VISUALISATION

Règle absolue :

# DATA → VISUALISATION

Jamais :

# VISUALISATION → FAUSSE DATA

Le WebGL et les animations doivent pouvoir être alimentés par les données réelles du site.

Si aucune donnée n'existe :

le système doit pouvoir afficher un état neutre.

Ne jamais inventer :

- producteurs ;
- quantités ;
- prix ;
- transactions ;
- demandes ;
- connexions.

---

# 39. LE RÔLE DU DESIGNER / CREATIVE DEVELOPER

Ne pas implémenter mécaniquement le layout actuel.

Observer.

Comprendre.

Identifier :

- ce qui fonctionne ;
- ce qui est inutile ;
- ce qui peut être regroupé ;
- ce qui doit être déplacé ;
- ce qui doit être supprimé ;
- ce qui mérite une interaction ;
- ce qui doit rester extrêmement simple.

Si un meilleur layout existe :

# LE CHANGER.

Si une section est trop chargée :

# LA SIMPLIFIER.

Si une animation n'apporte rien :

# LA SUPPRIMER.

---

# 40. ARCHITECTURE DE DÉCISION

Pour chaque nouvelle fonctionnalité ou section, poser :

### 1. Quelle question utilisateur résout-elle ?

### 2. Quelle donnée utilise-t-elle ?

### 3. Quelle action permet-elle ?

### 4. Quel état peut-elle avoir ?

### 5. Quelle relation possède-t-elle avec le reste du marché ?

### 6. Quelle représentation visuelle est la plus claire ?

### 7. Quelle technologie est la plus adaptée ?

Seulement après ces questions :

**CSS / SVG / Canvas / Three.js / GLSL / GSAP / etc.**

---

# 41. PERFORMANCE

L'expérience peut être ambitieuse.

Mais elle doit rester fluide.

Le WebGL doit être conçu intelligemment :

- DPR contrôlé ;
- nombre de particules maîtrisé ;
- instancing lorsque nécessaire ;
- textures optimisées ;
- calculs réduits ;
- scènes correctement détruites ;
- ressources libérées ;
- animations arrêtées lorsqu'elles ne sont plus nécessaires ;
- chargement progressif ;
- rendu adapté à la complexité réelle.

La performance ne signifie pas :

> moins de créativité.

Elle signifie :

> **plus d'intelligence dans la créativité.**

---

# 42. L'EXPÉRIENCE FINALE

Lorsque quelqu'un arrive sur le site, il ne doit pas se demander :

> « Qu'est-ce que ce site essaie de me montrer ? »

Il doit comprendre rapidement :

> **« Je peux trouver ce dont j'ai besoin. »**

ou :

> **« Je peux vendre ce que j'ai. »**

ou :

> **« Je peux exprimer ce que je cherche. »**

Et derrière cette simplicité, il doit découvrir progressivement un système beaucoup plus profond.

Un réseau.

Un marché.

Un territoire.

Des données.

Des disponibilités.

Des demandes.

Des tendances.

Des connexions.

---

# 43. LA PHRASE FONDATRICE

Tout le produit peut être résumé ainsi :

# « Tu as quelque chose ? Trouvons ceux qui le cherchent. »
# « Tu cherches quelque chose ? Trouvons ceux qui l'ont. »

Et à l'échelle du pays :

# « Le Marché de Gros connecte l'offre et la demande, partout en Côte d'Ivoire. »

---

# 44. CE QUE LE SITE DOIT DEVENIR

À terme, le Marché de Gros doit pouvoir devenir simultanément :

**un marché**

**un moteur de recherche d'offre**

**un moteur de recherche de demande**

**un réseau d'acteurs**

**une cartographie économique**

**un observatoire des disponibilités**

**un observatoire des prix**

**une mémoire du marché**

**un système de mise en relation**

Mais l'utilisateur ne doit jamais avoir l'impression d'utiliser huit outils différents.

Tout doit sembler appartenir à :

# UN SEUL MARCHÉ.

---

# 45. PÉRIMÈTRE ACTUEL

Pour cette phase :

### À construire

- philosophie produit ;
- architecture UX ;
- logique offre/demande ;
- logique de matching ;
- géographie ;
- disponibilité ;
- saisonnalité ;
- prix ;
- navigation ;
- interactions ;
- système visuel ;
- WebGL ;
- Three.js ;
- GSAP ;
- ScrollTrigger ;
- Lenis ;
- shaders ;
- physique ;
- SVG / Canvas ;
- micro-interactions ;
- performance.

### À NE PAS CONSTRUIRE MAINTENANT

Ne pas concevoir définitivement le mécanisme financier ou de sécurisation des transactions.

Notamment :

- escrow ;
- séquestre ;
- paiement sécurisé ;
- libération des fonds ;
- arbitrage ;
- mécanismes avancés de confiance transactionnelle.

Cette partie fera l'objet d'une **phase dédiée ultérieure**, lorsque l'architecture fondamentale du marché sera stabilisée.

Ne pas laisser cette future couche déformer prématurément la philosophie actuelle.

---

# 46. CONSIGNE FINALE À L'IMPLÉMENTATION

À partir de ce document, ne cherche pas simplement à :

> « rendre le site plus beau ».

Cherche à faire apparaître visuellement et fonctionnellement **le système qui existe derrière le site**.

Le marché doit être perceptible.

L'offre doit être perceptible.

La demande doit être perceptible.

La proximité doit être perceptible.

La disponibilité doit être perceptible.

Le mouvement du marché doit être perceptible.

Mais toujours avec une règle :

# COMPLEXITÉ INTERNE.
# SIMPLICITÉ EXTERNE.

L'utilisateur doit vivre une expérience simple.

Le système qui la produit peut être extrêmement sophistiqué.

C'est précisément cette contradiction qui doit faire la qualité du Marché de Gros de Côte d'Ivoire.