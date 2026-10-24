-- Schéma 94d (équipe Confiance, audit du 24/10/2026, P2 n° 12 ; partie 8 « badges fabricables ») : badges anti-complices.
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- Deux comptes complices ne fabriquent plus « Vendeur fiable », « Acheteur fiable », « Acheteur en gros » en quelques minutes :
--  • plafond par partenaire : une même paire compte au plus N commandes (réglage plafond_partenaire, 3 par défaut) pour les niveaux
--    qui n'ont pas leur propre plafond (Fiable, Bon) et pour « Acheteur en gros » ; Excellent et Grand gardent le leur (5) ;
--  • partenaires différents : chaque niveau et « Acheteur en gros » demandent au moins M partenaires différents
--    (réglage partenaires_min, 3 par défaut ; jamais plus que le nombre de commandes demandé) ;
--  • délai minimum entre la création de la commande et sa réception (réglage delai_min_minutes, 60 par défaut) ;
--  • alerte pour l'équipe sur les paires fermées (admin_paires_fermees, aussi dans admin_niveaux) : une paire qui a au moins
--    paire_alerte_commandes commandes terminées (3 par défaut) et qui fait au moins paire_alerte_part % (60 par défaut)
--    des commandes de l'un des deux.
-- Tous les réglages se changent dans le tableau de bord (admin_niveaux_regler), comme les autres réglages des niveaux.
-- Le pourcentage d'annulations abusives garde son calcul (toutes les commandes terminées après le délai minimum).

-- annulation « à examiner » par l'équipe avant toute sanction (schéma 94f) : ne compte nulle part tant qu'elle n'est pas classée
alter table public.annulations add column if not exists a_examiner boolean not null default false;

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
  -- commandes comptées : terminées dans la fenêtre, pas entièrement refusées, avec un partenaire ni lui-même ni banni,
  -- et reçues au moins dmin minutes après leur création
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
  -- annulations abusives et litiges perdus imputés dans ce rôle (un achat groupé compte une fois) ;
  -- les annulations légitimes, les litiges en cours et les litiges partagés ne comptent pas ; une annulation à examiner non plus
  select count(distinct coalesce(a.groupe_id, a.commande_id)) into abus from public.annulations a
  where a.imputable_id = p_uid and a.role_imputable = p_role and a.categorie in ('abusive', 'litige') and a.cree_le >= depuis
    and not coalesce(a.a_examiner, false);
  pct := case when n_all + abus = 0 then 0 else round(abus * 100.0 / (n_all + abus), 1) end;
  -- note : un avis par auteur (le plus récent), donné dans la fenêtre
  select round(avg(z.note)::numeric, 1), count(*) into note, navis from (
    select distinct on (k.auteur_id) k.note from public.avis_commandes k
    where k.cible_id = p_uid and k.role_cible = p_role and k.created_at >= depuis and k.auteur_id <> p_uid
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
    tous := tous and ok;          -- un niveau demande aussi tous les niveaux d'en dessous
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

-- paires fermées : deux comptes qui ne commercent presque qu'entre eux
create or replace function public.admin_paires_fermees()
returns json language plpgsql stable security definer set search_path = public as $$
declare depuis timestamptz := now() - make_interval(days => public._niv_regle('fenetre_jours', 365)::integer);
  seuil integer := public._niv_regle('paire_alerte_commandes', 3)::integer;
  part integer := public._niv_regle('paire_alerte_part', 60)::integer;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return coalesce((select json_agg(z order by z.n desc) from (
    with c as (select vendeur_id, acheteur_id, termine_le, created_at from public.commandes
               where etat = 'terminee' and termine_le >= depuis and vendeur_id <> acheteur_id),
    p as (select least(vendeur_id, acheteur_id) x, greatest(vendeur_id, acheteur_id) y, count(*) n,
                 min(termine_le - created_at) delai_min, max(termine_le) derniere from c group by 1, 2),
    t as (select u, count(*) n from (select vendeur_id u from c union all select acheteur_id from c) s group by u)
    select public._fiab_qui(p.x) a, public._fiab_qui(p.y) b, p.x a_id, p.y b_id, p.n,
      round(100.0 * p.n / tx.n) part_a, round(100.0 * p.n / ty.n) part_b,
      round(extract(epoch from p.delai_min) / 60) delai_min_minutes, p.derniere
    from p join t tx on tx.u = p.x join t ty on ty.u = p.y
    where p.n >= seuil and (p.n * 100 >= part * tx.n or p.n * 100 >= part * ty.n)
    order by p.n desc limit 50) z), '[]'::json);
end $$;

create or replace function public.admin_niveaux_regler(p_valeurs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; lim numeric[];
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'niveaux' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    lim := case k when 'fenetre_jours' then array[30, 1095] when 'grace_jours' then array[0, 365] when 'contestation_jours' then array[1, 60]
      when 'reponse_jours' then array[1, 60] when 'force_jours' then array[1, 365] when 'gros_commandes' then array[1, 1000]
      when 'gros_montant' then array[1, 10000000000]
      when 'plafond_partenaire' then array[1, 1000] when 'partenaires_min' then array[1, 100]
      when 'delai_min_minutes' then array[0, 10080] when 'paire_alerte_commandes' then array[2, 1000] when 'paire_alerte_part' then array[10, 100] end;
    if lim is null then raise exception 'Réglage inconnu : %', k; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric)
       or (v #>> '{}')::numeric < lim[1] or (v #>> '{}')::numeric > lim[2] then
      raise exception 'Valeur incorrecte pour % (de % à %)', k, lim[1], lim[2];
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'niveaux';
  perform public.niveaux_recalculer();
  return cur::json;
end $$;

-- les réglages par défaut s'affichent dans le tableau de bord (ajoutés seulement s'ils manquent)
update public.reglages set valeur = jsonb_build_object('plafond_partenaire', 3, 'partenaires_min', 3, 'delai_min_minutes', 60, 'paire_alerte_commandes', 3, 'paire_alerte_part', 60) || valeur
 where cle = 'niveaux';

create or replace function public.admin_niveaux()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'reglages', (select valeur from public.reglages where cle = 'niveaux'),
    'regles', (select json_agg(row_to_json(r) order by r.role desc, r.ordre) from public.niveaux_regles r),
    'repartition', (select coalesce(json_agg(json_build_object('role', z.role, 'niveau', z.niv, 'n', z.n)), '[]'::json) from (
        select y.role, y.niv, count(*) n from (select m.role, public._niv_effectif(m.user_id, m.role) niv from public.niveaux_membres m) y
        where y.niv is not null group by 1, 2) z),
    'gros', (select count(*) from public.niveaux_membres where role = 'acheteur' and gros),
    'en_grace', (select coalesce(json_agg(json_build_object('qui', public._fiab_qui(m.user_id), 'role', m.role, 'niveau', m.niveau,
        'vers', m.grace_vers, 'jusqua', m.grace_jusqua) order by m.grace_jusqua), '[]'::json)
      from public.niveaux_membres m where m.grace_jusqua is not null),
    'contestations', (select coalesce(json_agg(json_build_object('id', c.id, 'qui', public._fiab_qui(c.user_id), 'role', c.role,
        'niveau_avant', c.niveau_avant, 'niveau_actuel', c.niveau_actuel, 'texte', c.texte, 'statut', c.statut, 'reponse', c.reponse,
        'ouverte', c.statut = 'ouverte', 'cree_le', c.cree_le, 'repondre_avant', c.repondre_avant,
        'chiffres', (select m.chiffres from public.niveaux_membres m where m.user_id = c.user_id and m.role = c.role)) order by c.statut = 'ouverte' desc, c.cree_le desc), '[]'::json)
      from (select * from public.niveaux_contestations order by statut = 'ouverte' desc, cree_le desc limit 40) c),
    'journal', (select coalesce(json_agg(json_build_object('qui', public._fiab_qui(j.user_id), 'role', j.role, 'evenement', j.evenement,
        'ancien', j.ancien, 'nouveau', j.nouveau, 'raison', j.raison, 'at', j.at) order by j.at desc), '[]'::json)
      from (select * from public.niveaux_journal order by at desc limit 60) j),
    'paires', public.admin_paires_fermees());
