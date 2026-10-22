-- ═════════ Marché de Gros CI — schéma 52 : un lot entièrement vendu ne revient pas tout seul ═════════
-- Signalé par le propriétaire le 22/10/2026 : une demande de gombo (20 t) conclue à 20 t restait visible.
-- Cause : le serveur avait bien retiré la demande (schéma 12 : quantité − quantité convenue, retrait à zéro), mais le téléphone
-- de l'acheteur gardait son ancienne copie (20 t) et l'a renvoyée au serveur : la quantité est remontée à 20 t (statut resté « retiree »).
-- Correction dans l'application (v3/nuage.js : le téléphone reprend la quantité du serveur pour les offres ET les demandes, avant tout envoi).
-- Garde côté serveur (ce schéma) : sur une annonce dont le stock a été pris par un accord conclu,
--   • une annonce retirée à zéro ne voit pas sa quantité remonter par un renvoi du téléphone ;
--   • une annonce à zéro ne peut pas redevenir active.
-- Le propriétaire qui a vraiment de nouveau du stock publie une nouvelle annonce (comme au marché : nouveau lot, nouvelle annonce).
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune ligne effacée.

create or replace function public._stock_garde() returns trigger
language plpgsql security definer set search_path = public as $$
declare vendu boolean;
begin
  if old.quantity is null or current_setting('mdg.stock_rendu', true) = '1' then return new; end if;   -- commande annulée : le stock revient (schéma 26)
  vendu := exists (select 1 from public.negociations n where n.cible = case tg_table_name when 'offres' then 'offre' else 'demande' end
                     and n.cible_id = old.id and n.statut = 'conclue' and coalesce(n.quantite_finale, 0) > 0);
  if not vendu then return new; end if;
  if old.status = 'retiree' and old.quantity <= 0 and coalesce(new.quantity, 0) > old.quantity then new.quantity := old.quantity; end if;
  if new.status = 'active' and coalesce(new.quantity, 0) <= 0 then new.status := old.status; end if;
  return new;
end $$;
revoke all on function public._stock_garde() from public, anon, authenticated;
create or replace trigger offres_stock_garde before update of quantity, status on public.offres for each row execute function public._stock_garde();
create or replace trigger demandes_stock_garde before update of quantity, status on public.demandes for each row execute function public._stock_garde();

-- le stock rendu par une commande annulée passe la garde
do $$ declare d text; begin
  d := pg_get_functiondef('public._cmd_rendre_stock(public.commandes)'::regprocedure);
  if position('mdg.stock_rendu' in d) > 0 then return; end if;
  d := replace(d, $q$  if n.id is null then return; end if;$q$, $q$  if n.id is null then return; end if;
  perform set_config('mdg.stock_rendu', '1', true);$q$);
  d := replace(d, $q$quantity = coalesce(quantity, 0) + c.quantite where id = n.cible_id; end if;$q$, $q$quantity = coalesce(quantity, 0) + c.quantite where id = n.cible_id; end if;
  perform set_config('mdg.stock_rendu', '', true);$q$);
  if (length(d) - length(replace(d, 'mdg.stock_rendu', ''))) / length('mdg.stock_rendu') <> 2 then raise exception '_cmd_rendre_stock : motif introuvable'; end if;
  execute d;
end $$;

-- la demande de gombo : sa quantité était remontée à 20 t par le renvoi du téléphone ; on remet ce que l'accord avait laissé (20 − 20 = 0)
update public.demandes d set quantity = 0
where d.status = 'retiree' and d.quantity > 0
  and (select coalesce(sum(n.quantite_finale), 0) from public.negociations n where n.cible = 'demande' and n.cible_id = d.id and n.statut = 'conclue') >= d.quantity;
