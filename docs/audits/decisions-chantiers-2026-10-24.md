# Décisions à prendre pour les 4 chantiers (24/10/2026)

Chaque question vient de l'audit (`docs/audits/audit-chantiers-2026-10-24.md`). La réponse **recommandée** est écrite après la flèche. Le propriétaire répond « OK » ou change les numéros qu'il veut. Tant qu'une décision n'est pas validée, rien n'est construit.

Les chiffres (seuils, durées) sont des **valeurs de départ réglables** par l'administrateur, sans toucher au code. Ils ne viennent d'aucune étude : ils sont à ajuster quand il y aura de l'activité.

## À corriger avant tout (sécurité)

- **C1. Commission de 6,9 % ouverte à tous.** Aujourd'hui, un acheteur ou un vendeur peut, par un appel direct au serveur, faire accepter une mission par n'importe quel membre inscrit comme transporteur (même non vérifié). Une commission transport de 6,9 % est alors enregistrée hors du service MGCI. Il n'y a encore aucune mission en production. → Fermer ce chemin : seule une mission du service MGCI, avec un transporteur vérifié, crée une commission transport.
- **C2. Droits trop larges sur la table `alertes`.** Les visiteurs et les membres ont des droits techniques inutiles (dont TRUNCATE). L'application ne permet pas de s'en servir, mais ces droits passent outre les protections. → Retirer ces droits (`revoke`, aucune donnée touchée). Demande l'accord du propriétaire.

## Chantier 1 : commande et transport

