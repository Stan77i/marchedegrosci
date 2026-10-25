# Batteries SQL des unités

- Nom : `Uxx-<sujet>.sql` (exemple : U04-stocks.sql). L’unité est lue dans le nom par `tools/controle/lancer.js` ; les schémas couverts sont lus dans le texte (« schéma 93 », « schémas 96c »).
- Projet de **test** seulement (`yowdymdnoiubatxlwhfv`). Chaque bloc finit par `raise exception 'TEST: …'` : rien ne reste. Jamais `drop`, `delete`, `truncate`, même en commentaire.
- Sous chaque bloc : ID des tests (ex. `STK-04`), type, attendu, obtenu, statut, date.
- Le script ne les exécute **jamais** : il les liste « à exécuter par Claude (MCP) ». Claude les joue en suivant `../../procedures/CONTROLE_GENERAL.md`, partie 4.
