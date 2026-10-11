-- ═════════ Marché de Gros CI — base de données (Supabase, formule gratuite) ═════════
-- À coller UNE FOIS dans Supabase : menu de gauche « SQL Editor » → « New query » → coller → « Run ».
-- Le script peut être relancé sans danger (il ne supprime aucune donnée).
--
-- Principe :
--   • tout le monde peut LIRE les offres et demandes actives (sans compte) ;
--   • il faut être connecté (numéro de téléphone + code à 6 chiffres) pour PUBLIER ;
--   • chacun ne peut modifier ou retirer QUE ses propres annonces ;
--   • « Signaler » : 3 signalements de comptes différents masquent l'annonce en attendant une vérification.
-- Aucune donnée inventée : les tables sont vides au départ.

create extension if not exists pgcrypto;

-- ——— Offres (« J'ai ») ———
create table if not exists public.offres (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  client_id      text not null check (char_length(client_id) <= 60),        -- identifiant créé sur le téléphone (évite les doublons)
  product_slug   text not null check (char_length(product_slug) <= 80),
  product_label  text check (char_length(product_label) <= 120),
  region_slug    text not null check (char_length(region_slug) <= 60),
  city           text check (char_length(city) <= 80),
  quantity       numeric check (quantity is null or (quantity >= 0 and quantity < 1e9)),
  unit           text check (char_length(unit) <= 20),
  price          numeric check (price is null or (price >= 0 and price < 1e9)),
  available_from text check (char_length(available_from) <= 40),
  seller_name    text check (char_length(seller_name) <= 80),
  phone          text check (phone is null or phone ~ '^[0-9]{10}$'),
  agent          text check (char_length(agent) <= 80),
  status         text not null default 'active' check (status in ('active', 'retiree', 'masquee')),
  unique (user_id, client_id)
);

-- ——— Demandes (« Je cherche ») ———
create table if not exists public.demandes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  client_id      text not null check (char_length(client_id) <= 60),
  product_slug   text check (char_length(product_slug) <= 80),
  product_label  text check (char_length(product_label) <= 120),
  region_slug    text not null check (char_length(region_slug) <= 60),
  city           text check (char_length(city) <= 80),
  quantity       numeric check (quantity is null or (quantity >= 0 and quantity < 1e9)),
  unit           text check (char_length(unit) <= 20),
  budget         numeric check (budget is null or (budget >= 0 and budget < 1e9)),
  deadline       text check (char_length(deadline) <= 40),
  buyer_type     text check (char_length(buyer_type) <= 60),
  buyer_name     text check (char_length(buyer_name) <= 80),
  phone          text check (phone is null or phone ~ '^[0-9]{10}$'),
  status         text not null default 'active' check (status in ('active', 'retiree', 'masquee')),
  unique (user_id, client_id)
);

-- ——— Signalements (« Signaler une annonce ») ———
create table if not exists public.signalements (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  cible      text not null check (cible in ('offre', 'demande')),
  cible_id   uuid not null,
  motif      text check (char_length(motif) <= 300)
);

create index if not exists offres_recent   on public.offres (created_at desc) where status = 'active';
create index if not exists demandes_recent on public.demandes (created_at desc) where status = 'active';
create index if not exists signal_cible    on public.signalements (cible, cible_id);

-- ——— Sécurité ligne par ligne (RLS) ———
alter table public.offres       enable row level security;
alter table public.demandes     enable row level security;
alter table public.signalements enable row level security;

drop policy if exists "offres lisibles par tous"   on public.offres;
drop policy if exists "publier ses offres"         on public.offres;
drop policy if exists "modifier ses offres"        on public.offres;
drop policy if exists "retirer ses offres"         on public.offres;
create policy "offres lisibles par tous" on public.offres for select to anon, authenticated using (status = 'active' or user_id = auth.uid());
create policy "publier ses offres"       on public.offres for insert to authenticated with check (user_id = auth.uid() and status = 'active');
create policy "modifier ses offres"      on public.offres for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status <> 'masquee');
create policy "retirer ses offres"       on public.offres for delete to authenticated using (user_id = auth.uid());

drop policy if exists "demandes lisibles par tous" on public.demandes;
drop policy if exists "publier ses demandes"       on public.demandes;
drop policy if exists "modifier ses demandes"      on public.demandes;
drop policy if exists "retirer ses demandes"       on public.demandes;
create policy "demandes lisibles par tous" on public.demandes for select to anon, authenticated using (status = 'active' or user_id = auth.uid());
create policy "publier ses demandes"       on public.demandes for insert to authenticated with check (user_id = auth.uid() and status = 'active');
create policy "modifier ses demandes"      on public.demandes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status <> 'masquee');
create policy "retirer ses demandes"       on public.demandes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "signaler une annonce" on public.signalements;
create policy "signaler une annonce" on public.signalements for insert to anon, authenticated with check (true);
-- personne ne peut relire les signalements depuis le site (seulement depuis le tableau de bord Supabase)

-- ——— Accès donnés explicitement (« Automatically expose new tables » est désactivé) ———
grant usage on schema public to anon, authenticated;
grant select on public.offres, public.demandes to anon, authenticated;
grant insert, update, delete on public.offres, public.demandes to authenticated;
grant insert on public.signalements to anon, authenticated;

-- ——— Limite : 30 annonces actives par compte (protège la formule gratuite et évite les abus) ———
create or replace function public.limite_annonces() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where user_id = $1 and status = ''active''', tg_table_name) into n using new.user_id;
  if n >= 30 then raise exception 'Limite atteinte : 30 annonces actives par compte. Retirez-en une avant d''en publier une autre.'; end if;
  return new;
end $$;
drop trigger if exists offres_limite on public.offres;
drop trigger if exists demandes_limite on public.demandes;
create trigger offres_limite   before insert on public.offres   for each row execute function public.limite_annonces();
create trigger demandes_limite before insert on public.demandes for each row execute function public.limite_annonces();

-- ——— Modération : 3 signalements de comptes différents masquent l'annonce (les signalements anonymes sont gardés pour vous) ———
create or replace function public.apres_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- seuls les comptes connectés comptent (un visiteur anonyme ne peut pas masquer une annonce à lui seul en signalant 3 fois)
  select count(distinct user_id) into n from public.signalements where cible = new.cible and cible_id = new.cible_id and user_id is not null;
  if n >= 3 then
    if new.cible = 'offre' then update public.offres set status = 'masquee' where id = new.cible_id;
    else update public.demandes set status = 'masquee' where id = new.cible_id; end if;
  end if;
  return new;
end $$;
drop trigger if exists signalement_moderation on public.signalements;
create trigger signalement_moderation after insert on public.signalements for each row execute function public.apres_signalement();
