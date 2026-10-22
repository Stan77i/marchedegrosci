-- Marché de Gros CI — schéma 46 : les notifications du marché vont aussi aux comptes sans profil rempli.
-- Avant : push_diffusion_cible (annonces, achats groupés, besoins) et push_marketing_cible (notifications régulières)
-- exigeaient une ligne dans profils. Un téléphone abonné sur un compte qui n'a pas encore rempli son profil
-- (ex. le compte « Marché de Gros ») ne recevait donc rien. On garde l'exclusion des comptes supprimés (supprime_le).
do $$
declare f text; d text;
begin
  foreach f in array array['push_diffusion_cible(text,uuid[],integer)', 'push_marketing_cible()'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('join public.profils p on p.user_id = a.user_id and p.supprime_le is null' in d) = 0 then
      raise notice '% déjà corrigée', f; continue; end if;
    d := replace(d, 'join public.profils p on p.user_id = a.user_id and p.supprime_le is null', 'left join public.profils p on p.user_id = a.user_id');
    d := replace(d, 'where coalesce(r.diffusions, true)', 'where p.supprime_le is null and coalesce(r.diffusions, true)');
    execute d;
  end loop;
end $$;

-- Rythme des notifications régulières : une toutes les 25 minutes environ (avant : toutes les 30, la tâche ne passait que toutes
-- les 10 minutes). Écart minimal = (21 h − 7 h) / 30 − 5 min = 23 min ; la tâche passe toutes les 5 minutes → envoi à 25 min.
do $$ declare d text; begin
  d := pg_get_functiondef('public.marketing_tick()'::regprocedure);
  if position($q$- interval '2 minutes'$q$ in d) > 0 then
    execute replace(d, $q$- interval '2 minutes'$q$, $q$- interval '5 minutes'$q$);
  end if;
end $$;
select cron.schedule('mdg-marketing', '*/5 * * * *', $$select public.marketing_tick()$$);