1. Même ville : l'acheteur peut-il encore venir chercher lui-même ? → Oui, comme « retrait par l'acheteur », seulement si le vendeur l'accepte. Par défaut, le vendeur organise son livreur.
2. Comment savoir que c'est la même ville ? → Par la ville choisie dans la liste (ville de l'annonce et ville de livraison). C'est simple et clair pour tout le monde.
3. Quand rouvrir le transporteur MGCI ? → Pas tout de suite. On construit la négociation à trois, mais elle reste fermée tant qu'il n'y a pas au moins 3 transporteurs vérifiés. Le propriétaire décide l'ouverture.
4. Seuls les transporteurs vérifiés peuvent accepter une mission ? → Oui.
5. Négociation à trois : qui propose en premier ? → Le transporteur propose son prix. L'acheteur et le vendeur acceptent, refusent ou contre-proposent. Délai de 48 h, comme aujourd'hui.
6. Si quelqu'un refuse le prix du transporteur MGCI ? → La commande continue, avec le livreur du vendeur. Elle n'est pas annulée.
7. La commission de 6,9 % ? → Retenue sur le prix du transporteur (comme prévu aujourd'hui). L'acheteur voit un seul prix de transport.
8. Après un changement de chauffeur en route ? → Le prix convenu ne change pas.
9. Messages privés entre le transporteur et les parties pendant une mission ? → Interdits. Le transporteur négocie par propositions de prix seulement.
10. Villes différentes, transport à part : quand le vendeur donne-t-il son prix ? → Pendant la négociation, dans la même proposition que le prix de la marchandise.

## Chantier 2 : fiabilité et pénalités d'annulation

11. Motifs d'annulation ? → Stock épuisé, prix changé, l'autre partie ne répond pas, erreur de saisie, panne ou météo, autre (avec un mot obligatoire).
12. Qui décide qu'une annulation est abusive ? → Une règle automatique pour les cas clairs (annuler seul une commande déjà confirmée, sans motif accepté). L'administrateur peut toujours changer la catégorie, surtout après une contestation.
13. Le refus ou le retrait avant confirmation comptent-ils ? → Non.
14. Une commande sans réponse ? → Elle expire après 48 h et ne compte contre personne.
15. Suspension ? → Toujours décidée par l'administrateur : 7 jours la première fois, 30 jours en cas de récidive. Les annonces sont cachées pendant la suspension.
16. Un membre suspendu peut-il finir ses commandes en cours ? → Oui.
17. Le score est-il public ? → Oui, en une ligne simple (« Fiabilité : 96 % sur 25 commandes »). Le détail n'est visible que par le membre lui-même.
18. Les avertissements sont-ils visibles par les autres ? → Non.
19. Contestation ? → Possible pendant 7 jours. L'équipe répond en 7 jours au plus.
20. Rétroactif ? → Non. Le comptage commence à la mise en service.
21. Achat groupé annulé ? → Il compte une seule fois.

## Chantier 3 : badges

22. Seuils de départ (sur 12 mois glissants, commandes terminées seulement) :
    - Vendeur fiable : 3 commandes, au plus 10 % d'annulations abusives.
    - Bon vendeur : 10 commandes sur au moins 3 mois différents, au plus 7 %.
    - Excellent vendeur : 30 commandes sur 6 mois, au plus 5 %, note moyenne d'au moins 4,5.
    - Grand vendeur : 100 commandes sur 9 mois, au plus 3 %, au moins 25 millions F CFA.
    - Mêmes paliers pour les acheteurs : Acheteur fiable, Bon, Excellent, Grand acheteur.
    → À valider ou changer. Réglables ensuite par l'administrateur.
23. Le volume se compte en F CFA ou en tonnes ? → En F CFA (le prix convenu), plus simple.
24. Période glissante ? → 12 mois.
25. Grâce avant de perdre un niveau ? → 30 jours, avec un message au membre.
26. « Acheteur en gros » ? → Un badge à part, à côté du niveau : au moins 5 commandes de 500 000 F CFA ou plus sur 12 mois.
27. Annulation légitime ? → D'un commun accord, avant confirmation, ou force majeure validée par l'administrateur.
28. Litige tranché moitié-moitié ? → Ne compte contre personne.
29. Hauts niveaux : faut-il des commandes validées par code ? → Oui pour Excellent et Grand. Et au plus 5 commandes comptées avec le même partenaire, pour éviter les faux échanges entre deux comptes.
30. Les puces actuelles ? → On garde « Répond vite », « Actif » et « Nouveau membre ». « Vendeur de confiance », « Acheteur sérieux » et « Fiable » sont remplacés par les nouveaux niveaux.
31. Notifications ? → Oui : quand on monte, quand on entre en grâce, quand on descend.
32. Qui traite une contestation de badge ? → L'administrateur, en 7 jours au plus.
33. Identité vérifiée obligatoire ? → Oui pour Excellent et Grand.

## Chantier 4 : boutiques, liens et QR codes

34. Adresse de la boutique ? → Le pseudo s'il existe, sinon un code court automatique.
35. Boutique ouverte pour tous les vendeurs ? → Le vendeur l'active d'un geste.
36. « Stock faible » ? → Quand il reste 20 % ou moins de la quantité de départ.
37. « Retirer » une annonce ? → Elle est cachée, mais une trace est gardée (plus d'effacement).
38. Pause (« Indisponible pour l'instant ») ? → Oui. Les négociations déjà ouvertes restent ouvertes.
39. Quantité obligatoire pour publier ? → Oui (aujourd'hui, une offre sans quantité est vendue en entier au premier accord).
40. Aperçu sur WhatsApp et Facebook ? → Une page par boutique fabriquée sur le site, en `noindex` tant que le site est caché, mise à jour par la tâche automatique GitHub (gratuite).
41. Sur ordinateur ? → La page de maintenance montre le nom de la boutique et un QR code pour l'ouvrir sur le téléphone.
42. Le vendeur voit-il ses visites ? → Oui, des totaux seulement (aucune information sur les visiteurs).
43. Un visiteur sans compte voit-il l'historique du vendeur ? → Il voit les totaux (ventes réalisées, fiabilité), pas le détail.
44. Suppression d'un compte ? → Ses annonces sont cachées et gardées sans nom, pour garder la trace des commandes.

## Ordre de construction proposé

1. Correctifs C1 et C2 (petite PR, tout de suite après accord).
2. Chantier 1 (transport), car il touche la négociation que les autres réutilisent.
3. Chantier 2 (fiabilité).
4. Chantier 3 (badges), qui lit les annulations du chantier 2.
5. Chantier 4 (boutiques), qui affiche le badge et la fiabilité.

Une PR par chantier, testée sur le projet de test avant la production.
