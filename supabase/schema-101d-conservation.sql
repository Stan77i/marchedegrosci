-- Schéma 101d : durées de conservation (décision juridique n° 22, accord du propriétaire « ok pour tout », 25/10/2026).
--   journal des notifications ............ 90 jours après l'envoi
--   photos de preuve (départ, refus) ...... 1 an après la clôture de la commande (terminée ou annulée)
--   signalements et sanctions ............ 2 ans après leur fin (traité, décidé, levée ou fin de la sanction)
--   commandes et négociations ............ 5 ans après leur fin (commande terminée ou annulée ; négociation qui n'est plus ouverte)
-- Ce fichier ne supprime rien. Il pose :
--   1. la liste de ce qui a dépassé sa durée (fonctions _cons_*), une seule source pour compter et pour effacer ;
--   2. conservation_compter() : combien de lignes partiraient aujourd'hui (équipe seulement) ;
--   3. conservation_journal : une ligne par passage (lignes effacées par catégorie) ;
--   4. conservation_passage() : la tâche de nuit (02:41 UTC, heure d'Abidjan). Elle appelle _conservation_effacer() si elle est
--      installée (fichier schema-101e-conservation-effacer-a-coller.sql, à coller dans l'éditeur SQL : l'outil refuse le mot qui supprime),
--      sinon elle note « en_attente » ;
--   5. les photos : les fichiers du stockage ne s'effacent pas en SQL (Supabase l'interdit : déclencheur protect_objects_delete).
--      admin_preuves_a_effacer() donne la liste à l'écran de l'équipe, qui les retire par l'API Storage (comme les pièces d'identité,
--      schéma 16) ; preuve_purgeable(nom) sert à la règle du stockage (fichier 101e).
-- Garde-fous : une commande en litige ou en cours n'est jamais touchée ; une ligne dont les photos sont encore dans le stockage
-- attend que les photos soient retirées (aucun fichier orphelin) ; une annulation encore liée à une sanction gardée reste.

-- ───────── 1. Ce qui a dépassé sa durée
create or replace function public._cons_notif() returns setof bigint
language sql stable security definer set search_path = public as $$
  select id from public.notif_journal where cree_le < now() - interval '90 days'
$$;

create or replace function public._cons_preuves() returns setof text
language sql stable security definer set search_path = public as $$
  with noms as (
    select unnest(coalesce(c.depart_photos, '{}') || coalesce(c.refus_photos, '{}') || case when c.depart_mot_photo is not null then array[c.depart_mot_photo] else '{}'::text[] end) as nom
    from public.commandes c
    where c.etat in ('terminee', 'annulee') and coalesce(c.termine_le, c.updated_at) < now() - interval '1 year'
    union
    select unnest(s.preuves) from public.signalements_membres s
    where s.traite and s.created_at < now() - interval '2 years')
  select distinct o.name from noms n join storage.objects o on o.bucket_id = 'preuves' and o.name = n.nom
$$;

create or replace function public._cons_photos_restantes(p_noms text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = any (coalesce(p_noms, '{}')))
$$;

create or replace function public._cons_signalements() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.signalements where traite and coalesce(traite_le, created_at) < now() - interval '2 years'
$$;

create or replace function public._cons_signalements_membres() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.signalements_membres s
  where s.traite and s.created_at < now() - interval '2 years' and not public._cons_photos_restantes(s.preuves)
$$;

create or replace function public._cons_masquages() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.signalement_masquages where decide_le is not null and decide_le < now() - interval '2 years'
$$;

create or replace function public._cons_sanctions() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.sanctions where coalesce(levee_le, fin) is not null and coalesce(levee_le, fin) < now() - interval '2 years'
$$;

create or replace function public._cons_commandes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.commandes c
  where c.etat in ('terminee', 'annulee') and coalesce(c.termine_le, c.updated_at) < now() - interval '5 years'
    and not public._cons_photos_restantes(coalesce(c.depart_photos, '{}') || coalesce(c.refus_photos, '{}')
                                          || case when c.depart_mot_photo is not null then array[c.depart_mot_photo] else '{}'::text[] end)
$$;

create or replace function public._cons_annulations() returns setof uuid
language sql stable security definer set search_path = public as $$
  select a.id from public.annulations a
  where a.commande_id in (select public._cons_commandes())
    and not exists (select 1 from public.sanctions s where s.annulation_id = a.id and s.id not in (select public._cons_sanctions()))
