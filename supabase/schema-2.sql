-- ═════════ Marché de Gros CI — étape 2 : code de secours, administration, négociation des prix ═════════
-- À lancer APRÈS schema.sql (SQL Editor → New query → coller → Run). Peut être relancé sans danger.
--
--   • Code de secours : remis une seule fois à l'ouverture du compte ; il permet de choisir un nouveau code secret
--     sans SMS (aucun frais). Il est gardé chiffré (bcrypt) : personne, pas même l'administrateur, ne peut le relire.
--   • Administration : les comptes listés dans public.admins voient tout (annonces masquées, signalements, comptes,
--     négociations), peuvent masquer, rétablir ou supprimer une annonce et réinitialiser le code d'un compte.
--   • Négociation : un acheteur propose un prix sur une offre (ou un vendeur sur une demande), l'autre accepte,
--     refuse ou fait une contre-proposition. Toutes les écritures passent par des fonctions qui vérifient les règles.

-- ——— Administrateurs ———
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- l'administrateur voit et modère toutes les annonces
drop policy if exists "admin lit les offres"       on public.offres;
drop policy if exists "admin modère les offres"    on public.offres;
drop policy if exists "admin supprime les offres"  on public.offres;
create policy "admin lit les offres"      on public.offres for select to authenticated using ((select public.est_admin()));
create policy "admin modère les offres"   on public.offres for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "admin supprime les offres" on public.offres for delete to authenticated using ((select public.est_admin()));
drop policy if exists "admin lit les demandes"       on public.demandes;
drop policy if exists "admin modère les demandes"    on public.demandes;
drop policy if exists "admin supprime les demandes"  on public.demandes;
create policy "admin lit les demandes"      on public.demandes for select to authenticated using ((select public.est_admin()));
create policy "admin modère les demandes"   on public.demandes for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "admin supprime les demandes" on public.demandes for delete to authenticated using ((select public.est_admin()));
drop policy if exists "admin lit les signalements"      on public.signalements;
drop policy if exists "admin supprime les signalements" on public.signalements;
create policy "admin lit les signalements"      on public.signalements for select to authenticated using ((select public.est_admin()));
create policy "admin supprime les signalements" on public.signalements for delete to authenticated using ((select public.est_admin()));
drop policy if exists "admin lit les admins" on public.admins;
create policy "admin lit les admins" on public.admins for select to authenticated using ((select public.est_admin()));
grant select, delete on public.signalements to authenticated;
grant select on public.admins to authenticated;

-- ——— Code de secours ———
create table if not exists public.secours (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hash       text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.secours_essais (
  id    bigint generated always as identity primary key,
  tel   text not null,
  ok    boolean not null,
  at    timestamptz not null default now()
);
create index if not exists secours_essais_tel on public.secours_essais (tel, at desc);
alter table public.secours       enable row level security;  -- aucune politique : illisible depuis le site
alter table public.secours_essais enable row level security;

-- 12 caractères sans 0/O/1/I (faciles à recopier), environ 60 bits : impossible à deviner
create or replace function public._cle_secours() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' order by i)
  from (select gen_random_bytes(12) b) r, generate_series(0, 11) i;
$$;

-- crée (ou remplace) le code de secours du compte connecté et le renvoie UNE seule fois
create or replace function public.creer_secours() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare cle text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  cle := public._cle_secours();
  insert into public.secours (user_id, hash) values (auth.uid(), crypt(cle, gen_salt('bf', 8)))
  on conflict (user_id) do update set hash = excluded.hash, created_at = now();
  return cle;
end $$;

create or replace function public.a_secours() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.secours where user_id = auth.uid());
$$;

-- choisir un nouveau code secret avec le code de secours (sans être connecté)
-- 5 essais rates par numéro et par heure au maximum ; en cas de succès, un NOUVEAU code de secours est renvoyé
-- et toutes les connexions ouvertes ailleurs sont fermées.
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

