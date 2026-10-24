# Rapport d'audit de logique métier : Marché de Gros CI (MGCI)

Date : 24/10/2026. Audit fait par 9 auditeurs, puis contre-vérification de chaque constat grave (P0/P1), puis relecture finale.
Périmètre : règles du métier, cohérence, fiabilité, viabilité. **Pas d'audit du design** (couleurs, animations, disposition).

Légende :
- **FAIT OBSERVÉ** : prouvé par le code lu à la ligne près ou par un test exécuté.
- **RISQUE PROBABLE** : déduit du code, mais pas exécuté.
- **HYPOTHÈSE** : estimation, chiffre supposé ou point non mesuré.
- **Non vérifié** : aucune preuve, on ne conclut rien.
- Gravité : **P0** bloquant, **P1** critique, **P2** important, **P3** amélioration. Les gravités indiquées sont celles **après contre-vérification**.

Tous les tests en base ont été faits sur le **projet de test** (`yowdymdnoiubatxlwhfv`), dans des blocs annulés (`raise exception 'TEST…'`) : rien n'est resté. Sur la production, seules les **définitions** des fonctions et des règles ont été lues, aucune donnée. **FAIT OBSERVÉ** : plus de 150 fonctions comparées par empreinte (md5) sont identiques entre test et production (seuls des commentaires diffèrent). Les défauts trouvés sur le test sont donc **aussi en production**.

---

## 1. Verdict général

- **Cohérente ?** En partie. Le cœur (négocier, conclure, commander, charger, recevoir) suit des règles nettes et bien gardées par le serveur. Mais plusieurs chemins s'oublient : quand une vente tombe, le stock ne revient pas ; une commande confirmée peut rester bloquée sans fin ; les achats groupés et l'ancienne fonction de commande échappent à des règles décidées par le propriétaire (« ville seulement », suspension, transport à part).
- **Sûre contre les attaques directes ?** Oui. **FAIT OBSERVÉ** : les 72 tables ont la protection par ligne (RLS) ; personne n'a pu lire ou changer les données d'un autre, ni se donner les droits d'admin ou le badge vérifié.
- **Sûre contre les abus de confiance ?** Non. Comptes sans preuve du numéro, faux « Marché de Gros », badges fabriqués à deux, annonces masquées par 3 faux comptes.
- **Viable ?** Pas encore. Il n'y a **aucun paiement** et **aucune commission encaissable** : le modèle économique ne rapporte rien aujourd'hui. Plusieurs choix techniques ne tiendront pas l'échelle du plan gratuit (téléchargements, photos, tableau des prix).
- **Exploitable aujourd'hui ?** **Pour un essai fermé, accompagné, avec quelques vendeurs connus : oui.** **Pour une ouverture au grand public : non**, pas avant les corrections P1 de la partie 9 et des conditions d'utilisation.

Aucun constat n'a été classé P0 après contre-vérification, parce que l'application n'est pas ouverte au public (page de maintenance). **Si l'ouverture avait lieu demain, les 6 P1 deviendraient bloquants.**

---

## 2. Score de maturité : **49 / 100**

| Critère | Poids | Note | Justification (constats) |
|---|---|---|---|
| Logique métier | 20 | **9** | Négociation, accord figé, quantité minimale, étapes de commande : bons (FAIT OBSERVÉ). Mais stock non rendu dans 4 cas sur 5, commande confirmée sans issue, réception jamais confirmée sans échéance, annonce modifiable pendant une négociation, aucune expiration des annonces. |
| Intégrité des données et concurrence | 15 | **8** | Verrou anti-survente sur les offres (FOR UPDATE), une commande par accord, upsert sans doublon d'annonce (FAIT OBSERVÉ). Mais : ancienne quantité renvoyée par le téléphone → 160 sacs vendus pour 100 (testé), aucun verrou pour les demandes, produit/ville/unité non validés, messages en double. |
| Sécurité | 15 | **10** | RLS complète et identique test/prod, fonctions admin toutes gardées. Mais : numéro jamais prouvé, code de 6 chiffres, faux « Marché de Gros », admin sans double vérification, mot secret de réception devinable sans limite. |
| Argent et responsabilité | 10 | **3** | Calculs 3,5 % / 6,9 % justes au franc. Mais : aucun paiement, séquestre jamais déclenché, commission « due » sans moyen de la payer, 6,9 % affiché à tort au livreur privé, transport « à part » absent du total, textes « paiement libéré », « remboursement tout seul ». |
| Fiabilité et sanctions | 10 | **5** | Motif, catégories, paliers, suspension, contestation, badges 12 mois : testés et conformes. Mais : badges fabriqués par 2 complices, litiges abusifs gratuits, suspendu qui achète par groupe, vendeur absent jamais sanctionné, récidive comptée après une suspension levée par erreur. |
| Compréhension des règles | 10 | **6** | Aide simple et souvent fidèle. Mais : « sans intermédiaire » contre « seul intermédiaire », « terminée » qui n'est pas fini, « 24 h » au lieu de 1 h, qui paie le transport, transporteur réseau « bientôt » et décrit comme actif. |
| Viabilité technique | 10 | **5** | Hors ligne correct, tâches planifiées légères. Mais : 500 annonces visibles au plus, tableau des prix à 3,8 s, 10 Mo retéléchargés à chaque version, photos jamais effacées, tout le marché relu dès qu'une annonce change. |
| Viabilité économique | 5 | **1** | Commission non encaissable, recouvrement à la main, marché vide en production (4 comptes). |
| Exploitation (équipe, opérations) | 5 | **2** | Identités, litiges, suspensions, transporteurs, commissions : tout à la main, un seul admin, aucune échéance ni rappel pour les litiges. |
| **Total** | **100** | **49** | |

---

## 3. Tableau des fonctionnalités

