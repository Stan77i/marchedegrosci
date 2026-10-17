-- Marché de Gros CI — schéma 9 : lieu de l'annonce et contact dans l'application (appliqué le 17/10/2026)
-- 1) « lieu » : une annonce publiée ailleurs que chez soi est marquée « intermediaire » (je vends pour d'autres)
--    ou « secteur » (j'ai un stock dans un autre secteur). Sur la carte, c'est toujours la même personne.
alter table public.offres   add column if not exists lieu text check (lieu in ('intermediaire', 'secteur'));
alter table public.demandes add column if not exists lieu text check (lieu in ('intermediaire', 'secteur'));

-- 2) Les échanges restent dans l'application : le numéro n'est plus publié avec les annonces.
--    Il reste attaché au compte (numéro d'inscription), visible des administrateurs seulement.
create or replace function public.sans_numero_public() returns trigger
language plpgsql set search_path = public as $$
begin new.phone := null; return new; end $$;
drop trigger if exists offres_sans_numero on public.offres;
create trigger offres_sans_numero before insert or update on public.offres for each row execute function public.sans_numero_public();
drop trigger if exists demandes_sans_numero on public.demandes;
create trigger demandes_sans_numero before insert or update on public.demandes for each row execute function public.sans_numero_public();
update public.offres set phone = null where phone is not null;
update public.demandes set phone = null where phone is not null;
