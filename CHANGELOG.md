# Historique des changements (CHANGELOG)

Cet historique vient de `git log origin/main` du dépôt (607 commits) et des sections datées de `docs/PASSATION.md`. Il commence au premier commit, le 03/10/2026 (852d810). Du plus récent au plus ancien, groupé par jour (date du commit). Les références `Stan77i/marchedegrosci#NNN` sont les PR fusionnées citées par les messages de fusion (#1 à #20 le 11 et 12/10, puis #21 et suivantes). Les messages de commit sont lus tels quels : une PR citée à côté d'un commit est celle fusionnée juste avant ou après lui sur la même branche. Les numéros « schéma NN » sont les fichiers `supabase/schema-NN-*.sql`. Rien ici ne dit qu'un paiement, un séquestre ou une commission a été réellement encaissé : aucun prestataire de paiement n'est branché.

Total couvert : 12 jours avec des commits (3, 4, 10, 11, 12, 17, 18, 19, 21, 22, 23 et 24 octobre 2026), 607 commits. Aucun commit les 20/10 et entre le 5 et le 9, le 13 et le 16 octobre.

## 24/10/2026

- Notifications (schémas 88a, 88b, 88d et `pousser` en production le 24/10/2026 ; écran dans la PR « Notifications ») : audit (`docs/audits/audit-notifications-2026-10-24.md`) ; serveur (schémas 88a, 88b, 88d, `pousser` version 22) : catégories, préférences, plafonds, heures calmes, regroupement, anti-doublon, ciblage, groupe à 80 %, produit à racheter, journal et statistiques ; écran : réglages par catégorie, état réel et essai vérifié, toucher qui ouvre le bon écran, ouverture comptée, tableau de bord « Notifications ». Cache `mgci-v274`.

- Les communes d'Abidjan (Cocody, Yopougon…) ne sont plus proposées comme villes : dans la région Abidjan, « Abidjan » est mis tout seul et le choix de la ville est grisé ; une commune enregistrée avant devient « Abidjan ».
- Abidjan est une seule ville : avec une commune (Cocody, Yopougon…), l'interrupteur dit « Je vends uniquement à Abidjan » ; une livraison d'une commune à l'autre est « même ville » (schéma 87c, appliqué en production).

- Chantier 4 (branche `claude/chantier-boutiques-p`, schéma 86, 86b et 86c appliqués en production) : boutique par vendeur avec adresse (pseudo ou code court), lien, QR code à télécharger, aperçu de partage (pages `site/boutiques/`, noindex), visites en totaux ; pause d'une offre, retrait sans effacement, quantité obligatoire, verrou contre la survente ; page de maintenance avec le QR de la boutique.
- Formulaires de publication : une ville d'une autre région n'est plus gardée en mémoire (« Guiglo » ne revient plus sous « Abidjan » à la réouverture de l'application) ; le profil la vide quand sa région change.
- Transport : « Transport à votre charge » pour l'acheteur, « À la charge de l'acheteur » pour le vendeur, « À ma charge » dans une demande, partout (publication, annonces, tableau du marché, négociation, commande).


- « Ville uniquement » : pour une localité tapée (« Guiglo » dans la région Abidjan), c'est la ville de rattachement de la région choisie qui compte (« Je vends uniquement à Abidjan »), dans l'application et sur le serveur (schéma 87b) ; la région choisie ne change plus toute seule.
- Publication d'une offre : le choix « Non inclus » devient « Transport à part » (« son prix se négocie à part »), et l'annonce affiche « Transport à part » au lieu de « Transport à discuter ».
- Niveaux de confiance (chantier 3) : Vendeur fiable, Bon, Excellent, Grand vendeur, mêmes paliers pour les acheteurs et « Acheteur en gros », calculés par le serveur (schéma 85, appliqué en production), écran « Mes niveaux », tableau de bord de l'administrateur.
- Connexion : le titre alterne « marché de Gros » et « marché du pays » (3 s, puis 2 s, toutes les 10 s), validé en vidéo par le propriétaire ; le « court film » de connexion a été refusé et n'est pas fusionné.

Audit antislop de l'application, stabilité, prix officiels et reprise de projet.

- « Ville seulement » : vendre ou acheter uniquement dans sa ville (schéma 87, projet de test seulement) : interrupteur à la publication, pastille « Guiglo uniquement » partout où l'annonce apparaît, avertissement avant de négocier ou d'écrire, ville imposée à la commande, refus du serveur hors de la ville (branche `claude/ville-seulement`).
- Audit antislop de l'application : rapport complet sans correction (a40b3ca, Stan77i/marchedegrosci#251), puis corrections par lots :
  - phrases justes sur le paiement, n° 1 à 6 (b9143f4, Stan77i/marchedegrosci#251) ;
  - textes lisibles, n° 7 à 20 (c345021, Stan77i/marchedegrosci#252) ;
  - stabilité, n° 21 à 25 (4b1272e, Stan77i/marchedegrosci#253) ;
  - clavier et formulaires, n° 26, 31, 32, 34, 35 (304ce33, Stan77i/marchedegrosci#254) ;
  - icônes, couleurs, pastilles, cibles de toucher, n° 27 à 30 (d5c9c10, Stan77i/marchedegrosci#255) ;
  - textes, erreurs, animations, n° 33, 36 à 45, 52 (fba4c7a, Stan77i/marchedegrosci#256) ;
  - finitions, n° 46 à 58 (d76c3dd, Stan77i/marchedegrosci#258) ;
  - décisions A, B, C du propriétaire (3b425be, Stan77i/marchedegrosci#258).
- Compétence antislop installée et essayée sur l'application et le site (3e46fd1, Stan77i/marchedegrosci#249).
- Application plus stable : ouverture sans petit logo, profil sans écran vide, plus de clignotement au défilement (c0d0996, Stan77i/marchedegrosci#246). L'année du marché reçoit panier et caddie, le bouton de la fiche est affiné, et sur le réseau « Où êtes-vous ? » perd son cadre jaune (dfba010, Stan77i/marchedegrosci#247).
- Site : prix officiels de la semaine (OCPV) sur 11 pages produits et une page « Les prix de la semaine » (4d2a136) ; téléchargement automatique de la note chaque semaine par une tâche GitHub (a19f53d) ; documents mis à jour (b748a54). PR : Stan77i/marchedegrosci#245.
- Documentation de reprise : rapport du 24/10 avec fiche du projet, portage et reprise (c4b4734, Stan77i/marchedegrosci#244) ; marche à suivre « reprise en un mot » (809e4b4) ; fiche de reprise après les PR #246 et #247 (67d379b, Stan77i/marchedegrosci#248).
- Inventaire du site mis à jour automatiquement (d02ca7a, 2fdc445).

## 23/10/2026

Journée la plus chargée : sécurité de la base, séquestre et livraison suivie, design, PDF de stratégie, naissance du nouveau site public (caché).

Application, livraison et transport
- Entrée : scène du marché (étals, passants, enseigne, camion rapide, tomate qui tombe), connexion refaite, le sac dit bienvenue après la connexion (9b15a1d, 0656c95, 05d982b, b5e60f9, 3f07a45, Stan77i/marchedegrosci#174).
- Livraison refaite : plan à route en lacets, fiche foncée, image du produit (71aa6d4, Stan77i/marchedegrosci#175).
- Transport choisi par l'acheteur ou le vendeur : plus de code de chauffeur, réception par le mot secret du vendeur (bb00294, schéma 63, Stan77i/marchedegrosci#181).
- Lien de suivi qui démarre dès l'ouverture, « le chauffeur a ouvert le lien », code court de secours (c59ff12, schéma 64, Stan77i/marchedegrosci#184).
- « Le camion est parti » : étape signalée par le vendeur ou détectée par le lien de suivi (3969b72, schéma 65, notifications v19, Stan77i/marchedegrosci#184).
- Écrans stables : plus aucune fenêtre ne glisse de côté (5f8ee68).
- Code de suivi du chauffeur : essais limités, tirage sûr (5934c0f, schéma 71, Stan77i/marchedegrosci#191) ; code de secours : les essais ratés sont enfin comptés (594d3ab, schéma 72, Stan77i/marchedegrosci#198).

Application, prix et marché
- Prix : vignettes en cascade, prix du moment à la place du nom sur l'orbite (88717cb, Stan77i/marchedegrosci#176) ; pop-up « Ici, chacun place son prix » avec l'échelle des prix (7558780, Stan77i/marchedegrosci#177).
- Accord entre le pop-up du prix du moment et la bulle d'activité, une seule règle de couleurs (b83a1f9).
- Démo de la roue et des prix : switch « Démo », démonstration guidée, tutoriel en cartes (e9851c1, Stan77i/marchedegrosci#178).
- Réglages : fréquence des astuces et démos, démo au démarrage, bouton Démo affichable (f40509d, Stan77i/marchedegrosci#179).
- Placer son prix dans les deux sens (vendeurs et acheteurs) et bulles « qui a placé ce prix » (3a71636, Stan77i/marchedegrosci#180).
- Tableau du marché : les 50 meilleures annonces par unité, avec les vrais totaux (fca8de6, schéma 70, Stan77i/marchedegrosci#190).
- Index par produit sur les offres et les demandes (73f12fe, schéma 69, Stan77i/marchedegrosci#189).

Sécurité et base de données (corrections, sans changer les règles métier)
- Signalements d'annonces : l'auteur est toujours fixé par la base (6eb0b4f, schéma 66).
- Zones de forte demande : de nouveau visibles sans compte (5cdad6c, schéma 67).
- Messages avec un numéro ou un lien : le filtre ne plante plus (dece49e, schéma 68).
- Annonces : la date de publication et l'auteur ne se modifient plus (cbf74e5, schéma 73).
- Photos du profil public : seulement celles du membre (9c1bbe5, schéma 74).
- Alertes « nouvelle annonce » : au plus 10 par membre et par jour (9b1878a, schéma 75).
- Annonces : le téléphone ne retélécharge plus tout quand rien n'a changé (9a82fde, schéma 76, Stan77i/marchedegrosci#198).
- Notes : chaque auteur ne compte qu'une fois par personne notée (c04ff0e, schéma 77, Stan77i/marchedegrosci#199).
- L'heure de dernière activité n'est plus visible sans compte (58bb4d7, schéma 78, Stan77i/marchedegrosci#200).
- Mesure des visites sans donnée personnelle : schéma 81, site, maintenance, application, écran « Visites » (0307d39, Stan77i/marchedegrosci#229).

Corrections de l'interface
- La messagerie s'ouvre de nouveau à l'écran, conflit de styles avec la démo (5c88558).
- Petits boutons réparés : sortie de Mon compte, Me localiser, Suivre, ligne du numéro (82a33b6).
- Doublon « En cours », switch Démo en jour, croix de fermeture, pastille photo du profil (af695f1, Stan77i/marchedegrosci#206).
- Flèche de retour visible sur les pages claires, unités au pluriel (fa9a898, Stan77i/marchedegrosci#211).
- Pas de connexion : bandeau rouge en haut et sac qui dort (913617f, Stan77i/marchedegrosci#217).
- Onglets d'Acheter : le nombre dans l'onglet, plus d'ombre noire sur le panneau de la carte (4d811fc, Stan77i/marchedegrosci#218).
- Carte du réseau : panier et caddie dessinés dans les filtres Offres et Demandes (a3f32ec, Stan77i/marchedegrosci#219).
- Pastille sur Prix, « Aucune activité / Aucune alerte », pastilles panier et caddie au tableau (8903dbf, Stan77i/marchedegrosci#228).
- La carte « Dernières annonces » disparaît quand elle est vide (234b6e8, Stan77i/marchedegrosci#240).

Design
- Reçu d'accord, suivi de commande, ligne de vérification, personnages du marché (9708f4a, Stan77i/marchedegrosci#207).
- Avatars : bras attachés, ombre corrigée, vrai dé pour le tirage (3d02aa8, Stan77i/marchedegrosci#208) ; calmes au repos, un saut seulement quand il y a du nouveau (299dd47, Stan77i/marchedegrosci#209).
- Compétences de design installées (impeccable, ui-ux-pro-max, playwright-cli, skillui), DESIGN.md, carte du réseau allégée (98cdd9d).
- Lois anti-« design généré par IA » : 32 règles dans DESIGN.md et premières corrections (2d19969, wip dc60344).
- Panier et caddie dessinés à la place des émojis, tirets cadratins retirés des phrases (280d4f5) ; plus grands (d7696ba, 3398d45, Stan77i/marchedegrosci#213).
- Pastilles de nombre (.nbul) partout, oubliées par la fusion de la PR #213 (0be13ea, Stan77i/marchedegrosci#215).

Catalogue
- Produits du site IVT : photos, 5 nouveaux produits, tomate en carton (de05756, Stan77i/marchedegrosci#202).
- Consignes : Turnstile sur le site seulement, liste des produits sans photo (f397699, Stan77i/marchedegrosci#201).

PDF de stratégie et documents
- PDF de stratégie : pitch, présentation, problème et solution, marketing, chiffres sourcés, chiffres d'activité lus par `stats_publiques()` (92758c3, schéma 79, e087624, Stan77i/marchedegrosci#204).
- Mise à jour automatique des PDF chaque lundi et à chaque fusion concernée (0e48249, Stan77i/marchedegrosci#205).
- PDF de l'application : page « La livraison suivie » (e99f0bc, Stan77i/marchedegrosci#185).
- Règles du projet pour Claude (CLAUDE.md) (22ff8b3, Stan77i/marchedegrosci#203), règle sur l'audit de sécurité (efe5972, Stan77i/marchedegrosci#210), Remotion laissé de côté (e2b89a3, Stan77i/marchedegrosci#212).
- PORTAGE-SITE.md réécrit, inventaire automatique du site, règle dans CLAUDE.md (eb9ed2c, Stan77i/marchedegrosci#214).
- Compétences founder-skills et fiche FOUNDER_CONTEXT (b375242, Stan77i/marchedegrosci#216).
- Audit SEO, concurrents et plan d'acquisition, docs/seo (78b5acf, Stan77i/marchedegrosci#221).
- Rapports de reprise : docs/REPRISE.md (fcb80ca, 9b812f0, Stan77i/marchedegrosci#231) ; rapport de passation à jour (b8c580d, Stan77i/marchedegrosci#241).
- Décisions du propriétaire sur le site : vitrine pour ordinateur, construit caché (86fe3d6, 41fe090, b59d349, Stan77i/marchedegrosci#220).
- Dossier pour Claude Design ajouté (3f8dc6f, Stan77i/marchedegrosci#242) puis retiré à la demande du propriétaire (f9da4e6, d45a41f, Stan77i/marchedegrosci#243).
- Inventaire du site mis à jour automatiquement (13fe8d0).

Nouveau site public (caché, pages en noindex)
- Première pierre : accueil, carte vivante, tableau des prix, barre admin « SEO », fil public `fil_public()` (f165cda, schéma 80, Stan77i/marchedegrosci#222).
- Photos : un vrai étal, rayons du marché, photos sur la carte et le fil (4d7b0f7, Stan77i/marchedegrosci#223) ; site refait automatiquement (a509ae5).
- Liens d'intention : le site ouvre le bon écran de l'application, déjà rempli (7a2ee02, Stan77i/marchedegrosci#224).
- 12 pages produits (dce3f10, Stan77i/marchedegrosci#225), carte complète du réseau (de05406, Stan77i/marchedegrosci#226), 3 guides sourcés (2abc36a, Stan77i/marchedegrosci#227).
- « Qui sommes-nous », guides achats groupés et fournisseur, typographie française (8a65111, Stan77i/marchedegrosci#230).
- 13 pages produits de plus (25 en tout), plan du site sitemap.xml, page 404 pour tout le dépôt (cf72d73, b05cbe2) ; guide des grands marchés de gros (9e59771, Stan77i/marchedegrosci#232).
- Guide sur le transport du vivrier en gros, nombres jamais coupés en fin de ligne (19203a7, 9e229f5, Stan77i/marchedegrosci#233).
- Calendrier des récoltes sourcé, liens depuis le site, banane plantain et oignon, 12 produits de plus d'après la FAO (65d15c7, 28e4542, c4a9b22, c3bdd1f, Stan77i/marchedegrosci#234, #235, #236).
- « En ce moment » sur le calendrier, pages concombre et soja (fca247b, Stan77i/marchedegrosci#237) ; annonces cliquables, panneau adapté à l'intention (b35975d, Stan77i/marchedegrosci#238).
- Une page par district, liens depuis les calendriers, titres et descriptions à la bonne longueur (fdf865b, 38596bb, 4a9cd89, Stan77i/marchedegrosci#239).

## 22/10/2026

Début de l'historique disponible. Séquestre, maintenance du site, codes, aide et design du sac.

Séquestre, litiges, relevés (aucun paiement réel : aucun prestataire branché)
- Séquestre : libération par l'acheteur, refus avec photos confirmé par le chauffeur, commissions calculées à la libération, rien n'est prélevé (1230414, schéma 57, Stan77i/marchedegrosci#154).
- Règles du propriétaire : pas de libération automatique, l'acheteur n'annule plus, mot secret du vendeur, refus à l'arrivée, discussion à trois (6b5a806, schéma 58, Stan77i/marchedegrosci#156). Cette règle est ensuite modifiée par la libération automatique sous 24 h ci-dessous.
- Les échanges ne sont pas secrets : messages gardés 1 an, l'équipe voit la négociation (d515e70, schéma 60, Stan77i/marchedegrosci#156).
- Libération automatique 24 h après la réception sans réclamation ; refus seulement avec le mot secret du vendeur et des photos (43a8ceb, schéma 61, Stan77i/marchedegrosci#157).
- Procédure admin : traiter un litige sur preuves, PDF de 4 pages (25a2632, Stan77i/marchedegrosci#159).
- Relevé et bon PDF : tampon rouge du Marché de Gros, départ, destination, livraison (9eb8645, schéma 54, Stan77i/marchedegrosci#151).

Marché, prix, annonces
- Tableau du marché façon Binance P2P : onglet Prix, meilleur prix en haut, Acheter / Vendre (26873ad, schéma 59, Stan77i/marchedegrosci#156).
- Fil public : les ventes conclues s'ajoutent aux annonces, anonymes (bafff7c, schéma 55, Stan77i/marchedegrosci#152).
- Annonce : le nom est toujours celui du compte, imposé par le serveur (da8d9c0, schéma 56, Stan77i/marchedegrosci#153) ; « En cours » seulement quand on est connecté (d27b970).
- Vente conclue : l'annonce baisse ou disparaît, un lot vendu ne revient plus tout seul (3968041, schéma 52, Stan77i/marchedegrosci#143).
- « Tout » : un « + » par produit ouvre la publication réglée sur ce produit (3956987, Stan77i/marchedegrosci#131) ; offre = panier, demande = caddie partout (34c9910).
- Accueil : J'ai / Je cherche seulement sur l'onglet Marché (201dcdd, Stan77i/marchedegrosci#132) ; Activité avec « En cours » et « Reprendre là où vous en étiez » (90742fb, Stan77i/marchedegrosci#133).
- Exigences dans les demandes « Je cherche » (94debce, schéma 47, Stan77i/marchedegrosci#135).
- Roue de l'accueil : bulle d'activité de 5 s avec chiffres réels du serveur (b61e5be, schéma 53, Stan77i/marchedegrosci#146).
- Bandeau de l'accueil : garanties et fonctions utiles (4cf0eda, Stan77i/marchedegrosci#147).
- Catalogue : 7 produits reçoivent leur photo (273b175, Stan77i/marchedegrosci#164) ; 8 nouveaux produits avec photo, crevettes et anchois séchés, 6 surgelés (77ca3cf, Stan77i/marchedegrosci#165).

Transport et codes
- Transport inclus ou non, pas de transporteur du réseau quand le vendeur livre, lien de suivi pour son propre chauffeur (4c468ed, schéma 48, Stan77i/marchedegrosci#136).
- Transport négocié dans chaque proposition (0d246fe, schéma 49, Stan77i/marchedegrosci#137).
- Codes : « Gardez bien ce code », « Mes codes » dans Alertes, pas de commission transport quand le transport est inclus (9b615f2, schéma 50, Stan77i/marchedegrosci#140) ; le chauffeur demande le code dans l'application (90a26b4, schéma 51, Stan77i/marchedegrosci#141).
- « Suivre la commande » ne se ferme plus tout seul ; transporteur du réseau en pause, « Bientôt » (25c8215, schéma 62, Stan77i/marchedegrosci#169).
- Arrivée du camion (repère, « Arrivé », « Colis livré »), onglet Prix lisible en mode sombre (ca18041, 4607127, Stan77i/marchedegrosci#160).

Notifications, aide, tutoriels
- Notifications : comptes sans profil inclus (schéma 46), alerte à chaque notification sur iPhone (fa18672, Stan77i/marchedegrosci#134).
- Activité : retirer un élément en le glissant, « Tout effacer », « Annuler » (dbbc582, Stan77i/marchedegrosci#139).
- Astuces et petits tutoriels pour les nouveaux, avec réglage pour les couper (c1e6457) ; un tutoriel à l'entrée de chaque écran du menu (96914cf, Stan77i/marchedegrosci#161).
- Aide : tutoriels insistants et « Comment ça marche » à jour (723fc0e) ; 76 questions-réponses pendant la frappe puis « Je veux parler à une personne » (3d23f48, Stan77i/marchedegrosci#166) ; aide toujours visible dans la conversation (fd3f9f0, Stan77i/marchedegrosci#167).
- La cloche se calme une fois touchée (4a6af9e, Stan77i/marchedegrosci#168).
- PDF : mises à jour du 22 octobre point par point (46d5c2d, Stan77i/marchedegrosci#158).

Site en maintenance et accès administrateur
- Site web en maintenance : tout le monde va vers l'application, entrée secrète de l'administrateur vérifiée par le serveur (6e8e27b, Stan77i/marchedegrosci#145) ; connexion réservée à l'admin, sans création de compte (db60b12).
- Sur ordinateur : l'application ne s'ouvre que pour l'admin, QR code pour les visiteurs, barre admin Mobile / Site (f7da6dc, Stan77i/marchedegrosci#148).
- Point jaune de l'admin repérable sur la page de maintenance (1c3d5b2, Stan77i/marchedegrosci#149) ; l'interrupteur ne rebondit plus vers la maintenance (de11353, Stan77i/marchedegrosci#150).

Démarrage, nom, design
- Écran d'ouverture : ne reste plus bloqué si un fichier manque (96c99c1, Stan77i/marchedegrosci#142).
- Nom de l'application : « Marché de Gros » au lieu de « MGCI » (04a0506, Stan77i/marchedegrosci#163) ; barre du haut libérée, accroches dans la bande (544164f, Stan77i/marchedegrosci#162).
- Le sac devient l'unique héros, notifications refaites (e056b25, Stan77i/marchedegrosci#170) ; design mûr, sombre corrigé (31b0810, Stan77i/marchedegrosci#171) ; cartes, formulaires, sons (906d0c6, 6148efc, Stan77i/marchedegrosci#172) ; onglets de l'accueil, audit des écrans (7e6fdaa, Stan77i/marchedegrosci#173).
- Plus de bande blanche en bas d'Approvisionnement pro (fa889df, Stan77i/marchedegrosci#129).

## 21/10/2026

Journée de construction du fonctionnement complet : commandes, transporteurs, GPS, réputation, achats groupés, approvisionnement pro, puis refonte visuelle de l'accueil et mode nuit. Aucun paiement réel : les commissions décrites sont des registres côté serveur.

Commandes, transport et suivi
- Passation : règles de travail, pièges techniques, état complet, décisions en attente et suite logique (fe2ec4a, Stan77i/marchedegrosci#82).
- Schéma 25 : trous de l'audit bouchés (9e49657, Stan77i/marchedegrosci#83).
- Commandes : suivi de l'accord à la réception (5b1a78a, schéma 26, Stan77i/marchedegrosci#84).
- Transporteurs : inscription, vérification, missions, espace chauffeur et vues admin (5aafa3b, schéma 27, Stan77i/marchedegrosci#85).
- Codes à usage unique : prise en charge, transfert entre chauffeurs, réception (7b312cf, schéma 28, Stan77i/marchedegrosci#86).
- GPS : partage de position du chauffeur, carte de suivi et itinéraire (bab54ba, schéma 29, Stan77i/marchedegrosci#87), design d'application de course (8600e50, Stan77i/marchedegrosci#88), trois correctifs (efc33e3, Stan77i/marchedegrosci#91).
- Finitions : contrastes, focus, coupures réseau, arrivée du chauffeur (ba40f94, Stan77i/marchedegrosci#89) ; purge des positions installée (5161ec9, Stan77i/marchedegrosci#90).
- Commission de 3,5 % : registre côté serveur, journal, vue admin (ed21944, Stan77i/marchedegrosci#92). Commission transport de 6,9 % : prix fixé par le chauffeur, registre, total affiché pour la livraison (e9cd864, schéma 42). Ce sont des calculs enregistrés, rien n'est prélevé.

Marché, réputation et achats
- Prix par zone : fonction serveur `prix_zones` et feuille « Par zone et tendance » (a0d909b, Stan77i/marchedegrosci#93).
- Réputation : avis après commande terminée, réputation vendeur et acheteur, fidélité (3aa9d9b).
- Racheter : prix du jour, sélection de plusieurs produits, rappels d'achat (615883a, Stan77i/marchedegrosci#95) ; une seule négociation ouverte à la fois sur la même annonce (6bc4324, Stan77i/marchedegrosci#98).
- Approvisionnement pro : besoins multi-produits, propositions avec stock et délai, comparaison (8318be0, Stan77i/marchedegrosci#96).
- Achats groupés : paliers, confirmations individuelles, commandes par participant, notifications (84cb140, Stan77i/marchedegrosci#97).
- Minimum de vente fixé par le vendeur (4704673, schéma 37, Stan77i/marchedegrosci#99).
- Besoins pro : exigences à cocher (d65132d, schéma 38, Stan77i/marchedegrosci#100), puis détaillées avec volumes en tonnes ou litres, qualité, conditionnement et livraison (fa3f670, schéma 40, Stan77i/marchedegrosci#102).
- Badges Coopérative et Marché vérifiés par l'équipe (c55c636, schéma 39, Stan77i/marchedegrosci#101).
- Notifications : achat groupé ouvert, nouvel acheteur, besoin pro envoyé aux vendeurs du produit (2b85d10, schéma 41).
- Catalogue : 19 produits (poissons, volailles, œufs) reçoivent leur photo (2062e5c, Stan77i/marchedegrosci#115).

Design
- Une seule police partout : Jost (8fced59, Stan77i/marchedegrosci#103).
- Connexion sans message bleu dans le bouton, notifications translucides (ce54309, Stan77i/marchedegrosci#104) ; menu « … » des conversations lisible (5e4b655, Stan77i/marchedegrosci#105).
- Accueil clair : en-tête, onglets Marché, Activité, Alertes, sélecteur orbital dans une carte (c90c606, Stan77i/marchedegrosci#106) ; effets d'arrivée (c038d7b, Stan77i/marchedegrosci#107) ; cloche animée et en-tête avec le sac dans le rond (67a25f3, ee7381d, Stan77i/marchedegrosci#108).
- Menu latéral clair avec icônes Lucide (f9337de, Stan77i/marchedegrosci#109) ; Mon compte allégé et réglage du thème clair, sombre ou comme le téléphone (85d93ea, Stan77i/marchedegrosci#110).
- « de Gros » toujours jaune maïs, y compris sur fond clair (d7d46ce, Stan77i/marchedegrosci#111).
- Carte : la forte demande ne cache plus les villes, « Compatibles » devient un vrai filtre (46b7159, Stan77i/marchedegrosci#112).
- Barre jaune tracée à chaque retour à l'écran, urgences en tampons animés (06fb50e, Stan77i/marchedegrosci#113) ; le texte des tampons passe à la ligne (21d0938, Stan77i/marchedegrosci#117).
- Mode nuit sur toute l'application (3d6903a, 2461f44) ; notifications écrites comme sur le site (585141f, Stan77i/marchedegrosci#116).

## 19/10/2026

Notifications en « îlot », sac mascotte, filtres de contenu, identité des structures, relevés et garanties.

- Notifications refaites : l'îlot, une seule pastille vivante qui regroupe et propose le bon geste (a8163cf, Stan77i/marchedegrosci#72) ; phrases longues découpées en titre et explication, accueil personnalisé après la connexion (ab5ecc8, Stan77i/marchedegrosci#78).
- Le sac devient le personnage de l'application : plein et content, vide et patient, endormi sans réseau (18f7802, Stan77i/marchedegrosci#69) ; présent partout : chargement de la carte, notifications, attentes et listes vides (68f8043, Stan77i/marchedegrosci#71).
- Rapport de ce que l'application a et que le site n'a pas encore (28f385c, a067170, Stan77i/marchedegrosci#70).
- Textes des membres : liens et hameçonnage refusés (bad2726, Stan77i/marchedegrosci#67), numéros de téléphone refusés (4f4866c, Stan77i/marchedegrosci#68), réseaux sociaux refusés même abrégés (1fff92e). L'administrateur est exempté.
- Correctif : les messages, propositions et avis repartent, plus de message technique brut à l'écran (31ed376, Stan77i/marchedegrosci#75).
- La voix du logo : titres en Archivo dans toute l'application (bfd759b, Stan77i/marchedegrosci#74).
- Audit XIAS : langue et titre, listes nommées, cibles tactiles, focus clavier, contrastes (5a81823, Stan77i/marchedegrosci#73).
- Mes ventes et achats : historique, relevés PDF et CSV, bons de transaction, profil public en volumes seulement, architecture du séquestre (7dfbb68, Stan77i/marchedegrosci#77).
- Garanties dites au bon moment : bande de l'accueil, feuille « Pourquoi le Marché de Gros », rappels (ee56310, Stan77i/marchedegrosci#76).
- Profils et crédibilité : la structure représentée (coopérative, groupement, entreprise), son logo et ses preuves (f1184ee, Stan77i/marchedegrosci#80).
- Accueil : le sélecteur de familles et la roue remontent, boutons J'ai / Je cherche entiers (d55669f, Stan77i/marchedegrosci#81).
- Administration : dossiers d'identité avec notification, résumé du matin, compteur et mode rapide (6446a1e, 947f051, Stan77i/marchedegrosci#63) ; tableau de bord épuré (a437f9e, Stan77i/marchedegrosci#64) ; compte admin « Marché de Gros » officiel avec badge Officiel (387d028, Stan77i/marchedegrosci#65) ; retour du tableau de bord vers l'application (e2d216f).
- Mon compte de l'administrateur ne plante plus ; permis sans date de fin ; photo des corossols retirée et synonymes kplala (a01dc63, da5c3ac, Stan77i/marchedegrosci#66).
- Bouton « Publier » lisible sur la feuille J'ai / Je cherche, contraste vérifié sur 20 écrans (b9c7779, Stan77i/marchedegrosci#62).

## 18/10/2026

Nouveau logo, vérification d'identité, confiance, catalogue de 74 images, pages du marché.

- Écran d'ouverture : le logo MG se dessine, le logo respire pendant le chargement de la carte (573eed0) ; plus tard « le sac qui se remplit » (e896217, Stan77i/marchedegrosci#48).
- Étiquette « quand » : pastille colorée selon l'urgence (506878c).
- Vérification d'identité : script SQL (67c7e97), parcours, badge, onglet admin, lecture MRZ dans le téléphone (17a02ab, Stan77i/marchedegrosci#42), lecture fiable de la CNI ivoirienne (ecd91b2, Stan77i/marchedegrosci#43). Pièces expirées refusées, dossiers gardés 5 ans avec registre (ba6da63, Stan77i/marchedegrosci#47).
- Logo « Étal vert » : le nom écrit partout (51c1acf, Stan77i/marchedegrosci#44) ; un seul logo partout, plus d'ancien M (ce97c6b, Stan77i/marchedegrosci#49), icône sur deux lignes (e52c0b0, Stan77i/marchedegrosci#61).
- Confiance : 3 annonces gratuites puis identité vérifiée, bannissement à vie (8979277, Stan77i/marchedegrosci#45) ; signaler une personne, filtre Vérifiés, rappel avant de payer, purge des dossiers abandonnés (5fb6d74, Stan77i/marchedegrosci#46) ; signalement avec preuves (37982fa, Stan77i/marchedegrosci#57).
- Statuts des comptes partout : vérifié, vendeur de confiance, acheteur sérieux, répond vite, actif, nouveau (22c49ea, Stan77i/marchedegrosci#50).
- Catégories refaites (ee4aa83, Stan77i/marchedegrosci#51), prix du marché refait (38da294), année du marché (c681736, Stan77i/marchedegrosci#53), les pages réunies dans Stan77i/marchedegrosci#52, notes de mise à jour (fdb234c, Stan77i/marchedegrosci#54).
- Plus de page blanche à l'ouverture, messages après une action refaits avec un son (88643cf, Stan77i/marchedegrosci#55).
- Guide « Comment ça marche » (fc2ec3f, Stan77i/marchedegrosci#56).
- Boutons et accents aux couleurs du logo : vert forêt sur pages claires (17674aa, Stan77i/marchedegrosci#58).
- Chasse aux bugs : textes illisibles, nom coupé à 320 px, pied collant de « Proposer un prix » (4b8a812, 9ea64db, Stan77i/marchedegrosci#59).
- Catalogue : 74 images de produits, 28 nouveaux produits, famille « Viandes et abats » (b3fb1c8, Stan77i/marchedegrosci#60).
- Dossiers de travail temporaires retirés du dépôt et ignorés (2bed20c, 572be9a).

## 17/10/2026

Refonte de la carte (relief, hors connexion), de Mon compte et des icônes, messagerie officielle.

- Comptes séparés sur un téléphone, contact dans l'application, région et ville reliées (8877ae8, Stan77i/marchedegrosci#21 ; b7174a0).
- Messages : écrire au Marché de Gros, messages officiels, message à tous, échanges contrôlés (fe6c905, Stan77i/marchedegrosci#22).
- Carte plein écran, forte demande, Acheter : tout voir (dc9a676, Stan77i/marchedegrosci#23) ; stock qui baisse à chaque vente, alertes par produit, profil public (bca7ece, Stan77i/marchedegrosci#24).
- Refonte en trois temps : variables de design et lisibilité (28fee6f, Stan77i/marchedegrosci#25), carte d'annonce commune (5b48013, Stan77i/marchedegrosci#26), carte et liste reliées, recherche toutes villes (e7c8c4d, Stan77i/marchedegrosci#27).
- Carte en relief MapLibre, embarquée hors connexion, itinéraire en ligne (8cd98ab, Stan77i/marchedegrosci#28) ; plus tard quartiers, rues, bâtiments, lieux utiles, zoom niveau rue (813bda0, Stan77i/marchedegrosci#38) et attente propre (a346667, Stan77i/marchedegrosci#40).
- Icônes Lucide par sens, familles avec compteurs (7cd6760, Stan77i/marchedegrosci#29) ; un seul jeu d'icônes partout (637d29c, Stan77i/marchedegrosci#31).
- J'ai / Je cherche en deux boutons séparés (a30b446, Stan77i/marchedegrosci#30).
- Finitions : une seule croix centrée, audit complet (297649a, Stan77i/marchedegrosci#32).
- Mon compte refait (d4461a3, Stan77i/marchedegrosci#33), en-tête vivant et papier clair (f9157a0, Stan77i/marchedegrosci#34), fenêtres sur papier clair (54b2d46, Stan77i/marchedegrosci#35).
- Démarrage deux fois plus rapide (3cbab06, Stan77i/marchedegrosci#36).
- Sons refaits, vignettes pour les produits sans photo (d6fd2be, Stan77i/marchedegrosci#39).

## 12/10/2026

Ambiance de l'application : transitions, notifications hors application, messagerie directe.

- Phrases « Vous êtes connecté… » dans la barre, J'ai / Je cherche à la couleur du produit (760aa5d).
- Essais de halo et d'ondes quand la roue s'arrête, puis halo retiré et point « offre » qui scintille comme une luciole (65c762e, b6252bc, 49b0fe7).
- Marché flouté derrière la roue, transition « Vous êtes dans le marché » (0671eb1, Stan77i/marchedegrosci#17).
- « Se déconnecter » en bas du tiroir avec sa porte animée, voile plus sombre derrière le tiroir (e5de2d9, f32c2b6, Stan77i/marchedegrosci#18).
- Loupe et phrases plus courtes dans la barre, chargeur du site (1fb60c5) ; offres qui scintillent partout (a4771c3).
- J'ai / Je cherche en une capsule à deux parties, notifications sur le téléphone même application fermée (Web Push) avec chiffre sur l'icône (6873161, dbdbac0, 5d72af5, Stan77i/marchedegrosci#19).
- Étoiles, signalements avec raison, négociations supprimables par glissement, Sécurité refaite (a8ba206) ; messagerie directe, messages effacés après 7 jours (11b48fe, Stan77i/marchedegrosci#20).

## 11/10/2026

Début de l'application sur Supabase : hors connexion, comptes, annonces partagées, négociation.

- Application utilisable hors connexion (PWA : vendor, polices locales, manifest, service worker), console propre (e487deb, fd74048) ; ouverture hors connexion sur tous les appareils (1b2867f, Stan77i/marchedegrosci#1).
- Logo MG, icônes, application fixe contre l'étirement (79009e1, Stan77i/marchedegrosci#2).
- Site sur ordinateur et tablette, application sur téléphone, tous deux hors connexion (1cf84d8, Stan77i/marchedegrosci#3).
- Carte du site : territoire réel, voisins, fleuves et lacs, zoom (2f93cc4, Stan77i/marchedegrosci#4) ; deux captures de test retirées (0704fa1) ; pages lisibles au défilement (9038202).
- Prix du marché : ce qui a un prix d'abord, ce qui manque pour un prix du marché (cc4affe, Stan77i/marchedegrosci#5).
- Accueil : où le produit est proposé et cherché sur le vrai territoire (76807f4, Stan77i/marchedegrosci#6) ; fiche produit : offres et carte se répondent (c0f824a, Stan77i/marchedegrosci#7).
- Annonces partagées : comptes, envoi et lecture via Supabase, signalements (9f98d67, Stan77i/marchedegrosci#8) ; base installée, durcissement recopié dans schema.sql (fde0102, Stan77i/marchedegrosci#9).
- Négocier un prix, code de secours, tableau de bord administrateur (770232b) ; négociation complète, langage sonore (d401b3e, Stan77i/marchedegrosci#10).
- Compte complet (profil, avatars, Mon espace) et système micro-UX (5e953c6, Stan77i/marchedegrosci#11).
- Mise à jour du 12 octobre : connexion immersive, en-tête, avatar avec photo, proposer un prix, carte plein cadre (079d11b, Stan77i/marchedegrosci#12).
- Correctifs : enregistrement de l'avatar, défilement des fenêtres (71d96fe) ; une proposition retirée n'est plus « en cours » (f6ace72).
- Création de compte : prénom, nom et pseudonyme (3086ef0, cfac6f8, 012ff19) ; illustration de la porte du marché sur téléphone (8b9f63a, c8f126c) ; ambiance de la porte (72bfeed, Stan77i/marchedegrosci#13).
- Lien Tableau de bord pour l'administrateur, mises à jour de l'application installée sans recréer l'icône (7e11af4, 5617267, Stan77i/marchedegrosci#14).
- Fenêtres au-dessus du clavier, onglets de Mon compte visibles, avatar enregistré sans dépendre du droit sur user_id (12484ed, d4a26bb, 037c8e8, Stan77i/marchedegrosci#15).
- Barre du haut façon Gmail et menu en tiroir (e05ce2e, 97b8e2b, Stan77i/marchedegrosci#16).

## 10/10/2026

Remplacement du projet par la version « app-mobile » : ajout de l'application `application.dc.html`, de `app/marche-app.js` et de `MISE-A-JOUR.md`, retrait de l'ancien `index-v3.html` (8faa617, e5f13d4, 6282525). Quelques fichiers d'ancien contenu supprimés (d32c5ec, f1af30e, 6f55d4f, b1b1cde) et ajoutés par envoi de fichiers (cb13a72).

## 04/10/2026

Neuf commits d'envoi et de suppression de fichiers, sans message détaillé : suppression puis renvoi de `index.html`, du dossier `v2` et du dossier `css` (88ed4e6, 063d0d3, 887d5bb, 88c8386, a98da01, 2b01a5f, b0e4103, 3253c60, 6cdcf52).

## 03/10/2026

Premier jour de l'historique : premier commit (852d810), puis envois de fichiers répétés pour le site de départ (`index.html`, `css/styles.css`, `v2/data.js` et des photos de produits `v2/img/produit-*.webp`) : 852d810, ffbe3a4, f3f3724, c86f244, 18430dc, 89c4c38, f27377d, 4ff405c, d44ea55.