end $$;

create or replace function public._niv_texte()
returns text language sql stable security definer set search_path = public as $$
  select 'Niveaux calculés par le serveur sur les commandes terminées des ' || public._niv_regle('fenetre_jours', 365)::integer || ' derniers jours, '
    || 'avec au moins ' || public._niv_regle('partenaires_min', 3)::integer || ' partenaires différents. '
    || string_agg(case cle when 'fiable' then 'Fiable' when 'bon' then 'Bon' when 'excellent' then 'Excellent' else 'Grand' end || ' : ' || commandes || ' commandes'
       || case when mois > 1 then ' sur ' || mois || ' mois différents' else '' end
       || case when code_requis then ' validées par code' else '' end
       || ' (au plus ' || coalesce(plafond_partenaire, public._niv_regle('plafond_partenaire', 3)::integer) || ' par partenaire)'
       || ', au plus ' || replace(abus_max::text, '.', ',') || ' % d''annulations abusives'
       || case when note_min is not null then ', note d''au moins ' || replace(note_min::text, '.', ',') || '/5' else '' end
       || case when volume_min is not null then ', au moins ' || replace(to_char(volume_min, 'FM999,999,999,999'), ',', ' ') || ' F CFA' else '' end
       || case when identite_requise then ', identité vérifiée' else '' end, ' ; ' order by ordre) || '.'
  from public.niveaux_regles where role = 'vendeur';
$$;

create or replace function public.niveaux_criteres()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'fenetre_jours', public._niv_regle('fenetre_jours', 365)::integer,
    'grace_jours', public._niv_regle('grace_jours', 30)::integer,
    'contestation_jours', public._niv_regle('contestation_jours', 7)::integer,
    'plafond_partenaire', public._niv_regle('plafond_partenaire', 3)::integer,
    'partenaires_min', public._niv_regle('partenaires_min', 3)::integer,
    'delai_min_minutes', public._niv_regle('delai_min_minutes', 60)::integer,
    'gros', json_build_object('commandes', public._niv_regle('gros_commandes', 5)::integer, 'montant', public._niv_regle('gros_montant', 500000)),
    'niveaux', (select coalesce(json_agg(json_build_object('role', role, 'cle', cle, 'ordre', ordre, 'libelle', libelle, 'commandes', commandes,
        'mois', mois, 'abus_max', abus_max, 'note_min', note_min, 'volume_min', volume_min, 'code_requis', code_requis,
        'identite_requise', identite_requise, 'plafond_partenaire', coalesce(plafond_partenaire, public._niv_regle('plafond_partenaire', 3)::integer)) order by role desc, ordre), '[]'::json)
      from public.niveaux_regles));
$$;

revoke execute on function public.admin_paires_fermees() from public, anon;
grant execute on function public.admin_paires_fermees() to authenticated;
