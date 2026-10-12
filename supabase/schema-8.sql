-- ═════════ Marché de Gros CI — étape 8 : messagerie directe, messages effacés au bout de 7 jours (12 octobre 2026) ═════════
-- À lancer APRÈS les étapes 1 à 7. Peut être relancé sans danger.
--
-- Chacun peut écrire directement à un vendeur, un acheteur ou n'importe quel membre, sans passer par une annonce,
-- sans quitter l'application. Pour ne pas remplir la base gratuite (500 Mo), chaque message est effacé 7 jours après
-- son envoi (tâche horaire pg_cron) ; une conversation sans message depuis 7 jours disparaît aussi.
-- Ordre de grandeur : un message ≈ 0,5 Ko avec ses index ; 20 000 messages par jour pendant 7 jours ≈ 70 Mo.
-- La durée est réglée à un seul endroit : dm_duree().
-- L'effacement automatique (tâche pg_cron) est dans schema-8-effacement.sql, à coller dans l'éditeur SQL de Supabase.
-- Protection : on ne lit et n'écrit qu'à travers les fonctions ci-dessous (aucun accès direct aux tables) ;
-- 20 messages par minute et 500 par jour au plus par personne ; chacun peut bloquer quelqu'un.

create extension if not exists pg_cron;

create or replace function public.dm_duree() returns interval language sql immutable as $$ select interval '7 days' $$;

create table if not exists public.discussions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  a_id          uuid not null references auth.users(id) on delete cascade,
  b_id          uuid not null references auth.users(id) on delete cascade,
  dernier_texte text,
  dernier_par   uuid,
  lu_a          timestamptz,
  lu_b          timestamptz,
  cache_a       timestamptz,
  cache_b       timestamptz,
  check (a_id < b_id),
  unique (a_id, b_id)
);
create index if not exists discussions_b on public.discussions (b_id);
create index if not exists discussions_maj on public.discussions (updated_at);

create table if not exists public.dm (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  auteur_id     uuid not null references auth.users(id) on delete cascade,
  texte         text not null check (char_length(texte) between 1 and 2000)
);
create index if not exists dm_fil on public.dm (discussion_id, created_at);
create index if not exists dm_date on public.dm (created_at);
create index if not exists dm_auteur on public.dm (auteur_id, created_at);

create table if not exists public.blocages (
  auteur_id  uuid not null references auth.users(id) on delete cascade,
  cible_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auteur_id, cible_id)
);

alter table public.discussions enable row level security;
alter table public.dm enable row level security;
alter table public.blocages enable row level security;
revoke all on public.discussions, public.dm, public.blocages from anon, authenticated;

-- l'un des deux a bloqué l'autre ?
create or replace function public.dm_bloque(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocages where (auteur_id = x and cible_id = y) or (auteur_id = y and cible_id = x));
$$;

