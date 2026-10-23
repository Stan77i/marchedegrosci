# Consignes pour Claude Design : l'application Marché de Gros CI

Tu travailles sur le **design** de l'application mobile Marché de Gros CI (marché du vivrier en gros en Côte d'Ivoire).
Ce dossier est une **copie** préparée pour toi. Le propriétaire n'est pas développeur : parle-lui en **français simple**.

## 1. Ce que contient ce dossier

| Dossier / fichier | Contenu | Tu peux le modifier ? |
|---|---|---|
| `DESIGN.md` | **La référence du design** : couleurs, police, espaces, composants, et les 32 lois anti-« design généré par IA » (section 8). À lire en premier. | Non (propose les changements dans `CHANGEMENTS.md`) |
| `PRODUCT.md` | Qui utilise l'application et pourquoi. | Non |
| `captures/` | L'application telle qu'elle est aujourd'hui, en clair et en sombre (iPhone). Sans compte connecté et sans données en direct : les listes peuvent être vides. | — |
| `styles/` | **Tous les styles (CSS)** de l'application. `mgci-tokens.css` = les couleurs et tailles ; `mgci-app.css` = les écrans ; `sombre.css` = le mode nuit ; `00-dans-la-page.css` = les animations écrites dans la page. | **Oui, surtout ici** |
| `ecrans/` | La structure (HTML) de chaque écran, un fichier par écran. `SOMMAIRE.md` dit quel fichier correspond à quel écran. | Oui, avec prudence (voir 3) |
| `dessins/` | Les dessins faits en code : icônes, logo, sac, personnages du marché (avatars). | Seulement si on te le demande |

## 2. Les règles du propriétaire (à respecter toujours)

- **Une seule police : Jost.**
- « de Gros » toujours en **maïs `#F2C230`**.
- **Ne jamais écrire « PAYÉ »** (le paiement n'est pas branché).
- La **tomate** se montre **en carton**, pas en sac.
- Un accord conclu est en **vert**, jamais en bleu.
- Les nombres à côté d'un libellé sont **dans une pastille** (classe `.nbul`), jamais un chiffre nu ni entre parenthèses.
- Avatars (personnages du marché) : calmes au repos (respirer, cligner des yeux) ; ils sautent **seulement** quand il y a du nouveau.
- Vie privée : jamais de numéro de téléphone ni de nom complet affiché à un autre membre.
- **Mode clair et mode sombre** : tout changement doit marcher dans les deux (`sombre.css`).
- Fait pour le **téléphone** : zones à toucher de 44 px au moins, texte jamais en dessous de 11,5 px.
- Pas de néon, pas de violet « tech », pas de dégradés décoratifs (voir `DESIGN.md`).

## 3. Ce qu'il ne faut pas casser dans `ecrans/`

L'application est écrite dans un format où le HTML contient des repères lus par le programme. **Ne change pas, ne supprime pas, ne renomme pas** :
- les balises `<sc-if …>` et `<sc-for …>` (afficher si…, répéter pour chaque…) ;
- tout ce qui est entre doubles accolades `{{ … }}` ;
- les attributs `onClick`, `onScroll`, `onInput`… et les attributs `data-…` ;
- les noms de classes déjà utilisés (tu peux en **ajouter**).

Tu peux changer : l'ordre visuel (par le CSS de préférence), les textes visibles, les classes ajoutées, les styles.
**Préfère toujours modifier le CSS** (`styles/`) plutôt que la structure.

## 4. Comment rendre ton travail

1. Rends les **fichiers modifiés en entier**, avec **le même nom** et le même dossier (exemple : `styles/mgci-app.css`, `ecrans/05-accueil.html`).
2. Ajoute un fichier **`CHANGEMENTS.md`** : pour chaque changement, l'écran concerné, ce qui change, et pourquoi, en phrases simples.
3. Si tu fais une maquette ou un aperçu, joins-le aussi (image ou HTML) : il sert de modèle.

Le propriétaire enverra ces fichiers à Claude Code, qui les reporte dans le vrai code, vérifie sur iPhone (clair et sombre) et prépare la mise à jour.
