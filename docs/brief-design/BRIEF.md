# Brief pour Claude Design : Marché de Gros CI

## 1. Le projet en une phrase

Marché de Gros CI est une application mobile qui met en relation vendeurs et acheteurs de produits vivriers en gros en Côte d'Ivoire (igname, plantain, manioc, tomate, riz local, oignon…). Promesse : « Le marché de gros du vivrier ivoirien, dans le téléphone. »

Vendeurs et acheteurs se trouvent, comparent les prix, négocient, commandent et suivent la livraison au même endroit.

## 2. Qui utilise l'application

- **Vendeurs** : producteurs, coopératives, grossistes, commerçantes du vivrier.
- **Acheteurs** : grossistes, détaillants, restaurants, maquis, cantines, hôtels, commerces.
- **Transporteurs** : chauffeurs qui livrent (ils suivent la livraison par un simple lien).
- Usage **surtout sur téléphone**, Android d'entrée de gamme, connexion mobile faible ou coupée.
- Français simple. Certains lecteurs sont peu à l'aise avec l'écrit : verbes d'action, icônes dessinées en appui du texte.
- Unités du terrain : sac, carton, tas, régime, tonne, kg. Prix en francs CFA (F).

## 3. Ce que la personne fait dans l'application

Six étapes : **publier** (offre « J'ai à vendre » ou demande « Je cherche à acheter ») → **comparer les prix** → **négocier** (sans numéro visible) → **commander** (prix et quantité figés) → **livrer** (camion suivi par un lien) → **réceptionner** (mot secret, 1 h pour réclamer).

Écrans principaux :
- Accueil (« Bienvenue au marché », boutons « J'ai » et « Je cherche », carte-roue des produits)
- Marché (liste des annonces, filtres)
- Prix (tableau des prix par produit et par zone, mis à jour en direct)
- Activité (négociations, commandes, messages)
- Alertes (produits surveillés)
- Carte du réseau (annonces sur une carte)
- Fiche produit, fiche profil, fiche commande (reçu)
- Mon compte, réglages, aide

## 4. Ce que dit la marque (à respecter)

- **Une seule police : Jost.**
- **Couleurs** : fond crème chaud, encre presque noire `#171512`, vert du logo `#10392B` (action principale), maïs `#F2C230` (accent, « de Gros »). Vert clair `#6CC58C` = offre (vendre). Jaune `#F2C94C` = demande (acheter). Vert `#1F8A55` = accord conclu. Corail `#E2735B` = alerte.
- **Une couleur = un sens.** Ne pas réutiliser ces couleurs pour décorer.
- **Pas de bleu ni de violet** pour décorer. Seule exception : l'eau des cartes (fleuves, lacs).
- **Voix de la marque** : un mot clé du titre en Jost 900 italique, en maïs sur fond sombre ou souligné de maïs sur fond clair. Une fois par écran au plus.
- Vocabulaire : « vivrier », « en gros », « prix du moment », « mot secret ». **Jamais « PAYÉ »**.
- Les personnages du marché (produits avec un visage, dessinés en SVG) sont les avatars. Ils ne bougent qu'au repos, et sautent seulement quand il y a du nouveau.
- Le « J'ai » et le « Je cherche » ont un texte **noir**, dans les deux modes (clair et sombre).
- Un écran vide guide la personne (« Publiez la première : le réseau commence par vous. »), il ne reste pas vide.

## 5. Règles d'interface (chiffres à respecter)

- **Rien en dessous de 11,5 px** de texte.
- **Cibles tactiles de 44 px** minimum.
- **Contraste AA** : 4,5:1 pour le texte normal, 3:1 pour le gros texte. Le gris le plus pâle pour un texte sur fond clair : `#6F6553`.
- Marges d'écran : 16 px. Espacements sur une grille de 4 px.
- Rayons : 10 (petits), 14–16 (cartes), 22–24 (fenêtres), 999 (boutons pilule).
- Il faut tenir à **390 px et 320 px** de large, sans défilement horizontal.
- Mode clair **et** mode sombre.
- Mouvement : durées 160, 280 et 420 ms. Rien ne bouge en boucle sans raison. Respecter la réduction du mouvement.
- Un seul bouton principal par écran.
- Hors connexion : un bandeau discret « Pas de connexion · Réessayer ». Jamais une deuxième alerte rouge.

## 6. Ce qu'il faut éviter (le « design fait par IA »)

- Dégradés violets ou bleus, texte en dégradé, halos colorés, néons, verre dépoli décoratif.
- Cartes dans des cartes, bordure autour de chaque bloc, liseré coloré sur un seul côté.
- Surtitres en petites capitales (« ÉTAPE 1 », « 01 »), chiffres décoratifs géants, grille d'icône + titre + texte répétée.
- Emojis à la place des icônes. Icônes dessinées d'un seul trait.
- Tirets cadratin (—) dans les phrases. Utiliser « : », « , » ou « · ».
- Modales pour une tâche qui n'a pas besoin d'interrompre.
- Apparition animée de chaque bloc au défilement.
- Images de remplacement et faux avis, faux chiffres, faux logos. **Rien d'inventé.**

## 7. Règles de sécurité et d'argent (à respecter dans toutes les maquettes)

- **Aucun paiement n'est branché.** Ne jamais montrer qu'un argent est payé, encaissé ou prélevé dans l'application. Ne pas écrire « payez dans l'application ».
- La commission (3,5 % sur la marchandise, 6,9 % sur le transport du service Marché de Gros) est seulement **calculée**. Ne jamais dire qu'elle est encaissée.
- Un exemple de démonstration doit être **clairement marqué comme démo**.
- Pour le site public : prénom ou initiale, ville, produit, quantité. **Jamais de numéro de téléphone ni de nom complet.**
- Le mot « Marché de Gros » seul désigne les marchés physiques de l'État. Toujours écrire « Marché de Gros CI » ou un descripteur en ligne.

## 8. Remarque sur l'accueil actuel (capture jointe)

- Le bandeau « Négociez ici, payez à la livraison » peut laisser croire qu'on paie dans l'application. Proposition : « Négociez ici, convenez du prix avec le vendeur ». À valider.
- La carte « Marché de Gros vend à 12 500 F » est un exemple de démonstration : elle doit être marquée comme telle.

## 9. Ce que Claude Design doit produire

1. Une direction visuelle **épurée et unique** pour la marque : sobre, chaleureuse, pas générique. Elle doit rester fidèle au crème, au vert du logo et au maïs.
2. Une **proposition pour l'accueil** et pour **deux écrans** au choix : la fiche produit et l'écran de négociation (ou la commande).
3. Des maquettes en **clair et en sombre**, à 390 px de large.
4. Une liste courte de **changements proposés**, chacun avec la raison en une ligne (ex. « le bouton X passe en pilule vert parce que… »).
5. Pour chaque changement : ce qui se voit, et ce qui change dans le code (sans code, juste la description).

Tout reste une **proposition** : le propriétaire valide avant toute mise en œuvre. Rien n'est appliqué au code sans son accord, et toute modification passe par une demande de changement (PR) avec captures, fusionnée par lui.

## 10. Ce qu'on ne donne pas à Claude Design

- Le code de l'application, les clés, les mots de passe, les messages ou données des membres.
- L'adresse du site en ligne (le public voit une page de maintenance).
- Les données personnelles de quiconque.

## 11. Fichiers de référence (à joindre)

- `DESIGN.md` : la référence du design (couleurs, police, composants, interdits, 32 règles anti-« design généré »).
- `PRODUCT.md` : les utilisateurs, la promesse, les contraintes de terrain (téléphone d'entrée de gamme, connexion faible).
- `FOUNDER_CONTEXT.md` : la fiche du projet (ce qu'est l'entreprise, le modèle économique, la voix de la marque).
- Captures : accueil en clair et en sombre (iPhone émulé, 390 px).