-- ouvrir (ou retrouver) la conversation avec quelqu'un
create or replace function public.dm_ouvrir(p_autre uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_a uuid; v_b uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_autre is null or p_autre = auth.uid() then raise exception 'On ne s''écrit pas à soi-même.'; end if;
  if not exists (select 1 from auth.users where id = p_autre) or exists (select 1 from public.profils where user_id = p_autre and supprime_le is not null) then
    raise exception 'Ce compte n''existe plus.'; end if;
  v_a := least(auth.uid(), p_autre); v_b := greatest(auth.uid(), p_autre);
  select id into v_id from public.discussions where a_id = v_a and b_id = v_b;
  if v_id is null then
    insert into public.discussions (a_id, b_id) values (v_a, v_b) on conflict (a_id, b_id) do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.discussions where a_id = v_a and b_id = v_b; end if;
  end if;
  return v_id;
end $$;

create or replace function public.dm_envoyer(p_discussion uuid, p_texte text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare d public.discussions; v_autre uuid; v_t text := btrim(coalesce(p_texte, '')); r public.dm;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into d from public.discussions where id = p_discussion and auth.uid() in (a_id, b_id);
  if d.id is null then raise exception 'Conversation introuvable.'; end if;
  v_autre := case when d.a_id = auth.uid() then d.b_id else d.a_id end;
  if public.dm_bloque(auth.uid(), v_autre) then raise exception 'BLOQUE'; end if;
  if exists (select 1 from public.profils where user_id = v_autre and supprime_le is not null) then raise exception 'Ce compte n''existe plus.'; end if;
  if v_t = '' then raise exception 'Message vide.'; end if;
  if char_length(v_t) > 2000 then raise exception 'Message trop long (2 000 caractères au plus).'; end if;
  if (select count(*) from public.dm where auteur_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'TROP_VITE'; end if;
  if (select count(*) from public.dm where auteur_id = auth.uid() and created_at > now() - interval '1 day') >= 500 then raise exception 'TROP_VITE'; end if;
  insert into public.dm (discussion_id, auteur_id, texte) values (d.id, auth.uid(), v_t) returning * into r;
  update public.discussions set updated_at = r.created_at, dernier_texte = left(v_t, 140), dernier_par = auth.uid(),
    lu_a = case when a_id = auth.uid() then r.created_at else lu_a end, lu_b = case when b_id = auth.uid() then r.created_at else lu_b end,
    cache_a = case when a_id = auth.uid() then null else cache_a end, cache_b = case when b_id = auth.uid() then null else cache_b end
  where id = d.id;
  return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte);
end $$;

-- mes conversations (les masquées reviennent si l'autre écrit après le masquage)
create or replace function public.dm_liste() returns table (id uuid, autre_id uuid, autre_nom text, autre_avatar text, dernier_texte text, dernier_par uuid, updated_at timestamptz, non_lu boolean, bloque boolean, je_bloque boolean)
language sql stable security definer set search_path = public as $$
  select d.id, x.autre, coalesce(public.nom_public(x.autre), 'Membre'), p.avatar, d.dernier_texte, d.dernier_par, d.updated_at,
         d.dernier_par is not null and d.dernier_par <> auth.uid() and d.updated_at > coalesce(case when d.a_id = auth.uid() then d.lu_a else d.lu_b end, '-infinity'::timestamptz),
         public.dm_bloque(auth.uid(), x.autre),
         exists (select 1 from public.blocages b where b.auteur_id = auth.uid() and b.cible_id = x.autre)
  from public.discussions d
  cross join lateral (select case when d.a_id = auth.uid() then d.b_id else d.a_id end as autre) x
  left join public.profils p on p.user_id = x.autre and p.supprime_le is null
  where auth.uid() in (d.a_id, d.b_id) and d.dernier_par is not null and d.updated_at > now() - public.dm_duree()
    and d.updated_at > coalesce(case when d.a_id = auth.uid() then d.cache_a else d.cache_b end, '-infinity'::timestamptz)
  order by d.updated_at desc limit 200;
$$;

create or replace function public.dm_messages(p_discussion uuid, p_apres timestamptz default null) returns table (id uuid, created_at timestamptz, auteur_id uuid, texte text)
language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.created_at, m.auteur_id, m.texte from public.dm m
    where m.discussion_id = p_discussion and exists (select 1 from public.discussions d where d.id = p_discussion and auth.uid() in (d.a_id, d.b_id))
      and m.created_at > greatest(coalesce(p_apres, '-infinity'::timestamptz), now() - public.dm_duree())
    order by m.created_at desc limit 300) t order by t.created_at;
$$;

create or replace function public.dm_lu(p_discussion uuid) returns void
language sql volatile security definer set search_path = public as $$
  update public.discussions set lu_a = case when a_id = auth.uid() then now() else lu_a end, lu_b = case when b_id = auth.uid() then now() else lu_b end
  where id = p_discussion and auth.uid() in (a_id, b_id);
$$;

create or replace function public.dm_masquer(p_discussion uuid) returns void
language sql volatile security definer set search_path = public as $$
  update public.discussions set cache_a = case when a_id = auth.uid() then now() else cache_a end, cache_b = case when b_id = auth.uid() then now() else cache_b end
  where id = p_discussion and auth.uid() in (a_id, b_id);
$$;

create or replace function public.dm_bloquer(p_autre uuid, p_oui boolean default true) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or p_autre is null or p_autre = auth.uid() then return; end if;
  if p_oui then insert into public.blocages (auteur_id, cible_id) values (auth.uid(), p_autre) on conflict do nothing;
  else delete from public.blocages where auteur_id = auth.uid() and cible_id = p_autre; end if;
end $$;

-- effacement : toutes les heures, les messages de plus de 7 jours et les conversations restées vides
create or replace function public.dm_purger() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.dm where created_at < now() - public.dm_duree();
  delete from public.discussions where updated_at < now() - public.dm_duree();
end $$;
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'mdg-effacer-messages') then
    perform cron.schedule('mdg-effacer-messages', '23 * * * *', 'select public.dm_purger()');
  end if;
end $$;

-- le chiffre sur l'icône compte aussi les conversations à lire
create or replace function public.push_badge(uid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.negociations n
          where uid in (n.auteur_id, n.proprio_id) and n.dernier_par is not null and n.dernier_par <> uid
            and n.updated_at > coalesce(case when n.auteur_id = uid then n.lu_auteur else n.lu_proprio end, '-infinity'::timestamptz))::int
       + (select count(*) from public.discussions d
          where uid in (d.a_id, d.b_id) and d.dernier_par is not null and d.dernier_par <> uid and d.updated_at > now() - public.dm_duree()
            and d.updated_at > coalesce(case when d.a_id = uid then d.lu_a else d.lu_b end, '-infinity'::timestamptz))::int;
$$;

-- notification sur le téléphone à chaque nouveau message (même fonction Edge « pousser » que les négociations)
create or replace function public.push_dm() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('dm_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'push_dm' and tgrelid = 'public.dm'::regclass) then
  create trigger push_dm after insert on public.dm for each row execute function public.push_dm(); end if; end $$;

revoke execute on function public.dm_bloque(uuid, uuid), public.dm_ouvrir(uuid), public.dm_envoyer(uuid, text), public.dm_liste(), public.dm_messages(uuid, timestamptz),
  public.dm_lu(uuid), public.dm_masquer(uuid), public.dm_bloquer(uuid, boolean), public.dm_purger(), public.push_dm() from public, anon, authenticated;
grant execute on function public.dm_ouvrir(uuid), public.dm_envoyer(uuid, text), public.dm_liste(), public.dm_messages(uuid, timestamptz),
  public.dm_lu(uuid), public.dm_masquer(uuid), public.dm_bloquer(uuid, boolean) to authenticated;
grant select on public.dm, public.discussions to service_role;
