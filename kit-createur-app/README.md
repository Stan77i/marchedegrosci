# Kit créateur d'app

La boîte à outils tirée de Glorious Destiny, à réutiliser dans tous les prochains projets
(site, application mobile installable, boutique, tableau de bord).

## Contenu

- `skills/references-app-premium/` : **la mission**. Elle contient :
  - les sites de référence étudiés et ce qu'on a pris à chacun ;
  - la méthode complète, de l'audit à la mise en ligne ;
  - les règles permanentes ;
  - la recette PWA avec les mises à jour automatiques ;
  - deux exemples complets : le `DESIGN.md` et le `CLAUDE.md` de Glorious Destiny.
- `skills/reverse-audit/` : étudier un site, une application ou une capture (méthode Awesome-REA, script de capture).
- `skills/carrousel-beaute/` : diaporama premium et accessible.
- `skills/impeccable/`, `skills/ui-ux-pro-max/` : design d'interface.
- `skills/antislop*/` : éviter le rendu générique (interface, mobile, textes, accessibilité, code).
- `skills/playwright-cli/` : piloter le navigateur et tester.

## Installer dans un autre projet

À la racine du nouveau projet :

```bash
mkdir -p .claude/skills && cp -r /chemin/vers/kit-createur-app/skills/* .claude/skills/
```

Puis, au premier message à Claude dans ce projet :

> Charge le skill references-app-premium et suis la mission.

Ou, sans copier les fichiers à la main, depuis le dépôt GitHub :

```bash
git clone --depth 1 https://github.com/Stan77i/marchedegrosci /tmp/gd && mkdir -p .claude/skills && cp -r /tmp/gd/kit-createur-app/skills/* .claude/skills/
```
