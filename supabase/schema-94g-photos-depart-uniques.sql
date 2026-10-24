-- Schéma 94g (équipe Confiance, audit du 24/10/2026, P2 n° 15, photos seulement ; partie 8 « photos de départ réutilisables ») :
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- Les photos du colis au départ prouvent CETTE expédition :
--  • elles doivent avoir été envoyées après la confirmation de la commande (date d'envoi de la photo sur le serveur) ;
--  • une photo déjà utilisée pour une autre commande est refusée ;
--  • la même photo ne compte pas deux fois dans la même commande.
-- Le reste de commande_depart_preuves est inchangé (schéma 90). Le mot secret et l'étape « Arrivée » sont traités par une autre équipe.

create index if not exists commandes_depart_photos_gin on public.commandes using gin (depart_photos);

create or replace function public.commande_depart_preuves(p_id uuid, p_photos text[], p_poids_kg numeric)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; x text; confirme timestamptz; envoyee timestamptz;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Seul le vendeur photographie le colis au départ.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation')) then raise exception 'Les photos du départ se prennent avant le chargement.'; end if;
  if p_photos is null or cardinality(p_photos) < 2 or cardinality(p_photos) > 4 then raise exception 'Ajoutez de 2 à 4 photos du colis emballé.'; end if;
  if (select count(distinct y) from unnest(p_photos) y) <> cardinality(p_photos) then raise exception 'La même photo est envoyée deux fois : prenez des photos différentes du colis.'; end if;
  -- moment de la confirmation : premier passage à « confirmée » dans le journal de la commande, sinon sa création
  select min(e.at) into confirme from public.commande_etapes e where e.commande_id = c.id and e.evenement = 'confirmee';
  confirme := coalesce(confirme, c.created_at);
  foreach x in array p_photos loop
    select o.created_at into envoyee from storage.objects o where o.bucket_id = 'preuves' and o.name = x;
    if split_part(x, '/', 1) <> me::text or envoyee is null then
      raise exception 'Photo introuvable : renvoyez-la.';
    end if;
    if envoyee < confirme then
      raise exception 'Photo prise avant la confirmation de la commande : photographiez le colis préparé pour cette commande.';
    end if;
    if exists (select 1 from public.commandes k where k.id <> c.id and k.depart_photos @> array[x]) then
      raise exception 'Cette photo sert déjà pour une autre commande : photographiez le colis de cette commande.';
    end if;
  end loop;
  if p_poids_kg is null or p_poids_kg <= 0 or p_poids_kg > 100000 then raise exception 'Indiquez le poids pesé, en kilos.'; end if;
  update public.commandes set depart_photos = p_photos, depart_poids_kg = round(p_poids_kg, 1), depart_le = now() where id = c.id;
end $$;
