-- ═════════ Marché de Gros CI — confiance : 3 annonces gratuites, puis identité vérifiée ; bannissement à vie ═════════
-- À lancer une fois dans Supabase (SQL Editor → New query → coller → Run), APRÈS schema-13-identite.sql.
-- Peut être relancé sans danger.
--
--   • Chaque compte peut publier 3 annonces (offres et demandes confondues). Au-delà, il faut une identité vérifiée.
--     Le compteur ne redescend pas quand on supprime une annonce (sinon : supprimer, republier, à l'infini).
--     Modifier une annonce déjà publiée ne compte pas. Les annonces déjà en ligne restent en ligne.
--   • Un administrateur peut bannir un compte (arnaque, mauvais produits répétés, insultes, autre) :
--     ses annonces sont masquées, il ne peut plus publier, négocier, écrire ni faire vérifier son identité, et son badge disparaît.
--     Le nom vérifié du compte banni est gardé : si la même personne revient avec un autre numéro, l'administrateur est prévenu
--     quand elle demande la vérification.
--   • Les administrateurs ne sont pas concernés par la limite.

-- ——— 1) tables (fermées : seulement les fonctions ci-dessous) ———
create table if not exists public.bannis (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  motif        text not null check (motif in ('arnaque', 'mauvais_produits', 'insultes', 'autre')),
  detail       text check (char_length(detail) <= 300),
  nom_confirme text,                                                   -- nom vérifié au moment du bannissement, s'il y en avait un
  par          uuid references auth.users(id) on delete set null,
  le           timestamptz not null default now()
);
alter table public.bannis enable row level security;
revoke all on public.bannis from anon, authenticated;

create table if not exists public.annonces_publiees (
  user_id uuid primary key references auth.users(id) on delete cascade,
  n       int not null default 0
);
alter table public.annonces_publiees enable row level security;
revoke all on public.annonces_publiees from anon, authenticated;

-- les comptes qui ont déjà publié partent de leur nombre d'annonces actuel
insert into public.annonces_publiees (user_id, n)
select user_id, count(*) from (select user_id from public.offres union all select user_id from public.demandes) t group by user_id
on conflict (user_id) do update set n = greatest(public.annonces_publiees.n, excluded.n);

create or replace function public.annonces_gratuites() returns int language sql immutable as $$ select 3 $$;

create or replace function public.est_banni(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bannis where user_id = uid);
$$;

create or replace function public.identite_ok(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select v.statut = 'verifie' from public.verifications v
                   where v.user_id = uid and v.statut in ('verifie', 'refuse') and v.decide_le is not null
                   order by v.decide_le desc limit 1), false);
$$;

-- ——— 2) publier : la garde ———
create or replace function public.garde_publication() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if tg_op = 'UPDATE' then
    if public.est_admin() then return new; end if;
    if new.user_id = auth.uid() and public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
    if old.status = 'masquee' then new.status := 'masquee'; end if;   -- une annonce masquée par l'administration le reste
    return new;
  end if;
  if public.est_admin_id(new.user_id) then return new; end if;
  if public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  -- l'application renvoie une annonce déjà publiée quand elle est modifiée (même client_id) : ce n'est pas une nouvelle annonce
  execute format('select count(*) from public.%I where user_id = $1 and client_id = $2', tg_table_name) into c using new.user_id, new.client_id;
  if c > 0 then return new; end if;
  select n into c from public.annonces_publiees where user_id = new.user_id;
  if coalesce(c, 0) >= public.annonces_gratuites() and not public.identite_ok(new.user_id) then
    raise exception 'VERIFICATION_REQUISE : vous avez publié vos % annonces gratuites. Faites vérifier votre identité (Mon compte, Identité) pour publier les suivantes.', public.annonces_gratuites();
  end if;
  insert into public.annonces_publiees (user_id, n) values (new.user_id, 1)
  on conflict (user_id) do update set n = public.annonces_publiees.n + 1;
  return new;
