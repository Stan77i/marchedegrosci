-- ═════════ Marché de Gros CI — schéma 18 : signaler une personne avec des preuves, ou par le nombre (18 octobre 2026) ═════════
-- À lancer APRÈS schema-15-signalements-purge.sql. Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 18 octobre 2026.)
-- Aucun « drop » : l'ancienne fonction signaler_membre (5 paramètres) reste et demande de mettre l'application à jour.
--
-- Règles :
--   • Description obligatoire (15 caractères au moins).
--   • Une PREUVE est demandée : jusqu'à 3 photos / captures d'écran (espace de stockage PRIVÉ « preuves »),
--     ou la conversation d'où part le signalement (discussion ou négociation : l'équipe peut la lire).
--   • Sans preuve, la personne coche « Je n'ai pas de preuve » : le signalement compte seulement pour le NOMBRE.
--   • Priorité : un compte signalé par au moins 3 personnes différentes en 30 jours, ou avec une preuve, passe
--     « à examiner en priorité » dans le tableau de bord. Rien de public, aucune sanction automatique.
--   • Une même personne ne peut signaler le même compte qu'une fois tous les 7 jours (et 10 signalements par jour au plus).

-- ——— 1) colonnes ———
alter table public.signalements_membres add column if not exists preuves text[] not null default '{}';
alter table public.signalements_membres add column if not exists sans_preuve boolean not null default false;
create index if not exists signalements_membres_auteur on public.signalements_membres (auteur_id, cible_id, created_at desc);

-- ——— 2) espace de stockage privé « preuves » : <auteur>/<nom>.jpg ———
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preuves', 'preuves', false, 450000, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 450000, allowed_mime_types = array['image/jpeg'];

do $d$
begin
  -- déposer : seulement dans son propre dossier
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'preuves : déposer') then
    create policy "preuves : déposer" on storage.objects for insert to authenticated
      with check (bucket_id = 'preuves' and split_part(name, '/', 1) = (select auth.uid())::text);
  end if;
  -- lire : seulement l'administrateur (liens signés courts)
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'preuves : lecture admin') then
    create policy "preuves : lecture admin" on storage.objects for select to authenticated
      using (bucket_id = 'preuves' and (select public.est_admin()));
  end if;
end $d$;

-- ——— 3) signaler ———
-- ancienne version : demande la mise à jour (mêmes paramètres et valeurs par défaut qu'avant)
create or replace function public.signaler_membre(p_cible uuid, p_motif text, p_detail text default null, p_source text default 'profil', p_ref uuid default null)
returns void language plpgsql volatile security definer set search_path = public as $f$
begin raise exception 'Mettez l''application à jour : un signalement demande maintenant une preuve.'; end $f$;

create or replace function public.signaler_membre(p_cible uuid, p_motif text, p_detail text, p_source text, p_ref uuid,
    p_preuves text[], p_sans_preuve boolean)
returns json language plpgsql volatile security definer set search_path = public, storage as $f$
declare me uuid := auth.uid(); n int; dernier timestamptz; d text := nullif(btrim(p_detail), '');
        src text := case when p_source in ('dm', 'negociation', 'profil') then p_source else 'profil' end;
        pr text[] := coalesce(p_preuves, '{}'); conv boolean; personnes int; x text;
begin
  if me is null then raise exception 'Connectez-vous pour signaler une personne.'; end if;
  if p_cible is null or p_cible = me then raise exception 'Signalement impossible.'; end if;
  if p_motif not in ('arnaque', 'insultes', 'mauvais_produits', 'autre') then raise exception 'Motif inconnu.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if d is null or char_length(d) < 15 then raise exception 'Expliquez en une phrase ce qui s''est passé (15 caractères au moins).'; end if;
  if cardinality(pr) > 3 then raise exception '3 photos au plus.'; end if;
  foreach x in array pr loop
    if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
      raise exception 'Une photo n''a pas été envoyée. Réessayez.';
    end if;
  end loop;
  conv := src in ('dm', 'negociation') and p_ref is not null;
  if cardinality(pr) = 0 and not conv and not coalesce(p_sans_preuve, false) then
    raise exception 'Ajoutez une preuve (photo ou capture d''écran), ou cochez « Je n''ai pas de preuve ».';
  end if;
  select max(created_at) into dernier from public.signalements_membres where auteur_id = me and cible_id = p_cible;
  if dernier > now() - interval '7 days' then
    raise exception 'Vous avez déjà signalé ce compte le %. Vous pourrez le refaire à partir du %. L''équipe a bien votre signalement.',
      to_char(dernier, 'DD/MM/YYYY'), to_char(dernier + interval '7 days', 'DD/MM/YYYY');
  end if;
  select count(*) into n from public.signalements_membres where auteur_id = me and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Vous avez fait beaucoup de signalements aujourd''hui. Réessayez demain, ou écrivez au Marché de Gros.'; end if;
  insert into public.signalements_membres (auteur_id, cible_id, motif, detail, source, ref_id, preuves, sans_preuve)
  values (me, p_cible, p_motif, left(d, 500), src, p_ref, pr, cardinality(pr) = 0 and not conv)
  on conflict (auteur_id, cible_id, motif) do update
    set detail = excluded.detail, source = excluded.source, ref_id = excluded.ref_id, preuves = excluded.preuves,
        sans_preuve = excluded.sans_preuve, traite = false, created_at = now();
  select count(distinct auteur_id)::int into personnes from public.signalements_membres
   where cible_id = p_cible and created_at > now() - interval '30 days';
  return json_build_object('ok', true, 'avec_preuve', cardinality(pr) > 0 or conv);
end $f$;

-- ——— 4) tableau de bord : un bloc par compte signalé, les prioritaires d'abord ———
create or replace function public.admin_signalements_comptes()
returns table (cible_id uuid, cible_tel text, personnes_30j int, avec_preuve boolean, priorite boolean, a_traiter int,
               dernier timestamptz, cible_banni boolean, cible_verifie boolean, signalements json)