| Fonctionnalité | Statut | Preuve courte |
|---|---|---|
| Protection RLS sur toutes les tables | Fonctionne | 72/72 tables, politiques identiques test/prod |
| Profil privé, numéros jamais publics dans les annonces | Fonctionne | Tests T1, T6 ; déclencheur qui efface `phone` |
| Accès administrateur (est_admin) | Fonctionne | Toutes les `admin_*` refusent un non-admin (T1) |
| Inscription numéro + code 6 chiffres | Partiel | Aucune preuve du numéro (v3/nuage.js:64-71) |
| Preuve du numéro (SMS/WhatsApp) | Absent | FONCTIONNALITES.md:57 ; demande un budget |
| Code de secours | Fonctionne | Limites par numéro, IP et total |
| Vérification d'identité (manuelle) | Partiel | Badge gardé après changement de nom (T4) ; doublon de pièce non bloquant |
| Nom réservé « Marché de Gros » | Défaut | T3 : accepté pour un membre |
| Bannissement | Partiel | Le banni peut encore se connecter |
| Suppression de compte | Partiel | Numéro bloqué à vie |
| Masquage par signalements | Défaut | 3 comptes suffisent ; seul l'admin rétablit |
| Publier une offre / une demande | Partiel | Produit, ville, unité non validés ; prix 0 et quantités absurdes acceptés |
| Quantité obligatoire | Partiel | Refusée à la création, mais vidable ensuite (test L) |
| Quantité minimale | Fonctionne | Message « à partir de 10 sac » |
| Baisse du stock à l'accord, sans survente (offres) | Fonctionne | Verrou FOR UPDATE ; test 8+8 sur 10 refusé |
| Verrou anti-survente pour les demandes | Absent | Pas de verrou ; concurrence non testée |
| Retour du stock quand la vente tombe | Défaut | Rendu seulement pour une annulation acceptée après confirmation |
| Expiration des annonces | Absent | Aucune colonne ni tâche |
| Anti-doublon d'annonces | Absent | Doublon identique accepté |
| Unités et conversions | Absent | Texte libre, aucune conversion |
| Négociation : proposer, contre-proposer, 48 h | Fonctionne | Tests 1 à 6 |
| Accord figé (prix, quantité, transport) | Partiel | Transport modifiable en silence avant acceptation (nego_transport) |
| Annonce figée pendant une négociation | Défaut | Igname/sac devenue Manioc/kg (test) |
| Annulation d'un accord sans commande | Absent | Accord bloqué pour toujours |
| Création de commande (commande_creer2) | Fonctionne | Une par accord, ville seulement contrôlée |
| Ancienne commande_creer | Défaut | Toujours ouverte, contourne ville seulement et transport à part |
| Confirmation par l'autre partie, expiration 48 h | Fonctionne | Tests commandes 1 et 2 |
| Preuves de départ obligatoires | Partiel | Les mêmes photos servent pour plusieurs commandes |
| Étapes et rôles de la commande | Fonctionne | 9 transitions interdites refusées |
| Réception par mot secret | Partiel | 30 essais faux sans blocage |
| Clôture automatique 1 h | Fonctionne | Tâche toutes les 5 min, testée |
| Échéance pour commande confirmée non chargée | Absent | Aucune tâche, aucun recours |
| Échéance pour réception jamais confirmée | Absent | En cours après 30 jours simulés |
| Litiges | Partiel | Pas de délai ; partage seulement pour un refus de marchandise |
| Refus de marchandise avec photos et mot | Fonctionne | 6 mots faux → bloqué |
| Annulation avec motif et catégories | Partiel | Ancienne fonction sans motif encore ouverte |
| Paiement Mobile Money | Absent | `encaissement in ('aucun')` |
| Séquestre | Partiel | Code présent, jamais déclenchable, 0 ligne |
| Commission 3,5 % (registre) | Fonctionne | Calcul juste, rien encaissé |
| Commission 6,9 % réservée au réseau MGCI | Défaut | Calculée et affichée pour un livreur privé (test) |
| Service transporteur MGCI fermé | Partiel | Fermé pour les commandes, mais `admin_affecter` le contourne ; seuil de 3 non contrôlé |
| Négociation à trois du transport | Non vérifié en exécution | Code lu ; service fermé |
| Transport à part dans le total | Défaut | 270 000 au lieu de 300 000 dans la répartition |
| Pas de messages privés avec le transporteur en mission | Fonctionne (code lu) | `_dm_mission_interdite`, non exécuté |
| Fiabilité : paliers, suspension, contestation | Partiel | Suspendu qui achète par groupe ; litiges perdus non comptés |
| Niveaux et badges 12 mois | Partiel | Montée/grâce/descente OK ; fabriqués par 2 complices |
| Avis après commande | Fonctionne | Riposte possible (avis visibles et modifiables 24 h) |
| Boutiques | Fonctionne | Scénarios 86 rejoués |
| Achat groupé | Partiel | Ville seulement et suspension ignorées ; blocage si stock baisse ; transport non facturé |
| Approvisionnement pro (besoins) | Partiel | Fréquence sans effet ; besoin dépassé encore répondable |
| Racheter / rappels | Partiel | Propose des offres en pause ou limitées à une ville |
| Alertes produits | Partiel | Promesse « dès que publié » contredite par le plafond |
| Matching J'ai / Je cherche | Partiel | Seulement sur le site, pas dans l'application |
| Tableau des prix | Partiel | Lent ; meilleur prix sans filtre d'âge ni d'erreur |
| Carte du réseau / fil public | Partiel | Vie privée respectée ; code de la carte non lu |
| Notifications (rythme, plafond, heures calmes) | Partiel | Plafond testé ; offre retirée encore annoncée ; envois perdus sans reprise |
| Messages privés et filtre des numéros | Partiel | Contourné par la lettre O, chiffres pleine largeur |
| Mises à jour en direct (Realtime) | Absent | Tout par relecture régulière |
| Ouverture hors ligne | Fonctionne (code lu) | Service worker |
| Message direct sans doublon | Défaut | Deux envois = deux lignes (test) |
| CGU, mentions légales, confidentialité | Absent | Aucun texte, aucune acceptation |
| Limite de connexion 20 / 5 min / IP | Non vérifié | Réglage non lisible en SQL |
| Notifications push réelles | Non vérifié | Projet de test sans clés push |

---

## 4. Les 10 problèmes les plus dangereux

### 1. Le stock disparaît quand la vente tombe — **P1** — FAIT OBSERVÉ
- **Preuve** : le stock baisse à l'accord (`stock_apres_accord`). `_cmd_rendre_stock` n'est appelé que dans un seul chemin (annulation acceptée après confirmation, `commande_annuler`). Refus de la commande (`commande_repondre`), retrait avant confirmation, expiration 48 h (`commandes_expirer`) et litige tranché « annulée » ne rendent rien. Tests : 100 → 50 → 50 → 40 (attendu 70, 80, 50) ; 1000 kg → 600 kg. Un accord conclu sans commande garde aussi le stock pour toujours. `nego_fige` interdit de défaire l'accord, et une 2e commande est refusée (« Une commande existe déjà pour cet accord »). `_stock_garde` empêche même le vendeur de remettre du stock à la main, **sans message d'erreur**. FONCTIONNALITES.md:262 promet l'inverse.
- **Conséquence** : un vendeur d'igname de Bouaké avec 10 t voit son annonce tomber à 0 et disparaître après deux acheteurs qui ne confirment pas, alors que l'igname est dans son magasin. Un concurrent peut vider une annonce par des accords qu'il laisse expirer (il faut tout de même que le vendeur accepte chaque quantité).
- **Correction** : un seul déclencheur après tout passage d'une commande à « annulée » sans marchandise partie : rendre le stock, remettre l'annonce « active » si elle était retirée pour épuisement, garde-fou contre le double rendu. Délai de validité d'un accord sans commande (par exemple 48 à 72 h, réglable), puis accord « sans suite » et stock rendu. Message clair au lieu de la correction silencieuse.
- **Dépendances** : schémas 26/35/52/58/84a ; décision du propriétaire sur le délai.

### 2. Une commande confirmée peut rester bloquée sans fin — **P1** — FAIT OBSERVÉ
- **Preuve** : `commande_annuler` : « Commande confirmée : l'acheteur ne peut plus l'annuler ». `commande_litige` : seulement à partir du chargement. L'acheteur peut refuser l'annulation du vendeur et le vendeur redemander sans limite. Aucune tâche planifiée ne traite `en_cours / confirmee`, et aucune fonction admin ne sort une commande `en_cours` sans litige. Test : commande toujours en cours après 30 jours simulés. Sur le test, 9 commandes confirmées le 23/10 n'ont jamais bougé.
- **Conséquence** : un restaurateur d'Abidjan confirme 2 t de banane plantain d'un vendeur de Daloa qui ne charge jamais. Il ne peut ni annuler, ni signaler, ni être aidé par l'équipe. Le vendeur garde sa fiabilité intacte. Le jour où le séquestre existera, l'argent resterait bloqué.
- **Correction** : délai de chargement réglable (par exemple 72 h) ; ensuite l'acheteur annule seul (annulation « abusive » imputée au vendeur) ou signale un problème ; rappel au vendeur avant l'échéance ; issue admin pour toute commande en cours ; une seule redemande d'annulation, puis l'équipe tranche.
- **Dépendances** : fiabilité (84), notifications ; accord du propriétaire sur le délai.

### 3. Aucune preuve du numéro de téléphone — **P1** — FAIT OBSERVÉ
- **Preuve** : v3/nuage.js:64-71 : le compte est ouvert tout de suite, sans SMS. Reconnu dans FONCTIONNALITES.md:57.
- **Conséquence** : quelqu'un s'inscrit avec le numéro d'une coopérative de cacao de Soubré avant elle ; la vraie coopérative ne peut plus s'inscrire. Un banni revient avec un autre numéro. Les faux comptes permettent les signalements en meute, les faux avis et les badges fabriqués (problèmes 7 et 8).
- **Correction gratuite tout de suite** : ne jamais dire que le numéro est vérifié ; procédure admin « numéro contesté » (rendre le numéro, avec journal) ; limite d'inscriptions par IP ; Turnstile (décision en attente). **Avec budget** : code par SMS ou WhatsApp.
- **Dépendances** : budget SMS ; décision Turnstile.

