-- ═════════ Marché de Gros CI — schéma 53 : l'activité de chaque produit, pour la petite bulle de la roue de l'accueil ═════════
-- Demandé par le propriétaire le 22/10/2026 : sur le sac du produit, une bulle de 5 secondes quand il est très vendu,
-- très demandé (ces 2 semaines) ou vendu il y a peu (« il y a une minute »).
-- Seulement des chiffres agrégés par produit : aucun nom, aucun numéro, aucun prix, aucune ville.
-- Lecture seule. Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée modifiée.

create or replace function public.produits_activite() returns json
language sql stable security definer set search_path = public as $$
  with ventes as (
    select coalesce(o.product_slug, d.product_slug) slug, count(*) n, max(n.conclu_le) dern
    from public.negociations n
    left join public.offres o on n.cible = 'offre' and o.id = n.cible_id
    left join public.demandes d on n.cible = 'demande' and d.id = n.cible_id
    where n.statut = 'conclue' and n.conclu_le > now() - interval '14 days'
    group by 1),
  negos as (
    select coalesce(o.product_slug, d.product_slug) slug, count(*) n
    from public.negociations n
    left join public.offres o on n.cible = 'offre' and o.id = n.cible_id
    left join public.demandes d on n.cible = 'demande' and d.id = n.cible_id
    where n.statut = 'ouverte' and n.updated_at > now() - interval '7 days'
    group by 1),
  dem as (select product_slug slug, count(*) n, max(created_at) dern from public.demandes where created_at > now() - interval '14 days' group by 1),
  forte as (select distinct product_slug slug from public.zones where kind = 'demande' and product_slug is not null and (expire_le is null or expire_le > now())),
  tous as (select slug from ventes union select slug from negos union select slug from dem union select slug from forte)
  select coalesce(json_agg(json_build_object(
      'slug', t.slug,
      'ventes', coalesce(v.n, 0), 'derniere_vente', v.dern,
      'demandes', coalesce(d.n, 0), 'derniere_demande', d.dern,
      'negociations', coalesce(g.n, 0),
      'forte_demande', f.slug is not null)), '[]')
  from tous t left join ventes v using (slug) left join negos g using (slug) left join dem d using (slug) left join forte f using (slug)
  where t.slug is not null
$$;
revoke all on function public.produits_activite() from public;
grant execute on function public.produits_activite() to anon, authenticated;
