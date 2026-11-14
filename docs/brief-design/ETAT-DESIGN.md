# État du design : ce qui est fait, ce qu'il reste à faire

Page pour Claude Design. À lire avant chaque nouvelle proposition, pour ne jamais refaire ce qui existe. Mise à jour par Claude Code à chaque nouvel écran ou nouvelle fonctionnalité.

**Dernière mise à jour : 14/11/2026 (lot 14 : Espace équipe)**

## 1. Ce que Claude Design a déjà livré

**Maquette « MGCI App v2 »** (13/11/2026) : `MGCI App v2.dc.html`, `README.md` (le détail de chaque écran) et `PLAN-CLAUDE-CODE.md` (16 lots). **Validée par le propriétaire** : c'est la référence de l'application. Ne pas la redessiner.

Écrans couverts : coquille (onglets en bas, feuille du bas, toast, hors connexion), accueil (5 variantes, **« Duo » retenue**), recherche, alertes (cloche), fiche produit, proposer un prix, discussion de négociation, publier en 5 étapes, prix, tous les produits, l'année du marché, carte du réseau, activité, messages, commande acheteur et vendeur, compte et sous-écrans, espace équipe, inscription et connexion, chauffeur, compte banni. Jetons clair et sombre.

## 2. Décisions du propriétaire (13/11/2026)

Toutes les nouveautés de la maquette sont acceptées : onglets en bas et alertes dans la cloche, roue retirée de l'accueil, accueil « Duo », recherche en phrase, zone qui s'élargit et « Pourquoi » sur la fiche produit, jauge du prix à la publication, espace équipe dans l'application.

- **Avatars** : plus besoin des personnages du marché. Les initiales de la maquette sont gardées.
- **Corrigé par Claude Code** (rien à refaire par Claude Design) : la porte garde l'alternance « marché de Gros » / « marché du pays » ; l'onglet Commissions écrit « Calculée », jamais « Encaissé ».

## 3. Avancement dans l'application (mis à jour à chaque lot)

| Lot | Contenu | État |
|---|---|---|
| 1 | Jetons | **fait** (13/11/2026) : `css/mgci-tokens.css`, `css/sombre.css` ; un écran refait pose `data-v2` |
| 2 | Coquille (onglets en bas, feuille, toast, hors connexion) | **fait** pour l'accueil (13/11/2026) : onglets en bas, feuille « Publier », alertes dans la cloche ; toast et bandeau hors connexion : ceux d'avant, gardés |
| 3 | Accueil « Duo » | **fait** (13/11/2026). Écart voulu : le prix médian s'affiche seulement à partir de 4 prix réels, et pas de tendance tant qu'elle n'est pas calculée sur les vraies données |
| 4 | Recherche | **fait** (13/11/2026). Écart : texte « rien trouvé » limité à ce qui est vérifié (« les vendeurs qui l’ont la verront et pourront vous proposer leur prix ») |
| 5 | Fiche produit | **fait** (13/11/2026). Écarts : zones « ma ville / ma région / tout le pays » (pas « autour de moi » sans position) ; cloche d’alerte et partage gardés en haut ; « prix publiés » au lieu de « relevés sur 7 jours » |
| 6 | Proposer + Discussion | **fait** (13/11/2026). Ajouts pour les règles : « Changer » le transport dans le reçu (prix du transport « à part »), « Ajouter une condition » replié ; sous la discussion, profil, écrire en privé, retirer, signaler, arrêter gardés |
| 7 | Publier | **fait** (13/11/2026). Écarts : « À la prochaine récolte » → « Ce mois-ci » (pas de date de récolte) ; « Chaque semaine » retiré des demandes (pas géré) ; prix obligatoire (règle du 25/10) |
| 8 | Prix, Tous les produits, Année du marché | **fait** (13/11/2026). Prix : « offres publiées » (pas encore les commandes), pas de tendance sans prix réels de deux semaines ; Tous les produits : les 12 vraies familles ; Année du marché : toutes les récoltes sourcées (A.CAL) |
| 9 | Carte | **fait** (13/11/2026). Décision du propriétaire : la carte MapLibre de l’application est gardée (plus pro) ; seule la logique de la maquette est prise : titre « Carte du réseau », Tout / Offres / Demandes en haut, produit et zone dans le panneau du bas, « Ce qui se rapproche » (offre et demande du même produit, de la plus proche à la plus loin). Distances à vol d’oiseau entre chefs-lieux. Rien à redessiner |
| 10 | Activité + Messages | **fait** (14/11/2026). Chaque ligne d’Activité mène à l’écran de la maquette (commande, côté vendeur, discussion, Mes annonces, Messages). Écarts : bandeau « lisibles par l’équipe » (règle), heure, non lu et menu Signaler / Bloquer gardés ; montant de la commande pas encore sur la ligne |
| 11 | Commande acheteur | **fait** (14/11/2026). Écarts : **mot secret dans le sens de l’application** (le vendeur l’écrit sur un papier dans le colis, l’acheteur le tape ; décision du propriétaire), 5 choix de problème du serveur (pas « Pas le bon produit »), « Commande passée » en première étape, « Votre marchandise est arrivée » |
| 12 | Côté vendeur | **fait** (14/11/2026). Le vendeur voit « Votre mot secret » ; pas de champ pour taper le mot (c’est l’acheteur) ; « Commission prévue · 3,5 % · rien n’est prélevé » |
| 13 | Compte | **fait** (14/11/2026) : Compte, Mon profil, Ma boutique, Mes annonces, Approvisionnement, Réglages, Sécurité, Aide. Écarts : nom « Awa K. » (vie privée), pas d’interrupteur par catégorie de notifications, pas de « Être rappelé » |
| 14 | Espace équipe | **fait** (14/11/2026) : écran plein `v3/equipe.js`, ouvert depuis Compte → Espace équipe et le menu ; 7 onglets (Identités, Litiges, Signalements, Comptes, Commissions, Diffusion, Journal), accès vérifié par le serveur (`est_admin`), motif demandé à chaque geste. Écarts : « Calculée » au lieu de « Encaissé 0 F » (règle) ; Identités sans ville, « Vérifier » demande la date d’expiration de la pièce ; Litiges sans photos ni poids du départ (le serveur ne les renvoie pas), case « Compter un litige perdu » ajoutée ; Signalements : une annonce encore en ligne se « Masque » seulement, les personnes signalées restent dans `admin.html` ; Comptes : numéro au lieu du nom. Lien « Ouvrir le tableau complet » vers `admin.html`, qui reste |
| 15 | Porte et cas limites | à faire |
| 16 | Passe finale (sombre, 320 px, contrastes) | à faire |