language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  with s as (
    select x.*, split_part(a.email, '@', 1) as auteur_tel from public.signalements_membres x left join auth.users a on a.id = x.auteur_id
    where x.created_at > now() - interval '90 days'
  ), g as (
    select s.cible_id,
      count(distinct s.auteur_id) filter (where s.created_at > now() - interval '30 days')::int as p30,
      bool_or(cardinality(s.preuves) > 0 or (s.source in ('dm', 'negociation') and s.ref_id is not null)) filter (where not s.traite) as preuve,
      count(*) filter (where not s.traite)::int as nt,
      max(s.created_at) as dern,
      json_agg(json_build_object('id', s.id, 'created_at', s.created_at, 'motif', s.motif, 'detail', s.detail, 'source', s.source,
        'ref_id', s.ref_id, 'preuves', s.preuves, 'sans_preuve', s.sans_preuve, 'auteur_id', s.auteur_id, 'auteur_tel', s.auteur_tel, 'traite', s.traite)
        order by s.traite, s.created_at desc) as liste
    from s group by s.cible_id
  )
  select g.cible_id, split_part(c.email, '@', 1)::text, g.p30, coalesce(g.preuve, false),
    g.nt > 0 and (g.p30 >= 3 or coalesce(g.preuve, false)), g.nt, g.dern,
    public.est_banni(g.cible_id), public.identite_ok(g.cible_id), g.liste
  from g left join auth.users c on c.id = g.cible_id
  order by (g.nt > 0 and (g.p30 >= 3 or coalesce(g.preuve, false))) desc, (g.nt > 0) desc, g.p30 desc, g.dern desc
  limit 200;
end $f$;

-- tout marquer « traité » pour un compte
create or replace function public.admin_signalements_cible_traites(p_cible uuid) returns void
language plpgsql volatile security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  update public.signalements_membres set traite = true where cible_id = p_cible and not traite;
end $f$;

revoke execute on function public.signaler_membre(uuid, text, text, text, uuid, text[], boolean), public.admin_signalements_comptes(),
  public.admin_signalements_cible_traites(uuid) from public, anon;
grant execute on function public.signaler_membre(uuid, text, text, text, uuid, text[], boolean), public.admin_signalements_comptes(),
  public.admin_signalements_cible_traites(uuid) to authenticated;

-- contrôle : « preuves | false »
select id, public from storage.buckets where id = 'preuves';
