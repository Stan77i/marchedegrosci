# Icônes et couleurs : la logique

## Principe
Une icône = une **tuile** de 40 px (56 px sur les pages d'aide), teintée par son **sens**, avec une icône au trait de 22 px. Pas d'animation. Même jeu partout (menu, aide, notifications, boutons de la carte).

- Jeu d'icônes : Lucide (celui de shadcn/ui), licence ISC, embarqué dans `app/icones.js` (7,8 Ko, 38 icônes). On ne charge que les icônes utilisées.
- Ajouter une icône : l'inscrire dans `tools/icones/build.py` (nom de sens → nom Lucide), puis `python3 tools/icones/build.py <lucide-static>/icons`.
- Utilisation : `MDGIco.svg('vendre')` (chaîne SVG) ; dans l'application `tuile('vendre', 'offre')` ou `ico('vendre:offre')`.

## La couleur dit le sens (`css/mgci-tokens.css`, `--ton-*`)
Ces couleurs reprennent les codes déjà présents : rond vert = offre, carré jaune = demande, triangle violet = vous, trait bleu = lien.

| Ton | Sens | Exemples |
|---|---|---|
| vert `offre` | ce que je vends | Vendre, Mes publications et mon stock |
| jaune `demande` | ce que je cherche ou j'attends | Demander, Alertes produits |
| violet `vous` | moi | Acheter (je cherche), Compte, Mon profil public |
| bleu `lien` | l'échange entre deux personnes | Négociations, Messages, « Vous échangez ici » |
| terracotta `marche` | le marché lui-même | Le réseau, Catégories, Prix, L'année, Les mieux notés |
| sable `aide` | comprendre, se protéger | Comment ça marche, Aide producteur, Confiance |

Contraste de l'icône sur le tiroir (#211D17) : de 6,7:1 (violet) à 10,6:1 (jaune).

## Rôles façon shadcn/ui
`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--ring`, `--radius` : on nomme le rôle, pas la couleur. Les nouveaux composants (`.ui-tile`, `.ui-count`, `.ui-toast`, `.fam-pill` dans `css/mgci-app.css`) n'utilisent que ces noms.

## Pourquoi pas shadcn/ui en React
L'application est une page statique sans build (GitHub Pages) ; React + Tailwind + Radix/Base UI ajouteraient une chaîne de construction et des centaines de Ko. On reprend ce qui fait la qualité de shadcn — rôles de couleur, primitives cohérentes, icônes Lucide — sans le poids.
