-- Schéma 100e : un avis ne compte que si sa commande est terminée (contrôle qualité ANO-020, BDD-04, 25/10/2026).
-- Avant : une commande terminée, notée, puis annulée par l'équipe après un litige gardait ses avis dans la note publique
-- (reputation_publique, notes_publiques, mieux_notes, statuts_publics, niveaux).
-- Maintenant : les avis liés à une commande qui n'est pas « terminee » ne sont plus comptés. Les lignes d'avis restent
-- en base (rien n'est effacé) ; si la commande redevenait terminée, l'avis compterait de nouveau.
-- Changements : _avis_tous (source de _avis_uniques, donc de notes_publiques, mieux_notes, statuts_publics),
-- reputation_publique (partie « note ») et _niv_calculer (note des niveaux). Le reste des fonctions est recopié tel quel.
-- Appliqué sur le projet de TEST le 25/10/2026. Production : après fusion, avec l'accord du propriétaire.

create or replace function public._avis_tous()
returns table(auteur_id uuid, cible_id uuid, note smallint, texte text, quand timestamptz, role_cible text, commande_id uuid)
language sql stable security definer set search_path = public as $$
  select a.auteur_id, a.cible_id, a.note, a.texte, a.updated_at, null::text, null::uuid from public.avis a
  union all
  select k.auteur_id, k.cible_id, k.note, k.texte, k.updated_at, k.role_cible, k.commande_id from public.avis_commandes k
  where exists (select 1 from public.commandes c where c.id = k.commande_id and c.etat = 'terminee');
$$;

create or replace function public.reputation_publique(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  with
  c as (select * from public.commandes where p_uid in (vendeur_id, acheteur_id) and etat <> 'a_confirmer'),
  r as (
    select role,
      count(*) filter (where etat = 'terminee') terminees,
      count(*) filter (where etat = 'annulee' and annulation_par = p_uid) annul_demandees,
      count(*) filter (where etat = 'annulee') annulees,
      count(*) total
    from (select *, case when vendeur_id = p_uid then 'vendeur' else 'acheteur' end role from c) x group by role
  ),
  ab as (select a.role_imputable role, count(distinct coalesce(a.groupe_id, a.commande_id)) n
         from public.annulations a where a.imputable_id = p_uid and a.categorie = 'abusive' and not a.a_examiner group by a.role_imputable),
  lp as (select a.role_imputable role, count(distinct a.commande_id) n
         from public.annulations a where a.imputable_id = p_uid and a.categorie = 'litige' and not a.a_examiner group by a.role_imputable),
  n as (select role_cible role, round(avg(note)::numeric, 1) moyenne, count(*) nombre
        from (select distinct on (k.auteur_id, k.role_cible) k.role_cible, k.note from public.avis_commandes k
              where k.cible_id = p_uid
                and exists (select 1 from public.commandes kc where kc.id = k.commande_id and kc.etat = 'terminee')   -- schéma 100e
              order by k.auteur_id, k.role_cible, k.updated_at desc) z
        group by role_cible),
  d as (
    select percentile_cont(0.5) within group (order by extract(epoch from (rc.at - cf.at)) / 3600.0) h, count(*) n
    from public.commandes k
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'confirmee') cf on true
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'reception') rc on true
    where k.vendeur_id = p_uid and k.etat = 'terminee' and cf.at is not null and rc.at is not null
  ),
  nv as (select ro.role, public._niv_effectif(p_uid, ro.role) niv from (values ('vendeur'), ('acheteur')) ro(role)),
  role_json as (
    select ro.role, json_build_object(
      'terminees', coalesce(r.terminees, 0), 'annulations_demandees', coalesce(r.annul_demandees, 0), 'annulees', coalesce(r.annulees, 0),
      'annulations_abusives', coalesce(ab.n, 0),
      'litiges_perdus', coalesce(lp.n, 0),
      'litiges_contre', coalesce(lp.n, 0), 'total', coalesce(r.total, 0),
      'note', n.moyenne, 'avis', coalesce(n.nombre, 0),
      'fiable', nv.niv is not null,
      'niveau', nv.niv,
      'niveau_libelle', (select libelle from public.niveaux_regles g where g.role = ro.role and g.cle = nv.niv),
      'gros', case when ro.role = 'acheteur' then coalesce((select m.gros from public.niveaux_membres m where m.user_id = p_uid and m.role = 'acheteur'), false) end) j
    from (values ('vendeur'), ('acheteur')) ro(role)
    left join r on r.role = ro.role left join n on n.role = ro.role left join ab on ab.role = ro.role
    left join lp on lp.role = ro.role left join nv on nv.role = ro.role
  )
  select json_build_object(
    'verifie', public.identite_ok(p_uid),
    'vendeur', (select j from role_json where role = 'vendeur'),
    'acheteur', (select j from role_json where role = 'acheteur'),
    'fiabilite', public.fiabilite_publique(p_uid),
    'delai_median_h', (select case when n >= 3 then round(h::numeric, 0) end from d),
    'delai_n', (select n from d),
    'criteres_fiable', public._niv_texte(),
    'ensemble', case when auth.uid() is not null and auth.uid() <> p_uid then
      (select count(*) from public.commandes x where x.etat = 'terminee'
        and ((x.vendeur_id = auth.uid() and x.acheteur_id = p_uid) or (x.vendeur_id = p_uid and x.acheteur_id = auth.uid()))) end)
  where not exists (select 1 from public.bannis b where b.user_id = p_uid)
    and not public.est_admin_id(p_uid);
