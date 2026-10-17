-- Marché de Gros CI — schéma 11 : zones de « forte demande » posées sur la carte par l'administration (appliqué le 17/10/2026)
-- Une zone = un district (et une ville), un produit facultatif, une note courte, une date de fin (14 jours par défaut).
-- Lecture : tout le monde (zones en cours). Création, modification, retrait : administrateurs seulement.
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null default 'demande' check (kind in ('demande', 'offre')),
  product_slug text check (char_length(product_slug) <= 80),
  product_label text check (char_length(product_label) <= 120),
  region_slug text not null check (char_length(region_slug) <= 60),
  city text check (char_length(city) <= 80),
  note text check (char_length(note) <= 200),
  expire_le timestamptz not null default now() + interval '14 days'
);
create index if not exists zones_expire_idx on public.zones (expire_le);
create index if not exists zones_created_by_idx on public.zones (created_by);
alter table public.zones enable row level security;
create policy "zones visibles par tous" on public.zones for select to anon, authenticated using (expire_le > now() or (select public.est_admin()));
create policy "admin crée les zones" on public.zones for insert to authenticated with check ((select public.est_admin()));
create policy "admin modifie les zones" on public.zones for update to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));
create policy "admin retire les zones" on public.zones for delete to authenticated using ((select public.est_admin()));
grant select on public.zones to anon, authenticated;
grant insert, update, delete on public.zones to authenticated;
