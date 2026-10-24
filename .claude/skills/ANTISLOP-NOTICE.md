# antislop (anti « design et texte générés par IA »)

Ces 6 compétences viennent de https://github.com/miqdadbadjuber/anti-slop (licence MIT, © 2026 Miqdad Badjuber, fichier `LICENSE` dans chaque dossier), version 3.2.22, commit 671ab15 (23/10/2026). Copiées telles quelles, sauf `antislop-human/contrast-mcp.py` (serveur MCP inutile ici : le script `contrast-check.py` fait le même calcul).

| Compétence | Sert à |
|---|---|
| `antislop` | le cœur : 38 règles (R-01 à R-38) et le « Delivery Gate » (bilan PASS/FAIL avant de livrer) |
| `antislop-ui` | écrans : couleurs, mise en page, composants, décor, mouvement |
| `antislop-copywriting` | textes : titres, boutons, ton, faux chiffres, tournures « IA » |
| `antislop-human` | accessibilité : contraste, clavier, focus, états ; calculateur de contraste |
| `antislop-layoutmobile` | mise en page qui s'adapte du téléphone à l'ordinateur, cibles tactiles |
| `antislop-code` | commentaires de code inutiles à retirer (ne touche jamais au code) |

## Réglages propres au projet (décidés le 24/10/2026)

- **Pas de question au début de la discussion.** Le propriétaire veut qu'un mot suffise (`CLAUDE.md`). Le mode est donc fixé par le projet : **« pendant » (during)** pour tout travail ; **« après » (after)** quand on demande un audit, avec la liste des points dans `docs/anti-slop/audit-NNN-AAAA-MM-JJ.md`.
- **La direction, c'est `DESIGN.md`** (antislop n'est qu'un filtre). Les 32 lois de `DESIGN.md`, section 8, restent la référence ; antislop les complète.
- **Choix du projet qui ont une raison écrite** (antislop les signalerait sinon) :
  - icônes Lucide (`app/icones.js`) : un seul jeu, d'un seul trait, choisi pour la lisibilité ;
  - le petit point de l'entrée administrateur du site : une porte cachée voulue, pas un décor ;
  - la page de maintenance montrée au public : le site se construit caché (décision du propriétaire).
- Les textes sont en français : les règles d'`antislop-copywriting` s'appliquent pareil (pas de mots creux, pas de faux chiffres, pas de tiret long dans les phrases).

## Utiliser le calculateur de contraste

```
python3 .claude/skills/antislop-human/contrast-check.py "#655C4D" "#F2EBDD"
```

Mesurer le texte **sur son vrai fond** (par exemple dans une bulle foncée, pas sur la page).

## Mise à jour

Recopier `skills/*` du dépôt d'origine (sans `contrast-mcp.py`), garder les `LICENSE`, changer la version ci-dessus.
