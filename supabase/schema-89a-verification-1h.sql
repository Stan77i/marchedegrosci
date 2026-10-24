-- ═════════ Marché de Gros CI — schéma 89 : vérification en 1 h, délais publics par rôle ═════════
-- Demandé par le propriétaire le 24/10/2026 : sans réclamation de l'acheteur dans l'heure qui suit la réception,
-- la commande se clôt toute seule (avant : 24 h, schéma 61). La tâche passe toutes les 5 minutes.
-- Délais publics : vendeur = livraison (confirmation → réception) ; acheteur = validation (réception → clôture).
-- Aucun paiement réel : « libération » = clôture de la commande. Aucun drop, aucune donnée effacée.

create or replace function public.sequestre_liberer_echus() returns integer
language plpgsql security definer set search_path = public as $$
declare c public.commandes; n integer := 0;
begin
  for c in select * from public.commandes where etat = 'terminee' and libere_le is null and termine_le < now() - interval '1 hour' for update skip locked loop
    perform public._seq_journal(c.id, 'liberee_auto', null, 'systeme', '1 h après la réception, sans réclamation');
    update public.commandes set libere_le = now(), liberation = 'auto' where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sequestre_liberer_echus() from public, anon, authenticated;
select cron.schedule('mdg-liberer-echus', '*/5 * * * *', 'select public.sequestre_liberer_echus()');

-- délais d'un membre (3 commandes au moins pour chaque mesure)
create or replace function public.delais_publics(p_uid uuid) returns json
language sql stable security definer set search_path = public as $$
  with l as (
    select percentile_cont(0.5) within group (order by extract(epoch from (rc.at - cf.at)) / 3600.0) h, count(*) n
    from public.commandes k
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'confirmee') cf on true
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'reception') rc on true
    where k.vendeur_id = p_uid and k.etat = 'terminee' and cf.at is not null and rc.at is not null
  ), v as (
    select percentile_cont(0.5) within group (order by extract(epoch from (k.libere_le - k.termine_le)) / 60.0) m, count(*) n
    from public.commandes k
    where k.acheteur_id = p_uid and k.etat = 'terminee' and k.libere_le is not null and k.termine_le is not null and k.liberation in ('conforme', 'auto')
  )
  select json_build_object(
    'livraison_h', (select case when n >= 3 then round(h::numeric, 0) end from l), 'livraison_n', (select n from l),
    'validation_min', (select case when n >= 3 then round(m::numeric, 0) end from v), 'validation_n', (select n from v))
  where not exists (select 1 from public.bannis b where b.user_id = p_uid)
$$;
revoke all on function public.delais_publics(uuid) from public;
grant execute on function public.delais_publics(uuid) to anon, authenticated;
