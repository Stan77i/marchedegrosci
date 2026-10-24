-- Schéma 84e : fiabilité (chantier 2). Partie 5 : clore un litige en désignant la partie fautive par son rôle.
-- L'écran des commandes de l'administrateur ne connaît que les rôles (vendeur, acheteur), pas les identifiants :
-- cette porte traduit le rôle, puis appelle admin_litige_trancher2 (schéma 84a). Sans rôle : imputé à personne.
-- Testé sur le projet de test, pas encore appliqué en production.

create or replace function public.admin_litige_clore(p_cmd uuid, p_issue text, p_note text, p_fautif text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.commandes;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_fautif is not null and p_fautif not in ('vendeur', 'acheteur') then raise exception 'Partie fautive : vendeur, acheteur ou personne.'; end if;
  select * into c from public.commandes where id = p_cmd;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  perform public.admin_litige_trancher2(p_cmd, p_issue, p_note,
    case p_fautif when 'vendeur' then c.vendeur_id when 'acheteur' then c.acheteur_id end);
end $$;
revoke all on function public.admin_litige_clore(uuid, text, text, text) from public, anon;
grant execute on function public.admin_litige_clore(uuid, text, text, text) to authenticated;
