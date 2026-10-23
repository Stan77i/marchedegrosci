# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Application : `application.dc.html` (gabarit dc-runtime, React servi par `support.js`), hébergée sur GitHub Pages, serveur Supabase (plan gratuit). Nouveau site public (23/10/2026, choix du propriétaire) : **pages HTML statiques** fabriquées par un script Node sans dépendance (`tools/site-public.js`) et refaites par une tâche GitHub ; lisibles sans JavaScript ; données en direct chargées après l'affichage.

## Users

- **Vendeurs** : producteurs, coopératives, grossistes, commerçantes du vivrier en Côte d'Ivoire, qui cherchent des acheteurs pour leur récolte ou leur stock.
- **Acheteurs** : grossistes, détaillants, et les professionnels (restaurants, maquis, cantines, hôtels, commerces) qui doivent s'approvisionner régulièrement.
- **Transporteurs** : chauffeurs qui livrent les commandes (suivi par un simple lien).
- Le site (ordinateur) doit convaincre **les vendeurs et les acheteurs à égalité** (choix du propriétaire) ; il les amène à installer l'application sur leur téléphone. Sur téléphone, tout se passe dans l'application.

## Product Purpose

Le marché de gros du vivrier ivoirien, dans le téléphone : vendeurs et acheteurs se trouvent, comparent les prix, négocient et suivent la livraison au même endroit. Le site est la vitrine et l'outil d'acquisition (SEO, marketing, communication) ; l'application est l'outil pour agir. Réussite : des visiteurs venus de la recherche qui installent l'application et publient une offre ou une demande.

## Positioning

Une application privée et indépendante (ni le marché de gros physique de Bouaké, ni l'OCPV, ni l'État) qui remplace le bouche-à-oreille et les groupes Facebook par : annonces gratuites « J'ai / Je cherche » partout dans le pays, tableau des meilleurs prix par produit et par zone, négociation sans numéro visible, commande au prix et à la quantité figés, camion suivi par un lien, mot secret à la réception, 24 h pour réclamer, identité vérifiée, achats groupés, approvisionnement pro.

## Operating Context

Téléphones Android d'entrée de gamme, connexions mobiles faibles ou coupées ; marchés vivriers (Adjamé « Gouro », Bouaké…), zones de production, transport en camion. Unités du terrain : sac, carton, tas, régime, tonne, kg. Français simple ; prix en francs CFA (F).

## Capabilities and Constraints

- En place dans l'application : offres et demandes, tableau des prix, prix par zone, négociation, commandes en 8 étapes, mot secret, litige arbitré, identité vérifiée, signalements, approvisionnement pro, achats groupés, Racheter, alertes, notifications, carte du réseau.
- **Aucun paiement n'est branché** : ne jamais écrire « PAYÉ » ni laisser croire qu'un argent est encaissé. Commissions prévues : 3,5 % sur la vente, 6,9 % sur le transport du réseau.
- Pas de budget : aucune solution payante. Hébergement statique (GitHub Pages), pas de serveur.
- Pas encore sur le Play Store ni l'App Store : installation par le navigateur (application web).
- Vie privée sur le site public : prénom + initiale, ville, produit, quantité ; jamais de numéro ni de nom complet.

## Brand Commitments

- Nom : « Marché de Gros CI » (« marché de Gros », « de Gros » en maïs `#F2C230`). Toujours avec « CI » ou un descripteur en ligne (« marché de gros » seul désigne les marchés physiques de l'État).
- Une seule police : Jost. Personnages du marché (produits avec un visage) et le sac de jute. Panier = offre, caddie = demande. La tomate est montrée en carton.
- Voix : français simple, phrases courtes, direct et respectueux.
- Système visuel complet : `DESIGN.md`.

## Evidence on Hand

- Photos réelles de 145 produits (`v2/img/produit-*.webp`), logos (`logo/`), personnages (`v3/personnages.js`), le sac (`app/sac.js`).
- Chiffres du marché sourcés : `strategie/sources/donnees-marche.json`. Activité réelle : `stats_publiques()`.
- **Aucun témoignage, aucun client nommé, aucune presse** à ce jour : ne rien inventer. Les producteurs et offres de `v2/data.js` marqués `isExample` sont des exemples, jamais à présenter comme réels.

## Product Principles

1. Rien d'inventé : chaque chiffre, prix ou avis vient de données réelles ou d'une source citée.
2. Le site explique et attire ; l'application permet d'agir. Chaque page mène à l'action précise qui lui correspond.
3. Simple pour quelqu'un qui n'a jamais utilisé une place de marché en ligne.
4. Rapide sur un téléphone modeste et une connexion faible.
5. La confiance avant la vitesse : numéro caché, prix figé, preuves.

## Accessibility & Inclusion

Contraste AA minimum, cibles de 44 px, texte jamais sous 11,5 px, zoom autorisé sur le site, `prefers-reduced-motion` respecté. Lecteurs peu à l'aise avec l'écrit : verbes d'action, icônes dessinées en appui du texte.
