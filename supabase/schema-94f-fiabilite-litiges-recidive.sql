-- Schéma 94f (équipe Confiance, audit du 24/10/2026, P2 n° 13 partie fiabilité et n° 28 ; partie 8 « litiges ouverts par l'autre partie ») :
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- 1. Un litige perdu est imputé à celui que l'équipe désigne fautif, même quand la commande se termine (avant : seulement si elle était
--    annulée). Exemple : l'acheteur ouvre un litige, l'équipe donne raison au vendeur et désigne l'acheteur fautif → « litige perdu »
--    imputé à l'acheteur. Il compte dans la fiabilité, les niveaux et, comme les annulations abusives, dans les paliers (90 jours).
-- 2. Compteur public : « litiges perdus » seulement (reputation_publique.litiges_perdus ; l'ancienne clé litiges_contre donne la même
--    valeur, pour les téléphones pas encore à jour). Un litige gagné ne se voit plus sur le profil.
-- 3. Récidive : seule une suspension allée à son terme (pas levée avant la fin) dans les 12 derniers mois compte (réglage recidive_mois).
-- 4. Motifs « panne / météo » et « stock épuisé » refusés par l'autre partie : annulation « à examiner » par l'équipe, sans sanction
--    automatique ; l'équipe la classe ensuite (admin_annulation_classer), et seulement alors la sanction éventuelle part.

alter table public.annulations add column if not exists a_examiner boolean not null default false;

create or replace function public._fiab_annulation()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ch text; dem uuid; imp uuid; cat text; mc text; mt text; acc boolean; aid uuid; f text; exam boolean := false;
begin
  if new.etat <> 'annulee' or old.etat = 'annulee' then return new; end if;
  mc := nullif(current_setting('mdg.fiab_motif', true), '');
  mt := nullif(current_setting('mdg.fiab_motif_texte', true), '');
  acc := nullif(current_setting('mdg.fiab_accord', true), '')::boolean;
  f := nullif(current_setting('mdg.fiab_fautif', true), '');
  if current_setting('mdg.fiab_chemin', true) = 'expiration' then
    ch := 'expiration'; dem := null; imp := null; cat := 'legitime'; mc := 'sans_reponse'; mt := null;
  elsif old.etat = 'a_confirmer' then
    ch := case when me is not null and me = old.cree_par then 'retrait' when me is not null then 'refus' else 'expiration' end;
    dem := me; imp := null; cat := 'legitime';
  elsif old.etat = 'litige' then
    ch := 'litige'; dem := old.litige_par; cat := 'litige';
    imp := case when f is not null and f::uuid in (old.vendeur_id, old.acheteur_id) then f::uuid end;
  elsif old.etat = 'en_cours' then
    ch := 'accord'; dem := old.annulation_par;
    mc := coalesce(old.annulation_motif, mc); mt := coalesce(old.annulation_motif_texte, mt);
    if acc is false then
      cat := 'abusive'; imp := dem;
      -- panne, météo, stock épuisé : l'équipe regarde avant toute sanction
      exam := mc in ('panne_meteo', 'stock_epuise');
    else cat := 'legitime'; imp := null; end if;
  else
    ch := 'autre'; dem := me; imp := null; cat := 'legitime';
  end if;
  insert into public.annulations (commande_id, groupe_id, vendeur_id, acheteur_id, auteur_id, demandeur_id, imputable_id, role_imputable,
    etat_avant, etape_avant, chemin, motif_code, motif_texte, accord, categorie, categorie_auto, a_examiner)
  values (new.id, new.groupe_id, new.vendeur_id, new.acheteur_id, me, dem, imp,
    case when imp is null then null when imp = new.vendeur_id then 'vendeur' else 'acheteur' end,
    old.etat, old.etape, ch, mc, left(mt, 300), acc, cat, cat, exam)
  on conflict (commande_id) do nothing
  returning id into aid;
  if aid is not null and not exam and cat in ('abusive', 'litige') and imp is not null then perform public._fiab_paliers(imp, aid); end if;
  return new;
end $$;

