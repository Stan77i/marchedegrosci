-- Schéma 88d : statistiques des notifications jour par jour, pour l'écran de l'administrateur (admin.html, « Notifications »).
-- Totaux seulement, aucun nom ni numéro. À appliquer après 88a et 88b. Appliqué sur le projet de test le 24/10/2026, appliqué en production le 24/10/2026.
create or replace function public.notif_stats_jours(p_jours int default 14)
returns json language plpgsql stable security definer set search_path = public as $$
declare n int := greatest(1, least(coalesce(p_jours, 14), 90));
begin
  if not public.est_admin() then raise exception 'Réservé à l''équipe.'; end if;
  return coalesce((select json_agg(x order by x.jour desc) from (
    select d::date as jour,
      (select count(*) from public.notif_journal j where j.resultat = 'ok' and j.cree_le >= d and j.cree_le < d + interval '1 day') as envoyees,
      (select count(*) from public.notif_journal j where j.ouvert_le >= d and j.ouvert_le < d + interval '1 day') as ouvertes,
      (select count(*) from public.notif_journal j where j.action_le >= d and j.action_le < d + interval '1 day') as actions,
      (select count(*) from public.notif_desactivations s where s.quand >= d and s.quand < d + interval '1 day') as desactivations
    from generate_series(date_trunc('day', now()) - make_interval(days => n - 1), date_trunc('day', now()), interval '1 day') d) x), '[]'::json);
end $$;
revoke execute on function public.notif_stats_jours(int) from public, anon;
grant execute on function public.notif_stats_jours(int) to authenticated;
