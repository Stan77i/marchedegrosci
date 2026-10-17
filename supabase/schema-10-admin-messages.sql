-- Marché de Gros CI — schéma 10 : messages de l'administration, contrôle des échanges (appliqué le 17/10/2026)
-- • Les membres peuvent écrire au Marché de Gros (contact_marche) ; les messages des administrateurs portent le logo (dm_liste2.officiel).
-- • Un administrateur peut écrire à tous les membres d'un coup (admin_diffuser) et lire toutes les conversations (admin_discussions, admin_dm).
-- • Les échanges restent dans l'application : un numéro de téléphone écrit dans un message est masqué, et toute tentative de
--   sortir (numéro, WhatsApp, autre messagerie, lien) crée une alerte pour les administrateurs (table alertes + notification).

create or replace function public.est_admin_id(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = uid);
$$;

-- ——— alertes « sortie de l'application » ———
create table if not exists public.alertes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  source text not null check (source in ('dm', 'negociation')),
  ref_id uuid,
  motif text not null,
  extrait text,
  vu boolean not null default false
);
create index if not exists alertes_created_at_idx on public.alertes (created_at desc);
create index if not exists alertes_user_id_idx on public.alertes (user_id);
alter table public.alertes enable row level security;
drop policy if exists "admin lit les alertes" on public.alertes;
create policy "admin lit les alertes" on public.alertes for select to authenticated using ((select public.est_admin()));
drop policy if exists "admin traite les alertes" on public.alertes;
create policy "admin traite les alertes" on public.alertes for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
drop policy if exists "admin supprime les alertes" on public.alertes;
create policy "admin supprime les alertes" on public.alertes for delete to authenticated using ((select public.est_admin()));

-- numéro ivoirien (10 chiffres, 01 05 07 25 27…), avec ou sans +225 et séparateurs
create or replace function public.sortie_motif(t text) returns text
language sql immutable set search_path = public as $$
  select case
    when t ~ '(\+?\s*225[\s.\-]*)?0[1-9]([\s.\-]?[0-9]){8}' then 'numéro de téléphone'
    when t ~* '(whats\s*app|watsap|watsapp|wa\.me|wtsp|telegram|t\.me/|messenger|signal\s*app|\mimo\M|viber)' then 'autre messagerie'
    when t ~* '(https?://|www\.|facebook\.com|fb\.com|instagram\.com|tiktok\.com)' then 'lien vers un autre site'
    else null end;
