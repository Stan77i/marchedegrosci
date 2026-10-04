# Journal des mises à jour

À chaque mise à jour : remplacer les fichiers du dépôt par ceux de ce dossier, supprimer ceux listés « Supprimés », puis `git add -A && git commit && git push`.

## 2026-10-03 — La lumière du produit sur tout le site (lot 1/5)

- Le produit choisi (hero, recherche, fiche, Demander, lien `?p=`) éclaire tout le site, gardé pendant la session. Lumière par défaut : la terracotta du logo.
- Quatre niveaux : immersion (sections sombres), accent (boutons d'action, liens, focus), reflet (crème et ombres teintées à 4–6 %), neutre (texte, logo, mentions : inchangés). Encre d'accent recalculée pour garder 4.8:1 sur le crème.
- Choisir une famille donne une lumière de famille, plus discrète.
- En-tête : pastille « Sous la lumière de… » avec « éteindre ».
- Retour : cercle de 36 px, s'étire au survol et nomme sa destination (« Acheter », « Aubergine »…) ; lien direct → parent logique ; Alt+← et Échap.
- Voir plus : lien compact qui annonce le nombre réel (« 24 produits de plus, sur 134 »), puis « C'est tout pour l'instant » + lien vers Demander.

Fichiers
- Modifié : `index.html`

## 2026-10-03 — Familles : photos à la place des scènes WebGL

- Les 11 cartes de familles (accueil et page Familles) affichent une photo carrée plein cadre, avec le nom et le nombre de produits sur un voile en bas.
- Scènes animées WebGL des familles supprimées : page plus légère, rien ne se charge en plus.

Fichiers
- Ajoutés : `v2/img/famille-*.webp` (11 images, 720 × 720)
- Modifié : `index.html`
- Supprimés : `v2/familles.js`, `v2/familles-scenes.js`, `v2/familles-scenes2.js`

## 2026-10-03 — Carte « Le réseau » : offre ↔ demande, sans destination imposée

Alignement sur la philosophie du site : un réseau qui met en relation l'offre et la demande partout en Côte d'Ivoire, pas un flux dirigé vers Abidjan.

- Carte : plus de point central. Point plein = offre (taille = volume), cercle = demande, fil = mise en relation possible entre une offre et une demande du même produit, d'une ville à l'autre.
- Accueil : la section « Le trajet » devient « Le marché, en réseau » (offres, demandes, volumes, rencontre la plus proche, bouton « Publier une demande »).
- Carte plein écran : liste « Qui en cherche » sous les offres ; fiche vendeur = demandes pour ses produits (plus de « km jusqu'à Abidjan, marché principal ») ; toucher une demande affiche les offres du produit.
- Page Demande : la demande publiée se relie aux offres du produit.
- Demandes d'exemple (restaurants, hôtels, commerçants, transformateurs…) dans 10 villes ; les demandes publiées sur le téléphone apparaissent aussi sur la carte.

Fichiers
- Ajoutés : `v2/reseau-carte.js`, `v2/demandes.js`
- Modifié : `index.html`
- Supprimé : `v2/trajet.js` (remplacé par `v2/reseau-carte.js`)

## 2026-10-03 — Carte « Le trajet » (remplace la carte 3D)

Inspirée de la scène « Le trajet » du dépôt ivt-boutique, adaptée aux couleurs du marché (fond cacao, routes à la couleur du produit).

- Accueil : nouvelle section « Le trajet » sous l'étal. Le produit choisi allume ses routes producteurs → Abidjan, avec le prix de départ, le nombre d'offres et la distance.
- Carte plein écran (#/carte), encarts des fiches et page Demande : la carte en points remplace le territoire 3D. Recherche, zones, « Autour de moi » et sélection inchangées.
- Plus de Three.js ni de fond de carte téléchargé pour la carte : plus léger, fonctionne sans WebGL.

Fichiers
- Ajouté : `v2/trajet.js`
- Modifié : `index.html`
- Supprimé : `v2/territoire.js`
