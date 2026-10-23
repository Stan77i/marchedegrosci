-- ═════════ Schéma 77 (23/10/2026) — notes : chaque auteur ne compte qu'une fois par personne notée ═════════
-- Faille trouvée à l'audit : un même acheteur (ou un faux compte) pouvait gonfler la note d'un vendeur en laissant un avis
-- à chaque commande. Choix du propriétaire (23/10, sans dépense) : « un avis par personne ».
--   • _avis_uniques() : pour chaque (auteur, personne notée), seul l'avis le PLUS RÉCENT compte ;
--   • notes_publiques, mieux_notes, statuts_publics et reputation_publique (par rôle) calculent la note et le nombre d'avis avec lui ;
--   • avis_de2 renvoie toujours TOUS les avis (textes lisibles), avec deux indications en plus : « compte » (cet avis entre
--     dans la note) et « verifie » (l'auteur a une identité vérifiée) ; l'application calcule la moyenne avec les seuls avis qui comptent.
-- Aucun « drop » : une fonction nouvelle, les autres en create or replace (mêmes signatures, mêmes résultats sinon).

create or replace function public._avis_uniques()
returns table(auteur_id uuid, cible_id uuid, note smallint, quand timestamptz, role_cible text)
language sql stable security definer set search_path = public as $$
  select distinct on (a.auteur_id, a.cible_id) a.auteur_id, a.cible_id, a.note, a.quand, a.role_cible
  from public._avis_tous() a order by a.auteur_id, a.cible_id, a.quand desc;
$$;
revoke execute on function public._avis_uniques() from public, anon, authenticated;

create or replace function public.notes_publiques(ids uuid[])
returns table(user_id uuid, moyenne numeric, nombre integer)
language sql stable security definer set search_path = public as $$
  select a.cible_id, round(avg(a.note)::numeric, 1), count(*)::int from public._avis_uniques() a where a.cible_id = any (ids[1:200]) group by a.cible_id;
$$;

create or replace function public.mieux_notes(n integer default 30)
returns table(user_id uuid, affichage text, avatar text, role text, moyenne numeric, nombre integer, annonces integer)
language sql stable security definer set search_path = public as $$
  with s as (select cible_id, avg(note) m, count(*) c from public._avis_uniques() where not public.est_admin_id(cible_id) group by cible_id)
  select s.cible_id, coalesce(public.nom_public(s.cible_id), 'Membre'), p.avatar, p.role, round(s.m::numeric, 1), s.c::int,
         ((select count(*) from public.offres o where o.user_id = s.cible_id and o.status = 'active') + (select count(*) from public.demandes d where d.user_id = s.cible_id and d.status = 'active'))::int
  from s left join public.profils p on p.user_id = s.cible_id
  where p.supprime_le is null and not exists (select 1 from public.bannis b where b.user_id = s.cible_id)
  order by (s.c * s.m + 3 * 4.0) / (s.c + 3) desc, s.c desc limit least(greatest(n, 1), 100);
$$;

create or replace function public.statuts_publics(ids uuid[])
returns table(user_id uuid, verifie boolean, actif_le timestamptz, ventes integer, achats integer, note numeric, avis integer, contacts integer, reponses_24h integer, membre_depuis timestamptz)
language sql stable security definer set search_path = public as $$
  with u as (
    select x.id from unnest(ids[1:200]) as x(id)
    where not exists (select 1 from public.bannis b where b.user_id = x.id)
      and not exists (select 1 from public.profils p where p.user_id = x.id and p.supprime_le is not null)
  ),
  conclues as (
    select n.proprio_id, n.auteur_id, n.cible from public.negociations n
    where n.statut = 'conclue' and (n.proprio_id in (select id from u) or n.auteur_id in (select id from u))
  ),
  av as (select a.cible_id, a.note from public._avis_uniques() a where a.cible_id in (select id from u))
  select u.id,
    public.identite_ok(u.id),
    greatest(
      (select max(o.created_at) from public.offres o where o.user_id = u.id),
      (select max(d.created_at) from public.demandes d where d.user_id = u.id),
      (select max(m.created_at) from public.messages m where m.auteur_id = u.id),
      (select max(s.updated_at) from public.discussions s where s.dernier_par = u.id)),
    (select count(*)::int from conclues c where (c.cible like 'offre%' and c.proprio_id = u.id) or (c.cible like 'demande%' and c.auteur_id = u.id)),
    (select count(*)::int from conclues c where (c.cible like 'offre%' and c.auteur_id = u.id) or (c.cible like 'demande%' and c.proprio_id = u.id)),
    (select round(avg(av.note)::numeric, 1) from av where av.cible_id = u.id),
    (select count(*)::int from av where av.cible_id = u.id),
    (select count(*)::int from public.negociations n where n.proprio_id = u.id),
    (select count(*)::int from public.negociations n where n.proprio_id = u.id
       and exists (select 1 from public.messages m where m.negociation_id = n.id and m.auteur_id = u.id and m.created_at < n.created_at + interval '24 hours')),
    coalesce((select p.created_at from public.profils p where p.user_id = u.id), (select au.created_at from auth.users au where au.id = u.id))
  from u;
$$;

create or replace function public.reputation_publique(p_uid uuid)
returns json
language sql stable security definer set search_path = public as $$
  with
  c as (select * from public.commandes where p_uid in (vendeur_id, acheteur_id) and etat <> 'a_confirmer'),
  r as (
    select role,
      count(*) filter (where etat = 'terminee') terminees,
      count(*) filter (where etat = 'annulee' and annulation_par = p_uid) annul_demandees,
      count(*) filter (where etat = 'annulee') annulees,
      count(*) filter (where litige_par is not null and litige_par <> p_uid) litiges_contre,
      count(*) total
    from (select *, case when vendeur_id = p_uid then 'vendeur' else 'acheteur' end role from c) x group by role
  ),
  -- un avis par auteur et par rôle : le plus récent
  n as (select role_cible role, round(avg(note)::numeric, 1) moyenne, count(*) nombre
        from (select distinct on (k.auteur_id, k.role_cible) k.role_cible, k.note from public.avis_commandes k
              where k.cible_id = p_uid order by k.auteur_id, k.role_cible, k.updated_at desc) z
        group by role_cible),
  d as (
    select percentile_cont(0.5) within group (order by extract(epoch from (rc.at - cf.at)) / 3600.0) h, count(*) n
    from public.commandes k
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'confirmee') cf on true
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'reception') rc on true
    where k.vendeur_id = p_uid and k.etat = 'terminee' and cf.at is not null and rc.at is not null
  ),
  role_json as (
    select ro.role, json_build_object(
      'terminees', coalesce(r.terminees, 0), 'annulations_demandees', coalesce(r.annul_demandees, 0), 'annulees', coalesce(r.annulees, 0),
      'litiges_contre', coalesce(r.litiges_contre, 0), 'total', coalesce(r.total, 0),
      'note', n.moyenne, 'avis', coalesce(n.nombre, 0),
      'fiable', coalesce(r.terminees, 0) >= 5
                and coalesce(r.annul_demandees, 0) * 10 <= coalesce(r.total, 0)
                and coalesce(r.litiges_contre, 0) * 20 <= coalesce(r.total, 0)
                and coalesce(n.nombre, 0) >= 3 and n.moyenne >= 4.0) j
    from (values ('vendeur'), ('acheteur')) ro(role)
    left join r on r.role = ro.role left join n on n.role = ro.role
  )
  select json_build_object(
    'verifie', public.identite_ok(p_uid),
    'vendeur', (select j from role_json where role = 'vendeur'),
    'acheteur', (select j from role_json where role = 'acheteur'),
    'delai_median_h', (select case when n >= 3 then round(h::numeric, 0) end from d),
    'delai_n', (select n from d),
    'criteres_fiable', 'au moins 5 commandes terminées dans ce rôle, au plus 10 % d''annulations demandées, au plus 5 % de litiges ouverts par l''autre partie, au moins 3 avis de personnes différentes et une moyenne d''au moins 4/5',
    'ensemble', case when auth.uid() is not null and auth.uid() <> p_uid then
      (select count(*) from public.commandes x where x.etat = 'terminee'
        and ((x.vendeur_id = auth.uid() and x.acheteur_id = p_uid) or (x.vendeur_id = p_uid and x.acheteur_id = auth.uid()))) end)
  where not exists (select 1 from public.bannis b where b.user_id = p_uid)
    and not public.est_admin_id(p_uid);
$$;

create or replace function public.avis_de2(p_cible uuid)
returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.quand desc), '[]'::json) from (
    select a.note, a.texte, a.quand, a.role_cible role, c.produit,
      coalesce(public.nom_public(a.auteur_id), 'Un membre') auteur, p.avatar,
      row_number() over (partition by a.auteur_id order by a.quand desc) = 1 compte,   -- seul le plus récent de chaque auteur compte dans la note
      public.identite_ok(a.auteur_id) verifie
    from public._avis_tous() a
    left join public.commandes c on c.id = a.commande_id
    left join public.profils p on p.user_id = a.auteur_id and p.supprime_le is null
    where a.cible_id = p_cible order by a.quand desc limit 40) x;
$$;
