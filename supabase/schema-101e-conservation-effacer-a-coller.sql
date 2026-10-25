-- Schéma 101e : l'effacement des durées de conservation (décision juridique n° 22, accord du propriétaire « ok pour tout », 25/10/2026).
-- À COLLER PAR LE PROPRIÉTAIRE dans Supabase → SQL Editor → Run, APRÈS schema-101d-conservation.sql
-- (l'outil de Claude refuse tout texte qui contient le mot de suppression : ce fichier ne peut pas passer par lui).
-- D'abord sur le projet de test (yowdymdnoiubatxlwhfv), puis sur la production (catmsypctymgkjkfzdkt).
-- Peut être recollé sans danger. Il n'efface rien au moment où on le colle : c'est la tâche de nuit « mdg-conservation »
-- (02:41 UTC) qui l'appelle, et elle note chaque passage dans conservation_journal.
-- Ce qu'il retire : seulement les lignes données par les fonctions _cons_* du schéma 101d (une seule source pour compter et effacer).

create or replace function public._conservation_effacer() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n_notif int := 0; n_sig int := 0; n_sigm int := 0; n_masq int := 0; n_sanc int := 0; n_cont int := 0; n_annu int := 0;
  n_prop int := 0; n_cmd int := 0; n_nego int := 0;
begin
  delete from public.notif_journal where id in (select public._cons_notif());
  get diagnostics n_notif = row_count;
  delete from public.signalement_masquages where id in (select public._cons_masquages());
  get diagnostics n_masq = row_count;
  delete from public.signalements where id in (select public._cons_signalements());
  get diagnostics n_sig = row_count;
  delete from public.signalements_membres where id in (select public._cons_signalements_membres());
  get diagnostics n_sigm = row_count;
  delete from public.sanctions where id in (select public._cons_sanctions());
  get diagnostics n_sanc = row_count;
  -- commandes de plus de 5 ans : d'abord ce qui les retient (annulations et leurs contestations, propositions de transport)
  delete from public.contestations where annulation_id in (select public._cons_annulations());
  get diagnostics n_cont = row_count;
  delete from public.annulations where id in (select public._cons_annulations());
  get diagnostics n_annu = row_count;
  delete from public.transport_propositions where commande_id in (select public._cons_commandes())
     or mission_id in (select m.id from public.transport_missions m where m.commande_id in (select public._cons_commandes()));
  get diagnostics n_prop = row_count;
  update public.groupe_participants set commande_id = null where commande_id in (select public._cons_commandes());
  -- le reste de la commande part avec elle (étapes, codes, avis, commissions, séquestre, positions, itinéraire : ON DELETE CASCADE)
  delete from public.commandes where id in (select public._cons_commandes());
  get diagnostics n_cmd = row_count;
  -- négociations : leurs messages et détails partent avec elles (ON DELETE CASCADE)
  delete from public.negociations where id in (select public._cons_negociations());
  get diagnostics n_nego = row_count;
  return jsonb_build_object('notif_journal', n_notif, 'signalements', n_sig, 'signalements_membres', n_sigm, 'masquages', n_masq,
    'sanctions', n_sanc, 'contestations', n_cont, 'annulations', n_annu, 'transport_propositions', n_prop,
    'commandes', n_cmd, 'negociations', n_nego);
end $$;
revoke all on function public._conservation_effacer() from public, anon, authenticated;

-- photos de preuve de plus d'un an : l'équipe les retire par l'API Storage (écran de l'équipe), seulement celles de la liste
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'preuves : retrait équipe après conservation') then
    create policy "preuves : retrait équipe après conservation" on storage.objects for delete to authenticated
      using (bucket_id = 'preuves' and (select public.est_admin()) and (select public.preuve_purgeable(name)));
  end if;
end $$;

-- vérification : doit afficher une ligne « mdg-conservation »
select jobname, schedule, command, active from cron.job where jobname = 'mdg-conservation';
