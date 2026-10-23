-- ═════════ Schéma 74 (23/10/2026) — photos du profil public : seulement celles du membre, dans le stockage de l'application ═════════
-- Faille trouvée à l'audit : profils.photos acceptait n'importe quel lien https ; chaque visiteur du profil chargeait alors
-- l'image depuis un site extérieur (traçage de l'adresse des visiteurs, images qui échappent à la modération).
-- L'application range les photos dans le stockage « activites » sous la forme « <identifiant du compte>/<numéro>.jpg ».
-- Correction : un contrôle avant chaque enregistrement ne garde que ces chemins-là (dossier du membre lui-même), 6 au plus ;
-- tout lien extérieur ou chemin d'un autre compte est retiré. Comme pour le logo de structure (structure_propre).
-- Aucun « drop » : fonction nouvelle, déclencheur créé seulement s'il n'existe pas.

create or replace function public.profil_photos_propres() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.photos is not null then
    new.photos := coalesce((select array_agg(x order by i) from (
                              select x, i from unnest(new.photos) with ordinality u(x, i)
                              where x ~ ('^' || new.user_id::text || '/[A-Za-z0-9._-]{1,80}$') order by i limit 6) z), '{}');
  end if;
  return new;
end $$;
revoke execute on function public.profil_photos_propres() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.profils'::regclass and tgname = 'profils_photos_propres') then
    create trigger profils_photos_propres before insert or update of photos on public.profils
      for each row execute function public.profil_photos_propres();
  end if;
end $$;
