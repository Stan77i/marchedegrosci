-- ═════════ Marché de Gros CI — schéma 32 : réputation fondée sur les commandes terminées ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée effacée (la table avis était vide le 21/10/2026 ;
-- elle reste en place, en lecture, pour l'historique).
--
-- Règles :
--   • un avis ne se donne qu'après une commande TERMINÉE, par le vendeur ou l'acheteur de cette commande, sur l'autre partie,
--     dans les 30 jours qui suivent ; un seul avis par personne et par commande (contrainte unique) ;
--   • modifiable par son auteur pendant 24 h, puis figé (personne ne peut réécrire l'historique) ;
--   • la note est rangée selon le RÔLE de la personne notée : réputation de vendeur et réputation d'acheteur séparées ;
--   • l'ancienne fonction noter() (avis après une simple négociation) refuse désormais avec une phrase claire ;
--   • reputation_publique(uid) : par rôle, note, commandes honorées, annulations demandées, litiges ouverts par l'autre partie,
--     délai médian entre confirmation et réception ; badge « fiable » calculé par le serveur sur des critères publics ;
--     « vérifié » (identité) reste une information à part : vérifié ne veut pas dire fiable ;
--   • fidélité : nombre de commandes terminées ensemble (historique_commun), visible par les deux seuls intéressés.
--   • retards : il n'existe pas encore de date de livraison promise dans une commande ; on ne compte donc pas de « retard »
--     inventé, on montre le délai réel. (À ajouter avec une date promise si le propriétaire le souhaite.)

create table if not exists public.avis_commandes (
  id           uuid primary key default gen_random_uuid(),
  commande_id  uuid not null references public.commandes (id) on delete cascade,
  auteur_id    uuid not null,
  cible_id     uuid not null,
  role_cible   text not null check (role_cible in ('vendeur', 'acheteur')),
  note         smallint not null check (note between 1 and 5),
  texte        text check (char_length(texte) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (commande_id, auteur_id),
  check (auteur_id <> cible_id)
);
create index if not exists avis_commandes_cible on public.avis_commandes (cible_id, role_cible, created_at desc);
alter table public.avis_commandes enable row level security;
revoke all on public.avis_commandes from anon, authenticated;

-- Tous les avis (anciens + par commande), pour les fonctions de lecture.
create or replace function public._avis_tous() returns table (auteur_id uuid, cible_id uuid, note smallint, texte text, quand timestamptz, role_cible text, commande_id uuid)
language sql stable security definer set search_path = public as $$
  select a.auteur_id, a.cible_id, a.note, a.texte, a.updated_at, null::text, null::uuid from public.avis a
  union all
  select k.auteur_id, k.cible_id, k.note, k.texte, k.updated_at, k.role_cible, k.commande_id from public.avis_commandes k;
$$;
revoke all on function public._avis_tous() from public, anon, authenticated;

-- Donner (ou corriger dans les 24 h) son avis sur une commande terminée.
create or replace function public.avis_commande_donner(p_cmd uuid, p_note int, p_texte text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; cible uuid; role_c text; t text; r text; a public.avis_commandes;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or me not in (c.vendeur_id, c.acheteur_id) then raise exception 'Commande introuvable.'; end if;
  if c.etat <> 'terminee' then raise exception 'L''avis se donne quand la commande est terminée.'; end if;
  if c.termine_le < now() - interval '30 days' then raise exception 'Le délai de 30 jours pour donner un avis est passé.'; end if;
  if p_note is null or p_note not between 1 and 5 then raise exception 'Une note de 1 à 5 étoiles.'; end if;
  if me = c.vendeur_id then cible := c.acheteur_id; role_c := 'acheteur'; else cible := c.vendeur_id; role_c := 'vendeur'; end if;
  if public.est_admin_id(cible) then raise exception 'Le Marché de Gros officiel ne reçoit pas de note.'; end if;
  t := nullif(btrim(left(p_texte, 300)), '');
  if t is not null and not public.est_admin() then r := public.texte_refus(t); if r is not null then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if; end if;
  select * into a from public.avis_commandes where commande_id = c.id and auteur_id = me for update;
  if a.id is null then
    insert into public.avis_commandes (commande_id, auteur_id, cible_id, role_cible, note, texte)
      values (c.id, me, cible, role_c, p_note, t) returning * into a;
  elsif a.created_at > now() - interval '24 hours' then
    update public.avis_commandes set note = p_note, texte = t, updated_at = now() where id = a.id returning * into a;
  else
    raise exception 'Votre avis est figé : il ne se modifie plus après 24 heures.';
  end if;
  return json_build_object('note', a.note, 'texte', a.texte, 'modifiable_jusqua', a.created_at + interval '24 hours');
end $$;

-- Mon avis sur une commande, et si je peux encore le donner ou le corriger.
create or replace function public.avis_commande_moi(p_cmd uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'peut', c.etat = 'terminee' and c.termine_le >= now() - interval '30 days'
            and (a.id is null or a.created_at > now() - interval '24 hours')
            and not public.est_admin_id(case when auth.uid() = c.vendeur_id then c.acheteur_id else c.vendeur_id end),
    'note', a.note, 'texte', a.texte,
    'modifiable_jusqua', a.created_at + interval '24 hours',
    'recu', (select json_build_object('note', b.note, 'texte', b.texte) from public.avis_commandes b where b.commande_id = c.id and b.cible_id = auth.uid()),
    'ensemble', (select count(*) from public.commandes x where x.etat = 'terminee'
                   and ((x.vendeur_id = c.vendeur_id and x.acheteur_id = c.acheteur_id) or (x.vendeur_id = c.acheteur_id and x.acheteur_id = c.vendeur_id))))
  from public.commandes c
  left join public.avis_commandes a on a.commande_id = c.id and a.auteur_id = auth.uid()
  where c.id = p_cmd and auth.uid() in (c.vendeur_id, c.acheteur_id);
$$;

-- L'ancienne notation (après une simple négociation) est fermée.
create or replace function public.noter(p_cible uuid, p_note integer, p_texte text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'AVIS_APRES_COMMANDE : les avis se donnent maintenant après une commande terminée, depuis Mes commandes.';
end $$;
create or replace function public.peut_noter(p_cible uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('peut', false, 'raison', 'apres_commande', 'note', null, 'texte', null);
$$;

-- Lectures existantes : mêmes signatures, nourries par les deux sources.
create or replace function public.notes_publiques(ids uuid[]) returns table (user_id uuid, moyenne numeric, nombre integer)
language sql stable security definer set search_path = public as $$
  select a.cible_id, round(avg(a.note)::numeric, 1), count(*)::int from public._avis_tous() a where a.cible_id = any (ids[1:200]) group by a.cible_id;
$$;
create or replace function public.avis_de(p_cible uuid) returns table (note smallint, texte text, quand timestamptz, auteur text, avatar text)
language sql stable security definer set search_path = public as $$
  select a.note, a.texte, a.quand, coalesce(public.nom_public(a.auteur_id), 'Un membre'), p.avatar
  from public._avis_tous() a left join public.profils p on p.user_id = a.auteur_id and p.supprime_le is null
  where a.cible_id = p_cible order by a.quand desc limit 30;
$$;
create or replace function public.mieux_notes(n integer default 30) returns table (user_id uuid, affichage text, avatar text, role text, moyenne numeric, nombre integer, annonces integer)
language sql stable security definer set search_path = public as $$
  with s as (select cible_id, avg(note) m, count(*) c from public._avis_tous() where not public.est_admin_id(cible_id) group by cible_id)
  select s.cible_id, coalesce(public.nom_public(s.cible_id), 'Membre'), p.avatar, p.role, round(s.m::numeric, 1), s.c::int,
         ((select count(*) from public.offres o where o.user_id = s.cible_id and o.status = 'active') + (select count(*) from public.demandes d where d.user_id = s.cible_id and d.status = 'active'))::int
  from s left join public.profils p on p.user_id = s.cible_id
  where p.supprime_le is null and not exists (select 1 from public.bannis b where b.user_id = s.cible_id)
  order by (s.c * s.m + 3 * 4.0) / (s.c + 3) desc, s.c desc limit least(greatest(n, 1), 100);
$$;

-- Avis détaillés (avec le rôle et le produit), pour le profil.
create or replace function public.avis_de2(p_cible uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.quand desc), '[]'::json) from (
    select a.note, a.texte, a.quand, a.role_cible role, c.produit,
      coalesce(public.nom_public(a.auteur_id), 'Un membre') auteur, p.avatar
    from public._avis_tous() a
    left join public.commandes c on c.id = a.commande_id
    left join public.profils p on p.user_id = a.auteur_id and p.supprime_le is null
    where a.cible_id = p_cible order by a.quand desc limit 40) x;
$$;

-- Réputation par rôle, calculée par le serveur.
create or replace function public.reputation_publique(p_uid uuid) returns json
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
  n as (select role_cible role, round(avg(note)::numeric, 1) moyenne, count(*) nombre from public.avis_commandes where cible_id = p_uid group by role_cible),
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
    'criteres_fiable', 'au moins 5 commandes terminées dans ce rôle, au plus 10 % d''annulations demandées, au plus 5 % de litiges ouverts par l''autre partie, au moins 3 avis et une moyenne d''au moins 4/5',
    'ensemble', case when auth.uid() is not null and auth.uid() <> p_uid then
      (select count(*) from public.commandes x where x.etat = 'terminee'
        and ((x.vendeur_id = auth.uid() and x.acheteur_id = p_uid) or (x.vendeur_id = p_uid and x.acheteur_id = auth.uid()))) end)
  where not exists (select 1 from public.bannis b where b.user_id = p_uid)
    and not public.est_admin_id(p_uid);
$$;

revoke all on function public.avis_commande_donner(uuid, int, text), public.avis_commande_moi(uuid) from public, anon;
grant execute on function public.avis_commande_donner(uuid, int, text), public.avis_commande_moi(uuid) to authenticated;
revoke all on function public.avis_de2(uuid), public.reputation_publique(uuid) from public;
grant execute on function public.avis_de2(uuid), public.reputation_publique(uuid) to anon, authenticated;

-- statuts_publics (même signature) : sa note et son nombre d'avis lisent désormais les deux sources.
do $$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'statuts_publics' and pronamespace = 'public'::regnamespace;
  if position('from public.avis a where a.cible_id = u.id' in src) > 0 then
    src := replace(src, 'from public.avis a where a.cible_id = u.id', 'from public._avis_tous() a where a.cible_id = u.id');
    execute format($f$create or replace function public.statuts_publics(ids uuid[]) returns table (user_id uuid, verifie boolean, actif_le timestamptz, ventes integer, achats integer, note numeric, avis integer, contacts integer, reponses_24h integer, membre_depuis timestamptz) language sql stable security definer set search_path = public as %L$f$, src);
  end if;
end $$;
