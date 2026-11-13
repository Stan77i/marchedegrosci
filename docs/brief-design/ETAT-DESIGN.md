# État du design : ce qui est fait, ce qu'il reste à faire

Page pour Claude Design. À lire avant chaque nouvelle proposition, pour ne jamais refaire ce qui existe. Mise à jour par Claude Code à chaque nouvel écran ou nouvelle fonctionnalité.

**Dernière mise à jour : 13/11/2026**

## 1. Ce que Claude Design a déjà livré

**Maquette « MGCI App v2 »** (13/11/2026), reçue par le propriétaire : `MGCI App v2.dc.html`, `README.md` (le détail de chaque écran) et `PLAN-CLAUDE-CODE.md` (16 lots, une PR par lot).

- Coquille : barre d'onglets en bas (Marché, Prix, Publier, Activité, Compte), feuille du bas, bandeau hors connexion, toast.
- Accueil en 5 variantes (Duo, Photos, Tableau de bord, Carte, Recherche).
- Recherche, Alertes (cloche), Fiche produit, Proposer un prix, Discussion de négociation, Publier en 5 étapes.
- Prix, Tous les produits, L'année du marché, Carte du réseau.
- Activité, Messages, Commande côté acheteur et côté vendeur.
- Compte et ses sous-écrans, Espace équipe, Inscription et connexion, Chauffeur, Compte banni.
- Jetons de couleur clair et sombre (partie 8 du `README.md` de la maquette).

**Rien de cette maquette n'est encore dans l'application.** L'application en ligne est celle des captures `accueil-clair.png` et `accueil-sombre.png`.

## 2. Bien repris des règles du projet

Police Jost seule, crème, encre, vert du logo et maïs ; « J'ai » et « Je cherche » en texte noir ; vert d'accord `#1F8A55` jamais en petit texte ; cibles de 44 px ; texte d'au moins 11,5 px ; « À la livraison, hors application » ; commission « calculée » côté vendeur ; mot secret, 1 h, délai 2/6/24 h, 5 essais, 72 h ; « ville seulement » ; problème en 5 choix et arrangement à trois ; pas de bleu hors de l'eau et du lien « compatible » de la carte.

## 3. À corriger dans la maquette (contraire aux règles)

1. **Avatars** : la maquette met des initiales (36 px). La règle : les **personnages du marché** (`v3/personnages.js`), calmes au repos, qui sautent seulement quand il y a du nouveau.
2. **« Encaissé 0 F »** dans l'onglet Commissions de l'Espace équipe : le mot « encaissé » est interdit pour une commission. Écrire « Calculée » (et « d'avant la règle : non réclamée »).
3. **Porte (connexion)** : il manque l'alternance « marché de Gros » / « marché du pays » (3 s, puis 2 s, toutes les 10 s), choisie par le propriétaire.
4. **Données d'exemple** (« Awa », vendeurs, prix) : normales dans une maquette, mais jamais dans l'application.

## 4. Nouveautés de la maquette qui attendent la décision du propriétaire

La maquette ajoute des choses qui ne sont pas dans l'application. Rien n'est construit sans son accord.

1. Onglets **en bas**, et les alertes dans la cloche (aujourd'hui : 4 onglets en haut).
2. **La roue des produits disparaît de l'accueil.**
3. **Choix de l'accueil** parmi les 5 variantes (la maquette conseille « Duo »).
4. **Recherche en phrase** (« 10 tonnes de manioc à Korhogo » → demande pré-remplie).
5. **Fiche produit** : zone qui s'élargit (autour de moi → ville → région → pays), « Pourquoi » cette offre est en tête, tri par correspondance.
6. **Publier** : aperçu vivant, jauge du prix du marché.
7. **Espace équipe dans l'application** (en plus de `admin.html`).

## 5. Pas couvert par la maquette

- Le site public pour ordinateur (`site/`) et l'ancien site.
- L'outil de l'équipe `admin.html`.
- Les animations (accueil vivant, signature « de Gros » / « du pays ») et leur vidéo.
- Les PDF de stratégie (`strategie/`).

## 6. À faire maintenant par Claude Design

Rien pour l'instant : attendre les réponses du propriétaire à la partie 4. Ensuite, corriger les points 1 à 3 de la partie 3 dans la maquette.
