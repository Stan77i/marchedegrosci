# État du design : ce qui est fait, ce qu'il reste à faire

Page pour Claude Design. À lire avant chaque nouvelle proposition, pour ne jamais refaire ce qui existe. Mise à jour par Claude Code à chaque nouvel écran ou nouvelle fonctionnalité.

**Dernière mise à jour : 13/11/2026 (décisions du propriétaire : « ok pour tout »)**

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
| 5 | Fiche produit | à faire |
| 6 | Proposer + Discussion | à faire |
| 7 | Publier | à faire |
| 8 | Prix, Tous les produits, Année du marché | à faire |
| 9 | Carte | à faire |
| 10 | Activité + Messages | Activité **faite** (13/11/2026, avancée) ; Messages : à faire. Écart : le montant de la commande n'est pas encore sur la ligne |
| 11 | Commande acheteur | à faire |
| 12 | Côté vendeur | à faire |
| 13 | Compte | à faire |
| 14 | Espace équipe | à faire |
| 15 | Porte et cas limites | à faire |
| 16 | Passe finale (sombre, 320 px, contrastes) | à faire |

Les captures de chaque lot terminé sont dans `docs/brief-design/captures/` (`lot2-…`, `lot3-…`, `lot10-…`).

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