$$;
create or replace function public.sortie_masquer(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(t, '(\+?\s*225[\s.\-]*)?0[1-9]([\s.\-]?[0-9]){8}', '[numéro masqué]', 'g');
$$;

create or replace function public.controle_sortie() returns trigger
language plpgsql security definer set search_path = public as $$
declare m text; v_ref uuid;
begin
  if new.texte is null or public.est_admin_id(new.auteur_id) then return new; end if;
  m := public.sortie_motif(new.texte);
  if m is null then return new; end if;
  v_ref := case when tg_table_name = 'dm' then new.discussion_id else new.negociation_id end;
  insert into public.alertes (user_id, source, ref_id, motif, extrait)
  values (new.auteur_id, case when tg_table_name = 'dm' then 'dm' else 'negociation' end, v_ref, m, left(new.texte, 300));
  new.texte := public.sortie_masquer(new.texte);
  return new;
end $$;
drop trigger if exists dm_controle_sortie on public.dm;
create trigger dm_controle_sortie before insert on public.dm for each row execute function public.controle_sortie();
drop trigger if exists messages_controle_sortie on public.messages;
create trigger messages_controle_sortie before insert on public.messages for each row execute function public.controle_sortie();

-- les administrateurs sont prévenus sur leur téléphone (fonction Edge « pousser », { alerte_id })
create or replace function public.push_alerte() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('alerte_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
drop trigger if exists alertes_push on public.alertes;
create trigger alertes_push after insert on public.alertes for each row execute function public.push_alerte();

-- ——— écrire au Marché de Gros ———
create or replace function public.contact_marche() returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.admins order by created_at limit 1;
$$;

-- ——— la liste des conversations : les administrateurs apparaissent comme « Marché de Gros » ———
-- (nouvelle fonction à côté de dm_liste, que les anciennes versions de l'application continuent d'appeler)
create or replace function public.dm_liste2()
returns table (id uuid, autre_id uuid, autre_nom text, autre_avatar text, dernier_texte text, dernier_par uuid, updated_at timestamptz, non_lu boolean, bloque boolean, je_bloque boolean, officiel boolean)
language sql stable security definer set search_path = public as $$
  select d.id, x.autre,
         case when public.est_admin_id(x.autre) then 'Marché de Gros' else coalesce(public.nom_public(x.autre), 'Membre') end,
         p.avatar, d.dernier_texte, d.dernier_par, d.updated_at,
         d.dernier_par is not null and d.dernier_par <> auth.uid() and d.updated_at > coalesce(case when d.a_id = auth.uid() then d.lu_a else d.lu_b end, '-infinity'::timestamptz),
         public.dm_bloque(auth.uid(), x.autre),
         exists (select 1 from public.blocages b where b.auteur_id = auth.uid() and b.cible_id = x.autre),
         public.est_admin_id(x.autre)
  from public.discussions d
  cross join lateral (select case when d.a_id = auth.uid() then d.b_id else d.a_id end as autre) x
  left join public.profils p on p.user_id = x.autre and p.supprime_le is null
  where auth.uid() in (d.a_id, d.b_id) and d.dernier_par is not null and d.updated_at > now() - public.dm_duree()
    and d.updated_at > coalesce(case when d.a_id = auth.uid() then d.cache_a else d.cache_b end, '-infinity'::timestamptz)
  order by d.updated_at desc limit 200;
$$;
revoke execute on function public.dm_liste2() from public, anon;
grant execute on function public.dm_liste2() to authenticated;

-- ——— l'administration écrit à tous les membres ———
create or replace function public.admin_diffuser(p_texte text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_t text := btrim(coalesce(p_texte, '')); v_me uuid := auth.uid(); u record; v_d uuid; v_a uuid; v_b uuid; n int := 0; v_now timestamptz := now();
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if v_t = '' then raise exception 'Message vide.'; end if;
  if char_length(v_t) > 2000 then raise exception 'Message trop long (2 000 caractères au plus).'; end if;
  for u in select au.id from auth.users au left join public.profils p on p.user_id = au.id
           where au.id <> v_me and p.supprime_le is null loop
    v_a := least(v_me, u.id); v_b := greatest(v_me, u.id);
    insert into public.discussions (a_id, b_id) values (v_a, v_b) on conflict (a_id, b_id) do nothing;
    select id into v_d from public.discussions where a_id = v_a and b_id = v_b;
    insert into public.dm (discussion_id, auteur_id, texte, created_at) values (v_d, v_me, v_t, v_now);
    update public.discussions set updated_at = v_now, dernier_texte = left(v_t, 140), dernier_par = v_me,
      lu_a = case when a_id = v_me then v_now else lu_a end, lu_b = case when b_id = v_me then v_now else lu_b end,
      cache_a = null, cache_b = null where id = v_d;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.admin_diffuser(text) from public, anon;
grant execute on function public.admin_diffuser(text) to authenticated;

-- ——— l'administration lit toutes les conversations ———
create or replace function public.admin_discussions()
returns table (id uuid, a_id uuid, b_id uuid, a_nom text, b_nom text, a_tel text, b_tel text, dernier_texte text, dernier_par uuid, updated_at timestamptz, n bigint, alertes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return query
  select d.id, d.a_id, d.b_id, coalesce(public.nom_public(d.a_id), 'Membre'), coalesce(public.nom_public(d.b_id), 'Membre'),
         (select ua.raw_user_meta_data->>'tel' from auth.users ua where ua.id = d.a_id), (select ub.raw_user_meta_data->>'tel' from auth.users ub where ub.id = d.b_id),
         d.dernier_texte, d.dernier_par, d.updated_at, (select count(*) from public.dm m where m.discussion_id = d.id),
         (select count(*) from public.alertes al where al.ref_id = d.id)
  from public.discussions d where d.dernier_par is not null order by d.updated_at desc limit 500;
end $$;
create or replace function public.admin_dm(p_discussion uuid)
returns table (id uuid, created_at timestamptz, auteur_id uuid, texte text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return query select m.id, m.created_at, m.auteur_id, m.texte from public.dm m where m.discussion_id = p_discussion order by m.created_at limit 1000;
end $$;
revoke execute on function public.admin_discussions() from public, anon;
revoke execute on function public.admin_dm(uuid) from public, anon;
grant execute on function public.admin_discussions() to authenticated;
grant execute on function public.admin_dm(uuid) to authenticated;
revoke execute on function public.contact_marche() from public, anon;
grant execute on function public.contact_marche() to authenticated;
