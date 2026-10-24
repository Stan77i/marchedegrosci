-- Schéma 94h (équipe Confiance, audit du 24/10/2026, P2 n° 26, seconde moitié) : la date de création d'une annonce vient du serveur.
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- Avant : un membre pouvait envoyer created_at = 01/01/2020 (test T6 de l'audit). Désormais, pour toute écriture faite par un membre
-- connecté ou un visiteur : à la création, created_at = maintenant ; à la modification, created_at ne change jamais.
-- Les scripts du serveur (sans membre connecté : imports, tâches) gardent la date qu'ils donnent.
-- La décision sur ce qui est public dans le profil (historique, volumes) reste à prendre par le propriétaire.

create or replace function public._annonce_date_serveur()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then new.created_at := now();
  else new.created_at := old.created_at; end if;
  return new;
end $$;

create or replace trigger offres_date_serveur before insert or update on public.offres
  for each row execute function public._annonce_date_serveur();
create or replace trigger demandes_date_serveur before insert or update on public.demandes
  for each row execute function public._annonce_date_serveur();

revoke execute on function public._annonce_date_serveur() from public, anon, authenticated;
