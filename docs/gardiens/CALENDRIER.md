# Calendrier des contrôles

> Qui : **script** = le contrôle automatique (`.github/workflows/gardiens.yml`, scripts `tools/gardiens/`, mode d'emploi `tools/gardiens/README.md`) ; **Claude** = la session programmée (`MISSION-SESSION-PROGRAMMEE.md`) ; **propriétaire** = Stan.
> Les lettres A à K renvoient à `LISTES-DE-CONTROLE.md`. Les durées sont des ordres de grandeur, à corriger après les premiers passages (mesurer, ne pas supposer).

## Les deux rendez-vous programmés

| Gardien | Rythme | Heure conseillée | Réglage |
|---|---|---|---|
| Contrôle automatique (script) | Tous les 3 jours | Celle écrite dans `.github/workflows/gardiens.yml` | Tâche GitHub, gratuite. Lancement à la main possible depuis l'onglet « Actions ». |
| Session Claude programmée | Tous les 3 jours, **après** le script | 6 h 43, heure d'Abidjan (avant le début des notifications de 7 h) | Tâche programmée de Claude, nouvelle session à chaque passage, notification sur le téléphone. Expression : `43 6 */3 * *` (UTC = heure d'Abidjan ; jours 1, 4, 7… du mois). Identifiant de la tâche : `trig_01KLjPRL3kuCrSEjgNVCPkxg` (créée le 25/10/2026, sans accès Supabase pour l'instant : à recréer depuis claude.ai pour lui donner cet accès). |

Note : `*/3` compte les jours du mois (1, 4, 7… 28, 31). En fin de mois, deux passages peuvent tomber à 1 ou 2 jours d'écart : c'est voulu (plus simple qu'un compteur).

## Tous les 3 jours

| Quoi | Listes | Qui | Durée | Sortie attendue |
|---|---|---|---|---|
| Recherches mécaniques : mots interdits (« PAYÉ », « encaissé », « Non inclus »…), doublons de texte, de fonctions et de CSS, tirets cadratins, clés secrètes, chiffres nus, polices autres que Jost | A, B (repérage), D (mots), F (police, couleurs), I, J | Script | Quelques minutes | Résultat du script (voir `tools/gardiens/README.md`) |
| Lecture du résultat du script, tri des fausses alertes | Toutes | Claude | 10 min | Points rouges / orange du rapport |
| Écrans en iPhone émulé, clair et sombre : erreurs console, écrans vides, clignotements, textes trop longs, entrées en double, rangement | B, C, E, F | Claude (agents en parallèle) | 30 à 60 min | Captures dans le rapport (chemin), liste des erreurs console |
| Logique et cohérence des textes avec les règles de `CLAUDE.md` et avec le serveur | D | Claude (jugement) | 20 à 40 min | Points avec fichier:ligne et preuve |
| Tests du serveur rejoués sur le **projet de test** (blocs annulés), droits anon, RLS, tâches planifiées | G | Claude | 30 à 60 min | Tableau « fichier · résultat » dans le rapport ; mise à jour proposée de `REGISTRE-DES-TESTS.md` |
| Production en lecture seule : conseillers sécurité et performance, journaux d'erreurs, tâches planifiées | H | Claude | 10 min | Liste des alertes, comparée au passage précédent |
| Cache (`?v=`, `CACHE` de `sw.js`, `IMAGES`) | J | Script + Claude | 5 min | Fichiers changés sans `?v=` monté |
| Documents à jour | K | Claude | 10 min | Fonctions ou écrans absents des documents |
| Rapport + PR « Rapport des gardiens du JJ/MM » | | Claude | 10 min | `docs/gardiens/rapports/AAAA-MM-JJ.md`, une PR |
| Lecture du rapport, choix des numéros | | Propriétaire | 5 min | « Corrige 1, 3, 4 » dans une discussion, puis fusion de la PR du rapport |

## Chaque semaine (le passage qui tombe entre le lundi et le mercredi)

| Quoi | Qui | Durée | Sortie attendue |
|---|---|---|---|
| Liste F complète : les 32 lois de `DESIGN.md` vérifiées une par une sur les écrans principaux, à 390 et 320 px | Claude (Opus) | 45 min | Une ligne par loi : vert / orange / rouge, avec capture |
| Contraste mesuré (`contrast-check.py`) sur les textes nouveaux ou changés dans la semaine | Claude | 15 min | Couples couleur texte / vrai fond et leur rapport |
| Détecteur `impeccable detect` sur les fichiers front changés dans la semaine | Claude | 5 min | Sortie JSON résumée, fausses alertes écartées |
| Tableau `REGISTRE-DES-TESTS.md` relu : chaque test a-t-il été rejoué depuis moins de 7 jours ? | Claude | 5 min | Liste des tests en retard |
| Tâches planifiées : chaque `mdg-*` a tourné au moins une fois dans la semaine (`mdg-niveaux` chaque nuit, `mdg-effacer-messages`, `mdg-identites-matin`, `mdg-purger-positions`) | Claude | 5 min | Tâches sans exécution ou en échec |

## Chaque mois (premier passage du mois)

| Quoi | Qui | Durée | Sortie attendue |
|---|---|---|---|
| Comparaison des fonctions du dépôt et du **projet de test** (empreinte md5 du corps, commentaires retirés), comme à l'étape 1 du rapport de bout en bout (liste G8). La même comparaison avec la production lit les définitions de la production : seulement avec l'accord écrit du propriétaire (la liste H ne la permet pas d'office) | Claude | 20 min | Fonctions différentes ou absentes ; aucune action sans « OK production » |
| Parcours de bout en bout (a) à (l) rejoués sur le projet de test (`REGISTRE-DES-TESTS.md`, partie 2) | Claude | 1 h | Résultat par parcours |
| Taille du stockage (`stockage_volume()`) et des tables sur le test ; en production, seulement ce que donnent les conseillers et le tableau de bord | Claude + propriétaire (tableau de bord Supabase) | 10 min | Chiffres et date, comparés au mois précédent |
| Relecture de `docs/essai-ferme/A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md` : un point est-il devenu testable ? | Claude | 10 min | Points qui peuvent passer de « non testé » à « testé » |
| Mise à jour des compétences du dépôt si nécessaire (liste dans `CLAUDE.md`) | Claude, sur demande | | Proposition seulement |
| Le propriétaire regarde l'application sur son vrai téléphone (Android, et iPhone si possible) : ouverture, notifications, réseau lent | Propriétaire | 20 min | Ce qu'il a vu, noté dans le rapport suivant |

## Avant chaque ouverture ou grosse nouveauté

Ouverture du site au public, essai fermé, nouveau chantier (transport réseau, boutiques…), nouveau schéma appliqué en production.

| Quoi | Qui | Sortie attendue |
|---|---|---|
| **Audit de sécurité complet** (règle de `CLAUDE.md`) : liste I entière, droits de chaque fonction nouvelle, RLS, clés | Claude (Opus) | Rapport d'audit dans `docs/audits/`, aucun constat rouge ouvert |
| Toutes les listes A à K, sans exception | Claude | Rapport des gardiens complet |
| Tous les tests de `supabase/tests/` et les parcours (a) à (l) sur le projet de test | Claude | Tous « passe », ou chaque échec expliqué |
| Captures de tous les écrans touchés, clair et sombre, envoyées au propriétaire | Claude | Accord écrit du propriétaire |
| Liste « Non vérifié » relue avec le propriétaire : il accepte chaque limite par écrit, ou on la teste | Propriétaire | Décision notée dans `A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md` |

## Avant de brancher le paiement

| Quoi | Qui | Sortie attendue |
|---|---|---|
| Nouvel audit de sécurité **et** de logique, centré sur l'argent (séquestre, répartition, transport à part, commission « due » / « calculée ») | Claude (Opus) | Rapport d'audit ; corrections faites avant le branchement |
| Chercher partout les textes qui promettent ou nient un paiement (« rien n'est prélevé », « remboursement automatique », « jamais d'avance ») et les aligner sur ce qui sera vrai | Claude | Liste des textes à changer, captures |
| Vérifier qu'aucune clé du partenaire de paiement n'est dans le front | Claude (liste I) | Recherche vide |
| Accord écrit du propriétaire, partenaire agréé choisi | Propriétaire | Décision dans `CLAUDE.md` |
