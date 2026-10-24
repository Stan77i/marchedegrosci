-- Schéma 84c : fiabilité (chantier 2). Partie 3 : la réputation publique et les tâches planifiées.
-- reputation_publique garde tous ses champs (l'application en ligne continue de marcher) et en ajoute :
--   'fiabilite' : { pourcent, sur } (« Fiabilité : 96 % sur 25 commandes ») ;
--   par rôle, 'annulations_abusives' ; et 'fiable' compte désormais les annulations abusives imputées (plus les demandes).
-- Tâche planifiée : toutes les 15 minutes, les commandes sans réponse depuis 48 h expirent, et les suspensions finies rendent les annonces.
-- Testé sur le projet de test, pas encore appliqué en production.

create or replace function public.reputation_publique(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  with
  c as (select * from public.commandes where p_uid in (vendeur_id, acheteur_id) and etat <> 'a_confirmer'),
  r as (
    select role,
      count(*) filter (where etat = 'terminee') terminees,
      count(*) filter (where etat = 'annulee' and annulation_par = p_uid) annul_demandees,
      count(*) filter (where etat = 'annulee') annulees,
      count(*) filter (where litige_par is not null and litige_par <> p_uid) litiges_contre,
      count(*) total
    from (select *, case when vendeur_id = p_uid then 'vendeur' else 'acheteur' end role from c) x group by role
  ),
  ab as (select a.role_imputable role, count(distinct coalesce(a.groupe_id, a.commande_id)) n
         from public.annulations a where a.imputable_id = p_uid and a.categorie = 'abusive' group by a.role_imputable),
  n as (select role_cible role, round(avg(note)::numeric, 1) moyenne, count(*) nombre
        from (select distinct on (k.auteur_id, k.role_cible) k.role_cible, k.note from public.avis_commandes k
              where k.cible_id = p_uid order by k.auteur_id, k.role_cible, k.updated_at desc) z
        group by role_cible),
  d as (
    select percentile_cont(0.5) within group (order by extract(epoch from (rc.at - cf.at)) / 3600.0) h, count(*) n
    from public.commandes k
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'confirmee') cf on true
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'reception') rc on true
    where k.vendeur_id = p_uid and k.etat = 'terminee' and cf.at is not null and rc.at is not null
  ),
  role_json as (
    select ro.role, json_build_object(
      'terminees', coalesce(r.terminees, 0), 'annulations_demandees', coalesce(r.annul_demandees, 0), 'annulees', coalesce(r.annulees, 0),
      'annulations_abusives', coalesce(ab.n, 0),
      'litiges_contre', coalesce(r.litiges_contre, 0), 'total', coalesce(r.total, 0),
      'note', n.moyenne, 'avis', coalesce(n.nombre, 0),
      'fiable', coalesce(r.terminees, 0) >= 5
                and coalesce(ab.n, 0) * 10 <= coalesce(r.terminees, 0) + coalesce(ab.n, 0)
                and coalesce(r.litiges_contre, 0) * 20 <= coalesce(r.total, 0)
                and coalesce(n.nombre, 0) >= 3 and n.moyenne >= 4.0) j
    from (values ('vendeur'), ('acheteur')) ro(role)
    left join r on r.role = ro.role left join n on n.role = ro.role left join ab on ab.role = ro.role
  )
  select json_build_object(
    'verifie', public.identite_ok(p_uid),
    'vendeur', (select j from role_json where role = 'vendeur'),
    'acheteur', (select j from role_json where role = 'acheteur'),
    'fiabilite', public.fiabilite_publique(p_uid),
    'delai_median_h', (select case when n >= 3 then round(h::numeric, 0) end from d),
    'delai_n', (select n from d),
    'criteres_fiable', 'au moins 5 commandes terminées dans ce rôle, au plus 10 % d''annulations abusives, au plus 5 % de litiges ouverts par l''autre partie, au moins 3 avis de personnes différentes et une moyenne d''au moins 4/5',
    'ensemble', case when auth.uid() is not null and auth.uid() <> p_uid then
      (select count(*) from public.commandes x where x.etat = 'terminee'
        and ((x.vendeur_id = auth.uid() and x.acheteur_id = p_uid) or (x.vendeur_id = p_uid and x.acheteur_id = auth.uid()))) end)
  where not exists (select 1 from public.bannis b where b.user_id = p_uid)
    and not public.est_admin_id(p_uid);
$$;

create or replace function public.fiabilite_tick()
returns json language plpgsql security definer set search_path = public as $$
begin
  return json_build_object('expirees', public.commandes_expirer(), 'suspensions_finies', public.suspensions_echues());
end $$;
revoke all on function public.fiabilite_tick() from public, anon, authenticated;

select cron.schedule('mdg-fiabilite', '*/15 * * * *', 'select public.fiabilite_tick()');
