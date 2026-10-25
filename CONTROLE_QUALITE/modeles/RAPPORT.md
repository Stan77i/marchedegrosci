# Rapport du contrôle qualité · JJ/MM/AAAA à HH h MM (UTC = heure d’Abidjan)

> Gabarit de tout rapport du contrôle qualité. Les parties 1 à 4 et 6 sont remplies par `tools/controle/lancer.sh` pour ce qu’il exécute ; Claude complète avec les tests SQL (MCP, projet de test), le navigateur et son jugement.
> Interdits : inventer un résultat ; écrire « réussi » pour un test bloqué ou non exécuté ; mettre un secret, un numéro, un nom complet ou le contenu d’un message.

## 1. Identité du passage

| Champ | Valeur |
|---|---|
| Date | JJ/MM/AAAA à HH h MM |
| Commit | `abc1234` (branche `…`) |
| Mode | `tout` / `statique` / `navigateur` / `unite Uxx` / `apres-modif` / `pr` / contrôle général |
| Base de comparaison | `origin/main` (seulement après modification) |
| Projet de test joignable ? | oui / non (raison) |
| Production (lecture seule, conseillers) joignable ? | oui / non (raison) |
| Rapport précédent | `rapports/<fichier>.md` ou « aucun » |
| Lancé par | GitHub Actions / tâche Claude programmée / Claude sur demande / propriétaire |

## 2. En bref (3 lignes, pour le propriétaire)

1. Le plus important.
2. Comptes : réussis N · échoués N · bloqués N · non exécutés N · en attente N.
3. Nouveau depuis le dernier rapport : P0 N, P1 N, P2 N, P3 N.

## 3. Unités

| Unité | Exécutée ? | Réussis | Échoués | Bloqués | Non exécutés | En attente |
|---|---|---|---|---|---|---|
| U01 Logique métier | oui / non (raison) | | | | | |
| U02 Sécurité | | | | | | |
| U03 Transactions et argent | | | | | | |
| U04 Stocks et produits | | | | | | |
| U05 Commandes et négociations | | | | | | |
| U06 Transport et livraison | | | | | | |
| U07 Profils et confiance | | | | | | |
| U08 Notifications | | | | | | |
| U09 Base de données | | | | | | |
| U10 Fiabilité technique | | | | | | |
| U11 Administration | | | | | | |
| U12 Compréhension | | | | | | |
| U13 Cohérence documentaire et commerciale | | | | | | |
| U14 Situations extrêmes | | | | | | |

## 4. Tests

| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Gravité | Preuve | Date |
|---|---|---|---|---|---|---|---|---|---|
| STK-04 | U04 | limite | … | … | … | réussi / échoué / bloqué / non exécuté / en attente : <prérequis> | P0–P3 ou — | `fichier:fonction` ou requête | JJ/MM |

Type : normal / limite / erreur / malveillant / concurrent / panne / régression. Un test touché par un chantier en cours (ex. schéma 97b) : « en cours de changement », pas « échoué ».

## 5. Anomalies P0 à P3

Une fiche par anomalie, reprise (ou mise à jour) dans `REGISTRE_ANOMALIES.md` sous son numéro `ANO-NNN`.

### ANO-NNN · titre court (P1, U05) · nouvelle / toujours là depuis le JJ/MM / réglée
- **Preuve reproductible** : commande ou requête exacte, `fichier:ligne`, sortie obtenue.
- **Risque métier** : ce qui peut arriver à un membre ou au Marché de Gros.
- **Correctif proposé** : fichiers touchés, captures à faire avant la PR. Jamais « fait » dans un rapport.
- **Test de non-régression** : ID du test qui la surveillera.

## 6. Risques résiduels et limites

- Ce qui n’a pas été exécuté, et pourquoi (accès, prérequis, temps).
- Ce qui ne peut pas l’être sans accès externe (paiement, SMS, vrai téléphone, fonctions externes, charge).
- Rappel : absence d’erreur ≠ absence de faille ; un écran qui existe ≠ une fonction qui marche.

## 7. Comparaison avec le rapport précédent

- **Nouveau** : …
- **Toujours là** : … (depuis le JJ/MM)
- **Réglé** : … (avec la preuve)

## 8. Corrections proposées (le propriétaire répond par les numéros)

1. ANO-NNN : …