$$;

create or replace function public._niv_calculer(p_uid uuid, p_role text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  depuis timestamptz := now() - make_interval(days => public._niv_regle('fenetre_jours', 365)::integer);
  pc integer := public._niv_regle('plafond_partenaire', 3)::integer;
  pm integer := public._niv_regle('partenaires_min', 3)::integer;
  dmin integer := public._niv_regle('delai_min_minutes', 60)::integer;
  exclu boolean; idok boolean; n_all integer; abus integer; pct numeric; note numeric; navis integer;
  vol_all numeric; mois_all integer; gros_n integer; gros_p integer; gros boolean := false;
  r record; n integer; m integer; vol numeric; np integer; ok boolean; tous boolean := true; niv text; detail jsonb := '[]'::jsonb;
begin
  exclu := p_uid is null or public.est_banni(p_uid) or public.est_admin_id(p_uid)
           or exists (select 1 from public.profils p where p.user_id = p_uid and p.supprime_le is not null);
  idok := public.identite_ok(p_uid);
  with c as (
    select k.termine_le, k.montant - coalesce(k.montant_refuse, 0) valeur,
      (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end) partenaire
    from public.commandes k
    where k.etat = 'terminee' and k.termine_le >= depuis
      and (case when p_role = 'vendeur' then k.vendeur_id else k.acheteur_id end) = p_uid
      and coalesce(k.montant_refuse, 0) < k.montant and k.vendeur_id <> k.acheteur_id
      and k.termine_le - k.created_at >= make_interval(mins => dmin)
      and not exists (select 1 from public.bannis b where b.user_id = (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end))),
  g as (select c.*, row_number() over (partition by partenaire order by termine_le desc) rn from c
        where valeur >= public._niv_regle('gros_montant', 500000))
  select (select count(*) from c), (select coalesce(sum(valeur), 0) from c), (select count(distinct date_trunc('month', termine_le)) from c),
         (select count(*) from g where rn <= pc), (select count(distinct partenaire) from g where rn <= pc)
    into n_all, vol_all, mois_all, gros_n, gros_p;
  select count(distinct coalesce(a.groupe_id, a.commande_id)) into abus from public.annulations a
  where a.imputable_id = p_uid and a.role_imputable = p_role and a.categorie in ('abusive', 'litige') and a.cree_le >= depuis
    and not coalesce(a.a_examiner, false);
  pct := case when n_all + abus = 0 then 0 else round(abus * 100.0 / (n_all + abus), 1) end;
  select round(avg(z.note)::numeric, 1), count(*) into note, navis from (
    select distinct on (k.auteur_id) k.note from public.avis_commandes k
    where k.cible_id = p_uid and k.role_cible = p_role and k.created_at >= depuis and k.auteur_id <> p_uid
      and exists (select 1 from public.commandes kc where kc.id = k.commande_id and kc.etat = 'terminee')   -- schéma 100e
    order by k.auteur_id, k.updated_at desc) z;
  for r in select * from public.niveaux_regles where role = p_role order by ordre loop
    with c as (
      select k.termine_le, k.montant - coalesce(k.montant_refuse, 0) valeur,
        (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end) partenaire,
        row_number() over (partition by (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end) order by k.termine_le desc) rn
      from public.commandes k
      where k.etat = 'terminee' and k.termine_le >= depuis
        and (case when p_role = 'vendeur' then k.vendeur_id else k.acheteur_id end) = p_uid
        and coalesce(k.montant_refuse, 0) < k.montant and k.vendeur_id <> k.acheteur_id
        and k.termine_le - k.created_at >= make_interval(mins => dmin)
        and (not r.code_requis or k.validation = 'code')
        and not exists (select 1 from public.bannis b where b.user_id = (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end)))
    select count(*), count(distinct date_trunc('month', termine_le)), coalesce(sum(valeur), 0), count(distinct partenaire) into n, m, vol, np
    from c where rn <= coalesce(r.plafond_partenaire, pc);
    ok := not exclu and n >= r.commandes and m >= r.mois and pct <= r.abus_max
          and np >= least(r.commandes, pm)
          and (r.note_min is null or (note is not null and note >= r.note_min))
          and (r.volume_min is null or vol >= r.volume_min)
          and (not r.identite_requise or idok);
    tous := tous and ok;
    if tous then niv := r.cle; end if;
    detail := detail || jsonb_build_object('cle', r.cle, 'ordre', r.ordre, 'libelle', r.libelle, 'ok', ok, 'atteint', tous,
      'commandes', n, 'mois', m, 'volume', vol, 'partenaires', np);
  end loop;
  if p_role = 'acheteur' and not exclu then
    gros := gros_n >= public._niv_regle('gros_commandes', 5) and gros_p >= least(public._niv_regle('gros_commandes', 5)::integer, pm);
  end if;
  return jsonb_build_object('niveau', niv, 'ordre', public._niv_ordre(p_role, niv), 'gros', gros, 'gros_commandes', gros_n,
    'commandes', n_all, 'volume', vol_all, 'mois', mois_all, 'abusives', abus, 'abus_pct', pct, 'note', note, 'avis', navis,
    'identite', idok, 'exclu', exclu, 'fenetre_jours', public._niv_regle('fenetre_jours', 365)::integer, 'detail', detail);
end $$;
