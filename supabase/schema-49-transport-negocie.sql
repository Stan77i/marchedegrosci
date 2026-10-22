-- ═════════ Marché de Gros CI — schéma 49 : le transport se négocie avec le prix ═════════
-- Demandé par le propriétaire le 22/10/2026 : « si le transport n'est pas inclus, c'est une discussion dans la négociation :
-- l'acheteur dit "transport inclus, c'est combien ?" et le vendeur arrange son prix ».
-- Aucune donnée effacée, aucun drop. nego_agir et nego_ouvrir ne changent pas (anciennes versions de l'app).
--   • une proposition de prix peut dire « transport inclus » (vrai) ou « sans transport » (faux) ; rien = pas précisé ;
--   • l'auteur de la proposition en attente la marque avec nego_transport, juste après l'avoir envoyée ;
--   • à l'accord, l'information passe dans negociations.transport_final (et dans le message d'accord) ;
--   • commande_creer : si l'accord dit « transport inclus », c'est le vendeur qui transporte (pas de transporteur du réseau) ;
--     si l'accord dit « sans transport », l'annonce ne l'impose plus.
alter table public.messages add column if not exists transport_inclus boolean;
alter table public.negociations add column if not exists dernier_transport boolean;
alter table public.negociations add column if not exists transport_final boolean;

create or replace function public.nego_transport(p_nego uuid, p_oui boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; m public.messages;
begin
  select * into n from public.negociations where id = p_nego for update;
  if n.id is null or me is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Négociation introuvable.'; end if;
  if n.dernier_msg is null or n.dernier_par is distinct from me then raise exception 'Vous n''avez pas de proposition en attente.'; end if;
  select * into m from public.messages where id = n.dernier_msg;
  if m.issue <> 'en_attente' or m.genre <> 'prix' then raise exception 'Vous n''avez pas de proposition en attente.'; end if;
  update public.messages set transport_inclus = p_oui where id = m.id;
  update public.negociations set dernier_transport = p_oui where id = n.id;
end $$;
revoke execute on function public.nego_transport(uuid, boolean) from public, anon;
grant execute on function public.nego_transport(uuid, boolean) to authenticated;

-- une nouvelle proposition repart de « pas précisé » ; à l'accord, on garde ce que disait la proposition acceptée
create or replace function public.nego_transport_suivi() returns trigger
language plpgsql security definer set search_path = public as $$
declare t boolean;
begin
  if new.dernier_msg is distinct from old.dernier_msg and new.dernier_msg is not null then new.dernier_transport := null; end if;
  if old.statut is distinct from 'conclue' and new.statut = 'conclue' and old.dernier_msg is not null then
    select transport_inclus into t from public.messages where id = old.dernier_msg;
    new.transport_final := t;
    update public.messages set transport_inclus = t where negociation_id = new.id and genre = 'accord' and transport_inclus is null;
  end if;
  return new;
end $$;
revoke execute on function public.nego_transport_suivi() from public, anon, authenticated;
create or replace trigger negociations_transport before update on public.negociations
  for each row execute function public.nego_transport_suivi();

-- la commande suit l'accord d'abord, l'annonce ensuite
do $$ declare d text; begin
  d := pg_get_functiondef('public.commande_creer(uuid,text,text,text)'::regprocedure);
  if position('n.transport_final' in d) > 0 then return; end if;
  d := replace(d, 'if p_mode <> ''vendeur'' and public._transport_vendeur(n.cible, n.cible_id) then',
                  'if p_mode <> ''vendeur'' and coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id)) then');
  if position('n.transport_final' in d) = 0 then raise exception 'commande_creer : motif introuvable'; end if;
  execute d;
end $$;
