# Glorious Destiny — consignes permanentes

Site et future application d'une marque beauté (perruques, cils, produits, prestations).
Rapports à la cliente en français ; travail direct dans le code, vérification mobile (390 px)
et ordinateur (1440 px), commit et push sur `main` (déploiement GitHub Pages).

- **Règle de l'antagoniste** : chaque action est conçue avec son geste inverse (ajouter ↔
  retirer, ouvrir ↔ fermer…), au même endroit, sans bouton supplémentaire. Voir DESIGN.md.
- Rien d'inventé : ni prix, ni stock, ni avis, ni chiffre, ni promotion, ni preuve sociale.
- Stock modifié uniquement par un mouvement de stock ; historique commercial archivé, jamais supprimé.
- Respecter `prefers-reduced-motion` ; jamais de fond vert ni violet derrière un produit.
- Aucune clé secrète dans le front (seule la clé publiable Supabase).
- Vérifications : `npm run -s check`, `bash scripts/test-db.sh`.
