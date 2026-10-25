# Les gardiens de l'application

> Demande du propriétaire (24/10/2026) : avant l'ouverture au public, des « policiers » qui passent **tous les 3 jours** et vérifient qu'il n'y a ni doublon, ni texte trop long, ni bug, ni chose illogique, ni chose qui n'est pas à sa place. Ils lancent les tests et envoient un rapport. **Tout est noté ici.**

## Ce que les gardiens protègent

L'application ne doit jamais faire « amateur ». Six interdits :

| Interdit | En clair |
|---|---|
| **Zéro amateur** | Rien de bancal à l'écran : police, couleurs, pastilles, alignements, états vides (`DESIGN.md`, section 8 : les 32 lois). |
| **Zéro doublon** | Une entrée n'apparaît qu'à un endroit logique. Pas deux fois la même phrase, le même bouton, la même fonction. |
| **Zéro sur-explication** | Pas de paragraphe « comme un cahier », pas de slogan, pas de sous-titre qui redit le titre. |
| **Zéro bug** | Pas d'erreur dans la console, pas d'écran vide, pas de clignotement, pas de test qui échoue. |
| **Rien d'illogique** | Les écrans disent la même chose entre eux et la même chose que le serveur (transport, ville, 1 h, commission…). |
| **Rien hors de sa place** | Le compte dans Mon compte, les notifications dans Réglages et la cloche, l'aide dans L'aide. |

## Les règles des gardiens (à ne jamais enfreindre)

1. **Mesurer, ne pas supposer.** Un point est « vert » seulement si on l'a vu (commande lancée, capture, requête lue). Sinon, il va dans « Non vérifié », avec la raison.
2. **Ne jamais inventer un résultat.** Pas de « tout va bien » sans preuve. Un test qui n'a pas tourné est « non rejoué », jamais « réussi ».
3. **Ne rien corriger en passant.** Le gardien **constate et propose**. La correction se fait ensuite, dans une PR à part, seulement pour les numéros choisis par le propriétaire, avec les captures validées avant (règle de `CLAUDE.md`).
4. **Ne jamais toucher la production.** Sur le projet de production (`catmsypctymgkjkfzdkt`) : lecture seule (conseillers Supabase, journaux d'erreurs, tâches planifiées). Les tests se font sur le **projet de test** (`yowdymdnoiubatxlwhfv`), dans des blocs annulés.
5. **Jamais de `drop`, `delete` ou `truncate`**, jamais de dépense, jamais de fusion de PR.

## Qui sont les gardiens

| | Qui | Quand | Ce qu'il fait | Où arrive le résultat |
|---|---|---|---|---|
| **1** | **Le contrôle automatique (scripts)** : tâche GitHub `.github/workflows/gardiens.yml`, scripts dans `tools/gardiens/` | Tous les 3 jours, tout seul | Les vérifications mécaniques : recherche de mots interdits, de doublons, de clés secrètes, de cache non monté, etc. Rien de jugé, seulement compté. | Voir `tools/gardiens/README.md` (mode d'emploi et endroit exact du résultat). |
| **2** | **La session Claude programmée** | Tous les 3 jours (heure fixée dans `CALENDRIER.md`) | Ce qui demande un œil : lire les écrans en iPhone émulé, juger les textes, rejouer les tests SQL sur le projet de test, lire les conseillers Supabase, comparer avec le rapport précédent. Suit **exactement** `MISSION-SESSION-PROGRAMMEE.md`. | Une PR « Rapport des gardiens du JJ/MM » qui ajoute `docs/gardiens/rapports/AAAA-MM-JJ.md`, et une notification sur le téléphone du propriétaire. |
| **3** | **Le propriétaire** | Après chaque rapport | Lit « En bref » et les points rouges, choisit les numéros à corriger, fusionne la PR du rapport. | Il répond dans une discussion : « corrige 1, 3 et 4 ». |

## Les fichiers du dossier

| Fichier | À quoi il sert |
|---|---|
| `README.md` | Ce fichier : l'idée, les règles, qui fait quoi. |
| `CALENDRIER.md` | Ce qui se vérifie tous les 3 jours, chaque semaine, chaque mois, avant une ouverture ou une grosse nouveauté, avant le paiement. |
| `LISTES-DE-CONTROLE.md` | Les listes A à K, case par case, avec la façon exacte de vérifier chaque case. |
| `REGISTRE-DES-TESTS.md` | Tous les tests du serveur (`supabase/tests/*.sql`), les parcours de bout en bout, leur dernier résultat connu, et ce qui n'a jamais pu être vérifié. |
| `MISSION-SESSION-PROGRAMMEE.md` | Les instructions exactes de la session Claude qui passe tous les 3 jours. |
| `rapports/` | Un rapport par passage (`AAAA-MM-JJ.md`). |

## Tenir le dossier à jour

Règle du propriétaire (24/10/2026, dans `CLAUDE.md`) : **chaque nouvelle règle, fonction, test ou écran ajoute ce qu'il faut vérifier** dans `LISTES-DE-CONTROLE.md` et `REGISTRE-DES-TESTS.md`, dans la même PR. Une règle qui change : on remplace la case, on ne garde pas les deux.

## Lire un rapport en 1 minute

- **En bref** : 3 lignes.
- **Rouge** : grave (bug qui bloque, faille, texte qui promet un paiement, test qui échoue). À corriger avant toute ouverture.
- **Orange** : à corriger (doublon, texte trop long, couleur hors règle).
- **Vert** : vérifié et bon, avec la preuve.
- **Non vérifié** : ce qu'on n'a pas pu regarder, et pourquoi.
- **Corrections proposées** : une liste numérotée. Le propriétaire répond par les numéros.
