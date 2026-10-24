-- ═════════ Marché de Gros CI — schéma 92d : les avis du système partent en notification ═════════
-- Demande du propriétaire (24/10/2026) : rappels de chargement et de réception, retard, mot secret bloqué
-- doivent prévenir la bonne personne, sans toucher la contrainte de commande_etapes.
-- Chaque avis noté dans commande_alertes (schéma 92b) est mis dans la file des notifications transactionnelles
-- (notif_file, catégorie « commande », par _notif_mettre du schéma 88/91, sans changer les fonctions notif_*).
-- La tâche mdg-notif (notif_tick → pousser { lots: true }) les envoie ; les textes sont dans supabase/functions/pousser/index.ts
-- (types cmd_rappel_chargement, cmd_retard_chargement, cmd_rappel_reception, cmd_mot_bloque), écran ouvert : la commande.
-- Rien n'est effacé. Testé sur le projet de test.

create or replace function public._cmd_alerte_notif() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.commandes; u uuid; dests uuid[]; t text := 'cmd_' || new.evenement;
begin
  select * into c from public.commandes where id = new.commande_id;
  if c.id is null then return new; end if;
  dests := case new.evenement
    when 'rappel_chargement' then array[c.vendeur_id]
    when 'retard_chargement' then array[c.acheteur_id, c.vendeur_id]
    when 'rappel_reception' then array[c.acheteur_id]
    when 'mot_bloque' then array[c.acheteur_id, c.vendeur_id]
    else array[]::uuid[] end;
  foreach u in array dests loop
    perform public._notif_mettre(u, 'commande', t, 'cmdal:' || new.id || ':' || u, 'cmd:' || c.id, c.id::text, null, c.produit,
      'application.dc.html#/?commande=' || c.id,
      jsonb_build_object('role', case when u = c.vendeur_id then 'vendeur' else 'acheteur' end, 'numero', c.numero,
        'echeance', case new.evenement
          when 'rappel_chargement' then coalesce(c.confirme_le, c.created_at) + make_interval(hours => public._cmd_regle('chargement_heures', 72))
          when 'rappel_reception' then c.livre_le + make_interval(hours => public._cmd_regle('reception_heures', 24)) end));
  end loop;
  return new;
exception when others then return new;   -- une notification manquée ne bloque jamais la commande
end $$;
revoke all on function public._cmd_alerte_notif() from public, anon, authenticated;
create or replace trigger commande_alertes_notif after insert on public.commande_alertes
  for each row execute function public._cmd_alerte_notif();
