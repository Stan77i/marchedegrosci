-- Schéma 96e : stockage_volume (projet de TEST ; annulé par l'exception). Résultat du 24/10/2026 :
-- TEST: membre refusé : Réservé à l'équipe. | admin : {"total_octets" : 0, "espaces" : [preuves, identite, avatars, activites : 0 fichier]}
do $$ declare adm uuid; mb uuid; r json; t text := 'membre accepté (erreur)'; begin
  select user_id into adm from public.admins limit 1;
  select user_id into mb from public.profils where user_id not in (select user_id from public.admins) limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', mb, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.stockage_volume(); exception when others then t := 'membre refusé : ' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  r := public.stockage_volume();
  raise exception 'TEST: % | admin : %', t, r::text;
end $$;