### 4. N'importe qui peut s'appeler « Marché de Gros » — **P1** — FAIT OBSERVÉ
- **Preuve** : test T3 : prénom « Marché », nom « de Gros », pseudo « MarcheDeGros » acceptés ; `texte_refus('Marché de Gros')` = null ; le nom se recopie sur toutes les annonces.
- **Conséquence** : un faux « Marché de Gros » écrit à un vendeur de Daloa : « payez les frais de vérification par Mobile Money ». Arnaque crédible et tort à la marque. Seul le logo officiel reste réservé aux admins.
- **Correction** : déclencheur sur `profils` qui refuse les noms et pseudos réservés après normalisation (sans accents, espaces ni ponctuation) : marchedegros, mgci, admin, support, equipe, officiel… Gratuit, sans dépendance.

### 5. Ni conditions d'utilisation, ni mentions légales, ni politique de confidentialité — **P1** — FAIT OBSERVÉ
- **Preuve** : aucun fichier ni texte de ce type dans le dépôt ; aucune acceptation à l'inscription ; seul « Ce que nous gardons » (v3/compte.js:856), muet sur les pièces d'identité, le GPS et la lecture des messages par l'équipe. Déclaration ARTCI (loi 2013-450) « à faire » (MISE-A-JOUR.md:188), état non vérifié.
- **Conséquence** : un acheteur de Korhogo reçoit du maïs moisi et se retourne contre MGCI : rien d'accepté ne dit que MGCI n'est qu'un intermédiaire. Des pièces d'identité sont gardées sans politique publiée.
- **Correction** : faire rédiger par un juriste (rôle d'intermédiaire, responsabilité, litiges, commission, données) ; acceptation à la création du compte ; vérifier la formalité ARTCI. **Demande un budget ou une aide juridique** (signalé sans conseil juridique de notre part).

### 6. Chaque nouvelle version retélécharge environ 10 Mo sur chaque téléphone — **P1** — FAIT OBSERVÉ
- **Preuve** : sw.js:146-149 : tout le code, les images et la carte sont rechargés avec `cache:'reload'` à chaque nouvelle valeur de `CACHE` ; 210 versions entre le 17 et le 24/10/2026 (git log). Mesure : ≈ 2,1 Mo de code compressé + ≈ 8,25 Mo d'images.
- **Conséquence** : un commerçant de Daloa qui ouvre l'application chaque matin pendant une semaine de mises à jour consomme ≈ 10 Mo par jour de forfait sans le savoir. HYPOTHÈSE : à 1 000 membres, ≈ 300 Go/mois, au-dessus de la limite indiquée par GitHub Pages (100 Go/mois, non revérifiée ici).
- **Correction** : images dans un cache séparé et durable, sans `reload` ; ne recharger que les fichiers changés ; regrouper les mises en ligne (une par jour au plus) une fois le public ouvert. Adapter la règle CLAUDE.md « augmenter CACHE à chaque changement ».

### 7. Deux comptes complices fabriquent des badges en quelques minutes — **P2** — FAIT OBSERVÉ
- **Preuve** : test : 5 fausses commandes entre deux comptes, sans argent, réception « sans mot » → « Vendeur fiable », « Acheteur fiable », « Acheteur en gros », « Fiabilité 100 % sur 5 », avis 5★ croisés. Règles `fiable` sans plafond par partenaire ni code ; badge « gros » sans plafond. « Bon » demande 3 mois ; « Excellent » et « Grand » restent protégés (code, identité, plafond de 5).
- **Conséquence** : un faux grossiste de riz de Daloa s'affiche « Vendeur fiable 100 % » et attire un producteur de Bouaké qui expédie à crédit.
- **Correction** : plafond par partenaire et nombre minimum de partenaires différents pour tous les niveaux et le badge « gros » ; nombre minimum d'avis ; délai minimum entre création et réception ; alerte admin sur les paires qui ne commercent qu'entre elles.

### 8. Survente possible : le téléphone renvoie une ancienne quantité — **P2** — FAIT OBSERVÉ
- **Preuve** : test 5 : après 60 sacs vendus sur 100, l'envoi du téléphone avec `quantity=100` est accepté, puis un 2e accord de 100 passe : **160 sacs vendus pour 100**. Côté front, si `stockDuServeur()` échoue (try/catch vide), la ligne entière est renvoyée.
- **Conséquence** : un vendeur de tomates de Korhogo en 2G corrige son prix ; deux acheteurs ont un accord sur la même marchandise.
- **Correction** : le serveur refuse d'écrire `quantity` si des ventes ont eu lieu depuis la dernière lecture (version envoyée par le téléphone) ou passe par une fonction dédiée ; le front n'envoie rien si la lecture du stock échoue.

### 9. L'annonce (et la proposition) changent sous les yeux de l'autre — **P2** — FAIT OBSERVÉ
- **Preuve** : test : pendant une négociation, le vendeur change Igname/sac/Bouaké en Manioc/kg/Korhogo à 300 F ; l'accord se conclut sur « Igname, sac, 14 000 F » et retire 50 d'un stock en kg ; `commande_creer2` prend la ville **actuelle** de l'offre. Par ailleurs `nego_transport` change « transport inclus » sur une proposition en attente **sans changer son identifiant** : l'autre accepte sans le voir (test 2). L'application actuelle n'utilise ce chemin qu'en secours, mais il reste appelable.
- **Conséquence** : litige sur ce qui a été vendu, stock faux, ville de départ différente, acheteur d'Abidjan engagé à payer un camion qu'il croyait inclus.
- **Correction** : interdire de changer produit, unité, ville et région tant qu'une négociation est ouverte ou qu'un accord attend sa commande ; prévenir l'autre partie d'un changement de prix ; utiliser la ville de la négociation dans `commande_creer2` ; retirer le droit d'exécuter `nego_transport` et `commande_creer` aux membres.

### 10. Litiges et réceptions sans échéance, et litiges abusifs gratuits — **P2** — FAIT OBSERVÉ
- **Preuve** : aucune tâche sur `etat='litige'` (inchangé après 60 jours simulés) ; une réception jamais confirmée reste « en cours » ; `admin_litige_trancher` ne propose que tout ou rien (le partage existe seulement pour un refus de marchandise). Un litige tranché contre l'acheteur ne compte pas contre lui, mais le vendeur garde à vie « litiges ouverts par l'autre partie » (test 5 : 0 → 3).
- **Conséquence** : commandes gelées si l'admin est absent ; un acheteur de mauvaise foi peut ternir un vendeur de Bouaké sans risque.
- **Correction** : rappel et échéance des litiges pour l'équipe ; issue « partage » dans `admin_litige_trancher` ; clôture ou litige automatique N heures après l'arrivée sans réception ; ne compter publiquement que les litiges perdus ; imputer un litige perdu à son auteur.

Juste après ce top 10 : masquage d'annonce par 3 faux comptes (P2), achat groupé hors règles (P2), notification d'une offre retirée (P2), aucune expiration des annonces (P2), mot secret devinable (P2).

---

## 5. Contradictions de logique métier et règles manquantes

**Contradictions (FAIT OBSERVÉ)**
1. **« Le stock revient sur l'annonce »** (FONCTIONNALITES.md:262) contre le code, qui ne le rend que dans 1 cas sur 5. Vendeur d'igname de Bouaké : annonce vide alors que les sacs sont là.
2. **« Ville seulement »** : respectée par `commande_creer2`, mais contournée par l'ancienne `commande_creer` (« Abidjan, pas Bouaké » passe sur une offre « uniquement à Bouaké ») et ignorée par les **achats groupés** (commande Daloa → « Bouaké centre » créée, `ville_arrivee` vide). La ville d'une annonce n'est même pas validée (« Paris », « Cocody » dans la région de Bouaké acceptés).
3. **6,9 % seulement pour le transporteur MGCI** : le registre le respecte, mais la répartition du séquestre et l'Espace chauffeur l'appliquent au livreur du vendeur (« comptez-la dedans »). L'aide (v3/aide.js:55, 96, 132 ; astuces.js:68) le présente comme général.
4. **Service transporteur fermé** : refusé pour les commandes, mais `admin_affecter` affecte quand même un transporteur, et le seuil « 3 transporteurs vérifiés » n'est contrôlé nulle part.
5. **Transport à part** : figé dans l'accord et dans `total_convenu` (300 000 F), absent de la répartition (270 000 F). Le futur dépôt de 300 000 F serait refusé.
6. **Suspension** : bloque négociation et commande directe, mais pas l'achat groupé (test : commande créée pour un suspendu).
7. **Motif obligatoire** : imposé par la nouvelle fonction, contourné par l'ancienne `commande_annuler` (motif NULL, test MOI1).
8. **Délai de réclamation** : 1 h (schéma 89), mais le message du serveur `commande_litige` dit « 24 h après la réception ».
9. **« Terminée »** veut dire « reçue, contestable 1 h », puis « clôturée » : un grossiste de Bouaké ramène son camion alors que l'acheteur peut encore refuser.
10. **Intermédiaire** : « sans intermédiaire » (garanties.js:53, acheter.js:31) contre « le Marché de Gros est le seul intermédiaire » (guide.js:48, astuces.js:96, tableau.js:182) contre la case « Je suis intermédiaire ».
11. **Commission** : « rien n'est prélevé » dans les textes, statut « due » dans la base dès la clôture ; personne ne dit si elle sera réclamée un jour, ni comment.
12. **Remboursement** : « le remboursement se fait tout seul » (v3/commandes.js:585) et « la partie refusée vous est rendue » alors qu'aucun argent ne passe par l'application. En pratique, avec le paiement à la livraison, « rendu » veut dire « pas dû ».
13. **« Jamais d'avance »** (garanties.js) contre le futur séquestre où l'acheteur paiera à la confirmation.
14. **« Identités vérifiées par l'équipe »** en bande générale, alors que 3 annonces se publient sans vérification.
15. **Retirer cache sans effacer** (décision 37) contre des politiques RLS de suppression encore actives et un repli DELETE dans v3/nuage.js.
16. **Rôle acheteur/vendeur** : seulement déclaratif ; un « acheteur » publie des offres sans blocage.
17. **Trois horloges** : score de fiabilité sans fenêtre, paliers sur 90 jours, badges sur 12 mois.

**Règles manquantes**
- Délai de validité d'un **accord sans commande**.
- Délai de **chargement** après confirmation ; délai de **réception** après arrivée ; délai de **traitement d'un litige**.
- **Durée de vie d'une annonce** (et d'une demande : `deadline` est un texte sans effet).
- **Ce qu'on peut modifier** pendant une négociation.
- **Poids d'un sac / d'un carton** ; conversion entre unités.
- **Qui paie la casse en route** (aujourd'hui, toujours le vendeur ; le transporteur est payé en entier).
- **Qui paie le transport en cas de refus**.
- **Qui décide** quand l'acheteur refuse l'annulation du vendeur.
- **Responsabilité de l'acheteur** qui disparaît ou ouvre des litiges abusifs (la fiabilité acheteur ne mesure presque rien).
- **Force majeure** (pluies, route coupée) : aujourd'hui, l'autre partie décide seule si c'est abusif.
- **Numéro contesté**, **changement de numéro**, numéro libéré après suppression du compte.
- **Ce que voit un banni** ; journal des changements de code faits par l'admin.
- **Commission** : qui doit, quand, comment payer, et si les ventes d'avant le paiement seront réclamées.
- **Achat groupé** : qui paie le transport affiché, que devient un groupe dont le stock baisse ou dont l'offre est retirée.
- **Ce qui est public** dans le profil (historique, volumes, villes de livraison lisibles sans compte).

---

## 6. Scénarios critiques

| Scénario | Résultat | Preuve |
|---|---|---|
| « Commande confirmée » compris différemment par l'acheteur et le vendeur | **Échoué** (règle floue) | Accord = stock retiré mais sans obligation ; commande « à confirmer » ; « en cours » sans échéance ; « terminée » encore contestable 1 h. Aucun écran ne dit à quel moment chacun est engagé. |
| Double vente du stock (deux acceptations successives, offre) | **Tenu** | Test 8+8 sur 10 : 2e accord refusé (« il reste 2 ») |
| Double vente simultanée (offre) | **Non vérifié** (protégé par le code) | Verrou FOR UPDATE ; pas de test à deux connexions |
| Double vente simultanée (demande) | **Non vérifié**, RISQUE PROBABLE | Aucun verrou pour les demandes |
| Double vente par ancienne quantité du téléphone | **Échoué** | Test 5 : 160 vendus pour 100 |
| Accord sur une offre dont la quantité a été vidée | **Échoué** | Test 4 : 5 000 sacs acceptés |
| Prix ou quantité changés après l'accord | **Tenu** | `nego_fige` refuse toute modification |
| Produit, unité, ville changés pendant la négociation | **Échoué** | Accord Igname/sac sur une offre Manioc/kg |
| Transport changé sur une proposition en attente | **Échoué** | Même id, inclus → non inclus, accepté |
| Vendeur disparu après confirmation | **Échoué** | Aucun recours, aucune échéance (test MOI2, 30 jours) |
| Acheteur qui ne confirme pas la commande (48 h) | **Partiel** | Expire bien et ne compte contre personne, mais le stock n'est pas rendu |
| Acheteur qui ne confirme jamais la réception | **Échoué** (partiel côté issue) | En cours après 30 jours ; seule issue : litige manuel |
| Transporteur qui ne livre pas | **Partiel** | Litige possible après chargement ; aucun délai ni alerte |
| Transporteur qui change son prix après l'accord ou le chargement | **Tenu** (code lu) | « déjà convenu : il ne change plus » ; non exécuté |
| Refus du prix à trois → livreur du vendeur | **Non vérifié** | Code lu ; service fermé |
| Livraison partielle ou non conforme | **Partiel** | Refus avec photos et mot, partage selon quantité (`admin_refus_trancher`) ; mais état incohérent après décision (`termine_le` vide), casse en route imputée au vendeur, aucun remboursement réel |
| Deux actions simultanées sur une commande | **Tenu** (code lu) | Toutes les fonctions verrouillent la ligne ; clôture en `skip locked` ; pas de vraie concurrence testée |
| Double clic sur « Commander » | **Tenu** | « Une commande existe déjà pour cet accord » |
| Coupure réseau pendant la publication | **Tenu** (code lu) | Upsert sur `client_id`, index unique |
| Coupure réseau pendant un message | **Échoué** | Deux envois = deux messages (test) ; file perdue si on ferme |
| Coupure réseau pendant une négociation | **Partiel** | Refus clair, rien de perdu ni doublé, rien mis en attente |
| Multi-comptes / usurpation du numéro | **Échoué** | Aucune preuve du numéro (code lu) |
| Usurpation du nom officiel | **Échoué** | T3 |
| Membre vérifié qui change de nom | **Échoué** | T4 : badge gardé |
| 3 faux comptes masquent une annonce | **Échoué** | T2 ; seul l'admin rétablit |
| Badges fabriqués par deux complices | **Échoué** | Test 3 |
| Notification sur une offre périmée ou retirée | **Échoué** | Lot encore envoyé après retrait (test) ; aucune annonce n'expire |
| Plafond de 8 notifications commerciales par jour | **Tenu** | 1 « ok » puis 8 « plafond » |
| Commande bloquée (confirmée, litige, groupe) | **Échoué** | Confirmée sans issue ; litige gelé 60 jours ; groupe coincé en « attente » |
| Annulation légitime sanctionnée | **Partiel** | Avant confirmation : jamais sanctionnée (tenu). Après : il suffit que l'acheteur dise « pas d'accord » pour un avertissement (route coupée par la pluie à Man). Contestation 7 j possible. |
| Le vendeur se déclare lui-même « légitime » | **Tenu** | Catégorie posée par l'autre partie |
| Suspension contournée par l'achat groupé | **Échoué** | Test 4 |
| Utilisateur malveillant : lire/modifier les données d'autrui | **Tenu** | T1 : tout refusé |
| Utilisateur malveillant : se donner admin ou badge | **Tenu** | T1 |
| Admin malveillant ou compte admin volé | **Échoué** (risque) | Code de 6 chiffres, pas de double vérification ; `admin_reinitialiser` sans journal ; `admin_affecter` écrase le livreur du vendeur |
| Mot secret de réception deviné | **Échoué** | 30 essais sans blocage ; 2 160 combinaisons |
| Photos de départ réutilisées | **Échoué** | Mêmes photos pour 3 commandes |
| Acheteur qui déclare « arrivé » dès le chargement | **Échoué** | Accepté |
| Commission présentée comme encaissée | **Partiel** | « Encaissé : 0 F » partout, mais « Paiement libéré » dans l'admin et « chacun reçoit sa part » |
| Parité test / production | **Tenu** | md5 identiques |

---

## 7. Risques à examiner

**Juridiques**
- Pas de CGU ni de politique de confidentialité ; rôle d'intermédiaire non opposable (FAIT OBSERVÉ).
- Données sensibles (pièces d'identité 5 ans, selfies, GPS, messages lus par l'équipe) sans politique publiée ; déclaration ARTCI non faite (FAIT OBSERVÉ dans MISE-A-JOUR.md, état réel non vérifié).
- Historique commercial (produits, volumes, villes, dates) lisible sans compte par `profil_public` (FAIT OBSERVÉ, T5).
- Commissions notées « dues » sans contrat : les réclamer serait contestable (RISQUE PROBABLE).
- Changement de code par l'admin sans trace : aucune preuve en cas de litige (FAIT OBSERVÉ).
- Usurpation du nom « Marché de Gros » utilisable pour des arnaques (FAIT OBSERVÉ).
- Futur séquestre : exige un partenaire agréé BCEAO (docs/SEQUESTRE.md) — **budget**.

**Financiers**
- Aucun revenu possible aujourd'hui ; recouvrement de la commission à la main (HYPOTHÈSE : ≈ 83 h/mois à 1 000 commandes).
- Dépassement des quotas gratuits : egress Supabase (5 Go), stockage (1 Go, chiffre non revérifié), GitHub Pages (HYPOTHÈSE, voir problème 6).
- Remboursements « affichés » mais pas garantis ; casse en route toujours supportée par le vendeur.

**Opérationnels**
- Un seul administrateur ; tout est manuel (identités, litiges, suspensions, transporteurs, signalements). HYPOTHÈSE : un temps plein à 1 000 commandes/mois.
- Commandes et litiges sans échéance : accumulation de dossiers gelés.
- Envois de notifications perdus sans nouvelle tentative (état « pris » posé avant l'envoi) — RISQUE PROBABLE.
- Projet gratuit mis en pause après 7 jours de faible activité (documentation Supabase) — HYPOTHÈSE pour la production.
- Itinéraires sur le serveur de démonstration public OSRM (app/carte-gl.js:345), non fait pour la production.
- Marché vide en production (4 comptes) : risque n° 1 d'une place de marché au lancement.
- Limite de 20 connexions / 5 min / IP derrière les IP partagées des opérateurs mobiles — HYPOTHÈSE.

**Sécurité**
- Comptes sans preuve du numéro ; code de 6 chiffres ; refus des codes faciles seulement sur le téléphone.
- Admin sans double vérification (MFA gratuite possible).
- Numéro affiché à l'admin dans les discussions tiré de `user_metadata`, modifiable par le membre (RISQUE PROBABLE, non testé).
- Filtre de numéros contournable (lettre O, chiffres pleine largeur, « w.a ») — FAIT OBSERVÉ.
- Doublon de pièce d'identité non bloquant — FAIT OBSERVÉ.
- Date de création d'annonce choisie par le client (antidatée au 01/01/2020, test T6).
- Signalements anonymes illimités ; conversations privées ouvertes à n'importe qui (500 messages/jour).
- Fonctions lourdes appelables sans compte (`tableau_produits` : 3,8 s).

---

## 8. Fonctions qui donnent une fausse impression

| Fonction | Ce qu'on croit | Ce qui est vrai | Nature |
|---|---|---|---|
| Badge « Identité vérifiée » | Le nom affiché est vérifié | Le nom peut changer après la vérification ; le badge reste | FAIT OBSERVÉ |
| Badges « Fiable », « Acheteur en gros », « 100 % » | Sérieux prouvé par de vraies ventes | Fabricables à deux, sans argent | FAIT OBSERVÉ |
| Bande « Identités vérifiées par l'équipe » | Tout le monde est vérifié | 3 annonces sans vérification, numéros non prouvés | FAIT OBSERVÉ |
| « Litiges ouverts par l'autre partie » | Le vendeur a des problèmes | Compte aussi les litiges qu'il a gagnés | FAIT OBSERVÉ |
| Mot secret de réception | Preuve que l'acheteur a reçu | Devinable sans limite d'essais | FAIT OBSERVÉ |
| Photos de départ | Preuve de cette expédition | Réutilisables d'une commande à l'autre | FAIT OBSERVÉ |
| Étape « Arrivée » | Le camion est arrivé | L'acheteur peut la déclarer dès le chargement | FAIT OBSERVÉ |
| « Paiement sécurisé », « Libérer le paiement », « Paiement libéré » | De l'argent est bloqué puis versé | Aucun argent ; seule une date change ; 0 séquestre | FAIT OBSERVÉ |
| « Le remboursement se fait tout seul » | MGCI rembourse | Rien n'oblige le vendeur ; argent payé hors application | FAIT OBSERVÉ |
| Commission « due » | Une dette existe | Aucun moyen de payer, aucun contrat | FAIT OBSERVÉ |
| 6,9 % dans l'Espace chauffeur | Le livreur privé doit 6,9 % | Règle réservée au réseau MGCI | FAIT OBSERVÉ |
| Transporteur MGCI « décrit comme actif » (guide, astuces) | On peut recevoir des missions | Service fermé | FAIT OBSERVÉ |
| Stock affiché | Ce que le vendeur a | Baisse sans vente ; peut aussi remonter à tort (vieille quantité) | FAIT OBSERVÉ |
| Annonce « active » | Encore disponible | Aucune expiration ; 61 605 / 90 144 offres actives de plus de 30 jours sur le test | FAIT OBSERVÉ |
| « Meilleure offre » du tableau des prix | Le vrai meilleur prix du marché | Minimum brut, sans filtre d'âge ni d'erreur de saisie (« 1 F ») | FAIT OBSERVÉ |
| Alertes « dès qu'une annonce est publiée » | Alerte immédiate | Plafond commercial : 90 min d'écart, rien la nuit | FAIT OBSERVÉ |
| Notification « Nouvelle offre » | L'offre existe | Peut être déjà retirée | FAIT OBSERVÉ |
| « N professionnels cherchent un fournisseur » | Besoins actuels | Compte des besoins périmés | FAIT OBSERVÉ (code) |
| Achat groupé « Confirmé · on attend les autres » | Commande en route | Peut rester sans commande pour toujours si le stock a baissé | FAIT OBSERVÉ |
| Fréquence « hebdomadaire » des besoins pros | Approvisionnement récurrent | Simple étiquette | FAIT OBSERVÉ |
| Filtre des numéros dans les messages | Impossible de sortir de l'application | Contournable facilement | FAIT OBSERVÉ |
| Masquage automatique par signalements | Protection contre les fraudes | Outil de sabotage avec 3 faux comptes | FAIT OBSERVÉ |
| « Arrêter » une négociation | C'est fini | L'autre la rouvre par un simple prix | FAIT OBSERVÉ |
| Boutique « en pause » | Plus aucune affaire | Les négociations en cours continuent, accords compris | FAIT OBSERVÉ |
| Rôle acheteur / vendeur | Une permission | Seulement un affichage | FAIT OBSERVÉ |
| Test automatique notifications-88 | Couvre les notifications | Périmé depuis le schéma 91 | FAIT OBSERVÉ |

---

## 9. Corrections prioritaires

Toutes sont gratuites sauf mention **[budget]**. Chaque changement de serveur : d'abord sur le projet de test, puis en production avec l'accord du propriétaire.

### P1 (avant toute ouverture au public)
1. **Rendre le stock** dans tous les passages à « annulée » sans marchandise partie (refus, retrait, expiration, litige annulé), remettre l'annonce en ligne, et donner une durée de validité aux accords sans commande. *Preuve* : `_cmd_rendre_stock` appelé une seule fois ; tests 100→40, 1000→600. *Dépendances* : décision du propriétaire sur le délai.
2. **Sortie pour une commande confirmée** : délai de chargement réglable, annulation par l'acheteur ensuite (imputée au vendeur), litige possible dès la confirmation, issue admin, une seule redemande d'annulation. *Preuve* : test MOI2 et 30 jours. *Dépendances* : fiabilité 84, notifications.
3. **Noms réservés** (« Marché de Gros », mgci, admin, support…) refusés par le serveur. *Preuve* : T3. *Dépendances* : aucune.
4. **Numéro** : ne jamais le présenter comme vérifié, procédure « numéro contesté » avec journal, limite d'inscriptions par IP, Turnstile (décision en attente). **[budget]** pour l'OTP SMS/WhatsApp.
5. **CGU, mentions légales, confidentialité** acceptées à l'inscription ; formalité ARTCI. **[budget ou aide juridique]**.
6. **Service worker** : ne plus tout recharger à chaque version (images dans un cache durable). *Preuve* : sw.js:146-149.

### P2 (avant l'ouverture ou juste après, selon le volume)
7. Interdire de changer produit/unité/ville/région d'une annonce pendant une négociation ; ville de la négociation dans `commande_creer2`.
8. Retirer le droit d'exécuter aux membres pour `commande_creer`, `nego_transport`, `commande_annuler`/`commande_repondre` anciennes (révocation, pas de suppression), une fois les téléphones à jour.
9. Refuser une quantité vide ou nulle sur une offre active ; verrou de stock aussi pour les demandes ; refuser l'écriture d'une ancienne quantité par le téléphone.
10. Expiration des annonces (par exemple 30 jours, prolongeable d'un geste, rappel avant la fin) — décision du propriétaire sur la durée.
11. Achats groupés : contrôle « ville seulement » et suspension dans `groupe_creer`/`groupe_rejoindre`/`groupe_confirmer`/`groupe_valider` ; groupe « expiré » et participants prévenus si le stock manque ; groupes annulés si l'offre est retirée ; dire qui paie le transport.
12. Badges : plafond par partenaire, minimum de partenaires différents et d'avis, délai minimum création → réception, alerte sur les paires fermées.
13. Litiges : échéance et rappel pour l'équipe, issue « partage », imputation du litige perdu à son auteur, compteur public limité aux litiges perdus.
14. Réception : déclaration « livré » par le transporteur ou le vendeur, puis clôture ou litige automatique après un délai.
15. Mot secret : 5 essais au plus ; espace de mots plus grand. Photos de départ prises après la confirmation et jamais réutilisées. « Arrivée » réservée à celui qui transporte.
16. Signalements : plus de masquage automatique (ou seulement par des comptes anciens/vérifiés), vendeur prévenu, bouton « contester », signalements marqués traités au rétablissement.
17. Badge vérifié : bloquer prénom/nom après la vérification, ou afficher le nom vérifié.
18. Transport : 6,9 % seulement si mode « réseau » et transporteur vérifié (`_seq_repartition`, `chauffeur_missions`, v3/chauffeur.js) ; `admin_affecter` refusé si le service est fermé ou si le mode n'est pas « réseau » ; seuil de 3 transporteurs dans `admin_transport_reseau` ; transport « à part » ajouté à la répartition.
19. Textes : « 1 h » au lieu de « 24 h » ; « Commande clôturée » au lieu de « Paiement libéré » ; « la partie refusée n'est pas due » au lieu de « remboursement » ; un seul message sur l'intermédiaire ; qui paie le transport par mode ; transporteur MGCI « pas encore ouvert » partout ; garanties sans « Identités vérifiées » général ; « jamais d'avance à une personne ». *Captures de validation avant PR.*
20. Commission : écrire la règle (rien ne sera réclamé pour les ventes d'avant le paiement intégré, ou statut « calculée »). Décision du propriétaire sur le mode d'encaissement futur. **[budget]** pour un agrégateur de paiement.
21. Admin : journal et notification pour `admin_reinitialiser` ; MFA pour les admins (gratuite dans Supabase) ; numéro de discussion tiré de l'e-mail et non des métadonnées.
22. Notifications : revérifier l'objet (offre active, négociation ouverte…) avant l'envoi ; remettre en attente un envoi échoué.
23. Performance : tableau des prix calculé d'avance (toutes les 1 à 5 min) ; compteur de version d'une ligne ; lecture des annonces par différence et filtrée par région ; recherche et carte côté serveur avec pagination (fin de la limite à 500).
24. Photos : durée de conservation après clôture (effacement seulement avec l'accord du propriétaire), photos plus légères, suivi du volume.
25. Messages privés : clé anti-doublon et file d'attente gardée sur le téléphone.
26. Profil public : décider ce qui est public (historique, volumes) ; date de création d'annonce forcée par le serveur.
27. Doublon de pièce d'identité : numéro saisi par l'admin et refus s'il est déjà vérifié sur un autre compte.
28. Récidive : ne compter que les suspensions allées à leur terme, dans une fenêtre de 12 mois ; litiges perdus dans les paliers ; motifs « météo » / « stock épuisé » à examiner avant sanction.
29. Suppression de compte : libérer le numéro ; écrire la règle du banni.

### P3 (améliorations)
30. Anti-doublon d'annonces ; poids par unité et conversion en kg ; prix > 0 obligatoire pour une offre ferme.
31. Offre en pause : refuser les nouvelles propositions et accords ; négociation « arrêtée » non rouvrable par l'autre aussitôt.
32. Journal des commandes trié de façon fiable (`clock_timestamp`) ; une seule normalisation du mot secret.
33. `admin_refus_trancher` : poser l'étape et la date de fin.
34. Achats groupés : exemption du compte officiel ; Racheter sans offres en pause ni hors ville ; besoins pros : fréquence réelle ou retirée, refus après la date.
35. Alertes : ciblage au-delà de 200 abonnés ; texte du rythme réel.
36. Signalements anonymes limités ; `notif_ouverte` liée à l'utilisateur ; nouvelles conversations privées limitées par jour.
37. Liste locale de 30 annonces : ne jamais retirer une annonce du serveur parce qu'elle manque sur le téléphone (RISQUE PROBABLE, à vérifier dans un navigateur).
38. Avis « à l'aveugle » ; fenêtre du score public décidée par le propriétaire.
39. Index en double, politiques RLS avec `(select auth.uid())` ; en-têtes des schémas 83 et docs mis à jour ; test notifications-88 mis à jour.
40. Itinéraires par la fonction Edge `itineraire` plutôt que le serveur public OSRM ; MapLibre et la carte chargés à la demande.

---

## 10. Plan de mise en viabilité (ordre exact)

1. **Décisions du propriétaire** (une séance) : délai d'un accord sans commande, délai de chargement, délai de réception, délai de litige, durée de vie des annonces, qui paie la casse en route et le transport en cas de refus, ce qui est public dans le profil, règle de la commission d'avant le paiement. Écrire ces règles dans CLAUDE.md.
2. **Stock** : déclencheur unique de retour du stock + accord « sans suite » + message clair à la place de la correction silencieuse (P1 n° 1). Test sur le projet de test, puis production.
3. **Commandes bloquées** : délais de chargement et de réception, issue admin, litige dès la confirmation, rappels (P1 n° 2, P2 n° 13-14).
4. **Fermer les portes de côté** : révoquer `commande_creer`, `nego_transport`, anciennes annulations ; contrôles ville/suspension dans les achats groupés ; `admin_affecter` et seuil des 3 transporteurs ; annonce figée pendant une négociation ; quantité vide refusée ; ancienne quantité refusée (P2 n° 7 à 11, 18).
5. **Confiance** : noms réservés, badge vérifié lié au nom, plafonds des badges, signalements sans masquage automatique, litiges perdus imputés, mot secret limité, photos uniques (P1 n° 3, P2 n° 12, 15 à 17, 28).
6. **Comptes et admin** : procédure numéro contesté, limite d'inscriptions, MFA admin, journal des réinitialisations, Turnstile si le propriétaire le décide (P1 n° 4, P2 n° 21).
7. **Textes** : alignement complet des messages du serveur et de l'aide (P2 n° 19-20), avec captures de validation.
8. **Juridique** : CGU, mentions légales, confidentialité, acceptation à l'inscription, ARTCI (P1 n° 5) **[budget ou aide]**.
9. **Viabilité technique** : service worker (P1 n° 6), tableau des prix calculé d'avance, compteur de version, lecture par différence, recherche serveur, expiration des annonces, conservation des photos (P2 n° 10, 23-25).
10. **Refaire l'audit de sécurité** (règle CLAUDE.md) et rejouer tous les scénarios de la partie 6 sur le projet de test.
11. **Essai fermé** avec 20 à 50 vrais vendeurs sur 2 ou 3 produits et 1 ou 2 villes ; mesurer les abandons par étape et le temps réel de l'équipe.
12. **Plus tard, avec budget** : OTP SMS/WhatsApp, partenaire de paiement agréé, séquestre (corriger d'abord la répartition du transport à part), puis nouvel audit avant de brancher l'argent.

---

## 11. Tests exécutés, résultats et limites

**Comptes et sécurité** : inventaire RLS test + prod (72/72, politiques identiques) ; 349 fonctions recensées, 311 SECURITY DEFINER, toutes les `admin_*` gardées ; T1 accès aux données d'autrui (tout refusé) ; T2 masquage par 3 comptes (masquée, non réactivable) ; T3 nom « Marché de Gros » (accepté) ; T4 badge après changement de nom (gardé), pseudo en double (refusé) ; T5 profil public sans compte (historique rendu), signalement anonyme accepté ; T6 date et numéro forcés (date acceptée, numéro effacé) ; md5 de 14 fonctions identiques test/prod.

**Annonces et stock** : valeurs limites (A à P, demandes N à O2) ; modification pendant une négociation ; refus / annulation avant confirmation / expiration (stock jamais rendu) ; quantité vide (5 000 sacs acceptés) ; remise en ligne d'une annonce épuisée (annulée en silence) ; ancienne quantité du téléphone (160 pour 100).

**Négociations** : 6 blocs (survente séquentielle offre et demande refusée ; `nego_transport` silencieux ; refus et expiration de commande sans retour du stock ; ancienne `commande_creer` contourne ville seulement et transport à part ; offre en pause, expiration, réouverture après arrêt) ; md5 de 12 fonctions identiques.

**Commandes** : parcours complet jusqu'à la clôture 1 h (tenu) ; 9 transitions interdites refusées ; 30 mots faux sans blocage ; refus, expiration, demande d'annulation puis chargement, arrivée déclarée par l'acheteur ; refus partiel et décision admin ; litige de 60 jours ; réception jamais confirmée après 30 jours ; md5 de 20 fonctions + tâches planifiées identiques.

**Transport et argent** : md5 de 88 fonctions identiques ; droits d'exécution (fonctions d'argent non appelables par les membres) ; `admin_affecter` service fermé + 6,9 % affiché au livreur privé ; transport à part absent du total ; arrondis FCFA justes ; insert « réseau » refusé.

**Fiabilité et badges** : scénarios niveaux-85 bloc A rejoués (identiques) ; fiabilite-84 bloc A + MOI1/MOI2 ; collusion à deux ; suspendu dans un achat groupé ; litiges abusifs ; md5 de 57 fonctions.

**Commercial et notifications** : cycle complet d'achat groupé ; groupe coincé par le stock ; groupe sur offre en pause puis retirée ; scénarios boutiques 86 (A, B, C) ; notifications 88 bloc 1 adapté (plafond tenu) ; notification d'une offre retirée ; `notif_relances` 2,1 s ; `tableau_produits` 3,9 s ; 22 chaînes du filtre de numéros ; message d'un banni (refusé) ; md5 de 76 fonctions.

**Viabilité** : tailles de la base, des seaux de stockage, des tables ; durées des tâches planifiées (0 échec) ; EXPLAIN des fonctions lourdes ; taille JSON des 500 offres et demandes ; double envoi de `dm_envoyer` (2 lignes) ; Playwright iPhone 13 (75 requêtes, ≈ 1,2 Mo compressé) ; taille du précache et nombre de versions ; conseils de performance Supabase.

**Compréhension** : lecture de 25 fonctions ; tests A (stock après refus) et B (commande confirmée sans issue) ; md5 de 14 fonctions ; recherche des textes de délais, d'intermédiaire et de CGU.

**Constats réfutés** : aucun constat P0/P1 n'a été réfuté par la contre-vérification. Plusieurs ont été **ramenés à P2** (nuancés) : masquage par 3 comptes, badge vérifié renommé, `nego_transport`, ancienne `commande_creer`, réception jamais confirmée, litige sans délai, 6,9 % hors réseau, `admin_affecter`, refus/commission sans paiement, badges fabriqués, litiges abusifs, suspendu en achat groupé, groupe coincé, groupe hors ville, limite de 500 annonces, expiration des annonces, tableau des prix, relecture du marché, photos de preuve, commission non encaissable, marché vide.

**Limites (ce qui n'a pas pu être testé)**
- **Production interdite pour les tests** : seules les définitions ont été comparées ; aucune donnée lue. Le volume réel, les journaux Auth et le contenu de `cron.job` en production (partiellement) n'ont pas été vus.
- **Pas de vrai téléphone**, pas de vrai réseau 2G/3G coupé : les chemins « hors ligne » sont validés par lecture du code.
- **Pas de paiement** : aucun séquestre, aucun Mobile Money ; rien n'a été simulé.
- **Pas de vraie concurrence** : un seul bloc SQL à la fois ; les verrous sont validés par lecture du code.
- **Realtime absent** ; **fonctions Edge** (`pousser`, `itineraire`) non testées en charge ni en envoi réel (pas de clés push sur le test).
- **API Auth** (inscription, limite de connexion 20/5 min, modification des métadonnées) non appelable en SQL.
- **Durées simulées** en reculant les dates ; l'exécution réelle de pg_cron n'a pas été observée.
- Données du projet de test issues d'une **simulation** (135 000 annonces) : les mesures de lenteur exagèrent la situation d'aujourd'hui.
- Code de la carte (`carte-app.js`, `carte-gl.js`) non lu ; gabarits d'application.dc.html pas tous lus ; liste locale de 30 annonces non vérifiée dans un navigateur.
- Négociation à trois du transport non exécutée (service fermé).
- Les chiffres de quotas (stockage 1 Go, 500 000 appels Edge, GitHub Pages 100 Go) et les estimations de temps de travail sont des **hypothèses**.

---

## 12. Les grands parcours expliqués à un enfant de 10 ans

**Créer un compte**
1. Awa veut vendre ses ignames. 2. Elle tape son numéro et un code de 6 chiffres. 3. Le compte s'ouvre tout de suite, sans SMS, avec un code de secours à garder. 4. Elle peut publier 3 annonces, puis doit faire vérifier sa pièce d'identité (gratuit). 5. Si quelqu'un a déjà pris son numéro, elle ne peut pas s'inscrire.
*Flou* : rien pour récupérer un numéro volé ou changer de numéro ; on peut ouvrir autant de comptes qu'on veut ; n'importe qui peut s'appeler « Marché de Gros ».

**Publier une annonce**
1. Le vendeur dit « j'ai 100 sacs d'igname à Bouaké ». 2. Il choisit produit, quantité, unité, prix, ville. 3. Le serveur vérifie la quantité, le prix positif, la limite de 30 annonces. 4. L'annonce est visible par tous, sans date de fin. 5. Le serveur ne vérifie pas que la ville ou le produit existent.
*Flou* : combien de temps l'annonce reste ; combien pèse un « sac » ; prix 0 accepté.

**Négocier et conclure**
1. Awa propose un prix pour 8 sacs. 2. Koffi a 48 h pour dire oui, non ou un autre prix. 3. S'il dit oui, le prix et la quantité ne bougent plus et les 8 sacs sortent de l'annonce. 4. Deux acheteurs ne peuvent pas prendre les mêmes sacs l'un après l'autre. 5. Si personne ne répond en 48 h, la proposition s'efface.
*Flou* : l'accord n'oblige personne à commander ; si la commande échoue, les sacs ne reviennent pas ; le vendeur peut changer son annonce pendant qu'on négocie.

**Commander**
1. L'un des deux crée la commande (qui transporte, où livrer). 2. L'autre doit dire « je confirme ». 3. Sans réponse en 48 h, elle s'annule et ce n'est la faute de personne. 4. Une fois confirmée, l'acheteur ne peut plus annuler. 5. Si le vendeur ne charge jamais, l'acheteur n'a aucun bouton.
*Flou* : aucun délai après la confirmation ; qui décide si l'acheteur refuse l'annulation du vendeur.

**Charger, transporter, recevoir**
1. Le vendeur photographie le colis, le pèse, glisse un papier avec un mot secret. 2. Sans ces preuves, il ne peut pas charger. 3. À l'arrivée, l'acheteur tape le mot secret. 4. Il a 1 h pour dire s'il y a un problème ; ensuite c'est clôturé. 5. Si la marchandise est abîmée, il refuse avec photos et mot.
*Flou* : si l'acheteur ne tape jamais le mot, rien ne se termine ; le mot se devine en essayant ; les mêmes photos peuvent servir plusieurs fois ; « terminée » n'est pas encore fini.

**Litige**
1. Il y a un problème après le chargement. 2. On le signale. 3. L'équipe regarde les photos. 4. Elle décide : tout pour le vendeur ou tout remboursé (partage seulement pour un refus de marchandise). 5. Si l'équipe ne répond pas, tout reste bloqué.
*Flou* : pas de délai ; celui qui a menti n'est pas puni ; le vendeur garde le litige sur son profil même s'il avait raison.

**Transport**
1. Même ville : le vendeur envoie son livreur, payé par l'acheteur. 2. Villes différentes : transport compris, à la charge de l'acheteur, ou à part avec un prix. 3. Le choix est gardé dans la commande. 4. Le camionneur du Marché de Gros n'est pas encore ouvert. 5. Quand il ouvrira, les trois devront être d'accord sur son prix.
*Flou* : l'équipe peut déjà mettre un camionneur MGCI sur une commande ; le livreur privé voit à tort « 6,9 % » ; qui paie la casse en route.

**Argent et commission**
1. Aujourd'hui, l'acheteur paie le vendeur en main propre, à la livraison. 2. L'application ne touche pas l'argent. 3. Elle note seulement « 3,5 % dus » dans un cahier. 4. Personne ne sait comment les payer. 5. Si le vendeur ne paie pas, rien ne se passe.
*Flou* : la commission sera-t-elle réclamée un jour ? « Remboursement tout seul » alors que rien n'est remboursé.

**Badges et sanctions**
1. Plus tu finis de commandes, plus ton badge monte (sur 12 mois). 2. Une annulation dont l'autre n'accepte pas la raison = mauvais point. 3. 1, 3, 5 mauvais points en 90 jours = avertissement, baisse, examen. 4. Seule l'équipe suspend (7 puis 30 jours). 5. On peut contester pendant 7 jours.
*Flou* : deux amis peuvent se fabriquer un badge ; un suspendu peut encore acheter en groupe ; une suspension levée par erreur compte comme récidive.

**Achat groupé**
1. Plusieurs acheteurs s'unissent pour un meilleur prix. 2. Chacun dit combien il veut. 3. Quand il y a assez de monde, chacun confirme en 48 h. 4. Une commande est créée pour chacun. 5. Si le vendeur n'a plus assez de marchandise, le groupe reste coincé.
*Flou* : qui paie le transport affiché ; la règle « ville seulement » et la suspension ne s'appliquent pas.

---

## 13. Réponse directe

**« Si MGCI était lancé demain auprès de vrais producteurs, grossistes et acheteurs ivoiriens, qu'est-ce qui pourrait concrètement échouer, tromper les utilisateurs, faire perdre de l'argent ou empêcher l'activité de fonctionner ? »**

1. **Les annonces se videraient toutes seules.** Chaque acheteur qui conclut puis ne confirme pas, ou dont la commande est refusée, retire la marchandise de l'annonce pour toujours. Au bout de quelques semaines, des vendeurs de Bouaké ou de Daloa verraient leurs annonces « épuisées » alors que leurs magasins sont pleins, et ne pourraient même pas remettre le stock sur la même annonce. (FAIT OBSERVÉ)
2. **Des commandes resteraient bloquées.** Un vendeur qui confirme puis ne charge pas laisse l'acheteur d'Abidjan sans aucun recours, et l'équipe elle-même ne peut rien débloquer. Un acheteur qui ne tape jamais le mot secret laisse la commande « en cours » sans fin. Les litiges n'ont pas de délai. (FAIT OBSERVÉ)
3. **Des escrocs tromperaient les membres.** Un faux « Marché de Gros » peut demander des « frais » par Mobile Money ; un compte peut prendre le numéro d'un vrai grossiste ; deux complices peuvent s'afficher « Vendeur fiable 100 % » ; un membre vérifié peut changer de nom et garder le badge vert. (FAIT OBSERVÉ)
4. **Des concurrents saboteraient.** Trois faux comptes cachent l'annonce d'un rival jusqu'à ce que l'équipe passe ; un acheteur de mauvaise foi ouvre des litiges qui restent à vie sur le profil du vendeur, sans rien risquer. (FAIT OBSERVÉ)
5. **Des accords porteraient sur autre chose que ce qui a été vu.** L'annonce peut changer de produit, d'unité ou de ville pendant la négociation ; une ancienne quantité renvoyée par un téléphone en 2G peut faire vendre plus que le stock réel. (FAIT OBSERVÉ)
6. **Personne ne gagnerait d'argent, et des promesses d'argent seraient fausses.** Aucune commission ne peut être encaissée ; l'écran parle de « paiement libéré » et de « remboursement tout seul » alors qu'aucun franc ne passe par l'application ; la casse en route retombe toujours sur le vendeur ; le livreur privé croit devoir 6,9 %. (FAIT OBSERVÉ)
7. **MGCI serait exposé juridiquement.** Aucune condition d'utilisation acceptée ne dit que MGCI n'est qu'un intermédiaire ; des pièces d'identité et des positions GPS sont gardées sans politique publiée. (FAIT OBSERVÉ ; portée juridique à faire confirmer par un juriste)
8. **Le service coûterait cher en données et pourrait ralentir.** Chaque mise à jour fait retélécharger ≈ 10 Mo à chaque téléphone ; le tableau des prix est lent ; les photos de preuve ne s'effacent jamais ; au-delà de 500 annonces, les plus anciennes deviennent invisibles. (FAIT OBSERVÉ pour le code ; dépassement des quotas = HYPOTHÈSE dépendant du volume)
9. **L'équipe serait débordée.** Identités, litiges, suspensions, signalements et commissions se font à la main, avec un seul administrateur et aucune échéance. (HYPOTHÈSE sur les heures)
10. **Le marché serait vide au départ.** En production, 4 comptes : le premier acheteur risque de ne rien trouver et de ne pas revenir. (FAIT OBSERVÉ)

Ce qui tiendrait : personne ne pourrait lire ou modifier les données d'un autre, ni voler les droits d'administrateur ; deux acheteurs ne pourraient pas prendre les mêmes sacs l'un après l'autre ; un double clic ne créerait pas deux commandes ; le parcours normal négociation → commande → chargement → réception → clôture fonctionne.

**Conclusion** : MGCI est prêt pour un **essai fermé et accompagné**, pas pour un **lancement public**. Les six corrections P1 (stock, commandes bloquées, noms réservés, numéro, conditions d'utilisation, téléchargements) sont l'étape minimale avant d'ouvrir.
