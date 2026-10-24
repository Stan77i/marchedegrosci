-- Schéma 96a : scénarios du tableau des prix calculé d'avance (projet de TEST seulement ; tout est annulé par l'exception finale).
-- 1. un prix aberrant (1 F le kg) ne devient pas « meilleure offre » ;
-- 2. une offre de plus de 30 jours ne compte pas pour le prix (mais compte dans le nombre d'offres) ;
-- 3. une offre récente et normale moins chère devient la meilleure offre après le recalcul ;
-- 4. tableau_produits lit le JSON gardé (même forme qu'avant).
do $$
declare u uuid; r text; avant json; apres json; m0 numeric; m1 numeric; m2 numeric; n0 int; n1 int;
begin
  select user_id, region_slug into u, r from public.offres where status = 'active' and product_slug = 'prod-1' limit 1;
  perform public.tableau_prix_calculer();
  avant := public.tableau_produits(null);
  select (e->>'meilleure_offre')::numeric, (e->>'n_offres')::int into m0, n0 from json_array_elements(avant) e where e->>'slug' = 'prod-1';
  -- déclencheurs mis de côté dans ce bloc annulé (limite de publication du compte de simulation, maj_le fixé à la main)
  set local session_replication_role = replica;
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (u, 'test96-aberrant', 'prod-1', 'TEST VOL Produit 1', r, 'Abidjan', 10, 'kg', 1, 'active'),
           (u, 'test96-vieille', 'prod-1', 'TEST VOL Produit 1', r, 'Abidjan', 10, 'kg', 50, 'active');
  update public.offres set created_at = now() - interval '40 days', maj_le = now() - interval '40 days' where client_id = 'test96-vieille' and user_id = u;
  perform public.tableau_prix_calculer();
  select (e->>'meilleure_offre')::numeric, (e->>'n_offres')::int into m1, n1 from json_array_elements(public.tableau_produits(null)) e where e->>'slug' = 'prod-1';
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (u, 'test96-normale', 'prod-1', 'TEST VOL Produit 1', r, 'Abidjan', 10, 'kg', m0 - 5, 'active');
  perform public.tableau_prix_calculer();
  select (e->>'meilleure_offre')::numeric into m2 from json_array_elements(public.tableau_produits(null)) e where e->>'slug' = 'prod-1';
  raise exception 'TEST: avant meilleure=% n=% | +aberrante(1)+vieille(50) meilleure=% n=% | +normale(%) meilleure=%', m0, n0, m1, n1, m0 - 5, m2;
end $$;
