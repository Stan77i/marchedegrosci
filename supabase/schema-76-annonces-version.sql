-- ═════════ Schéma 76 (23/10/2026) — annonces : le téléphone ne retélécharge plus tout quand rien n'a changé ═════════
-- Mesuré par le test de charge : toutes les 2 minutes, chaque téléphone ouvert retéléchargeait jusqu'à 500 offres et
-- 500 demandes (≈ 506 Ko avec une base pleine), même sans aucun changement — premier poste de bande passante (5 Go/mois en gratuit).
-- Correction :
--   • colonne maj_le sur offres et demandes : date de la dernière écriture, TOUJOURS fixée par la base (déclencheur,
--     à l'insertion comme à la modification ; le téléphone ne peut pas la choisir) ;
--   • annonces_version() (ouverte à tous) : un petit résumé « nombre d'annonces actives + dernière écriture » par table ;
--     l'application le demande d'abord et ne retélécharge les listes que s'il a changé.
-- Ajouts seulement (add column if not exists, create index if not exists, create or replace) : aucun « drop ».

alter table public.offres   add column if not exists maj_le timestamptz not null default now();
alter table public.demandes add column if not exists maj_le timestamptz not null default now();
create index if not exists offres_maj_le   on public.offres   (maj_le);
create index if not exists demandes_maj_le on public.demandes (maj_le);

create or replace function public.annonce_maj_le() returns trigger
language plpgsql set search_path = public as $$
begin
  new.maj_le := clock_timestamp();
  return new;
end $$;
revoke execute on function public.annonce_maj_le() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.offres'::regclass and tgname = 'offres_maj_le') then
    create trigger offres_maj_le before insert or update on public.offres for each row execute function public.annonce_maj_le();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.demandes'::regclass and tgname = 'demandes_maj_le') then
    create trigger demandes_maj_le before insert or update on public.demandes for each row execute function public.annonce_maj_le();
  end if;
end $$;

create or replace function public.annonces_version() returns text
language sql stable security definer set search_path = public as $$
  select concat_ws('|',
    (select count(*) from public.offres where status = 'active'),
    (select extract(epoch from max(maj_le))::numeric(20, 6) from public.offres),
    (select count(*) from public.demandes where status = 'active'),
    (select extract(epoch from max(maj_le))::numeric(20, 6) from public.demandes));
$$;
revoke execute on function public.annonces_version() from public;
grant execute on function public.annonces_version() to anon, authenticated;
