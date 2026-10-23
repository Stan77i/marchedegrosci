# Dossier pour Claude Design

Ce dossier sert à **modifier le design avec Claude Design**, sans qu'il ait à fouiller tout le dépôt.
Il est **refait automatiquement** à partir des vrais fichiers après chaque fusion : ne rien y écrire à la main.

| Pour modifier… | Dire à Claude Design d'ouvrir |
|---|---|
| **l'application** (téléphone) | `claude-design/application/` |
| **le nouveau site caché** (ordinateur) | `claude-design/site/` |

Chaque dossier existe aussi en un seul fichier à téléverser : `claude-design/application.zip` et `claude-design/site.zip`.
Lien de téléchargement direct :
- https://github.com/Stan77i/marchedegrosci/raw/main/claude-design/application.zip
- https://github.com/Stan77i/marchedegrosci/raw/main/claude-design/site.zip

## Quoi dire à Claude Design (à copier-coller)

Pour l'application :

> Ouvre le dossier `claude-design/application/` du dépôt Stan77i/marchedegrosci (ou le fichier application.zip). Lis d'abord `CONSIGNES.md`, puis regarde les captures dans `captures/`. Je veux changer : … (décrire ici ce qu'il faut changer).

Pour le site :

> Ouvre le dossier `claude-design/site/` du dépôt Stan77i/marchedegrosci (ou le fichier site.zip). Lis d'abord `CONSIGNES.md`, puis regarde les captures dans `captures/`. Je veux changer : …

## Après Claude Design

Claude Design rend les fichiers modifiés et un fichier `CHANGEMENTS.md`.
Les envoyer à Claude Code (dans la discussion) : il reporte les changements dans les vrais fichiers, vérifie dans un navigateur et ouvre la pull request.
Ces copies ne sont **pas** le code de l'application : modifier ce dossier ne change rien en ligne.
