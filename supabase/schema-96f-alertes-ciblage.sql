-- ═════════ Schéma 96f (24/10/2026) — alertes produits : tous les abonnés sont prévenus, pas seulement les 200 premiers ═════════
-- Audit P3 n° 35 : notif_cible_annonce (schéma 88b) gardait 200 personnes au plus, triées par identifiant : au-delà de 200
-- abonnés à un produit, toujours les mêmes étaient prévenus et les autres jamais.
-- Correction (seules les limites et l'ordre changent, les règles de ciblage restent celles du schéma 88b / 87) :
--   • les abonnés du produit (« suivi ») : tous, jusqu'à 2 000 ;
--   • les autres (déjà acheté, même région ; vendeurs du produit pour une demande) : 200 (vendeurs : 50) comme avant, mais tirés
--     dans un ordre qui change à chaque annonce (md5 de l'annonce et du compte) : chacun a sa chance, toujours de façon vérifiable.
-- Le rythme (8 par jour, 90 min, 21 h - 7 h, regroupement) reste appliqué à l'envoi par notif_lots_prendre / notif_preparer.

create or replace function public.notif_cible_annonce(p_table text, p_id uuid)
returns table(user_id uuid, raison text) language plpgsql stable security definer set search_path = public as $$
declare v_slug text; v_auteur uuid; v_region text; v_ville text; v_seule boolean;
begin
  if p_table = 'offres' then
    select o.product_slug, o.user_id, o.region_slug, o.city, coalesce(o.ville_seulement, false) into v_slug, v_auteur, v_region, v_ville, v_seule
    from public.offres o where o.id = p_id;
  elsif p_table = 'demandes' then
    select d.product_slug, d.user_id, d.region_slug, d.city, coalesce(d.ville_seulement, false) into v_slug, v_auteur, v_region, v_ville, v_seule
    from public.demandes d where d.id = p_id;
  else raise exception 'table inconnue'; end if;
  if v_slug is null then return; end if;

  if p_table = 'offres' then
    return query
    with c as (
      select a.user_id u, 1 rang, 'suivi'::text r from public.alertes_produits a where a.product_slug = v_slug and a.offres
      union all
      select k.acheteur_id, 2, 'deja_achete' from public.commandes k
      where k.etat = 'terminee' and coalesce(k.termine_le, k.updated_at) > now() - interval '365 days'
        and public._notif_slug_commande(k.id) = v_slug
      union all
      (select p.user_id, 3, 'region' from public.profils p
       where v_region is not null and p.region_slug = v_region and coalesce(p.role, 'acheteur') in ('acheteur', 'les_deux')
         and exists (select 1 from public.push_abonnements s where s.user_id = p.user_id) limit 500)
    ), u as (
      select distinct on (c.u) c.u, c.rang, c.r from c where c.u is not null and c.u <> v_auteur order by c.u, c.rang
    ), ok as (
      select u.u, u.rang, u.r from u
      left join public.profils p on p.user_id = u.u
      where public._notif_joignable(u.u)
        and (not v_seule or public._ville_cle(p.ville) = public._ville_cle(v_ville))
    )
    (select ok.u, ok.r from ok where ok.rang = 1 order by md5(p_id::text || ok.u::text) limit 2000)
    union all
    (select ok.u, ok.r from ok where ok.rang > 1 order by ok.rang, md5(p_id::text || ok.u::text) limit 200);
  else
    return query
    with v as (
      select o.user_id u, (o.region_slug is not distinct from v_region) meme, o.city vil from public.offres o
      where o.product_slug = v_slug and o.status = 'active'
      union all
      select k.vendeur_id, false, null::text from public.commandes k
      where k.etat = 'terminee' and coalesce(k.termine_le, k.updated_at) > now() - interval '365 days'
        and public._notif_slug_commande(k.id) = v_slug
    ), vend as (
      select v.u, bool_or(v.meme) meme, bool_or(v_seule and public._ville_cle(v.vil) = public._ville_cle(v_ville)) dans_ville
      from v where v.u is not null and v.u <> v_auteur group by v.u
    ), vend_ok as (
      select vend.u, case when vend.meme or p.region_slug is not distinct from v_region then 2 else 3 end rang
      from vend left join public.profils p on p.user_id = vend.u
      where public._notif_joignable(vend.u)
        and (not v_seule or vend.dans_ville or public._ville_cle(p.ville) = public._ville_cle(v_ville))
      order by 2, md5(p_id::text || vend.u::text)
      limit 50
    ), suiv as (
      select a.user_id u from public.alertes_produits a left join public.profils p on p.user_id = a.user_id
      where a.product_slug = v_slug and a.demandes and a.user_id <> v_auteur and public._notif_joignable(a.user_id)
        and (not v_seule or public._ville_cle(p.ville) = public._ville_cle(v_ville))
      order by md5(p_id::text || a.user_id::text)
      limit 2000
    ), tout as (
      select suiv.u, 1 rang, 'suivi'::text r from suiv
      union all select vend_ok.u, vend_ok.rang, case when vend_ok.rang = 2 then 'vendeur_region' else 'vendeur' end from vend_ok
    )
    select distinct on (tout.u) tout.u, tout.r from tout order by tout.u, tout.rang;
  end if;
end $$;
revoke execute on function public.notif_cible_annonce(text, uuid) from public, anon, authenticated;
grant execute on function public.notif_cible_annonce(text, uuid) to service_role;
