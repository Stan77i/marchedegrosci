-- ═════════ Marché de Gros CI — schéma 31 : prix par zone (lecture seule) ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucune table créée ni modifiée, aucun drop : une fonction de lecture.
--
-- prix_zones(produit) : pour un produit, par zone (district) et par unité :
--   • annonces : prix DEMANDÉS par les vendeurs (offres publiées, actives ou retirées, jamais celles masquées par la
--     modération), 90 derniers jours : nombre, vendeurs distincts, min, médiane, max, date du dernier prix ;
--   • disponible : quantité encore en vente sur les offres actives (le stock baisse déjà après chaque accord) ;
--   • budgets : prix PROPOSÉS par les acheteurs (demandes), 90 jours ;
--   • ventes : prix des commandes TERMINÉES (vente réalisée), 180 jours. Le prix n'est montré qu'avec au moins
--     3 ventes de 2 vendeurs différents : on ne révèle jamais le prix d'une vente isolée ;
--   • tendance : médiane des prix demandés des 30 derniers jours contre les 30 jours d'avant, seulement si chaque
--     période a au moins 3 prix de 2 vendeurs. Écart > 5 % : hausse ou baisse ; sinon stable. Sinon « insuffisant ».
--   • mois : médiane par mois sur 12 mois (toutes zones, unité principale), seulement les mois avec au moins 3 prix.
-- Rien n'est estimé ni complété : sans données, la réponse le dit. Un prix demandé n'est pas un prix garanti.
-- Lisible sans connexion (les offres et demandes actives sont déjà publiques) ; les ventes ne sortent qu'agrégées.

create or replace function public.prix_zones(p_produit text) returns json
language sql stable security definer set search_path = public as $$
with
ann as (
  select o.region_slug r, o.unit u, o.price p, o.user_id v, o.created_at at, o.status, o.quantity q
  from public.offres o
  where o.product_slug = p_produit and o.price > 0 and o.status in ('active', 'retiree')
    and o.created_at > now() - interval '90 days' and o.region_slug is not null and o.unit is not null
),
bud as (
  select d.region_slug r, d.unit u, d.budget p, d.created_at at
  from public.demandes d
  where d.product_slug = p_produit and d.budget > 0 and d.status in ('active', 'retiree')
    and d.created_at > now() - interval '90 days' and d.region_slug is not null and d.unit is not null
),
ven as (
  select coalesce(o.region_slug, d.region_slug) r, c.unite u, c.prix_unitaire p, c.vendeur_id v, c.termine_le at
  from public.commandes c
  join public.negociations n on n.id = c.negociation_id
  left join public.offres o on n.cible = 'offre' and o.id = n.cible_id
  left join public.demandes d on n.cible = 'demande' and d.id = n.cible_id
  where c.etat = 'terminee' and c.prix_unitaire > 0 and c.termine_le > now() - interval '180 days'
    and coalesce(o.product_slug, d.product_slug) = p_produit
),
cles as (select r, u from ann union select r, u from bud union select r, u from ven where r is not null),
z as (
  select k.r, k.u,
    (select json_build_object('n', count(*), 'vendeurs', count(distinct v), 'min', min(p), 'max', max(p),
        'mediane', percentile_cont(0.5) within group (order by p), 'dernier', max(at))
       from ann a where a.r = k.r and a.u = k.u) annonces,
    (select coalesce(sum(q), 0) from ann a where a.r = k.r and a.u = k.u and a.status = 'active') disponible,
    (select count(*) from ann a where a.r = k.r and a.u = k.u and a.status = 'active') actives,
    (select json_build_object('n', count(*), 'mediane', percentile_cont(0.5) within group (order by p), 'dernier', max(at))
       from bud b where b.r = k.r and b.u = k.u) budgets,
    (select case when count(*) >= 3 and count(distinct v) >= 2
              then json_build_object('n', count(*), 'mediane', percentile_cont(0.5) within group (order by p), 'dernier', max(at))
              else json_build_object('n', count(*), 'insuffisant', true) end
       from ven w where w.r = k.r and w.u = k.u) ventes,
    (select case when count(*) filter (where at > now() - interval '30 days') >= 3
                  and count(distinct v) filter (where at > now() - interval '30 days') >= 2
                  and count(*) filter (where at <= now() - interval '30 days' and at > now() - interval '60 days') >= 3
                  and count(distinct v) filter (where at <= now() - interval '30 days' and at > now() - interval '60 days') >= 2
            then (select json_build_object(
                    'sens', case when t.av = 0 then 'insuffisant' when (t.re - t.av) / t.av > 0.05 then 'hausse'
                                 when (t.re - t.av) / t.av < -0.05 then 'baisse' else 'stable' end,
                    'ecart_pct', case when t.av > 0 then round(((t.re - t.av) / t.av * 100)::numeric, 0) end,
                    'recent', t.re, 'avant', t.av)
                  from (select percentile_cont(0.5) within group (order by p) filter (where at > now() - interval '30 days') re,
                               percentile_cont(0.5) within group (order by p) filter (where at <= now() - interval '30 days' and at > now() - interval '60 days') av
                        from ann a2 where a2.r = k.r and a2.u = k.u) t)
            else json_build_object('sens', 'insuffisant') end
       from ann a where a.r = k.r and a.u = k.u) tendance
  from cles k
),
uprin as (select u from ann group by u order by count(*) desc limit 1),
mois as (
  select to_char(date_trunc('month', o.created_at), 'YYYY-MM') m, count(*) n, percentile_cont(0.5) within group (order by o.price) med
  from public.offres o
  where o.product_slug = p_produit and o.price > 0 and o.status in ('active', 'retiree')
    and o.created_at > now() - interval '12 months' and o.unit = (select u from uprin)
  group by 1 having count(*) >= 3 order by 1
)
select json_build_object(
  'produit', p_produit,
  'calcule_le', now(),
  'seuils', json_build_object('jours_annonces', 90, 'jours_ventes', 180, 'ventes_min', 3, 'tendance_min', 3, 'tendance_ecart_pct', 5),
  'zones', coalesce((select json_agg(json_build_object('region', z.r, 'unite', z.u, 'annonces', z.annonces, 'disponible', z.disponible,
              'actives', z.actives, 'budgets', z.budgets, 'ventes', z.ventes, 'tendance', z.tendance)
            order by (z.annonces->>'n')::int desc nulls last) from z), '[]'::json),
  'mois', json_build_object('unite', (select u from uprin), 'liste', coalesce((select json_agg(json_build_object('mois', m, 'n', n, 'mediane', med)) from mois), '[]'::json)))
where p_produit ~ '^[a-z0-9-]{1,80}$';
$$;
revoke all on function public.prix_zones(text) from public;
grant execute on function public.prix_zones(text) to anon, authenticated;
