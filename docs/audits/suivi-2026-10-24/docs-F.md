# Équipe F : textes à ajouter aux documents partagés

## docs/PASSATION.md (nouvelle section)

### Projets de textes juridiques (audit P1 n° 5), 24/10/2026
- Branche `claude/conditions-utilisation`. Dossier `docs/juridique/` : `LISEZMOI.md`, `conditions-utilisation.md`, `confidentialite.md`, `mentions-legales.md`, `regles-manquantes.md`.
- Statut : **PROJET, à faire relire par un juriste. Rien n'est en ligne.** Aucune case d'acceptation branchée, aucun texte affiché dans l'application ni sur le site.
- Chaque règle cite sa source dans le code (`<!-- source: … -->`). Marques : [À VALIDER], [À VALIDER PAR LE JURISTE], [DÉCISION DU PROPRIÉTAIRE], [À REMPLIR], [À VÉRIFIER AVANT PUBLICATION].
- Découvertes faites en lisant le code :
  - l'équipe peut lire **toutes** les conversations sans condition (`admin_discussions`, `admin_dm`, schéma 10) ;
  - messages privés gardés 1 an (`dm_duree`, schéma 60) ; positions du chauffeur 30 jours (schéma 29) ; dossiers d'identité 5 ans (schéma 16) ; rien n'est fixé pour le reste ;
  - sur la carte, les deux points d'un trajet (parfois la position GPS) partent vers le serveur public de démonstration OSRM (`app/carte-gl.js`) ;
  - après suppression du compte, le numéro reste bloqué (`supprimer_compte`, schéma 4) ;
  - « ville seulement » est une option de l'annonce (`ville_seulement`), pas une obligation ;
  - région du serveur Supabase inconnue dans le dépôt.
- 32 décisions attendues du propriétaire : `docs/juridique/regles-manquantes.md`.

## FONCTIONNALITES.md (ligne)
- Conditions d'utilisation, confidentialité, mentions légales : **projets** dans `docs/juridique/`, à faire relire par un juriste. Pas en ligne, pas d'acceptation à l'inscription.

## CHANGELOG.md (ligne)
- 24/10/2026 : projets de conditions d'utilisation, politique de confidentialité, mentions légales et liste des règles manquantes (`docs/juridique/`). Non publiés.

## ROADMAP.md (ligne)
- Avant l'ouverture : relecture juridique des textes de `docs/juridique/`, formalité ARTCI, puis affichage et acceptation à l'inscription.

## docs/REPRISE.md (ce qui reste)
- Le propriétaire répond aux 32 questions de `docs/juridique/regles-manquantes.md` ; trouver un juriste ; vérifier la formalité ARTCI.

## docs/A-FAIRE-PROPRIETAIRE.md (cases)
- [ ] Répondre aux questions de `docs/juridique/regles-manquantes.md`.
- [ ] Remplir `docs/juridique/mentions-legales.md` (éditeur, adresse, RCCM, contact).
- [ ] Trouver un juriste pour relire les textes et la formalité ARTCI.

## PORTAGE-SITE.md partie 4
- Rien : aucune nouveauté de l'application.
