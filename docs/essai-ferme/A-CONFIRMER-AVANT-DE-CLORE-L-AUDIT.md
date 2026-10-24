# À confirmer avant de clore l'audit

Ce que l'audit n'a **pas pu tester** (`AUDIT.md`, partie 11 « Limites », et notes des auditeurs). Pour chaque point : comment le tester **gratuitement**, **sans toucher la production**, qui le fait, et ce qui demande un budget.

Règle : la production est interdite pour les tests. On utilise le projet de test (`yowdymdnoiubatxlwhfv`), le téléphone réel du propriétaire et des outils gratuits.

| # | Non testé | Comment le tester gratuitement | Qui | Budget ? |
|---|---|---|---|---|
| 1 | **Paiements réels** (Mobile Money, séquestre) : aucun paiement n'existe, rien n'a été simulé | Rien à tester. Vérifier seulement que les textes ne promettent rien (relecture des écrans, P2 n° 19) | Claude | **Oui** : partenaire de paiement agréé, puis nouvel audit avant de brancher l'argent |
| 2 | **Charge concurrente** : un seul bloc SQL à la fois ; les verrous (deux acheteurs, un seul stock) ne sont validés que par lecture du code | Sur le projet de test, lancer plusieurs sessions en parallèle (script à plusieurs connexions) qui commandent la même offre. Contrôler : jamais plus que le stock | Claude | Non |
| 3 | **Fonction `pousser`** (envoi réel) : pas de clés push sur le test ; 15 cas non testés un par un | Sur un téléphone réel, activer les notifications avec un compte de test, déclencher chaque cas (message, négociation, commande, litige…), noter si la notification arrive et ouvre le bon écran. Créer des clés push pour le test (gratuit) | Propriétaire (téléphone) + Claude (déclenche, lit le journal) | Non |
| 4 | **Notifications sur vrai téléphone** : testées par simulation du navigateur seulement | Même essai que le point 3, sur Android et, si possible, iPhone ; téléphone verrouillé, application fermée, économie d'énergie active | Propriétaire | Non (un iPhone manquant limite le test) |
| 5 | **Fonction `itineraire`** (Edge) : non testée en charge ni en réel | L'appeler depuis le projet de test avec un trajet réel ; mesurer le temps et les erreurs ; relever le quota gratuit du service d'itinéraires | Claude | Non (surveiller le quota gratuit) |
| 6 | **Serveur public OSRM** (`router.project-osrm.org`, serveur de démonstration, sans garantie) | Mesurer sa disponibilité sur quelques jours (une requête par heure) ; décider ensuite de passer par `itineraire` (P3 n° 40) | Claude | Non pour la mesure ; un serveur à soi serait payant |
| 7 | **Realtime absent** : l'application relit toutes les 20 à 30 s ; non testé en charge | Compter les requêtes par minute avec plusieurs onglets ou téléphones ouverts (outils du navigateur), comparer au quota gratuit de Supabase | Claude | Non (plan payant à éviter si le quota est dépassé) |
| 8 | **Tuiles de carte** (OpenFreeMap, relief Terrarium sur `s3.amazonaws.com`) : dépendances extérieures | Ouvrir la carte sur téléphone en 3G ; vérifier l'affichage, le cache `tuiles-mgci`, et le comportement quand les tuiles ne répondent pas (blocage réseau dans le navigateur) | Claude (navigateur) + propriétaire (téléphone) | Non |
| 9 | **GitHub Pages** : quotas (100 Go, hypothèse non vérifiée) | Relever la taille des pages et du précache, estimer pour un nombre de visites réaliste, comparer à la limite publiée par GitHub (relue à la source) | Claude | Non |
| 10 | **Vrai téléphone en 2G/3G** : chemins hors ligne validés par lecture du code seulement | Téléphone réel du propriétaire sur réseau lent ; à défaut, limitation « Slow 3G » et « Hors ligne » dans Chromium. Parcours : ouvrir, publier, négocier, couper le réseau, revenir. Noter les temps de chargement | Propriétaire + Claude (émulation) | Non |
| 11 | **Liste locale de 30 annonces** : risque de retirer du serveur une annonce qui manque sur le téléphone (P3 n° 37), jamais vérifié dans un navigateur | Compte du projet de test avec plus de 30 annonces ; ouvrir, couper le réseau, modifier, rouvrir | Claude | Non |
| 12 | **API Auth** (inscription, limite 20 par 5 min et par IP, modification des métadonnées) : non appelable en SQL | Appels directs à l'API du projet de test (script) : rafale d'inscriptions et de connexions, changement des métadonnées par un membre | Claude | Non |
| 13 | **Exécution réelle de pg_cron** : durées simulées en reculant les dates | Sur le projet de test, créer des cas qui arrivent vraiment à échéance et attendre la tâche ; lire `cron.job_run_details` | Claude | Non (attente de quelques minutes à quelques heures) |
| 14 | **Production non lue** : volume réel, journaux Auth, contenu de `cron.job` | Le propriétaire regarde le tableau de bord Supabase, ou autorise une lecture seule précise | Propriétaire décide | Non |
| 15 | **Mesures de lenteur faussées** : le projet de test contient une simulation de 135 000 annonces | Refaire les mesures (tableau des prix, `notif_relances`) sur un jeu de quelques centaines d'annonces | Claude | Non |
| 16 | **Négociation à trois du transport** : service fermé, jamais exécutée | Sur le projet de test, ouvrir le service, créer 3 transporteurs vérifiés fictifs, jouer le parcours, refermer | Claude | Non |
| 17 | **Code de la carte** (`carte-app.js`, `carte-gl.js`) et gabarits de `application.dc.html` non lus en entier | Relecture, puis parcours navigateur de chaque écran | Claude | Non |
| 18 | **Quotas Supabase gratuits** (1 Go de stockage, 500 000 appels Edge) : hypothèses | Relever les chiffres sur la page officielle du plan gratuit et l'usage dans le tableau de bord ; estimer la durée avant dépassement | Claude (page officielle) + propriétaire (tableau de bord) | Non pour la mesure ; **oui** si un plan payant devient nécessaire |
| 19 | **Temps de travail de l'équipe** (identités, litiges, signalements) : estimation seulement | Se mesure pendant l'essai fermé (journal de bord, `PLAN.md`) | Propriétaire / équipe | Non |
| 20 | **Preuve du numéro de téléphone** (OTP) : inexistante | Non testable sans service d'envoi. En attendant : procédure « numéro contesté » | Claude (procédure) | **Oui** : SMS ou WhatsApp |
| 21 | **Juridique** : portée des CGU et de la confidentialité, déclaration ARTCI | Relecture par un juriste ; chercher une aide locale gratuite | Propriétaire | **À voir** : aide gratuite possible, sinon budget |

## Ordre conseillé

1. Sans le propriétaire, sur le projet de test : 2, 5, 11, 12, 13, 15, 16, 17.
2. Une séance avec le téléphone réel du propriétaire : 3, 4, 8, 10.
3. Dépendances et quotas : 6, 7, 9, 18.
4. Hors de portée sans budget : 1, 20, 21. À écrire comme limites connues avant l'essai fermé.

## Ce que « clore l'audit » veut dire

Un point est clos quand son test est fait et son résultat écrit ici (date, résultat exact), ou quand le propriétaire a décidé d'accepter la limite par écrit. Un résultat non obtenu reste « non testé » : on ne le déclare jamais réussi.
