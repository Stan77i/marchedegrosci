# Compétences ponytail et Agent Reach

Ajoutées le 13/11/2026 à la demande du propriétaire.

## ponytail (6 compétences)

- Origine : `DietrichGebert/ponytail` (commit `96608e0`), licence MIT (fichier `LICENSE` gardé dans chaque dossier).
- Dossiers : `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`. Seuls les fichiers `SKILL.md` sont copiés : pas de crochets (« hooks »), pas de barre d'état, pas de mise à jour automatique.
- À quoi ça sert : écrire le moins de code possible pour régler un problème (réutiliser ce qui existe, pas de dépendance inutile), relire une modification (`/ponytail-review`) ou tout le dépôt (`/ponytail-audit`), lister les raccourcis laissés exprès (`/ponytail-debt`).
- Règles du projet qui passent avant ponytail :
  - réponses au propriétaire **en français simple**, même si la compétence parle d'anglais ;
  - « le moins de code » ne retire jamais ce que `CLAUDE.md` demande : captures avant la PR, documentation, passation, tableau de bord, contrôle qualité, tests SQL sur le projet de test ;
  - un audit (`/ponytail-audit`) est une liste de constats : rien n'est corrigé sans l'accord du propriétaire.
- Mise à jour : recopier les `SKILL.md` depuis `skills/` du dépôt d'origine.

## Agent Reach (1 compétence)

- Origine : `Panniantong/Agent-Reach` (version 1.6.1, commit `c70ae6d`), licence MIT (fichier `LICENSE` gardé).
- Dossier : `agent-reach` (texte anglais de la compétence ; les fichiers de `references/` sont en chinois, comme à l'origine). La table des canaux, fabriquée normalement à l'installation, est remplacée par la commande `agent-reach channels`.
- À quoi ça sert : lire (jamais écrire) du contenu public sur Facebook, Instagram, X, Reddit, YouTube (sous-titres), GitHub… Utile pour la veille marketing et les concurrents.
- **Elle a besoin du programme `agent-reach`**, qui n'est pas dans le dépôt. Son installation a été refusée par les garde-fous de la session du 13/11/2026 : il faut l'accord du propriétaire pour l'installer (commande officielle dans `docs/install.md` du dépôt d'origine, jamais le paquet PyPI du même nom, qui n'est pas ce projet). Sans ce programme, la compétence se contente de rappeler d'utiliser les outils de recherche habituels.
- Règles : lecture seule ; ne jamais se connecter à la place du propriétaire, ne jamais demander de mot de passe ou de cookie ; aucun chiffre repris sans source vérifiée (règle du projet).