end $$;
drop trigger if exists offres_garde on public.offres;
drop trigger if exists demandes_garde on public.demandes;
create trigger offres_garde   before insert or update on public.offres   for each row execute function public.garde_publication();
create trigger demandes_garde before insert or update on public.demandes for each row execute function public.garde_publication();

-- ——— 3) un compte banni n'écrit plus : négociations, messages, discussions, vérification ———
create or replace function public.garde_banni() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  u := (to_jsonb(new) ->> tg_argv[0])::uuid;
  if public.est_banni(u) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  return new;
end $$;
drop trigger if exists negociations_banni on public.negociations;
drop trigger if exists messages_banni on public.messages;
drop trigger if exists dm_banni on public.dm;
drop trigger if exists verifications_banni on public.verifications;
create trigger negociations_banni  before insert on public.negociations  for each row execute function public.garde_banni('auteur_id');
create trigger messages_banni      before insert on public.messages      for each row execute function public.garde_banni('auteur_id');
create trigger dm_banni            before insert on public.dm            for each row execute function public.garde_banni('auteur_id');
create trigger verifications_banni before insert on public.verifications for each row execute function public.garde_banni('user_id');

-- le badge disparaît pour un compte banni
create or replace function public.identite_verifiee(ids uuid[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select x.user_id from (
    select distinct on (v.user_id) v.user_id, v.statut
    from public.verifications v
    where v.user_id = any (ids[1:200]) and v.statut in ('verifie', 'refuse') and v.decide_le is not null
    order by v.user_id, v.decide_le desc) x
  where x.statut = 'verifie'
    and not exists (select 1 from public.profils p where p.user_id = x.user_id and p.supprime_le is not null)
    and not exists (select 1 from public.bannis b where b.user_id = x.user_id);
$$;

-- ——— 4) côté membre : mon statut dit aussi où j'en suis de mes annonces gratuites ———
create or replace function public.identite_statut() returns json
language sql stable security definer set search_path = public as $$
  select (coalesce((
    select jsonb_build_object('id', v.id, 'statut', v.statut, 'piece', v.piece, 'motif', v.motif,
             'soumis_le', v.soumis_le, 'decide_le', v.decide_le,
             'nouvel_essai_le', case when v.statut = 'refuse' then v.decide_le + interval '7 days' end,
             'defi', case when v.statut = 'brouillon' then v.defi end,
             'dossier', case when v.statut in ('brouillon', 'en_attente', 'verification_manuelle') then public.identite_dossier(v) end)
    from public.verifications v
    where v.user_id = auth.uid() and v.statut not in ('remplace', 'retire')
    order by v.created_at desc limit 1),
    jsonb_build_object('statut', 'non_verifie'))
  || jsonb_build_object(
       'annonces', coalesce((select n from public.annonces_publiees where user_id = auth.uid()), 0),
       'gratuites', public.annonces_gratuites(),
       'exempt', public.est_admin(),
       'banni', public.est_banni(auth.uid())))::json;
$$;

-- ——— 5) côté administrateur ———
create or replace function public.admin_bannir(p_user uuid, p_motif text, p_detail text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if p_motif not in ('arnaque', 'mauvais_produits', 'insultes', 'autre') then raise exception 'Motif inconnu.'; end if;
  if public.est_admin_id(p_user) then raise exception 'Un administrateur ne peut pas être banni.'; end if;
  insert into public.bannis (user_id, motif, detail, nom_confirme, par)
  values (p_user, p_motif, left(nullif(btrim(p_detail), ''), 300),
          (select v.nom_confirme from public.verifications v where v.user_id = p_user and v.statut = 'verifie' order by v.decide_le desc limit 1),
          auth.uid())
  on conflict (user_id) do update set motif = excluded.motif, detail = excluded.detail, par = excluded.par, le = now();
  update public.offres set status = 'masquee' where user_id = p_user and status <> 'masquee';
  update public.demandes set status = 'masquee' where user_id = p_user and status <> 'masquee';
  update public.verifications set statut = 'retire' where user_id = p_user and statut in ('brouillon', 'en_attente', 'verification_manuelle');
end $$;

-- en cas d'erreur seulement : les annonces restent masquées (l'administrateur les rétablit une par une s'il le faut)
create or replace function public.admin_lever_bannissement(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  delete from public.bannis where user_id = p_user;
end $$;

drop function if exists public.admin_comptes();
create function public.admin_comptes()
returns table (id uuid, tel text, created_at timestamptz, last_sign_in_at timestamptz, offres bigint, demandes bigint, negociations bigint,
               signale bigint, admin boolean, secours boolean, verifie boolean, publiees int, banni boolean, banni_motif text, banni_le timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  select u.id, split_part(u.email, '@', 1)::text, u.created_at, u.last_sign_in_at,
    (select count(*) from public.offres o where o.user_id = u.id),
    (select count(*) from public.demandes d where d.user_id = u.id),
    (select count(*) from public.negociations g where u.id in (g.auteur_id, g.proprio_id)),
    (select count(*) from public.signalements s where s.cible_id in (select o.id from public.offres o where o.user_id = u.id union all select d.id from public.demandes d where d.user_id = u.id)),
    exists (select 1 from public.admins a where a.user_id = u.id),
    exists (select 1 from public.secours c where c.user_id = u.id),
    public.identite_ok(u.id),
    coalesce((select p.n from public.annonces_publiees p where p.user_id = u.id), 0),
    b.user_id is not null, b.motif, b.le
  from auth.users u left join public.bannis b on b.user_id = u.id
  order by u.created_at desc;
end $$;

-- la file des identités signale un nom déjà banni (même personne revenue avec un autre numéro ?)
drop function if exists public.admin_identite_file();
create function public.admin_identite_file()
returns table (id uuid, user_id uuid, statut text, piece text, defi text, nom_saisi text, nom_lu text, mrz_ok boolean,
               motif text, soumis_le timestamptz, dossier text, tel text, profil_nom text, profil_pseudo text, membre_depuis timestamptz, essais bigint,
               nom_banni boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  select v.id, v.user_id, v.statut, v.piece, v.defi, v.nom_saisi, v.nom_lu, v.mrz_ok, v.motif, v.soumis_le,
    public.identite_dossier(v), split_part(u.email, '@', 1)::text,
    nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), p.pseudo, u.created_at,
    (select count(*) from public.verifications w where w.user_id = v.user_id and w.soumis_le is not null),
    exists (select 1 from public.bannis b where b.nom_confirme is not null
            and (upper(btrim(b.nom_confirme)) = upper(btrim(v.nom_saisi)) or upper(btrim(b.nom_confirme)) = upper(btrim(coalesce(v.nom_lu, '')))))
  from public.verifications v
  join auth.users u on u.id = v.user_id
  left join public.profils p on p.user_id = v.user_id
  where v.statut in ('en_attente', 'verification_manuelle')
  order by v.statut = 'verification_manuelle', v.soumis_le;
end $$;

-- ——— 6) droits d'exécution ———
revoke execute on function public.annonces_gratuites(), public.est_banni(uuid), public.identite_ok(uuid), public.garde_publication(), public.garde_banni(),
  public.admin_bannir(uuid, text, text), public.admin_lever_bannissement(uuid), public.admin_comptes(), public.admin_identite_file() from public, anon, authenticated;
grant execute on function public.annonces_gratuites() to anon, authenticated;
grant execute on function public.admin_bannir(uuid, text, text), public.admin_lever_bannissement(uuid), public.admin_comptes(), public.admin_identite_file() to authenticated;
grant execute on function public.identite_statut() to authenticated;
grant execute on function public.identite_verifiee(uuid[]) to anon, authenticated;

-- contrôle : nombre de comptes déjà au-delà des 3 annonces gratuites (ils gardent leurs annonces, mais devront se faire vérifier pour la suivante)
select count(*) as comptes_au_dela_de_3 from public.annonces_publiees where n >= public.annonces_gratuites();