-- ——— Négociation des prix ———
create table if not exists public.negociations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  cible         text not null check (cible in ('offre', 'demande')),
  cible_id      uuid not null,
  auteur_id     uuid not null references auth.users(id) on delete cascade,   -- celui qui ouvre la négociation
  proprio_id    uuid not null references auth.users(id) on delete cascade,   -- celui qui a publié l'annonce
  produit       text,
  ville         text,
  unite         text,
  quantite      numeric,
  prix_annonce  numeric,
  dernier_prix  numeric,
  dernier_par   uuid,
  prix_final    numeric,
  statut        text not null default 'ouverte' check (statut in ('ouverte', 'conclue', 'close')),
  lu_auteur     timestamptz not null default now(),
  lu_proprio    timestamptz not null default 'epoch',
  unique (cible, cible_id, auteur_id)
);
create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  negociation_id uuid not null references public.negociations(id) on delete cascade,
  auteur_id      uuid not null references auth.users(id) on delete cascade,
  genre          text not null check (genre in ('texte', 'prix', 'accord', 'refus', 'fin')),
  prix           numeric check (prix is null or (prix > 0 and prix < 1e9)),
  texte          text check (char_length(texte) <= 500)
);
create index if not exists nego_auteur  on public.negociations (auteur_id, updated_at desc);
create index if not exists nego_proprio on public.negociations (proprio_id, updated_at desc);
create index if not exists msg_nego     on public.messages (negociation_id, created_at);
alter table public.negociations enable row level security;
alter table public.messages     enable row level security;

drop policy if exists "voir mes négociations" on public.negociations;
create policy "voir mes négociations" on public.negociations for select to authenticated
  using (auteur_id = auth.uid() or proprio_id = auth.uid() or (select public.est_admin()));
drop policy if exists "voir mes messages" on public.messages;
create policy "voir mes messages" on public.messages for select to authenticated
  using (exists (select 1 from public.negociations n where n.id = negociation_id and (n.auteur_id = auth.uid() or n.proprio_id = auth.uid())) or (select public.est_admin()));
grant select on public.negociations, public.messages to authenticated;  -- écriture : seulement par les fonctions ci-dessous

-- ouvrir (ou reprendre) une négociation sur une annonce active d'un autre compte, avec une première proposition
create or replace function public.proposer_prix(cible text, cible_id uuid, prix numeric, texte text default null) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); a record; n uuid; ouvertes int;
begin
  if me is null then raise exception 'Connectez-vous pour proposer un prix.'; end if;
  if prix is null or prix <= 0 or prix >= 1e9 then raise exception 'Indiquez un prix.'; end if;
  if cible = 'offre' then
    select user_id, product_label, city, unit, quantity, price as p, status into a from public.offres where id = cible_id;
  elsif cible = 'demande' then
    select user_id, product_label, city, unit, quantity, budget as p, status into a from public.demandes where id = cible_id;
  else raise exception 'Annonce inconnue.'; end if;
  if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
  if a.user_id = me then raise exception 'C''est votre propre annonce.'; end if;
  select count(*) into ouvertes from public.negociations where auteur_id = me and statut = 'ouverte' and created_at > now() - interval '1 day';
  if ouvertes >= 40 then raise exception 'Limite atteinte : 40 négociations ouvertes par jour.'; end if;
  insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, prix_annonce)
  values (cible, cible_id, me, a.user_id, a.product_label, a.city, a.unit, a.quantity, a.p)
  on conflict on constraint negociations_cible_cible_id_auteur_id_key do update set statut = 'ouverte', prix_final = null
  returning id into n;
  perform public.negocier(n, 'prix', prix, texte);
  return n;
end $$;

