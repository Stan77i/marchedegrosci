# Procédure : après un incident

> Un membre signale un problème, un écran casse, une notification part de travers, une donnée paraît fausse, une tâche GitHub échoue. But : comprendre, prouver, corriger sans rien casser de plus, et **empêcher le retour** (un test de non-régression par incident).

## 1. Constater (sans rien changer)

- Noter : date, heure (Abidjan), écran ou fonction, ce qui était attendu, ce qui s’est passé. Aucune donnée personnelle dans les notes.
- Production : **lecture seule** (`get_advisors`). Ne jamais « réparer » une donnée de production sans l’accord écrit du propriétaire ; jamais de `delete`, `drop`, `truncate`.

## 2. Reproduire sur le projet de test ou dans le navigateur

- SQL : bloc annulé sur `yowdymdnoiubatxlwhfv` qui reproduit le cas (`procedures/CONTROLE_GENERAL.md`, partie 4).
- Écran : iPhone émulé, réponses injectées.
- Non reproduit : l’écrire tel quel (« non reproduit, conditions essayées : … »), jamais « résolu ».

## 3. Enregistrer

- Nouvelle fiche dans `REGISTRE_ANOMALIES.md` (`ANO-NNN`), gravité P0 à P3, preuve reproductible, risque métier.
- P0 (argent, sécurité, perte de données) : prévenir le propriétaire tout de suite, en deux lignes.

## 4. Corriger

- Une PR à part, partie d’`origin/main`, avec captures validées si un écran change.
- Dans la même PR : le **test de non-régression** (fichier SQL dans `supabase/tests/` ou batterie dans `CONTROLE_QUALITE/tests/`, ou cas ajouté au contrôle statique), sa ligne dans `tools/controle/unites.json`, `MATRICE_TESTS.md` (type « régression »).
- `bash tools/controle/lancer.sh apres-modif` sans échec bloquant.
- Statut : « corrigée non vérifiée ».

## 5. Vérifier

- Après fusion (et application sur le test, puis en production avec accord) : rejouer le test de non-régression ; statut « vérifiée » avec date et preuve.
- `bash tools/controle/lancer.sh unite <unité de l’incident>`.

## 6. Retenir

- Si l’incident vient d’une règle mal comprise : mettre à jour `CLAUDE.md` (règle n° 1) et la case de `LISTES_DE_CONTROLE.md`.
- Si un contrôle automatique aurait pu le voir : ajouter ce contrôle à `tools/controle/controle.js` (mode d’emploi : `tools/controle/README.md`).
