-- ═════════ Schéma 69 (23/10/2026) — index par produit sur les offres et les demandes ═════════
-- Mesuré par la simulation (projet de test, 100 000 offres et 50 000 demandes) :
--   • tableau_marche('mais') : 1 187 ms sans index → 36 ms avec ;
--   • prix_zones('mais')     :   253 ms sans index → 8,4 ms avec ;
--   • rafale de 100 ouvertures du marché : 3 erreurs 500 (délai dépassé) sans index → 0 erreur, p95 7,7 s → 3,9 s.
-- Ces fonctions filtrent par product_slug ; aucun index n'existait sur cette colonne (seulement par date et par compte).
-- Ajout seulement (create index if not exists), rien n'est supprimé. Les réponses des fonctions ne changent pas.

create index if not exists offres_produit   on public.offres   (product_slug);
create index if not exists demandes_produit on public.demandes (product_slug);