-- écrire dans une négociation : 'texte' (message), 'prix' (proposition ou contre-proposition),
-- 'accord' (accepter la dernière proposition de l'autre), 'refus' (la refuser), 'fin' (arrêter la négociation)
create or replace function public.negocier(nego uuid, genre text, prix numeric default null, texte text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; t text := nullif(btrim(coalesce(texte, '')), ''); dernier int;
begin
  select * into n from public.negociations where id = nego for update;
  if n.id is null or me is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Négociation introuvable.'; end if;
  if genre not in ('texte', 'prix', 'accord', 'refus', 'fin') then raise exception 'Action inconnue.'; end if;
  if char_length(t) > 500 then raise exception 'Message trop long (500 caractères au plus).'; end if;
  select count(*) into dernier from public.messages where auteur_id = me and created_at > now() - interval '1 minute';
  if dernier >= 20 then raise exception 'Trop de messages d''un coup. Patientez une minute.'; end if;
  if genre = 'texte' then
    if t is null then raise exception 'Message vide.'; end if;
  elsif n.statut <> 'ouverte' and not (genre = 'prix' and n.statut = 'close') then
    raise exception 'Cette négociation est terminée.';
  elsif genre = 'prix' then
    if prix is null or prix <= 0 or prix >= 1e9 then raise exception 'Indiquez un prix.'; end if;
    update public.negociations set dernier_prix = prix, dernier_par = me, statut = 'ouverte' where id = nego;
  elsif genre = 'accord' then
    if n.dernier_prix is null or n.dernier_par is null or n.dernier_par = me then raise exception 'Il n''y a pas de proposition de l''autre partie à accepter.'; end if;
    prix := n.dernier_prix;
    update public.negociations set statut = 'conclue', prix_final = n.dernier_prix where id = nego;
  elsif genre = 'refus' then
    if n.dernier_prix is null or n.dernier_par is null or n.dernier_par = me then raise exception 'Il n''y a pas de proposition de l''autre partie à refuser.'; end if;
    prix := n.dernier_prix;
    update public.negociations set dernier_par = null where id = nego;  -- la proposition refusée ne peut plus être acceptée
  elsif genre = 'fin' then
    update public.negociations set statut = 'close' where id = nego;
  end if;
  insert into public.messages (negociation_id, auteur_id, genre, prix, texte)
  values (nego, me, genre, case when genre in ('prix', 'accord', 'refus') then prix end, t);
  update public.negociations set updated_at = now(),
    lu_auteur  = case when me = auteur_id  then now() else lu_auteur end,
    lu_proprio = case when me = proprio_id then now() else lu_proprio end
  where id = nego;
end $$;

create or replace function public.marquer_lu(nego uuid) returns void
language sql volatile security definer set search_path = public as $$
  update public.negociations set
    lu_auteur  = case when auth.uid() = auteur_id  then now() else lu_auteur end,
    lu_proprio = case when auth.uid() = proprio_id then now() else lu_proprio end
  where id = nego and auth.uid() in (auteur_id, proprio_id);
$$;

-- ——— Fonctions de l'administrateur ———
create or replace function public.admin_comptes()
returns table (id uuid, tel text, created_at timestamptz, last_sign_in_at timestamptz, offres bigint, demandes bigint, negociations bigint, signale bigint, admin boolean, secours boolean)
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
    exists (select 1 from public.secours c where c.user_id = u.id)
  from auth.users u order by u.created_at desc;
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

-- ——— Droits : seules les fonctions prévues pour le site sont appelables ———
revoke execute on function public._cle_secours() from public, anon, authenticated;
revoke execute on function public.est_admin() from public, anon;
revoke execute on function public.creer_secours(), public.a_secours(), public.proposer_prix(text, uuid, numeric, text),
  public.negocier(uuid, text, numeric, text), public.marquer_lu(uuid), public.admin_comptes(), public.admin_reinitialiser(uuid, text) from public, anon;
grant execute on function public.est_admin(), public.creer_secours(), public.a_secours(), public.proposer_prix(text, uuid, numeric, text),
  public.negocier(uuid, text, numeric, text), public.marquer_lu(uuid), public.admin_comptes(), public.admin_reinitialiser(uuid, text) to authenticated;
revoke execute on function public.reinitialiser_code(text, text, text) from public;
grant execute on function public.reinitialiser_code(text, text, text) to anon, authenticated;
revoke truncate, references, trigger on public.admins, public.secours, public.secours_essais, public.negociations, public.messages from anon, authenticated;
revoke all on public.secours, public.secours_essais from anon, authenticated;
revoke insert, update, delete on public.negociations, public.messages, public.admins from anon, authenticated;

-- ——— Le premier administrateur ———
-- Remplacez le numéro par le vôtre (10 chiffres) si besoin, puis lancez cette ligne :
-- insert into public.admins (user_id) select id from auth.users where email = '225' || '0700000000' || '@tel.marchedegros.ci' on conflict do nothing;
