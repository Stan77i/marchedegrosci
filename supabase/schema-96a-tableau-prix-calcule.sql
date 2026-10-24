-- ═════════ Schéma 96a (24/10/2026) — tableau des prix calculé d'avance, résumé des annonces plus léger ═════════
-- Audit P2 n° 23 : tableau_produits(null) prenait 3,8 à 4,3 s sur le test (90 144 offres actives), à chaque ouverture du tableau.
-- Correction :
--   • tableau_prix_cache : une ligne par région (« » = tout le pays), le JSON déjà prêt ; recalculé toutes les 5 min (tâche mdg-prix) ;
--   • tableau_produits(p_region) lit ce JSON (même forme qu'avant) ; s'il manque, il est calculé une fois ;
--   • « meilleure offre », « meilleure demande » et médiane : seulement les annonces de moins de 30 jours (date de création ou de
--     dernière modification) et sans prix aberrant (hors [médiane/5 ; médiane×5] pour le même produit et la même unité).
--     Les nombres d'annonces comptent toujours toutes les annonces actives ;
--   • annonces_version() : ne compte plus les 90 000 annonces actives à chaque appel ; il lit seulement le maj_le le plus récent
--     de chaque table, par l'index (toute écriture le change : déclencheur du schéma 76). Une ligne effacée pour de bon ne le
--     change pas (les annonces ne sont plus effacées depuis le schéma 86 : « retirer » change leur statut, donc maj_le).
-- Ajouts seulement (create … if not exists, create or replace) ; aucune donnée existante n'est modifiée.

create table if not exists public.tableau_prix_cache (
  region     text primary key,          -- '' = tout le pays
  donnees    json not null default '[]'::json,
  calcule_le timestamptz not null default now()
);
alter table public.tableau_prix_cache enable row level security;   -- aucune politique : lu seulement par tableau_produits (security definer)
revoke all on public.tableau_prix_cache from anon, authenticated;

-- calcule le tableau d'une région (ou du pays si p_region est null), sans écrire
create or replace function public._tableau_prix_json(p_region text)
returns json language sql stable security definer set search_path = public as $$
  with o as (select product_slug, coalesce(nullif(product_label, ''), product_slug) lab, unit, price, created_at,
                    greatest(created_at, maj_le) >= now() - interval '30 days' recent
             from public.offres where status = 'active' and (p_region is null or region_slug = p_region)),
       d as (select product_slug, coalesce(nullif(product_label, ''), product_slug) lab, unit, budget, created_at,
                    greatest(created_at, maj_le) >= now() - interval '30 days' recent
             from public.demandes where status = 'active' and (p_region is null or region_slug = p_region)),
       ro as (select * from o where recent and price > 0), rd as (select * from d where recent and budget > 0),
       uo as (select product_slug, mode() within group (order by unit) u from ro group by 1),
       ud as (select product_slug, mode() within group (order by unit) u from rd group by 1),
       mo as (select ro.product_slug, percentile_cont(0.5) within group (order by price) m from ro join uo on uo.product_slug = ro.product_slug and ro.unit = uo.u group by 1),
       md as (select rd.product_slug, percentile_cont(0.5) within group (order by budget) m from rd join ud on ud.product_slug = rd.product_slug and rd.unit = ud.u group by 1),
       so as (select ro.product_slug, min(price) meilleure, percentile_cont(0.5) within group (order by price) mediane
              from ro join uo on uo.product_slug = ro.product_slug and ro.unit = uo.u join mo on mo.product_slug = ro.product_slug
              where price between mo.m / 5 and mo.m * 5 group by 1),
       sd as (select rd.product_slug, max(budget) meilleure
              from rd join ud on ud.product_slug = rd.product_slug and rd.unit = ud.u join md on md.product_slug = rd.product_slug
              where budget between md.m / 5 and md.m * 5 group by 1),
       co as (select product_slug, count(*) n, max(lab) lab, max(created_at) maj from o group by 1),
       cd as (select product_slug, count(*) n, max(lab) lab, max(created_at) maj from d group by 1),
       p as (select coalesce(co.product_slug, cd.product_slug) slug, greatest(co.lab, cd.lab) lab, greatest(co.maj, cd.maj) maj,
                    coalesce(co.n, 0) n_offres, coalesce(cd.n, 0) n_demandes
             from co full join cd on cd.product_slug = co.product_slug)
  select coalesce(json_agg(r order by r.n desc, r.maj desc), '[]'::json) from (
    select p.slug, p.lab, p.maj, p.n_offres, p.n_demandes, p.n_offres + p.n_demandes n,
      uo.u unite_offre, so.meilleure meilleure_offre, so.mediane mediane_offre,
      ud.u unite_demande, sd.meilleure meilleure_demande
    from p left join uo on uo.product_slug = p.slug left join so on so.product_slug = p.slug
           left join ud on ud.product_slug = p.slug left join sd on sd.product_slug = p.slug
    order by 6 desc, p.maj desc limit 80) r;
$$;
revoke execute on function public._tableau_prix_json(text) from public, anon, authenticated;

-- recalcule toutes les régions (tâche mdg-prix, toutes les 5 min) ; une région sans annonce garde une ligne vide '[]'
create or replace function public.tableau_prix_calculer()
returns integer language plpgsql security definer set search_path = public as $$
declare r text; n integer := 0; t0 timestamptz := clock_timestamp();
begin
  insert into public.tableau_prix_cache (region, donnees, calcule_le) values ('', public._tableau_prix_json(null), t0)
    on conflict (region) do update set donnees = excluded.donnees, calcule_le = excluded.calcule_le;
  for r in select distinct region_slug from (select region_slug from public.offres where status = 'active'
                                              union select region_slug from public.demandes where status = 'active') x
           where region_slug is not null and region_slug <> '' loop
    insert into public.tableau_prix_cache (region, donnees, calcule_le) values (r, public._tableau_prix_json(r), t0)
      on conflict (region) do update set donnees = excluded.donnees, calcule_le = excluded.calcule_le;
    n := n + 1;
  end loop;
  update public.tableau_prix_cache set donnees = '[]'::json, calcule_le = t0 where calcule_le < t0;
  return n;
end $$;
revoke execute on function public.tableau_prix_calculer() from public, anon, authenticated;

-- même nom, mêmes paramètres, même forme de réponse qu'avant : le téléphone ne change pas
create or replace function public.tableau_produits(p_region text default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare j json;
begin
  select donnees into j from public.tableau_prix_cache where region = coalesce(p_region, '');
  if j is null then j := public._tableau_prix_json(p_region); end if;   -- pas encore calculé (avant le premier passage de mdg-prix)
  return j;
end $$;
revoke execute on function public.tableau_produits(text) from public;
grant execute on function public.tableau_produits(text) to anon, authenticated;

-- le résumé change dès qu'une annonce est écrite ; maj_le le plus récent est lu par l'index offres_maj_le / demandes_maj_le
create or replace function public.annonces_version() returns text
language sql stable security definer set search_path = public as $$
  select concat_ws('|',
    (select extract(epoch from max(maj_le))::numeric(20, 6) from public.offres),
    (select extract(epoch from max(maj_le))::numeric(20, 6) from public.demandes));
$$;
revoke execute on function public.annonces_version() from public;
grant execute on function public.annonces_version() to anon, authenticated;

-- tâche planifiée : le tableau des prix toutes les 5 minutes
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'mdg-prix') then
    perform cron.schedule('mdg-prix', '*/5 * * * *', 'select public.tableau_prix_calculer()');
  end if;
end $$;
select public.tableau_prix_calculer();
