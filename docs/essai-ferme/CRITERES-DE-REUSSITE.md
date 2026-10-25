# Critères de réussite de l'essai fermé

Quand peut-on ouvrir au public ? Ce fichier reprend les critères de `PLAN.md` (partie 8). Le plan ne donnait pas de chiffres (« [N] ») : les chiffres ci-dessous, prévus pour 20 participants, sont **validés par le propriétaire le 25/10/2026** (« ok pour tout »). On ne les change plus pendant l'essai.

Les chiffres viennent du relevé de `SUIVI.md`. Ce qui n'a pas été mesuré compte comme **non tenu**.

---

## 1. Critères obligatoires (tous doivent être tenus)

| # | Critère (du plan) | Seuil validé | Où le lire | Tenu ? |
|---|---|---|---|---|
| 1 | Commandes menées jusqu'à la clôture | **au moins 10** | Commandes → Toutes, « Terminée » | |
| 2 | Vendeurs différents qui ont reçu une commande | **au moins 5 sur 10** | `SUIVI.md`, partie 1 | |
| 3 | Acheteurs différents qui ont passé une commande | **au moins 5 sur 10** | `SUIVI.md`, partie 1 | |
| 4 | Aucune commande restée bloquée sans issue au-delà du délai prévu | **0** | Commandes → À traiter (échéances dépassées en rouge) | |
| 5 | Aucun stock « disparu » sans raison | **0 cas** | ce que disent les vendeurs ; vérification par Claude à la demande | |
| 6 | Litiges tranchés dans le délai du serveur | **tous en 72 h ou moins** | Commandes → À traiter (« À trancher avant le … ») | |
| 7 | Aucun incident de sécurité (accès aux données d'autrui, usurpation, faux « Marché de Gros ») | **0** | messages des participants, journal | |
| 8 | Aucun texte qui laisse croire à un paiement ou un remboursement garanti par le Marché de Gros | **0 cas vu** | journal, remarques des participants | |

## 2. Critères à surveiller (le propriétaire juge)

| # | Critère | Seuil validé | Où le lire |
|---|---|---|---|
| 9 | Participants qui ont fait au moins une action (annonce ou proposition de prix) | **au moins 14 sur 20** | `SUIVI.md`, partie 1 |
| 10 | Temps d'équipe par commande | **30 minutes ou moins en moyenne** en semaines 3 et 4 | journal (heures) ÷ commandes de la semaine |
| 11 | Le même blocage cité par plusieurs personnes | **aucun blocage cité 3 fois ou plus** sans correction | `SUIVI.md` (colonne « Problème vu »), questionnaire, question 4 |
| 12 | Les participants reviendraient | **au moins 7 sur 10** « Oui » ou « Peut-être » | questionnaire, question 8 |
| 13 | Annulations jugées abusives | **au plus 2** | Fiabilité → Dernières annulations (catégorie « Abusive ») |

**Décision** : voir la grille de `QUESTIONNAIRE.md`. En bref : un critère obligatoire manqué → on corrige d'abord.

---

## 3. Les points de l'audit à confirmer pendant l'essai

Liste complète : `A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`. L'essai permet d'en confirmer certains avec de vrais utilisateurs. Noter le résultat (date, ce qui a été vu) dans ce fichier-là ; un point non vu reste « non testé ».

| N° de l'audit | Point | Ce qu'on regarde pendant l'essai | Qui |
|---|---|---|---|
| 3 et 4 | Notifications sur vrais téléphones (`pousser`) | Chaque participant qui a activé les notifications : en reçoit-il pour un message, une proposition de prix, une commande ? Ouvrent-elles le bon écran ? Android et iPhone ; écran **Notifications** du tableau de bord (envoyées, ouvertes) | Propriétaire (demande aux participants) + Claude (journal) |
| 7 | Relecture toutes les 20 à 30 s, sans « temps réel » | Avec 20 personnes, l'usage reste-t-il dans le quota gratuit ? | Propriétaire (tableau de bord Supabase → Usage) + Claude |
| 8 | Carte et tuiles en 3G | Les participants ouvrent-ils la carte ? S'affiche-t-elle chez eux ? | Propriétaire (questions aux participants) |
| 10 | Vrais téléphones en 2G/3G, hors ligne | Temps d'ouverture, annonces publiées avec un réseau faible, plaintes de lenteur | Propriétaire (journal) |
| 13 | Tâches automatiques (délais de chargement, clôture 1 h après la réception, annonces expirées) | Les commandes se clôturent-elles seules après 1 h ? Les échéances apparaissent-elles ? | Claude (lecture de `cron.job_run_details` avec l'accord du propriétaire) |
| 14 | Production jamais lue en volume | Volume réel après 4 semaines | Propriétaire (tableau de bord Supabase) ou lecture seule par Claude avec accord |
| 18 | Quotas gratuits Supabase (stockage des photos, appels) | Photos du colis et des refus : combien de place après 4 semaines ? | Propriétaire (tableau de bord Supabase → Usage) ; `stockage_volume()` par Claude |
| 19 | Temps de travail de l'équipe | Heures par semaine : identités, litiges, aide | Propriétaire (journal) |

**Limites connues, pas testables pendant l'essai** (à dire aux participants si on vous pose la question) :
- **n° 1** : aucun paiement dans l'application (il faut un partenaire de paiement) ;
- **n° 20** : le numéro de téléphone n'est pas prouvé par SMS (il faut un budget) ; l'équipe a la procédure « numéro contesté » ;
- **n° 21** : conditions d'utilisation et confidentialité encore en projet, pas relues par un juriste, pas acceptées à l'inscription.
