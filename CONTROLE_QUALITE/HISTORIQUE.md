# Historique des passages

> Une ligne par passage. Les lignes sont ajoutées par `tools/controle/lancer.sh` (sauf modes `pr` et `--sortie`) et par Claude à la fin d’un contrôle général. Ne jamais effacer une ligne.
> « non exécuté » compte surtout les tests SQL, que le script ne lance jamais (Claude les joue via MCP sur le projet de test).

| Date | Mode | Commit | Réussis | Échoués | Bloqués | Non exécutés | En attente | Échec bloquant | Rapport |
|---|---|---|---|---|---|---|---|---|---|
| 25/10/2026 | premier rapport des gardiens (ancien chemin tools/gardiens/controle.js, avant ce dossier) | non noté | 8 contrôles sans constat | 1 rouge, 89 oranges | 0 | — | — | — | non enregistré dans le dépôt ; repris dans `REGISTRE_ANOMALIES.md` (ANO-001 à ANO-006) |
| 25/10/2026 à 00 h 39 | `tout` | `e215991` | 8 | 6 | 0 | 17 | 0 | non | [rapport](rapports/2026-10-25-00h39-tout.md) |
| 25/10/2026, 00 h 20 à 02 h 00 | contrôle général (équipes SQL sur le projet de test, navigateur, jugement, `lancer.sh statique` et `navigateur`) | `1657f0e` (SQL, jugement) / `8e88fbe` (statique, navigateur) | 148 | 69 | 1 | 4 | 16 | non (0 P0 ; 4 P1) | [rapport](rapports/2026-10-25-controle-general.md) |