$$;

create or replace function public._cons_negociations() returns setof uuid
language sql stable security definer set search_path = public as $$
  select n.id from public.negociations n
  where n.statut <> 'ouverte' and n.updated_at < now() - interval '5 years'
    and not exists (select 1 from public.commandes c where c.negociation_id = n.id and c.id not in (select public._cons_commandes()))
$$;

revoke all on function public._cons_notif(), public._cons_preuves(), public._cons_photos_restantes(text[]), public._cons_signalements(),
  public._cons_signalements_membres(), public._cons_masquages(), public._cons_sanctions(), public._cons_commandes(),
  public._cons_annulations(), public._cons_negociations() from public, anon, authenticated;

-- ───────── 2. Compter (sans rien changer)
create or replace function public._conservation_compte() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'notif_journal', (select count(*) from public._cons_notif()),
    'photos_preuve', (select count(*) from public._cons_preuves()),
    'signalements', (select count(*) from public._cons_signalements()),
    'signalements_membres', (select count(*) from public._cons_signalements_membres()),
    'masquages', (select count(*) from public._cons_masquages()),
    'sanctions', (select count(*) from public._cons_sanctions()),
    'annulations', (select count(*) from public._cons_annulations()),
    'commandes', (select count(*) from public._cons_commandes()),
    'negociations', (select count(*) from public._cons_negociations()))
$$;
revoke all on function public._conservation_compte() from public, anon, authenticated;

create or replace function public.conservation_compter() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return public._conservation_compte();
end $$;
revoke all on function public.conservation_compter() from public, anon;
grant execute on function public.conservation_compter() to authenticated;

-- ───────── 3. Journal des passages
create table if not exists public.conservation_journal (
  id bigint generated always as identity primary key,
  passe_le timestamptz not null default now(),
  etat text not null check (etat in ('fait', 'en_attente', 'erreur')),
  lignes jsonb not null default '{}'::jsonb,
  total integer not null default 0,
  note text check (note is null or char_length(note) <= 500)
);
alter table public.conservation_journal enable row level security;
revoke all on public.conservation_journal from anon, authenticated;
grant select on public.conservation_journal to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conservation_journal' and policyname = 'conservation_journal : lecture équipe') then
    create policy "conservation_journal : lecture équipe" on public.conservation_journal for select to authenticated using ((select public.est_admin()));
  end if;
end $$;

-- ───────── 4. Le passage de nuit
create or replace function public.conservation_passage() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r jsonb; t integer;
begin
  if to_regprocedure('public._conservation_effacer()') is null then
    r := public._conservation_compte();
    insert into public.conservation_journal (etat, lignes, total, note)
    values ('en_attente', r, 0, 'Effacement pas encore installé (schema-101e à coller) : rien n''est effacé, voici ce qui partirait.');
    return r;
  end if;
  begin
    execute 'select public._conservation_effacer()' into r;
    select coalesce(sum(v::text::integer), 0) into t from jsonb_each(r) e(k, v) where jsonb_typeof(v) = 'number';
    insert into public.conservation_journal (etat, lignes, total) values ('fait', r, t);
  exception when others then
    insert into public.conservation_journal (etat, note) values ('erreur', left(sqlerrm, 500));
    r := jsonb_build_object('erreur', sqlerrm);
  end;
  return r;
end $$;
revoke all on function public.conservation_passage() from public, anon, authenticated;

-- ───────── 5. Photos de preuve : la liste pour l'équipe (les fichiers se retirent par l'API Storage)
create or replace function public.preuve_purgeable(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public._cons_preuves() x where x = p_name)
$$;
revoke all on function public.preuve_purgeable(text) from public, anon;
grant execute on function public.preuve_purgeable(text) to authenticated;

create or replace function public.admin_preuves_a_effacer() returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query select x from public._cons_preuves() x order by 1 limit 1000;
end $$;
revoke all on function public.admin_preuves_a_effacer() from public, anon;
grant execute on function public.admin_preuves_a_effacer() to authenticated;

-- ───────── 6. La tâche de nuit (02:41 UTC = 02:41 à Abidjan)
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'mdg-conservation') then
    perform cron.schedule('mdg-conservation', '41 2 * * *', 'select public.conservation_passage()');
  end if;
end $$;