-- litige tranché en faveur de l'autre partie (commande terminée) : le fautif désigné par l'équipe porte un « litige perdu »
create or replace function public._fiab_litige_perdu()
returns trigger language plpgsql security definer set search_path = public as $$
declare f text := nullif(current_setting('mdg.fiab_fautif', true), ''); imp uuid; aid uuid;
begin
  if old.etat <> 'litige' or new.etat <> 'terminee' or f is null then return new; end if;
  imp := case when f::uuid in (old.vendeur_id, old.acheteur_id) then f::uuid end;
  if imp is null then return new; end if;
  insert into public.annulations (commande_id, groupe_id, vendeur_id, acheteur_id, auteur_id, demandeur_id, imputable_id, role_imputable,
    etat_avant, etape_avant, chemin, motif_code, motif_texte, accord, categorie, categorie_auto)
  values (new.id, new.groupe_id, new.vendeur_id, new.acheteur_id, auth.uid(), old.litige_par, imp,
    case when imp = new.vendeur_id then 'vendeur' else 'acheteur' end,
    old.etat, old.etape, 'litige', null, left(old.litige_motif, 300), null, 'litige', 'litige')
  on conflict (commande_id) do nothing
  returning id into aid;
  if aid is not null then perform public._fiab_paliers(imp, aid); end if;
  return new;
end $$;
create or replace trigger commandes_litige_perdu after update of etat on public.commandes
  for each row execute function public._fiab_litige_perdu();

-- paliers et score : annulations abusives ET litiges perdus ; rien de ce qui attend l'examen de l'équipe
create or replace function public._fiab_n90(p_uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct coalesce(a.groupe_id, a.commande_id))::integer from public.annulations a
  where a.imputable_id = p_uid and a.categorie in ('abusive', 'litige') and not a.a_examiner
    and a.cree_le > now() - make_interval(days => public._fiab_regle('fenetre_jours', 90));
$$;

