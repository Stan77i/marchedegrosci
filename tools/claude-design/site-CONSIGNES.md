# Consignes pour Claude Design : le nouveau site Marché de Gros CI

Tu travailles sur le **design** du nouveau site public de Marché de Gros CI (marché du vivrier en gros en Côte d'Ivoire).
Le site est encore **caché** (seul l'administrateur le voit). Il est fait **pour l'ordinateur** : c'est une vitrine qui montre en direct ce qui se passe dans l'application et donne envie de l'installer. Sur téléphone, c'est l'application qui s'ouvre.
Ce dossier est une **copie** préparée pour toi. Le propriétaire n'est pas développeur : parle-lui en **français simple**.

## 1. Ce que contient ce dossier

| Dossier / fichier | Contenu | Tu peux le modifier ? |
|---|---|---|
| `DESIGN.md` | **La référence du design** (couleurs, police, composants, 32 lois anti-« design généré par IA »). À lire en premier. | Non (propose dans `CHANGEMENTS.md`) |
| `captures/` | Les pages entières telles qu'elles sont aujourd'hui (écran d'ordinateur 1440 px), sans les données en direct : les listes d'annonces et de prix sont vides. | — |
| `styles/site.css` | **Tous les styles du site.** | **Oui, surtout ici** |
| `gabarits/` | Les modèles des pages : `_debut.html` / `_entete.html` / `_fin.html` (haut et bas communs), `index.html` (accueil), `produit.html`, `region.html`, `guide.html`, `saisons.html`, `carte.html`, `a-propos.html`… `SOMMAIRE.md` les explique. | Oui, avec prudence (voir 3) |
| `gabarits/guides/` | Le texte des guides. | Le texte : seulement si on te le demande |
| `scripts/` | Ce qui fait vivre la page (annonces et prix en direct, carte). Pour comprendre seulement. | Non |

## 2. Les règles du propriétaire (à respecter toujours)

- **Une seule police : Jost.** « de Gros » toujours en **maïs `#F2C230`**.
- **Ne jamais écrire « PAYÉ ».**
- **Aucun chiffre inventé** : les chiffres du site viennent de sources vérifiées ou de l'application en direct. Ne mets pas de faux chiffres, faux avis ou faux témoignages, même pour décorer.
- Vie privée : prénom ou initiale, ville, produit, quantité. Jamais de numéro ni de nom complet.
- Les nombres à côté d'un libellé sont **dans une pastille** (`.nbul`).
- Le site doit rester **lisible sans JavaScript** (Google lit le HTML) et léger.
- Le site n'a **qu'un thème** (fond crème, bandeaux vert profond) : pas de mode sombre à prévoir, sauf demande.
- Pas de néon, pas de violet « tech », pas de dégradés décoratifs.

## 3. Ce qu'il ne faut pas casser dans `gabarits/`

Les pages sont **fabriquées** par un programme à partir de ces modèles. **Ne change pas, ne supprime pas** :
- les repères entre doubles accolades `{{ … }}` (ils sont remplacés par le titre, le produit, etc.) ;
- les commentaires spéciaux `<!--@ … -->` ;
- les attributs `id="…"`, `data-…` (les scripts s'en servent pour mettre les annonces et les prix en direct) ;
- les noms de classes déjà utilisés (tu peux en **ajouter**).

**Préfère toujours modifier le CSS** (`styles/site.css`) plutôt que la structure.

## 4. Comment rendre ton travail

1. Rends les **fichiers modifiés en entier**, avec **le même nom** et le même dossier (exemple : `styles/site.css`, `gabarits/index.html`).
2. Ajoute un fichier **`CHANGEMENTS.md`** : pour chaque changement, la page concernée, ce qui change, et pourquoi, en phrases simples.
3. Si tu fais une maquette ou un aperçu, joins-le aussi.

Le propriétaire enverra ces fichiers à Claude Code, qui les reporte dans le vrai code, refait les pages, vérifie dans un navigateur et prépare la mise à jour.
