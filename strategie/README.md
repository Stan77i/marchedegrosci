# Les PDF de stratégie du Marché de Gros CI

| PDF | Pour quoi faire |
|---|---|
| `1-Pitch.pdf` | Présenter le projet en 9 diapositives : investisseur, partenaire, concours. |
| `2-Presentation.pdf` | Le projet en détail : pour qui, comment ça marche, modèle économique, état. |
| `3-Probleme-et-solution.pdf` | Le problème précis auquel le projet répond, chiffres sourcés à l'appui, et la réponse de l'application. |
| `4-Marketing.pdf` | Comment remplir le marché sans budget : cibles, messages, canaux, plan en trois temps, indicateurs. |

Le détail du modèle économique (exemples, grille de calcul, questions pour les professionnels) est dans `docs/Marche-de-Gros-application-et-modele-economique.pdf`.

## D'où viennent les chiffres

Aucun chiffre n'est inventé.

- **L'application** : le nombre de produits, de familles et de régions, et les photos, sont lus dans le dépôt (`v2/data.js`, `v2/img/`).
- **L'activité** : les membres, les annonces actives et les commandes terminées sont lus dans la base par la fonction publique `stats_publiques()` (schéma 79). Elle ne renvoie que des totaux et utilise la clé publique de l'application, jamais une clé secrète. Si la base ne répond pas, ce sont les derniers chiffres connus qui servent (`sources/chiffres-base.json`).
- **Le marché ivoirien** : les chiffres sont dans `sources/donnees-marche.json`, chacun avec sa source, son année, son lien et la citation exacte. Ils sont numérotés dans le texte et listés à la fin de chaque PDF.

## Mettre à jour

- **Les chiffres** se mettent à jour tout seuls à chaque nouvelle fabrication.
- **Les textes** sont dans `sources/*.html`. Les valeurs entre `{{…}}` sont remplacées à la fabrication : `{{membres}}`, `{{produits}}`, `{{m:identifiant}}` pour un chiffre du marché, `{{sources}}` pour la liste des sources.
- **Fabriquer les PDF** : `node strategie/sources/construire.js`, ou `CHROMIUM=/chemin/vers/chrome node …` si Playwright ne trouve pas de navigateur. Un PDF n'est refait que si son contenu a changé (`sources/empreintes.json`).
- **Tout seul** : la tâche GitHub `.github/workflows/strategie-pdf.yml` refait les PDF chaque lundi matin (nouveaux chiffres de la base) et à chaque fusion qui touche les textes, le catalogue ou les photos. On peut aussi la lancer à la main : onglet **Actions** → « PDF de stratégie » → **Run workflow**.
- Claude met à jour les modèles et refait les PDF à chaque changement important du projet : c'est une règle de `CLAUDE.md`.
