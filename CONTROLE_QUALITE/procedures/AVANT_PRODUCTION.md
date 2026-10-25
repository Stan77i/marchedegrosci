# Procédure : avant la production

> Avant d’appliquer un schéma en production, d’ouvrir le site au public, de lancer un essai fermé, un nouveau chantier ou le paiement. **Rien ne part en production sans l’accord écrit du propriétaire** (règle de `CLAUDE.md`).

## 1. Conditions d’entrée

| Condition | Preuve attendue |
|---|---|
| Contrôle général fait depuis moins de 3 jours, ou refait maintenant | `rapports/AAAA-MM-JJ-controle-general.md` (`procedures/CONTROLE_GENERAL.md`) |
| Aucune anomalie **P0** ouverte | `REGISTRE_ANOMALIES.md` |
| Chaque **P1** ouverte : corrigée et vérifiée, ou « risque accepté par le propriétaire » avec sa phrase écrite | `REGISTRE_ANOMALIES.md` |
| Tous les tests SQL liés aux schémas qui partent : rejoués sur le **test** après le dernier changement, résultat identique | lignes `SQL-…` du rapport, avec date |
| Fonctions du dépôt identiques à celles du test (md5 du corps, commentaires retirés) | liste G8 |
| `bash tools/controle/lancer.sh tout` : aucun échec bloquant | rapport daté |
| Captures des écrans touchés, clair et sombre, validées par le propriétaire | sa réponse écrite |

## 2. Audit de sécurité (obligatoire avant l’ouverture au public et avant le paiement)

- Liste I entière, droits de chaque fonction nouvelle (`anon`, `authenticated`), RLS de chaque table, `security definer` avec `search_path`, aucune clé secrète dans le front (U02).
- Rapport dans `docs/audits/`, aucun constat P0 ou P1 ouvert.

## 3. Avant le paiement, en plus

- Audit centré sur l’argent (U03) : séquestre, répartition, transport à part, commission « due » / « calculée ».
- Chercher partout les textes qui promettent ou nient un paiement et les aligner sur ce qui sera vrai.
- Aucune clé du partenaire de paiement dans le front.
- Partenaire agréé choisi et accord écrit du propriétaire.

## 4. Pendant le passage en production

- Schéma d’abord, fonction ensuite (règle des notifications de `CLAUDE.md`).
- Aucune requête de test en production. Après application : seulement `get_advisors` (lecture) et comparaison au passage précédent.

## 5. Après

- `bash tools/controle/lancer.sh tout` sur `main` à jour.
- Ligne dans `HISTORIQUE.md` ; ce qui n’a pas pu être vérifié en production est écrit « non exécuté », jamais « réussi ».