Les captures de chaque lot terminé sont dans `docs/brief-design/captures/` (`lot2-…` à `lot14-…`).

## 4. Le site pour ordinateur : ce qui existe, ce qui manque

**Instruction pour Claude Design : appliquer au site le même habillage que la maquette de l'application** (mêmes jetons, même typographie Jost, mêmes cartes, mêmes repères offre rond vert / demande carré jaune), adapté à un écran d'ordinateur. Le site ne refait pas l'application : il montre ce qui s'y passe et amène à l'installer sur le téléphone.

**Déjà fait** (site construit, encore caché : le public voit une page de maintenance ; pages en `noindex`, ouvertes seulement à l'administrateur) :
- Accueil : vraies photos des produits, « Je vends / Je cherche », fil « En ce moment », tableau des prix en direct, rayons du marché, petite carte, étapes, confiance, pros, guides, QR code pour prendre l'application.
- Carte du réseau en plein écran avec panneau (filtres, annonces).
- 27 pages produits (activité en direct, calendrier des récoltes sourcé, prix officiel OCPV au détail sur 11 d'entre elles).
- 7 guides (dont « Les grands marchés de gros », « Transporter le vivrier »).
- 14 pages de districts et un sommaire ; calendrier des récoltes ; « Prix de la semaine » (OCPV) ; « À propos » ; pages des boutiques des vendeurs.
- Les pages sont fabriquées par un programme à partir de gabarits (`tools/site/`) : Claude Design propose un dessin, Claude Code l'applique aux gabarits.

**Pas fait** (à dessiner par Claude Design) :
1. L'habillage de la maquette v2 appliqué au site : en-tête, pied de page, cartes d'annonce, tableau des prix, page produit, page guide, page district.
2. La page « Installer l'application » : QR code sur ordinateur, liens Play Store et App Store (à ajouter quand l'application y sera).
3. Le parcours du visiteur : il clique sur une annonce, crée son compte (le même que dans l'application), puis on l'invite à prendre l'application.
4. Un état « vide » propre pour chaque bloc en direct (aucune annonce, aucun prix) et un état « hors connexion ».

**Règles du site** : vie privée (prénom ou initiale, ville, produit, quantité ; jamais de numéro ni de nom complet) ; prix OCPV toujours « prix de détail » ; rien d'inventé ; l'eau des cartes reste bleue.

## 5. À faire maintenant par Claude Design

1. Le site pour ordinateur (partie 4, « Pas fait »), à partir de la maquette v2.
2. Rien sur l'application : la maquette est validée, Claude Code l'applique lot par lot.
