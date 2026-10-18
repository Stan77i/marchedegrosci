# Tesseract.js (lecture de la bande MRZ des pièces d'identité)

Chargé seulement quand une personne fait vérifier son identité (`v3/identite.js`), jamais au démarrage.

| Fichier | Origine | Licence |
| --- | --- | --- |
| `tesseract.min.js`, `worker.min.js` | npm `tesseract.js@7.0.0` (`dist/`) | Apache-2.0 (`LICENSE-tesseract.js.md`) |
| `core/tesseract-core-relaxedsimd-lstm.wasm.js`, `core/tesseract-core-simd-lstm.wasm.js`, `core/tesseract-core-lstm.wasm.js` (le navigateur prend la plus rapide qu’il sait faire tourner) | npm `tesseract.js-core@7.0.0` | Apache-2.0 (`core/LICENSE`) |
| `lang/eng.traineddata.gz` | npm `@tesseract.js-data/eng@1.0.0`, dossier `4.0.0_best_int` (modèle Tesseract `tessdata_best` entier) | Apache-2.0 (modèle Tesseract), paquet MIT |

Tout tourne dans le téléphone : aucune image n'est envoyée à un service de lecture.
