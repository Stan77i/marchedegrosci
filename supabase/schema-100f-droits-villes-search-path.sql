-- Schéma 100f : droits réduits sur villes_ref et search_path fixé (contrôle qualité ANO-037 et ANO-038, SEC-11, 25/10/2026).
-- 1. villes_ref : visiteurs (anon) et membres (authenticated) avaient tous les droits sur la table (test : arwdDxtm),
--    dont « vider la table », qui ignore la RLS ; en production, tout sauf la lecture (Dxtm). Seules les fonctions du serveur
--    lisent cette liste. Maintenant : lecture seule (la RLS sans règle laisse toujours 0 ligne à un appel direct).
-- 2. search_path modifiable (alerte get_advisors) sur _notif_rang, negocier, proposer_prix : fixé à public.
--    Corps inchangés. Les 7 fonctions du schéma _sim (simulation du projet de test) ne sont pas touchées.
-- Appliqué sur le projet de TEST le 25/10/2026. Production : après fusion, avec l'accord du propriétaire.

revoke all on table public.villes_ref from anon, authenticated;
grant select on table public.villes_ref to anon, authenticated;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure s from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('_notif_rang', 'negocier', 'proposer_prix')
             and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'))
  loop
    execute format('alter function %s set search_path = public', f.s);
  end loop;
end $$;
