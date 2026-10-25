-- Schéma 101a : profil public, les totaux seulement pour un visiteur sans compte (décision juridique n° 21, décision 43 du 24/10/2026).
-- Sans compte (auth.uid() vide) : présentation, totaux (ventes, achats, transactions, annonces), rien de plus.
-- « volumes », « lieux » et « historique » valent null ; « detail » = false dit à l'écran que le détail est réservé aux membres connectés.
-- Membre connecté : inchangé (detail = true). Même signature, même type de retour : l'application n'a pas à changer d'appel.
create or replace function public.profil_public(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'user_id', u.id,
    'affichage', case when public.est_admin_id(u.id) then 'Marché de Gros' else coalesce(public.nom_public(u.id), 'Membre') end,
    'officiel', public.est_admin_id(u.id),
    'avatar', p.avatar, 'role', p.role, 'bio', p.bio, 'activites', p.activites, 'photos', coalesce(p.photos, '{}'),
    'region_slug', p.region_slug, 'ville', p.ville,
    'membre_depuis', u.created_at,
    'detail', auth.uid() is not null,
    'vu_le', case when auth.uid() is not null then greatest(u.last_sign_in_at,
      (select max(vu_le) from public.push_abonnements pa where pa.user_id = u.id),
      (select max(created_at) from public.dm where auteur_id = u.id),
      (select max(created_at) from public.messages where auteur_id = u.id),
      (select max(created_at) from public.offres where user_id = u.id),
      (select max(created_at) from public.demandes where user_id = u.id)) end,
    'ventes', (select count(*) from public.negociations g where g.statut = 'conclue' and ((g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id))),
    'achats', (select count(*) from public.negociations g where g.statut = 'conclue' and ((g.cible = 'offre' and g.auteur_id = u.id) or (g.cible = 'demande' and g.proprio_id = u.id))),
    'transactions', (select count(*) from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id)),
    'volumes', case when auth.uid() is not null then (select coalesce(json_agg(v order by v.sens desc, v.quantite desc), '[]') from (
        select case when (g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id) then 'vente' else 'achat' end as sens,
               coalesce(g.unite, 'unité') as unite, sum(coalesce(g.quantite_finale, g.quantite)) as quantite
        from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id) and coalesce(g.quantite_finale, g.quantite) is not null
        group by 1, 2) v) end,
    'offres_actives', (select count(*) from public.offres where user_id = u.id and status = 'active'),
    'demandes_actives', (select count(*) from public.demandes where user_id = u.id and status = 'active'),
    'annonces_total', (select count(*) from public.offres where user_id = u.id) + (select count(*) from public.demandes where user_id = u.id),
    'lieux', case when auth.uid() is not null then (select coalesce(json_agg(distinct x.l), '[]') from (select coalesce(nullif(city, ''), region_slug) l from public.offres where user_id = u.id union select coalesce(nullif(city, ''), region_slug) from public.demandes where user_id = u.id) x where x.l is not null) end,
    'historique', case when auth.uid() is not null then (select coalesce(json_agg(h order by h.quand desc), '[]') from (
        select g.produit, g.quantite_finale as quantite, g.unite, g.ville, coalesce(g.conclu_le, g.updated_at) as quand,
               case when (g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id) then 'vente' else 'achat' end as sens
        from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id)
        order by coalesce(g.conclu_le, g.updated_at) desc limit 12) h) end)
  from auth.users u left join public.profils p on p.user_id = u.id
  where u.id = p_uid and (p.user_id is null or p.supprime_le is null);
$$;
