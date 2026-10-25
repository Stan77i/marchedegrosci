#!/usr/bin/env bash
# Point d'entrée unique du contrôle qualité MGCI (centre de commande : CONTROLE_QUALITE/README.md).
# Exemples : bash tools/controle/lancer.sh statique | tout | navigateur | unite U04 | apres-modif | pr
# Le détail des modes et des options est en tête de tools/controle/lancer.js.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec node tools/controle/lancer.js "$@"