create or replace function public._fiab_score(p_uid uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare t integer; i integer; n integer; poids integer; sur integer; pal text;
  sb integer := public._fiab_regle('seuil_baisse', 3); se integer := public._fiab_regle('seuil_examen', 5); sa integer := public._fiab_regle('seuil_avertissement', 1);
begin
  select count(*) into t from public.commandes c
  where p_uid in (c.vendeur_id, c.acheteur_id) and c.etat = 'terminee' and coalesce(c.termine_le, c.updated_at) >= public._fiab_debut();
  select count(distinct coalesce(a.groupe_id, a.commande_id)) into i from public.annulations a
  where a.imputable_id = p_uid and a.categorie in ('abusive', 'litige') and not a.a_examiner;
  n := public._fiab_n90(p_uid);
  poids := i + case when n >= se then 2 * n when n >= sb then n else 0 end;
  sur := t + i;
  pal := case when n >= se then 'examen' when n >= sb then 'baisse' when n >= sa then 'avertissement' else 'aucun' end;
  return json_build_object('pourcent', case when sur = 0 then null else round(100.0 * t / greatest(t + poids, 1))::integer end,
    'sur', sur, 'terminees', t, 'imputables', i, 'n90', n, 'palier', pal);
end $$;

-- récidive : seulement une suspension allée à son terme, dans les 12 derniers mois
create or replace function public.admin_suspendre(p_user uuid, p_motif text, p_jours integer default null)
returns json language plpgsql security definer set search_path = public as $$
declare j integer; sid uuid; m text := nullif(btrim(coalesce(p_motif, '')), ''); f timestamptz; rec boolean;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_user is null or public.est_admin_id(p_user) then raise exception 'Ce compte ne peut pas être suspendu.'; end if;
  if m is null or char_length(m) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  if public.est_suspendu(p_user) then raise exception 'Ce compte est déjà suspendu.'; end if;
  rec := exists (select 1 from public.sanctions s where s.user_id = p_user and s.type = 'suspension'
                  and s.fin <= now() and (s.levee_le is null or s.levee_le >= s.fin)
                  and s.fin > now() - make_interval(months => public._fiab_regle('recidive_mois', 12)));
  j := coalesce(p_jours, case when rec then public._fiab_regle('recidive_jours', 30) else public._fiab_regle('suspension_jours', 7) end);
  if j < 1 or j > 365 then raise exception 'Durée entre 1 et 365 jours.'; end if;
  f := now() + make_interval(days => j);
  insert into public.sanctions (user_id, type, debut, fin, motif, par, nb_90j)
  values (p_user, 'suspension', now(), f, m, auth.uid(), public._fiab_n90(p_user)) returning id into sid;
  update public.offres set status = 'masquee', suspension_id = sid where user_id = p_user and status = 'active';
  update public.demandes set status = 'masquee', suspension_id = sid where user_id = p_user and status = 'active';
  return json_build_object('id', sid, 'jours', j, 'fin', f, 'recidive', rec);
end $$;

create or replace function public.admin_fiabilite_regler(p_valeurs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'fiabilite' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('fenetre_jours', 'seuil_avertissement', 'seuil_baisse', 'seuil_examen', 'suspension_jours', 'recidive_jours',
                 'contestation_jours', 'reponse_jours', 'expiration_heures', 'recidive_mois') then raise exception 'Réglage inconnu : %', k; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 1 or (v #>> '{}')::numeric > 1000 then
      raise exception 'Valeur incorrecte pour %', k;
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  if (cur ->> 'seuil_avertissement')::int > (cur ->> 'seuil_baisse')::int or (cur ->> 'seuil_baisse')::int > (cur ->> 'seuil_examen')::int then
    raise exception 'Les seuils doivent monter : avertissement, puis baisse, puis examen.';
  end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'fiabilite';
  return cur::json;
end $$;
update public.reglages set valeur = jsonb_build_object('recidive_mois', 12) || valeur where cle = 'fiabilite';

-- classer une annulation la sort de l'examen ; la sanction éventuelle part seulement à ce moment
create or replace function public.admin_annulation_classer(p_id uuid, p_categorie text, p_imputable uuid default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.annulations; nt text := left(nullif(btrim(coalesce(p_note, '')), ''), 300); imp uuid;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_categorie not in ('abusive', 'legitime', 'litige', 'technique') then raise exception 'Catégorie inconnue.'; end if;
  select * into a from public.annulations where id = p_id for update;
  if a.id is null then raise exception 'Annulation introuvable.'; end if;
  if p_imputable is not null and p_imputable not in (a.vendeur_id, a.acheteur_id) then raise exception 'La personne doit être le vendeur ou l''acheteur.'; end if;
  imp := case when p_categorie in ('abusive', 'litige') then p_imputable end;
  if p_categorie = 'abusive' and imp is null then raise exception 'Une annulation abusive doit être imputée au vendeur ou à l''acheteur.'; end if;
  update public.annulations set categorie = p_categorie, imputable_id = imp, a_examiner = false,
    role_imputable = case when imp is null then null when imp = a.vendeur_id then 'vendeur' else 'acheteur' end,
    decide_par = auth.uid(), decide_le = now(), note_admin = coalesce(nt, note_admin) where id = a.id;
  update public.sanctions set levee_le = now(), levee_par = auth.uid(), levee_motif = 'Annulation requalifiée par l''équipe'
  where annulation_id = a.id and levee_le is null and (p_categorie not in ('abusive', 'litige') or user_id is distinct from imp);
  if p_categorie in ('abusive', 'litige') and imp is not null then
    update public.sanctions set user_id = imp where annulation_id = a.id and user_id is distinct from imp;
    perform public._fiab_paliers(imp, a.id);
  end if;
end $$;

-- tableau de bord : les annulations à examiner avant sanction
create or replace function public.admin_fiabilite()
returns json language plpgsql stable security definer set search_path = public as $$
declare se integer := public._fiab_regle('seuil_examen', 5);
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'reglages', (select valeur from public.reglages where cle = 'fiabilite'),
    'examen', coalesce((select json_agg(z order by z.n90 desc) from (
      select u.uid, public._fiab_qui(u.uid) qui, public._fiab_n90(u.uid) n90, public._fiab_score(u.uid) score,
        public.est_suspendu(u.uid) suspendu,
        (select count(*) from public.sanctions s where s.user_id = u.uid and s.type = 'suspension') suspensions
      from (select distinct imputable_id uid from public.annulations where imputable_id is not null and categorie in ('abusive', 'litige')) u
      where public._fiab_n90(u.uid) >= se) z), '[]'::json),
    'a_examiner', coalesce((select json_agg(z order by z.cree_le) from (
      select a.id, a.cree_le, a.chemin, a.motif_code, a.motif_texte, a.accord, a.categorie, a.role_imputable, k.numero, k.produit,
        a.vendeur_id, a.acheteur_id, a.imputable_id, public._fiab_qui(a.vendeur_id) vendeur, public._fiab_qui(a.acheteur_id) acheteur
      from public.annulations a left join public.commandes k on k.id = a.commande_id
      where a.a_examiner order by a.cree_le limit 100) z), '[]'::json),
    'contestations', coalesce((select json_agg(z order by z.ouverte desc, z.cree_le) from (
      select t.id, t.texte, t.statut, t.reponse, t.cree_le, t.decide_le, t.repondre_avant, t.statut = 'ouverte' ouverte,
        a.id annulation_id, a.categorie, a.chemin, a.motif_code, a.motif_texte, a.role_imputable, k.numero, k.produit,
        public._fiab_qui(t.auteur_id) qui
      from public.contestations t join public.annulations a on a.id = t.annulation_id left join public.commandes k on k.id = a.commande_id
      where t.statut = 'ouverte' or t.decide_le > now() - interval '30 days'
      order by t.cree_le desc limit 100) z), '[]'::json),
    'annulations', coalesce((select json_agg(z order by z.cree_le desc) from (
      select a.id, a.cree_le, a.chemin, a.motif_code, a.motif_texte, a.accord, a.categorie, a.categorie_auto, a.note_admin, a.decide_le,
        a.etat_avant, a.etape_avant, a.role_imputable, a.groupe_id, k.numero, k.produit, a.a_examiner,
        a.vendeur_id, a.acheteur_id, a.imputable_id, public._fiab_qui(a.vendeur_id) vendeur, public._fiab_qui(a.acheteur_id) acheteur
      from public.annulations a left join public.commandes k on k.id = a.commande_id
      order by a.cree_le desc limit 150) z), '[]'::json),
    'suspensions', coalesce((select json_agg(z order by z.fin) from (
      select s.id, s.user_id, s.debut, s.fin, s.motif, public._fiab_qui(s.user_id) qui
      from public.sanctions s where s.type = 'suspension' and s.levee_le is null and s.fin > now()) z), '[]'::json));
end $$;

-- profil public : litiges PERDUS seulement (un litige gagné ne pèse plus sur le profil)
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
              where k.cible_id = p_uid order by k.auteur_id, k.role_cible, k.updated_at desc) z
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

revoke execute on function public._fiab_litige_perdu() from public, anon, authenticated;

-- « Ma fiabilité » : une annulation à examiner n'affiche pas encore de catégorie (l'équipe n'a pas décidé) et ne se conteste pas encore
create or replace function public.ma_fiabilite()
returns json language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); cj integer := public._fiab_regle('contestation_jours', 7);
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  return json_build_object(
    'score', public._fiab_score(me),
    'debut', public._fiab_debut(),
    'fenetre_jours', public._fiab_regle('fenetre_jours', 90),
    'seuils', json_build_object('avertissement', public._fiab_regle('seuil_avertissement', 1), 'baisse', public._fiab_regle('seuil_baisse', 3), 'examen', public._fiab_regle('seuil_examen', 5)),
    'contestation_jours', cj,
    'suspension', (select json_build_object('fin', s.fin, 'motif', s.motif) from public.sanctions s where s.user_id = me and s.type = 'suspension'
                   and s.levee_le is null and now() >= s.debut and now() < s.fin order by s.fin desc limit 1),
    'non_vues', (select count(*) from public.sanctions s where s.user_id = me and s.vue_le is null and s.levee_le is null),
    'annulations', coalesce((select json_agg(x order by x.cree_le desc) from (
      select a.id, a.cree_le, a.chemin, a.motif_code, a.motif_texte,
        case when a.a_examiner then null when a.imputable_id is null or a.imputable_id = me then a.categorie end categorie, a.accord,
        a.a_examiner,
        case when a.imputable_id = me or t.id is not null then a.note_admin end note_admin,
        k.numero, k.produit,
        case when a.vendeur_id = me then 'vendeur' else 'acheteur' end mon_role,
        a.imputable_id = me and not a.a_examiner contre_moi, a.demandeur_id = me demande_par_moi,
        (a.imputable_id = me and not a.a_examiner and a.categorie in ('abusive', 'litige') and not exists (select 1 from public.contestations z where z.annulation_id = a.id)
          and now() <= greatest(a.cree_le, coalesce(a.decide_le, a.cree_le)) + make_interval(days => cj)) contestable,
        case when t.id is not null then json_build_object('statut', t.statut, 'texte', t.texte, 'reponse', t.reponse, 'cree_le', t.cree_le,
          'decide_le', t.decide_le, 'repondre_avant', t.repondre_avant) end contestation
      from public.annulations a
      left join public.commandes k on k.id = a.commande_id
      left join public.contestations t on t.annulation_id = a.id and t.auteur_id = me
      where me in (a.vendeur_id, a.acheteur_id)
      order by a.cree_le desc limit 100) x), '[]'::json),
    'sanctions', coalesce((select json_agg(y order by y.cree_le desc) from (
      select s.id, s.type, s.nb_90j, s.debut, s.fin, s.motif, s.levee_le, s.levee_motif, s.vue_le, s.cree_le
      from public.sanctions s where s.user_id = me order by s.cree_le desc limit 50) y), '[]'::json));
end $$;
