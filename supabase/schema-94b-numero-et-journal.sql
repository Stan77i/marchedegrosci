-- Schéma 94b (équipe Confiance, audit du 24/10/2026, P1 n° 4 partie gratuite, P2 n° 21 et n° 29) : numéro et journal de l'équipe.
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- 1. Journal des gestes sensibles de l'équipe (admin_journal) : lisible par l'équipe seulement, jamais modifiable par un membre.
-- 2. _equipe_ecrire : un message du « Marché de Gros » dans la conversation du membre (la notification part comme pour tout message).
-- 3. « Numéro contesté » : admin_numero_rendre détache le numéro du compte qui le tient (le compte est fermé, rien n'est effacé),
--    pour que le vrai propriétaire puisse s'inscrire. Motif obligatoire, journalisé.
-- 4. Code changé par l'équipe : admin_reinitialiser_journal (motif obligatoire, journal, message au membre). L'ancienne
--    admin_reinitialiser n'est plus appelable directement (elle reste la « porte » utilisée à l'intérieur).
-- 5. Compte supprimé : le numéro est libéré (l'adresse de connexion du compte supprimé change), il peut servir à un nouveau compte.
--    Un compte banni garde son numéro bloqué.
-- 6. admin_discussions : le numéro affiché vient de l'adresse de connexion, plus des données envoyées par le téléphone.
-- Limite d'inscriptions : la base ne voit pas l'adresse IP de l'inscription (elle passe par Supabase Auth, pas par la base).
-- Le réglage se fait dans Supabase : Authentication → Rate Limits (le propriétaire l'a déjà réglé à 20 par 5 minutes et par IP).

create table if not exists public.admin_journal (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  admin_id uuid,
  action text not null,
  cible_id uuid,
  motif text,
  detail jsonb not null default '{}'::jsonb
);
alter table public.admin_journal enable row level security;
revoke all on public.admin_journal from public, anon, authenticated;
grant select on public.admin_journal to authenticated;
create index if not exists admin_journal_cible on public.admin_journal (cible_id, at desc);
do $$ begin
  if not exists (select 1 from pg_policy where polrelid = 'public.admin_journal'::regclass and polname = 'équipe lit le journal') then
    create policy "équipe lit le journal" on public.admin_journal for select to authenticated using ((select public.est_admin()));
  end if;
end $$;

-- un message de l'équipe au membre : l'auteur est l'administrateur qui agit, sinon le premier compte officiel
create or replace function public._equipe_ecrire(p_user uuid, p_texte text)
returns void language plpgsql security definer set search_path = public as $$
declare v_adm uuid; v_a uuid; v_b uuid; v_id uuid; v_t text := left(btrim(coalesce(p_texte, '')), 2000);
begin
  if p_user is null or v_t = '' or public.est_admin_id(p_user) then return; end if;
  if exists (select 1 from public.profils where user_id = p_user and supprime_le is not null) then return; end if;
  v_adm := case when public.est_admin() then auth.uid() end;
  if v_adm is null then select user_id into v_adm from public.admins order by user_id limit 1; end if;
  if v_adm is null then return; end if;
  v_a := least(v_adm, p_user); v_b := greatest(v_adm, p_user);
  insert into public.discussions (a_id, b_id) values (v_a, v_b) on conflict (a_id, b_id) do nothing;
  select id into v_id from public.discussions where a_id = v_a and b_id = v_b;
  insert into public.dm (discussion_id, auteur_id, texte) values (v_id, v_adm, v_t);
  update public.discussions set updated_at = now(), dernier_texte = left(v_t, 140), dernier_par = v_adm,
    cache_a = null, cache_b = null where id = v_id;
exception when others then
  -- un message qui ne part pas ne bloque jamais le geste de l'équipe ; il reste écrit dans le journal du geste
  raise warning '_equipe_ecrire : %', sqlerrm;
end $$;

-- détache un numéro de son compte : l'adresse de connexion change, le compte ne peut plus se connecter par ce numéro
create or replace function public._numero_detacher(p_user uuid, p_prefixe text)
returns text language plpgsql security definer set search_path = public as $$
declare v_mail text; v_neuf text;
begin
  select email into v_mail from auth.users where id = p_user;
  if v_mail is null or v_mail not like '%@tel.marchedegros.ci' then return null; end if;
  v_neuf := p_prefixe || '-' || split_part(v_mail, '@', 1) || '-' || left(p_user::text, 8) || '@detache.marchedegros.ci';
  update auth.users set email = v_neuf, updated_at = now() where id = p_user;
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_neuf)), updated_at = now()
   where user_id = p_user and provider = 'email';
  return v_neuf;
end $$;

