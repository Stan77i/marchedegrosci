# Batteries navigateur des unités

- Nom : `Uxx-<sujet>.js` (exemple : U10-hors-ligne.js). Lancées par `bash tools/controle/lancer.sh navigateur`, `tout` ou `unite Uxx`, en local et chaque jour sur GitHub.
- Variables reçues : `CQ_URL` (adresse du serveur local qui sert le dépôt, finit par `/`), `PLAYWRIGHT_MODULE` (à passer à `require`), `CHROMIUM` (chemin du navigateur, absent sur GitHub : lancer alors sans `executablePath`), `CQ_RACINE`.
- iPhone émulé (`devices['iPhone 13']`), sinon la page de maintenance s’affiche ; réseau extérieur coupé (`page.route`) et réponses Supabase injectées.
- Code de sortie : `0` réussi, `3` bloqué (prérequis absent), autre = échoué. Les 3 dernières lignes affichées vont dans le rapport : y écrire le résumé (ID des tests et statut).
- 10 minutes au plus par fichier. Aucune capture dans le dépôt.
