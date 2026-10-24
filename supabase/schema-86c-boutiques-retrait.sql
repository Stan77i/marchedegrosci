-- Schéma 86c : « Retirer » ferme aussi les négociations ouvertes (complément du schéma 86).
-- Avant, retirer effaçait la ligne et nego_annonce_retiree fermait les négociations. Maintenant la ligne reste (retiree_le) :
-- si seul retiree_le change (sans status dans la demande), on ferme les négociations ouvertes de la même façon.
create or replace function public._boutique_retrait_negos() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text := case when tg_table_name = 'offres' then 'offre' else 'demande' end;
begin
  if new.retiree_le is not null and old.retiree_le is null then
    update public.negociations set statut = 'close', motif_fin = 'annonce_retiree', updated_at = now()
    where cible = c and cible_id = new.id and statut = 'ouverte';
    update public.messages set issue = 'retiree' where issue = 'en_attente'
      and negociation_id in (select id from public.negociations where cible = c and cible_id = new.id);
  end if;
  return new;
end $$;
create or replace trigger offres_boutique_retrait after update of retiree_le on public.offres
  for each row execute function public._boutique_retrait_negos();
create or replace trigger demandes_boutique_retrait after update of retiree_le on public.demandes
  for each row execute function public._boutique_retrait_negos();
revoke execute on function public._boutique_retrait_negos() from public, anon, authenticated;