-- numéro contesté : le vrai propriétaire montre à l'équipe que le numéro est à lui ; l'équipe le rend
create or replace function public.admin_numero_rendre(p_tel text, p_motif text)
returns json language plpgsql security definer set search_path = public as $$
declare t text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); m text := nullif(btrim(coalesce(p_motif, '')), ''); u uuid; v_neuf text;
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if length(t) = 13 and left(t, 3) = '225' then t := substr(t, 4); end if;
  if t !~ '^[0-9]{10}$' then raise exception 'Numéro à 10 chiffres, par exemple 07 01 02 03 04.'; end if;
  if m is null or char_length(m) < 10 or char_length(m) > 300 then raise exception 'Expliquez comment le propriétaire a prouvé que le numéro est à lui (10 à 300 caractères).'; end if;
  select id into u from auth.users where email = '225' || t || '@tel.marchedegros.ci';
  if u is null then raise exception 'Ce numéro est libre : le propriétaire peut s''inscrire.'; end if;
  if public.est_admin_id(u) then raise exception 'Le numéro d''un compte officiel ne se rend pas ici.'; end if;
  v_neuf := public._numero_detacher(u, 'conteste');
  update auth.users set banned_until = 'infinity' where id = u;
  update public.offres set status = 'masquee' where user_id = u and status = 'active';
  update public.demandes set status = 'masquee' where user_id = u and status = 'active';
  insert into public.admin_journal (admin_id, action, cible_id, motif, detail)
  values (auth.uid(), 'numero_rendu', u, left(m, 300), jsonb_build_object('tel', t, 'nouvelle_adresse', v_neuf));
  return json_build_object('compte', u, 'tel', t, 'libre', true);
end $$;

-- code secret changé par l'équipe : motif, journal (jamais le code), message au membre
create or replace function public.admin_reinitialiser_journal(compte uuid, nouveau text, motif text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare m text := nullif(btrim(coalesce(motif, '')), '');
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if m is null or char_length(m) < 5 or char_length(m) > 300 then raise exception 'Indiquez pourquoi le code est changé (5 à 300 caractères).'; end if;
  if coalesce(nouveau, '') ~ '^(\d)\1{5}$' or nouveau in ('123456', '654321') then raise exception 'Code trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.'; end if;
  perform public.admin_reinitialiser(compte, nouveau);
  insert into public.admin_journal (admin_id, action, cible_id, motif) values (auth.uid(), 'code_change', compte, left(m, 300));
  perform public._equipe_ecrire(compte, 'Votre code de connexion vient d’être changé par l’équipe du Marché de Gros, comme vous l’avez demandé. Si ce n’est pas vous qui l’avez demandé, répondez ici tout de suite.');
end $$;
revoke execute on function public.admin_reinitialiser(uuid, text) from public, anon, authenticated;

-- compte supprimé : le numéro redevient libre (le compte reste fermé et ses traces gardées)
create or replace function public._numero_libere_suppression()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_neuf text;
begin
  if new.supprime_le is not null and old.supprime_le is null and not exists (select 1 from public.bannis b where b.user_id = new.user_id) then
    v_neuf := public._numero_detacher(new.user_id, 'supprime');
    if v_neuf is not null then
      insert into public.admin_journal (admin_id, action, cible_id, detail)
      values (case when public.est_admin() then auth.uid() end, 'numero_libere', new.user_id, jsonb_build_object('nouvelle_adresse', v_neuf));
    end if;
  end if;
  return new;
end $$;
create or replace trigger profils_numero_libere after update of supprime_le on public.profils
  for each row execute function public._numero_libere_suppression();

-- le numéro montré à l'équipe dans les conversations vient de l'adresse de connexion (pas des données du téléphone)
create or replace function public.admin_discussions()
returns table(id uuid, a_id uuid, b_id uuid, a_nom text, b_nom text, a_tel text, b_tel text, dernier_texte text, dernier_par uuid, updated_at timestamptz, n bigint, alertes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  return query
  select d.id, d.a_id, d.b_id, coalesce(public.nom_public(d.a_id), 'Membre'), coalesce(public.nom_public(d.b_id), 'Membre'),
         (select case when ua.email like '225%@tel.marchedegros.ci' then substr(split_part(ua.email, '@', 1), 4) end from auth.users ua where ua.id = d.a_id),
         (select case when ub.email like '225%@tel.marchedegros.ci' then substr(split_part(ub.email, '@', 1), 4) end from auth.users ub where ub.id = d.b_id),
         d.dernier_texte, d.dernier_par, d.updated_at, (select count(*) from public.dm m where m.discussion_id = d.id),
         (select count(*) from public.alertes al where al.ref_id = d.id)
  from public.discussions d where d.dernier_par is not null order by d.updated_at desc limit 500;
end $$;

revoke execute on function public._equipe_ecrire(uuid, text) from public, anon, authenticated;
revoke execute on function public._numero_detacher(uuid, text) from public, anon, authenticated;
revoke execute on function public._numero_libere_suppression() from public, anon, authenticated;
revoke execute on function public.admin_numero_rendre(text, text) from public, anon;
revoke execute on function public.admin_reinitialiser_journal(uuid, text, text) from public, anon;
grant execute on function public.admin_numero_rendre(text, text) to authenticated;
grant execute on function public.admin_reinitialiser_journal(uuid, text, text) to authenticated;
