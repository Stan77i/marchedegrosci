-- ═════════ Marché de Gros CI — à coller vous-même dans Supabase (SQL Editor → New query → coller → Run) ═════════
-- Tout le reste de l'étape 2 est déjà installé. Supabase demande que ces lignes soient lancées par le propriétaire du projet,
-- parce qu'elles permettent de changer un code secret (mot de passe) : c'est une protection normale.
--
--   1. « Code oublié » : choisir un nouveau code avec son code de secours (sans SMS).
--   2. Tableau de bord : remettre un nouveau code à un vendeur qui vous appelle.
--   3. Vous déclarer administrateur : REMPLACEZ 0700000000 par VOTRE numéro (10 chiffres) avant de lancer.

create or replace function public.reinitialiser_code(tel text, cle text, nouveau text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare t text := regexp_replace(coalesce(tel, ''), '\D', '', 'g'); u uuid; h text; rates int; neuve text;
begin
  if length(t) = 13 and left(t, 3) = '225' then t := substr(t, 4); end if;
  if t !~ '^[0-9]{10}$' then raise exception 'Numéro à 10 chiffres, par exemple 07 01 02 03 04.'; end if;
  if coalesce(nouveau, '') !~ '^[0-9]{6}$' then raise exception 'Le nouveau code secret fait 6 chiffres.'; end if;
  if nouveau ~ '^(\d)\1{5}$' or nouveau in ('123456', '654321') then raise exception 'Code trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.'; end if;
  select count(*) into rates from public.secours_essais where secours_essais.tel = t and not ok and at > now() - interval '1 hour';
  if rates >= 5 then raise exception 'Trop d''essais. Réessayez dans une heure, ou appelez le Marché de Gros.'; end if;
  select id into u from auth.users where email = '225' || t || '@tel.marchedegros.ci';
  select s.hash into h from public.secours s where s.user_id = u;
  if u is null or h is null or crypt(upper(regexp_replace(coalesce(cle, ''), '[^A-Za-z0-9]', '', 'g')), h) <> h then
    insert into public.secours_essais (tel, ok) values (t, false);
    raise exception 'Numéro ou code de secours incorrect.';
  end if;
  insert into public.secours_essais (tel, ok) values (t, true);
  update auth.users set encrypted_password = crypt(nouveau, gen_salt('bf', 10)), updated_at = now() where id = u;
  delete from auth.sessions where user_id = u;
  neuve := public._cle_secours();
  update public.secours set hash = crypt(neuve, gen_salt('bf', 8)), created_at = now() where user_id = u;
  return neuve;
end $$;

create or replace function public.admin_reinitialiser(compte uuid, nouveau text) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if coalesce(nouveau, '') !~ '^[0-9]{6}$' then raise exception 'Le nouveau code secret fait 6 chiffres.'; end if;
  update auth.users set encrypted_password = crypt(nouveau, gen_salt('bf', 10)), updated_at = now() where id = compte;
  if not found then raise exception 'Compte introuvable.'; end if;
  delete from auth.sessions where user_id = compte;
end $$;

revoke execute on function public.reinitialiser_code(text, text, text) from public;
grant execute on function public.reinitialiser_code(text, text, text) to anon, authenticated;
revoke execute on function public.admin_reinitialiser(uuid, text) from public, anon;
grant execute on function public.admin_reinitialiser(uuid, text) to authenticated;

-- 3. administrateur : votre numéro à la place de 0700000000
insert into public.admins (user_id) select id from auth.users where email = '225' || '0700000000' || '@tel.marchedegros.ci' on conflict do nothing;

-- nettoyage : une fonction d'essai vide créée pendant l'installation, et les fonctions de négociation de l'étape 2,
-- remplacées par nego_ouvrir / nego_agir (étape 3, déjà installée) et déjà rendues inaccessibles
drop function if exists public._essai_tmp();
drop function if exists public.proposer_prix(text, uuid, numeric, text);
drop function if exists public.negocier(uuid, text, numeric, text);

select (select count(*) from public.admins) as administrateurs;
