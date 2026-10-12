-- ═════════ Marché de Gros CI — étape 8 bis : effacement automatique des messages après 7 jours ═════════
-- À coller une fois dans Supabase → SQL Editor → Run (après schema-8.sql). Peut être relancé sans danger.
-- Toutes les heures (à la minute 23), les messages de plus de 7 jours et les conversations restées vides sont effacés.
-- En attendant, les messages de plus de 7 jours sont déjà invisibles (les fonctions de lecture les filtrent).
create extension if not exists pg_cron;

create or replace function public.dm_purger() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.dm where created_at < now() - public.dm_duree();
  delete from public.discussions where updated_at < now() - public.dm_duree();
end $$;
revoke execute on function public.dm_purger() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'mdg-effacer-messages') then
    perform cron.schedule('mdg-effacer-messages', '23 * * * *', 'select public.dm_purger()');
  end if;
end $$;

-- vérification : doit afficher une ligne « mdg-effacer-messages »
select jobname, schedule, command from cron.job where jobname = 'mdg-effacer-messages';
