-- ═════════ Schéma 70 (23/10/2026) — tableau du marché : les 50 meilleures annonces par unité, avec les vrais totaux ═════════
-- Mesuré par la simulation (projet de test) : tableau_marche renvoyait TOUTES les annonces actives d'un produit ;
-- avec 3 000 offres pour un produit, une seule réponse pesait 1,85 Mo (relue toutes les 30 s quand l'onglet est ouvert).
-- Correction :
--   • au plus 50 offres et 50 demandes PAR UNITÉ (kg, sac…), dans le même ordre qu'avant (prix, transport, fiabilité,
--     identité vérifiée, commandes honorées, date) : ce sont celles que le membre regarde ;
--   • la réputation n'est calculée que pour les annonces gardées (on coupe d'abord par prix et transport, ex æquo gardés) ;
--   • à égalité parfaite (même prix, transport, fiabilité… et même date), l'ordre est fixé par l'identifiant : il ne saute plus
--     d'une relecture à l'autre (évitait de faux « ↑ monte ») ;
--   • nouveau champ « totaux » : le vrai nombre d'offres et de demandes par unité, pour que l'application affiche les bons compteurs.
-- Même signature, mêmes champs qu'avant (plus « totaux ») : create or replace, aucun « drop ».

create or replace function public.tableau_marche(p_slug text, p_region text default null::text) returns json
language sql stable security definer set search_path to 'public' as $function$
  with a0 as (
    select 'offre' sens, o.id, o.user_id, o.price prix, o.unit, o.quantity, o.qte_min, o.city, o.region_slug, o.transport, o.negociable, o.created_at, o.available_from::text dispo,
      case o.transport when 'inclus' then 0 when 'hors_ville' then 1 else 2 end tr_rang
    from public.offres o where o.status = 'active' and o.product_slug = p_slug and (p_region is null or o.region_slug = p_region)
    union all
    select 'demande', d.id, d.user_id, d.budget, d.unit, d.quantity, null, d.city, d.region_slug, d.transport, d.negociable, d.created_at, d.deadline::text,
      case d.transport when 'acheteur' then 0 when 'vendeur' then 1 else 2 end
    from public.demandes d where d.status = 'active' and d.product_slug = p_slug and (p_region is null or d.region_slug = p_region)
  ),
  t as (select sens, coalesce(unit, '') u, count(*) n from a0 group by 1, 2),
  -- première coupe, sans la réputation : prix (meilleur d'abord) puis transport ; les ex æquo sont tous gardés
  a as (select * from (select a0.*, rank() over (partition by sens, coalesce(unit, '')
          order by (prix is null), case when sens = 'offre' then prix else -prix end, tr_rang) rk1 from a0) z where rk1 <= 50),
  u as (select distinct user_id from a where user_id is not null),
  rep as (select u.user_id, public.reputation_publique(u.user_id) j from u),
  r0 as (
    select a.*, coalesce(public.nom_public(a.user_id), 'Membre') nom,
      coalesce((rep.j->>'verifie')::boolean, false) verifie,
      coalesce((rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'fiable')::boolean, false) fiable,
      coalesce((rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'terminees')::int, 0) terminees,
      (rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'note')::numeric note,
      public.est_admin_id(a.user_id) officiel
    from a left join rep on rep.user_id = a.user_id
  ),
  -- coupe finale : le classement complet d'avant, 50 par unité
  r as (select * from (select r0.*, row_number() over (partition by sens, coalesce(unit, '')
          order by (prix is null), case when sens = 'offre' then prix else -prix end, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc, id) rk from r0) z where rk <= 50)
  select json_build_object(
    'slug', p_slug,
    'lab', (select coalesce(nullif(product_label, ''), product_slug) from (select product_label, product_slug from public.offres where product_slug = p_slug
              union all select product_label, product_slug from public.demandes where product_slug = p_slug) x limit 1),
    'regions', (select coalesce(json_agg(json_build_object('slug', region_slug, 'n', n) order by n desc), '[]'::json)
                from (select region_slug, count(*) n from (select region_slug from public.offres where status = 'active' and product_slug = p_slug
                      union all select region_slug from public.demandes where status = 'active' and product_slug = p_slug) z where region_slug is not null group by 1) y),
    'totaux', json_build_object(
      'offres', (select coalesce(json_object_agg(t.u, t.n), '{}'::json) from t where t.sens = 'offre'),
      'demandes', (select coalesce(json_object_agg(t.u, t.n), '{}'::json) from t where t.sens = 'demande')),
    'offres', (select coalesce(json_agg(json_build_object('id', id, 'prix', prix, 'unite', unit, 'quantite', quantity, 'qte_min', qte_min, 'ville', city, 'region', region_slug,
                 'transport', transport, 'negociable', negociable, 'le', created_at, 'dispo', dispo, 'nom', nom, 'verifie', verifie, 'fiable', fiable, 'terminees', terminees, 'note', note, 'officiel', officiel)
                 order by (prix is null), prix asc, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc, id), '[]'::json)
               from r where sens = 'offre'),
    'demandes', (select coalesce(json_agg(json_build_object('id', id, 'prix', prix, 'unite', unit, 'quantite', quantity, 'ville', city, 'region', region_slug,
                 'transport', transport, 'negociable', negociable, 'le', created_at, 'echeance', dispo, 'nom', nom, 'verifie', verifie, 'fiable', fiable, 'terminees', terminees, 'note', note, 'officiel', officiel)
                 order by (prix is null), prix desc, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc, id), '[]'::json)
               from r where sens = 'demande'));
$function$;
