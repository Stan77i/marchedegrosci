# Équipe D : transport, argent et textes (branche `claude/transport-textes`, schéma 95)

## 1. Ce qui a été fait

### Serveur (schéma 95, `supabase/schema-95-transport-regles.sql`) : appliqué sur le TEST seulement
- `_seq_repartition` : 6,9 % seulement si mode « reseau » ET transporteur vérifié ; transport « à part » (`transport_regle = 'a_part'`, `prix_transport`) ajouté au total et versé au vendeur sans commission (nouvelles clés `transport_a_part`, `vendeur_transport`, `transport_reseau`, `taux_transport`, `non_du`) ; le total suit `total_convenu`.
- `chauffeur_missions` : `taux`, `commission`, `net` à 0 hors service réseau ; nouvelle clé `reseau`.
- `admin_affecter` : refusé si le service est fermé (`_transport_reseau_ouvert()`) ou si la commande n'est pas en mode « reseau ».
- `admin_transport_reseau(true)` : refusé sous 3 transporteurs vérifiés (seuil `reglages.transport_reseau_min`, jamais moins de 3 ; nouvelle fonction interne `_transport_reseau_min()`, non exécutable par les membres).
- `commande_liberer`, `admin_liberer` : messages « clôturer la commande » au lieu de « libérer le paiement » (le journal écrit « Commande clôturée par l'équipe »).
- Tests : `supabase/tests/transport-95-scenarios.sql` (annulés). Résultat exact sur le test :
  `1.ferme=REFUS(Le service transport Marché de Gros n'est pas encore ouvert : l'équipe n'affecte pas de transporteur.) | 6.seuil20=REFUS(Il faut au moins 20 transporteurs vérifiés pour ouvrir le service (aujourd'hui : 15).) | 6.seuil1(plancher 3)=true | 2.mode_vendeur=REFUS(Cette commande n'a pas choisi le transporteur du Marché de Gros : le transport reste organisé par le vendeur ou l'acheteur.) | 3.reseau=proposee rep=ERR(Proposez votre prix : la mission démarre quand l'acheteur et le vendeur l'ont accepté.) registre=prevue:3450 chauffeur(reseau): taux=0.069 com=3450 net=46550 repart: total=320000 tk=3450 marche=12900 | 4.vendeur repart: total=320000 tk=0 net=50000 marche=9450 registre=0 chauffeur: taux=0 com=0 net=50000 | 5.a_part: total=300000 convenu=300000 vendeur_net=290550 (brut 270000 - 9450 + 30000) tk=0 | 7.arrondis: marchandise 12345, transport 7246, total 19591, vendeur_brut 10345, vendeur_commission 362, vendeur_net 9983, transporteur_commission 500, transporteur_net 6746, acheteur_rembourse 2000, marche 862, somme_parts=19591 | 8.cloture_en_cours=La commande se clôture après la réception. | autre=Seul l'acheteur peut clôturer la commande.`
  (« rep=ERR » est normal : en mode réseau, le prix se convient à trois ; le test pose ensuite l'accord à 50 000 F.)
- Tests d'audit rejoués : Test 1 (admin_affecter service fermé → était « proposee », maintenant refusé ; livreur du vendeur → était 3 450 F de commission, maintenant 0) ; Test 2 (à part : était 270 000, maintenant 300 000 = total_convenu).
- Vérifié après les tests : rien n'est resté (`transport_reseau_min` absent, service toujours fermé, aucune mission créée, commande de test toujours en mode vendeur).

### Textes du front (11 fichiers)
`v3/aide.js`, `v3/guide.js`, `v3/astuces.js`, `app/garanties.js`, `v3/souffle.js`, `v3/acheter.js`, `v3/tableau.js`, `v3/commandes.js` (textes, plus la ligne « Qui paie » du transport et le transport à part dans « Qui paie quoi »), `v3/chauffeur.js`, `v3/admin-transport.js`, `application.dc.html`. `?v=20261126td` dans `application.dc.html`, `admin.html`, `index-v3.html` ; `sw.js` : `mgci-v284`.
Les modèles `strategie/sources/*.html` ont été relus : rien de faux (transport « en pause », 6,9 % « du réseau Marché de Gros », « pas de promesse de paiement sécurisé ») ; non modifiés, PDF non refaits.

Captures (iPhone 13, sombre et clair, serveur simulé, sans compte réel) : `/tmp/claude-0/-home-user-marchedegrosci/c379b1b5-cd95-51ca-a2c5-79ef185f8fc8/scratchpad/captures-D/` (aide-commission, aide-transport, aide-refus, garanties, commande-haut, commande-quipaie, commande-transport, chauffeur, chauffeur-mission ; chacune en -sombre et -clair). Script : `captures-D.js` dans le même dossier.

## 2. Décision à demander au propriétaire : la commission « due »
La base passe la commission au statut « due » à chaque clôture (`_commission_sync`, `_ctr_sync`), alors qu'aucun paiement ne passe par l'application et qu'aucun contrat ne dit qu'elle sera réclamée. La base n'a PAS été changée. Question à poser, en une phrase :
« Pour les ventes faites avant le paiement dans l'application, la commission est-elle seulement **calculée** (rien ne sera réclamé), ou sera-t-elle **réclamée** plus tard (alors il faut le dire avant la vente, par écrit, et dire comment payer) ? »
- Conseil : statut « calculée » (« due » seulement quand l'argent passe par le séquestre), et écrire « rien ne sera réclamé pour les ventes d'avant le paiement intégré ». Il faudrait alors changer `_commission_sync` / `_ctr_sync` et les lignes existantes (avec son accord).
- En attendant, l'écran vendeur dit « Commission calculée (3,5 %) · rien n'est prélevé ni réclamé ».

## 3. Hors de mon périmètre (à faire par une autre équipe)
- `commande_litige` (serveur) dit encore « à la libération du paiement (24 h après la réception) » → « jusqu'à la clôture (1 h après la réception) ».
- `commande_refuser2` (serveur) : « Sans le mot secret du vendeur, pas de remboursement » → « pas de refus ».
- `v3/commandes.js`, `LIB.terminee` : l'étape « Commande terminée » est cochée pendant l'heure de vérification (contradiction 9). Proposition : « Marchandise reçue ». Non changé : `LIB` sert aussi au journal, et une autre équipe modifie ce fichier.
- Quand le service transport ouvrira : les textes « pas encore ouvert » (aide, guide, astuces, chauffeur) sont écrits en dur ; à changer dans la même PR que l'ouverture.

## 4. À ajouter aux documents partagés (par le chef)
- **PASSATION** : « Schéma 95 (test seulement) : 6,9 % réservé au service transport Marché de Gros (mode réseau + transporteur vérifié) dans `_seq_repartition` et `chauffeur_missions` ; `admin_affecter` refusé service fermé ou hors mode réseau ; ouverture du service refusée sous 3 transporteurs vérifiés (`reglages.transport_reseau_min`, plancher 3) ; transport à part dans la répartition (300 000 = total convenu) ; messages de clôture. Textes : un seul message sur l'intermédiaire (« met en relation, ni vendeur ni acheteur ») ; plus de « Paiement sécurisé / Libérer le paiement / Paiement libéré » ; « la partie refusée n'est pas due » ; « jamais d'avance à une personne » ; service transport « pas encore ouvert » partout ; 6,9 % seulement pour ce service ; « Qui paie » du transport dans la commande ; « Commission calculée » ; sceau vert au lieu de « Identités vérifiées » général. Production : à appliquer avec l'accord du propriétaire (schéma 95 puis front). »
- **CHANGELOG** : « Transport et argent : 6,9 % seulement pour le service transport Marché de Gros, transport à part compté dans le total, affectation et ouverture du service contrôlées (schéma 95) ; textes de paiement, remboursement et intermédiaire alignés. »
- **FONCTIONNALITES** (commande) : « Le bloc « Qui paie quoi » (ex-« Paiement sécurisé ») montre le total marchandise + transport à part ; la ligne Transport dit qui paie selon le mode. Espace chauffeur : aucune commission hors service Marché de Gros. »
- **PORTAGE-SITE partie 4** : « Textes argent/transport (schéma 95) : « met en relation », « Qui paie quoi », « la partie refusée n'est pas due », service transport « pas encore ouvert » : à reprendre sur le site s'il en parle. »

## 5. Chaque phrase changée (avant → après)
