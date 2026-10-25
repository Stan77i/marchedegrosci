-- Schéma 98b : un membre suspendu ne propose plus de prix et ne conclut plus d'accord (contrôle qualité LOG-12, 25/10/2026).
-- Avant : l'autre partie pouvait encore conclure avec un membre suspendu (aucune garde dans nego_agir) ; la commande était
-- ensuite refusée par _fiab_garde_commande (« Ce membre est suspendu ») : accord sans suite, stock immobilisé 72 h.
-- Maintenant, deux déclencheurs (nego_agir n'est pas réécrite) :
--   messages, genre « prix » (proposition ou contre-proposition) : refusée si l'auteur ou l'autre partie est suspendu ;
--   negociations, passage à « conclue » : refusé si l'un des deux est suspendu.
-- Les simples messages, le refus d'une proposition, le retrait et l'arrêt restent possibles ; les commandes en cours continuent (décision 16).
-- Messages : ceux des gardes du schéma 84b (négociation et commande).
-- Appliqué sur le projet de TEST le 25/10/2026. Production : à appliquer par l'équipe qui y travaille.

create or replace function public._fiab_garde_suspendus(p_moi uuid, p_a uuid, p_b uuid, p_quoi text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_moi is not null and p_moi in (p_a, p_b) and public.est_suspendu(p_moi) then
    raise exception 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos commandes en cours continuent.';
  end if;
  if public.est_suspendu(p_a) or public.est_suspendu(p_b) then
    raise exception 'Ce membre est suspendu pour l''instant : pas de % avec lui.', p_quoi;
  end if;
end $$;
revoke all on function public._fiab_garde_suspendus(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public._fiab_garde_proposition()
returns trigger language plpgsql security definer set search_path = public as $$
declare n public.negociations;
begin
  if new.genre <> 'prix' or new.negociation_id is null then return new; end if;
  select * into n from public.negociations where id = new.negociation_id;
  if n.id is null then return new; end if;
  perform public._fiab_garde_suspendus(coalesce(auth.uid(), new.auteur_id), n.auteur_id, n.proprio_id, 'nouvelle proposition');
  return new;
end $$;
revoke all on function public._fiab_garde_proposition() from public, anon, authenticated;

create or replace function public._fiab_garde_accord()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._fiab_garde_suspendus(auth.uid(), new.auteur_id, new.proprio_id, 'nouvel accord');
  return new;
end $$;
revoke all on function public._fiab_garde_accord() from public, anon, authenticated;

create or replace trigger messages_fiab_garde_prix before insert on public.messages
  for each row when (new.genre = 'prix') execute function public._fiab_garde_proposition();
create or replace trigger negociations_fiab_garde_accord before update of statut on public.negociations
  for each row when (new.statut = 'conclue' and old.statut is distinct from 'conclue') execute function public._fiab_garde_accord();
