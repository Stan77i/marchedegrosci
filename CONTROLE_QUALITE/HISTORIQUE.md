# Historique des passages

> Une ligne par passage. Les lignes sont ajoutées par `tools/controle/lancer.sh` (sauf modes `pr` et `--sortie`) et par Claude à la fin d’un contrôle général. Ne jamais effacer une ligne.
> « non exécuté » compte surtout les tests SQL, que le script ne lance jamais (Claude les joue via MCP sur le projet de test).

| Date | Mode | Commit | Réussis | Échoués | Bloqués | Non exécutés | En attente | Échec bloquant | Rapport |
|---|---|---|---|---|---|---|---|---|---|
| 25/10/2026 | premier rapport des gardiens (ancien chemin tools/gardiens/controle.js, avant ce dossier) | non noté | 8 contrôles sans constat | 1 rouge, 89 oranges | 0 | — | — | — | non enregistré dans le dépôt ; repris dans `REGISTRE_ANOMALIES.md` (ANO-001 à ANO-006) |
| 25/10/2026 à 00 h 39 | `tout` | `e215991` | 8 | 6 | 0 | 17 | 0 | non | [rapport](rapports/2026-10-25-00h39-tout.md) |
| 25/10/2026, 00 h 20 à 02 h 00 | contrôle général (équipes SQL sur le projet de test, navigateur, jugement, `lancer.sh statique` et `navigateur`) | `1657f0e` (SQL, jugement) / `8e88fbe` (statique, navigateur) | 148 | 69 | 1 | 4 | 16 | non (0 P0 ; 4 P1) | [rapport](rapports/2026-10-25-controle-general.md) |
| 13/11/2026 à 12 h 34 | `apres-modif` | `ca34847` | 10 | 4 | 0 | 3 | 0 | non | [rapport](rapports/2026-11-13-12h34-apres-modif.md) |
| 13/11/2026 à 12 h 44 | `apres-modif` | `dd4dfc6` | 13 | 4 | 0 | 1 | 0 | non | [rapport](rapports/2026-11-13-12h44-apres-modif.md) |
| 13/11/2026 à 13 h 00 | `apres-modif` | `3cecb72` | 9 | 4 | 1 | 1 | 0 | non | [rapport](rapports/2026-11-13-13h00-apres-modif.md) |
| 13/11/2026 à 13 h 15 | `apres-modif` | `a4b58f0` | 9 | 4 | 1 | 1 | 0 | non | [rapport](rapports/2026-11-13-13h15-apres-modif.md) |
| 13/11/2026 à 13 h 38 | `apres-modif` | `63efce1` | 9 | 4 | 1 | 1 | 0 | non | [rapport](rapports/2026-11-13-13h38-apres-modif.md) |
| 13/11/2026 à 14 h 01 | `apres-modif` | `2a381c0` | 9 | 4 | 1 | 1 | 0 | non | [rapport](rapports/2026-11-13-14h01-apres-modif.md) |
| 13/11/2026 à 14 h 08 | `apres-modif` | `5160e0e` | 9 | 4 | 1 | 1 | 0 | non | [rapport](rapports/2026-11-13-14h08-apres-modif.md) |
| 13/11/2026 à 14 h 23 | `apres-modif` | `ae1ef22` | 9 | 4 | 1 | 1 | 0 | non | [rapport](rapports/2026-11-13-14h23-apres-modif.md) |
| 14/11/2026 à 05 h 59 | `apres-modif` | `a010232` | 13 | 4 | 0 | 1 | 0 | non | [rapport](rapports/2026-11-14-05h59-apres-modif.md) |
| 14/11/2026 à 06 h 23 | `apres-modif` | `7466b78` | 13 | 4 | 0 | 1 | 0 | non | [rapport](rapports/2026-11-14-06h23-apres-modif.md) |
| 14/11/2026 à 06 h 27 | `apres-modif` | `82e131d` | 13 | 4 | 0 | 1 | 0 | non | [rapport](rapports/2026-11-14-06h27-apres-modif.md) |
