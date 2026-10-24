-- Scénarios du schéma 95b (projet de test seulement). Tout est annulé par la dernière exception.
do $$
declare
  adm uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  chf uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9';
  trp uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  c1 uuid := '4bcea401-db94-4a3a-8958-33fb0efd5bef';  -- réseau, transport 50 000, sans séquestre
  c2 uuid := 'abac67eb-5bc0-40b5-8ac2-5a6fca538d71';  -- avec séquestre
  r text := ''; x text; mid uuid; leg uuid; leg_cmd uuid; j json;
begin
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  update public.commandes set mode_transport = 'reseau', validation = 'code', transport_regle = 'mgci' where id = c1;
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le, prix)
    values (c1, trp, adm, 'admin', 'acceptee', now(), 50000) returning id into mid;
  -- 1. clôture sans argent passé : « calculee »
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now() - interval '2 hours' where id = c1;
  update public.commandes set libere_le = now(), liberation = 'auto' where id = c1;
  perform public._ctr_sync(mid);
  select statut || '/' || coalesce(statut_registre, '-') into x from public.commissions where commande_id = c1;
  r := r || '1.vente=' || x;
  select statut || '/' || coalesce(statut_registre, '-') into x from public.commissions_transport where mission_id = mid;
  r := r || ' transport=' || coalesce(x, 'aucune');
  r := r || ' journal=' || (select motif from public.commission_journal jj join public.commissions k on k.id = jj.commission_id where k.commande_id = c1 order by jj.at desc limit 1);
  -- 2. avec un séquestre (argent passé par l'application) : « due »
  perform public.sequestre_depot_confirme(c2, 'wave', 'TEST-95B', (public._seq_repartition(c2)->>'total')::numeric);
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now() - interval '2 hours' where id = c2;
  update public.commandes set libere_le = now(), liberation = 'auto' where id = c2;
  select statut || '/' || coalesce(statut_registre, '-') into x from public.commissions where commande_id = c2;
  r := r || ' | 2.avec_sequestre=' || x;
  -- 3. une ligne « due » d'avant 95b ne change pas
  select k.id, k.commande_id into leg, leg_cmd from public.commissions k where k.statut = 'due' and k.statut_registre is null limit 1;
  update public.commandes set updated_at = now() where id = leg_cmd;
  select statut || '/' || coalesce(statut_registre, '-') into x from public.commissions where id = leg;
  r := r || ' | 3.ancienne=' || x;
  -- 4. lecture admin et vendeur
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.admin_commissions();
  r := r || ' | 4.admin_totaux=' || (j->'totaux')::text;
  j := public.admin_commissions_transport();
  r := r || ' admin_transport=' || (j->'totaux')::text;
  execute 'reset role';
  raise exception 'TEST: %', r;
end $$;
