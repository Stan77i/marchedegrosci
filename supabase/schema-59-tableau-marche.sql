-- ═════════ Marché de Gros CI — schéma 59 : le tableau du marché (philosophie Binance P2P) ═════════
-- Demandé par le propriétaire le 22/10/2026 : une liste des offres et des demandes, très bien placée dans l'application,
-- où l'annonce la plus alléchante monte en haut. Si quelqu'un baisse son prix (ou monte son budget), il remonte.
-- Comme sur Binance P2P :
--   • onglet « Acheter » = les offres des vendeurs, du MOINS cher au plus cher ;
--   • onglet « Vendre »  = les demandes des acheteurs, du budget le PLUS haut au plus bas ;
--   • à prix égal : transport compris d'abord (pour l'acheteur) / l'acheteur prend le transport d'abord (pour le vendeur),
--     puis le membre fiable, puis l'identité vérifiée, puis le plus de commandes honorées, puis le plus récent ;
--   • on ne compare que des prix dans la MÊME unité (kg, sac, régime…) : l'application choisit l'unité, le serveur trie ;
--   • filtre par zone (région).
-- Le seul intermédiaire, c'est le Marché de Gros : la liste ne montre jamais de numéro ni de contact, on échange dans l'application.
-- Données publiques (lisibles sans compte), comme le reste du marché. Appliqué par Claude avec l'outil Supabase. Aucun drop.

-- ——— Vue d'ensemble : un résumé par produit (meilleure offre, meilleure demande, dans l'unité la plus courante) ———
create or replace function public.tableau_produits(p_region text default null) returns json
language sql stable security definer set search_path = public as $$
  with o as (select product_slug, coalesce(nullif(product_label, ''), product_slug) lab, unit, price, created_at
             from public.offres where status = 'active' and (p_region is null or region_slug = p_region)),
       d as (select product_slug, coalesce(nullif(product_label, ''), product_slug) lab, unit, budget, created_at
             from public.demandes where status = 'active' and (p_region is null or region_slug = p_region)),
       uo as (select product_slug, mode() within group (order by unit) u from o where price is not null group by 1),
       ud as (select product_slug, mode() within group (order by unit) u from d where budget is not null group by 1),
       p as (select product_slug, max(lab) lab, max(created_at) maj from (select product_slug, lab, created_at from o union all select product_slug, lab, created_at from d) x group by 1)
  select coalesce(json_agg(r order by r.n desc, r.maj desc), '[]'::json) from (
    select p.product_slug slug, p.lab, p.maj,
      (select count(*) from o where o.product_slug = p.product_slug) n_offres,
      (select count(*) from d where d.product_slug = p.product_slug) n_demandes,
      (select count(*) from o where o.product_slug = p.product_slug) + (select count(*) from d where d.product_slug = p.product_slug) n,
      uo.u unite_offre, (select min(price) from o where o.product_slug = p.product_slug and o.unit = uo.u) meilleure_offre,
      (select percentile_cont(0.5) within group (order by price) from o where o.product_slug = p.product_slug and o.unit = uo.u) mediane_offre,
      ud.u unite_demande, (select max(budget) from d where d.product_slug = p.product_slug and d.unit = ud.u) meilleure_demande
    from p left join uo on uo.product_slug = p.product_slug left join ud on ud.product_slug = p.product_slug
    order by 6 desc, p.maj desc limit 80) r;
$$;

-- ——— Le tableau d'un produit : toutes les annonces actives, classées ———
create or replace function public.tableau_marche(p_slug text, p_region text default null) returns json
language sql stable security definer set search_path = public as $$
  with a as (
    select 'offre' sens, o.id, o.user_id, o.price prix, o.unit, o.quantity, o.qte_min, o.city, o.region_slug, o.transport, o.negociable, o.created_at, o.available_from dispo,
      case o.transport when 'inclus' then 0 when 'hors_ville' then 1 else 2 end tr_rang
    from public.offres o where o.status = 'active' and o.product_slug = p_slug and (p_region is null or o.region_slug = p_region)
    union all
    select 'demande', d.id, d.user_id, d.budget, d.unit, d.quantity, null, d.city, d.region_slug, d.transport, d.negociable, d.created_at, d.deadline,
      case d.transport when 'acheteur' then 0 when 'vendeur' then 1 else 2 end
    from public.demandes d where d.status = 'active' and d.product_slug = p_slug and (p_region is null or d.region_slug = p_region)
  ),
  u as (select distinct user_id from a where user_id is not null),
  rep as (select u.user_id, public.reputation_publique(u.user_id) j from u),
  r as (
    select a.*, coalesce(public.nom_public(a.user_id), 'Membre') nom,
      coalesce((rep.j->>'verifie')::boolean, false) verifie,
      coalesce((rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'fiable')::boolean, false) fiable,
      coalesce((rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'terminees')::int, 0) terminees,
      (rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'note')::numeric note,
      public.est_admin_id(a.user_id) officiel
    from a left join rep on rep.user_id = a.user_id
  )
  select json_build_object(
    'slug', p_slug,
    'lab', (select coalesce(nullif(product_label, ''), product_slug) from (select product_label, product_slug from public.offres where product_slug = p_slug
              union all select product_label, product_slug from public.demandes where product_slug = p_slug) x limit 1),
    'regions', (select coalesce(json_agg(json_build_object('slug', region_slug, 'n', n) order by n desc), '[]'::json)
                from (select region_slug, count(*) n from (select region_slug from public.offres where status = 'active' and product_slug = p_slug
                      union all select region_slug from public.demandes where status = 'active' and product_slug = p_slug) z where region_slug is not null group by 1) y),
    'offres', (select coalesce(json_agg(json_build_object('id', id, 'prix', prix, 'unite', unit, 'quantite', quantity, 'qte_min', qte_min, 'ville', city, 'region', region_slug,
                 'transport', transport, 'negociable', negociable, 'le', created_at, 'dispo', dispo, 'nom', nom, 'verifie', verifie, 'fiable', fiable, 'terminees', terminees, 'note', note, 'officiel', officiel)
                 order by (prix is null), prix asc, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc), '[]'::json)
               from r where sens = 'offre'),
    'demandes', (select coalesce(json_agg(json_build_object('id', id, 'prix', prix, 'unite', unit, 'quantite', quantity, 'ville', city, 'region', region_slug,
                 'transport', transport, 'negociable', negociable, 'le', created_at, 'echeance', dispo, 'nom', nom, 'verifie', verifie, 'fiable', fiable, 'terminees', terminees, 'note', note, 'officiel', officiel)
                 order by (prix is null), prix desc, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc), '[]'::json)
               from r where sens = 'demande'));
$$;

revoke all on function public.tableau_produits(text), public.tableau_marche(text, text) from public;
grant execute on function public.tableau_produits(text), public.tableau_marche(text, text) to anon, authenticated;
